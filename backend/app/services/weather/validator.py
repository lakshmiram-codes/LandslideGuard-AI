import math
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, Any
from app.core.config import settings
from app.schemas.observation import DataQualityStatus
from app.services.weather.base import ProviderObservation

logger = logging.getLogger(__name__)

# Physical reasonableness boundaries for mountain meteorological variables
PHYSICAL_LIMITS = {
    "rainfall": (0.0, 500.0),            # mm/hour (0 to 500 mm)
    "temperature": (-80.0, 65.0),         # degrees Celsius
    "relative_humidity": (0.0, 100.0),    # percentage (0 to 100%)
    "soil_moisture": (0.0, 100.0),        # percentage saturation or volumetric %
    "surface_pressure": (300.0, 1100.0),  # hPa (low mountain pressure to sea level)
}

EXPECTED_UNITS = {
    "rainfall": ["mm", "mm/h", "millimeters"],
    "temperature": ["°C", "C", "celsius"],
    "relative_humidity": ["%"],
    "soil_moisture": ["%", "m³/m³", "volumetric_%"],
    "surface_pressure": ["hPa", "mb"],
}


class WeatherValidator:
    """Validates weather observations for physical plausibility, temporal integrity, and freshness."""

    @staticmethod
    def normalize_utc_timestamp(dt: datetime) -> datetime:
        """Ensures a datetime object is timezone-aware and normalized to UTC."""
        if dt.tzinfo is None:
            # Assume UTC if naive, per system policy
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    @classmethod
    def evaluate_quality_status(
        cls,
        observation: ProviderObservation,
        reference_time: Optional[datetime] = None,
    ) -> Tuple[DataQualityStatus, Optional[str]]:
        """
        Validates an observation against physical boundaries, future-skew tolerance,
        and freshness thresholds. Returns (DataQualityStatus, optional_reason).
        """
        now = reference_time or datetime.now(timezone.utc)
        now = cls.normalize_utc_timestamp(now)

        # 1. Null / None / NaN checks
        if observation.value is None or math.isnan(observation.value) or math.isinf(observation.value):
            return "INVALID", f"Measurement value for {observation.metric_type} is null, NaN, or infinite."

        # 2. Forecast distinction: Never silently label forecast data as measured
        if observation.is_forecast:
            return "FORECAST", "Record is a numerical forecast projection, not a measured historical observation."

        # 3. Unit validation
        metric = observation.metric_type.lower()
        if metric in EXPECTED_UNITS:
            allowed = EXPECTED_UNITS[metric]
            if observation.unit not in allowed and not any(u in observation.unit for u in allowed):
                logger.warning(f"Unexpected unit '{observation.unit}' for {metric}. Allowed: {allowed}")
                return "INVALID", f"Unexpected unit '{observation.unit}' for variable {metric}."

        # 4. Physical boundary check
        if metric in PHYSICAL_LIMITS:
            min_val, max_val = PHYSICAL_LIMITS[metric]
            if observation.value < min_val or observation.value > max_val:
                return "INVALID", (
                    f"Value {observation.value} {observation.unit} violates physical boundaries "
                    f"[{min_val}, {max_val}] for {metric}."
                )

        # 5. Temporal integrity & clock-skew tolerance
        obs_time = cls.normalize_utc_timestamp(observation.observed_at)
        skew_tolerance = timedelta(minutes=settings.WEATHER_CLOCK_SKEW_TOLERANCE_MINUTES)
        if obs_time > (now + skew_tolerance):
            skew_minutes = (obs_time - now).total_seconds() / 60
            return "INVALID", (
                f"Future-dated observation timestamp {obs_time.isoformat()} exceeds clock-skew "
                f"tolerance of {settings.WEATHER_CLOCK_SKEW_TOLERANCE_MINUTES}m (skew: +{skew_minutes:.1f}m)."
            )

        # 6. Freshness policy evaluation
        age_hours = (now - obs_time).total_seconds() / 3600.0

        if age_hours < 0:
            # Within forward skew tolerance: treat as current
            return "CURRENT", None

        if age_hours <= settings.WEATHER_FRESHNESS_HOURS_CURRENT:
            # Within configured current freshness window (e.g., 3 hours)
            return "CURRENT", None

        if age_hours <= settings.WEATHER_FRESHNESS_HOURS_STALE:
            # Between 3 hours and 24 hours: valid historical observation, but STALE for real-time trigger
            return "STALE", f"Observation is {age_hours:.1f}h old (exceeds {settings.WEATHER_FRESHNESS_HOURS_CURRENT}h real-time threshold)."

        # Beyond 24 hours
        return "STALE", f"Observation is stale ({age_hours / 24:.1f} days old)."

    @classmethod
    def can_supersede(
        cls,
        existing_observed_at: Optional[datetime],
        new_observed_at: datetime,
    ) -> bool:
        """
        Rule: Do not replace a valid recent observation with an older observation.
        Returns True if new_observed_at is greater than or equal to existing_observed_at.
        """
        if existing_observed_at is None:
            return True
        existing_utc = cls.normalize_utc_timestamp(existing_observed_at)
        new_utc = cls.normalize_utc_timestamp(new_observed_at)
        return new_utc >= existing_utc

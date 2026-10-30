import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.models.location import MonitoredLocation
from app.models.observation import EnvironmentalObservation
from app.schemas.observation import (
    DataQualityStatus,
    WeatherMetricSummary,
    LocationWeatherStatusResponse,
    PanIndiaWeatherStatusResponse,
    WeatherRefreshResponse,
)
from app.services.weather.base import BaseWeatherProvider
from app.services.weather.open_meteo import OpenMeteoProvider
from app.services.weather.validator import WeatherValidator

logger = logging.getLogger(__name__)


class WeatherService:
    """Orchestrates weather data retrieval, validation, deduplication, and persistence."""

    def __init__(self, provider: Optional[BaseWeatherProvider] = None):
        self._provider = provider or OpenMeteoProvider()
        self._validator = WeatherValidator()

    @property
    def provider(self) -> BaseWeatherProvider:
        return self._provider

    def refresh_location(
        self,
        location_id: int,
        db: Session,
        client: Optional[httpx.Client] = None,
    ) -> Dict[str, Any]:
        """
        Fetches external weather data for a single monitored location, validates each metric,
        and safely persists non-duplicate observations into the database.
        """
        location = db.query(MonitoredLocation).filter(MonitoredLocation.id == location_id).first()
        if not location:
            return {
                "success": False,
                "location_id": location_id,
                "error": f"Monitored location ID {location_id} does not exist.",
            }

        if location.latitude is None or location.longitude is None:
            return {
                "success": False,
                "location_id": location_id,
                "error": f"Location '{location.name}' has no valid coordinates.",
            }

        # 1. Fetch from provider
        fetch_result = self._provider.fetch_weather(
            latitude=location.latitude,
            longitude=location.longitude,
            elevation=location.elevation,
            client=client,
        )

        if not fetch_result.success:
            logger.warning(
                f"Failed weather fetch for location #{location_id} ({location.name}): {fetch_result.error_message}"
            )
            return {
                "success": False,
                "location_id": location_id,
                "location_name": location.name,
                "error": fetch_result.error_message,
                "http_status": fetch_result.http_status,
            }

        now_utc = datetime.now(timezone.utc)
        persisted_records: List[Dict[str, Any]] = []
        skipped_records: List[Dict[str, Any]] = []

        # 2. Validate and persist each observation
        for obs_payload in fetch_result.observations:
            quality_status, validation_reason = self._validator.evaluate_quality_status(
                obs_payload, reference_time=now_utc
            )

            if quality_status == "INVALID":
                logger.warning(
                    f"Rejected INVALID observation for location #{location_id}: {validation_reason}"
                )
                skipped_records.append({
                    "metric_type": obs_payload.metric_type,
                    "reason": validation_reason,
                    "status": "INVALID",
                })
                continue

            obs_time = self._validator.normalize_utc_timestamp(obs_payload.observed_at)

            # 3. Deduplication & Idempotent Upsert
            existing = (
                db.query(EnvironmentalObservation)
                .filter(
                    EnvironmentalObservation.location_id == location_id,
                    EnvironmentalObservation.observation_type == obs_payload.metric_type,
                    EnvironmentalObservation.observed_at == obs_time,
                )
                .first()
            )

            raw_meta_str = json.dumps(obs_payload.raw_metadata) if obs_payload.raw_metadata else None

            if existing:
                # Update existing record if new retrieval has more recent retrieval time
                existing.quality_status = quality_status
                existing.is_forecast = obs_payload.is_forecast
                existing.retrieved_at = now_utc
                if raw_meta_str:
                    existing.raw_metadata = raw_meta_str
                persisted_records.append({
                    "metric_type": obs_payload.metric_type,
                    "value": existing.value,
                    "unit": existing.unit,
                    "action": "updated",
                    "quality_status": quality_status,
                })
            else:
                # Insert fresh observation
                new_obs = EnvironmentalObservation(
                    location_id=location_id,
                    observation_type=obs_payload.metric_type,
                    value=obs_payload.value,
                    unit=obs_payload.unit,
                    observed_at=obs_time,
                    source=obs_payload.source,
                    provenance_metadata=obs_payload.provenance_metadata,
                    quality_status=quality_status,
                    is_forecast=obs_payload.is_forecast,
                    retrieved_at=now_utc,
                    raw_metadata=raw_meta_str,
                )
                db.add(new_obs)
                persisted_records.append({
                    "metric_type": obs_payload.metric_type,
                    "value": obs_payload.value,
                    "unit": obs_payload.unit,
                    "action": "inserted",
                    "quality_status": quality_status,
                })

        db.commit()

        return {
            "success": True,
            "location_id": location_id,
            "location_name": location.name,
            "provider": self._provider.provider_name,
            "persisted_count": len(persisted_records),
            "skipped_count": len(skipped_records),
            "persisted": persisted_records,
            "skipped": skipped_records,
            "retrieved_at": now_utc.isoformat(),
        }

    def refresh_pan_india_batch(
        self,
        db: Session,
        max_locations: int = 25,
        client: Optional[httpx.Client] = None,
    ) -> WeatherRefreshResponse:
        """
        Executes a bounded batch refresh across active monitored locations in India.
        """
        locations = (
            db.query(MonitoredLocation)
            .filter(MonitoredLocation.is_active == True)
            .limit(max_locations)
            .all()
        )

        refreshed = 0
        failed = 0
        skipped = 0
        details: List[Dict[str, Any]] = []

        should_close = False
        if client is None:
            client = httpx.Client(timeout=settings.WEATHER_REQUEST_TIMEOUT_SECONDS)
            should_close = True

        try:
            for loc in locations:
                res = self.refresh_location(loc.id, db, client=client)
                details.append(res)
                if res.get("success"):
                    refreshed += 1
                else:
                    failed += 1
        finally:
            if should_close:
                client.close()

        return WeatherRefreshResponse(
            status="completed" if failed == 0 else "completed_with_errors",
            provider=self._provider.provider_name,
            refreshed_count=refreshed,
            failed_count=failed,
            skipped_count=skipped,
            timestamp_utc=datetime.now(timezone.utc),
            details=details,
        )

    def get_location_weather_status(
        self,
        location_id: int,
        db: Session,
    ) -> LocationWeatherStatusResponse:
        """Constructs an audited weather status response for a single monitored location."""
        location = db.query(MonitoredLocation).filter(MonitoredLocation.id == location_id).first()
        if not location:
            raise ValueError(f"Location ID {location_id} not found.")

        # Query latest observations per metric type
        now_utc = datetime.now(timezone.utc)
        metrics = ["rainfall", "soil_moisture", "temperature", "relative_humidity"]
        summaries: Dict[str, Optional[WeatherMetricSummary]] = {}

        last_retrieved: Optional[datetime] = None

        for m in metrics:
            obs = (
                db.query(EnvironmentalObservation)
                .filter(
                    EnvironmentalObservation.location_id == location_id,
                    EnvironmentalObservation.observation_type == m,
                )
                .order_by(EnvironmentalObservation.observed_at.desc())
                .first()
            )

            if obs:
                # Re-evaluate freshness dynamically based on current clock
                age_hours = (now_utc - self._validator.normalize_utc_timestamp(obs.observed_at)).total_seconds() / 3600.0
                curr_status = obs.quality_status
                if curr_status != "INVALID" and not obs.is_forecast:
                    if age_hours <= settings.WEATHER_FRESHNESS_HOURS_CURRENT:
                        curr_status = "CURRENT"
                    else:
                        curr_status = "STALE"

                summaries[m] = WeatherMetricSummary(
                    metric_type=obs.observation_type,
                    value=obs.value,
                    unit=obs.unit,
                    observed_at=obs.observed_at,
                    quality_status=curr_status,
                    is_forecast=obs.is_forecast,
                    source=obs.source,
                )
                if obs.retrieved_at and (last_retrieved is None or obs.retrieved_at > last_retrieved):
                    last_retrieved = obs.retrieved_at
            else:
                summaries[m] = None

        # Determine overall location data-quality status
        # Priority: CURRENT > STALE > MISSING
        rf = summaries.get("rainfall")
        sm = summaries.get("soil_moisture")

        if (rf and rf.quality_status == "CURRENT") or (sm and sm.quality_status == "CURRENT"):
            overall: DataQualityStatus = "CURRENT"
        elif (rf and rf.quality_status == "STALE") or (sm and sm.quality_status == "STALE"):
            overall = "STALE"
        else:
            overall = "MISSING"

        is_demo = "[DEMO]" in location.name

        return LocationWeatherStatusResponse(
            location_id=location.id,
            location_name=location.name,
            state=location.state,
            district=location.district,
            latitude=location.latitude,
            longitude=location.longitude,
            overall_status=overall,
            latest_rainfall=summaries.get("rainfall"),
            latest_soil_moisture=summaries.get("soil_moisture"),
            latest_temperature=summaries.get("temperature"),
            latest_humidity=summaries.get("relative_humidity"),
            last_retrieved_at=last_retrieved,
            provider_name=self._provider.provider_name,
            provider_coverage="Pan-India High Resolution (ECMWF/GFS)",
            is_demo=is_demo,
        )

    def get_pan_india_summary(self, db: Session) -> PanIndiaWeatherStatusResponse:
        """Constructs an audited pan-India weather summary across all monitored locations."""
        locations = db.query(MonitoredLocation).order_by(MonitoredLocation.state.asc(), MonitoredLocation.name.asc()).all()
        loc_statuses: List[LocationWeatherStatusResponse] = []

        cur_count = 0
        stale_count = 0
        missing_count = 0
        error_count = 0

        latest_sync: Optional[datetime] = None

        for loc in locations:
            stat = self.get_location_weather_status(loc.id, db)
            loc_statuses.append(stat)

            if stat.overall_status == "CURRENT":
                cur_count += 1
            elif stat.overall_status == "STALE":
                stale_count += 1
            elif stat.overall_status == "MISSING":
                missing_count += 1
            else:
                error_count += 1

            if stat.last_retrieved_at:
                if latest_sync is None or stat.last_retrieved_at > latest_sync:
                    latest_sync = stat.last_retrieved_at

        # Unique states/regions represented
        regions = sorted(list(set(loc.state for loc in locations)))

        # Provider health check
        health = self._provider.health_check()

        return PanIndiaWeatherStatusResponse(
            provider_name=self._provider.provider_name,
            provider_status=health.get("status", "unknown"),
            provider_docs_url=self._provider.documentation_url,
            attribution=self._provider.attribution_text,
            last_sync_utc=latest_sync,
            total_monitored_locations=len(locations),
            locations_current=cur_count,
            locations_stale=stale_count,
            locations_missing=missing_count,
            locations_invalid_or_error=error_count,
            monitored_regions=regions,
            locations=loc_statuses,
        )

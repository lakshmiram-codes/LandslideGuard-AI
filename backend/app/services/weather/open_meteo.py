import time
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import httpx

from app.core.config import settings
from app.services.weather.base import (
    BaseWeatherProvider,
    ProviderFetchResult,
    ProviderObservation,
)

logger = logging.getLogger(__name__)


class OpenMeteoProvider(BaseWeatherProvider):
    """
    Open-Meteo Weather API Provider.
    
    Verified Documentation: https://open-meteo.com/en/docs
    Attribution: Weather data by Open-Meteo.com under CC BY 4.0
    Coverage: Pan-India high-resolution numerical weather models (ECMWF IFS, GFS, ICON).
    """

    PROVIDER_NAME = "Open-Meteo Weather API"
    DOCUMENTATION_URL = "https://open-meteo.com/en/docs"
    ATTRIBUTION_TEXT = "Weather data provided by Open-Meteo.com (CC BY 4.0)"

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_retries: Optional[int] = None,
    ):
        self._api_url = api_url or settings.OPEN_METEO_API_URL
        self._api_key = api_key or settings.OPEN_METEO_API_KEY
        self._timeout_seconds = timeout_seconds or settings.WEATHER_REQUEST_TIMEOUT_SECONDS
        self._max_retries = max_retries or settings.WEATHER_MAX_RETRIES

    @property
    def provider_name(self) -> str:
        return self.PROVIDER_NAME

    @property
    def documentation_url(self) -> str:
        return self.DOCUMENTATION_URL

    @property
    def attribution_text(self) -> str:
        return self.ATTRIBUTION_TEXT

    def fetch_weather(
        self,
        latitude: float,
        longitude: float,
        elevation: Optional[float] = None,
        client: Optional[httpx.Client] = None,
    ) -> ProviderFetchResult:
        """
        Fetches current weather and recent soil moisture analysis from Open-Meteo.
        Executes bounded retries with exponential backoff on transient errors.
        """
        params: Dict[str, Any] = {
            "latitude": round(latitude, 4),
            "longitude": round(longitude, 4),
            "current": "precipitation,rain,showers,temperature_2m,relative_humidity_2m,surface_pressure",
            "hourly": "precipitation,soil_moisture_0_to_1cm",
            "past_days": 1,
            "forecast_days": 1,
            "timezone": "UTC",
        }

        if elevation is not None:
            params["elevation"] = round(elevation, 1)

        # Pass commercial API key if configured
        if self._api_key:
            params["apikey"] = self._api_key

        headers = {
            "User-Agent": f"LandslideGuardAI/{settings.VERSION} (Disaster Monitoring & Early Warning)",
            "Accept": "application/json",
        }

        # Build request execution with bounded retries
        last_error: Optional[str] = None
        http_status: Optional[int] = None

        should_close_client = False
        if client is None:
            client = httpx.Client(timeout=self._timeout_seconds)
            should_close_client = True

        try:
            for attempt in range(1, self._max_retries + 1):
                try:
                    response = client.get(self._api_url, params=params, headers=headers)
                    http_status = response.status_code

                    # Handle Rate Limiting (HTTP 429)
                    if response.status_code == 429:
                        retry_after = response.headers.get("Retry-After")
                        wait_sec = float(retry_after) if retry_after else (0.5 * (2 ** (attempt - 1)))
                        logger.warning(
                            f"Open-Meteo 429 Rate Limit exceeded for ({latitude}, {longitude}). "
                            f"Attempt {attempt}/{self._max_retries}. Backoff: {wait_sec}s."
                        )
                        if attempt < self._max_retries:
                            time.sleep(wait_sec)
                            continue
                        return ProviderFetchResult(
                            success=False,
                            provider_name=self.PROVIDER_NAME,
                            latitude=latitude,
                            longitude=longitude,
                            http_status=429,
                            error_message="Open-Meteo API rate limit exceeded (HTTP 429). Retry later.",
                        )

                    # Handle 5xx Server Errors
                    if response.status_code >= 500:
                        logger.warning(
                            f"Open-Meteo 5xx server error ({response.status_code}) on attempt {attempt}/{self._max_retries}."
                        )
                        if attempt < self._max_retries:
                            time.sleep(0.4 * (2 ** (attempt - 1)))
                            continue
                        return ProviderFetchResult(
                            success=False,
                            provider_name=self.PROVIDER_NAME,
                            latitude=latitude,
                            longitude=longitude,
                            http_status=response.status_code,
                            error_message=f"Open-Meteo server error HTTP {response.status_code}.",
                        )

                    # Handle 4xx Client Errors (e.g. invalid lat/lon out of range)
                    if response.status_code >= 400:
                        return ProviderFetchResult(
                            success=False,
                            provider_name=self.PROVIDER_NAME,
                            latitude=latitude,
                            longitude=longitude,
                            http_status=response.status_code,
                            error_message=f"Open-Meteo client error HTTP {response.status_code}: {response.text[:200]}",
                        )

                    # Success - Parse JSON
                    data = response.json()
                    observations = self._parse_open_meteo_payload(data, latitude, longitude)

                    return ProviderFetchResult(
                        success=True,
                        provider_name=self.PROVIDER_NAME,
                        latitude=latitude,
                        longitude=longitude,
                        observations=observations,
                        http_status=200,
                    )

                except httpx.TimeoutException as exc:
                    last_error = f"Connection timeout after {self._timeout_seconds}s: {exc}"
                    logger.warning(f"Timeout on attempt {attempt}/{self._max_retries} for ({latitude}, {longitude}): {exc}")
                    if attempt < self._max_retries:
                        time.sleep(0.3 * (2 ** (attempt - 1)))
                except httpx.NetworkError as exc:
                    last_error = f"Network transport error: {exc}"
                    logger.warning(f"Network error on attempt {attempt}/{self._max_retries}: {exc}")
                    if attempt < self._max_retries:
                        time.sleep(0.3 * (2 ** (attempt - 1)))
                except json.JSONDecodeError as exc:
                    return ProviderFetchResult(
                        success=False,
                        provider_name=self.PROVIDER_NAME,
                        latitude=latitude,
                        longitude=longitude,
                        error_message=f"Malformed JSON response from Open-Meteo: {exc}",
                    )

            return ProviderFetchResult(
                success=False,
                provider_name=self.PROVIDER_NAME,
                latitude=latitude,
                longitude=longitude,
                http_status=http_status,
                error_message=last_error or "Exhausted all retry attempts reaching Open-Meteo.",
            )
        finally:
            if should_close_client:
                client.close()

    def health_check(self, client: Optional[httpx.Client] = None) -> Dict[str, Any]:
        """Performs a lightweight ping for central India coordinates."""
        try:
            res = self.fetch_weather(latitude=22.8, longitude=80.2, client=client)
            return {
                "provider": self.PROVIDER_NAME,
                "status": "healthy" if res.success else "unavailable",
                "http_status": res.http_status,
                "error": res.error_message,
                "attribution": self.ATTRIBUTION_TEXT,
                "documentation": self.DOCUMENTATION_URL,
            }
        except Exception as exc:
            return {
                "provider": self.PROVIDER_NAME,
                "status": "unavailable",
                "error": str(exc),
                "attribution": self.ATTRIBUTION_TEXT,
                "documentation": self.DOCUMENTATION_URL,
            }

    def _parse_open_meteo_payload(
        self,
        data: Dict[str, Any],
        latitude: float,
        longitude: float,
    ) -> List[ProviderObservation]:
        """Normalizes Open-Meteo response dictionary into structured ProviderObservations."""
        observations: List[ProviderObservation] = []

        current = data.get("current")
        current_units = data.get("current_units", {})

        if not current:
            logger.warning(f"No 'current' section in Open-Meteo response for ({latitude}, {longitude})")
            return observations

        # 1. Parse Observation Timestamp (ISO8601 UTC)
        raw_time = current.get("time")
        if not raw_time:
            logger.warning("Missing 'time' in Open-Meteo current weather payload.")
            return observations

        try:
            # Open-Meteo returns '2026-10-29T14:15'
            obs_dt = datetime.fromisoformat(raw_time)
            if obs_dt.tzinfo is None:
                obs_dt = obs_dt.replace(tzinfo=timezone.utc)
        except Exception as exc:
            logger.warning(f"Failed to parse Open-Meteo timestamp '{raw_time}': {exc}")
            return observations

        meta_dict = {
            "elevation": data.get("elevation"),
            "generationtime_ms": data.get("generationtime_ms"),
            "utc_offset_seconds": data.get("utc_offset_seconds"),
            "model": "ECMWF/GFS Analysis Nowcast",
            "provider": self.PROVIDER_NAME,
        }

        # 2. Rainfall / Precipitation (mm)
        # Note: Do not convert missing into 0.0! Only record if non-None numeric value exists.
        precip = current.get("precipitation")
        if precip is not None:
            unit = current_units.get("precipitation", "mm")
            observations.append(
                ProviderObservation(
                    metric_type="rainfall",
                    value=float(precip),
                    unit=unit,
                    observed_at=obs_dt,
                    is_forecast=False,
                    source=f"Open-Meteo Analysis ({unit})",
                    provenance_metadata="ECMWF/GFS numerical weather analysis nowcast",
                    raw_metadata=meta_dict,
                )
            )

        # 3. Temperature 2m (°C)
        temp = current.get("temperature_2m")
        if temp is not None:
            unit = current_units.get("temperature_2m", "°C")
            observations.append(
                ProviderObservation(
                    metric_type="temperature",
                    value=float(temp),
                    unit=unit,
                    observed_at=obs_dt,
                    is_forecast=False,
                    source=f"Open-Meteo Analysis ({unit})",
                    provenance_metadata="2m surface air temperature",
                    raw_metadata=meta_dict,
                )
            )

        # 4. Relative Humidity 2m (%)
        humidity = current.get("relative_humidity_2m")
        if humidity is not None:
            unit = current_units.get("relative_humidity_2m", "%")
            observations.append(
                ProviderObservation(
                    metric_type="relative_humidity",
                    value=float(humidity),
                    unit=unit,
                    observed_at=obs_dt,
                    is_forecast=False,
                    source=f"Open-Meteo Analysis ({unit})",
                    provenance_metadata="2m relative humidity",
                    raw_metadata=meta_dict,
                )
            )

        # 5. Surface Pressure (hPa)
        pressure = current.get("surface_pressure")
        if pressure is not None:
            unit = current_units.get("surface_pressure", "hPa")
            observations.append(
                ProviderObservation(
                    metric_type="surface_pressure",
                    value=float(pressure),
                    unit=unit,
                    observed_at=obs_dt,
                    is_forecast=False,
                    source=f"Open-Meteo Analysis ({unit})",
                    provenance_metadata="Surface atmospheric barometric pressure",
                    raw_metadata=meta_dict,
                )
            )

        # 6. Soil Moisture from Hourly Slice (Latest Measured/Analysis Entry)
        hourly = data.get("hourly", {})
        hourly_times = hourly.get("time", [])
        soil_moisture_vals = hourly.get("soil_moisture_0_to_1cm", [])

        if hourly_times and soil_moisture_vals:
            # Find the most recent entry with time <= now or closest to obs_dt
            best_idx = -1
            best_dt = obs_dt
            for idx, h_time in enumerate(hourly_times):
                try:
                    h_dt = datetime.fromisoformat(h_time).replace(tzinfo=timezone.utc)
                    # Don't pick future forecast slices for measured soil moisture
                    if h_dt <= obs_dt and idx < len(soil_moisture_vals) and soil_moisture_vals[idx] is not None:
                        best_idx = idx
                        best_dt = h_dt
                except Exception:
                    continue

            if best_idx >= 0 and soil_moisture_vals[best_idx] is not None:
                # Open-Meteo reports volumetric soil moisture in m³/m³ (0.0 to ~0.55 m³/m³)
                # Explicit conversion to volumetric percentage: 0.30 m³/m³ -> 30.0%
                raw_sm = float(soil_moisture_vals[best_idx])
                volumetric_pct = round(raw_sm * 100.0, 1)

                observations.append(
                    ProviderObservation(
                        metric_type="soil_moisture",
                        value=volumetric_pct,
                        unit="%",
                        observed_at=best_dt,
                        is_forecast=False,
                        source="Open-Meteo Soil Model (0-1cm)",
                        provenance_metadata=f"Volumetric soil moisture: {raw_sm} m³/m³ converted to {volumetric_pct}%",
                        raw_metadata={**meta_dict, "raw_volumetric_value": raw_sm, "raw_unit": "m³/m³"},
                    )
                )

        return observations

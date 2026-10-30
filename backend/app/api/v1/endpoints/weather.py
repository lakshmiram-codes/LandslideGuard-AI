import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.observation import (
    LocationWeatherStatusResponse,
    PanIndiaWeatherStatusResponse,
    WeatherRefreshResponse,
)
from app.services.weather.service import WeatherService

logger = logging.getLogger(__name__)

router = APIRouter()
weather_service = WeatherService()


@router.get(
    "/status",
    response_model=PanIndiaWeatherStatusResponse,
    summary="Get Pan-India weather provider status and location telemetry coverage",
)
def get_pan_india_weather_status(
    db: Session = Depends(get_db),
) -> PanIndiaWeatherStatusResponse:
    """
    Returns an audited overview of external weather provider connectivity, data freshness,
    and a summary breakdown of how many monitored locations have CURRENT, STALE, or MISSING data.
    """
    return weather_service.get_pan_india_summary(db)


@router.get(
    "/locations/{location_id}/latest",
    response_model=LocationWeatherStatusResponse,
    summary="Get latest audited weather telemetry for a specific location",
)
def get_location_weather_latest(
    location_id: int,
    db: Session = Depends(get_db),
) -> LocationWeatherStatusResponse:
    """
    Retrieves the latest verified meteorological observations (rainfall, soil moisture,
    temperature, relative humidity) for a monitored location, including data quality status,
    forecast vs. measured distinction, and provider attribution.
    """
    try:
        return weather_service.get_location_weather_status(location_id, db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post(
    "/refresh",
    response_model=WeatherRefreshResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger a controlled on-demand weather telemetry refresh",
)
def refresh_weather_telemetry(
    location_id: Optional[int] = Query(
        None,
        ge=1,
        description="Optional single location ID to refresh. If omitted, refreshes active monitored locations.",
    ),
    db: Session = Depends(get_db),
) -> WeatherRefreshResponse:
    """
    Triggers an on-demand, bounded weather fetch from the configured external provider (Open-Meteo).
    Validates, normalizes, and deduplicates observations before persisting to PostgreSQL.
    """
    if location_id is not None:
        result = weather_service.refresh_location(location_id, db)
        if not result.get("success"):
            # Check if location not found
            if "does not exist" in result.get("error", ""):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=result.get("error"),
                )
            # Provider failure or coordinate error
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Weather provider error: {result.get('error')}",
            )
        return WeatherRefreshResponse(
            status="completed",
            provider=weather_service.provider.provider_name,
            refreshed_count=1,
            failed_count=0,
            skipped_count=result.get("skipped_count", 0),
            timestamp_utc=datetime.now(timezone.utc),
            details=[result],
        )

    # Batch refresh for pan-India locations
    return weather_service.refresh_pan_india_batch(db)

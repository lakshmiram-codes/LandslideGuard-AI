import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
import httpx

from app.schemas.observation import DataQualityStatus
from app.services.weather.base import (
    BaseWeatherProvider,
    ProviderObservation,
    ProviderFetchResult,
)
from app.services.weather.validator import WeatherValidator
from app.services.weather.open_meteo import OpenMeteoProvider
from app.services.weather.service import WeatherService
from app.models.location import MonitoredLocation
from app.models.observation import EnvironmentalObservation


# -------------------------------------------------------------
# Test 1-6: WeatherValidator Unit Tests (Deterministic)
# -------------------------------------------------------------
def test_validator_valid_observation():
    """Test 1: Valid provider observation evaluates to CURRENT."""
    now = datetime.now(timezone.utc)
    obs = ProviderObservation(
        metric_type="rainfall",
        value=24.5,
        unit="mm",
        observed_at=now - timedelta(minutes=30),
        is_forecast=False,
    )
    status, reason = WeatherValidator.evaluate_quality_status(obs, reference_time=now)
    assert status == "CURRENT"
    assert reason is None


def test_validator_null_or_nan_value():
    """Test 3: Null and NaN values evaluate to INVALID."""
    now = datetime.now(timezone.utc)
    obs = ProviderObservation(
        metric_type="rainfall",
        value=float("nan"),
        unit="mm",
        observed_at=now - timedelta(minutes=10),
    )
    status, reason = WeatherValidator.evaluate_quality_status(obs, reference_time=now)
    assert status == "INVALID"
    assert "NaN" in reason


def test_validator_invalid_unit():
    """Test 4: Unrecognized metric units evaluate to INVALID."""
    now = datetime.now(timezone.utc)
    obs = ProviderObservation(
        metric_type="rainfall",
        value=15.0,
        unit="gallons",  # invalid unit
        observed_at=now - timedelta(minutes=10),
    )
    status, reason = WeatherValidator.evaluate_quality_status(obs, reference_time=now)
    assert status == "INVALID"
    assert "Unexpected unit" in reason


def test_validator_out_of_bounds_value():
    """Test: Negative rainfall or absurd pressure evaluates to INVALID."""
    now = datetime.now(timezone.utc)
    obs = ProviderObservation(
        metric_type="rainfall",
        value=-5.0,  # Negative precipitation is physically impossible
        unit="mm",
        observed_at=now - timedelta(minutes=10),
    )
    status, reason = WeatherValidator.evaluate_quality_status(obs, reference_time=now)
    assert status == "INVALID"
    assert "violates physical boundaries" in reason


def test_validator_future_dated_timestamp():
    """Test 5: Timestamps exceeding clock-skew tolerance evaluate to INVALID."""
    now = datetime.now(timezone.utc)
    obs = ProviderObservation(
        metric_type="rainfall",
        value=12.0,
        unit="mm",
        observed_at=now + timedelta(hours=2),  # +2 hours in the future
    )
    status, reason = WeatherValidator.evaluate_quality_status(obs, reference_time=now)
    assert status == "INVALID"
    assert "clock-skew" in reason


def test_validator_stale_observation():
    """Test 6: Observations older than 3 hours evaluate to STALE."""
    now = datetime.now(timezone.utc)
    obs = ProviderObservation(
        metric_type="rainfall",
        value=10.0,
        unit="mm",
        observed_at=now - timedelta(hours=5),  # 5 hours old
    )
    status, reason = WeatherValidator.evaluate_quality_status(obs, reference_time=now)
    assert status == "STALE"
    assert "5.0h old" in reason


def test_validator_forecast_separation():
    """Test 7: Forecast values are labeled FORECAST and never treated as measured nowcast."""
    now = datetime.now(timezone.utc)
    obs = ProviderObservation(
        metric_type="rainfall",
        value=30.0,
        unit="mm",
        observed_at=now + timedelta(hours=6),
        is_forecast=True,  # explicitly forecast
    )
    status, reason = WeatherValidator.evaluate_quality_status(obs, reference_time=now)
    assert status == "FORECAST"
    assert "numerical forecast projection" in reason


def test_validator_can_supersede():
    """Test: Validates that an older observation cannot supersede a newer observation."""
    t_old = datetime(2026, 10, 29, 10, 0, tzinfo=timezone.utc)
    t_new = datetime(2026, 10, 29, 11, 0, tzinfo=timezone.utc)
    assert WeatherValidator.can_supersede(t_old, t_new) is True
    assert WeatherValidator.can_supersede(t_new, t_old) is False


# -------------------------------------------------------------
# Test 8-12: OpenMeteoProvider Mocked HTTP Tests
# -------------------------------------------------------------
def test_open_meteo_mocked_success():
    """Test: OpenMeteoProvider parses standard API response cleanly."""
    mock_payload = {
        "latitude": 27.34,
        "longitude": 88.61,
        "elevation": 1650.0,
        "current_units": {
            "time": "iso8601",
            "precipitation": "mm",
            "temperature_2m": "°C",
            "relative_humidity_2m": "%",
            "surface_pressure": "hPa",
        },
        "current": {
            "time": "2026-10-29T10:00",
            "precipitation": 14.2,
            "temperature_2m": 16.5,
            "relative_humidity_2m": 88.0,
            "surface_pressure": 845.0,
        },
        "hourly": {
            "time": ["2026-10-29T09:00", "2026-10-29T10:00"],
            "soil_moisture_0_to_1cm": [0.32, 0.35],
        },
    }

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = mock_payload
    mock_client.get.return_value = mock_response

    provider = OpenMeteoProvider()
    result = provider.fetch_weather(latitude=27.34, longitude=88.61, client=mock_client)

    assert result.success is True
    assert result.http_status == 200
    assert len(result.observations) == 5  # rainfall, temp, humidity, pressure, soil_moisture

    rainfall_obs = next(o for o in result.observations if o.metric_type == "rainfall")
    assert rainfall_obs.value == 14.2
    assert rainfall_obs.unit == "mm"
    assert rainfall_obs.is_forecast is False

    soil_obs = next(o for o in result.observations if o.metric_type == "soil_moisture")
    assert soil_obs.value == 35.0  # 0.35 * 100
    assert soil_obs.unit == "%"


def test_open_meteo_missing_rainfall():
    """Test 2: Provider response without precipitation does not fabricate 0.0 rainfall."""
    mock_payload = {
        "latitude": 27.34,
        "longitude": 88.61,
        "current_units": {"temperature_2m": "°C"},
        "current": {
            "time": "2026-10-29T10:00",
            "precipitation": None,  # Missing / unavailable
            "temperature_2m": 22.0,
        },
    }

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = mock_payload
    mock_client.get.return_value = mock_response

    provider = OpenMeteoProvider()
    result = provider.fetch_weather(latitude=27.34, longitude=88.61, client=mock_client)

    assert result.success is True
    # Rainfall must NOT be in observations if precipitation was None
    assert not any(o.metric_type == "rainfall" for o in result.observations)
    # Temperature should be present
    assert any(o.metric_type == "temperature" for o in result.observations)


def test_open_meteo_rate_limit_429():
    """Test 11: HTTP 429 rate-limiting is handled gracefully."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_response.headers = {"Retry-After": "1"}
    mock_client.get.return_value = mock_response

    provider = OpenMeteoProvider(max_retries=1)
    result = provider.fetch_weather(latitude=27.34, longitude=88.61, client=mock_client)

    assert result.success is False
    assert result.http_status == 429
    assert "rate limit" in result.error_message.lower()


def test_open_meteo_timeout_handling():
    """Test 9: Timeout exceptions do not crash and produce an error result."""
    mock_client = MagicMock()
    mock_client.get.side_effect = httpx.TimeoutException("Connection timed out")

    provider = OpenMeteoProvider(max_retries=1)
    result = provider.fetch_weather(latitude=27.34, longitude=88.61, client=mock_client)

    assert result.success is False
    assert "timeout" in result.error_message.lower()


# -------------------------------------------------------------
# Test 13: Database Persistence & Deduplication
# -------------------------------------------------------------
def test_weather_service_persistence_and_deduplication(db_session):
    """Test 8 & 13: Ingestion idempotency — identical timestamp updates without duplicating rows."""
    # Create test location
    loc = MonitoredLocation(
        name="[TEST] Munnar Weather Test Station",
        state="Kerala",
        district="Idukki",
        latitude=10.0889,
        longitude=77.0595,
        elevation=1530.0,
        is_active=True,
    )
    db_session.add(loc)
    db_session.commit()

    obs_time = datetime(2026, 10, 29, 9, 0, tzinfo=timezone.utc)
    mock_obs = [
        ProviderObservation(
            metric_type="rainfall",
            value=18.5,
            unit="mm",
            observed_at=obs_time,
            source="Mock Open-Meteo",
        ),
        ProviderObservation(
            metric_type="temperature",
            value=21.0,
            unit="°C",
            observed_at=obs_time,
            source="Mock Open-Meteo",
        ),
    ]

    mock_provider = MagicMock(spec=BaseWeatherProvider)
    mock_provider.provider_name = "Mock Provider"
    mock_provider.fetch_weather.return_value = ProviderFetchResult(
        success=True,
        provider_name="Mock Provider",
        latitude=loc.latitude,
        longitude=loc.longitude,
        observations=mock_obs,
    )

    service = WeatherService(provider=mock_provider)

    # First Ingestion
    res1 = service.refresh_location(loc.id, db_session)
    assert res1["success"] is True
    assert res1["persisted_count"] == 2

    count_after_first = (
        db_session.query(EnvironmentalObservation)
        .filter(EnvironmentalObservation.location_id == loc.id)
        .count()
    )
    assert count_after_first == 2

    # Second Ingestion with identical timestamps (Idempotency check)
    res2 = service.refresh_location(loc.id, db_session)
    assert res2["success"] is True

    count_after_second = (
        db_session.query(EnvironmentalObservation)
        .filter(EnvironmentalObservation.location_id == loc.id)
        .count()
    )
    # Count must remain 2 (updated in-place, zero duplicate rows inserted)
    assert count_after_second == 2

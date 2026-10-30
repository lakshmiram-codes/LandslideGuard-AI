import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.models.location import MonitoredLocation
from app.models.observation import EnvironmentalObservation
from app.services.weather.base import ProviderObservation, ProviderFetchResult


def test_weather_status_endpoint(client: TestClient, db_session):
    """Test 14: GET /api/v1/weather/status returns structured summary."""
    # Seed a location
    loc = MonitoredLocation(
        name="[TEST] Shillong Peak Weather Test",
        state="Meghalaya",
        district="East Khasi Hills",
        latitude=25.5342,
        longitude=91.8478,
        elevation=1965.0,
        is_active=True,
    )
    db_session.add(loc)
    db_session.commit()

    response = client.get("/api/v1/weather/status")
    assert response.status_code == 200
    data = response.json()

    assert "provider_name" in data
    assert "provider_status" in data
    assert "total_monitored_locations" in data
    assert data["total_monitored_locations"] >= 1
    assert "locations_current" in data
    assert "locations_stale" in data
    assert "locations_missing" in data
    assert isinstance(data["locations"], list)


def test_location_weather_latest_endpoint_missing_data(client: TestClient, db_session):
    """Test 15: Station with no observations returns MISSING with 'No data available' semantics."""
    loc = MonitoredLocation(
        name="[TEST] Remote Arunachal Escarpment",
        state="Arunachal Pradesh",
        district="Tawang",
        latitude=27.5861,
        longitude=91.8594,
        elevation=3048.0,
        is_active=True,
    )
    db_session.add(loc)
    db_session.commit()

    response = client.get(f"/api/v1/weather/locations/{loc.id}/latest")
    assert response.status_code == 200
    data = response.json()

    assert data["location_id"] == loc.id
    assert data["overall_status"] == "MISSING"
    assert data["latest_rainfall"] is None
    assert data["latest_soil_moisture"] is None
    assert data["last_retrieved_at"] is None


def test_location_weather_latest_endpoint_with_data(client: TestClient, db_session):
    """Test: Station with validated observations returns CURRENT metrics."""
    loc = MonitoredLocation(
        name="[TEST] Wayanad Telemetered Slope",
        state="Kerala",
        district="Wayanad",
        latitude=11.5312,
        longitude=76.1345,
        elevation=950.0,
        is_active=True,
    )
    db_session.add(loc)
    db_session.commit()

    now = datetime.now(timezone.utc)
    obs = EnvironmentalObservation(
        location_id=loc.id,
        observation_type="rainfall",
        value=52.0,
        unit="mm",
        observed_at=now - timedelta(minutes=45),
        source="Open-Meteo Analysis (mm)",
        quality_status="CURRENT",
        is_forecast=False,
        retrieved_at=now,
    )
    db_session.add(obs)
    db_session.commit()

    response = client.get(f"/api/v1/weather/locations/{loc.id}/latest")
    assert response.status_code == 200
    data = response.json()

    assert data["location_id"] == loc.id
    assert data["overall_status"] == "CURRENT"
    assert data["latest_rainfall"] is not None
    assert data["latest_rainfall"]["value"] == 52.0
    assert data["latest_rainfall"]["unit"] == "mm"
    assert data["latest_rainfall"]["quality_status"] == "CURRENT"
    assert data["latest_rainfall"]["is_forecast"] is False


def test_location_weather_not_found(client: TestClient):
    """Test: 404 is returned when querying non-existent location ID."""
    response = client.get("/api/v1/weather/locations/999999/latest")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@patch("app.services.weather.open_meteo.OpenMeteoProvider.fetch_weather")
def test_mocked_refresh_endpoint_single_location(mock_fetch, client: TestClient, db_session):
    """Test: POST /api/v1/weather/refresh with single location_id using mocked provider."""
    loc = MonitoredLocation(
        name="[TEST] Panthyal Refresh Test",
        state="Jammu and Kashmir",
        district="Ramban",
        latitude=33.2505,
        longitude=75.2014,
        elevation=1420.0,
        is_active=True,
    )
    db_session.add(loc)
    db_session.commit()

    now = datetime.now(timezone.utc)
    mock_fetch.return_value = ProviderFetchResult(
        success=True,
        provider_name="Mock Open-Meteo Provider",
        latitude=loc.latitude,
        longitude=loc.longitude,
        observations=[
            ProviderObservation(
                metric_type="rainfall",
                value=8.4,
                unit="mm",
                observed_at=now - timedelta(minutes=15),
                source="Mock Open-Meteo",
            )
        ],
    )

    response = client.post(f"/api/v1/weather/refresh?location_id={loc.id}")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "completed"
    assert data["refreshed_count"] == 1
    assert data["failed_count"] == 0
    assert len(data["details"]) == 1
    assert data["details"][0]["success"] is True


def test_refresh_endpoint_nonexistent_location(client: TestClient):
    """Test: POST /api/v1/weather/refresh with invalid location_id returns 404."""
    response = client.post("/api/v1/weather/refresh?location_id=999999")
    assert response.status_code == 404
    assert "does not exist" in response.json()["detail"]

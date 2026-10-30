from datetime import datetime, timezone, timedelta


def test_create_and_get_observation(client):
    """Test creating an observation linked to a valid location."""
    # Create location first
    loc_res = client.post(
        "/api/v1/locations",
        json={
            "name": "Cherrapunji Monitored Station",
            "state": "Meghalaya",
            "district": "East Khasi Hills",
            "latitude": 25.2700,
            "longitude": 91.7300,
        },
    )
    assert loc_res.status_code == 201
    loc_id = loc_res.json()["id"]

    now = datetime.now(timezone.utc)
    obs_payload = {
        "location_id": loc_id,
        "observation_type": "rainfall",
        "value": 115.4,
        "unit": "mm",
        "observed_at": now.isoformat(),
        "source": "IMD Automated AWS Station 01",
        "provenance_metadata": "Calibrated tipping bucket gauge",
    }
    res = client.post("/api/v1/observations", json=obs_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["value"] == 115.4
    assert data["observation_type"] == "rainfall"
    obs_id = data["id"]

    # Get by ID
    get_res = client.get(f"/api/v1/observations/{obs_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == obs_id


def test_observation_nonexistent_location(client):
    """Test creating observation for non-existent location returns 404."""
    now = datetime.now(timezone.utc)
    payload = {
        "location_id": 99999,
        "observation_type": "soil_moisture",
        "value": 45.0,
        "unit": "%",
        "observed_at": now.isoformat(),
        "source": "TDR Sensor",
    }
    res = client.post("/api/v1/observations", json=payload)
    assert res.status_code == 404
    assert "does not exist" in res.json()["detail"]


def test_foreign_key_delete_protection(client):
    """Test that deleting a location with dependent observations returns 409 Conflict."""
    loc_res = client.post(
        "/api/v1/locations",
        json={
            "name": "Protected Catchment Zone",
            "state": "Sikkim",
            "district": "North Sikkim",
            "latitude": 27.5000,
            "longitude": 88.6000,
        },
    )
    loc_id = loc_res.json()["id"]

    # Add an observation
    client.post(
        "/api/v1/observations",
        json={
            "location_id": loc_id,
            "observation_type": "pore_water_pressure",
            "value": 24.5,
            "unit": "kPa",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "source": "Piezometer Sensor #12",
        },
    )

    # Attempt delete -> 409
    del_res = client.delete(f"/api/v1/locations/{loc_id}")
    assert del_res.status_code == 409
    assert "environmental observation(s) reference it" in del_res.json()["detail"]


def test_observation_filtering_and_pagination(client):
    """Test listing observations with type and time-range filtering."""
    loc_res = client.post(
        "/api/v1/locations",
        json={
            "name": "Mawlynnong Sensor Site",
            "state": "Meghalaya",
            "district": "East Khasi Hills",
            "latitude": 25.2000,
            "longitude": 91.8000,
        },
    )
    loc_id = loc_res.json()["id"]

    base_time = datetime.now(timezone.utc)
    # Add 2 rainfall and 1 soil_moisture observation
    client.post(
        "/api/v1/observations",
        json={
            "location_id": loc_id,
            "observation_type": "rainfall",
            "value": 50.0,
            "unit": "mm",
            "observed_at": (base_time - timedelta(hours=2)).isoformat(),
            "source": "Gauge 1",
        },
    )
    client.post(
        "/api/v1/observations",
        json={
            "location_id": loc_id,
            "observation_type": "rainfall",
            "value": 75.0,
            "unit": "mm",
            "observed_at": (base_time - timedelta(hours=1)).isoformat(),
            "source": "Gauge 1",
        },
    )
    client.post(
        "/api/v1/observations",
        json={
            "location_id": loc_id,
            "observation_type": "soil_moisture",
            "value": 60.0,
            "unit": "%",
            "observed_at": base_time.isoformat(),
            "source": "Moisture Sensor",
        },
    )

    # Filter by rainfall
    rain_res = client.get(f"/api/v1/observations?location_id={loc_id}&observation_type=rainfall")
    assert rain_res.status_code == 200
    assert rain_res.json()["total"] == 2

    # Filter by soil moisture
    moist_res = client.get(f"/api/v1/observations?location_id={loc_id}&observation_type=soil_moisture")
    assert moist_res.status_code == 200
    assert moist_res.json()["total"] == 1

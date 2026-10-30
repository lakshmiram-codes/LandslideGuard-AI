"""Integration tests for Phase 6 explainable assessment and alert safeguard endpoints."""

from fastapi.testclient import TestClient
from app.models.location import MonitoredLocation
from app.models.observation import EnvironmentalObservation
from app.models.alert import Alert
from datetime import datetime, timezone, timedelta


def test_data_readiness_endpoint(client: TestClient, db_session):
    """GET /api/v1/risk-assessments/data-readiness returns complete data readiness audit."""
    response = client.get("/api/v1/risk-assessments/data-readiness")
    assert response.status_code == 200
    data = response.json()

    assert "total_locations" in data
    assert "ml_readiness_verdict" in data
    assert "INSUFFICIENT DATA" in data["ml_readiness_verdict"]
    assert "prerequisites_for_ml_deployment" in data
    assert isinstance(data["available_features"], list)
    assert isinstance(data["missing_features"], list)


def test_explain_assessment_endpoint(client: TestClient, db_session):
    """GET /api/v1/risk-assessments/explain/{location_id} returns factor breakdown."""
    loc = MonitoredLocation(
        name="Explain Endpoint Test Location",
        state="Meghalaya",
        district="East Khasi Hills",
        latitude=25.53,
        longitude=91.85,
        elevation=1965.0,
        slope_angle=42.0,
    )
    db_session.add(loc)
    db_session.commit()

    now = datetime.now(timezone.utc)
    obs = EnvironmentalObservation(
        location_id=loc.id,
        observation_type="rainfall",
        value=85.0,
        unit="mm",
        observed_at=now - timedelta(hours=1),
        source="IMD AWS Shillong Test",
        quality_status="CURRENT",
    )
    obs_moist = EnvironmentalObservation(
        location_id=loc.id,
        observation_type="soil_moisture",
        value=78.0,
        unit="%",
        observed_at=now - timedelta(hours=1),
        source="In-situ Sensor Test",
        quality_status="CURRENT",
    )
    db_session.add(obs)
    db_session.add(obs_moist)
    db_session.commit()

    response = client.get(f"/api/v1/risk-assessments/explain/{loc.id}")
    assert response.status_code == 200
    data = response.json()

    assert data["location_id"] == loc.id
    assert data["assessment_type"] == "dynamic_risk"
    assert data["risk_category"] in ["high", "critical"]
    assert len(data["contributing_factors"]) == 4
    factor_names = [f["factor_name"] for f in data["contributing_factors"]]
    assert "Slope Incline" in factor_names
    assert "Precipitation Trigger" in factor_names


def test_explain_nonexistent_location_returns_404(client: TestClient):
    """GET /api/v1/risk-assessments/explain/999999 returns 404."""
    response = client.get("/api/v1/risk-assessments/explain/999999")
    assert response.status_code == 404


def test_evaluate_risk_endpoint(client: TestClient, db_session):
    """POST /api/v1/risk-assessments/evaluate evaluates risk and returns batch response."""
    loc = MonitoredLocation(
        name="Batch Eval Test",
        state="Uttarakhand",
        district="Chamoli",
        latitude=30.55,
        longitude=79.56,
        elevation=1890.0,
        slope_angle=39.5,
    )
    db_session.add(loc)
    db_session.commit()

    response = client.post(
        "/api/v1/risk-assessments/evaluate",
        json={"location_id": loc.id},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["evaluated_count"] == 1
    assert len(data["results"]) == 1
    assert data["results"][0]["location_id"] == loc.id


def test_evaluate_alert_triggers_endpoint(client: TestClient, db_session):
    """POST /api/v1/alerts/evaluate-triggers applies safeguards and reports outcomes."""
    loc = MonitoredLocation(
        name="Trigger Test Hill",
        state="Kerala",
        district="Wayanad",
        latitude=11.53,
        longitude=76.13,
        elevation=950.0,
        slope_angle=43.5,
    )
    db_session.add(loc)
    db_session.commit()

    now = datetime.now(timezone.utc)
    # Heavy rainfall and high soil moisture
    db_session.add(
        EnvironmentalObservation(
            location_id=loc.id,
            observation_type="rainfall",
            value=125.0,
            unit="mm",
            observed_at=now - timedelta(minutes=30),
            source="Test Gauge",
            quality_status="CURRENT",
        )
    )
    db_session.add(
        EnvironmentalObservation(
            location_id=loc.id,
            observation_type="soil_moisture",
            value=86.0,
            unit="%",
            observed_at=now - timedelta(minutes=30),
            source="Test Probe",
            quality_status="CURRENT",
        )
    )
    db_session.commit()

    response = client.post(f"/api/v1/alerts/evaluate-triggers?location_id={loc.id}")
    assert response.status_code == 200
    data = response.json()

    assert data["evaluated_locations"] == 1
    assert data["alerts_issued"] >= 1
    assert len(data["dispatched_alerts"]) >= 1
    assert "[EXPERIMENTAL EARLY WARNING]" in data["dispatched_alerts"][0]["title"]


def test_acknowledge_and_resolve_alert_endpoints(client: TestClient, db_session):
    """PATCH /api/v1/alerts/{id}/acknowledge and /resolve transition lifecycle."""
    alert = Alert(
        severity="high",
        title="[EXPERIMENTAL EARLY WARNING] Test Warning",
        description="Test description",
        status="issued",
        source="Test Engine",
    )
    db_session.add(alert)
    db_session.commit()

    # Acknowledge
    ack_res = client.patch(f"/api/v1/alerts/{alert.id}/acknowledge")
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "acknowledged"
    assert ack_res.json()["acknowledged_at"] is not None

    # Resolve
    res_res = client.patch(f"/api/v1/alerts/{alert.id}/resolve")
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "resolved"

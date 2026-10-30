from datetime import datetime, timezone
from app.models.risk_assessment import RiskAssessment
from app.models.alert import Alert


def test_risk_assessments_endpoints(client, db_session):
    """Test retrieving risk assessments and 404 handling."""
    # Create location
    loc_res = client.post(
        "/api/v1/locations",
        json={
            "name": "Nongpoh Valley Sector",
            "state": "Meghalaya",
            "district": "Ri-Bhoi",
            "latitude": 25.9000,
            "longitude": 91.8800,
        },
    )
    loc_id = loc_res.json()["id"]

    # Insert a risk assessment in DB
    assessment = RiskAssessment(
        location_id=loc_id,
        risk_category="high",
        risk_score=0.78,
        assessed_at=datetime.now(timezone.utc),
        assessment_source="Test Model Ingestion v1.0",
        explanation="Rainfall exceedance advisory threshold.",
    )
    db_session.add(assessment)
    db_session.commit()
    db_session.refresh(assessment)

    # List
    list_res = client.get(f"/api/v1/risk-assessments?location_id={loc_id}&risk_category=high")
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 1
    assert list_res.json()["items"][0]["risk_category"] == "high"

    # Get by ID
    get_res = client.get(f"/api/v1/risk-assessments/{assessment.id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == assessment.id

    # 404 test
    not_found_res = client.get("/api/v1/risk-assessments/999999")
    assert not_found_res.status_code == 404


def test_alerts_endpoints(client, db_session):
    """Test retrieving alerts with severity filtering and 404 handling."""
    alert = Alert(
        severity="critical",
        title="Immediate Evacuation Warning",
        description="Active slope displacement detected above settlement sector B.",
        status="issued",
        source="State Disaster Management Authority",
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)

    # List with severity filter
    res = client.get("/api/v1/alerts?severity=critical&status=issued")
    assert res.status_code == 200
    assert res.json()["total"] == 1
    assert res.json()["items"][0]["severity"] == "critical"

    # Get by ID
    get_res = client.get(f"/api/v1/alerts/{alert.id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == alert.id

    # 404 test
    not_found_res = client.get("/api/v1/alerts/999999")
    assert not_found_res.status_code == 404

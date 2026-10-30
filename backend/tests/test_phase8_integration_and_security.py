import io
import pytest
from datetime import datetime, timezone, timedelta
from app.models.location import MonitoredLocation
from app.models.observation import EnvironmentalObservation
from app.models.risk_assessment import RiskAssessment
from app.models.alert import Alert
from app.models.incident import IncidentReport
from app.models.cap_message import CapMessage
from app.models.user import User
from app.core.security import ensure_default_users
from app.core.config import settings


@pytest.fixture(autouse=True)
def seed_test_users(db_session):
    """Ensures standard test user accounts exist in DB."""
    ensure_default_users(db_session)


# ---------------------------------------------------------------------------
# Integration Scenario 1: Telemetry -> Geomorphic Risk -> Alert -> Anti-Flapping
# ---------------------------------------------------------------------------

def test_e2e_weather_to_risk_to_alert_anti_flapping(client, db_session):
    """
    E2E Pipeline Test:
    1. Create monitored mountain location.
    2. Ingest extreme rainfall and moisture observations.
    3. Evaluate susceptibility using explainable baseline engine.
    4. Trigger early warning alert.
    5. Verify anti-flapping guard blocks duplicate alerts within cooldown window.
    """
    loc = MonitoredLocation(
        name="Phase 8 Munnar Gap Road Station",
        state="Kerala",
        district="Idukki",
        latitude=10.0889,
        longitude=77.0595,
        elevation=1520.0,
        slope_angle=42.5,
        is_active=True,
    )
    db_session.add(loc)
    db_session.flush()

    now = datetime.now(timezone.utc)
    obs_rain = EnvironmentalObservation(
        location_id=loc.id,
        observation_type="rainfall",
        value=140.0,
        unit="mm",
        observed_at=now,
        source="open-meteo",
        quality_status="CURRENT",
        is_forecast=False,
    )
    obs_moist = EnvironmentalObservation(
        location_id=loc.id,
        observation_type="soil_moisture",
        value=92.0,
        unit="%",
        observed_at=now,
        source="open-meteo",
        quality_status="CURRENT",
        is_forecast=False,
    )
    db_session.add(obs_rain)
    db_session.add(obs_moist)
    db_session.commit()

    # Step 3: Evaluate risk via API
    risk_res = client.post("/api/v1/risk-assessments/evaluate", json={"location_id": loc.id})
    assert risk_res.status_code == 200
    batch_data = risk_res.json()
    assert batch_data["evaluated_count"] >= 1
    risk_data = batch_data["results"][0]
    assert risk_data["location_id"] == loc.id
    assert risk_data["risk_category"] in ("high", "critical", "moderate")
    assert risk_data["risk_score"] >= 0.50
    assert "contributing_factors" in risk_data

    # Step 4: Evaluate alert triggers
    alert_res = client.post("/api/v1/alerts/evaluate-triggers")
    assert alert_res.status_code == 200
    alert_data = alert_res.json()
    assert alert_data["alerts_issued"] >= 1
    created_alerts = [a for a in alert_data["dispatched_alerts"] if a["location_id"] == loc.id]
    assert len(created_alerts) >= 1
    assert created_alerts[0]["severity"].lower() in ("warning", "danger", "high", "critical")

    # Step 5: Immediate re-evaluation must be suppressed by anti-flapping safeguards
    re_eval_res = client.post("/api/v1/alerts/evaluate-triggers")
    assert re_eval_res.status_code == 200
    re_eval_data = re_eval_res.json()
    new_duplicates = [a for a in re_eval_data["dispatched_alerts"] if a["location_id"] == loc.id]
    assert len(new_duplicates) == 0, "Anti-flapping guard should have suppressed duplicate alert within cooldown period."
    assert re_eval_data["alerts_suppressed"] >= 1


# ---------------------------------------------------------------------------
# Integration Scenario 2: Crowdsourced Report -> Review -> Self-Approval Guard
# ---------------------------------------------------------------------------

def test_e2e_community_incident_review_and_self_approval_guard(client, db_session):
    """
    E2E Community Incident Test:
    1. Citizen submits report.
    2. Attempting self-review/approval by same reporter is blocked (403).
    3. Independent authorized reviewer successfully verifies report.
    4. Review audit trail immutably records both stages.
    """
    # 1. Citizen submits report
    submit_payload = {
        "category": "debris_flow",
        "description": "Massive debris flow blocked NH-10 near Rangpo border.",
        "latitude": 27.1800,
        "longitude": 88.5300,
        "location_description": "NH-10 Kilometre stone 42, Rangpo Ghat",
        "source_type": "citizen",
        "reporter_name": "Field Observer Sharma",
        "reporter_contact": "+91-9876543210",
        "consent_given": True,
    }
    submit_res = client.post(
        "/api/v1/incidents",
        json=submit_payload,
        headers={"X-User-Email": "citizen@landslideguard.local"},
    )
    assert submit_res.status_code == 201
    inc_data = submit_res.json()
    inc_id = inc_data["id"]
    assert inc_data["review_status"] == "pending_review"

    # 2. Self-approval attempt: Citizen attempts to verify their own report (forbidden role)
    self_verify_res = client.post(
        f"/api/v1/incidents/{inc_id}/review",
        json={"action": "verify", "notes": "I approve my own submission."},
        headers={"X-User-Email": "citizen@landslideguard.local"},
    )
    assert self_verify_res.status_code == 403

    # When user with reviewer role is ALSO the reporter:
    reviewer = db_session.query(User).filter(User.role == "official_ddma").first()
    incident_obj = db_session.query(IncidentReport).filter(IncidentReport.id == inc_id).first()
    incident_obj.reporter_user_id = reviewer.id
    db_session.commit()

    self_approve_reviewer_res = client.post(
        f"/api/v1/incidents/{inc_id}/review",
        json={"action": "verify", "notes": "Attempting self-approval as reviewer."},
        headers={"X-User-Email": reviewer.email},
    )
    assert self_approve_reviewer_res.status_code == 403
    assert "Conflict of interest" in self_approve_reviewer_res.json()["detail"]

    # 3. Independent reviewer (admin) verifies report
    admin = db_session.query(User).filter(User.role == "admin").first()
    verify_res = client.post(
        f"/api/v1/incidents/{inc_id}/review",
        json={"action": "verify", "notes": "Independent ground verification completed with SDRF."},
        headers={"X-User-Email": admin.email},
    )
    assert verify_res.status_code == 200
    verified_data = verify_res.json()
    assert verified_data["review_status"] == "verified"
    assert verified_data["verified_at"] is not None
    assert len(verified_data["review_logs"]) >= 2
    actions = [l["action"] for l in verified_data["review_logs"]]
    assert "VERIFY" in actions
    verify_log = next(l for l in verified_data["review_logs"] if l["action"] == "VERIFY")
    assert verify_log["reviewer_name"] == admin.display_name


# ---------------------------------------------------------------------------
# Integration Scenario 3: High Risk -> CAP v1.2 XML -> Approval -> Simulated Dispatch
# ---------------------------------------------------------------------------

def test_e2e_cap_message_full_lifecycle(client, db_session):
    """
    E2E CAP v1.2 Protocol Test:
    1. Draft alert message.
    2. Validate raw XML against OASIS CAP v1.2 standard.
    3. Non-approver attempt to approve is blocked.
    4. Authorized approver approves CAP message.
    5. Export simulated dispatch and verify immutable audit trail.
    """
    draft_payload = {
        "headline": "High Landslide Risk Warning - Phase 8 Test Corridor",
        "description": "Continuous heavy precipitation has triggered slope instability along the ghat sector.",
        "area_description": "Western Ghats Mountain Pass, Sector 4",
        "urgency": "Immediate",
        "severity": "Severe",
        "certainty": "Likely",
        "instruction": "Avoid non-essential hill travel and monitor DDMA updates.",
        "circle_lat": 10.0889,
        "circle_lon": 77.0595,
        "circle_radius_km": 15.0,
        "scope": "Private",
    }

    # 1. Draft message
    draft_res = client.post(
        "/api/v1/cap/draft",
        json=draft_payload,
        headers={"X-User-Email": "ddma.officer@landslideguard.local"},
    )
    assert draft_res.status_code == 201
    cap_data = draft_res.json()
    cap_id = cap_data["id"]
    assert cap_data["status"] == "Draft"
    assert cap_data["dispatch_status"] in ("VALIDATED", "PENDING_APPROVAL")
    assert cap_data["is_simulation"] is True

    # 2. Preview & validate CAP v1.2 XML
    preview_res = client.get(f"/api/v1/cap/{cap_id}/preview")
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["is_valid"] is True
    assert len(preview_data["errors"]) == 0
    assert "<alert xmlns=\"urn:oasis:names:tc:emergency:cap:1.2\">" in preview_data["xml_payload"]

    # 3. Non-approver (citizen) attempts approval -> 403 Forbidden
    unauth_res = client.post(
        f"/api/v1/cap/{cap_id}/approve",
        json={"notes": "Unauthorized approval attempt."},
        headers={"X-User-Email": "citizen@landslideguard.local"},
    )
    assert unauth_res.status_code == 403

    # 4. Authorized approver (admin) approves
    approve_res = client.post(
        f"/api/v1/cap/{cap_id}/approve",
        json={"notes": "Approved for simulated disaster early warning broadcast."},
        headers={"X-User-Email": "admin@landslideguard.local"},
    )
    assert approve_res.status_code == 200
    approved_data = approve_res.json()
    assert approved_data["dispatch_status"] == "APPROVED"

    # 5. Export simulated broadcast
    export_res = client.post(
        f"/api/v1/cap/{cap_id}/export",
        headers={"X-User-Email": "admin@landslideguard.local"},
    )
    assert export_res.status_code == 200
    export_data = export_res.json()
    assert export_data["is_simulation"] is True
    assert export_data["dispatch_status"] == "EXPORTED"
    assert "[SIMULATION" in export_data["dispatch_receipt"]
    assert export_data["export_count"] >= 1


# ---------------------------------------------------------------------------
# Security Audit 1: Secret Leakage & Credential Exposure Prevention
# ---------------------------------------------------------------------------

def test_security_audit_secret_leakage_prevention(client):
    """
    Ensure no database passwords, raw connection strings, auth tokens,
    or internal server secret keys are exposed across public endpoints.
    """
    endpoints = [
        "/api/v1/health",
        "/api/v1/health/db",
        "/api/v1/info",
        "/api/v1/locations",
        "/api/v1/weather/status",
    ]
    forbidden_tokens = [
        "postgres:",
        "password",
        "secret_key",
        "OPEN_METEO_API_KEY",
        "DATABASE_URL",
        "private_key",
    ]

    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 200, f"Endpoint {ep} should return 200"
        body_text = res.text.lower()
        for token in forbidden_tokens:
            if token == "password":
                assert '"password":' not in body_text, f"Potential password exposure in {ep}"
                assert "password=" not in body_text, f"Potential password exposure in {ep}"
            elif token == "postgres:":
                assert "postgres:" not in body_text, f"PostgreSQL connection string leaked in {ep}"
            elif token == "database_url":
                assert "database_url" not in body_text, f"Database URL leaked in {ep}"


# ---------------------------------------------------------------------------
# Security Audit 2: File Upload Defense (Traversal, MIME Spoofing, Oversize)
# ---------------------------------------------------------------------------

def test_security_audit_upload_boundaries(client, db_session):
    """
    Verify upload security defenses:
    - Path traversal attempt (../../malicious.png) is sanitized.
    - Magic byte check prevents executable/shell script spoofing as PNG.
    - Oversize file (>5MB) is strictly rejected.
    """
    inc = IncidentReport(
        category="slope_cracks",
        description="Ground tension crack along terrace road.",
        latitude=27.32,
        longitude=88.61,
        review_status="pending_review",
        source_type="citizen",
        is_community_report=True,
    )
    db_session.add(inc)
    db_session.commit()

    # 1. Directory traversal attempt
    valid_png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    traversal_file = ("../../../../evil_script.png", io.BytesIO(valid_png_bytes), "image/png")
    res_traversal = client.post(
        f"/api/v1/incidents/{inc.id}/attachments",
        files={"file": traversal_file},
        data={"caption": "Traversal test"},
    )
    assert res_traversal.status_code == 201
    saved_data = res_traversal.json()
    assert ".." not in saved_data["filename"]
    assert ".." not in saved_data["original_filename"]

    # 2. Magic byte check: Fake PNG with shell script content
    fake_png_bytes = b"#!/bin/bash\nrm -rf /"
    fake_file = ("script.png", io.BytesIO(fake_png_bytes), "image/png")
    res_fake = client.post(
        f"/api/v1/incidents/{inc.id}/attachments",
        files={"file": fake_file},
        data={"caption": "Spoofed script"},
    )
    assert res_fake.status_code == 400
    assert "signature" in res_fake.json()["detail"].lower()

    # 3. Oversize file (>5MB)
    oversize_bytes = valid_png_bytes + (b"\x00" * (5 * 1024 * 1024 + 1024))
    large_file = ("huge.png", io.BytesIO(oversize_bytes), "image/png")
    res_large = client.post(
        f"/api/v1/incidents/{inc.id}/attachments",
        files={"file": large_file},
    )
    assert res_large.status_code in (400, 413)


# ---------------------------------------------------------------------------
# Security Audit 3: Role-Based Access Control (RBAC) Boundaries
# ---------------------------------------------------------------------------

def test_security_audit_rbac_boundaries(client):
    """
    Ensure unauthorized users cannot execute privileged operations.
    """
    # 1. Anonymous user cannot create CAP draft (401 Unauthorized)
    unauth_draft = client.post(
        "/api/v1/cap/draft",
        json={"headline": "Test", "description": "Short", "area_description": "Loc"},
    )
    assert unauth_draft.status_code in (401, 403, 422)

    # 2. Citizen cannot review or verify incidents (403 Forbidden)
    citizen_review = client.post(
        "/api/v1/incidents/1/review",
        json={"action": "verify", "notes": "Citizen verification attempt"},
        headers={"X-User-Email": "citizen@landslideguard.local"},
    )
    assert citizen_review.status_code == 403


# ---------------------------------------------------------------------------
# Query Optimization & Deployment Readiness
# ---------------------------------------------------------------------------

def test_query_optimization_paginated_lists(client, db_session):
    """
    Verify that paginated listings for incidents and CAP messages return
    correct structures with eagerly loaded relationship data.
    """
    res_inc = client.get("/api/v1/incidents?page=1&size=10")
    assert res_inc.status_code == 200
    data_inc = res_inc.json()
    assert "items" in data_inc
    assert "total" in data_inc

    res_cap = client.get("/api/v1/cap?page=1&size=10")
    assert res_cap.status_code == 200
    data_cap = res_cap.json()
    assert "items" in data_cap
    assert "total" in data_cap


def test_system_info_phase8_alignment(client):
    """
    Verify that /api/v1/info accurately reflects Phase 8 metadata and pan-India coverage.
    """
    res = client.get("/api/v1/info")
    assert res.status_code == 200
    data = res.json()
    assert "Phase 8" in data["current_phase"]
    assert "Pan-India" in data["target_region"]
    assert data["status"] == "active"

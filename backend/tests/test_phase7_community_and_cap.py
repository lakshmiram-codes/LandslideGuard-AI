import io
import pytest
from app.models.location import MonitoredLocation
from app.models.risk_assessment import RiskAssessment
from app.models.incident import IncidentReport
from app.models.user import User
from app.services.cap.builder import CapMessageBuilder
from app.services.cap.validator import CapSchemaValidator
from app.core.security import ensure_default_users
from datetime import datetime, timezone


@pytest.fixture(autouse=True)
def seed_test_users(db_session):
    """Ensures standard test user accounts exist in DB."""
    ensure_default_users(db_session)


def test_community_incident_submission_valid(client):
    """Test public/citizen community incident report submission."""
    payload = {
        "category": "suspected_landslide",
        "description": "Large tension cracks and fresh soil slump observed above village footpath.",
        "latitude": 27.3500,
        "longitude": 88.6200,
        "location_description": "Upper hill slope near Mile 3 marker, Gangtok ridge",
        "source_type": "citizen",
        "reporter_name": "Tenzing Norbu",
        "reporter_contact": "+91-9876543210",
        "consent_given": True,
    }
    res = client.post("/api/v1/incidents", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["category"] == "suspected_landslide"
    assert data["review_status"] == "pending_review"
    assert data["is_community_report"] is True
    assert data["location_description"] == "Upper hill slope near Mile 3 marker, Gangtok ridge"
    assert data["reporter_name"] == "Tenzing Norbu"
    assert len(data["review_logs"]) >= 1
    assert data["review_logs"][0]["action"] == "SUBMIT"


def test_community_incident_coordinate_validation(client):
    """Test rejection of out-of-bounds latitude and longitude."""
    res_lat = client.post(
        "/api/v1/incidents",
        json={
            "category": "rockfall",
            "description": "Test invalid latitude",
            "latitude": 95.0,  # Invalid (>90)
            "longitude": 88.0,
            "source_type": "citizen",
        },
    )
    assert res_lat.status_code == 422

    res_lon = client.post(
        "/api/v1/incidents",
        json={
            "category": "rockfall",
            "description": "Test invalid longitude",
            "latitude": 27.0,
            "longitude": 200.0,  # Invalid (>180)
            "source_type": "citizen",
        },
    )
    assert res_lon.status_code == 422


def test_evidence_file_attachment_upload_and_download(client):
    """Test safe evidence upload with magic bytes, sanitization, and retrieval."""
    # Create incident first
    inc_res = client.post(
        "/api/v1/incidents",
        json={
            "category": "debris_flow",
            "description": "Mudflow across local access road.",
            "latitude": 30.5500,
            "longitude": 79.5600,
            "source_type": "citizen",
        },
    )
    incident_id = inc_res.json()["id"]

    # Valid PNG image bytes: \x89PNG\r\n\x1a\n + sample payload
    valid_png_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
    file_tuple = ("debris_photo.png", io.BytesIO(valid_png_content), "image/png")

    upload_res = client.post(
        f"/api/v1/incidents/{incident_id}/attachments",
        files={"file": file_tuple},
        data={"caption": "Active debris blockage near culvert"},
        headers={"X-User-Email": "citizen@landslideguard.local"},
    )
    assert upload_res.status_code == 201
    att_data = upload_res.json()
    assert att_data["original_filename"] == "debris_photo.png"
    assert att_data["mime_type"] == "image/png"
    assert att_data["caption"] == "Active debris blockage near culvert"
    attachment_id = att_data["id"]

    # Verify retrieval
    get_res = client.get(f"/api/v1/incidents/{incident_id}/attachments/{attachment_id}")
    assert get_res.status_code == 200
    assert get_res.headers["content-type"] == "image/png"
    assert get_res.content == valid_png_content
    assert get_res.headers.get("x-content-type-options") == "nosniff"


def test_evidence_file_invalid_type_and_magic_check(client):
    """Test rejection of non-permitted file extensions and spoofed MIME types."""
    inc_res = client.post(
        "/api/v1/incidents",
        json={
            "category": "rockfall",
            "description": "Test incident for file reject",
            "latitude": 30.0,
            "longitude": 79.0,
            "source_type": "citizen",
        },
    )
    incident_id = inc_res.json()["id"]

    # 1. Invalid extension
    bad_ext_tuple = ("script.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")
    res1 = client.post(
        f"/api/v1/incidents/{incident_id}/attachments",
        files={"file": bad_ext_tuple},
    )
    assert res1.status_code == 400
    assert "not permitted" in res1.json()["detail"]

    # 2. Spoofed extension with fake content (txt disguised as png)
    fake_png = ("fake.png", io.BytesIO(b"Hello plain text file without PNG magic bytes"), "image/png")
    res2 = client.post(
        f"/api/v1/incidents/{incident_id}/attachments",
        files={"file": fake_png},
    )
    assert res2.status_code == 400
    assert "signature" in res2.json()["detail"].lower()


def test_verification_workflow_state_transitions_and_roles(client):
    """Test role-gated review states: submitted -> under_review -> needs_more_info -> verified."""
    # 1. Submit incident
    res = client.post(
        "/api/v1/incidents",
        json={
            "category": "slope_cracks",
            "description": "Visible scarp crack along tea estate slope.",
            "latitude": 10.0889,
            "longitude": 77.0595,
            "source_type": "citizen",
        },
    )
    inc_id = res.json()["id"]

    # 2. Unauthorized citizen attempts review action -> 403
    unauth_res = client.post(
        f"/api/v1/incidents/{inc_id}/review",
        json={"action": "start_review", "notes": "I am reviewing my own report"},
        headers={"X-User-Email": "citizen@landslideguard.local"},
    )
    assert unauth_res.status_code == 403
    assert "Access denied" in unauth_res.json()["detail"]

    # 3. Authorized Field Observer starts review -> 200 (under_review)
    review_res = client.post(
        f"/api/v1/incidents/{inc_id}/review",
        json={"action": "start_review", "notes": "Assigned field patrol to inspect slope geometry."},
        headers={"X-User-Email": "observer@landslideguard.local"},
    )
    assert review_res.status_code == 200
    assert review_res.json()["review_status"] == "under_review"

    # 4. Request more info
    info_res = client.post(
        f"/api/v1/incidents/{inc_id}/review",
        json={"action": "request_info", "notes": "Need width measurement and proximity to drainage."},
        headers={"X-User-Email": "observer@landslideguard.local"},
    )
    assert info_res.status_code == 200
    assert info_res.json()["review_status"] == "needs_more_info"

    # 5. Official DDMA verifies the incident -> verified
    verify_res = client.post(
        f"/api/v1/incidents/{inc_id}/review",
        json={"action": "verify", "notes": "Verified by ground team: 15cm scarp confirmed active displacement."},
        headers={"X-User-Email": "ddma.officer@landslideguard.local"},
    )
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    assert v_data["review_status"] == "verified"
    assert v_data["verified_at"] is not None
    assert len(v_data["review_logs"]) >= 4


def test_prevention_of_self_approval(client):
    """Test that a user cannot verify or approve their own submitted report."""
    # Field observer submits an incident report
    submit_res = client.post(
        "/api/v1/incidents",
        json={
            "category": "road_blockage",
            "description": "Observer patrol report on NH-10.",
            "latitude": 27.1,
            "longitude": 88.5,
            "source_type": "field_observer",
        },
        headers={"X-User-Email": "observer@landslideguard.local"},
    )
    incident_id = submit_res.json()["id"]

    # Same observer attempts to verify their own submission -> 403 Conflict of interest
    self_verify = client.post(
        f"/api/v1/incidents/{incident_id}/review",
        json={"action": "verify", "notes": "I verify my own report."},
        headers={"X-User-Email": "observer@landslideguard.local"},
    )
    assert self_verify.status_code == 403
    assert "Conflict of interest" in self_verify.json()["detail"]

    # Different authorized official (DDMA) verifies -> 200 OK
    other_verify = client.post(
        f"/api/v1/incidents/{incident_id}/review",
        json={"action": "verify", "notes": "Reviewed and confirmed by senior district desk."},
        headers={"X-User-Email": "ddma.officer@landslideguard.local"},
    )
    assert other_verify.status_code == 200
    assert other_verify.json()["review_status"] == "verified"


def test_separation_of_community_and_historical_incidents(client, db_session):
    """Test that community crowdsourced reports are filtered separately from official historical records."""
    # Historical record
    hist = IncidentReport(
        category="debris_flow",
        description="Verified historical 2020 scar",
        latitude=27.0,
        longitude=88.0,
        source_type="official_ddma",
        review_status="verified",
        is_community_report=False,
    )
    db_session.add(hist)
    db_session.commit()

    # Community report
    client.post(
        "/api/v1/incidents",
        json={
            "category": "slope_cracks",
            "description": "Crowdsourced pending review report",
            "latitude": 27.01,
            "longitude": 88.01,
            "source_type": "citizen",
        },
    )

    # Filter community reports only
    comm_res = client.get("/api/v1/incidents?is_community_report=true")
    assert comm_res.status_code == 200
    for item in comm_res.json()["items"]:
        assert item["is_community_report"] is True

    # Filter official historical only
    hist_res = client.get("/api/v1/incidents?is_community_report=false")
    assert hist_res.status_code == 200
    for item in hist_res.json()["items"]:
        assert item["is_community_report"] is False


def test_cap_xml_generation_and_schema_validation():
    """Test OASIS CAP v1.2 XML synthesis and structural validation."""
    xml_str = CapMessageBuilder.build_cap_xml(
        identifier="IN-LG-20261029-TEST01",
        sender="ddma.officer@landslideguard.local",
        sent_at=datetime(2026, 10, 29, 14, 0, 0, tzinfo=timezone.utc),
        status="Draft",
        msg_type="Alert",
        scope="Private",
        headline="MODERATE LANDSLIDE WATCH: Chamoli Corridor",
        description="Pore-pressure saturation exceeds 70% following sustained rainfall.",
        area_description="Joshimath Escarpment Sector, Chamoli District, Uttarakhand",
        urgency="Expected",
        severity="Severe",
        certainty="Likely",
        circle_lat=30.5564,
        circle_lon=79.5671,
        circle_radius_km=15.0,
        parameters={"Model": "GeomorphicBaselineModel", "RiskScore": "0.78"},
    )

    assert "urn:oasis:names:tc:emergency:cap:1.2" in xml_str
    assert "<identifier>IN-LG-20261029-TEST01</identifier>" in xml_str
    assert "<severity>Severe</severity>" in xml_str
    assert "<circle>30.5564,79.5671 15.0</circle>" in xml_str

    validation = CapSchemaValidator.validate_xml(xml_str)
    assert validation.is_valid is True
    assert len(validation.errors) == 0
    assert validation.identifier == "IN-LG-20261029-TEST01"
    assert validation.status == "Draft"


def test_cap_xml_validation_rejection():
    """Test CAP validation error detection on missing mandatory tags or bad enums."""
    # Malformed XML
    bad_xml = "<alert><identifier>TEST</alert>"
    res1 = CapSchemaValidator.validate_xml(bad_xml)
    assert res1.is_valid is False
    assert any("Syntax" in e for e in res1.errors)

    # Missing info block
    no_info_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
      <identifier>ID1</identifier>
      <sender>test@test.local</sender>
      <sent>2026-10-29T14:00:00+00:00</sent>
      <status>InvalidStatus</status>
      <msgType>Alert</msgType>
      <scope>Private</scope>
    </alert>"""
    res2 = CapSchemaValidator.validate_xml(no_info_xml)
    assert res2.is_valid is False
    assert any("Invalid <status>" in e for e in res2.errors)
    assert any("<info> block is missing" in e for e in res2.errors)


def test_cap_draft_endpoint_stale_and_insufficient_data_guard(client, db_session):
    """Test safety invariant: cannot draft/approve CAP alert if risk assessment is INSUFFICIENT_DATA or STALE."""
    # Create monitored location
    loc = MonitoredLocation(
        name="Test Hill Station",
        state="Uttarakhand",
        district="Chamoli",
        latitude=30.5,
        longitude=79.5,
        elevation=1500.0,
        slope_angle=35.0,
        is_active=True,
    )
    db_session.add(loc)
    db_session.flush()

    # Create assessment with INSUFFICIENT_DATA
    bad_assessment = RiskAssessment(
        location_id=loc.id,
        risk_category="insufficient_data",
        assessment_type="insufficient_data",
        data_quality_status="INSUFFICIENT_DATA",
        assessed_at=datetime.now(timezone.utc),
        assessment_source="TestModel",
    )
    db_session.add(bad_assessment)
    db_session.commit()

    # Attempt to draft CAP message for insufficient assessment -> 400
    res_bad = client.post(
        "/api/v1/cap/draft",
        json={
            "risk_assessment_id": bad_assessment.id,
            "headline": "Dangerous Landslide Warning",
            "description": "Warning based on incomplete inputs",
            "area_description": "Chamoli sector",
        },
        headers={"X-User-Email": "ddma.officer@landslideguard.local"},
    )
    assert res_bad.status_code == 400
    assert "INSUFFICIENT_DATA" in res_bad.json()["detail"]

    # Now create valid assessment
    good_assessment = RiskAssessment(
        location_id=loc.id,
        risk_category="high",
        risk_score=0.72,
        susceptibility_score=0.68,
        trigger_score=0.76,
        assessment_type="dynamic_risk",
        data_quality_status="CURRENT",
        assessed_at=datetime.now(timezone.utc),
        assessment_source="GeomorphicBaselineModel",
    )
    db_session.add(good_assessment)
    db_session.commit()

    res_good = client.post(
        "/api/v1/cap/draft",
        json={
            "risk_assessment_id": good_assessment.id,
            "headline": "HIGH RISK: Chamoli Corridor Slopes",
            "description": "High failure probability evaluated by geomorphic baseline engine.",
            "area_description": "Chamoli Highway Corridor",
            "circle_lat": 30.5,
            "circle_lon": 79.5,
            "circle_radius_km": 10.0,
        },
        headers={"X-User-Email": "observer@landslideguard.local"},
    )
    assert res_good.status_code == 201
    cap_data = res_good.json()
    assert cap_data["dispatch_status"] == "VALIDATED"
    assert cap_data["severity"] == "Severe"


def test_cap_approval_export_and_cancellation_workflow(client):
    """Test full approval-gated lifecycle: DRAFT/VALIDATED -> PENDING_APPROVAL -> APPROVED -> EXPORTED -> CANCELLED."""
    # 1. Draft CAP alert
    draft_res = client.post(
        "/api/v1/cap/draft",
        json={
            "headline": "WATCH: Teesta Valley Escarpment",
            "description": "Heightened hydrologic saturation observed.",
            "area_description": "Teesta River Highway Segment, Sikkim",
            "urgency": "Expected",
            "severity": "Moderate",
            "certainty": "Likely",
        },
        headers={"X-User-Email": "observer@landslideguard.local"},
    )
    assert draft_res.status_code == 201
    cap_id = draft_res.json()["id"]

    # 2. Preview XML
    preview_res = client.get(f"/api/v1/cap/{cap_id}/preview")
    assert preview_res.status_code == 200
    assert preview_res.json()["is_valid"] is True

    # 3. Request approval
    req_res = client.post(
        f"/api/v1/cap/{cap_id}/request-approval",
        headers={"X-User-Email": "observer@landslideguard.local"},
    )
    assert req_res.status_code == 200
    assert req_res.json()["dispatch_status"] == "PENDING_APPROVAL"

    # 4. Unauthorized field observer cannot approve -> 403
    unauth_appr = client.post(
        f"/api/v1/cap/{cap_id}/approve",
        headers={"X-User-Email": "observer@landslideguard.local"},
    )
    assert unauth_appr.status_code == 403

    # 5. Official DDMA approves -> 200
    appr_res = client.post(
        f"/api/v1/cap/{cap_id}/approve",
        json={"notes": "Approved for simulation test export."},
        headers={"X-User-Email": "ddma.officer@landslideguard.local"},
    )
    assert appr_res.status_code == 200
    assert appr_res.json()["dispatch_status"] == "APPROVED"

    # 6. Export simulation payload -> 200
    export_res = client.post(
        f"/api/v1/cap/{cap_id}/export",
        headers={"X-User-Email": "ddma.officer@landslideguard.local"},
    )
    assert export_res.status_code == 200
    exp_data = export_res.json()
    assert exp_data["dispatch_status"] == "EXPORTED"
    assert exp_data["export_count"] == 1
    assert "SIMULATION ONLY" in exp_data["dispatch_receipt"]

    # 7. Cancel message -> 200
    cancel_res = client.post(
        f"/api/v1/cap/{cap_id}/cancel",
        json={"reason": "Rainfall ceased and water levels stabilized below warning threshold."},
        headers={"X-User-Email": "ddma.officer@landslideguard.local"},
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["dispatch_status"] == "CANCELLED"
    assert "Rainfall ceased" in cancel_res.json()["cancellation_reason"]

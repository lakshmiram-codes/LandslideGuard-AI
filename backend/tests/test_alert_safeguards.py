"""Unit tests for AlertSafeguards and AlertWarningEngine."""

import pytest
from datetime import datetime, timezone, timedelta
from app.models.location import MonitoredLocation
from app.models.alert import Alert
from app.services.susceptibility.base import ExplainableAssessmentResult, FactorContribution
from app.services.alerts.safeguards import AlertSafeguards
from app.services.alerts.engine import AlertWarningEngine


@pytest.fixture
def alert_engine():
    return AlertWarningEngine(cooldown_hours=6.0)


def create_assessment_mock(
    location_id: int = 1,
    category: str = "critical",
    score: float = 0.88,
    is_sufficient: bool = True,
    data_quality: str = "VERIFIED_EVALUATION",
    is_demo: bool = False,
):
    return ExplainableAssessmentResult(
        location_id=location_id,
        location_name="Test Hill Station",
        assessment_type="dynamic_risk",
        risk_category=category,
        risk_score=score,
        susceptibility_score=0.85,
        trigger_score=0.90,
        data_quality_status=data_quality,
        is_sufficient_data=is_sufficient,
        is_demo=is_demo,
        analytical_rationale="Simulated test assessment.",
        contributing_factors=[
            FactorContribution(
                factor_name="Precipitation Trigger",
                raw_value=120.0,
                unit="mm",
                normalized_score=0.9,
                weight=0.55,
                contribution_score=0.495,
                percentage_of_total=55.0,
                narrative="Heavy rainfall test.",
            )
        ],
    )


def test_alert_suppressed_on_low_or_moderate_risk(alert_engine, db_session):
    """Low or moderate risk scores must never trigger warning alerts."""
    ass_low = create_assessment_mock(category="low", score=0.25)
    alert, reason = alert_engine.evaluate_and_dispatch(db_session, ass_low)
    assert alert is None
    assert "does not breach warning alert threshold" in reason

    ass_mod = create_assessment_mock(category="moderate", score=0.55)
    alert_m, reason_m = alert_engine.evaluate_and_dispatch(db_session, ass_mod)
    assert alert_m is None
    assert "does not breach warning alert threshold" in reason_m


def test_alert_suppressed_on_insufficient_data(alert_engine, db_session):
    """Alerts must be strictly suppressed when telemetry inputs are incomplete."""
    ass_missing = create_assessment_mock(
        category="critical",
        score=0.90,
        is_sufficient=False,
        data_quality="INSUFFICIENT_DATA",
    )
    alert, reason = alert_engine.evaluate_and_dispatch(db_session, ass_missing)
    assert alert is None
    assert "Incomplete input telemetry" in reason


def test_alert_suppressed_on_stale_telemetry(alert_engine, db_session):
    """Alerts must be suppressed if telemetry is stale (>3h)."""
    ass_stale = create_assessment_mock(
        category="critical",
        score=0.85,
        is_sufficient=True,
        data_quality="DATA_STALE",
    )
    alert, reason = alert_engine.evaluate_and_dispatch(db_session, ass_stale)
    assert alert is None
    assert "stale (>3 hours old)" in reason


def test_alert_dispatch_and_fingerprint(alert_engine, db_session):
    """Valid high/critical assessment with current telemetry must dispatch an alert with fingerprint."""
    loc = MonitoredLocation(
        name="Alert Test Location",
        state="Uttarakhand",
        district="Chamoli",
        latitude=30.5,
        longitude=79.5,
        elevation=1900.0,
        slope_angle=40.0,
    )
    db_session.add(loc)
    db_session.commit()

    ass_valid = create_assessment_mock(
        location_id=loc.id,
        category="critical",
        score=0.92,
        is_sufficient=True,
        data_quality="VERIFIED_EVALUATION",
    )

    alert, reason = alert_engine.evaluate_and_dispatch(db_session, ass_valid)
    assert alert is not None
    assert reason is None
    assert alert.severity == "critical"
    assert alert.status == "issued"
    assert "[EXPERIMENTAL EARLY WARNING]" in alert.title
    assert alert.is_experimental is True
    assert alert.alert_fingerprint is not None
    assert alert.cooldown_until is not None


def test_alert_deduplication_cooldown(alert_engine, db_session):
    """A duplicate alert for the same location within the 6h cooldown window must be suppressed."""
    loc = MonitoredLocation(
        name="Cooldown Test Hill",
        state="Kerala",
        district="Wayanad",
        latitude=11.5,
        longitude=76.1,
        elevation=1000.0,
        slope_angle=42.0,
    )
    db_session.add(loc)
    db_session.commit()

    ass = create_assessment_mock(
        location_id=loc.id,
        category="high",
        score=0.75,
        is_sufficient=True,
        data_quality="VERIFIED_EVALUATION",
    )

    # First dispatch succeeds
    alert1, reason1 = alert_engine.evaluate_and_dispatch(db_session, ass)
    assert alert1 is not None
    db_session.commit()

    # Second immediate dispatch with same severity is suppressed
    alert2, reason2 = alert_engine.evaluate_and_dispatch(db_session, ass)
    assert alert2 is None
    assert "cooldown" in reason2.lower()


def test_alert_severity_escalation_allowed(alert_engine, db_session):
    """A critical alert is allowed to escalate and break through a prior high alert cooldown."""
    loc = MonitoredLocation(
        name="Escalation Test Hill",
        state="Himachal Pradesh",
        district="Kangra",
        latitude=32.2,
        longitude=76.3,
        elevation=2000.0,
        slope_angle=45.0,
    )
    db_session.add(loc)
    db_session.commit()

    # 1. Issue HIGH alert
    ass_high = create_assessment_mock(
        location_id=loc.id,
        category="high",
        score=0.72,
        is_sufficient=True,
        data_quality="VERIFIED_EVALUATION",
    )
    alert_high, _ = alert_engine.evaluate_and_dispatch(db_session, ass_high)
    assert alert_high is not None
    db_session.commit()

    # 2. Issue CRITICAL alert: escalation exception should allow dispatch
    ass_critical = create_assessment_mock(
        location_id=loc.id,
        category="critical",
        score=0.95,
        is_sufficient=True,
        data_quality="VERIFIED_EVALUATION",
    )
    alert_crit, reason_crit = alert_engine.evaluate_and_dispatch(db_session, ass_critical)
    assert alert_crit is not None
    assert reason_crit is None
    assert alert_crit.severity == "critical"


def test_alert_lifecycle_state_transitions(alert_engine, db_session):
    """Verifies transition from issued -> acknowledged -> resolved."""
    loc = MonitoredLocation(
        name="Lifecycle Hill",
        state="Sikkim",
        district="East Sikkim",
        latitude=27.3,
        longitude=88.6,
        elevation=1600.0,
        slope_angle=39.0,
    )
    db_session.add(loc)
    db_session.commit()

    ass = create_assessment_mock(location_id=loc.id, category="critical")
    alert, _ = alert_engine.evaluate_and_dispatch(db_session, ass)
    db_session.commit()

    assert alert.status == "issued"
    assert alert.acknowledged_at is None

    # Acknowledge
    ack_alert = alert_engine.acknowledge_alert(db_session, alert.id)
    assert ack_alert.status == "acknowledged"
    assert ack_alert.acknowledged_at is not None

    # Resolve
    res_alert = alert_engine.resolve_alert(db_session, alert.id)
    assert res_alert.status == "resolved"

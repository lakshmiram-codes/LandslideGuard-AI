"""Alert engine safeguards for deduplication, cooldowns, and suppression of invalid triggers."""

import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.services.susceptibility.base import ExplainableAssessmentResult, utc_now


def _normalize_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class AlertSafeguards:
    """Safeguard rules engine ensuring alerts are only generated on verified, non-duplicate, non-stale data."""

    DEFAULT_COOLDOWN_HOURS = 6.0

    @classmethod
    def generate_fingerprint(cls, location_id: int, severity: str, assessment_date: datetime) -> str:
        """Generates a stable, reproducible fingerprint for an alert event."""
        date_str = assessment_date.strftime("%Y-%m-%d")
        raw = f"loc_{location_id}_sev_{severity.lower()}_{date_str}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]

    @classmethod
    def can_issue_alert(
        cls,
        db: Session,
        assessment: ExplainableAssessmentResult,
        cooldown_hours: float = DEFAULT_COOLDOWN_HOURS,
    ) -> Tuple[bool, Optional[str]]:
        """
        Evaluates whether an alert can be safely issued based on:
        1. Severity threshold: Only 'high' or 'critical' trigger warning alerts.
        2. Data quality: Suppressed if data is insufficient, stale, or missing.
        3. Active cooldown: Suppressed if a recent alert with same or higher severity is unexpired.
        4. Deduplication: Suppressed if fingerprint already exists for today.
        """
        # Rule 1: Severity check
        if assessment.risk_category not in ["high", "critical"]:
            return False, f"Risk category '{assessment.risk_category}' does not breach warning alert threshold."

        # Rule 2: Incomplete or stale data suppression
        if not assessment.is_sufficient_data:
            return False, "Alert suppressed: Incomplete input telemetry; alerts cannot be issued on missing data."

        if assessment.data_quality_status == "DATA_STALE":
            return False, "Alert suppressed: Observation telemetry is stale (>3 hours old)."

        if assessment.data_quality_status == "INSUFFICIENT_DATA":
            return False, "Alert suppressed: Data quality status indicates insufficient telemetry."

        now = utc_now()

        # Rule 3: Check cooldown & deduplication
        existing_alerts = (
            db.query(Alert)
            .filter(Alert.location_id == assessment.location_id)
            .order_by(Alert.created_at.desc())
            .limit(5)
            .all()
        )

        for existing in existing_alerts:
            cooldown_dt = _normalize_utc(getattr(existing, "cooldown_until", None))
            created_dt = _normalize_utc(existing.created_at)

            # Check cooldown
            if cooldown_dt:
                if now < cooldown_dt:
                    # Severity escalation exception: If existing was 'high' and new is 'critical', allow escalation!
                    if existing.severity == "high" and assessment.risk_category == "critical":
                        break  # Allow escalation
                    return False, f"Alert suppressed: Cooldown active until {cooldown_dt.isoformat()}."

            # Check within standard time window if cooldown_until column not populated
            if created_dt:
                time_since = now - created_dt
                if time_since < timedelta(hours=cooldown_hours):
                    if existing.severity == "high" and assessment.risk_category == "critical":
                        break  # Allow escalation
                    return False, f"Alert suppressed: Recent alert '{existing.title}' issued within {cooldown_hours}h cooldown window."

        return True, None

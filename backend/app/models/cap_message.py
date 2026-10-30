from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CapMessage(Base):
    """Common Alerting Protocol (CAP v1.2 / ITU-T X.1303) structured alert record."""

    __tablename__ = "cap_messages"

    id = Column(Integer, primary_key=True, index=True)
    identifier = Column(String(100), unique=True, index=True, nullable=False)
    alert_id = Column(
        Integer,
        ForeignKey("alerts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    risk_assessment_id = Column(
        Integer,
        ForeignKey("risk_assessments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    incident_id = Column(
        Integer,
        ForeignKey("incident_reports.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    
    # CAP Core Header
    sender = Column(String(100), nullable=False)
    sent_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    status = Column(String(20), default="Draft", nullable=False)  # Draft, Test, Actual, Exercise
    msg_type = Column(String(20), default="Alert", nullable=False)  # Alert, Update, Cancel
    scope = Column(String(20), default="Private", nullable=False)  # Public, Restricted, Private
    note = Column(String(255), nullable=True)
    
    # CAP Info Block
    category = Column(String(30), default="Geo", nullable=False)
    event = Column(String(100), nullable=False)
    urgency = Column(String(30), default="Expected", nullable=False)  # Immediate, Expected, Future, Past, Unknown
    severity = Column(String(30), default="Moderate", nullable=False)  # Extreme, Severe, Moderate, Minor, Unknown
    certainty = Column(String(30), default="Likely", nullable=False)  # Observed, Likely, Possible, Unlikely, Unknown
    headline = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    instruction = Column(Text, nullable=True)
    contact = Column(String(100), nullable=True)
    
    # Geospatial Area Block
    area_description = Column(String(255), nullable=False)
    circle_lat = Column(Float, nullable=True)
    circle_lon = Column(Float, nullable=True)
    circle_radius_km = Column(Float, nullable=True)
    effective_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Dispatch & Governance Workflow Lifecycle
    dispatch_status = Column(
        String(30),
        default="DRAFT",
        nullable=False,
        index=True,
    )  # DRAFT, VALIDATED, PENDING_APPROVAL, APPROVED, EXPORTED, CANCELLED
    xml_payload = Column(Text, nullable=True)
    validation_outcome = Column(Text, nullable=True)
    
    created_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at = Column(DateTime(timezone=True), nullable=True)
    exported_at = Column(DateTime(timezone=True), nullable=True)
    export_count = Column(Integer, default=0, nullable=False)
    is_simulation = Column(Boolean, default=True, nullable=False)
    cancellation_reason = Column(Text, nullable=True)
    supersedes_identifier = Column(String(100), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    alert = relationship("Alert", foreign_keys=[alert_id])
    risk_assessment = relationship("RiskAssessment", foreign_keys=[risk_assessment_id])
    incident = relationship("IncidentReport", foreign_keys=[incident_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    audit_logs = relationship(
        "CapAuditLog",
        back_populates="cap_message",
        cascade="all, delete-orphan",
        order_by="CapAuditLog.created_at.desc()",
    )


class CapAuditLog(Base):
    """Audit trail of edits, state transitions, validation, approvals, and exports for CAP messages."""

    __tablename__ = "cap_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    cap_message_id = Column(
        Integer,
        ForeignKey("cap_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_name = Column(String(100), nullable=False)
    user_role = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)  # CREATE, VALIDATE, REQUEST_APPROVAL, APPROVE, EXPORT, CANCEL
    notes = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    cap_message = relationship("CapMessage", back_populates="audit_logs")
    user = relationship("User", foreign_keys=[user_id])

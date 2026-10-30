from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(
        Integer,
        ForeignKey("monitored_locations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    triggering_assessment_id = Column(
        Integer,
        ForeignKey("risk_assessments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    severity = Column(String(30), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(30), default="draft", nullable=False, index=True)
    alert_fingerprint = Column(String(100), nullable=True, index=True)
    cooldown_until = Column(DateTime(timezone=True), nullable=True)
    uncertainty_notes = Column(Text, nullable=True)
    is_experimental = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    source = Column(String(100), nullable=False)

    # Relationships
    location = relationship("MonitoredLocation", back_populates="alerts")

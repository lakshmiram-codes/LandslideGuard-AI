from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MonitoredLocation(Base):
    __tablename__ = "monitored_locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    state = Column(String(100), nullable=False, index=True)
    district = Column(String(100), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation = Column(Float, nullable=True)
    slope_angle = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    observations = relationship(
        "EnvironmentalObservation",
        back_populates="location",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    incident_reports = relationship("IncidentReport", back_populates="location")
    risk_assessments = relationship(
        "RiskAssessment",
        back_populates="location",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    alerts = relationship("Alert", back_populates="location")

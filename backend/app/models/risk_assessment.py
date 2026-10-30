from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(
        Integer,
        ForeignKey("monitored_locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    risk_category = Column(String(30), nullable=False, index=True)
    risk_score = Column(Float, nullable=True)
    assessment_type = Column(String(30), default="dynamic_risk", nullable=False)
    susceptibility_score = Column(Float, nullable=True)
    trigger_score = Column(Float, nullable=True)
    data_quality_status = Column(String(30), nullable=True)
    contributing_factors_json = Column(Text, nullable=True)
    limitations_notes = Column(Text, nullable=True)
    assessed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    assessment_source = Column(String(100), nullable=False)
    model_version = Column(String(50), nullable=True)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    location = relationship("MonitoredLocation", back_populates="risk_assessments")

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EnvironmentalObservation(Base):
    __tablename__ = "environmental_observations"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(
        Integer,
        ForeignKey("monitored_locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    observation_type = Column(String(50), nullable=False, index=True)
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    observed_at = Column(DateTime(timezone=True), nullable=False, index=True)
    source = Column(String(100), nullable=False)
    provenance_metadata = Column(String(255), nullable=True)

    # Phase 5 additions: Data Quality, Forecast Distinction, Retrieval Timestamp & Raw Metadata
    quality_status = Column(
        String(20),
        nullable=False,
        default="CURRENT",
        server_default="CURRENT",
        index=True,
    )
    is_forecast = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        index=True,
    )
    retrieved_at = Column(DateTime(timezone=True), nullable=True)
    raw_metadata = Column(String(1000), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    location = relationship("MonitoredLocation", back_populates="observations")

    __table_args__ = (
        Index("ix_obs_loc_type_time", "location_id", "observation_type", "observed_at"),
    )


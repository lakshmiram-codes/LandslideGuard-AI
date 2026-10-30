from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class IncidentReport(Base):
    __tablename__ = "incident_reports"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_description = Column(String(255), nullable=True)
    location_id = Column(
        Integer,
        ForeignKey("monitored_locations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reported_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    source_type = Column(String(50), nullable=False)
    review_status = Column(
        String(30),
        default="pending_review",
        nullable=False,
        index=True,
    )
    
    # Phase 7 Community Crowdsourcing & Verification metadata
    reporter_name = Column(String(100), nullable=True)
    reporter_contact = Column(String(100), nullable=True)
    reporter_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    consent_given = Column(Boolean, default=True, nullable=False)
    is_community_report = Column(Boolean, default=True, nullable=False, index=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    review_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    location = relationship("MonitoredLocation", back_populates="incident_reports")
    reporter = relationship("User", foreign_keys=[reporter_user_id])
    reviewer = relationship("User", foreign_keys=[verified_by_id])
    attachments = relationship(
        "IncidentAttachment",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentAttachment.uploaded_at.asc()",
    )
    review_logs = relationship(
        "IncidentReviewLog",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentReviewLog.created_at.desc()",
    )


class IncidentAttachment(Base):
    __tablename__ = "incident_attachments"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(
        Integer,
        ForeignKey("incident_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    caption = Column(String(255), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    uploaded_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    incident = relationship("IncidentReport", back_populates="attachments")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])


class IncidentReviewLog(Base):
    __tablename__ = "incident_review_logs"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(
        Integer,
        ForeignKey("incident_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reviewer_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewer_name = Column(String(100), nullable=False)
    reviewer_role = Column(String(50), nullable=False)
    from_status = Column(String(30), nullable=False)
    to_status = Column(String(30), nullable=False)
    action = Column(String(50), nullable=False)
    notes = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    incident = relationship("IncidentReport", back_populates="review_logs")
    reviewer = relationship("User", foreign_keys=[reviewer_id])

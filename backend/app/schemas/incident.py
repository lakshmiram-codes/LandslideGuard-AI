from datetime import datetime
from typing import Optional, Literal, List
from pydantic import BaseModel, Field, ConfigDict

IncidentCategory = Literal[
    "slope_cracks",
    "tension_cracks",
    "suspected_landslide",
    "road_blockage",
    "debris_flow",
    "rockfall",
    "other",
]

ReviewStatus = Literal[
    "submitted",
    "pending_review",
    "under_review",
    "needs_more_info",
    "verified",
    "rejected",
]

SourceType = Literal[
    "citizen",
    "community_crowdsource",
    "field_observer",
    "official_ddma",
    "patrol",
]

ReviewActionType = Literal[
    "start_review",
    "request_info",
    "verify",
    "reject",
]


class IncidentAttachmentResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    mime_type: str
    file_size_bytes: int
    caption: Optional[str] = None
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IncidentReviewLogResponse(BaseModel):
    id: int
    reviewer_name: str
    reviewer_role: str
    from_status: str
    to_status: str
    action: str
    notes: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IncidentBase(BaseModel):
    category: IncidentCategory = Field(..., description="Observed geohazard anomaly type")
    description: str = Field(..., min_length=3, description="Narrative description of ground observations")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude of the observation")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude of the observation")
    location_description: Optional[str] = Field(
        None, max_length=255, description="Optional approximate landmark or road corridor location"
    )
    location_id: Optional[int] = Field(None, ge=1, description="Associated monitored location ID, if identified")
    source_type: SourceType = Field("citizen", description="Identity class of the reporter")
    reporter_name: Optional[str] = Field(None, max_length=100, description="Optional name of the citizen/observer")
    reporter_contact: Optional[str] = Field(None, max_length=100, description="Optional phone or email")
    consent_given: bool = Field(True, description="Explicit reporter consent for incident processing")


class IncidentCreate(IncidentBase):
    reported_at: Optional[datetime] = Field(None, description="Report timestamp (defaults to current UTC time)")


class IncidentReviewAction(BaseModel):
    action: ReviewActionType = Field(..., description="Triage action to perform")
    notes: str = Field(..., min_length=3, description="Verification findings, rejection rationale, or info request details")


class IncidentUpdate(BaseModel):
    review_status: Optional[str] = Field(None, description="Administrative validation review status")
    description: Optional[str] = Field(None, min_length=3)
    category: Optional[IncidentCategory] = None
    location_id: Optional[int] = Field(None, ge=1)
    location_description: Optional[str] = None


class IncidentResponse(IncidentBase):
    id: int = Field(..., description="Unique incident identifier")
    reported_at: datetime
    review_status: str
    is_community_report: bool
    verified_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    attachment_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IncidentDetailResponse(IncidentResponse):
    attachments: List[IncidentAttachmentResponse] = []
    review_logs: List[IncidentReviewLogResponse] = []

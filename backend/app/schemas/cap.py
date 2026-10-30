from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class CapAuditLogResponse(BaseModel):
    id: int
    user_name: str
    user_role: str
    action: str
    notes: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CapDraftCreate(BaseModel):
    alert_id: Optional[int] = Field(None, ge=1, description="Associated system alert ID, if applicable")
    risk_assessment_id: Optional[int] = Field(None, ge=1, description="Associated susceptibility assessment ID")
    incident_id: Optional[int] = Field(None, ge=1, description="Associated verified incident ID")
    headline: str = Field(..., min_length=5, max_length=255, description="Brief headline of the warning")
    description: str = Field(..., min_length=10, description="Full hazard description and risk assessment findings")
    area_description: str = Field(..., min_length=3, max_length=255, description="Geographic area designation")
    urgency: Optional[str] = Field(None, description="CAP Urgency tier (Immediate, Expected, Future, Past)")
    severity: Optional[str] = Field(None, description="CAP Severity tier (Extreme, Severe, Moderate, Minor)")
    certainty: Optional[str] = Field(None, description="CAP Certainty tier (Observed, Likely, Possible, Unlikely)")
    instruction: Optional[str] = Field(None, description="Actionable safety guidance for transport & communities")
    circle_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    circle_lon: Optional[float] = Field(None, ge=-180.0, le=180.0)
    circle_radius_km: Optional[float] = Field(10.0, ge=0.5, le=500.0)
    scope: Optional[str] = Field("Private", description="CAP Scope (Private/Restricted during development)")


class CapApprovalRequest(BaseModel):
    notes: Optional[str] = Field(None, description="Official review approval comments")


class CapCancellationRequest(BaseModel):
    reason: str = Field(..., min_length=5, description="Required justification for cancelling the active alert")


class CapXmlPreviewResponse(BaseModel):
    identifier: str
    xml_payload: str
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []


class CapExportResponse(BaseModel):
    identifier: str
    dispatch_status: str
    export_count: int
    exported_at: datetime
    is_simulation: bool
    xml_payload: str
    dispatch_receipt: str


class CapMessageResponse(BaseModel):
    id: int
    identifier: str
    alert_id: Optional[int] = None
    risk_assessment_id: Optional[int] = None
    incident_id: Optional[int] = None
    sender: str
    sent_at: datetime
    status: str
    msg_type: str
    scope: str
    category: str
    event: str
    urgency: str
    severity: str
    certainty: str
    headline: str
    description: str
    instruction: Optional[str] = None
    area_description: str
    circle_lat: Optional[float] = None
    circle_lon: Optional[float] = None
    circle_radius_km: Optional[float] = None
    dispatch_status: str
    validation_outcome: Optional[str] = None
    is_simulation: bool
    export_count: int
    approved_at: Optional[datetime] = None
    exported_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    audit_logs: List[CapAuditLogResponse] = []

    model_config = ConfigDict(from_attributes=True)

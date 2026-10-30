from datetime import datetime
from typing import Optional, Literal, List
from pydantic import BaseModel, Field, ConfigDict

AlertSeverity = Literal["low", "moderate", "high", "critical"]
AlertStatus = Literal["draft", "issued", "acknowledged", "resolved", "cancelled"]


class AlertBase(BaseModel):
    location_id: Optional[int] = Field(None, ge=1, description="Associated location ID, if applicable")
    severity: AlertSeverity = Field(..., description="Alert urgency tier")
    title: str = Field(..., min_length=1, max_length=150, description="Headline of the warning dispatch")
    description: str = Field(..., min_length=1, description="Actionable advisory details")
    status: AlertStatus = Field("draft", description="Operational alert workflow status")
    acknowledged_at: Optional[datetime] = Field(None, description="UTC timestamp of authority acknowledgment")
    source: str = Field(..., min_length=1, max_length=100, description="Authorizing agency or protocol")
    triggering_assessment_id: Optional[int] = Field(None, description="ID of risk assessment that triggered this alert")
    alert_fingerprint: Optional[str] = Field(None, description="Deduplication event hash")
    cooldown_until: Optional[datetime] = Field(None, description="Expiration time of deduplication cooldown window")
    uncertainty_notes: Optional[str] = Field(None, description="Caveats, data limitations, and legal disclaimers")
    is_experimental: bool = Field(True, description="Indicates whether this alert is an experimental algorithmic warning")


class AlertResponse(AlertBase):
    id: int = Field(..., description="Unique alert identifier")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertTriggerEvaluationResponse(BaseModel):
    evaluated_locations: int
    alerts_issued: int
    alerts_suppressed: int
    suppression_reasons: List[str]
    dispatched_alerts: List[AlertResponse]
    evaluated_at: datetime

from datetime import datetime
from typing import Optional, Literal, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

RiskCategory = Literal["low", "moderate", "high", "critical", "insufficient_data"]
AssessmentType = Literal["susceptibility", "dynamic_risk", "insufficient_data"]


class FactorContributionSchema(BaseModel):
    factor_name: str
    raw_value: Optional[float] = None
    unit: str
    normalized_score: float
    weight: float
    contribution_score: float
    percentage_of_total: float
    narrative: str


class RiskAssessmentBase(BaseModel):
    location_id: int = Field(..., ge=1, description="Associated monitored location ID")
    risk_category: str = Field(..., description="Susceptibility classification")
    risk_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Normalized risk score (0.0 to 1.0)")
    assessment_type: str = Field("dynamic_risk", description="Evaluation type ('susceptibility' or 'dynamic_risk')")
    susceptibility_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Static terrain predisposition score")
    trigger_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Dynamic hydrometeorological trigger score")
    data_quality_status: Optional[str] = Field(None, description="Quality status of assessment inputs")
    contributing_factors_json: Optional[str] = Field(None, description="Serialized factor breakdown")
    limitations_notes: Optional[str] = Field(None, description="Identified data limitations & uncertainty caveats")
    assessed_at: datetime = Field(..., description="Timestamp of the evaluation (UTC)")
    assessment_source: str = Field(..., min_length=1, max_length=100, description="Methodology or model name")
    model_version: Optional[str] = Field(None, max_length=50, description="Model revision identifier")
    explanation: Optional[str] = Field(None, description="Analytical rationale or threshold trigger notes")


class RiskAssessmentResponse(RiskAssessmentBase):
    id: int = Field(..., description="Unique assessment identifier")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExplainableAssessmentResponse(BaseModel):
    location_id: int
    location_name: str
    assessment_type: str
    risk_category: str
    risk_score: Optional[float]
    susceptibility_score: Optional[float]
    trigger_score: Optional[float]
    data_quality_status: str
    is_sufficient_data: bool
    is_demo: bool
    assessed_at: datetime
    model_version: str
    model_name: str
    contributing_factors: List[FactorContributionSchema]
    features_used: Dict[str, Any]
    limitations: List[str]
    analytical_rationale: str


class DataReadinessReportResponse(BaseModel):
    report_timestamp: datetime
    total_locations: int
    locations_with_terrain: int
    locations_with_live_telemetry: int
    historical_incident_count: int
    verified_incident_count: int
    synthetic_demo_count: int
    available_features: List[str]
    missing_features: List[str]
    sampling_bias_assessment: str
    spatial_leakage_risks: str
    temporal_leakage_risks: str
    negative_sampling_caution: str
    ml_readiness_verdict: str
    prerequisites_for_ml_deployment: List[str]


class EvaluateRiskRequest(BaseModel):
    location_id: Optional[int] = Field(None, description="Optional specific location ID to evaluate")


class EvaluateRiskBatchResponse(BaseModel):
    evaluated_count: int
    results: List[ExplainableAssessmentResponse]
    evaluated_at: datetime

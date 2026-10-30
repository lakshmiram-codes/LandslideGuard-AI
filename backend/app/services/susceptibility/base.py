"""Base data contracts and abstract interface for landslide susceptibility and risk models."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class LocationTerrainFeatures:
    """Intrinsic static geomorphological terrain features."""
    location_id: int
    name: str
    latitude: float
    longitude: float
    elevation: Optional[float]  # meters above sea level
    slope_angle: Optional[float]  # degrees (0 to 90)
    state: str
    district: str
    is_demo: bool = False


@dataclass
class DynamicWeatherFeatures:
    """Extrinsic hydrometeorological trigger telemetry."""
    precipitation_mm: Optional[float] = None
    precipitation_observed_at: Optional[datetime] = None
    precipitation_quality: Optional[str] = None
    precipitation_is_forecast: bool = False

    soil_moisture_pct: Optional[float] = None
    soil_moisture_observed_at: Optional[datetime] = None
    soil_moisture_quality: Optional[str] = None

    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    source_attribution: Optional[str] = None


@dataclass
class FactorContribution:
    """Explicit contribution breakdown for a single input factor."""
    factor_name: str
    raw_value: Optional[float]
    unit: str
    normalized_score: float  # 0.0 to 1.0
    weight: float  # Factor weighting in model
    contribution_score: float  # normalized_score * weight
    percentage_of_total: float  # Percentage of final score
    narrative: str


@dataclass
class ExplainableAssessmentResult:
    """Scientifically defensible, explainable assessment output."""
    location_id: int
    location_name: str
    assessment_type: str  # 'susceptibility' (static) or 'dynamic_risk' (static + weather)
    risk_category: str  # 'low', 'moderate', 'high', 'critical', or 'insufficient_data'
    risk_score: Optional[float]  # 0.0 to 1.0, or None if insufficient_data
    susceptibility_score: Optional[float]  # Long-term static predisposition (0.0 to 1.0)
    trigger_score: Optional[float]  # Short-term dynamic trigger (0.0 to 1.0)

    data_quality_status: str  # 'VERIFIED_EVALUATION', 'DATA_STALE', 'INSUFFICIENT_DATA', 'DEMO_EVALUATION'
    is_sufficient_data: bool
    is_demo: bool

    assessed_at: datetime = field(default_factory=utc_now)
    model_version: str = "geomorphic-baseline-v1.0"
    model_name: str = "Geomorphic Antecedent Threshold Model"

    contributing_factors: List[FactorContribution] = field(default_factory=list)
    features_used: Dict[str, Any] = field(default_factory=dict)
    limitations: List[str] = field(default_factory=list)
    analytical_rationale: str = ""


@dataclass
class DataReadinessReport:
    """Comprehensive readiness audit of datasets for ML training and validation."""
    report_timestamp: datetime = field(default_factory=utc_now)
    total_locations: int = 0
    locations_with_terrain: int = 0
    locations_with_live_telemetry: int = 0
    historical_incident_count: int = 0
    verified_incident_count: int = 0
    synthetic_demo_count: int = 0

    available_features: List[str] = field(default_factory=list)
    missing_features: List[str] = field(default_factory=list)

    sampling_bias_assessment: str = ""
    spatial_leakage_risks: str = ""
    temporal_leakage_risks: str = ""
    negative_sampling_caution: str = ""
    ml_readiness_verdict: str = ""
    prerequisites_for_ml_deployment: List[str] = field(default_factory=list)


class BaseSusceptibilityModel(ABC):
    """Abstract interface for all landslide susceptibility and risk models."""

    @property
    @abstractmethod
    def version(self) -> str:
        """Model version identifier."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Human-readable model name."""
        pass

    @abstractmethod
    def evaluate_location(
        self,
        terrain: LocationTerrainFeatures,
        weather: Optional[DynamicWeatherFeatures] = None,
    ) -> ExplainableAssessmentResult:
        """Evaluate a single location's susceptibility and dynamic risk with full explanation."""
        pass

    @abstractmethod
    def audit_data_readiness(
        self,
        locations: List[LocationTerrainFeatures],
        incidents: List[Dict[str, Any]],
    ) -> DataReadinessReport:
        """Audit the data readiness and identify gaps before any ML training."""
        pass

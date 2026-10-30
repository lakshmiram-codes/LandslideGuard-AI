from datetime import datetime
from typing import Optional, Literal, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

ObservationType = Literal[
    "rainfall",
    "soil_moisture",
    "pore_water_pressure",
    "ground_vibration",
    "slope_displacement",
    "temperature",
    "relative_humidity",
    "surface_pressure",
]

DataQualityStatus = Literal[
    "CURRENT",
    "STALE",
    "MISSING",
    "INVALID",
    "FORECAST",
    "ERROR",
]


class ObservationBase(BaseModel):
    location_id: int = Field(..., ge=1, description="Foreign key to the monitored location")
    observation_type: ObservationType = Field(..., description="Environmental metric type")
    value: float = Field(..., description="Observed numeric measurement")
    unit: str = Field(..., min_length=1, max_length=20, description="Measurement unit (e.g., 'mm', '%', 'kPa')")
    observed_at: datetime = Field(..., description="Timestamp when observation was captured (UTC)")
    source: str = Field(..., min_length=1, max_length=100, description="Instrument or data provider name")
    provenance_metadata: Optional[str] = Field(None, max_length=255, description="Sensor calibration or batch metadata")
    quality_status: DataQualityStatus = Field("CURRENT", description="Data quality classification")
    is_forecast: bool = Field(False, description="True if value is a forecast prediction, False if observed analysis")
    retrieved_at: Optional[datetime] = Field(None, description="Timestamp when measurement was ingested into backend (UTC)")
    raw_metadata: Optional[str] = Field(None, max_length=1000, description="JSON metadata from weather provider")


class ObservationCreate(ObservationBase):
    pass


class ObservationResponse(ObservationBase):
    id: int = Field(..., description="Unique record identifier")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WeatherMetricSummary(BaseModel):
    metric_type: str = Field(..., description="e.g. 'rainfall', 'temperature', 'soil_moisture'")
    value: Optional[float] = Field(None, description="Numeric reading, or None if missing")
    unit: Optional[str] = Field(None, description="Measurement unit (e.g. 'mm')")
    observed_at: Optional[datetime] = Field(None, description="Observation timestamp in UTC")
    quality_status: DataQualityStatus = Field("MISSING", description="Freshness and quality tier")
    is_forecast: bool = Field(False, description="Distinguishes measured nowcast from forecast")
    source: Optional[str] = Field(None, description="Provider attribution")


class LocationWeatherStatusResponse(BaseModel):
    location_id: int
    location_name: str
    state: str
    district: str
    latitude: float
    longitude: float
    overall_status: DataQualityStatus
    latest_rainfall: Optional[WeatherMetricSummary] = None
    latest_soil_moisture: Optional[WeatherMetricSummary] = None
    latest_temperature: Optional[WeatherMetricSummary] = None
    latest_humidity: Optional[WeatherMetricSummary] = None
    last_retrieved_at: Optional[datetime] = None
    provider_name: str
    provider_coverage: str
    is_demo: bool


class PanIndiaWeatherStatusResponse(BaseModel):
    provider_name: str
    provider_status: str
    provider_docs_url: str
    attribution: str
    last_sync_utc: Optional[datetime] = None
    total_monitored_locations: int
    locations_current: int
    locations_stale: int
    locations_missing: int
    locations_invalid_or_error: int
    monitored_regions: List[str]
    locations: List[LocationWeatherStatusResponse]


class WeatherRefreshResponse(BaseModel):
    status: str
    provider: str
    refreshed_count: int
    failed_count: int
    skipped_count: int
    timestamp_utc: datetime
    details: List[Dict[str, Any]]


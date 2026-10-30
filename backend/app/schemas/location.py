from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class LocationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="Name of the monitored hill tract or village")
    state: str = Field(..., min_length=1, max_length=100, description="Indian state name (e.g., Assam, Meghalaya)")
    district: str = Field(..., min_length=1, max_length=100, description="District within the state")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="WGS84 latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="WGS84 longitude coordinate")
    elevation: Optional[float] = Field(None, description="Elevation above mean sea level in meters")
    slope_angle: Optional[float] = Field(None, ge=0.0, le=90.0, description="Slope inclination angle in degrees")
    is_active: bool = Field(True, description="Whether monitoring is active for this location")


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    state: Optional[str] = Field(None, min_length=1, max_length=100)
    district: Optional[str] = Field(None, min_length=1, max_length=100)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    elevation: Optional[float] = None
    slope_angle: Optional[float] = Field(None, ge=0.0, le=90.0)
    is_active: Optional[bool] = None


class LocationResponse(LocationBase):
    id: int = Field(..., description="Unique database identifier")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

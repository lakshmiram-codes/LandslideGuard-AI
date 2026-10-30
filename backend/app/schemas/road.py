from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

RoadStatus = Literal["open", "restricted", "blocked", "unknown"]


class RoadBase(BaseModel):
    road_name: str = Field(..., min_length=1, max_length=100, description="Designation (e.g., 'NH-27', 'NH-10')")
    state: str = Field(..., min_length=1, max_length=100, description="Indian state name")
    district: str = Field(..., min_length=1, max_length=100, description="District traversed by segment")
    connectivity_status: RoadStatus = Field("unknown", description="Transit corridor condition")
    status_description: Optional[str] = Field(None, max_length=255, description="Clearance notes or detours")
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)


class RoadCreate(RoadBase):
    pass


class RoadResponse(RoadBase):
    id: int = Field(..., description="Unique road segment identifier")
    last_updated: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

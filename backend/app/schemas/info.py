from pydantic import BaseModel, Field


class InfoResponse(BaseModel):
    application: str = Field(..., description="Application name")
    subtitle: str = Field(..., description="System subtitle / mission statement")
    version: str = Field(..., description="Application semantic version")
    current_phase: str = Field(..., description="Current development phase identifier")
    target_region: str = Field(..., description="Geographical coverage area")
    description: str = Field(..., description="System overview")
    status: str = Field(..., description="Overall platform status")

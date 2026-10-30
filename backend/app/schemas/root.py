from pydantic import BaseModel, Field


class RootResponse(BaseModel):
    application: str = Field(..., description="Name of the application")
    status: str = Field(..., description="Application operational status")
    version: str = Field(..., description="Semantic version string")
    phase: str = Field(..., description="Current development phase")
    docs_url: str = Field(..., description="API interactive documentation URL")

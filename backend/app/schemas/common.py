from typing import Generic, TypeVar, List, Optional
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T] = Field(..., description="List of items for the current page")
    total: int = Field(..., ge=0, description="Total number of matching records")
    page: int = Field(..., ge=1, description="Current page number (1-indexed)")
    size: int = Field(..., ge=1, description="Number of items per page")
    pages: int = Field(..., ge=0, description="Total number of pages")


class DatabaseHealthResponse(BaseModel):
    status: str = Field(..., description="API operational status: 'healthy' or 'degraded'")
    database_status: str = Field(..., description="Database status: 'connected' or 'unavailable'")
    dialect: Optional[str] = Field(None, description="Active database dialect (e.g., 'postgresql', 'sqlite')")
    database_available: bool = Field(..., description="Whether the database is accessible")
    details: Optional[str] = Field(None, description="Diagnostic information if unavailable")

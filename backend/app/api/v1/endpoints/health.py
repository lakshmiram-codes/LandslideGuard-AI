from datetime import datetime, timezone
from fastapi import APIRouter, Response, status
from app.core.config import settings
from app.core.database import check_db_health
from app.schemas.health import HealthResponse
from app.schemas.common import DatabaseHealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Application Health Check",
    description="Returns current operational status and heartbeat information of the LandslideGuard AI backend.",
)
async def get_health() -> HealthResponse:
    """Preserves Phase 1 and Phase 2 health contract."""
    return HealthResponse(
        status="healthy",
        application=settings.PROJECT_NAME,
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get(
    "/health/db",
    response_model=DatabaseHealthResponse,
    summary="Database Connectivity Diagnostic",
    description="Actively queries the database engine with SELECT 1 and distinguishes running API from database availability.",
)
def get_db_health(response: Response) -> DatabaseHealthResponse:
    db_result = check_db_health()
    if db_result.get("database_available"):
        return DatabaseHealthResponse(
            status="healthy",
            database_status="connected",
            dialect=db_result.get("dialect"),
            database_available=True,
            details="Database engine connection verified and responsive.",
        )
    else:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return DatabaseHealthResponse(
            status="degraded",
            database_status="unavailable",
            dialect=db_result.get("dialect"),
            database_available=False,
            details=db_result.get("error", "Database connection failed."),
        )

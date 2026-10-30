from fastapi import APIRouter
from app.core.config import settings
from app.schemas.info import InfoResponse

router = APIRouter()


@router.get(
    "/info",
    response_model=InfoResponse,
    summary="API Information",
    description="Returns public metadata about the LandslideGuard AI application and current development phase.",
)
async def get_info() -> InfoResponse:
    return InfoResponse(
        application=settings.PROJECT_NAME,
        subtitle="Early Warning and Landslide Risk Monitoring System",
        version=settings.VERSION,
        current_phase=settings.CURRENT_PHASE,
        target_region="Pan-India (Northern Himalayas, North Eastern Region, Western Ghats & Nilgiri Hills)",
        description=settings.DESCRIPTION,
        status="active",
    )

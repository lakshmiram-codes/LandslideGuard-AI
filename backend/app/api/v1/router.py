from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    info,
    locations,
    observations,
    incidents,
    roads,
    risk_assessments,
    alerts,
    weather,
    cap,
    auth,
)

api_router = APIRouter()

# Health & Info (Phase 1 & 2)
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(info.router, tags=["System Info"])

# Database Endpoints (Phase 3)
api_router.include_router(locations.router, prefix="/locations", tags=["Monitored Locations"])
api_router.include_router(observations.router, prefix="/observations", tags=["Environmental Observations"])
api_router.include_router(incidents.router, prefix="/incidents", tags=["Field Incident Reports"])
api_router.include_router(roads.router, prefix="/roads", tags=["Road Corridors"])
api_router.include_router(risk_assessments.router, prefix="/risk-assessments", tags=["Risk Assessments"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Early Warning Alerts"])

# Weather Telemetry Endpoints (Phase 5)
api_router.include_router(weather.router, prefix="/weather", tags=["Weather Integration"])

# Community Crowdsourcing & CAP Alerts (Phase 7)
api_router.include_router(cap.router, prefix="/cap", tags=["Common Alerting Protocol (CAP)"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Roles"])

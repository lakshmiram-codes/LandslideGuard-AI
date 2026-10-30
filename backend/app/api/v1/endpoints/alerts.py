from math import ceil
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.alert import Alert
from app.schemas.common import PaginatedResponse
from app.schemas.alert import AlertResponse, AlertTriggerEvaluationResponse
from app.services.susceptibility import SusceptibilityService
from app.services.alerts import AlertWarningEngine

router = APIRouter()
susceptibility_service = SusceptibilityService()
alert_engine = AlertWarningEngine()


@router.get(
    "",
    response_model=PaginatedResponse[AlertResponse],
    summary="List early warning alerts with pagination and severity filters",
)
def list_alerts(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    severity: Optional[str] = Query(None, description="Filter by severity (low/moderate/high/critical)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (draft/issued/acknowledged/resolved/cancelled)"),
    location_id: Optional[int] = Query(None, description="Filter by location ID"),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AlertResponse]:
    query = db.query(Alert)

    if severity:
        query = query.filter(Alert.severity == severity.strip().lower())
    if status_filter:
        query = query.filter(Alert.status == status_filter.strip().lower())
    if location_id:
        query = query.filter(Alert.location_id == location_id)

    total = query.count()
    offset = (page - 1) * size
    items = query.order_by(Alert.created_at.desc()).offset(offset).limit(size).all()
    pages = ceil(total / size) if total > 0 else 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.post(
    "/evaluate-triggers",
    response_model=AlertTriggerEvaluationResponse,
    summary="Evaluate current risk assessments and issue safeguarded alerts",
)
def evaluate_alert_triggers(
    location_id: Optional[int] = Query(None, description="Optional single location ID to evaluate"),
    db: Session = Depends(get_db),
) -> AlertTriggerEvaluationResponse:
    # 1. Run susceptibility & dynamic risk evaluation
    target_ids = [location_id] if location_id else None
    assessments = susceptibility_service.evaluate_pan_india_batch(db, location_ids=target_ids)

    issued_alerts: List[Alert] = []
    suppressed_reasons: List[str] = []

    # 2. Check each assessment against alert safeguards
    for ass in assessments:
        alert, reason = alert_engine.evaluate_and_dispatch(db, ass)
        if alert:
            issued_alerts.append(alert)
        elif reason:
            suppressed_reasons.append(f"{ass.location_name}: {reason}")

    db.commit()

    return AlertTriggerEvaluationResponse(
        evaluated_locations=len(assessments),
        alerts_issued=len(issued_alerts),
        alerts_suppressed=len(suppressed_reasons),
        suppression_reasons=suppressed_reasons,
        dispatched_alerts=issued_alerts,
        evaluated_at=datetime.now(timezone.utc),
    )


@router.patch(
    "/{alert_id}/acknowledge",
    response_model=AlertResponse,
    summary="Acknowledge an early warning alert",
)
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
) -> AlertResponse:
    try:
        alert = alert_engine.acknowledge_alert(db, alert_id)
        db.commit()
        return alert
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.patch(
    "/{alert_id}/resolve",
    response_model=AlertResponse,
    summary="Resolve an active alert",
)
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
) -> AlertResponse:
    try:
        alert = alert_engine.resolve_alert(db, alert_id)
        db.commit()
        return alert
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get(
    "/{alert_id}",
    response_model=AlertResponse,
    summary="Get alert by ID",
)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
) -> AlertResponse:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID {alert_id} not found.",
        )
    return alert

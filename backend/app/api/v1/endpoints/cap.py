import json
from math import ceil
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import (
    get_current_user_optional,
    get_current_user_required,
    require_cap_approver,
)
from app.models.cap_message import CapMessage
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.cap import (
    CapDraftCreate,
    CapMessageResponse,
    CapXmlPreviewResponse,
    CapApprovalRequest,
    CapCancellationRequest,
    CapExportResponse,
)
from app.services.cap import cap_service, cap_validator

router = APIRouter()


@router.post(
    "/draft",
    response_model=CapMessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Common Alerting Protocol (CAP v1.2) alert message draft",
)
def create_cap_draft(
    payload: CapDraftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
) -> CapMessageResponse:
    """
    Drafts a new CAP v1.2 XML warning message from an existing risk assessment,
    system alert, or custom parameters. Enforces data quality gates.
    """
    cap_msg = cap_service.create_cap_draft(
        db=db,
        sender_user=current_user,
        headline=payload.headline,
        description=payload.description,
        area_description=payload.area_description,
        alert_id=payload.alert_id,
        risk_assessment_id=payload.risk_assessment_id,
        incident_id=payload.incident_id,
        urgency=payload.urgency,
        severity=payload.severity,
        certainty=payload.certainty,
        instruction=payload.instruction,
        circle_lat=payload.circle_lat,
        circle_lon=payload.circle_lon,
        circle_radius_km=payload.circle_radius_km,
        scope=payload.scope or "Private",
        is_simulation=True,
    )
    return cap_msg


@router.get(
    "",
    response_model=PaginatedResponse[CapMessageResponse],
    summary="List CAP alert messages with pagination and status filters",
)
def list_cap_messages(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    dispatch_status: Optional[str] = Query(None, description="Filter by dispatch lifecycle status"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by CAP status (Draft, Test, Actual)"),
    msg_type: Optional[str] = Query(None, description="Filter by message type (Alert, Update, Cancel)"),
    db: Session = Depends(get_db),
) -> PaginatedResponse[CapMessageResponse]:
    query = db.query(CapMessage).options(selectinload(CapMessage.audit_logs))

    if dispatch_status:
        query = query.filter(CapMessage.dispatch_status == dispatch_status.strip().upper())
    if status_filter:
        query = query.filter(CapMessage.status == status_filter.strip().capitalize())
    if msg_type:
        query = query.filter(CapMessage.msg_type == msg_type.strip().capitalize())

    total = query.count()
    offset = (page - 1) * size
    items = query.order_by(CapMessage.created_at.desc()).offset(offset).limit(size).all()
    pages = ceil(total / size) if total > 0 else 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get(
    "/{cap_id}",
    response_model=CapMessageResponse,
    summary="Get detailed CAP message by ID including audit logs",
)
def get_cap_message(
    cap_id: int,
    db: Session = Depends(get_db),
) -> CapMessageResponse:
    cap_msg = (
        db.query(CapMessage)
        .options(selectinload(CapMessage.audit_logs))
        .filter(CapMessage.id == cap_id)
        .first()
    )
    if not cap_msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CAP message with ID {cap_id} not found.",
        )
    return cap_msg


@router.get(
    "/{cap_id}/preview",
    response_model=CapXmlPreviewResponse,
    summary="Preview raw CAP v1.2 XML payload and schema validation report",
)
def preview_cap_xml(
    cap_id: int,
    db: Session = Depends(get_db),
) -> CapXmlPreviewResponse:
    cap_msg = db.query(CapMessage).filter(CapMessage.id == cap_id).first()
    if not cap_msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CAP message with ID {cap_id} not found.",
        )

    xml_text = cap_msg.xml_payload or ""
    validation = cap_validator.validate_xml(xml_text)

    return CapXmlPreviewResponse(
        identifier=cap_msg.identifier,
        xml_payload=xml_text,
        is_valid=validation.is_valid,
        errors=validation.errors,
        warnings=validation.warnings,
    )


@router.post(
    "/{cap_id}/request-approval",
    response_model=CapMessageResponse,
    summary="Submit validated CAP message for official administrative approval",
)
def request_cap_approval(
    cap_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
) -> CapMessageResponse:
    cap_msg = db.query(CapMessage).filter(CapMessage.id == cap_id).first()
    if not cap_msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CAP message with ID {cap_id} not found.",
        )
    return cap_service.request_approval(db, cap_msg, current_user)


@router.post(
    "/{cap_id}/approve",
    response_model=CapMessageResponse,
    summary="Approve CAP alert message (Restricted to official_ddma or admin)",
)
def approve_cap_message(
    cap_id: int,
    payload: Optional[CapApprovalRequest] = None,
    db: Session = Depends(get_db),
    approver: User = Depends(require_cap_approver),
) -> CapMessageResponse:
    cap_msg = db.query(CapMessage).filter(CapMessage.id == cap_id).first()
    if not cap_msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CAP message with ID {cap_id} not found.",
        )
    notes = payload.notes if payload else None
    return cap_service.approve_cap_message(db, cap_msg, approver, notes=notes)


@router.post(
    "/{cap_id}/export",
    response_model=CapExportResponse,
    summary="Export simulated CAP alert payload (Restricted to official_ddma or admin)",
)
def export_cap_message(
    cap_id: int,
    db: Session = Depends(get_db),
    exporter: User = Depends(require_cap_approver),
) -> CapExportResponse:
    cap_msg = db.query(CapMessage).filter(CapMessage.id == cap_id).first()
    if not cap_msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CAP message with ID {cap_id} not found.",
        )
    result = cap_service.export_cap_message(db, cap_msg, exporter)
    return CapExportResponse(**result)


@router.post(
    "/{cap_id}/cancel",
    response_model=CapMessageResponse,
    summary="Cancel active CAP alert message with cancellation XML and reason",
)
def cancel_cap_message(
    cap_id: int,
    payload: CapCancellationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
) -> CapMessageResponse:
    cap_msg = db.query(CapMessage).filter(CapMessage.id == cap_id).first()
    if not cap_msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CAP message with ID {cap_id} not found.",
        )
    return cap_service.cancel_cap_message(db, cap_msg, current_user, payload.reason)

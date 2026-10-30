from datetime import datetime, timezone
from math import ceil
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import (
    get_current_user_optional,
    require_reviewer,
    check_prevent_self_approval,
)
from app.models.location import MonitoredLocation
from app.models.incident import IncidentReport, IncidentAttachment, IncidentReviewLog
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.incident import (
    IncidentCreate,
    IncidentUpdate,
    IncidentResponse,
    IncidentDetailResponse,
    IncidentReviewAction,
    IncidentAttachmentResponse,
)
from app.services.evidence import evidence_service

router = APIRouter()


def _format_incident_response(incident: IncidentReport) -> dict:
    """Helper to populate attachment_count on IncidentResponse."""
    d = {c.name: getattr(incident, c.name) for c in incident.__table__.columns}
    d["attachment_count"] = len(incident.attachments) if incident.attachments else 0
    return d


@router.post(
    "",
    response_model=IncidentDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a community incident report",
)
def create_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> IncidentDetailResponse:
    """
    Submits a new crowdsourced incident report or observer finding.
    Enforces geographic coordinate bounds, optional approximate location description,
    and sets initial status to 'submitted'.
    """
    if payload.latitude < -90.0 or payload.latitude > 90.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Latitude {payload.latitude} is outside valid range (-90 to +90 degrees).",
        )
    if payload.longitude < -180.0 or payload.longitude > 180.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Longitude {payload.longitude} is outside valid range (-180 to +180 degrees).",
        )

    # Validate referenced monitored location if given
    if payload.location_id is not None:
        loc = db.query(MonitoredLocation).filter(MonitoredLocation.id == payload.location_id).first()
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Referenced location ID {payload.location_id} does not exist.",
            )

    reporter_user_id = current_user.id if current_user else None
    reporter_name = payload.reporter_name or (current_user.display_name if current_user else None)

    incident = IncidentReport(
        category=payload.category,
        description=payload.description.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_description=payload.location_description.strip() if payload.location_description else None,
        location_id=payload.location_id,
        reported_at=payload.reported_at or datetime.now(timezone.utc),
        source_type=payload.source_type,
        review_status="pending_review",
        reporter_name=reporter_name,
        reporter_contact=payload.reporter_contact.strip() if payload.reporter_contact else None,
        reporter_user_id=reporter_user_id,
        consent_given=payload.consent_given,
        is_community_report=True,
    )
    db.add(incident)
    db.flush()

    # Create initial submission review audit log
    submit_log = IncidentReviewLog(
        incident_id=incident.id,
        reviewer_id=reporter_user_id,
        reviewer_name=reporter_name or "Anonymous Observer",
        reviewer_role=current_user.role if current_user else "citizen",
        from_status="NONE",
        to_status="pending_review",
        action="SUBMIT",
        notes="Crowdsourced community hazard report submitted for review.",
    )
    db.add(submit_log)
    db.commit()
    db.refresh(incident)

    res_data = _format_incident_response(incident)
    res_data["attachments"] = []
    res_data["review_logs"] = incident.review_logs
    return IncidentDetailResponse(**res_data)


@router.get(
    "",
    response_model=PaginatedResponse[IncidentResponse],
    summary="List incident reports with status, category, and community filters",
)
def list_incidents(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    review_status: Optional[str] = Query(None, description="Filter by review status (submitted, under_review, verified, rejected)"),
    category: Optional[str] = Query(None, description="Filter by hazard category"),
    location_id: Optional[int] = Query(None, description="Filter by monitored station ID"),
    is_community_report: Optional[bool] = Query(None, description="Filter community crowdsourced reports vs historical records"),
    source_type: Optional[str] = Query(None, description="Filter by source type (citizen, field_observer, official_ddma)"),
    db: Session = Depends(get_db),
) -> PaginatedResponse[IncidentResponse]:
    query = db.query(IncidentReport).options(selectinload(IncidentReport.attachments))

    if review_status:
        # Match both 'submitted' and legacy 'pending_review' when searching
        status_clean = review_status.strip().lower()
        if status_clean in ("submitted", "pending_review"):
            query = query.filter(IncidentReport.review_status.in_(["submitted", "pending_review"]))
        else:
            query = query.filter(IncidentReport.review_status == status_clean)

    if category:
        query = query.filter(IncidentReport.category == category.strip().lower())
    if location_id:
        query = query.filter(IncidentReport.location_id == location_id)
    if is_community_report is not None:
        query = query.filter(IncidentReport.is_community_report == is_community_report)
    if source_type:
        query = query.filter(IncidentReport.source_type == source_type.strip().lower())

    total = query.count()
    offset = (page - 1) * size
    items_raw = query.order_by(IncidentReport.reported_at.desc()).offset(offset).limit(size).all()
    pages = ceil(total / size) if total > 0 else 0

    items = [IncidentResponse(**_format_incident_response(i)) for i in items_raw]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get(
    "/{incident_id}",
    response_model=IncidentDetailResponse,
    summary="Get detailed incident report with attachments and review audit history",
)
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db),
) -> IncidentDetailResponse:
    incident = (
        db.query(IncidentReport)
        .options(
            selectinload(IncidentReport.attachments),
            selectinload(IncidentReport.review_logs),
        )
        .filter(IncidentReport.id == incident_id)
        .first()
    )
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident report with ID {incident_id} not found.",
        )

    res_data = _format_incident_response(incident)
    res_data["attachments"] = incident.attachments or []
    res_data["review_logs"] = incident.review_logs or []
    return IncidentDetailResponse(**res_data)


@router.post(
    "/{incident_id}/review",
    response_model=IncidentDetailResponse,
    summary="Review, verify, request info, or reject a report (Authorized Role Required)",
)
def review_incident(
    incident_id: int,
    payload: IncidentReviewAction,
    db: Session = Depends(get_db),
    reviewer: User = Depends(require_reviewer),
) -> IncidentDetailResponse:
    """
    Transitions incident review state:
    - start_review -> under_review
    - request_info -> needs_more_info
    - verify -> verified (records verified_at and verified_by_id)
    - reject -> rejected
    Enforces non-self-approval and appends to immutable review audit trail.
    """
    incident = db.query(IncidentReport).filter(IncidentReport.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident report with ID {incident_id} not found.",
        )

    # Prevent reviewer from self-approving their own report
    check_prevent_self_approval(incident, reviewer)

    old_status = incident.review_status
    action = payload.action

    if action == "start_review":
        new_status = "under_review"
    elif action == "request_info":
        new_status = "needs_more_info"
    elif action == "verify":
        new_status = "verified"
        incident.verified_at = datetime.now(timezone.utc)
        incident.verified_by_id = reviewer.id
    elif action == "reject":
        new_status = "rejected"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported review action: '{action}'.",
        )

    incident.review_status = new_status
    incident.review_notes = payload.notes.strip()

    # Append to review audit trail
    log_entry = IncidentReviewLog(
        incident_id=incident.id,
        reviewer_id=reviewer.id,
        reviewer_name=reviewer.display_name,
        reviewer_role=reviewer.role,
        from_status=old_status,
        to_status=new_status,
        action=action.upper(),
        notes=payload.notes.strip(),
    )
    db.add(log_entry)
    db.commit()
    db.refresh(incident)

    res_data = _format_incident_response(incident)
    res_data["attachments"] = incident.attachments or []
    res_data["review_logs"] = incident.review_logs or []
    return IncidentDetailResponse(**res_data)


@router.post(
    "/{incident_id}/attachments",
    response_model=IncidentAttachmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload photographic or document evidence for an incident report",
)
def upload_attachment(
    incident_id: int,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> IncidentAttachmentResponse:
    """
    Uploads evidence file attachment. Validates size (<=5MB), MIME type, extension,
    magic byte signature, computes SHA-256 hash, and prevents directory traversal.
    """
    incident = db.query(IncidentReport).filter(IncidentReport.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident report with ID {incident_id} not found.",
        )

    (
        safe_filename,
        original_name,
        relative_path,
        mime_type,
        file_size,
        sha256_hash,
    ) = evidence_service.validate_and_save(file)

    uploader_id = current_user.id if current_user else None

    attachment = IncidentAttachment(
        incident_id=incident.id,
        filename=safe_filename,
        original_filename=original_name,
        file_path=relative_path,
        mime_type=mime_type,
        file_size_bytes=file_size,
        sha256_hash=sha256_hash,
        caption=caption.strip() if caption else None,
        uploaded_by_id=uploader_id,
    )
    db.add(attachment)

    # Add log entry
    log_entry = IncidentReviewLog(
        incident_id=incident.id,
        reviewer_id=uploader_id,
        reviewer_name=current_user.display_name if current_user else "Reporter Attachment",
        reviewer_role=current_user.role if current_user else "citizen",
        from_status=incident.review_status,
        to_status=incident.review_status,
        action="ATTACH_EVIDENCE",
        notes=f"Attached evidence file: {original_name} ({file_size} bytes, {mime_type}).",
    )
    db.add(log_entry)
    db.commit()
    db.refresh(attachment)

    return IncidentAttachmentResponse.model_validate(attachment)


@router.get(
    "/{incident_id}/attachments/{attachment_id}",
    summary="Retrieve evidence file attachment safely",
)
def get_attachment(
    incident_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
):
    """Streams verified evidence attachment file with security headers."""
    attachment = db.query(IncidentAttachment).filter(
        IncidentAttachment.id == attachment_id,
        IncidentAttachment.incident_id == incident_id,
    ).first()
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attachment #{attachment_id} for incident #{incident_id} not found.",
        )

    file_path = evidence_service.get_file_path(attachment.filename)
    return FileResponse(
        path=file_path,
        media_type=attachment.mime_type,
        filename=attachment.original_filename,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'",
        },
    )


@router.patch(
    "/{incident_id}",
    response_model=IncidentResponse,
    summary="Update incident report status or details (Legacy compatibility)",
)
def update_incident(
    incident_id: int,
    payload: IncidentUpdate,
    db: Session = Depends(get_db),
) -> IncidentResponse:
    incident = db.query(IncidentReport).filter(IncidentReport.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident report with ID {incident_id} not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "location_id" in update_data and update_data["location_id"] is not None:
        loc = db.query(MonitoredLocation).filter(
            MonitoredLocation.id == update_data["location_id"]
        ).first()
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Referenced location ID {update_data['location_id']} does not exist.",
            )

    for field, value in update_data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(incident, field, value)

    db.commit()
    db.refresh(incident)
    return IncidentResponse(**_format_incident_response(incident))

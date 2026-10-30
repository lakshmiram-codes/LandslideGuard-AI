from datetime import datetime
from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.location import MonitoredLocation
from app.models.observation import EnvironmentalObservation
from app.schemas.common import PaginatedResponse
from app.schemas.observation import ObservationCreate, ObservationResponse

router = APIRouter()


@router.post(
    "",
    response_model=ObservationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an environmental observation",
)
def create_observation(
    payload: ObservationCreate,
    db: Session = Depends(get_db),
) -> ObservationResponse:
    # Validate referenced monitored location exists
    location = db.query(MonitoredLocation).filter(
        MonitoredLocation.id == payload.location_id
    ).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referenced location ID {payload.location_id} does not exist.",
        )

    observation = EnvironmentalObservation(
        location_id=payload.location_id,
        observation_type=payload.observation_type,
        value=payload.value,
        unit=payload.unit.strip(),
        observed_at=payload.observed_at,
        source=payload.source.strip(),
        provenance_metadata=payload.provenance_metadata.strip() if payload.provenance_metadata else None,
    )
    db.add(observation)
    db.commit()
    db.refresh(observation)
    return observation


@router.get(
    "",
    response_model=PaginatedResponse[ObservationResponse],
    summary="List environmental observations with filters and pagination",
)
def list_observations(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    location_id: Optional[int] = Query(None, description="Filter by location ID"),
    observation_type: Optional[str] = Query(None, description="Filter by observation metric"),
    start_time: Optional[datetime] = Query(None, description="Filter observations starting after UTC timestamp"),
    end_time: Optional[datetime] = Query(None, description="Filter observations recorded before UTC timestamp"),
    db: Session = Depends(get_db),
) -> PaginatedResponse[ObservationResponse]:
    query = db.query(EnvironmentalObservation)

    if location_id:
        query = query.filter(EnvironmentalObservation.location_id == location_id)
    if observation_type:
        query = query.filter(EnvironmentalObservation.observation_type == observation_type.strip().lower())
    if start_time:
        query = query.filter(EnvironmentalObservation.observed_at >= start_time)
    if end_time:
        query = query.filter(EnvironmentalObservation.observed_at <= end_time)

    total = query.count()
    offset = (page - 1) * size
    items = query.order_by(EnvironmentalObservation.observed_at.desc()).offset(offset).limit(size).all()
    pages = ceil(total / size) if total > 0 else 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get(
    "/{observation_id}",
    response_model=ObservationResponse,
    summary="Get observation by ID",
)
def get_observation(
    observation_id: int,
    db: Session = Depends(get_db),
) -> ObservationResponse:
    obs = db.query(EnvironmentalObservation).filter(
        EnvironmentalObservation.id == observation_id
    ).first()
    if not obs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environmental observation with ID {observation_id} not found.",
        )
    return obs

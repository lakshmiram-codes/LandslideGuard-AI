from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.location import MonitoredLocation
from app.models.observation import EnvironmentalObservation
from app.schemas.common import PaginatedResponse
from app.schemas.location import LocationCreate, LocationUpdate, LocationResponse

router = APIRouter()


@router.post(
    "",
    response_model=LocationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new monitored location",
)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
) -> LocationResponse:
    # Check for duplicate location name within same state and district
    existing = (
        db.query(MonitoredLocation)
        .filter(
            func.lower(MonitoredLocation.name) == payload.name.strip().lower(),
            func.lower(MonitoredLocation.district) == payload.district.strip().lower(),
            func.lower(MonitoredLocation.state) == payload.state.strip().lower(),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Location '{payload.name}' already registered in {payload.district}, {payload.state}.",
        )

    location = MonitoredLocation(
        name=payload.name.strip(),
        state=payload.state.strip(),
        district=payload.district.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        elevation=payload.elevation,
        slope_angle=payload.slope_angle,
        is_active=payload.is_active,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.get(
    "",
    response_model=PaginatedResponse[LocationResponse],
    summary="List monitored locations with pagination and filters",
)
def list_locations(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    state: Optional[str] = Query(None, description="Filter by state name"),
    district: Optional[str] = Query(None, description="Filter by district name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
) -> PaginatedResponse[LocationResponse]:
    query = db.query(MonitoredLocation)

    if state:
        query = query.filter(func.lower(MonitoredLocation.state) == state.strip().lower())
    if district:
        query = query.filter(func.lower(MonitoredLocation.district) == district.strip().lower())
    if is_active is not None:
        query = query.filter(MonitoredLocation.is_active == is_active)

    total = query.count()
    offset = (page - 1) * size
    items = query.order_by(MonitoredLocation.name.asc()).offset(offset).limit(size).all()
    pages = ceil(total / size) if total > 0 else 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get(
    "/{location_id}",
    response_model=LocationResponse,
    summary="Get monitored location by ID",
)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
) -> LocationResponse:
    location = db.query(MonitoredLocation).filter(MonitoredLocation.id == location_id).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Monitored location with ID {location_id} not found.",
        )
    return location


@router.patch(
    "/{location_id}",
    response_model=LocationResponse,
    summary="Update monitored location attributes",
)
def update_location(
    location_id: int,
    payload: LocationUpdate,
    db: Session = Depends(get_db),
) -> LocationResponse:
    location = db.query(MonitoredLocation).filter(MonitoredLocation.id == location_id).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Monitored location with ID {location_id} not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(location, field, value)

    db.commit()
    db.refresh(location)
    return location


@router.delete(
    "/{location_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a monitored location",
)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
) -> None:
    location = db.query(MonitoredLocation).filter(MonitoredLocation.id == location_id).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Monitored location with ID {location_id} not found.",
        )

    # Protect referential integrity: check for dependent observations
    obs_count = db.query(EnvironmentalObservation).filter(
        EnvironmentalObservation.location_id == location_id
    ).count()
    if obs_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete location {location_id}: {obs_count} environmental observation(s) reference it. Archive location by setting is_active=false instead.",
        )

    db.delete(location)
    db.commit()

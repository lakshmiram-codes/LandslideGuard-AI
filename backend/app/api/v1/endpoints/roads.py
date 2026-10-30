from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.road import RoadSegment
from app.schemas.common import PaginatedResponse
from app.schemas.road import RoadCreate, RoadResponse

router = APIRouter()


@router.post(
    "",
    response_model=RoadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a road segment corridor",
)
def create_road(
    payload: RoadCreate,
    db: Session = Depends(get_db),
) -> RoadResponse:
    road = RoadSegment(
        road_name=payload.road_name.strip(),
        state=payload.state.strip(),
        district=payload.district.strip(),
        connectivity_status=payload.connectivity_status,
        status_description=payload.status_description.strip() if payload.status_description else None,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(road)
    db.commit()
    db.refresh(road)
    return road


@router.get(
    "",
    response_model=PaginatedResponse[RoadResponse],
    summary="List road segments with status and location filters",
)
def list_roads(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    connectivity_status: Optional[str] = Query(None, description="Filter by status (open/restricted/blocked/unknown)"),
    state: Optional[str] = Query(None, description="Filter by state"),
    district: Optional[str] = Query(None, description="Filter by district"),
    db: Session = Depends(get_db),
) -> PaginatedResponse[RoadResponse]:
    query = db.query(RoadSegment)

    if connectivity_status:
        query = query.filter(RoadSegment.connectivity_status == connectivity_status.strip().lower())
    if state:
        query = query.filter(func.lower(RoadSegment.state) == state.strip().lower())
    if district:
        query = query.filter(func.lower(RoadSegment.district) == district.strip().lower())

    total = query.count()
    offset = (page - 1) * size
    items = query.order_by(RoadSegment.road_name.asc()).offset(offset).limit(size).all()
    pages = ceil(total / size) if total > 0 else 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get(
    "/{road_id}",
    response_model=RoadResponse,
    summary="Get road segment by ID",
)
def get_road(
    road_id: int,
    db: Session = Depends(get_db),
) -> RoadResponse:
    road = db.query(RoadSegment).filter(RoadSegment.id == road_id).first()
    if not road:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Road segment with ID {road_id} not found.",
        )
    return road

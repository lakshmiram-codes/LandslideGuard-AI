from math import ceil
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.risk_assessment import RiskAssessment
from app.models.location import MonitoredLocation
from app.schemas.common import PaginatedResponse
from app.schemas.risk_assessment import (
    RiskAssessmentResponse,
    ExplainableAssessmentResponse,
    DataReadinessReportResponse,
    EvaluateRiskRequest,
    EvaluateRiskBatchResponse,
    FactorContributionSchema,
)
from app.services.susceptibility import SusceptibilityService

router = APIRouter()
susceptibility_service = SusceptibilityService()


@router.get(
    "",
    response_model=PaginatedResponse[RiskAssessmentResponse],
    summary="List risk assessments with pagination and filters",
)
def list_risk_assessments(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    location_id: Optional[int] = Query(None, description="Filter by location ID"),
    risk_category: Optional[str] = Query(None, description="Filter by risk category (low/moderate/high/critical)"),
    db: Session = Depends(get_db),
) -> PaginatedResponse[RiskAssessmentResponse]:
    query = db.query(RiskAssessment)

    if location_id:
        query = query.filter(RiskAssessment.location_id == location_id)
    if risk_category:
        query = query.filter(RiskAssessment.risk_category == risk_category.strip().lower())

    total = query.count()
    offset = (page - 1) * size
    items = query.order_by(RiskAssessment.assessed_at.desc()).offset(offset).limit(size).all()
    pages = ceil(total / size) if total > 0 else 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get(
    "/data-readiness",
    response_model=DataReadinessReportResponse,
    summary="Audit dataset readiness, gaps, and ML feasibility",
)
def get_data_readiness_report(
    db: Session = Depends(get_db),
) -> DataReadinessReportResponse:
    report = susceptibility_service.get_data_readiness_report(db)
    return DataReadinessReportResponse(
        report_timestamp=report.report_timestamp,
        total_locations=report.total_locations,
        locations_with_terrain=report.locations_with_terrain,
        locations_with_live_telemetry=report.locations_with_live_telemetry,
        historical_incident_count=report.historical_incident_count,
        verified_incident_count=report.verified_incident_count,
        synthetic_demo_count=report.synthetic_demo_count,
        available_features=report.available_features,
        missing_features=report.missing_features,
        sampling_bias_assessment=report.sampling_bias_assessment,
        spatial_leakage_risks=report.spatial_leakage_risks,
        temporal_leakage_risks=report.temporal_leakage_risks,
        negative_sampling_caution=report.negative_sampling_caution,
        ml_readiness_verdict=report.ml_readiness_verdict,
        prerequisites_for_ml_deployment=report.prerequisites_for_ml_deployment,
    )


@router.get(
    "/explain/{location_id}",
    response_model=ExplainableAssessmentResponse,
    summary="Get explainable factor breakdown for a specific location",
)
def get_assessment_explanation(
    location_id: int,
    db: Session = Depends(get_db),
) -> ExplainableAssessmentResponse:
    loc = db.query(MonitoredLocation).filter(MonitoredLocation.id == location_id).first()
    if not loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location with ID {location_id} not found.",
        )

    try:
        result = susceptibility_service.evaluate_location(db, location_id, persist=False)
        return ExplainableAssessmentResponse(
            location_id=result.location_id,
            location_name=result.location_name,
            assessment_type=result.assessment_type,
            risk_category=result.risk_category,
            risk_score=result.risk_score,
            susceptibility_score=result.susceptibility_score,
            trigger_score=result.trigger_score,
            data_quality_status=result.data_quality_status,
            is_sufficient_data=result.is_sufficient_data,
            is_demo=result.is_demo,
            assessed_at=result.assessed_at,
            model_version=result.model_version,
            model_name=result.model_name,
            contributing_factors=[
                FactorContributionSchema(
                    factor_name=f.factor_name,
                    raw_value=f.raw_value,
                    unit=f.unit,
                    normalized_score=f.normalized_score,
                    weight=f.weight,
                    contribution_score=f.contribution_score,
                    percentage_of_total=f.percentage_of_total,
                    narrative=f.narrative,
                )
                for f in result.contributing_factors
            ],
            features_used=result.features_used,
            limitations=result.limitations,
            analytical_rationale=result.analytical_rationale,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate assessment explanation: {str(e)}",
        )


@router.post(
    "/evaluate",
    response_model=EvaluateRiskBatchResponse,
    summary="Evaluate susceptibility and dynamic risk using current telemetry",
)
def evaluate_risk(
    request: Optional[EvaluateRiskRequest] = None,
    db: Session = Depends(get_db),
) -> EvaluateRiskBatchResponse:
    target_ids = [request.location_id] if request and request.location_id else None

    if target_ids:
        loc = db.query(MonitoredLocation).filter(MonitoredLocation.id == target_ids[0]).first()
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location with ID {target_ids[0]} not found.",
            )

    results = susceptibility_service.evaluate_pan_india_batch(db, location_ids=target_ids)

    response_items = [
        ExplainableAssessmentResponse(
            location_id=r.location_id,
            location_name=r.location_name,
            assessment_type=r.assessment_type,
            risk_category=r.risk_category,
            risk_score=r.risk_score,
            susceptibility_score=r.susceptibility_score,
            trigger_score=r.trigger_score,
            data_quality_status=r.data_quality_status,
            is_sufficient_data=r.is_sufficient_data,
            is_demo=r.is_demo,
            assessed_at=r.assessed_at,
            model_version=r.model_version,
            model_name=r.model_name,
            contributing_factors=[
                FactorContributionSchema(
                    factor_name=f.factor_name,
                    raw_value=f.raw_value,
                    unit=f.unit,
                    normalized_score=f.normalized_score,
                    weight=f.weight,
                    contribution_score=f.contribution_score,
                    percentage_of_total=f.percentage_of_total,
                    narrative=f.narrative,
                )
                for f in r.contributing_factors
            ],
            features_used=r.features_used,
            limitations=r.limitations,
            analytical_rationale=r.analytical_rationale,
        )
        for r in results
    ]

    return EvaluateRiskBatchResponse(
        evaluated_count=len(results),
        results=response_items,
        evaluated_at=datetime.now(timezone.utc),
    )


@router.get(
    "/{assessment_id}",
    response_model=RiskAssessmentResponse,
    summary="Get risk assessment by ID",
)
def get_risk_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
) -> RiskAssessmentResponse:
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Risk assessment with ID {assessment_id} not found.",
        )
    return assessment

"""Susceptibility assessment service orchestrating database feature extraction, model scoring, and persistence."""

import json
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session

from app.models.location import MonitoredLocation
from app.models.observation import EnvironmentalObservation
from app.models.incident import IncidentReport
from app.models.risk_assessment import RiskAssessment
from app.services.susceptibility.base import (
    LocationTerrainFeatures,
    DynamicWeatherFeatures,
    ExplainableAssessmentResult,
    DataReadinessReport,
    FactorContribution,
    utc_now,
)
from app.services.susceptibility.baseline import GeomorphicBaselineModel


class SusceptibilityService:
    """Service to evaluate, explain, and persist geohazard susceptibility and dynamic risk assessments."""

    def __init__(self, model=None):
        self.model = model or GeomorphicBaselineModel()

    def _extract_terrain_features(self, loc: MonitoredLocation) -> LocationTerrainFeatures:
        return LocationTerrainFeatures(
            location_id=loc.id,
            name=loc.name,
            latitude=loc.latitude,
            longitude=loc.longitude,
            elevation=loc.elevation,
            slope_angle=loc.slope_angle,
            state=loc.state,
            district=loc.district,
            is_demo="[DEMO]" in loc.name,
        )

    def _extract_weather_features(self, db: Session, location_id: int) -> DynamicWeatherFeatures:
        """Pulls the most recent hydrometeorological observations for this location."""
        observations = (
            db.query(EnvironmentalObservation)
            .filter(EnvironmentalObservation.location_id == location_id)
            .order_by(EnvironmentalObservation.observed_at.desc())
            .all()
        )

        precip_obs: Optional[EnvironmentalObservation] = None
        moist_obs: Optional[EnvironmentalObservation] = None
        temp_obs: Optional[EnvironmentalObservation] = None
        hum_obs: Optional[EnvironmentalObservation] = None

        for obs in observations:
            t = obs.observation_type.lower()
            if ("rain" in t or "precip" in t) and precip_obs is None:
                precip_obs = obs
            elif ("moist" in t or "soil" in t) and moist_obs is None:
                moist_obs = obs
            elif "temp" in t and temp_obs is None:
                temp_obs = obs
            elif "humid" in t and hum_obs is None:
                hum_obs = obs

        features = DynamicWeatherFeatures()

        if precip_obs:
            features.precipitation_mm = precip_obs.value
            features.precipitation_observed_at = precip_obs.observed_at
            features.precipitation_quality = precip_obs.quality_status
            features.precipitation_is_forecast = bool(precip_obs.is_forecast)
            features.source_attribution = precip_obs.source

        if moist_obs:
            features.soil_moisture_pct = moist_obs.value
            features.soil_moisture_observed_at = moist_obs.observed_at
            features.soil_moisture_quality = moist_obs.quality_status
            if not features.source_attribution:
                features.source_attribution = moist_obs.source

        if temp_obs:
            features.temperature_c = temp_obs.value

        if hum_obs:
            features.humidity_pct = hum_obs.value

        return features

    def evaluate_location(
        self, db: Session, location_id: int, persist: bool = True
    ) -> ExplainableAssessmentResult:
        """Evaluates susceptibility and dynamic risk for a single location and optionally persists."""
        loc = db.query(MonitoredLocation).filter(MonitoredLocation.id == location_id).first()
        if not loc:
            raise ValueError(f"Monitored location ID {location_id} not found.")

        terrain = self._extract_terrain_features(loc)
        weather = self._extract_weather_features(db, location_id)

        result = self.model.evaluate_location(terrain, weather)

        if persist:
            self._persist_assessment(db, result)

        return result

    def evaluate_pan_india_batch(
        self, db: Session, location_ids: Optional[List[int]] = None
    ) -> List[ExplainableAssessmentResult]:
        """Evaluates a batch of locations across India and persists assessments."""
        query = db.query(MonitoredLocation)
        if location_ids:
            query = query.filter(MonitoredLocation.id.in_(location_ids))
        locations = query.all()

        results: List[ExplainableAssessmentResult] = []
        for loc in locations:
            terrain = self._extract_terrain_features(loc)
            weather = self._extract_weather_features(db, loc.id)
            res = self.model.evaluate_location(terrain, weather)
            self._persist_assessment(db, res)
            results.append(res)

        db.commit()
        return results

    def _persist_assessment(self, db: Session, result: ExplainableAssessmentResult) -> RiskAssessment:
        """Persists or updates the latest risk assessment record in database."""
        # Convert factor contributions to JSON
        factors_dict = [
            {
                "factor_name": f.factor_name,
                "raw_value": f.raw_value,
                "unit": f.unit,
                "normalized_score": f.normalized_score,
                "weight": f.weight,
                "contribution_score": f.contribution_score,
                "percentage_of_total": f.percentage_of_total,
                "narrative": f.narrative,
            }
            for f in result.contributing_factors
        ]
        factors_json = json.dumps(factors_dict)
        limitations_str = " | ".join(result.limitations) if result.limitations else None

        # Check existing assessment for location
        existing = (
            db.query(RiskAssessment)
            .filter(RiskAssessment.location_id == result.location_id)
            .order_by(RiskAssessment.assessed_at.desc())
            .first()
        )

        assessment_source = (
            f"{self.model.model_name} [DEMO]" if result.is_demo else self.model.model_name
        )

        category_for_db = (
            "low" if result.risk_category == "insufficient_data" else result.risk_category
        )

        if existing:
            existing.risk_category = category_for_db
            existing.risk_score = result.risk_score
            existing.assessed_at = result.assessed_at
            existing.assessment_source = assessment_source
            existing.model_version = result.model_version
            existing.explanation = result.analytical_rationale

            # Extra columns if present
            if hasattr(existing, "assessment_type"):
                existing.assessment_type = result.assessment_type
            if hasattr(existing, "susceptibility_score"):
                existing.susceptibility_score = result.susceptibility_score
            if hasattr(existing, "trigger_score"):
                existing.trigger_score = result.trigger_score
            if hasattr(existing, "data_quality_status"):
                existing.data_quality_status = result.data_quality_status
            if hasattr(existing, "contributing_factors_json"):
                existing.contributing_factors_json = factors_json
            if hasattr(existing, "limitations_notes"):
                existing.limitations_notes = limitations_str

            db.flush()
            return existing
        else:
            kwargs = {
                "location_id": result.location_id,
                "risk_category": category_for_db,
                "risk_score": result.risk_score,
                "assessed_at": result.assessed_at,
                "assessment_source": assessment_source,
                "model_version": result.model_version,
                "explanation": result.analytical_rationale,
            }
            # Check model fields
            if hasattr(RiskAssessment, "assessment_type"):
                kwargs["assessment_type"] = result.assessment_type
            if hasattr(RiskAssessment, "susceptibility_score"):
                kwargs["susceptibility_score"] = result.susceptibility_score
            if hasattr(RiskAssessment, "trigger_score"):
                kwargs["trigger_score"] = result.trigger_score
            if hasattr(RiskAssessment, "data_quality_status"):
                kwargs["data_quality_status"] = result.data_quality_status
            if hasattr(RiskAssessment, "contributing_factors_json"):
                kwargs["contributing_factors_json"] = factors_json
            if hasattr(RiskAssessment, "limitations_notes"):
                kwargs["limitations_notes"] = limitations_str

            new_ra = RiskAssessment(**kwargs)
            db.add(new_ra)
            db.flush()
            return new_ra

    def get_data_readiness_report(self, db: Session) -> DataReadinessReport:
        """Compiles real database statistics and runs audit_data_readiness."""
        locations = db.query(MonitoredLocation).all()
        incidents = db.query(IncidentReport).all()

        loc_features = [self._extract_terrain_features(l) for l in locations]
        inc_dicts = [
            {"id": i.id, "category": i.category, "review_status": i.review_status}
            for i in incidents
        ]

        report = self.model.audit_data_readiness(loc_features, inc_dicts)

        # Count locations with recent live telemetry
        recent_threshold = utc_now() - timedelta(hours=24)
        active_telemetry_locs = (
            db.query(EnvironmentalObservation.location_id)
            .filter(EnvironmentalObservation.observed_at >= recent_threshold)
            .distinct()
            .count()
        )
        report.locations_with_live_telemetry = active_telemetry_locs

        return report

"""Scientifically grounded, explainable geomorphic baseline susceptibility and dynamic risk model."""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
from app.services.susceptibility.base import (
    BaseSusceptibilityModel,
    LocationTerrainFeatures,
    DynamicWeatherFeatures,
    FactorContribution,
    ExplainableAssessmentResult,
    DataReadinessReport,
    utc_now,
)


class GeomorphicBaselineModel(BaseSusceptibilityModel):
    """
    Transparent, physics-informed baseline model for landslide hazard assessment.
    
    Scientific Foundations:
    - Long-Term Susceptibility: Based on Varnes (1984) and Cruden & Varnes (1996) geomorphological
      landslide classifications. Gravitational shear stress is governed by slope gradient (theta)
      and internal friction angles of colluvial mantles (typically 28° to 38°).
    - Dynamic Hazard Trigger: In-situ antecedent precipitation and volumetric soil moisture
      increase positive pore-water pressure (u), directly reducing effective normal stress
      (sigma' = sigma - u) according to Terzaghi's principle.
    """

    @property
    def version(self) -> str:
        return "geomorphic-baseline-v1.0"

    @property
    def model_name(self) -> str:
        return "Deterministic Geomorphic & Antecedent Threshold Model"

    # Slope angle normalization function
    def _normalize_slope(self, slope: float) -> Tuple[float, str]:
        if slope < 0.0 or slope > 90.0:
            return 0.0, "Invalid slope angle outside 0-90 degree boundary."
        if slope < 15.0:
            score = (slope / 15.0) * 0.20
            narrative = f"Gentle inclination ({slope:.1f}°); gravitational shear driving stress is low."
        elif slope < 30.0:
            score = 0.20 + ((slope - 15.0) / 15.0) * 0.35
            narrative = f"Moderate slope gradient ({slope:.1f}°); stable under dry conditions but susceptible to lubricating shear."
        elif slope <= 45.0:
            score = 0.55 + ((slope - 30.0) / 15.0) * 0.35
            narrative = f"Critical shear incline ({slope:.1f}°); approaches typical colluvial angle of internal friction (28°-38°)."
        else:
            score = 0.90 + min(((slope - 45.0) / 45.0) * 0.10, 0.10)
            narrative = f"Steep escarpment ({slope:.1f}°); highly prone to translational failure, rock detachments, and gravity falls."
        return round(score, 4), narrative

    # Elevation relief normalization function
    def _normalize_elevation(self, elevation: float) -> Tuple[float, str]:
        if elevation < 0.0:
            return 0.0, "Sea-level or depressed elevation baseline."
        # Normalized up to 3500m (Himalayan / high Western Ghats relief threshold)
        score = min(elevation / 3500.0, 1.0) * 0.90 + 0.10
        narrative = f"Elevation relief of {elevation:.0f}m amplifies orographic condensation, kinetic energy of runout, and frost weathering."
        return round(score, 4), narrative

    # Precipitation normalization function (Caine 1980 / GSI threshold proxy)
    def _normalize_rainfall(self, rainfall: float) -> Tuple[float, str]:
        if rainfall < 0.0 or rainfall > 500.0:
            return 0.0, "Rainfall rate outside physical range."
        if rainfall < 15.0:
            score = (rainfall / 15.0) * 0.15
            narrative = f"Minimal recent precipitation ({rainfall:.1f} mm); low hydraulic infiltration."
        elif rainfall < 50.0:
            score = 0.15 + ((rainfall - 15.0) / 35.0) * 0.35
            narrative = f"Moderate steady precipitation ({rainfall:.1f} mm); elevates shallow soil moisture storage."
        elif rainfall <= 100.0:
            score = 0.50 + ((rainfall - 50.0) / 50.0) * 0.35
            narrative = f"Heavy rainfall accumulation ({rainfall:.1f} mm); exceeds standard hourly infiltration capacity."
        else:
            score = 0.85 + min(((rainfall - 100.0) / 150.0) * 0.15, 0.15)
            narrative = f"Torrential downpour ({rainfall:.1f} mm); dangerous overland surge and high hydraulic liquefaction potential."
        return round(score, 4), narrative

    # Soil moisture saturation normalization function
    def _normalize_soil_moisture(self, moisture: float) -> Tuple[float, str]:
        if moisture < 0.0 or moisture > 100.0:
            return 0.0, "Soil moisture outside 0-100% boundary."
        if moisture < 40.0:
            score = (moisture / 40.0) * 0.20
            narrative = f"Dry to normal soil moisture ({moisture:.1f}%); high matric suction and effective cohesive strength."
        elif moisture < 70.0:
            score = 0.20 + ((moisture - 40.0) / 30.0) * 0.40
            narrative = f"Elevated soil saturation ({moisture:.1f}%); reduction in negative pore pressures."
        elif moisture <= 85.0:
            score = 0.60 + ((moisture - 70.0) / 15.0) * 0.28
            narrative = f"High soil moisture saturation ({moisture:.1f}%); critical pore-water pressure buildup along slip planes."
        else:
            score = 0.88 + min(((moisture - 85.0) / 15.0) * 0.12, 0.12)
            narrative = f"Extreme hydrologic saturation ({moisture:.1f}%); severe loss of shear strength, liquefaction, and imminent slurry surge vulnerability."
        return round(score, 4), narrative

    def evaluate_location(
        self,
        terrain: LocationTerrainFeatures,
        weather: Optional[DynamicWeatherFeatures] = None,
    ) -> ExplainableAssessmentResult:
        """
        Evaluates a location with strict data-quality gating and explicit uncertainty communication.
        """
        limitations: List[str] = []
        factors: List[FactorContribution] = []
        features_used: Dict[str, Any] = {
            "location_id": terrain.location_id,
            "name": terrain.name,
            "latitude": terrain.latitude,
            "longitude": terrain.longitude,
            "elevation": terrain.elevation,
            "slope_angle": terrain.slope_angle,
        }

        is_demo = terrain.is_demo or "[DEMO]" in terrain.name

        # 1. Gate: Verify Terrain Features
        if terrain.slope_angle is None or terrain.elevation is None:
            limitations.append("Missing essential geomorphological parameters (slope incline or elevation).")
            return ExplainableAssessmentResult(
                location_id=terrain.location_id,
                location_name=terrain.name,
                assessment_type="insufficient_data",
                risk_category="insufficient_data",
                risk_score=None,
                susceptibility_score=None,
                trigger_score=None,
                data_quality_status="INSUFFICIENT_DATA",
                is_sufficient_data=False,
                is_demo=is_demo,
                model_version=self.version,
                model_name=self.model_name,
                contributing_factors=[],
                features_used=features_used,
                limitations=limitations,
                analytical_rationale="Assessment halted: Missing essential slope or elevation measurements.",
            )

        # 2. Compute Long-Term Terrain Susceptibility
        slope_score, slope_narrative = self._normalize_slope(terrain.slope_angle)
        elev_score, elev_narrative = self._normalize_elevation(terrain.elevation)

        slope_weight = 0.75
        elev_weight = 0.25

        susceptibility = (slope_score * slope_weight) + (elev_score * elev_weight)
        susceptibility = round(min(max(susceptibility, 0.0), 1.0), 4)

        factors.append(
            FactorContribution(
                factor_name="Slope Incline",
                raw_value=terrain.slope_angle,
                unit="degrees",
                normalized_score=slope_score,
                weight=slope_weight,
                contribution_score=round(slope_score * slope_weight, 4),
                percentage_of_total=0.0,  # Will normalize below
                narrative=slope_narrative,
            )
        )

        factors.append(
            FactorContribution(
                factor_name="Elevation Relief",
                raw_value=terrain.elevation,
                unit="meters",
                normalized_score=elev_score,
                weight=elev_weight,
                contribution_score=round(elev_score * elev_weight, 4),
                percentage_of_total=0.0,
                narrative=elev_narrative,
            )
        )

        # 3. Dynamic Hydrometeorological Evaluation
        has_weather = weather is not None
        has_rain = has_weather and weather.precipitation_mm is not None
        has_moist = has_weather and weather.soil_moisture_pct is not None

        trigger_score: Optional[float] = None
        data_quality_status = "VERIFIED_EVALUATION"
        if is_demo:
            data_quality_status = "DEMO_EVALUATION"

        if not has_rain or not has_moist:
            limitations.append("Missing dynamic rainfall or soil moisture telemetry; evaluating static terrain susceptibility only.")
            if not has_rain:
                limitations.append("Rainfall telemetry missing: System does NOT assume 0.0 mm rainfall.")
            if not has_moist:
                limitations.append("Soil moisture telemetry missing: In-situ pore pressure is unknown.")

            # Static susceptibility only
            assessment_type = "susceptibility"
            final_score = susceptibility

            # Distribute factor percentages
            for f in factors:
                f.percentage_of_total = round((f.contribution_score / susceptibility) * 100.0, 1)

            category = self._categorize_score(final_score)
            rationale = (
                f"Static terrain susceptibility is {category.upper()} ({final_score:.2f}) based on "
                f"slope ({terrain.slope_angle:.1f}°) and elevation ({terrain.elevation:.0f}m). "
                f"Dynamic triggers could not be computed due to missing in-situ telemetry."
            )

            return ExplainableAssessmentResult(
                location_id=terrain.location_id,
                location_name=terrain.name,
                assessment_type=assessment_type,
                risk_category=category,
                risk_score=final_score,
                susceptibility_score=susceptibility,
                trigger_score=None,
                data_quality_status="INSUFFICIENT_DATA" if not is_demo else "DEMO_EVALUATION",
                is_sufficient_data=False,
                is_demo=is_demo,
                model_version=self.version,
                model_name=self.model_name,
                contributing_factors=factors,
                features_used=features_used,
                limitations=limitations,
                analytical_rationale=rationale,
            )

        # Weather data is present
        features_used["precipitation_mm"] = weather.precipitation_mm
        features_used["precipitation_observed_at"] = (
            weather.precipitation_observed_at.isoformat() if weather.precipitation_observed_at else None
        )
        features_used["soil_moisture_pct"] = weather.soil_moisture_pct
        features_used["temperature_c"] = weather.temperature_c
        features_used["humidity_pct"] = weather.humidity_pct

        # Check staleness
        rain_is_stale = weather.precipitation_quality == "STALE"
        moist_is_stale = weather.soil_moisture_quality == "STALE"

        if rain_is_stale or moist_is_stale:
            data_quality_status = "DATA_STALE"
            limitations.append("Telemetry inputs are stale (> 3 hours old); risk assessment reflects degraded confidence.")

        if weather.precipitation_is_forecast:
            limitations.append("Precipitation input is derived from a numerical forecast projection, not an in-situ rain gauge.")

        rain_score, rain_narrative = self._normalize_rainfall(weather.precipitation_mm)
        moist_score, moist_narrative = self._normalize_soil_moisture(weather.soil_moisture_pct)

        rain_weight = 0.55
        moist_weight = 0.45

        trigger_score = round((rain_score * rain_weight) + (moist_score * moist_weight), 4)

        factors.append(
            FactorContribution(
                factor_name="Precipitation Trigger",
                raw_value=weather.precipitation_mm,
                unit="mm",
                normalized_score=rain_score,
                weight=rain_weight,
                contribution_score=round(rain_score * rain_weight, 4),
                percentage_of_total=0.0,
                narrative=rain_narrative,
            )
        )

        factors.append(
            FactorContribution(
                factor_name="Soil Moisture Saturation",
                raw_value=weather.soil_moisture_pct,
                unit="%",
                normalized_score=moist_score,
                weight=moist_weight,
                contribution_score=round(moist_score * moist_weight, 4),
                percentage_of_total=0.0,
                narrative=moist_narrative,
            )
        )

        # Combined dynamic hazard: Susceptibility modulated by hydrometeorological trigger
        # Formula: R_dynamic = Susceptibility * (0.35 + 0.65 * Trigger)
        combined_score = susceptibility * (0.35 + 0.65 * trigger_score)
        combined_score = round(min(max(combined_score, 0.0), 1.0), 4)

        # Calculate factor contribution percentages
        total_raw_contrib = sum(f.contribution_score for f in factors)
        if total_raw_contrib > 0.0:
            for f in factors:
                f.percentage_of_total = round((f.contribution_score / total_raw_contrib) * 100.0, 1)

        category = self._categorize_score(combined_score)
        rationale = (
            f"Dynamic landslide risk evaluated as {category.upper()} ({combined_score:.2f}) "
            f"[Susceptibility: {susceptibility:.2f}, Dynamic Trigger: {trigger_score:.2f}]. "
            f"Key drivers: {factors[0].factor_name} ({factors[0].percentage_of_total}%), "
            f"{factors[2].factor_name} ({factors[2].percentage_of_total}%)."
        )

        return ExplainableAssessmentResult(
            location_id=terrain.location_id,
            location_name=terrain.name,
            assessment_type="dynamic_risk",
            risk_category=category,
            risk_score=combined_score,
            susceptibility_score=susceptibility,
            trigger_score=trigger_score,
            data_quality_status=data_quality_status,
            is_sufficient_data=True,
            is_demo=is_demo,
            model_version=self.version,
            model_name=self.model_name,
            contributing_factors=factors,
            features_used=features_used,
            limitations=limitations,
            analytical_rationale=rationale,
        )

    def audit_data_readiness(
        self,
        locations: List[LocationTerrainFeatures],
        incidents: List[Dict[str, Any]],
    ) -> DataReadinessReport:
        """
        Audits current database assets against standard machine-learning landslide susceptibility criteria.
        """
        total_locs = len(locations)
        with_terrain = sum(1 for l in locations if l.slope_angle is not None and l.elevation is not None)
        demo_count = sum(1 for l in locations if l.is_demo or "[DEMO]" in l.name)
        incident_count = len(incidents)
        verified_count = sum(1 for i in incidents if i.get("review_status") == "verified")

        available = [
            "Digital Elevation Model proxy (elevation in meters)",
            "Slope inclination gradient (degrees)",
            "Real-time external atmospheric precipitation (Open-Meteo ECMWF/GFS)",
            "Volumetric root-zone soil moisture (Open-Meteo 0-7cm analysis)",
        ]

        missing = [
            "Official GSI (Geological Survey of India) Bhukosh spatial landslide inventory polygon catalog",
            "High-resolution LiDAR / Cartosat-1 DEM (slope aspect, curvature, flow accumulation, topographic wetness index TWI)",
            "Bedrock lithology, structural faults, and shear zone vector maps",
            "Land use / land cover (LULC) deforestation dynamics",
            "In-situ borehole piezometric pore-water pressure time series",
            "Confirmed negative spatial sampling (verified stable non-landslide slopes)",
        ]

        sampling_bias = (
            "Severe positive-sampling and reporting bias: Recorded incidents cluster along inhabited valley roads "
            "and tourist highways (NH-44, NH-10). Uninhabited steep ridges lack incident reporting, which would cause an "
            "untrained ML model to falsely associate roads with landslide causation."
        )

        spatial_leakage = (
            "High spatial autocorrelation risk: Random cross-validation (k-fold) would leak adjacent hill points between "
            "train and test sets. Spatial block cross-validation or catchment-separated holdouts are strictly required."
        )

        temporal_leakage = (
            "Temporal leakage hazard: Ingesting post-failure terrain elevation models to train pre-failure predictors creates "
            "spurious correlations. Time-separated training on pre-monsoon baseline DEMs is necessary."
        )

        negative_caution = (
            "Absence of evidence is NOT evidence of absence: Locations with zero historical records cannot be treated as confirmed "
            "negative training samples. True absence requires verified historical stability audits."
        )

        verdict = (
            "CURRENT VERDICT: INSUFFICIENT DATA FOR DEFENSIVE MACHINE LEARNING MODEL TRAINING. "
            "The platform operates a physics-grounded, explainable geomorphic baseline. "
            "Training and deploying a black-box ML model (e.g., Random Forest or XGBoost) at this stage would violate "
            "scientific safety invariants due to lack of verified negative labels, uncurated spatial bias, and missing lithological layers."
        )

        prerequisites = [
            "Acquisition of Geological Survey of India (GSI) 1:50,000 scale national landslide inventory.",
            "Integration of high-resolution ISRO Bhuvan / Cartosat DEM for plan and profile curvature computation.",
            "Implementation of spatial block cross-validation (Spatial K-Fold) to prevent spatial autocorrelation leakage.",
            "Multi-temporal satellite radar interferometry (InSAR) for slope creep deformation baselines.",
            "Statistically defensible pseudo-absence negative sampling with slope-weighted buffering.",
        ]

        return DataReadinessReport(
            report_timestamp=utc_now(),
            total_locations=total_locs,
            locations_with_terrain=with_terrain,
            locations_with_live_telemetry=0,  # Dynamically computed by service
            historical_incident_count=incident_count,
            verified_incident_count=verified_count,
            synthetic_demo_count=demo_count,
            available_features=available,
            missing_features=missing,
            sampling_bias_assessment=sampling_bias,
            spatial_leakage_risks=spatial_leakage,
            temporal_leakage_risks=temporal_leakage,
            negative_sampling_caution=negative_caution,
            ml_readiness_verdict=verdict,
            prerequisites_for_ml_deployment=prerequisites,
        )

    def _categorize_score(self, score: float) -> str:
        if score < 0.30:
            return "low"
        elif score < 0.60:
            return "moderate"
        elif score < 0.80:
            return "high"
        return "critical"

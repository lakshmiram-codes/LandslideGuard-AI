"""Deterministic unit tests for GeomorphicBaselineModel and SusceptibilityService."""

import pytest
from datetime import datetime, timezone, timedelta
from app.services.susceptibility.base import (
    LocationTerrainFeatures,
    DynamicWeatherFeatures,
)
from app.services.susceptibility.baseline import GeomorphicBaselineModel


@pytest.fixture
def baseline_model():
    return GeomorphicBaselineModel()


def test_baseline_slope_normalization(baseline_model):
    """Verifies slope normalization across gentle, moderate, critical, and steep angles."""
    # 1. Gentle slope (<15°)
    score_gentle, narr_gentle = baseline_model._normalize_slope(10.0)
    assert 0.0 < score_gentle < 0.20
    assert "Gentle inclination" in narr_gentle

    # 2. Moderate slope (15° to 30°)
    score_mod, narr_mod = baseline_model._normalize_slope(25.0)
    assert 0.20 <= score_mod < 0.55
    assert "Moderate slope gradient" in narr_mod

    # 3. Critical shear incline (30° to 45°)
    score_crit, narr_crit = baseline_model._normalize_slope(38.0)
    assert 0.55 <= score_crit < 0.90
    assert "Critical shear incline" in narr_crit

    # 4. Steep escarpment (>45°)
    score_steep, narr_steep = baseline_model._normalize_slope(50.0)
    assert 0.90 <= score_steep <= 1.0
    assert "Steep escarpment" in narr_steep

    # 5. Out of bounds (<0 or >90)
    score_invalid, narr_invalid = baseline_model._normalize_slope(-5.0)
    assert score_invalid == 0.0
    assert "Invalid slope" in narr_invalid


def test_baseline_rainfall_normalization(baseline_model):
    """Verifies precipitation trigger scoring across low to extreme precipitation rates."""
    # Low
    score_low, _ = baseline_model._normalize_rainfall(10.0)
    assert 0.0 < score_low <= 0.15

    # Moderate
    score_mod, _ = baseline_model._normalize_rainfall(35.0)
    assert 0.15 < score_mod <= 0.50

    # Heavy
    score_heavy, _ = baseline_model._normalize_rainfall(75.0)
    assert 0.50 < score_heavy <= 0.85

    # Torrential
    score_extreme, narr_extreme = baseline_model._normalize_rainfall(160.0)
    assert 0.85 < score_extreme <= 1.0
    assert "Torrential downpour" in narr_extreme


def test_baseline_soil_moisture_normalization(baseline_model):
    """Verifies volumetric soil moisture saturation scaling and pore pressure reduction."""
    score_dry, _ = baseline_model._normalize_soil_moisture(25.0)
    assert 0.0 < score_dry <= 0.20

    score_med, _ = baseline_model._normalize_soil_moisture(55.0)
    assert 0.20 < score_med <= 0.60

    score_high, narr_high = baseline_model._normalize_soil_moisture(78.0)
    assert 0.60 < score_high <= 0.88
    assert "critical pore-water pressure" in narr_high.lower()

    score_saturated, narr_saturated = baseline_model._normalize_soil_moisture(92.0)
    assert 0.88 < score_saturated <= 1.0
    assert "liquefaction" in narr_saturated.lower()


def test_baseline_insufficient_terrain_data(baseline_model):
    """Missing slope or elevation must halt assessment and return insufficient_data."""
    terrain = LocationTerrainFeatures(
        location_id=1,
        name="Test Incomplete Slope",
        latitude=27.5,
        longitude=88.5,
        elevation=1500.0,
        slope_angle=None,  # Missing slope!
        state="Sikkim",
        district="East Sikkim",
    )
    result = baseline_model.evaluate_location(terrain)

    assert result.is_sufficient_data is False
    assert result.risk_category == "insufficient_data"
    assert result.risk_score is None
    assert result.susceptibility_score is None
    assert result.data_quality_status == "INSUFFICIENT_DATA"
    assert any("slope" in lim.lower() for lim in result.limitations)


def test_baseline_missing_weather_evaluates_susceptibility_only(baseline_model):
    """Missing rainfall or moisture must evaluate static susceptibility without inventing zero rainfall."""
    terrain = LocationTerrainFeatures(
        location_id=2,
        name="Joshimath Slope",
        latitude=30.55,
        longitude=79.56,
        elevation=1890.0,
        slope_angle=39.5,
        state="Uttarakhand",
        district="Chamoli",
    )
    # No weather provided
    result = baseline_model.evaluate_location(terrain, weather=None)

    assert result.is_sufficient_data is False
    assert result.assessment_type == "susceptibility"
    assert result.susceptibility_score is not None
    assert result.trigger_score is None
    # Explicitly check that system does NOT assume 0.0 mm rainfall
    assert any("does not assume 0.0 mm" in lim.lower() for lim in result.limitations)
    assert len(result.contributing_factors) == 2  # Slope and Elevation only
    assert sum(f.percentage_of_total for f in result.contributing_factors) == pytest.approx(100.0, abs=0.5)


def test_baseline_full_dynamic_evaluation_and_percentages(baseline_model):
    """Verifies complete dynamic risk evaluation when all terrain and weather telemetry are current."""
    terrain = LocationTerrainFeatures(
        location_id=3,
        name="Wayanad Catchment",
        latitude=11.53,
        longitude=76.13,
        elevation=950.0,
        slope_angle=43.5,
        state="Kerala",
        district="Wayanad",
    )
    now = datetime.now(timezone.utc)
    weather = DynamicWeatherFeatures(
        precipitation_mm=110.0,
        precipitation_observed_at=now - timedelta(minutes=45),
        precipitation_quality="CURRENT",
        soil_moisture_pct=88.0,
        soil_moisture_observed_at=now - timedelta(minutes=45),
        soil_moisture_quality="CURRENT",
    )

    result = baseline_model.evaluate_location(terrain, weather)

    assert result.is_sufficient_data is True
    assert result.assessment_type == "dynamic_risk"
    assert result.risk_category in ["high", "critical"]
    assert result.risk_score is not None
    assert result.susceptibility_score is not None
    assert result.trigger_score is not None
    assert result.data_quality_status == "VERIFIED_EVALUATION"

    # Check 4 contributing factors
    assert len(result.contributing_factors) == 4
    factor_names = [f.factor_name for f in result.contributing_factors]
    assert "Slope Incline" in factor_names
    assert "Elevation Relief" in factor_names
    assert "Precipitation Trigger" in factor_names
    assert "Soil Moisture Saturation" in factor_names

    # Contribution percentages must sum to ~100%
    total_pct = sum(f.percentage_of_total for f in result.contributing_factors)
    assert total_pct == pytest.approx(100.0, abs=0.5)


def test_baseline_stale_telemetry_handling(baseline_model):
    """Stale inputs (>3h old) must degrade quality status to DATA_STALE with limitation logged."""
    terrain = LocationTerrainFeatures(
        location_id=4,
        name="Coonoor Section",
        latitude=11.35,
        longitude=76.79,
        elevation=1850.0,
        slope_angle=40.2,
        state="Tamil Nadu",
        district="The Nilgiris",
    )
    now = datetime.now(timezone.utc)
    weather = DynamicWeatherFeatures(
        precipitation_mm=25.0,
        precipitation_observed_at=now - timedelta(hours=6),
        precipitation_quality="STALE",
        soil_moisture_pct=60.0,
        soil_moisture_observed_at=now - timedelta(hours=6),
        soil_moisture_quality="STALE",
    )

    result = baseline_model.evaluate_location(terrain, weather)

    assert result.data_quality_status == "DATA_STALE"
    assert any("stale" in lim.lower() for lim in result.limitations)


def test_baseline_reproducibility(baseline_model):
    """Identical feature inputs must deterministically produce identical assessment outputs."""
    terrain = LocationTerrainFeatures(
        location_id=5,
        name="Consistent Hill",
        latitude=25.5,
        longitude=91.8,
        elevation=1965.0,
        slope_angle=42.0,
        state="Meghalaya",
        district="East Khasi Hills",
    )
    weather = DynamicWeatherFeatures(
        precipitation_mm=45.0,
        soil_moisture_pct=72.0,
        precipitation_quality="CURRENT",
        soil_moisture_quality="CURRENT",
    )

    res1 = baseline_model.evaluate_location(terrain, weather)
    res2 = baseline_model.evaluate_location(terrain, weather)

    assert res1.risk_score == res2.risk_score
    assert res1.susceptibility_score == res2.susceptibility_score
    assert res1.trigger_score == res2.trigger_score
    assert res1.risk_category == res2.risk_category
    assert len(res1.contributing_factors) == len(res2.contributing_factors)
    for f1, f2 in zip(res1.contributing_factors, res2.contributing_factors):
        assert f1.contribution_score == f2.contribution_score
        assert f1.percentage_of_total == f2.percentage_of_total


def test_data_readiness_audit_verdict(baseline_model):
    """Data readiness audit must explicitly flag missing layers, sampling bias, and ML readiness verdict."""
    locations = [
        LocationTerrainFeatures(
            location_id=1,
            name="Hill 1",
            latitude=30.0,
            longitude=79.0,
            elevation=2000.0,
            slope_angle=35.0,
            state="Uttarakhand",
            district="Chamoli",
        )
    ]
    incidents = [{"id": 1, "category": "debris_flow", "review_status": "verified"}]

    report = baseline_model.audit_data_readiness(locations, incidents)

    assert report.total_locations == 1
    assert report.locations_with_terrain == 1
    assert report.verified_incident_count == 1
    assert "INSUFFICIENT DATA FOR DEFENSIVE MACHINE LEARNING" in report.ml_readiness_verdict
    assert "sampling" in report.sampling_bias_assessment.lower() and "bias" in report.sampling_bias_assessment.lower()
    assert "spatial" in report.spatial_leakage_risks.lower()
    assert len(report.missing_features) >= 5
    assert len(report.prerequisites_for_ml_deployment) >= 4

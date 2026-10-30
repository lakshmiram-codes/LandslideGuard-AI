import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Mountain,
  CloudRain,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Info,
  FileSearch,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import {
  fetchLocations,
  fetchAssessmentExplanation,
  fetchDataReadinessReport,
  evaluateRiskAssessments,
} from '../services/api';
import {
  LocationItem,
  ExplainableAssessmentResponse,
  DataReadinessReportResponse,
} from '../types';

interface AiPredictionPageProps {
  onReturnToOverview?: () => void;
  onNavigateToAlerts?: () => void;
}

export const AiPredictionPage: React.FC<AiPredictionPageProps> = ({
  onReturnToOverview,
  onNavigateToAlerts,
}) => {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<ExplainableAssessmentResponse | null>(null);
  const [readinessReport, setReadinessReport] = useState<DataReadinessReportResponse | null>(null);

  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);
  const [loadingExplanation, setLoadingExplanation] = useState<boolean>(false);
  const [loadingReadiness, setLoadingReadiness] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'inspector' | 'data-readiness'>('inspector');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load locations on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingLocations(true);
    fetchLocations({ size: 100 })
      .then((res) => {
        if (!isMounted) return;
        const locs = res.items || [];
        setLocations(locs);
        if (locs.length > 0) {
          setSelectedLocationId(locs[0].id);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load monitoring stations.');
      })
      .finally(() => {
        if (isMounted) setLoadingLocations(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Load assessment explanation whenever selected location changes
  const loadExplanation = useCallback(async (locId: number) => {
    setLoadingExplanation(true);
    setError(null);
    try {
      const data = await fetchAssessmentExplanation(locId);
      setExplanation(data);
    } catch (err) {
      setExplanation(null);
      setError(
        err instanceof Error
          ? err.message
          : `Failed to compute explanation for station #${locId}.`
      );
    } finally {
      setLoadingExplanation(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLocationId) {
      loadExplanation(selectedLocationId);
    }
  }, [selectedLocationId, loadExplanation]);

  // Load data readiness report
  const loadReadinessReport = useCallback(async () => {
    setLoadingReadiness(true);
    try {
      const report = await fetchDataReadinessReport();
      setReadinessReport(report);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to retrieve data readiness audit.'
      );
    } finally {
      setLoadingReadiness(false);
    }
  }, []);

  useEffect(() => {
    loadReadinessReport();
  }, [loadReadinessReport]);

  // Trigger batch or single evaluation
  const handleRunEvaluation = async (locId?: number) => {
    setEvaluating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await evaluateRiskAssessments(locId);
      setSuccessMessage(
        `Successfully evaluated ${res.evaluated_count} monitoring location(s) using GeomorphicBaselineModel v1.0.0.`
      );
      if (selectedLocationId) {
        await loadExplanation(selectedLocationId);
      }
      await loadReadinessReport();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to run risk assessment evaluation.'
      );
    } finally {
      setEvaluating(false);
    }
  };

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  // Helper for risk category color
  const getRiskCategoryStyle = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'moderate':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'low':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Context */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                Phase 6 &bull; Explainable Warning Engine
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                GeomorphicBaseline v1.0.0
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Cpu className="w-6 h-6 text-indigo-600" />
              <span>AI Susceptibility & Explainable Warning Engine</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              Transparent, physics-grounded geomorphic baseline separating static terrain predisposition
              from dynamic hydrometeorological triggers. Evaluates physical slope incline, elevation bands,
              real-time precipitation telemetry, and soil moisture saturation without opaque black-box fabrication.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onReturnToOverview && (
              <button
                onClick={onReturnToOverview}
                className="inline-flex items-center space-x-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>
            )}

            <button
              onClick={() => handleRunEvaluation()}
              disabled={evaluating}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
              <span>{evaluating ? 'Evaluating Pipeline...' : 'Evaluate All Stations'}</span>
            </button>

            {onNavigateToAlerts && (
              <button
                onClick={onNavigateToAlerts}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>Early Warning Console</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-600 hover:text-rose-800 font-bold ml-2 text-xs"
            >
              &times;
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-800 font-bold ml-2 text-xs"
            >
              &times;
            </button>
          </div>
        )}

        {/* Scientific Safety & Defensive Stance Banner */}
        <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs flex items-start space-x-3">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-900">
              Scientific Safety & Explainability Principles (Phase 6 Defensive Baseline):
            </span>
            <p className="text-amber-800 leading-relaxed text-[11px]">
              High-stakes disaster early warning requires explainable causality. Our engine enforces data-gated
              scoring: missing telemetry returns <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">INSUFFICIENT_DATA</code> instead of assuming dry conditions; stale telemetry is explicitly flagged; and model weights are strictly auditable.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Top-Level Tab Switcher */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('inspector')}
          className={`pb-3 border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
            activeTab === 'inspector'
              ? 'border-indigo-600 text-indigo-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Station Susceptibility & Factor Attribution</span>
        </button>

        <button
          onClick={() => setActiveTab('data-readiness')}
          className={`pb-3 border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
            activeTab === 'data-readiness'
              ? 'border-indigo-600 text-indigo-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSearch className="w-4 h-4" />
          <span>ML Data Readiness & Scientific Audit</span>
          {readinessReport && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 font-semibold">
              Training Gated
            </span>
          )}
        </button>
      </div>

      {/* 3. Tab Content */}
      {activeTab === 'inspector' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Station Selector & Overview */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Select Monitoring Station
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {locations.length} Stations Available
                </span>
              </div>

              {loadingLocations ? (
                <div className="py-8 text-center text-xs text-slate-500">Loading stations...</div>
              ) : (
                <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                  {locations.map((loc) => {
                    const isSelected = loc.id === selectedLocationId;
                    const isDemo = loc.name.includes('[DEMO]');
                    return (
                      <button
                        key={loc.id}
                        onClick={() => setSelectedLocationId(loc.id)}
                        className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400 text-indigo-950 font-semibold'
                            : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="truncate font-semibold text-slate-900">{loc.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {loc.district}, {loc.state}
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                            isDemo
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {isDemo ? 'Demo' : 'Operational'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Station Stats */}
            {selectedLocation && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Terrain Features
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">ID #{selectedLocation.id}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Elevation</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {selectedLocation.elevation != null ? `${selectedLocation.elevation} m` : 'No data'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Slope Incline</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {selectedLocation.slope_angle != null ? `${selectedLocation.slope_angle}°` : 'No data'}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Coordinates: {selectedLocation.latitude.toFixed(4)}°N, {selectedLocation.longitude.toFixed(4)}°E
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Explainable AI Breakdown */}
          <div className="lg:col-span-8 space-y-4">
            {loadingExplanation ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-700">
                  Computing Explainable Geomorphic Susceptibility...
                </p>
                <p className="text-xs text-slate-500">
                  Evaluating static terrain slope, elevation bounds, live rainfall, and moisture saturation.
                </p>
              </div>
            ) : explanation ? (
              <div className="space-y-4">
                {/* 3-Score Gauge Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded border ${getRiskCategoryStyle(
                            explanation.risk_category
                          )}`}
                        >
                          {explanation.risk_category} Risk
                        </span>
                        <span className="text-xs text-slate-500">
                          &bull; Data Quality:{' '}
                          <span className="font-semibold text-slate-800 uppercase font-mono">
                            {explanation.data_quality_status}
                          </span>
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 mt-1">
                        {explanation.location_name}
                      </h2>
                    </div>

                    <button
                      onClick={() => handleRunEvaluation(explanation.location_id)}
                      disabled={evaluating}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                    >
                      <RefreshCw className={`w-3 h-3 ${evaluating ? 'animate-spin' : ''}`} />
                      <span>Re-score Station</span>
                    </button>
                  </div>

                  {/* 3 Score Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Overall Score */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 uppercase">
                          Dynamic Risk Score
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Combined</span>
                      </div>
                      <div className="text-2xl font-black text-slate-900 font-mono">
                        {explanation.risk_score != null
                          ? `${(explanation.risk_score * 100).toFixed(1)}%`
                          : 'N/A'}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        0.5 &times; Susceptibility + 0.5 &times; Trigger
                      </p>
                    </div>

                    {/* Static Susceptibility */}
                    <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-900 uppercase">
                          Static Terrain (S)
                        </span>
                        <Mountain className="w-3.5 h-3.5 text-blue-700" />
                      </div>
                      <div className="text-2xl font-black text-blue-950 font-mono">
                        {explanation.susceptibility_score != null
                          ? `${(explanation.susceptibility_score * 100).toFixed(1)}%`
                          : 'N/A'}
                      </div>
                      <p className="text-[10px] text-blue-700">
                        0.75 &times; Slope + 0.25 &times; Elevation
                      </p>
                    </div>

                    {/* Dynamic Hydrologic Trigger */}
                    <div className="p-3.5 rounded-xl bg-cyan-50/60 border border-cyan-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-900 uppercase">
                          Dynamic Trigger (T)
                        </span>
                        <CloudRain className="w-3.5 h-3.5 text-cyan-700" />
                      </div>
                      <div className="text-2xl font-black text-cyan-950 font-mono">
                        {explanation.trigger_score != null
                          ? `${(explanation.trigger_score * 100).toFixed(1)}%`
                          : 'N/A'}
                      </div>
                      <p className="text-[10px] text-cyan-700">
                        0.55 &times; Rain + 0.45 &times; Moisture
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contributing Factor Attribution Bars */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Factor Contribution & Sensitivity Attribution
                      </h3>
                      <p className="text-xs text-slate-500">
                        Relative attribution weights summing to 100% of the computed hazard score.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {explanation.contributing_factors.length} Factors Evaluated
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {explanation.contributing_factors.map((factor, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-slate-50/80 border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{factor.factor_name}</span>
                            <span className="text-[11px] font-mono text-slate-500">
                              (Weight: {(factor.weight * 100).toFixed(1)}%)
                            </span>
                          </div>

                          <div className="flex items-center space-x-3 text-[11px]">
                            <span className="text-slate-600">
                              Raw: <strong className="font-mono text-slate-900">
                                {factor.raw_value != null ? `${factor.raw_value} ${factor.unit}` : 'Missing'}
                              </strong>
                            </span>
                            <span className="text-indigo-700 font-semibold font-mono">
                              Attribution: {factor.percentage_of_total.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              factor.normalized_score > 0.75
                                ? 'bg-rose-500'
                                : factor.normalized_score > 0.5
                                ? 'bg-orange-500'
                                : factor.normalized_score > 0.25
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(0, factor.normalized_score * 100))}%`,
                            }}
                          />
                        </div>

                        {/* Narrative note */}
                        <p className="text-[11px] text-slate-600 italic leading-relaxed">
                          {factor.narrative}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Analytical Rationale Narrative */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2 text-xs">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <Info className="w-4 h-4 text-indigo-600" />
                    <span>Analytical Geomorphic Synthesis</span>
                  </h3>
                  <div className="p-3.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-indigo-950 leading-relaxed text-[11px] space-y-1">
                    <p>{explanation.analytical_rationale}</p>
                    <div className="text-[10px] text-indigo-700/80 pt-1 font-mono">
                      Evaluation Timestamp: {new Date(explanation.assessed_at).toUTCString()} &bull; Engine: {explanation.model_name} ({explanation.model_version})
                    </div>
                  </div>
                </div>

                {/* Scientific Limitations & Uncertainty Caveats */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2 text-xs">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Scientific Limitations & Operational Caveats</span>
                  </h3>
                  <ul className="space-y-1.5 list-disc list-inside text-[11px] text-slate-600 pl-1">
                    {explanation.limitations.map((lim, i) => (
                      <li key={i} className="leading-relaxed">
                        {lim}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                Select a station to inspect explainable susceptibility breakdown.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ML Data Readiness Tab */
        <div className="space-y-6">
          {loadingReadiness ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                Auditing Repository Data Readiness for Machine Learning...
              </p>
            </div>
          ) : readinessReport ? (
            <div className="space-y-6">
              {/* Verdict Card */}
              <div className="bg-white rounded-xl border border-rose-300 shadow-sm p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-200">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                      Defensive ML Audit Verdict
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold text-rose-950">
                      {readinessReport.ml_readiness_verdict}
                    </h2>
                  </div>

                  <button
                    onClick={loadReadinessReport}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Re-audit Datasets</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase block">Monitored Stations</span>
                    <span className="font-bold text-slate-900 text-base font-mono">
                      {readinessReport.total_locations}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase block">With Slope/Elevation</span>
                    <span className="font-bold text-slate-900 text-base font-mono">
                      {readinessReport.locations_with_terrain}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase block">Live Telemetry Feeds</span>
                    <span className="font-bold text-slate-900 text-base font-mono">
                      {readinessReport.locations_with_live_telemetry}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase block">Verified Incident Scars</span>
                    <span className="font-bold text-rose-700 text-base font-mono">
                      {readinessReport.verified_incident_count} / {readinessReport.historical_incident_count}
                    </span>
                  </div>
                </div>

                {/* Audit Analysis Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                  <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 space-y-1.5">
                    <h4 className="font-bold text-rose-950 uppercase text-[11px] flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-700" />
                      <span>Reporting & Sampling Bias</span>
                    </h4>
                    <p className="text-[11px] text-rose-900 leading-relaxed">
                      {readinessReport.sampling_bias_assessment}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1.5">
                    <h4 className="font-bold text-amber-950 uppercase text-[11px] flex items-center space-x-1.5">
                      <Lock className="w-4 h-4 text-amber-700" />
                      <span>Negative Sampling Caution</span>
                    </h4>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      {readinessReport.negative_sampling_caution}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <h4 className="font-bold text-slate-900 uppercase text-[11px] flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-slate-700" />
                      <span>Spatial Leakage Risk</span>
                    </h4>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {readinessReport.spatial_leakage_risks}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <h4 className="font-bold text-slate-900 uppercase text-[11px] flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-slate-700" />
                      <span>Temporal Leakage Risk</span>
                    </h4>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {readinessReport.temporal_leakage_risks}
                    </p>
                  </div>
                </div>
              </div>

              {/* Missing High-Resolution Feature Layers */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 text-xs">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  GIS Layer Inventory: Available vs Missing Geo-Features
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200 space-y-2">
                    <span className="font-bold text-emerald-950 text-[11px] uppercase block">
                      Currently Available in Schema
                    </span>
                    <ul className="space-y-1">
                      {readinessReport.available_features.map((feat, i) => (
                        <li key={i} className="flex items-center space-x-1.5 text-emerald-900 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-lg bg-rose-50/50 border border-rose-200 space-y-2">
                    <span className="font-bold text-rose-950 text-[11px] uppercase block">
                      Missing Critical Geospatial Layers
                    </span>
                    <ul className="space-y-1">
                      {readinessReport.missing_features.map((feat, i) => (
                        <li key={i} className="flex items-center space-x-1.5 text-rose-900 text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Prerequisites for ML Deployment */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 text-xs">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Mandatory Prerequisites Before Defensive ML Model Training
                </h3>
                <div className="space-y-2">
                  {readinessReport.prerequisites_for_ml_deployment.map((req, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start space-x-2.5 text-slate-700 text-[11px]"
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold font-mono text-[10px] flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{req}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              Failed to load data readiness report.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiPredictionPage;
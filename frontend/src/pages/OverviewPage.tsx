import React, { useState, useEffect } from 'react';
import {
  MapPin,
  BellRing,
  AlertTriangle,
  FileText,
  Activity,
  History,
  Compass,
  ArrowRight,
  CloudRain,
  Radio,
} from 'lucide-react';
import { WelcomeSection } from '../components/WelcomeSection';
import { StatusPanel } from '../components/StatusPanel';
import { StatCard } from '../components/common/StatCard';
import { RiskLegend } from '../components/RiskLegend';
import { EmptyState } from '../components/common/EmptyState';
import { PhaseRoadmap } from '../components/PhaseRoadmap';
import { IndiaMonitoringMap } from '../components/map/IndiaMonitoringMap';
import { fetchCompleteMapData } from '../services/api';
import {
  ConnectionState,
  HealthResponse,
  InfoResponse,
  MapDataPayload,
  CompositeMapLocation,
  IncidentItem,
} from '../types';

interface OverviewPageProps {
  connectionState: ConnectionState;
  healthData: HealthResponse | null;
  infoData: InfoResponse | null;
  errorMessage: string | null;
  lastChecked: Date | null;
  onRefreshHealth: () => void;
  onNavigateToMap?: () => void;
  onNavigateToAiPrediction?: () => void;
  onNavigateToAlerts?: () => void;
  onNavigateToFieldReports?: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  connectionState,
  healthData,
  infoData,
  errorMessage,
  lastChecked,
  onRefreshHealth,
  onNavigateToMap,
  onNavigateToAiPrediction,
  onNavigateToAlerts,
  onNavigateToFieldReports,
}) => {
  const [mapData, setMapData] = useState<MapDataPayload>({
    locations: [],
    incidents: [],
    totalLocations: 0,
    totalIncidents: 0,
    totalRisks: 0,
    totalAlerts: 0,
  });
  const [selectedLocation, setSelectedLocation] = useState<CompositeMapLocation | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchCompleteMapData()
      .then((data) => {
        if (isMounted) {
          setMapData(data);
          if (data.locations.length > 0) {
            setSelectedLocation(data.locations[0]);
          }
        }
      })
      .catch(() => {
        // Fallback to empty if server offline
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const criticalCount = mapData.locations.filter(
    (l) => l.riskAssessment?.risk_category === 'critical'
  ).length;
  const highRiskCount = mapData.locations.filter(
    (l) => l.riskAssessment?.risk_category === 'high' || l.riskAssessment?.risk_category === 'critical'
  ).length;

  return (
    <div className="space-y-6">
      {/* 1. Welcome Section & Regional Geohazard Mission */}
      <WelcomeSection />

      {/* 2. System Status & Health Diagnostics (Real API Handshake) */}
      <StatusPanel
        connectionState={connectionState}
        healthData={healthData}
        infoData={infoData}
        errorMessage={errorMessage}
        lastChecked={lastChecked}
        onRefresh={onRefreshHealth}
      />

      {/* 3. Pan-India Geohazard Monitoring Map (Full Country Extent: Kashmir to Kanyakumari) */}
      <section aria-labelledby="india-map-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 text-blue-600" aria-hidden="true" />
            <h2
              id="india-map-heading"
              className="text-xs font-bold text-slate-800 uppercase tracking-wider"
            >
              Pan-India Live Monitoring Map
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
              Full Extent Active
            </span>
          </div>

          {onNavigateToMap && (
            <button
              onClick={onNavigateToMap}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <span>Open Full GIS Workstation</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <IndiaMonitoringMap
          locations={mapData.locations}
          incidents={mapData.incidents}
          communityReports={mapData.communityReports || []}
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
          selectedIncident={selectedIncident}
          onSelectIncident={setSelectedIncident}
          heightClass="h-[500px]"
          showCardWrapper={true}
        />
      </section>

      {/* 4. Verified Weather Telemetry Status (Phase 5 Live Provider Integration) */}
      <section aria-labelledby="weather-integration-heading" className="space-y-2">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-white shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-100 uppercase tracking-wide">
                  Verified Meteorological Telemetry
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono">
                  Phase 5 Integrated
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {mapData.weatherSummary?.attribution || 'Open-Meteo Global Analysis (ECMWF/GFS, CC BY 4.0)'} &bull; Quality-verified observations
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300 font-mono">
                {mapData.weatherSummary?.locations_current ?? 0} Live Stations
              </span>
            </div>
            {onNavigateToMap && (
              <button
                onClick={onNavigateToMap}
                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors cursor-pointer inline-flex items-center space-x-1"
              >
                <span>Inspect Telemetry</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4b. Phase 6 AI Susceptibility & Warning Safeguards Banner */}
      <section aria-labelledby="phase6-integration-heading" className="space-y-2">
        <div className="p-3.5 bg-gradient-to-r from-indigo-900 to-slate-900 border border-indigo-800 rounded-xl text-white shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Activity className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-100 uppercase tracking-wide">
                  Explainable AI Susceptibility & Warning Engine
                </span>
                <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-400 border border-indigo-700 text-[10px] font-mono">
                  Phase 6 Active
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Physics-grounded GeomorphicBaseline v1.0.0 &bull; Anti-flapping safeguards (6h cooldown) &bull; ML Data Readiness Audit
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onNavigateToAiPrediction && (
              <button
                onClick={onNavigateToAiPrediction}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors cursor-pointer inline-flex items-center space-x-1"
              >
                <span>AI Inspector</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            {onNavigateToAlerts && (
              <button
                onClick={onNavigateToAlerts}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors cursor-pointer inline-flex items-center space-x-1"
              >
                <span>Warning Console</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4c. Phase 7 Community Crowdsourcing & CAP Dispatches Banner */}
      <section aria-labelledby="phase7-integration-heading" className="space-y-2">
        <div className="p-3.5 bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 border border-teal-800 rounded-xl text-white shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <FileText className="w-4 h-4 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-100 uppercase tracking-wide">
                  Community Crowdsourcing &amp; CAP v1.2 Protocol Dispatches
                </span>
                <span className="px-1.5 py-0.2 rounded bg-teal-950 text-teal-400 border border-teal-700 text-[10px] font-mono">
                  Phase 7 Active
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Tamper-evident citizen hazard reporting &bull; Multi-stage role verification with anti-self-approval &bull; OASIS CAP v1.2 standardized dispatches
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onNavigateToFieldReports && (
              <button
                onClick={onNavigateToFieldReports}
                className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-medium text-xs transition-colors cursor-pointer inline-flex items-center space-x-1"
              >
                <span>Field Reports Desk</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            {onNavigateToAlerts && (
              <button
                onClick={onNavigateToAlerts}
                className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-medium text-xs transition-colors cursor-pointer inline-flex items-center space-x-1"
              >
                <span>CAP XML Dispatches</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 5. Monitoring Overview (Stat Cards with Live Database Counts) */}
      <section aria-labelledby="monitoring-overview-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-slate-700" aria-hidden="true" />
            <h2
              id="monitoring-overview-heading"
              className="text-xs font-bold text-slate-800 uppercase tracking-wider"
            >
              Pan-India Monitoring Metrics
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            PostgreSQL 15 Database Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Monitored Locations"
            icon={MapPin}
            iconBg="bg-blue-50 border-blue-200"
            iconColor="text-blue-700"
            badgeText={mapData.totalLocations > 0 ? `${mapData.totalLocations} Stations` : 'Active'}
            statusLabel={mapData.totalLocations > 0 ? 'Locations synchronized' : 'Data integration active'}
            description="Active hill tracts spanning Himalayas, NER, Western Ghats & Nilgiris"
            plannedPhase="Phase 3 Verified"
          />
          <StatCard
            title="Weather Telemetry"
            icon={CloudRain}
            iconBg="bg-cyan-50 border-cyan-200"
            iconColor="text-cyan-700"
            badgeText={mapData.weatherSummary ? `${mapData.weatherSummary.locations_current} Live` : 'Active'}
            statusLabel={mapData.weatherSummary?.provider_status === 'operational' ? 'Open-Meteo Operational' : 'Telemetry Sync'}
            description="Verified precipitation, soil moisture, temp & humidity"
            plannedPhase="Phase 5 Verified"
          />
          <StatCard
            title="Active Warnings"
            icon={BellRing}
            iconBg="bg-rose-50 border-rose-200"
            iconColor="text-rose-700"
            badgeText={criticalCount > 0 ? `${criticalCount} Critical` : `${mapData.totalAlerts} Dispatches`}
            statusLabel={criticalCount > 0 ? 'High alert threshold active' : 'Safeguards active'}
            description="Threshold exceedance with 6h anti-flapping suppression"
            plannedPhase="Phase 6 Verified"
          />
          <StatCard
            title="Susceptibility Scores"
            icon={AlertTriangle}
            iconBg="bg-indigo-50 border-indigo-200"
            iconColor="text-indigo-700"
            badgeText={highRiskCount > 0 ? `${highRiskCount} Elevated Risk` : mapData.totalRisks > 0 ? `${mapData.totalRisks} Assessed` : 'Pipeline Ready'}
            statusLabel={highRiskCount > 0 ? 'High/critical hazard tract' : 'Geomorphic evaluations'}
            description="Terrain slope & elevation predisposition combined with triggers"
            plannedPhase="Phase 6 Verified"
          />
          <StatCard
            title="Historical Incidents"
            icon={FileText}
            iconBg="bg-red-50 border-red-200"
            iconColor="text-red-700"
            badgeText={mapData.totalIncidents > 0 ? `${mapData.totalIncidents} Scars` : 'Catalog'}
            statusLabel={mapData.totalIncidents > 0 ? 'Verified historical records' : 'Intake pipeline'}
            description="Verified historical landslides across Indian states"
            plannedPhase="Phase 4 Verified"
          />
        </div>
      </section>

      {/* 5. Geohazard Susceptibility Risk Legend */}
      <section aria-labelledby="risk-legend-heading">
        <h2 id="risk-legend-heading" className="sr-only">
          Risk Scale Legend
        </h2>
        <RiskLegend />
      </section>

      {/* 6. Recent Activity & Incident Stream */}
      <section aria-labelledby="recent-activity-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-700" aria-hidden="true" />
            <h2
              id="recent-activity-heading"
              className="text-xs font-bold text-slate-800 uppercase tracking-wider"
            >
              Verified Historical Incidents & Active Advisories
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Database Log Stream
          </span>
        </div>

        {mapData.incidents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mapData.incidents.map((inc) => (
              <div
                key={inc.id}
                className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-900 border border-red-300">
                    {inc.category.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(inc.reported_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-700 line-clamp-2 leading-relaxed">
                  {inc.description}
                </p>
                <div className="text-[10px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
                  <span className="capitalize">{inc.source_type.replace('_', ' ')}</span>
                  <span className="font-mono">{inc.latitude.toFixed(2)}°N, {inc.longitude.toFixed(2)}°E</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="No Incident Records"
            description="Live landslide events and ground reports will populate this stream automatically."
            className="bg-white"
          />
        )}
      </section>

      {/* 7. Multi-Phase Engineering Roadmap */}
      <section aria-labelledby="phase-roadmap-heading">
        <h2 id="phase-roadmap-heading" className="sr-only">
          Engineering Roadmap
        </h2>
        <PhaseRoadmap />
      </section>
    </div>
  );
};

export default OverviewPage;

import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  AlertTriangle,
  History,
  CloudRain,
  Droplets,
  RefreshCw,
  SlidersHorizontal,
  Compass,
  Info,
  ShieldAlert,
  Mountain,
  Thermometer,
  Wind,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { IndiaMonitoringMap } from '../components/map/IndiaMonitoringMap';
import { fetchCompleteMapData, triggerWeatherRefresh } from '../services/api';
import {
  CompositeMapLocation,
  IncidentItem,
  MapDataPayload,
} from '../types';

interface RiskMapPageProps {
  onReturnToOverview?: () => void;
  onNavigateToAi?: () => void;
}

export const RiskMapPage: React.FC<RiskMapPageProps> = ({
  onReturnToOverview,
  onNavigateToAi,
}) => {
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [syncingAll, setSyncingAll] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const [selectedCommunityReport, setSelectedCommunityReport] = useState<IncidentItem | null>(null);
  const [stateFilter, setStateFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchCompleteMapData();
      setMapData(data);

      // Preserve or initialize selected location
      setSelectedLocation((prev) => {
        if (!prev) {
          const priorityLoc =
            data.locations.find((l) => l.riskAssessment?.risk_category === 'critical') ||
            data.locations.find((l) => l.riskAssessment?.risk_category === 'high') ||
            data.locations[0];
          return priorityLoc || null;
        }
        const updated = data.locations.find((l) => l.location.id === prev.location.id);
        return updated || prev;
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load spatial geohazard data.');
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    setSyncSuccessMsg(null);
    loadData();
  };

  const handleSyncAllWeather = async () => {
    setSyncingAll(true);
    setSyncSuccessMsg(null);
    setError(null);
    try {
      const res = await triggerWeatherRefresh();
      setSyncSuccessMsg(
        `Synchronized ${res.refreshed_count} stations across India via ${res.provider}.`
      );
      await loadData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to refresh real-time weather observations.');
      }
    } finally {
      setSyncingAll(false);
    }
  };

  const handleRefreshSingleLocation = async (locId: number) => {
    setError(null);
    try {
      await triggerWeatherRefresh(locId);
      await loadData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(`Failed to refresh weather data for location #${locId}`);
      }
      throw err;
    }
  };

  // Filtered locations
  const filteredLocations = mapData.locations.filter((item) => {
    if (stateFilter === 'all') return true;
    return item.location.state.toLowerCase() === stateFilter.toLowerCase();
  });

  // Extract unique states for filter dropdown
  const uniqueStates = Array.from(
    new Set(mapData.locations.map((item) => item.location.state))
  ).sort();

  // Metrics count
  const criticalCount = mapData.locations.filter(
    (l) => l.riskAssessment?.risk_category === 'critical'
  ).length;
  const highCount = mapData.locations.filter(
    (l) => l.riskAssessment?.risk_category === 'high'
  ).length;
  const withTelemetryCount = mapData.locations.filter(
    (l) => l.latestRainfall !== null || l.latestSoilMoisture !== null
  ).length;

  const currentCount = mapData.locations.filter(
    (l) => l.weatherQualityStatus === 'CURRENT'
  ).length;
  const staleCount = mapData.locations.filter(
    (l) => l.weatherQualityStatus === 'STALE'
  ).length;
  const missingCount = mapData.locations.filter(
    (l) => l.weatherQualityStatus === 'MISSING'
  ).length;
  const demoCount = mapData.locations.filter(
    (l) => l.weatherQualityStatus === 'DEMO'
  ).length;

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        title="Spatial GIS Hazard Map"
        subtitle="Pan-India landslide monitoring covering the northern Himalayas, Western Ghats, Nilgiri Hills, and Northeast India down to Kanyakumari"
        badge={
          <StatusBadge variant="success" size="md">
            Pan-India Live Extent
          </StatusBadge>
        }
        actions={
          <div className="flex items-center space-x-2">
            {onReturnToOverview && (
              <button
                onClick={onReturnToOverview}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              >
                <span>&larr; Overview</span>
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
            </button>
          </div>
        }
      />

      {/* Error Notice */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={handleRefresh} className="underline font-semibold cursor-pointer">Retry</button>
        </div>
      )}

      {/* 2. Top Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="p-2 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900">{mapData.totalLocations}</div>
            <div className="text-[11px] text-slate-500 font-medium leading-tight">Monitored Zones</div>
          </div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="p-2 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-black text-rose-700">{criticalCount}</div>
            <div className="text-[11px] text-slate-500 font-medium leading-tight">Critical Warnings</div>
          </div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="p-2 rounded-md bg-orange-50 text-orange-700 border border-orange-200">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-black text-orange-700">{highCount}</div>
            <div className="text-[11px] text-slate-500 font-medium leading-tight">High Risk Zones</div>
          </div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="p-2 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200">
            <CloudRain className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900">{withTelemetryCount}</div>
            <div className="text-[11px] text-slate-500 font-medium leading-tight">Active In-situ Telemetry</div>
          </div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="p-2 rounded-md bg-red-50 text-red-700 border border-red-200">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900">{mapData.totalIncidents}</div>
            <div className="text-[11px] text-slate-500 font-medium leading-tight">Historical Scars</div>
          </div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center space-x-3">
          <div className="p-2 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900">
              {mapData.communityReports?.length || 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium leading-tight">Crowdsourced Reports</div>
          </div>
        </div>
      </div>

      {/* 2b. Verified External Weather Telemetry Quality Bar */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-white shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-100 uppercase tracking-wide">
                Meteorological Telemetry Feed
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono">
                Open-Meteo CC BY 4.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              ECMWF / GFS analysis &bull; Physical range & clock-skew validated &bull; Pan-India coverage
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700" title="Recent verified readings <= 3 hours old">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300">Live (Current):</span>
            <span className="font-bold font-mono text-emerald-400">{currentCount}</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700" title="Telemetry older than 3 hours">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-slate-300">Stale (&gt;3h):</span>
            <span className="font-bold font-mono text-amber-400">{staleCount}</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700" title="No sensor or provider observation available">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span className="text-slate-300">Missing:</span>
            <span className="font-bold font-mono text-slate-400">{missingCount}</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700" title="Synthetic or historical baseline demo data">
            <span className="w-2 h-2 rounded-full bg-orange-400"></span>
            <span className="text-slate-300">Demo Baseline:</span>
            <span className="font-bold font-mono text-orange-400">{demoCount}</span>
          </div>

          <button
            onClick={handleSyncAllWeather}
            disabled={syncingAll}
            className="inline-flex items-center space-x-1 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-60 cursor-pointer shadow-xs ml-1"
            title="Fetch live observations from Open-Meteo for all Indian locations"
          >
            <RefreshCw className={`w-3 h-3 ${syncingAll ? 'animate-spin' : ''}`} />
            <span>{syncingAll ? 'Syncing...' : 'Sync All Live'}</span>
          </button>
        </div>
      </div>

      {/* Sync Success Feedback */}
      {syncSuccessMsg && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncSuccessMsg}</span>
          </span>
          <button
            onClick={() => setSyncSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 cursor-pointer text-sm"
          >
            &times;
          </button>
        </div>
      )}

      {/* 3. Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-2xs text-xs">
        <div className="flex items-center space-x-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-slate-700">Filter by State / Region:</span>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium"
          >
            <option value="all">All States & Union Territories ({mapData.totalLocations})</option>
            {uniqueStates.map((s) => (
              <option key={s} value={s}>
                {s} ({mapData.locations.filter((l) => l.location.state === s).length})
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
          <Info className="w-3.5 h-3.5 text-blue-600" />
          <span>Click any marker to inspect telemetry, slope geometry, and alert status</span>
        </div>
      </div>

      {/* 4. Main Map & Inspector Side Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: 2 Columns - Interactive Map Component */}
        <div className="lg:col-span-2 space-y-4">
          <IndiaMonitoringMap
            locations={filteredLocations}
            incidents={mapData.incidents}
            communityReports={mapData.communityReports || []}
            selectedLocation={selectedLocation}
            onSelectLocation={(loc) => {
              setSelectedLocation(loc);
              if (loc) {
                setSelectedIncident(null);
                setSelectedCommunityReport(null);
              }
            }}
            selectedIncident={selectedIncident}
            onSelectIncident={(inc) => {
              setSelectedIncident(inc);
              if (inc) {
                setSelectedLocation(null);
                setSelectedCommunityReport(null);
              }
            }}
            selectedCommunityReport={selectedCommunityReport}
            onSelectCommunityReport={(rep) => {
              setSelectedCommunityReport(rep);
              if (rep) {
                setSelectedLocation(null);
                setSelectedIncident(null);
              }
            }}
            heightClass="h-[620px]"
          />
        </div>

        {/* Right: 1 Column - Detail Telemetry Inspector */}
        <div className="space-y-4">
          {selectedLocation ? (
            <LocationInspectorCard
              item={selectedLocation}
              onRefreshLocation={handleRefreshSingleLocation}
              onNavigateToAi={onNavigateToAi}
            />
          ) : selectedIncident ? (
            <IncidentInspectorCard incident={selectedIncident} />
          ) : selectedCommunityReport ? (
            <CommunityReportInspectorCard report={selectedCommunityReport} />
          ) : (
            <div className="p-6 bg-white rounded-xl border border-slate-200 text-center space-y-3">
              <Compass className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                No Marker Selected
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click any monitoring beacon, risk diamond, historical scar, or community crowdsourced report on the map to inspect full slope geometry, telemetry, and early warnings.
              </p>
            </div>
          )}

          {/* Quick Zone Navigator */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Mountain className="w-3.5 h-3.5 text-blue-600" />
                <span>Critical Hill Tracts</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">Fast Select</span>
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {mapData.locations.map((locItem) => {
                const isSelected = selectedLocation?.location.id === locItem.location.id;
                const riskTier = locItem.riskAssessment?.risk_category || 'none';

                let riskBadge = 'bg-slate-100 text-slate-600 border-slate-200';
                if (riskTier === 'critical') riskBadge = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
                else if (riskTier === 'high') riskBadge = 'bg-orange-100 text-orange-800 border-orange-300 font-bold';
                else if (riskTier === 'moderate') riskBadge = 'bg-amber-100 text-amber-800 border-amber-300';
                else if (riskTier === 'low') riskBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';

                return (
                  <button
                    key={locItem.location.id}
                    onClick={() => {
                      setSelectedLocation(locItem);
                      setSelectedIncident(null);
                    }}
                    className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-400 text-blue-950 font-medium'
                        : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate font-semibold">{locItem.location.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {locItem.location.district}, {locItem.location.state}
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border shrink-0 ${riskBadge}`}>
                      {riskTier}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Inspector Sub-Component: Location & Telemetry Detail
interface LocationInspectorProps {
  item: CompositeMapLocation;
  onRefreshLocation?: (id: number) => Promise<void>;
  onNavigateToAi?: () => void;
}

const LocationInspectorCard: React.FC<LocationInspectorProps> = ({
  item,
  onRefreshLocation,
  onNavigateToAi,
}) => {
  const {
    location,
    latestRainfall,
    latestSoilMoisture,
    latestTemperature,
    latestHumidity,
    riskAssessment,
    activeAlert,
    weatherQualityStatus,
  } = item;

  const [refreshingStation, setRefreshingStation] = useState<boolean>(false);
  const [stationError, setStationError] = useState<string | null>(null);

  const isDemo = location.name.includes('[DEMO]');

  const handleSyncStation = async () => {
    if (!onRefreshLocation) return;
    setRefreshingStation(true);
    setStationError(null);
    try {
      await onRefreshLocation(location.id);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setStationError(err.message);
      } else {
        setStationError('Failed to refresh telemetry for this location.');
      }
    } finally {
      setRefreshingStation(false);
    }
  };

  // Provider attribution text
  let providerText = 'No provider feed linked';
  if (latestRainfall?.source && latestRainfall.source.toLowerCase().includes('open-meteo')) {
    providerText = 'Open-Meteo Analysis (ECMWF/GFS, CC BY 4.0)';
  } else if (latestRainfall?.source && latestRainfall.source.includes('[DEMO]')) {
    providerText = 'Demonstration Historical Baseline';
  } else if (latestRainfall?.source) {
    providerText = latestRainfall.source;
  }

  // Quality badge styling
  let qualityBadge = (
    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-300">
      MISSING DATA
    </span>
  );
  if (weatherQualityStatus === 'CURRENT') {
    qualityBadge = (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
        Live: CURRENT
      </span>
    );
  } else if (weatherQualityStatus === 'STALE') {
    qualityBadge = (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
        STALE (&gt;3h)
      </span>
    );
  } else if (weatherQualityStatus === 'DEMO') {
    qualityBadge = (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-100 text-orange-800 border border-orange-300">
        DEMO BASELINE
      </span>
    );
  } else if (weatherQualityStatus === 'FORECAST') {
    qualityBadge = (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-300">
        PROVISIONAL FORECAST
      </span>
    );
  }

  const isForecast = latestRainfall?.is_forecast || latestSoilMoisture?.is_forecast;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
      {/* Header */}
      <div className="border-b border-slate-200 pb-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            {qualityBadge}
            {isForecast && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                Forecast
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-slate-500">Station ID #{location.id}</span>
        </div>
        <h3 className="text-sm font-bold text-slate-900">{location.name}</h3>
        <p className="text-xs text-slate-600">
          {location.district}, {location.state} &bull;{' '}
          <span className="font-mono text-[11px]">
            {location.latitude.toFixed(4)}°N, {location.longitude.toFixed(4)}°E
          </span>
        </p>

        {/* Sync Station Action */}
        <div className="pt-1 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 truncate max-w-[180px]">
            {isDemo ? 'Demonstration Dataset' : 'Operational Ground Station'}
          </span>
          {onRefreshLocation && (
            <button
              onClick={handleSyncStation}
              disabled={refreshingStation}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-300 hover:border-blue-300 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Pull latest verified weather observation from Open-Meteo"
            >
              <RefreshCw className={`w-3 h-3 ${refreshingStation ? 'animate-spin text-blue-600' : ''}`} />
              <span>{refreshingStation ? 'Fetching...' : 'Fetch Live Weather'}</span>
            </button>
          )}
        </div>

        {stationError && (
          <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
            {stationError}
          </div>
        )}
      </div>

      {/* Terrain Geometry */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
          Terrain & Geomorphology
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 text-[11px] block">Elevation</span>
            <span className="font-bold text-slate-800 text-sm">
              {location.elevation != null ? `${location.elevation} m` : 'No data available'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 text-[11px] block">Slope Incline</span>
            <span className="font-bold text-slate-800 text-sm">
              {location.slope_angle != null ? `${location.slope_angle}°` : 'No data available'}
            </span>
          </div>
        </div>
      </div>

      {/* In-Situ Hydrometeorological Telemetry */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
            Telemetry & Sensor Readings
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {latestRainfall?.observed_at
              ? new Date(latestRainfall.observed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              : 'No timestamp'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Rainfall */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1 font-medium text-slate-700 text-[11px]">
                <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                <span>Precipitation</span>
              </span>
            </div>
            <div className="font-mono font-bold text-slate-900 text-sm">
              {latestRainfall ? `${latestRainfall.value} ${latestRainfall.unit}` : 'No data available'}
            </div>
          </div>

          {/* Soil Moisture */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1 font-medium text-slate-700 text-[11px]">
                <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                <span>Soil Moisture</span>
              </span>
            </div>
            <div className="font-mono font-bold text-slate-900 text-sm">
              {latestSoilMoisture ? `${latestSoilMoisture.value} ${latestSoilMoisture.unit}` : 'No data available'}
            </div>
          </div>

          {/* Surface Temperature */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1 font-medium text-slate-700 text-[11px]">
                <Thermometer className="w-3.5 h-3.5 text-rose-600" />
                <span>Temperature</span>
              </span>
            </div>
            <div className="font-mono font-bold text-slate-900 text-sm">
              {latestTemperature ? `${latestTemperature.value} ${latestTemperature.unit}` : 'No data available'}
            </div>
          </div>

          {/* Relative Humidity */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1 font-medium text-slate-700 text-[11px]">
                <Wind className="w-3.5 h-3.5 text-teal-600" />
                <span>Humidity</span>
              </span>
            </div>
            <div className="font-mono font-bold text-slate-900 text-sm">
              {latestHumidity ? `${latestHumidity.value} ${latestHumidity.unit}` : 'No data available'}
            </div>
          </div>
        </div>

        {/* Telemetry Attribution & Freshness Metadata */}
        <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-600 space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Provider Feed:</span>
            <span className="font-semibold text-slate-800 truncate max-w-[190px]">{providerText}</span>
          </div>
          {latestRainfall?.retrieved_at && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Retrieved At:</span>
              <span className="font-mono text-slate-700">
                {new Date(latestRainfall.retrieved_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Calculated Risk Assessment */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
            Calculated Susceptibility
          </span>
          {onNavigateToAi && (
            <button
              onClick={onNavigateToAi}
              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              Explain Factor Breakdown &rarr;
            </button>
          )}
        </div>
        {riskAssessment ? (
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Risk Level:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  riskAssessment.risk_category === 'critical'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : riskAssessment.risk_category === 'high'
                    ? 'bg-orange-100 text-orange-800 border-orange-300'
                    : riskAssessment.risk_category === 'moderate'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}
              >
                {riskAssessment.risk_category} ({riskAssessment.risk_score != null ? `${(riskAssessment.risk_score * 100).toFixed(0)}%` : 'N/A'})
              </span>
            </div>

            {(riskAssessment.susceptibility_score != null || riskAssessment.trigger_score != null) && (
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1">
                <div className="p-1 rounded bg-blue-50/70 border border-blue-200 text-blue-900">
                  Terrain (S): {(riskAssessment.susceptibility_score ?? 0 * 100).toFixed(0)}%
                </div>
                <div className="p-1 rounded bg-cyan-50/70 border border-cyan-200 text-cyan-900">
                  Trigger (T): {(riskAssessment.trigger_score ?? 0 * 100).toFixed(0)}%
                </div>
              </div>
            )}

            {riskAssessment.explanation && (
              <p className="text-[11px] text-slate-600 leading-relaxed border-t border-slate-200/60 pt-1.5">
                {riskAssessment.explanation}
              </p>
            )}
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>Model: {riskAssessment.model_version || 'GeomorphicBaseline v1.0.0'}</span>
              <span>{new Date(riskAssessment.assessed_at).toLocaleDateString()}</span>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 italic">
            No data available — risk assessment model not evaluated for this location.
          </div>
        )}
      </div>

      {/* Active Early Warning Dispatch */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
          Early Warning Dispatch
        </span>
        {activeAlert ? (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-950 space-y-1 text-xs">
            <div className="flex items-center justify-between font-bold">
              <span>🚨 {activeAlert.title}</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-200 text-rose-900">
                {activeAlert.status}
              </span>
            </div>
            <p className="text-[11px] text-rose-800 leading-relaxed">{activeAlert.description}</p>
            <div className="text-[10px] text-rose-700/80 pt-1">Authorizing Agency: {activeAlert.source}</div>
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 italic">
            No active early warning alert for this station.
          </div>
        )}
      </div>
    </div>
  );
};

// Inspector Sub-Component: Incident Detail
interface IncidentInspectorProps {
  incident: IncidentItem;
}

const IncidentInspectorCard: React.FC<IncidentInspectorProps> = ({ incident }) => {
  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4 space-y-3 text-xs">
      <div className="border-b border-red-100 pb-2 flex items-center justify-between">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-900 border border-red-300">
          Historical Incident Scar
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          {new Date(incident.reported_at).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>

      <div>
        <div className="text-xs font-bold text-red-900 uppercase">
          Category: {incident.category.replace('_', ' ')}
        </div>
        <p className="text-xs text-slate-700 mt-1 leading-relaxed">{incident.description}</p>
      </div>

      <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-1 text-slate-600">
        <div>Coordinates: <span className="font-mono text-slate-800">{incident.latitude.toFixed(4)}°N, {incident.longitude.toFixed(4)}°E</span></div>
        <div>Verification Status: <span className="font-semibold text-emerald-700 uppercase">{incident.review_status}</span></div>
        <div>Source: <span className="font-medium text-slate-800">{incident.source_type}</span></div>
      </div>
    </div>
  );
};

// Inspector Sub-Component: Community Crowdsourced Report Detail
interface CommunityReportInspectorProps {
  report: IncidentItem;
}

const CommunityReportInspectorCard: React.FC<CommunityReportInspectorProps> = ({ report }) => {
  const isVerified = report.review_status === 'verified';
  return (
    <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-4 space-y-3 text-xs">
      <div className="border-b border-teal-100 pb-2 flex items-center justify-between">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
            isVerified
              ? 'bg-teal-100 text-teal-900 border-teal-300'
              : 'bg-amber-100 text-amber-900 border-amber-300'
          }`}
        >
          {isVerified ? 'Verified Community Report' : 'Community Crowdsourced Report'}
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          {new Date(report.reported_at).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>

      <div>
        <div className="text-xs font-bold text-teal-900 uppercase">
          Category: {report.category.replace('_', ' ')}
        </div>
        <p className="text-xs text-slate-700 mt-1 leading-relaxed">{report.description}</p>
        {report.location_description && (
          <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
            <strong>Landmark / Location:</strong> {report.location_description}
          </div>
        )}
      </div>

      <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-1.5 text-slate-600">
        <div>
          Coordinates:{' '}
          <span className="font-mono text-slate-800">
            {report.latitude.toFixed(4)}°N, {report.longitude.toFixed(4)}°E
          </span>
        </div>
        <div>
          Audit Status:{' '}
          <span
            className={`font-semibold uppercase ${
              isVerified ? 'text-teal-700' : 'text-amber-700'
            }`}
          >
            {report.review_status}
          </span>
        </div>
        <div>
          Submitted By:{' '}
          <span className="font-medium text-slate-800">
            {report.reporter_name || 'Anonymous Citizen'}
          </span>
        </div>
        {report.attachment_count && report.attachment_count > 0 && (
          <div className="text-blue-700 font-medium">
            📎 {report.attachment_count} evidence photo/document attached
          </div>
        )}
      </div>

      <div className="text-[10px] text-slate-400 italic">
        Crowdsourced hazard observation. Multi-stage field verification conducted by DDMA and field observers in the Field Reports console.
      </div>
    </div>
  );
};

export default RiskMapPage;

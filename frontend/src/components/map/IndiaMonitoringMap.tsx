import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  Compass,
  Maximize2,
  Eye,
} from 'lucide-react';
import {
  CompositeMapLocation,
  IncidentItem,
} from '../../types';

// Bounding box strictly encompassing the entirety of India (Kashmir to Kanyakumari, Gujarat to Arunachal)
const INDIA_BOUNDS: L.LatLngBoundsExpression = [
  [7.2, 67.5],  // Southwest: South of Kanyakumari & Lakshadweep
  [37.8, 97.8], // Northeast: Northern Ladakh & Eastern Arunachal Pradesh
];

interface RegionPreset {
  id: string;
  label: string;
  flag: string;
  bounds: L.LatLngBoundsExpression;
}

const REGION_PRESETS: RegionPreset[] = [
  {
    id: 'india',
    label: 'All India (Full Extent)',
    flag: '🇮🇳',
    bounds: INDIA_BOUNDS,
  },
  {
    id: 'himalayas',
    label: 'Himalayas / North',
    flag: '🏔️',
    bounds: [
      [29.0, 73.8],
      [36.8, 81.5],
    ],
  },
  {
    id: 'ner',
    label: 'Northeast India (NER)',
    flag: '🌿',
    bounds: [
      [21.6, 88.0],
      [29.8, 97.6],
    ],
  },
  {
    id: 'western-ghats',
    label: 'Western Ghats',
    flag: '🌊',
    bounds: [
      [8.2, 73.0],
      [20.5, 77.6],
    ],
  },
  {
    id: 'nilgiris',
    label: 'Nilgiris & Kanyakumari',
    flag: '⛰️',
    bounds: [
      [8.0, 76.2],
      [12.5, 78.5],
    ],
  },
];

interface IndiaMonitoringMapProps {
  locations: CompositeMapLocation[];
  incidents: IncidentItem[];
  communityReports?: IncidentItem[];
  selectedLocation: CompositeMapLocation | null;
  onSelectLocation?: (loc: CompositeMapLocation | null) => void;
  selectedIncident: IncidentItem | null;
  onSelectIncident?: (inc: IncidentItem | null) => void;
  selectedCommunityReport?: IncidentItem | null;
  onSelectCommunityReport?: (report: IncidentItem | null) => void;
  heightClass?: string;
  showCardWrapper?: boolean;
}

export const IndiaMonitoringMap: React.FC<IndiaMonitoringMapProps> = ({
  locations,
  incidents,
  communityReports = [],
  selectedLocation,
  onSelectLocation,
  selectedIncident,
  onSelectIncident,
  selectedCommunityReport,
  onSelectCommunityReport,
  heightClass = 'h-[580px]',
  showCardWrapper = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Layer Visibility Filters
  const [showStations, setShowStations] = useState<boolean>(true);
  const [showRiskBadges, setShowRiskBadges] = useState<boolean>(true);
  const [showIncidents, setShowIncidents] = useState<boolean>(true);
  const [showCommunityReports, setShowCommunityReports] = useState<boolean>(true);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [activeBasemap, setActiveBasemap] = useState<'osm' | 'dark' | 'topo'>('dark');
  const [activeRegion, setActiveRegion] = useState<string>('india');

  // Tile layers definition
  const tileLayers = useMemo(
    () => ({
      osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      },
      dark: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
        maxZoom: 19,
      },
      topo: {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: 'Map data: &copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap',
        maxZoom: 17,
      },
    }),
    []
  );

  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
      maxBounds: [
        [5.0, 60.0],
        [40.0, 105.0],
      ],
      minZoom: 4,
      maxZoom: 18,
    });

    // Fit to entire geographical extent of India immediately
    map.fitBounds(INDIA_BOUNDS, {
      padding: [24, 24],
      animate: false,
    });

    // Add base tile layer
    const base = L.tileLayer(tileLayers[activeBasemap].url, {
      attribution: tileLayers[activeBasemap].attribution,
      maxZoom: tileLayers[activeBasemap].maxZoom,
    }).addTo(map);
    tileLayerRef.current = base;

    // Add zoom control at top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Create LayerGroup for markers
    const markerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markerGroup;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [tileLayers, activeBasemap]);

  // 2. Change Basemap TileLayer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(tileLayers[activeBasemap].url);
  }, [activeBasemap, tileLayers]);

  // 3. Render Custom Markers with Separate Symbols
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();

    // Symbol A: Monitored Station (Blue Radar Beacon)
    if (showStations) {
      locations.forEach((item) => {
        const { location } = item;
        if (!location.latitude || !location.longitude) return;

        // Skip if risk filter is applied and location does not match
        if (riskFilter !== 'all') {
          const locRisk = item.riskAssessment?.risk_category || 'none';
          if (locRisk !== riskFilter) return;
        }

        const isSelected = selectedLocation?.location.id === location.id;

        // Quality status indicator dot
        let qualityDotColor = 'bg-slate-400';
        let qualityDotTitle = 'Missing Telemetry';
        if (item.weatherQualityStatus === 'CURRENT') {
          qualityDotColor = 'bg-emerald-500 ring-1 ring-white';
          qualityDotTitle = 'Live Data (Current)';
        } else if (item.weatherQualityStatus === 'STALE') {
          qualityDotColor = 'bg-amber-500 ring-1 ring-white';
          qualityDotTitle = 'Stale Observation (>3h)';
        } else if (item.weatherQualityStatus === 'DEMO') {
          qualityDotColor = 'bg-orange-500 ring-1 ring-white';
          qualityDotTitle = 'Demonstration Baseline';
        }

        // SVG Symbol: Blue monitoring station pin with weather quality status pip
        const stationIconHtml = `
          <div class="relative flex items-center justify-center cursor-pointer group" style="width: 32px; height: 32px;">
            <div class="absolute inset-0 rounded-full bg-blue-500/20 pulse-station ${isSelected ? 'ring-2 ring-blue-600' : ''}"></div>
            <div class="relative w-6 h-6 rounded-full bg-blue-700 border-2 border-white shadow-md flex items-center justify-center text-white text-[10px] font-bold">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="2"></circle>
                <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path>
              </svg>
            </div>
            <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${qualityDotColor}" title="${qualityDotTitle}"></span>
          </div>
        `;

        const stationIcon = L.divIcon({
          html: stationIconHtml,
          className: 'custom-station-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });

        const marker = L.marker([location.latitude, location.longitude], {
          icon: stationIcon,
          title: location.name,
        });

        // Popup Content with Telemetry & Observation Status
        const popupHtml = createLocationPopupHtml(item);
        marker.bindPopup(popupHtml, { maxWidth: 320 });

        marker.on('click', () => {
          if (onSelectLocation) onSelectLocation(item);
          if (onSelectIncident) onSelectIncident(null);
        });

        layer.addLayer(marker);
      });
    }

    // Symbol B: Calculated Risk Assessments (Color-Coded Diamond/Octagon Badge)
    if (showRiskBadges) {
      locations
        .filter((item) => item.riskAssessment !== null)
        .forEach((item) => {
          const { location, riskAssessment } = item;
          if (!location.latitude || !location.longitude || !riskAssessment) return;

          if (riskFilter !== 'all' && riskAssessment.risk_category !== riskFilter) {
            return;
          }

          const tier = riskAssessment.risk_category;
          let badgeColor = 'bg-emerald-600 border-emerald-300';
          let pulseClass = '';

          if (tier === 'critical') {
            badgeColor = 'bg-rose-600 border-rose-300 pulse-critical';
            pulseClass = 'ring-2 ring-rose-600 ring-offset-1';
          } else if (tier === 'high') {
            badgeColor = 'bg-orange-600 border-orange-300';
          } else if (tier === 'moderate') {
            badgeColor = 'bg-amber-600 border-amber-300';
          }

          // Offset slightly so station and risk badge don't overlap completely
          const latOffset = location.latitude + 0.018;
          const lngOffset = location.longitude + 0.018;

          const riskIconHtml = `
            <div class="relative flex items-center justify-center cursor-pointer" style="width: 28px; height: 28px;">
              <div class="w-6 h-6 rotate-45 ${badgeColor} ${pulseClass} border-2 shadow-lg flex items-center justify-center text-white">
                <span class="-rotate-45 text-[9px] font-black uppercase tracking-tighter">
                  ${tier[0].toUpperCase()}
                </span>
              </div>
            </div>
          `;

          const riskIcon = L.divIcon({
            html: riskIconHtml,
            className: 'custom-risk-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14],
          });

          const marker = L.marker([latOffset, lngOffset], {
            icon: riskIcon,
            title: `Risk Assessment: ${location.name} (${tier.toUpperCase()})`,
          });

          const popupHtml = createRiskPopupHtml(item);
          marker.bindPopup(popupHtml, { maxWidth: 320 });

          marker.on('click', () => {
            if (onSelectLocation) onSelectLocation(item);
            if (onSelectIncident) onSelectIncident(null);
          });

          layer.addLayer(marker);
        });
    }

    // Symbol C: Verified Historical Landslide Incidents (Warning Triangle / Scar)
    if (showIncidents) {
      incidents.forEach((inc) => {
        if (!inc.latitude || !inc.longitude) return;

        const isSelected = selectedIncident?.id === inc.id;

        const incidentIconHtml = `
          <div class="relative flex items-center justify-center cursor-pointer" style="width: 30px; height: 30px;">
            <div class="w-7 h-7 rounded-lg bg-red-900 border-2 border-red-400 shadow-md flex items-center justify-center text-amber-300 ${isSelected ? 'ring-2 ring-amber-400' : ''}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
          </div>
        `;

        const incidentIcon = L.divIcon({
          html: incidentIconHtml,
          className: 'custom-incident-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -15],
        });

        const marker = L.marker([inc.latitude, inc.longitude], {
          icon: incidentIcon,
          title: `Historical Incident: ${inc.category}`,
        });

        const popupHtml = createIncidentPopupHtml(inc);
        marker.bindPopup(popupHtml, { maxWidth: 320 });

        marker.on('click', () => {
          if (onSelectIncident) onSelectIncident(inc);
          if (onSelectLocation) onSelectLocation(null);
        });

        layer.addLayer(marker);
      });
    }

    // Symbol D: Community Crowdsourced Reports (Amber for Unverified / Teal for Verified)
    // NEVER merged with official historical incidents
    if (showCommunityReports && communityReports && communityReports.length > 0) {
      communityReports.forEach((report) => {
        if (!report.latitude || !report.longitude) return;

        const isSelected = selectedCommunityReport?.id === report.id;
        const isVerified = report.review_status === 'verified';
        const isUnderReview = report.review_status === 'under_review';
        const isRejected = report.review_status === 'rejected';

        // Separate, distinct visual symbology:
        // Verified: Teal diamond with shield
        // Under Review: Orange rounded square with clock
        // Rejected: Dark red with cross
        // Submitted/Pending: Amber circle with warning beacon
        let iconBg = 'bg-amber-900 border-amber-400 text-amber-300';
        let svgIcon = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        `;

        if (isVerified) {
          iconBg = 'bg-teal-900 border-teal-400 text-teal-300';
          svgIcon = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
          `;
        } else if (isUnderReview) {
          iconBg = 'bg-orange-950 border-orange-400 text-orange-300';
          svgIcon = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          `;
        } else if (isRejected) {
          iconBg = 'bg-rose-950 border-rose-400 text-rose-300';
          svgIcon = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          `;
        }

        const reportIconHtml = `
          <div class="relative flex items-center justify-center cursor-pointer" style="width: 32px; height: 32px;">
            <div class="w-7 h-7 rounded-full ${iconBg} border-2 shadow-md flex items-center justify-center ${
              isSelected ? 'ring-2 ring-cyan-400 ring-offset-1' : ''
            }">
              ${svgIcon}
            </div>
            ${
              report.attachment_count && report.attachment_count > 0
                ? `<span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-600 text-[8px] font-bold text-white flex items-center justify-center border border-white shadow-xs" title="${report.attachment_count} attachment(s)">📎</span>`
                : ''
            }
          </div>
        `;

        const reportIcon = L.divIcon({
          html: reportIconHtml,
          className: 'custom-community-report-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });

        const marker = L.marker([report.latitude, report.longitude], {
          icon: reportIcon,
          title: `Community Report #${report.id}: ${report.category} (${report.review_status})`,
        });

        const popupHtml = createCommunityPopupHtml(report);
        marker.bindPopup(popupHtml, { maxWidth: 320 });

        marker.on('click', () => {
          if (onSelectCommunityReport) onSelectCommunityReport(report);
          if (onSelectIncident) onSelectIncident(null);
          if (onSelectLocation) onSelectLocation(null);
        });

        layer.addLayer(marker);
      });
    }
  }, [
    locations,
    incidents,
    communityReports,
    showStations,
    showRiskBadges,
    showIncidents,
    showCommunityReports,
    riskFilter,
    selectedLocation,
    selectedIncident,
    selectedCommunityReport,
    onSelectLocation,
    onSelectIncident,
    onSelectCommunityReport,
  ]);

  // 4. Region Preset Handler
  const handleSelectRegion = (preset: RegionPreset) => {
    setActiveRegion(preset.id);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyToBounds(preset.bounds, {
        padding: [24, 24],
        duration: 1.2,
      });
    }
  };

  const handleResetIndiaView = () => {
    handleSelectRegion(REGION_PRESETS[0]);
  };

  return (
    <div
      className={
        showCardWrapper
          ? 'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col'
          : 'flex flex-col h-full'
      }
    >
      {/* Map Control Bar */}
      <div className="p-3.5 bg-slate-900 border-b border-slate-800 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Title & Region Badge */}
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-md bg-blue-600/30 border border-blue-500/40 text-blue-400">
            <Compass className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Pan-India Geohazard Monitoring GIS
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                Kashmir to Kanyakumari
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Interactive coverage across all Indian states and hill tracts
            </p>
          </div>
        </div>

        {/* Region Quick Preset Buttons */}
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center space-x-1">
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Focus Region:</span>
          </span>
          {REGION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSelectRegion(preset)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center space-x-1 ${
                activeRegion === preset.id
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              title={`Focus map on ${preset.label}`}
            >
              <span>{preset.flag}</span>
              <span className="hidden sm:inline">{preset.label.split(' ')[0]}</span>
            </button>
          ))}
          <button
            onClick={handleResetIndiaView}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs cursor-pointer ml-1"
            title="Reset to Full India View"
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Layer Toggles & Filter Sub-Bar */}
      <div className="px-3.5 py-2 bg-slate-800/90 border-b border-slate-700 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Layer Checkboxes */}
        <div className="flex items-center flex-wrap gap-4">
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white select-none">
            <input
              type="checkbox"
              checked={showStations}
              onChange={(e) => setShowStations(e.target.checked)}
              className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-700 w-3.5 h-3.5"
            />
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
              <span>Monitored Locations</span>
              <span className="text-[10px] font-mono text-slate-400">({locations.length})</span>
            </span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white select-none">
            <input
              type="checkbox"
              checked={showRiskBadges}
              onChange={(e) => setShowRiskBadges(e.target.checked)}
              className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-700 w-3.5 h-3.5"
            />
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rotate-45 bg-amber-500 inline-block"></span>
              <span>Calculated Risks</span>
              <span className="text-[10px] font-mono text-slate-400">
                ({locations.filter((l) => l.riskAssessment !== null).length})
              </span>
            </span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white select-none">
            <input
              type="checkbox"
              checked={showIncidents}
              onChange={(e) => setShowIncidents(e.target.checked)}
              className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-700 w-3.5 h-3.5"
            />
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-sm bg-red-600 inline-block"></span>
              <span>Historical Incidents</span>
              <span className="text-[10px] font-mono text-slate-400">({incidents.length})</span>
            </span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white select-none">
            <input
              type="checkbox"
              checked={showCommunityReports}
              onChange={(e) => setShowCommunityReports(e.target.checked)}
              className="rounded border-slate-600 text-teal-600 focus:ring-teal-500 bg-slate-700 w-3.5 h-3.5"
            />
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-teal-400 inline-block"></span>
              <span>Community Reports</span>
              <span className="text-[10px] font-mono text-slate-400">
                ({communityReports?.length || 0})
              </span>
            </span>
          </label>
        </div>

        {/* Risk Level Filter & Basemap Selector */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-slate-400">Risk Tier:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Tiers</option>
              <option value="critical">Critical Only</option>
              <option value="high">High Only</option>
              <option value="moderate">Moderate Only</option>
              <option value="low">Low Only</option>
            </select>
          </div>

          <div className="flex items-center space-x-1 border-l border-slate-700 pl-3">
            <span className="text-[11px] text-slate-400">Basemap:</span>
            <button
              onClick={() => setActiveBasemap('dark')}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                activeBasemap === 'dark' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Navy
            </button>
            <button
              onClick={() => setActiveBasemap('osm')}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                activeBasemap === 'osm' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              OSM
            </button>
            <button
              onClick={() => setActiveBasemap('topo')}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                activeBasemap === 'topo' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Topo
            </button>
          </div>
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div className="relative flex-1">
        <div ref={mapContainerRef} className={`w-full ${heightClass} z-10`} />

        {/* Floating Legend / Quick Guide Overlay */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-xs border border-slate-800 rounded-lg p-2.5 text-white shadow-lg pointer-events-auto max-w-xs text-[11px] space-y-1.5">
          <div className="font-bold uppercase tracking-wider text-[10px] text-slate-400 flex items-center justify-between">
            <span>Symbol Classification</span>
            <span className="text-blue-400 font-mono">GIS Legend</span>
          </div>
          <div className="grid grid-cols-1 gap-1 text-[11px]">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-blue-600 border border-white shrink-0"></span>
              <span className="text-slate-300">Monitored Station (Pan-India)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rotate-45 bg-rose-600 border border-rose-300 shrink-0"></span>
              <span className="text-slate-300">Calculated Risk (Critical / High)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-sm bg-red-900 border border-red-400 shrink-0"></span>
              <span className="text-slate-300">Verified Historical Incident</span>
            </div>
            <div className="flex items-center space-x-1.5 pt-1.5 border-t border-slate-800 text-[10px]">
              <span className="text-slate-400">Telemetry:</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-slate-300 font-medium">Live</span>
              <span className="w-2 h-2 rounded-full bg-amber-500 ml-1"></span>
              <span className="text-slate-300">Stale</span>
              <span className="w-2 h-2 rounded-full bg-slate-400 ml-1"></span>
              <span className="text-slate-300">Missing</span>
              <span className="w-2 h-2 rounded-full bg-orange-500 ml-1"></span>
              <span className="text-slate-300">Demo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper: Generate Rich Location Popup Content
function createLocationPopupHtml(item: CompositeMapLocation): string {
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

  const rainfallText = latestRainfall
    ? `${latestRainfall.value} ${latestRainfall.unit} (${formatRelativeTime(latestRainfall.observed_at)})`
    : 'No data available';

  const moistureText = latestSoilMoisture
    ? `${latestSoilMoisture.value} ${latestSoilMoisture.unit} (${formatRelativeTime(latestSoilMoisture.observed_at)})`
    : 'No data available';

  const tempText = latestTemperature
    ? `${latestTemperature.value} ${latestTemperature.unit}`
    : 'No data available';

  const humText = latestHumidity
    ? `${latestHumidity.value} ${latestHumidity.unit}`
    : 'No data available';

  let riskTierHtml = `<span class="text-slate-500 font-mono text-[11px]">No data available</span>`;
  if (riskAssessment) {
    const tier = riskAssessment.risk_category.toUpperCase();
    const colors =
      tier === 'CRITICAL'
        ? 'bg-rose-100 text-rose-800 border-rose-300'
        : tier === 'HIGH'
        ? 'bg-orange-100 text-orange-800 border-orange-300'
        : tier === 'MODERATE'
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-emerald-100 text-emerald-800 border-emerald-300';
    riskTierHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${colors}">${tier} (${riskAssessment.risk_score || 'N/A'})</span>`;
  }

  let alertHtml = `<div class="text-[11px] text-slate-500 italic">No active early warning alert</div>`;
  if (activeAlert) {
    alertHtml = `
      <div class="p-2 rounded bg-rose-50 border border-rose-200 text-rose-950 space-y-1">
        <div class="flex items-center justify-between text-[11px] font-bold">
          <span>⚠️ ${escapeHtml(activeAlert.title)}</span>
          <span class="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-200 text-rose-900">${activeAlert.severity}</span>
        </div>
        <p class="text-[10px] text-rose-800 leading-snug">${escapeHtml(activeAlert.description)}</p>
      </div>
    `;
  }

  const isDemo = location.name.includes('[DEMO]');

  // Quality status badge
  let qualityBadgeHtml = '';
  switch (weatherQualityStatus) {
    case 'CURRENT':
      qualityBadgeHtml = `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">Live: CURRENT</span>`;
      break;
    case 'STALE':
      qualityBadgeHtml = `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">STALE (>3h)</span>`;
      break;
    case 'DEMO':
      qualityBadgeHtml = `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-orange-100 text-orange-800 border border-orange-300">DEMO</span>`;
      break;
    case 'FORECAST':
      qualityBadgeHtml = `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-300">FORECAST</span>`;
      break;
    default:
      qualityBadgeHtml = `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-300">MISSING DATA</span>`;
      break;
  }

  // Provider attribution text
  let providerText = 'No telemetry feed connected';
  if (latestRainfall?.source && latestRainfall.source.toLowerCase().includes('open-meteo')) {
    providerText = 'Open-Meteo Analysis (ECMWF/GFS)';
  } else if (latestRainfall?.source && latestRainfall.source.includes('[DEMO]')) {
    providerText = 'Demonstration Historical Baseline';
  } else if (latestRainfall?.source) {
    providerText = latestRainfall.source;
  }

  const isForecast = latestRainfall?.is_forecast || latestSoilMoisture?.is_forecast;
  const observationTag = isForecast
    ? `<span class="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Model Forecast</span>`
    : (latestRainfall ? `<span class="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Verified Analysis</span>` : '');

  return `
    <div class="p-3 text-slate-800 font-sans space-y-2 text-xs">
      <div class="border-b border-slate-200 pb-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-1.5">
            ${qualityBadgeHtml}
            ${observationTag}
          </div>
          <span class="text-[10px] text-slate-500 font-mono">${location.latitude.toFixed(4)}°N, ${location.longitude.toFixed(4)}°E</span>
        </div>
        <h4 class="text-sm font-bold text-slate-900 mt-1">${escapeHtml(location.name)}</h4>
        <div class="text-[11px] text-slate-600">${escapeHtml(location.district)}, ${escapeHtml(location.state)}</div>
      </div>

      <div class="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded border border-slate-200">
        <div>
          <span class="text-slate-500 block">Elevation:</span>
          <span class="font-semibold text-slate-800">${location.elevation != null ? `${location.elevation} m` : 'No data available'}</span>
        </div>
        <div>
          <span class="text-slate-500 block">Slope Incline:</span>
          <span class="font-semibold text-slate-800">${location.slope_angle != null ? `${location.slope_angle}°` : 'No data available'}</span>
        </div>
      </div>

      <div class="space-y-1.5 pt-1">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-slate-600 font-medium">🌧️ Precipitation:</span>
          <span class="font-mono text-slate-800 font-semibold">${rainfallText}</span>
        </div>
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-slate-600 font-medium">💧 Soil Moisture:</span>
          <span class="font-mono text-slate-800 font-semibold">${moistureText}</span>
        </div>
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-slate-600 font-medium">🌡️ Temperature:</span>
          <span class="font-mono text-slate-800 font-semibold">${tempText}</span>
        </div>
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-slate-600 font-medium">💨 Humidity:</span>
          <span class="font-mono text-slate-800 font-semibold">${humText}</span>
        </div>
        <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
          <span class="text-slate-600 font-medium">Calculated Risk:</span>
          <div>${riskTierHtml}</div>
        </div>
      </div>

      <div class="pt-1 text-[10px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
        <span>Provider: ${escapeHtml(providerText)}</span>
        <span>${isDemo ? '[DEMO]' : 'ID #' + location.id}</span>
      </div>

      <div class="pt-0.5">
        ${alertHtml}
      </div>
    </div>
  `;
}

// Helper: Risk Assessment Specific Popup
function createRiskPopupHtml(item: CompositeMapLocation): string {
  const { location, riskAssessment } = item;
  if (!riskAssessment) return '';

  const tier = riskAssessment.risk_category.toUpperCase();
  const colors =
    tier === 'CRITICAL'
      ? 'bg-rose-100 text-rose-900 border-rose-300'
      : tier === 'HIGH'
      ? 'bg-orange-100 text-orange-900 border-orange-300'
      : tier === 'MODERATE'
      ? 'bg-amber-100 text-amber-900 border-amber-300'
      : 'bg-emerald-100 text-emerald-900 border-emerald-300';

  return `
    <div class="p-3 text-slate-800 font-sans space-y-2 text-xs">
      <div class="flex items-center justify-between border-b border-slate-200 pb-1.5">
        <span class="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${colors}">
          ${tier} RISK ASSESSMENT
        </span>
        <span class="text-[10px] text-slate-500 font-mono">Score: ${riskAssessment.risk_score ?? 'N/A'}</span>
      </div>
      <div>
        <h4 class="text-xs font-bold text-slate-900">${escapeHtml(location.name)}</h4>
        <div class="text-[11px] text-slate-600">${escapeHtml(location.district)}, ${escapeHtml(location.state)}</div>
      </div>
      <div class="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-700 leading-snug">
        ${escapeHtml(riskAssessment.explanation || 'No assessment explanation available.')}
      </div>
      <div class="text-[10px] text-slate-500 pt-1 flex justify-between">
        <span>Source: ${escapeHtml(riskAssessment.assessment_source)}</span>
        <span>${formatRelativeTime(riskAssessment.assessed_at)}</span>
      </div>
    </div>
  `;
}

// Helper: Historical Incident Popup
function createIncidentPopupHtml(inc: IncidentItem): string {
  return `
    <div class="p-3 text-slate-800 font-sans space-y-2 text-xs">
      <div class="flex items-center justify-between border-b border-slate-200 pb-1.5">
        <span class="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-900 border border-red-300">
          HISTORICAL INCIDENT (${inc.review_status.toUpperCase()})
        </span>
        <span class="text-[10px] text-slate-500 font-mono">${formatDate(inc.reported_at)}</span>
      </div>
      <div class="space-y-1">
        <div class="text-[11px] font-bold text-red-900 uppercase tracking-wide">Category: ${escapeHtml(inc.category.replace('_', ' '))}</div>
        <p class="text-[11px] text-slate-700 leading-relaxed">${escapeHtml(inc.description)}</p>
      </div>
      <div class="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
        <span>Source: ${escapeHtml(inc.source_type)}</span>
        <span class="font-mono">${inc.latitude.toFixed(4)}°N, ${inc.longitude.toFixed(4)}°E</span>
      </div>
    </div>
  `;
}

// Helper: Community Crowdsourced Report Popup
function createCommunityPopupHtml(report: IncidentItem): string {
  const isVerified = report.review_status === 'verified';
  const badgeClass = isVerified
    ? 'bg-teal-100 text-teal-900 border-teal-300'
    : report.review_status === 'under_review'
    ? 'bg-orange-100 text-orange-900 border-orange-300'
    : report.review_status === 'rejected'
    ? 'bg-rose-100 text-rose-900 border-rose-300'
    : 'bg-amber-100 text-amber-900 border-amber-300';

  const verificationBadge = isVerified
    ? '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">Field Verified</span>'
    : '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">Pending Field Audit</span>';

  return `
    <div class="p-3 text-slate-800 font-sans space-y-2 text-xs">
      <div class="flex items-center justify-between border-b border-slate-200 pb-1.5">
        <span class="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${badgeClass}">
          COMMUNITY REPORT #${report.id}
        </span>
        ${verificationBadge}
      </div>
      <div class="space-y-1">
        <div class="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
          Category: ${escapeHtml(report.category.replace('_', ' '))}
        </div>
        <p class="text-[11px] text-slate-700 leading-relaxed">${escapeHtml(report.description)}</p>
        ${
          report.location_description
            ? `<div class="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200">
                <strong>Landmark:</strong> ${escapeHtml(report.location_description)}
              </div>`
            : ''
        }
      </div>
      <div class="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
        <span>Reporter: ${escapeHtml(report.reporter_name || 'Anonymous Citizen')}</span>
        <span class="font-mono">${report.latitude.toFixed(4)}°N, ${report.longitude.toFixed(4)}°E</span>
      </div>
      ${
        report.attachment_count && report.attachment_count > 0
          ? `<div class="text-[10px] text-blue-700 font-medium">📷 ${report.attachment_count} evidence attachment(s) available</div>`
          : ''
      }
      <div class="text-[9px] text-slate-400 italic">
        Subject to DDMA/Observer ground verification before inclusion in official hazard catalogs.
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours <= 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return dateStr;
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default IndiaMonitoringMap;

import React from 'react';
import {
  Map,
  Cpu,
  FileText,
  BellRing,
  Route,
  CloudRain,
  BarChart3,
  Settings,
  ArrowLeft,
  Calendar,
  Lock,
  Layers,
} from 'lucide-react';
import { NavSectionId } from '../types';
import { PageHeader } from '../components/common/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';

interface PlaceholderPageProps {
  sectionId: NavSectionId;
  onReturnToOverview: () => void;
}

interface SectionMeta {
  title: string;
  subtitle: string;
  phase: string;
  icon: typeof Map;
  summary: string;
  capabilities: string[];
  techStack: string[];
}

const SECTION_METADATA: Record<Exclude<NavSectionId, 'overview'>, SectionMeta> = {
  'risk-map': {
    title: 'Spatial GIS Hazard Map',
    subtitle: 'Interactive geospatial terrain visualization and slope stability mapping',
    phase: 'Phase 3 Milestone',
    icon: Map,
    summary:
      'High-resolution digital elevation models (DEM), slope incline overlays, geological fault structures, and susceptible hill tracts across India’s North Eastern Region.',
    capabilities: [
      'Interactive vector tile rendering with MapLibre GL / Leaflet',
      'Geological Survey of India (GSI) landslide hazard macro-zonation overlays',
      'Slope gradient filters and elevation contours (SRTM / Cartosat DEM)',
      'Sub-basin hydrological drainage basin visualization',
    ],
    techStack: ['PostgreSQL + PostGIS', 'MapLibre GL / Leaflet', 'GeoJSON / TopoJSON', 'FastAPI Spatial Routes'],
  },
  'ai-prediction': {
    title: 'AI Risk Prediction Engine',
    subtitle: 'Machine learning susceptibility modeling and rainfall-triggered failure forecasting',
    phase: 'Phase 5 Milestone',
    icon: Cpu,
    summary:
      'Predictive landslide susceptibility models fusing antecedent rainfall, geological fragility, slope geometry, and real-time soil moisture saturation curves.',
    capabilities: [
      'Empirical Rainfall Threshold (I-D Intensity-Duration) modeling',
      'Random Forest and XGBoost slope susceptibility scoring',
      '48-hour forward failure probability forecast for vulnerable highway segments',
      'Automated confidence interval calculation with ground-truth verification',
    ],
    techStack: ['PyTorch / Scikit-Learn', 'FastAPI ML Inference Pipeline', 'NumPy / Pandas', 'Pydantic Predictor Schemas'],
  },
  'field-reports': {
    title: 'Field Reports & Ground Verification',
    subtitle: 'Incident tracking, damage assessment, and ground-truth validation',
    phase: 'Phase 6 Milestone',
    icon: FileText,
    summary:
      'Structured incident intake for field emergency responders, district disaster management authorities (DDMA), and verified citizen observers.',
    capabilities: [
      'Standardized incident reporting schemas (debris volume, lane blockage, casualties)',
      'Photo geotagging and EXIF validation for ground-truth proof',
      'Offline-first field synchronization for remote mountain corridors',
      'Verification workflow with multi-level agency sign-off',
    ],
    techStack: ['IndexedDB Offline Cache', 'Role-Based Access Control (RBAC)', 'REST Ingestion APIs', 'Multipart Form Uploads'],
  },
  'alerts': {
    title: 'Early Warning & Alerts Dispatch',
    subtitle: 'Emergency notification distribution and CAP protocol integration',
    phase: 'Phase 5 Milestone',
    icon: BellRing,
    summary:
      'Multi-channel early warning broadcast system alerting regional authorities, transport departments, and local communities ahead of high-probability slope failures.',
    capabilities: [
      'ITU Common Alerting Protocol (CAP v1.2) XML payload synthesis',
      'Automated SMS, Telegram, and WhatsApp alert dispatch for registered authorities',
      'Threshold-triggered audible horn and roadside digital sign integration',
      'Audit log of issued warning dispatches and acknowledgment receipts',
    ],
    techStack: ['Celery / Redis Async Queue', 'CAP v1.2 XML Generator', 'Twilio / SMS Gateway', 'WebSockets Push Notifications'],
  },
  'road-connectivity': {
    title: 'Road Connectivity & Lifeline Corridors',
    subtitle: 'Strategic highway monitoring and critical transit vulnerability tracking',
    phase: 'Phase 4 Milestone',
    icon: Route,
    summary:
      'Dedicated monitoring of vital North Eastern transit arteries (NH-27, NH-37, NH-10) connecting Assam, Meghalaya, Sikkim, and hill border corridors.',
    capabilities: [
      'Critical transit corridor segmentation and vulnerability ranking',
      'Real-time landslide blockage status and estimated clearance times',
      'Alternate detour routing recommendations for emergency response convoys',
      'Border Roads Organisation (BRO) and PWD operational coordination feeds',
    ],
    techStack: ['GraphHopper / pgRouting', 'Spatial Route Buffers', 'Live Road Event Feeds', 'FastAPI Road APIs'],
  },
  'weather-monitoring': {
    title: 'Weather & Precipitation Monitoring',
    subtitle: 'Precipitation telemetry, radar feeds, and soil moisture dynamics',
    phase: 'Phase 4 Milestone',
    icon: CloudRain,
    summary:
      'Near real-time ingestion from India Meteorological Department (IMD) automatic weather stations (AWS), Doppler radar rainfall estimates, and satellite soil moisture.',
    capabilities: [
      'Hourly precipitation accumulation and rolling 24h / 72h antecedent rainfall tracking',
      'NASA GPM / IMD gridded rainfall raster ingestion and spatial averaging',
      'In-situ borehole piezometer and soil moisture sensor telemetry feeds',
      'Threshold exceedance monitors triggering automated preliminary watches',
    ],
    techStack: ['IMD Weather API Client', 'TimescaleDB / Chrono Time-Series', 'NetCDF / GRIB2 Parsers', 'Pydantic Telemetry Schemas'],
  },
  'analytics': {
    title: 'Geohazard Analytics & Trends',
    subtitle: 'Historical landslide catalog analysis and monsoon seasonality insights',
    phase: 'Phase 5 Milestone',
    icon: BarChart3,
    summary:
      'Retrospective analysis of geological event patterns, seasonal rainfall intensity spikes, and district-level risk exposure across North Eastern India.',
    capabilities: [
      'Historical landslide frequency heatmaps and decadal recurrence cycles',
      'Rainfall intensity-frequency-duration (IFD) correlation curves',
      'District-wise vulnerability index ranking for disaster preparedness funding',
      'Automated monthly executive summaries for state disaster management authorities',
    ],
    techStack: ['Apache ECharts / Recharts', 'Pandas Analytics Pipeline', 'GeoPandas Spatial Aggregations', 'FastAPI Analytics Endpoints'],
  },
  'settings': {
    title: 'System Settings & Integration Protocols',
    subtitle: 'Platform configuration, notification channels, and spatial data sources',
    phase: 'Phase 6 Milestone',
    icon: Settings,
    summary:
      'Administrative console for managing telemetry ingest intervals, warning thresholds, external agency API tokens, and PostGIS database connections.',
    capabilities: [
      'Customizable rainfall warning thresholds by geographical zone',
      'External API configurations (IMD, GSI, BRO, State DDMAs)',
      'Agency role permissions and operator session management',
      'System log exports and telemetry retention rules',
    ],
    techStack: ['Encrypted Secret Vault', 'Pydantic Configuration Sync', 'FastAPI Admin Endpoints', 'Audit Trail Engine'],
  },
};

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  sectionId,
  onReturnToOverview,
}) => {
  if (sectionId === 'overview') {
    return null;
  }

  const meta = SECTION_METADATA[sectionId];
  const Icon = meta.icon;

  return (
    <div className="space-y-6">
      {/* Page Header with Return Button */}
      <PageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        badge={
          <StatusBadge variant="info" size="md">
            {meta.phase}
          </StatusBadge>
        }
        actions={
          <button
            onClick={onReturnToOverview}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Return to Overview</span>
          </button>
        }
      />

      {/* Planned Feature Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-950">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-blue-600 text-white rounded-lg shadow-2xs shrink-0">
              <Icon className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900">{meta.title}</h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-200/80 text-blue-900 border border-blue-300">
                  {meta.phase}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                {meta.summary}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
              <Lock className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
              <span>Planned Milestone</span>
            </span>
          </div>
        </div>

        {/* Planned Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-blue-600" aria-hidden="true" />
              <h3>Planned Capabilities</h3>
            </div>
            <ul className="space-y-2 text-xs text-slate-600">
              {meta.capabilities.map((cap, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" aria-hidden="true" />
                  <span className="leading-snug">{cap}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-blue-600" aria-hidden="true" />
              <h3>Planned Engineering Stack</h3>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {meta.techStack.map((tech, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-white text-slate-700 border border-slate-300 shadow-2xs"
                >
                  {tech}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 pt-2 leading-relaxed">
              In accordance with project phase isolation rules, implementation for this module will commence following successful sign-off and explicit progression to its targeted phase.
            </p>
          </div>
        </div>

        {/* Footer Navigation Action */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Module status: Isolated & Planned</span>
          <button
            onClick={onReturnToOverview}
            className="inline-flex items-center space-x-1 font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:underline cursor-pointer"
          >
            <span>&larr; Back to System Overview</span>
          </button>
        </div>
      </div>
    </div>
  );
};

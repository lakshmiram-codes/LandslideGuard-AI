export type ConnectionState = 'idle' | 'loading' | 'success' | 'error';

export type NavSectionId =
  | 'overview'
  | 'risk-map'
  | 'ai-prediction'
  | 'field-reports'
  | 'alerts'
  | 'road-connectivity'
  | 'weather-monitoring'
  | 'analytics'
  | 'settings';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export type BadgeVariant =
  | 'low'
  | 'moderate'
  | 'high'
  | 'critical'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral';

export interface HealthResponse {
  status: string;
  application: string;
  version: string;
  timestamp: string;
}

export interface InfoResponse {
  application: string;
  subtitle: string;
  version: string;
  current_phase: string;
  target_region: string;
  description: string;
  status: string;
}

export interface RootResponse {
  application: string;
  status: string;
  version: string;
  phase: string;
  docs_url: string;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: string;
}

export interface NavItemConfig {
  id: NavSectionId;
  label: string;
  phaseTarget: string;
  available: boolean;
  description: string;
  iconName: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface LocationItem {
  id: number;
  name: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  slope_angle?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DataQualityStatus =
  | 'CURRENT'
  | 'STALE'
  | 'MISSING'
  | 'INVALID'
  | 'FORECAST'
  | 'ERROR'
  | 'DEMO';

export interface ObservationItem {
  id: number;
  location_id: number;
  observation_type: string;
  value: number;
  unit: string;
  observed_at: string;
  source: string;
  provenance_metadata?: string | null;
  quality_status?: DataQualityStatus;
  is_forecast?: boolean;
  retrieved_at?: string | null;
}

export interface IncidentItem {
  id: number;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  location_description?: string | null;
  location_id?: number | null;
  source_type: string;
  review_status: string;
  reported_at: string;
  reporter_name?: string | null;
  reporter_contact?: string | null;
  reporter_user_id?: number | null;
  consent_given?: boolean;
  is_community_report: boolean;
  verified_at?: string | null;
  review_notes?: string | null;
  attachment_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface IncidentAttachmentItem {
  id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  caption?: string | null;
  uploaded_at: string;
}

export interface IncidentReviewLogItem {
  id: number;
  reviewer_name: string;
  reviewer_role: string;
  from_status: string;
  to_status: string;
  action: string;
  notes: string;
  created_at: string;
}

export interface IncidentDetailItem extends IncidentItem {
  attachments: IncidentAttachmentItem[];
  review_logs: IncidentReviewLogItem[];
}

export interface UserItem {
  id: number;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

export interface CapAuditLogItem {
  id: number;
  user_name: string;
  user_role: string;
  action: string;
  notes: string;
  created_at: string;
}

export interface CapMessageItem {
  id: number;
  identifier: string;
  alert_id?: number | null;
  risk_assessment_id?: number | null;
  incident_id?: number | null;
  sender: string;
  sent_at: string;
  status: 'Draft' | 'Test' | 'Actual' | 'Exercise' | string;
  msg_type: 'Alert' | 'Update' | 'Cancel' | string;
  scope: 'Public' | 'Restricted' | 'Private' | string;
  category: string;
  event: string;
  urgency: string;
  severity: string;
  certainty: string;
  headline: string;
  description: string;
  instruction?: string | null;
  area_description: string;
  circle_lat?: number | null;
  circle_lon?: number | null;
  circle_radius_km?: number | null;
  dispatch_status: 'DRAFT' | 'VALIDATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'EXPORTED' | 'CANCELLED' | string;
  validation_outcome?: string | null;
  is_simulation: boolean;
  export_count: number;
  approved_at?: string | null;
  exported_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
  audit_logs: CapAuditLogItem[];
}

export interface CapXmlPreviewItem {
  identifier: string;
  xml_payload: string;
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CapExportResult {
  identifier: string;
  dispatch_status: string;
  export_count: number;
  exported_at: string;
  is_simulation: boolean;
  xml_payload: string;
  dispatch_receipt: string;
}

export interface RiskAssessmentItem {
  id: number;
  location_id: number;
  risk_category: RiskLevel | 'insufficient_data';
  risk_score?: number | null;
  assessment_type?: string;
  susceptibility_score?: number | null;
  trigger_score?: number | null;
  data_quality_status?: string | null;
  contributing_factors_json?: string | null;
  limitations_notes?: string | null;
  assessed_at: string;
  assessment_source: string;
  model_version?: string | null;
  explanation?: string | null;
}

export interface AlertItem {
  id: number;
  location_id?: number | null;
  severity: RiskLevel;
  title: string;
  description: string;
  status: 'draft' | 'issued' | 'acknowledged' | 'resolved' | 'cancelled' | string;
  acknowledged_at?: string | null;
  source: string;
  triggering_assessment_id?: number | null;
  alert_fingerprint?: string | null;
  cooldown_until?: string | null;
  uncertainty_notes?: string | null;
  is_experimental?: boolean;
  created_at: string;
}

export interface FactorContribution {
  factor_name: string;
  raw_value: number | null;
  unit: string;
  normalized_score: number;
  weight: number;
  contribution_score: number;
  percentage_of_total: number;
  narrative: string;
}

export interface ExplainableAssessmentResponse {
  location_id: number;
  location_name: string;
  assessment_type: string;
  risk_category: RiskLevel | 'insufficient_data';
  risk_score: number | null;
  susceptibility_score: number | null;
  trigger_score: number | null;
  data_quality_status: string;
  is_sufficient_data: boolean;
  is_demo: boolean;
  assessed_at: string;
  model_version: string;
  model_name: string;
  contributing_factors: FactorContribution[];
  features_used: Record<string, unknown>;
  limitations: string[];
  analytical_rationale: string;
}

export interface DataReadinessReportResponse {
  report_timestamp: string;
  total_locations: number;
  locations_with_terrain: number;
  locations_with_live_telemetry: number;
  historical_incident_count: number;
  verified_incident_count: number;
  synthetic_demo_count: number;
  available_features: string[];
  missing_features: string[];
  sampling_bias_assessment: string;
  spatial_leakage_risks: string;
  temporal_leakage_risks: string;
  negative_sampling_caution: string;
  ml_readiness_verdict: string;
  prerequisites_for_ml_deployment: string[];
}

export interface EvaluateRiskBatchResponse {
  evaluated_count: number;
  results: ExplainableAssessmentResponse[];
  evaluated_at: string;
}

export interface AlertTriggerEvaluationResponse {
  evaluated_locations: number;
  alerts_issued: number;
  alerts_suppressed: number;
  suppression_reasons: string[];
  dispatched_alerts: AlertItem[];
  evaluated_at: string;
}

export interface CompositeMapLocation {
  location: LocationItem;
  latestRainfall: ObservationItem | null;
  latestSoilMoisture: ObservationItem | null;
  latestTemperature?: ObservationItem | null;
  latestHumidity?: ObservationItem | null;
  riskAssessment: RiskAssessmentItem | null;
  activeAlert: AlertItem | null;
  weatherQualityStatus: DataQualityStatus;
}

export interface MapDataPayload {
  locations: CompositeMapLocation[];
  incidents: IncidentItem[];
  communityReports?: IncidentItem[];
  totalLocations: number;
  totalIncidents: number;
  totalCommunityReports?: number;
  totalRisks: number;
  totalAlerts: number;
  weatherSummary?: WeatherStatusResponse | null;
}

export interface WeatherStatusResponse {
  provider_name: string;
  provider_status: string;
  provider_docs_url: string;
  attribution: string;
  last_sync_utc: string | null;
  total_monitored_locations: number;
  locations_current: number;
  locations_stale: number;
  locations_missing: number;
  locations_invalid_or_error: number;
  monitored_regions: string[];
}

export interface WeatherRefreshResponse {
  status: string;
  provider: string;
  refreshed_count: number;
  failed_count: number;
  skipped_count: number;
  timestamp_utc: string;
  details: unknown[];
}


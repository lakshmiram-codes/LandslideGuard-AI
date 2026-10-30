import {
  HealthResponse,
  InfoResponse,
  RootResponse,
  PaginatedResponse,
  LocationItem,
  ObservationItem,
  IncidentItem,
  IncidentDetailItem,
  IncidentAttachmentItem,
  UserItem,
  RiskAssessmentItem,
  AlertItem,
  CompositeMapLocation,
  MapDataPayload,
  WeatherStatusResponse,
  WeatherRefreshResponse,
  DataQualityStatus,
  ExplainableAssessmentResponse,
  DataReadinessReportResponse,
  EvaluateRiskBatchResponse,
  AlertTriggerEvaluationResponse,
  CapMessageItem,
  CapXmlPreviewItem,
  CapExportResult,
} from '../types';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000';

const REQUEST_TIMEOUT_MS = 6000;

// Active user session state
let activeUser: UserItem | null = null;

export function getActiveUser(): UserItem | null {
  if (activeUser) return activeUser;
  try {
    const raw = localStorage.getItem('landslideguard_active_user');
    if (raw) {
      activeUser = JSON.parse(raw);
      return activeUser;
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

export function setActiveUser(user: UserItem | null): void {
  activeUser = user;
  try {
    if (user) {
      localStorage.setItem('landslideguard_active_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('landslideguard_active_user');
    }
  } catch {
    // Ignore storage errors
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const currentUser = getActiveUser();
  const headers = new Headers(options.headers || {});
  if (currentUser) {
    if (!headers.has('X-User-Email')) headers.set('X-User-Email', currentUser.email);
    if (!headers.has('X-User-Id')) headers.set('X-User-Id', String(currentUser.id));
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/health`);

    if (!response.ok) {
      throw new Error(
        `Backend returned error response: HTTP ${response.status} ${response.statusText}`
      );
    }

    const data: HealthResponse = await response.json();
    return data;
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error(
          `Connection timed out after ${REQUEST_TIMEOUT_MS / 1000}s while reaching backend at ${API_BASE_URL}.`
        );
      }
      throw new Error(
        `Failed to connect to backend at ${API_BASE_URL}. Ensure FastAPI is running. (${err.message})`
      );
    }
    throw new Error(`An unexpected error occurred while contacting ${API_BASE_URL}.`);
  }
}

export async function getBackendInfo(): Promise<InfoResponse> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/info`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as InfoResponse;
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`Failed to fetch backend info: ${err.message}`);
    }
    throw new Error('An unexpected error occurred while fetching system info.');
  }
}

export async function getBackendRoot(): Promise<RootResponse> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as RootResponse;
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`Failed to reach backend root: ${err.message}`);
    }
    throw new Error('An unexpected error occurred while reaching backend root.');
  }
}

export async function fetchLocations(params?: {
  state?: string;
  district?: string;
  page?: number;
  size?: number;
}): Promise<PaginatedResponse<LocationItem>> {
  const query = new URLSearchParams();
  if (params?.state) query.set('state', params.state);
  if (params?.district) query.set('district', params.district);
  query.set('page', String(params?.page || 1));
  query.set('size', String(params?.size || 100));

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/locations?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch locations: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchObservations(params?: {
  location_id?: number;
  page?: number;
  size?: number;
}): Promise<PaginatedResponse<ObservationItem>> {
  const query = new URLSearchParams();
  if (params?.location_id) query.set('location_id', String(params.location_id));
  query.set('page', String(params?.page || 1));
  query.set('size', String(params?.size || 100));

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/observations?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch observations: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchIncidents(params?: {
  review_status?: string;
  is_community_report?: boolean;
  page?: number;
  size?: number;
}): Promise<PaginatedResponse<IncidentItem>> {
  const query = new URLSearchParams();
  if (params?.review_status) query.set('review_status', params.review_status);
  if (params?.is_community_report !== undefined) {
    query.set('is_community_report', String(params.is_community_report));
  }
  query.set('page', String(params?.page || 1));
  query.set('size', String(params?.size || 100));

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/incidents?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch incidents: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchRiskAssessments(params?: {
  page?: number;
  size?: number;
}): Promise<PaginatedResponse<RiskAssessmentItem>> {
  const query = new URLSearchParams();
  query.set('page', String(params?.page || 1));
  query.set('size', String(params?.size || 100));

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/risk-assessments?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch risk assessments: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchAlerts(params?: {
  page?: number;
  size?: number;
}): Promise<PaginatedResponse<AlertItem>> {
  const query = new URLSearchParams();
  query.set('page', String(params?.page || 1));
  query.set('size', String(params?.size || 100));

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/alerts?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch alerts: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchWeatherStatus(): Promise<WeatherStatusResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/weather/status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch weather status: HTTP ${response.status}`);
  }
  return response.json();
}

export async function triggerWeatherRefresh(locationId?: number): Promise<WeatherRefreshResponse> {
  const url = locationId
    ? `${API_BASE_URL}/api/v1/weather/refresh?location_id=${locationId}`
    : `${API_BASE_URL}/api/v1/weather/refresh`;
  const response = await fetchWithTimeout(url, { method: 'POST' });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Weather refresh failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchCompleteMapData(): Promise<MapDataPayload> {
  const emptyPaginated = <T>(): PaginatedResponse<T> => ({
    items: [],
    total: 0,
    page: 1,
    size: 0,
    pages: 0,
  });

  const [locationsRes, observationsRes, incidentsRes, communityRes, risksRes, alertsRes, weatherRes] = await Promise.all([
    fetchLocations({ size: 100 }),
    fetchObservations({ size: 100 }).catch(() => emptyPaginated<ObservationItem>()),
    fetchIncidents({ is_community_report: false, size: 100 }).catch(() => emptyPaginated<IncidentItem>()),
    fetchIncidents({ is_community_report: true, size: 100 }).catch(() => emptyPaginated<IncidentItem>()),
    fetchRiskAssessments({ size: 100 }).catch(() => emptyPaginated<RiskAssessmentItem>()),
    fetchAlerts({ size: 100 }).catch(() => emptyPaginated<AlertItem>()),
    fetchWeatherStatus().catch(() => null),
  ]);

  const locations = locationsRes.items || [];
  const observations = observationsRes.items || [];
  const incidents = incidentsRes.items || [];
  const communityReports = communityRes.items || [];
  const risks = risksRes.items || [];
  const alerts = alertsRes.items || [];

  // Group observations by location_id and type
  const rainfallByLoc = new Map<number, ObservationItem>();
  const moistureByLoc = new Map<number, ObservationItem>();
  const temperatureByLoc = new Map<number, ObservationItem>();
  const humidityByLoc = new Map<number, ObservationItem>();

  for (const obs of observations) {
    const locId = obs.location_id;
    const typeLower = obs.observation_type.toLowerCase();

    if (typeLower.includes('rain') || typeLower.includes('precip')) {
      const existing = rainfallByLoc.get(locId);
      if (!existing || new Date(obs.observed_at) > new Date(existing.observed_at)) {
        rainfallByLoc.set(locId, obs);
      }
    } else if (typeLower.includes('moist') || typeLower.includes('soil')) {
      const existing = moistureByLoc.get(locId);
      if (!existing || new Date(obs.observed_at) > new Date(existing.observed_at)) {
        moistureByLoc.set(locId, obs);
      }
    } else if (typeLower.includes('temp')) {
      const existing = temperatureByLoc.get(locId);
      if (!existing || new Date(obs.observed_at) > new Date(existing.observed_at)) {
        temperatureByLoc.set(locId, obs);
      }
    } else if (typeLower.includes('humid')) {
      const existing = humidityByLoc.get(locId);
      if (!existing || new Date(obs.observed_at) > new Date(existing.observed_at)) {
        humidityByLoc.set(locId, obs);
      }
    }
  }

  // Group risk assessments by location_id (most recent)
  const riskByLoc = new Map<number, RiskAssessmentItem>();
  for (const r of risks) {
    const existing = riskByLoc.get(r.location_id);
    if (!existing || new Date(r.assessed_at) > new Date(existing.assessed_at)) {
      riskByLoc.set(r.location_id, r);
    }
  }

  // Group alerts by location_id (active / most recent)
  const alertByLoc = new Map<number, AlertItem>();
  for (const a of alerts) {
    if (a.location_id) {
      const existing = alertByLoc.get(a.location_id);
      if (!existing || new Date(a.created_at) > new Date(existing.created_at)) {
        alertByLoc.set(a.location_id, a);
      }
    }
  }

  // Assemble composite items
  const compositeLocations: CompositeMapLocation[] = locations.map((loc) => {
    const rf = rainfallByLoc.get(loc.id) || null;
    const sm = moistureByLoc.get(loc.id) || null;
    const temp = temperatureByLoc.get(loc.id) || null;
    const hum = humidityByLoc.get(loc.id) || null;

    // Determine data quality status
    let qualityStatus: DataQualityStatus = 'MISSING';
    const primaryObs = rf || sm || temp;

    if (primaryObs) {
      if (loc.name.includes('[DEMO]') && primaryObs.source.includes('[DEMO]')) {
        qualityStatus = 'DEMO';
      } else if (primaryObs.quality_status) {
        qualityStatus = primaryObs.quality_status;
      } else {
        qualityStatus = 'CURRENT';
      }
    }

    return {
      location: loc,
      latestRainfall: rf,
      latestSoilMoisture: sm,
      latestTemperature: temp,
      latestHumidity: hum,
      riskAssessment: riskByLoc.get(loc.id) || null,
      activeAlert: alertByLoc.get(loc.id) || null,
      weatherQualityStatus: qualityStatus,
    };
  });

  return {
    locations: compositeLocations,
    incidents: incidents,
    communityReports: communityReports,
    totalLocations: locations.length,
    totalIncidents: incidents.length,
    totalCommunityReports: communityReports.length,
    totalRisks: risks.length,
    totalAlerts: alerts.length,
    weatherSummary: weatherRes,
  };
}

// ==========================================
// Phase 6: AI Susceptibility & Warning Engine
// ==========================================

export async function fetchAssessmentExplanation(
  locationId: number
): Promise<ExplainableAssessmentResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/risk-assessments/explain/${locationId}`
  );
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Failed to fetch assessment explanation: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function fetchDataReadinessReport(): Promise<DataReadinessReportResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/risk-assessments/data-readiness`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch data readiness report: HTTP ${response.status}`);
  }
  return response.json();
}

export async function evaluateRiskAssessments(
  locationId?: number
): Promise<EvaluateRiskBatchResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/risk-assessments/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(locationId ? { location_id: locationId } : {}),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Risk assessment evaluation failed: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function evaluateAlertTriggers(
  locationId?: number
): Promise<AlertTriggerEvaluationResponse> {
  const url = locationId
    ? `${API_BASE_URL}/api/v1/alerts/evaluate-triggers?location_id=${locationId}`
    : `${API_BASE_URL}/api/v1/alerts/evaluate-triggers`;

  const response = await fetchWithTimeout(url, { method: 'POST' });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Alert trigger evaluation failed: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function acknowledgeAlert(alertId: number): Promise<AlertItem> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/alerts/${alertId}/acknowledge`,
    {
      method: 'PATCH',
    }
  );
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Failed to acknowledge alert #${alertId}: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function resolveAlert(alertId: number): Promise<AlertItem> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/alerts/${alertId}/resolve`,
    {
      method: 'PATCH',
    }
  );
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Failed to resolve alert #${alertId}: HTTP ${response.status}`
    );
  }
  return response.json();
}

// ==========================================
// Phase 7: Crowdsourcing, Verification & CAP
// ==========================================

export async function fetchUsers(): Promise<UserItem[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/users`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user directory: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchCurrentUser(): Promise<UserItem> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/me`);
  if (!response.ok) {
    throw new Error(`Failed to fetch current user profile: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchIncidentDetails(
  incidentId: number
): Promise<IncidentDetailItem> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/incidents/${incidentId}`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Failed to fetch incident #${incidentId}: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function createCommunityIncident(data: {
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  incident_date?: string;
  severity?: string;
  location_description?: string;
  reporter_name?: string;
  reporter_contact?: string;
  consent_given: boolean;
}): Promise<IncidentItem> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Incident submission failed: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function uploadIncidentAttachment(
  incidentId: number,
  file: File,
  caption?: string
): Promise<IncidentAttachmentItem> {
  const formData = new FormData();
  formData.append('file', file);
  if (caption) {
    formData.append('caption', caption);
  }

  // Notice: no Content-Type header so the browser sets the multipart boundary automatically
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/incidents/${incidentId}/attachments`,
    {
      method: 'POST',
      body: formData,
    }
  );
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Evidence upload failed: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function reviewIncident(
  incidentId: number,
  data: {
    status: string;
    notes?: string;
  }
): Promise<IncidentDetailItem> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/incidents/${incidentId}/review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Field verification action failed: HTTP ${response.status}`
    );
  }
  return response.json();
}

export function getAttachmentDownloadUrl(
  incidentId: number,
  attachmentId: number
): string {
  return `${API_BASE_URL}/api/v1/incidents/${incidentId}/attachments/${attachmentId}`;
}

export async function fetchCapMessages(params?: {
  status?: string;
  alert_type?: string;
  page?: number;
  size?: number;
}): Promise<PaginatedResponse<CapMessageItem>> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.alert_type) query.set('alert_type', params.alert_type);
  query.set('page', String(params?.page || 1));
  query.set('size', String(params?.size || 50));

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/cap?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch CAP alerts: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchCapMessageDetails(id: number): Promise<CapMessageItem> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/cap/${id}`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Failed to fetch CAP message #${id}: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function createCapDraft(data: {
  location_id: number;
  risk_assessment_id?: number;
  alert_type?: string;
  event: string;
  headline: string;
  description: string;
  instruction?: string;
  urgency?: string;
  severity?: string;
  certainty?: string;
  area_desc: string;
  circle_radius_km?: number;
}): Promise<CapMessageItem> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/cap/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Failed to draft CAP alert: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function previewCapXml(id: number): Promise<CapXmlPreviewItem> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/cap/${id}/preview`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Failed to generate CAP XML preview: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function requestCapApproval(
  id: number,
  notes?: string
): Promise<CapMessageItem> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/cap/${id}/request-approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notes ? { notes } : {}),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Failed to request CAP approval: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function approveCapMessage(
  id: number,
  notes?: string
): Promise<CapMessageItem> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/cap/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notes ? { notes } : {}),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Failed to approve CAP message: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function exportCapMessage(id: number): Promise<CapExportResult> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/cap/${id}/export`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Failed to export CAP message: HTTP ${response.status}`
    );
  }
  return response.json();
}

export async function cancelCapMessage(
  id: number,
  reason: string
): Promise<CapMessageItem> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/cap/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Failed to cancel CAP message: HTTP ${response.status}`
    );
  }
  return response.json();
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Upload,
  UserCheck,
  Search,
  Eye,
  Camera,
  MapPin,
  ExternalLink,
  ChevronRight,
  Info,
  RefreshCw,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import {
  fetchIncidents,
  fetchIncidentDetails,
  createCommunityIncident,
  uploadIncidentAttachment,
  reviewIncident,
  fetchUsers,
  getActiveUser,
  setActiveUser,
  getAttachmentDownloadUrl,
} from '../services/api';
import {
  IncidentItem,
  IncidentDetailItem,
  UserItem,
} from '../types';

interface FieldReportsPageProps {
  onReturnToOverview?: () => void;
  onNavigateToRiskMap?: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'rockfall', label: 'Rockfall / Boulders' },
  { value: 'debris_flow', label: 'Debris Flow / Torrent' },
  { value: 'shallow_landslide', label: 'Shallow Landslide' },
  { value: 'mudslide', label: 'Mudslide / Silt Runoff' },
  { value: 'tension_cracks', label: 'Tension Cracks / Ground Fissures' },
  { value: 'road_blockage', label: 'Road / Highway Blockage' },
  { value: 'slope_subsidence', label: 'Slope Subsidence / Bulging' },
];

const PRESET_COORDINATES = [
  { label: 'Wayanad, KL', lat: 11.5273, lon: 76.1042 },
  { label: 'Joshimath, UK', lat: 30.5574, lon: 79.5668 },
  { label: 'Shimla, HP', lat: 31.1048, lon: 77.1734 },
  { label: 'Darjeeling, WB', lat: 27.0410, lon: 88.2663 },
  { label: 'Munnar, KL', lat: 10.0889, lon: 77.0595 },
  { label: 'Lonavala, MH', lat: 18.7557, lon: 73.4091 },
];

export const FieldReportsPage: React.FC<FieldReportsPageProps> = ({
  onReturnToOverview,
  onNavigateToRiskMap,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'submit'>('queue');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [currentUser, setCurrentUserState] = useState<UserItem | null>(null);

  // Feed & Queue State
  const [reports, setReports] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Detail Modal
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [reportDetail, setReportDetail] = useState<IncidentDetailItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Review Form State
  const [reviewStatus, setReviewStatus] = useState<string>('under_review');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Attachment Upload State inside modal
  const [newAttachmentFile, setNewAttachmentFile] = useState<File | null>(null);
  const [attachmentCaption, setAttachmentCaption] = useState<string>('');
  const [uploadingAttachment, setUploadingAttachment] = useState<boolean>(false);

  // Submission Form State
  const [formCategory, setFormCategory] = useState<string>('debris_flow');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formLatitude, setFormLatitude] = useState<string>('30.5574');
  const [formLongitude, setFormLongitude] = useState<string>('79.5668');
  const [formLocationDesc, setFormLocationDesc] = useState<string>('');
  const [formSeverity, setFormSeverity] = useState<string>('moderate');
  const [formReporterName, setFormReporterName] = useState<string>('');
  const [formReporterContact, setFormReporterContact] = useState<string>('');
  const [formConsent, setFormConsent] = useState<boolean>(true);
  const [formFile, setFormFile] = useState<File | null>(null);
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);

  // 1. Load users and restore or set default user
  useEffect(() => {
    fetchUsers()
      .then((data) => {
        setUsers(data);
        const stored = getActiveUser();
        if (stored) {
          const match = data.find((u) => u.id === stored.id);
          if (match) {
            setCurrentUserState(match);
            setActiveUser(match);
            return;
          }
        }
        if (data.length > 0) {
          setCurrentUserState(data[0]);
          setActiveUser(data[0]);
        }
      })
      .catch((err) => {
        console.warn('Could not load user directory:', err);
      });
  }, []);

  // Update user selection
  const handleUserChange = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setCurrentUserState(user);
      setActiveUser(user);
    }
  };

  // 2. Load Community Reports
  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchIncidents({
        is_community_report: true,
        size: 100,
      });
      setReports(res.items || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to retrieve crowdsourced reports.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // 3. Load Detail for modal
  const openReportDetail = async (id: number) => {
    setSelectedReportId(id);
    setDetailLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const detail = await fetchIncidentDetails(id);
      setReportDetail(detail);
      setReviewStatus(
        detail.review_status === 'pending_review' || detail.review_status === 'submitted'
          ? 'under_review'
          : detail.review_status
      );
      setReviewNotes('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to load details for report #${id}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeReportDetail = () => {
    setSelectedReportId(null);
    setReportDetail(null);
    setNewAttachmentFile(null);
    setAttachmentCaption('');
  };

  // 4. Submit Verification Action
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDetail) return;
    setSubmittingReview(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const updated = await reviewIncident(reportDetail.id, {
        status: reviewStatus,
        notes: reviewNotes.trim() || undefined,
      });
      setReportDetail(updated);
      setSuccessMsg(
        `Report #${updated.id} successfully updated to status "${updated.review_status.toUpperCase()}".`
      );
      await loadReports();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Field verification update failed.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // 5. Upload Attachment in Detail Modal
  const handleUploadAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDetail || !newAttachmentFile) return;

    if (newAttachmentFile.size > 5 * 1024 * 1024) {
      setError('File exceeds maximum allowable size of 5 MB.');
      return;
    }

    setUploadingAttachment(true);
    setError(null);
    try {
      await uploadIncidentAttachment(
        reportDetail.id,
        newAttachmentFile,
        attachmentCaption.trim() || undefined
      );
      setNewAttachmentFile(null);
      setAttachmentCaption('');
      setSuccessMsg('Evidence attachment uploaded and verified successfully.');
      // Refresh details
      const refreshed = await fetchIncidentDetails(reportDetail.id);
      setReportDetail(refreshed);
      await loadReports();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Evidence upload failed.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  // 6. Submit New Community Incident Report
  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const lat = parseFloat(formLatitude);
    const lon = parseFloat(formLongitude);

    if (isNaN(lat) || isNaN(lon)) {
      setError('Latitude and longitude must be valid floating-point coordinates.');
      return;
    }

    if (lat < 8.0 || lat > 37.5 || lon < 68.0 || lon > 97.5) {
      setError('Coordinates must fall within the sovereign territory of India (lat 8.0°-37.5°N, lon 68.0°-97.5°E).');
      return;
    }

    if (!formDescription.trim()) {
      setError('Detailed observation description is required.');
      return;
    }

    if (!formConsent) {
      setError('You must consent to data retention for hazard monitoring and public safety.');
      return;
    }

    setSubmittingReport(true);
    try {
      const created = await createCommunityIncident({
        category: formCategory,
        description: formDescription.trim(),
        latitude: lat,
        longitude: lon,
        location_description: formLocationDesc.trim() || undefined,
        severity: formSeverity,
        reporter_name: formReporterName.trim() || currentUser?.display_name || undefined,
        reporter_contact: formReporterContact.trim() || currentUser?.email || undefined,
        consent_given: formConsent,
      });

      // Upload file if selected
      if (formFile) {
        if (formFile.size <= 5 * 1024 * 1024) {
          try {
            await uploadIncidentAttachment(created.id, formFile, 'Initial field submission');
          } catch (fileErr) {
            console.warn('Initial evidence upload error:', fileErr);
          }
        }
      }

      setSuccessMsg(
        `Community hazard report #${created.id} submitted successfully! It is now pending field review.`
      );
      // Reset form
      setFormDescription('');
      setFormLocationDesc('');
      setFormFile(null);
      setActiveTab('queue');
      await loadReports();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit community report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  // Metrics computation
  const totalCount = reports.length;
  const pendingCount = reports.filter(
    (r) => r.review_status === 'pending_review' || r.review_status === 'submitted'
  ).length;
  const underReviewCount = reports.filter((r) => r.review_status === 'under_review').length;
  const verifiedCount = reports.filter((r) => r.review_status === 'verified').length;
  const rejectedCount = reports.filter(
    (r) => r.review_status === 'rejected' || r.review_status === 'needs_more_info'
  ).length;

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        if (r.review_status !== 'pending_review' && r.review_status !== 'submitted') return false;
      } else if (r.review_status !== statusFilter) {
        return false;
      }
    }
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = r.description.toLowerCase().includes(q);
      const matchCat = r.category.toLowerCase().includes(q);
      const matchLoc = (r.location_description || '').toLowerCase().includes(q);
      const matchRep = (r.reporter_name || '').toLowerCase().includes(q);
      if (!matchDesc && !matchCat && !matchLoc && !matchRep) return false;
    }
    return true;
  });

  // User permission helper
  const isReviewerRole =
    currentUser && ['observer', 'ddma_officer', 'admin'].includes(currentUser.role);
  const isSelfReporter =
    reportDetail && currentUser && reportDetail.reporter_user_id === currentUser.id;
  const isSelfApprovalBlocked = isSelfReporter && currentUser?.role !== 'admin';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Community Crowdsourcing & Field Verification
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-teal-100 text-teal-800 border border-teal-300">
              Phase 7 Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Audited crowdsourced geohazard intake, tamper-evident evidence upload, and role-based field verification workflow.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {onReturnToOverview && (
            <button
              onClick={onReturnToOverview}
              className="inline-flex items-center space-x-1 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
          )}

          {onNavigateToRiskMap && (
            <button
              onClick={onNavigateToRiskMap}
              className="inline-flex items-center space-x-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>GIS Map</span>
            </button>
          )}

          {/* Identity & Role Selector */}
          <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center space-x-3 text-xs">
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400">Active Identity:</span>
                <span className="font-mono text-[11px] font-semibold text-slate-800">
                  {currentUser?.display_name || 'Loading...'}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <select
                  value={currentUser?.id || ''}
                  onChange={(e) => handleUserChange(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name} ({u.role.toUpperCase()})
                    </option>
                  ))}
                </select>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                    currentUser?.role === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : currentUser?.role === 'ddma_officer'
                      ? 'bg-blue-100 text-blue-800'
                      : currentUser?.role === 'observer'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {currentUser?.role || 'user'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Notice & Disclaimer */}
      <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start space-x-3 text-xs text-amber-900">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold">Prototype Geohazard Telemetry Environment</div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Crowdsourced community submissions undergo multi-stage field review before being promoted to verified hazard catalogs. For imminent life-threatening emergencies, call official national dispatchers directly at <strong>NDRF (1078)</strong> or <strong>SDMA (1070)</strong>.
          </p>
        </div>
      </div>

      {/* Global Alerts / Messages */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-800 font-bold ml-2 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-800 font-bold ml-2 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Stat Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Total Submissions</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{totalCount}</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-amber-700">Pending Review</div>
          <div className="text-xl font-black text-amber-900 mt-0.5">{pendingCount}</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-orange-200 bg-orange-50/20 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-orange-700">Under Review</div>
          <div className="text-xl font-black text-orange-900 mt-0.5">{underReviewCount}</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-teal-200 bg-teal-50/20 shadow-2xs">
          <div className="text-[10px] font-bold uppercase text-teal-700">Field Verified</div>
          <div className="text-xl font-black text-teal-900 mt-0.5">{verifiedCount}</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[10px] font-bold uppercase text-slate-500">Rejected / Needs Info</div>
          <div className="text-xl font-black text-slate-700 mt-0.5">{rejectedCount}</div>
        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div className="border-b border-slate-200 flex items-center space-x-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('queue')}
          className={`pb-3 flex items-center space-x-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'queue'
              ? 'border-teal-600 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Incident Feed & Verification Desk ({filteredReports.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('submit')}
          className={`pb-3 flex items-center space-x-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'submit'
              ? 'border-teal-600 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Submit Hazard Report (Citizen Intake)</span>
        </button>
      </div>

      {/* TAB 1: INCIDENT FEED & VERIFICATION QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center flex-wrap gap-2.5">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium cursor-pointer"
                >
                  <option value="all">All Statuses ({totalCount})</option>
                  <option value="pending">Pending Review ({pendingCount})</option>
                  <option value="under_review">Under Review ({underReviewCount})</option>
                  <option value="verified">Verified ({verifiedCount})</option>
                  <option value="rejected">Rejected</option>
                  <option value="needs_more_info">Needs Info</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">Hazard Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium cursor-pointer"
                >
                  <option value="all">All Hazard Types</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Search reports or landmarks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 w-52 sm:w-64"
                />
              </div>

              <button
                onClick={loadReports}
                disabled={loading}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                title="Refresh Report Queue"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Report Cards Feed */}
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-600 mb-2" />
              Loading crowdsourced community reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-white rounded-xl border border-slate-200 space-y-2">
              <Info className="w-6 h-6 text-slate-400 mx-auto" />
              <div className="font-semibold text-slate-700">No community hazard reports found.</div>
              <p className="text-slate-500">
                Try clearing active filters or submit a new citizen observation using the tab above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReports.map((item) => {
                const isVerified = item.review_status === 'verified';
                const isUnderReview = item.review_status === 'under_review';
                const isRejected = item.review_status === 'rejected';

                let statusBadge = (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                    Pending Review
                  </span>
                );
                if (isVerified) {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-100 text-teal-800 border border-teal-300 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                      <span>Verified</span>
                    </span>
                  );
                } else if (isUnderReview) {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-100 text-orange-800 border border-orange-300 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-orange-600" />
                      <span>Under Review</span>
                    </span>
                  );
                } else if (isRejected) {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300">
                      Rejected
                    </span>
                  );
                }

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3 text-xs hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] font-bold text-slate-500">
                          #{item.id} &bull; {item.category.replace('_', ' ').toUpperCase()}
                        </span>
                        {statusBadge}
                      </div>

                      <p className="text-slate-800 font-medium line-clamp-3 leading-relaxed">
                        {item.description}
                      </p>

                      {item.location_description && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 flex items-start space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{item.location_description}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Reporter: {item.reporter_name || 'Anonymous'}</span>
                        <span className="font-mono">
                          {item.latitude.toFixed(3)}°N, {item.longitude.toFixed(3)}°E
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                          <span>
                            {new Date(item.reported_at).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          {item.attachment_count && item.attachment_count > 0 ? (
                            <span className="text-blue-600 font-medium flex items-center space-x-0.5">
                              <Camera className="w-3 h-3" />
                              <span>{item.attachment_count} photo(s)</span>
                            </span>
                          ) : null}
                        </div>

                        <button
                          onClick={() => openReportDetail(item.id)}
                          className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-semibold text-[11px] flex items-center space-x-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect & Verify</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CITIZEN INTAKE SUBMISSION FORM */}
      {activeTab === 'submit' && (
        <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 sm:p-7 space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Submit Community Landslide Observation
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Provide ground telemetry, approximate landmarks, and optional photographic evidence to alert district monitoring desks.
            </p>
          </div>

          <form onSubmit={handleCreateReport} className="space-y-5 text-xs">
            {/* Category & Severity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Hazard Phenomenon *</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-xs focus:ring-2 focus:ring-teal-500"
                  required
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Estimated Visual Severity</label>
                <select
                  value={formSeverity}
                  onChange={(e) => setFormSeverity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-xs focus:ring-2 focus:ring-teal-500"
                >
                  <option value="low">Low (Minor debris, road shoulder silt)</option>
                  <option value="moderate">Moderate (Partial road lane blockage, tension cracks)</option>
                  <option value="high">High (Active slope failure, major highway blocked)</option>
                  <option value="critical">Critical (Imminent slope collapse, settlement threatened)</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Detailed Hazard Observation *
              </label>
              <textarea
                rows={4}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe visible ground cracking, water discharging from slope, falling rocks, affected roads or settlements..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800 text-xs focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            {/* Coordinates & Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">Geographic Coordinates (India) *</label>
                <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                  <span>Fast presets:</span>
                  {PRESET_COORDINATES.map((p) => (
                    <button
                      type="button"
                      key={p.label}
                      onClick={() => {
                        setFormLatitude(String(p.lat));
                        setFormLongitude(String(p.lon));
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">Latitude (°N, 8.0 - 37.5)</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={formLatitude}
                    onChange={(e) => setFormLatitude(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">Longitude (°E, 68.0 - 97.5)</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={formLongitude}
                    onChange={(e) => setFormLongitude(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-xs font-mono"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Landmark / Location Description */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Approximate Landmark / Milepost / Village
              </label>
              <input
                type="text"
                value={formLocationDesc}
                onChange={(e) => setFormLocationDesc(e.target.value)}
                placeholder="e.g. Near NH-58 km 42, 200m uphill from Alaknanda bridge, Joshimath"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-xs"
              />
            </div>

            {/* Reporter Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Reporter Name (Optional)</label>
                <input
                  type="text"
                  value={formReporterName}
                  onChange={(e) => setFormReporterName(e.target.value)}
                  placeholder={currentUser?.display_name || 'Citizen Observer'}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Contact Phone / Email</label>
                <input
                  type="text"
                  value={formReporterContact}
                  onChange={(e) => setFormReporterContact(e.target.value)}
                  placeholder={currentUser?.email || 'citizen@example.com'}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-xs"
                />
              </div>
            </div>

            {/* Photo / Evidence Upload */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Field Photo / Evidence Attachment (Max 5 MB, JPG/PNG/WEBP/PDF)
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFormFile(e.target.files[0]);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">
                Uploaded files are checked against magic signature bytes and stored in an isolated, secure filesystem path.
              </span>
            </div>

            {/* Consent Checkbox */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="flex items-start space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formConsent}
                  onChange={(e) => setFormConsent(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 mt-0.5 w-4 h-4 cursor-pointer"
                  required
                />
                <span className="text-[11px] text-slate-700 leading-relaxed select-none">
                  <strong>Data Privacy & Accuracy Consent:</strong> I confirm this submission represents an authentic ground observation and consent to storing this data for geohazard monitoring, verification audits, and public safety.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submittingReport}
                className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
              >
                {submittingReport ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting Report...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Transmit Incident Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DETAIL & VERIFICATION MODAL */}
      {selectedReportId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold text-slate-900">
                    Incident Audit #{selectedReportId}
                  </span>
                  {reportDetail && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        reportDetail.review_status === 'verified'
                          ? 'bg-teal-100 text-teal-800'
                          : reportDetail.review_status === 'under_review'
                          ? 'bg-orange-100 text-orange-800'
                          : reportDetail.review_status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {reportDetail.review_status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-stage field verification and tamper-evident audit history
                </p>
              </div>

              <button
                onClick={closeReportDetail}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {detailLoading || !reportDetail ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-600 mb-2" />
                Retrieving incident details, evidence attachments, and review log...
              </div>
            ) : (
              <div className="space-y-5 text-xs">
                {/* Description & Category */}
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-700 uppercase tracking-wide text-[11px]">
                    Category: {reportDetail.category.replace('_', ' ').toUpperCase()}
                  </div>
                  <p className="text-slate-800 text-xs leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {reportDetail.description}
                  </p>
                </div>

                {/* Spatial & Reporter Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Coordinates:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {reportDetail.latitude.toFixed(4)}°N, {reportDetail.longitude.toFixed(4)}°E
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Reported Timestamp:</span>
                    <span className="text-slate-800 font-medium">
                      {new Date(reportDetail.reported_at).toLocaleString('en-IN', { timeZone: 'UTC' })} UTC
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Reporter:</span>
                    <span className="text-slate-800 font-medium">
                      {reportDetail.reporter_name || 'Anonymous Citizen'}
                      {reportDetail.reporter_contact ? ` (${reportDetail.reporter_contact})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Landmark:</span>
                    <span className="text-slate-800 font-medium">
                      {reportDetail.location_description || 'No landmark provided'}
                    </span>
                  </div>
                </div>

                {/* Evidence Attachments Gallery */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] flex items-center space-x-1.5">
                      <Camera className="w-3.5 h-3.5 text-teal-600" />
                      <span>Evidence Attachments ({reportDetail.attachments?.length || 0})</span>
                    </span>
                  </div>

                  {reportDetail.attachments && reportDetail.attachments.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {reportDetail.attachments.map((att) => {
                        const isImage = att.mime_type.startsWith('image/');
                        const downloadUrl = getAttachmentDownloadUrl(reportDetail.id, att.id);

                        return (
                          <div
                            key={att.id}
                            className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 flex flex-col justify-between"
                          >
                            {isImage ? (
                              <div className="w-full h-24 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                                <img
                                  src={downloadUrl}
                                  alt={att.original_filename}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // Fallback if image fails to load
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="w-full h-24 bg-slate-200 rounded flex items-center justify-center text-slate-500 font-mono text-[10px]">
                                PDF Document
                              </div>
                            )}

                            <div>
                              <div className="text-[11px] font-semibold text-slate-800 truncate" title={att.original_filename}>
                                {att.original_filename}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {(att.file_size_bytes / 1024).toFixed(1)} KB &bull; {att.mime_type.split('/')[1]?.toUpperCase()}
                              </div>
                              {att.caption && (
                                <div className="text-[10px] text-slate-600 italic mt-0.5">
                                  "{att.caption}"
                                </div>
                              )}
                            </div>

                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1 text-[10px] font-semibold text-teal-700 hover:text-teal-900 pt-1 border-t border-slate-200/60"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>View Full Size</span>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-[11px] italic">
                      No photographic or document evidence attached to this report.
                    </div>
                  )}

                  {/* Upload new attachment to existing report */}
                  <form onSubmit={handleUploadAttachment} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <span className="font-semibold text-slate-700 block text-[11px]">
                      Attach Supplementary Ground Evidence
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setNewAttachmentFile(e.target.files[0]);
                          }
                        }}
                        className="text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        placeholder="Caption (optional)"
                        value={attachmentCaption}
                        onChange={(e) => setAttachmentCaption(e.target.value)}
                        className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 flex-1"
                      />
                      <button
                        type="submit"
                        disabled={!newAttachmentFile || uploadingAttachment}
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        {uploadingAttachment ? 'Uploading...' : 'Upload'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Role-Gated Field Verification Action Box */}
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] flex items-center space-x-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      <span>Authorized Verification Desk</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Acting Role: {currentUser?.role?.toUpperCase() || 'ANONYMOUS'}
                    </span>
                  </div>

                  {!isReviewerRole ? (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      <strong>Audit Privilege Required:</strong> Your active user profile ({currentUser?.display_name || 'Citizen'}) is in Observer/Citizen read-only mode. Switch to a Field Observer, DDMA Officer, or Administrator profile in the top-right toolbar to perform verification transitions.
                    </div>
                  ) : isSelfApprovalBlocked ? (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Self-Approval Safeguard Active:</strong> You submitted this incident report (#{reportDetail.id}). Under disaster audit protocol, the original reporter cannot self-verify their own submission. Another field observer, DDMA officer, or system administrator must conduct this review.
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleReviewSubmit} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Verification Decision *</label>
                          <select
                            value={reviewStatus}
                            onChange={(e) => setReviewStatus(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 text-xs font-semibold cursor-pointer"
                          >
                            <option value="under_review">Mark Under Field Review</option>
                            <option value="verified">Verified (Confirm Genuine Landslide / Hazard)</option>
                            <option value="needs_more_info">Needs More Info (Request clarification)</option>
                            <option value="rejected">Rejected (False Alarm / Duplicate / Non-Hazard)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Field Review Notes / Justification</label>
                          <textarea
                            rows={2}
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="Add inspection notes, verification methodology, or reason for rejection..."
                            className="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end space-x-2 pt-1">
                        <button
                          type="submit"
                          disabled={submittingReview}
                          className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {submittingReview ? 'Committing Review...' : 'Commit Verification Status'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Audit History Log Timeline */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] block">
                    Verification Audit History ({reportDetail.review_logs?.length || 0})
                  </span>

                  {reportDetail.review_logs && reportDetail.review_logs.length > 0 ? (
                    <div className="space-y-2">
                      {reportDetail.review_logs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-700 font-semibold">
                            <span>
                              {log.reviewer_name} ({log.reviewer_role.toUpperCase()})
                            </span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'UTC' })} UTC
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-slate-600">
                            <span className="font-mono text-slate-500 uppercase">{log.from_status}</span>
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                            <span className="font-mono font-bold text-teal-700 uppercase">
                              {log.to_status}
                            </span>
                            <span className="text-slate-400">&bull; Action: {log.action}</span>
                          </div>
                          {log.notes && (
                            <p className="text-slate-700 italic bg-white p-1.5 rounded border border-slate-200/80">
                              "{log.notes}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-500 text-[11px] italic">
                      No review actions recorded yet. Initial submission state.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldReportsPage;

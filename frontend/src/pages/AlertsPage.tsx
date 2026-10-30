import React, { useState, useEffect, useCallback } from 'react';
import {
  BellRing,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Filter,
  Check,
  Activity,
  ArrowLeft,
  MapPin,
  FileCode,
  FileText,
  Send,
  XCircle,
  Copy,
  Radio,
  PlusCircle,
} from 'lucide-react';
import {
  fetchAlerts,
  evaluateAlertTriggers,
  acknowledgeAlert,
  resolveAlert,
  fetchCapMessages,
  createCapDraft,
  previewCapXml,
  requestCapApproval,
  approveCapMessage,
  exportCapMessage,
  cancelCapMessage,
  fetchLocations,
  getActiveUser,
} from '../services/api';
import {
  AlertItem,
  AlertTriggerEvaluationResponse,
  CapMessageItem,
  CapXmlPreviewItem,
  CapExportResult,
  LocationItem,
} from '../types';

interface AlertsPageProps {
  onReturnToOverview?: () => void;
  onNavigateToRiskMap?: () => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  onReturnToOverview,
  onNavigateToRiskMap,
}) => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'cap'>('alerts');

  // Phase 6 Early Warnings State
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lastEvalResult, setLastEvalResult] =
    useState<AlertTriggerEvaluationResponse | null>(null);

  // Phase 7 CAP Workflow State
  const [capMessages, setCapMessages] = useState<CapMessageItem[]>([]);
  const [capLoading, setCapLoading] = useState<boolean>(false);
  const [capStatusFilter, setCapStatusFilter] = useState<string>('all');
  const [capActionId, setCapActionId] = useState<number | null>(null);

  // Modals
  const [xmlPreviewModal, setXmlPreviewModal] = useState<CapXmlPreviewItem | null>(null);
  const [exportReceiptModal, setExportReceiptModal] = useState<CapExportResult | null>(null);
  const [showDraftModal, setShowDraftModal] = useState<boolean>(false);
  const [cancellingCapId, setCancellingCapId] = useState<number | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState<string>('');

  // Draft Form State
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [draftLocationId, setDraftLocationId] = useState<number | ''>('');
  const [draftEvent, setDraftEvent] = useState<string>('Landslide Hazard Warning');
  const [draftHeadline, setDraftHeadline] = useState<string>('Severe Slope Saturation & Landslide Warning');
  const [draftDescription, setDraftDescription] = useState<string>(
    'Intense cumulative precipitation has exceeded the empirical stability threshold. Ground displacement and high debris flow hazard expected.'
  );
  const [draftInstruction, setDraftInstruction] = useState<string>(
    'Evacuate high-risk valley floors and steep cut-slopes. Avoid arterial roads along landslide corridors.'
  );
  const [draftAreaDesc, setDraftAreaDesc] = useState<string>('District slope sector');
  const [draftRadiusKm, setDraftRadiusKm] = useState<number>(10);
  const [submittingDraft, setSubmittingDraft] = useState<boolean>(false);

  // Shared Notifications
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedXml, setCopiedXml] = useState<boolean>(false);

  const currentUser = getActiveUser();

  // 1. Load Phase 6 Alerts
  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAlerts({ size: 100 });
      setAlerts(res.items || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to retrieve early warning alert feed.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Load Phase 7 CAP Alerts
  const loadCapMessages = useCallback(async () => {
    setCapLoading(true);
    setError(null);
    try {
      const res = await fetchCapMessages({ size: 100 });
      setCapMessages(res.items || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to retrieve CAP dispatches.'
      );
    } finally {
      setCapLoading(false);
    }
  }, []);

  // 3. Load Locations for Drafting
  useEffect(() => {
    fetchLocations({ size: 100 })
      .then((res) => {
        setLocations(res.items || []);
        if (res.items && res.items.length > 0) {
          setDraftLocationId(res.items[0].id);
          setDraftAreaDesc(`${res.items[0].name}, ${res.items[0].district}, ${res.items[0].state}`);
        }
      })
      .catch((err) => console.warn('Could not load locations for drafting:', err));
  }, []);

  useEffect(() => {
    if (activeTab === 'alerts') {
      loadAlerts();
    } else {
      loadCapMessages();
    }
  }, [activeTab, loadAlerts, loadCapMessages]);

  // Handle location change in draft modal
  const handleDraftLocationSelect = (locId: number) => {
    setDraftLocationId(locId);
    const loc = locations.find((l) => l.id === locId);
    if (loc) {
      setDraftAreaDesc(`${loc.name}, ${loc.district}, ${loc.state}`);
      setDraftHeadline(`Landslide Early Warning for ${loc.name}`);
    }
  };

  // Evaluate warning triggers
  const handleEvaluateTriggers = async () => {
    setEvaluating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await evaluateAlertTriggers();
      setLastEvalResult(res);
      setSuccessMessage(
        `Trigger evaluation complete: ${res.alerts_issued} new alert(s) issued, ${res.alerts_suppressed} suppressed by anti-flapping safeguards.`
      );
      await loadAlerts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Warning trigger evaluation failed.');
    } finally {
      setEvaluating(false);
    }
  };

  // Acknowledge alert
  const handleAcknowledge = async (alertId: number) => {
    setActionInProgress(alertId);
    setError(null);
    try {
      await acknowledgeAlert(alertId);
      setSuccessMessage(`Alert #${alertId} successfully acknowledged by authorized desk.`);
      await loadAlerts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to acknowledge alert #${alertId}`);
    } finally {
      setActionInProgress(null);
    }
  };

  // Resolve alert
  const handleResolve = async (alertId: number) => {
    setActionInProgress(alertId);
    setError(null);
    try {
      await resolveAlert(alertId);
      setSuccessMessage(`Alert #${alertId} marked as resolved.`);
      await loadAlerts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to resolve alert #${alertId}`);
    } finally {
      setActionInProgress(null);
    }
  };

  // ==========================================
  // CAP Actions
  // ==========================================

  const handlePreviewXml = async (id: number) => {
    setError(null);
    try {
      const preview = await previewCapXml(id);
      setXmlPreviewModal(preview);
      setCopiedXml(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to generate CAP XML preview.`);
    }
  };

  const handleRequestApproval = async (id: number) => {
    setCapActionId(id);
    setError(null);
    try {
      await requestCapApproval(id, 'Requested desk approval via operational console.');
      setSuccessMessage(`CAP Alert #${id} promoted to PENDING_APPROVAL status.`);
      await loadCapMessages();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Approval request failed.`);
    } finally {
      setCapActionId(null);
    }
  };

  const handleApproveCap = async (id: number) => {
    setCapActionId(id);
    setError(null);
    try {
      await approveCapMessage(id, 'Approved by operational officer following risk verification.');
      setSuccessMessage(`CAP Alert #${id} officially APPROVED. Ready for simulated export.`);
      await loadCapMessages();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Approval failed. Check data freshness requirements.`);
    } finally {
      setCapActionId(null);
    }
  };

  const handleExportCap = async (id: number) => {
    setCapActionId(id);
    setError(null);
    try {
      const res = await exportCapMessage(id);
      setExportReceiptModal(res);
      setSuccessMessage(`CAP Alert ${res.identifier} simulated export dispatched successfully.`);
      await loadCapMessages();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Simulated export failed.`);
    } finally {
      setCapActionId(null);
    }
  };

  const handleCancelCapConfirm = async () => {
    if (!cancellingCapId) return;
    if (!cancelReasonText.trim()) {
      setError('A cancellation reason is required to withdraw a public warning.');
      return;
    }

    setCapActionId(cancellingCapId);
    setError(null);
    try {
      await cancelCapMessage(cancellingCapId, cancelReasonText.trim());
      setSuccessMessage(`CAP Alert #${cancellingCapId} successfully CANCELLED and referenced.`);
      setCancellingCapId(null);
      setCancelReasonText('');
      await loadCapMessages();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to cancel CAP alert.`);
    } finally {
      setCapActionId(null);
    }
  };

  const handleCreateCapDraftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftLocationId) {
      setError('Please select a monitored location.');
      return;
    }

    setSubmittingDraft(true);
    setError(null);
    try {
      const created = await createCapDraft({
        location_id: Number(draftLocationId),
        event: draftEvent.trim(),
        headline: draftHeadline.trim(),
        description: draftDescription.trim(),
        instruction: draftInstruction.trim() || undefined,
        area_desc: draftAreaDesc.trim(),
        circle_radius_km: draftRadiusKm,
      });

      setSuccessMessage(`CAP draft alert ${created.identifier} created successfully!`);
      setShowDraftModal(false);
      await loadCapMessages();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create CAP draft. Verify that station risk data is CURRENT and sufficient.'
      );
    } finally {
      setSubmittingDraft(false);
    }
  };

  // Filter alerts
  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity.toLowerCase() !== severityFilter) {
      return false;
    }
    if (statusFilter !== 'all' && a.status.toLowerCase() !== statusFilter) {
      return false;
    }
    return true;
  });

  const filteredCapMessages = capMessages.filter((m) => {
    if (capStatusFilter !== 'all' && m.dispatch_status !== capStatusFilter) {
      return false;
    }
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'extreme':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'high':
      case 'severe':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'moderate':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'low':
      case 'minor':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'issued':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'acknowledged':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'resolved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getCapStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'EXPORTED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'PENDING_APPROVAL':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'CANCELLED':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'VALIDATED':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  const activeIssuedCount = alerts.filter((a) => a.status === 'issued').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Early Warning &amp; CAP Dispatches
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Phases 6–7 Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Automated anti-flapping early warnings and OASIS CAP v1.2 standardized dispatches.
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

          {activeTab === 'alerts' ? (
            <>
              <button
                onClick={handleEvaluateTriggers}
                disabled={evaluating}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
                <span>{evaluating ? 'Evaluating...' : 'Evaluate Triggers'}</span>
              </button>

              <button
                onClick={loadAlerts}
                disabled={loading}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowDraftModal(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Draft New CAP Alert</span>
              </button>

              <button
                onClick={loadCapMessages}
                disabled={capLoading}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${capLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div className="border-b border-slate-200 flex items-center space-x-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`pb-3 flex items-center space-x-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'alerts'
              ? 'border-rose-600 text-rose-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BellRing className="w-4 h-4" />
          <span>Operational Early Warnings ({alerts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cap')}
          className={`pb-3 flex items-center space-x-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'cap'
              ? 'border-indigo-600 text-indigo-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Common Alerting Protocol (CAP v1.2) ({capMessages.length})</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            OASIS Standard
          </span>
        </button>
      </div>

      {/* Global Feedback Banners */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold text-xs text-rose-600 cursor-pointer">
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
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-xs text-emerald-600 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: OPERATIONAL EARLY WARNINGS (PHASE 6)             */}
      {/* ======================================================== */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Anti-Flapping Safeguard Status Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-[11px] uppercase">Cooldown Window</span>
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="font-mono font-bold text-slate-900 text-sm">6 Hours Strict</div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Prevents alert fatigue by throttling repeated warnings for the same station.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-[11px] uppercase">Fingerprint Hash</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="font-mono font-bold text-slate-900 text-sm">Deterministic SHA</div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Hashes location, severity tier, and calendar date to enforce deduplication.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-[11px] uppercase">Data Gate Rule</span>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="font-mono font-bold text-slate-900 text-sm">Missing = Suppressed</div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Stations with missing or stale telemetry (&gt;3h) are suppressed from dispatch.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-[11px] uppercase">Escalation Override</span>
                <Activity className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="font-mono font-bold text-rose-700 text-sm">Critical Unlocked</div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Critical life-safety escalations bypass active High cooldown windows.
              </p>
            </div>
          </div>

          {/* Automated Evaluation Diagnostics */}
          {lastEvalResult && (
            <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-indigo-950 uppercase text-[11px]">
                    Latest Warning Evaluation Diagnostics
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {new Date(lastEvalResult.evaluated_at).toUTCString()}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center py-1">
                <div className="p-2 rounded bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">Stations Evaluated</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">{lastEvalResult.evaluated_locations}</span>
                </div>
                <div className="p-2 rounded bg-rose-50 border border-rose-200">
                  <span className="text-[10px] text-rose-600 uppercase block">Alerts Dispatched</span>
                  <span className="font-mono font-bold text-rose-800 text-sm">{lastEvalResult.alerts_issued}</span>
                </div>
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 uppercase block">Suppressed</span>
                  <span className="font-mono font-bold text-emerald-800 text-sm">{lastEvalResult.alerts_suppressed}</span>
                </div>
              </div>
            </div>
          )}

          {/* Filter Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700 flex items-center space-x-1">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Filter Feed:</span>
              </span>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium cursor-pointer"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical Urgency</option>
                <option value="high">High Risk</option>
                <option value="moderate">Moderate Watch</option>
                <option value="low">Low Advisory</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="issued">Issued (Pending Desk Action)</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div className="flex items-center space-x-3 text-slate-500 text-[11px]">
              <span>Total: <strong className="text-slate-800 font-mono">{alerts.length}</strong></span>
              <span>&bull;</span>
              <span>Active: <strong className="text-rose-700 font-mono">{activeIssuedCount}</strong></span>
              <span>&bull;</span>
              <span>Critical: <strong className="text-rose-800 font-mono">{criticalCount}</strong></span>
            </div>
          </div>

          {/* Alert Items List */}
          <div className="space-y-3">
            {loading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
                <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
                <p>Loading early warning dispatch feed...</p>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-semibold text-slate-700">No early warning alerts match the selected criteria.</p>
                <p className="text-slate-400 text-[11px]">
                  No active landslide hazard warnings or all dispatches resolved.
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const isAcknowledged = alert.status === 'acknowledged';
                const isResolved = alert.status === 'resolved';
                const isCritical = alert.severity === 'critical';
                const isProcessing = actionInProgress === alert.id;

                return (
                  <div
                    key={alert.id}
                    className={`bg-white rounded-xl border shadow-sm p-4 sm:p-5 space-y-3 transition-colors ${
                      isCritical
                        ? 'border-rose-300 ring-1 ring-rose-200/60'
                        : alert.severity === 'high'
                        ? 'border-orange-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getSeverityBadge(
                            alert.severity
                          )}`}
                        >
                          {alert.severity} Urgency
                        </span>

                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getStatusBadge(
                            alert.status
                          )}`}
                        >
                          Status: {alert.status}
                        </span>

                        {alert.location_id && (
                          <span className="text-[10px] font-mono text-slate-500">
                            Station ID #{alert.location_id}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-mono text-slate-500">
                        Dispatched: {new Date(alert.created_at).toLocaleString('en-IN', { timeZone: 'UTC' })} UTC
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        {alert.title}
                      </h3>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                        {alert.description}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1 text-slate-600">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-slate-500">Authorizing Protocol:</span>
                        <span className="font-semibold text-slate-800">{alert.source}</span>
                      </div>
                      {alert.alert_fingerprint && (
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="text-slate-500">Fingerprint:</span>
                          <span className="font-mono text-[10px] text-slate-700">
                            {alert.alert_fingerprint}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Operational Actions */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                      <div className="text-[10px] text-slate-400">
                        Alert ID: #{alert.id}
                      </div>

                      <div className="flex items-center space-x-2">
                        {!isAcknowledged && !isResolved && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={isProcessing}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isProcessing ? 'Processing...' : 'Acknowledge'}</span>
                          </button>
                        )}

                        {!isResolved && (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            disabled={isProcessing}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isProcessing ? 'Resolving...' : 'Mark Resolved'}</span>
                          </button>
                        )}

                        {isResolved && (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 text-xs font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Incident Resolved</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: COMMON ALERTING PROTOCOL (CAP v1.2) DISPATCHES    */}
      {/* ======================================================== */}
      {activeTab === 'cap' && (
        <div className="space-y-4">
          {/* Dispatch Safety Notice */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-start space-x-3 text-xs text-indigo-950">
            <Radio className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <div className="font-bold">
                OASIS Common Alerting Protocol (CAP v1.2 / ITU-T X.1303) — Simulated Export Console
              </div>
              <p className="text-[11px] text-indigo-900 leading-relaxed">
                Standardized disaster early-warning dispatches for inter-agency coordination. Every message is validated against OASIS schema rules. In this environment, alert dispatches are strictly <strong>SIMULATED</strong>: live public broadcasting sirens and emergency carrier alerts are disabled.
              </p>
            </div>
          </div>

          {/* CAP Filter Bar */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-500 font-semibold">Lifecycle Stage:</span>
              <select
                value={capStatusFilter}
                onChange={(e) => setCapStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 font-medium cursor-pointer"
              >
                <option value="all">All Dispatches ({capMessages.length})</option>
                <option value="DRAFT">Drafts</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="EXPORTED">Exported (Simulated)</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="text-[11px] text-slate-500">
              Active Approver Role:{' '}
              <span className="font-mono font-bold text-slate-800 uppercase">
                {currentUser?.role || 'ANONYMOUS'}
              </span>
            </div>
          </div>

          {/* CAP Messages Feed */}
          {capLoading ? (
            <div className="p-10 text-center text-slate-500 text-xs bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
              Loading CAP alert messages...
            </div>
          ) : filteredCapMessages.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-xs bg-white rounded-xl border border-slate-200 space-y-2">
              <FileCode className="w-6 h-6 text-slate-400 mx-auto" />
              <div className="font-semibold text-slate-700">No CAP messages found in this view.</div>
              <p className="text-slate-500">
                Click "Draft New CAP Alert" above to compose a standardized OASIS CAP message.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCapMessages.map((cap) => {
                const isApproved = cap.dispatch_status === 'APPROVED';
                const isPending = cap.dispatch_status === 'PENDING_APPROVAL';
                const isExported = cap.dispatch_status === 'EXPORTED';
                const isCancelled = cap.dispatch_status === 'CANCELLED';
                const isDraft = cap.dispatch_status === 'DRAFT' || cap.dispatch_status === 'VALIDATED';
                const isProcessing = capActionId === cap.id;

                const canApprove =
                  currentUser && ['ddma_officer', 'admin'].includes(currentUser.role);

                return (
                  <div
                    key={cap.id}
                    className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 text-xs"
                  >
                    {/* Header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {cap.identifier}
                        </span>

                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getCapStatusBadge(
                            cap.dispatch_status
                          )}`}
                        >
                          {cap.dispatch_status}
                        </span>

                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getSeverityBadge(
                            cap.severity
                          )}`}
                        >
                          {cap.severity}
                        </span>

                        <span className="text-[10px] font-mono text-slate-500">
                          Type: {cap.msg_type} &bull; Scope: {cap.scope}
                        </span>
                      </div>

                      <span className="text-[11px] font-mono text-slate-500">
                        Sent: {new Date(cap.sent_at).toLocaleString('en-IN', { timeZone: 'UTC' })} UTC
                      </span>
                    </div>

                    {/* Headline and Description */}
                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {cap.headline}
                      </h3>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {cap.description}
                      </p>
                      {cap.instruction && (
                        <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-950 font-medium text-[11px]">
                          <strong>Response Instruction:</strong> {cap.instruction}
                        </div>
                      )}
                    </div>

                    {/* Area and Telemetry Metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-500 block">Designated Area:</span>
                        <span className="font-medium text-slate-800">{cap.area_description}</span>
                        {cap.circle_lat && cap.circle_lon && (
                          <span className="font-mono text-[10px] text-slate-500 block">
                            Circle: {cap.circle_lat.toFixed(4)}°N, {cap.circle_lon.toFixed(4)}°E (r={cap.circle_radius_km}km)
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-500 block">Sender Agency:</span>
                        <span className="font-mono text-[10px] text-slate-700 block truncate" title={cap.sender}>
                          {cap.sender}
                        </span>
                        <span className="text-slate-500 block mt-0.5">Simulated Dispatch Status:</span>
                        <span className="font-semibold text-indigo-700">
                          {cap.is_simulation ? 'Simulated Dispatch Engine (Isolated)' : 'Live'}
                          {cap.export_count > 0 ? ` &bull; Export Count: ${cap.export_count}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePreviewXml(cap.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs border border-slate-300 flex items-center space-x-1 cursor-pointer transition-colors"
                        >
                          <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Preview XML &amp; Schema</span>
                        </button>
                      </div>

                      <div className="flex items-center flex-wrap gap-2">
                        {/* Request Approval (for DRAFT / VALIDATED) */}
                        {isDraft && (
                          <button
                            onClick={() => handleRequestApproval(cap.id)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <span>Request Desk Approval</span>
                          </button>
                        )}

                        {/* Approve (Role-Gated) */}
                        {isPending && (
                          <button
                            onClick={() => handleApproveCap(cap.id)}
                            disabled={isProcessing || !canApprove}
                            className={`px-3 py-1.5 rounded-lg text-white font-semibold text-xs shadow-2xs cursor-pointer disabled:opacity-50 ${
                              canApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400'
                            }`}
                            title={!canApprove ? 'Requires DDMA Officer or Admin role to approve' : ''}
                          >
                            <span>Approve for Dispatch</span>
                          </button>
                        )}

                        {/* Simulated Export */}
                        {(isApproved || isExported) && !isCancelled && (
                          <button
                            onClick={() => handleExportCap(cap.id)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-2xs flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Simulate Dispatch Export</span>
                          </button>
                        )}

                        {/* Cancel Warning */}
                        {(isApproved || isExported) && !isCancelled && (
                          <button
                            onClick={() => {
                              setCancellingCapId(cap.id);
                              setCancelReasonText('');
                            }}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-semibold text-xs cursor-pointer disabled:opacity-50"
                          >
                            <span>Cancel Alert</span>
                          </button>
                        )}

                        {isCancelled && (
                          <span className="text-[11px] font-semibold text-slate-500 italic">
                            Cancelled &bull; {cap.cancellation_reason || 'Withdrawn'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DRAFT CAP ALERT MODAL */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Draft Standardized CAP v1.2 Warning
                </h3>
                <p className="text-xs text-slate-500">
                  Synthesizes OASIS CAP v1.2 / ITU-T X.1303 disaster early warning message
                </p>
              </div>
              <button
                onClick={() => setShowDraftModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs">
              <strong>Telemetry Guard:</strong> The target station's latest risk telemetry must be in <code>CURRENT</code> status. If data is <code>STALE</code> or <code>INSUFFICIENT_DATA</code>, the validation pipeline will reject CAP draft generation.
            </div>

            <form onSubmit={handleCreateCapDraftSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Target Monitoring Station *</label>
                <select
                  value={draftLocationId}
                  onChange={(e) => handleDraftLocationSelect(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 text-xs"
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      #{loc.id} &bull; {loc.name} ({loc.district}, {loc.state})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">CAP Event Identifier *</label>
                  <input
                    type="text"
                    value={draftEvent}
                    onChange={(e) => setDraftEvent(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Alert Radius (km)</label>
                  <input
                    type="number"
                    value={draftRadiusKm}
                    onChange={(e) => setDraftRadiusKm(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 text-xs font-mono"
                    min={1}
                    max={100}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">CAP Headline *</label>
                <input
                  type="text"
                  value={draftHeadline}
                  onChange={(e) => setDraftHeadline(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Area Description *</label>
                <input
                  type="text"
                  value={draftAreaDesc}
                  onChange={(e) => setDraftAreaDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Hazard Description *</label>
                <textarea
                  rows={3}
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Response Instruction</label>
                <textarea
                  rows={2}
                  value={draftInstruction}
                  onChange={(e) => setDraftInstruction(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDraftModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDraft}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingDraft ? 'Validating & Synthesizing...' : 'Synthesize CAP Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* XML PREVIEW MODAL */}
      {xmlPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full p-5 sm:p-6 space-y-4 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">
                    OASIS CAP v1.2 XML Payload
                  </h3>
                  <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {xmlPreviewModal.identifier}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Schema Compliance &amp; Structural Syntax Verification
                </div>
              </div>

              <button
                onClick={() => setXmlPreviewModal(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Schema Validation Status */}
            <div
              className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                xmlPreviewModal.is_valid
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                {xmlPreviewModal.is_valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
                <span className="font-semibold">
                  {xmlPreviewModal.is_valid
                    ? 'OASIS CAP v1.2 Schema Valid: Verified against OASIS X.1303 specification'
                    : 'Schema Validation Errors Detected'}
                </span>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(xmlPreviewModal.xml_payload);
                  setCopiedXml(true);
                  setTimeout(() => setCopiedXml(false), 2000);
                }}
                className="px-2.5 py-1 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3 h-3 text-slate-500" />
                <span>{copiedXml ? 'Copied!' : 'Copy XML'}</span>
              </button>
            </div>

            {/* XML Payload Display */}
            <div className="relative">
              <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
                <code>{xmlPreviewModal.xml_payload}</code>
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                onClick={() => setXmlPreviewModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATED EXPORT RECEIPT MODAL */}
      {exportReceiptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Simulated Dispatch Receipt
                </h3>
              </div>
              <button
                onClick={() => setExportReceiptModal(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 text-xs space-y-2">
              <div className="font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Transmission Acknowledged via Isolated Simulation Adapter</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                The CAP XML message was safely dispatched to the simulated test channel. Public broadcasting systems remained unprompted.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Alert Identifier:</span>
                <span className="font-mono font-bold text-indigo-900">{exportReceiptModal.identifier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dispatch Status:</span>
                <span className="font-semibold text-emerald-700">{exportReceiptModal.dispatch_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Export Cycle Count:</span>
                <span className="font-mono">{exportReceiptModal.export_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dispatched At:</span>
                <span className="font-mono text-[11px]">{new Date(exportReceiptModal.exported_at).toUTCString()}</span>
              </div>
              <div className="pt-1 border-t border-slate-200 text-[10px] text-slate-500">
                Receipt Hash: <code className="text-slate-700">{exportReceiptModal.dispatch_receipt}</code>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setExportReceiptModal(null)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs cursor-pointer"
              >
                Dismiss Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL ALERT MODAL */}
      {cancellingCapId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Cancel Active Warning (#{cancellingCapId})
              </h3>
              <button
                onClick={() => setCancellingCapId(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-rose-900 text-xs">
              <strong>Official Cancellation Notice:</strong> Under CAP standards, an alert cancellation generates an official message reference to reassure the public that the hazard threat has mitigated.
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700 block">Cancellation Reason *</label>
              <textarea
                rows={3}
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
                placeholder="e.g. Rainfall has ceased; ground telemetry stabilized below threshold; slope inspection confirmed clear."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 text-xs"
                required
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setCancellingCapId(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleCancelCapConfirm}
                disabled={!cancelReasonText.trim()}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs cursor-pointer disabled:opacity-50"
              >
                Emit CAP Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsPage;

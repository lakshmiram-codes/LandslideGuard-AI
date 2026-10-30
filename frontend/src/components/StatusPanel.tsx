import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Server,
  Globe,
  Radio,
  Clock,
  Terminal,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { ConnectionState, HealthResponse, InfoResponse } from '../types';
import { API_BASE_URL } from '../services/api';

interface StatusPanelProps {
  connectionState: ConnectionState;
  healthData: HealthResponse | null;
  infoData: InfoResponse | null;
  errorMessage: string | null;
  lastChecked: Date | null;
  onRefresh: () => void;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({
  connectionState,
  healthData,
  infoData,
  errorMessage,
  lastChecked,
  onRefresh,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Panel Header */}
      <div className="bg-slate-900 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-blue-600/30 rounded-md border border-blue-400/30">
            <Radio className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-100">
              System Connectivity & Health Diagnostics
            </h2>
            <p className="text-xs text-slate-400">
              Real-time synchronization between React client and FastAPI service
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={connectionState === 'loading'}
          className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${connectionState === 'loading' ? 'animate-spin' : ''}`} />
          <span>{connectionState === 'loading' ? 'Checking...' : 'Re-check Connection'}</span>
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Connection Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Frontend Client Status */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-md">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Frontend Client</h3>
                  <p className="text-xs text-slate-500 font-mono">React 18 + Vite + TS</p>
                </div>
              </div>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>Active</span>
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/80 text-xs text-slate-600 flex justify-between items-center">
              <span>Client State:</span>
              <span className="font-medium text-slate-700">Ready & Rendered</span>
            </div>
          </div>

          {/* Backend API Connection Status */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`p-2 rounded-md ${
                    connectionState === 'loading'
                      ? 'bg-amber-100 text-amber-700'
                      : connectionState === 'success'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">FastAPI Backend</h3>
                  <p className="text-xs text-slate-500 font-mono truncate max-w-[200px]" title={API_BASE_URL}>
                    {API_BASE_URL}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              {connectionState === 'loading' && (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-700" />
                  <span>Connecting</span>
                </span>
              )}
              {connectionState === 'success' && (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Operational</span>
                </span>
              )}
              {connectionState === 'error' && (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Unavailable</span>
                </span>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/80 text-xs text-slate-600 flex justify-between items-center">
              <span>Health Endpoint:</span>
              <span className="font-mono text-slate-700">/api/v1/health</span>
            </div>
          </div>
        </div>

        {/* Detailed State Banner */}
        {connectionState === 'loading' && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center space-x-3">
            <Loader2 className="w-5 h-5 animate-spin text-amber-600 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold">Establishing connection to FastAPI service...</span>
              <p className="text-amber-700/90 mt-0.5">
                Querying <span className="font-mono">{API_BASE_URL}/api/v1/health</span>. Please wait.
              </p>
            </div>
          </div>
        )}

        {connectionState === 'error' && (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 space-y-2.5">
            <div className="flex items-start space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                  Backend API Communication Failure
                </h4>
                <p className="text-xs text-rose-700">{errorMessage}</p>
              </div>
            </div>
            <div className="bg-white/80 p-3 rounded border border-rose-200 text-xs text-slate-700 space-y-1.5">
              <span className="font-semibold text-rose-900 block">Troubleshooting steps:</span>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>
                  Verify the backend process is running: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">uvicorn app.main:app --port 8000</code>
                </li>
                <li>
                  Confirm the base URL matches: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">{API_BASE_URL}</code>
                </li>
                <li>Verify CORS allows origin requests from Vite (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">http://127.0.0.1:5173</code>)</li>
              </ul>
            </div>
          </div>
        )}

        {connectionState === 'success' && healthData && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-semibold text-emerald-900">
                  Backend Handshake Successful & Verified
                </span>
                <p className="text-emerald-800">
                  The frontend successfully connected to <span className="font-mono">{API_BASE_URL}</span>. Both services are communicating over local HTTP.
                </p>
              </div>
            </div>

            {/* Diagnostic Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Backend Service</span>
                <span className="font-semibold text-slate-800">{healthData.application}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Health Status</span>
                <span className="font-semibold text-emerald-600 uppercase font-mono">{healthData.status}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[11px]">API Version</span>
                <span className="font-mono text-slate-800">{healthData.version}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Current Phase</span>
                <span className="font-medium text-slate-800">{infoData?.current_phase || 'Phase 1'}</span>
              </div>
            </div>

            {/* Response Payload Preview */}
            <div className="bg-slate-900 text-slate-200 rounded-lg p-3 text-xs font-mono">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400 text-[11px]">
                <div className="flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  <span>Response from /api/v1/health</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{healthData.timestamp}</span>
                </div>
              </div>
              <pre className="overflow-x-auto text-[11px] leading-relaxed text-emerald-400">
                {JSON.stringify(healthData, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Footer timestamp */}
        {lastChecked && (
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
            <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
            <span className="font-mono">CORS: Enabled</span>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import {
  CheckCircle2,
  Clock,
  Layers,
  Layout,
  Map,
  CloudRain,
  Cpu,
  FileText,
  ShieldCheck,
} from 'lucide-react';

export const PhaseRoadmap: React.FC = () => {
  const phases = [
    {
      phase: 'Phase 1',
      title: 'Project Foundation & Health API',
      status: 'COMPLETED & VERIFIED',
      active: true,
      completed: true,
      icon: Layers,
      color: 'border-emerald-300 bg-emerald-50/40',
      tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      description:
        'FastAPI REST server, React + Vite + TS client, CORS configuration, health diagnostics, unit tests, and environment templates.',
    },
    {
      phase: 'Phase 2',
      title: 'UI Design System & Application Shell',
      status: 'COMPLETED & VERIFIED',
      active: true,
      completed: true,
      icon: Layout,
      color: 'border-blue-400 bg-blue-50/50',
      tagColor: 'bg-blue-100 text-blue-800 border-blue-300',
      description:
        'Disaster-management design tokens, 9-item responsive navigation shell, reusable stat cards, risk legends, empty states, and accessibility.',
    },
    {
      phase: 'Phase 3',
      title: 'Database & Backend Foundation',
      status: 'COMPLETED & VERIFIED',
      active: true,
      completed: true,
      icon: Map,
      color: 'border-emerald-300 bg-emerald-50/40',
      tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      description:
        'PostgreSQL 15 dedicated database (landslideguard_db), SQLAlchemy 2.x relational models, Alembic migrations, CRUD endpoints, and 24 passing backend tests.',
    },
    {
      phase: 'Phase 4',
      title: 'Pan-India Spatial GIS & Extent',
      status: 'COMPLETED & VERIFIED',
      active: true,
      completed: true,
      icon: Layers,
      color: 'border-emerald-300 bg-emerald-50/40',
      tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      description:
        'Interactive Leaflet GIS map encompassing the whole country of India (Kashmir to Kanyakumari), 5 regional focus presets, and separate symbol classifications.',
    },
    {
      phase: 'Phase 5',
      title: 'Verified Real-Time Weather Integration',
      status: 'COMPLETED & VERIFIED',
      active: true,
      completed: true,
      icon: CloudRain,
      color: 'border-blue-400 bg-blue-50/50',
      tagColor: 'bg-blue-100 text-blue-800 border-blue-300',
      description:
        'Open-Meteo external weather provider (ECMWF/GFS Analysis), physical range & clock-skew validation, data quality tags (CURRENT/STALE/MISSING/DEMO), and batch sync.',
    },
    {
      phase: 'Phase 6',
      title: 'AI Susceptibility & Warning Engine',
      status: 'COMPLETED & VERIFIED',
      active: true,
      completed: true,
      icon: Cpu,
      color: 'border-indigo-300 bg-indigo-50/40',
      tagColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      description:
        'Explainable geomorphic baseline (GeomorphicBaselineModel v1.0.0), feature attribution breakdown, ML data readiness audit, and anti-flapping early warning safeguards with 6h cooldowns.',
    },
    {
      phase: 'Phase 7',
      title: 'Crowdsourcing, Field Review & CAP',
      status: 'COMPLETED & VERIFIED',
      active: true,
      completed: true,
      icon: FileText,
      color: 'border-teal-300 bg-teal-50/40',
      tagColor: 'bg-teal-100 text-teal-800 border-teal-300',
      description:
        'Audited community reporting, evidence upload with magic signature check, role-based field verification with self-approval guards, and OASIS CAP v1.2 XML alert dispatches.',
    },
    {
      phase: 'Phase 8',
      title: 'Final Integration & Security Audit',
      status: 'COMPLETED & VERIFIED',
      active: true,
      completed: true,
      icon: ShieldCheck,
      color: 'border-emerald-300 bg-emerald-50/40',
      tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      description:
        'Full integration verification, comprehensive security audit, query optimization (N+1 elimination), E2E test suite, latency benchmarks, and deployment readiness review.',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Multi-Phase Engineering Roadmap
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict isolation maintained per phase. Future features unlock systematically.
          </p>
        </div>
        <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
          Phases 1–8 Verified
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {phases.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.phase}
              className={`p-3.5 rounded-lg border text-xs flex flex-col justify-between space-y-2.5 transition-shadow ${p.color}`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Icon className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                    <span className="font-bold text-slate-900 font-sans">{p.phase}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${p.tagColor}`}
                  >
                    {p.status}
                  </span>
                </div>
                <h4 className="font-semibold text-slate-800">{p.title}</h4>
                <p className="text-slate-600 leading-relaxed text-[11px]">{p.description}</p>
              </div>

              {p.completed && (
                <div className="pt-2 border-t border-slate-200/70 flex items-center space-x-1.5 text-emerald-700 text-[11px] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>Implemented & verified</span>
                </div>
              )}
              {!p.completed && (
                <div className="pt-2 border-t border-slate-200/50 flex items-center space-x-1.5 text-slate-500 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>Scheduled milestone</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React from 'react';
import { Mountain, AlertCircle, ShieldAlert, Sparkles, Compass } from 'lucide-react';

export const WelcomeSection: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Hero Welcome Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white rounded-xl p-6 sm:p-8 shadow-sm border border-slate-800">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phase 1 — Workspace & Project Foundation</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
            LandslideGuard AI
          </h1>
          <p className="text-base sm:text-lg text-slate-300 font-medium">
            Early Warning and Landslide Risk Monitoring System
          </p>

          <p className="text-sm text-slate-400 leading-relaxed pt-1">
            Dedicated to disaster mitigation and real-time geohazard monitoring across{' '}
            <strong className="text-slate-200">India&apos;s North Eastern Region (NER)</strong>.
            This platform will integrate spatial GIS mapping, precipitation telemetry, soil moisture
            dynamics, and predictive machine learning models to deliver critical early warnings to authorities and vulnerable communities.
          </p>
        </div>

        {/* Foundation Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-slate-800 rounded-lg text-blue-400 shrink-0">
              <Mountain className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Targeted Geography
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Northeastern Himalayas, Assam, Meghalaya, Sikkim & Hill Tracts
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-slate-800 rounded-lg text-emerald-400 shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Full-Stack Architecture
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                React 18 + TypeScript Client, FastAPI Backend, PostGIS-ready
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-slate-800 rounded-lg text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Compliance & Integrity
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Rigorous testing, zero synthetic telemetry or simulated alerts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Demonstration / Integrity Notice Banner */}
      <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-4 flex items-start space-x-3 text-amber-900">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h4 className="font-bold text-amber-950 uppercase tracking-wide">
            Development Phase Integrity Notice
          </h4>
          <p className="text-amber-800 leading-relaxed">
            In accordance with Phase 1 project rules, this deployment establishes the software foundation and verified API connectivity.
            No simulated live sensor telemetry, mock landslide alerts, or synthetic ML hazard scores are presented. Real-time GIS data ingestion, hydrological modeling, and emergency notification pipelines will be integrated in subsequent phases.
          </p>
        </div>
      </div>
    </div>
  );
};

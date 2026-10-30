import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';
import { StatusBadge } from './common/StatusBadge';

export const RiskLegend: React.FC = () => {
  const levels = [
    {
      level: 'low' as const,
      name: 'Low Risk',
      threshold: '< 25 mm/24h',
      color: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50/60 border-emerald-200',
      description: 'Standard baseline slope stability. Normal environmental conditions.',
    },
    {
      level: 'moderate' as const,
      name: 'Moderate Risk',
      threshold: '25 – 60 mm/24h',
      color: 'bg-amber-500',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50/60 border-amber-200',
      description: 'Elevated saturation in vulnerable hill tracts. Advisory monitoring required.',
    },
    {
      level: 'high' as const,
      name: 'High Risk',
      threshold: '60 – 110 mm/24h',
      color: 'bg-orange-500',
      textColor: 'text-orange-700',
      bgColor: 'bg-orange-50/60 border-orange-200',
      description: 'High precipitation threshold exceeded. Potential localized slope failure.',
    },
    {
      level: 'critical' as const,
      name: 'Critical Hazard',
      threshold: '> 110 mm/24h',
      color: 'bg-red-500',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50/60 border-red-200',
      description: 'Severe structural saturation. Immediate evacuation warnings and road closures.',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-slate-700" aria-hidden="true" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Geohazard Susceptibility Scale (Legend)
          </h3>
        </div>
        <StatusBadge variant="neutral" size="sm">
          Planned Classification Schema
        </StatusBadge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {levels.map((item) => (
          <div
            key={item.level}
            className={`p-3 rounded-lg border ${item.bgColor} flex flex-col justify-between space-y-2`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <span className={`w-2 h-2 rounded-full ${item.color}`} aria-hidden="true" />
                  <span>{item.name}</span>
                </span>
                <span className="text-[10px] font-mono font-medium text-slate-500">
                  {item.threshold}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                {item.description}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200/60 text-[10px] font-mono text-slate-500 flex justify-between">
              <span>Class Level</span>
              <span className="uppercase font-semibold">{item.level}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Explicit Disclaimer */}
      <div className="flex items-start space-x-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px]">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="text-slate-700">Classification Notice:</strong> This legend standardizes the upcoming 4-tier risk threshold framework planned for Phase 4 (Meteorological Ingestion) and Phase 5 (AI Susceptibility Engine). It does not display live predictions or simulated active hazards in this phase.
        </p>
      </div>
    </div>
  );
};

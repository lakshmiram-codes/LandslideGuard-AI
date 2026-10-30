import React from 'react';
import { LucideIcon } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface StatCardProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  badgeText?: string;
  statusLabel?: string;
  description?: string;
  plannedPhase?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  icon: Icon,
  iconColor = 'text-blue-700',
  iconBg = 'bg-blue-50 border-blue-200',
  badgeText = 'Pending',
  statusLabel = 'Data integration pending',
  description,
  plannedPhase,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-lg border ${iconBg} ${iconColor} shrink-0`}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {title}
            </h3>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              {statusLabel}
            </p>
          </div>
        </div>

        <StatusBadge variant="neutral" size="sm">
          {badgeText}
        </StatusBadge>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="truncate pr-2">{description || 'Telemetry pipeline awaiting database'}</span>
        {plannedPhase && (
          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
            {plannedPhase}
          </span>
        )}
      </div>
    </div>
  );
};

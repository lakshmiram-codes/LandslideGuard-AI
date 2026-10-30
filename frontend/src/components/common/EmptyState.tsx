import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  badge?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  badge,
  className = '',
}) => {
  return (
    <div
      className={`bg-slate-50/70 border border-dashed border-slate-300 rounded-xl p-8 text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs text-slate-500 mb-3.5">
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>

      <div className="max-w-md space-y-1.5">
        <div className="flex items-center justify-center space-x-2">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {badge}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 cursor-pointer"
        >
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
};

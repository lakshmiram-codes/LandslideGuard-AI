import React from 'react';
import { BadgeVariant } from '../../types';

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  children,
  size = 'sm',
  dot = false,
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    critical: 'bg-red-100 text-red-900 border-red-300',
    high: 'bg-orange-100 text-orange-900 border-orange-300',
    moderate: 'bg-amber-100 text-amber-900 border-amber-300',
    low: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    success: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    warning: 'bg-amber-100 text-amber-800 border-amber-300',
    error: 'bg-rose-100 text-rose-800 border-rose-300',
    info: 'bg-blue-100 text-blue-800 border-blue-300',
    neutral: 'bg-slate-100 text-slate-700 border-slate-300',
  };

  const dotColors: Record<BadgeVariant, string> = {
    critical: 'bg-red-600',
    high: 'bg-orange-600',
    moderate: 'bg-amber-600',
    low: 'bg-emerald-600',
    success: 'bg-emerald-600',
    warning: 'bg-amber-600',
    error: 'bg-rose-600',
    info: 'bg-blue-600',
    neutral: 'bg-slate-500',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-medium font-sans rounded-full border tracking-normal ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${dotColors[variant]} ${
            variant === 'critical' ? 'animate-ping' : ''
          }`}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
};

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading diagnostic telemetry...',
  subMessage,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="p-8 flex flex-col items-center justify-center space-y-3 text-center"
    >
      <Loader2
        className={`${sizeClasses[size]} animate-spin text-blue-600`}
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-700">{message}</p>
        {subMessage && (
          <p className="text-[11px] text-slate-500 font-mono">{subMessage}</p>
        )}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
};

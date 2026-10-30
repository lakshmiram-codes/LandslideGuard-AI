import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryText?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Service Communication Error',
  message,
  onRetry,
  retryText = 'Retry Request',
}) => {
  return (
    <div
      role="alert"
      className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900 space-y-3"
    >
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-950">
            {title}
          </h3>
          <p className="text-xs text-rose-700 leading-relaxed">{message}</p>
        </div>
      </div>

      {onRetry && (
        <div className="pt-2 border-t border-rose-200/70 flex justify-end">
          <button
            onClick={onRetry}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{retryText}</span>
          </button>
        </div>
      )}
    </div>
  );
};

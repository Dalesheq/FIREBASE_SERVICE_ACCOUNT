import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

interface AlertBannerProps {
  type?: 'error' | 'success' | 'info';
  message: string;
  onDismiss?: () => void;
  id?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = 'error',
  message,
  onDismiss,
  id,
}) => {
  if (!message) return null;

  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
  }[type];

  const Icon = {
    error: AlertCircle,
    success: CheckCircle2,
    info: Info,
  }[type];

  return (
    <div
      id={id || 'alert-banner'}
      className={`flex items-start gap-3 p-3.5 rounded-lg border text-sm ${styles} transition-all duration-150`}
      role="alert"
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 text-xs sm:text-sm leading-relaxed">{message}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-slate-500 hover:text-slate-800 p-0.5 rounded transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

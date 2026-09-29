import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  subtext?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  subtext,
  fullScreen = false,
}) => {
  const content = (
    <div id="loading-spinner-container" className="flex flex-col items-center justify-center p-8 text-center">
      <Loader2 className="h-9 w-9 animate-spin text-slate-700 mb-4" />
      <p className="text-base font-medium text-slate-800 tracking-tight">{message}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1 max-w-sm">{subtext}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div id="loading-spinner-fullscreen" className="min-h-screen bg-slate-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};

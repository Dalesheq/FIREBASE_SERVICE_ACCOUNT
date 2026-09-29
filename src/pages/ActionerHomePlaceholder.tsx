import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ActionerDashboard } from '../components/actioner/ActionerDashboard';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

interface ActionerHomePlaceholderProps {
  onReturnToAdmin?: () => void;
}

export const ActionerHomePlaceholder: React.FC<ActionerHomePlaceholderProps> = ({ onReturnToAdmin }) => {
  const { isAdmin } = useAuth();

  return (
    <div id="actioner-portal-page" className="space-y-4">
      {/* Return to Admin banner if viewing in preview mode as Admin */}
      {isAdmin && onReturnToAdmin && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-xs">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                You are viewing the <strong>Actioner Portal</strong> in preview mode as an Administrator.
              </span>
            </div>
            <button
              type="button"
              onClick={onReturnToAdmin}
              className="inline-flex items-center gap-1.5 font-bold text-amber-950 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Admin Portal
            </button>
          </div>
        </div>
      )}

      {/* Main Actioner Portal */}
      <ActionerDashboard />
    </div>
  );
};

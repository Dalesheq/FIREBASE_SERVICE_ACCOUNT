import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserX, LogOut } from 'lucide-react';

export const AccountDeactivated: React.FC = () => {
  const { currentUser, logout } = useAuth();

  return (
    <div id="account-deactivated-page" className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xs border border-slate-200 p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <UserX className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Account Deactivated</h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          The user account for <strong className="text-slate-800">{currentUser?.email}</strong> has been deactivated by a SHEQ administrator. You no longer have active access to the inspection portal.
        </p>
        <p className="text-[11px] text-slate-500">
          Please contact your workplace SHEQ compliance manager if you believe this is in error.
        </p>
        <div className="pt-2">
          <button
            id="btn-deactivated-logout"
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

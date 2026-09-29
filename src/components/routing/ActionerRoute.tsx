import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserCheck } from 'lucide-react';

interface ActionerRouteProps {
  children: React.ReactNode;
}

export const ActionerRoute: React.FC<ActionerRouteProps> = ({ children }) => {
  const { currentUser, isActioner, isAdmin } = useAuth();

  if (!isActioner && !isAdmin) {
    return (
      <div id="actioner-access-denied" className="max-w-lg mx-auto my-12 p-6 bg-white rounded-xl shadow-xs border border-amber-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <UserCheck className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Valid Profile Required</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Your account profile is currently unassigned or pending authorization.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

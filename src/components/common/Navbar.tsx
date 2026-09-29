import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, UserCheck, LogOut, ShieldAlert } from 'lucide-react';
import { PWAInstallButton } from './PWAStatusAndInstall';

interface NavbarProps {
  currentView?: string;
  onNavigate?: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { currentUser, logout, isAdmin, isActioner } = useAuth();

  return (
    <header id="app-header" className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-amber-500 flex items-center justify-center text-slate-950 font-bold tracking-wider shadow-sm">
              <ShieldCheck className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-base sm:text-lg">SHEQ</span>
                <span className="text-xs uppercase font-semibold tracking-wider text-amber-400 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-800/60">
                  Inspection Hub
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Workplace Safety & Quality Management</p>
            </div>
          </div>

          {/* User badge & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <PWAInstallButton />
            {currentUser && (
              <div className="flex items-center gap-2 sm:gap-3 bg-slate-800/80 border border-slate-700/80 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs">
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-200">
                  {isAdmin ? (
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5 text-sky-400" />
                  )}
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-200 max-w-[140px] sm:max-w-[200px] truncate leading-tight">
                    {currentUser.fullName}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded text-[10px] uppercase font-bold tracking-wider ${
                        isAdmin
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                    <span className="text-[11px] text-slate-400 hidden md:inline">
                      {currentUser.email}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              id="btn-logout"
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/90 border border-slate-700 rounded-lg transition-colors"
              title="Sign out of SHEQ Hub"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

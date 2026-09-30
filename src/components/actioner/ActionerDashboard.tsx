import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Action } from '../../types/sheq';
import { UserProfile } from '../../types/auth';
import { subscribeActionsForActioner } from '../../services/actionService';
import { getActiveActioners } from '../../services/userService';
import { ActionerSummaryCards } from './ActionerSummaryCards';
import { ActionList } from './ActionList';
import { ActionDetailModal } from './ActionDetailModal';
import { ActionerProfile } from './ActionerProfile';
import {
  ClipboardList,
  User,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Lock,
  Users,
} from 'lucide-react';

export const ActionerDashboard: React.FC = () => {
  const { currentUser, isAdmin, logout } = useAuth();

  // Navigation tab: 'actions' or 'profile'
  const [activeTab, setActiveTab] = useState<'actions' | 'profile'>('actions');

  // Admin preview selector state (only available when isAdmin is true)
  const [availableActioners, setAvailableActioners] = useState<UserProfile[]>([]);
  const [previewActionerUid, setPreviewActionerUid] = useState<string>('');

  // Actions state
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter state
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Selected action for detailed modal view
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  // If Admin is previewing the Actioner Portal, load registered actioners so Admin can preview any individual Actioner's isolated view
  useEffect(() => {
    if (!isAdmin) return;
    let mounted = true;
    getActiveActioners()
      .then((list) => {
        if (!mounted) return;
        setAvailableActioners(list);
        if (list.length > 0 && !previewActionerUid) {
          setPreviewActionerUid(list[0].uid);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  const effectiveActioner: UserProfile | null = isAdmin
    ? availableActioners.find((a) => a.uid === previewActionerUid) || currentUser
    : currentUser;

  // Subscribe to real-time action updates strictly for the authenticated (or admin-previewed) actioner
  useEffect(() => {
    if (!effectiveActioner?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const unsubscribe = subscribeActionsForActioner(
      effectiveActioner.uid,
      (fetchedActions) => {
        setActions(fetchedActions);
        setLoading(false);

        // If a modal is open, keep its data fresh with the newly received document
        setSelectedAction((currentSelected) => {
          if (!currentSelected) return null;
          const updated = fetchedActions.find((a) => a.id === currentSelected.id);
          return updated || null;
        });
      },
      (err) => {
        console.error('Actioner subscription failed:', err);
        setErrorMsg(
          'Failed to load your assigned actions. Ensure your account is active and authorized.'
        );
        setLoading(false);
      },
      {
        email: effectiveActioner.email,
        fullName: effectiveActioner.fullName,
      }
    );

    return () => {
      unsubscribe();
    };
  }, [effectiveActioner?.uid, effectiveActioner?.email, effectiveActioner?.fullName]);

  // Handle active status check
  if (currentUser && !currentUser.active) {
    return (
      <div id="actioner-deactivated" className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-lg max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 mx-auto flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Account Deactivated</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your actioner profile has been deactivated by the system administrator. You cannot view or update assigned actions at this time.
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="actioner-dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Admin Preview Actioner Selector (only visible to Admins in preview mode) */}
      {isAdmin && availableActioners.length > 0 && (
        <div className="p-3.5 bg-slate-900 text-white rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-400 shrink-0" />
            <span>
              <strong>Admin Preview Mode:</strong> Select a registered Actioner to preview their isolated view (when an Actioner signs in, they are locked strictly to their own account):
            </span>
          </div>
          <select
            value={previewActionerUid}
            onChange={(e) => setPreviewActionerUid(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            {availableActioners.map((act) => (
              <option key={act.uid} value={act.uid}>
                {act.fullName} ({act.email})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Personal Allocation & Zero-Trust Isolation Banner */}
      <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-sky-950">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Lock className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-bold">Personal Actioner Workspace: </span>
            <span>
              Showing exclusively corrective actions currently and previously allocated to{' '}
              <strong>{effectiveActioner?.fullName || currentUser?.fullName}</strong> (
              <span className="font-mono">{effectiveActioner?.email || currentUser?.email}</span>).
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white text-sky-800 border border-sky-200 self-start sm:self-auto shrink-0">
          Isolated View Active
        </span>
      </div>

      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Actioner Portal
            </span>
            <span className="text-xs text-slate-400 font-mono">•</span>
            <span className="text-xs font-semibold text-slate-500">
              {effectiveActioner?.fullName || currentUser?.fullName || 'Actioner'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            {activeTab === 'actions' ? 'My Allocated Corrective Actions' : 'My Profile'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeTab === 'actions'
              ? 'View and update corrective actions currently allocated to you, as well as historical actions previously allocated to you.'
              : 'View and manage your personal account display information.'}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('actions')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'actions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="h-4 w-4 text-sky-600" />
            <span>My Actions</span>
            {actions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-100 text-sky-800 font-bold">
                {actions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="h-4 w-4 text-slate-600" />
            <span>My Profile</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-xs font-bold underline hover:no-underline text-red-800 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && actions.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="h-6 w-6 text-sky-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">
            Loading your assigned corrective actions...
          </p>
        </div>
      ) : (
        <>
          {activeTab === 'actions' ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <ActionerSummaryCards
                actions={actions}
                selectedFilter={selectedFilter}
                onSelectFilter={(f) => setSelectedFilter(f)}
              />

              {/* Action Items List */}
              <ActionList
                actions={actions}
                selectedFilter={selectedFilter}
                onSelectFilter={(f) => setSelectedFilter(f)}
                onSelectAction={(action) => setSelectedAction(action)}
              />
            </div>
          ) : (
            <ActionerProfile />
          )}
        </>
      )}

      {/* Action Detail Modal */}
      {selectedAction && (
        <ActionDetailModal
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          onActionUpdated={() => {
            // The onSnapshot listener automatically receives the update
          }}
        />
      )}
    </div>
  );
};

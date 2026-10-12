import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Action, Inspection } from '../../types/sheq';
import { UserProfile } from '../../types/auth';
import { subscribeActionsForActioner } from '../../services/actionService';
import { getActiveActioners } from '../../services/userService';
import { getInspections } from '../../services/inspectionService';
import { ActionerSummaryCards } from './ActionerSummaryCards';
import { ActionList } from './ActionList';
import { ActionDetailModal } from './ActionDetailModal';
import { ActionerProfile } from './ActionerProfile';
import { ReportPreviewModal } from '../admin/reports/ReportPreviewModal';
import {
  ClipboardList,
  User,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Lock,
  Users,
  FileText,
  Calendar,
  Building2,
  Search,
  ExternalLink,
} from 'lucide-react';

export const ActionerDashboard: React.FC = () => {
  const { currentUser, isAdmin, logout } = useAuth();

  // Navigation tab: 'actions' | 'reports' | 'profile'
  const [activeTab, setActiveTab] = useState<'actions' | 'reports' | 'profile'>('actions');

  // Reports state for Actioner report view
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');
  const [activeReportInspection, setActiveReportInspection] = useState<Inspection | null>(null);

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

  // Load inspections for the actioner's report view
  useEffect(() => {
    let mounted = true;
    setLoadingReports(true);
    getInspections()
      .then((data) => {
        if (!mounted) return;
        setInspections(data);
      })
      .catch((err) => {
        console.warn('Failed to load inspections for actioner reports view:', err);
      })
      .finally(() => {
        if (mounted) setLoadingReports(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

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
            {activeTab === 'actions'
              ? 'My Allocated Corrective Actions'
              : activeTab === 'reports'
              ? 'Workplace Inspection Reports'
              : 'My Profile'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeTab === 'actions'
              ? 'View and update corrective actions currently allocated to you, as well as historical actions previously allocated to you.'
              : activeTab === 'reports'
              ? 'View, preview, and download official workplace inspection reports with complete embedded photographs and findings.'
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
            onClick={() => setActiveTab('reports')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="h-4 w-4 text-emerald-600" />
            <span>Inspection Reports</span>
            {inspections.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                {inspections.length}
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
          ) : activeTab === 'reports' ? (
            <div className="space-y-6">
              {/* Reports Search and Controls */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      Inspection Reports Directory
                    </h3>
                    <p className="text-xs text-slate-500">
                      All official inspection reports and photographs are available here for all users to review, print, and export.
                    </p>
                  </div>
                  <div className="relative max-w-xs w-full">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={reportSearchQuery}
                      onChange={(e) => setReportSearchQuery(e.target.value)}
                      placeholder="Search reports by ID or department..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {loadingReports && inspections.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-slate-600" />
                    Loading inspection reports...
                  </div>
                ) : inspections.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    No inspection reports found in the system yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inspections
                      .filter((insp) => {
                        if (!reportSearchQuery.trim()) return true;
                        const q = reportSearchQuery.toLowerCase();
                        return (
                          insp.inspectionNumber.toLowerCase().includes(q) ||
                          insp.title.toLowerCase().includes(q) ||
                          insp.departmentNameSnapshot?.toLowerCase().includes(q) ||
                          insp.inspectorNameSnapshot?.toLowerCase().includes(q)
                        );
                      })
                      .map((insp) => (
                        <div
                          key={insp.id}
                          className="p-4 bg-slate-50/70 hover:bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">
                                {insp.inspectionNumber}
                              </span>
                              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-slate-400" />
                                {insp.departmentNameSnapshot || 'Department'}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                  insp.status === 'Completed'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}
                              >
                                {insp.status}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">{insp.title}</h4>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                {insp.inspectionDate}
                              </span>
                              <span>•</span>
                              <span>Inspector: {insp.inspectorNameSnapshot || 'Inspector'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => setActiveReportInspection(insp)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-xs"
                            >
                              <FileText className="h-3.5 w-3.5 text-amber-400" />
                              View & Download Report
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
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

      {/* Official Inspection Report Modal (Available with all photos embedded to all users) */}
      {activeReportInspection && (
        <ReportPreviewModal
          inspection={activeReportInspection}
          onClose={() => setActiveReportInspection(null)}
        />
      )}
    </div>
  );
};

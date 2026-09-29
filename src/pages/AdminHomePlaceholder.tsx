import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Eye,
  ClipboardCheck,
  Plus,
  Database,
  LayoutDashboard,
  ListTodo,
  FileText,
  Users,
} from 'lucide-react';
import { InspectionList } from '../components/inspections/InspectionList';
import { InspectionForm } from '../components/inspections/InspectionForm';
import { InspectionDetail } from '../components/inspections/InspectionDetail';
import { Phase2DataFoundation } from '../components/admin/Phase2DataFoundation';
import { AdminDashboard } from '../components/admin/dashboard/AdminDashboard';
import { AdminActionList } from '../components/admin/actions/AdminActionList';
import { AdminActionDetailModal } from '../components/admin/actions/AdminActionDetailModal';
import { ExecutiveReportsView } from '../components/admin/reports/ExecutiveReportsView';
import { AdminUsersManagement } from '../components/admin/users/AdminUsersManagement';
import { getActionById } from '../services/actionService';
import { Action } from '../types/sheq';

interface AdminHomePlaceholderProps {
  onSwitchToActionerView?: () => void;
}

type AdminView =
  | 'dashboard'
  | 'list'
  | 'actions'
  | 'reports'
  | 'users'
  | 'create'
  | 'edit'
  | 'detail'
  | 'data-foundation';

export const AdminHomePlaceholder: React.FC<AdminHomePlaceholderProps> = ({
  onSwitchToActionerView,
}) => {
  const { currentUser } = useAuth();
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  // Drill-down filter states passed to list views
  const [inspectionFilters, setInspectionFilters] = useState<Record<string, string> | undefined>(undefined);
  const [actionFilters, setActionFilters] = useState<Record<string, string> | undefined>(undefined);

  // Quick Action Modal from Dashboard
  const [modalActionId, setModalActionId] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<Action | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (modalActionId) {
      getActionById(modalActionId).then((act) => {
        if (isMounted) setModalAction(act);
      });
    } else {
      setModalAction(null);
    }
    return () => {
      isMounted = false;
    };
  }, [modalActionId]);

  // Navigation handlers
  const handleStartNewInspection = () => {
    setSelectedInspectionId(null);
    setCurrentView('create');
  };

  const handleSelectInspection = (id: string) => {
    setSelectedInspectionId(id);
    setCurrentView('detail');
  };

  const handleEditInspection = (id: string) => {
    setSelectedInspectionId(id);
    setCurrentView('edit');
  };

  const handleFormDone = (id: string) => {
    setSelectedInspectionId(id);
    setCurrentView('detail');
  };

  const handleBackToList = () => {
    setSelectedInspectionId(null);
    setCurrentView('list');
  };

  return (
    <div id="admin-home-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-xs border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Lead SHEQ Inspector Session
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Inspection & Corrective Actions Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Oversee company-wide SHEQ compliance, conduct workplace walkthroughs, and coordinate corrective action remediation with departmental actioners.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchToActionerView && (
            <button
              type="button"
              onClick={onSwitchToActionerView}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors shrink-0 cursor-pointer"
            >
              <Eye className="h-4 w-4 text-sky-400" />
              Preview Actioner View
            </button>
          )}
        </div>
      </div>

      {/* Admin Sub-Navigation Tabs */}
      <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* Executive Dashboard Tab */}
          <button
            id="tab-admin-dashboard"
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              currentView === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="h-4 w-4 text-amber-400" />
            Executive Dashboard
          </button>

          {/* Inspections Tab */}
          <button
            id="tab-admin-inspections"
            type="button"
            onClick={() => {
              setInspectionFilters(undefined);
              setCurrentView('list');
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              currentView === 'list' || currentView === 'detail' || currentView === 'edit'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            Inspections Directory
          </button>

          {/* Corrective Actions Tab */}
          <button
            id="tab-admin-actions"
            type="button"
            onClick={() => {
              setActionFilters(undefined);
              setCurrentView('actions');
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              currentView === 'actions'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ListTodo className="h-4 w-4" />
            Corrective Actions
          </button>

          {/* Executive Reports Tab */}
          <button
            id="tab-admin-reports"
            type="button"
            onClick={() => setCurrentView('reports')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              currentView === 'reports'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="h-4 w-4 text-emerald-400" />
            Executive Reports
          </button>

          {/* User Management Tab */}
          <button
            id="tab-admin-users"
            type="button"
            onClick={() => setCurrentView('users')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              currentView === 'users'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="h-4 w-4 text-sky-400" />
            User Management
          </button>

          {/* New Inspection Tab */}
          <button
            id="tab-admin-new-inspection"
            type="button"
            onClick={handleStartNewInspection}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              currentView === 'create'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Plus className="h-4 w-4" />
            + New Inspection
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="tab-admin-data-tests"
            type="button"
            onClick={() => setCurrentView('data-foundation')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              currentView === 'data-foundation'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Database className="h-4 w-4" />
            Data Foundation & 23 Tests
          </button>
        </div>
      </div>

      {/* VIEW RENDERER */}
      {currentView === 'dashboard' && (
        <AdminDashboard
          onNavigateToInspections={(filters) => {
            setInspectionFilters(filters);
            setCurrentView('list');
          }}
          onNavigateToActions={(filters) => {
            setActionFilters(filters);
            setCurrentView('actions');
          }}
          onViewInspection={(id) => {
            setSelectedInspectionId(id);
            setCurrentView('detail');
          }}
          onOpenActionDetail={(actionId) => {
            setModalActionId(actionId);
          }}
        />
      )}

      {currentView === 'list' && (
        <InspectionList
          onNewInspection={handleStartNewInspection}
          onSelectInspection={handleSelectInspection}
          onEditInspection={handleEditInspection}
          initialFilters={inspectionFilters}
        />
      )}

      {currentView === 'actions' && (
        <AdminActionList
          initialFilters={actionFilters}
          onViewInspection={(id) => {
            setSelectedInspectionId(id);
            setCurrentView('detail');
          }}
        />
      )}

      {currentView === 'reports' && (
        <ExecutiveReportsView
          onViewInspectionDetail={(id) => {
            setSelectedInspectionId(id);
            setCurrentView('detail');
          }}
        />
      )}

      {currentView === 'users' && (
        <AdminUsersManagement />
      )}

      {currentView === 'create' && (
        <InspectionForm
          initialInspectionId={null}
          onDone={handleFormDone}
          onCancel={handleBackToList}
        />
      )}

      {currentView === 'edit' && selectedInspectionId && (
        <InspectionForm
          initialInspectionId={selectedInspectionId}
          onDone={handleFormDone}
          onCancel={handleBackToList}
        />
      )}

      {currentView === 'detail' && selectedInspectionId && (
        <InspectionDetail
          inspectionId={selectedInspectionId}
          onBack={handleBackToList}
          onEditFull={handleEditInspection}
          onDeleted={handleBackToList}
        />
      )}

      {currentView === 'data-foundation' && (
        <Phase2DataFoundation />
      )}

      {/* Quick Action Detail Modal triggered from dashboard feed */}
      {modalAction && (
        <AdminActionDetailModal
          action={modalAction}
          onClose={() => {
            setModalActionId(null);
            setModalAction(null);
          }}
          onActionUpdated={() => {
            if (modalActionId) {
              getActionById(modalActionId).then(setModalAction);
            }
          }}
          onViewInspection={(inspId) => {
            setModalActionId(null);
            setModalAction(null);
            setSelectedInspectionId(inspId);
            setCurrentView('detail');
          }}
        />
      )}
    </div>
  );
};

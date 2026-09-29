import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  RotateCcw,
  AlertTriangle,
  Building2,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  PlayCircle,
  Eye,
  ShieldAlert,
  Flame,
  ArrowUpDown,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { Action, Department, RiskLevel, ActionStatus } from '../../../types/sheq';
import { UserProfile } from '../../../types/auth';
import { getAllActionsForAdmin } from '../../../services/actionService';
import { getDepartments } from '../../../services/departmentService';
import { getAllUsers } from '../../../services/userService';
import { isActionOverdue, getDaysOverdue } from '../../../utils/validation';
import { AdminActionDetailModal } from './AdminActionDetailModal';

interface AdminActionListProps {
  initialFilters?: {
    status?: string;
    departmentId?: string;
    assignedToUserId?: string;
    riskLevel?: string;
    dueDatePreset?: string;
  };
  onViewInspection?: (inspectionId: string) => void;
}

export const AdminActionList: React.FC<AdminActionListProps> = ({
  initialFilters,
  onViewInspection,
}) => {
  const [actions, setActions] = useState<Action[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [actioners, setActioners] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialFilters?.departmentId || 'ALL');
  const [selectedActionerId, setSelectedActionerId] = useState<string>(initialFilters?.assignedToUserId || 'ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialFilters?.status || 'ALL');
  const [selectedRisk, setSelectedRisk] = useState<string>(initialFilters?.riskLevel || 'ALL');
  const [selectedDueDateFilter, setSelectedDueDateFilter] = useState<string>(initialFilters?.dueDatePreset || 'ALL');
  const [sortOrder, setSortOrder] = useState<'due_asc' | 'due_desc' | 'overdue_first' | 'updated_desc'>('overdue_first');

  // Modal State
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg(null);

    try {
      const [allActs, depts, users] = await Promise.all([
        getAllActionsForAdmin(),
        getDepartments(),
        getAllUsers(),
      ]);
      setActions(allActs);
      setDepartments(depts);
      setActioners(users.filter((u) => u.role === 'actioner' && u.active));
    } catch (err: unknown) {
      const e = err as Error;
      console.error('Failed to load admin actions:', e);
      setErrorMsg(e.message || 'Failed to load corrective actions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update filters if initialFilters changes
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.status) setSelectedStatus(initialFilters.status);
      if (initialFilters.departmentId) setSelectedDeptId(initialFilters.departmentId);
      if (initialFilters.assignedToUserId) setSelectedActionerId(initialFilters.assignedToUserId);
      if (initialFilters.riskLevel) setSelectedRisk(initialFilters.riskLevel);
      if (initialFilters.dueDatePreset) setSelectedDueDateFilter(initialFilters.dueDatePreset);
    }
  }, [initialFilters]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDeptId('ALL');
    setSelectedActionerId('ALL');
    setSelectedStatus('ALL');
    setSelectedRisk('ALL');
    setSelectedDueDateFilter('ALL');
    setSortOrder('overdue_first');
  };

  // Filtered & Sorted Actions
  const filteredActions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return actions
      .filter((action) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = action.title.toLowerCase().includes(q);
          const matchDesc = (action.description || '').toLowerCase().includes(q);
          const matchInsp = (action.inspectionNumberSnapshot || '').toLowerCase().includes(q);
          const matchDept = (action.departmentNameSnapshot || '').toLowerCase().includes(q);
          const matchUser = (action.assignedToUserNameSnapshot || '').toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchInsp && !matchDept && !matchUser) {
            return false;
          }
        }

        // Department
        if (selectedDeptId !== 'ALL' && action.departmentId !== selectedDeptId) {
          return false;
        }

        // Actioner
        if (selectedActionerId !== 'ALL' && action.assignedToUserId !== selectedActionerId) {
          return false;
        }

        // Risk Level
        if (selectedRisk !== 'ALL' && action.riskLevel !== selectedRisk) {
          return false;
        }

        // Status (Derived Overdue handling)
        const overdue = isActionOverdue(action.dueDate, action.status);
        if (selectedStatus === 'Overdue') {
          if (!overdue) return false;
        } else if (selectedStatus !== 'ALL') {
          if (action.status !== selectedStatus) return false;
        }

        // Due Date Preset Filter
        if (selectedDueDateFilter === 'overdue') {
          if (!overdue) return false;
        } else if (selectedDueDateFilter === 'due_today') {
          const todayStr = today.toISOString().split('T')[0];
          if (action.dueDate !== todayStr) return false;
        } else if (selectedDueDateFilter === 'due_7_days') {
          if (!action.dueDate) return false;
          const dueMs = new Date(action.dueDate).getTime();
          const next7Ms = today.getTime() + 7 * 24 * 60 * 60 * 1000;
          if (dueMs < today.getTime() || dueMs > next7Ms) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aOverdue = isActionOverdue(a.dueDate, a.status);
        const bOverdue = isActionOverdue(b.dueDate, b.status);

        if (sortOrder === 'overdue_first') {
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          if (aOverdue && bOverdue) {
            const daysA = getDaysOverdue(a.dueDate, a.status);
            const daysB = getDaysOverdue(b.dueDate, b.status);
            return daysB - daysA;
          }
          return (a.dueDate || '').localeCompare(b.dueDate || '');
        }

        if (sortOrder === 'due_asc') {
          return (a.dueDate || '').localeCompare(b.dueDate || '');
        }

        if (sortOrder === 'due_desc') {
          return (b.dueDate || '').localeCompare(a.dueDate || '');
        }

        if (sortOrder === 'updated_desc') {
          return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
        }

        return 0;
      });
  }, [
    actions,
    searchQuery,
    selectedDeptId,
    selectedActionerId,
    selectedStatus,
    selectedRisk,
    selectedDueDateFilter,
    sortOrder,
  ]);

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'Critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
            <Flame className="h-3 w-3 text-red-600" />
            Critical
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
            <ShieldAlert className="h-3 w-3 text-orange-600" />
            High
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (action: Action) => {
    const overdue = isActionOverdue(action.dueDate, action.status);
    const days = getDaysOverdue(action.dueDate, action.status);

    if (overdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
          <AlertTriangle className="h-3 w-3 text-rose-600" />
          Overdue (+{days}d)
        </span>
      );
    }

    switch (action.status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <PlayCircle className="h-3 w-3 text-amber-600" />
            In Progress
          </span>
        );
      case 'Closed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <Clock className="h-3 w-3 text-sky-600" />
            Open
          </span>
        );
    }
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedDeptId !== 'ALL' ||
    selectedActionerId !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedRisk !== 'ALL' ||
    selectedDueDateFilter !== 'ALL' ||
    sortOrder !== 'overdue_first';

  return (
    <div id="admin-action-list-view" className="space-y-4 max-w-7xl mx-auto">
      {/* Search & Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="input-search-actions"
              type="text"
              placeholder="Search action, inspection, department, or actioner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900"
            />
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filters
              </button>
            )}

            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Actioner */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Actioner
            </label>
            <select
              value={selectedActionerId}
              onChange={(e) => setSelectedActionerId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 font-medium text-slate-800"
            >
              <option value="ALL">All Actioners</option>
              {actioners.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Department
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 font-medium text-slate-800"
            >
              <option value="ALL">All Departments</option>
              {departments
                .filter((d) => d.active)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 font-medium text-slate-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="Overdue">Overdue</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Risk Level */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Risk Rating
            </label>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 font-medium text-slate-800"
            >
              <option value="ALL">All Risks</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Due Date Preset */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Due Date Scope
            </label>
            <select
              value={selectedDueDateFilter}
              onChange={(e) => setSelectedDueDateFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 font-medium text-slate-800"
            >
              <option value="ALL">All Deadlines</option>
              <option value="overdue">Overdue Only</option>
              <option value="due_today">Due Today</option>
              <option value="due_7_days">Due Within 7 Days</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Sort Sequence
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 font-medium text-slate-800"
            >
              <option value="overdue_first">Overdue & Urgency First</option>
              <option value="due_asc">Due Date (Earliest First)</option>
              <option value="due_desc">Due Date (Latest First)</option>
              <option value="updated_desc">Recently Updated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Actions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>
            Displaying <strong className="text-slate-900">{filteredActions.length}</strong> of{' '}
            <strong className="text-slate-900">{actions.length}</strong> total actions
          </span>
          {initialFilters && Object.keys(initialFilters).length > 0 && (
            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200">
              Filtered from Dashboard Drill-down
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-300" />
            Loading corrective actions...
          </div>
        ) : filteredActions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No corrective actions match this filter query</p>
            <p className="text-slate-500 mt-1">Try clearing some filters or searching with different terms.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">Action Item</th>
                  <th scope="col" className="px-3 py-3">Audit No.</th>
                  <th scope="col" className="px-3 py-3">Department</th>
                  <th scope="col" className="px-3 py-3 text-center">Risk</th>
                  <th scope="col" className="px-3 py-3">Assigned Actioner</th>
                  <th scope="col" className="px-3 py-3 text-center">Due Date</th>
                  <th scope="col" className="px-3 py-3 text-center">Status</th>
                  <th scope="col" className="px-3 py-3">Last Updated</th>
                  <th scope="col" className="px-4 py-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActions.map((action) => {
                  const overdue = isActionOverdue(action.dueDate, action.status);
                  return (
                    <tr
                      key={action.id}
                      onClick={() => setSelectedAction(action)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer group ${
                        overdue ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-bold text-slate-900 group-hover:text-amber-700 truncate">
                          {action.title}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {action.description}
                        </p>
                      </td>

                      <td className="px-3 py-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                        {action.inspectionNumberSnapshot || 'N/A'}
                      </td>

                      <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                        <span className="flex items-center gap-1 font-medium">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          {action.departmentNameSnapshot || 'General'}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {getRiskBadge(action.riskLevel)}
                      </td>

                      <td className="px-3 py-3 text-slate-800 whitespace-nowrap">
                        <span className="flex items-center gap-1 font-medium">
                          <User className="h-3 w-3 text-slate-400" />
                          {action.assignedToUserNameSnapshot || 'Unassigned'}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center font-mono whitespace-nowrap">
                        <span className={overdue ? 'text-rose-700 font-bold' : 'text-slate-700'}>
                          {action.dueDate}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {getStatusBadge(action)}
                      </td>

                      <td className="px-3 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {action.updatedAt ? new Date(action.updatedAt).toLocaleDateString() : 'N/A'}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAction(action);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Detail Modal */}
      {selectedAction && (
        <AdminActionDetailModal
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          onActionUpdated={() => {
            loadData();
          }}
          onViewInspection={onViewInspection}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Calendar,
  Building2,
  User,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  Archive,
  ArrowUpDown,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Department, InspectionStatus } from '../../types/sheq';
import { EnrichedInspection, getInspectionsWithMetrics, deleteInspection } from '../../services/inspectionService';
import { getDepartments } from '../../services/departmentService';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { calculateDateRangeBounds, DateRangePreset } from '../../services/dashboardService';
import { ReportPreviewModal } from '../admin/reports/ReportPreviewModal';

interface InspectionListProps {
  onNewInspection: () => void;
  onSelectInspection: (inspectionId: string) => void;
  onEditInspection: (inspectionId: string) => void;
  initialFilters?: {
    departmentId?: string;
    status?: string;
    datePreset?: string;
    searchQuery?: string;
  };
}

export const InspectionList: React.FC<InspectionListProps> = ({
  onNewInspection,
  onSelectInspection,
  onEditInspection,
  initialFilters,
}) => {
  const [inspections, setInspections] = useState<EnrichedInspection[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState(initialFilters?.searchQuery || '');
  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialFilters?.departmentId || 'ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialFilters?.status || 'ALL');
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>(initialFilters?.datePreset || 'ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Deletion Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingInspection, setDeletingInspection] = useState<EnrichedInspection | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // PDF Report Modal State
  const [reportInspection, setReportInspection] = useState<EnrichedInspection | null>(null);

  // Keep state synchronized with incoming drill-down filters
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.departmentId) setSelectedDeptId(initialFilters.departmentId);
      if (initialFilters.status) setSelectedStatus(initialFilters.status);
      if (initialFilters.datePreset) setSelectedDatePreset(initialFilters.datePreset);
      if (initialFilters.searchQuery) setSearchQuery(initialFilters.searchQuery);
    }
  }, [initialFilters]);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg(null);

    try {
      const [insps, depts] = await Promise.all([
        getInspectionsWithMetrics(),
        getDepartments(),
      ]);
      setInspections(insps);
      setDepartments(depts);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(`Failed to load inspections: ${e.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter & Search Logic
  const filteredInspections = useMemo(() => {
    return inspections
      .filter((insp) => {
        // Search filter (number or title)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchNumber = insp.inspectionNumber.toLowerCase().includes(q);
          const matchTitle = insp.title.toLowerCase().includes(q);
          const matchInspector = insp.inspectorNameSnapshot.toLowerCase().includes(q);
          const matchDept = insp.departmentNameSnapshot.toLowerCase().includes(q);
          if (!matchNumber && !matchTitle && !matchInspector && !matchDept) {
            return false;
          }
        }

        // Department filter
        if (selectedDeptId !== 'ALL' && insp.departmentId !== selectedDeptId) {
          return false;
        }

        // Status filter
        if (selectedStatus !== 'ALL' && insp.status !== selectedStatus) {
          return false;
        }

        // Date preset filter
        if (selectedDatePreset !== 'ALL') {
          try {
            const bounds = calculateDateRangeBounds(selectedDatePreset as DateRangePreset);
            if (insp.inspectionDate < bounds.startDate || insp.inspectionDate > bounds.endDate) {
              return false;
            }
          } catch {
            // Ignore if invalid preset
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.inspectionDate).getTime();
        const dateB = new Date(b.inspectionDate).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [inspections, searchQuery, selectedDeptId, selectedStatus, selectedDatePreset, sortOrder]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = inspections.length;
    const drafts = inspections.filter((i) => i.status === 'Draft').length;
    const completed = inspections.filter((i) => i.status === 'Completed').length;
    const openActions = inspections.reduce((acc, i) => acc + i.openActionsCount, 0);
    return { total, drafts, completed, openActions };
  }, [inspections]);

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!deletingInspection) return;
    setDeletingLoading(true);
    try {
      await deleteInspection(deletingInspection.id);
      setInspections((prev) => prev.filter((i) => i.id !== deletingInspection.id));
      setDeleteModalOpen(false);
      setDeletingInspection(null);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(`Failed to delete inspection: ${e.message}`);
    } finally {
      setDeletingLoading(false);
    }
  };

  const getStatusBadge = (status: InspectionStatus) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Completed
          </span>
        );
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            Draft
          </span>
        );
      case 'Archived':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-200 text-slate-700 border border-slate-300">
            <Archive className="h-3.5 w-3.5 text-slate-600" />
            Archived
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Workplace Inspections
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {inspections.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Conduct, review, and manage industrial SHEQ walkthrough inspections and corrective actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onNewInspection}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            + New Inspection
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Inspections</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Active Drafts</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{metrics.drafts}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Completed Inspections</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{metrics.completed}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Open Corrective Actions</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{metrics.openActions}</div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by INS-#, title, inspector..."
              className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
            />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-800"
            >
              <option value="ALL">All Departments ({departments.length})</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Completed">Completed</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Date Scope Filter */}
          <div className="relative">
            <select
              value={selectedDatePreset}
              onChange={(e) => setSelectedDatePreset(e.target.value)}
              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-800"
            >
              <option value="ALL">All Dates</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="this_year">This Year</option>
              <option value="last_30_days">Last 30 Days</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
                Date: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </span>
            </button>
          </div>
        </div>

        {/* Active filter counter if applied */}
        {(searchQuery || selectedDeptId !== 'ALL' || selectedStatus !== 'ALL' || selectedDatePreset !== 'ALL') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {filteredInspections.length} of {inspections.length} inspections
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDeptId('ALL');
                setSelectedStatus('ALL');
                setSelectedDatePreset('ALL');
              }}
              className="text-xs font-semibold text-slate-800 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Inspections List View */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-slate-400 mb-2" />
          Loading inspection records...
        </div>
      ) : filteredInspections.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border-2 border-dashed border-slate-200 p-6">
          <ClipboardCheck className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No inspections found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {inspections.length === 0
              ? 'No inspections have been conducted yet. Click "+ New Inspection" to begin your first walkthrough inspection.'
              : 'No inspections match your active search or filter criteria. Try adjusting the filters above.'}
          </p>
          {inspections.length === 0 && (
            <button
              type="button"
              onClick={onNewInspection}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Start New Inspection
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 font-semibold">Inspection #</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold">Title</th>
                  <th className="py-3 px-4 font-semibold">Inspector</th>
                  <th className="py-3 px-4 font-semibold text-center">Findings</th>
                  <th className="py-3 px-4 font-semibold text-center">Open Actions</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInspections.map((insp) => (
                  <tr
                    key={insp.id}
                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                    onClick={() => onSelectInspection(insp.id)}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {insp.inspectionNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {insp.inspectionDate}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                        {insp.departmentNameSnapshot}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs truncate">
                      {insp.title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate max-w-[120px]">{insp.inspectorNameSnapshot}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {insp.findingsCount}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                          insp.openActionsCount > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {insp.openActionsCount}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(insp.status)}
                    </td>
                    <td
                      className="py-3.5 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setReportInspection(insp)}
                          title="Generate PDF Report"
                          className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-md cursor-pointer transition-colors"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectInspection(insp.id)}
                          title="View Inspection Details"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditInspection(insp.id)}
                          title="Edit Inspection"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingInspection(insp);
                            setDeleteModalOpen(true);
                          }}
                          title="Delete Inspection"
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Optimized Cards */}
          <div className="md:hidden space-y-3">
            {filteredInspections.map((insp) => (
              <div
                key={insp.id}
                onClick={() => onSelectInspection(insp.id)}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 active:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono font-bold text-sm text-slate-900">
                    {insp.inspectionNumber}
                  </div>
                  {getStatusBadge(insp.status)}
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900">{insp.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {insp.inspectionDate}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {insp.departmentNameSnapshot}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      {insp.findingsCount} findings
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-semibold ${
                        insp.openActionsCount > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {insp.openActionsCount} open actions
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setReportInspection(insp)}
                      title="Generate PDF Report"
                      className="p-1.5 text-slate-600 hover:text-amber-600 rounded-md"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditInspection(insp.id)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingInspection(insp);
                        setDeleteModalOpen(true);
                      }}
                      className="p-1.5 text-rose-600 hover:text-rose-800 rounded-md"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Required Deletion Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Delete Inspection"
        message="Are you sure you want to permanently delete this inspection and all associated findings and corrective actions?"
        confirmLabel="Permanently Delete"
        isDestructive={true}
        isLoading={deletingLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setDeletingInspection(null);
        }}
      />

      {/* PDF Inspection Report Modal */}
      {reportInspection && (
        <ReportPreviewModal
          inspection={reportInspection}
          onClose={() => setReportInspection(null)}
        />
      )}
    </div>
  );
};

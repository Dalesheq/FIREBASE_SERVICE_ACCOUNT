import React from 'react';
import {
  Calendar,
  Building2,
  User,
  AlertTriangle,
  Clock,
  Search,
  RotateCcw,
  SlidersHorizontal,
  Filter,
} from 'lucide-react';
import { Department, RiskLevel, ActionStatus } from '../../../types/sheq';
import { UserProfile } from '../../../types/auth';
import { DateRangePreset, DashboardFilterState } from '../../../services/dashboardService';

interface DashboardFilterBarProps {
  filters: DashboardFilterState;
  onFilterChange: (updates: Partial<DashboardFilterState>) => void;
  onResetFilters: () => void;
  departments: Department[];
  actioners: UserProfile[];
  totalScopeCount: {
    inspections: number;
    findings: number;
    actions: number;
  };
}

export const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  departments,
  actioners,
  totalScopeCount,
}) => {
  const isCustomRange = filters.dateRangePreset === 'custom';

  const hasActiveFilters =
    filters.dateRangePreset !== 'this_month' ||
    filters.departmentId !== 'ALL' ||
    filters.assignedToUserId !== 'ALL' ||
    filters.riskLevel !== 'ALL' ||
    filters.status !== 'ALL' ||
    Boolean(filters.searchQuery?.trim());

  return (
    <div
      id="dashboard-filter-bar"
      className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Operational Reporting Period & Filters
            </h2>
            <p className="text-xs text-slate-500">
              Filter SHEQ performance indicators by date window, department, risk, or actioner
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {hasActiveFilters && (
            <button
              id="btn-reset-filters"
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Reset all filters to current month"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          )}

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-[11px] font-medium text-slate-600 border border-slate-200">
            <Filter className="h-3 w-3 text-slate-400" />
            <span>Scope:</span>
            <span className="font-bold text-slate-800">{totalScopeCount.inspections}</span> insps
            <span className="text-slate-300">|</span>
            <span className="font-bold text-slate-800">{totalScopeCount.findings}</span> findings
            <span className="text-slate-300">|</span>
            <span className="font-bold text-slate-800">{totalScopeCount.actions}</span> actions
          </div>
        </div>
      </div>

      {/* Filter Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Date Preset Filter */}
        <div>
          <label
            htmlFor="filter-date-preset"
            className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
          >
            <Calendar className="inline-block h-3.5 w-3.5 mr-1 text-slate-400" />
            Reporting Period
          </label>
          <select
            id="filter-date-preset"
            value={filters.dateRangePreset}
            onChange={(e) => onFilterChange({ dateRangePreset: e.target.value as DateRangePreset })}
            className="w-full text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden transition-colors"
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="last_90_days">Last 90 Days</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Range...</option>
          </select>
        </div>

        {/* Department Filter */}
        <div>
          <label
            htmlFor="filter-department"
            className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
          >
            <Building2 className="inline-block h-3.5 w-3.5 mr-1 text-slate-400" />
            Department
          </label>
          <select
            id="filter-department"
            value={filters.departmentId}
            onChange={(e) => onFilterChange({ departmentId: e.target.value })}
            className="w-full text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden transition-colors"
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

        {/* Actioner Filter */}
        <div>
          <label
            htmlFor="filter-actioner"
            className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
          >
            <User className="inline-block h-3.5 w-3.5 mr-1 text-slate-400" />
            Actioner
          </label>
          <select
            id="filter-actioner"
            value={filters.assignedToUserId}
            onChange={(e) => onFilterChange({ assignedToUserId: e.target.value })}
            className="w-full text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden transition-colors"
          >
            <option value="ALL">All Actioners</option>
            {actioners.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.fullName}
              </option>
            ))}
          </select>
        </div>

        {/* Risk Level Filter */}
        <div>
          <label
            htmlFor="filter-risk"
            className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
          >
            <AlertTriangle className="inline-block h-3.5 w-3.5 mr-1 text-slate-400" />
            Risk Level
          </label>
          <select
            id="filter-risk"
            value={filters.riskLevel}
            onChange={(e) => onFilterChange({ riskLevel: e.target.value })}
            className="w-full text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden transition-colors"
          >
            <option value="ALL">All Risks</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label
            htmlFor="filter-status"
            className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
          >
            <Clock className="inline-block h-3.5 w-3.5 mr-1 text-slate-400" />
            Action Status
          </label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className="w-full text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden transition-colors"
          >
            <option value="ALL">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Overdue">Overdue (Derived)</option>
            <option value="Completed">Completed</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Custom Date Range Sub-Row (Rendered only when 'custom' is selected) */}
      {isCustomRange && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-amber-900">Custom Date Range:</span>
          <div className="flex items-center gap-2">
            <label htmlFor="custom-start-date" className="text-xs text-slate-600 font-medium">
              From:
            </label>
            <input
              id="custom-start-date"
              type="date"
              value={filters.customStartDate || ''}
              onChange={(e) => onFilterChange({ customStartDate: e.target.value })}
              className="text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1 text-slate-800 focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="custom-end-date" className="text-xs text-slate-600 font-medium">
              To:
            </label>
            <input
              id="custom-end-date"
              type="date"
              value={filters.customEndDate || ''}
              onChange={(e) => onFilterChange({ customEndDate: e.target.value })}
              className="text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1 text-slate-800 focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

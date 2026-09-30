import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  Building2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Filter,
  CheckCircle2,
  PlayCircle,
  FileQuestion,
  ShieldCheck,
} from 'lucide-react';
import { Action, RiskLevel } from '../../types/sheq';
import { sortActionsForActioner } from '../../services/actionService';
import { isActionOverdue } from '../../utils/validation';

interface ActionListProps {
  actions: Action[];
  selectedFilter: string;
  onSelectFilter: (filter: string) => void;
  onSelectAction: (action: Action) => void;
}

const RISK_BADGES: Record<RiskLevel, { label: string; bg: string; text: string; border: string }> = {
  Critical: { label: 'CRITICAL', bg: 'bg-red-500/10', text: 'text-red-700', border: 'border-red-300' },
  High: { label: 'HIGH RISK', bg: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-orange-300' },
  Medium: { label: 'MEDIUM RISK', bg: 'bg-amber-500/10', text: 'text-amber-700', border: 'border-amber-300' },
  Low: { label: 'LOW RISK', bg: 'bg-blue-500/10', text: 'text-blue-700', border: 'border-blue-300' },
};

export const ActionList: React.FC<ActionListProps> = ({
  actions,
  selectedFilter,
  onSelectFilter,
  onSelectAction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Filter by status / overdue / allocation history tab
  const filteredByTab = useMemo(() => {
    if (selectedFilter === 'all') return actions;
    if (selectedFilter === 'Active') {
      return actions.filter((a) => a.status === 'Open' || a.status === 'In Progress');
    }
    if (selectedFilter === 'History') {
      return actions.filter((a) => a.status === 'Completed' || a.status === 'Closed');
    }
    if (selectedFilter === 'Overdue') {
      return actions.filter((a) => isActionOverdue(a.dueDate, a.status));
    }
    return actions.filter((a) => a.status === selectedFilter);
  }, [actions, selectedFilter]);

  // 2. Filter by search query
  const filteredBySearch = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return filteredByTab;

    return filteredByTab.filter((a) => {
      const matchTitle = (a.title || '').toLowerCase().includes(term);
      const matchDesc = (a.description || '').toLowerCase().includes(term);
      const matchDept = (a.departmentNameSnapshot || '').toLowerCase().includes(term);
      const matchInspNum = (a.inspectionNumberSnapshot || '').toLowerCase().includes(term);
      const matchRisk = (a.riskLevel || '').toLowerCase().includes(term);
      return matchTitle || matchDesc || matchDept || matchInspNum || matchRisk;
    });
  }, [filteredByTab, searchTerm]);

  // 3. Apply standard Actioner specification sort order
  const sortedActions = useMemo(() => {
    return sortActionsForActioner(filteredBySearch);
  }, [filteredBySearch]);

  const filterTabs = [
    { id: 'all', label: 'All Allocated (Is & Was)' },
    { id: 'Active', label: 'Currently Allocated' },
    { id: 'History', label: 'Previously Allocated (Done)' },
    { id: 'Open', label: 'Open' },
    { id: 'In Progress', label: 'In Progress' },
    { id: 'Completed', label: 'Completed' },
    { id: 'Closed', label: 'Closed' },
    { id: 'Overdue', label: 'Overdue' },
  ];

  return (
    <div className="space-y-4">
      {/* Controls Bar: Search & Quick Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="actioner-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by action title, description, department, or inspection #..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action Count indicator */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing <strong>{sortedActions.length}</strong> of <strong>{actions.length}</strong> actions assigned to you
        </span>
        {selectedFilter !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectFilter('all')}
            className="text-sky-600 hover:text-sky-800 font-semibold cursor-pointer"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Empty State */}
      {sortedActions.length === 0 && (
        <div
          id="actioner-empty-state"
          className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <FileQuestion className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No actions found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm
              ? `No actions matched your search "${searchTerm}". Try adjusting your keywords or clearing the filter.`
              : selectedFilter !== 'all'
              ? `You currently have no actions under the "${selectedFilter}" status.`
              : 'You do not have any corrective actions allocated to your profile at this time.'}
          </p>
          {(searchTerm || selectedFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                onSelectFilter('all');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
            >
              View All My Actions
            </button>
          )}
        </div>
      )}

      {/* Action Items Cards Grid */}
      <div id="actioner-items-list" className="space-y-3">
        {sortedActions.map((action) => {
          const overdue = isActionOverdue(action.dueDate, action.status);
          const risk = RISK_BADGES[action.riskLevel] || RISK_BADGES.Medium;

          return (
            <div
              key={action.id}
              id={`action-card-${action.id}`}
              onClick={() => onSelectAction(action)}
              className={`group bg-white rounded-xl border p-4 sm:p-5 transition-all duration-150 hover:shadow-md cursor-pointer ${
                overdue
                  ? 'border-red-300 bg-red-50/10 hover:border-red-400 ring-1 ring-red-300/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Left Content */}
                <div className="space-y-2 flex-1 min-w-0">
                  {/* Meta pill row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Inspection number */}
                    <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {action.inspectionNumberSnapshot || `INS-${action.inspectionId.substring(0, 8)}`}
                    </span>

                    {/* Department */}
                    <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                      <Building2 className="h-3 w-3 text-slate-400" />
                      {action.departmentNameSnapshot || 'Workplace Department'}
                    </span>

                    {/* Risk Level */}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${risk.bg} ${risk.text} ${risk.border}`}
                    >
                      {risk.label}
                    </span>

                    {/* Overdue Badge */}
                    {overdue && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        OVERDUE
                      </span>
                    )}

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        action.status === 'Closed'
                          ? 'bg-slate-800 text-white border-slate-900'
                          : action.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : action.status === 'In Progress'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-sky-100 text-sky-800 border-sky-300'
                      }`}
                    >
                      {action.status === 'Closed' ? 'Closed (Verified)' : action.status}
                    </span>
                  </div>

                  {/* Action Title */}
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                    {action.title}
                  </h4>

                  {/* Action Recommended Instruction */}
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {action.description}
                  </p>

                  {/* Details row: Due Date & Comments snippet */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <div
                      className={`flex items-center gap-1 font-medium ${
                        overdue ? 'text-red-700 font-bold' : 'text-slate-600'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Due Date: <span>{action.dueDate}</span>
                    </div>

                    {action.actionerComments && (
                      <div className="flex items-center gap-1 text-slate-500 italic max-w-xs truncate">
                        <span className="font-semibold not-italic">Notes:</span> {action.actionerComments}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Action Trigger Button */}
                <div className="flex items-center sm:self-center shrink-0 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAction(action);
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 group-hover:text-white bg-slate-100 group-hover:bg-slate-900 border border-slate-300 group-hover:border-slate-900 transition-all duration-150 min-h-[44px] cursor-pointer shadow-xs"
                  >
                    <span>View & Update</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React from 'react';
import {
  ClipboardCheck,
  CalendarCheck,
  AlertOctagon,
  Clock,
  PlayCircle,
  CheckCircle2,
  CheckCheck,
  FileEdit,
  AlertTriangle,
  Flame,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import { DashboardKPICounters } from '../../../services/dashboardService';

interface DashboardKPICardsProps {
  kpis: DashboardKPICounters;
  onDrillDown: (type: 'inspections' | 'findings' | 'actions', filterParam?: Record<string, string>) => void;
}

export const DashboardKPICards: React.FC<DashboardKPICardsProps> = ({ kpis, onDrillDown }) => {
  return (
    <div id="dashboard-kpi-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2.5">
      {/* 1. Total Inspections */}
      <div
        id="kpi-total-inspections"
        onClick={() => onDrillDown('inspections')}
        className="group bg-white rounded-xl border border-slate-200 p-3 shadow-xs hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
            Total Insps
          </span>
          <ClipboardCheck className="h-3.5 w-3.5 text-sky-600 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-extrabold text-slate-900 tracking-tight">
            {kpis.totalInspections}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className="text-[9px] text-slate-400 mt-1 truncate">In period</p>
      </div>

      {/* 2. Draft Inspections */}
      <div
        id="kpi-draft-inspections"
        onClick={() => onDrillDown('inspections', { status: 'Draft' })}
        className="group bg-white rounded-xl border border-slate-200 p-3 shadow-xs hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
            Draft Insps
          </span>
          <FileEdit className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-extrabold text-amber-700 tracking-tight">
            {kpis.draftInspections}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className="text-[9px] text-slate-400 mt-1 truncate">In progress</p>
      </div>

      {/* 3. Completed Inspections */}
      <div
        id="kpi-completed-inspections"
        onClick={() => onDrillDown('inspections', { status: 'Completed' })}
        className="group bg-white rounded-xl border border-slate-200 p-3 shadow-xs hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
            Completed Insps
          </span>
          <CalendarCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-extrabold text-emerald-700 tracking-tight">
            {kpis.completedInspections}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className="text-[9px] text-slate-400 mt-1 truncate">Submitted</p>
      </div>

      {/* 3. Total Findings */}
      <div
        id="kpi-total-findings"
        onClick={() => onDrillDown('findings')}
        className="group bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
            Total Findings
          </span>
          <AlertOctagon className="h-4 w-4 text-amber-600 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {kpis.totalFindings}
          </span>
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className="text-[10px] text-slate-400 mt-1 truncate">Non-conformances</p>
      </div>

      {/* 4. Open Actions */}
      <div
        id="kpi-open-actions"
        onClick={() => onDrillDown('actions', { status: 'Open' })}
        className="group bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-sky-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
            Open Actions
          </span>
          <Clock className="h-4 w-4 text-sky-500 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-extrabold text-sky-700 tracking-tight">
            {kpis.openActions}
          </span>
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className="text-[10px] text-slate-400 mt-1 truncate">Pending actioner start</p>
      </div>

      {/* 5. In Progress Actions */}
      <div
        id="kpi-inprogress-actions"
        onClick={() => onDrillDown('actions', { status: 'In Progress' })}
        className="group bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
            In Progress
          </span>
          <PlayCircle className="h-4 w-4 text-amber-500 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-extrabold text-amber-700 tracking-tight">
            {kpis.inProgressActions}
          </span>
          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className="text-[10px] text-slate-400 mt-1 truncate">Remediation active</p>
      </div>

      {/* 6. Completed Actions */}
      <div
        id="kpi-completed-actions"
        onClick={() => onDrillDown('actions', { status: 'Completed' })}
        className="group bg-white rounded-xl border border-slate-200 p-3 shadow-xs hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
            Completed
          </span>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-extrabold text-emerald-700 tracking-tight">
            {kpis.completedActions}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className="text-[9px] text-slate-400 mt-1 truncate">Ready for review</p>
      </div>

      {/* 7. Closed Actions */}
      <div
        id="kpi-closed-actions"
        onClick={() => onDrillDown('actions', { status: 'Closed' })}
        className="group bg-white rounded-xl border border-slate-200 p-3 shadow-xs hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
            Closed
          </span>
          <CheckCheck className="h-3.5 w-3.5 text-slate-600 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-extrabold text-slate-800 tracking-tight">
            {kpis.closedActions}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className="text-[9px] text-slate-400 mt-1 truncate">Verified closed</p>
      </div>

      {/* 8. Overdue Actions (High Alert) */}
      <div
        id="kpi-overdue-actions"
        onClick={() => onDrillDown('actions', { status: 'Overdue' })}
        className={`group rounded-xl p-3 shadow-xs transition-all cursor-pointer flex flex-col justify-between ${
          kpis.overdueActions > 0
            ? 'bg-rose-50/70 border-2 border-rose-400 hover:border-rose-600 hover:shadow-md'
            : 'bg-white border border-slate-200 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${
            kpis.overdueActions > 0 ? 'text-rose-800' : 'text-slate-500'
          }`}>
            Overdue
          </span>
          <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${
            kpis.overdueActions > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'
          }`} />
        </div>
        <div className="flex items-baseline justify-between">
          <span className={`text-xl font-black tracking-tight ${
            kpis.overdueActions > 0 ? 'text-rose-700' : 'text-slate-900'
          }`}>
            {kpis.overdueActions}
          </span>
          <ChevronRight className={`h-3.5 w-3.5 group-hover:translate-x-0.5 transition-all ${
            kpis.overdueActions > 0 ? 'text-rose-500 group-hover:text-rose-700' : 'text-slate-300'
          }`} />
        </div>
        <p className={`text-[9px] mt-1 truncate ${
          kpis.overdueActions > 0 ? 'text-rose-600 font-medium' : 'text-slate-400'
        }`}>
          {kpis.overdueActions > 0 ? 'Requires action' : 'Zero overdue'}
        </p>
      </div>

      {/* 9. Critical Findings */}
      <div
        id="kpi-critical-findings"
        onClick={() => onDrillDown('findings', { riskLevel: 'Critical' })}
        className={`group rounded-xl p-3 shadow-xs transition-all cursor-pointer flex flex-col justify-between ${
          kpis.criticalFindings > 0
            ? 'bg-red-50/80 border border-red-300 hover:border-red-500 hover:shadow-sm'
            : 'bg-white border border-slate-200 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${
            kpis.criticalFindings > 0 ? 'text-red-800' : 'text-slate-500'
          }`}>
            Critical
          </span>
          <Flame className={`h-3.5 w-3.5 shrink-0 ${
            kpis.criticalFindings > 0 ? 'text-red-600' : 'text-slate-400'
          }`} />
        </div>
        <div className="flex items-baseline justify-between">
          <span className={`text-xl font-extrabold tracking-tight ${
            kpis.criticalFindings > 0 ? 'text-red-700' : 'text-slate-900'
          }`}>
            {kpis.criticalFindings}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className={`text-[9px] mt-1 truncate ${
          kpis.criticalFindings > 0 ? 'text-red-600 font-medium' : 'text-slate-400'
        }`}>
          High hazard
        </p>
      </div>

      {/* 10. High-Risk Findings */}
      <div
        id="kpi-high-risk-findings"
        onClick={() => onDrillDown('findings', { riskLevel: 'High' })}
        className={`group rounded-xl p-3 shadow-xs transition-all cursor-pointer flex flex-col justify-between ${
          kpis.highRiskFindings > 0
            ? 'bg-orange-50/70 border border-orange-300 hover:border-orange-500 hover:shadow-sm'
            : 'bg-white border border-slate-200 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${
            kpis.highRiskFindings > 0 ? 'text-orange-800' : 'text-slate-500'
          }`}>
            High Risk
          </span>
          <ShieldAlert className={`h-3.5 w-3.5 shrink-0 ${
            kpis.highRiskFindings > 0 ? 'text-orange-600' : 'text-slate-400'
          }`} />
        </div>
        <div className="flex items-baseline justify-between">
          <span className={`text-xl font-extrabold tracking-tight ${
            kpis.highRiskFindings > 0 ? 'text-orange-700' : 'text-slate-900'
          }`}>
            {kpis.highRiskFindings}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <p className={`text-[9px] mt-1 truncate ${
          kpis.highRiskFindings > 0 ? 'text-orange-600 font-medium' : 'text-slate-400'
        }`}>
          Significant hazard
        </p>
      </div>
    </div>
  );
};

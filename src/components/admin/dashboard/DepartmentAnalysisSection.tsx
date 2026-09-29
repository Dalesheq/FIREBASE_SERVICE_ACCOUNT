import React from 'react';
import { DepartmentAnalysisDataPoint } from '../../../services/dashboardService';
import { Building2, AlertTriangle, ArrowRight, CheckCircle2, Clock } from 'lucide-react';

interface DepartmentAnalysisSectionProps {
  data: DepartmentAnalysisDataPoint[];
  onSelectDepartment: (departmentId: string) => void;
}

export const DepartmentAnalysisSection: React.FC<DepartmentAnalysisSectionProps> = ({
  data,
  onSelectDepartment,
}) => {
  return (
    <div id="section-department-analysis" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Department Non-Conformance & Actions Analysis</h3>
            <p className="text-xs text-slate-500">
              Identify workshop facilities with high finding density and pending corrective actions
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-medium">
          {data.length} active departments analysed
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-4 py-3">Department</th>
              <th scope="col" className="px-3 py-3 text-center">Inspections</th>
              <th scope="col" className="px-3 py-3 text-center">Findings Logged</th>
              <th scope="col" className="px-3 py-3 text-center">Open Actions</th>
              <th scope="col" className="px-3 py-3 text-center">Overdue Actions</th>
              <th scope="col" className="px-3 py-3 text-center">Completed / Closed</th>
              <th scope="col" className="px-4 py-3 text-right">Drill-down</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No department activity found in the current reporting scope.
                </td>
              </tr>
            ) : (
              data.map((dept) => {
                const hasOverdue = dept.overdueActionsCount > 0;
                return (
                  <tr
                    key={dept.departmentId}
                    onClick={() => onSelectDepartment(dept.departmentId)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-amber-500 transition-colors" />
                      <span>{dept.departmentName}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700">
                        {dept.inspectionsCount}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-800">
                        {dept.findingsCount}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center gap-1 font-semibold text-sky-700">
                        <Clock className="h-3 w-3 text-sky-500" />
                        {dept.openActionsCount}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {hasOverdue ? (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full border border-rose-200">
                          <AlertTriangle className="h-3 w-3 text-rose-600" />
                          {dept.overdueActionsCount} Overdue
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        {dept.completedActionsCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDepartment(dept.departmentId);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                      >
                        View Actions
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

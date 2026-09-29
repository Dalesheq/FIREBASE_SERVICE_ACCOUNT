import React from 'react';
import { OverdueActionItem } from '../../../services/dashboardService';
import {
  AlertTriangle,
  Calendar,
  User,
  Building2,
  ChevronRight,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import { RiskLevel } from '../../../types/sheq';

interface OverdueActionsSectionProps {
  items: OverdueActionItem[];
  onOpenActionDetail: (actionId: string, inspectionId: string) => void;
  onViewAllOverdue: () => void;
}

export const OverdueActionsSection: React.FC<OverdueActionsSectionProps> = ({
  items,
  onOpenActionDetail,
  onViewAllOverdue,
}) => {
  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'Critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 text-red-800 border border-red-200">
            <Flame className="h-3 w-3 text-red-600" />
            Critical
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
            <ShieldAlert className="h-3 w-3 text-orange-600" />
            High
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            Low
          </span>
        );
    }
  };

  return (
    <div
      id="section-overdue-actions"
      className={`rounded-xl border shadow-xs overflow-hidden transition-all ${
        items.length > 0
          ? 'bg-white border-rose-300 ring-1 ring-rose-200'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="p-4 sm:p-5 border-b border-rose-100 bg-rose-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-rose-950">
                Critical Priority: Overdue Corrective Actions
              </h3>
              {items.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-black animate-pulse">
                  {items.length} OVERDUE
                </span>
              )}
            </div>
            <p className="text-xs text-rose-800/80">
              Actions where deadline has expired without closure, sorted by longest overdue and risk severity
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={onViewAllOverdue}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Manage All in Actions Directory
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center bg-white flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 border border-emerald-100">
            <Calendar className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Overdue Actions</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            All corrective actions in the selected scope are currently progressing within their allotted due dates or have been completed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-rose-50/70 border-b border-rose-100 text-[11px] font-bold text-rose-900 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3">Inspection</th>
                <th scope="col" className="px-3 py-3">Department</th>
                <th scope="col" className="px-4 py-3">Finding & Remedial Action</th>
                <th scope="col" className="px-3 py-3">Assigned Actioner</th>
                <th scope="col" className="px-3 py-3 text-center">Risk Level</th>
                <th scope="col" className="px-3 py-3 text-center">Target Due Date</th>
                <th scope="col" className="px-3 py-3 text-center">Days Overdue</th>
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50">
              {items.map((item) => (
                <tr
                  key={item.action.id}
                  onClick={() => onOpenActionDetail(item.action.id, item.action.inspectionId)}
                  className="hover:bg-rose-50/40 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-3 font-mono font-bold text-slate-800 group-hover:text-rose-700 whitespace-nowrap">
                    {item.inspectionNumber}
                  </td>
                  <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Building2 className="h-3 w-3 text-slate-400" />
                      {item.departmentName}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-semibold text-slate-900 truncate">
                      {item.action.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.action.description || item.findingTitle}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate-800 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 font-medium">
                      <User className="h-3 w-3 text-slate-400" />
                      {item.action.assignedToUserNameSnapshot || 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    {getRiskBadge(item.action.riskLevel)}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-slate-700 whitespace-nowrap">
                    {item.action.dueDate}
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full font-black text-[11px] bg-rose-100 text-rose-800 border border-rose-300">
                      +{item.daysOverdue} days
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenActionDetail(item.action.id, item.action.inspectionId);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 hover:underline cursor-pointer"
                    >
                      Inspect Detail
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

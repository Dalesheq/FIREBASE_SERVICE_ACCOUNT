import React from 'react';
import { RecentInspectionItem } from '../../../services/dashboardService';
import { ClipboardCheck, Building2, User, Eye, CheckCircle2, Clock } from 'lucide-react';

interface RecentInspectionsSectionProps {
  items: RecentInspectionItem[];
  onViewInspection: (inspectionId: string) => void;
  onViewAllInspections: () => void;
}

export const RecentInspectionsSection: React.FC<RecentInspectionsSectionProps> = ({
  items,
  onViewInspection,
  onViewAllInspections,
}) => {
  return (
    <div id="section-recent-inspections" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
      <div>
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent SHEQ Inspections</h3>
              <p className="text-xs text-slate-500">Latest inspection audits executed across site facilities</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onViewAllInspections}
            className="text-xs font-semibold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
          >
            Directory ({items.length})
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3">Audit No.</th>
                <th scope="col" className="px-3 py-3">Date</th>
                <th scope="col" className="px-3 py-3">Department</th>
                <th scope="col" className="px-3 py-3">Lead Inspector</th>
                <th scope="col" className="px-2 py-3 text-center">Findings</th>
                <th scope="col" className="px-2 py-3 text-center">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    No inspection records found in current scope.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onViewInspection(item.id)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 group-hover:text-sky-600 whitespace-nowrap">
                      {item.inspectionNumber}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {item.inspectionDate}
                    </td>
                    <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {item.departmentName}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        {item.inspectorName}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                          {item.findingsCount} total
                        </span>
                        {item.openActionsCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-600">
                            <Clock className="h-2.5 w-2.5" />
                            {item.openActionsCount} open
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'Draft'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewInspection(item.id);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-3 bg-slate-50/60 border-t border-slate-100 text-right">
        <button
          type="button"
          onClick={onViewAllInspections}
          className="text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
        >
          Open Full Inspections Directory &rarr;
        </button>
      </div>
    </div>
  );
};

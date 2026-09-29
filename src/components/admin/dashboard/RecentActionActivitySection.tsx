import React from 'react';
import { RecentActionActivityItem } from '../../../services/dashboardService';
import { Activity, Clock, CheckCircle2, PlayCircle, AlertTriangle, ChevronRight, User } from 'lucide-react';
import { ActionStatus } from '../../../types/sheq';

interface RecentActionActivitySectionProps {
  items: RecentActionActivityItem[];
  onOpenActionDetail: (actionId: string) => void;
  onViewAllActions: () => void;
}

export const RecentActionActivitySection: React.FC<RecentActionActivitySectionProps> = ({
  items,
  onOpenActionDetail,
  onViewAllActions,
}) => {
  const getStatusBadge = (effectiveStatus: ActionStatus) => {
    switch (effectiveStatus) {
      case 'Overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="h-2.5 w-2.5 text-rose-600" />
            Overdue
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
            Completed
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <PlayCircle className="h-2.5 w-2.5 text-amber-600" />
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
            <Clock className="h-2.5 w-2.5 text-sky-600" />
            Open
          </span>
        );
    }
  };

  const formatTimeAgo = (isoDate: string) => {
    try {
      const now = new Date();
      const past = new Date(isoDate);
      const diffSec = Math.floor((now.getTime() - past.getTime()) / 1000);

      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays <= 7) return `${diffDays}d ago`;
      return past.toISOString().split('T')[0];
    } catch {
      return isoDate;
    }
  };

  return (
    <div id="section-recent-action-activity" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
      <div>
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Corrective Action Activity</h3>
              <p className="text-xs text-slate-500">Live operational log of progress notes and state transitions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onViewAllActions}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
          >
            All Actions ({items.length})
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No recent corrective action updates found.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenActionDetail(item.id)}
                className="p-3 sm:px-5 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-[11px] font-bold text-slate-700">
                      {item.inspectionNumber}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-xs text-slate-500 truncate">
                      {item.departmentName}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-900 truncate group-hover:text-indigo-600">
                    {item.actionTitle}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400" />
                      {item.actionerName}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-slate-400">
                      {formatTimeAgo(item.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(item.effectiveStatus)}
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-3 bg-slate-50/60 border-t border-slate-100 text-right">
        <button
          type="button"
          onClick={onViewAllActions}
          className="text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
        >
          Open Actions Directory &rarr;
        </button>
      </div>
    </div>
  );
};

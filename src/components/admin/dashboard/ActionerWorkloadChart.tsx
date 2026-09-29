import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ActionerWorkloadDataPoint } from '../../../services/dashboardService';
import { Users, ChevronRight, UserCheck } from 'lucide-react';

interface ActionerWorkloadChartProps {
  data: ActionerWorkloadDataPoint[];
  onSelectActioner: (userId: string) => void;
}

export const ActionerWorkloadChart: React.FC<ActionerWorkloadChartProps> = ({
  data,
  onSelectActioner,
}) => {
  return (
    <div id="chart-actioner-workload" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Actioner Workload & Accountability</h3>
            <p className="text-xs text-slate-500">Corrective actions assigned per operational assignee</p>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
          <p>No actioners registered or active in current scope</p>
        </div>
      ) : (
        <div className="h-56 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const clicked = state.activePayload[0].payload as ActionerWorkloadDataPoint;
                  onSelectActioner(clicked.userId);
                }
              }}
            >
              <XAxis
                dataKey="displayName"
                tick={{ fontSize: 11, fill: '#334155' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as ActionerWorkloadDataPoint;
                    return (
                      <div className="bg-slate-900 text-white text-xs p-3 rounded-lg shadow-md border border-slate-700 min-w-44">
                        <p className="font-bold text-indigo-300 border-b border-slate-700 pb-1 mb-1.5 flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5" />
                          {item.displayName}
                        </p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Assigned:</span>
                            <span className="font-bold text-white">{item.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-rose-300">Overdue:</span>
                            <span className="font-bold text-rose-400">{item.overdue}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sky-300">Open:</span>
                            <span className="font-bold text-sky-400">{item.open}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-300">In Progress:</span>
                            <span className="font-bold text-amber-400">{item.inProgress}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-300">Completed:</span>
                            <span className="font-bold text-emerald-400">{item.completed}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-indigo-300 mt-2 border-t border-slate-700 pt-1">
                          Click to filter actions by this actioner
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                wrapperStyle={{ fontSize: 10, paddingBottom: 8 }}
              />
              <Bar dataKey="overdue" name="Overdue" fill="#ef4444" stackId="a" />
              <Bar dataKey="open" name="Open" fill="#3b82f6" stackId="a" />
              <Bar dataKey="inProgress" name="In Progress" fill="#f59e0b" stackId="a" />
              <Bar dataKey="completed" name="Completed" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Actioner Cards Mini-Row for Direct Click */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-100 mt-2">
        {data.map((actioner) => (
          <button
            key={actioner.userId}
            type="button"
            onClick={() => onSelectActioner(actioner.userId)}
            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-300 transition-all text-left cursor-pointer group"
          >
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 block truncate">
                {actioner.displayName}
              </span>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                <span>Total: <strong className="text-slate-700">{actioner.total}</strong></span>
                {actioner.overdue > 0 && (
                  <span className="text-rose-600 font-bold bg-rose-100/80 px-1 rounded">
                    {actioner.overdue} Overdue
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
};

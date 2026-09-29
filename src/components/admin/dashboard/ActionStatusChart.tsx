import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ActionStatusDataPoint } from '../../../services/dashboardService';
import { PieChart, Info } from 'lucide-react';

interface ActionStatusChartProps {
  data: ActionStatusDataPoint[];
  onSelectStatus: (status: string) => void;
}

export const ActionStatusChart: React.FC<ActionStatusChartProps> = ({ data, onSelectStatus }) => {
  const total = data.reduce((acc, item) => acc + item.count, 0);

  return (
    <div id="chart-action-status" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <PieChart className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Corrective Action Status Distribution</h3>
            <p className="text-xs text-slate-500">
              Total actions in scope: <strong className="text-slate-800">{total}</strong>
            </p>
          </div>
        </div>
        <div className="group relative">
          <Info className="h-4 w-4 text-slate-400 cursor-help" />
          <div className="absolute right-0 top-6 hidden group-hover:block z-20 w-64 p-2.5 bg-slate-900 text-white text-[11px] rounded-lg shadow-lg leading-relaxed">
            Overdue actions are derived (dueDate &lt; today & not completed). Non-overdue Open and In Progress actions are separated to prevent double-counting.
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
          <p>No actions found matching current filter scope</p>
        </div>
      ) : (
        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -15, bottom: 20 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const clickedItem = state.activePayload[0].payload as ActionStatusDataPoint;
                  onSelectStatus(clickedItem.status);
                }
              }}
            >
              <XAxis
                dataKey="status"
                tick={{ fontSize: 11, fill: '#64748b' }}
                interval={0}
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
                    const item = payload[0].payload as ActionStatusDataPoint;
                    const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';
                    return (
                      <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-md border border-slate-700">
                        <div className="font-bold flex items-center gap-1.5 mb-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span>{item.status}</span>
                        </div>
                        <p className="text-slate-300">
                          Count: <span className="font-semibold text-white">{item.count}</span> ({pct}%)
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">{item.description}</p>
                        <p className="text-[10px] text-amber-300 mt-1">Click bar to filter list</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} className="cursor-pointer">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Breakdown Legend Pill Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-3 border-t border-slate-100 mt-2">
        {data.map((item) => (
          <button
            key={item.status}
            type="button"
            onClick={() => onSelectStatus(item.status)}
            className="flex items-center justify-between p-1.5 rounded-md hover:bg-slate-50 transition-colors text-left group"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] font-medium text-slate-600 truncate group-hover:text-slate-900">
                {item.status}
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-900 ml-1">
              {item.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

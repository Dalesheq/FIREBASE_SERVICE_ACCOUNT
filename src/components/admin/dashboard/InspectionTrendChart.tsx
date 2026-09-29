import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { InspectionTrendDataPoint } from '../../../services/dashboardService';
import { TrendingUp, Calendar } from 'lucide-react';

interface InspectionTrendChartProps {
  data: InspectionTrendDataPoint[];
  dateRangeLabel: string;
  onDrillDownInspections: () => void;
}

export const InspectionTrendChart: React.FC<InspectionTrendChartProps> = ({
  data,
  dateRangeLabel,
  onDrillDownInspections,
}) => {
  const totalInspections = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div id="chart-inspection-trend" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Inspection Velocity & Volume Trend</h3>
            <p className="text-xs text-slate-500">
              Aggregated over <span className="font-medium text-slate-700">{dateRangeLabel}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDrillDownInspections}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
        >
          View All ({totalInspections})
        </button>
      </div>

      {data.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
          <Calendar className="h-6 w-6 text-slate-300 mb-1" />
          <p>No inspection records logged in this timeframe</p>
        </div>
      ) : (
        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <defs>
                <linearGradient id="inspectionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as InspectionTrendDataPoint;
                    return (
                      <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-md border border-slate-700">
                        <p className="font-semibold text-emerald-400">{item.dateKey}</p>
                        <p className="text-slate-200 mt-1">
                          Inspections Conducted:{' '}
                          <span className="font-bold text-white">{item.count}</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#inspectionGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-500 mt-2">
        <span>Timeline metric based on authoritative <code className="text-slate-700 font-mono">inspectionDate</code></span>
        <span className="font-semibold text-slate-700">{totalInspections} audits executed</span>
      </div>
    </div>
  );
};

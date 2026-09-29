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
import { RiskLevelDataPoint } from '../../../services/dashboardService';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface RiskAnalysisChartProps {
  data: RiskLevelDataPoint[];
  onSelectRisk: (risk: string) => void;
}

export const RiskAnalysisChart: React.FC<RiskAnalysisChartProps> = ({ data, onSelectRisk }) => {
  const total = data.reduce((acc, curr) => acc + curr.count, 0);
  const criticalAndHigh = data
    .filter((d) => d.riskLevel === 'Critical' || d.riskLevel === 'High')
    .reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div id="chart-risk-analysis" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Findings Risk Matrix</h3>
            <p className="text-xs text-slate-500">
              Severity distribution from authoritative <span className="font-mono text-slate-700">findings</span>
            </p>
          </div>
        </div>

        {criticalAndHigh > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-200">
            <AlertTriangle className="h-3 w-3 text-rose-600" />
            {criticalAndHigh} High/Critical
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
          <p>No non-conformances identified in current scope</p>
        </div>
      ) : (
        <div className="h-56 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const clicked = state.activePayload[0].payload as RiskLevelDataPoint;
                  onSelectRisk(clicked.riskLevel);
                }
              }}
            >
              <XAxis
                dataKey="riskLevel"
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
                    const item = payload[0].payload as RiskLevelDataPoint;
                    const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';
                    return (
                      <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-md border border-slate-700">
                        <p className="font-bold text-white flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.riskLevel} Risk Severity
                        </p>
                        <p className="text-slate-300 mt-1">
                          Findings Count: <strong className="text-white">{item.count}</strong> ({pct}%)
                        </p>
                        <p className="text-[10px] text-amber-300 mt-1">Click to filter by {item.riskLevel}</p>
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

      {/* Risk Level Pills */}
      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 mt-2">
        {data.map((item) => (
          <button
            key={item.riskLevel}
            type="button"
            onClick={() => onSelectRisk(item.riskLevel)}
            className="flex flex-col items-center p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-center cursor-pointer group"
          >
            <span
              className="w-2.5 h-1 rounded-full mb-1"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-slate-900">
              {item.riskLevel}
            </span>
            <span className="text-xs font-black text-slate-900 mt-0.5">
              {item.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

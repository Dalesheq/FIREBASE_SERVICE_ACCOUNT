import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { Inspection, Department } from '../../../types/sheq';
import { getInspections } from '../../../services/inspectionService';
import { getDepartments } from '../../../services/departmentService';
import { ReportPreviewModal } from './ReportPreviewModal';

interface ExecutiveReportsViewProps {
  onViewInspectionDetail?: (id: string) => void;
}

export const ExecutiveReportsView: React.FC<ExecutiveReportsViewProps> = ({
  onViewInspectionDetail,
}) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'Draft' | 'Completed'>('ALL');

  // Selected inspection for report modal
  const [activeReportInspection, setActiveReportInspection] = useState<Inspection | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [insps, depts] = await Promise.all([
        getInspections(),
        getDepartments(),
      ]);
      setInspections(insps);
      setDepartments(depts);
    } catch (err) {
      console.error('Failed to load reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredInspections = inspections.filter((insp) => {
    if (selectedDeptId !== 'ALL' && insp.departmentId !== selectedDeptId) {
      return false;
    }
    if (selectedStatus !== 'ALL' && insp.status !== selectedStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const numMatch = insp.inspectionNumber.toLowerCase().includes(q);
      const titleMatch = insp.title.toLowerCase().includes(q);
      const deptMatch = insp.departmentNameSnapshot?.toLowerCase().includes(q);
      const inspMatch = insp.inspectorNameSnapshot?.toLowerCase().includes(q);
      return numMatch || titleMatch || deptMatch || inspMatch;
    }
    return true;
  });

  const completedCount = inspections.filter((i) => i.status === 'Completed').length;
  const draftCount = inspections.filter((i) => i.status === 'Draft').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <FileText className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Executive SHEQ Inspection Reports
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Generate, preview, print, and export authoritative workplace inspection reports with embedded high-resolution photo evidence.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Directory
        </button>
      </div>

      {/* Summary KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Available Reports</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{inspections.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Completed Audits</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{completedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">In-Progress Drafts</div>
            <div className="text-2xl font-black text-amber-600 mt-1">{draftCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by INS-#, title, inspector..."
              className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
            />
          </div>

          {/* Department */}
          <div>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="Completed">Completed Only</option>
              <option value="Draft">Draft Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <Clock className="h-6 w-6 animate-spin mx-auto text-slate-400 mb-2" />
            Loading inspection documents...
          </div>
        ) : filteredInspections.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText className="h-8 w-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900">No inspections match current criteria</h3>
            <p className="text-xs text-slate-500">
              Clear filters or conduct a new inspection from the directory.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="py-3 px-4">Inspection #</th>
                  <th className="py-3 px-4">Title & Details</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Inspector</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">PDF Report Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredInspections.map((insp, idx) => (
                  <tr
                    key={insp.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      idx % 2 === 1 ? 'bg-slate-50/50' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {insp.inspectionNumber}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 line-clamp-1">{insp.title}</div>
                      {insp.generalComments && (
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {insp.generalComments}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {insp.departmentNameSnapshot || '—'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {insp.inspectionDate}
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {insp.inspectorNameSnapshot || '—'}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          insp.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {insp.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {onViewInspectionDetail && (
                          <button
                            type="button"
                            onClick={() => onViewInspectionDetail(insp.id)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                            title="View Inspection Detail"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setActiveReportInspection(insp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-xs"
                        >
                          <FileText className="h-3.5 w-3.5 text-amber-400" />
                          Generate PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Preview & Download Modal */}
      {activeReportInspection && (
        <ReportPreviewModal
          inspection={activeReportInspection}
          onClose={() => setActiveReportInspection(null)}
        />
      )}
    </div>
  );
};

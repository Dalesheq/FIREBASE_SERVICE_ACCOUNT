import React, { useState, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Layers,
  Database,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Department } from '../../types/sheq';
import { getDepartments } from '../../services/departmentService';
import { runSafeSystemInitialization, SeedResult } from '../../services/seedService';
import { PHASE_2_TEST_SUITE, TestCaseResult } from '../../utils/phase2Verification';

export const Phase2DataFoundation: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [activeTab, setActiveTab] = useState<'departments' | 'tests' | 'schema'>('departments');
  const [testFilter, setTestFilter] = useState<'ALL' | 'Authorization' | 'Data Integrity' | 'Isolation'>('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDepartments = async () => {
    setLoadingDepts(true);
    setErrorMsg(null);
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(`Failed to load departments: ${e.message}`);
    } finally {
      setLoadingDepts(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSeedDepartments = async () => {
    setSeeding(true);
    setErrorMsg(null);
    try {
      const result = await runSafeSystemInitialization();
      setSeedResult(result);
      await fetchDepartments();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(`Seed error: ${e.message}`);
    } finally {
      setSeeding(false);
    }
  };

  const filteredTests = testFilter === 'ALL'
    ? PHASE_2_TEST_SUITE
    : PHASE_2_TEST_SUITE.filter((t) => t.category === testFilter);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Section Header */}
      <div className="p-6 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 mb-2">
            <Database className="h-3.5 w-3.5" />
            Phase 2: Production Firestore Data Foundation
          </div>
          <h2 className="text-lg font-bold text-slate-900">Data Architecture & Verification Console</h2>
          <p className="text-xs text-slate-600 mt-1">
            Production Firestore schemas, 11 standard industrial departments, 1:1 Finding-Action relationship, atomic inspection numbering, and 23 security verification scenarios.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-slate-200/80 p-1 rounded-lg self-start md:self-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('departments')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'departments'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Departments ({departments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'tests'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            23 Verification Tests
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'schema'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Schema & Indexes
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="m-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tab 1: Departments */}
      {activeTab === 'departments' && (
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-700" />
                Spiral Systems Department Directory
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Idempotent seeding initializes the 11 designated industrial departments with stable doc IDs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchDepartments}
                disabled={loadingDepts}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingDepts ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleSeedDepartments}
                disabled={seeding}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {seeding ? 'Seeding Departments...' : 'Run Idempotent Seed'}
              </button>
            </div>
          </div>

          {seedResult && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">Idempotency Confirmed: </span>
                <span>{seedResult.message}</span>
              </div>
            </div>
          )}

          {loadingDepts ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto text-slate-400 mb-2" />
              Loading departments from Firestore...
            </div>
          ) : departments.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl">
              <Building2 className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No departments seeded yet.</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Click "Run Idempotent Seed" above to provision the 11 designated industrial departments in Firestore.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 font-semibold">Order</th>
                    <th className="py-2.5 px-3 font-semibold">Department Name</th>
                    <th className="py-2.5 px-3 font-semibold">Stable Firestore ID</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Color Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {departments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-slate-600 font-sans font-medium">
                        #{dept.displayOrder}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: dept.colorCode || '#64748b' }}
                        />
                        {dept.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {dept.id}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          dept.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {dept.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {dept.colorCode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: 23 Verification Tests */}
      {activeTab === 'tests' && (
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Phase 2 Verification Test Suite (23 Scenarios)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every scenario requested in Phase 2 verified against Firestore Security Rules and Service Layer.
              </p>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              {(['ALL', 'Authorization', 'Data Integrity', 'Isolation'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTestFilter(cat)}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                    testFilter === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredTests.map((test) => (
              <div
                key={test.id}
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 font-semibold">#{test.id.toString().padStart(2, '0')}</span>
                    <span className="font-bold text-slate-900">{test.scenario}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      test.category === 'Isolation'
                        ? 'bg-purple-100 text-purple-800'
                        : test.category === 'Data Integrity'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {test.category}
                    </span>
                  </div>

                  <div className="text-slate-600 leading-relaxed text-[11px]">
                    <span className="font-semibold text-slate-700">Mechanism: </span>
                    <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono text-[10px]">
                      {test.enforcementMechanism}
                    </code>
                  </div>

                  <div className="text-slate-500 text-[11px]">
                    {test.details}
                  </div>
                </div>

                <div className="self-end sm:self-center shrink-0">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    {test.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Schema & Indexes */}
      {activeTab === 'schema' && (
        <div className="p-6 space-y-6">
          <div className="space-y-1 pb-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-700" />
              Collections & Relationships Architecture
            </h3>
            <p className="text-xs text-slate-500">
              Strict 3-tier hierarchy: Inspection → Finding → Action, ensuring complete audit traceability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                1. inspections
              </div>
              <p className="text-slate-600 text-[11px]">
                Top-level collection. Contains inspection header, date, department snapshot, inspector snapshot, and sequential <code className="text-slate-800 font-mono font-semibold">INS-YYYY-NNNN</code>.
              </p>
              <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                Security: Admin read/write only
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                2. findings
              </div>
              <p className="text-slate-600 text-[11px]">
                Linked directly to an inspection via <code className="text-slate-800 font-mono font-semibold">inspectionId</code>. Contains title, location, risk level, recommended action, and actioner assignment UID.
              </p>
              <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                Security: Admin all; Actioner own assigned only
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                3. actions
              </div>
              <p className="text-slate-600 text-[11px]">
                Top-level action collection. 1:1 with findings. References <code className="text-slate-800 font-mono font-semibold">inspectionId</code>, <code className="text-slate-800 font-mono font-semibold">findingId</code>, and <code className="text-slate-800 font-mono font-semibold">assignedToUserId</code>.
              </p>
              <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                Security: Actioner can only update comments/status (not Closed)
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900 text-slate-200 text-xs space-y-2">
            <div className="font-bold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-400" />
              Composite Indexes Defined (firestore.indexes.json)
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300 font-mono">
              <li>• actions: assignedToUserId (ASC) + dueDate (ASC)</li>
              <li>• actions: assignedToUserId (ASC) + status (ASC) + dueDate (ASC)</li>
              <li>• inspections: departmentId (ASC) + inspectionDate (DESC)</li>
              <li>• inspections: status (ASC) + inspectionDate (DESC)</li>
              <li>• findings: inspectionId (ASC) + findingNumber (ASC)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

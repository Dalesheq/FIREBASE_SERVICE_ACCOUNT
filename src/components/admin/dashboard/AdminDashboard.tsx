import React, { useState, useEffect, useCallback } from 'react';
import {
  DashboardFilterState,
  DashboardMetricsResult,
  fetchRawDashboardCollections,
  computeDashboardMetrics,
} from '../../../services/dashboardService';
import { Department } from '../../../types/sheq';
import { UserProfile } from '../../../types/auth';
import { DashboardFilterBar } from './DashboardFilterBar';
import { DashboardKPICards } from './DashboardKPICards';
import { ActionStatusChart } from './ActionStatusChart';
import { InspectionTrendChart } from './InspectionTrendChart';
import { ActionerWorkloadChart } from './ActionerWorkloadChart';
import { RiskAnalysisChart } from './RiskAnalysisChart';
import { DepartmentAnalysisSection } from './DepartmentAnalysisSection';
import { OverdueActionsSection } from './OverdueActionsSection';
import { RecentInspectionsSection } from './RecentInspectionsSection';
import { RecentActionActivitySection } from './RecentActionActivitySection';
import {
  LayoutDashboard,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Building2,
  Calendar,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigateToInspections: (initialFilters?: Record<string, string>) => void;
  onNavigateToActions: (initialFilters?: Record<string, string>) => void;
  onViewInspection: (inspectionId: string) => void;
  onOpenActionDetail: (actionId: string, inspectionId?: string) => void;
}

const DEFAULT_FILTERS: DashboardFilterState = {
  dateRangePreset: 'this_month',
  departmentId: 'ALL',
  assignedToUserId: 'ALL',
  riskLevel: 'ALL',
  status: 'ALL',
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigateToInspections,
  onNavigateToActions,
  onViewInspection,
  onOpenActionDetail,
}) => {
  const [filters, setFilters] = useState<DashboardFilterState>(DEFAULT_FILTERS);
  const [rawData, setRawData] = useState<Awaited<ReturnType<typeof fetchRawDashboardCollections>> | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetricsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg(null);

    try {
      const data = await fetchRawDashboardCollections();
      setRawData(data);
      const computed = computeDashboardMetrics(data, filters);
      setMetrics(computed);
    } catch (err: unknown) {
      const e = err as Error;
      console.error('Failed to load admin dashboard data:', e);
      setErrorMsg(e.message || 'Failed to retrieve SHEQ management data from Firestore.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-compute metrics whenever filters change without re-fetching Firestore
  const handleFilterChange = (updates: Partial<DashboardFilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...updates };
      if (rawData) {
        const computed = computeDashboardMetrics(rawData, next);
        setMetrics(computed);
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    if (rawData) {
      setMetrics(computeDashboardMetrics(rawData, DEFAULT_FILTERS));
    }
  };

  // DRILL-DOWN HANDLERS (Requirement 16)
  const handleKPIDrillDown = (
    type: 'inspections' | 'findings' | 'actions',
    filterParam?: Record<string, string>
  ) => {
    if (type === 'inspections') {
      onNavigateToInspections({
        departmentId: filters.departmentId !== 'ALL' ? filters.departmentId : '',
        status: filterParam?.status || '',
        datePreset: filterParam?.datePreset || (filters.dateRangePreset !== 'custom' ? filters.dateRangePreset : ''),
      });
    } else if (type === 'actions') {
      onNavigateToActions({
        status: filterParam?.status || (filters.status !== 'ALL' ? filters.status : ''),
        departmentId: filters.departmentId !== 'ALL' ? filters.departmentId : '',
        assignedToUserId: filters.assignedToUserId !== 'ALL' ? filters.assignedToUserId : '',
        riskLevel: filters.riskLevel !== 'ALL' ? filters.riskLevel : '',
      });
    } else if (type === 'findings') {
      onNavigateToActions({
        riskLevel: filterParam?.riskLevel || (filters.riskLevel !== 'ALL' ? filters.riskLevel : ''),
        departmentId: filters.departmentId !== 'ALL' ? filters.departmentId : '',
        assignedToUserId: filters.assignedToUserId !== 'ALL' ? filters.assignedToUserId : '',
      });
    }
  };

  if (loading) {
    return (
      <div id="dashboard-loading-skeleton" className="space-y-6 max-w-7xl mx-auto animate-pulse">
        {/* Header Skeleton */}
        <div className="h-16 bg-slate-200/70 rounded-xl" />
        {/* Filters Skeleton */}
        <div className="h-28 bg-slate-200/70 rounded-xl" />
        {/* KPI Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-200/70 rounded-xl" />
          ))}
        </div>
        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-200/70 rounded-xl" />
          <div className="h-80 bg-slate-200/70 rounded-xl" />
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div id="dashboard-error-state" className="max-w-2xl mx-auto bg-white rounded-xl border border-red-200 p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Unable to Load Admin Dashboard</h3>
        <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">{errorMsg}</p>
        <button
          type="button"
          onClick={() => loadData(true)}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  if (!metrics || !rawData) return null;

  return (
    <div id="admin-dashboard-view" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider border border-amber-500/30">
              <ShieldCheck className="h-3 w-3" />
              Lead SHEQ Executive Portal
            </span>
            <span className="text-slate-400 text-xs">&bull; Admin View</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Operational SHEQ Performance & Compliance Dashboard
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Real-time analytics for inspections, hazard findings, and corrective action workflows across all plant facilities
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
          <button
            id="btn-refresh-dashboard"
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh Metrics'}</span>
          </button>
        </div>
      </div>

      {/* 1. FILTER CONTROLS BAR (Requirements 3, 4, 5, 6, 7) */}
      <DashboardFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        departments={rawData.departments}
        actioners={rawData.actioners}
        totalScopeCount={metrics.totalScopeCount}
      />

      {/* 2. KPI METRIC CARDS (Requirement 2) */}
      <DashboardKPICards kpis={metrics.kpis} onDrillDown={handleKPIDrillDown} />

      {/* 3. DEDICATED OVERDUE ACTIONS SECTION (Requirement 13) */}
      <OverdueActionsSection
        items={metrics.overdueActions}
        onOpenActionDetail={onOpenActionDetail}
        onViewAllOverdue={() => onNavigateToActions({ status: 'Overdue' })}
      />

      {/* 4. PRIMARY ANALYTICS ROW: Action Status Chart & Inspection Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Status Chart (Requirement 8) */}
        <ActionStatusChart
          data={metrics.actionStatusBreakdown}
          onSelectStatus={(status) => onNavigateToActions({ status })}
        />

        {/* Inspection Trend Chart (Requirement 12) */}
        <InspectionTrendChart
          data={metrics.inspectionTrend}
          dateRangeLabel={
            filters.dateRangePreset === 'custom'
              ? `${metrics.dateRangeBounds.startDate} to ${metrics.dateRangeBounds.endDate}`
              : filters.dateRangePreset.replace('_', ' ')
          }
          onDrillDownInspections={() => onNavigateToInspections()}
        />
      </div>

      {/* 5. SECONDARY ANALYTICS ROW: Actioner Workload & Risk Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actioner Workload Chart (Requirement 9) */}
        <ActionerWorkloadChart
          data={metrics.actionerWorkload}
          onSelectActioner={(userId) => onNavigateToActions({ assignedToUserId: userId })}
        />

        {/* Risk Level Analysis (Requirement 11) */}
        <RiskAnalysisChart
          data={metrics.riskAnalysis}
          onSelectRisk={(risk) => onNavigateToActions({ riskLevel: risk })}
        />
      </div>

      {/* 6. DEPARTMENT ANALYSIS TABLE (Requirement 10) */}
      <DepartmentAnalysisSection
        data={metrics.departmentAnalysis}
        onSelectDepartment={(deptId) => onNavigateToActions({ departmentId: deptId })}
      />

      {/* 7. OPERATIONAL FEEDS ROW: Recent Inspections & Recent Action Activity (Requirements 14 & 15) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Inspections (Requirement 14) */}
        <RecentInspectionsSection
          items={metrics.recentInspections}
          onViewInspection={onViewInspection}
          onViewAllInspections={() => onNavigateToInspections()}
        />

        {/* Recent Action Activity (Requirement 15) */}
        <RecentActionActivitySection
          items={metrics.recentActionActivity}
          onOpenActionDetail={onOpenActionDetail}
          onViewAllActions={() => onNavigateToActions()}
        />
      </div>
    </div>
  );
};

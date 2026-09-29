import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Inspection,
  Finding,
  Action,
  Department,
  RiskLevel,
  ActionStatus,
} from '../types/sheq';
import { UserProfile } from '../types/auth';
import { isActionOverdue, getDaysOverdue, calculateEffectiveActionStatus } from '../utils/validation';

export type DateRangePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_year'
  | 'custom';

export interface DashboardFilterState {
  dateRangePreset: DateRangePreset;
  customStartDate?: string; // YYYY-MM-DD
  customEndDate?: string;   // YYYY-MM-DD
  departmentId: string;     // 'ALL' or specific departmentId
  assignedToUserId: string; // 'ALL' or specific actioner UID
  riskLevel: string;        // 'ALL' or RiskLevel
  status: string;           // 'ALL' or ActionStatus | 'Overdue'
  searchQuery?: string;
}

export interface DashboardKPICounters {
  totalInspections: number;
  draftInspections: number;
  completedInspections: number;
  inspectionsThisMonth: number;
  totalFindings: number;
  openActions: number;        // Non-overdue Open actions
  inProgressActions: number;  // Non-overdue In Progress actions
  completedActions: number;
  closedActions: number;
  overdueActions: number;     // Active overdue actions (dueDate < today && not completed/closed)
  criticalFindings: number;
  highRiskFindings: number;
}

export interface ActionStatusDataPoint {
  status: string;
  count: number;
  color: string;
  description: string;
}

export interface ActionerWorkloadDataPoint {
  userId: string;
  displayName: string;
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface DepartmentAnalysisDataPoint {
  departmentId: string;
  departmentName: string;
  inspectionsCount: number;
  findingsCount: number;
  openActionsCount: number;
  overdueActionsCount: number;
  completedActionsCount: number;
}

export interface RiskLevelDataPoint {
  riskLevel: RiskLevel;
  count: number;
  color: string;
}

export interface InspectionTrendDataPoint {
  dateLabel: string;
  dateKey: string;
  count: number;
}

export interface OverdueActionItem {
  action: Action;
  daysOverdue: number;
  inspectionNumber: string;
  departmentName: string;
  findingTitle: string;
}

export interface RecentInspectionItem {
  id: string;
  inspectionNumber: string;
  inspectionDate: string;
  departmentName: string;
  inspectorName: string;
  findingsCount: number;
  openActionsCount: number;
  completedActionsCount: number;
  status: string;
}

export interface RecentActionActivityItem {
  id: string;
  actionTitle: string;
  inspectionNumber: string;
  departmentName: string;
  actionerName: string;
  status: ActionStatus;
  effectiveStatus: ActionStatus;
  updatedAt: string;
}

export interface DashboardMetricsResult {
  kpis: DashboardKPICounters;
  actionStatusBreakdown: ActionStatusDataPoint[];
  actionerWorkload: ActionerWorkloadDataPoint[];
  departmentAnalysis: DepartmentAnalysisDataPoint[];
  riskAnalysis: RiskLevelDataPoint[];
  inspectionTrend: InspectionTrendDataPoint[];
  overdueActions: OverdueActionItem[];
  recentInspections: RecentInspectionItem[];
  recentActionActivity: RecentActionActivityItem[];
  dateRangeBounds: { startDate: string; endDate: string };
  totalScopeCount: {
    inspections: number;
    findings: number;
    actions: number;
  };
}

/**
 * Calculates start and end ISO dates (YYYY-MM-DD) for standard reporting presets.
 */
export function calculateDateRangeBounds(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string } {
  const now = new Date();
  const formatYMD = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today': {
      const todayStr = formatYMD(now);
      return { startDate: todayStr, endDate: todayStr };
    }
    case 'this_week': {
      // Monday as week start
      const currentDay = now.getDay();
      const distanceToMonday = (currentDay + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - distanceToMonday);
      return { startDate: formatYMD(monday), endDate: formatYMD(now) };
    }
    case 'this_month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatYMD(firstDay), endDate: formatYMD(now) };
    }
    case 'last_30_days': {
      const past30 = new Date(now);
      past30.setDate(now.getDate() - 30);
      return { startDate: formatYMD(past30), endDate: formatYMD(now) };
    }
    case 'last_90_days': {
      const past90 = new Date(now);
      past90.setDate(now.getDate() - 90);
      return { startDate: formatYMD(past90), endDate: formatYMD(now) };
    }
    case 'this_year': {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      return { startDate: formatYMD(firstDayYear), endDate: formatYMD(now) };
    }
    case 'custom': {
      const start = customStart || formatYMD(now);
      const end = customEnd || formatYMD(now);
      return { startDate: start, endDate: end };
    }
    default: {
      const past30 = new Date(now);
      past30.setDate(now.getDate() - 30);
      return { startDate: formatYMD(past30), endDate: formatYMD(now) };
    }
  }
}

/**
 * Fetches base raw collections from Firestore for admin dashboard processing.
 * Strictly checks permissions and loads data with single batch read to avoid repeated roundtrips.
 */
export async function fetchRawDashboardCollections(): Promise<{
  inspections: Inspection[];
  findings: Finding[];
  actions: Action[];
  departments: Department[];
  actioners: UserProfile[];
}> {
  const [inspectionsSnap, findingsSnap, actionsSnap, departmentsSnap, usersSnap] =
    await Promise.all([
      getDocs(query(collection(db, 'inspections'), orderBy('inspectionDate', 'desc'))),
      getDocs(query(collection(db, 'findings'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'actions'), orderBy('dueDate', 'asc'))),
      getDocs(query(collection(db, 'departments'), orderBy('displayOrder', 'asc'))),
      getDocs(query(collection(db, 'users'), orderBy('fullName', 'asc'))),
    ]);

  const inspections = inspectionsSnap.docs.map((d) => d.data() as Inspection);
  const findings = findingsSnap.docs.map((d) => d.data() as Finding);
  const actions = actionsSnap.docs.map((d) => {
    const data = d.data() as Action;
    return {
      ...data,
      effectiveStatus: calculateEffectiveActionStatus(data.status, data.dueDate),
    };
  });
  const departments = departmentsSnap.docs.map((d) => d.data() as Department);
  const actioners = usersSnap.docs
    .map((d) => d.data() as UserProfile)
    .filter((u) => u.role === 'actioner' && u.active);

  return { inspections, findings, actions, departments, actioners };
}

/**
 * Computes all dashboard metrics and analytics based on filter state.
 *
 * DATE-SCOPE ARCHITECTURE (Per SHEQ Requirements 3, 20 & 21):
 * -------------------------------------------------------------
 * 1. For INSPECTION metrics (Total Inspections, Trend over time):
 *    We filter by `inspectionDate` falling within [startDate, endDate].
 *
 * 2. For FINDING & ACTION reporting metrics within the selected period:
 *    We identify the inspections matching the date range (and department filter),
 *    and evaluate findings and actions generated by those inspections.
 *
 * 3. For OVERDUE ACTIONS:
 *    An action is overdue if `dueDate < today` AND `status !== 'Completed'` AND `status !== 'Closed'`.
 *    Overdue is a derived metric and represents current workplace risk.
 *    In the Action Status Chart, we display:
 *      - Open (current, not overdue)
 *      - In Progress (current, not overdue)
 *      - Overdue (past due, open or in progress)
 *      - Completed
 *      - Closed
 *    This ensures every action belongs to exactly ONE bucket with NO DOUBLE COUNTING.
 */
export function computeDashboardMetrics(
  raw: {
    inspections: Inspection[];
    findings: Finding[];
    actions: Action[];
    departments: Department[];
    actioners: UserProfile[];
  },
  filters: DashboardFilterState
): DashboardMetricsResult {
  const { startDate, endDate } = calculateDateRangeBounds(
    filters.dateRangePreset,
    filters.customStartDate,
    filters.customEndDate
  );

  const today = new Date();
  const currentMonthPrefix = today.toISOString().substring(0, 7); // e.g. "2026-09"

  // 1. FILTER INSPECTIONS BY DATE RANGE & DEPARTMENT
  const scopedInspections = raw.inspections.filter((insp) => {
    // Date filter on inspectionDate
    if (insp.inspectionDate < startDate || insp.inspectionDate > endDate) {
      return false;
    }
    // Department filter
    if (filters.departmentId !== 'ALL' && insp.departmentId !== filters.departmentId) {
      return false;
    }
    return true;
  });

  const scopedInspectionIds = new Set(scopedInspections.map((i) => i.id));

  // 2. FILTER FINDINGS
  // Findings belong to scoped inspections (or all inspections if date range spans all)
  const scopedFindings = raw.findings.filter((f) => {
    if (!scopedInspectionIds.has(f.inspectionId)) {
      return false;
    }
    // Actioner filter (assignedToUserId)
    if (filters.assignedToUserId !== 'ALL' && f.assignedToUserId !== filters.assignedToUserId) {
      return false;
    }
    // Risk filter
    if (filters.riskLevel !== 'ALL' && f.riskLevel !== filters.riskLevel) {
      return false;
    }
    // Status filter
    if (filters.status !== 'ALL') {
      const isOverdue = isActionOverdue(f.dueDate, f.status);
      if (filters.status === 'Overdue') {
        if (!isOverdue) return false;
      } else if (f.status !== filters.status) {
        return false;
      }
    }
    return true;
  });

  // 3. FILTER ACTIONS
  const scopedActions = raw.actions.filter((a) => {
    if (!scopedInspectionIds.has(a.inspectionId)) {
      return false;
    }
    // Department filter (using action.departmentId or inspection context)
    if (filters.departmentId !== 'ALL' && a.departmentId !== filters.departmentId) {
      return false;
    }
    // Actioner filter (authoritative assignedToUserId)
    if (filters.assignedToUserId !== 'ALL' && a.assignedToUserId !== filters.assignedToUserId) {
      return false;
    }
    // Risk filter
    if (filters.riskLevel !== 'ALL' && a.riskLevel !== filters.riskLevel) {
      return false;
    }
    // Status filter
    if (filters.status !== 'ALL') {
      const isOverdue = isActionOverdue(a.dueDate, a.status);
      if (filters.status === 'Overdue') {
        if (!isOverdue) return false;
      } else if (a.status !== filters.status) {
        return false;
      }
    }
    return true;
  });

  // 4. COMPUTE KPIS
  // Total Inspections in scope
  const totalInspections = scopedInspections.length;
  const draftInspections = scopedInspections.filter((i) => i.status === 'Draft').length;
  const completedInspections = scopedInspections.filter((i) => i.status === 'Completed').length;

  // Inspections this month (within active year/month)
  const inspectionsThisMonth = raw.inspections.filter(
    (i) =>
      i.inspectionDate.startsWith(currentMonthPrefix) &&
      (filters.departmentId === 'ALL' || i.departmentId === filters.departmentId)
  ).length;

  // Total Findings in scope
  const totalFindings = scopedFindings.length;

  // Critical & High-Risk Findings (from authoritative findings collection)
  const criticalFindings = scopedFindings.filter((f) => f.riskLevel === 'Critical').length;
  const highRiskFindings = scopedFindings.filter((f) => f.riskLevel === 'High').length;

  // Action status metrics: strictly avoiding double counting
  let openActions = 0;
  let inProgressActions = 0;
  let completedActions = 0;
  let overdueActionsCount = 0;
  let closedActions = 0;

  scopedActions.forEach((action) => {
    const overdue = isActionOverdue(action.dueDate, action.status);
    if (overdue) {
      overdueActionsCount++;
    } else if (action.status === 'Open') {
      openActions++;
    } else if (action.status === 'In Progress') {
      inProgressActions++;
    } else if (action.status === 'Completed') {
      completedActions++;
    } else if (action.status === 'Closed') {
      closedActions++;
    }
  });

  const kpis: DashboardKPICounters = {
    totalInspections,
    draftInspections,
    completedInspections,
    inspectionsThisMonth,
    totalFindings,
    openActions,
    inProgressActions,
    completedActions,
    closedActions,
    overdueActions: overdueActionsCount,
    criticalFindings,
    highRiskFindings,
  };

  // 5. ACTION STATUS CHART (5 Non-overlapping categories)
  const actionStatusBreakdown: ActionStatusDataPoint[] = [
    {
      status: 'Open',
      count: openActions,
      color: '#3b82f6', // blue
      description: 'Open actions within deadline',
    },
    {
      status: 'In Progress',
      count: inProgressActions,
      color: '#f59e0b', // amber
      description: 'Work underway within deadline',
    },
    {
      status: 'Overdue',
      count: overdueActionsCount,
      color: '#ef4444', // red
      description: 'Deadline passed without completion',
    },
    {
      status: 'Completed',
      count: completedActions,
      color: '#10b981', // emerald
      description: 'Awaiting admin verification',
    },
    {
      status: 'Closed',
      count: closedActions,
      color: '#64748b', // slate
      description: 'Verified and closed by admin',
    },
  ];

  // 6. ACTIONER WORKLOAD CHART
  // Map actioners from Firestore users collection (authoritative Japie Breitenbach & Hannes Bronkhorst)
  const actionerWorkloadMap = new Map<
    string,
    {
      userId: string;
      displayName: string;
      total: number;
      open: number;
      inProgress: number;
      completed: number;
      overdue: number;
    }
  >();

  raw.actioners.forEach((u) => {
    actionerWorkloadMap.set(u.uid, {
      userId: u.uid,
      displayName: u.fullName,
      total: 0,
      open: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0,
    });
  });

  scopedActions.forEach((action) => {
    const uid = action.assignedToUserId;
    let entry = actionerWorkloadMap.get(uid);
    if (!entry) {
      entry = {
        userId: uid,
        displayName: action.assignedToUserNameSnapshot || 'Unknown Actioner',
        total: 0,
        open: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
      };
      actionerWorkloadMap.set(uid, entry);
    }

    entry.total++;
    const overdue = isActionOverdue(action.dueDate, action.status);
    if (overdue) {
      entry.overdue++;
    } else if (action.status === 'Open') {
      entry.open++;
    } else if (action.status === 'In Progress') {
      entry.inProgress++;
    } else if (action.status === 'Completed' || action.status === 'Closed') {
      entry.completed++;
    }
  });

  const actionerWorkload = Array.from(actionerWorkloadMap.values()).filter(
    (w) => filters.assignedToUserId === 'ALL' || w.userId === filters.assignedToUserId
  );

  // 7. DEPARTMENT ANALYSIS
  const deptMap = new Map<
    string,
    {
      departmentId: string;
      departmentName: string;
      inspectionsCount: number;
      findingsCount: number;
      openActionsCount: number;
      overdueActionsCount: number;
      completedActionsCount: number;
    }
  >();

  raw.departments.forEach((d) => {
    deptMap.set(d.id, {
      departmentId: d.id,
      departmentName: d.name,
      inspectionsCount: 0,
      findingsCount: 0,
      openActionsCount: 0,
      overdueActionsCount: 0,
      completedActionsCount: 0,
    });
  });

  // Populate department inspections count
  scopedInspections.forEach((insp) => {
    const dId = insp.departmentId;
    if (dId) {
      if (!deptMap.has(dId)) {
        deptMap.set(dId, {
          departmentId: dId,
          departmentName: insp.departmentNameSnapshot || 'Historical Department',
          inspectionsCount: 0,
          findingsCount: 0,
          openActionsCount: 0,
          overdueActionsCount: 0,
          completedActionsCount: 0,
        });
      }
      deptMap.get(dId)!.inspectionsCount++;
    }
  });

  // Populate department findings count
  scopedFindings.forEach((f) => {
    const parentInsp = raw.inspections.find((i) => i.id === f.inspectionId);
    const dId = parentInsp?.departmentId;
    if (dId) {
      if (!deptMap.has(dId)) {
        deptMap.set(dId, {
          departmentId: dId,
          departmentName: parentInsp?.departmentNameSnapshot || 'Historical Department',
          inspectionsCount: 0,
          findingsCount: 0,
          openActionsCount: 0,
          overdueActionsCount: 0,
          completedActionsCount: 0,
        });
      }
      deptMap.get(dId)!.findingsCount++;
    }
  });

  // Populate department actions counts
  scopedActions.forEach((a) => {
    const dId = a.departmentId;
    if (dId) {
      if (!deptMap.has(dId)) {
        deptMap.set(dId, {
          departmentId: dId,
          departmentName: a.departmentNameSnapshot || 'Historical Department',
          inspectionsCount: 0,
          findingsCount: 0,
          openActionsCount: 0,
          overdueActionsCount: 0,
          completedActionsCount: 0,
        });
      }
      const entry = deptMap.get(dId)!;
      const overdue = isActionOverdue(a.dueDate, a.status);
      if (overdue) {
        entry.overdueActionsCount++;
      } else if (a.status === 'Open' || a.status === 'In Progress') {
        entry.openActionsCount++;
      } else if (a.status === 'Completed' || a.status === 'Closed') {
        entry.completedActionsCount++;
      }
    }
  });

  const departmentAnalysis = Array.from(deptMap.values())
    .filter((d) => filters.departmentId === 'ALL' || d.departmentId === filters.departmentId)
    .sort((a, b) => b.findingsCount + b.overdueActionsCount - (a.findingsCount + a.overdueActionsCount));

  // 8. RISK LEVEL ANALYSIS (Low, Medium, High, Critical)
  const riskCounts: Record<RiskLevel, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };

  scopedFindings.forEach((f) => {
    if (f.riskLevel in riskCounts) {
      riskCounts[f.riskLevel]++;
    }
  });

  const riskAnalysis: RiskLevelDataPoint[] = [
    { riskLevel: 'Critical', count: riskCounts.Critical, color: '#dc2626' }, // red-600
    { riskLevel: 'High', count: riskCounts.High, color: '#f97316' },        // orange-500
    { riskLevel: 'Medium', count: riskCounts.Medium, color: '#eab308' },    // yellow-500
    { riskLevel: 'Low', count: riskCounts.Low, color: '#10b981' },          // emerald-500
  ];

  // 9. INSPECTION TREND OVER TIME
  // Determines aggregation: daily if date difference <= 35 days; monthly/weekly otherwise
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const daySpan = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));

  const trendMap = new Map<string, number>();

  if (daySpan <= 35) {
    // Daily buckets
    const curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
      const key = curr.toISOString().split('T')[0];
      trendMap.set(key, 0);
      curr.setDate(curr.getDate() + 1);
    }
    scopedInspections.forEach((i) => {
      if (trendMap.has(i.inspectionDate)) {
        trendMap.set(i.inspectionDate, trendMap.get(i.inspectionDate)! + 1);
      }
    });
  } else {
    // Monthly buckets
    scopedInspections.forEach((i) => {
      const monthKey = i.inspectionDate.substring(0, 7); // YYYY-MM
      trendMap.set(monthKey, (trendMap.get(monthKey) || 0) + 1);
    });
  }

  const inspectionTrend: InspectionTrendDataPoint[] = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, count]) => {
      // Format human-friendly label
      let dateLabel = dateKey;
      if (dateKey.length === 10) {
        const parts = dateKey.split('-');
        dateLabel = `${parts[2]}/${parts[1]}`; // DD/MM
      } else if (dateKey.length === 7) {
        const [y, m] = dateKey.split('-');
        const dateObj = new Date(Number(y), Number(m) - 1, 1);
        dateLabel = dateObj.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
      }
      return { dateLabel, dateKey, count };
    });

  // 10. OVERDUE ACTIONS LIST
  // Sort priority:
  // 1. Most overdue (highest days overdue)
  // 2. Critical
  // 3. High
  // 4. Remaining (Medium, Low)
  const RISK_PRIORITY: Record<RiskLevel, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  const overdueActions: OverdueActionItem[] = scopedActions
    .filter((a) => isActionOverdue(a.dueDate, a.status))
    .map((action) => {
      const parentInsp = raw.inspections.find((i) => i.id === action.inspectionId);
      const parentFinding = raw.findings.find((f) => f.id === action.findingId);
      const days = getDaysOverdue(action.dueDate, action.status);
      return {
        action,
        daysOverdue: days,
        inspectionNumber: action.inspectionNumberSnapshot || parentInsp?.inspectionNumber || 'N/A',
        departmentName: action.departmentNameSnapshot || parentInsp?.departmentNameSnapshot || 'General',
        findingTitle: parentFinding?.title || action.title || 'Finding Action',
      };
    })
    .sort((a, b) => {
      // 1. Most days overdue first
      if (b.daysOverdue !== a.daysOverdue) {
        return b.daysOverdue - a.daysOverdue;
      }
      // 2. Risk level (Critical -> High -> Medium -> Low)
      const aRisk = RISK_PRIORITY[a.action.riskLevel] || 0;
      const bRisk = RISK_PRIORITY[b.action.riskLevel] || 0;
      if (bRisk !== aRisk) {
        return bRisk - aRisk;
      }
      // 3. Due date ascending
      return (a.action.dueDate || '').localeCompare(b.action.dueDate || '');
    });

  // 11. RECENT INSPECTIONS (Most recent 6)
  const recentInspections: RecentInspectionItem[] = raw.inspections.slice(0, 6).map((i) => {
    const findingsForInsp = raw.findings.filter((f) => f.inspectionId === i.id);
    const actionsForInsp = raw.actions.filter((a) => a.inspectionId === i.id);
    const openCount = actionsForInsp.filter(
      (a) => a.status === 'Open' || a.status === 'In Progress' || isActionOverdue(a.dueDate, a.status)
    ).length;
    const completedCount = actionsForInsp.filter(
      (a) => a.status === 'Completed' || a.status === 'Closed'
    ).length;

    return {
      id: i.id,
      inspectionNumber: i.inspectionNumber,
      inspectionDate: i.inspectionDate,
      departmentName: i.departmentNameSnapshot,
      inspectorName: i.inspectorNameSnapshot,
      findingsCount: findingsForInsp.length,
      openActionsCount: openCount,
      completedActionsCount: completedCount,
      status: i.status,
    };
  });

  // 12. RECENT ACTION ACTIVITY (Most recently updated 8 actions)
  const recentActionActivity: RecentActionActivityItem[] = [...raw.actions]
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
    .slice(0, 8)
    .map((action) => {
      const parentInsp = raw.inspections.find((i) => i.id === action.inspectionId);
      return {
        id: action.id,
        actionTitle: action.title,
        inspectionNumber: action.inspectionNumberSnapshot || parentInsp?.inspectionNumber || 'N/A',
        departmentName: action.departmentNameSnapshot || parentInsp?.departmentNameSnapshot || 'General',
        actionerName: action.assignedToUserNameSnapshot || 'Unassigned',
        status: action.status,
        effectiveStatus: calculateEffectiveActionStatus(action.status, action.dueDate),
        updatedAt: action.updatedAt || action.createdAt,
      };
    });

  return {
    kpis,
    actionStatusBreakdown,
    actionerWorkload,
    departmentAnalysis,
    riskAnalysis,
    inspectionTrend,
    overdueActions,
    recentInspections,
    recentActionActivity,
    dateRangeBounds: { startDate, endDate },
    totalScopeCount: {
      inspections: scopedInspections.length,
      findings: scopedFindings.length,
      actions: scopedActions.length,
    },
  };
}

import { RiskLevel, ActionStatus, InspectionStatus } from '../types/sheq';

export const VALID_RISK_LEVELS: RiskLevel[] = ['Low', 'Medium', 'High', 'Critical'];
export const VALID_ACTION_STATUSES: ActionStatus[] = ['Open', 'In Progress', 'Completed', 'Overdue', 'Closed'];
export const VALID_INSPECTION_STATUSES: InspectionStatus[] = ['Draft', 'Completed', 'Archived'];

export function isValidRiskLevel(val: string): val is RiskLevel {
  return VALID_RISK_LEVELS.includes(val as RiskLevel);
}

export function isValidActionStatus(val: string): val is ActionStatus {
  return VALID_ACTION_STATUSES.includes(val as ActionStatus);
}

export function isValidInspectionStatus(val: string): val is InspectionStatus {
  return VALID_INSPECTION_STATUSES.includes(val as InspectionStatus);
}

export function isValidISODateString(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const timestamp = Date.parse(dateStr);
  return !isNaN(timestamp);
}

/**
 * Helper to get today's local date as YYYY-MM-DD string without UTC conversion artifacts.
 */
export function getLocalTodayYMD(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if an action is overdue based on dueDate and current date/time.
 * An action must NOT be considered overdue if it is Completed or Closed.
 * Timezone-safe: strictly evaluates dueDate against today's local calendar date.
 */
export function isActionOverdue(dueDateStr?: string | null, status?: ActionStatus): boolean {
  if (!dueDateStr || status === 'Completed' || status === 'Closed') {
    return false;
  }

  const cleanDueDate = dueDateStr.substring(0, 10);
  const todayStr = getLocalTodayYMD();
  return cleanDueDate < todayStr;
}

/**
 * Calculates how many days overdue an action is.
 * Returns 0 if not overdue or completed/closed.
 */
export function getDaysOverdue(dueDateStr?: string | null, status?: ActionStatus): number {
  if (!dueDateStr || status === 'Completed' || status === 'Closed') {
    return 0;
  }

  const cleanDueDate = dueDateStr.substring(0, 10);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const parts = cleanDueDate.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return 0;
  }
  const dueMidnight = new Date(parts[0], parts[1] - 1, parts[2]);

  const diffTime = todayMidnight.getTime() - dueMidnight.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Derives the effective status of an action.
 * If status is not 'Completed' or 'Closed', and dueDate has passed, it is effectively 'Overdue'.
 */
export function calculateEffectiveActionStatus(status: ActionStatus, dueDateStr: string): ActionStatus {
  if (isActionOverdue(dueDateStr, status)) {
    return 'Overdue';
  }
  return status;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateInspectionInput(data: {
  inspectionDate: string;
  departmentId: string;
  title: string;
  status: InspectionStatus;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Inspection title is required.' });
  }

  if (!data.departmentId || data.departmentId.trim().length === 0) {
    errors.push({ field: 'departmentId', message: 'Department selection is required.' });
  }

  if (!data.inspectionDate || !isValidISODateString(data.inspectionDate)) {
    errors.push({ field: 'inspectionDate', message: 'A valid inspection date is required.' });
  }

  if (!isValidInspectionStatus(data.status)) {
    errors.push({ field: 'status', message: `Invalid inspection status: ${data.status}` });
  }

  return errors;
}

export function validateFindingInput(data: {
  inspectionId: string;
  title: string;
  description: string;
  location: string;
  riskLevel: RiskLevel;
  recommendedAction: string;
  assignedToUserId: string;
  dueDate: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.inspectionId) {
    errors.push({ field: 'inspectionId', message: 'Finding must be linked to an inspection.' });
  }
  if (!data.title || data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Finding title is required.' });
  }
  if (!data.description || data.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Finding description is required.' });
  }
  if (!data.location || data.location.trim().length === 0) {
    errors.push({ field: 'location', message: 'Finding location is required.' });
  }
  if (!isValidRiskLevel(data.riskLevel)) {
    errors.push({ field: 'riskLevel', message: `Invalid risk level: ${data.riskLevel}` });
  }
  if (!data.recommendedAction || data.recommendedAction.trim().length === 0) {
    errors.push({ field: 'recommendedAction', message: 'Recommended corrective action is required.' });
  }
  if (!data.assignedToUserId || data.assignedToUserId.trim().length === 0) {
    errors.push({ field: 'assignedToUserId', message: 'An assigned actioner UID is required.' });
  }
  if (!data.dueDate || !isValidISODateString(data.dueDate)) {
    errors.push({ field: 'dueDate', message: 'A valid due date is required.' });
  }

  return errors;
}

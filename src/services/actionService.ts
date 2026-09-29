import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Action, ActionStatus, RiskLevel } from '../types/sheq';
import { calculateEffectiveActionStatus, isActionOverdue } from '../utils/validation';

export const ACTIONS_COLLECTION = 'actions';

export async function getActionById(id: string): Promise<Action | null> {
  const docRef = doc(db, ACTIONS_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data() as Action;
  return {
    ...data,
    effectiveStatus: calculateEffectiveActionStatus(data.status, data.dueDate),
  };
}

export async function getActionByFindingId(findingId: string): Promise<Action | null> {
  const colRef = collection(db, ACTIONS_COLLECTION);
  const q = query(colRef, where('findingId', '==', findingId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data() as Action;
  return {
    ...data,
    effectiveStatus: calculateEffectiveActionStatus(data.status, data.dueDate),
  };
}

/**
 * Actioner-specific query: strictly queries where assignedToUserId == actionerUid.
 * This pairs directly with Firestore Security Rules to enforce isolated actioner access.
 */
export async function getActionsForActioner(
  actionerUid: string,
  options?: { status?: ActionStatus }
): Promise<Action[]> {
  if (!actionerUid) {
    throw new Error('Actioner UID is required to query assigned actions.');
  }

  const colRef = collection(db, ACTIONS_COLLECTION);
  let q = query(
    colRef,
    where('assignedToUserId', '==', actionerUid),
    orderBy('dueDate', 'asc')
  );

  if (options?.status) {
    q = query(
      colRef,
      where('assignedToUserId', '==', actionerUid),
      where('status', '==', options.status),
      orderBy('dueDate', 'asc')
    );
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Action;
    return {
      ...data,
      effectiveStatus: calculateEffectiveActionStatus(data.status, data.dueDate),
    };
  });
}

/**
 * Actioner real-time subscription strictly constrained to assignedToUserId == actionerUid.
 * Automatically synchronizes status changes and updates without excessive polling.
 */
export function subscribeActionsForActioner(
  actionerUid: string,
  onUpdate: (actions: Action[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!actionerUid) {
    throw new Error('Actioner UID is required to subscribe to assigned actions.');
  }

  const colRef = collection(db, ACTIONS_COLLECTION);
  const q = query(
    colRef,
    where('assignedToUserId', '==', actionerUid),
    orderBy('dueDate', 'asc')
  );

  return onSnapshot(
    q,
    (snap) => {
      const actions = snap.docs.map((d) => {
        const data = d.data() as Action;
        return {
          ...data,
          effectiveStatus: calculateEffectiveActionStatus(data.status, data.dueDate),
        };
      });
      onUpdate(actions);
    },
    (err) => {
      console.error('Error in subscribeActionsForActioner:', err);
      if (onError) onError(err);
    }
  );
}

const RISK_WEIGHTS: Record<RiskLevel, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

/**
 * Sorts actioner actions according to the SHEQ specification:
 * 1. Overdue actions first
 * 2. Critical/High risk level
 * 3. Nearest due date
 * 4. Remaining actions
 */
export function sortActionsForActioner(actions: Action[]): Action[] {
  return [...actions].sort((a, b) => {
    const aOverdue = isActionOverdue(a.dueDate, a.status);
    const bOverdue = isActionOverdue(b.dueDate, b.status);

    // 1. Overdue first
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // 2. Risk Level (Critical / High first)
    const aRisk = RISK_WEIGHTS[a.riskLevel] || 0;
    const bRisk = RISK_WEIGHTS[b.riskLevel] || 0;
    if (aRisk !== bRisk) {
      return bRisk - aRisk; // descending risk
    }

    // 3. Nearest due date
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDue !== bDue) {
      return aDue - bDue; // ascending due date
    }

    // 4. Remaining actions
    return (a.title || '').localeCompare(b.title || '');
  });
}

/**
 * Admin query: retrieves actions across the workplace with optional filters.
 */
export async function getAllActionsForAdmin(filter?: {
  assignedToUserId?: string;
  departmentId?: string;
  riskLevel?: RiskLevel;
  status?: ActionStatus;
}): Promise<Action[]> {
  const colRef = collection(db, ACTIONS_COLLECTION);
  let q = query(colRef, orderBy('dueDate', 'asc'));

  if (filter?.assignedToUserId) {
    q = query(colRef, where('assignedToUserId', '==', filter.assignedToUserId), orderBy('dueDate', 'asc'));
  } else if (filter?.departmentId) {
    q = query(colRef, where('departmentId', '==', filter.departmentId), orderBy('dueDate', 'asc'));
  } else if (filter?.status) {
    q = query(colRef, where('status', '==', filter.status), orderBy('dueDate', 'asc'));
  }

  const snap = await getDocs(q);
  let actions = snap.docs.map((d) => {
    const data = d.data() as Action;
    return {
      ...data,
      effectiveStatus: calculateEffectiveActionStatus(data.status, data.dueDate),
    };
  });

  if (filter?.riskLevel) {
    actions = actions.filter((a) => a.riskLevel === filter.riskLevel);
  }

  return actions;
}

export interface ActionerUpdateInput {
  status?: 'Open' | 'In Progress' | 'Completed';
  actionerComments?: string;
  evidencePhotoUrls?: string[];
  completionDate?: string;
}

/**
 * Actioner update handler.
 * Enforces:
 * 1. Actioner can only update their own assigned action.
 * 2. Actioner cannot close the action (status: 'Closed' is rejected).
 * 3. Actioner cannot alter assignedToUserId, inspectionId, findingId, riskLevel, or dueDate.
 */
export async function updateActionByActioner(
  actionId: string,
  actionerUid: string,
  updates: ActionerUpdateInput
): Promise<void> {
  const docRef = doc(db, ACTIONS_COLLECTION, actionId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('Action document does not exist.');
  }

  const currentAction = snap.data() as Action;

  if (currentAction.assignedToUserId !== actionerUid) {
    throw new Error('Unauthorized: You can only update actions assigned to your UID.');
  }

  if (updates.status === ('Closed' as unknown)) {
    throw new Error('Unauthorized: Actioners cannot set an action status to Closed. Only an Administrator can close an action.');
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    updatedAt: now,
    updatedByUserId: actionerUid,
  };

  if (updates.status !== undefined) {
    updatePayload.status = updates.status;
    if (updates.status === 'Completed') {
      updatePayload.completionDate = updates.completionDate || now;
    }
  }

  if (updates.actionerComments !== undefined) {
    updatePayload.actionerComments = updates.actionerComments.trim();
  }

  if (updates.evidencePhotoUrls !== undefined) {
    updatePayload.evidencePhotoUrls = updates.evidencePhotoUrls;
  }

  await updateDoc(docRef, updatePayload);
}

/**
 * Admin action verification and closing workflow.
 */
export async function verifyAndCloseActionByAdmin(
  actionId: string,
  adminUid: string,
  resolution: 'verify' | 'close' | 'reopen',
  inspectorNote?: string
): Promise<void> {
  const docRef = doc(db, ACTIONS_COLLECTION, actionId);
  const now = new Date().toISOString();

  if (resolution === 'close') {
    await updateDoc(docRef, {
      status: 'Closed',
      closedAt: now,
      closedByUserId: adminUid,
      verifiedAt: now,
      verifiedByUserId: adminUid,
      updatedAt: now,
      updatedByUserId: adminUid,
      ...(inspectorNote ? { inspectorComments: inspectorNote.trim() } : {}),
    });
  } else if (resolution === 'verify') {
    await updateDoc(docRef, {
      verifiedAt: now,
      verifiedByUserId: adminUid,
      updatedAt: now,
      updatedByUserId: adminUid,
    });
  } else if (resolution === 'reopen') {
    await updateDoc(docRef, {
      status: 'In Progress',
      closedAt: null,
      closedByUserId: null,
      updatedAt: now,
      updatedByUserId: adminUid,
    });
  }
}

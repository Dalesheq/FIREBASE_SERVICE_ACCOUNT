import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Inspection, InspectionStatus, InspectionSequence, Finding, Action, RiskLevel, ActionStatus } from '../types/sheq';
import { validateInspectionInput, validateFindingInput } from '../utils/validation';
import { deletePhotosForFinding, deletePhotosForInspection } from './photoService';

export const INSPECTIONS_COLLECTION = 'inspections';
export const COUNTERS_COLLECTION = 'system_counters';

/**
 * Concurrently safe, atomic inspection number generator using Firestore transaction.
 * Format: INS-YYYY-NNNN (e.g. INS-2026-0001).
 */
export async function generateNextInspectionNumber(targetYear?: number): Promise<string> {
  const year = targetYear || new Date().getFullYear();
  const counterDocRef = doc(db, COUNTERS_COLLECTION, `inspections_${year}`);

  // When online, attempt atomic Firestore transaction; when offline or if transaction fails,
  // use local cache / localStorage sequence and queue setDoc so offline saves never fail.
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const nextNumber = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterDocRef);
        let nextCount = 1;

        if (counterSnap.exists()) {
          const data = counterSnap.data() as InspectionSequence;
          nextCount = (data.currentCount || 0) + 1;
          transaction.update(counterDocRef, {
            currentCount: nextCount,
            updatedAt: new Date().toISOString(),
          });
        } else {
          transaction.set(counterDocRef, {
            year,
            currentCount: 1,
            updatedAt: new Date().toISOString(),
          });
        }

        return nextCount;
      });

      try {
        localStorage.setItem(`sheq_counter_${year}`, String(nextNumber));
      } catch {
        // ignore storage quota errors
      }
      const padded = String(nextNumber).padStart(4, '0');
      return `INS-${year}-${padded}`;
    } catch (err) {
      console.warn('Transaction unavailable (offline mode), using local offline counter:', err);
    }
  }

  // Offline-safe sequence generation
  let nextCount = 1;
  try {
    const cachedSnap = await getDoc(counterDocRef);
    if (cachedSnap.exists()) {
      const data = cachedSnap.data() as InspectionSequence;
      nextCount = (data.currentCount || 0) + 1;
    }
  } catch {
    // ignore
  }

  try {
    const localStored = parseInt(localStorage.getItem(`sheq_counter_${year}`) || '0', 10);
    if (!Number.isNaN(localStored) && localStored + 1 > nextCount) {
      nextCount = localStored + 1;
    }
    localStorage.setItem(`sheq_counter_${year}`, String(nextCount));
  } catch {
    // ignore
  }

  // Queue non-blocking update to Firestore local cache
  setDoc(
    counterDocRef,
    {
      year,
      currentCount: nextCount,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  ).catch(() => {});

  const padded = String(nextCount).padStart(4, '0');
  return `INS-${year}-${padded}`;
}

export interface CreateInspectionInput {
  title: string;
  inspectionDate: string; // ISO date YYYY-MM-DD
  departmentId: string;
  departmentNameSnapshot: string;
  generalComments?: string;
  status?: InspectionStatus;
}

export interface EnrichedInspection extends Inspection {
  findingsCount: number;
  openActionsCount: number;
}

export interface FindingWorkflowItem {
  id?: string;
  findingNumber: number;
  title: string;
  description: string;
  location: string;
  riskLevel: RiskLevel;
  recommendedAction: string;
  assignedToUserId: string;
  assignedToUserNameSnapshot: string;
  dueDate: string;
  inspectorComments?: string;
  status?: ActionStatus;
}

export interface SaveInspectionWorkflowParams {
  inspectionId?: string;
  inspectionDate: string;
  departmentId: string;
  departmentNameSnapshot: string;
  title: string;
  generalComments?: string;
  status: InspectionStatus; // 'Draft' | 'Completed'
  findings: FindingWorkflowItem[];
  deletedFindingIds?: string[];
  inspectorUserId: string;
  inspectorNameSnapshot: string;
}

export async function createInspection(
  input: CreateInspectionInput,
  inspectorUserId: string,
  inspectorNameSnapshot: string
): Promise<Inspection> {
  const status = input.status || 'Draft';
  const validationErrors = validateInspectionInput({
    title: input.title,
    inspectionDate: input.inspectionDate,
    departmentId: input.departmentId,
    status,
  });

  if (validationErrors.length > 0) {
    throw new Error(`Validation failed: ${validationErrors.map((e) => e.message).join(', ')}`);
  }

  // Atomically generate unique inspection number
  const inspectionNumber = await generateNextInspectionNumber(
    new Date(input.inspectionDate).getFullYear() || new Date().getFullYear()
  );

  const now = new Date().toISOString();
  const inspectionId = `ins_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const newInspection: Inspection = {
    id: inspectionId,
    inspectionNumber,
    inspectionDate: input.inspectionDate,
    departmentId: input.departmentId,
    departmentNameSnapshot: input.departmentNameSnapshot,
    inspectorUserId,
    inspectorNameSnapshot,
    title: input.title.trim(),
    generalComments: input.generalComments?.trim() || '',
    status,
    createdAt: now,
    updatedAt: now,
    createdByUserId: inspectorUserId,
    updatedByUserId: inspectorUserId,
  };

  const docRef = doc(db, INSPECTIONS_COLLECTION, inspectionId);
  await setDoc(docRef, newInspection);
  return newInspection;
}

export async function getInspectionById(id: string): Promise<Inspection | null> {
  const docRef = doc(db, INSPECTIONS_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as Inspection;
}

export async function getInspections(filter?: {
  status?: InspectionStatus;
  departmentId?: string;
}): Promise<Inspection[]> {
  const colRef = collection(db, INSPECTIONS_COLLECTION);
  let q = query(colRef, orderBy('inspectionDate', 'desc'));

  if (filter?.status) {
    q = query(colRef, where('status', '==', filter.status), orderBy('inspectionDate', 'desc'));
  } else if (filter?.departmentId) {
    q = query(colRef, where('departmentId', '==', filter.departmentId), orderBy('inspectionDate', 'desc'));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as Inspection);
}

/**
 * Retrieves inspections enriched with real-time finding and open action counts.
 */
export async function getInspectionsWithMetrics(filter?: {
  status?: InspectionStatus;
  departmentId?: string;
}): Promise<EnrichedInspection[]> {
  const inspections = await getInspections(filter);
  if (inspections.length === 0) return [];

  // Fetch all findings and actions to aggregate counts accurately
  const [findingsSnap, actionsSnap] = await Promise.all([
    getDocs(collection(db, 'findings')),
    getDocs(collection(db, 'actions')),
  ]);

  const findingsCountMap = new Map<string, number>();
  findingsSnap.docs.forEach((d) => {
    const data = d.data();
    const inspId = data.inspectionId as string;
    if (inspId) {
      findingsCountMap.set(inspId, (findingsCountMap.get(inspId) || 0) + 1);
    }
  });

  const openActionsCountMap = new Map<string, number>();
  actionsSnap.docs.forEach((d) => {
    const data = d.data();
    const inspId = data.inspectionId as string;
    const status = data.status as string;
    if (inspId && (status === 'Open' || status === 'In Progress' || status === 'Overdue')) {
      openActionsCountMap.set(inspId, (openActionsCountMap.get(inspId) || 0) + 1);
    }
  });

  return inspections.map((insp) => ({
    ...insp,
    findingsCount: findingsCountMap.get(insp.id) || 0,
    openActionsCount: openActionsCountMap.get(insp.id) || 0,
  }));
}

export async function updateInspection(
  inspectionId: string,
  updates: Partial<Omit<Inspection, 'id' | 'inspectionNumber' | 'createdAt' | 'createdByUserId'>>,
  updatedByUserId: string
): Promise<void> {
  const docRef = doc(db, INSPECTIONS_COLLECTION, inspectionId);
  await updateDoc(docRef, {
    ...updates,
    updatedByUserId,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Atomic workflow function to save an entire inspection with its findings and 1:1 corrective actions.
 * Supports saving as 'Draft' (partial validation) or 'Completed' (strict validation).
 * Guarantees no duplicate actions and atomic consistency across collections.
 */
export async function saveInspectionWorkflow(
  params: SaveInspectionWorkflowParams
): Promise<{ inspection: Inspection; savedFindingsCount: number }> {
  const now = new Date().toISOString();
  const isCompleted = params.status === 'Completed';

  // 1. Validation for Completion
  if (isCompleted) {
    const inspectionErrors = validateInspectionInput({
      title: params.title,
      inspectionDate: params.inspectionDate,
      departmentId: params.departmentId,
      status: 'Completed',
    });

    if (inspectionErrors.length > 0) {
      throw new Error(`Inspection details invalid: ${inspectionErrors.map((e) => e.message).join(', ')}`);
    }

    if (!params.findings || params.findings.length === 0) {
      throw new Error('At least one finding is required to complete an inspection.');
    }

    // Validate every individual finding
    for (let i = 0; i < params.findings.length; i++) {
      const f = params.findings[i];
      const findingErrors = validateFindingInput({
        inspectionId: params.inspectionId || 'temp',
        title: f.title,
        description: f.description,
        location: f.location,
        riskLevel: f.riskLevel,
        recommendedAction: f.recommendedAction,
        assignedToUserId: f.assignedToUserId,
        dueDate: f.dueDate,
      });

      if (findingErrors.length > 0) {
        throw new Error(`Finding #${f.findingNumber || i + 1} incomplete: ${findingErrors.map((e) => e.message).join(', ')}`);
      }
    }
  }

  // 2. Prepare Inspection Document
  let inspectionId = params.inspectionId;
  let inspectionNumber = '';
  let createdAt = now;

  if (inspectionId) {
    // Existing or pre-allocated inspection ID
    const existing = await getInspectionById(inspectionId).catch(() => null);
    if (existing) {
      inspectionNumber = existing.inspectionNumber;
      createdAt = existing.createdAt;
    } else {
      const year = new Date(params.inspectionDate).getFullYear() || new Date().getFullYear();
      inspectionNumber = await generateNextInspectionNumber(year);
    }
  } else {
    // Brand new inspection: generate atomic sequence
    const year = new Date(params.inspectionDate).getFullYear() || new Date().getFullYear();
    inspectionNumber = await generateNextInspectionNumber(year);
    inspectionId = `ins_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  const inspectionDoc: Inspection = {
    id: inspectionId,
    inspectionNumber,
    inspectionDate: params.inspectionDate || now.slice(0, 10),
    departmentId: params.departmentId || '',
    departmentNameSnapshot: params.departmentNameSnapshot || '',
    inspectorUserId: params.inspectorUserId,
    inspectorNameSnapshot: params.inspectorNameSnapshot,
    title: params.title.trim() || (isCompleted ? 'Inspection' : 'Draft Inspection'),
    generalComments: params.generalComments?.trim() || '',
    status: params.status,
    createdAt,
    updatedAt: now,
    createdByUserId: params.inspectorUserId,
    updatedByUserId: params.inspectorUserId,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, INSPECTIONS_COLLECTION, inspectionId), inspectionDoc);

  // 3. Handle Deleted Findings
  if (params.deletedFindingIds && params.deletedFindingIds.length > 0) {
    for (const delId of params.deletedFindingIds) {
      batch.delete(doc(db, 'findings', delId));
      // Also delete linked action
      const actionsSnap = await getDocs(
        query(collection(db, 'actions'), where('findingId', '==', delId))
      );
      actionsSnap.docs.forEach((actDoc) => {
        batch.delete(actDoc.ref);
      });
      // Clean up linked photos and storage binaries asynchronously
      deletePhotosForFinding(delId).catch((err) =>
        console.warn(`Could not clean up photos for finding ${delId}:`, err)
      );
    }
  }

  // 4. Handle Findings & 1:1 Corrective Actions
  for (let i = 0; i < params.findings.length; i++) {
    const item = params.findings[i];
    const findingNumber = item.findingNumber || (i + 1);

    if (item.id) {
      // Existing or pre-allocated finding
      const findingRef = doc(db, 'findings', item.id);
      const findingSnap = await getDoc(findingRef);

      if (findingSnap.exists()) {
        const updatedFinding: Partial<Finding> = {
          findingNumber,
          title: item.title.trim(),
          description: item.description.trim(),
          location: item.location.trim(),
          riskLevel: item.riskLevel,
          recommendedAction: item.recommendedAction.trim(),
          assignedToUserId: item.assignedToUserId,
          assignedToUserNameSnapshot: item.assignedToUserNameSnapshot,
          dueDate: item.dueDate,
          inspectorComments: item.inspectorComments?.trim() || '',
          updatedAt: now,
          updatedByUserId: params.inspectorUserId,
        };
        batch.update(findingRef, updatedFinding);
      } else {
        const fullFinding: Finding = {
          id: item.id,
          inspectionId,
          findingNumber,
          title: item.title.trim() || `Finding #${findingNumber}`,
          description: item.description.trim(),
          location: item.location.trim(),
          riskLevel: item.riskLevel || 'Medium',
          recommendedAction: item.recommendedAction.trim(),
          assignedToUserId: item.assignedToUserId || '',
          assignedToUserNameSnapshot: item.assignedToUserNameSnapshot || '',
          departmentNameSnapshot: params.departmentNameSnapshot,
          inspectionNumberSnapshot: inspectionDoc.inspectionNumber,
          inspectionDateSnapshot: params.inspectionDate,
          dueDate: item.dueDate || '',
          status: 'Open',
          inspectorComments: item.inspectorComments?.trim() || '',
          createdAt: now,
          updatedAt: now,
          createdByUserId: params.inspectorUserId,
          updatedByUserId: params.inspectorUserId,
        };
        batch.set(findingRef, fullFinding);
      }

      // Check linked action
      const actionsSnap = await getDocs(
        query(collection(db, 'actions'), where('findingId', '==', item.id))
      );

      if (!actionsSnap.empty) {
        // Update existing action
        actionsSnap.docs.forEach((actDoc) => {
          batch.update(actDoc.ref, {
            title: item.title.trim(),
            description: item.recommendedAction.trim(),
            riskLevel: item.riskLevel,
            assignedToUserId: item.assignedToUserId,
            assignedToUserNameSnapshot: item.assignedToUserNameSnapshot,
            departmentId: params.departmentId,
            departmentNameSnapshot: params.departmentNameSnapshot,
            inspectionNumberSnapshot: inspectionDoc.inspectionNumber,
            inspectionDateSnapshot: params.inspectionDate,
            dueDate: item.dueDate,
            updatedAt: now,
            updatedByUserId: params.inspectorUserId,
          });
        });
      } else if (item.assignedToUserId && item.dueDate) {
        // Action was not created yet (e.g. was partial draft): create 1:1 action now
        const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newAction: Action = {
          id: actionId,
          inspectionId,
          findingId: item.id,
          title: item.title.trim(),
          description: item.recommendedAction.trim(),
          riskLevel: item.riskLevel,
          assignedToUserId: item.assignedToUserId,
          assignedToUserNameSnapshot: item.assignedToUserNameSnapshot,
          departmentId: params.departmentId,
          departmentNameSnapshot: params.departmentNameSnapshot,
          inspectionNumberSnapshot: inspectionDoc.inspectionNumber,
          inspectionDateSnapshot: params.inspectionDate,
          dueDate: item.dueDate,
          status: 'Open',
          createdAt: now,
          updatedAt: now,
          createdByUserId: params.inspectorUserId,
          updatedByUserId: params.inspectorUserId,
        };
        batch.set(doc(db, 'actions', actionId), newAction);
      }
    } else {
      // New finding
      const newFindingId = `fnd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${i}`;
      const newActionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${i}`;

      const newFinding: Finding = {
        id: newFindingId,
        inspectionId,
        findingNumber,
        title: item.title.trim(),
        description: item.description.trim(),
        location: item.location.trim(),
        riskLevel: item.riskLevel,
        recommendedAction: item.recommendedAction.trim(),
        assignedToUserId: item.assignedToUserId,
        assignedToUserNameSnapshot: item.assignedToUserNameSnapshot,
        departmentNameSnapshot: params.departmentNameSnapshot,
        inspectionNumberSnapshot: inspectionDoc.inspectionNumber,
        inspectionDateSnapshot: params.inspectionDate,
        dueDate: item.dueDate,
        status: 'Open',
        inspectorComments: item.inspectorComments?.trim() || '',
        createdAt: now,
        updatedAt: now,
        createdByUserId: params.inspectorUserId,
        updatedByUserId: params.inspectorUserId,
      };

      batch.set(doc(db, 'findings', newFindingId), newFinding);

      // Create corresponding 1:1 corrective action if assignment info exists or if completing
      if (item.assignedToUserId && item.dueDate) {
        const newAction: Action = {
          id: newActionId,
          inspectionId,
          findingId: newFindingId,
          title: item.title.trim(),
          description: item.recommendedAction.trim(),
          riskLevel: item.riskLevel,
          assignedToUserId: item.assignedToUserId,
          assignedToUserNameSnapshot: item.assignedToUserNameSnapshot,
          departmentId: params.departmentId,
          departmentNameSnapshot: params.departmentNameSnapshot,
          inspectionNumberSnapshot: inspectionDoc.inspectionNumber,
          inspectionDateSnapshot: params.inspectionDate,
          dueDate: item.dueDate,
          status: 'Open',
          createdAt: now,
          updatedAt: now,
          createdByUserId: params.inspectorUserId,
          updatedByUserId: params.inspectorUserId,
        };
        batch.set(doc(db, 'actions', newActionId), newAction);
      }
    }
  }

  await batch.commit();

  return {
    inspection: inspectionDoc,
    savedFindingsCount: params.findings.length,
  };
}

/**
 * Deletes an inspection and cascades deletion to linked findings and actions.
 */
export async function deleteInspection(inspectionId: string): Promise<void> {
  // Find linked findings
  const findingsRef = collection(db, 'findings');
  const findingsSnap = await getDocs(query(findingsRef, where('inspectionId', '==', inspectionId)));

  // Find linked actions
  const actionsRef = collection(db, 'actions');
  const actionsSnap = await getDocs(query(actionsRef, where('inspectionId', '==', inspectionId)));

  const batch = writeBatch(db);

  // Delete actions
  actionsSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  // Delete findings
  findingsSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  // Delete inspection
  batch.delete(doc(db, INSPECTIONS_COLLECTION, inspectionId));

  await batch.commit();

  // Asynchronously purge all associated photograph storage binaries and metadata
  await deletePhotosForInspection(inspectionId).catch((err) =>
    console.warn(`Could not clean up photos for inspection ${inspectionId}:`, err)
  );
}

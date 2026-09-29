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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Finding, RiskLevel, ActionStatus, Action, Inspection } from '../types/sheq';
import { validateFindingInput } from '../utils/validation';
import { deletePhotosForFinding } from './photoService';

export const FINDINGS_COLLECTION = 'findings';
export const ACTIONS_COLLECTION = 'actions';

export interface CreateFindingInput {
  inspectionId: string;
  findingNumber: number;
  title: string;
  description: string;
  location: string;
  riskLevel: RiskLevel;
  recommendedAction: string;
  assignedToUserId: string; // Actioner UID
  assignedToUserNameSnapshot: string;
  dueDate: string;          // ISO YYYY-MM-DD
  inspectorComments?: string;
  status?: ActionStatus;
}

/**
 * Creates a finding and atomically provisions its corresponding Action record in the actions collection.
 * This guarantees strict Inspection -> Finding -> Action relationship with zero duplicate actions.
 */
export async function createFindingWithAction(
  input: CreateFindingInput,
  inspection: Inspection,
  creatorUserId: string
): Promise<{ finding: Finding; action: Action }> {
  const status = input.status || 'Open';
  const validationErrors = validateFindingInput({
    inspectionId: input.inspectionId,
    title: input.title,
    description: input.description,
    location: input.location,
    riskLevel: input.riskLevel,
    recommendedAction: input.recommendedAction,
    assignedToUserId: input.assignedToUserId,
    dueDate: input.dueDate,
  });

  if (validationErrors.length > 0) {
    throw new Error(`Validation failed: ${validationErrors.map((e) => e.message).join(', ')}`);
  }

  const now = new Date().toISOString();
  const findingId = `fnd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const newFinding: Finding = {
    id: findingId,
    inspectionId: input.inspectionId,
    findingNumber: input.findingNumber,
    title: input.title.trim(),
    description: input.description.trim(),
    location: input.location.trim(),
    riskLevel: input.riskLevel,
    recommendedAction: input.recommendedAction.trim(),
    assignedToUserId: input.assignedToUserId,
    assignedToUserNameSnapshot: input.assignedToUserNameSnapshot,
    dueDate: input.dueDate,
    status,
    inspectorComments: input.inspectorComments?.trim() || '',
    createdAt: now,
    updatedAt: now,
    createdByUserId: creatorUserId,
    updatedByUserId: creatorUserId,
  };

  const newAction: Action = {
    id: actionId,
    inspectionId: input.inspectionId,
    findingId,
    title: input.title.trim(),
    description: input.recommendedAction.trim(),
    riskLevel: input.riskLevel,
    assignedToUserId: input.assignedToUserId,
    assignedToUserNameSnapshot: input.assignedToUserNameSnapshot,
    departmentId: inspection.departmentId,
    departmentNameSnapshot: inspection.departmentNameSnapshot,
    dueDate: input.dueDate,
    status,
    actionerComments: '',
    createdAt: now,
    updatedAt: now,
    createdByUserId: creatorUserId,
    updatedByUserId: creatorUserId,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, FINDINGS_COLLECTION, findingId), newFinding);
  batch.set(doc(db, ACTIONS_COLLECTION, actionId), newAction);
  await batch.commit();

  return { finding: newFinding, action: newAction };
}

export async function getFindingsByInspectionId(inspectionId: string): Promise<Finding[]> {
  const colRef = collection(db, FINDINGS_COLLECTION);
  const q = query(colRef, where('inspectionId', '==', inspectionId), orderBy('findingNumber', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as Finding);
}

export async function getFindingById(id: string): Promise<Finding | null> {
  const docRef = doc(db, FINDINGS_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as Finding;
}

export async function updateFinding(
  findingId: string,
  updates: Partial<Omit<Finding, 'id' | 'inspectionId' | 'createdAt' | 'createdByUserId'>>,
  updatedByUserId: string
): Promise<void> {
  const now = new Date().toISOString();
  const findingDocRef = doc(db, FINDINGS_COLLECTION, findingId);

  // Also update synced fields in the associated action
  const actionsRef = collection(db, ACTIONS_COLLECTION);
  const actionsSnap = await getDocs(query(actionsRef, where('findingId', '==', findingId)));

  const batch = writeBatch(db);
  batch.update(findingDocRef, {
    ...updates,
    updatedByUserId,
    updatedAt: now,
  });

  actionsSnap.docs.forEach((actDoc) => {
    const actionUpdates: Record<string, unknown> = {
      updatedByUserId,
      updatedAt: now,
    };
    if (updates.title) actionUpdates.title = updates.title;
    if (updates.recommendedAction) actionUpdates.description = updates.recommendedAction;
    if (updates.riskLevel) actionUpdates.riskLevel = updates.riskLevel;
    if (updates.dueDate) actionUpdates.dueDate = updates.dueDate;
    if (updates.assignedToUserId) actionUpdates.assignedToUserId = updates.assignedToUserId;
    if (updates.assignedToUserNameSnapshot) actionUpdates.assignedToUserNameSnapshot = updates.assignedToUserNameSnapshot;
    if (updates.status) actionUpdates.status = updates.status;

    batch.update(actDoc.ref, actionUpdates);
  });

  await batch.commit();
}

export async function deleteFinding(findingId: string): Promise<void> {
  const actionsRef = collection(db, ACTIONS_COLLECTION);
  const actionsSnap = await getDocs(query(actionsRef, where('findingId', '==', findingId)));

  const batch = writeBatch(db);
  actionsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, FINDINGS_COLLECTION, findingId));
  await batch.commit();

  // Asynchronously purge all associated finding photo storage binaries and metadata
  await deletePhotosForFinding(findingId).catch((err) =>
    console.warn(`Could not clean up photos for finding ${findingId}:`, err)
  );
}

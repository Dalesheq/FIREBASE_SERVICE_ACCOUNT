import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Department } from '../types/sheq';

export const DEPARTMENTS_COLLECTION = 'departments';

export const INITIAL_DEPARTMENTS: Array<{
  id: string;
  name: string;
  displayOrder: number;
  colorCode: string;
}> = [
  { id: 'dept_1_grinding_bay', name: 'Grinding Bay', displayOrder: 1, colorCode: '#e11d48' },
  { id: 'dept_2_sheet_metal', name: 'Sheet Metal', displayOrder: 2, colorCode: '#2563eb' },
  { id: 'dept_3_sheq', name: 'SHEQ', displayOrder: 3, colorCode: '#059669' },
  { id: 'dept_4_stores', name: 'Stores', displayOrder: 4, colorCode: '#d97706' },
  { id: 'dept_5_electrical', name: 'Electrical', displayOrder: 5, colorCode: '#7c3aed' },
  { id: 'dept_6_admin_office', name: 'Administration / Office', displayOrder: 6, colorCode: '#475569' },
  { id: 'dept_7_project_mgmt', name: 'Project Management', displayOrder: 7, colorCode: '#0891b2' },
  { id: 'dept_8_commissioning', name: 'Commissioning', displayOrder: 8, colorCode: '#ea580c' },
  { id: 'dept_9_machine_shop', name: 'Machine Shop', displayOrder: 9, colorCode: '#4f46e5' },
  { id: 'dept_10_services_team', name: 'Services Team', displayOrder: 10, colorCode: '#0d9488' },
  { id: 'dept_11_blasting_bay', name: 'Blasting Bay', displayOrder: 11, colorCode: '#b91c1c' },
  { id: 'dept_12_welding', name: 'Welding', displayOrder: 12, colorCode: '#0284c7' },
];

export function getDefaultDepartments(): Department[] {
  const now = new Date().toISOString();
  return INITIAL_DEPARTMENTS.map((dept) => ({
    id: dept.id,
    name: dept.name,
    displayOrder: dept.displayOrder,
    active: true,
    colorCode: dept.colorCode,
    createdAt: now,
    updatedAt: now,
  }));
}

function mapAndSortDepartments(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
): Department[] {
  const byId = new Map<string, Department>();
  const now = new Date().toISOString();

  // 1. Seed map with the 11 canonical standard departments first so the list is never empty
  for (const std of INITIAL_DEPARTMENTS) {
    byId.set(std.id, {
      id: std.id,
      name: std.name,
      displayOrder: std.displayOrder,
      active: true,
      colorCode: std.colorCode,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 2. Overlay any Firestore documents
  for (const d of docs) {
    const data = d.data() as Partial<Department>;
    const resolvedId = data.id || d.id;
    const standardMatch = INITIAL_DEPARTMENTS.find((s) => s.id === resolvedId);

    byId.set(resolvedId, {
      ...data,
      id: resolvedId,
      name: standardMatch ? standardMatch.name : data.name || resolvedId,
      displayOrder:
        typeof data.displayOrder === 'number'
          ? data.displayOrder
          : standardMatch
          ? standardMatch.displayOrder
          : Number.MAX_SAFE_INTEGER,
      active: data.active !== false,
      colorCode: data.colorCode || standardMatch?.colorCode,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    });
  }

  const items = Array.from(byId.values());

  return items.sort((a, b) => {
    const orderA =
      typeof a.displayOrder === 'number' ? a.displayOrder : Number.MAX_SAFE_INTEGER;
    const orderB =
      typeof b.displayOrder === 'number' ? b.displayOrder : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * Retrieves all departments ordered safely in memory by displayOrder, then name.
 */
export async function getDepartments(): Promise<Department[]> {
  try {
    const deptRef = collection(db, DEPARTMENTS_COLLECTION);
    const snapshot = await getDocs(deptRef);
    return mapAndSortDepartments(snapshot.docs);
  } catch (error) {
    console.error('Failed to get departments from Firestore, using standard departments:', error);
    return getDefaultDepartments();
  }
}

/**
 * Retrieves only active departments for inspection creation.
 */
export async function getActiveDepartments(): Promise<Department[]> {
  try {
    const deptRef = collection(db, DEPARTMENTS_COLLECTION);
    const q = query(deptRef, where('active', '==', true));
    const snapshot = await getDocs(q);
    return mapAndSortDepartments(snapshot.docs).filter((d) => d.active !== false);
  } catch (error) {
    console.error('Failed to get active departments, using standard departments:', error);
    return getDefaultDepartments();
  }
}

export async function getDepartmentById(id: string): Promise<Department | null> {
  try {
    const docRef = doc(db, DEPARTMENTS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return getDefaultDepartments().find((d) => d.id === id) || null;
    }
    const data = snap.data() as Partial<Department>;
    const standardMatch = INITIAL_DEPARTMENTS.find((s) => s.id === (data.id || snap.id));
    return {
      ...data,
      id: data.id || snap.id,
      name: standardMatch ? standardMatch.name : data.name || snap.id,
      displayOrder:
        typeof data.displayOrder === 'number'
          ? data.displayOrder
          : standardMatch
          ? standardMatch.displayOrder
          : Number.MAX_SAFE_INTEGER,
      active: data.active !== false,
      colorCode: data.colorCode || standardMatch?.colorCode,
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
    };
  } catch (error) {
    console.error(`Failed to get department ${id}:`, error);
    return getDefaultDepartments().find((d) => d.id === id) || null;
  }
}

/**
 * Idempotent seed process for the 11 departments.
 * Preserves existing records and timestamps without creating duplicates.
 */
export async function seedDepartments(): Promise<{ seededCount: number; existingCount: number }> {
  const now = new Date().toISOString();
  let seededCount = 0;
  let existingCount = 0;

  for (const dept of INITIAL_DEPARTMENTS) {
    const docRef = doc(db, DEPARTMENTS_COLLECTION, dept.id);
    const existing = await getDoc(docRef);

    if (!existing.exists()) {
      const newRecord: Department = {
        id: dept.id,
        name: dept.name,
        displayOrder: dept.displayOrder,
        active: true,
        colorCode: dept.colorCode,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(docRef, newRecord);
      seededCount++;
    } else {
      const existingData = existing.data() as Partial<Department>;
      if (
        existingData.name !== dept.name ||
        existingData.id !== dept.id ||
        typeof existingData.displayOrder !== 'number'
      ) {
        await updateDoc(docRef, {
          id: dept.id,
          name: dept.name,
          displayOrder:
            typeof existingData.displayOrder === 'number'
              ? existingData.displayOrder
              : dept.displayOrder,
          updatedAt: now,
        });
      }
      existingCount++;
    }
  }

  return { seededCount, existingCount };
}

/**
 * Admin function to toggle department active status.
 * Prefers deactivation over deletion to protect historical inspection records.
 */
export async function setDepartmentActive(id: string, active: boolean): Promise<void> {
  const docRef = doc(db, DEPARTMENTS_COLLECTION, id);
  await updateDoc(docRef, {
    active,
    updatedAt: new Date().toISOString(),
  });
}

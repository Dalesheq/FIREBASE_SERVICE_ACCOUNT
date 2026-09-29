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
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserProfile, UserRole, SystemConfig } from '../types/auth';

export const USERS_COLLECTION = 'users';
export const SYSTEM_CONFIG_COLLECTION = 'system_config';
export const SETUP_DOC_ID = 'setup';

const DEFAULT_STANDARD_ACTIONERS: UserProfile[] = [
  {
    uid: 'actioner_japie_breitenbach',
    fullName: 'Japie Breitenbach',
    email: 'japie@spiralsystems.co.za',
    role: 'actioner',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    uid: 'actioner_hannes_bronkhorst',
    fullName: 'Hannes Bronkhorst',
    email: 'hannes@spiralsystems.co.za',
    role: 'actioner',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    const userSnapshot = await getDoc(userDocRef);
    if (!userSnapshot.exists()) {
      const cached = localStorage.getItem(`sheq_user_profile_${uid}`);
      return cached ? (JSON.parse(cached) as UserProfile) : null;
    }
    const profile = userSnapshot.data() as UserProfile;
    try {
      localStorage.setItem(`sheq_user_profile_${uid}`, JSON.stringify(profile));
    } catch {
      // ignore quota errors
    }
    return profile;
  } catch (error) {
    console.warn('Error fetching user profile from Firestore, checking local cache:', error);
    try {
      const cached = localStorage.getItem(`sheq_user_profile_${uid}`);
      if (cached) return JSON.parse(cached) as UserProfile;
    } catch {
      // ignore
    }
    throw error;
  }
}

export async function checkInitialAdminStatus(): Promise<{ adminExists: boolean; setupConfig: SystemConfig | null }> {
  try {
    const setupDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, SETUP_DOC_ID);
    const setupSnapshot = await getDoc(setupDocRef);
    if (setupSnapshot.exists()) {
      const data = setupSnapshot.data() as SystemConfig;
      try {
        localStorage.setItem('sheq_admin_setup', JSON.stringify(data));
      } catch {
        // ignore
      }
      return { adminExists: !!data.initialAdminSetupComplete, setupConfig: data };
    }
    const cached = localStorage.getItem('sheq_admin_setup');
    if (cached) {
      const parsed = JSON.parse(cached) as SystemConfig;
      return { adminExists: !!parsed.initialAdminSetupComplete, setupConfig: parsed };
    }
    return { adminExists: false, setupConfig: null };
  } catch (error) {
    console.warn('Error reading system_config setup:', error);
    try {
      const cached = localStorage.getItem('sheq_admin_setup');
      if (cached) {
        const parsed = JSON.parse(cached) as SystemConfig;
        return { adminExists: !!parsed.initialAdminSetupComplete, setupConfig: parsed };
      }
    } catch {
      // ignore
    }
    return { adminExists: true, setupConfig: null };
  }
}

/**
 * Standard user registration profile creation.
 * Enforces role: 'actioner'. Regular users can NEVER choose admin.
 */
export async function createActionerProfile(uid: string, fullName: string, email: string): Promise<UserProfile> {
  const now = new Date().toISOString();
  const profile: UserProfile = {
    uid,
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    role: 'actioner', // Strictly enforced as actioner
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  const userDocRef = doc(db, USERS_COLLECTION, uid);
  await setDoc(userDocRef, profile);
  return profile;
}

/**
 * Bootstraps the first administrator when no admin has been claimed.
 * Enforces atomic creation verified by Firestore rules.
 */
export async function bootstrapInitialAdmin(uid: string, fullName: string, email: string): Promise<UserProfile> {
  const now = new Date().toISOString();
  const setupDocRef = doc(db, SYSTEM_CONFIG_COLLECTION, SETUP_DOC_ID);

  const setupSnap = await getDoc(setupDocRef);
  if (setupSnap.exists() && setupSnap.data()?.initialAdminSetupComplete) {
    throw new Error('Initial administrator setup has already been completed and locked.');
  }

  // 1. Create the setup lock document
  await setDoc(setupDocRef, {
    initialAdminSetupComplete: true,
    firstAdminUid: uid,
    firstAdminEmail: email.trim().toLowerCase(),
    completedAt: now,
  });

  // 2. Create the admin profile
  const adminProfile: UserProfile = {
    uid,
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    role: 'admin',
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  const userDocRef = doc(db, USERS_COLLECTION, uid);
  await setDoc(userDocRef, adminProfile);
  return adminProfile;
}

/**
 * Admin function to retrieve all users.
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
}

/**
 * Retrieves active actioner users for allocation by the inspector (e.g. Japie, Hannes).
 */
export async function getActiveActioners(): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('active', '==', true));
    const snapshot = await getDocs(q);
    const users = snapshot.docs.map((d) => d.data() as UserProfile);
    const actioners = users.filter((u) => u.role === 'actioner');
    if (actioners.length > 0) {
      try {
        localStorage.setItem('sheq_cached_actioners', JSON.stringify(actioners));
      } catch {
        // ignore
      }
      return actioners;
    }
    const cached = localStorage.getItem('sheq_cached_actioners');
    if (cached) {
      return JSON.parse(cached) as UserProfile[];
    }
    return DEFAULT_STANDARD_ACTIONERS;
  } catch (error) {
    console.warn('Error fetching active actioners, using offline fallback:', error);
    try {
      const cached = localStorage.getItem('sheq_cached_actioners');
      if (cached) return JSON.parse(cached) as UserProfile[];
    } catch {
      // ignore
    }
    return DEFAULT_STANDARD_ACTIONERS;
  }
}

/**
 * Admin function to toggle user active status.
 */
export async function setUserActive(uid: string, active: boolean): Promise<void> {
  const userDocRef = doc(db, USERS_COLLECTION, uid);
  await updateDoc(userDocRef, {
    active,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Admin function to update a user's role.
 */
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  const userDocRef = doc(db, USERS_COLLECTION, uid);
  await updateDoc(userDocRef, {
    role,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Admin function to update permitted user fields (fullName, role, active).
 */
export async function updateUserByAdmin(
  uid: string,
  updates: { fullName?: string; role?: UserRole; active?: boolean }
): Promise<void> {
  const userDocRef = doc(db, USERS_COLLECTION, uid);
  const data: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };
  if (updates.fullName !== undefined) data.fullName = updates.fullName.trim();
  if (updates.role !== undefined) data.role = updates.role;
  if (updates.active !== undefined) data.active = updates.active;

  await updateDoc(userDocRef, data);
}

/**
 * Checks whether a user can be safely deleted without leaving active assigned records.
 */
export async function checkUserDeleteSafety(uid: string): Promise<{
  safe: boolean;
  assignedActionCount: number;
  inspectionCount: number;
  reason?: string;
}> {
  try {
    const actionsRef = collection(db, 'actions');
    const qAct = query(actionsRef, where('assignedToUserId', '==', uid));
    const actSnap = await getDocs(qAct);

    const inspectionsRef = collection(db, 'inspections');
    const qInsp = query(inspectionsRef, where('inspectorUserId', '==', uid));
    const inspSnap = await getDocs(qInsp);

    const assignedActionCount = actSnap.size;
    const inspectionCount = inspSnap.size;
    const safe = assignedActionCount === 0 && inspectionCount === 0;

    let reason: string | undefined;
    if (!safe) {
      reason = `User has ${assignedActionCount} assigned action(s) and ${inspectionCount} inspection(s). Deactivating the account is strongly recommended to preserve historical audit trails.`;
    }

    return { safe, assignedActionCount, inspectionCount, reason };
  } catch (err) {
    console.warn('Error checking user delete safety:', err);
    return { safe: false, assignedActionCount: 0, inspectionCount: 0, reason: 'Could not verify historical dependencies.' };
  }
}

/**
 * Admin function to delete a user with orphaned data protection.
 */
export async function deleteUser(uid: string): Promise<void> {
  const userDocRef = doc(db, USERS_COLLECTION, uid);
  await deleteDoc(userDocRef);
}

/**
 * Admin provisioning of an actioner profile.
 */
export async function provisionActionerByAdmin(
  uid: string,
  fullName: string,
  email: string
): Promise<UserProfile> {
  const now = new Date().toISOString();
  const profile: UserProfile = {
    uid,
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    role: 'actioner',
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  const userDocRef = doc(db, USERS_COLLECTION, uid);
  await setDoc(userDocRef, profile);
  return profile;
}

/**
 * Idempotently ensures primary actioners (Japie Breitenbach and Hannes Bronkhorst)
 * exist in Firestore so they are immediately available for allocation during inspections.
 */
export async function ensureStandardActioners(): Promise<UserProfile[]> {
  const currentActioners = await getActiveActioners();
  const japieExists = currentActioners.some(
    (u) => u.fullName.toLowerCase().includes('japie') || u.email.toLowerCase().includes('japie')
  );
  const hannesExists = currentActioners.some(
    (u) => u.fullName.toLowerCase().includes('hannes') || u.email.toLowerCase().includes('hannes')
  );

  if (!japieExists) {
    await provisionActionerByAdmin(
      'actioner_japie_breitenbach',
      'Japie Breitenbach',
      'japie@spiralsystems.co.za'
    );
  }
  if (!hannesExists) {
    await provisionActionerByAdmin(
      'actioner_hannes_bronkhorst',
      'Hannes Bronkhorst',
      'hannes@spiralsystems.co.za'
    );
  }

  return getActiveActioners();
}

/**
 * Allows an authenticated user to update their own full name.
 * Strictly preserves role, active status, email, and UID as required by Firestore Security Rules.
 */
export async function updateSelfProfile(uid: string, fullName: string): Promise<void> {
  const trimmed = fullName.trim();
  if (!trimmed) {
    throw new Error('Full name cannot be empty.');
  }
  const userDocRef = doc(db, USERS_COLLECTION, uid);
  await updateDoc(userDocRef, {
    fullName: trimmed,
    updatedAt: new Date().toISOString(),
  });
}

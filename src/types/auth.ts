export type UserRole = 'admin' | 'actioner';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemConfig {
  initialAdminSetupComplete: boolean;
  firstAdminUid: string;
  firstAdminEmail: string;
  completedAt: string;
}

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: import('firebase/auth').User | null;
  loading: boolean;
  initialAdminExists: boolean;
  error: string | null;
}

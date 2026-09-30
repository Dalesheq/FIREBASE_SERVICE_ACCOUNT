import { UserRole } from './auth';

export type InspectionStatus = 'Draft' | 'Completed' | 'Archived';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type ActionStatus = 'Open' | 'In Progress' | 'Completed' | 'Overdue' | 'Closed';

export interface Department {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
  colorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionSequence {
  year: number;
  currentCount: number;
  updatedAt: string;
}

export interface Inspection {
  id: string;
  inspectionNumber: string; // e.g. INS-2026-0001
  inspectionDate: string;   // ISO YYYY-MM-DD
  departmentId: string;
  departmentNameSnapshot: string;
  inspectorUserId: string;  // Firebase UID of inspector
  inspectorNameSnapshot: string;
  title: string;
  generalComments?: string;
  status: InspectionStatus;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
}

export interface Finding {
  id: string;
  inspectionId: string;
  findingNumber: number;
  title: string;
  description: string;
  location: string;
  riskLevel: RiskLevel;
  recommendedAction: string;
  assignedToUserId: string; // Firebase UID of Actioner
  assignedToUserNameSnapshot: string;
  assignedToUserEmail?: string;
  departmentNameSnapshot?: string;
  inspectionNumberSnapshot?: string;
  inspectionDateSnapshot?: string;
  dueDate: string;          // ISO YYYY-MM-DD
  status: ActionStatus;
  inspectorComments?: string;
  photoIds?: string[];
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
}

export interface Action {
  id: string;
  inspectionId: string;
  findingId: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  assignedToUserId: string; // Authoritative Firebase UID
  assignedToUserNameSnapshot: string;
  assignedToUserEmail?: string;
  departmentId?: string;
  departmentNameSnapshot?: string;
  inspectionNumberSnapshot?: string;
  inspectionDateSnapshot?: string;
  dueDate: string;          // ISO YYYY-MM-DD
  status: ActionStatus;     // Open | In Progress | Completed | Closed (Overdue calculated)
  effectiveStatus?: ActionStatus; // Runtime calculated effective status
  actionerComments?: string;
  completionDate?: string;  // ISO string when actioner marked completed
  evidencePhotoUrls?: string[];
  verifiedAt?: string;      // ISO string when admin verified
  verifiedByUserId?: string;// Admin UID
  closedAt?: string;        // ISO string when admin closed
  closedByUserId?: string;  // Admin UID
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
}

export type PhotoType = 'inspection' | 'evidence';

export interface PhotoMetadata {
  id: string;
  inspectionId: string;
  findingId?: string;
  actionId?: string;
  uploadedByUserId: string;
  uploadedByNameSnapshot?: string;
  assignedToUserId?: string;
  assignedToUserNameSnapshot?: string;
  assignedToUserEmail?: string;
  photoType: PhotoType;
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  caption?: string;
  createdAt: string;
  updatedAt: string;
}

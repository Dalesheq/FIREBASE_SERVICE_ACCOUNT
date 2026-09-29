import { seedDepartments, getDepartments } from './departmentService';
import { checkInitialAdminStatus, ensureStandardActioners } from './userService';

export interface SeedResult {
  departmentsSeeded: number;
  departmentsExisting: number;
  totalDepartments: number;
  adminConfigured: boolean;
  actionersCount: number;
  message: string;
}

/**
 * Safe, idempotent initialization routine for the application.
 * Seeds the 11 designated industrial departments if not already present.
 * Ensures standard actioners (Japie & Hannes) exist in Firestore.
 * Does NOT overwrite user accounts or existing inspections.
 */
export async function runSafeSystemInitialization(): Promise<SeedResult> {
  const deptResult = await seedDepartments();
  const allDepts = await getDepartments();
  const adminStatus = await checkInitialAdminStatus();
  const actioners = await ensureStandardActioners();

  return {
    departmentsSeeded: deptResult.seededCount,
    departmentsExisting: deptResult.existingCount,
    totalDepartments: allDepts.length,
    adminConfigured: adminStatus.adminExists,
    actionersCount: actioners.length,
    message: `System seed check completed: ${deptResult.seededCount} departments newly seeded, ${deptResult.existingCount} existing, total ${allDepts.length} departments. ${actioners.length} active actioners available. Initial administrator configured: ${adminStatus.adminExists ? 'Yes' : 'Pending bootstrap'}.`,
  };
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ClipboardCheck,
  Building2,
  Calendar,
  User,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Save,
  Clock,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Check,
  ChevronDown,
  Lock,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Department, RiskLevel, Inspection, Finding } from '../../types/sheq';
import {
  getDepartments,
  getDefaultDepartments,
  seedDepartments,
  INITIAL_DEPARTMENTS,
} from '../../services/departmentService';
import { getActiveActioners, ensureStandardActioners, provisionActionerByAdmin } from '../../services/userService';
import {
  FindingWorkflowItem,
  saveInspectionWorkflow,
  getInspectionById
} from '../../services/inspectionService';
import { getFindingsByInspectionId } from '../../services/findingService';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { FindingPhotoSection } from '../photos/FindingPhotoSection';
import { syncPhotosToInspection } from '../../services/photoService';

interface InspectionFormProps {
  initialInspectionId?: string | null;
  onDone: (savedInspectionId: string) => void;
  onCancel: () => void;
}

type StepType = 'details' | 'findings' | 'review';

export const InspectionForm: React.FC<InspectionFormProps> = ({
  initialInspectionId,
  onDone,
  onCancel,
}) => {
  const { currentUser, isAdmin } = useAuth();

  // Reference data from Firestore (pre-initialized with the 11 standard departments so dropdown is never empty)
  const [departments, setDepartments] = useState<Department[]>(() =>
    getDefaultDepartments()
  );
  const [actioners, setActioners] = useState<Array<{ uid: string; fullName: string; email: string }>>([]);
  const [loadingRefData, setLoadingRefData] = useState(true);

  // Form Step
  const [currentStep, setCurrentStep] = useState<StepType>('details');

  // Inspection Header State
  const [currentInspectionId, setCurrentInspectionId] = useState<string>(
    initialInspectionId || ''
  );
  const [inspectionNumber, setInspectionNumber] = useState<string>('Auto-generated upon save');
  const [inspectionDate, setInspectionDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(
    initialInspectionId ? '' : INITIAL_DEPARTMENTS[0].id
  );
  const [title, setTitle] = useState<string>('');
  const [generalComments, setGeneralComments] = useState<string>('');
  const [currentStatus, setCurrentStatus] = useState<'Draft' | 'Completed'>('Draft');

  // Findings State
  const [findings, setFindings] = useState<FindingWorkflowItem[]>([]);
  const [deletedFindingIds, setDeletedFindingIds] = useState<string[]>([]);
  const [expandedFindingIndex, setExpandedFindingIndex] = useState<number | null>(0);

  // UI & Validation States
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Modals
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [findingToDeleteIndex, setFindingToDeleteIndex] = useState<number | null>(null);
  const [quickAddActionerIndex, setQuickAddActionerIndex] = useState<number | null>(null);
  const [newActionerName, setNewActionerName] = useState('');
  const [newActionerEmail, setNewActionerEmail] = useState('');
  const [addingActioner, setAddingActioner] = useState(false);

  // Load Reference Data and Existing Inspection (if editing)
  useEffect(() => {
    let isMounted = true;
    const loadInitial = async () => {
      setLoadingRefData(true);
      try {
        // 1. Load & ensure 11 standard departments independently so no other failure can block them
        let depts = getDefaultDepartments();
        try {
          depts = await getDepartments();
          const isAdminUser =
            isAdmin ||
            currentUser?.role === 'admin' ||
            (currentUser?.role as string)?.toLowerCase() === 'admin';

          if (isAdminUser) {
            // Idempotently ensure the 11 standard department documents exist in Firestore
            seedDepartments()
              .then(async ({ seededCount }) => {
                if (seededCount > 0 && isMounted) {
                  const refreshed = await getDepartments();
                  if (isMounted && refreshed.length > 0) {
                    setDepartments(refreshed);
                  }
                }
              })
              .catch((seedErr) => {
                console.warn('Background department seed skipped:', seedErr);
              });
          }
        } catch (deptErr) {
          console.warn('Using fallback standard departments:', deptErr);
          depts = getDefaultDepartments();
        }

        if (!isMounted) return;
        const resolvedDepts = depts.length > 0 ? depts : getDefaultDepartments();
        setDepartments(resolvedDepts);

        // 2. Load & ensure standard actioners independently
        try {
          const actUsers = await getActiveActioners();
          if (!isMounted) return;
          if (actUsers.length === 0) {
            const seeded = await ensureStandardActioners();
            if (isMounted) setActioners(seeded);
          } else {
            setActioners(actUsers);
          }
        } catch (actErr) {
          console.warn('Failed to load actioners:', actErr);
        }

        // 3. If editing an existing inspection, load it
        if (initialInspectionId) {
          const existing = await getInspectionById(initialInspectionId);
          if (existing && isMounted) {
            setInspectionNumber(existing.inspectionNumber);
            setInspectionDate(existing.inspectionDate);
            setSelectedDepartmentId(existing.departmentId);
            setTitle(existing.title);
            setGeneralComments(existing.generalComments || '');
            setCurrentStatus(existing.status === 'Completed' ? 'Completed' : 'Draft');

            // Load existing findings
            const existingFindings = await getFindingsByInspectionId(initialInspectionId);
            if (isMounted) {
              const mapped: FindingWorkflowItem[] = existingFindings.map((f) => ({
                id: f.id,
                findingNumber: f.findingNumber,
                title: f.title,
                description: f.description,
                location: f.location,
                riskLevel: f.riskLevel,
                recommendedAction: f.recommendedAction,
                assignedToUserId: f.assignedToUserId,
                assignedToUserNameSnapshot: f.assignedToUserNameSnapshot,
                assignedToUserEmail: f.assignedToUserEmail || '',
                dueDate: f.dueDate,
                inspectorComments: f.inspectorComments || '',
                status: f.status,
              }));
              setFindings(mapped);
              if (mapped.length > 0) setExpandedFindingIndex(0);
            }
          }
        } else {
          // New inspection defaults
          if (resolvedDepts.length > 0) {
            setSelectedDepartmentId((prev) => prev || resolvedDepts[0].id);
          }
        }
      } catch (err: unknown) {
        const e = err as Error;
        if (isMounted) setSubmitError(`Initialization failed: ${e.message}`);
      } finally {
        if (isMounted) setLoadingRefData(false);
      }
    };

    loadInitial();
    return () => {
      isMounted = false;
    };
  }, [initialInspectionId, isAdmin, currentUser?.role]);

  // BeforeUnload unsaved changes listener
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Selected Department Helper
  const selectedDept = useMemo(() => {
    return departments.find((d) => d.id === selectedDepartmentId);
  }, [departments, selectedDepartmentId]);

  // Add a new Finding card
  const handleAddFinding = () => {
    setIsDirty(true);
    const nextFindingNum = findings.length + 1;
    // Default due date to +14 days from now
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 14);

    // Default actioner to Japie Breitenbach if available, or first actioner
    const defaultActioner = actioners.find(
      (a) => a.fullName.toLowerCase().includes('japie')
    ) || actioners[0];

    const newFindingId = `fnd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newFinding: FindingWorkflowItem = {
      id: newFindingId,
      findingNumber: nextFindingNum,
      title: '',
      description: '',
      location: '',
      riskLevel: 'Medium',
      recommendedAction: '',
      assignedToUserId: defaultActioner?.uid || '',
      assignedToUserNameSnapshot: defaultActioner?.fullName || '',
      assignedToUserEmail: defaultActioner?.email || '',
      dueDate: defaultDue.toISOString().slice(0, 10),
      inspectorComments: '',
    };

    const updated = [...findings, newFinding];
    setFindings(updated);
    setExpandedFindingIndex(updated.length - 1);
  };

  // Ensures parent draft inspection and finding exist in Firestore before photo upload
  const handleEnsureSavedParent = async (
    findingIndex: number
  ): Promise<{ inspectionId: string; findingId: string }> => {
    if (!currentUser) {
      throw new Error('You must be signed in to upload inspection photos.');
    }

    let fndId = findings[findingIndex]?.id;
    if (!fndId) {
      fndId = `fnd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      handleUpdateFinding(findingIndex, 'id', fndId);
    }

    const deptId = selectedDepartmentId || departments[0]?.id || 'DEP-FAB';
    const deptName = selectedDept?.name || departments[0]?.name || 'Fabrication';

    let result;
    try {
      result = await saveInspectionWorkflow({
        inspectionId: currentInspectionId || undefined,
        inspectionDate,
        departmentId: deptId,
        departmentNameSnapshot: deptName,
        title: title.trim() || 'Draft Inspection',
        generalComments,
        status: 'Draft',
        findings: findings.map((f, idx) => (idx === findingIndex ? { ...f, id: fndId } : f)),
        deletedFindingIds,
        inspectorUserId: currentUser.uid,
        inspectorNameSnapshot: currentUser.fullName || currentUser.email || 'SHEQ Inspector',
      });
    } catch {
      // If currentInspectionId was not yet in Firestore, create a fresh draft inspection
      result = await saveInspectionWorkflow({
        inspectionId: undefined,
        inspectionDate,
        departmentId: deptId,
        departmentNameSnapshot: deptName,
        title: title.trim() || 'Draft Inspection',
        generalComments,
        status: 'Draft',
        findings: findings.map((f, idx) => (idx === findingIndex ? { ...f, id: fndId } : f)),
        deletedFindingIds,
        inspectorUserId: currentUser.uid,
        inspectorNameSnapshot: currentUser.fullName || currentUser.email || 'SHEQ Inspector',
      });
    }

    setCurrentInspectionId(result.inspection.id);
    setInspectionNumber(result.inspection.inspectionNumber);
    return { inspectionId: result.inspection.id, findingId: fndId };
  };

  // Update a single finding field
  const handleUpdateFinding = (
    index: number,
    field: keyof FindingWorkflowItem,
    value: unknown
  ) => {
    setIsDirty(true);
    setFindings((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };

      // If updating assignedToUserId, automatically sync assignedToUserNameSnapshot and assignedToUserEmail
      if (field === 'assignedToUserId') {
        const found = actioners.find((a) => a.uid === value);
        if (found) {
          item.assignedToUserNameSnapshot = found.fullName;
          item.assignedToUserEmail = found.email || '';
        }
      }

      copy[index] = item;
      return copy;
    });

    // Clear field-specific validation error
    const errKey = `finding_${index}_${field}`;
    if (validationErrors[errKey]) {
      setValidationErrors((prev) => {
        const c = { ...prev };
        delete c[errKey];
        return c;
      });
    }
  };

  // Inline quick-add for a new departmental actioner during inspection
  const handleQuickAddActioner = async (findingIndex: number) => {
    const cleanName = newActionerName.trim();
    const cleanEmail = newActionerEmail.trim().toLowerCase();
    if (!cleanName || !cleanEmail) return;

    setAddingActioner(true);
    try {
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const uid = `actioner_${slug}_${Date.now().toString(36)}`;
      const created = await provisionActionerByAdmin(uid, cleanName, cleanEmail);
      const refreshed = await getActiveActioners();
      setActioners(refreshed);

      setIsDirty(true);
      setFindings((prev) => {
        const copy = [...prev];
        copy[findingIndex] = {
          ...copy[findingIndex],
          assignedToUserId: created.uid,
          assignedToUserNameSnapshot: created.fullName,
          assignedToUserEmail: created.email,
        };
        return copy;
      });

      setNewActionerName('');
      setNewActionerEmail('');
      setQuickAddActionerIndex(null);
    } catch (err) {
      console.warn('Failed to quick-add actioner:', err);
    } finally {
      setAddingActioner(false);
    }
  };

  // Quick preset for Due Date
  const handleSetDueDays = (index: number, daysFromNow: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    handleUpdateFinding(index, 'dueDate', target.toISOString().slice(0, 10));
  };

  // Remove a finding
  const handleConfirmDeleteFinding = () => {
    if (findingToDeleteIndex === null) return;
    setIsDirty(true);
    const item = findings[findingToDeleteIndex];
    if (item.id) {
      setDeletedFindingIds((prev) => [...prev, item.id as string]);
    }

    const updated = findings
      .filter((_, idx) => idx !== findingToDeleteIndex)
      .map((f, newIdx) => ({
        ...f,
        findingNumber: newIdx + 1, // Keep finding numbers clean sequential
      }));

    setFindings(updated);
    setFindingToDeleteIndex(null);
    if (expandedFindingIndex === findingToDeleteIndex) {
      setExpandedFindingIndex(updated.length > 0 ? 0 : null);
    }
  };

  // Validation function
  const validate = (targetStatus: 'Draft' | 'Completed'): boolean => {
    const errors: Record<string, string> = {};

    if (targetStatus === 'Completed') {
      if (!title.trim()) {
        errors['title'] = 'Inspection title is required.';
      }
      if (!selectedDepartmentId) {
        errors['department'] = 'Department selection is required.';
      }
      if (!inspectionDate) {
        errors['inspectionDate'] = 'Inspection date is required.';
      }
      if (findings.length === 0) {
        errors['findings'] = 'At least one finding is required to complete an inspection.';
      }

      // Check each finding
      findings.forEach((f, idx) => {
        if (!f.title.trim()) {
          errors[`finding_${idx}_title`] = 'Finding title is required.';
        }
        if (!f.description.trim()) {
          errors[`finding_${idx}_description`] = 'Finding description is required.';
        }
        if (!f.location.trim()) {
          errors[`finding_${idx}_location`] = 'Location is required.';
        }
        if (!f.riskLevel) {
          errors[`finding_${idx}_riskLevel`] = 'Risk level must be selected.';
        }
        if (!f.recommendedAction.trim()) {
          errors[`finding_${idx}_recommendedAction`] = 'Recommended corrective action is required.';
        }
        if (!f.assignedToUserId) {
          errors[`finding_${idx}_assignedToUserId`] = 'An active actioner must be allocated.';
        }
        if (!f.dueDate) {
          errors[`finding_${idx}_dueDate`] = 'Action due date is required.';
        }
      });
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Execution
  const handleSave = async (targetStatus: 'Draft' | 'Completed') => {
    setSubmitError(null);
    setSaveSuccessMsg(null);

    const isValid = validate(targetStatus);
    if (!isValid) {
      setSubmitError('Please address all highlighted requirements before completing the inspection.');
      // If validation fails on details, jump to details; if on findings, jump to findings
      if (validationErrors['title'] || validationErrors['department'] || validationErrors['inspectionDate']) {
        setCurrentStep('details');
      } else if (findings.length === 0 || Object.keys(validationErrors).some((k) => k.startsWith('finding_'))) {
        setCurrentStep('findings');
      }
      return;
    }

    setSaving(true);
    try {
      if (!currentUser) throw new Error('You must be signed in as an administrator to save an inspection.');

      let result;
      try {
        result = await saveInspectionWorkflow({
          inspectionId: currentInspectionId || initialInspectionId || undefined,
          inspectionDate,
          departmentId: selectedDepartmentId,
          departmentNameSnapshot: selectedDept?.name || 'General Department',
          title: title.trim() || (targetStatus === 'Draft' ? 'Draft Inspection' : 'Workplace Inspection'),
          generalComments,
          status: targetStatus,
          findings,
          deletedFindingIds,
          inspectorUserId: currentUser.uid,
          inspectorNameSnapshot: currentUser.fullName || currentUser.email || 'SHEQ Inspector',
        });
      } catch (firstErr: unknown) {
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        if (msg.toLowerCase().includes('not found')) {
          result = await saveInspectionWorkflow({
            inspectionId: undefined,
            inspectionDate,
            departmentId: selectedDepartmentId,
            departmentNameSnapshot: selectedDept?.name || 'General Department',
            title: title.trim() || (targetStatus === 'Draft' ? 'Draft Inspection' : 'Workplace Inspection'),
            generalComments,
            status: targetStatus,
            findings,
            deletedFindingIds,
            inspectorUserId: currentUser.uid,
            inspectorNameSnapshot: currentUser.fullName || currentUser.email || 'SHEQ Inspector',
          });
        } else {
          throw firstErr;
        }
      }

      // Ensure any photos uploaded while creating/editing findings are linked to the finalized inspection ID and actioner
      await syncPhotosToInspection(result.inspection.id, findings);

      setIsDirty(false);
      setSaveSuccessMsg(
        targetStatus === 'Completed'
          ? `Inspection ${result.inspection.inspectionNumber} successfully completed with ${result.savedFindingsCount} corrective actions allocated.`
          : `Inspection ${result.inspection.inspectionNumber} saved as draft.`
      );

      // Redirect after brief acknowledgement
      setTimeout(() => {
        onDone(result.inspection.id);
      }, 1000);
    } catch (err: unknown) {
      const e = err as Error;
      setSubmitError(e.message || 'Failed to save inspection.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      onCancel();
    }
  };

  if (loadingRefData) {
    return (
      <div className="py-20 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200 shadow-xs">
        <Clock className="h-6 w-6 animate-spin mx-auto text-slate-400 mb-2" />
        Loading departments and actioners from database...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={handleCancelClick}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Inspections List
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {initialInspectionId ? `Edit Inspection ${inspectionNumber}` : 'New Workplace Inspection'}
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                currentStatus === 'Completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {currentStatus}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Perform walkthrough inspection, document hazards, and allocate corrective actions directly to Japie Breitenbach or Hannes Bronkhorst.
          </p>
        </div>

        {/* Action Buttons Top */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave('Draft')}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
          >
            <Save className="h-3.5 w-3.5 text-slate-600" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave('Completed')}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? 'Processing...' : 'Complete Inspection'}
          </button>
        </div>
      </div>

      {/* Touch-Friendly Stepper Navigation */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs grid grid-cols-3 gap-2 text-xs font-bold text-center">
        <button
          type="button"
          onClick={() => setCurrentStep('details')}
          className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
            currentStep === 'details'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>1. Inspection Details</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep('findings')}
          className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
            currentStep === 'findings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>2. Findings ({findings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep('review')}
          className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
            currentStep === 'review'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          <span>3. Review & Submit</span>
        </button>
      </div>

      {/* Notifications / Alerts */}
      {submitError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 shadow-xs animate-in fade-in duration-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <div className="font-bold">Cannot complete inspection:</div>
            <div className="mt-0.5">{submitError}</div>
          </div>
        </div>
      )}

      {saveSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-bold">{saveSuccessMsg}</span>
        </div>
      )}

      {/* STEP 1: INSPECTION DETAILS */}
      {currentStep === 'details' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-700" />
              Inspection Details
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select the industrial department, inspection date, and provide an overview title.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Inspection Date */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Inspection Date *
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => {
                    setIsDirty(true);
                    setInspectionDate(e.target.value);
                  }}
                  className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsDirty(true);
                    setInspectionDate(new Date().toISOString().slice(0, 10));
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Today
                </button>
              </div>
              {validationErrors['inspectionDate'] && (
                <p className="text-rose-600 text-[11px] font-semibold mt-1">{validationErrors['inspectionDate']}</p>
              )}
            </div>

            {/* Department Selection (From active Firestore departments) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Department *
              </label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => {
                  setIsDirty(true);
                  setSelectedDepartmentId(e.target.value);
                }}
                className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-800 font-medium"
              >
                <option value="" disabled>Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {validationErrors['department'] && (
                <p className="text-rose-600 text-[11px] font-semibold mt-1">{validationErrors['department']}</p>
              )}
            </div>
          </div>

          {/* Inspection Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Inspection Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setIsDirty(true);
                setTitle(e.target.value);
              }}
              placeholder="e.g. Weekly Safety Walkthrough - Fabrication & Press"
              className="block w-full px-3 py-2.5 text-xs border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-800 font-medium"
            />
            {validationErrors['title'] && (
              <p className="text-rose-600 text-[11px] font-semibold mt-1">{validationErrors['title']}</p>
            )}
          </div>

          {/* General Comments */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              General Comments / Executive Summary
            </label>
            <textarea
              rows={3}
              value={generalComments}
              onChange={(e) => {
                setIsDirty(true);
                setGeneralComments(e.target.value);
              }}
              placeholder="Overall workplace housekeeping, PPE compliance observations, environmental notes..."
              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
            />
          </div>

          {/* Inspector Snapshot Card (Read-only, security enforced) */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold">
                <User className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Authoritative Inspector (Logged-in Administrator)
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {currentUser?.fullName || currentUser?.email || 'SHEQ Admin'}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  UID: {currentUser?.uid}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md text-[11px] font-bold">
              <Lock className="h-3.5 w-3.5 text-emerald-700" />
              <span>Auto-Assigned</span>
            </div>
          </div>

          {/* Navigation to Next Step */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setCurrentStep('findings')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <span>Continue to Findings</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: FINDINGS ENTRY */}
      {currentStep === 'findings' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Walkthrough Findings & Corrective Actions
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Record observed non-conformances and immediately allocate action items to Japie Breitenbach or Hannes Bronkhorst.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddFinding}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
              + Add Finding
            </button>
          </div>

          {validationErrors['findings'] && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700">
              {validationErrors['findings']}
            </div>
          )}

          {findings.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border-2 border-dashed border-slate-200 space-y-3">
              <AlertTriangle className="h-10 w-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No findings added yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Click the "+ Add Finding" button to record hazards, defects, or safety observations found during your inspection.
              </p>
              <button
                type="button"
                onClick={handleAddFinding}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add First Finding
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {findings.map((finding, index) => {
                const isExpanded = expandedFindingIndex === index;
                const findingErrPrefix = `finding_${index}_`;
                const hasErrors = Object.keys(validationErrors).some((k) =>
                  k.startsWith(findingErrPrefix)
                );

                return (
                  <div
                    key={finding.id || `fnd_item_${index}`}
                    className={`bg-white rounded-xl border transition-all overflow-hidden ${
                      hasErrors
                        ? 'border-rose-300 ring-2 ring-rose-200'
                        : isExpanded
                        ? 'border-slate-400 shadow-sm'
                        : 'border-slate-200 shadow-xs'
                    }`}
                  >
                    {/* Finding Accordion Header */}
                    <div
                      onClick={() =>
                        setExpandedFindingIndex(isExpanded ? null : index)
                      }
                      className="p-4 bg-slate-50/80 hover:bg-slate-100/70 transition-colors flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-mono font-bold shrink-0">
                          #{finding.findingNumber || index + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>{finding.title || 'Untitled Finding (Click to expand)'}</span>
                            {finding.riskLevel && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  finding.riskLevel === 'Critical'
                                    ? 'bg-rose-100 text-rose-800'
                                    : finding.riskLevel === 'High'
                                    ? 'bg-orange-100 text-orange-800'
                                    : finding.riskLevel === 'Medium'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {finding.riskLevel}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>Location: {finding.location || 'Not specified'}</span>
                            <span>•</span>
                            <span>Actioner: {finding.assignedToUserNameSnapshot || 'Unassigned'}</span>
                            <span>•</span>
                            <span>Due: {finding.dueDate || 'Pending'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFindingToDeleteIndex(index);
                          }}
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                          title="Remove finding"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        )}
                      </div>
                    </div>

                    {/* Finding Form Body */}
                    {isExpanded && (
                      <div className="p-6 space-y-5 border-t border-slate-200">
                        {/* Title & Location */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                              Finding Title / Hazard *
                            </label>
                            <input
                              type="text"
                              value={finding.title}
                              onChange={(e) =>
                                handleUpdateFinding(index, 'title', e.target.value)
                              }
                              placeholder="e.g. Missing safety guard on hydraulic press"
                              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                            />
                            {validationErrors[`${findingErrPrefix}title`] && (
                              <p className="text-rose-600 text-[11px] font-semibold mt-1">
                                {validationErrors[`${findingErrPrefix}title`]}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                              Specific Workplace Location *
                            </label>
                            <input
                              type="text"
                              value={finding.location}
                              onChange={(e) =>
                                handleUpdateFinding(index, 'location', e.target.value)
                              }
                              placeholder="e.g. Press Bay 2, adjacent to main aisle"
                              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                            />
                            {validationErrors[`${findingErrPrefix}location`] && (
                              <p className="text-rose-600 text-[11px] font-semibold mt-1">
                                {validationErrors[`${findingErrPrefix}location`]}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Risk Level Touch Pills */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                            Risk Level *
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(['Low', 'Medium', 'High', 'Critical'] as RiskLevel[]).map(
                              (risk) => {
                                const selected = finding.riskLevel === risk;
                                return (
                                  <button
                                    key={risk}
                                    type="button"
                                    onClick={() =>
                                      handleUpdateFinding(index, 'riskLevel', risk)
                                    }
                                    className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                      selected
                                        ? risk === 'Critical'
                                          ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                          : risk === 'High'
                                          ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                                          : risk === 'Medium'
                                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                          : 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        selected ? 'bg-white' : 'bg-slate-400'
                                      }`}
                                    />
                                    {risk}
                                  </button>
                                );
                              }
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                            Detailed Description / Observation *
                          </label>
                          <textarea
                            rows={2}
                            value={finding.description}
                            onChange={(e) =>
                              handleUpdateFinding(index, 'description', e.target.value)
                            }
                            placeholder="Describe the physical condition, non-compliance with OHSA/ISO, or safety risk observed..."
                            className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                          />
                          {validationErrors[`${findingErrPrefix}description`] && (
                            <p className="text-rose-600 text-[11px] font-semibold mt-1">
                              {validationErrors[`${findingErrPrefix}description`]}
                            </p>
                          )}
                        </div>

                        {/* Recommended Corrective Action */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                                Recommended Corrective Action *
                              </label>
                              <span className="text-[11px] text-slate-500 font-medium">
                                Directs action item creation
                              </span>
                            </div>
                            <textarea
                              rows={2}
                              value={finding.recommendedAction}
                              onChange={(e) =>
                                handleUpdateFinding(
                                  index,
                                  'recommendedAction',
                                  e.target.value
                                )
                              }
                              placeholder="Specify exact action required to rectify the hazard (e.g. Fabricate and install interlocked steel guard)..."
                              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                            />
                            {validationErrors[`${findingErrPrefix}recommendedAction`] && (
                              <p className="text-rose-600 text-[11px] font-semibold mt-1">
                                {validationErrors[`${findingErrPrefix}recommendedAction`]}
                              </p>
                            )}
                          </div>

                          {/* Actioner Allocation & Due Date */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Actioner Dropdown: Loaded from active Firestore actioners */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                                  Allocate Corrective Action To *
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuickAddActionerIndex(
                                      quickAddActionerIndex === index ? null : index
                                    )
                                  }
                                  className="text-[11px] font-bold text-sky-700 hover:text-sky-900 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" />
                                  {quickAddActionerIndex === index ? 'Cancel' : 'Add New Actioner'}
                                </button>
                              </div>
                              <select
                                value={finding.assignedToUserId}
                                onChange={(e) =>
                                  handleUpdateFinding(
                                    index,
                                    'assignedToUserId',
                                    e.target.value
                                  )
                                }
                                className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                              >
                                <option value="" disabled>Select Actioner</option>
                                {actioners.map((act) => (
                                  <option key={act.uid} value={act.uid}>
                                    {act.fullName} ({act.email})
                                  </option>
                                ))}
                              </select>
                              {quickAddActionerIndex === index && (
                                <div className="mt-2 p-3 bg-white border border-sky-200 rounded-lg space-y-2 shadow-xs">
                                  <div className="text-[11px] font-bold text-slate-800">
                                    Provision New Actioner for Allocation
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input
                                      type="text"
                                      value={newActionerName}
                                      onChange={(e) => setNewActionerName(e.target.value)}
                                      placeholder="Full Name (e.g. Pieter Botha)"
                                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                                    />
                                    <input
                                      type="email"
                                      value={newActionerEmail}
                                      onChange={(e) => setNewActionerEmail(e.target.value)}
                                      placeholder="Email (e.g. pieter@company.co.za)"
                                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-500">
                                      When they register with this email, their allocated actions link automatically.
                                    </span>
                                    <button
                                      type="button"
                                      disabled={addingActioner || !newActionerName.trim() || !newActionerEmail.trim()}
                                      onClick={() => handleQuickAddActioner(index)}
                                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-md disabled:opacity-50 cursor-pointer"
                                    >
                                      {addingActioner ? 'Adding...' : 'Save & Allocate'}
                                    </button>
                                  </div>
                                </div>
                              )}
                              <p className="text-[11px] text-slate-500 mt-1">
                                All registered &amp; provisioned actioners appear here. Each actioner only sees tasks allocated to them.
                              </p>
                              {validationErrors[`${findingErrPrefix}assignedToUserId`] && (
                                <p className="text-rose-600 text-[11px] font-semibold mt-1">
                                  {validationErrors[`${findingErrPrefix}assignedToUserId`]}
                                </p>
                              )}
                            </div>

                            {/* Due Date with Quick Shortcuts */}
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                                Action Due Date *
                              </label>
                              <div className="space-y-1.5">
                                <input
                                  type="date"
                                  value={finding.dueDate}
                                  onChange={(e) =>
                                    handleUpdateFinding(index, 'dueDate', e.target.value)
                                  }
                                  className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                                />
                                <div className="flex items-center gap-1 text-[10px]">
                                  <span className="text-slate-500 mr-1 font-medium">Shortcuts:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleSetDueDays(index, 7)}
                                    className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold cursor-pointer"
                                  >
                                    +7 Days
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetDueDays(index, 14)}
                                    className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold cursor-pointer"
                                  >
                                    +14 Days
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetDueDays(index, 30)}
                                    className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold cursor-pointer"
                                  >
                                    +30 Days
                                  </button>
                                </div>
                              </div>
                              {validationErrors[`${findingErrPrefix}dueDate`] && (
                                <p className="text-rose-600 text-[11px] font-semibold mt-1">
                                  {validationErrors[`${findingErrPrefix}dueDate`]}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Inspector Comments */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                            Additional Inspector Comments (Optional)
                          </label>
                          <input
                            type="text"
                            value={finding.inspectorComments || ''}
                            onChange={(e) =>
                              handleUpdateFinding(
                                index,
                                'inspectorComments',
                                e.target.value
                              )
                            }
                            placeholder="e.g. Re-inspect at next safety committee meeting"
                            className="block w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                          />
                        </div>

                        {/* Finding Photographs (Camera capture & Cloud Storage upload) */}
                        <FindingPhotoSection
                          inspectionId={currentInspectionId}
                          findingId={finding.id || ''}
                          canUpload={true}
                          canDelete={true}
                          onEnsureSavedParent={() => handleEnsureSavedParent(index)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep('details')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Details
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddFinding}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Another Finding
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('review')}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer transition-colors"
              >
                <span>Review Inspection</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & COMPLETE SCREEN */}
      {currentStep === 'review' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                  Pre-Completion Inspection Review
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify inspection parameters and individual findings before finalizing and generating corrective actions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep('details')}
                  className="text-xs text-slate-700 hover:text-slate-900 underline font-semibold cursor-pointer"
                >
                  Edit Header Details
                </button>
              </div>
            </div>

            {/* Inspection Header Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Inspection #
                </div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">
                  {inspectionNumber}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Inspection Date
                </div>
                <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {inspectionDate}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Department
                </div>
                <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: selectedDept?.colorCode || '#64748b' }}
                  />
                  {selectedDept?.name || 'Not selected'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Inspector
                </div>
                <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  {currentUser?.fullName || currentUser?.email}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Title & Executive Notes
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {title || 'Untitled Inspection'}
              </div>
              {generalComments && (
                <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {generalComments}
                </p>
              )}
            </div>

            {/* Findings & Actions Detailed Review Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-slate-700" />
                  Findings to be Registered ({findings.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setCurrentStep('findings')}
                  className="text-xs text-slate-700 hover:text-slate-900 underline font-semibold cursor-pointer"
                >
                  Edit Findings
                </button>
              </div>

              {findings.length === 0 ? (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                  No findings have been entered. At least one finding is required before an inspection can be completed.
                </div>
              ) : (
                <div className="space-y-3">
                  {findings.map((f, idx) => (
                    <div
                      key={f.id || `review_fnd_${idx}`}
                      className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-mono font-bold">
                            #{f.findingNumber || idx + 1}
                          </span>
                          <span className="font-bold text-sm text-slate-900">
                            {f.title || 'Untitled Finding'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              f.riskLevel === 'Critical'
                                ? 'bg-rose-100 text-rose-800'
                                : f.riskLevel === 'High'
                                ? 'bg-orange-100 text-orange-800'
                                : f.riskLevel === 'Medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {f.riskLevel}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCurrentStep('findings');
                            setExpandedFindingIndex(idx);
                          }}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer shrink-0"
                        >
                          Edit
                        </button>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        <div>
                          <span className="font-semibold text-slate-700">Location: </span>
                          {f.location || 'None'}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700">Observation: </span>
                          {f.description || 'None'}
                        </div>
                      </div>

                      {/* Corrective Action Card Preview */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            1:1 Corrective Action Assignment
                          </div>
                          <div className="text-slate-900 font-semibold mt-0.5">
                            {f.recommendedAction || 'No corrective action specified'}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                          <div className="text-right">
                            <div className="text-[10px] text-slate-500 uppercase font-bold">Actioner</div>
                            <div className="font-bold text-slate-900">
                              {f.assignedToUserNameSnapshot || 'Unassigned'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-slate-500 uppercase font-bold">Due Date</div>
                            <div className="font-bold text-slate-900">{f.dueDate || 'None'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Review Photos preview */}
                      {currentInspectionId && f.id && (
                        <div className="pt-2 border-t border-slate-100">
                          <FindingPhotoSection
                            inspectionId={currentInspectionId}
                            findingId={f.id}
                            canUpload={false}
                            canDelete={false}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Final Action Submission Bar */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep('findings')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Findings
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSave('Draft')}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <Save className="h-4 w-4 text-slate-600" />
                  Save as Draft
                </button>

                <button
                  type="button"
                  onClick={() => handleSave('Completed')}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-md cursor-pointer transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? 'Completing Inspection...' : 'Complete Inspection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDiscardModal}
        title="Discard Unsaved Changes?"
        message="You have unsaved modifications in this inspection. If you leave now, any unpersisted findings or changes will be lost."
        confirmLabel="Discard & Leave"
        cancelLabel="Keep Editing"
        isDestructive={true}
        onConfirm={onCancel}
        onCancel={() => setShowDiscardModal(false)}
      />

      {/* Delete Finding Confirmation Modal */}
      <ConfirmationModal
        isOpen={findingToDeleteIndex !== null}
        title="Remove Finding"
        message="Are you sure you want to remove this finding? If this inspection was previously saved, the linked corrective action will also be removed."
        confirmLabel="Remove Finding"
        isDestructive={true}
        onConfirm={handleConfirmDeleteFinding}
        onCancel={() => setFindingToDeleteIndex(null)}
      />
    </div>
  );
};

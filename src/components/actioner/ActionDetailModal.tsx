import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PlayCircle,
  FileText,
  MapPin,
  UserCheck,
  Save,
  Camera,
  Info,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { Action, Finding, RiskLevel } from '../../types/sheq';
import { getFindingById } from '../../services/findingService';
import { updateActionByActioner } from '../../services/actionService';
import { isActionOverdue } from '../../utils/validation';
import { useAuth } from '../../context/AuthContext';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { ActionEvidencePhotoSection } from '../photos/ActionEvidencePhotoSection';
import { FindingPhotoSection } from '../photos/FindingPhotoSection';

interface ActionDetailModalProps {
  action: Action;
  onClose: () => void;
  onActionUpdated?: () => void;
}

const RISK_BADGES: Record<RiskLevel, { label: string; bg: string; text: string; border: string }> = {
  Critical: { label: 'CRITICAL', bg: 'bg-red-500/10', text: 'text-red-700', border: 'border-red-300' },
  High: { label: 'HIGH RISK', bg: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-orange-300' },
  Medium: { label: 'MEDIUM RISK', bg: 'bg-amber-500/10', text: 'text-amber-700', border: 'border-amber-300' },
  Low: { label: 'LOW RISK', bg: 'bg-blue-500/10', text: 'text-blue-700', border: 'border-blue-300' },
};

export const ActionDetailModal: React.FC<ActionDetailModalProps> = ({
  action,
  onClose,
  onActionUpdated,
}) => {
  const { currentUser } = useAuth();

  // Linked Finding Data
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loadingFinding, setLoadingFinding] = useState(true);

  // Local comments state
  const [actionerComments, setActionerComments] = useState<string>(action.actionerComments || '');
  const [savingComments, setSavingComments] = useState(false);
  const [commentsSavedNotice, setCommentsSavedNotice] = useState(false);

  // Status transition state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Completion confirmation modal
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Fetch linked finding observation details
  useEffect(() => {
    let isMounted = true;
    async function loadFinding() {
      if (!action.findingId) {
        setLoadingFinding(false);
        return;
      }
      try {
        const found = await getFindingById(action.findingId);
        if (isMounted) {
          setFinding(found);
        }
      } catch (err) {
        console.error('Failed to load finding for action:', err);
      } finally {
        if (isMounted) setLoadingFinding(false);
      }
    }
    loadFinding();
    return () => {
      isMounted = false;
    };
  }, [action.findingId]);

  // Keep actioner comments in sync if prop changes
  useEffect(() => {
    setActionerComments(action.actionerComments || '');
  }, [action.actionerComments]);

  const overdue = isActionOverdue(action.dueDate, action.status);
  const risk = RISK_BADGES[action.riskLevel] || RISK_BADGES.Medium;

  // Handle saving comments independently
  const handleSaveComments = async () => {
    if (!currentUser) return;
    setSavingComments(true);
    setErrorMessage(null);
    setCommentsSavedNotice(false);

    try {
      await updateActionByActioner(action.id, currentUser.uid, {
        actionerComments: actionerComments.trim(),
      });
      setCommentsSavedNotice(true);
      setTimeout(() => setCommentsSavedNotice(false), 3000);
      if (onActionUpdated) onActionUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save comments.';
      setErrorMessage(msg);
    } finally {
      setSavingComments(false);
    }
  };

  // Handle Start Action (Open -> In Progress)
  const handleStartAction = async () => {
    if (!currentUser) return;
    setUpdatingStatus(true);
    setErrorMessage(null);

    try {
      await updateActionByActioner(action.id, currentUser.uid, {
        status: 'In Progress',
        actionerComments: actionerComments.trim() || undefined,
      });
      if (onActionUpdated) onActionUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start action.';
      setErrorMessage(msg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Mark Completed confirmation execution
  const handleConfirmComplete = async () => {
    if (!currentUser) return;
    setUpdatingStatus(true);
    setErrorMessage(null);

    try {
      await updateActionByActioner(action.id, currentUser.uid, {
        status: 'Completed',
        completionDate: new Date().toISOString(),
        actionerComments: actionerComments.trim() || undefined,
      });
      setShowCompleteConfirm(false);
      if (onActionUpdated) onActionUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark action as completed.';
      setErrorMessage(msg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Revert to In Progress (if actioner marked complete prematurely)
  const handleRevertToInProgress = async () => {
    if (!currentUser) return;
    setUpdatingStatus(true);
    setErrorMessage(null);

    try {
      await updateActionByActioner(action.id, currentUser.uid, {
        status: 'In Progress',
      });
      if (onActionUpdated) onActionUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update action.';
      setErrorMessage(msg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const inspectionNumber =
    action.inspectionNumberSnapshot ||
    finding?.inspectionNumberSnapshot ||
    `INS-${action.inspectionId.substring(0, 8)}`;

  const inspectionDate =
    action.inspectionDateSnapshot ||
    finding?.inspectionDateSnapshot ||
    'Recorded on Inspection';

  const departmentName =
    action.departmentNameSnapshot ||
    finding?.departmentNameSnapshot ||
    'Workplace Department';

  const findingNumber = finding?.findingNumber || 1;
  const findingDescription = finding?.description || action.description;
  const findingLocation = finding?.location || 'Workplace Floor';
  const inspectorComments = finding?.inspectorComments || '';

  return (
    <>
      <div
        id="action-detail-backdrop"
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          id="action-detail-modal"
          role="dialog"
          aria-modal="true"
          className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-sky-300">
                    {inspectionNumber}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-300 font-medium">
                    Finding #{findingNumber}
                  </span>
                </div>
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                  {action.title}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-slate-900 text-sm">
            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Assignment & Authoritative Banner */}
            <div className="p-3.5 bg-sky-50/80 border border-sky-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                  <UserCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-sky-900">
                    Assigned Actioner
                  </div>
                  <div className="text-xs font-bold text-sky-950">
                    {action.assignedToUserNameSnapshot || currentUser?.fullName || 'Assigned to You'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {overdue && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Overdue
                  </span>
                )}
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                    action.status === 'Completed'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : action.status === 'In Progress'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-sky-100 text-sky-800 border-sky-300'
                  }`}
                >
                  {action.status}
                </span>
              </div>
            </div>

            {/* Inspection Context Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                  Department
                </span>
                <span className="font-semibold text-slate-900 flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {departmentName}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                  Inspection Date
                </span>
                <span className="font-semibold text-slate-900 flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {inspectionDate}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                  Due Date
                </span>
                <span
                  className={`font-semibold flex items-center gap-1 mt-0.5 ${
                    overdue ? 'text-red-700 font-bold' : 'text-slate-900'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {action.dueDate}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                  Risk Level
                </span>
                <span
                  className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${risk.bg} ${risk.text} ${risk.border}`}
                >
                  {risk.label}
                </span>
              </div>
            </div>

            {/* Finding Observation Section (Read-Only) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                  Workplace Finding Description
                </span>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  {findingLocation}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed">
                {findingDescription}
              </div>
            </div>

            {/* Required Corrective Action (Read-Only) */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Required Corrective Action
              </span>
              <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-950 leading-relaxed">
                {action.description}
              </div>
            </div>

            {/* Inspector Comments (Read-Only) */}
            {inspectorComments && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-slate-500" />
                  Inspector Instructions / Comments
                </span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 italic leading-relaxed">
                  "{inspectorComments}"
                </div>
              </div>
            )}

            {/* Inspection Photos of the Finding (Read-Only reference for Actioner) */}
            {action.findingId && (
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider block mb-1">
                  Hazard Finding Context
                </span>
                <FindingPhotoSection
                  inspectionId={action.inspectionId}
                  findingId={action.findingId}
                  canUpload={false}
                  canDelete={false}
                />
              </div>
            )}

            {/* Corrective Action Evidence Photographs */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <ActionEvidencePhotoSection
                actionId={action.id}
                inspectionId={action.inspectionId}
                findingId={action.findingId}
                assignedToUserId={action.assignedToUserId}
                canUpload={action.status !== 'Closed'}
              />
            </div>

            {/* Actioner Comments (Editable) */}
            <div className="space-y-2 pt-1 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="actioner-comments-input"
                  className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <UserCheck className="h-3.5 w-3.5 text-sky-600" />
                  Actioner Comments & Progress Notes
                </label>
                {commentsSavedNotice && (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 animate-in fade-in">
                    <CheckCircle2 className="h-3 w-3" />
                    Saved
                  </span>
                )}
              </div>
              <textarea
                id="actioner-comments-input"
                rows={3}
                value={actionerComments}
                onChange={(e) => setActionerComments(e.target.value)}
                placeholder="Detail the work carried out, parts replaced, or corrective steps taken..."
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveComments}
                  disabled={savingComments}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingComments ? 'Saving...' : 'Save Comments'}
                </button>
              </div>
            </div>

            {/* Completed Notice if already completed */}
            {action.status === 'Completed' && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Action Marked as Completed
                </div>
                <div className="text-slate-600 text-[11px]">
                  Completed timestamp:{' '}
                  <strong>
                    {action.completionDate
                      ? new Date(action.completionDate).toLocaleString()
                      : 'Recorded'}
                  </strong>
                </div>
                <div className="text-slate-500 text-[11px]">
                  This task is now awaiting Administrator review, verification, and closure.
                </div>
              </div>
            )}
          </div>

          {/* Footer Action Controls */}
          <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              {action.status === 'Open' && (
                <>
                  <button
                    type="button"
                    onClick={handleStartAction}
                    disabled={updatingStatus}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-amber-900 bg-amber-400 hover:bg-amber-500 transition-colors shadow-xs disabled:opacity-50 cursor-pointer min-h-[44px]"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Start Action
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCompleteConfirm(true)}
                    disabled={updatingStatus}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer min-h-[44px]"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Completed
                  </button>
                </>
              )}

              {action.status === 'In Progress' && (
                <button
                  type="button"
                  onClick={() => setShowCompleteConfirm(true)}
                  disabled={updatingStatus}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark Completed
                </button>
              )}

              {action.status === 'Completed' && (
                <button
                  type="button"
                  onClick={handleRevertToInProgress}
                  disabled={updatingStatus}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Revert back to In Progress to make further edits"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reopen as In Progress
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Completion Confirmation Prompt */}
      {showCompleteConfirm && (
        <ConfirmationModal
          isOpen={showCompleteConfirm}
          title="Confirm Action Completion"
          message="Are you sure this corrective action has been completed? This will record the completion timestamp and notify the administrator for verification."
          confirmText="Yes, Mark Completed"
          cancelText="Cancel"
          variant="success"
          isLoading={updatingStatus}
          onConfirm={handleConfirmComplete}
          onCancel={() => setShowCompleteConfirm(false)}
        />
      )}
    </>
  );
};

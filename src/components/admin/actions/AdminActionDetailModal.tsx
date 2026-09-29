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
  User,
  ShieldAlert,
  Flame,
  Camera,
  ExternalLink,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Action, Finding, RiskLevel, ActionStatus, Inspection } from '../../../types/sheq';
import { getFindingById } from '../../../services/findingService';
import { getInspectionById } from '../../../services/inspectionService';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { isActionOverdue, getDaysOverdue } from '../../../utils/validation';
import { useAuth } from '../../../context/AuthContext';
import { ActionEvidencePhotoSection } from '../../photos/ActionEvidencePhotoSection';
import { FindingPhotoSection } from '../../photos/FindingPhotoSection';
import { ReportPreviewModal } from '../reports/ReportPreviewModal';

interface AdminActionDetailModalProps {
  action: Action;
  onClose: () => void;
  onActionUpdated: () => void;
  onViewInspection?: (inspectionId: string) => void;
}

export const AdminActionDetailModal: React.FC<AdminActionDetailModalProps> = ({
  action,
  onClose,
  onActionUpdated,
  onViewInspection,
}) => {
  const { currentUser } = useAuth();
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loadingFinding, setLoadingFinding] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadFinding() {
      if (!action.findingId) {
        setLoadingFinding(false);
        return;
      }
      try {
        const found = await getFindingById(action.findingId);
        if (isMounted) setFinding(found);
      } catch (err) {
        console.error('Failed to load linked finding:', err);
      } finally {
        if (isMounted) setLoadingFinding(false);
      }
    }
    loadFinding();
    return () => {
      isMounted = false;
    };
  }, [action.findingId]);

  const overdue = isActionOverdue(action.dueDate, action.status);
  const daysOverdue = getDaysOverdue(action.dueDate, action.status);

  // Admin status update: Verify & Close OR Return for rework
  const handleAdminStatusChange = async (newStatus: ActionStatus) => {
    if (!currentUser) return;
    setSaving(true);
    setFeedbackMsg(null);

    try {
      const now = new Date().toISOString();
      const updates: Partial<Action> = {
        status: newStatus,
        updatedAt: now,
        updatedByUserId: currentUser.uid,
      };

      if (newStatus === 'Closed') {
        updates.closedAt = now;
        updates.closedByUserId = currentUser.uid;
        updates.verifiedAt = now;
        updates.verifiedByUserId = currentUser.uid;
      } else if (newStatus === 'In Progress' || newStatus === 'Open') {
        // Returned for rework
        updates.closedAt = undefined;
        updates.closedByUserId = undefined;
      }

      await updateDoc(doc(db, 'actions', action.id), updates as Record<string, unknown>);

      // Also update linked finding status if present
      if (action.findingId) {
        await updateDoc(doc(db, 'findings', action.findingId), {
          status: newStatus,
          updatedAt: now,
          updatedByUserId: currentUser.uid,
        });
      }

      setFeedbackMsg({
        type: 'success',
        text: `Action successfully transitioned to "${newStatus}".`,
      });
      onActionUpdated();
    } catch (err: unknown) {
      const e = err as Error;
      console.error('Failed to update action:', e);
      setFeedbackMsg({ type: 'error', text: e.message || 'Failed to update action status.' });
    } finally {
      setSaving(false);
    }
  };

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'Critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <Flame className="h-3.5 w-3.5 text-red-600" />
            CRITICAL
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
            <ShieldAlert className="h-3.5 w-3.5 text-orange-600" />
            HIGH RISK
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            LOW
          </span>
        );
    }
  };

  return (
    <div
      id="modal-admin-action-detail"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                {action.inspectionNumberSnapshot || 'INSPECTION ACTION'}
              </span>
              <span className="text-slate-400">&bull;</span>
              <span className="text-xs text-slate-300">
                {action.departmentNameSnapshot || 'General Department'}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {action.title}
            </h2>
          </div>

          <button
            id="btn-close-action-detail"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-800 text-xs">
          {feedbackMsg && (
            <div
              className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Risk Rating</span>
              <div className="mt-1">{getRiskBadge(action.riskLevel)}</div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Current Status</span>
              <div className="mt-1">
                {overdue ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                    OVERDUE ({daysOverdue}d)
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
                    {action.status}
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Assigned Actioner</span>
              <p className="mt-1 font-semibold text-slate-900 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-slate-400" />
                {action.assignedToUserNameSnapshot || 'Unassigned'}
              </p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Due Date</span>
              <p className={`mt-1 font-mono font-bold flex items-center gap-1 ${
                overdue ? 'text-rose-600' : 'text-slate-800'
              }`}>
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {action.dueDate}
              </p>
            </div>
          </div>

          {/* Remedial Action Description */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-slate-500" />
              Corrective Action Specification
            </h3>
            <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap">
              {action.description || 'No detailed action specification provided.'}
            </div>
          </div>

          {/* Actioner Remediation Notes / Comments */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <User className="h-4 w-4 text-slate-500" />
              Actioner Execution Progress & Notes
            </h3>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap">
              {action.actionerComments ? (
                action.actionerComments
              ) : (
                <span className="text-slate-400 italic">No notes logged by actioner yet.</span>
              )}
            </div>
            {action.completionDate && (
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                Completed by actioner on: {new Date(action.completionDate).toLocaleString()}
              </p>
            )}
          </div>

          {/* Actioner Evidence Photos */}
          <div>
            <ActionEvidencePhotoSection
              action={action}
              canUpload={false} // Admin views evidence in read-only mode here
            />
          </div>

          {/* Linked Finding Observation Section */}
          {finding && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-500" />
                Originating Hazard Finding Details
              </h3>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800">
                    Finding #{finding.findingNumber}: {finding.title}
                  </span>
                  <span className="text-slate-500">Location: {finding.location || 'Workshop Floor'}</span>
                </div>
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {finding.description}
                </p>
                {finding.inspectorComments && (
                  <p className="text-[11px] text-slate-500 italic border-t border-slate-200 pt-1 mt-1">
                    Inspector note: {finding.inspectorComments}
                  </p>
                )}
              </div>

              {/* Finding Inspection Photos */}
              <div className="mt-3">
                <FindingPhotoSection
                  finding={finding}
                  inspectionId={action.inspectionId}
                  canUpload={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {onViewInspection && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewInspection(action.inspectionId);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Full Audit
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {action.status === 'Completed' && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleAdminStatusChange('In Progress')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Return for Rework
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleAdminStatusChange('Closed')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Verify & Close Action
                </button>
              </>
            )}

            {action.status !== 'Completed' && action.status !== 'Closed' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleAdminStatusChange('Closed')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Directly Close Action
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Building2,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Edit,
  Trash2,
  ArrowLeft,
  AlertCircle,
  Save,
  X,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { Inspection, Finding, Action, Department } from '../../types/sheq';
import { getInspectionById, deleteInspection } from '../../services/inspectionService';
import { getFindingsByInspectionId, updateFinding } from '../../services/findingService';
import { getDepartments } from '../../services/departmentService';
import { getActiveActioners } from '../../services/userService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { calculateEffectiveActionStatus } from '../../utils/validation';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import { FindingPhotoSection } from '../photos/FindingPhotoSection';
import { ActionEvidencePhotoSection } from '../photos/ActionEvidencePhotoSection';
import { ReportPreviewModal } from '../admin/reports/ReportPreviewModal';

interface InspectionDetailProps {
  inspectionId: string;
  onBack: () => void;
  onEditFull: (inspectionId: string) => void;
  onDeleted: () => void;
}

export const InspectionDetail: React.FC<InspectionDetailProps> = ({
  inspectionId,
  onBack,
  onEditFull,
  onDeleted,
}) => {
  const { currentUser } = useAuth();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);
  const [actioners, setActioners] = useState<Array<{ uid: string; fullName: string; email: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Deletion Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // PDF Report Modal
  const [showReportModal, setShowReportModal] = useState(false);

  // Quick Edit Finding Modal State
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null);
  const [editActionerUid, setEditActionerUid] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editRecommendedAction, setEditRecommendedAction] = useState<string>('');
  const [editInspectorComments, setEditInspectorComments] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [insp, fnds, actUsers, depts] = await Promise.all([
        getInspectionById(inspectionId),
        getFindingsByInspectionId(inspectionId),
        getActiveActioners(),
        getDepartments(),
      ]);

      if (!insp) {
        throw new Error(`Inspection ${inspectionId} was not found.`);
      }

      setInspection(insp);
      setFindings(fnds);
      setActioners(actUsers);

      const dept = depts.find((d) => d.id === insp.departmentId);
      if (dept) setDepartment(dept);

      // Load linked actions for this inspection
      const actSnap = await getDocs(
        query(collection(db, 'actions'), where('inspectionId', '==', inspectionId))
      );
      const acts = actSnap.docs.map((d) => {
        const data = d.data() as Action;
        return {
          ...data,
          status: calculateEffectiveActionStatus(data.status, data.dueDate),
        };
      });
      setActions(acts);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(`Failed to load inspection details: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [inspectionId]);

  // Handle Permanent Delete
  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteInspection(inspectionId);
      setShowDeleteModal(false);
      onDeleted();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(`Failed to delete inspection: ${e.message}`);
      setDeleteLoading(false);
    }
  };

  // Open Quick Edit for Finding
  const handleOpenEditFinding = (finding: Finding) => {
    setEditingFinding(finding);
    setEditActionerUid(finding.assignedToUserId);
    setEditDueDate(finding.dueDate);
    setEditRecommendedAction(finding.recommendedAction);
    setEditInspectorComments(finding.inspectorComments || '');
  };

  // Save Quick Edit for Finding
  const handleSaveFindingEdits = async () => {
    if (!editingFinding || !currentUser) return;
    setEditSaving(true);
    setErrorMsg(null);
    try {
      const chosenActioner = actioners.find((a) => a.uid === editActionerUid);
      await updateFinding(
        editingFinding.id,
        {
          assignedToUserId: editActionerUid,
          assignedToUserNameSnapshot: chosenActioner?.fullName || editingFinding.assignedToUserNameSnapshot,
          dueDate: editDueDate,
          recommendedAction: editRecommendedAction.trim(),
          inspectorComments: editInspectorComments.trim(),
        },
        currentUser.uid
      );

      setSuccessMsg(`Finding #${editingFinding.findingNumber} and linked action updated successfully.`);
      setEditingFinding(null);
      await loadAll();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(`Update failed: ${e.message}`);
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
        <Clock className="h-6 w-6 animate-spin mx-auto text-slate-400 mb-2" />
        Loading inspection and corrective actions...
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Inspection Not Found</h2>
        <p className="text-xs text-slate-500">The requested inspection could not be located in Firestore.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
        >
          Return to Inspections List
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Inspections List
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-mono">
              {inspection.inspectionNumber}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                inspection.status === 'Completed'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {inspection.status}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-semibold">
            {inspection.title}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="btn-generate-inspection-pdf"
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer shadow-xs transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-amber-400" />
            Generate PDF Report
          </button>
          <button
            type="button"
            onClick={() => onEditFull(inspection.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer shadow-xs transition-colors"
          >
            <Edit className="h-3.5 w-3.5" />
            Edit Inspection
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 cursor-pointer transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Inspection
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 shadow-xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Inspection Header Metadata Grid */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
          Inspection Overview & Audit Trail
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Inspection Date</div>
            <div className="font-bold text-slate-900 mt-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {inspection.inspectionDate}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Department</div>
            <div className="font-bold text-slate-900 mt-1 flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: department?.colorCode || '#64748b' }}
              />
              {inspection.departmentNameSnapshot}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Authoritative Inspector</div>
            <div className="font-bold text-slate-900 mt-1 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" />
              {inspection.inspectorNameSnapshot}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Registered Findings</div>
            <div className="font-bold text-slate-900 mt-1 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              {findings.length} findings ({actions.filter((a) => a.status === 'Open' || a.status === 'In Progress').length} open actions)
            </div>
          </div>
        </div>

        {inspection.generalComments && (
          <div className="pt-3 border-t border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">General Comments / Notes</div>
            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {inspection.generalComments}
            </p>
          </div>
        )}

        <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-100 flex flex-wrap gap-4">
          <span>Created: {new Date(inspection.createdAt).toLocaleString()}</span>
          <span>Last Updated: {new Date(inspection.updatedAt).toLocaleString()}</span>
          <span>Doc ID: {inspection.id}</span>
        </div>
      </div>

      {/* Findings and 1:1 Corrective Actions List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-slate-700" />
            Walkthrough Findings & Corrective Action Allocation
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {findings.length} registered
          </span>
        </div>

        {findings.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
            No findings currently recorded for this inspection.
          </div>
        ) : (
          findings.map((finding) => {
            // Find linked action
            const linkedAction = actions.find((a) => a.findingId === finding.id);

            return (
              <div
                key={finding.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
              >
                {/* Finding Header */}
                <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-mono font-bold">
                      #{finding.findingNumber}
                    </span>
                    <div>
                      <span className="font-bold text-sm text-slate-900">
                        {finding.title}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Location: <span className="font-medium text-slate-700">{finding.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        finding.riskLevel === 'Critical'
                          ? 'bg-rose-100 text-rose-800'
                          : finding.riskLevel === 'High'
                          ? 'bg-orange-100 text-orange-800'
                          : finding.riskLevel === 'Medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {finding.riskLevel} Risk
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenEditFinding(finding)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5 text-slate-500" />
                      Edit / Reallocate
                    </button>
                  </div>
                </div>

                {/* Finding Content */}
                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Observation / Hazard</div>
                    <p className="text-xs text-slate-800 mt-0.5 leading-relaxed">{finding.description}</p>
                  </div>

                  {finding.inspectorComments && (
                    <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200">
                      <span className="font-semibold text-slate-700">Inspector Note: </span>
                      {finding.inspectorComments}
                    </div>
                  )}

                  {/* Finding Workplace Hazard Photos */}
                  <div className="pt-2 border-t border-slate-100">
                    <FindingPhotoSection
                      inspectionId={inspection.id}
                      findingId={finding.id}
                      canUpload={true}
                      canDelete={true}
                    />
                  </div>

                  {/* 1:1 Linked Corrective Action Card */}
                  <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                        <ShieldCheck className="h-4 w-4 text-slate-700" />
                        1:1 Linked Corrective Action
                      </div>

                      {/* Action Status Badge */}
                      {linkedAction && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            linkedAction.status === 'Completed' || linkedAction.status === 'Closed'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : linkedAction.status === 'Overdue'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : linkedAction.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {linkedAction.status}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-800">
                      <span className="font-semibold text-slate-700">Action Directive: </span>
                      {finding.recommendedAction}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 text-xs">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Allocated Actioner</div>
                        <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-500" />
                          {finding.assignedToUserNameSnapshot}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          UID: {finding.assignedToUserId}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Action Due Date</div>
                        <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          {finding.dueDate}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Action Document ID</div>
                        <div className="font-mono text-slate-600 mt-0.5 truncate text-[11px]">
                          {linkedAction?.id || 'Pending creation'}
                        </div>
                      </div>
                    </div>

                    {linkedAction?.actionerComments && (
                      <div className="pt-2 border-t border-slate-200 text-xs">
                        <span className="font-bold text-slate-800">Actioner Feedback: </span>
                        <span className="text-slate-600">{linkedAction.actionerComments}</span>
                      </div>
                    )}

                    {/* Actioner Resolution Evidence Photographs Preview */}
                    {linkedAction && (
                      <div className="pt-3 border-t border-slate-200">
                        <ActionEvidencePhotoSection
                          actionId={linkedAction.id}
                          findingId={finding.id}
                          inspectionId={inspection.id}
                          canUpload={false}
                          canDelete={false}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Edit Finding / Reallocate Modal */}
      {editingFinding && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit className="h-4 w-4 text-slate-700" />
                Edit Finding #{editingFinding.findingNumber}
              </h3>
              <button
                type="button"
                onClick={() => setEditingFinding(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Reallocate Action To
                </label>
                <select
                  value={editActionerUid}
                  onChange={(e) => setEditActionerUid(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                >
                  {actioners.map((act) => (
                    <option key={act.uid} value={act.uid}>
                      {act.fullName} ({act.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Action Due Date
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Recommended Action Directive
                </label>
                <textarea
                  rows={2}
                  value={editRecommendedAction}
                  onChange={(e) => setEditRecommendedAction(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Inspector Comments
                </label>
                <input
                  type="text"
                  value={editInspectorComments}
                  onChange={(e) => setEditInspectorComments(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingFinding(null)}
                disabled={editSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFindingEdits}
                disabled={editSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Required Deletion Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Inspection"
        message="Are you sure you want to permanently delete this inspection and all associated findings and corrective actions?"
        confirmLabel="Permanently Delete"
        isDestructive={true}
        isLoading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* PDF Inspection Report Modal */}
      {showReportModal && inspection && (
        <ReportPreviewModal
          inspection={inspection}
          findings={findings}
          actions={actions}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};

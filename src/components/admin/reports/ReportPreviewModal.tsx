import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  RotateCw,
  X,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Building2,
  Loader2,
} from 'lucide-react';
import { Inspection, Finding, Action, PhotoMetadata } from '../../../types/sheq';
import {
  generateInspectionReportPdf,
  downloadReportPdfBlob,
  printReportPdfBlob,
  getReportDownloadFilename,
} from '../../../services/reportClientService';
import { getFindingsByInspectionId } from '../../../services/findingService';
import { getPhotosForReport } from '../../../services/photoService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/config';

interface ReportPreviewModalProps {
  inspection: Inspection;
  findings?: Finding[];
  actions?: Action[];
  photos?: PhotoMetadata[];
  onClose: () => void;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  inspection,
  findings,
  actions,
  photos,
  onClose,
}) => {
  const [generating, setGenerating] = useState(true);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [embeddedPhotoCount, setEmbeddedPhotoCount] = useState<number>(photos?.length || 0);

  const filename = getReportDownloadFilename(inspection.inspectionNumber);

  const handleGenerate = async () => {
    setGenerating(true);
    setErrorMsg(null);

    // Clean up previous preview URL
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }

    try {
      const resolvedFindings =
        findings && findings.length > 0
          ? findings
          : await getFindingsByInspectionId(inspection.id).catch(() => []);

      let resolvedActions = actions && actions.length > 0 ? actions : [];
      if (resolvedActions.length === 0) {
        try {
          const actSnap = await getDocs(
            query(collection(db, 'actions'), where('inspectionId', '==', inspection.id))
          );
          resolvedActions = actSnap.docs.map((d) => ({ ...(d.data() as Action), id: d.id }));
        } catch {
          // ignore
        }
      }

      const resolvedPhotos = await getPhotosForReport(
        inspection.id,
        resolvedFindings,
        resolvedActions
      );
      setEmbeddedPhotoCount(resolvedPhotos.length);

      const blob = await generateInspectionReportPdf(inspection.id, {
        inspection,
        findings: resolvedFindings,
        actions: resolvedActions,
        photos: resolvedPhotos,
      });

      setPdfBlob(blob);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err: any) {
      console.error('Failed to generate report:', err);
      setErrorMsg(err.message || 'Failed to generate PDF report from server.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    handleGenerate();

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [inspection.id]);

  const handleDownload = () => {
    if (!pdfBlob) return;
    downloadReportPdfBlob(pdfBlob, filename);
  };

  const handlePrint = () => {
    if (!pdfBlob) return;
    printReportPdfBlob(pdfBlob);
  };

  return (
    <div
      id="modal-report-preview"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  {inspection.inspectionNumber}
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-xs text-slate-300">
                  {inspection.departmentNameSnapshot || 'Department'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Official SHEQ Inspection Report
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close Preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              Date: <strong className="text-slate-800">{inspection.inspectionDate}</strong>
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              Inspector: <strong className="text-slate-800">{inspection.inspectorNameSnapshot}</strong>
            </span>
            <span>&bull;</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                inspection.status === 'Completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {inspection.status}
            </span>
            <span>&bull;</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              {embeddedPhotoCount} {embeddedPhotoCount === 1 ? 'Photo' : 'Photos'} Included
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
            >
              <RotateCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={!pdfBlob || generating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              Print Report
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!pdfBlob || generating}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-amber-400" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex flex-col items-center justify-center min-h-[450px]">
          {generating && (
            <div className="text-center py-16 space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-slate-800 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">
                Generating Executive Inspection Report...
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Retrieving findings, overdue status, and securely embedding high-resolution photographs from storage.
              </p>
            </div>
          )}

          {errorMsg && !generating && (
            <div className="max-w-md w-full bg-white p-6 rounded-xl border border-rose-200 shadow-sm text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-rose-600 mx-auto" />
              <h3 className="text-sm font-bold text-rose-900">PDF Generation Failed</h3>
              <p className="text-xs text-slate-600">{errorMsg}</p>
              <button
                type="button"
                onClick={handleGenerate}
                className="mt-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {pdfUrl && !generating && (
            <div className="w-full h-full flex flex-col space-y-2">
              <iframe
                id="pdf-report-preview-frame"
                src={pdfUrl}
                title={`Inspection Report ${inspection.inspectionNumber}`}
                className="w-full h-[620px] bg-white rounded-xl border border-slate-300 shadow-sm"
              />
              <div className="text-center">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open PDF in separate browser tab if embedded preview does not render
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Authoritative Admin-Certified Report • Conforms to SHEQ Compliance Standards</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

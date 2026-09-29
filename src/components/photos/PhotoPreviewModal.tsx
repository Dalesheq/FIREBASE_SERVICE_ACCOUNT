import React, { useState } from 'react';
import { PhotoMetadata } from '../../types/sheq';
import { X, Calendar, User, FileText, HardDrive, Trash2, Download, AlertCircle } from 'lucide-react';

interface PhotoPreviewModalProps {
  photo: PhotoMetadata | null;
  onClose: () => void;
  onDelete?: (photo: PhotoMetadata) => Promise<void>;
  canDelete?: boolean;
}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  photo,
  onClose,
  onDelete,
  canDelete = false,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!photo) return null;

  const formattedDate = photo.createdAt
    ? new Date(photo.createdAt).toLocaleString('en-ZA', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Unknown Date';

  const formattedSize = photo.fileSize
    ? `${(photo.fileSize / 1024).toFixed(1)} KB`
    : 'Unknown size';

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(photo);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete photograph.';
      setDeleteError(msg);
      setDeleting(false);
    }
  };

  return (
    <div
      id="photo-preview-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="photo-preview-modal-container"
        className="relative w-full max-w-3xl bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                photo.photoType === 'evidence'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
              }`}
            >
              {photo.photoType === 'evidence' ? 'Action Evidence' : 'Inspection Photo'}
            </span>
            <span className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">
              {photo.fileName}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <a
              href={photo.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={photo.fileName}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Open full size / Download"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="flex-1 bg-slate-950 flex items-center justify-center overflow-auto p-2 sm:p-4 min-h-[260px] max-h-[62vh]">
          <img
            src={photo.downloadUrl}
            alt={photo.caption || photo.fileName}
            className="max-h-full max-w-full object-contain rounded-lg shadow-lg select-none"
            loading="lazy"
          />
        </div>

        {/* Footer & Metadata */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 text-xs space-y-3 shrink-0">
          {/* Caption */}
          {photo.caption && (
            <div className="flex items-start gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <FileText className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-slate-200 text-xs sm:text-sm italic leading-relaxed">
                "{photo.caption}"
              </p>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-400 text-[11px]">
            <div className="flex items-center gap-1.5 truncate">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {photo.uploadedByNameSnapshot || 'SHEQ Inspector'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formattedSize}</span>
            </div>
          </div>

          {/* Delete Action Bar */}
          {canDelete && onDelete && (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              {confirmDelete ? (
                <div className="flex items-center gap-2 w-full justify-between animate-in fade-in">
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Permanently delete this photo from cloud storage?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleDelete}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Photograph
                </button>
              )}
            </div>
          )}

          {deleteError && (
            <div className="text-xs text-red-400 p-2 bg-red-950/50 border border-red-900 rounded-lg">
              {deleteError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

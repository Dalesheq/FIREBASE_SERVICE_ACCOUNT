import React, { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Trash2, Eye, Plus } from 'lucide-react';
import { PhotoMetadata } from '../../types/sheq';
import {
  subscribePhotosByFinding,
  deletePhoto,
} from '../../services/photoService';
import { PhotoUploader } from './PhotoUploader';
import { PhotoPreviewModal } from './PhotoPreviewModal';
import { useAuth } from '../../context/AuthContext';

interface FindingPhotoSectionProps {
  inspectionId: string;
  findingId: string;
  canUpload?: boolean;
  canDelete?: boolean;
  onEnsureSavedParent?: () => Promise<{ inspectionId: string; findingId: string }>;
}

export const FindingPhotoSection: React.FC<FindingPhotoSectionProps> = ({
  inspectionId: initialInspectionId,
  findingId: initialFindingId,
  canUpload = true,
  canDelete = true,
  onEnsureSavedParent,
}) => {
  const { currentUser, isAdmin } = useAuth();

  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePreviewPhoto, setActivePreviewPhoto] = useState<PhotoMetadata | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [ensuringParent, setEnsuringParent] = useState(false);
  const [resolvedInspectionId, setResolvedInspectionId] = useState(initialInspectionId);
  const [resolvedFindingId, setResolvedFindingId] = useState(initialFindingId);

  // Keep resolved IDs in sync if props update
  useEffect(() => {
    if (initialInspectionId) setResolvedInspectionId(initialInspectionId);
    if (initialFindingId) setResolvedFindingId(initialFindingId);
  }, [initialInspectionId, initialFindingId]);

  // Subscribe to real-time photos for this finding
  useEffect(() => {
    if (!resolvedFindingId) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribePhotosByFinding(
      resolvedFindingId,
      (updatedPhotos) => {
        setPhotos(updatedPhotos);
        setLoading(false);
      },
      (err) => {
        console.warn('Photos subscription error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [resolvedFindingId]);

  const handleOpenUploader = async () => {
    // If findingId or inspectionId is not persisted yet, call callback to save draft
    if ((!resolvedInspectionId || !resolvedFindingId) && onEnsureSavedParent) {
      setEnsuringParent(true);
      try {
        const saved = await onEnsureSavedParent();
        setResolvedInspectionId(saved.inspectionId);
        setResolvedFindingId(saved.findingId);
        setShowUploader(true);
      } catch (err) {
        console.error('Failed to save draft before uploading photo:', err);
      } finally {
        setEnsuringParent(false);
      }
    } else {
      setShowUploader(true);
    }
  };

  const handlePhotoUploaded = (newPhoto: PhotoMetadata) => {
    setPhotos((prev) => {
      const exists = prev.some((p) => p.id === newPhoto.id);
      return exists ? prev : [...prev, newPhoto];
    });
    setShowUploader(false);
  };

  const handleDeletePhoto = async (photo: PhotoMetadata) => {
    if (!currentUser) return;
    await deletePhoto(photo, currentUser.uid, isAdmin);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  return (
    <div id={`finding-photos-${resolvedFindingId || 'draft'}`} className="mt-4 pt-4 border-t border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Inspection Photos
          </span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            {photos.length}
          </span>
        </div>

        {canUpload && !showUploader && (
          <button
            type="button"
            onClick={handleOpenUploader}
            disabled={ensuringParent}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-200 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{ensuringParent ? 'Saving Draft...' : 'Add Photo'}</span>
          </button>
        )}
      </div>

      {/* Uploader Section */}
      {showUploader && currentUser && (
        <div className="mb-4 bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">Capture or Upload Finding Photo</span>
            <button
              type="button"
              onClick={() => setShowUploader(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          <PhotoUploader
            inspectionId={resolvedInspectionId}
            findingId={resolvedFindingId}
            photoType="inspection"
            uploaderUserId={currentUser.uid}
            uploaderNameSnapshot={currentUser.fullName || currentUser.email || 'Inspector'}
            onPhotoUploaded={handlePhotoUploaded}
          />
        </div>
      )}

      {/* Photos Thumbnail Grid */}
      {loading ? (
        <div className="text-xs text-slate-400 py-3 italic">Loading photos...</div>
      ) : photos.length === 0 ? (
        <div className="text-xs text-slate-500 bg-slate-50/60 p-3 rounded-lg border border-dashed border-slate-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-slate-400" />
            No photographs attached to this finding yet.
          </span>
          {canUpload && !showUploader && (
            <button
              type="button"
              onClick={handleOpenUploader}
              className="text-xs text-sky-700 font-semibold hover:underline"
            >
              Attach a photo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-4/3 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs hover:shadow-md transition-all cursor-pointer"
              onClick={() => setActivePreviewPhoto(photo)}
            >
              <img
                src={photo.downloadUrl}
                alt={photo.caption || photo.fileName}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy"
              />

              {/* Hover overlay with action buttons */}
              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                <button
                  type="button"
                  className="p-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-lg shadow-sm"
                  title="View full photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePreviewPhoto(photo);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>

                {canDelete && isAdmin && (
                  <button
                    type="button"
                    className="p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-lg shadow-sm"
                    title="Delete photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePhoto(photo);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Caption pill if caption exists */}
              {photo.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-slate-950/70 backdrop-blur-xs text-white text-[10px] px-2 py-1 truncate">
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {activePreviewPhoto && (
        <PhotoPreviewModal
          photo={activePreviewPhoto}
          onClose={() => setActivePreviewPhoto(null)}
          onDelete={handleDeletePhoto}
          canDelete={canDelete && isAdmin}
        />
      )}
    </div>
  );
};

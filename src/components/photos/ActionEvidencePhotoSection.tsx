import React, { useState, useEffect } from 'react';
import { ShieldCheck, Image as ImageIcon, Eye, Trash2, Plus } from 'lucide-react';
import { PhotoMetadata } from '../../types/sheq';
import {
  subscribePhotosByAction,
  deletePhoto,
} from '../../services/photoService';
import { PhotoUploader } from './PhotoUploader';
import { PhotoPreviewModal } from './PhotoPreviewModal';
import { useAuth } from '../../context/AuthContext';

interface ActionEvidencePhotoSectionProps {
  actionId: string;
  inspectionId: string;
  findingId: string;
  assignedToUserId: string;
  canUpload?: boolean;
  onPhotosUpdated?: (photos: PhotoMetadata[]) => void;
}

export const ActionEvidencePhotoSection: React.FC<ActionEvidencePhotoSectionProps> = ({
  actionId,
  inspectionId,
  findingId,
  assignedToUserId,
  canUpload = true,
  onPhotosUpdated,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const isAssignedActioner = currentUser?.uid === assignedToUserId;

  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePreviewPhoto, setActivePreviewPhoto] = useState<PhotoMetadata | null>(null);
  const [showUploader, setShowUploader] = useState(false);

  // Subscribe to real-time updates of evidence photos for this action
  useEffect(() => {
    if (!actionId) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribePhotosByAction(
      actionId,
      (updatedPhotos) => {
        setPhotos(updatedPhotos);
        setLoading(false);
        if (onPhotosUpdated) onPhotosUpdated(updatedPhotos);
      },
      (err) => {
        console.warn('Action photos subscription error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [actionId, onPhotosUpdated]);

  const handlePhotoUploaded = (newPhoto: PhotoMetadata) => {
    setPhotos((prev) => {
      const exists = prev.some((p) => p.id === newPhoto.id);
      const updated = exists ? prev : [...prev, newPhoto];
      if (onPhotosUpdated) onPhotosUpdated(updated);
      return updated;
    });
    setShowUploader(false);
  };

  const handleDeletePhoto = async (photo: PhotoMetadata) => {
    if (!currentUser) return;
    await deletePhoto(photo, currentUser.uid, isAdmin);
    setPhotos((prev) => {
      const updated = prev.filter((p) => p.id !== photo.id);
      if (onPhotosUpdated) onPhotosUpdated(updated);
      return updated;
    });
  };

  // An actioner can only upload evidence if they are assigned to this action (or admin)
  const isAuthorizedToUpload = canUpload && (isAssignedActioner || isAdmin);

  return (
    <div id={`action-evidence-${actionId}`} className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Corrective Action Evidence Photos
          </span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {photos.length}
          </span>
        </div>

        {isAuthorizedToUpload && !showUploader && (
          <button
            type="button"
            onClick={() => setShowUploader(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Evidence Photo</span>
          </button>
        )}
      </div>

      {/* Uploader Section */}
      {showUploader && currentUser && isAuthorizedToUpload && (
        <div className="bg-emerald-50/40 p-3 sm:p-4 rounded-xl border border-emerald-200/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-950">
              Attach Proof of Corrective Action
            </span>
            <button
              type="button"
              onClick={() => setShowUploader(false)}
              className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <PhotoUploader
            inspectionId={inspectionId}
            findingId={findingId}
            actionId={actionId}
            photoType="evidence"
            uploaderUserId={currentUser.uid}
            uploaderNameSnapshot={currentUser.fullName || currentUser.email || 'Actioner'}
            onPhotoUploaded={handlePhotoUploaded}
          />
        </div>
      )}

      {/* Photos Thumbnail Grid */}
      {loading ? (
        <div className="text-xs text-slate-400 py-2 italic">Loading evidence photos...</div>
      ) : photos.length === 0 ? (
        <div className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-slate-400 shrink-0" />
            No completion evidence photographs uploaded yet.
          </span>
          {isAuthorizedToUpload && !showUploader && (
            <button
              type="button"
              onClick={() => setShowUploader(true)}
              className="text-xs text-emerald-700 font-bold hover:underline self-start sm:self-auto cursor-pointer"
            >
              Take or Upload Evidence Photo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo) => {
            const canDeleteThisPhoto =
              isAdmin || (photo.uploadedByUserId === currentUser?.uid && photo.photoType === 'evidence');

            return (
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

                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                  <button
                    type="button"
                    className="p-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-lg shadow-sm cursor-pointer"
                    title="View full photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePreviewPhoto(photo);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>

                  {canDeleteThisPhoto && (
                    <button
                      type="button"
                      className="p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-lg shadow-sm cursor-pointer"
                      title="Delete evidence photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(photo);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {photo.caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-slate-950/70 backdrop-blur-xs text-white text-[10px] px-2 py-1 truncate">
                    {photo.caption}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {activePreviewPhoto && (
        <PhotoPreviewModal
          photo={activePreviewPhoto}
          onClose={() => setActivePreviewPhoto(null)}
          onDelete={handleDeletePhoto}
          canDelete={
            isAdmin ||
            (activePreviewPhoto.uploadedByUserId === currentUser?.uid &&
              activePreviewPhoto.photoType === 'evidence')
          }
        />
      )}
    </div>
  );
};

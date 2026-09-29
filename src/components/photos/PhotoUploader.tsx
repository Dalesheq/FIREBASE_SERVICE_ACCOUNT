import React, { useState, useRef } from 'react';
import { Camera, Upload, CheckCircle2, AlertCircle, RefreshCw, X, FileText } from 'lucide-react';
import {
  validatePhotoFile,
  uploadInspectionPhoto,
  uploadEvidencePhoto,
} from '../../services/photoService';
import { PhotoMetadata, PhotoType } from '../../types/sheq';

interface PhotoUploaderProps {
  inspectionId: string;
  findingId: string;
  actionId?: string;
  photoType: PhotoType;
  uploaderUserId: string;
  uploaderNameSnapshot: string;
  onPhotoUploaded: (photo: PhotoMetadata) => void;
  disabled?: boolean;
}

type UploadState = 'idle' | 'selected' | 'compressing' | 'uploading' | 'saving' | 'success' | 'error';

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  inspectionId,
  findingId,
  actionId,
  photoType,
  uploaderUserId,
  uploaderNameSnapshot,
  onPhotoUploaded,
  disabled = false,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const validation = validatePhotoFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid photo file.');
      setUploadState('error');
      // Reset input
      e.target.value = '';
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadState('selected');
    e.target.value = '';
  };

  const handleCancelSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
    setUploadState('idle');
    setErrorMessage(null);
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

    setUploadState('compressing');
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      let uploaded: PhotoMetadata;

      if (photoType === 'evidence') {
        if (!actionId) {
          throw new Error('Action ID is required for corrective action evidence.');
        }

        setUploadState('uploading');
        uploaded = await uploadEvidencePhoto({
          file: selectedFile,
          inspectionId,
          findingId,
          actionId,
          caption,
          uploaderUserId,
          uploaderNameSnapshot,
          onProgress: (percent) => {
            setUploadProgress(percent);
            if (percent === 100) {
              setUploadState('saving');
            }
          },
        });
      } else {
        setUploadState('uploading');
        uploaded = await uploadInspectionPhoto({
          file: selectedFile,
          inspectionId,
          findingId,
          caption,
          uploaderUserId,
          uploaderNameSnapshot,
          onProgress: (percent) => {
            setUploadProgress(percent);
            if (percent === 100) {
              setUploadState('saving');
            }
          },
        });
      }

      setUploadState('success');
      onPhotoUploaded(uploaded);

      // Clean up local preview
      setTimeout(() => {
        handleCancelSelection();
      }, 1500);
    } catch (err: unknown) {
      console.error('Photo upload process failed:', err);
      const msg = err instanceof Error ? err.message : 'Photo upload failed.';
      setErrorMessage(msg);
      setUploadState('error');
    }
  };

  return (
    <div id="photo-uploader-container" className="space-y-3">
      {/* Hidden File Inputs */}
      {/* Camera Capture on Mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploadState === 'uploading' || uploadState === 'saving'}
      />

      {/* File Gallery Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploadState === 'uploading' || uploadState === 'saving'}
      />

      {/* Action Buttons: Take Photo & Upload Photo */}
      {uploadState === 'idle' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
            title="Use device camera to take a photo"
          >
            <Camera className="h-4 w-4 text-sky-600" />
            <span>Take Photo</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
            title="Select image from files or gallery"
          >
            <Upload className="h-4 w-4 text-slate-600" />
            <span>Upload Photo</span>
          </button>
        </div>
      )}

      {/* Selected Photo Staging & Upload Progress */}
      {(uploadState === 'selected' ||
        uploadState === 'compressing' ||
        uploadState === 'uploading' ||
        uploadState === 'saving' ||
        uploadState === 'success') && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-start gap-3">
            {/* Thumbnail Preview */}
            {previewUrl && (
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-200 shrink-0">
                <img
                  src={previewUrl}
                  alt="Selected preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {selectedFile?.name}
                </div>
                {uploadState === 'selected' && (
                  <button
                    type="button"
                    onClick={handleCancelSelection}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                    title="Cancel selection"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="text-[11px] text-slate-500">
                Size: {((selectedFile?.size || 0) / 1024).toFixed(1)} KB (will be optimized on upload)
              </div>

              {/* Caption Input */}
              {uploadState === 'selected' && (
                <div className="relative">
                  <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Optional photo caption / location notes..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    maxLength={200}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Progress & Status Indicators */}
          {uploadState === 'compressing' && (
            <div className="flex items-center gap-2 text-xs text-sky-700 bg-sky-50 p-2.5 rounded-lg border border-sky-200">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-600 shrink-0" />
              <span>Optimizing image for SHEQ report...</span>
            </div>
          )}

          {uploadState === 'uploading' && (
            <div className="space-y-1.5 bg-sky-50 p-2.5 rounded-lg border border-sky-200">
              <div className="flex items-center justify-between text-xs font-semibold text-sky-800">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin text-sky-600" />
                  Saving compressed photo to SHEQ Database...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-sky-200/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-sky-600 h-1.5 rounded-full transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {uploadState === 'saving' && (
            <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0" />
              <span>Finalizing photograph record in database...</span>
            </div>
          )}

          {uploadState === 'success' && (
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Photograph uploaded and saved successfully!</span>
            </div>
          )}

          {/* Upload Confirm Button */}
          {uploadState === 'selected' && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelSelection}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartUpload}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 transition-colors shadow-xs cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Save & Upload Photo</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error Message & Retry */}
      {uploadState === 'error' && errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={handleCancelSelection}
            className="text-xs font-bold text-red-800 hover:underline shrink-0 cursor-pointer"
          >
            Dismiss / Retry
          </button>
        </div>
      )}
    </div>
  );
};

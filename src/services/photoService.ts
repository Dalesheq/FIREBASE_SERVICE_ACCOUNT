import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  updateDoc,
  onSnapshot,
  arrayUnion,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { PhotoMetadata, PhotoType, Finding, Action } from '../types/sheq';
import { apiUrl } from '../config/api';

export const PHOTOS_COLLECTION = 'photos';
const OFFLINE_PHOTO_PREFIX = 'sheq_offline_photo_';
const LOCAL_PHOTOS_INDEX_KEY = 'sheq_local_photos_index_v2';

type PhotoStoreListener = () => void;
const photoStoreListeners = new Set<PhotoStoreListener>();

function notifyPhotoStoreListeners(): void {
  photoStoreListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
}

function loadLocalPhotosIndex(): Record<string, PhotoMetadata> {
  try {
    const raw = localStorage.getItem(LOCAL_PHOTOS_INDEX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalPhotoEntry(photo: PhotoMetadata): void {
  try {
    const current = loadLocalPhotosIndex();
    current[photo.id] = photo;
    localStorage.setItem(LOCAL_PHOTOS_INDEX_KEY, JSON.stringify(current));
  } catch {
    // ignore storage quota errors
  }
  notifyPhotoStoreListeners();
}

function removeLocalPhotoEntry(photoId: string): void {
  try {
    const current = loadLocalPhotosIndex();
    if (current[photoId]) {
      delete current[photoId];
      localStorage.setItem(LOCAL_PHOTOS_INDEX_KEY, JSON.stringify(current));
    }
  } catch {
    // ignore
  }
  notifyPhotoStoreListeners();
}

function mergeWithLocalPhotos(
  remotePhotos: PhotoMetadata[],
  filterFn: (p: PhotoMetadata) => boolean
): PhotoMetadata[] {
  const mergedMap = new Map<string, PhotoMetadata>();
  for (const p of remotePhotos) {
    mergedMap.set(p.id, p);
  }
  const localIndex = loadLocalPhotosIndex();
  for (const p of Object.values(localIndex)) {
    if (filterFn(p) && !mergedMap.has(p.id)) {
      mergedMap.set(p.id, p);
      if (p.downloadUrl && p.downloadUrl.length < 900000) {
        setDoc(doc(db, PHOTOS_COLLECTION, p.id), p, { merge: true }).catch(() => {});
      }
    }
  }
  return Array.from(mergedMap.values()).sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '')
  );
}

// Supported MIME types for inspection and evidence photographs
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

// Maximum allowed raw input file size before client-side compression (10 MB)
export const MAX_RAW_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

// Maximum compressed byte size to stay safely within Firestore's 1 MiB document limit (~450 KB raw -> ~600 KB base64)
const MAX_FIRESTORE_INLINE_BYTES = 450 * 1024;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file type and raw file size before processing.
 */
export function validatePhotoFile(file: File): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file was provided.' };
  }

  const isTypeAllowed = ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase());
  if (!isTypeAllowed) {
    return {
      valid: false,
      error: `Invalid file type "${file.type || 'unknown'}". Only JPEG, PNG, and WebP photographs are permitted.`,
    };
  }

  if (file.size > MAX_RAW_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 10 MB limit. Please choose a smaller photo.`,
    };
  }

  return { valid: true };
}

/**
 * Renders an image onto a canvas at the specified maximum dimensions and quality.
 */
function renderCompressedBlob(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    let targetWidth = img.naturalWidth || img.width;
    let targetHeight = img.naturalHeight || img.height;

    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    canvas.toBlob(
      (blob) => resolve(blob),
      'image/jpeg',
      quality
    );
  });
}

/**
 * Compresses and resizes high-resolution camera shots on a client-side HTML5 canvas.
 * Ensures output is compact enough for instant Firestore + IndexedDB offline storage and PDF reports.
 */
export async function compressAndResizeImage(
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.72
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      try {
        let blob = await renderCompressedBlob(img, maxWidth, maxHeight, quality);
        if (!blob) {
          resolve(file);
          return;
        }

        // If still larger than MAX_FIRESTORE_INLINE_BYTES, step down dimensions and quality
        if (blob.size > MAX_FIRESTORE_INLINE_BYTES) {
          const smallerBlob = await renderCompressedBlob(img, 800, 800, 0.58);
          if (smallerBlob) {
            blob = smallerBlob;
          }
        }

        resolve(blob);
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for client-side compression.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Converts a Blob to a base64 Data URL string.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert image blob to base64.'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading image blob.'));
    reader.readAsDataURL(blob);
  });
}

export interface UploadPhotoParams {
  file: File;
  inspectionId: string;
  findingId: string;
  actionId?: string;
  assignedToUserId?: string;
  photoType: PhotoType;
  caption?: string;
  uploaderUserId: string;
  uploaderNameSnapshot: string;
  onProgress?: (progressPercent: number) => void;
}

// In-memory cache for resolved photo URLs
interface CachedSignedUrl {
  url: string;
  expiresAt: number; // Unix timestamp in ms
}
const signedUrlCache = new Map<string, CachedSignedUrl>();

/**
 * Retrieves a URL for a photo, preferring inline data URLs and local cache.
 */
export async function getPhotoSignedUrl(photoId: string): Promise<string | null> {
  const cached = signedUrlCache.get(photoId);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60 * 1000) {
    return cached.url;
  }

  try {
    const localDataUrl = localStorage.getItem(`${OFFLINE_PHOTO_PREFIX}${photoId}`);
    if (localDataUrl) {
      signedUrlCache.set(photoId, {
        url: localDataUrl,
        expiresAt: now + 365 * 24 * 3600 * 1000,
      });
      return localDataUrl;
    }
  } catch {
    // ignore storage errors
  }

  const token = await auth.currentUser?.getIdToken().catch(() => null);
  if (!token) return null;

  try {
    const res = await fetch(apiUrl('/api/photos/signed-url'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ photoId }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.signedUrl) {
      signedUrlCache.set(photoId, {
        url: data.signedUrl,
        expiresAt: now + (data.expiresIn || 3600) * 1000,
      });
      return data.signedUrl;
    }
  } catch (err) {
    console.warn(`Could not resolve signed URL for photo ${photoId}:`, err);
  }

  return null;
}

/**
 * Enriches an array of photos with their inline data URLs, local cache, or signed URLs.
 */
async function enrichPhotosWithSignedUrls(photos: PhotoMetadata[]): Promise<PhotoMetadata[]> {
  if (!photos || photos.length === 0) return [];

  const now = Date.now();
  const missingIds: string[] = [];

  for (const photo of photos) {
    // If the photo already has an inline base64 data URL, cache it directly and skip network calls
    if (photo.downloadUrl && photo.downloadUrl.startsWith('data:image/')) {
      signedUrlCache.set(photo.id, {
        url: photo.downloadUrl,
        expiresAt: now + 365 * 24 * 3600 * 1000,
      });
      continue;
    }

    // Check localStorage cache
    let localDataUrl = '';
    try {
      localDataUrl = localStorage.getItem(`${OFFLINE_PHOTO_PREFIX}${photo.id}`) || '';
    } catch {
      // ignore
    }
    if (localDataUrl) {
      signedUrlCache.set(photo.id, {
        url: localDataUrl,
        expiresAt: now + 365 * 24 * 3600 * 1000,
      });
      continue;
    }

    // Only request signed URL if stored in legacy external bucket path
    if (
      photo.storagePath &&
      !photo.storagePath.startsWith('offline/') &&
      !photo.storagePath.startsWith('firestore-inline/')
    ) {
      const cached = signedUrlCache.get(photo.id);
      if (!cached || cached.expiresAt <= now + 60 * 1000) {
        missingIds.push(photo.id);
      }
    }
  }

  if (missingIds.length > 0 && (typeof navigator === 'undefined' || navigator.onLine)) {
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      if (token) {
        const res = await fetch(apiUrl('/api/photos/signed-urls'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ photoIds: missingIds }),
        });

        if (res.ok) {
          const { urls } = await res.json();
          if (urls) {
            for (const [id, url] of Object.entries(urls as Record<string, string>)) {
              if (url) {
                signedUrlCache.set(id, {
                  url,
                  expiresAt: now + 3500 * 1000,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Batch signed URL fetch skipped:', err);
    }
  }

  return photos.map((photo) => {
    const cached = signedUrlCache.get(photo.id);
    let localDataUrl = '';
    try {
      localDataUrl = localStorage.getItem(`${OFFLINE_PHOTO_PREFIX}${photo.id}`) || '';
    } catch {
      // ignore
    }
    return {
      ...photo,
      downloadUrl: cached ? cached.url : localDataUrl || photo.downloadUrl || '',
    };
  });
}

/**
 * Saves compressed photo directly into Firestore (with IndexedDB offline persistence)
 * and local cache so photo uploads work 100% free, both offline and online, without external storage dependencies.
 */
async function savePhotoLocallyOffline(params: {
  fileBase64: string;
  fileName: string;
  sizeBytes: number;
  inspectionId: string;
  findingId: string;
  actionId?: string;
  assignedToUserId?: string;
  photoType: PhotoType;
  caption?: string;
  uploaderUserId: string;
  uploaderNameSnapshot: string;
}): Promise<PhotoMetadata> {
  const now = new Date().toISOString();
  const photoId = `pho_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const sanitizedFileName = (params.fileName || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');

  const photoDoc: PhotoMetadata = {
    id: photoId,
    inspectionId: params.inspectionId,
    findingId: params.findingId,
    actionId: params.actionId || '',
    assignedToUserId:
      params.assignedToUserId ||
      (params.photoType === 'evidence' ? params.uploaderUserId : ''),
    photoType: params.photoType,
    storagePath: `inspections/${params.inspectionId}/findings/${params.findingId}/${photoId}_${sanitizedFileName}`,
    downloadUrl: params.fileBase64,
    fileName: sanitizedFileName,
    contentType: 'image/jpeg',
    fileSize: params.sizeBytes,
    caption: params.caption?.trim() || '',
    uploadedByUserId: params.uploaderUserId,
    uploadedByNameSnapshot: params.uploaderNameSnapshot,
    createdAt: now,
    updatedAt: now,
  };

  try {
    localStorage.setItem(`${OFFLINE_PHOTO_PREFIX}${photoId}`, params.fileBase64);
  } catch {
    // If localStorage is full, photoDoc.downloadUrl still holds the compressed base64 in Firestore IndexedDB
  }

  signedUrlCache.set(photoId, {
    url: params.fileBase64,
    expiresAt: Date.now() + 365 * 24 * 3600 * 1000,
  });

  // Immediately persist in local photo index and notify UI listeners
  saveLocalPhotoEntry(photoDoc);

  // Write directly to Firestore (resolves immediately from IndexedDB or within timeout if offline)
  const writePromise = setDoc(doc(db, PHOTOS_COLLECTION, photoId), photoDoc).catch((err) => {
    console.warn('Firestore photo setDoc warning (saved in local persistent store):', err);
  });
  await Promise.race([
    writePromise,
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);

  // If this is an evidence photo linked to an action, also append to the action's evidencePhotoUrls
  if (params.photoType === 'evidence' && params.actionId) {
    const actionUpdatePromise = updateDoc(doc(db, 'actions', params.actionId), {
      evidencePhotoUrls: arrayUnion(params.fileBase64),
      updatedAt: now,
      updatedByUserId: params.uploaderUserId,
    }).catch((err) => {
      console.warn('Could not update action evidencePhotoUrls inline:', err);
    });

    await Promise.race([
      actionUpdatePromise,
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
    ]);
  }

  return photoDoc;
}

/**
 * Uploads an inspection photograph taken by an inspector.
 * Compresses client-side and saves directly to Firestore + IndexedDB persistent cache
 * so it works 100% free both online and offline without Supabase errors.
 */
export async function uploadInspectionPhoto(
  params: Omit<UploadPhotoParams, 'photoType'>
): Promise<PhotoMetadata> {
  // 1. Client-side file validation
  const validation = validatePhotoFile(params.file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Client-side image compression
  if (params.onProgress) params.onProgress(25);
  const compressedBlob = await compressAndResizeImage(params.file, 800, 800, 0.68);

  if (params.onProgress) params.onProgress(60);
  const fileBase64 = await blobToBase64(compressedBlob);

  if (params.onProgress) params.onProgress(85);
  const savedPhoto = await savePhotoLocallyOffline({
    fileBase64,
    fileName: params.file.name,
    sizeBytes: compressedBlob.size,
    inspectionId: params.inspectionId,
    findingId: params.findingId,
    photoType: 'inspection',
    caption: params.caption,
    uploaderUserId: params.uploaderUserId,
    uploaderNameSnapshot: params.uploaderNameSnapshot,
  });

  if (params.onProgress) params.onProgress(100);
  return savedPhoto;
}

/**
 * Uploads an evidence photograph for a corrective action by the assigned actioner.
 * Compresses client-side and saves directly to Firestore + IndexedDB persistent cache
 * so it works 100% free both online and offline without Supabase errors.
 */
export async function uploadEvidencePhoto(
  params: Omit<UploadPhotoParams, 'photoType'> & { actionId: string }
): Promise<PhotoMetadata> {
  // 1. Client-side file validation
  const validation = validatePhotoFile(params.file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Client-side image compression
  if (params.onProgress) params.onProgress(25);
  const compressedBlob = await compressAndResizeImage(params.file, 800, 800, 0.68);

  if (params.onProgress) params.onProgress(60);
  const fileBase64 = await blobToBase64(compressedBlob);

  if (params.onProgress) params.onProgress(85);
  const savedPhoto = await savePhotoLocallyOffline({
    fileBase64,
    fileName: params.file.name,
    sizeBytes: compressedBlob.size,
    inspectionId: params.inspectionId,
    findingId: params.findingId,
    actionId: params.actionId,
    assignedToUserId: params.assignedToUserId || params.uploaderUserId,
    photoType: 'evidence',
    caption: params.caption,
    uploaderUserId: params.uploaderUserId,
    uploaderNameSnapshot: params.uploaderNameSnapshot,
  });

  if (params.onProgress) params.onProgress(100);
  return savedPhoto;
}

/**
 * Subscribes to real-time updates of photos for a specific finding.
 * Merges Firestore snapshots with local persistent photo store for instant zero-latency updates.
 */
export function subscribePhotosByFinding(
  findingId: string,
  onUpdate: (photos: PhotoMetadata[]) => void,
  onError?: (err: Error) => void
): () => void {
  let latestRemotePhotos: PhotoMetadata[] = [];

  const emitMerged = async () => {
    const merged = mergeWithLocalPhotos(
      latestRemotePhotos,
      (p) => p.findingId === findingId
    );
    try {
      const enriched = await enrichPhotosWithSignedUrls(merged);
      onUpdate(enriched);
    } catch {
      onUpdate(merged);
    }
  };

  const localListener = () => {
    emitMerged();
  };
  photoStoreListeners.add(localListener);

  // Immediately emit any locally stored photos
  emitMerged();

  const q = query(
    collection(db, PHOTOS_COLLECTION),
    where('findingId', '==', findingId)
  );

  const unsubFirestore = onSnapshot(
    q,
    async (snapshot) => {
      latestRemotePhotos = snapshot.docs
        .map((d) => d.data() as PhotoMetadata)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      await emitMerged();
    },
    (err) => {
      console.warn(`Firestore photo subscription fallback to local store for finding ${findingId}:`, err);
      emitMerged();
      if (onError && mergeWithLocalPhotos([], (p) => p.findingId === findingId).length === 0) {
        // Still allow UI to work with local photos without blocking
        onUpdate([]);
      }
    }
  );

  return () => {
    photoStoreListeners.delete(localListener);
    unsubFirestore();
  };
}

/**
 * Subscribes to real-time updates of evidence photos for a specific action.
 * Merges Firestore snapshots with local persistent photo store for instant zero-latency updates.
 */
export function subscribePhotosByAction(
  actionId: string,
  onUpdate: (photos: PhotoMetadata[]) => void,
  onError?: (err: Error) => void
): () => void {
  let latestRemotePhotos: PhotoMetadata[] = [];

  const emitMerged = async () => {
    const merged = mergeWithLocalPhotos(
      latestRemotePhotos,
      (p) => p.actionId === actionId
    );
    try {
      const enriched = await enrichPhotosWithSignedUrls(merged);
      onUpdate(enriched);
    } catch {
      onUpdate(merged);
    }
  };

  const localListener = () => {
    emitMerged();
  };
  photoStoreListeners.add(localListener);

  // Immediately emit any locally stored photos
  emitMerged();

  const q = query(
    collection(db, PHOTOS_COLLECTION),
    where('actionId', '==', actionId)
  );

  const unsubFirestore = onSnapshot(
    q,
    async (snapshot) => {
      latestRemotePhotos = snapshot.docs
        .map((d) => d.data() as PhotoMetadata)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      await emitMerged();
    },
    (err) => {
      console.warn(`Firestore photo subscription fallback to local store for action ${actionId}:`, err);
      emitMerged();
      if (onError && mergeWithLocalPhotos([], (p) => p.actionId === actionId).length === 0) {
        onUpdate([]);
      }
    }
  );

  return () => {
    photoStoreListeners.delete(localListener);
    unsubFirestore();
  };
}

/**
 * Converts any image URL or data URL (JPEG, PNG, WebP, or HTTP URL) into a clean
 * data:image/jpeg;base64,... URL so PDF generators can embed it reliably.
 */
export async function ensureJpegDataUrl(urlOrDataUrl?: string): Promise<string> {
  if (!urlOrDataUrl) return '';
  if (urlOrDataUrl.startsWith('data:image/jpeg;base64,') || urlOrDataUrl.startsWith('data:image/jpg;base64,')) {
    return urlOrDataUrl;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      if (!urlOrDataUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        try {
          const maxDim = 1000;
          let w = img.naturalWidth || img.width || 800;
          let h = img.naturalHeight || img.height || 600;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(urlOrDataUrl);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(jpegDataUrl || urlOrDataUrl);
        } catch {
          resolve(urlOrDataUrl);
        }
      };
      img.onerror = () => resolve(urlOrDataUrl);
      img.src = urlOrDataUrl;
    } catch {
      resolve(urlOrDataUrl);
    }
  });
}

/**
 * Synchronizes any photos uploaded for the given findingIds so their inspectionId
 * matches the finalized inspectionId in both localStorage and Firestore.
 */
export async function syncPhotosToInspection(
  inspectionId: string,
  findingIds: string[]
): Promise<void> {
  if (!inspectionId || !findingIds || findingIds.length === 0) return;
  const findingIdSet = new Set(findingIds.filter(Boolean));
  if (findingIdSet.size === 0) return;

  try {
    const localIndex = loadLocalPhotosIndex();
    let changed = false;
    for (const [id, photo] of Object.entries(localIndex)) {
      if (photo.findingId && findingIdSet.has(photo.findingId) && photo.inspectionId !== inspectionId) {
        localIndex[id] = {
          ...photo,
          inspectionId,
          storagePath: `inspections/${inspectionId}/findings/${photo.findingId}/${photo.id}_${photo.fileName || 'photo.jpg'}`,
        };
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(LOCAL_PHOTOS_INDEX_KEY, JSON.stringify(localIndex));
      notifyPhotoStoreListeners();
    }
  } catch {
    // ignore localStorage errors
  }

  for (const fId of findingIdSet) {
    try {
      const q = query(collection(db, PHOTOS_COLLECTION), where('findingId', '==', fId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = d.data() as PhotoMetadata;
        if (data.inspectionId !== inspectionId) {
          await updateDoc(d.ref, {
            inspectionId,
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }
    } catch {
      // ignore offline errors
    }
  }
}

/**
 * Gets all photos associated with an inspection.
 */
export async function getPhotosByInspection(
  inspectionId: string
): Promise<PhotoMetadata[]> {
  let remotePhotos: PhotoMetadata[] = [];
  try {
    const q = query(
      collection(db, PHOTOS_COLLECTION),
      where('inspectionId', '==', inspectionId)
    );
    const snap = await getDocs(q);
    remotePhotos = snap.docs
      .map((d) => d.data() as PhotoMetadata)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  } catch (err) {
    console.warn(`Using local photo store fallback for inspection ${inspectionId}:`, err);
  }

  const merged = mergeWithLocalPhotos(
    remotePhotos,
    (p) => p.inspectionId === inspectionId
  );

  return enrichPhotosWithSignedUrls(merged);
}

/**
 * Comprehensively retrieves and normalizes ALL inspection and corrective action evidence
 * photographs for an inspection report (by inspectionId, findingIds, actionIds, local cache,
 * and action.evidencePhotoUrls) with guaranteed inline JPEG data URLs.
 */
export async function getPhotosForReport(
  inspectionId: string,
  findings: Finding[] = [],
  actions: Action[] = []
): Promise<PhotoMetadata[]> {
  const photoMap = new Map<string, PhotoMetadata>();
  const findingIds = new Set(findings.map((f) => f.id).filter(Boolean));
  const actionIds = new Set(actions.map((a) => a.id).filter(Boolean));

  // 1. Query Firestore by inspectionId
  try {
    const inspSnap = await getDocs(
      query(collection(db, PHOTOS_COLLECTION), where('inspectionId', '==', inspectionId))
    );
    inspSnap.docs.forEach((d) => {
      const data = d.data() as PhotoMetadata;
      photoMap.set(data.id || d.id, { ...data, id: data.id || d.id, inspectionId });
    });
  } catch (err) {
    console.warn('Could not query photos by inspectionId:', err);
  }

  // 2. Query Firestore by each findingId (catches photos uploaded before draft inspectionId was finalized)
  for (const fId of findingIds) {
    try {
      const fSnap = await getDocs(
        query(collection(db, PHOTOS_COLLECTION), where('findingId', '==', fId))
      );
      fSnap.docs.forEach((d) => {
        const data = d.data() as PhotoMetadata;
        photoMap.set(data.id || d.id, { ...data, id: data.id || d.id, inspectionId });
      });
    } catch {
      // ignore
    }
  }

  // 3. Query Firestore by each actionId
  for (const aId of actionIds) {
    try {
      const aSnap = await getDocs(
        query(collection(db, PHOTOS_COLLECTION), where('actionId', '==', aId))
      );
      aSnap.docs.forEach((d) => {
        const data = d.data() as PhotoMetadata;
        photoMap.set(data.id || d.id, { ...data, id: data.id || d.id, inspectionId });
      });
    } catch {
      // ignore
    }
  }

  // 4. Merge any matching photos from localStorage index
  const localIndex = loadLocalPhotosIndex();
  for (const p of Object.values(localIndex)) {
    const matchesInspection = p.inspectionId === inspectionId;
    const matchesFinding = Boolean(p.findingId && findingIds.has(p.findingId));
    const matchesAction = Boolean(p.actionId && actionIds.has(p.actionId));
    if (matchesInspection || matchesFinding || matchesAction) {
      const existing = photoMap.get(p.id);
      photoMap.set(p.id, {
        ...existing,
        ...p,
        inspectionId,
        downloadUrl: p.downloadUrl || existing?.downloadUrl || '',
      });
    }
  }

  // 5. Enrich with signed URLs / local cache
  const enriched = await enrichPhotosWithSignedUrls(Array.from(photoMap.values()));
  const finalMap = new Map<string, PhotoMetadata>();
  for (const p of enriched) {
    finalMap.set(p.id, p);
  }

  // 6. Also synthesize PhotoMetadata for any action.evidencePhotoUrls not already represented
  for (const act of actions) {
    if (Array.isArray(act.evidencePhotoUrls) && act.evidencePhotoUrls.length > 0) {
      const existingActionPhotos = Array.from(finalMap.values()).filter(
        (p) => p.actionId === act.id || (p.findingId === act.findingId && p.photoType === 'evidence')
      );
      act.evidencePhotoUrls.forEach((url, idx) => {
        if (!url) return;
        const alreadyPresent = existingActionPhotos.some((p) => p.downloadUrl === url);
        if (!alreadyPresent) {
          const synthId = `pho_ev_${act.id}_${idx}`;
          finalMap.set(synthId, {
            id: synthId,
            inspectionId,
            findingId: act.findingId,
            actionId: act.id,
            assignedToUserId: act.assignedToUserId,
            photoType: 'evidence',
            storagePath: `inspections/${inspectionId}/findings/${act.findingId}/actions/${act.id}/evidence/${synthId}.jpg`,
            downloadUrl: url,
            fileName: `evidence_${idx + 1}.jpg`,
            contentType: 'image/jpeg',
            fileSize: url.length,
            caption: `Corrective Action Evidence #${idx + 1}`,
            uploadedByUserId: act.assignedToUserId,
            uploadedByNameSnapshot: act.assignedToUserNameSnapshot || 'Actioner',
            createdAt: act.completionDate || act.updatedAt || act.createdAt,
            updatedAt: act.updatedAt || act.createdAt,
          });
        }
      });
    }
  }

  // 7. Normalize every photo's downloadUrl to JPEG data URL for guaranteed PDF embedding
  const allPhotos = Array.from(finalMap.values()).sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '')
  );

  const normalizedPhotos = await Promise.all(
    allPhotos.map(async (p) => {
      let rawUrl = p.downloadUrl || '';
      if (!rawUrl) {
        try {
          rawUrl = localStorage.getItem(`${OFFLINE_PHOTO_PREFIX}${p.id}`) || '';
        } catch {
          // ignore
        }
      }
      const jpegDataUrl = rawUrl ? await ensureJpegDataUrl(rawUrl) : '';
      return {
        ...p,
        inspectionId,
        storagePath: p.storagePath?.startsWith(`inspections/${inspectionId}/`)
          ? p.storagePath
          : `inspections/${inspectionId}/findings/${p.findingId || 'general'}/${p.id}.jpg`,
        downloadUrl: jpegDataUrl || rawUrl,
      };
    })
  );

  return normalizedPhotos;
}

/**
 * Deletes a photo from Firestore metadata and local cache.
 */
export async function deletePhoto(
  photo: PhotoMetadata,
  currentUserId: string,
  isAdmin: boolean
): Promise<void> {
  // Client-side quick check
  if (!isAdmin) {
    const isOwnEvidence =
      photo.photoType === 'evidence' && photo.uploadedByUserId === currentUserId;
    if (!isOwnEvidence) {
      throw new Error('Unauthorized: You can only delete your own evidence photos.');
    }
  }

  removeLocalPhotoEntry(photo.id);

  try {
    localStorage.removeItem(`${OFFLINE_PHOTO_PREFIX}${photo.id}`);
  } catch {
    // ignore
  }

  // Evict from cache
  signedUrlCache.delete(photo.id);

  await deleteDoc(doc(db, PHOTOS_COLLECTION, photo.id)).catch((err) => {
    console.warn('Could not delete photo doc from Firestore:', err);
  });
}

/**
 * Cascading deletion for all photos associated with a finding.
 */
export async function deletePhotosForFinding(findingId: string): Promise<void> {
  try {
    const localIndex = loadLocalPhotosIndex();
    for (const p of Object.values(localIndex)) {
      if (p.findingId === findingId) {
        removeLocalPhotoEntry(p.id);
        try {
          localStorage.removeItem(`${OFFLINE_PHOTO_PREFIX}${p.id}`);
        } catch {
          // ignore
        }
        signedUrlCache.delete(p.id);
      }
    }

    const q = query(collection(db, PHOTOS_COLLECTION), where('findingId', '==', findingId));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map(async (d) => {
        removeLocalPhotoEntry(d.id);
        await deleteDoc(d.ref).catch(() => {});
        try {
          localStorage.removeItem(`${OFFLINE_PHOTO_PREFIX}${d.id}`);
        } catch {
          // ignore
        }
        signedUrlCache.delete(d.id);
      })
    );
  } catch (err) {
    console.warn(`Could not delete photos for finding ${findingId}:`, err);
  }
}

/**
 * Cascading deletion for all photos associated with an inspection.
 */
export async function deletePhotosForInspection(inspectionId: string): Promise<void> {
  try {
    const localIndex = loadLocalPhotosIndex();
    for (const p of Object.values(localIndex)) {
      if (p.inspectionId === inspectionId) {
        removeLocalPhotoEntry(p.id);
        try {
          localStorage.removeItem(`${OFFLINE_PHOTO_PREFIX}${p.id}`);
        } catch {
          // ignore
        }
        signedUrlCache.delete(p.id);
      }
    }

    const q = query(collection(db, PHOTOS_COLLECTION), where('inspectionId', '==', inspectionId));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map(async (d) => {
        removeLocalPhotoEntry(d.id);
        await deleteDoc(d.ref).catch(() => {});
        try {
          localStorage.removeItem(`${OFFLINE_PHOTO_PREFIX}${d.id}`);
        } catch {
          // ignore
        }
        signedUrlCache.delete(d.id);
      })
    );
  } catch (err) {
    console.warn(`Could not delete photos for inspection ${inspectionId}:`, err);
  }
}

/**
 * Updates a photo's caption in Firestore and local cache.
 */
export async function updatePhotoCaption(
  photoId: string,
  caption: string
): Promise<void> {
  const now = new Date().toISOString();
  const trimmed = caption.trim();

  try {
    const localIndex = loadLocalPhotosIndex();
    if (localIndex[photoId]) {
      localIndex[photoId] = {
        ...localIndex[photoId],
        caption: trimmed,
        updatedAt: now,
      };
      localStorage.setItem(LOCAL_PHOTOS_INDEX_KEY, JSON.stringify(localIndex));
      notifyPhotoStoreListeners();
    }
  } catch {
    // ignore
  }

  const photoRef = doc(db, PHOTOS_COLLECTION, photoId);
  await updateDoc(photoRef, {
    caption: trimmed,
    updatedAt: now,
  }).catch((err) => {
    console.warn('Could not update photo caption in Firestore:', err);
  });
}

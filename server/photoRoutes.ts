import { Router, Request, Response } from 'express';
import { getAuthTokenFromHeader, verifyFirebaseToken, isUserAdmin, isUserActive } from './firebaseAuth';
import {
  isSupabaseConfigured,
  uploadPhotoBuffer,
  createSignedUrl,
  deletePhotoObject,
  deletePhotoObjects,
  checkSupabaseDiagnostics,
} from './supabaseStorage';
import {
  getFirestoreDoc,
  writeFirestoreDoc,
  deleteFirestoreDoc,
  appendToArrayField,
  removeFromArrayField,
  queryDocsByField,
} from './firestoreRest';

export const photoRouter = Router();

// Permitted MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Helper to get file extension from MIME type.
 */
function getExtension(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.jpg';
  }
}

/**
 * Health / Config check
 */
photoRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    configured: isSupabaseConfigured(),
    bucket: 'sheq-photos',
    accessModel: 'private-signed-urls',
    authProvider: 'firebase-auth',
  });
});

/**
 * Diagnostic check for Supabase storage connectivity and bucket state.
 * Safe to call; never reveals private keys.
 */
photoRouter.get('/diagnostics', async (req: Request, res: Response) => {
  try {
    const report = await checkSupabaseDiagnostics();
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Diagnostic check failed.' });
  }
});

/**
 * POST /api/photos/upload
 * Uploads a photograph to private Supabase Storage and creates Firestore metadata.
 */
photoRouter.post('/upload', async (req: Request, res: Response) => {
  try {
    // 1. Authenticate Firebase user
    const token = getAuthTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    }

    const caller = await verifyFirebaseToken(token);
    const isActive = await isUserActive(caller, token);
    if (!isActive) {
      return res.status(403).json({ error: 'Account deactivated. Access denied.' });
    }

    //Check if Supabase Storage is configured; if not or if unreachable, we will store compressed inline image in Firestore
    const supabaseReady = isSupabaseConfigured();

    const {
      fileBase64,
      fileName,
      contentType,
      inspectionId,
      findingId,
      actionId,
      photoType,
      caption,
      uploaderNameSnapshot,
    } = req.body;

    if (!fileBase64 || !contentType || !inspectionId || !findingId || !photoType) {
      return res.status(400).json({
        error: 'Missing required upload parameters (fileBase64, contentType, inspectionId, findingId, photoType).',
      });
    }

    // 2. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(contentType.toLowerCase())) {
      return res.status(400).json({
        error: `Invalid file type "${contentType}". Only JPEG, PNG, and WebP images are permitted.`,
      });
    }

    // 3. Decode base64 and validate byte size
    const rawData = fileBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(rawData, 'base64');
    const inlineDataUrl = fileBase64.startsWith('data:image/')
      ? fileBase64
      : `data:${contentType};base64,${rawData}`;

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({
        error: `File size (${(buffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds the 10 MB limit.`,
      });
    }

    const isAdmin = await isUserAdmin(caller, token);

    // 4. Enforce domain authorization
    if (photoType === 'inspection') {
      if (!isAdmin) {
        return res.status(403).json({
          error: 'Only SHEQ Inspectors / Admins can upload inspection hazard photographs.',
        });
      }
    } else if (photoType === 'evidence') {
      if (!actionId) {
        return res.status(400).json({ error: 'Action ID is required for corrective action evidence.' });
      }

      // Check action record in Firestore
      const actionDoc = await getFirestoreDoc(`actions/${actionId}`, token);
      if (!actionDoc) {
        return res.status(404).json({ error: `Associated Action "${actionId}" not found.` });
      }

      const assignedToUserId = actionDoc.assignedToUserId;
      // Actioner Isolation: Only the assigned actioner (or admin) may upload evidence
      if (assignedToUserId !== caller.uid && !isAdmin) {
        return res.status(403).json({
          error:
            'Actioner isolation violation: You can only upload evidence to corrective actions assigned to your account.',
        });
      }
    } else {
      return res.status(400).json({ error: `Invalid photoType "${photoType}".` });
    }

    // 5. Generate safe, non-sensitive photoId and storage path
    const photoId = `pho_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const ext = getExtension(contentType);

    let storagePath: string;
    if (photoType === 'evidence' && actionId) {
      storagePath = `inspections/${inspectionId}/findings/${findingId}/actions/${actionId}/evidence/${photoId}${ext}`;
    } else {
      storagePath = `inspections/${inspectionId}/findings/${findingId}/inspection/${photoId}${ext}`;
    }

    // 6. Attempt upload to Supabase Storage; if Supabase is paused or unreachable, fall back to Firestore inline data URL
    let uploadedToSupabase = false;
    if (supabaseReady) {
      try {
        await uploadPhotoBuffer(storagePath, buffer, contentType);
        uploadedToSupabase = true;
      } catch (supaErr: any) {
        console.warn(
          'Supabase Storage upload unavailable, falling back to Firestore inline storage:',
          supaErr?.message || supaErr
        );
        storagePath = `firestore-inline/${inspectionId}/${findingId}/${photoId}${ext}`;
      }
    } else {
      storagePath = `firestore-inline/${inspectionId}/${findingId}/${photoId}${ext}`;
    }

    // 7. Write Firestore metadata record
    const now = new Date().toISOString();
    const metadata: Record<string, any> = {
      id: photoId,
      inspectionId,
      findingId,
      actionId: actionId || '',
      uploadedByUserId: caller.uid,
      uploadedByNameSnapshot: uploaderNameSnapshot || caller.email || 'Inspector',
      assignedToUserId: photoType === 'evidence' ? caller.uid : '',
      photoType,
      storagePath,
      fileName: fileName || `photo_${photoId}${ext}`,
      contentType,
      fileSize: buffer.length,
      caption: (caption || '').trim(),
      createdAt: now,
      updatedAt: now,
      ...(uploadedToSupabase ? {} : { downloadUrl: inlineDataUrl }),
    };

    try {
      await writeFirestoreDoc(`photos/${photoId}`, metadata, token);
    } catch (fsErr) {
      console.warn('Server REST Firestore write skipped (client SDK will persist):', fsErr);
    }

    // 8. Generate short-lived signed URL for immediate client preview (or use inline data URL)
    let signedUrl = inlineDataUrl;
    if (uploadedToSupabase) {
      try {
        signedUrl = await createSignedUrl(storagePath, 3600);
      } catch {
        signedUrl = inlineDataUrl;
      }
    }

    // 9. If evidence photo, append reference to action document
    if (photoType === 'evidence' && actionId) {
      await appendToArrayField(`actions/${actionId}`, 'evidencePhotoUrls', signedUrl, token).catch((e) =>
        console.warn('Could not update action evidencePhotoUrls:', e)
      );
    }

    return res.status(201).json({
      success: true,
      photo: {
        ...metadata,
        downloadUrl: signedUrl,
      },
      signedUrl,
    });
  } catch (err: any) {
    console.error('Photo upload error:', err);
    return res.status(500).json({ error: err.message || 'Photo upload failed.' });
  }
});

/**
 * POST /api/photos/signed-url
 * Generates a short-lived signed URL for an authorized photo.
 */
photoRouter.post('/signed-url', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const caller = await verifyFirebaseToken(token);
    const isActive = await isUserActive(caller, token);
    if (!isActive) {
      return res.status(403).json({ error: 'Account deactivated. Access denied.' });
    }

    const { photoId } = req.body;
    if (!photoId) {
      return res.status(400).json({ error: 'photoId is required.' });
    }

    // Fetch photo metadata from Firestore
    const photo = await getFirestoreDoc(`photos/${photoId}`, token);
    if (!photo) {
      return res.status(404).json({ error: 'Photograph metadata not found.' });
    }

    const isAdmin = await isUserAdmin(caller, token);

    // Authorization verification
    if (photo.photoType === 'evidence') {
      const assignedTo = photo.assignedToUserId;
      const uploadedBy = photo.uploadedByUserId;
      if (assignedTo !== caller.uid && uploadedBy !== caller.uid && !isAdmin) {
        return res.status(403).json({
          error: 'Access denied: You are not authorized to view this corrective action evidence.',
        });
      }
    } else if (photo.photoType === 'inspection') {
      // Inspectors/admins can view; assigned actioners can view if linked to their finding
      if (!isAdmin && photo.assignedToUserId && photo.assignedToUserId !== caller.uid) {
        return res.status(403).json({ error: 'Access denied to this inspection photograph.' });
      }
    }

    if (photo.downloadUrl && String(photo.downloadUrl).startsWith('data:image/')) {
      return res.json({ signedUrl: photo.downloadUrl, expiresIn: 3600 });
    }

    if (!isSupabaseConfigured()) {
      return res.json({ signedUrl: photo.downloadUrl || '', expiresIn: 3600 });
    }

    try {
      const signedUrl = await createSignedUrl(photo.storagePath, 3600);
      return res.json({ signedUrl, expiresIn: 3600 });
    } catch {
      return res.json({ signedUrl: photo.downloadUrl || '', expiresIn: 3600 });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate signed URL.' });
  }
});

/**
 * POST /api/photos/signed-urls
 * Batch signed URL generation for list / thumbnail views.
 */
photoRouter.post('/signed-urls', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const caller = await verifyFirebaseToken(token);
    const isActive = await isUserActive(caller, token);
    if (!isActive) {
      return res.status(403).json({ error: 'Account deactivated. Access denied.' });
    }

    const { photoIds } = req.body;
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return res.json({ urls: {} });
    }

    const isAdmin = await isUserAdmin(caller, token);
    const urls: Record<string, string> = {};

    for (const id of photoIds.slice(0, 50)) {
      try {
        const photo = await getFirestoreDoc(`photos/${id}`, token);
        if (!photo) continue;

        if (photo.photoType === 'evidence') {
          if (photo.assignedToUserId !== caller.uid && photo.uploadedByUserId !== caller.uid && !isAdmin) {
            continue; // Skip unauthorized
          }
        }

        if (photo.downloadUrl && String(photo.downloadUrl).startsWith('data:image/')) {
          urls[id] = photo.downloadUrl;
          continue;
        }

        if (isSupabaseConfigured() && photo.storagePath && !String(photo.storagePath).startsWith('firestore-inline/') && !String(photo.storagePath).startsWith('offline/')) {
          const signedUrl = await createSignedUrl(photo.storagePath, 3600);
          urls[id] = signedUrl;
        } else if (photo.downloadUrl) {
          urls[id] = photo.downloadUrl;
        }
      } catch {
        // Continue with next
      }
    }

    return res.json({ urls });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate batch signed URLs.' });
  }
});

/**
 * DELETE /api/photos/:photoId
 * Securely deletes photo object from Supabase Storage and Firestore metadata.
 */
photoRouter.delete('/:photoId', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const caller = await verifyFirebaseToken(token);
    const isActive = await isUserActive(caller, token);
    if (!isActive) {
      return res.status(403).json({ error: 'Account deactivated. Access denied.' });
    }

    const { photoId } = req.params;
    const photo = await getFirestoreDoc(`photos/${photoId}`, token);
    if (!photo) {
      return res.status(404).json({ error: 'Photograph not found.' });
    }

    const isAdmin = await isUserAdmin(caller, token);

    // Check delete permission
    if (photo.photoType === 'inspection') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only SHEQ Admins can delete inspection hazard photos.' });
      }
    } else if (photo.photoType === 'evidence') {
      // Evidence can be deleted by the uploader (if assigned) or admin
      const isUploader = photo.uploadedByUserId === caller.uid;
      const isAssigned = photo.assignedToUserId === caller.uid;
      if (!(isUploader && isAssigned) && !isAdmin) {
        return res.status(403).json({ error: 'You are not authorized to delete this evidence photo.' });
      }
    }

    // 1. Delete Supabase Storage object if configured and not an inline/offline photo
    if (
      isSupabaseConfigured() &&
      photo.storagePath &&
      !String(photo.storagePath).startsWith('firestore-inline/') &&
      !String(photo.storagePath).startsWith('offline/')
    ) {
      try {
        await deletePhotoObject(photo.storagePath);
      } catch (storageErr: any) {
        console.warn('Supabase storage deletion skipped (unreachable or already removed):', storageErr?.message || storageErr);
      }
    }

    // 2. Delete Firestore metadata document
    try {
      await deleteFirestoreDoc(`photos/${photoId}`, token);
    } catch (fsErr: any) {
      console.error('Firestore deletion failed after storage deletion:', fsErr);
      return res.status(500).json({
        error: `Storage file was deleted, but Firestore metadata deletion failed: ${fsErr.message}`,
      });
    }

    // 3. If evidence, remove from action evidencePhotoUrls
    if (photo.photoType === 'evidence' && photo.actionId && photo.downloadUrl) {
      await removeFromArrayField(`actions/${photo.actionId}`, 'evidencePhotoUrls', photo.downloadUrl, token).catch(
        (e) => console.warn('Could not remove evidencePhotoUrl from action:', e)
      );
    }

    return res.json({ success: true, message: 'Photo deleted successfully.' });
  } catch (err: any) {
    console.error('Delete photo error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete photo.' });
  }
});

/**
 * POST /api/photos/delete-for-finding
 * Cascading delete for all photos associated with a finding.
 */
photoRouter.post('/delete-for-finding', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const caller = await verifyFirebaseToken(token);
    const isAdmin = await isUserAdmin(caller, token);

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only Admins can perform finding cascading photo cleanup.' });
    }

    const { findingId } = req.body;
    if (!findingId) {
      return res.status(400).json({ error: 'findingId is required.' });
    }

    const photos = await queryDocsByField('photos', 'findingId', findingId, token);
    const storagePaths: string[] = [];

    for (const photo of photos) {
      if (photo.storagePath) storagePaths.push(photo.storagePath);
      await deleteFirestoreDoc(`photos/${photo.id}`, token).catch((e) =>
        console.warn(`Could not delete photo doc ${photo.id}:`, e)
      );
    }

    if (isSupabaseConfigured() && storagePaths.length > 0) {
      await deletePhotoObjects(storagePaths).catch((e) =>
        console.warn('Could not batch delete finding photos from storage:', e)
      );
    }

    return res.json({ success: true, count: photos.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete photos for finding.' });
  }
});

/**
 * POST /api/photos/delete-for-inspection
 * Cascading delete for all photos associated with an inspection.
 */
photoRouter.post('/delete-for-inspection', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const caller = await verifyFirebaseToken(token);
    const isAdmin = await isUserAdmin(caller, token);

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only Admins can perform inspection cascading photo cleanup.' });
    }

    const { inspectionId } = req.body;
    if (!inspectionId) {
      return res.status(400).json({ error: 'inspectionId is required.' });
    }

    const photos = await queryDocsByField('photos', 'inspectionId', inspectionId, token);
    const storagePaths: string[] = [];

    for (const photo of photos) {
      if (photo.storagePath) storagePaths.push(photo.storagePath);
      await deleteFirestoreDoc(`photos/${photo.id}`, token).catch((e) =>
        console.warn(`Could not delete photo doc ${photo.id}:`, e)
      );
    }

    if (isSupabaseConfigured() && storagePaths.length > 0) {
      await deletePhotoObjects(storagePaths).catch((e) =>
        console.warn('Could not batch delete inspection photos from storage:', e)
      );
    }

    return res.json({ success: true, count: photos.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete photos for inspection.' });
  }
});

// Re-export router aliases for full compatibility
export const router = photoRouter;
export default photoRouter;

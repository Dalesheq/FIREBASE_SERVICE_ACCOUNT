import { Router, Request, Response } from 'express';
import { getAuthTokenFromHeader, verifyFirebaseToken, isUserAdmin } from './firebaseAuth';
import { getFirestoreDoc, queryDocsByField } from './firestoreRest';
import { generateInspectionPdf, sanitizeReportFilename, ReportGenerationData } from './reportService';
import { Inspection, Finding, Action, PhotoMetadata } from '../src/types/sheq';

export const reportRouter = Router();

/**
 * GET /api/reports/status
 * Health & capability endpoint for PDF reporting engine.
 */
reportRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    engine: 'PDFKit',
    roleRequired: 'Admin',
    format: 'application/pdf',
  });
});

/**
 * Core handler to generate inspection PDF.
 * Enforces strict Admin-Only authorization and relational validation.
 */
async function handleGenerateReport(req: Request, res: Response) {
  try {
    // 1. Verify Authentication (Bearer Token)
    const token = getAuthTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Missing Bearer token.',
      });
    }

    let caller;
    try {
      caller = await verifyFirebaseToken(token);
    } catch (authErr: any) {
      return res.status(401).json({
        error: authErr.message || 'Authentication failed. Invalid or expired Firebase token.',
      });
    }

    // 2. Authoritative Active Admin Authorization Check
    const isAdmin = await isUserAdmin(caller, token);
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Access denied: Only active SHEQ Administrators may access or generate inspection reports.',
      });
    }

    const { inspectionId } = req.params;
    if (!inspectionId) {
      return res.status(400).json({ error: 'Inspection ID is required.' });
    }

    // 3. Retrieve authoritative inspection document from Firestore
    let inspection: Inspection | null = null;
    try {
      const docData = await getFirestoreDoc(`inspections/${inspectionId}`, token);
      if (docData) {
        inspection = {
          id: inspectionId,
          ...docData,
        } as Inspection;
      }
    } catch (fsErr: any) {
      console.warn(`Firestore read inspection error (${inspectionId}):`, fsErr?.message || fsErr);
    }

    // If Firestore doc not found, check if client provided validated snapshot in request body
    if (!inspection && req.body?.inspection && req.body.inspection.id === inspectionId) {
      inspection = req.body.inspection as Inspection;
    }

    if (!inspection) {
      return res.status(404).json({
        error: `Inspection with ID "${inspectionId}" was not found.`,
      });
    }

    // 4. Retrieve authoritative findings, actions, and photos
    let findings: Finding[] = [];
    let actions: Action[] = [];
    let photos: PhotoMetadata[] = [];

    // Attempt authoritative database retrieval using admin token
    try {
      findings = (await queryDocsByField('findings', 'inspectionId', inspectionId, token)) as Finding[];
    } catch (e) {
      console.warn('Could not query findings from Firestore REST API:', e);
    }

    try {
      actions = (await queryDocsByField('actions', 'inspectionId', inspectionId, token)) as Action[];
    } catch (e) {
      console.warn('Could not query actions from Firestore REST API:', e);
    }

    try {
      photos = (await queryDocsByField('photos', 'inspectionId', inspectionId, token)) as PhotoMetadata[];
    } catch (e) {
      console.warn('Could not query photos from Firestore REST API:', e);
    }

    // If client supplied latest UI state (e.g. newly edited in memory before reload),
    // merge carefully while enforcing relational consistency
    if (Array.isArray(req.body?.findings) && req.body.findings.length > 0) {
      const clientFindings = req.body.findings as Finding[];
      if (findings.length === 0 || clientFindings.length >= findings.length) {
        findings = clientFindings.filter((f) => !f.inspectionId || f.inspectionId === inspectionId);
      }
    }

    if (Array.isArray(req.body?.actions) && req.body.actions.length > 0) {
      const clientActions = req.body.actions as Action[];
      if (actions.length === 0 || clientActions.length >= actions.length) {
        actions = clientActions.filter((a) => !a.inspectionId || a.inspectionId === inspectionId);
      }
    }

    // Also query photos by each findingId if any photos were saved under findingId before inspectionId was finalized
    for (const f of findings) {
      if (!f.id) continue;
      try {
        const fPhotos = (await queryDocsByField('photos', 'findingId', f.id, token)) as PhotoMetadata[];
        for (const fp of fPhotos) {
          if (!photos.some((existing) => existing.id === fp.id)) {
            photos.push({ ...fp, inspectionId });
          }
        }
      } catch {
        // ignore
      }
    }

    // Merge client-supplied photos (which carry resolved inline base64 downloadUrls from local/IndexedDB cache)
    if (Array.isArray(req.body?.photos) && req.body.photos.length > 0) {
      const clientPhotos = req.body.photos as PhotoMetadata[];
      const mergedPhotosMap = new Map<string, PhotoMetadata>();
      for (const p of photos) {
        mergedPhotosMap.set(p.id, p);
      }
      for (const cp of clientPhotos) {
        if (!cp || !cp.id) continue;
        const existing = mergedPhotosMap.get(cp.id);
        mergedPhotosMap.set(cp.id, {
          ...existing,
          ...cp,
          inspectionId,
          downloadUrl: cp.downloadUrl || existing?.downloadUrl || '',
        });
      }
      photos = Array.from(mergedPhotosMap.values());
    }

    // Also ensure any action.evidencePhotoUrls are represented in photos
    for (const act of actions) {
      if (Array.isArray(act.evidencePhotoUrls) && act.evidencePhotoUrls.length > 0) {
        act.evidencePhotoUrls.forEach((url, idx) => {
          if (!url) return;
          const alreadyExists = photos.some(
            (p) =>
              (p.actionId === act.id || p.findingId === act.findingId) &&
              p.photoType === 'evidence' &&
              p.downloadUrl === url
          );
          if (!alreadyExists) {
            photos.push({
              id: `pho_ev_${act.id}_${idx}`,
              inspectionId,
              findingId: act.findingId,
              actionId: act.id,
              assignedToUserId: act.assignedToUserId,
              photoType: 'evidence',
              storagePath: `inspections/${inspectionId}/findings/${act.findingId}/actions/${act.id}/evidence/ev_${idx}.jpg`,
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

    // Sort findings by findingNumber ascending
    findings.sort((a, b) => (a.findingNumber || 0) - (b.findingNumber || 0));

    // 5. Relational Verification
    const validFindingIds = new Set(findings.map((f) => f.id));
    const validActionIds = new Set(actions.map((a) => a.id));

    const validatedPhotos = photos.filter((p) => {
      const belongsToInspection = p.inspectionId === inspectionId;
      const belongsToFinding = Boolean(p.findingId && validFindingIds.has(p.findingId));
      const belongsToAction = Boolean(p.actionId && validActionIds.has(p.actionId));
      return belongsToInspection || belongsToFinding || belongsToAction;
    });

    const reportData: ReportGenerationData = {
      inspection,
      findings,
      actions,
      photos: validatedPhotos,
      generatedAt: new Date().toISOString(),
      generatedByEmail: caller.email,
    };

    // 6. Generate PDF with embedded photographs
    const pdfBuffer = await generateInspectionPdf(reportData);

    // 7. Send PDF response with sanitized filename and proper headers
    const filename = sanitizeReportFilename(inspection.inspectionNumber);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('X-Embedded-Photos-Count', String(validatedPhotos.length));
    res.setHeader('Access-Control-Expose-Headers', 'X-Embedded-Photos-Count, Content-Disposition');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.status(200).send(pdfBuffer);
  } catch (err: any) {
    console.error('Report generation error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to generate inspection report PDF.',
    });
  }
}

/**
 * POST /api/reports/:inspectionId
 * Primary report generation endpoint.
 */
reportRouter.post('/:inspectionId', handleGenerateReport);

/**
 * GET /api/reports/:inspectionId
 * Secondary GET endpoint for direct preview with auth token.
 */
reportRouter.get('/:inspectionId', handleGenerateReport);

/**
 * POST /api/reports/:inspectionId/generate
 * Explicit alias endpoint.
 */
reportRouter.post('/:inspectionId/generate', handleGenerateReport);

// Re-export router aliases for full compatibility
export const router = reportRouter;
export default reportRouter;

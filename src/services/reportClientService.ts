import { auth, db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Inspection, Finding, Action, PhotoMetadata } from '../types/sheq';
import { apiUrl } from '../config/api';
import { getInspectionById } from './inspectionService';
import { getFindingsByInspectionId } from './findingService';
import { getPhotosForReport, ensureJpegDataUrl } from './photoService';

export interface GenerateReportOptions {
  inspection?: Inspection;
  findings?: Finding[];
  actions?: Action[];
  photos?: PhotoMetadata[];
}

/**
 * Sanitizes inspection number for consistent download naming.
 */
export function getReportDownloadFilename(inspectionNumber: string): string {
  const safe = (inspectionNumber || 'Report')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-');
  return `SHEQ-Inspection-${safe}.pdf`;
}

interface ParsedJpegImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/**
 * Parses JPEG dimensions and raw bytes from a data:image/jpeg;base64,... URL.
 */
async function parseJpegFromDataUrl(urlOrDataUrl: string): Promise<ParsedJpegImage | null> {
  try {
    const jpegDataUrl = await ensureJpegDataUrl(urlOrDataUrl);
    if (!jpegDataUrl || !jpegDataUrl.startsWith('data:image/')) return null;

    const commaIdx = jpegDataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    const base64 = jpegDataUrl.slice(commaIdx + 1);
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }

    // Parse SOF0/SOF2 marker from JPEG binary for exact width/height
    let width = 800;
    let height = 600;
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3
      ) {
        height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        break;
      }
      const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (len < 2) break;
      offset += 2 + len;
    }

    return {
      bytes,
      width: width > 0 ? width : 800,
      height: height > 0 ? height : 600,
    };
  } catch {
    return null;
  }
}

function pdfEscape(str: string): string {
  return (str || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapTextLines(text: string, maxCharsPerLine: number): string[] {
  const clean = (text || '').replace(/\r\n/g, '\n');
  const paragraphs = clean.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      if ((current + ' ' + words[i]).length <= maxCharsPerLine) {
        current += ' ' + words[i];
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

/**
 * Generates a complete, multi-page PDF binary on the client with embedded DCTDecode JPEG images.
 * Used as an automatic guarantee when the backend server is unreachable or running an older build.
 */
async function generateClientSideInspectionPdfBlob(
  inspection: Inspection,
  findings: Finding[],
  actions: Action[],
  photos: PhotoMetadata[]
): Promise<Blob> {
  const parsedImages = new Map<string, ParsedJpegImage>();
  for (const p of photos) {
    if (p.downloadUrl) {
      const parsed = await parseJpegFromDataUrl(p.downloadUrl);
      if (parsed) {
        parsedImages.set(p.id, parsed);
      }
    }
  }

  interface PageSpec {
    ops: string[];
    images: Array<{ name: string; jpeg: ParsedJpegImage }>;
  }

  const pages: PageSpec[] = [];
  let currentPage: PageSpec = { ops: [], images: [] };
  pages.push(currentPage);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  let cursorY = pageHeight - 40;

  const ensureRoom = (neededHeight: number) => {
    if (cursorY - neededHeight < 55) {
      currentPage = { ops: [], images: [] };
      pages.push(currentPage);
      cursorY = pageHeight - 40;
    }
  };

  const drawRect = (x: number, yTop: number, w: number, h: number, fillRgb: string, strokeRgb?: string) => {
    const yBottom = yTop - h;
    currentPage.ops.push(`q ${fillRgb} rg ${strokeRgb ? strokeRgb + ' RG 0.75 w ' : ''}${x.toFixed(2)} ${yBottom.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${strokeRgb ? 'B' : 'f'} Q`);
  };

  const drawText = (text: string, x: number, yTop: number, size = 10, bold = false, rgb = '0.06 0.09 0.16') => {
    const fontKey = bold ? '/F2' : '/F1';
    currentPage.ops.push(`BT ${fontKey} ${size} Tf ${rgb} rg 1 0 0 1 ${x.toFixed(2)} ${(yTop - size).toFixed(2)} Tm (${pdfEscape(text)}) Tj ET`);
  };

  // Header Banner
  drawRect(marginX, cursorY, contentWidth, 64, '0.06 0.09 0.16');
  drawText('SHEQ WORKPLACE INSPECTION REPORT', marginX + 16, cursorY - 14, 15, true, '1 1 1');
  drawText(
    `${inspection.inspectionNumber || 'INS-REPORT'}  |  Status: ${inspection.status}  |  Date: ${inspection.inspectionDate}`,
    marginX + 16,
    cursorY - 38,
    9.5,
    false,
    '0.98 0.75 0.14'
  );
  cursorY -= 76;

  // Inspection Metadata Box
  drawRect(marginX, cursorY, contentWidth, 68, '0.97 0.98 0.99', '0.80 0.84 0.88');
  drawText(`Title: ${inspection.title || 'Workplace Inspection'}`, marginX + 12, cursorY - 10, 10, true);
  drawText(
    `Department: ${inspection.departmentNameSnapshot || 'General'}    |    Inspector: ${inspection.inspectorNameSnapshot || 'Inspector'}`,
    marginX + 12,
    cursorY - 28,
    9,
    false,
    '0.20 0.25 0.33'
  );
  drawText(
    `Findings: ${findings.length}    |    Corrective Actions: ${actions.length}    |    Embedded Photographs: ${parsedImages.size}`,
    marginX + 12,
    cursorY - 46,
    9,
    true,
    '0.08 0.33 0.18'
  );
  cursorY -= 82;

  if (inspection.generalComments && inspection.generalComments.trim()) {
    const commentLines = wrapTextLines(`General Summary: ${inspection.generalComments.trim()}`, 92);
    ensureRoom(commentLines.length * 13 + 12);
    for (const line of commentLines) {
      drawText(line, marginX, cursorY, 9, false, '0.20 0.25 0.33');
      cursorY -= 13;
    }
    cursorY -= 8;
  }

  const renderedPhotoIds = new Set<string>();

  const embedPhotoList = (titleLabel: string, list: PhotoMetadata[]) => {
    ensureRoom(30);
    drawText(`${titleLabel} (${list.length})`, marginX, cursorY, 10, true, '0.06 0.09 0.16');
    cursorY -= 16;

    if (list.length === 0) {
      drawText('No photographs recorded in this section.', marginX + 8, cursorY, 8.5, false, '0.40 0.45 0.53');
      cursorY -= 16;
      return;
    }

    for (let idx = 0; idx < list.length; idx++) {
      const p = list[idx];
      renderedPhotoIds.add(p.id);
      const jpeg = parsedImages.get(p.id);
      if (jpeg) {
        const maxW = 420;
        const maxH = 210;
        const scale = Math.min(maxW / jpeg.width, maxH / jpeg.height, 1);
        const drawW = Math.round(jpeg.width * scale);
        const drawH = Math.round(jpeg.height * scale);

        ensureRoom(drawH + 38);
        const boxX = marginX + (contentWidth - drawW) / 2;
        const boxBottomY = cursorY - drawH;

        drawRect(boxX - 4, cursorY + 2, drawW + 8, drawH + 4, '0.97 0.98 0.99', '0.82 0.86 0.90');

        const imgName = `Im${currentPage.images.length + 1}`;
        currentPage.images.push({ name: imgName, jpeg });
        currentPage.ops.push(
          `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${boxX.toFixed(2)} ${boxBottomY.toFixed(2)} cm /${imgName} Do Q`
        );

        cursorY -= drawH + 8;
        const cap = p.caption?.trim() || `${titleLabel} #${idx + 1}`;
        drawText(
          `${cap} (${p.uploadedByNameSnapshot ? 'Uploaded by ' + p.uploadedByNameSnapshot : 'Recorded Photo'})`,
          marginX + 12,
          cursorY,
          8.5,
          true,
          '0.20 0.25 0.33'
        );
        cursorY -= 18;
      }
    }
  };

  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const act = actions.find((a) => a.findingId === f.id);
    ensureRoom(110);

    drawRect(marginX, cursorY, contentWidth, 26, '0.06 0.09 0.16');
    drawText(
      `FINDING #${f.findingNumber || i + 1}: ${f.title || 'Observation'}  [${(f.riskLevel || 'Medium').toUpperCase()} RISK]`,
      marginX + 10,
      cursorY - 7,
      10.5,
      true,
      '1 1 1'
    );
    cursorY -= 32;

    drawText(
      `Location: ${f.location || 'Not Specified'}  |  Assigned To: ${act?.assignedToUserNameSnapshot || f.assignedToUserNameSnapshot || 'Unassigned'}  |  Due: ${act?.dueDate || f.dueDate || 'N/A'}  |  Status: ${act?.status || f.status || 'Open'}`,
      marginX + 4,
      cursorY,
      8.5,
      true,
      '0.20 0.25 0.33'
    );
    cursorY -= 16;

    const descLines = wrapTextLines(`Observation: ${f.description || 'None provided.'}`, 92);
    for (const line of descLines) {
      ensureRoom(14);
      drawText(line, marginX + 4, cursorY, 9, false);
      cursorY -= 13;
    }

    const recLines = wrapTextLines(`Recommended Action: ${f.recommendedAction || 'None specified.'}`, 92);
    for (const line of recLines) {
      ensureRoom(14);
      drawText(line, marginX + 4, cursorY, 9, false);
      cursorY -= 13;
    }

    if (act?.actionerComments) {
      const actLines = wrapTextLines(`Actioner Notes: ${act.actionerComments}`, 92);
      for (const line of actLines) {
        ensureRoom(14);
        drawText(line, marginX + 4, cursorY, 8.5, false, '0.12 0.25 0.69');
        cursorY -= 13;
      }
    }

    cursorY -= 6;

    const fInspectionPhotos = photos.filter(
      (p) => p.findingId === f.id && p.photoType !== 'evidence'
    );
    const fEvidencePhotos = photos.filter(
      (p) =>
        (p.findingId === f.id || (act && p.actionId === act.id)) &&
        p.photoType === 'evidence'
    );

    embedPhotoList('Inspection Photographs', fInspectionPhotos);
    embedPhotoList('Corrective Action Evidence Photographs', fEvidencePhotos);
    cursorY -= 10;
  }

  const remainingPhotos = photos.filter((p) => !renderedPhotoIds.has(p.id));
  if (remainingPhotos.length > 0) {
    embedPhotoList('Additional Inspection Photographs', remainingPhotos);
  }

  // Assemble valid PDF 1.4 binary with embedded JPEG streams
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let byteOffset = 0;
  const offsets: number[] = [0];

  const pushBytes = (arr: Uint8Array) => {
    chunks.push(arr);
    byteOffset += arr.byteLength;
  };
  const pushStr = (s: string) => {
    pushBytes(encoder.encode(s));
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Object 1: Catalog, Object 2: Pages, Object 3: Font Helvetica, Object 4: Font Helvetica-Bold
  let nextObjId = 5;
  const pageObjIds: number[] = [];

  const pageBuilders: Array<() => void> = [];

  pages.forEach((p, pageIdx) => {
    // Add footer to each page
    const footerY = 28;
    p.ops.push(
      `BT /F1 8 Tf 0.40 0.45 0.53 rg 1 0 0 1 ${marginX} ${footerY} Tm (${pdfEscape(
        `SHEQ Inspection Report - ${inspection.inspectionNumber || inspection.id}   |   Page ${pageIdx + 1} of ${pages.length}`
      )}) Tj ET`
    );

    const pageObjId = nextObjId++;
    const contentObjId = nextObjId++;
    const imgEntries: Array<{ name: string; objId: number; jpeg: ParsedJpegImage }> = p.images.map((im) => ({
      name: im.name,
      objId: nextObjId++,
      jpeg: im.jpeg,
    }));

    pageObjIds.push(pageObjId);

    pageBuilders.push(() => {
      // Page Object
      offsets[pageObjId] = byteOffset;
      const xobjDict =
        imgEntries.length > 0
          ? `/XObject << ${imgEntries.map((im) => `/${im.name} ${im.objId} 0 R`).join(' ')} >>`
          : '';
      pushStr(
        `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(
          2
        )}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xobjDict} >> /Contents ${contentObjId} 0 R >>\nendobj\n`
      );

      // Content Stream Object
      const streamBytes = encoder.encode(p.ops.join('\n'));
      offsets[contentObjId] = byteOffset;
      pushStr(`${contentObjId} 0 obj\n<< /Length ${streamBytes.byteLength} >>\nstream\n`);
      pushBytes(streamBytes);
      pushStr('\nendstream\nendobj\n');

      // Image XObject Streams
      for (const im of imgEntries) {
        offsets[im.objId] = byteOffset;
        pushStr(
          `${im.objId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.jpeg.width} /Height ${im.jpeg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.bytes.byteLength} >>\nstream\n`
        );
        pushBytes(im.jpeg.bytes);
        pushStr('\nendstream\nendobj\n');
      }
    });
  });

  // Write Obj 1..4
  offsets[1] = byteOffset;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = byteOffset;
  pushStr(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>\nendobj\n`
  );

  offsets[3] = byteOffset;
  pushStr('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');

  offsets[4] = byteOffset;
  pushStr('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');

  for (const buildPage of pageBuilders) {
    buildPage();
  }

  const totalObjs = nextObjId;
  const xrefOffset = byteOffset;
  pushStr(`xref\n0 ${totalObjs}\n0000000000 65535 f \n`);
  for (let i = 1; i < totalObjs; i++) {
    const offStr = String(offsets[i] || 0).padStart(10, '0');
    pushStr(`${offStr} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: 'application/pdf' });
}

/**
 * Requests server-side PDF generation for an inspection, ensuring all inspection and
 * corrective action evidence photographs are loaded and converted to inline JPEG data URLs.
 * Automatically falls back to client-side PDF generation with embedded images if the server
 * is offline or running an older build that did not embed all photographs.
 */
export async function generateInspectionReportPdf(
  inspectionId: string,
  options?: GenerateReportOptions
): Promise<Blob> {
  if (!auth.currentUser) {
    throw new Error('Authentication required. You must be signed in as an administrator.');
  }

  // 1. Resolve authoritative inspection, findings, actions, and photos on the client first
  let inspection = options?.inspection || null;
  if (!inspection) {
    inspection = await getInspectionById(inspectionId);
  }

  let findings = options?.findings && options.findings.length > 0 ? options.findings : [];
  if (findings.length === 0) {
    try {
      findings = await getFindingsByInspectionId(inspectionId);
    } catch {
      // ignore
    }
  }

  let actions = options?.actions && options.actions.length > 0 ? options.actions : [];
  if (actions.length === 0) {
    try {
      const actSnap = await getDocs(
        query(collection(db, 'actions'), where('inspectionId', '==', inspectionId))
      );
      actions = actSnap.docs.map((d) => ({ ...(d.data() as Action), id: d.id }));
    } catch {
      // ignore
    }
  }

  // 2. Always retrieve and normalize ALL photos for this inspection, its findings, and its actions
  const retrievedPhotos = await getPhotosForReport(inspectionId, findings, actions);
  const photoMap = new Map<string, PhotoMetadata>();
  for (const p of retrievedPhotos) {
    photoMap.set(p.id, p);
  }
  if (Array.isArray(options?.photos)) {
    for (const cp of options.photos) {
      if (!cp || !cp.id) continue;
      const existing = photoMap.get(cp.id);
      const rawUrl = cp.downloadUrl || existing?.downloadUrl || '';
      const jpegUrl = rawUrl ? await ensureJpegDataUrl(rawUrl) : '';
      photoMap.set(cp.id, {
        ...existing,
        ...cp,
        inspectionId,
        downloadUrl: jpegUrl || rawUrl,
      });
    }
  }
  const allPhotos = Array.from(photoMap.values());

  const idToken = await auth.currentUser.getIdToken();

  try {
    const response = await fetch(apiUrl(`/api/reports/${encodeURIComponent(inspectionId)}`), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inspection,
        findings,
        actions,
        photos: allPhotos,
      }),
    });

    if (response.ok) {
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('application/pdf')) {
        const embeddedHeader = response.headers.get('X-Embedded-Photos-Count');
        const serverEmbeddedCount = embeddedHeader !== null ? parseInt(embeddedHeader, 10) : -1;

        // If there are photos to embed, verify the server response came from the updated PDF engine
        if (allPhotos.length === 0 || serverEmbeddedCount >= allPhotos.length) {
          return await response.blob();
        }
      }
    }
  } catch (netErr) {
    console.warn('Backend PDF report endpoint unreachable, using client-side PDF generator with embedded photos:', netErr);
  }

  // Fallback: If backend was unreachable or running an older build without inline photo embedding,
  // generate the PDF directly in the browser with all JPEG images embedded.
  if (inspection) {
    return await generateClientSideInspectionPdfBlob(inspection, findings, actions, allPhotos);
  }

  throw new Error('Unable to generate PDF report: Inspection record could not be loaded.');
}

/**
 * Triggers a browser download of the generated PDF Blob.
 */
export function downloadReportPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Clean up object URL after short delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 15000);
}

/**
 * Opens browser print dialog for the generated PDF Blob via hidden iframe.
 */
export function printReportPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn('Could not trigger automatic print from iframe:', e);
    }
    // Cleanup after printing dialog dismissed
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 60000);
  };

  document.body.appendChild(iframe);
}

import PDFDocument from 'pdfkit';
import { Inspection, Finding, Action, PhotoMetadata, RiskLevel, ActionStatus } from '../src/types/sheq';
import { downloadPhotoBuffer } from './supabaseStorage';

export interface ReportGenerationData {
  inspection: Inspection;
  findings: Finding[];
  actions: Action[];
  photos: PhotoMetadata[];
  generatedAt?: string;
  generatedByEmail?: string;
}

export interface EmbeddablePhoto {
  metadata: PhotoMetadata;
  buffer: Buffer | null;
  error?: string;
}

/**
 * Timezone-safe local date string YYYY-MM-DD.
 */
function getLocalTodayYMD(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if an action is overdue (strictly derived condition).
 * Completed and Closed actions are NEVER overdue.
 */
function isActionOverdue(dueDateStr?: string | null, status?: ActionStatus): boolean {
  if (!dueDateStr || status === 'Completed' || status === 'Closed') {
    return false;
  }
  const cleanDueDate = dueDateStr.substring(0, 10);
  const todayStr = getLocalTodayYMD();
  return cleanDueDate < todayStr;
}

/**
 * Calculates days overdue.
 */
function getDaysOverdue(dueDateStr?: string | null, status?: ActionStatus): number {
  if (!dueDateStr || status === 'Completed' || status === 'Closed') {
    return 0;
  }
  const cleanDueDate = dueDateStr.substring(0, 10);
  const todayStr = getLocalTodayYMD();
  if (cleanDueDate >= todayStr) return 0;

  const due = new Date(`${cleanDueDate}T00:00:00Z`).getTime();
  const today = new Date(`${todayStr}T00:00:00Z`).getTime();
  const diffDays = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Sanitizes inspection numbers for safe PDF filenames.
 */
export function sanitizeReportFilename(inspectionNumber: string): string {
  const safe = (inspectionNumber || 'Report')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-');
  return `SHEQ-Inspection-${safe}.pdf`;
}

/**
 * Formats ISO dates into clean human-readable text (e.g. 15 Sep 2026).
 */
function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Ensures enough vertical space remains on the current page;
 * if not, starts a fresh page with consistent margins.
 */
function ensureSpace(doc: PDFKit.PDFDocument, requiredHeight: number): void {
  const bottomMargin = doc.page.margins.bottom || 40;
  const pageHeight = doc.page.height;
  if (doc.y + requiredHeight > pageHeight - bottomMargin - 20) {
    doc.addPage();
  }
}

/**
 * Draws a rounded pill/badge for statuses and risk levels.
 */
function drawBadge(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  fillColor: string,
  textColor: string,
  borderColor: string,
  width = 80,
  height = 18
): void {
  doc.save();
  doc.roundedRect(x, y, width, height, 4)
    .fillAndStroke(fillColor, borderColor);
  doc.font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(textColor)
    .text(text, x, y + 4.5, { width, align: 'center' });
  doc.restore();
}

/**
 * Generates a complete, professional SHEQ Inspection Report PDF.
 */
export async function generateInspectionPdf(data: ReportGenerationData): Promise<Buffer> {
  const { inspection, findings = [], actions = [], photos = [] } = data;
  const reportGeneratedDate = data.generatedAt || new Date().toISOString();

  // 1. Download all associated photographs securely from inline base64 data URL, HTTP URL, or Supabase Storage
  const embeddedPhotos: EmbeddablePhoto[] = [];
  for (const photo of photos) {
    if ((photo as any).buffer && Buffer.isBuffer((photo as any).buffer)) {
      embeddedPhotos.push({ metadata: photo, buffer: (photo as any).buffer });
    } else if (photo.downloadUrl && photo.downloadUrl.startsWith('data:image/')) {
      try {
        const commaIdx = photo.downloadUrl.indexOf(',');
        const rawBase64 = commaIdx >= 0 ? photo.downloadUrl.slice(commaIdx + 1) : photo.downloadUrl;
        embeddedPhotos.push({ metadata: photo, buffer: Buffer.from(rawBase64, 'base64') });
      } catch {
        embeddedPhotos.push({
          metadata: photo,
          buffer: null,
          error: 'Inline photograph binary could not be decoded.',
        });
      }
    } else if (
      photo.downloadUrl &&
      (photo.downloadUrl.startsWith('https://') || photo.downloadUrl.startsWith('http://'))
    ) {
      try {
        const resp = await fetch(photo.downloadUrl);
        if (resp.ok) {
          const arrBuf = await resp.arrayBuffer();
          embeddedPhotos.push({ metadata: photo, buffer: Buffer.from(arrBuf) });
        } else {
          const res = photo.storagePath ? await downloadPhotoBuffer(photo.storagePath) : null;
          embeddedPhotos.push({
            metadata: photo,
            buffer: res?.buffer || null,
            error: res?.buffer ? undefined : 'Photograph binary could not be retrieved.',
          });
        }
      } catch {
        const res = photo.storagePath ? await downloadPhotoBuffer(photo.storagePath) : null;
        embeddedPhotos.push({
          metadata: photo,
          buffer: res?.buffer || null,
          error: res?.buffer ? undefined : 'Photograph binary could not be retrieved.',
        });
      }
    } else if (
      photo.storagePath &&
      !photo.storagePath.startsWith('offline/') &&
      !photo.storagePath.startsWith('firestore-inline/')
    ) {
      const res = await downloadPhotoBuffer(photo.storagePath);
      if (res?.buffer) {
        embeddedPhotos.push({ metadata: photo, buffer: res.buffer });
      } else {
        embeddedPhotos.push({
          metadata: photo,
          buffer: null,
          error: 'Photograph binary could not be retrieved from private storage.',
        });
      }
    } else {
      embeddedPhotos.push({
        metadata: photo,
        buffer: null,
        error: 'Missing storage path.',
      });
    }
  }

  return new Promise<Buffer>((resolve, reject) => {
    try {
      // Create A4 PDF Document with buffered pages for dynamic total page counting
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `SHEQ Inspection Report - ${inspection.inspectionNumber}`,
          Author: 'SHEQ Inspection Management System',
          Subject: inspection.title,
          CreationDate: new Date(),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const contentWidth = doc.page.width - 80; // 595.28 - 80 = 515.28

      // ==========================================
      // 1. REPORT HEADER (Page 1)
      // ==========================================
      const headerStartY = 40;

      // Header top bar with company logo clean placeholder area
      // Left: Title & System Identification
      doc.font('Helvetica-Bold')
        .fontSize(20)
        .fillColor('#0f172a')
        .text('SHEQ INSPECTION REPORT', 40, headerStartY);

      doc.font('Helvetica')
        .fontSize(9)
        .fillColor('#64748b')
        .text('Safety, Health, Environment & Quality Management System', 40, headerStartY + 24);

      // Right: Clean Logo Placeholder Frame (per specification: area for company logo, no fabricated branding)
      const logoBoxWidth = 140;
      const logoBoxHeight = 44;
      const logoBoxX = doc.page.width - 40 - logoBoxWidth;
      const logoBoxY = headerStartY;

      doc.save();
      doc.rect(logoBoxX, logoBoxY, logoBoxWidth, logoBoxHeight)
        .lineWidth(1)
        .dash(3, { space: 3 })
        .stroke('#cbd5e1');
      doc.font('Helvetica')
        .fontSize(8)
        .fillColor('#94a3b8')
        .text('[ COMPANY LOGO AREA ]', logoBoxX, logoBoxY + 16, { width: logoBoxWidth, align: 'center' });
      doc.restore();

      // Divider rule under top header
      const dividerY = headerStartY + 54;
      doc.strokeColor('#0f172a')
        .lineWidth(2)
        .moveTo(40, dividerY)
        .lineTo(doc.page.width - 40, dividerY)
        .stroke();

      doc.y = dividerY + 12;

      // Preliminary Draft Warning Banner (if inspection is still in Draft status)
      if (inspection.status === 'Draft') {
        doc.save();
        doc.roundedRect(40, doc.y, contentWidth, 22, 4)
          .fillAndStroke('#fffbeb', '#fcd34d');
        doc.font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor('#92400e')
          .text('PRELIMINARY DRAFT REPORT — WALKTHROUGH IN PROGRESS (NOT FINALIZED)', 40, doc.y + 6, {
            width: contentWidth,
            align: 'center',
          });
        doc.restore();
        doc.y += 28;
      }

      // ==========================================
      // 2. INSPECTION SUMMARY CARD
      // ==========================================
      const summaryStartY = doc.y;
      const summaryBoxHeight = 110;

      // Background Card
      doc.save();
      doc.roundedRect(40, summaryStartY, contentWidth, summaryBoxHeight, 6)
        .fillAndStroke('#f8fafc', '#e2e8f0');
      doc.restore();

      // Card Header
      doc.font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#1e293b')
        .text('INSPECTION SUMMARY', 52, summaryStartY + 10);

      // Status Pill on top right of card
      const statusPillColor = inspection.status === 'Completed'
        ? { fill: '#dcfce7', text: '#166534', border: '#86efac' }
        : { fill: '#fef3c7', text: '#92400e', border: '#fcd34d' };
      drawBadge(
        doc,
        inspection.status.toUpperCase(),
        doc.page.width - 40 - 90,
        summaryStartY + 8,
        statusPillColor.fill,
        statusPillColor.text,
        statusPillColor.border,
        80,
        18
      );

      // 3-Column Metadata
      const col1X = 52;
      const col2X = 210;
      const col3X = 380;
      const row1Y = summaryStartY + 32;
      const row2Y = summaryStartY + 58;
      const row3Y = summaryStartY + 84;

      // Row 1
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('INSPECTION NUMBER', col1X, row1Y);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(inspection.inspectionNumber || 'N/A', col1X, row1Y + 11);

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('INSPECTION DATE', col2X, row1Y);
      doc.font('Helvetica').fontSize(10).fillColor('#0f172a').text(formatDisplayDate(inspection.inspectionDate), col2X, row1Y + 11);

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('REPORT GENERATED', col3X, row1Y);
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(formatDisplayDate(reportGeneratedDate), col3X, row1Y + 11);

      // Row 2
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('DEPARTMENT', col1X, row2Y);
      doc.font('Helvetica').fontSize(10).fillColor('#0f172a').text(inspection.departmentNameSnapshot || 'Not Specified', col1X, row2Y + 11);

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('INSPECTOR', col2X, row2Y);
      doc.font('Helvetica').fontSize(10).fillColor('#0f172a').text(inspection.inspectorNameSnapshot || 'Not Specified', col2X, row2Y + 11);

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('FINDINGS COUNT', col3X, row2Y);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(String(findings.length), col3X, row2Y + 11);

      // Row 3: Title
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('INSPECTION TITLE', col1X, row3Y);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(inspection.title || 'Untitled Inspection', col1X, row3Y + 11, { width: contentWidth - 24 });

      doc.y = summaryStartY + summaryBoxHeight + 14;

      // General comments if available
      if (inspection.generalComments && inspection.generalComments.trim()) {
        ensureSpace(doc, 45);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155').text('GENERAL COMMENTS / OBSERVATIONS');
        doc.y += 3;
        doc.font('Helvetica').fontSize(9).fillColor('#1e293b').text(inspection.generalComments.trim(), {
          width: contentWidth,
          lineGap: 2,
        });
        doc.y += 10;
      }

      // ==========================================
      // 3. EXECUTIVE FINDINGS SUMMARY TABLE
      // ==========================================
      ensureSpace(doc, 70);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('FINDINGS & CORRECTIVE ACTIONS SUMMARY');
      doc.y += 6;

      const tableX = 40;
      const colW = { num: 28, title: 160, risk: 65, actioner: 105, dueDate: 75, status: 82 };
      const tableHeaderHeight = 22;

      // Table Header row
      doc.save();
      doc.rect(tableX, doc.y, contentWidth, tableHeaderHeight).fill('#1e293b');
      doc.restore();

      const thY = doc.y + 6;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      doc.text('#', tableX + 4, thY, { width: colW.num });
      doc.text('Finding Title', tableX + colW.num + 4, thY, { width: colW.title });
      doc.text('Risk', tableX + colW.num + colW.title + 4, thY, { width: colW.risk });
      doc.text('Actioner', tableX + colW.num + colW.title + colW.risk + 4, thY, { width: colW.actioner });
      doc.text('Due Date', tableX + colW.num + colW.title + colW.risk + colW.actioner + 4, thY, { width: colW.dueDate });
      doc.text('Status', tableX + colW.num + colW.title + colW.risk + colW.actioner + colW.dueDate + 4, thY, { width: colW.status });

      doc.y += tableHeaderHeight;

      if (findings.length === 0) {
        doc.rect(tableX, doc.y, contentWidth, 26).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#64748b').text('No findings recorded for this inspection.', tableX + 12, doc.y + 8);
        doc.y += 26;
      } else {
        // Render each finding summary row
        for (let idx = 0; idx < findings.length; idx++) {
          const f = findings[idx];
          const associatedAction = actions.find((a) => a.findingId === f.id) || null;
          const status = associatedAction?.status || f.status || 'Open';
          const dueDate = associatedAction?.dueDate || f.dueDate || '';
          const overdue = isActionOverdue(dueDate, status);
          const daysOverdue = overdue ? getDaysOverdue(dueDate, status) : 0;
          const actioner = associatedAction?.assignedToUserNameSnapshot || f.assignedToUserNameSnapshot || 'Unassigned';

          const rowHeight = 24;
          ensureSpace(doc, rowHeight + 10);

          const rowY = doc.y;
          const isOdd = idx % 2 === 1;

          doc.save();
          doc.rect(tableX, rowY, contentWidth, rowHeight)
            .fillAndStroke(isOdd ? '#f8fafc' : '#ffffff', '#e2e8f0');
          doc.restore();

          // Cells
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text(String(f.findingNumber || idx + 1), tableX + 4, rowY + 7, { width: colW.num });
          doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a').text(f.title || 'Untitled', tableX + colW.num + 4, rowY + 7, {
            width: colW.title - 8,
            ellipsis: true,
          });

          // Risk Text with color
          const riskColor = f.riskLevel === 'Critical' ? '#dc2626' : f.riskLevel === 'High' ? '#ea580c' : f.riskLevel === 'Medium' ? '#ca8a04' : '#16a34a';
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor(riskColor).text(f.riskLevel || 'Medium', tableX + colW.num + colW.title + 4, rowY + 7);

          doc.font('Helvetica').fontSize(8).fillColor('#334155').text(actioner, tableX + colW.num + colW.title + colW.risk + 4, rowY + 7, {
            width: colW.actioner - 8,
            ellipsis: true,
          });

          doc.font('Helvetica').fontSize(8).fillColor('#334155').text(formatDisplayDate(dueDate), tableX + colW.num + colW.title + colW.risk + colW.actioner + 4, rowY + 7);

          // Status cell
          if (overdue) {
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#dc2626').text(`OVERDUE (${daysOverdue}d)`, tableX + colW.num + colW.title + colW.risk + colW.actioner + colW.dueDate + 4, rowY + 7);
          } else {
            const statusTextColor = status === 'Closed' ? '#166534' : status === 'Completed' ? '#15803d' : status === 'In Progress' ? '#1d4ed8' : '#64748b';
            doc.font('Helvetica-Bold').fontSize(8).fillColor(statusTextColor).text(status, tableX + colW.num + colW.title + colW.risk + colW.actioner + colW.dueDate + 4, rowY + 7);
          }

          doc.y = rowY + rowHeight;
        }
      }

      doc.y += 16;

      // ==========================================
      // 4. DETAILED FINDINGS & PHOTOGRAPHS
      // ==========================================
      // Always start detailed findings on fresh page for pristine visual structure
      doc.addPage();

      const renderedPhotoIds = new Set<string>();

      for (let i = 0; i < findings.length; i++) {
        const f = findings[i];
        const associatedAction = actions.find((a) => a.findingId === f.id) || null;
        const currentStatus = associatedAction?.status || f.status || 'Open';
        const dueDate = associatedAction?.dueDate || f.dueDate || '';
        const overdue = isActionOverdue(dueDate, currentStatus);
        const daysOverdue = overdue ? getDaysOverdue(dueDate, currentStatus) : 0;
        const actionerName = associatedAction?.assignedToUserNameSnapshot || f.assignedToUserNameSnapshot || 'Unassigned';

        // Filter authorized photographs for this specific finding
        const findingInspectionPhotos = embeddedPhotos.filter(
          (p) => p.metadata.findingId === f.id && p.metadata.photoType !== 'evidence'
        );
        const findingEvidencePhotos = embeddedPhotos.filter(
          (p) =>
            (p.metadata.findingId === f.id ||
              (associatedAction && p.metadata.actionId === associatedAction.id)) &&
            p.metadata.photoType === 'evidence'
        );

        findingInspectionPhotos.forEach((p) => renderedPhotoIds.add(p.metadata.id));
        findingEvidencePhotos.forEach((p) => renderedPhotoIds.add(p.metadata.id));

        // Ensure reasonable space for finding header block
        ensureSpace(doc, 130);

        // Finding Header Banner
        const fHeaderY = doc.y;
        doc.save();
        doc.roundedRect(40, fHeaderY, contentWidth, 30, 4).fill('#0f172a');
        doc.restore();

        doc.font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#ffffff')
          .text(`FINDING #${f.findingNumber || i + 1}: ${f.title}`, 50, fHeaderY + 8, { width: contentWidth - 140, ellipsis: true });

        // Prominent Risk Badge on Right
        const riskBadgeConfig = {
          Critical: { fill: '#fee2e2', text: '#991b1b', border: '#ef4444' },
          High: { fill: '#ffedd5', text: '#9a3412', border: '#f97316' },
          Medium: { fill: '#fef9c3', text: '#854d0e', border: '#eab308' },
          Low: { fill: '#dcfce7', text: '#166534', border: '#22c55e' },
        }[f.riskLevel || 'Medium'];

        drawBadge(
          doc,
          `${(f.riskLevel || 'MEDIUM').toUpperCase()} RISK`,
          doc.page.width - 40 - 110,
          fHeaderY + 5,
          riskBadgeConfig.fill,
          riskBadgeConfig.text,
          riskBadgeConfig.border,
          100,
          20
        );

        doc.y = fHeaderY + 38;

        // Details Container Box
        const detailsStartY = doc.y;
        doc.save();
        doc.roundedRect(40, detailsStartY, contentWidth, 80, 4).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.restore();

        // 3-Column details
        const detCol1 = 52;
        const detCol2 = 210;
        const detCol3 = 370;

        // Row 1
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('LOCATION', detCol1, detailsStartY + 8);
        doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a').text(f.location || 'Not Specified', detCol1, detailsStartY + 19);

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('ASSIGNED ACTIONER', detCol2, detailsStartY + 8);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(actionerName, detCol2, detailsStartY + 19);

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('ACTION STATUS', detCol3, detailsStartY + 8);
        if (overdue) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#dc2626').text(`OVERDUE (${daysOverdue} Days Overdue)`, detCol3, detailsStartY + 19);
        } else {
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(currentStatus, detCol3, detailsStartY + 19);
        }

        // Row 2
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('DUE DATE', detCol1, detailsStartY + 42);
        doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a').text(formatDisplayDate(dueDate), detCol1, detailsStartY + 53);

        if (associatedAction?.completionDate) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('COMPLETED DATE', detCol2, detailsStartY + 42);
          doc.font('Helvetica').fontSize(9.5).fillColor('#15803d').text(formatDisplayDate(associatedAction.completionDate), detCol2, detailsStartY + 53);
        }

        if (associatedAction?.closedAt) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('CLOSED DATE & ADMIN', detCol3, detailsStartY + 42);
          const closedByStr = associatedAction.closedByUserId ? ` (by ${associatedAction.closedByUserId.substring(0, 8)})` : '';
          doc.font('Helvetica').fontSize(9).fillColor('#166534').text(`${formatDisplayDate(associatedAction.closedAt)}${closedByStr}`, detCol3, detailsStartY + 53);
        } else if (associatedAction?.verifiedAt) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('VERIFIED DATE & ADMIN', detCol3, detailsStartY + 42);
          const verifiedByStr = associatedAction.verifiedByUserId ? ` (by ${associatedAction.verifiedByUserId.substring(0, 8)})` : '';
          doc.font('Helvetica').fontSize(9).fillColor('#1e40af').text(`${formatDisplayDate(associatedAction.verifiedAt)}${verifiedByStr}`, detCol3, detailsStartY + 53);
        }

        doc.y = detailsStartY + 90;

        // Observation / Description
        ensureSpace(doc, 45);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155').text('OBSERVATION / DESCRIPTION:');
        doc.y += 2;
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(f.description || 'None provided.', {
          width: contentWidth,
          lineGap: 2,
        });
        doc.y += 8;

        // Recommended Corrective Action
        ensureSpace(doc, 45);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155').text('RECOMMENDED CORRECTIVE ACTION:');
        doc.y += 2;
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(f.recommendedAction || 'None specified.', {
          width: contentWidth,
          lineGap: 2,
        });
        doc.y += 8;

        // Inspector Comments (if any)
        if (f.inspectorComments && f.inspectorComments.trim()) {
          ensureSpace(doc, 35);
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text('INSPECTOR COMMENTS:');
          doc.y += 2;
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#334155').text(f.inspectorComments.trim(), {
            width: contentWidth,
            lineGap: 2,
          });
          doc.y += 8;
        }

        // Actioner Comments (if any)
        if (associatedAction?.actionerComments && associatedAction.actionerComments.trim()) {
          ensureSpace(doc, 35);
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e40af').text('ACTIONER COMMENTS:');
          doc.y += 2;
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#1e293b').text(associatedAction.actionerComments.trim(), {
            width: contentWidth,
            lineGap: 2,
          });
          doc.y += 8;
        }

        // ==========================================
        // 4A. INSPECTION PHOTOGRAPHS
        // ==========================================
        ensureSpace(doc, 30);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(`Inspection Photographs (${findingInspectionPhotos.length})`);
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2).stroke();
        doc.y += 8;

        if (findingInspectionPhotos.length === 0) {
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#64748b').text('No inspection photographs recorded for this finding.', 48, doc.y);
          doc.y += 14;
        } else {
          // Render photographs in clean grid/stacked layout
          for (let pIdx = 0; pIdx < findingInspectionPhotos.length; pIdx++) {
            const photoItem = findingInspectionPhotos[pIdx];
            const maxImgWidth = 440;
            const maxImgHeight = 220;

            // Ensure space for image + caption + padding
            ensureSpace(doc, maxImgHeight + 35);

            const imgBoxX = 40 + (contentWidth - maxImgWidth) / 2;
            const imgBoxY = doc.y;

            if (photoItem.buffer) {
              try {
                // Background frame
                doc.save();
                doc.rect(imgBoxX, imgBoxY, maxImgWidth, maxImgHeight)
                  .fillAndStroke('#f8fafc', '#e2e8f0');
                doc.restore();

                // Embed actual photograph binary
                doc.image(photoItem.buffer, imgBoxX + 5, imgBoxY + 5, {
                  fit: [maxImgWidth - 10, maxImgHeight - 10],
                  align: 'center',
                  valign: 'center',
                });

                doc.y = imgBoxY + maxImgHeight + 4;
              } catch (imgErr: any) {
                console.warn('PDFKit image embed error:', imgErr);
                // Draw fallback placeholder
                doc.save();
                doc.rect(imgBoxX, imgBoxY, maxImgWidth, 40)
                  .fillAndStroke('#fef2f2', '#f87171');
                doc.font('Helvetica-Bold')
                  .fontSize(8.5)
                  .fillColor('#991b1b')
                  .text(`[ Image rendering notice: Unable to process photograph data ]`, imgBoxX + 10, imgBoxY + 14);
                doc.restore();
                doc.y = imgBoxY + 44;
              }
            } else {
              // Missing photo placeholder
              doc.save();
              doc.rect(imgBoxX, imgBoxY, maxImgWidth, 40)
                .fillAndStroke('#fef2f2', '#f87171');
              doc.font('Helvetica-Bold')
                .fontSize(8.5)
                .fillColor('#991b1b')
                .text(`[ Photograph could not be retrieved from storage: ${photoItem.metadata.fileName || photoItem.metadata.id} ]`, imgBoxX + 10, imgBoxY + 14);
              doc.restore();
              doc.y = imgBoxY + 44;
            }

            // Caption and metadata
            const captionText = photoItem.metadata.caption?.trim() || `Inspection Photo #${pIdx + 1}`;
            const metaSubText = `Uploaded: ${formatDisplayDate(photoItem.metadata.createdAt)} ${photoItem.metadata.uploadedByNameSnapshot ? 'by ' + photoItem.metadata.uploadedByNameSnapshot : ''}`;
            
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155').text(captionText, 40, doc.y, { width: contentWidth, align: 'center' });
            doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(metaSubText, 40, doc.y + 1, { width: contentWidth, align: 'center' });
            doc.y += 12;
          }
        }

        // ==========================================
        // 4B. CORRECTIVE ACTION EVIDENCE PHOTOGRAPHS
        // ==========================================
        ensureSpace(doc, 30);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(`Corrective Action Evidence (${findingEvidencePhotos.length})`);
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2).stroke();
        doc.y += 8;

        if (findingEvidencePhotos.length === 0) {
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#64748b').text('No corrective action evidence photographs uploaded.', 48, doc.y);
          doc.y += 16;
        } else {
          for (let eIdx = 0; eIdx < findingEvidencePhotos.length; eIdx++) {
            const photoItem = findingEvidencePhotos[eIdx];
            const maxImgWidth = 440;
            const maxImgHeight = 220;

            ensureSpace(doc, maxImgHeight + 35);

            const imgBoxX = 40 + (contentWidth - maxImgWidth) / 2;
            const imgBoxY = doc.y;

            if (photoItem.buffer) {
              try {
                doc.save();
                doc.rect(imgBoxX, imgBoxY, maxImgWidth, maxImgHeight)
                  .fillAndStroke('#f0fdf4', '#86efac');
                doc.restore();

                doc.image(photoItem.buffer, imgBoxX + 5, imgBoxY + 5, {
                  fit: [maxImgWidth - 10, maxImgHeight - 10],
                  align: 'center',
                  valign: 'center',
                });

                doc.y = imgBoxY + maxImgHeight + 4;
              } catch (imgErr: any) {
                console.warn('PDFKit evidence embed error:', imgErr);
                doc.save();
                doc.rect(imgBoxX, imgBoxY, maxImgWidth, 40)
                  .fillAndStroke('#fef2f2', '#f87171');
                doc.font('Helvetica-Bold')
                  .fontSize(8.5)
                  .fillColor('#991b1b')
                  .text(`[ Evidence image rendering notice: Unable to process photograph data ]`, imgBoxX + 10, imgBoxY + 14);
                doc.restore();
                doc.y = imgBoxY + 44;
              }
            } else {
              doc.save();
              doc.rect(imgBoxX, imgBoxY, maxImgWidth, 40)
                .fillAndStroke('#fef2f2', '#f87171');
              doc.font('Helvetica-Bold')
                .fontSize(8.5)
                .fillColor('#991b1b')
                .text(`[ Evidence photo could not be retrieved from storage: ${photoItem.metadata.fileName || photoItem.metadata.id} ]`, imgBoxX + 10, imgBoxY + 14);
              doc.restore();
              doc.y = imgBoxY + 44;
            }

            const captionText = photoItem.metadata.caption?.trim() || `Corrective Action Evidence #${eIdx + 1}`;
            const metaSubText = `Uploaded: ${formatDisplayDate(photoItem.metadata.createdAt)} ${photoItem.metadata.uploadedByNameSnapshot ? 'by ' + photoItem.metadata.uploadedByNameSnapshot : ''}`;

            doc.font('Helvetica-Bold').fontSize(8).fillColor('#166534').text(captionText, 40, doc.y, { width: contentWidth, align: 'center' });
            doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(metaSubText, 40, doc.y + 1, { width: contentWidth, align: 'center' });
            doc.y += 14;
          }
        }

        // Space between findings or page break if not last
        if (i < findings.length - 1) {
          doc.addPage();
        }
      }

      // Render any additional inspection/evidence photographs that were not matched to a specific finding above
      const remainingPhotos = embeddedPhotos.filter((p) => !renderedPhotoIds.has(p.metadata.id));
      if (remainingPhotos.length > 0) {
        doc.addPage();
        doc.font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#0f172a')
          .text(`ADDITIONAL INSPECTION & EVIDENCE PHOTOGRAPHS (${remainingPhotos.length})`, 40, doc.y);
        doc.strokeColor('#cbd5e1')
          .lineWidth(1)
          .moveTo(40, doc.y + 4)
          .lineTo(doc.page.width - 40, doc.y + 4)
          .stroke();
        doc.y += 14;

        for (let rIdx = 0; rIdx < remainingPhotos.length; rIdx++) {
          const photoItem = remainingPhotos[rIdx];
          const maxImgWidth = 440;
          const maxImgHeight = 220;
          ensureSpace(doc, maxImgHeight + 35);

          const imgBoxX = 40 + (contentWidth - maxImgWidth) / 2;
          const imgBoxY = doc.y;

          if (photoItem.buffer) {
            try {
              doc.save();
              doc.rect(imgBoxX, imgBoxY, maxImgWidth, maxImgHeight).fillAndStroke('#f8fafc', '#e2e8f0');
              doc.restore();
              doc.image(photoItem.buffer, imgBoxX + 5, imgBoxY + 5, {
                fit: [maxImgWidth - 10, maxImgHeight - 10],
                align: 'center',
                valign: 'center',
              });
              doc.y = imgBoxY + maxImgHeight + 4;
            } catch {
              doc.y = imgBoxY + 20;
            }
          }
          const captionText = photoItem.metadata.caption?.trim() || `Inspection Photograph #${rIdx + 1}`;
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155').text(captionText, 40, doc.y, {
            width: contentWidth,
            align: 'center',
          });
          doc.y += 16;
        }
      }

      // ==========================================
      // 5. RUNTIME FOOTER & PAGE NUMBERING PASS
      // ==========================================
      const pageRange = doc.bufferedPageRange();
      for (let p = pageRange.start; p < pageRange.start + pageRange.count; p++) {
        doc.switchToPage(p);
        const footerY = doc.page.height - 30;

        // Subtle divider
        doc.save();
        doc.strokeColor('#cbd5e1')
          .lineWidth(0.75)
          .moveTo(40, footerY - 8)
          .lineTo(doc.page.width - 40, footerY - 8)
          .stroke();
        doc.restore();

        // Footer Left: SHEQ Inspection Report + Number
        const draftSuffix = inspection.status === 'Draft' ? ' [PRELIMINARY DRAFT]' : '';
        doc.font('Helvetica')
          .fontSize(8)
          .fillColor('#64748b')
          .text(`SHEQ Inspection Report - ${inspection.inspectionNumber || 'N/A'}${draftSuffix}`, 40, footerY);

        // Footer Center: Confidentiality Notice
        doc.font('Helvetica')
          .fontSize(7.5)
          .fillColor('#94a3b8')
          .text('Internal SHEQ Audit Document', 40, footerY, { width: contentWidth, align: 'center' });

        // Footer Right: Page X of Y
        const pageLabel = `Page ${p + 1} of ${pageRange.count}`;
        doc.font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#64748b')
          .text(pageLabel, doc.page.width - 40 - 100, footerY, { width: 100, align: 'right' });
      }

      // Finalize the PDF stream
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

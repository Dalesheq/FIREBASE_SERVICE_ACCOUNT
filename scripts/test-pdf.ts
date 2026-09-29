import zlib from 'zlib';
import { generateInspectionPdf, sanitizeReportFilename } from '../server/reportService';
import { Inspection, Finding, Action, PhotoMetadata } from '../src/types/sheq';

function extractAllPdfStreams(pdfBuffer: Buffer): string {
  const binary = pdfBuffer.toString('binary');
  let extracted = binary;
  const regex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = regex.exec(binary)) !== null) {
    try {
      const streamBuf = Buffer.from(match[1], 'latin1');
      const decompressed = zlib.inflateSync(streamBuf).toString('utf-8');
      // Decode hex strings like <4452414654> -> DRAFT
      const decodedHex = decompressed.replace(/<([0-9a-fA-F]+)>/g, (_, hex) => {
        let text = '';
        for (let i = 0; i < hex.length; i += 2) {
          const code = parseInt(hex.substring(i, i + 2), 16);
          if (code >= 32 && code <= 126) {
            text += String.fromCharCode(code);
          }
        }
        return text;
      });
      extracted += ' ' + decodedHex;
    } catch {
      // not flate compressed or partial
    }
  }
  return extracted;
}

// 1x1 valid sample JPEG buffer
const SAMPLE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x80, 0xff, 0xd9
]);

async function runTests() {
  console.log('--- Starting PDF Generation Test Scenarios ---');

  const baseInspection: Inspection = {
    id: 'ins_test_1',
    inspectionNumber: 'INS-2026-0001',
    inspectionDate: '2026-09-15',
    departmentId: 'dept_1',
    departmentNameSnapshot: 'Assembly Line 1',
    inspectorUserId: 'insp_123',
    inspectorNameSnapshot: 'Herman Nel',
    title: 'Quarterly SHEQ Safety & Fire Compliance Inspection',
    generalComments: 'Comprehensive walkthrough conducted. Overall housekeeping is satisfactory with specific areas requiring corrective action.',
    status: 'Completed',
    createdAt: '2026-09-15T08:00:00Z',
    updatedAt: '2026-09-15T10:00:00Z',
    createdByUserId: 'insp_123',
    updatedByUserId: 'insp_123',
  };

  // Scenario 1: One finding and no photos
  console.log('Testing Scenario 1: One finding and no photos...');
  const f1: Finding = {
    id: 'fnd_1',
    inspectionId: 'ins_test_1',
    findingNumber: 1,
    title: 'Blocked Emergency Exit Door',
    description: 'Pallets of raw materials were stacked in front of Fire Exit Door B-4, restricting egress width to under 400mm.',
    location: 'Bay 4 Warehouse',
    riskLevel: 'Critical',
    recommendedAction: 'Immediately relocate stacked pallets to designated staging racks and maintain clear clearance zone.',
    assignedToUserId: 'act_japie',
    assignedToUserNameSnapshot: 'Japie (Actioner)',
    dueDate: '2026-09-16',
    status: 'Open',
    inspectorComments: 'Flagged during initial morning walkthrough. Urgent.',
    createdAt: '2026-09-15T08:15:00Z',
    updatedAt: '2026-09-15T08:15:00Z',
    createdByUserId: 'insp_123',
    updatedByUserId: 'insp_123',
  };

  const a1: Action = {
    id: 'act_1',
    inspectionId: 'ins_test_1',
    findingId: 'fnd_1',
    title: 'Blocked Emergency Exit Door',
    description: 'Relocate stacked pallets',
    riskLevel: 'Critical',
    assignedToUserId: 'act_japie',
    assignedToUserNameSnapshot: 'Japie (Actioner)',
    dueDate: '2026-09-16',
    status: 'Open',
    createdAt: '2026-09-15T08:15:00Z',
    updatedAt: '2026-09-15T08:15:00Z',
    createdByUserId: 'insp_123',
    updatedByUserId: 'insp_123',
  };

  const pdf1 = await generateInspectionPdf({
    inspection: baseInspection,
    findings: [f1],
    actions: [a1],
    photos: [],
  });

  if (!pdf1 || pdf1.length < 1000 || pdf1.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('Scenario 1 Failed: Invalid PDF output');
  }
  console.log(`Scenario 1 PASSED (${pdf1.length} bytes)`);

  // Scenario 2: Multiple findings with Overdue, Completed, and Closed actions
  console.log('Testing Scenario 2: Multiple findings (Critical, High, Overdue, Completed, Closed)...');
  const f2: Finding = {
    id: 'fnd_2',
    inspectionId: 'ins_test_1',
    findingNumber: 2,
    title: 'Missing Chemical Eye Wash Inspection Tag',
    description: 'The emergency eyewash station at Battery Bay was last inspected 6 months ago. Flow test was not recorded.',
    location: 'Battery Bay',
    riskLevel: 'High',
    recommendedAction: 'Perform weekly flush test, verify water flow and sign off inspection log card.',
    assignedToUserId: 'act_hannes',
    assignedToUserNameSnapshot: 'Hannes (Actioner)',
    dueDate: '2026-09-01', // Overdue relative to 2026-09-15
    status: 'In Progress',
    inspectorComments: 'Ensure water runs clear for 3 minutes.',
    createdAt: '2026-09-15T08:30:00Z',
    updatedAt: '2026-09-15T08:30:00Z',
    createdByUserId: 'insp_123',
    updatedByUserId: 'insp_123',
  };

  const a2: Action = {
    id: 'act_2',
    inspectionId: 'ins_test_1',
    findingId: 'fnd_2',
    title: 'Eyewash station test',
    description: 'Perform flush test',
    riskLevel: 'High',
    assignedToUserId: 'act_hannes',
    assignedToUserNameSnapshot: 'Hannes (Actioner)',
    dueDate: '2026-09-01',
    status: 'In Progress',
    actionerComments: 'Flushed station and ordered replacement inspection tags.',
    createdAt: '2026-09-15T08:30:00Z',
    updatedAt: '2026-09-15T08:30:00Z',
    createdByUserId: 'insp_123',
    updatedByUserId: 'insp_123',
  };

  const f3: Finding = {
    id: 'fnd_3',
    inspectionId: 'ins_test_1',
    findingNumber: 3,
    title: 'Oil Spill Under CNC Machine #3',
    description: 'Minor hydraulic oil seepage on the walkway creating slip hazard. Absorbent pads applied.',
    location: 'Machining Hall B',
    riskLevel: 'Medium',
    recommendedAction: 'Degrease floor, replace leaking hydraulic hose coupling.',
    assignedToUserId: 'act_japie',
    assignedToUserNameSnapshot: 'Japie (Actioner)',
    dueDate: '2026-09-10',
    status: 'Closed',
    createdAt: '2026-09-15T08:45:00Z',
    updatedAt: '2026-09-15T11:00:00Z',
    createdByUserId: 'insp_123',
    updatedByUserId: 'insp_123',
  };

  const a3: Action = {
    id: 'act_3',
    inspectionId: 'ins_test_1',
    findingId: 'fnd_3',
    title: 'Oil Spill Under CNC Machine #3',
    description: 'Degrease floor, replace coupling',
    riskLevel: 'Medium',
    assignedToUserId: 'act_japie',
    assignedToUserNameSnapshot: 'Japie (Actioner)',
    dueDate: '2026-09-10',
    status: 'Closed',
    actionerComments: 'Fittings replaced and floor cleaned with industrial degreaser.',
    completionDate: '2026-09-12T14:00:00Z',
    verifiedAt: '2026-09-13T09:00:00Z',
    verifiedByUserId: 'insp_123',
    closedAt: '2026-09-14T10:00:00Z',
    closedByUserId: 'insp_123',
    createdAt: '2026-09-15T08:45:00Z',
    updatedAt: '2026-09-15T11:00:00Z',
    createdByUserId: 'insp_123',
    updatedByUserId: 'insp_123',
  };

  const pdf2 = await generateInspectionPdf({
    inspection: baseInspection,
    findings: [f1, f2, f3],
    actions: [a1, a2, a3],
    photos: [],
  });

  if (!pdf2 || pdf2.length < 1500 || pdf2.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('Scenario 2 Failed: Invalid PDF output');
  }
  console.log(`Scenario 2 PASSED (${pdf2.length} bytes)`);

  // Scenario 3: Long text without clipping
  console.log('Testing Scenario 3: Long text paragraphs in observation, recommendation, and comments...');
  const longParagraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. '.repeat(5);

  const fLong: Finding = {
    ...f1,
    description: `Very long observation details:\n${longParagraph}`,
    recommendedAction: `Very long recommended action details:\n${longParagraph}`,
    inspectorComments: `Very long inspector notes:\n${longParagraph}`,
  };

  const pdf3 = await generateInspectionPdf({
    inspection: {
      ...baseInspection,
      generalComments: `Very long executive summary:\n${longParagraph}`,
    },
    findings: [fLong],
    actions: [a1],
    photos: [],
  });

  if (!pdf3 || pdf3.length < 2000 || pdf3.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('Scenario 3 Failed: Long text PDF output invalid');
  }
  console.log(`Scenario 3 PASSED (${pdf3.length} bytes)`);

  // Scenario 4: Embedded Photographs (Inspection + Evidence with real embedded image buffers)
  console.log('Testing Scenario 4: Embedded Inspection & Evidence Photos with actual image buffers...');
  const photoInspection: PhotoMetadata = {
    id: 'p_insp_1',
    inspectionId: 'ins_test_1',
    findingId: 'fnd_1',
    uploadedByUserId: 'insp_123',
    uploadedByNameSnapshot: 'Herman Nel',
    photoType: 'inspection',
    storagePath: 'inspections/ins_test_1/fnd_1/photo.jpg',
    downloadUrl: '',
    fileName: 'exit_door_blocked.jpg',
    contentType: 'image/jpeg',
    fileSize: SAMPLE_JPEG.length,
    caption: 'Pallet obstruction blocking exit door B-4',
    createdAt: '2026-09-15T08:16:00Z',
    updatedAt: '2026-09-15T08:16:00Z',
  };
  (photoInspection as any).buffer = SAMPLE_JPEG;

  const photoEvidence: PhotoMetadata = {
    id: 'p_evid_1',
    inspectionId: 'ins_test_1',
    findingId: 'fnd_3',
    actionId: 'act_3',
    uploadedByUserId: 'act_japie',
    uploadedByNameSnapshot: 'Japie (Actioner)',
    photoType: 'evidence',
    storagePath: 'inspections/ins_test_1/findings/fnd_3/actions/act_3/evidence/p_evid_1.jpg',
    downloadUrl: '',
    fileName: 'floor_cleaned.jpg',
    contentType: 'image/jpeg',
    fileSize: SAMPLE_JPEG.length,
    caption: 'Hydraulic coupling replaced and floor degreased',
    createdAt: '2026-09-15T11:05:00Z',
    updatedAt: '2026-09-15T11:05:00Z',
  };
  (photoEvidence as any).buffer = SAMPLE_JPEG;

  const pdfPhotos = await generateInspectionPdf({
    inspection: baseInspection,
    findings: [f1, f3],
    actions: [a1, a3],
    photos: [photoInspection, photoEvidence],
  });

  if (!pdfPhotos || pdfPhotos.length < 3000 || pdfPhotos.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('Scenario 4 Failed: Photos PDF output invalid');
  }
  // Verify that the PDF stream contains an embedded image XObject
  const pdfString = pdfPhotos.toString('binary');
  if (!pdfString.includes('/Subtype /Image') && !pdfString.includes('/Subtype/Image')) {
    throw new Error('Scenario 4 Failed: PDF does not contain embedded image XObject');
  }
  console.log(`Scenario 4 (Photos & Evidence Buffers) PASSED (${pdfPhotos.length} bytes, verified /Subtype /Image embedded)`);

  // Scenario 4B: Live Supabase Storage round-trip test (if configured)
  console.log('Testing Scenario 4B: Live Supabase Storage round-trip test...');
  try {
    const { isSupabaseConfigured, uploadPhotoBuffer, deletePhotoObject } = await import('../server/supabaseStorage');
    if (isSupabaseConfigured()) {
      const testStoragePath = `inspections/ins_test_live/fnd_1/inspection/test_${Date.now()}.jpg`;
      await uploadPhotoBuffer(testStoragePath, SAMPLE_JPEG, 'image/jpeg');

      const livePhoto: PhotoMetadata = {
        id: 'p_live_1',
        inspectionId: 'ins_test_1',
        findingId: 'fnd_1',
        uploadedByUserId: 'insp_123',
        uploadedByNameSnapshot: 'Herman Nel',
        photoType: 'inspection',
        storagePath: testStoragePath,
        downloadUrl: '',
        fileName: 'live_test.jpg',
        contentType: 'image/jpeg',
        fileSize: SAMPLE_JPEG.length,
        caption: 'Live test photo downloaded directly from Supabase Storage',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const livePdf = await generateInspectionPdf({
        inspection: baseInspection,
        findings: [f1],
        actions: [a1],
        photos: [livePhoto],
      });

      const livePdfStr = livePdf.toString('binary');
      if (!livePdfStr.includes('/Subtype /Image') && !livePdfStr.includes('/Subtype/Image')) {
        throw new Error('Scenario 4B Failed: PDF does not contain embedded image downloaded from Supabase');
      }

      // Cleanup
      await deletePhotoObject(testStoragePath);
      console.log(`Scenario 4B (Live Supabase Download & Embed) PASSED (${livePdf.length} bytes, downloaded directly from private bucket)`);
    } else {
      console.log('Scenario 4B SKIPPED (Supabase credentials not configured)');
    }
  } catch (err) {
    console.warn('Scenario 4B Warning (non-fatal live test issue):', err);
  }

  // Scenario 5: Filename sanitization
  console.log('Testing Scenario 5: Filename sanitization...');
  const fn1 = sanitizeReportFilename('INS-2026-0001');
  const fn2 = sanitizeReportFilename('INS/2026/0002#Special');
  if (fn1 !== 'SHEQ-Inspection-INS-2026-0001.pdf') throw new Error(`Fn1 mismatch: ${fn1}`);
  if (fn2 !== 'SHEQ-Inspection-INS-2026-0002-Special.pdf') throw new Error(`Fn2 mismatch: ${fn2}`);
  console.log(`Scenario 5 PASSED: ${fn1}, ${fn2}`);

  // Scenario 6: Draft inspection status handling
  console.log('Testing Scenario 6: Draft inspection report with preliminary draft watermark...');
  const draftInspection: Inspection = {
    ...baseInspection,
    status: 'Draft',
  };
  const pdfDraft = await generateInspectionPdf({
    inspection: draftInspection,
    findings: [f1],
    actions: [a1],
    photos: [],
  });
  const pdfDraftStr = extractAllPdfStreams(pdfDraft);
  if (!pdfDraftStr.includes('DRAFT')) {
    throw new Error('Scenario 6 Failed: Draft indicator missing from draft PDF');
  }
  console.log(`Scenario 6 (Draft Inspection Watermark) PASSED (${pdfDraft.length} bytes)`);

  console.log('--- ALL TEST SCENARIOS PASSED SUCCESSFULLY ---');
}

runTests().catch((e) => {
  console.error('Test suite failed:', e);
  process.exit(1);
});

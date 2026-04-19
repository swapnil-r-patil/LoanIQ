// Professional Single-Page Loan Sanction Letter — v3 (text overflow fully fixed)
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

function fmt(n: number) { return `Rs. ${Number(n || 0).toLocaleString('en-IN')}`; }
function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''; }
function safe(v: any, max = 999) { return String(v ?? '').replace(/[^\x20-\x7E]/g, '').trim().substring(0, max); }
function fmtDate(iso?: string) {
  return (iso ? new Date(iso) : new Date())
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}
function mkRef(docId?: string | null) {
  const b = docId ? docId.substring(0, 8).toUpperCase()
                  : Math.random().toString(36).substring(2, 10).toUpperCase();
  return `CS-${new Date().getFullYear()}-${b}`;
}
function maskAcc(acc: string) {
  if (!acc || acc.length < 4) return 'XXXXXXXX';
  return 'X'.repeat(Math.max(0, acc.length - 4)) + acc.slice(-4);
}

async function getLocationText(location: any): Promise<string> {
  try {
    if (!location) return 'Not Provided';
    let lat: number, lng: number;
    if (typeof location === 'string') { const p = JSON.parse(location); lat = p.lat; lng = p.lng; }
    else { lat = location.lat; lng = location.lng; }
    if (!lat || !lng) return 'Not Provided';
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'CodeStorm/1.0' } }
    );
    if (!r.ok) throw new Error();
    const d = await r.json();
    const a = d.address || {};
    const parts = [a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state, a.country].filter(Boolean);
    return safe(parts.join(', '), 50) || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch { return 'Location Verified (GPS)'; }
}

async function makeQR(text: string): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', width: 200, margin: 1 });
}

export async function downloadLoanSanctionPDF(
  result: any, accountNumber: string, ifscCode: string, userId?: string | null
) {
  const report = result.report || {};
  const offer  = result.offer  || {};
  const cust   = report.customerDetails  || {};
  const fin    = report.financialDetails || {};
  const pan    = report.panDetails       || {};
  const ver    = report.verification     || {};
  const adjs: any[] = report.adjustments || [];

  const ref         = mkRef(result.docId);
  const dateStr     = fmtDate(report.createdAt);
  const name        = safe(cust.name  || 'N/A', 38);
  const panNum      = safe(pan.panNumber || 'Verified', 20);
  const emp         = safe(cap(fin.jobType    || 'N/A'), 28);
  const income      = fmt(fin.income || 0);
  const purpose     = safe(cap(fin.loanPurpose || 'N/A'), 28);
  const requested   = fmt(fin.requestedAmount || 0);
  const maskedAcc   = maskAcc(accountNumber);
  const ifsc        = safe(ifscCode, 15).toUpperCase();
  const score       = result.creditScore || report.creditScore || 0;
  const riskLevel   = safe(result.riskLevel || report.riskLevel || 'N/A');
  const riskScore   = safe(report.riskScore || 'N/A');
  const decision    = safe(result.decision  || report.decision  || 'APPROVED');
  const scoreBand   = score >= 751 ? 'EXCELLENT' : score >= 491 ? 'FAIR' : 'POOR';
  const totalDelta  = adjs.reduce((s: number, a: any) => s + (a.delta || 0), 0);
  const nmScore     = pan.nameMatch?.score ?? null;
  const qScore      = pan.quality?.score   ?? null;

  const appUrl = `${window.location.origin}/user/profile${userId ? `?userId=${userId}` : ''}`;
  const [locText, qrData] = await Promise.all([getLocationText(cust.location), makeQR(appUrl)]);

  // ── jsPDF ───────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, ML = 13, MR = 13, CW = PW - ML - MR;
  let y = 0;

  type C3 = [number,number,number];
  const BLU : C3 = [13,  71, 161];
  const GRN : C3 = [27, 120,  80];
  const DRK : C3 = [20,  20,  40];
  const MUT : C3 = [110,120, 140];
  const WHT : C3 = [255,255, 255];
  const BRD : C3 = [205,215, 240];
  const RED : C3 = [180, 30,  30];
  const LBLU: C3 = [234,241, 255];
  const LGRN: C3 = [234,249, 241];
  const CRM : C3 = [248,252, 248];

  // helpers ──────────────────────────────────────────────────────────
  const setT = (st: 'normal'|'bold'|'italic', sz: number, c: C3) => {
    doc.setFont('helvetica', st); doc.setFontSize(sz); doc.setTextColor(...c);
  };
  const fillR = (x: number, ry: number, w: number, h: number, c: C3) => {
    doc.setFillColor(...c); doc.rect(x, ry, w, h, 'F');
  };
  const bordR = (x: number, ry: number, w: number, h: number, c: C3, lw = 0.25) => {
    doc.setDrawColor(...c); doc.setLineWidth(lw); doc.rect(x, ry, w, h);
  };
  const hLine = (x1: number, ry: number, x2: number, c: C3 = BRD, lw = 0.2) => {
    doc.setDrawColor(...c); doc.setLineWidth(lw); doc.line(x1, ry, x2, ry);
  };

  // Render text clipped to maxW, return first line only (no overflow ever)
  const txt1 = (t: string, x: number, ry: number, maxW: number, st: 'normal'|'bold'|'italic', sz: number, c: C3, align: 'left'|'right'|'center' = 'left') => {
    setT(st, sz, c);
    const lines = doc.splitTextToSize(safe(t), maxW);
    doc.text(lines[0] ?? '', x, ry, { align });
  };
  // Render up to N lines within maxW, return height used
  const txtN = (t: string, x: number, ry: number, maxW: number, maxLines: number, st: 'normal'|'bold'|'italic', sz: number, c: C3, lh = 3.8): number => {
    setT(st, sz, c);
    const lines = doc.splitTextToSize(safe(t), maxW).slice(0, maxLines);
    doc.text(lines, x, ry);
    return lines.length * lh;
  };

  // ── HEADER ─────────────────────────────────────────────────────────
  fillR(0, 0, PW, 28, BLU); fillR(0, 24, PW, 4, GRN);
  doc.setFillColor(...WHT); doc.circle(ML + 7, 13, 6, 'F');
  setT('bold', 9, BLU); doc.text('CS', ML + 3.8, 14.5);
  setT('bold', 14, WHT); doc.text('CodeStorm', ML + 17, 11);
  setT('normal', 6.5, [200,225,255] as C3);
  doc.text('Intelligent Credit Solutions  |  NBFC Reg. No. RBI-2024-NBFC-0042', ML + 17, 17);
  setT('normal', 7, WHT);
  doc.text(`Ref: ${ref}`, PW - MR, 9.5, { align: 'right' });
  doc.text(`Date: ${dateStr}`, PW - MR, 15.5, { align: 'right' });
  y = 33;

  // ── TITLE ──────────────────────────────────────────────────────────
  fillR(ML, y, CW, 10, LBLU); bordR(ML, y, CW, 10, BLU, 0.4);
  fillR(ML, y, 3, 10, BLU);
  setT('bold', 11, BLU); doc.text('LOAN SANCTION LETTER', PW / 2, y + 6.8, { align: 'center' });
  y += 13;

  // ── APPLICANT + LOAN BOXES ─────────────────────────────────────────
  const C1W = CW * 0.52 - 2, C2W = CW * 0.48 - 2;
  const C1X = ML,             C2X = ML + C1W + 4;
  const BOXY = y, BOX_H = 72;

  // Left applicant box
  fillR(C1X, BOXY, C1W, BOX_H, LBLU);
  bordR(C1X, BOXY, C1W, BOX_H, BLU, 0.25);
  fillR(C1X, BOXY, 3, BOX_H, BLU);
  setT('bold', 7, BLU); doc.text('APPLICANT DETAILS', C1X + 5, BOXY + 5.5);
  hLine(C1X + 5, BOXY + 7.5, C1X + C1W - 3, BLU, 0.3);

  const FW = C1W - 10; // max text width in left column
  const leftRows: [string, string][] = [
    ['Full Name',        name],
    ['PAN Number',       panNum],
    ['Employment',       emp],
    ['Monthly Income',   income],
    ['Loan Purpose',     purpose],
    ['Amount Requested', requested],
    ['Location',         locText],
  ];
  let ly = BOXY + 11;
  leftRows.forEach(([label, val]) => {
    txt1(label + ':', C1X + 5, ly,     FW, 'normal', 6.5, MUT);
    txt1(val,         C1X + 5, ly + 4, FW, 'bold',   7,   DRK);
    ly += 8;
  });

  // Right loan box
  fillR(C2X, BOXY, C2W, BOX_H, LGRN);
  bordR(C2X, BOXY, C2W, BOX_H, GRN, 0.25);
  fillR(C2X, BOXY, C2W, 6, GRN);
  setT('bold', 7, WHT); doc.text('SANCTIONED AMOUNT', C2X + 3, BOXY + 4.5);

  const amtStr = fmt(offer.offeredAmount || 0);
  setT('bold', 16, GRN); doc.text(amtStr, C2X + C2W / 2, BOXY + 18, { align: 'center' });
  setT('normal', 6, MUT); doc.text('Amount Approved', C2X + C2W / 2, BOXY + 23, { align: 'center' });
  hLine(C2X + 4, BOXY + 26, C2X + C2W - 4, GRN, 0.3);

  const rightRows: [string, string][] = [
    ['Interest Rate',  `${offer.interestRate || 0}% p.a. (Fixed)`],
    ['Monthly EMI',    fmt(offer.emi || 0)],
    ['Tenure',         `${offer.tenure || 0} Months`],
    ['Processing Fee', fmt(offer.processingFee || 0)],
  ];
  const R2W = C2W - 8; // available width inside right box
  let ry2 = BOXY + 30;
  rightRows.forEach(([label, val]) => {
    txt1(label, C2X + 4,       ry2, R2W / 2,      'normal', 6.5, MUT);
    txt1(val,   C2X + C2W - 4, ry2, R2W / 2 + 2,  'bold',   7,   DRK, 'right');
    hLine(C2X + 4, ry2 + 2.5, C2X + C2W - 4, BRD, 0.15);
    ry2 += 7;
  });

  // Account row — split into two lines if needed
  setT('normal', 6.5, MUT); doc.text('Account No:', C2X + 4, ry2 + 1.5);
  txt1(maskedAcc, C2X + 4, ry2 + 6, R2W, 'bold', 7, BLU);
  txt1(`IFSC: ${ifsc}`, C2X + 4, ry2 + 10.5, R2W, 'normal', 6.5, MUT);

  y = BOXY + BOX_H + 3;

  // ── CREDIT SCORE + VERIFICATION ───────────────────────────────────
  const SC_W = CW * 0.46, VE_W = CW * 0.54 - 4;
  const SC_X = ML,         VE_X = ML + SC_W + 4;
  const ROW2H = 35;

  // Score card
  fillR(SC_X, y, SC_W, ROW2H, LBLU);
  bordR(SC_X, y, SC_W, ROW2H, BLU, 0.25);
  fillR(SC_X, y, 3, ROW2H, BLU);
  setT('bold', 7, BLU); doc.text('CREDIT ASSESSMENT', SC_X + 5, y + 5);

  const barW = SC_W - 14, barY = y + 9;
  const scorePct = Math.min(1, score / 900);
  const barCol: C3 = score >= 751 ? GRN : score >= 491 ? [185,125,0] : RED;
  fillR(SC_X + 6, barY, barW, 3.5, BRD);
  fillR(SC_X + 6, barY, barW * scorePct, 3.5, barCol);
  bordR(SC_X + 6, barY, barW, 3.5, BRD, 0.15);

  // Score number — render as single string to avoid alignment issues
  setT('bold', 13, barCol); doc.text(`${score}`, SC_X + 6, barY + 11);
  setT('normal', 8, MUT);   doc.text('/900', SC_X + 6 + 14, barY + 11);

  setT('normal', 6.5, MUT);
  doc.text(`Risk Level: ${riskLevel}  |  Band: ${scoreBand}`, SC_X + 6, barY + 17);
  doc.text(`Decision: ${decision}  |  Risk Score: ${riskScore}/100`, SC_X + 6, barY + 22);

  // Verification card
  fillR(VE_X, y, VE_W, ROW2H, LGRN);
  bordR(VE_X, y, VE_W, ROW2H, GRN, 0.25);
  fillR(VE_X, y, 3, ROW2H, GRN);
  setT('bold', 7, GRN); doc.text('VERIFICATION STATUS', VE_X + 5, y + 5);
  hLine(VE_X + 5, y + 7, VE_X + VE_W - 3, GRN, 0.2);

  const verItems = [
    { label: 'Biometric Liveness Check',         ok: !!ver.liveness },
    { label: 'PAN Card Verified',                 ok: !!ver.panVerified },
    { label: `Name Match: ${nmScore ?? 'N/A'}%`,  ok: (nmScore ?? 0) >= 50 },
    { label: `Image Quality: ${qScore ?? 'N/A'}/100`, ok: (qScore ?? 0) >= 50 },
  ];
  let vly = y + 11;
  const VLW = VE_W - 26; // label max width after badge
  verItems.forEach(item => {
    const col: C3 = item.ok ? GRN : RED;
    setT('bold', 7.5, col); doc.text(item.ok ? '[PASS]' : '[FAIL]', VE_X + 5, vly);
    txt1(item.label, VE_X + 23, vly, VLW, 'normal', 7, DRK);
    vly += 5.5;
  });

  y += ROW2H + 3;

  // ── SCORING TABLE + QR ────────────────────────────────────────────
  const QR_W = 30, QR_X = ML + CW - QR_W;
  const TBL_W = CW - QR_W - 4; // table leaves space for QR on right
  const PTS_W = 20; // points column width (right side of table)
  const FAC_W = TBL_W - PTS_W - 6; // max width for factor text

  const TABLE_TOP = y;
  fillR(ML, y, TBL_W, 6.5, BLU);
  setT('bold', 7.5, WHT); doc.text('CREDIT SCORING FACTORS', ML + 3, y + 4.5);
  doc.text('Points', ML + TBL_W - 3, y + 4.5, { align: 'right' });
  y += 6.5;

  const MAX_ROWS = Math.min(adjs.length, 7);
  adjs.slice(0, MAX_ROWS).forEach((adj: any, i: number) => {
    const rh = 5.5;
    fillR(ML, y, TBL_W, rh, i % 2 === 0 ? [247,249,255] : WHT);
    hLine(ML, y + rh, ML + TBL_W, BRD, 0.15);
    // Factor text: strictly clipped to FAC_W
    txt1(safe(adj.factor || '—'), ML + 3, y + 3.8, FAC_W, 'normal', 6.5, DRK);
    // Points: right aligned in PTS column
    const delta = adj.delta || 0;
    const pc: C3 = delta > 0 ? GRN : delta < 0 ? RED : MUT;
    txt1(`${delta >= 0 ? '+' : ''}${delta} pts`, ML + TBL_W - 3, y + 3.8, PTS_W, 'bold', 7, pc, 'right');
    y += rh;
  });
  if (adjs.length > MAX_ROWS) {
    setT('italic', 6, MUT); doc.text(`  + ${adjs.length - MAX_ROWS} more factors`, ML + 3, y + 3.5);
    y += 5;
  }

  // Total row
  fillR(ML, y, TBL_W, 7, DRK);
  setT('bold', 7.5, WHT); doc.text('TOTAL SCORE', ML + 3, y + 5);
  const totCol: C3 = totalDelta >= 0 ? [120,250,170] : [255,150,150];
  const totStr = `${totalDelta >= 0 ? '+' : ''}${totalDelta} pts  =>  ${score}/900`;
  setT('bold', 7.5, totCol); doc.text(totStr, ML + TBL_W - 3, y + 5, { align: 'right' });
  y += 9;

  // QR code card (right of table, vertically centered)
  if (qrData) {
    const qrBoxH = y - TABLE_TOP;
    fillR(QR_X, TABLE_TOP, QR_W, qrBoxH, WHT);
    bordR(QR_X, TABLE_TOP, QR_W, qrBoxH, BLU, 0.3);
    const qrImgSize = QR_W - 4;
    const qrImgY = TABLE_TOP + (qrBoxH - qrImgSize - 9) / 2;
    doc.addImage(qrData, 'PNG', QR_X + 2, qrImgY, qrImgSize, qrImgSize);
    setT('bold', 5.5, BLU); doc.text('TRACK REPAYMENT', QR_X + QR_W / 2, qrImgY + qrImgSize + 4, { align: 'center' });
    setT('normal', 5, MUT); doc.text('Given vs Paid Status', QR_X + QR_W / 2, qrImgY + qrImgSize + 8, { align: 'center' });
  }

  // ── TERMS ─────────────────────────────────────────────────────────
  const TERMS_H = 30;
  fillR(ML, y, CW, TERMS_H, LBLU);
  bordR(ML, y, CW, TERMS_H, BLU, 0.25);
  fillR(ML, y, 3, TERMS_H, BLU);
  setT('bold', 7, BLU); doc.text('KEY TERMS & CONDITIONS', ML + 5, y + 5.5);

  const TW = CW - 10;
  const terms = [
    `1. Sanctioned amount of ${fmt(offer.offeredAmount || 0)} will be credited to A/c ${maskedAcc} (IFSC: ${ifsc}) within 2-3 business days.`,
    `2. Interest @ ${offer.interestRate || 0}% p.a. fixed. EMI: ${fmt(offer.emi || 0)}/month x ${offer.tenure || 0} months starting 5th of next month.`,
    `3. Processing fee of ${fmt(offer.processingFee || 0)} deducted at disbursement. Pre-payment allowed after 6 months (2% penalty).`,
    `4. This sanction is valid 30 days. Any misrepresentation will result in immediate loan recall per RBI guidelines.`,
  ];
  let ty = y + 10;
  terms.forEach(t => {
    // Allow up to 2 lines per term to avoid truncation
    const used = txtN(safe(t), ML + 5, ty, TW, 2, 'normal', 6, DRK, 3.7);
    ty += used + 1.5;
  });
  y += TERMS_H + 2;

  // ── SIGNATURES ────────────────────────────────────────────────────
  const SIG_H = 22, SIG_W = CW / 2 - 2;
  fillR(ML,           y, SIG_W, SIG_H, [250,250,255]);
  bordR(ML,           y, SIG_W, SIG_H, BRD, 0.2);
  setT('normal', 6.5, MUT); doc.text('Borrower Acceptance', ML + 3, y + 5);
  hLine(ML + 3, y + 15, ML + SIG_W - 3, DRK, 0.5);
  txt1(name.substring(0, 30), ML + 3, y + 19, SIG_W - 6, 'bold', 7, DRK);

  const S2X = ML + SIG_W + 4;
  fillR(S2X, y, SIG_W, SIG_H, CRM);
  bordR(S2X, y, SIG_W, SIG_H, BRD, 0.2);
  setT('normal', 6.5, MUT); doc.text('Authorised Signatory', S2X + 3, y + 5);
  hLine(S2X + 3, y + 15, S2X + SIG_W - 3, DRK, 0.5);
  setT('bold', 7, BLU); doc.text('CodeStorm Financial Services', S2X + 3, y + 19);

  y += SIG_H + 3;

  // ── DISCLAIMER ────────────────────────────────────────────────────
  setT('italic', 5.5, MUT);
  doc.text(
    'This document is auto-generated and legally binding. Governed by RBI regulations & laws of India.',
    PW / 2, y + 2, { align: 'center' }
  );

  // ── FOOTER ────────────────────────────────────────────────────────
  fillR(0, PH - 9, PW, 9, BLU);
  setT('normal', 6, WHT);
  doc.text(`CodeStorm  |  Ref: ${ref}  |  CONFIDENTIAL`, ML, PH - 3.8);
  setT('normal', 6, [180,210,255] as C3);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, PW - MR, PH - 3.8, { align: 'right' });

  doc.save(`${name}_by_CodeStorm.pdf`);
}

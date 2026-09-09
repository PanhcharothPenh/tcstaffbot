import { jsPDF } from 'jspdf';
import { RevenueRecord } from '../types';

let cachedFontBase64: string | null = null;
const FONT_URL = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansKhmer/NotoSansKhmer-Regular.ttf';

/**
 * Downloads and caches the Noto Sans Khmer regular TrueType font.
 */
async function loadKhmerFont(): Promise<string> {
  if (cachedFontBase64) {
    return cachedFontBase64;
  }

  try {
    console.log('[RevenuePdfService] Loading Noto Sans Khmer font from CDN...');
    const response = await fetch(FONT_URL);
    if (!response.ok) {
      throw new Error(`Failed to load Khmer font from CDN: HTTP ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    cachedFontBase64 = buffer.toString('base64');
    console.log('[RevenuePdfService] Khmer font loaded and cached successfully.');
    return cachedFontBase64;
  } catch (err: any) {
    console.error('[RevenuePdfService] Font loading error:', err);
    throw err;
  }
}

/**
 * Formats a number as KHR (e.g. 1,000,000 ៛)
 */
function formatKHR(val: number): string {
  return `${Math.round(val).toLocaleString('en-US')} ៛`;
}

/**
 * Formats a date string (YYYY-MM-DD) as DD (DayOfWeek)
 */
function getFormattedDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayIndex = d.getDay();
    const dayNum = String(d.getDate()).padStart(2, '0');
    return `${dayNum} (${days[dayIndex]})`;
  } catch (e) {
    return dateStr;
  }
}

interface GenerateParams {
  branchId: string;
  branchName: string;
  month: number;
  year: number;
  records: RevenueRecord[];
  generatedBy: string;
  generatedDateStr: string;
  isBlankTemplate?: boolean;
}

export async function generateRevenuePdf({
  branchId,
  branchName,
  month,
  year,
  records,
  generatedBy,
  generatedDateStr,
  isBlankTemplate = false
}: GenerateParams): Promise<Buffer> {
  const fileBytesBase64 = await loadKhmerFont();

  // Create A4 Portrait jsPDF instance
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Register and set custom font to support Khmer letters and Unicode
  pdf.addFileToVFS('NotoSansKhmer.ttf', fileBytesBase64);
  pdf.addFont('NotoSansKhmer.ttf', 'NotoSansKhmer', 'normal');
  pdf.setFont('NotoSansKhmer', 'normal');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[month - 1];
  const monthString = String(month).padStart(2, '0');

  // Let's compute totals
  let totalCashRev = 0;
  let totalAbaRev = 0;
  let totalCoinSales = 0;
  let totalRevenue = 0;

  for (const r of records) {
    const cash = (r.endCounter || 0) - (r.startCounter || 0);
    const aba = (r.endCounterAba || 0) - (r.startCounterAba || 0);
    const coin = r.coinSales || 0;
    totalCashRev += cash;
    totalAbaRev += aba;
    totalCoinSales += coin;
    totalRevenue += (cash + aba + coin);
  }

  // Pre-calculate page-layout configurations
  const pageHeight = 297;
  const marginX = 15;
  const startTableY = 62;
  const maxTableHeight = 210; // Page height cap before wrapping

  // Layout Columns width config (Total width: 180mm)
  const colWidths = {
    date: 15,
    time: 11,
    startCash: 16,
    endCash: 16,
    startAba: 16,
    endAba: 16,
    cashRev: 16,
    abaRev: 16,
    coinSales: 16,
    totalRev: 18,
    notes: 24
  };

  const colX = {
    date: marginX,
    time: marginX + colWidths.date,
    startCash: marginX + colWidths.date + colWidths.time,
    endCash: marginX + colWidths.date + colWidths.time + colWidths.startCash,
    startAba: marginX + colWidths.date + colWidths.time + colWidths.startCash + colWidths.endCash,
    endAba: marginX + colWidths.date + colWidths.time + colWidths.startCash + colWidths.endCash + colWidths.startAba,
    cashRev: marginX + colWidths.date + colWidths.time + colWidths.startCash + colWidths.endCash + colWidths.startAba + colWidths.endAba,
    abaRev: marginX + colWidths.date + colWidths.time + colWidths.startCash + colWidths.endCash + colWidths.startAba + colWidths.endAba + colWidths.cashRev,
    coinSales: marginX + colWidths.date + colWidths.time + colWidths.startCash + colWidths.endCash + colWidths.startAba + colWidths.endAba + colWidths.cashRev + colWidths.abaRev,
    totalRev: marginX + colWidths.date + colWidths.time + colWidths.startCash + colWidths.endCash + colWidths.startAba + colWidths.endAba + colWidths.cashRev + colWidths.abaRev + colWidths.coinSales,
    notes: marginX + colWidths.date + colWidths.time + colWidths.startCash + colWidths.endCash + colWidths.startAba + colWidths.endAba + colWidths.cashRev + colWidths.abaRev + colWidths.coinSales + colWidths.totalRev
  };

  let pageNum = 1;

  // Header Draw Function
  const drawPageHeaders = (p: jsPDF, page: number) => {
    // 1. Corporate logo drawn as simple geometric elements to guarantee no crashes
    p.setFillColor('#00B2B2'); // Corporate Teal
    p.roundedRect(marginX, 15, 12, 12, 2, 2, 'F');
    p.setFillColor('#FFFFFF');
    p.circle(marginX + 6, 21, 3.5, 'F');
    p.setFillColor('#00B2B2');
    p.circle(marginX + 6, 21, 1.5, 'F');

    // Wordmark
    p.setFontSize(20);
    p.setTextColor('#00B2B1');
    p.setFont('NotoSansKhmer', 'normal');
    p.text('CLEAN24', marginX + 15, 23.5);

    // Right header block (Branch & Month specifications)
    p.setFontSize(10);
    p.setTextColor('#334155');
    p.text('Official Monthly Audit Report', 195, 19, { align: 'right' });
    p.setFontSize(11);
    p.setTextColor('#0F172A');
    p.text(`Branch: ${branchName}`, 195, 24, { align: 'right' });
    p.text(`Period: ${monthName} ${year}`, 195, 29, { align: 'right' });

    // Header division rule
    p.setDrawColor('#e2e8f0');
    p.setLineWidth(0.5);
    p.line(marginX, 33, 195, 33);

    // 2. Report Main Title Label
    p.setFontSize(13);
    p.setTextColor('#0F172A');
    p.text(isBlankTemplate ? 'MONTHLY REVENUE STATEMENT (BLANK FORM)' : 'MONTHLY REVENUE STATEMENT', 105, 41, { align: 'center' });
    p.setFontSize(10);
    p.setTextColor('#475569');
    p.text(isBlankTemplate 
      ? `Blank ledger template for handwriting records (${monthName} ${year})`
      : `Reconciled revenue records for the full reporting month of ${monthName} ${year}`, 
      105, 46, { align: 'center' });

    // 3. Grid Table Headers
    const headerY = 52;
    p.setFillColor('#0891b2'); // Dark Cyan / Teal
    p.rect(marginX, headerY, 180, 8, 'F');
    p.setFontSize(6.5);
    p.setTextColor('#FFFFFF');

    p.text('Date', colX.date + colWidths.date / 2, headerY + 5.5, { align: 'center' });
    p.text('Time', colX.time + colWidths.time / 2, headerY + 5.5, { align: 'center' });
    p.text('Cash Start', colX.startCash + colWidths.startCash / 2, headerY + 5.5, { align: 'center' });
    p.text('Cash End', colX.endCash + colWidths.endCash / 2, headerY + 5.5, { align: 'center' });
    p.text('ABA Start', colX.startAba + colWidths.startAba / 2, headerY + 5.5, { align: 'center' });
    p.text('ABA End', colX.endAba + colWidths.endAba / 2, headerY + 5.5, { align: 'center' });
    p.text('Cash Rev', colX.cashRev + colWidths.cashRev / 2, headerY + 5.5, { align: 'center' });
    p.text('ABA Rev', colX.abaRev + colWidths.abaRev / 2, headerY + 5.5, { align: 'center' });
    p.text('Coin Sales', colX.coinSales + colWidths.coinSales / 2, headerY + 5.5, { align: 'center' });
    p.text('Daily Rev', colX.totalRev + colWidths.totalRev / 2, headerY + 5.5, { align: 'center' });
    p.text('Notes', colX.notes + 2, headerY + 5.5, { align: 'left' });
  };

  // Helper to draw clean borders
  const drawRowBorders = (p: jsPDF, y: number, h: number) => {
    p.setDrawColor('#cbd5e1'); // light gray thin lines
    p.setLineWidth(0.15);
    // Draw cells separations
    p.line(colX.date, y, colX.date, y + h);
    p.line(colX.time, y, colX.time, y + h);
    p.line(colX.startCash, y, colX.startCash, y + h);
    p.line(colX.endCash, y, colX.endCash, y + h);
    p.line(colX.startAba, y, colX.startAba, y + h);
    p.line(colX.endAba, y, colX.endAba, y + h);
    p.line(colX.cashRev, y, colX.cashRev, y + h);
    p.line(colX.abaRev, y, colX.abaRev, y + h);
    p.line(colX.coinSales, y, colX.coinSales, y + h);
    p.line(colX.totalRev, y, colX.totalRev, y + h);
    p.line(colX.notes, y, colX.notes, y + h);
    p.line(195, y, 195, y + h);
    // Draw row bottom line
    p.line(marginX, y + h, 195, y + h);
  };

  // Initialize page 1
  drawPageHeaders(pdf, pageNum);

  let currentY = startTableY;
  const baseRowHeight = 7.5;
  const cellPadding = 1.8;

  for (let idx = 0; idx < records.length; idx++) {
    const r = records[idx];
    const notesStr = r.note || '';

    // Wrapping notes text
    const noteLines = pdf.splitTextToSize(notesStr, colWidths.notes - 4) as string[];
    const neededCellHeight = Math.max(baseRowHeight, noteLines.length * 4.5 + cellPadding * 2);

    // Page overflow safety wrap check
    if (currentY + neededCellHeight > maxTableHeight + 25) {
      // Create new page
      pdf.addPage();
      pageNum++;
      drawPageHeaders(pdf, pageNum);
      currentY = startTableY;
    }

    // Row zebra stripes coloring
    if (idx % 2 === 1) {
      pdf.setFillColor('#f8fafc'); // clean cool soft-gray background
      pdf.rect(marginX, currentY, 180, neededCellHeight, 'F');
    }

    // Print text values in cells
    pdf.setFontSize(6.5);
    pdf.setTextColor('#0F172A');

    // 1. Date label
    const dateLabel = getFormattedDate(r.date);
    pdf.text(dateLabel, colX.date + colWidths.date / 2, currentY + (neededCellHeight / 2) + 1.2, { align: 'center' });

    // 2. Time label
    const timeValue = isBlankTemplate ? '' : (r.time || '10:30');
    if (timeValue) {
      pdf.text(timeValue, colX.time + colWidths.time / 2, currentY + (neededCellHeight / 2) + 1.2, { align: 'center' });
    }

    if (!isBlankTemplate) {
      // 3. Cash Start Counter
      const startStr = r.startCounter !== undefined && r.startCounter !== null ? Math.round(r.startCounter).toLocaleString('en-US') : '0';
      pdf.text(startStr, colX.startCash + colWidths.startCash - 1.5, currentY + (neededCellHeight / 2) + 1.2, { align: 'right' });

      // 4. Cash End Counter
      const endStr = r.endCounter !== undefined && r.endCounter !== null ? Math.round(r.endCounter).toLocaleString('en-US') : '0';
      pdf.text(endStr, colX.endCash + colWidths.endCash - 1.5, currentY + (neededCellHeight / 2) + 1.2, { align: 'right' });

      // 5. ABA Start Counter
      const startAbaStr = r.startCounterAba !== undefined && r.startCounterAba !== null ? Math.round(r.startCounterAba).toLocaleString('en-US') : '0';
      pdf.text(startAbaStr, colX.startAba + colWidths.startAba - 1.5, currentY + (neededCellHeight / 2) + 1.2, { align: 'right' });

      // 6. ABA End Counter
      const endAbaStr = r.endCounterAba !== undefined && r.endCounterAba !== null ? Math.round(r.endCounterAba).toLocaleString('en-US') : '0';
      pdf.text(endAbaStr, colX.endAba + colWidths.endAba - 1.5, currentY + (neededCellHeight / 2) + 1.2, { align: 'right' });

      // 7. Cash Revenue
      const cashRevVal = (r.endCounter || 0) - (r.startCounter || 0);
      if (cashRevVal < 0) {
        pdf.setTextColor('#b91c1c');
      }
      pdf.text(formatKHR(cashRevVal), colX.cashRev + colWidths.cashRev - 1.5, currentY + (neededCellHeight / 2) + 1.2, { align: 'right' });
      pdf.setTextColor('#0F172A');

      // 8. ABA Revenue
      const abaRevVal = (r.endCounterAba || 0) - (r.startCounterAba || 0);
      if (abaRevVal < 0) {
        pdf.setTextColor('#b91c1c');
      }
      pdf.text(formatKHR(abaRevVal), colX.abaRev + colWidths.abaRev - 1.5, currentY + (neededCellHeight / 2) + 1.2, { align: 'right' });
      pdf.setTextColor('#0F172A');

      // 9. Coin Sales
      const coinSalesVal = r.coinSales || 0;
      pdf.text(coinSalesVal > 0 ? formatKHR(coinSalesVal) : '-', colX.coinSales + colWidths.coinSales - 1.5, currentY + (neededCellHeight / 2) + 1.2, { align: 'right' });

      // 10. Daily Revenue value
      const dayTotalRev = cashRevVal + abaRevVal + coinSalesVal;
      pdf.text(formatKHR(dayTotalRev), colX.totalRev + colWidths.totalRev - 1.5, currentY + (neededCellHeight / 2) + 1.2, { align: 'right' });

      // 11. Wrap notes text (now at the end)
      pdf.setTextColor('#475569');
      let lineY = currentY + cellPadding + 3;
      for (const line of noteLines) {
        pdf.text(line, colX.notes + 2, lineY);
        lineY += 4.5;
      }
    }

    // Draw borders
    drawRowBorders(pdf, currentY, neededCellHeight);

    currentY += neededCellHeight;
  }

  // Draw AGGREGATED TOTALS ROW (Zebra highlight)
  const totalRowHeight = 9;
  if (currentY + totalRowHeight > maxTableHeight + 25) {
    pdf.addPage();
    pageNum++;
    drawPageHeaders(pdf, pageNum);
    currentY = startTableY;
  }

  pdf.setFillColor('#ecfdf5'); // Minty emerald highlight
  pdf.rect(marginX, currentY, 180, totalRowHeight, 'F');
  pdf.setFont('NotoSansKhmer', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor('#065f46'); // Dark green text

  // 1. Label
  pdf.text('Totals:', colX.date + 1, currentY + totalRowHeight / 2 + 1.5, { align: 'left' });

  // Columns Cash End/Start empty
  pdf.text('', colX.time + 1, currentY + totalRowHeight / 2 + 1.5);
  pdf.text('', colX.startCash + 1, currentY + totalRowHeight / 2 + 1.5);
  pdf.text('', colX.endCash + 1, currentY + totalRowHeight / 2 + 1.5);
  pdf.text('', colX.startAba + 1, currentY + totalRowHeight / 2 + 1.5);
  pdf.text('', colX.endAba + 1, currentY + totalRowHeight / 2 + 1.5);

  // Totals sums
  if (!isBlankTemplate) {
    pdf.text(formatKHR(totalCashRev), colX.cashRev + colWidths.cashRev - 1.5, currentY + totalRowHeight / 2 + 1.5, { align: 'right' });
    pdf.text(formatKHR(totalAbaRev), colX.abaRev + colWidths.abaRev - 1.5, currentY + totalRowHeight / 2 + 1.5, { align: 'right' });
    pdf.text(formatKHR(totalCoinSales), colX.coinSales + colWidths.coinSales - 1.5, currentY + totalRowHeight / 2 + 1.5, { align: 'right' });
    pdf.text(formatKHR(totalRevenue), colX.totalRev + colWidths.totalRev - 1.5, currentY + totalRowHeight / 2 + 1.5, { align: 'right' });
    pdf.text('Summary', colX.notes + 2, currentY + totalRowHeight / 2 + 1.5);
  }

  // Draw borders for total row
  drawRowBorders(pdf, currentY, totalRowHeight);

  // Write Signature signoff boxes at bottom of document if space permits, otherwise push to new page
  currentY += totalRowHeight;
  const signatureHeight = 35;
  if (currentY + signatureHeight > 270) {
    pdf.addPage();
    pageNum++;
    drawPageHeaders(pdf, pageNum);
    currentY = startTableY + 10;
  }

  currentY += 12;
  pdf.setFontSize(9);
  pdf.setTextColor('#334155');

  // Multi-signatories
  pdf.text('រៀបចំដោយបេឡា (Prepared By Cashier)', 15, currentY);
  pdf.text('ពិនិត្យដោយប្រធាន (Checked By Supervisor)', 105, currentY, { align: 'center' });
  pdf.text('អនុម័តដោយម្ចាស់ (Approved By Owner)', 195, currentY, { align: 'right' });

  pdf.setDrawColor('#94a3b8');
  pdf.setLineDashPattern([1.5, 1.5], 0);
  pdf.line(15, currentY + 18, 55, currentY + 18);
  pdf.line(85, currentY + 18, 125, currentY + 18);
  pdf.line(155, currentY + 18, 195, currentY + 18);

  // Write dynamic bottom footers on ALL pages (Page X of Y pass)
  const totalPagesCount = pdf.getNumberOfPages();
  for (let pageIdx = 1; pageIdx <= totalPagesCount; pageIdx++) {
    pdf.setPage(pageIdx);

    // Rule separator for bottom page footer
    pdf.setDrawColor('#e2e8f0');
    pdf.setLineWidth(0.4);
    pdf.setLineDashPattern([], 0);
    pdf.line(marginX, 280, 195, 280);

    pdf.setFontSize(7.5);
    pdf.setTextColor('#64748b');
    // Bottom left metadata
    pdf.text(`Generated Date: ${generatedDateStr}  |  Generated By: ${generatedBy}`, marginX, 285);

    // Bottom right page number indicator
    pdf.text(`Page ${pageIdx} of ${totalPagesCount}`, 195, 285, { align: 'right' });
  }

  const arrayBuffer = pdf.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

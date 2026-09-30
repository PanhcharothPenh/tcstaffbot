/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Income, Expense, Salary } from './types';

// Currency Formatting helper supporting USD and Khmer Riel (KHR)
export function formatCurrency(amount: number, currency: 'USD' | 'KHR' = 'USD', exchangeRate = 4000): string {
  if (currency === 'USD') {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formatter.format(amount);
  } else {
    // KHR
    const rielAmount = Math.round(amount * exchangeRate);
    const formatter = new Intl.NumberFormat('kh-KH', {
      style: 'currency',
      currency: 'KHR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return formatter.format(rielAmount);
  }
}

// Dual Currency display e.g. "$12.00 / 48,000 ៛"
export function formatDualCurrency(amount: number, exchangeRate = 4000): string {
  const usd = formatCurrency(amount, 'USD');
  const khrVal = Math.round(amount * exchangeRate);
  const khr = new Intl.NumberFormat('en-US').format(khrVal) + ' ៛';
  return `${usd} (${khr})`;
}

// Convert packet counts into Cases and Packets display string
export function formatCasesAndPackets(totalPackets: number, lang: 'en' | 'kh' = 'en'): string {
  const PACKETS_PER_CASE = 24;
  const cases = Math.floor(Math.abs(totalPackets) / PACKETS_PER_CASE);
  const packets = Math.round((Math.abs(totalPackets) % PACKETS_PER_CASE) * 10) / 10;
  const sign = totalPackets < 0 ? '-' : '';

  if (lang === 'en') {
    if (cases === 0) return `${sign}${packets} pcs`;
    if (packets === 0) return `${sign}${cases} cs`;
    return `${sign}${cases} cs & ${packets} pcs`;
  } else {
    if (cases === 0) return `${sign}${packets} កញ្ចប់`;
    if (packets === 0) return `${sign}${cases} កេស`;
    return `${sign}${cases} កេស ${packets} កញ្ចប់`;
  }
}

// Calculate salary totals for a staff list
export function calculateNetSalary(base: number, ot: number, bonus: number, ded: number, advance: number): number {
  return base + ot + bonus - ded - advance;
}

// Function to generate and export structured CSV client-side (mocking Excel download)
export function exportToCSV(filename: string, headers: string[], rows: any[][]) {
  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" // Add BOM for Excel Khmer font rendering
    + [headers.join(","), ...rows.map(e => e.map(val => {
        // Escape quotes
        const str = typeof val === 'string' ? val.replace(/"/g, '""') : String(val);
        return `"${str}"`;
      }).join(","))].join("\n");
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename + ".csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helper to capture DOM element to high-res canvas handling Tailwind v4 oklch colors natively
export async function captureElementToCanvas(element: HTMLElement, scale: number = 3): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas')).default;
  const originalGetComputedStyle = window.getComputedStyle;

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  // Local 1x1 canvas helper to let the browser natively decode oklch/oklab to standard rgba values
  const conversionCanvas = document.createElement('canvas');
  conversionCanvas.width = 1;
  conversionCanvas.height = 1;
  const conversionCtx = conversionCanvas.getContext('2d');

  const anyColorToRgb = (colorStr: string): string => {
    if (!conversionCtx) return 'rgb(0,0,0)';
    try {
      conversionCtx.clearRect(0, 0, 1, 1);
      conversionCtx.fillStyle = colorStr;
      conversionCtx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = conversionCtx.getImageData(0, 0, 1, 1).data;
      if (a === 255) {
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
      }
    } catch {
      return 'rgb(0,0,0)';
    }
  };

  const replaceColorsWithRgb = (str: string): string => {
    if (!str || typeof str !== 'string') return str;
    if (!str.includes('oklch') && !str.includes('oklab')) return str;
    return str.replace(/(oklch|oklab)\([^)]+\)/g, (match) => anyColorToRgb(match));
  };

  try {
    // Wrap getComputedStyle dynamically during html2canvas DOM traversal
    window.getComputedStyle = function (el, pseudoElt) {
      const originalStyle = originalGetComputedStyle.call(window, el, pseudoElt);
      return new Proxy(originalStyle, {
        get(target, prop) {
          if (prop === 'getPropertyValue') {
            return function (propertyName: string) {
              const val = target.getPropertyValue(propertyName);
              if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
                return replaceColorsWithRgb(val);
              }
              return val;
            };
          }
          const value = target[prop as any];
          if (typeof value === 'string' && (value.includes('oklch') || value.includes('oklab'))) {
            return replaceColorsWithRgb(value);
          }
          if (typeof value === 'function') {
            return value.bind(target);
          }
          return value;
        }
      });
    };

    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc) => {
        // Copy all head styles and fonts so cloned canvas uses identical fonts and weights
        Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]')).forEach(el => {
          clonedDoc.head.appendChild(el.cloneNode(true));
        });
      }
    });

    return canvas;
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
  }
}

// Helper to trigger browser printing of a specific element id
export function printElement(elementId: string, title: string, orientation: 'portrait' | 'landscape' = 'portrait') {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Print target #${elementId} not found`);
    return;
  }

  // Clone head style tags so Tailwind and custom fonts apply to print output
  const styleTags = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(el => el.outerHTML)
    .join('\n');

  const printHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        ${styleTags}
        <style>
          @page {
            size: A4 ${orientation};
            margin: 0.4cm 0.5cm;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          .print\\:hidden, .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div>
          ${element.innerHTML}
        </div>
      </body>
    </html>
  `;

  let iframe = document.getElementById('clean24-global-print-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'clean24-global-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(printHtml);
    iframeDoc.close();

    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    }, 350);
  }
}

/**
 * Calculates prorated worked days and salary based on start/resignation date and payroll period
 */
export function getProratedDaysAndSalary(
  monthlySalary: number,
  startDateStr: string,
  resignationDateStr: string | undefined | null,
  year: number,
  month: number, // 1-12
  periodType: 'full' | 'first-half' | 'second-half' = 'full'
): { workedDays: number; totalDays: number; dailyRate: number; dueSalary: number } {
  // Safe date parsing fallbacks
  if (!startDateStr) startDateStr = '2026-01-01';
  
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyRate = Math.round((monthlySalary / daysInMonth) * 100) / 100;

  let startDay = 1;
  let endDay = daysInMonth;

  if (periodType === 'first-half') {
    endDay = 15;
  } else if (periodType === 'second-half') {
    startDay = 16;
  }

  let workedDays = 0;

  const startParsed = new Date(startDateStr);
  const resignationParsed = resignationDateStr ? new Date(resignationDateStr) : null;

  // Clear times for accurate day comparisons
  startParsed.setHours(0, 0, 0, 0);
  if (resignationParsed) {
    resignationParsed.setHours(0, 0, 0, 0);
  }

  for (let d = startDay; d <= endDay; d++) {
    const currentDayDate = new Date(year, month - 1, d);
    currentDayDate.setHours(0, 0, 0, 0);

    const afterStarted = currentDayDate.getTime() >= startParsed.getTime();
    const beforeResigned = resignationParsed ? currentDayDate.getTime() <= resignationParsed.getTime() : true;

    if (afterStarted && beforeResigned) {
      workedDays++;
    }
  }

  const dueSalary = Math.round((dailyRate * workedDays) * 100) / 100;

  return {
    workedDays,
    totalDays: endDay - startDay + 1,
    dailyRate,
    dueSalary
  };
}

/**
 * Returns the current date formatted as YYYY-MM-DD in Asia/Phnom_Penh (UTC+7) time
 */
export function getPhnomPenhDateStr(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(new Date());
  } catch {
    const d = new Date();
    d.setHours(d.getHours() + 7);
    return d.toISOString().substring(0, 10);
  }
}

/**
 * Normalizes Khmer numerals (០-៩) into standard Arabic digits (0-9)
 */
export function normalizeKhmerDigits(str?: string): string {
  if (!str) return '';
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  let res = String(str);
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(khmerDigits[i], String(i));
  }
  return res;
}

/**
 * Parses time string in various formats (12-hour, 24-hour, Khmer numerals, Khmer AM/PM words)
 * into fractional decimal hours (e.g., 7.5 = 07:30, 14.5 = 14:30 / 02:30 PM).
 */
export function parseTimeToHours(tStr?: string): number | null {
  if (!tStr || tStr === '--' || !/\S/.test(tStr)) return null;

  // 1. Convert Khmer numerals to Arabic digits
  let clean = normalizeKhmerDigits(tStr).trim();

  // 2. Identify Khmer period indicators
  const isKhmerPM = /រសៀល|ល្ងាច|យប់/i.test(clean);
  const isKhmerAM = /ព្រឹក/i.test(clean);

  // 3. Normalize separators (. or ; -> :)
  clean = clean.replace(/(\d{1,2})[.;](\d{2})/, '$1:$2');

  // 4. Regex matching H:M(:S)? (AM|PM|...)
  const match = clean.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|ព្រឹក|រសៀល|ល្ងាច|យប់)?/i);
  if (!match) {
    // Fallback: check if only number of hours or single time was provided
    const singleMatch = clean.match(/^(\d{1,2})\s*(AM|PM|ព្រឹក|រសៀល|ល្ងាច|យប់)?$/i);
    if (!singleMatch) return null;
    let h = parseInt(singleMatch[1], 10);
    let ampm = (singleMatch[2] || '').toUpperCase();
    if (isKhmerPM) ampm = 'PM';
    if (isKhmerAM) ampm = 'AM';
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h;
  }

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  let ampm = (match[3] || '').toUpperCase();

  if (isKhmerPM) ampm = 'PM';
  if (isKhmerAM) ampm = 'AM';

  if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes >= 60) return null;

  // Handle 12-hour period adjustments
  if (ampm === 'PM' || ampm === 'រសៀល' || ampm === 'ល្ងាច' || ampm === 'យប់') {
    if (hours < 12) hours += 12;
  } else if (ampm === 'AM' || ampm === 'ព្រឹក') {
    if (hours === 12) hours = 0;
  }

  return hours + minutes / 60;
}

/**
 * Calculates total worked duration in decimal hours between check-in and check-out.
 * Automatically handles overnight shifts and returns 0 for absent/permission statuses.
 */
export function calculateWorkHours(checkIn?: string, checkOut?: string, status?: string): number {
  if (status === 'Absent' || status === 'Permission') return 0;
  if (!checkIn || !checkOut || checkIn === '--' || checkOut === '--') return 0;

  const inH = parseTimeToHours(checkIn);
  const outH = parseTimeToHours(checkOut);
  if (inH === null || outH === null) return 0;

  let diff = outH - inH;
  // Handle overnight shift crossing midnight
  if (diff < 0) {
    diff += 24;
  }

  return Math.round(diff * 100) / 100;
}

/**
 * Formats fractional work hours into friendly localized strings
 * (e.g. 7.5 -> "7 ម៉ោង 30 នាទី" or "7h 30m")
 */
export function formatWorkDuration(hoursVal?: number, lang: 'kh' | 'en' = 'kh'): string {
  if (hoursVal === undefined || hoursVal === null || isNaN(hoursVal)) return '--';
  if (hoursVal <= 0) return lang === 'kh' ? '0 ម៉ោង' : '0h';

  const totalMinutes = Math.round(hoursVal * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (lang === 'kh') {
    if (hours === 0) return `${minutes} នាទី`;
    if (minutes === 0) return `${hours} ម៉ោង`;
    return `${hours} ម៉ោង ${minutes} នាទី`;
  } else {
    if (hours === 0) return `${minutes}mn`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Formats late minutes into friendly localized strings
 */
export function formatLateMinutes(mins?: number, lang: 'kh' | 'en' = 'kh'): string {
  if (mins === undefined || mins === null || isNaN(mins) || mins <= 0) {
    return lang === 'en' ? '0m' : '0 នាទី';
  }
  const totalMinutes = Math.round(mins);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (lang === 'kh') {
    if (hours === 0) return `${minutes} នាទី`;
    if (minutes === 0) return `${hours} ម៉ោង`;
    return `${hours} ម៉ោង ${minutes} នាទី`;
  } else {
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Smart Non-Wiping Attendance Merge
 * 
 * Merges two attendance records safely:
 * - Never overwrites a valid checkIn/checkOut with '--' or empty
 * - Recalculates workHours dynamically
 * - Sets status to 'Completed' if checkOut is valid
 * - Merges audit histories, photos, GPS coords, Face scores
 */
export function mergeAttendanceRecords(
  localList: any[] = [],
  incomingList: any[] = []
): { mergedList: any[]; hasLocalWins: boolean; isChangedFromLocal: boolean } {
  const safeLocal = Array.isArray(localList) ? localList : [];
  const safeIncoming = Array.isArray(incomingList) ? incomingList : [];

  if (safeIncoming.length === 0) {
    return { mergedList: safeLocal, hasLocalWins: safeLocal.length > 0, isChangedFromLocal: false };
  }
  if (safeLocal.length === 0) {
    const fixed = safeIncoming.map(item => {
      if (item && item.checkIn && item.checkOut && item.checkIn !== '--' && item.checkOut !== '--' && item.status !== 'Absent' && item.status !== 'Permission') {
        if (!item.workHours || item.workHours <= 0) {
          item.workHours = calculateWorkHours(item.checkIn, item.checkOut, item.status);
        }
      }
      return item;
    });
    return { mergedList: fixed, hasLocalWins: false, isChangedFromLocal: true };
  }

  const isValidTime = (t: any): boolean => {
    if (!t || t === '--' || typeof t !== 'string') return false;
    return /\d/.test(t.trim()) && !t.toLowerCase().includes('absent');
  };

  const getRecordTimestamp = (item: any): number => {
    if (!item) return 0;
    if (item.updatedAt) {
      const t = new Date(item.updatedAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (item.auditHistory && Array.isArray(item.auditHistory) && item.auditHistory.length > 0) {
      const last = item.auditHistory[item.auditHistory.length - 1];
      if (last?.changedAt) {
        const t = new Date(last.changedAt).getTime();
        if (!isNaN(t)) return t;
      }
    }
    if (item.createdAt) {
      const t = new Date(item.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  };

  const mergedMap = new Map<string, any>();
  let hasLocalWins = false;

  const getRecordKey = (item: any): string => {
    if (!item) return '';
    if (item.id) return String(item.id);
    if (item.staffId && item.date) return `${item.staffId}_${item.date}`;
    return JSON.stringify(item);
  };

  const getAltKey = (item: any): string => {
    if (!item) return '';
    if (item.staffId && item.date) return `${item.staffId}_${item.date}`;
    if (item.staffName && item.date) return `${item.staffName}_${item.date}`;
    return '';
  };

  // 1. Index incoming server records
  for (const inc of safeIncoming) {
    if (!inc) continue;
    const key = getRecordKey(inc);
    if (key) mergedMap.set(key, { ...inc });
  }

  // Helper to find match in mergedMap
  const findMatchInMap = (loc: any): { matchedKey: string; existing: any } | null => {
    const directKey = getRecordKey(loc);
    if (mergedMap.has(directKey)) {
      return { matchedKey: directKey, existing: mergedMap.get(directKey) };
    }
    const altKey = getAltKey(loc);
    if (altKey) {
      for (const [k, v] of mergedMap.entries()) {
        if (getAltKey(v) === altKey) {
          return { matchedKey: k, existing: v };
        }
      }
    }
    return null;
  };

  const mergeTwo = (loc: any, inc: any) => {
    const locTime = getRecordTimestamp(loc);
    const incTime = getRecordTimestamp(inc);
    const isLocNewer = locTime >= incTime;

    const base = isLocNewer ? { ...inc, ...loc } : { ...loc, ...inc };

    // Resolve checkIn: Never wipe a valid checkIn with empty or '--'
    if (isValidTime(loc.checkIn) && !isValidTime(inc.checkIn)) {
      base.checkIn = loc.checkIn;
    } else if (isValidTime(inc.checkIn) && !isValidTime(loc.checkIn)) {
      base.checkIn = inc.checkIn;
    } else if (isValidTime(loc.checkIn) && isValidTime(inc.checkIn)) {
      base.checkIn = isLocNewer ? loc.checkIn : inc.checkIn;
    } else {
      base.checkIn = loc.checkIn || inc.checkIn || '--';
    }

    // Resolve checkOut: Never wipe a valid checkOut with empty or '--'
    if (isValidTime(loc.checkOut) && !isValidTime(inc.checkOut)) {
      base.checkOut = loc.checkOut;
      base.status = (base.status === 'Working' || !base.status) ? 'Completed' : base.status;
    } else if (isValidTime(inc.checkOut) && !isValidTime(loc.checkOut)) {
      base.checkOut = inc.checkOut;
      base.status = (base.status === 'Working' || !base.status) ? 'Completed' : base.status;
    } else if (isValidTime(loc.checkOut) && isValidTime(inc.checkOut)) {
      base.checkOut = isLocNewer ? loc.checkOut : inc.checkOut;
    } else {
      base.checkOut = loc.checkOut || inc.checkOut || '--';
    }

    // Resolve status: If checkOut exists and status is 'Working', it is Completed
    if (isValidTime(base.checkOut) && (base.status === 'Working' || !base.status)) {
      base.status = 'Completed';
    }

    // Calculate workHours
    if (isValidTime(base.checkIn) && isValidTime(base.checkOut) && base.status !== 'Absent' && base.status !== 'Permission') {
      base.workHours = calculateWorkHours(base.checkIn, base.checkOut, base.status);
    } else if (base.status === 'Absent' || base.status === 'Permission') {
      base.workHours = 0;
    } else {
      base.workHours = base.workHours ?? 0;
    }

    // Preserve photos, Face, GPS
    base.checkInPhoto = loc.checkInPhoto || inc.checkInPhoto;
    base.checkOutPhoto = loc.checkOutPhoto || inc.checkOutPhoto;
    base.checkInFaceScore = loc.checkInFaceScore ?? inc.checkInFaceScore;
    base.checkOutFaceScore = loc.checkOutFaceScore ?? inc.checkOutFaceScore;
    base.checkInLatitude = loc.checkInLatitude ?? inc.checkInLatitude;
    base.checkInLongitude = loc.checkInLongitude ?? inc.checkInLongitude;
    base.checkOutLatitude = loc.checkOutLatitude ?? inc.checkOutLatitude;
    base.checkOutLongitude = loc.checkOutLongitude ?? inc.checkOutLongitude;

    // Merge auditHistory
    const histMap = new Map<string, any>();
    (inc.auditHistory || []).forEach((h: any) => histMap.set(h.changedAt || JSON.stringify(h), h));
    (loc.auditHistory || []).forEach((h: any) => histMap.set(h.changedAt || JSON.stringify(h), h));
    base.auditHistory = Array.from(histMap.values());

    base.updatedAt = new Date(Math.max(locTime, incTime, isLocNewer ? Date.now() : 0)).toISOString();

    return base;
  };

  // 2. Merge local records
  for (const loc of safeLocal) {
    if (!loc) continue;
    const match = findMatchInMap(loc);

    if (!match) {
      // Local record not in server -> KEEP IT
      const key = getRecordKey(loc);
      mergedMap.set(key, { ...loc });
      hasLocalWins = true;
    } else {
      const merged = mergeTwo(loc, match.existing);
      mergedMap.set(match.matchedKey, merged);
      if (JSON.stringify(match.existing) !== JSON.stringify(merged)) {
        hasLocalWins = true;
      }
    }
  }

  const mergedList = Array.from(mergedMap.values()).map(item => {
    if (item && isValidTime(item.checkIn) && isValidTime(item.checkOut) && item.status !== 'Absent' && item.status !== 'Permission') {
      if (item.workHours === undefined || item.workHours === null || item.workHours <= 0) {
        item.workHours = calculateWorkHours(item.checkIn, item.checkOut, item.status);
      }
    }
    return item;
  });

  const isChangedFromLocal = JSON.stringify(safeLocal) !== JSON.stringify(mergedList);

  return {
    mergedList,
    hasLocalWins,
    isChangedFromLocal
  };
}

/**
 * Smart Bidirectional Timestamp-Aware Merge for Collections
 * 
 * Merges incoming server records with local client records without losing
 * local edits or newer server records.
 * Returns { mergedList, hasLocalWins, isChangedFromLocal }:
 * - mergedList: The combined latest records
 * - hasLocalWins: True if local client had newer changes that server didn't have, indicating a push to server is required
 * - isChangedFromLocal: True if the merged result differs from localList, requiring local state/storage update
 */
export function mergeCollectionRecords<T extends Record<string, any>>(
  localList: T[] = [],
  incomingList: T[] = [],
  keyType: 'id' | 'attendance' | 'custom' = 'id'
): { mergedList: T[]; hasLocalWins: boolean; isChangedFromLocal: boolean } {
  if (keyType === 'attendance') {
    return mergeAttendanceRecords(localList, incomingList);
  }

  const safeLocal = Array.isArray(localList) ? localList : [];
  const safeIncoming = Array.isArray(incomingList) ? incomingList : [];

  if (safeIncoming.length === 0) {
    return {
      mergedList: safeLocal,
      hasLocalWins: safeLocal.length > 0,
      isChangedFromLocal: false
    };
  }

  if (safeLocal.length === 0) {
    return {
      mergedList: safeIncoming,
      hasLocalWins: false,
      isChangedFromLocal: true
    };
  }

  const getItemKey = (item: any): string => {
    if (!item) return '';
    return item.id ? String(item.id) : (item._id ? String(item._id) : JSON.stringify(item));
  };

  const getItemTimestamp = (item: any): number => {
    if (!item) return 0;
    if (item.updatedAt) {
      const t = new Date(item.updatedAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (item.auditHistory && Array.isArray(item.auditHistory) && item.auditHistory.length > 0) {
      const last = item.auditHistory[item.auditHistory.length - 1];
      if (last?.changedAt) {
        const t = new Date(last.changedAt).getTime();
        if (!isNaN(t)) return t;
      }
    }
    if (item.createdAt) {
      const t = new Date(item.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (item.timestamp) {
      const t = new Date(item.timestamp).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  };

  const mergedMap = new Map<string, any>();
  let hasLocalWins = false;

  // 1. Index incoming server records
  for (const inc of safeIncoming) {
    if (!inc) continue;
    const key = getItemKey(inc);
    if (key) {
      mergedMap.set(key, inc);
    }
  }

  // 2. Merge local records
  for (const loc of safeLocal) {
    if (!loc) continue;
    const key = getItemKey(loc);
    if (!key) continue;

    if (!mergedMap.has(key)) {
      // Local item not present on server -> KEEP IT and mark for push
      mergedMap.set(key, loc);
      hasLocalWins = true;
    } else {
      const inc = mergedMap.get(key);
      const locTime = getItemTimestamp(loc);
      const incTime = getItemTimestamp(inc);

      if (locTime >= incTime) {
        // Local is newer or equal
        const mergedItem = { ...inc, ...loc };
        mergedMap.set(key, mergedItem);
        if (JSON.stringify(loc) !== JSON.stringify(inc)) {
          hasLocalWins = true;
        }
      } else {
        // Server is strictly newer
        const mergedItem = { ...loc, ...inc };
        mergedMap.set(key, mergedItem);
      }
    }
  }

  const mergedList = Array.from(mergedMap.values());
  const isChangedFromLocal = JSON.stringify(safeLocal) !== JSON.stringify(mergedList);

  return {
    mergedList,
    hasLocalWins,
    isChangedFromLocal
  };
}



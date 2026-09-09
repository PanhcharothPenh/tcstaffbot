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


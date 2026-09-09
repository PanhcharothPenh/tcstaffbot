/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Copy, Send, Image as ImageIcon, FileText, Printer, CheckCircle2, AlertCircle, ShieldCheck, Check, Loader2 } from 'lucide-react';
import { generatePayslipText } from '../utils/khmerPayrollUtils';
import { printElement, captureElementToCanvas } from '../utils';

interface KhmerPayrollPayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any;
  lang: 'en' | 'kh';
  onUpdateStatus?: (newStatus: 'paid' | 'unpaid') => void;
}

export default function KhmerPayrollPayslipModal({
  isOpen,
  onClose,
  record,
  lang,
  onUpdateStatus
}: KhmerPayrollPayslipModalProps) {
  const [copied, setCopied] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !record) return null;

  const monthNamesKh = ['', 'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const monthNamesEn = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthStr = lang === 'kh' ? (monthNamesKh[record.month] || `ខែ ${record.month}`) : (monthNamesEn[record.month] || `Month ${record.month}`);
  
  const name = lang === 'kh' ? (record.empNameKh || record.staffName) : (record.empNameEn || record.staffName);
  const position = record.position || 'Barista';
  const branchName = record.branchName || 'toto by Chichi';
  const payDate = record.paymentDate || record.dateCalculated || new Date().toISOString().substring(0, 10);
  const payMethod = record.paymentMethod || 'Cash';

  const baseSalary = Number(record.basicSalary || record.baseSalary || 0);
  const extraShiftAmount = Number(record.extraShiftAmount || record.overtime || 0);
  const extraShiftCount = Number(record.extraShiftCount || 0);
  const staffExpenseAmount = Number(record.staffExpenseAmount || 0);
  const bonus = Number(record.bonus || record.allowance || 0);

  const grossEarnings = baseSalary + extraShiftAmount + staffExpenseAmount + bonus;

  const advancePayment = Number(record.advancePayment || record.advancesDeduct || 0);
  const leaveDeduction = Number(record.leavesDeduct !== undefined ? record.leavesDeduct : (record.deduction || 0));
  const leaveDays = Number(record.leaveDays !== undefined ? record.leaveDays : (record.daysAbsent || 0));
  
  // Format leave dates cleanly
  let leaveDates: string[] = [];
  if (Array.isArray(record.leaveDates)) {
    leaveDates = record.leaveDates;
  } else if (typeof record.leaveDates === 'string' && record.leaveDates.trim()) {
    leaveDates = record.leaveDates.split(',').map(d => d.trim()).filter(Boolean);
  }

  const otherDeduction = Number(record.customDeduct || (record.leavesDeduct !== undefined ? 0 : record.deduction) || 0);
  const period1Deduct = Number(record.period1Deduct || 0);

  const totalDeductions = advancePayment + leaveDeduction + otherDeduction + period1Deduct;
  const netSalary = Math.max(0, grossEarnings - totalDeductions);

  const isPaid = record.status === 'paid' || record.status === 'Paid';

  // 1. Bulletproof Clipboard Copy (Modern + Fallback)
  const copyToClipboard = () => {
    const text = generatePayslipText({ ...record, netSalary, leavesDeduct: leaveDeduction, leaveDays, leaveDates }, lang);
    const fallbackExecCopy = (str: string) => {
      const textArea = document.createElement("textarea");
      textArea.value = str;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (err) {
        console.error('Copy fallback failed:', err);
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => fallbackExecCopy(text));
    } else {
      fallbackExecCopy(text);
    }
  };

  // 2. Resilient Telegram Share
  const shareToTelegram = () => {
    const text = generatePayslipText({ ...record, netSalary, leavesDeduct: leaveDeduction, leaveDays, leaveDates }, lang);
    const encodedText = encodeURIComponent(text);
    const url = `https://t.me/share/url?url=&text=${encodedText}`;
    
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 3. Reliable High-Res PNG Image Export
  const downloadAsImage = async () => {
    const element = document.getElementById('payslip-print-area');
    if (!element || isExportingImage) return;

    setIsExportingImage(true);
    try {
      const canvas = await captureElementToCanvas(element, 3);
      const empName = (record.empNameKh || record.empNameEn || record.staffName || 'Employee').replace(/\s+/g, '_');
      const filename = `Coffee_Payslip_${empName}_${record.month || 'M'}_${record.year || 2026}.png`;

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = filename;
          link.click();
        }
        setIsExportingImage(false);
      }, 'image/png');
    } catch (err: any) {
      console.error('Error exporting image:', err);
      setIsExportingImage(false);
      alert(lang === 'kh' ? `មានបញ្ហាក្នុងការទាញយកជារូបភាព៖ ${err?.message || ''}` : `Error exporting image: ${err?.message || ''}`);
    }
  };

  // 4. Reliable Vector-Accurate PDF Export
  const downloadAsPdf = async () => {
    const element = document.getElementById('payslip-print-area');
    if (!element || isExportingPdf) return;

    setIsExportingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const canvas = await captureElementToCanvas(element, 3);
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 10, 15, imgWidth, imgHeight, undefined, 'FAST');
      
      const empName = (record.empNameKh || record.empNameEn || record.staffName || 'Employee').replace(/\s+/g, '_');
      pdf.save(`Coffee_Payslip_${empName}_${record.month || 'M'}_${record.year || 2026}.pdf`);
    } catch (err: any) {
      console.error('Error exporting PDF:', err);
      alert(lang === 'kh' ? `មានបញ្ហាក្នុងការទាញយក PDF៖ ${err?.message || ''}` : `Error exporting PDF: ${err?.message || ''}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // 5. Reliable Direct Printing
  const printPayslip = () => {
    setIsPrinting(true);
    try {
      printElement('payslip-print-area', 'Cafe Management Barista Salary Payslip');
    } catch (err) {
      window.print();
    } finally {
      setTimeout(() => setIsPrinting(false), 800);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="max-w-xl w-full my-auto py-4">
        {/* Quick actions top bar */}
        <div className="flex items-center justify-between gap-2 mb-3 px-1 print:hidden">
          <button 
            onClick={onClose} 
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
            title={lang === 'kh' ? 'បិទ' : 'Close'}
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {onUpdateStatus && (
              <button 
                onClick={() => onUpdateStatus(isPaid ? 'unpaid' : 'paid')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs ${
                  isPaid ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                {isPaid ? (
                  <>
                    <AlertCircle size={14} />
                    <span>{lang === 'kh' ? 'មិនទាន់បើក' : 'Unpaid'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>{lang === 'kh' ? 'បានបើក' : 'Paid'}</span>
                  </>
                )}
              </button>
            )}

            {/* 1. Copy Text Button */}
            <button 
              onClick={copyToClipboard}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                copied 
                  ? 'bg-emerald-600 text-white scale-105' 
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={lang === 'kh' ? 'ចម្លងអត្ថបទ' : 'Copy Text'}
            >
              {copied ? <Check size={14} className="text-emerald-200" /> : <Copy size={14} />}
              <span>{copied ? (lang === 'kh' ? 'បានចម្លង!' : 'Copied!') : (lang === 'kh' ? 'ចម្លង' : 'Copy')}</span>
            </button>

            {/* 2. Telegram Share Button */}
            <button 
              onClick={shareToTelegram}
              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title={lang === 'kh' ? 'ផ្ញើទៅ Telegram' : 'Share to Telegram'}
            >
              <Send size={14} />
              <span>Telegram</span>
            </button>

            {/* 3. Save Image Button */}
            <button 
              onClick={downloadAsImage}
              disabled={isExportingImage}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              title={lang === 'kh' ? 'ទាញយកជារូបភាព PNG' : 'Save as PNG Image'}
            >
              {isExportingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
              <span>{isExportingImage ? (lang === 'kh' ? 'កំពុងទាញ...' : 'Saving...') : (lang === 'kh' ? 'រូបភាព' : 'Image')}</span>
            </button>

            {/* 4. Save PDF Button */}
            <button 
              onClick={downloadAsPdf}
              disabled={isExportingPdf}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              title={lang === 'kh' ? 'ទាញយកជាឯកសារ PDF' : 'Save as PDF Document'}
            >
              {isExportingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              <span>{isExportingPdf ? (lang === 'kh' ? 'កំពុងទាញ...' : 'Saving...') : (lang === 'kh' ? 'PDF' : 'PDF')}</span>
            </button>

            {/* 5. Print Button */}
            <button 
              onClick={printPayslip}
              disabled={isPrinting}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title={lang === 'kh' ? 'បោះពុម្ភបង្កាន់ដៃ' : 'Print Payslip'}
            >
              <Printer size={14} />
              <span>{lang === 'kh' ? 'បោះពុម្ភ' : 'Print'}</span>
            </button>
          </div>
        </div>

        {/* Paper Container - Flat, Clean, Borderless Executive Document Style */}
        <div 
          id="payslip-print-area" 
          className="relative bg-white text-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-2xl mx-auto overflow-hidden space-y-5"
        >
          {/* Top Subtle Brand Color Line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#003D9B]" />

          {/* Header: System Branding & Payslip Title */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3 border-b-2 border-slate-800">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="P2B Laundry System" 
                className="h-12 w-auto max-h-14 object-contain shrink-0" 
              />
              <div>
                <div className="text-xs font-black text-[#003D9B] uppercase tracking-wide">
                  P2B LAUNDRY SYSTEM | {branchName}
                </div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 mt-0.5 leading-snug">
                  {lang === 'kh' ? 'បង្កាន់ដៃបើកប្រាក់បៀវត្សរ៍បុគ្គលិក' : 'OFFICIAL SALARY PAYSLIP'}
                </h1>
              </div>
            </div>

            {/* Reference & Status */}
            <div className="text-left sm:text-right space-y-1">
              <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                {isPaid ? (lang === 'kh' ? '✓ បានទូទាត់រួច' : '✓ PAID') : (lang === 'kh' ? '⏳ មិនទាន់ទូទាត់' : '⏳ PENDING')}
              </div>
              <div className="text-[10.5px] text-slate-500 font-bold">
                លេខយោង៖ #PAY-{record.year || 2026}{String(record.month || 9).padStart(2, '0')}-{record.id?.slice(-4) || '001'}
              </div>
            </div>
          </div>

          {/* Employee Information: Clean Flat 2-Column Key-Values (No Box) */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs py-1">
            <div className="flex items-baseline gap-2">
              <span className="text-slate-500 w-28 shrink-0">{lang === 'kh' ? 'ឈ្មោះបុគ្គលិក ៖' : 'Staff Name:'}</span>
              <span className="font-bold text-slate-900 text-sm">{name}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-slate-500 w-28 shrink-0">{lang === 'kh' ? 'ប្រចាំខែ ៖' : 'Pay Period:'}</span>
              <span className="font-bold text-blue-700">{record.salaryPeriod || `${monthStr} ${record.year || 2026}`}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-slate-500 w-28 shrink-0">{lang === 'kh' ? 'តួនាទី / ផ្នែក ៖' : 'Position:'}</span>
              <span className="font-bold text-slate-800">{position}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-slate-500 w-28 shrink-0">{lang === 'kh' ? 'វិធីសាស្ត្រ ៖' : 'Method:'}</span>
              <span className="font-bold text-slate-800">{payMethod}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-slate-500 w-28 shrink-0">{lang === 'kh' ? 'កាលបរិច្ឆេទ ៖' : 'Pay Date:'}</span>
              <span className="font-bold text-slate-800">{payDate}</span>
            </div>
          </div>

          {/* Financial Breakdown Table: Flat Clean Accounting Ledger (No Box) */}
          <div className="border-t border-b border-slate-300 py-2 space-y-3 text-xs">
            {/* 1. Earnings Section */}
            <div className="space-y-1.5">
              <div className="font-black text-slate-900 flex justify-between items-center text-xs pb-1 border-b border-slate-200">
                <span>១. ប្រាក់ចំណូល និងប្រាក់បន្ថែម (Earnings & Additions)</span>
                <span className="text-slate-500">+ USD ($)</span>
              </div>
              <div className="space-y-1 pl-2 text-slate-700">
                <div className="flex justify-between items-center py-0.5">
                  <span>• ប្រាក់ខែគោល (Base Salary)</span>
                  <span className="font-bold text-slate-900">${baseSalary.toFixed(2)}</span>
                </div>
                {extraShiftAmount > 0 && (
                  <div className="flex justify-between items-center py-0.5 text-sky-900">
                    <span>
                      • ជំនួសវេន ($6/វេន)
                      {extraShiftCount > 0 && <span className="text-slate-500 ml-1">({extraShiftCount} វេន)</span>}
                    </span>
                    <span className="font-bold text-sky-700">+${extraShiftAmount.toFixed(2)}</span>
                  </div>
                )}
                {staffExpenseAmount > 0 && (
                  <div className="flex justify-between items-center py-0.5 text-amber-900">
                    <span>• សងថ្លៃចំណាយបុគ្គលិក (Staff Expense Reimbursement)</span>
                    <span className="font-bold text-amber-700">+${staffExpenseAmount.toFixed(2)}</span>
                  </div>
                )}
                {bonus > 0 && (
                  <div className="flex justify-between items-center py-0.5 text-emerald-900">
                    <span>• ប្រាក់ឧបត្ថម្ភផ្សេងៗ (Bonus / Allowance)</span>
                    <span className="font-bold text-emerald-700">+${bonus.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-100 font-bold text-slate-900">
                  <span>➜ សរុបប្រាក់ចំណូល (Gross Earnings)</span>
                  <span className="font-bold text-emerald-700">${grossEarnings.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* 2. Deductions Section */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <div className="font-black text-slate-900 flex justify-between items-center text-xs pb-1 border-b border-slate-200">
                <span>២. ការកាត់ប្រាក់ (Deductions)</span>
                <span className="text-slate-500">- USD ($)</span>
              </div>
              <div className="space-y-1 pl-2 text-slate-700">
                {advancePayment > 0 && (
                  <div className="flex justify-between items-center py-0.5 text-rose-900">
                    <span>• បើកប្រាក់មុន (Salary Advance)</span>
                    <span className="font-bold text-rose-600">-${advancePayment.toFixed(2)}</span>
                  </div>
                )}
                {leaveDeduction > 0 ? (
                  <div className="py-0.5 text-rose-900 space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span>
                        • ឈប់សម្រាក ($6/វេន)
                        {leaveDays > 0 && <span className="text-slate-500 ml-1">({leaveDays} វេន)</span>}
                      </span>
                      <span className="font-bold text-rose-600">-${leaveDeduction.toFixed(2)}</span>
                    </div>
                    {leaveDates.length > 0 && (
                      <div className="text-[11px] text-rose-700 pl-3">
                        └ កាលបរិច្ឆេទឈប់៖ <span className="font-bold">{leaveDates.join(', ')}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between items-center py-0.5 text-slate-400">
                    <span>• ឈប់សម្រាក/អវត្តមាន (Absences)</span>
                    <span>$0.00</span>
                  </div>
                )}
                {otherDeduction > 0 && (
                  <div className="flex justify-between items-center py-0.5 text-rose-900">
                    <span>• កាត់ផ្សេងៗ (Other Deductions)</span>
                    <span className="font-bold text-rose-600">-${otherDeduction.toFixed(2)}</span>
                  </div>
                )}
                {period1Deduct > 0 && (
                  <div className="flex justify-between items-center py-0.5 text-rose-900">
                    <span>• បើកលើកទី១រួច (Period 1 Paid)</span>
                    <span className="font-bold text-rose-600">-${period1Deduct.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-100 font-bold text-slate-900">
                  <span>➜ សរុបការកាត់ប្រាក់ (Total Deductions)</span>
                  <span className="font-bold text-rose-600">-${totalDeductions.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Payable Row: Flat Bold Underlined Summary (No Box) */}
          <div className="flex items-center justify-between py-2 border-b-2 border-slate-900">
            <div>
              <span className="text-sm font-black text-slate-900 block">
                {lang === 'kh' ? 'ប្រាក់ខែបើកជាក់ស្តែង • NET PAYABLE SALARY' : 'NET SALARY PAYOUT'}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#003D9B]">
              ${netSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-2 gap-8 text-xs text-slate-700 text-center pt-4">
            <div className="space-y-1">
              <p className="font-bold text-slate-900">{lang === 'kh' ? 'អ្នករៀបចំ / អ្នកគ្រប់គ្រងហាង' : 'Prepared by Manager'}</p>
              <p className="text-[10.5px] text-slate-400">{lang === 'kh' ? '(ហត្ថលេខា & ឈ្មោះ)' : '(Signature & Name)'}</p>
              <div className="h-14 flex items-end justify-center">
                <div className="w-40 border-b border-dashed border-slate-400" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="font-bold text-slate-900">{lang === 'kh' ? 'បុគ្គលិកទទួលប្រាក់ខែ' : 'Received by Employee'}</p>
              <p className="text-[10.5px] text-slate-400">{lang === 'kh' ? '(ហត្ថលេខា ឬស្នាមមេដៃ)' : '(Signature / Thumbprint)'}</p>
              <div className="h-14 flex items-end justify-center">
                <div className="w-40 border-b border-dashed border-slate-400" />
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="text-center pt-3 border-t border-slate-200 text-[10px] text-slate-400">
            <p>toto by Chichi & Coffee corner • ឯកសារទូទាត់ប្រាក់បៀវត្សរ៍ផ្លូវការ • {payDate}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Printer, 
  Download, 
  FileSpreadsheet, 
  Save, 
  Check, 
  Eye, 
  Calendar,
  Layers,
  Send,
  Info,
  DollarSign,
  TrendingUp,
  BarChart3,
  X,
  Sparkles,
  RefreshCw,
  Coins,
  FileText,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { RevenueRecord, Role, Branch } from '../types';
import { printElement } from '../utils';
import Clean24Logo from './Clean24Logo';
import { notifyRevenueRecordSaved, notifyBatchSaveCompleted } from '../services/branchTelegramNotifier';

interface RevenueRecordsViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  revenueRecords: RevenueRecord[];
  setRevenueRecords: React.Dispatch<React.SetStateAction<RevenueRecord[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
  exchangeRate: number;
  onSelectBranch?: (branchId: string) => void;
}

export default function RevenueRecordsView({
  currentRole,
  activeBranchId,
  branches,
  revenueRecords,
  setRevenueRecords,
  lang,
  onAddLog,
  exchangeRate,
  onSelectBranch
}: RevenueRecordsViewProps) {
  const isOwner = currentRole === 'Owner';
  const isManager = currentRole === 'Manager';
  const isStaff = currentRole === 'Staff';

  // ----------------------------------------------------
  // FILTER STATES (Month, Year, Branch)
  // ----------------------------------------------------
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => 
    (activeBranchId && activeBranchId !== 'all') ? activeBranchId : (branches[0]?.id || 'b1')
  );
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);

  // View state: 'sheet' | 'reports'
  const [activeTab, setActiveTab] = useState<'sheet' | 'reports'>('sheet');
  const [reportSubTab, setReportSubTab] = useState<'daily' | 'monthly' | 'yearly' | 'branch'>('daily');

  // Print Preview Dialogue
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // PDF Export and Preview States
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isBlankPrint, setIsBlankPrint] = useState(false);
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('portrait');
  // Custom Table Size (Row Height) State (0 = Default 42px)
  const [customRowHeight, setCustomRowHeight] = useState<number>(0);
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [toastAlert, setToastAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToastAlert({ type, message });
    setTimeout(() => {
      setToastAlert(null);
    }, 5000);
  };

  const generateAndDownloadPdf = async () => {
    setIsPdfModalOpen(true);
    setPdfGenerating(true);
    setPdfError(null);
    setPdfBlobUrl(null);
    try {
      const branchObj = branches.find(b => b.id === selectedBranchId);
      const branchName = branchObj ? branchObj.branchName : 'Branch';
      
      const email = localStorage.getItem('clean24_user_email') || 'auditor@clean24.com';
      
      const response = await fetch(`/api/revenue/export/pdf?branch_id=${selectedBranchId}&month=${selectedMonth}&year=${selectedYear}&generated_by=${encodeURIComponent(email)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clean24_access_token') || ''}`
        }
      });
      
      if (!response.ok) {
        const errText = await response.text();
        let parsedErr = 'Unknown error occurred';
        try {
          const json = JSON.parse(errText);
          parsedErr = json.error || json.message || parsedErr;
        } catch (e) {
          parsedErr = errText || parsedErr;
        }
        throw new Error(parsedErr);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setPdfGenerating(false);

      // Auto download pdf
      const cleanBranchName = branchName.replace(/\s+/g, '');
      const filename = `Revenue_${cleanBranchName}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      onAddLog(`Generated and auto-downloaded PDF Statement: ${filename}`);
      showToast('success', lang === 'en' ? `Generated and downloaded PDF successfully: ${filename}` : `បានទាញយក PDF ដោយជោគជ័យ៖ ${filename}`);
    } catch (err: any) {
      console.error('[PDF Export Error]', err);
      const errMsg = err.message || 'Error occurred generating the report PDF.';
      setPdfError(errMsg);
      setPdfGenerating(false);
      onAddLog(`PDF Generation Failed: ${err.message || err}`);
      showToast('error', lang === 'en' ? `PDF Generation Failed: ${errMsg}` : `ការបង្កើត PDF បានបរាជ័យ៖ ${errMsg}`);
    }
  };

  const handlePrintPdfFromIframe = () => {
    const iframe = document.getElementById('pdf-preview-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      alert(lang === 'en' ? 'Print preview iframe not ready.' : 'មិនទាន់រៀបចំស៊ុមបោះពុម្ពទេ។');
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfBlobUrl) return;
    const branchObj = branches.find(b => b.id === selectedBranchId);
    const branchName = branchObj ? branchObj.branchName : 'Branch';
    const cleanBranchName = branchName.replace(/\s+/g, '');
    const filename = `Revenue_${cleanBranchName}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.pdf`;
    
    const a = document.createElement('a');
    a.href = pdfBlobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    onAddLog(`Downloaded PDF Statement: ${filename}`);
  };

  // Status flags
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [savedRowIndex, setSavedRowIndex] = useState<number | null>(null);

  // Telegram modal state
  const [telegramModalRow, setTelegramModalRow] = useState<any | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  // Keep internal branch synchronized with parent's active branch selector
  useEffect(() => {
    if (activeBranchId && activeBranchId !== 'all') {
      setSelectedBranchId(activeBranchId);
    } else if (branches.length > 0 && !branches.some(b => b.id === selectedBranchId)) {
      setSelectedBranchId(branches[0].id);
    }
  }, [activeBranchId, branches]);

  const handleBranchChange = (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    if (onSelectBranch) {
      onSelectBranch(newBranchId);
    }
  };

  // Months List
  const months = useMemo(() => [
    { value: 1, en: 'Jan', kh: 'មករា', fullEn: 'January', fullKh: 'មករា' },
    { value: 2, en: 'Feb', kh: 'កុម្ភៈ', fullEn: 'February', fullKh: 'កុម្ភៈ' },
    { value: 3, en: 'Mar', kh: 'មីនា', fullEn: 'March', fullKh: 'មីនា' },
    { value: 4, en: 'Apr', kh: 'មេសា', fullEn: 'April', fullKh: 'មេសា' },
    { value: 5, en: 'May', kh: 'ឧសភា', fullEn: 'May', fullKh: 'ឧសភា' },
    { value: 6, en: 'Jun', kh: 'មិថុនា', fullEn: 'June', fullKh: 'មិថុនា' },
    { value: 7, en: 'Jul', kh: 'កក្កដា', fullEn: 'July', fullKh: 'កកក្ដា' },
    { value: 8, en: 'Aug', kh: 'សីហា', fullEn: 'August', fullKh: 'សីហា' },
    { value: 9, en: 'Sep', kh: 'កញ្ញា', fullEn: 'September', fullKh: 'កញ្ញា' },
    { value: 10, en: 'Oct', kh: 'តុលា', fullEn: 'October', fullKh: 'តុលា' },
    { value: 11, en: 'Nov', kh: 'វិច្ឆិកា', fullEn: 'November', fullKh: 'វិច្ឆិកា' },
    { value: 12, en: 'Dec', kh: 'ធ្នូ', fullEn: 'December', fullKh: 'ធ្នូ' },
  ], []);

  const years = [2025, 2026, 2027, 2028];

  // Helper translations for UI
  const tLocal = {
    revenueSheet: lang === 'en' ? 'Clean24 Revenue & Counter Sheet' : 'សៀវភៅកុងទ័រនិងចំណូល Clean24',
    staffOnlyEnters: lang === 'en' 
      ? 'Staff enters Start/End Counters, Cash, ABA, Bank Deposit, Actual Cash Count & Notes. Everything derives automatically.' 
      : 'បុគ្គលិកកត់ត្រា កុងទ័រចាប់ផ្ដើម/បញ្ចប់ លុយសុទ្ធ ABA ប្រាក់ចូលធនាគារ លុយរាប់ជាក់ស្ដែង និងចំណាំ។ ប្រព័ន្ធគណនាដោយស្វ័យប្រវត្ត។',
    date: lang === 'en' ? 'Date' : 'ថ្ងៃ/ម៉ោង',
    startCounter: lang === 'en' ? 'Start Counter' : 'កុងទ័រចាប់ផ្តើម',
    endCounter: lang === 'en' ? 'End Counter' : 'កុងទ័របញ្ចប់',
    cash: lang === 'en' ? 'Cash (KHR)' : 'លុយសុទ្ធ (KHR)',
    aba: lang === 'en' ? 'ABA' : 'ABA',
    coinSales: lang === 'en' ? 'Outside Coin Sales' : 'លក់កាក់ក្រៅ',
    bankDeposit: lang === 'en' ? 'Bank Deposit' : 'ចូលធនាគារ',
    notes: lang === 'en' ? 'Notes' : 'ចំណាំ',
    totalRevenue: lang === 'en' ? 'Total Revenue (KHR)' : 'លុយសរុបប្រចាំថ្ងៃ',
    received: lang === 'en' ? 'Received (Remaining KHR)' : 'ទទួល (ប្រាក់នៅសល់)',
    action: lang === 'en' ? 'Action' : 'សកម្មភាព',
    todayRevenue: lang === 'en' ? 'Today Revenue' : 'ចំណូលថ្ងៃនេះ',
    monthlyRevenue: lang === 'en' ? 'Monthly Revenue' : 'ចំណូលប្រចាំខែ',
    yearlyRevenue: lang === 'en' ? 'Yearly Revenue' : 'ចំណូលប្រចាំឆ្នាំ',
    branchRevenue: lang === 'en' ? 'Branch Revenue' : 'ចំណូលតាមសាខា',
    saveMonthData: lang === 'en' ? 'Save Month Data' : 'រក្សាទុកទិន្នន័យខែនេះ',
    exportExcel: lang === 'en' ? 'Export Excel' : 'នាំចេញ Excel',
    printPdf: lang === 'en' ? 'Print / PDF' : 'បោះពុម្ព / PDF',
    reportsCenter: lang === 'en' ? 'Reports Center' : 'មជ្ឈមណ្ឌលរបាយការណ៍',
    dailyReport: lang === 'en' ? 'Daily Report' : 'របាយការណ៍ប្រចាំថ្ងៃ',
    monthlyReport: lang === 'en' ? 'Monthly Report' : 'របាយការណ៍ប្រចាំខែ',
    yearlyReport: lang === 'en' ? 'Yearly Report' : 'របាយការណ៍ប្រចាំឆ្នាំ',
    branchReport: lang === 'en' ? 'Branch Comparison' : 'របាយការណ៍សាខា',
    sendAlert: lang === 'en' ? 'Telegram Alert' : 'ផ្ញើ Telegram',
  };

  // Selected Branch Name
  const selectedBranchName = useMemo(() => {
    if (selectedBranchId === 'all') return lang === 'en' ? 'Consolidated Branches View' : 'គ្រប់សាខាទាំងអស់';
    const br = branches.find(b => b.id === selectedBranchId);
    return br ? br.branchName : (branches.length > 0 ? branches[0].branchName : 'Clean24 Laundry');
  }, [branches, selectedBranchId, lang]);

  // Get days count
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Convert month name to shorthand
  const getMonthAbbr = (monthVal: number) => {
    const found = months.find(m => m.value === monthVal);
    return found ? found.en : '';
  };

  const getMonthKhmer = (monthVal: number) => {
    const found = months.find(m => m.value === monthVal);
    return found ? found.kh : '';
  };

  // Format Helper e.g. 01-Jun-2026
  const formatDayLabel = (dayNum: number) => {
    const dStr = String(dayNum).padStart(2, '0');
    const mStr = getMonthAbbr(selectedMonth);
    return `${dStr}-${mStr}-${selectedYear}`;
  };

  // YYYY-MM-DD
  const formatYYYYMMDD = (dayNum: number) => {
    const mm = String(selectedMonth).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    return `${selectedYear}-${mm}-${dd}`;
  };

  // Khmer currency formatter helper
  const formatKHR = (amount: number) => {
    return new Intl.NumberFormat('kh-KH', {
      style: 'currency',
      currency: 'KHR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // USD equivalence display helper
  const formatUSD = (amountKh: number) => {
    const usd = amountKh / exchangeRate;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(usd);
  };

  // ----------------------------------------------------
  // GRID DATA STATE
  // ----------------------------------------------------
  const [localRows, setLocalRows] = useState<any[]>([]);
  // Build the local editable grid matching current filters
  useEffect(() => {
    setLocalRows(prevLocal => {
      const isSameContext = Boolean(
        prevLocal && 
        prevLocal.length === daysInMonth && 
        prevLocal[0]?.date === formatYYYYMMDD(1) &&
        prevLocal[0]?.branchId === selectedBranchId
      );
      
      const rows = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatYYYYMMDD(day);
        const match = revenueRecords.find(
          r => r.branchId === selectedBranchId && r.date === dateStr
        );
        const prevRow = isSameContext ? prevLocal[day - 1] : null;

        if (prevRow && prevRow.isDirty) {
          // Keep user's active uncommitted edits in memory for this exact branch & month
          rows.push(prevRow);
        } else if (match) {
          // Use saved database record for this branch
          rows.push({
            branchId: selectedBranchId,
            day,
            date: dateStr,
            label: formatDayLabel(day),
            time: match.time || '10:30',
            startCounter: match.startCounter !== undefined ? match.startCounter : 0,
            endCounter: match.endCounter !== undefined ? match.endCounter : 0,
            startCounterAba: match.startCounterAba !== undefined ? match.startCounterAba : 0,
            endCounterAba: match.endCounterAba !== undefined ? match.endCounterAba : 0,
            cash: match.cash !== undefined ? match.cash : 0,
            aba: match.aba !== undefined ? match.aba : 0,
            coinCount: match.coinCount !== undefined ? match.coinCount : (match.coinSales ? Math.round(match.coinSales / 1000) : 0),
            coinSales: match.coinSales !== undefined ? match.coinSales : ((match.coinCount || 0) * 1000),
            bankDeposit: match.bankDeposit !== undefined ? match.bankDeposit : 0,
            actualCashCount: match.actualCashCount !== undefined ? match.actualCashCount : 0,
            note: match.note || '',
            exists: true,
            recordId: match.id || null,
            isDirty: false
          });
        } else {
          // Unsaved day for this branch: start clean with 0s (no carry-over from other branch)
          rows.push({
            branchId: selectedBranchId,
            day,
            date: dateStr,
            label: formatDayLabel(day),
            time: '10:30',
            startCounter: 0,
            endCounter: 0,
            startCounterAba: 0,
            endCounterAba: 0,
            cash: 0,
            aba: 0,
            coinCount: 0,
            coinSales: 0,
            bankDeposit: 0,
            actualCashCount: 0,
            note: '',
            exists: false,
            recordId: null,
            isDirty: false
          });
        }
      }

      return rows;
    });
  }, [selectedBranchId, selectedYear, selectedMonth, daysInMonth, revenueRecords]);

  // Calculates derived values like Expected Revenue (Counter Revenue), Daily Revenue, Remaining, and Difference
  const processedRows = useMemo(() => {
    return localRows.map(row => {
      // 1. Cash Revenue = Cash End Counter - Cash Start Counter (only if end counter entered)
      const cash = (row.endCounter > 0 && row.startCounter > 0)
        ? (row.endCounter - row.startCounter)
        : (row.endCounter > 0 ? row.endCounter : 0);

      // 2. ABA Revenue = ABA End Counter - ABA Start Counter (only if end counter entered)
      const aba = (row.endCounterAba > 0 && row.startCounterAba > 0)
        ? (row.endCounterAba - row.startCounterAba)
        : (row.endCounterAba > 0 ? row.endCounterAba : 0);

      // 3. Outside Coin Sales (លក់កាក់ក្រៅ: 1 coin = 1,000 KHR)
      const coinCount = row.coinCount !== undefined 
        ? row.coinCount 
        : (row.coinSales ? Math.round(row.coinSales / 1000) : 0);
      const coinSales = coinCount * 1000;

      // 4. Daily Revenue = Cash Revenue + ABA Revenue + Outside Coin Sales
      const dailyRevenue = Math.max(0, cash) + Math.max(0, aba) + Math.max(0, coinSales);

      // Background compatible attributes
      const bankDeposit = row.bankDeposit || 0;
      const actualCashCount = row.actualCashCount || 0;
      const remainingCash = Math.max(0, dailyRevenue - bankDeposit);
      const difference = dailyRevenue - (cash + aba + coinSales);

      return {
        ...row,
        cash,
        aba,
        coinCount,
        coinSales,
        dailyRevenue,
        bankDeposit,
        actualCashCount,
        remainingCash,
        difference
      };
    });
  }, [localRows]);

  // Handle cell edits in memory
  const handleCellChange = (
    dayIndex: number, 
    field: 'startCounter' | 'endCounter' | 'startCounterAba' | 'endCounterAba' | 'coinCount' | 'coinSales' | 'note' | 'time', 
    value: any
  ) => {
    const updated = [...localRows];
    const target = { ...updated[dayIndex] };

    if (field === 'note' || field === 'time') {
      target[field] = value;
    } else if (field === 'coinCount' || field === 'coinSales') {
      // 1 coin = 1,000 KHR
      const count = value === '' ? 0 : Math.max(0, parseInt(value) || 0);
      target.coinCount = count;
      target.coinSales = count * 1000;
    } else {
      const num = value === '' ? 0 : Math.max(0, parseInt(value) || 0);
      target[field] = num;
    }

    target.isDirty = true;
    updated[dayIndex] = target;

    setLocalRows(updated);
  };

  // ----------------------------------------------------
  // REAL-TIME TOTALS AGGREGATES
  // ----------------------------------------------------
  const sumCash = useMemo(() => processedRows.reduce((a, b) => a + (b.cash || 0), 0), [processedRows]);
  const sumAba = useMemo(() => processedRows.reduce((a, b) => a + (b.aba || 0), 0), [processedRows]);
  const sumCoinCount = useMemo(() => processedRows.reduce((a, b) => a + (b.coinCount || 0), 0), [processedRows]);
  const sumCoinSales = useMemo(() => processedRows.reduce((a, b) => a + (b.coinSales || 0), 0), [processedRows]);
  const sumBankDeposit = useMemo(() => processedRows.reduce((a, b) => a + (b.bankDeposit || 0), 0), [processedRows]);
  const sumRevenue = useMemo(() => processedRows.reduce((a, b) => a + (b.dailyRevenue || 0), 0), [processedRows]);
  const sumRemaining = useMemo(() => processedRows.reduce((a, b) => a + (b.remainingCash || 0), 0), [processedRows]);

  // ----------------------------------------------------
  // DASHBOARD INDICATORS logic
  // ----------------------------------------------------
  const currentLocalDateStr = new Date().toISOString().split('T')[0];

  const todayRevenueVal = useMemo(() => {
    const match = revenueRecords.filter(r => r.branchId === selectedBranchId && r.date === currentLocalDateStr);
    return match.reduce((sum, r) => sum + (r.dailyRevenue || 0), 0);
  }, [revenueRecords, selectedBranchId, currentLocalDateStr]);

  const yearlyRevenueVal = useMemo(() => {
    const prefix = `${selectedYear}`;
    return revenueRecords
      .filter(r => r.branchId === selectedBranchId && r.date.startsWith(prefix))
      .reduce((sum, r) => sum + (r.dailyRevenue || 0), 0);
  }, [revenueRecords, selectedBranchId, selectedYear]);

  // ----------------------------------------------------
  // SAVING logic
  // ----------------------------------------------------
  // Save single row to persistent parent records array
  const saveRow = (index: number) => {
    const row = processedRows[index];

    const hasCashError = row.endCounter > 0 && row.endCounter < row.startCounter;
    const hasAbaError = row.endCounterAba > 0 && row.endCounterAba < row.startCounterAba;

    if (hasCashError || hasAbaError) {
      if (isOwner || isManager) {
        showToast('success', lang === 'en'
          ? `Warning filled (Day ${row.day}): Saved with Admin Override despite End Counter is lower than Start Counter.`
          : `ការព្រមាន (ថ្ងៃទី ${row.day})៖ រក្សាទុកដោយ Admin ជំនះលើកំហុសលេខកុងទ័របញ្ចប់ទាបជាងកុងទ័រផ្ដើម។`);
      } else {
        if (hasCashError) {
          showToast('error', lang === 'en'
            ? `Error (Day ${row.day}): Cash End Counter (${row.endCounter.toLocaleString()}) cannot be lower than Cash Start Counter (${row.startCounter.toLocaleString()}) unless overridden by Admin.`
            : `កំហុស (ថ្ងៃទី ${row.day})៖ កុងទ័របញ្ចប់សាច់ប្រាក់ (${row.endCounter.toLocaleString()}) មិនអាចទាបជាងកុងទ័រផ្ដើមសាច់ប្រាក់ (${row.startCounter.toLocaleString()}) ឡើយ (ត្រូវតែមានការជំនះដោយ Admin)។`);
        } else {
          showToast('error', lang === 'en'
            ? `Error (Day ${row.day}): ABA End Counter (${row.endCounterAba.toLocaleString()}) cannot be lower than ABA Start Counter (${row.startCounterAba.toLocaleString()}) unless overridden by Admin.`
            : `កំហុស (ថ្ងៃទី ${row.day})៖ កុងទ័របញ្ចប់ ABA (${row.endCounterAba.toLocaleString()}) មិនអាចទាបជាងកុងទ័រផ្ដើម ABA (${row.startCounterAba.toLocaleString()}) ឡើយ (ត្រូវតែមានការជំនះដោយ Admin)។`);
        }
        return;
      }
    }

    const matchId = row.recordId || `rev_${selectedBranchId}_${row.date}`;

    const savedRecord: RevenueRecord = {
      id: matchId,
      branchId: selectedBranchId,
      date: row.date,
      time: row.time,
      startCounter: row.startCounter,
      endCounter: row.endCounter,
      startCounterAba: row.startCounterAba,
      endCounterAba: row.endCounterAba,
      counterRevenue: row.cash + row.aba,
      cash: row.cash,
      aba: row.aba,
      coinCount: row.coinCount || 0,
      coinSales: row.coinSales || 0,
      dailyRevenue: row.dailyRevenue,
      bankDeposit: row.bankDeposit || 0,
      remainingCash: row.remainingCash || 0,
      actualCashCount: row.actualCashCount || 0,
      difference: row.difference || 0,
      note: row.note || '',
      amountUsd: parseFloat((row.dailyRevenue / exchangeRate).toFixed(2)),
      amountKhr: row.dailyRevenue,
      paymentMethod: row.aba >= row.cash ? 'ABA' : 'Cash',
      createdBy: currentRole,
      createdAt: row.exists ? (revenueRecords.find(r => r.id === matchId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'Submitted'
    };

    setRevenueRecords(prev => {
      const idx = prev.findIndex(p => p.id === matchId);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = savedRecord;
        return copy;
      } else {
        return [...prev, savedRecord];
      }
    });

    const copyRows = [...localRows];
    copyRows[index] = { 
      ...row, 
      note: row.note || '',
      exists: true, 
      recordId: matchId, 
      isDirty: false 
    };

    setLocalRows(copyRows);

    setSavedRowIndex(index);
    setTimeout(() => setSavedRowIndex(null), 1500);

    onAddLog(`Saved Revenue book sheet for "${selectedBranchName}" on ${row.label} (Total: ${row.dailyRevenue} KHR, Cash: ${row.cash} KHR, ABA: ${row.aba} KHR, Coin: ${row.coinCount || 0} pcs / ${row.coinSales || 0} KHR)`);

    // Auto-dispatch to branch Telegram bot
    notifyRevenueRecordSaved({
      branchId: selectedBranchId,
      branchName: selectedBranchName,
      dateLabel: row.label,
      row,
      exchangeRate,
      role: currentRole
    }).then(res => {
      if (res.success) {
        onAddLog(`✓ ផ្ញើទៅ Telegram សាខា (${selectedBranchName}) រួចរាល់`);
      } else {
        onAddLog(`⚠️ Telegram (${selectedBranchName}): ${res.error || 'រកមិនឃើញ Chat ID'}`);
      }
    }).catch(err => console.warn('Telegram notify error:', err));
  };

  // Batch save the full month list
  const saveAllRows = () => {
    const invalidCashRow = processedRows.find(r => r.endCounter > 0 && r.endCounter < r.startCounter);
    const invalidAbaRow = processedRows.find(r => r.endCounterAba > 0 && r.endCounterAba < r.startCounterAba);

    if (invalidCashRow || invalidAbaRow) {
      if (isOwner || isManager) {
        showToast('success', lang === 'en'
          ? `Warning: Saved with Admin Override despite counter errors.`
          : `ការព្រមាន៖ រក្សាទុកដោយ Admin ជំនះលើកំហុសលេខកុងទ័រ។`);
      } else {
        if (invalidCashRow) {
          showToast('error', lang === 'en'
            ? `Error (Day ${invalidCashRow.day}): Cash End Counter (${invalidCashRow.endCounter.toLocaleString()}) cannot be lower than Cash Start Counter (${invalidCashRow.startCounter.toLocaleString()}) unless overridden by Admin.`
            : `កំហុស (ថ្ងៃទី ${invalidCashRow.day})៖ កុងទ័របញ្ចប់សាច់ប្រាក់ (${invalidCashRow.endCounter.toLocaleString()}) មិនអាចទាបជាងកុងទ័រផ្ដើមសាច់ប្រាក់ (${invalidCashRow.startCounter.toLocaleString()}) ឡើយ (ត្រូវតែមានការជំនះដោយ Admin)។`);
        } else {
          showToast('error', lang === 'en'
            ? `Error (Day ${invalidAbaRow.day}): ABA End Counter (${invalidAbaRow.endCounterAba.toLocaleString()}) cannot be lower than ABA Start Counter (${invalidAbaRow.startCounterAba.toLocaleString()}) unless overridden by Admin.`
            : `កំហុស (ថ្ងៃទី ${invalidAbaRow.day})៖ កុងទ័របញ្ចប់ ABA (${invalidAbaRow.endCounterAba.toLocaleString()}) មិនអាចទាបជាងកុងទ័រផ្ដើម ABA (${invalidAbaRow.startCounterAba.toLocaleString()}) ឡើយ (ត្រូវតែមានការជំនះដោយ Admin)។`);
        }
        return;
      }
    }

    const dirtyRows = processedRows.filter(r => r.isDirty || !r.exists);
    if (dirtyRows.length === 0) {
      setSaveStatus(lang === 'en' ? 'All records are already written up-to-date.' : 'កំណត់ត្រាទាំងអស់ពិតជាបានរក្សាទម្រង់ចុងក្រោយបង្អស់រួចរាល់ហើយ។');
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    setRevenueRecords(prev => {
      let nextList = [...prev];

      dirtyRows.forEach(row => {
        const matchId = row.recordId || `rev_${selectedBranchId}_${row.date}`;
        const newRec: RevenueRecord = {
          id: matchId,
          branchId: selectedBranchId,
          date: row.date,
          time: row.time,
          startCounter: row.startCounter,
          endCounter: row.endCounter,
          startCounterAba: row.startCounterAba,
          endCounterAba: row.endCounterAba,
          counterRevenue: row.cash + row.aba,
          cash: row.cash,
          aba: row.aba,
          coinCount: row.coinCount || 0,
          coinSales: row.coinSales || 0,
          dailyRevenue: row.dailyRevenue,
          bankDeposit: row.bankDeposit || 0,
          remainingCash: row.remainingCash || 0,
          actualCashCount: row.actualCashCount || 0,
          difference: row.difference || 0,
          note: row.note,
          amountUsd: parseFloat((row.dailyRevenue / exchangeRate).toFixed(2)),
          amountKhr: row.dailyRevenue,
          paymentMethod: row.aba >= row.cash ? 'ABA' : 'Cash',
          createdBy: currentRole,
          createdAt: nextList.find(x => x.id === matchId)?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'Submitted'
        };

        const existingIdx = nextList.findIndex(x => x.id === matchId);
        if (existingIdx > -1) {
          nextList[existingIdx] = newRec;
        } else {
          nextList.push(newRec);
        }
      });

      return nextList;
    });

    setLocalRows(prev => prev.map(r => ({ 
      ...r, 
      isDirty: false, 
      exists: true, 
      recordId: r.recordId || `rev_${selectedBranchId}_${r.date}` 
    })));
    setSaveStatus(lang === 'en' ? `Successfully saved month sheet logs` : `រក្សាទុកទិន្នន័យទំព័រកត់ត្រាខែនេះបានជោគជ័យ`);
    setTimeout(() => setSaveStatus(null), 3500);

    onAddLog(`Batch saved ${dirtyRows.length} daily counter records for branch "${selectedBranchName}" (Month: ${getMonthAbbr(selectedMonth)} ${selectedYear})`);

    notifyBatchSaveCompleted({
      branchId: selectedBranchId,
      branchName: selectedBranchName,
      category: 'revenue',
      month: selectedMonth,
      year: selectedYear,
      count: dirtyRows.length,
      role: currentRole
    }).catch(err => console.warn('Batch Telegram notify error:', err));
  };

  // ----------------------------------------------------
  // EXPORT XLSX & PRINT
  // ----------------------------------------------------
  const handleExportExcel = (asBlank: boolean = false) => {
    const headers = [
      lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ',
      lang === 'en' ? 'Time' : 'ម៉ោង',
      lang === 'en' ? 'Start Counter' : 'កុងទ័រផ្ដើម',
      lang === 'en' ? 'End Counter' : 'កុងទ័របញ្ចប់',
      lang === 'en' ? 'Expected Revenue' : 'ចំណូលរំពឹងទុក (៛)',
      lang === 'en' ? 'Cash Revenue' : 'លុយសុទ្ធ (៛)',
      lang === 'en' ? 'ABA Revenue' : 'អេប៊ីអេ (៛)',
      lang === 'en' ? 'Coin Quantity' : 'ចំនួនកាក់ក្រៅ (កាក់)',
      lang === 'en' ? 'Outside Coin Sales' : 'លក់កាក់ក្រៅ (៛)',
      lang === 'en' ? 'Daily Revenue' : 'លុយសរុបប្រចាំថ្ងៃ (៛)',
      lang === 'en' ? 'Bank Deposit' : 'ចូលធនាគារ (៛)',
      lang === 'en' ? 'Actual Cash Count' : 'សាច់ប្រាក់រាប់ជាក់ស្ដែង (៛)',
      lang === 'en' ? 'Difference' : 'លំអៀង (៛)',
      lang === 'en' ? 'Notes' : 'ចំណាំ'
    ];

    const rows = asBlank
      ? processedRows.map(r => [
          r.label,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          ''
        ])
      : processedRows.map(r => [
          r.label,
          r.time,
          r.startCounter,
          r.endCounter,
          r.counterRevenue,
          r.cash,
          r.aba,
          r.coinCount || 0,
          r.coinSales || 0,
          r.dailyRevenue,
          r.bankDeposit,
          r.actualCashCount,
          r.difference,
          r.note
        ]);

    // Totals row at the bottom
    rows.push([
      lang === 'en' ? 'Sheet Totals' : 'សរុបប្រចាំខែ',
      '',
      '',
      '',
      asBlank ? '' : processedRows.reduce((a, b) => a + (b.counterRevenue || 0), 0),
      asBlank ? '' : sumCash,
      asBlank ? '' : sumAba,
      asBlank ? '' : sumCoinCount,
      asBlank ? '' : sumCoinSales,
      asBlank ? '' : sumRevenue,
      asBlank ? '' : sumBankDeposit,
      asBlank ? '' : processedRows.reduce((a, b) => a + (b.actualCashCount || 0), 0),
      asBlank ? '' : processedRows.reduce((a, b) => a + (b.difference || 0), 0),
      ''
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, asBlank ? "Blank Ledger Template" : "Branch Revenue");

    const safeBranchStr = selectedBranchName.replace(/\s+/g, '_');
    const prefix = asBlank ? 'Clean24_BlankLedger_' : 'Clean24_RevenueBook_';
    XLSX.writeFile(workbook, `${prefix}${safeBranchStr}_${getMonthAbbr(selectedMonth)}_${selectedYear}.xlsx`);
    onAddLog(`Exported ${asBlank ? 'Blank Ledger Template' : 'Counter Book'} for branch "${selectedBranchName}" to Excel`);
  };

  const triggerTelegramModal = (row: any) => {
    setTelegramModalRow(row);
    setAlertSuccess(null);
  };

  const handleSendTelegram = async () => {
    if (!telegramModalRow) return;
    
    setAlertSuccess(lang === 'en' ? 'Sending to Telegram...' : 'កំពុងផ្ញើទៅកាន់ Telegram...');
    
    const res = await notifyRevenueRecordSaved({
      branchId: selectedBranchId,
      branchName: selectedBranchName,
      dateLabel: telegramModalRow.label,
      row: telegramModalRow,
      exchangeRate,
      role: currentRole
    });

    if (res.success) {
      setAlertSuccess(lang === 'en' ? 'Telegram summary sent!' : 'ផ្ញើទៅកាន់ Telegram បានរួចរាល់!');
      onAddLog(`Telegram summary alert was dispatched for "${selectedBranchName}" on ${telegramModalRow.label}. Cash: ${formatKHR(telegramModalRow.cash)}, ABA: ${formatKHR(telegramModalRow.aba)}${telegramModalRow.coinSales ? `, Coin: ${formatKHR(telegramModalRow.coinSales)}` : ''}, Total: ${formatKHR(telegramModalRow.dailyRevenue)}.`);
    } else {
      setAlertSuccess(lang === 'en' ? `Notice: (Telegram: ${res.error || 'Failed'})` : `បរាជ័យ (Telegram: ${res.error || 'បរាជ័យក្នុងការផ្ញើ'})`);
    }
    
    setTimeout(() => {
      setTelegramModalRow(null);
      setAlertSuccess(null);
    }, 2000);
  };

  // ----------------------------------------------------
  // REPORTS COMPUTATIONS
  // ----------------------------------------------------
  const activeDailyDataReport = useMemo(() => {
    return processedRows.filter(r => r.cash > 0 || r.aba > 0 || r.coinSales > 0 || r.exists);
  }, [processedRows]);

  const monthlyDataReport = useMemo(() => {
    const list = [];
    for (let m = 1; m <= 12; m++) {
      const monthPrefix = `${selectedYear}-${String(m).padStart(2, '0')}`;
      const branchRecords = revenueRecords.filter(r => r.branchId === selectedBranchId && r.date.startsWith(monthPrefix));

      const mCash = branchRecords.reduce((s, c) => s + (c.cash || 0), 0);
      const mAba = branchRecords.reduce((s, c) => s + (c.aba || 0), 0);
      const mCoin = branchRecords.reduce((s, c) => s + (c.coinSales || 0), 0);
      const mDeposit = branchRecords.reduce((s, c) => s + (c.bankDeposit || 0), 0);
      const mTotalRev = mCash + mAba + mCoin;
      const mRemaining = Math.max(0, mTotalRev - mDeposit);

      list.push({
        num: m,
        monthName: lang === 'en' ? months[m-1].fullEn : months[m-1].fullKh,
        cash: mCash,
        aba: mAba,
        coinSales: mCoin,
        deposit: mDeposit,
        remaining: mRemaining,
        total: mTotalRev
      });
    }
    return list;
  }, [revenueRecords, selectedBranchId, selectedYear, months, lang]);

  const yearlyDataReport = useMemo(() => {
    return branches.map(br => {
      const suffixYear = `${selectedYear}`;
      const brRecords = revenueRecords.filter(r => r.branchId === br.id && r.date.startsWith(suffixYear));

      const yCash = brRecords.reduce((s, c) => s + (c.cash || 0), 0);
      const yAba = brRecords.reduce((s, c) => s + (c.aba || 0), 0);
      const yCoin = brRecords.reduce((s, c) => s + (c.coinSales || 0), 0);
      const yDeposit = brRecords.reduce((s, c) => s + (c.bankDeposit || 0), 0);
      const yTotal = yCash + yAba + yCoin;
      const yRemaining = Math.max(0, yTotal - yDeposit);

      return {
        id: br.id,
        name: br.branchName,
        cash: yCash,
        aba: yAba,
        coinSales: yCoin,
        deposit: yDeposit,
        remaining: yRemaining,
        total: yTotal
      };
    });
  }, [branches, revenueRecords, selectedYear]);

  const branchDataReport = useMemo(() => {
    return branches.map(br => {
      const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const brRecords = revenueRecords.filter(r => r.branchId === br.id && r.date.startsWith(monthPrefix));

      const bCash = brRecords.reduce((s, c) => s + (c.cash || 0), 0);
      const bAba = brRecords.reduce((s, c) => s + (c.aba || 0), 0);
      const bCoin = brRecords.reduce((s, c) => s + (c.coinSales || 0), 0);
      const bDeposit = brRecords.reduce((s, c) => s + (c.bankDeposit || 0), 0);
      const bTotal = bCash + bAba + bCoin;
      const bRemaining = Math.max(0, bTotal - bDeposit);

      return {
        id: br.id,
        name: br.branchName,
        cash: bCash,
        aba: bAba,
        coinSales: bCoin,
        deposit: bDeposit,
        remaining: bRemaining,
        total: bTotal
      };
    });
  }, [branches, revenueRecords, selectedYear, selectedMonth]);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 py-4 font-sans text-slate-800" id="revenue-records-module">
      
      {/* HEADER BAR (Print Hidden) */}
      <div className="flex justify-end items-center mb-4 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('sheet')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'sheet' 
                ? 'bg-cyan-600 text-white shadow-xs' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            📊 {lang === 'en' ? 'Sheet Register' : 'សន្លឹកសៀវភៅបញ្ជី'}
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'reports' 
                ? 'bg-cyan-600 text-white shadow-xs' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            📈 {tLocal.reportsCenter}
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 mb-5 print:hidden flex flex-col md:flex-row flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Branch Selector */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase">{lang === 'en' ? 'Active Branch' : 'សាខាបោកអ៊ុត'}</span>
            {branches.length > 1 ? (
              <select
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {branches.map(br => (
                  <option key={br.id} value={br.id}>{br.branchName}</option>
                ))}
              </select>
            ) : (
              <div className="px-2.5 py-1.5 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-800 text-xs font-bold whitespace-nowrap">
                {branches[0]?.branchName || 'Branch'}
              </div>
            )}
          </div>

          {/* Month Selector */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase">{lang === 'en' ? 'Month' : 'ជ្រើសរើសខែ'}</span>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold focus:outline-none appearance-none"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>
                    {lang === 'en' ? m.fullEn : m.fullKh}
                  </option>
                ))}
              </select>
              <Calendar className="absolute left-2 top-2.5 w-3 h-3 text-cyan-500" />
            </div>
          </div>

          {/* Year Selector */}
          <div className="flex flex-col gap-1 min-w-[90px]">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase">{lang === 'en' ? 'Year' : 'ឆ្នាំកត់ត្រា'}</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold focus:outline-none"
            >
              {years.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end md:self-auto">
          {activeTab === 'sheet' && (
            <>
              <button
                onClick={saveAllRows}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black rounded-lg flex items-center gap-1 shadow-xs transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                {tLocal.saveMonthData}
              </button>

              <button
                onClick={() => {
                  setIsBlankPrint(false);
                  setIsPdfModalOpen(true);
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-lg flex items-center gap-1 transition-all shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                {lang === 'en' ? 'Export PDF' : 'នាំចេញជា PDF'}
              </button>

              <button
                onClick={() => {
                  setIsBlankPrint(true);
                  setIsPdfModalOpen(true);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                title={lang === 'en' ? 'Export or print blank handwriting table' : 'ទាញយក ឬបោះពុម្ពតារាងទទេសម្រាប់សរសេរដៃ'}
              >
                <FileText className="w-3.5 h-3.5" />
                {lang === 'en' ? 'Blank Form' : 'ទម្រង់ទទេ (សរសេរដៃ)'}
              </button>
            </>
          )}

          <button
            onClick={() => handleExportExcel(false)}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-black rounded-lg flex items-center gap-1 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {tLocal.exportExcel}
          </button>
        </div>
      </div>

      {/* AUTO ACTION NOTIFICATION */}
      {saveStatus && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-bounce print:hidden">
          <Check className="w-4 h-4 text-emerald-600" />
          {saveStatus}
        </div>
      )}

      {toastAlert && (
        <div 
          id={toastAlert.type === 'success' ? 'toast-success' : 'toast-error'} 
          className={`p-4 rounded-xl flex items-center gap-3 text-xs mb-4 border transition-all animate-fade-in print:hidden ${
            toastAlert.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {toastAlert.type === 'success' ? (
            <Check className="text-emerald-600 shrink-0" size={16} />
          ) : (
            <Info className="text-rose-600 shrink-0" size={16} />
          )}
          <span>{toastAlert.message}</span>
        </div>
      )}

      {/* ====================================================
          VIEW 1: REGISTER BOOK SPREADSHEET (HANDWRITTEN STYLE MATCH)
          ==================================================== */}
      {activeTab === 'sheet' && (
        <div className="space-y-4">
          
          {/* Cyan paper binder theme banner */}
          <div className="bg-cyan-700 border-2 border-cyan-800 rounded-t-2xl p-4 text-center shadow-xs">
            <h2 className="text-white font-black uppercase text-sm md:text-base tracking-widest font-sans">
              Revenue Clean Wash and Dry ({selectedBranchName})
            </h2>
            <span className="text-cyan-100 font-bold block text-xs tracking-wider mt-1">
              តារាងគណនាកុងទ័រនិងចំណូលប្រចាំថ្ងៃ ({getMonthAbbr(selectedMonth)} {selectedYear})
            </span>
          </div>

          <div className="bg-white border-2 border-slate-300 rounded-b-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" style={{ minWidth: '1200px' }}>
                <thead>
                  {/* High fidelity cyan main headers matching PDF layout */}
                  <tr className="bg-cyan-600 text-white border-b-2 border-cyan-800 text-center font-bold text-xs select-none">
                    <th className="py-2.5 px-2 border-r border-cyan-700 w-[110px] uppercase font-sans tracking-wide">
                      ថ្ងៃ/ម៉ោង<br/><span className="text-[9px] font-normal tracking-normal">(Date / Time)</span>
                    </th>
                    <th className="py-2.5 px-2 border-r border-cyan-700 w-[150px] uppercase font-sans">
                      កុងទ័រចាប់ផ្តើម<br/><span className="text-[9px] font-normal tracking-normal">(Start Counter)</span>
                    </th>
                    <th className="py-2.5 px-2 border-r border-cyan-700 w-[150px] uppercase font-sans">
                      កុងទ័របញ្ចប់<br/><span className="text-[9px] font-normal tracking-normal">(End Counter)</span>
                    </th>
                    <th className="py-2.5 px-2 border-r border-cyan-700 w-[120px] uppercase font-sans bg-cyan-700/65">
                      លុយសុទ្ធ<br/><span className="text-[9px] font-normal tracking-normal">(Cash Revenue)</span>
                    </th>
                    <th className="py-2.5 px-2 border-r border-cyan-700 w-[120px] uppercase font-sans bg-cyan-700/65">
                      ABA<br/><span className="text-[9px] font-normal tracking-normal">(ABA Revenue)</span>
                    </th>
                    <th className="py-2.5 px-2 border-r border-cyan-700 w-[130px] uppercase font-sans bg-cyan-700/65">
                      លក់កាក់ក្រៅ<br/><span className="text-[9px] font-normal tracking-normal">(Coin Sales)</span>
                    </th>
                    <th className="py-2.5 px-2 border-r border-cyan-700 w-[140px] uppercase font-sans bg-cyan-700">
                      លុយសរុបប្រចាំថ្ងៃ<br/><span className="text-[9px] font-normal tracking-normal">(Daily Revenue)</span>
                    </th>
                    <th className="py-2.5 px-2 border-r border-cyan-700 w-[180px] uppercase font-sans">
                      ចំណាំ<br/><span className="text-[9px] font-normal tracking-normal">(Notes)</span>
                    </th>
                    <th className="py-2.5 px-2 w-[110px] uppercase font-sans print:hidden">
                      សកម្មភាព<br/><span className="text-[9px] font-normal tracking-normal">(Action)</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="text-xs border-t border-slate-300 divide-y-2 divide-slate-300">
                  {processedRows.map((row, index) => {
                    const isDirty = row.isDirty;
                    const isSavedNow = savedRowIndex === index;
                    const isCashNegative = row.endCounter > 0 && row.startCounter > 0 && row.endCounter < row.startCounter;
                    const isAbaNegative = row.endCounterAba > 0 && row.startCounterAba > 0 && row.endCounterAba < row.startCounterAba;

                    // Strictly take previous data: previous row's end counter, or Day 1's previous month end counter
                    const prevEndCash = index === 0
                      ? (revenueRecords
                          .filter(r => r.branchId === selectedBranchId && r.date < formatYYYYMMDD(1) && (r.endCounter || 0) > 0)
                          .sort((a, b) => b.date.localeCompare(a.date))[0]?.endCounter || 0)
                      : (localRows[index - 1]?.endCounter || 0);

                    const prevEndAba = index === 0
                      ? (revenueRecords
                          .filter(r => r.branchId === selectedBranchId && r.date < formatYYYYMMDD(1) && (r.endCounterAba || 0) > 0)
                          .sort((a, b) => b.date.localeCompare(a.date))[0]?.endCounterAba || 0)
                      : (localRows[index - 1]?.endCounterAba || 0);

                    return (
                      <React.Fragment key={row.day}>
                        {/* Sub-row 1: Cash Counter & Cash Revenue */}
                        <tr className={`transition-colors border-t border-slate-300 ${isDirty ? 'bg-amber-50/20' : ''} ${isSavedNow ? 'bg-cyan-50/70' : 'bg-white hover:bg-slate-50/40'}`}>
                          {/* 1. Date/Time Label */}
                          <td rowSpan={2} className="py-2 px-2 border-r border-slate-200 text-center select-none bg-slate-50 text-slate-755 align-middle">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className="font-extrabold font-mono text-xs tracking-tight text-slate-800 leading-none">{row.label}</span>
                              <div className="flex items-center justify-center gap-0.5 border border-slate-200 bg-white px-1.5 py-0.5 rounded-lg w-[68px]">
                                <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <input 
                                  type="text"
                                  value={row.time}
                                  onChange={(e) => handleCellChange(index, 'time', e.target.value)}
                                  className="w-8 text-center font-bold font-mono text-[10px] text-slate-600 bg-transparent focus:outline-none" 
                                />
                              </div>
                            </div>
                          </td>

                          {/* 2. Cash Start Counter */}
                          <td className="p-1.5 border-r border-slate-200 border-b border-slate-200">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1 rounded-lg px-2 py-1 border border-amber-200 bg-amber-50/10 focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400">
                                <span className="text-[9px] font-bold text-amber-700 uppercase">Cash</span>
                                <input
                                  type="number"
                                  value={row.startCounter === 0 ? '' : row.startCounter}
                                  onChange={(e) => handleCellChange(index, 'startCounter', e.target.value)}
                                  placeholder="0"
                                  className="w-full text-right font-black font-mono focus:outline-none text-xs text-slate-800 bg-transparent"
                                />
                              </div>
                              {prevEndCash > 0 && row.startCounter === 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleCellChange(index, 'startCounter', prevEndCash)}
                                  className="text-left text-[9px] text-cyan-600 hover:text-cyan-800 font-bold mt-1 block select-none bg-cyan-50/50 hover:bg-cyan-50 border border-cyan-100 px-1 py-0.5 rounded cursor-pointer transition-colors"
                                >
                                  💡 Suggested: {prevEndCash.toLocaleString()}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 3. Cash End Counter */}
                          <td className="p-1.5 border-r border-slate-200 border-b border-slate-200">
                            <div className={`flex items-center gap-1 border rounded-lg px-2 py-1 ${isCashNegative ? 'bg-rose-50 border-rose-300' : 'bg-sky-50/20 border-sky-100'}`}>
                              <span className="text-[9px] font-bold text-sky-700 uppercase">Cash</span>
                              <input
                                type="number"
                                value={row.endCounter === 0 ? '' : row.endCounter}
                                onChange={(e) => handleCellChange(index, 'endCounter', e.target.value)}
                                placeholder="0"
                                className={`w-full text-right font-black font-mono focus:outline-none text-xs ${isCashNegative ? 'text-rose-700 bg-transparent' : 'text-blue-900 bg-transparent'}`}
                              />
                            </div>
                            {isCashNegative && (
                              <span className="text-[8px] text-rose-650 bg-rose-100 px-1 py-0.5 rounded font-black uppercase mt-1 block text-center animate-pulse leading-none">
                                ⚠️ End &lt; Start
                              </span>
                            )}
                          </td>

                          {/* 4. Cash Revenue */}
                          <td className={`p-2 border-r border-slate-200 border-b border-slate-200 text-center transition-all ${isCashNegative ? 'bg-rose-50' : 'bg-slate-50/60'}`}>
                            <span className={`font-black font-mono text-xs block ${isCashNegative ? 'text-rose-600' : 'text-blue-700'}`}>
                              {row.cash < 0 ? '-' : ''}{formatKHR(Math.abs(row.cash))}
                            </span>
                          </td>

                          {/* 5. ABA Revenue (Empty on Sub-row 1) */}
                          <td className="p-2 border-r border-slate-200 border-b border-slate-200 bg-slate-50/30"></td>

                          {/* 6. Outside Coin Sales (លក់កាក់ក្រៅ: 1 coin = 1,000 KHR) */}
                          <td rowSpan={2} className="p-1.5 border-r border-slate-200 align-middle bg-cyan-50/20">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 rounded-lg px-2 py-1.5 border border-cyan-200 bg-white focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500">
                                <Coins className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                                <input
                                  type="number"
                                  value={row.coinCount === 0 ? '' : row.coinCount}
                                  onChange={(e) => handleCellChange(index, 'coinCount', e.target.value)}
                                  placeholder="0"
                                  className="w-full text-right font-black font-mono focus:outline-none text-xs text-cyan-900 bg-transparent"
                                />
                                <span className="text-[10px] font-bold text-slate-400 select-none">កាក់</span>
                              </div>
                              <div className="flex items-center justify-end gap-1 px-1">
                                <span className="text-[10px] text-slate-400 font-medium select-none">=</span>
                                <span className="text-[11px] text-cyan-700 font-black font-mono leading-none">
                                  {formatKHR(row.coinSales || 0)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 7. Daily Revenue */}
                          <td rowSpan={2} className="p-2 border-r border-slate-200 text-center bg-cyan-50/70 align-middle">
                            <span className="font-black font-mono text-xs text-cyan-950 block">
                              {formatKHR(row.dailyRevenue)}
                            </span>
                            <span className="text-[9px] text-cyan-600 block leading-none font-bold mt-0.5">
                              {formatUSD(row.dailyRevenue)}
                            </span>
                          </td>

                          {/* 8. Notes (ចំណាំ - Moved to the end!) */}
                          <td rowSpan={2} className="p-1.5 border-r border-slate-200 align-middle">
                            <textarea
                              value={row.note || ''}
                              onChange={(e) => handleCellChange(index, 'note', e.target.value)}
                              placeholder={lang === 'en' ? 'Notes...' : 'ចំណាំ...'}
                              rows={2}
                              className="w-full bg-white text-xs border border-slate-200 p-1.5 rounded-md focus:outline-none focus:border-cyan-500 resize-none overflow-hidden hover:border-slate-350 min-h-[52px] font-sans"
                            />
                          </td>

                          {/* 10. Actions */}
                          <td rowSpan={2} className="py-2.5 px-2 text-center bg-slate-50/40 print:hidden align-middle">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <button
                                onClick={() => saveRow(index)}
                                className={`w-full py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1 shadow-xs ${
                                  isDirty 
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse' 
                                    : 'bg-emerald-600 hover:bg-emerald-750 text-white'
                                }`}
                              >
                                <Save className="w-3 h-3" />
                                {lang === 'en' ? 'Save' : 'រក្សាទុក'}
                              </button>
                              <button
                                onClick={() => triggerTelegramModal(row)}
                                className="w-full py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-[10px] font-black flex items-center justify-center gap-0.5 cursor-pointer"
                              >
                                <Send className="w-2.5 h-2.5" />
                                {lang === 'en' ? 'Telegram' : 'ផ្ញើ'}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Sub-row 2: ABA Counter & ABA Revenue */}
                        <tr className={`transition-colors border-b border-slate-300 ${isDirty ? 'bg-amber-50/20' : ''} ${isSavedNow ? 'bg-cyan-50/70' : 'bg-white hover:bg-slate-50/40'}`}>
                          {/* ABA Start Counter */}
                          <td className="p-1.5 border-r border-slate-200">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1 rounded-lg px-2 py-1 border border-amber-200 bg-amber-50/10 focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400">
                                <span className="text-[9px] font-bold text-purple-700 uppercase">ABA</span>
                                <input
                                  type="number"
                                  value={row.startCounterAba === 0 ? '' : row.startCounterAba}
                                  onChange={(e) => handleCellChange(index, 'startCounterAba', e.target.value)}
                                  placeholder="0"
                                  className="w-full text-right font-black font-mono focus:outline-none text-xs text-slate-800 bg-transparent"
                                />
                              </div>
                              {prevEndAba > 0 && row.startCounterAba === 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleCellChange(index, 'startCounterAba', prevEndAba)}
                                  className="text-left text-[9px] text-cyan-600 hover:text-cyan-800 font-bold mt-1 block select-none bg-cyan-50/50 hover:bg-cyan-50 border border-cyan-100 px-1 py-0.5 rounded cursor-pointer transition-colors"
                                >
                                  💡 Suggested: {prevEndAba.toLocaleString()}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* ABA End Counter */}
                          <td className="p-1.5 border-r border-slate-200">
                            <div className={`flex items-center gap-1 border rounded-lg px-2 py-1 ${isAbaNegative ? 'bg-rose-50 border-rose-300' : 'bg-purple-50/10 border-purple-100'}`}>
                              <span className="text-[9px] font-bold text-purple-700 uppercase">ABA</span>
                              <input
                                type="number"
                                value={row.endCounterAba === 0 ? '' : row.endCounterAba}
                                onChange={(e) => handleCellChange(index, 'endCounterAba', e.target.value)}
                                placeholder="0"
                                className={`w-full text-right font-black font-mono focus:outline-none text-xs ${isAbaNegative ? 'text-rose-700 bg-transparent' : 'text-purple-800 bg-transparent'}`}
                              />
                            </div>
                            {isAbaNegative && (
                              <span className="text-[8px] text-rose-650 bg-rose-100 px-1 py-0.5 rounded font-black uppercase mt-1 block text-center animate-pulse leading-none">
                                ⚠️ End &lt; Start
                              </span>
                            )}
                          </td>

                          {/* Cash Revenue (Empty on Sub-row 2) */}
                          <td className="p-2 border-r border-slate-200 bg-slate-50/30"></td>

                          {/* ABA Revenue */}
                          <td className={`p-2 border-r border-slate-200 text-center transition-all ${isAbaNegative ? 'bg-rose-50' : 'bg-slate-50/60'}`}>
                            <span className={`font-black font-mono text-xs block ${isAbaNegative ? 'text-rose-600' : 'text-purple-800'}`}>
                              {row.aba < 0 ? '-' : ''}{formatKHR(Math.abs(row.aba))}
                            </span>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* BOTTOM TOTALS REVENUE (MONTHLY SUMMARY) */}
                  <tr className="bg-cyan-700 text-white border-t-4 border-cyan-800 font-bold text-xs select-none">
                    <td className="py-3 px-2 text-center border-r border-cyan-800 uppercase tracking-widest font-black">
                      {lang === 'en' ? 'Totals:' : 'សរុបប្រចាំខែ:'}
                    </td>
                    <td colSpan={2} className="py-3 px-2 text-left border-r border-cyan-800 font-sans italic text-cyan-200 text-[10px]">
                      {lang === 'en' ? 'Monthly Carry-Forward Aggregation Summary:' : 'ផលបូកសរុបប្រចាំខែជាក់ស្ដែង:'}
                    </td>
                    <td className="py-3 px-2 text-right border-r border-cyan-800 bg-cyan-800 font-mono text-xs">
                      {formatKHR(sumCash)}
                    </td>
                    <td className="py-3 px-2 text-right border-r border-cyan-800 bg-cyan-800 font-mono text-xs">
                      {formatKHR(sumAba)}
                    </td>
                    <td className="py-3 px-2 text-right border-r border-cyan-800 bg-cyan-800 font-mono text-xs">
                      <div>{formatKHR(sumCoinSales)}</div>
                      <div className="text-[10px] text-cyan-200 font-normal">({sumCoinCount} កាក់)</div>
                    </td>
                    <td className="py-3 px-2 text-center border-r border-cyan-800 bg-cyan-900 font-mono text-sm font-black text-emerald-100">
                      {formatKHR(sumRevenue)}
                    </td>
                    <td className="py-3 px-2 text-center border-r border-cyan-800 italic font-semibold text-cyan-100 text-[10px]">
                      {lang === 'en' ? 'Month Summary' : 'សង្ខេប'}
                    </td>
                    <td className="py-3 px-2 italic font-semibold text-cyan-100 text-[10px] print:hidden">
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bottom Register Action Strip */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
              <span className="text-xs text-slate-500 font-bold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-cyan-500" />
                {lang === 'en' 
                  ? 'All counter discrepancies calculate instantly. Hit Save All to sync changes.' 
                  : 'រាល់លេខកុងទ័រត្រូវបានគណនាដោយស្វ័យប្រវត្តិ។ ចុចរក្សាទុកទិន្នន័យខែនេះទាំងអស់ដើម្បីបញ្ចប់។'}
              </span>
              <button
                onClick={saveAllRows}
                className="w-full sm:w-auto px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Save className="w-4 h-4" />
                {lang === 'en' ? 'Commit All Monthly Entries' : 'រក្សាទុកទិន្នន័យកុងទ័រទាំងអស់'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          VIEW 2: REPORTS CENTER
          ==================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-4 print:hidden">
          
          {/* Inner report tabs selector */}
          <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
            <button
              onClick={() => setReportSubTab('daily')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                reportSubTab === 'daily' 
                  ? 'text-cyan-700 border-b-2 border-cyan-600 font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📝 {tLocal.dailyReport}
            </button>
            <button
              onClick={() => setReportSubTab('monthly')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                reportSubTab === 'monthly' 
                  ? 'text-cyan-700 border-b-2 border-cyan-600 font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📅 {tLocal.monthlyReport}
            </button>
            <button
              onClick={() => setReportSubTab('yearly')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                reportSubTab === 'yearly' 
                  ? 'text-cyan-700 border-b-2 border-cyan-600 font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📆 {tLocal.yearlyReport}
            </button>
            <button
              onClick={() => setReportSubTab('branch')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                reportSubTab === 'branch' 
                  ? 'text-cyan-700 border-b-2 border-cyan-600 font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🏢 {tLocal.branchReport}
            </button>
          </div>

          {/* SubTab 1: Daily Revenue */}
          {reportSubTab === 'daily' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    {lang === 'en' ? 'Active Daily Ledger Logs' : 'បញ្ជីចំណូលប្រចាំថ្ងៃសកម្ម'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'en' ? `Days recorded for ${selectedBranchName}` : `ថ្ងៃដែលមានការកត់ត្រាសម្រាប់សាខា ${selectedBranchName}`}
                  </p>
                </div>
                <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-mono font-bold">
                  {activeDailyDataReport.length} {lang === 'en' ? 'Days' : 'ថ្ងៃ'}
                </span>
              </div>

              {activeDailyDataReport.length === 0 ? (
                <div className="text-center py-10 text-slate-400 italic text-xs">
                  {lang === 'en' ? 'No revenue records entered for current month.' : 'មិនទាន់មានការកត់ត្រាចំណូលសម្រាប់ខែនេះនៅឡើយទេ។'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <th className="py-2.5 px-3 font-bold">{lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ'}</th>
                        <th className="py-2.5 px-3 text-right font-bold">{lang === 'en' ? 'Cash Amount' : 'សាច់ប្រាក់'}</th>
                        <th className="py-2.5 px-3 text-right font-bold">{lang === 'en' ? 'ABA Amount' : 'អេប៊ីអេ'}</th>
                        <th className="py-2.5 px-3 text-right font-bold">{lang === 'en' ? 'Outside Coin Sales' : 'លក់កាក់ក្រៅ'}</th>
                        <th className="py-2.5 px-3 text-right font-bold">{lang === 'en' ? 'Total Revenue' : 'លុយសរុបប្រចាំថ្ងៃ'}</th>
                        <th className="py-2.5 px-3 text-right font-bold">{lang === 'en' ? 'Bank Deposit' : 'ចូលធនាគារ'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono font-medium">
                      {activeDailyDataReport.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-sans font-bold text-slate-600">{r.label}</td>
                          <td className="py-2 px-3 text-right text-blue-800">{formatKHR(r.cash)}</td>
                          <td className="py-2 px-3 text-right text-purple-800">{formatKHR(r.aba)}</td>
                          <td className="py-2 px-3 text-right text-cyan-800 font-bold">
                            <div>{formatKHR(r.coinSales || 0)}</div>
                            {r.coinCount ? <div className="text-[10px] text-slate-400 font-normal">({r.coinCount} កាក់)</div> : null}
                          </td>
                          <td className="py-2 px-3 text-right text-cyan-950 font-black">{formatKHR(r.dailyRevenue)}</td>
                          <td className="py-2 px-3 text-right text-amber-800">{formatKHR(r.bankDeposit)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-black border-t border-slate-200">
                        <td className="py-2.5 px-3 font-sans">{lang === 'en' ? 'Ledger Totals' : 'ផលសរុបជារួម'}</td>
                        <td className="py-2.5 px-3 text-right text-blue-800">{formatKHR(sumCash)}</td>
                        <td className="py-2.5 px-3 text-right text-purple-800">{formatKHR(sumAba)}</td>
                        <td className="py-2.5 px-3 text-right text-cyan-800">
                          <div>{formatKHR(sumCoinSales)}</div>
                          <div className="text-[10px] text-slate-500 font-normal">({sumCoinCount} កាក់)</div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-cyan-950">{formatKHR(sumRevenue)}</td>
                        <td className="py-2.5 px-3 text-right text-amber-800">{formatKHR(sumBankDeposit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SubTab 2: Monthly Comparison */}
          {reportSubTab === 'monthly' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 mb-4">
                📊 {lang === 'en' ? `Monthly Summary for Year ${selectedYear}` : `ផលសរុបប្រចាំខែនីមួយៗសម្រាប់ឆ្នាំ ${selectedYear}`}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-bold">
                      <th className="py-2 px-3">{lang === 'en' ? 'Month' : 'ខែ'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'Accumulated Cash' : 'សាច់ប្រាក់សរុប'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'Accumulated ABA' : 'ABA សរុប'}</th>
                      <th className="py-2 px-3 text-right font-black text-cyan-900">{lang === 'en' ? 'Total Revenue' : 'ចំណូលសរុប'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'Deposited' : 'បានចូលធនាគារ'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'Handover Cash' : 'ប្រាក់ប្រគល់សល់'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono font-bold">
                    {monthlyDataReport.map((m, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-sans text-slate-750 text-xs">{m.monthName}</td>
                        <td className="py-2.5 px-3 text-right text-blue-700">{formatKHR(m.cash)}</td>
                        <td className="py-2.5 px-3 text-right text-purple-700">{formatKHR(m.aba)}</td>
                        <td className="py-2.5 px-3 text-right text-cyan-800">{formatKHR(m.total)}</td>
                        <td className="py-2.5 px-3 text-right text-amber-700">{formatKHR(m.deposit)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-800">{formatKHR(m.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SubTab 3: Yearly Comparison */}
          {reportSubTab === 'yearly' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 mb-4">
                🏢 {lang === 'en' ? `Yearly Branch Breakdown for ${selectedYear}` : `របាយការណ៍សាខាប្រចាំឆ្នាំ ${selectedYear}`}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-650 font-bold border-b border-slate-200">
                      <th className="py-2 px-3">{lang === 'en' ? 'Branch Name' : 'ឈ្មោះសាខា'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'Yearly Cash' : 'សាច់ប្រាក់ឆ្នាំ'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'Yearly ABA' : 'ABA ឆ្នាំ'}</th>
                      <th className="py-2 px-3 text-right text-cyan-900 font-black">{lang === 'en' ? 'Gross Revenue' : 'ចំណូលរួម'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'Deposits In Bank' : 'ចូលធនាគារ'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'Handover Cash' : 'ប្រាក់រួមសល់'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono font-bold">
                    {yearlyDataReport.map((b, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-sans text-slate-800">{b.name}</td>
                        <td className="py-2.5 px-3 text-right text-blue-700">{formatKHR(b.cash)}</td>
                        <td className="py-2.5 px-3 text-right text-purple-700">{formatKHR(b.aba)}</td>
                        <td className="py-2.5 px-3 text-right text-cyan-800">{formatKHR(b.total)}</td>
                        <td className="py-2.5 px-3 text-right text-amber-700">{formatKHR(b.deposit)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-800">{formatKHR(b.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SubTab 4: Branch Comparison side by side */}
          {reportSubTab === 'branch' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 mb-4">
                👑 {lang === 'en' ? `Branch Performance comparison for ${getMonthAbbr(selectedMonth)} ${selectedYear}` : `ការប្រៀបធៀបចំណូលតាមសាខាសម្រាប់ខែ ធ្នូ ${selectedYear}`}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-650 font-bold border-b border-slate-200">
                      <th className="py-2 px-3">{lang === 'en' ? 'Branch' : 'សាខា'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'Cash Amount' : 'សាច់ប្រាក់'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'ABA Amount' : 'ABA'}</th>
                      <th className="py-2 px-3 text-right text-cyan-900 font-black">{lang === 'en' ? 'Branch Revenue' : 'ចំណូលសរុប'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'Deposits' : 'បានបញ្ញើធនាគារ'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'en' ? 'Remaining Handed Over' : 'ប្រាក់សល់'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono font-bold">
                    {branchDataReport.map((b, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-sans text-slate-800">{b.name}</td>
                        <td className="py-2.5 px-3 text-right text-blue-700">{formatKHR(b.cash)}</td>
                        <td className="py-2.5 px-3 text-right text-purple-700">{formatKHR(b.aba)}</td>
                        <td className="py-2.5 px-3 text-right text-cyan-800">{formatKHR(b.total)}</td>
                        <td className="py-2.5 px-3 text-right text-amber-700">{formatKHR(b.deposit)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-800">{formatKHR(b.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================
          TELEGRAM POPUP DISPATCHER (REAL PREVIEW MODAL)
          ==================================================== */}
      {telegramModalRow && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl relative">
            <button 
              onClick={() => setTelegramModalRow(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-650"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sky-500 mb-4">
              <Send className="w-5 h-5 fill-current" />
              <h3 className="text-sm font-black uppercase text-slate-900">Telegram Channel Alert</h3>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 font-sans text-xs text-slate-700 whitespace-pre-line select-all leading-relaxed">
              {`Daily Revenue Summary

💰 Revenue Summary

Branch: ${selectedBranchName}

Cash Revenue: ${formatKHR(telegramModalRow.cash)}

ABA Revenue: ${formatKHR(telegramModalRow.aba)}

Total Revenue: ${formatKHR(telegramModalRow.dailyRevenue)}

Date: ${telegramModalRow.label}`}
            </div>

            {alertSuccess && (
              <div className="mt-4 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 font-bold text-center text-xs">
                {alertSuccess}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setTelegramModalRow(null)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
              >
                {lang === 'en' ? 'Cancel' : 'បោះបង់'}
              </button>
              <button
                onClick={handleSendTelegram}
                className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5 fill-current" />
                {lang === 'en' ? 'Dispatch Now' : 'ផ្ញើចេញភ្លាម'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          PRINT VIEW HIDDEN WATERMARK
          ==================================================== */}
      <div className="hidden print:block font-serif text-slate-900">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black">{selectedBranchName} Daily Revenue Report</h1>
          <p className="text-sm italic">{getMonthAbbr(selectedMonth)} {selectedYear} - Log Sheet Records</p>
        </div>
      </div>

      {/* ====================================================
          PDF PRINT & PREVIEW INTERACTIVE MODAL (100% FIT & ZOOM CONTROLS)
          ==================================================== */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in print:hidden" id="pdf_preview_modal">
          <div className="bg-white rounded-2xl w-full max-w-[96vw] h-[95vh] flex flex-col overflow-hidden border border-slate-200/80 shadow-2xl animate-slide-up">
            
            {/* Modal Heading Toolbar */}
            <div className="px-4 md:px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-cyan-600" />
                  {lang === 'en' ? 'Revenue Report PDF & Print Preview' : 'ប្រព័ន្ធទាញយក PDF & បោះពុម្ព'}
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  {lang === 'en' 
                    ? `Branch: ${selectedBranchName} | Month: ${getMonthAbbr(selectedMonth)} ${selectedYear}`
                    : `សាខា: ${selectedBranchName} | ខែ: ${getMonthAbbr(selectedMonth)} ${selectedYear}`}
                </p>
              </div>

              {/* Action Operations */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 px-2 py-1 rounded-xl shadow-xs text-xs font-bold text-slate-700">
                  <span className="text-[11px] text-slate-500 font-sans mr-0.5">
                    {lang === 'en' ? 'Zoom:' : 'ពង្រីក:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(prev => Math.max(50, prev - 10))}
                    className="w-5 h-5 flex items-center justify-center bg-white hover:bg-slate-200 text-slate-800 rounded font-black text-xs border border-slate-250 cursor-pointer"
                    title="Zoom Out"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(100)}
                    className="text-[11px] font-mono px-1 font-extrabold text-cyan-900 hover:text-cyan-700 cursor-pointer min-w-[36px] text-center"
                    title="Reset Zoom"
                  >
                    {previewZoom}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(prev => Math.min(180, prev + 10))}
                    className="w-5 h-5 flex items-center justify-center bg-white hover:bg-slate-200 text-slate-800 rounded font-black text-xs border border-slate-250 cursor-pointer"
                    title="Zoom In"
                  >
                    +
                  </button>
                </div>

                {/* Orientation Selector */}
                <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setPdfOrientation('portrait')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      pdfOrientation === 'portrait'
                        ? 'bg-white text-slate-900 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📄 {lang === 'en' ? 'Portrait' : 'ឈរ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfOrientation('landscape')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      pdfOrientation === 'landscape'
                        ? 'bg-white text-slate-900 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📜 {lang === 'en' ? 'Landscape' : 'ដេក'}
                  </button>
                </div>

                {/* Data vs Blank Mode Selector */}
                <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setIsBlankPrint(false)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      !isBlankPrint
                        ? 'bg-white text-slate-900 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📊 {lang === 'en' ? 'Data' : 'មានទិន្នន័យ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBlankPrint(true)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      isBlankPrint
                        ? 'bg-amber-600 text-white shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📝 {lang === 'en' ? 'Blank' : 'ទម្រង់ទទេ'}
                  </button>
                </div>

                {/* Custom Table Size Controls */}
                <div className="flex items-center gap-1 bg-slate-100 border border-slate-250 px-2 py-1 rounded-xl shadow-xs text-xs font-bold text-slate-700">
                  <span className="text-[11px] text-slate-600 font-sans mr-0.5">
                    {lang === 'en' ? 'Height:' : 'កម្ពស់:'}
                  </span>
                  <button 
                    onClick={() => setCustomRowHeight(0)}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] transition-colors cursor-pointer ${customRowHeight === 0 ? 'bg-cyan-600 text-white font-bold' : 'bg-white text-slate-700 hover:bg-slate-200'}`}
                    title="Default standard height"
                  >
                    {lang === 'en' ? 'Fit' : 'សមរម្យ'}
                  </button>
                  <button 
                    onClick={() => setCustomRowHeight(30)}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] transition-colors cursor-pointer ${customRowHeight === 30 ? 'bg-cyan-600 text-white font-bold' : 'bg-white text-slate-700 hover:bg-slate-200'}`}
                  >
                    {lang === 'en' ? 'Compact' : 'តូច'}
                  </button>
                  <button 
                    onClick={() => setCustomRowHeight(46)}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] transition-colors cursor-pointer ${customRowHeight === 46 ? 'bg-cyan-600 text-white font-bold' : 'bg-white text-slate-700 hover:bg-slate-200'}`}
                  >
                    {lang === 'en' ? 'Bigger' : 'ធំ'}
                  </button>
                </div>

                <button
                  onClick={() => printElement('revenue-pdf-printable-area', isBlankPrint ? `Revenue Report (Blank) - ${selectedBranchName}` : `Revenue Report - ${selectedBranchName}`, pdfOrientation)}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Print / Download PDF' : 'បោះពុម្ព / ទាញយក PDF'}
                </button>

                <button
                  onClick={() => handleExportExcel(isBlankPrint)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  title={isBlankPrint ? (lang === 'en' ? 'Export Blank Excel Template' : 'នាំចេញគំរូតារាងទទេជា Excel') : undefined}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {isBlankPrint ? (lang === 'en' ? 'Blank Excel' : 'Excel ទទេ') : (lang === 'en' ? 'Excel' : 'Excel')}
                </button>

                <button
                  onClick={() => setIsPdfModalOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-all ml-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: A4 Printable Document Container */}
            <div className="flex-1 bg-slate-200/70 p-4 md:p-6 overflow-auto flex justify-center items-start">
              <div 
                id="revenue-pdf-printable-area" 
                className={`bg-white p-4 md:p-6 rounded-xl shadow-lg border border-slate-200/80 font-sans text-slate-800 transition-all origin-top ${
                  pdfOrientation === 'landscape' ? 'w-[297mm] max-w-full' : 'w-[210mm] max-w-full'
                }`}
                style={{ 
                  minHeight: pdfOrientation === 'landscape' ? '210mm' : '297mm',
                  transform: previewZoom !== 100 ? `scale(${previewZoom / 100})` : undefined,
                  marginBottom: previewZoom > 100 ? `${(previewZoom - 100) * 16}px` : undefined
                }}
              >
                {/* 1. Official Banner Header (Matching Photo 1:1) */}
                <div className="bg-cyan-600 text-white font-black text-center py-2 uppercase text-sm sm:text-base tracking-widest border border-cyan-700 rounded-t-lg">
                  Revenue Clean Wash and Dry
                </div>
                <div className="bg-slate-100 text-slate-800 font-extrabold text-center py-1.5 text-xs border-x border-b border-slate-300 rounded-b-lg mb-3">
                  តារាងកុងទ័រម៉ាស៊ីនបោក ({selectedBranchName} - {getMonthAbbr(selectedMonth)} {selectedYear})
                </div>

                {/* 2. 100% Fit Table with table-fixed & proportional column widths */}
                <table className="w-full table-fixed text-left border-collapse border border-slate-300 font-sans">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 text-center font-black text-xs border-b border-slate-300 uppercase leading-snug">
                      <th className="py-2 px-1 border-r border-slate-300 w-[10%] align-middle">ថ្ងៃ</th>
                      <th className="py-2 px-1.5 border-r border-slate-300 w-[14%] align-middle">កុងទ័រចាប់ផ្តើម</th>
                      <th className="py-2 px-1.5 border-r border-slate-300 w-[14%] align-middle">កុងទ័របញ្ចប់</th>
                      <th className="py-2 px-1.5 border-r border-slate-300 w-[11%] align-middle">លុយសុទ្ធ</th>
                      <th className="py-2 px-1.5 border-r border-slate-300 w-[11%] align-middle">ABA</th>
                      <th className="py-2 px-1.5 border-r border-slate-300 w-[12%] align-middle">
                        លក់កាក់ក្រៅ
                      </th>
                      <th className="py-2 px-1.5 border-r border-slate-300 w-[14%] align-middle">លុយសរុបប្រចាំថ្ងៃ</th>
                      <th className="py-2 px-1 w-[14%] align-middle">ចំណាំ</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-mono border-t border-slate-300">
                    {processedRows.map((r, i) => {
                      const cellPad = isBlankPrint 
                        ? (customRowHeight === 30 ? 'py-1 px-1 text-xs' : 'py-2 px-1.5 text-xs')
                        : (customRowHeight === 30 
                            ? 'py-0.5 px-1 text-[11px]' 
                            : customRowHeight === 46 
                            ? 'py-2.5 px-1.5 text-xs sm:text-sm' 
                            : 'py-1 px-1.5 text-xs');
                      return (
                        <React.Fragment key={i}>
                          {/* Sub-row 1: Cash Counter & Cash Amount */}
                          <tr className={`hover:bg-slate-50 border-t border-slate-300 ${isBlankPrint ? 'h-[30px]' : ''}`}>
                            <td rowSpan={2} className="py-1 px-1 text-center font-sans border-r border-slate-300 align-middle bg-slate-50/50">
                              <span className="font-black text-slate-900 text-[11px] font-sans leading-tight block truncate">{r.label}</span>
                            </td>
                            <td className={`${cellPad} text-right font-mono font-black text-slate-900 border-r border-slate-300 border-b border-slate-200 truncate`}>
                              {!isBlankPrint && r.startCounter > 0 ? r.startCounter.toLocaleString() : ''}
                            </td>
                            <td className={`${cellPad} text-right font-mono font-black text-slate-900 border-r border-slate-300 border-b border-slate-200 truncate`}>
                              {!isBlankPrint && r.endCounter > 0 ? r.endCounter.toLocaleString() : ''}
                            </td>
                            <td className={`${cellPad} text-right font-mono font-black text-blue-700 border-r border-slate-300 border-b border-slate-200 truncate`}>
                              {!isBlankPrint && r.cash > 0 ? formatKHR(r.cash) : ''}
                            </td>
                            <td className={`${cellPad} text-right font-mono font-black text-purple-700 border-r border-slate-300 border-b border-slate-200 truncate`}></td>
                            <td rowSpan={2} className="py-1 px-1 text-right font-mono font-black text-cyan-900 border-r border-slate-300 align-middle text-xs truncate">
                              {!isBlankPrint && r.coinSales > 0 ? (
                                <>
                                  <div>{formatKHR(r.coinSales)}</div>
                                  <div className="text-[9px] text-slate-400 font-normal">({r.coinCount || Math.round(r.coinSales / 1000)} កាក់)</div>
                                </>
                              ) : ''}
                            </td>
                            <td rowSpan={2} className="py-1 px-1 text-right font-mono font-black text-cyan-950 bg-cyan-50/50 border-r border-slate-300 align-middle text-xs sm:text-sm truncate">
                              {!isBlankPrint && r.dailyRevenue > 0 ? formatKHR(r.dailyRevenue) : ''}
                            </td>
                            <td rowSpan={2} className="py-1 px-1 text-left font-sans text-slate-800 text-[10.5px] font-semibold truncate align-middle leading-tight">
                              {!isBlankPrint ? (r.note || '') : ''}
                            </td>
                          </tr>

                          {/* Sub-row 2: ABA Counter & ABA Amount */}
                          <tr className={`hover:bg-slate-50 border-b border-slate-300 ${isBlankPrint ? 'h-[30px]' : ''}`}>
                            <td className={`${cellPad} text-right font-mono font-black text-slate-800 border-r border-slate-300 bg-slate-50/30 truncate`}>
                              {!isBlankPrint && r.startCounterAba > 0 ? r.startCounterAba.toLocaleString() : ''}
                            </td>
                            <td className={`${cellPad} text-right font-mono font-black text-slate-800 border-r border-slate-300 bg-slate-50/30 truncate`}>
                              {!isBlankPrint && r.endCounterAba > 0 ? r.endCounterAba.toLocaleString() : ''}
                            </td>
                            <td className={`${cellPad} text-right font-mono font-black text-blue-700 border-r border-slate-300 truncate`}></td>
                            <td className={`${cellPad} text-right font-mono font-black text-purple-700 border-r border-slate-300 truncate`}>
                              {!isBlankPrint && r.aba > 0 ? formatKHR(r.aba) : ''}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}

                    {/* Summary Footer Row */}
                    <tr className="bg-cyan-700 text-white font-black text-xs border-t-2 border-cyan-800">
                      <td className="py-2 px-1 text-center font-black">TOTAL:</td>
                      <td className="py-2 px-1 text-center font-mono text-[10px] font-medium text-cyan-100">-</td>
                      <td className="py-2 px-1 text-center font-mono text-[10px] font-medium text-cyan-100">-</td>
                      <td className="py-2 px-1.5 text-right text-xs font-black truncate">
                        {!isBlankPrint ? formatKHR(sumCash) : ''}
                      </td>
                      <td className="py-2 px-1.5 text-right text-xs font-black truncate">
                        {!isBlankPrint ? formatKHR(sumAba) : ''}
                      </td>
                      <td className="py-2 px-1.5 text-right text-xs font-black truncate">
                        {!isBlankPrint ? (
                          <>
                            <div>{formatKHR(sumCoinSales)}</div>
                            <div className="text-[9px] text-cyan-200 font-normal">({sumCoinCount} កាក់)</div>
                          </>
                        ) : ''}
                      </td>
                      <td className="py-2 px-1.5 text-right bg-cyan-900 text-white text-xs sm:text-sm font-black truncate">
                        {!isBlankPrint ? formatKHR(sumRevenue) : ''}
                      </td>
                      <td className="py-2 px-1 text-center font-sans text-[10px] font-semibold text-cyan-100">
                        {!isBlankPrint ? 'Summary' : ''}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      
      )}
    </div>
  );
}

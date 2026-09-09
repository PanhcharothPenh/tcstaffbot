/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Printer, 
  Download, 
  FileSpreadsheet, 
  Save, 
  Check, 
  Eye, 
  FileText,
  TrendingUp,
  RefreshCw,
  FolderOpen,
  Calendar,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SoftenerRecord, Role, Branch, InventoryItem, StockTransaction } from '../types';
import { formatCurrency, printElement } from '../utils';
import { notifySoftenerRecordSaved, notifyBatchSaveCompleted } from '../services/branchTelegramNotifier';

interface SoftenerRecordsViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  softenerRecords: SoftenerRecord[];
  setSoftenerRecords: React.Dispatch<React.SetStateAction<SoftenerRecord[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
  exchangeRate: number;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  stockTransactions: StockTransaction[];
  setStockTransactions: React.Dispatch<React.SetStateAction<StockTransaction[]>>;
}

export default function SoftenerRecordsView({
  currentRole,
  activeBranchId,
  branches,
  softenerRecords,
  setSoftenerRecords,
  lang,
  onAddLog,
  exchangeRate,
  inventory,
  setInventory,
  stockTransactions,
  setStockTransactions
}: SoftenerRecordsViewProps) {
  const isOwner = currentRole === 'Owner';
  const isManager = currentRole === 'Manager';
  const isStaff = currentRole === 'Staff';

  // ----------------------------------------------------
  // FILTER STATES (Month, Year, Branch)
  // ----------------------------------------------------
  const [selectedBranchId, setSelectedBranchId] = useState<string>('b1');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  // Custom Table Size (Row Height) State (0 = Auto A4 fit)
  const [customRowHeight, setCustomRowHeight] = useState<number>(0);
  // Selected Brand Name State (Comfort, Ora, Siusip, or Custom)
  const [selectedBrand, setSelectedBrand] = useState<string>(() => localStorage.getItem('clean24_softener_brand') || 'Comfort');
  const [customBrandInput, setCustomBrandInput] = useState<string>('');
  const [isCustomBrand, setIsCustomBrand] = useState<boolean>(false);

  const handleBrandChange = (val: string) => {
    if (val === 'CUSTOM') {
      setIsCustomBrand(true);
    } else {
      setIsCustomBrand(false);
      setSelectedBrand(val);
      localStorage.setItem('clean24_softener_brand', val);
    }
  };

  const handleCustomBrandSubmit = () => {
    if (customBrandInput.trim()) {
      const brandVal = customBrandInput.trim();
      setSelectedBrand(brandVal);
      localStorage.setItem('clean24_softener_brand', brandVal);
      setIsCustomBrand(false);
      setCustomBrandInput('');
    }
  };

  // Active view tabs: 'sheet' | 'reports'
  const [activeTab, setActiveTab] = useState<'sheet' | 'reports'>('sheet');
  // Reports sub-tabs: 'daily' | 'monthly' | 'branch'
  const [reportSubTab, setReportSubTab] = useState<'daily' | 'monthly' | 'branch'>('daily');

  // Print Preview Dialog
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Status message state
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [savedRowIndex, setSavedRowIndex] = useState<number | null>(null);

  // Sync state with active branch from global layout
  useEffect(() => {
    if (activeBranchId && activeBranchId !== 'all') {
      setSelectedBranchId(activeBranchId);
    } else if (branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [activeBranchId, branches]);

  // Months List
  const months = useMemo(() => [
    { value: 1, en: 'January', kh: 'មករា', abbr: 'Jan' },
    { value: 2, en: 'February', kh: 'កុម្ភៈ', abbr: 'Feb' },
    { value: 3, en: 'March', kh: 'មីនា', abbr: 'Mar' },
    { value: 4, en: 'April', kh: 'មេសា', abbr: 'Apr' },
    { value: 5, en: 'May', kh: 'ឧសភា', abbr: 'May' },
    { value: 6, en: 'June', kh: 'មិថុនា', abbr: 'Jun' },
    { value: 7, en: 'July', kh: 'កក្កដា', abbr: 'Jul' },
    { value: 8, en: 'August', kh: 'សីហា', abbr: 'Aug' },
    { value: 9, en: 'September', kh: 'កញ្ញា', abbr: 'Sep' },
    { value: 10, en: 'October', kh: 'តុលា', abbr: 'Oct' },
    { value: 11, en: 'November', kh: 'វិច្ឆិកា', abbr: 'Nov' },
    { value: 12, en: 'December', kh: 'ធ្នូ', abbr: 'Dec' },
  ], []);

  const years = [2025, 2026, 2027, 2028];

  // Selected Branch Name
  const selectedBranchName = useMemo(() => {
    const br = branches.find(b => b.id === selectedBranchId);
    return br ? br.branchName : 'Unknown Branch';
  }, [branches, selectedBranchId]);

  // Selected Branch Address
  const selectedBranchAddress = useMemo(() => {
    const br = branches.find(b => b.id === selectedBranchId);
    return br ? (br.address || 'Phnom Penh, Cambodia') : 'Phnom Penh, Cambodia';
  }, [branches, selectedBranchId]);

  // Get days count
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Convert month name to shorthand
  const getMonthAbbr = (monthVal: number) => {
    const found = months.find(m => m.value === monthVal);
    return found ? found.abbr : '';
  };

  const getMonthKhmer = (monthVal: number) => {
    const found = months.find(m => m.value === monthVal);
    return found ? found.kh : '';
  };

  const getMonthEnglish = (monthVal: number) => {
    const found = months.find(m => m.value === monthVal);
    return found ? found.en : '';
  };

  const getPrintedDateTime = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hrStr = String(hours).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hrStr}:${minutes}:${seconds} ${ampm}`;
  };

  // Helper: Format Date string for displaying (e.g. 1-Jun-2026)
  const formatDayLabel = (dayNum: number) => {
    const mStr = getMonthAbbr(selectedMonth);
    return `${dayNum}-${mStr}-${selectedYear}`;
  };

  // Helper: YYYY-MM-DD
  const formatYYYYMMDD = (dayNum: number) => {
    const mm = String(selectedMonth).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    return `${selectedYear}-${mm}-${dd}`;
  };

  // ----------------------------------------------------
  // GRID DATA STATE
  // ----------------------------------------------------
  // Local state for the editable monthly sheet
  const [localRows, setLocalRows] = useState<any[]>([]);

  // Build local visual state based on month selection and stored softener records
  useEffect(() => {
    setLocalRows(prevLocal => {
      const isSameContext = prevLocal && prevLocal.length === daysInMonth && prevLocal[0]?.date === formatYYYYMMDD(1);
      const rows = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatYYYYMMDD(day);
        const match = softenerRecords.find(
          r => r.branchId === selectedBranchId && r.date === dateStr
        );
        const prevRow = isSameContext ? prevLocal[day - 1] : null;

        if (prevRow && prevRow.isDirty) {
          rows.push(prevRow);
        } else {
          const computedOut = match?.outQty !== undefined 
            ? match.outQty 
            : (match?.total !== undefined 
                ? match.total 
                : ((match?.comfort || 0) + (match?.ora || 0)));

          const comfortVal = match?.comfort !== undefined ? match.comfort : 0;
          const oraVal = match?.ora !== undefined ? match.ora : 0;
          const siusipVal = match?.siusip !== undefined ? match.siusip : 0;

          rows.push({
            day,
            date: dateStr,
            label: formatDayLabel(day),
            inQty: match?.inQty !== undefined ? match.inQty : 0,
            comfort: comfortVal,
            ora: oraVal,
            siusip: siusipVal,
            outQty: computedOut > 0 ? computedOut : (comfortVal + oraVal + siusipVal),
            total: computedOut > 0 ? computedOut : (comfortVal + oraVal + siusipVal),
            note: match?.note || '',
            exists: !!match,
            recordId: match?.id || null,
            isDirty: false
          });
        }
      }
      return rows;
    });
  }, [selectedBranchId, selectedYear, selectedMonth, daysInMonth, softenerRecords]);

  // ----------------------------------------------------
  // RECALCULATIONS & CELL EDITING
  // ----------------------------------------------------
  const handleCellChange = (dayIndex: number, field: 'inQty' | 'outQty' | 'comfort' | 'ora' | 'siusip' | 'note', value: any) => {
    const updated = [...localRows];
    const target = { ...updated[dayIndex] };

    if (field === 'note') {
      target[field] = value;
    } else {
      const num = value === '' ? 0 : Math.max(0, parseInt(value) || 0);
      target[field] = num;
    }

    if (['comfort', 'ora', 'siusip'].includes(field)) {
      const c = target.comfort || 0;
      const o = target.ora || 0;
      const s = target.siusip || 0;
      target.outQty = c + o + s;
      target.total = target.outQty;
    } else if (field === 'outQty') {
      target.total = target.outQty;
    }

    target.isDirty = true;
    updated[dayIndex] = target;
    setLocalRows(updated);
  };

  // Real-time aggregates
  const sumInQty = useMemo(() => localRows.reduce((a, b) => a + (b.inQty || 0), 0), [localRows]);
  
  
  const sumComfort = useMemo(() => localRows.reduce((a, b) => a + (b.comfort || 0), 0), [localRows]);
  const sumOra = useMemo(() => localRows.reduce((a, b) => a + (b.ora || 0), 0), [localRows]);
  const sumSiusip = useMemo(() => localRows.reduce((a, b) => a + (b.siusip || 0), 0), [localRows]);
  const sumOutQty = useMemo(() => localRows.reduce((a, b) => a + (b.outQty || 0), 0), [localRows]);
  const sumTotal = useMemo(() => localRows.reduce((a, b) => a + (b.total || 0), 0), [localRows]);

  // Initialize/adjust inventory levels when softener ledger is saved
  const syncInventoryOnSave = (dirtyRowsList: any[]) => {
    let updatedInventory = [...inventory];
    let updatedStockTx = [...stockTransactions];

    let totalInQtyChange = 0;
    let totalOutQtyChange = 0;

    dirtyRowsList.forEach(row => {
      const originalRecord = softenerRecords.find(r => r.id === row.recordId);
      const prevIn = originalRecord?.inQty || 0;
      const prevOut = originalRecord?.outQty !== undefined ? originalRecord.outQty : ((originalRecord?.comfort || 0) + (originalRecord?.ora || 0));

      totalInQtyChange += (row.inQty - prevIn);
      totalOutQtyChange += (row.outQty - prevOut);
    });

    if (totalInQtyChange === 0 && totalOutQtyChange === 0) return;

    // Find Softener Stock item in inventory
    let itemIdx = updatedInventory.findIndex(item => 
      item.branchId === selectedBranchId && 
      (item.itemName.toLowerCase().includes('softener') || item.category === 'Fabric Softener')
    );

    if (itemIdx < 0) {
      // Create Liquid Softener item if none exists
      const newItem: InventoryItem = {
        id: 'inv_soft_' + selectedBranchId,
        branchId: selectedBranchId,
        itemName: 'Liquid Softener Stock',
        category: 'Fabric Softener',
        unit: 'pcs',
        currentStock: 250,
        minimumStockAlert: 20,
        purchasePrice: 5.2,
        supplier: 'CleanChem Supply Co., Ltd',
        purchaseDate: new Date().toISOString().split('T')[0],
        usedQuantity: 0,
        remainingStock: 250
      };
      updatedInventory.push(newItem);
      itemIdx = updatedInventory.length - 1;
    }

    const currentItem = updatedInventory[itemIdx];
    
    // Add refills and subtract stock outs
    const newUsedQuantity = currentItem.usedQuantity + totalOutQtyChange;
    const newCurrentStock = currentItem.currentStock + totalInQtyChange;
    const newRemainingStock = Math.max(0, newCurrentStock - newUsedQuantity);

    updatedInventory[itemIdx] = {
      ...currentItem,
      currentStock: newCurrentStock,
      usedQuantity: newUsedQuantity,
      remainingStock: newRemainingStock
    };

    // Add Audit stock logs
    if (totalInQtyChange !== 0) {
      const txIn: StockTransaction = {
        id: 'stk_sof_in_' + Date.now().toString().slice(-6),
        branchId: selectedBranchId,
        date: new Date().toISOString().split('T')[0],
        itemId: currentItem.id,
        itemName: currentItem.itemName,
        quantity: Math.abs(totalInQtyChange),
        currentStock: newRemainingStock,
        type: totalInQtyChange > 0 ? 'In' : 'Out',
        cost: 0,
        createdBy: currentRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        note: totalInQtyChange > 0 
          ? `Added ${totalInQtyChange} pcs Softener In via Daily Tracking form`
          : `Removed ${Math.abs(totalInQtyChange)} pcs Softener In via daily corrections`
      };
      updatedStockTx = [txIn, ...updatedStockTx];
    }

    if (totalOutQtyChange !== 0) {
      const txOut: StockTransaction = {
        id: 'stk_sof_out_' + Date.now().toString().slice(-6),
        branchId: selectedBranchId,
        date: new Date().toISOString().split('T')[0],
        itemId: currentItem.id,
        itemName: currentItem.itemName,
        quantity: Math.abs(totalOutQtyChange),
        currentStock: newRemainingStock,
        type: totalOutQtyChange > 0 ? 'Use' : 'In',
        cost: 0,
        createdBy: currentRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        note: totalOutQtyChange > 0 
          ? `Subtracted ${totalOutQtyChange} pcs Softener out via Daily Tracking usage`
          : `Returned ${Math.abs(totalOutQtyChange)} pcs Softener to stock via adjustments`
      };
      updatedStockTx = [txOut, ...updatedStockTx];
    }

    setInventory(updatedInventory);
    setStockTransactions(updatedStockTx);

    // Trigger Telegram Instant Alert if remaining stock is low
    if (newRemainingStock < currentItem.minimumStockAlert) {
      fetch('/api/telegram-trigger-instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'low_stock',
          alertType: 'Low Stock Alert (Softener)',
          branchId: selectedBranchId,
          branchName: selectedBranchName,
          details: `📦 <b>ទំនិញ:</b> ${currentItem.itemName || 'ទឹកក្រអូប (Softener)'}\n` +
            `📉 <b>ស្តុកនៅសល់បច្ចុប្បន្ន:</b> <code>${newRemainingStock} កញ្ចប់/កេស</code>\n` +
            `⚠️ <b>កម្រិតសុវត្ថិភាពអប្បបរមា:</b> <code>${currentItem.minimumStockAlert} កញ្ចប់/កេស</code>`,
          actionRequired: 'សូមត្រៀមកុម្ម៉ង់ទិញទឹកក្រអូបពីអ្នកផ្គត់ផ្គង់បន្ថែមជាបន្ទាន់!'
        })
      }).catch(err => console.error('Failed to trigger stock alert Telegram config notification:', err));
    }
  };

  // ----------------------------------------------------
  // DATA SAVING
  // ----------------------------------------------------
  // Save single row to global softener records
  const saveRow = (index: number) => {
    const row = localRows[index];
    const matchId = row.recordId || `sof_${selectedBranchId}_${row.date}`;

    // Sync inventory first
    syncInventoryOnSave([row]);

    // Create target SoftenerRecord
    const savedRecord: SoftenerRecord = {
      id: matchId,
      branchId: selectedBranchId,
      date: row.date,
      // For legacy components compatibility
      quantityLiters: row.total,
      remainingLiters: 48, // placeholder
      type: 'Use',
      cost: 0,
      createdBy: currentRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      note: row.note,
      // Our paper shape additions
      inQty: row.inQty,
      outQty: row.outQty,
      total: row.total
    };

    // Replace or insert
    setSoftenerRecords(prev => {
      const idx = prev.findIndex(p => p.id === matchId);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = savedRecord;
        return copy;
      } else {
        return [...prev, savedRecord];
      }
    });

    // Mark as clean locally
    const copyRows = [...localRows];
    copyRows[index] = { ...row, exists: true, recordId: matchId, isDirty: false };
    setLocalRows(copyRows);

    setSavedRowIndex(index);
    setTimeout(() => setSavedRowIndex(null), 1500);

    onAddLog(`Saved daily softener usage sheet row for ${selectedBranchName} on ${row.label} (Usage: ${row.outQty}, Total: ${row.total})`);

    // Auto-dispatch to branch Telegram bot
    notifySoftenerRecordSaved({
      branchId: selectedBranchId,
      branchName: selectedBranchName,
      dateLabel: row.label,
      row: {
        inQty: row.inQty,
        outQty: row.outQty,
        total: row.total,
        note: row.note
      },
      role: currentRole
    }).then(res => {
      if (res.success) {
        onAddLog(`✓ ផ្ញើកំណត់ត្រាទឹកក្រអូបទៅ Telegram សាខា (${selectedBranchName}) រួចរាល់`);
      } else {
        onAddLog(`⚠️ Telegram (${selectedBranchName}): ${res.error || 'រកមិនឃើញ Chat ID'}`);
      }
    }).catch(err => console.warn('Telegram softener notify error:', err));
  };

  // Save the whole month's sheet
  const saveAllRows = () => {
    const dirtyRows = localRows.filter(r => r.isDirty);
    if (dirtyRows.length === 0) {
      setSaveStatus(lang === 'en' ? 'All records are already up to date.' : 'កំណត់ត្រាទាំងអស់បានរក្សាទុកថ្មីៗរួចរាល់ហើយ។');
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    // Sync physical stock levels in inventory
    syncInventoryOnSave(dirtyRows);

    setSoftenerRecords(prev => {
      let nextList = [...prev];

      dirtyRows.forEach(row => {
        const matchId = row.recordId || `sof_${selectedBranchId}_${row.date}`;
        const newRec: SoftenerRecord = {
          id: matchId,
          branchId: selectedBranchId,
          date: row.date,
          quantityLiters: row.total,
          remainingLiters: 48,
          type: 'Use',
          cost: 0,
          createdBy: currentRole,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          note: row.note,
          inQty: row.inQty,
          outQty: row.outQty,
          total: row.total
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

    // Reset local rows dirty markers
    setLocalRows(prev => prev.map(r => ({ ...r, isDirty: false, exists: true, recordId: r.recordId || `sof_${selectedBranchId}_${r.date}` })));
    setSaveStatus(lang === 'en' ? `Successfully saved ${dirtyRows.length} daily entries` : `រក្សាទុកទិន្នន័យចំនួន ${dirtyRows.length} ថ្ងៃបានជោគជ័យ`);
    setTimeout(() => setSaveStatus(null), 3500);

    onAddLog(`Batch saved ${dirtyRows.length} daily softener usage sheet rows for Branch ID: ${selectedBranchId} of month #${selectedMonth}/${selectedYear}`);

    notifyBatchSaveCompleted({
      branchId: selectedBranchId,
      branchName: selectedBranchName,
      category: 'softener',
      month: selectedMonth,
      year: selectedYear,
      count: dirtyRows.length,
      role: currentRole
    }).catch(err => console.warn('Batch Telegram softener notify error:', err));
  };

  // Auto-save on blur helper
  const handleInputBlur = (index: number) => {
    // If you want full automation, un-comment the next line:
    // saveRow(index);
  };

  // ----------------------------------------------------
  // EXPORTS
  // ----------------------------------------------------
  const handleExportExcel = () => {
    const headers = [
      lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ',
      lang === 'en' ? 'In (ចូល)' : 'ចូល',
      lang === 'en' ? 'Out (ចេញ)' : 'ទឹកក្រអូប (ចេញ)',
      lang === 'en' ? 'Note (ចំណាំ)' : 'ចំណាំ',
      lang === 'en' ? 'Total (សរុប)' : 'សរុប'
    ];

    const rows = localRows.map(r => [
      r.label,
      r.inQty,
      r.outQty,
      r.note,
      r.total
    ]);

    // Footer
    rows.push([
      lang === 'en' ? 'Total Monthly' : 'សរុបប្រចាំខែ',
      sumInQty,
      sumOutQty,
      '',
      sumTotal
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Softener Usage");

    // Write file
    const safeBranchStr = selectedBranchName.replace(/\s+/g, '_');
    XLSX.writeFile(workbook, `Softener_Usage_${safeBranchStr}_${getMonthAbbr(selectedMonth)}_${selectedYear}.xlsx`);
    onAddLog(`Exported Monthly Softener Sheet to Excel for branch ${selectedBranchName}, month #${selectedMonth}`);
  };

  const handlePrint = () => {
    if (!isPreviewOpen) {
      setIsPreviewOpen(true);
      setTimeout(() => {
        printElement('paper-form-printing-container', 'Fabric Softener Ledger');
      }, 250);
    } else {
      printElement('paper-form-printing-container', 'Fabric Softener Ledger');
    }
  };

  // ----------------------------------------------------
  // REPORTS VIEW GENERATORS (Daily, Monthly, Branch reports)
  // ----------------------------------------------------

  // 1. Daily usage list (compact version of non-zero entries)
  const dailyReportData = useMemo(() => {
    return localRows.filter(r => r.outQty > 0 || r.inQty > 0);
  }, [localRows]);

  // 2. Monthly usage across all 12 months for current branch
  const monthlyReportData = useMemo(() => {
    const report = [];
    for (let m = 1; m <= 12; m++) {
      const monthPrefix = `${selectedYear}-${String(m).padStart(2, '0')}`;
      const branchRecords = softenerRecords.filter(r => r.branchId === selectedBranchId && r.date.startsWith(monthPrefix));

      const tOut = branchRecords.reduce((sum, r) => sum + (r.outQty !== undefined ? r.outQty : ((r.comfort || 0) + (r.ora || 0))), 0);
      const tIn = branchRecords.reduce((sum, r) => sum + (r.inQty || 0), 0);
      const tTotal = tOut;

      report.push({
        monthNum: m,
        monthNameEn: getMonthEnglish(m),
        monthNameKh: getMonthKhmer(m),
        outQty: tOut,
        inQty: tIn,
        total: tTotal
      });
    }
    return report;
  }, [softenerRecords, selectedBranchId, selectedYear, months]);

  // 3. Branch usage comparison table for selected month
  const branchReportData = useMemo(() => {
    return branches.map(br => {
      const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const brRecords = softenerRecords.filter(r => r.branchId === br.id && r.date.startsWith(monthPrefix));

      const tOut = brRecords.reduce((sum, r) => sum + (r.outQty !== undefined ? r.outQty : ((r.comfort || 0) + (r.ora || 0))), 0);
      const tIn = brRecords.reduce((sum, r) => sum + (r.inQty || 0), 0);
      const tTotal = tOut;

      return {
        branchId: br.id,
        branchName: br.branchName,
        outQty: tOut,
        inQty: tIn,
        total: tTotal
      };
    });
  }, [branches, softenerRecords, selectedYear, selectedMonth]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6" id="softener-records-module">
      {/* Action Tabs Switcher */}
      <div className="flex justify-end items-center mb-5 print:hidden">
        <div className="flex items-center gap-2">
          {/* Main Tabs */}
          <button
            onClick={() => setActiveTab('sheet')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'sheet' 
                ? 'bg-pink-600 text-white shadow-xs' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            📋 {lang === 'en' ? 'Daily Sheet Form' : 'ទម្រង់សន្លឹកការងារ'}
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'reports' 
                ? 'bg-pink-600 text-white shadow-xs' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            📊 {lang === 'en' ? 'Reports Center' : 'មជ្ឈមណ្ឌលរបាយការណ៍'}
          </button>
        </div>
      </div>

      {/* FILTER BAR (Print Hidden) */}
      <div className="bg-white border border-slate-100 shadow-xs rounded-2xl p-5 mb-6 print:hidden flex flex-col md:flex-row flex-wrap items-center justify-between gap-5">
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Branch Select */}
          {activeBranchId === 'all' && (
            <div className="flex flex-col gap-1 min-w-[150px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'en' ? 'Select Branch' : 'ជ្រើសរើសសាខា'}</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-pink-500"
              >
                {branches.map(br => (
                  <option key={br.id} value={br.id}>{br.branchName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Month Select */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <span className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'en' ? 'Working Month' : 'ខែបំពេញការងារ'}</span>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full pl-7 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-pink-500 appearance-none"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>
                    {lang === 'en' ? m.en : m.kh}
                  </option>
                ))}
              </select>
              <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* Year Select */}
          <div className="flex flex-col gap-1 min-w-[100px]">
            <span className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'en' ? 'Working Year' : 'ឆ្នាំបំពេញការងារ'}</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {years.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Softener Brand Selector (Comfort, Ora, Siusip, Custom) */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <span className="text-[10px] text-sky-600 font-bold uppercase tracking-wider flex items-center gap-1">
              🌸 {lang === 'en' ? 'Softener Brand' : 'ម៉ាកទឹកក្រអូប'}
            </span>
            {!isCustomBrand ? (
              <select
                value={['Comfort', 'Ora', 'Siusip'].includes(selectedBrand) ? selectedBrand : 'CUSTOM_ACTIVE'}
                onChange={(e) => handleBrandChange(e.target.value)}
                className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="Comfort">Comfort</option>
                <option value="Ora">Ora</option>
                <option value="Siusip">Siusip</option>
                {!['Comfort', 'Ora', 'Siusip'].includes(selectedBrand) && (
                  <option value="CUSTOM_ACTIVE">{selectedBrand} (Custom)</option>
                )}
                <option value="CUSTOM">+ {lang === 'en' ? 'Custom Brand...' : 'បន្ថែមម៉ាកផ្សេងៗ...'}</option>
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="e.g. Downy, Hygiene"
                  value={customBrandInput}
                  onChange={(e) => setCustomBrandInput(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-sky-300 text-xs font-bold rounded-lg text-slate-800 focus:outline-none w-28"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCustomBrandSubmit}
                  className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-black rounded-lg"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomBrand(false)}
                  className="px-1.5 py-1 bg-slate-200 text-slate-600 text-xs rounded-lg font-bold"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {activeTab === 'sheet' && (
            <>
              <button
                onClick={saveAllRows}
                className="px-3 py-2 bg-pink-600 hover:bg-pink-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                title="Save all changes of current month"
              >
                <Save className="w-3.5 h-3.5" />
                {lang === 'en' ? 'Save Month Data' : 'រក្សាទុកទិន្នន័យខែនេះ'}
              </button>

              <button
                onClick={() => setIsPreviewOpen(true)}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                {lang === 'en' ? 'Paper Preview / Print' : 'មើលជាក្រដាស / បោះពុម្ព'}
              </button>
            </>
          )}

          <button
            onClick={handleExportExcel}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
            title="Export Excel spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            {lang === 'en' ? 'Export Excel' : 'នាំចេញ Excel'}
          </button>
        </div>
      </div>

      {/* Save Success Alerts banner */}
      {saveStatus && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-6 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-bounce print:hidden">
          <Check className="w-4 h-4 text-emerald-600" />
          {saveStatus}
        </div>
      )}

      {/* ====================================================
          TAB 1: DAILY SHEET FORM (THE PAPER COPY REPLICA)
          ==================================================== */}
      {activeTab === 'sheet' && (
        <div className="space-y-6">
                    {/* Quick Real-Time Month-End Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4.5">
              <span className="text-[10px] text-emerald-600 font-bold uppercase block">{lang === 'en' ? 'Total Refilled (In)' : 'សរុបនាំចូល (In)'}</span>
              <span className="text-2xl font-extrabold text-emerald-700 block mt-1">{sumInQty} {lang === 'en' ? 'pcs' : 'កញ្ចប់'}</span>
              <span className="text-[9px] text-emerald-500 block mt-0.5">{lang === 'en' ? 'Stored as backup reserves' : 'ស្តុកក្រអូបបន្ថែមក្នុងធុង'}</span>
            </div>
            <div className="bg-pink-50 border border-pink-100 rounded-2xl p-4.5">
              <span className="text-[10px] text-pink-600 font-bold uppercase block">{lang === 'en' ? 'Total Softener Used (Out)' : 'ទឹកក្រអូបប្រើប្រាស់សរុប (Out)'}</span>
              <span className="text-2xl font-extrabold text-pink-600 block mt-1">{sumOutQty} {lang === 'en' ? 'pcs' : 'កញ្ចប់'}</span>
              <span className="text-[9px] text-pink-400 block mt-0.5">{lang === 'en' ? 'From current month daily lines' : 'គិតតាមទិន្នន័យប្រចាំថ្ងៃ'}</span>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4.5">
              <span className="text-[10px] text-amber-600 font-bold uppercase block">{lang === 'en' ? 'Warehouse Stock Balance' : 'សមតុល្យស្តុកក្នុងឃ្លាំង'}</span>
              <span className="text-2xl font-extrabold text-amber-700 block mt-1">
                {(() => {
                  const item = inventory.find(i => i.branchId === selectedBranchId && (i.itemName.toLowerCase().includes('softener') || i.category === 'Fabric Softener'));
                  return item ? item.remainingStock : 0;
                })()} {lang === 'en' ? 'pcs' : 'កញ្ចប់'}
              </span>
              <span className="text-[9px] text-amber-500 font-semibold block mt-0.5">{lang === 'en' ? 'Active branch warehouse level' : 'កម្រិតស្តុកឃ្លាំងសាខាបច្ចុប្បន្ន'}</span>
            </div>
          </div>

          {/* MAIN FORM GRID */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center print:hidden">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-pink-500" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  {selectedBranchName} - {lang === 'en' ? ("DAILY USAGE FOR " + getMonthEnglish(selectedMonth).toUpperCase() + " " + selectedYear) : ("សន្លឹកកិច្ចការប្រចាំថ្ងៃសម្រាប់ខែ " + getMonthKhmer(selectedMonth) + " ឆ្នាំ " + selectedYear)}
                </h2>
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                {lang === 'en' ? 'Double check inputs. Out values subtract from warehouse stock levels.' : 'កម្រិតប្រើប្រាស់ចុងក្រោយនឹងដកចេញពីចំនួនស្តុកក្នុងឃ្លាំង។'}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-300 shadow-xs">
                <thead>
                  <tr className="bg-sky-700 text-white border-b border-sky-800 text-xs font-bold">
                    <th rowSpan={2} className="py-2 px-3 text-center border-r border-sky-500 w-[110px] font-black">
                      📅 {lang === 'en' ? 'Date' : 'ថ្ងៃ'}
                    </th>
                    <th rowSpan={2} className="py-2 px-2 text-center border-r border-sky-500 w-[80px] font-black bg-emerald-700">
                      🛢️ {lang === 'en' ? 'Stock In' : 'ចូល'}
                    </th>
                    <th colSpan={3} className="py-1 px-3 text-center border-r border-sky-500 border-b border-sky-500 font-black bg-sky-800">
                      🌸 {lang === 'en' ? 'Softener Out (Pcs)' : 'ទឹកក្រអូបចេញតាមម៉ាក'}
                    </th>
                    <th rowSpan={2} className="py-2 px-2 border-r border-sky-500 w-[100px] text-center font-black">
                      📝 {lang === 'en' ? 'Note' : 'ចំណាំ'}
                    </th>
                    <th rowSpan={2} className="py-2 px-3 text-center border-r border-sky-500 w-[95px] font-black bg-sky-900">
                      📊 {lang === 'en' ? 'Total Out' : 'សរុប'}
                    </th>
                    <th rowSpan={2} className="py-2 px-3 text-center w-[90px] print:hidden font-black">
                      {lang === 'en' ? 'Action' : 'សកម្មភាព'}
                    </th>
                  </tr>
                  <tr className="bg-sky-600 text-white border-b border-sky-700 text-[11px] font-bold">
                    <th className="py-1 px-2 text-center border-r border-sky-400 w-[75px] font-extrabold bg-sky-700/90">Comfort</th>
                    <th className="py-1 px-2 text-center border-r border-sky-400 w-[75px] font-extrabold bg-sky-700/90">Ora</th>
                    <th className="py-1 px-2 text-center border-r border-sky-400 w-[75px] font-extrabold bg-sky-700/90">Siusip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-sans text-xs">
                  {localRows.map((row, index) => {
                    const isDirty = row.isDirty;
                    const isSavedNow = savedRowIndex === index;

                    return (
                      <tr 
                        key={row.day} 
                        className={`hover:bg-slate-50 transition-colors odd:bg-white even:bg-slate-50/50 ${
                          isDirty ? 'bg-amber-50/50' : ''
                        } ${isSavedNow ? 'bg-emerald-50' : ''}`}
                      >
                        {/* Day indicator / label (e.g., 1-Jun-2026) */}
                        <td className="py-2 px-4 font-bold text-slate-700 border-r border-slate-300 text-center font-mono select-none">
                          {row.label}
                        </td>

                        {/* ចូល (In) Input */}
                        <td className="py-1.5 px-2 border-r border-slate-300 bg-emerald-50/10 text-center">
                          <input
                            type="number"
                            value={row.inQty === 0 ? '' : row.inQty}
                            onChange={(e) => handleCellChange(index, 'inQty', e.target.value)}
                            onBlur={() => handleInputBlur(index)}
                            min="0"
                            placeholder="0"
                            disabled={isStaff && !isOwner && !isManager && index + 1 !== new Date().getDate()}
                            className="w-full max-w-[80px] mx-auto text-center font-bold font-mono text-emerald-800 bg-white border border-slate-300 rounded-lg px-1.5 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* ទឹកក្រអូបចេញ (Out) Input */}
                        
                        {/* Comfort Brand Input */}
                        <td className="py-1.5 px-2 border-r border-slate-300 bg-sky-50/20 text-center">
                          <input
                            type="number"
                            value={row.comfort === 0 ? '' : row.comfort}
                            onChange={(e) => handleCellChange(index, 'comfort', e.target.value)}
                            onBlur={() => handleInputBlur(index)}
                            min="0"
                            placeholder="0"
                            className="w-full max-w-[70px] mx-auto text-center font-black font-mono text-sky-900 bg-white border border-slate-300 rounded-lg px-1.5 py-1 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                          />
                        </td>

                        {/* Ora Brand Input */}
                        <td className="py-1.5 px-2 border-r border-slate-300 bg-sky-50/20 text-center">
                          <input
                            type="number"
                            value={row.ora === 0 ? '' : row.ora}
                            onChange={(e) => handleCellChange(index, 'ora', e.target.value)}
                            onBlur={() => handleInputBlur(index)}
                            min="0"
                            placeholder="0"
                            className="w-full max-w-[70px] mx-auto text-center font-black font-mono text-sky-900 bg-white border border-slate-300 rounded-lg px-1.5 py-1 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                          />
                        </td>

                        {/* Siusip Brand Input */}
                        <td className="py-1.5 px-2 border-r border-slate-300 bg-sky-50/20 text-center">
                          <input
                            type="number"
                            value={row.siusip === 0 ? '' : row.siusip}
                            onChange={(e) => handleCellChange(index, 'siusip', e.target.value)}
                            onBlur={() => handleInputBlur(index)}
                            min="0"
                            placeholder="0"
                            className="w-full max-w-[70px] mx-auto text-center font-black font-mono text-sky-900 bg-white border border-slate-300 rounded-lg px-1.5 py-1 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                          />
                        </td>

                        {/* ចំណាំ (Note) Input */}
                        <td className="py-1.5 px-1 border-r border-slate-300 text-center w-[100px]">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => handleCellChange(index, 'note', e.target.value)}
                            onBlur={() => handleInputBlur(index)}
                            placeholder={lang === 'en' ? 'Note' : 'ចំណាំ'}
                            className="w-full max-w-[95px] mx-auto bg-white border border-slate-300 rounded-lg px-1.5 py-1 focus:ring-1 focus:ring-slate-400 focus:outline-none text-slate-700 text-[11px] text-center"
                          />
                        </td>

                        {/* សរុប (Total) -> calculated instantly */}
                        <td className="py-2 px-4 text-center border-r border-slate-300 bg-slate-50">
                          <span className={`font-bold font-sans tracking-tight text-sm ${row.total > 0 ? 'text-red-700 font-extrabold' : 'text-slate-400'}`}>
                            {row.total}
                          </span>
                        </td>

                        {/* Action buttons (Print hidden) */}
                        <td className="py-1.5 px-3 text-center border-r border-slate-300 print:hidden">
                          <div className="flex items-center justify-center gap-2.5">
                            {isDirty ? (
                              <button
                                onClick={() => saveRow(index)}
                                className="p-1 px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                                title="Save this day row"
                              >
                                <Save className="w-3 h-3" />
                                {lang === 'en' ? 'Save' : 'រក្សាទុក'}
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-bold text-[10px] flex items-center gap-0.5 select-none">
                                <Check className="w-3.5 h-3.5" />
                                {lang === 'en' ? 'Saved' : 'រក្សាទុកហើយ'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Cumulative Monthly Totals row */}
                  <tr className="bg-sky-700 text-white font-extrabold text-xs">
                    <td className="py-2.5 px-3 border-r border-sky-500 text-center">{lang === 'en' ? 'Total:' : 'សរុប៖'}</td>
                    <td className="py-2.5 px-2.5 text-center border-r border-sky-500 bg-sky-800">{sumInQty}</td>
                    <td className="py-2.5 px-2.5 text-center border-r border-sky-500 bg-sky-800 text-sky-100 font-black">{sumComfort}</td>
                    <td className="py-2.5 px-2.5 text-center border-r border-sky-500 bg-sky-800 text-sky-100 font-black">{sumOra}</td>
                    <td className="py-2.5 px-2.5 text-center border-r border-sky-500 bg-sky-800 text-sky-100 font-black">{sumSiusip}</td>
                    <td className="py-2.5 px-3 border-r border-sky-500 text-left font-sans italic text-[10px] text-sky-100 font-medium">
                      {selectedBranchName}
                    </td>
                    <td className="py-2.5 px-3 text-center text-red-100 bg-red-800/80 font-black text-sm">{sumTotal}</td>
                    <td className="py-2.5 px-3 print:hidden"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bottom Actions footer */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-between items-center gap-4 print:hidden">
              <div className="flex items-center gap-2">
                <button
                  onClick={saveAllRows}
                  className="px-5 py-2 bg-pink-600 hover:bg-pink-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {lang === 'en' ? 'Save All Sheet Modifications' : 'រក្សាទុកការកែប្រែទាំងអស់'}
                </button>
                {saveStatus && (
                  <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-150 animate-bounce">
                    {saveStatus}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-slate-655" />
                  {lang === 'en' ? 'Export to Excel' : 'នាំចេញទៅ Excel'}
                </button>
                <button
                  onClick={() => setIsPreviewOpen(true)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  {lang === 'en' ? 'Print Preview / PDF' : 'មើលគំរូសន្លឹកបោះពុម្ភ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
                     REPORTS SECTION TAB
         ========================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Sub Navigation for Reports */}
          <div className="flex border-b border-slate-200 gap-4 print:hidden">
            <button
              onClick={() => setReportSubTab('daily')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                reportSubTab === 'daily' 
                  ? 'border-pink-600 text-pink-650' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              📅 {lang === 'en' ? 'Active Days Log' : 'កំណត់ត្រាថ្ងៃសកម្ម'}
            </button>
            <button
              onClick={() => setReportSubTab('monthly')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                reportSubTab === 'monthly' 
                  ? 'border-pink-600 text-pink-650' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              📊 {lang === 'en' ? 'Monthly Comparison' : 'សង្ខេបប្រចាំខែ'}
            </button>
            <button
              onClick={() => setReportSubTab('branch')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                reportSubTab === 'branch' 
                  ? 'border-pink-600 text-pink-650' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              🏢 {lang === 'en' ? 'Branch Compare' : 'ប្រៀបធៀបតាមសាខា'}
            </button>
          </div>

          {/* Report 1: Daily Usage List (active days only) */}
          {reportSubTab === 'daily' && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {lang === 'en' ? 'Active Daily Usage Report' : 'របាយការណ៍ការប្រើប្រាស់សកម្មប្រចាំថ្ងៃ'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'en' ? ("Showing only days with entered actions for " + getMonthEnglish(selectedMonth) + " " + selectedYear + " inside ") : ("បង្ហាញតែថ្ងៃដែលមានប្រតិបត្តិការក្នុងខែ " + getMonthKhmer(selectedMonth) + " ឆ្នាំ " + selectedYear + " ")}
                    <strong>{selectedBranchName}</strong>
                  </p>
                </div>
                <span className="text-xs bg-slate-100 text-slate-655 px-2.5 py-1 rounded-lg font-mono font-bold">
                  {dailyReportData.length} {lang === 'en' ? 'Active Days' : 'ថ្ងៃសកម្ម'}
                </span>
              </div>

              {dailyReportData.length === 0 ? (
                <div className="text-center py-10 text-slate-400 italic text-xs">
                  {lang === 'en' ? 'No operational usages entered yet for this branch month.' : 'មិនទាន់មានកំណត់ត្រាប្រើប្រាស់សកម្មក្នុងខែនេះនៅឡើយទេ។'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <th className="py-2.5 px-3 font-semibold">{lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ'}</th>
                        <th className="py-2.5 px-3 font-semibold text-center">{lang === 'en' ? 'Refilled (In)' : 'ចូល'}</th>
                        <th className="py-2.5 px-3 font-semibold text-center">{lang === 'en' ? 'Softener (Out)' : 'ទឹកក្រអូប (ចេញ)'}</th>
                        <th className="py-2.5 px-3 font-semibold text-center">{lang === 'en' ? 'Total Usage (Out)' : 'ចេញសរុប'}</th>
                        <th className="py-2.5 px-3 font-semibold">{lang === 'en' ? 'Note' : 'ចំណាំ'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {dailyReportData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-sans font-bold text-slate-700">{r.label}</td>
                          <td className="py-2 px-3 text-center text-emerald-700 font-bold">{r.inQty}</td>
                          <td className="py-2 px-3 text-center text-pink-650 font-bold">{r.outQty}</td>
                          <td className="py-2 px-3 text-center text-rose-700 font-extrabold">{r.total}</td>
                          <td className="py-2 px-3 font-sans text-slate-500 italic max-w-[200px] truncate">{r.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t border-slate-200">
                        <td className="py-2 px-3 font-sans">{lang === 'en' ? 'Total Active' : 'សរុបសកម្ម'}</td>
                        <td className="py-2 px-3 text-center text-emerald-800">{sumInQty}</td>
                        <td className="py-2 px-3 text-center text-pink-700">{sumOutQty}</td>
                        <td className="py-2 px-3 text-center text-red-700">{sumTotal}</td>
                        <td className="py-2 px-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Report 2: Monthly Summary (All 12 Months comparison) */}
          {reportSubTab === 'monthly' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-800">
                    {lang === 'en' ? ("Full Year Cumulative Softener Usage Sheet (" + selectedYear + ")") : ("សន្លឹកសង្ខេបការប្រើប្រាស់ប្រចាំឆ្នាំ (" + selectedYear + ")")}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'en' ? "Aggregated month-by-month softener consumption overview for branch " : "ទម្រង់ទិដ្ឋភាពទូទៅនៃកម្រិតប្រើប្រាស់ទឹកក្រអូបប្រចាំខែនីមួយៗសម្រាប់សាខា "}
                    <strong>{selectedBranchName}</strong>
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <th className="py-2.5 px-3 font-semibold">{lang === 'en' ? 'Month' : 'ខែ'}</th>
                        <th className="py-2.5 px-3 font-semibold text-center">{lang === 'en' ? 'Purchased / In' : 'នាំចូល'}</th>
                        <th className="py-2.5 px-3 font-semibold text-center">{lang === 'en' ? 'Softener (Out)' : 'ទឹកក្រអូប (ចេញ)'}</th>
                        <th className="py-2.5 px-3 font-semibold text-center">{lang === 'en' ? 'Monthly Grand Total' : 'សរុបប្រចាំខែ'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {monthlyReportData.map((m, i) => (
                        <tr 
                          key={i} 
                          className={`hover:bg-slate-50 ${
                            m.monthNum === selectedMonth ? 'bg-pink-50/40 font-bold' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-sans text-slate-700">
                            {lang === 'en' ? m.monthNameEn : m.monthNameKh}
                            {m.monthNum === selectedMonth && <span className="text-[9px] bg-pink-100 text-pink-700 font-medium px-1.5 py-0.5 rounded-md ml-1">{lang === 'en' ? 'Selected' : 'បច្ចុប្បន្ន'}</span>}
                          </td>
                          <td className="py-2 px-3 text-center text-teal-700 font-semibold">{m.inQty}</td>
                          <td className="py-2 px-3 text-center text-pink-650">{m.outQty}</td>
                          <td className="py-2 px-3 text-center text-rose-700 font-bold">{m.total}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 text-slate-900 font-extrabold border-t-2 border-slate-200">
                        <td className="py-2.5 px-3 font-sans text-right pr-6">{lang === 'en' ? 'Yearly Cumulate:' : 'សរុបប្រចាំឆ្នាំ:'}</td>
                        <td className="py-2.5 px-3 text-center text-teal-800 font-mono">{monthlyReportData.reduce((sum, r) => sum + r.inQty, 0)}</td>
                        <td className="py-2.5 px-3 text-center text-pink-700 font-mono">{monthlyReportData.reduce((sum, r) => sum + r.outQty, 0)}</td>
                        <td className="py-2.5 px-3 text-center text-red-700 font-mono">{monthlyReportData.reduce((sum, r) => sum + r.total, 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Simple CSS Visualization Bar Chart */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
                  📊 {lang === 'en' ? 'Monthly Consumption Visual Trend' : 'និន្នាការប្រើប្រាស់ប្រចាំខែបន្ទាត់គំនូសបំភាយ'}
                </h4>
                <div className="space-y-3">
                  {monthlyReportData.map((m, i) => {
                    const maxVal = Math.max(...monthlyReportData.map(x => x.total), 1);
                    const percent = Math.min(100, Math.round((m.total / maxVal) * 100));

                    return (
                      <div key={i} className="flex items-center text-xs">
                        <span className="w-24 text-slate-500 font-medium truncate">
                          {lang === 'en' ? m.monthNameEn : m.monthNameKh}
                        </span>
                        <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden mx-3">
                          <div 
                            style={{ width: (percent + "%") }} 
                            className="h-full bg-gradient-to-r from-pink-400 to-pink-600" 
                            title={"Usage: " + m.total}
                          />
                        </div>
                        <span className="w-10 text-right font-mono font-bold text-slate-700">
                          {m.total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Report 3: Branch Report Comparison */}
          {reportSubTab === 'branch' && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5">
              <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {lang === 'en' ? ("Multi-Branch Softener Comparison (" + getMonthEnglish(selectedMonth) + " " + selectedYear + ")") : ("ការប្រៀបធៀបកម្រិតប្រើប្រាស់តាមសាខា (" + getMonthKhmer(selectedMonth) + " ឆ្នាំ " + selectedYear + ")")}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'en' ? 'Side-by-side usage metrics comparing softener consumption across different stations.' 
                                  : 'គណនេយ្យកម្រិតប្រើប្រាស់ទឹកក្រអូបប្រៀបធៀបគ្នាក្នុងចំណោមទីតាំងផ្សេងៗ។'}
                  </p>
                </div>
                <span className="text-xs bg-pink-100 text-pink-700 font-bold px-2.5 py-1 rounded-lg">
                  {lang === 'en' ? "All Active Branches" : "គ្រប់សាខាសកម្ម"}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-semibold">{lang === 'en' ? 'Branch / Station' : 'ទីតាំងសាខា'}</th>
                      <th className="py-2.5 px-3 font-semibold text-center">{lang === 'en' ? 'Refilled (In) Count' : 'នាំចូល'}</th>
                      <th className="py-2.5 px-3 font-semibold text-center">{lang === 'en' ? 'Softener Used (Out)' : 'ទឹកក្រអូប (ចេញ)'}</th>
                      <th className="py-2.5 px-3 font-semibold text-center">{lang === 'en' ? 'Combined Grand Total' : 'សរុបប្រចាំខែ'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {branchReportData.map((b, i) => (
                      <tr 
                        key={i} 
                        className={`hover:bg-slate-50 ${
                          b.branchId === selectedBranchId ? 'bg-pink-50/20 font-bold' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-sans text-slate-700">
                          {b.branchName}
                          {b.branchId === selectedBranchId && <span className="text-[9px] bg-slate-100 text-slate-500 font-medium px-1 rounded-md ml-1">{lang === 'en' ? 'Viewing' : 'មើលបច្ចុប្បន្ន'}</span>}
                        </td>
                        <td className="py-2 px-3 text-center text-teal-800 font-semibold">{b.inQty}</td>
                        <td className="py-2 px-3 text-center text-pink-650">{b.outQty}</td>
                        <td className="py-2 px-3 text-center text-rose-700 font-bold">{b.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================
                     PRINT PREVIEW DIALOG MODAL
         ========================================= */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto print:p-0 print:bg-white print:static print:h-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[850px] flex flex-col h-[90vh] print:h-auto print:border-none print:shadow-none print:rounded-none">
            
            {/* Modal Control Header (Hidden when printing via standard print rules) */}
            <div className="px-6 py-3 bg-slate-150 border-b border-slate-200 flex flex-wrap justify-between items-center print:hidden rounded-t-2xl gap-3">
              <div>
                <h3 className="font-sans font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Printer className="w-4 h-4 text-pink-500" />
                  {lang === 'en' ? 'Printable Paper Form Template Viewer' : 'ទិដ្ឋភាពគំរូនៃទម្រង់ក្រដាសដែលអាចបោះពុម្ពបាន'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {lang === 'en' ? 'Styled EXACTLY like the binders kept on branch counters.' : 'ទម្រង់នេះរៀបចំឡើងដូចគ្នាបេះបិទទៅនឹងសៀវភៅតាមដានបច្ចុប្បន្ននៅសាខា។'}
                </p>
              </div>

              {/* Custom Table Size Controls */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-250 px-2.5 py-1 rounded-xl shadow-xs text-xs font-bold text-slate-700">
                <span className="text-[11px] text-slate-600 font-sans mr-1">
                  {lang === 'en' ? 'Table Size:' : 'ទំហំរៀងតារាង:'}
                </span>
                <button 
                  onClick={() => setCustomRowHeight(0)}
                  className={`px-2 py-0.5 rounded-lg text-[10.5px] transition-colors ${customRowHeight === 0 ? 'bg-sky-600 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  title="Auto Fit 1 Page A4 (30px)"
                >
                  {lang === 'en' ? 'Auto A4 (30px)' : 'ពេញ A4 (30px)'}
                </button>
                <button 
                  onClick={() => setCustomRowHeight(20)}
                  className={`px-2 py-0.5 rounded-lg text-[10.5px] transition-colors ${customRowHeight === 20 ? 'bg-sky-600 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {lang === 'en' ? 'Small (20px)' : 'តូច (20px)'}
                </button>
                <button 
                  onClick={() => setCustomRowHeight(25)}
                  className={`px-2 py-0.5 rounded-lg text-[10.5px] transition-colors ${customRowHeight === 25 ? 'bg-sky-600 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {lang === 'en' ? 'Medium (25px)' : 'មធ្យម (25px)'}
                </button>
                <button 
                  onClick={() => setCustomRowHeight(30)}
                  className={`px-2 py-0.5 rounded-lg text-[10.5px] transition-colors ${customRowHeight === 30 ? 'bg-sky-600 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {lang === 'en' ? 'Large (30px)' : 'ធំ (30px)'}
                </button>

                {/* Stepper buttons */}
                <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5 ml-0.5">
                  <button 
                    onClick={() => setCustomRowHeight(prev => Math.max(14, (prev || 30) - 1))}
                    className="w-5 h-5 flex items-center justify-center bg-slate-150 hover:bg-slate-200 text-slate-800 rounded font-black text-xs"
                    title="Decrease row height"
                  >
                    -
                  </button>
                  <span className="text-[10px] font-mono px-1 font-extrabold text-sky-850 min-w-[32px] text-center">
                    {customRowHeight > 0 ? `${customRowHeight}px` : '30px'}
                  </span>
                  <button 
                    onClick={() => setCustomRowHeight(prev => Math.min(45, (prev || 30) + 1))}
                    className="w-5 h-5 flex items-center justify-center bg-slate-150 hover:bg-slate-200 text-slate-800 rounded font-black text-xs"
                    title="Increase row height"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Trigger Print / PDF' : 'បោះពុម្ព / នាំចេញ PDF'}
                </button>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {lang === 'en' ? 'Close View' : 'បិទ'}
                </button>
              </div>
            </div>

            {/* Printable Container Body */}
            <div className="flex-1 overflow-y-auto p-8 print:p-0" id="paper-form-printing-container">
              {/* Target Area for exact photo replication */}
              <div className="w-full bg-white text-[#111827] mx-auto relative antialiased rounded-3xl p-8 max-w-[800px] print:p-1.5 overflow-hidden">
                
                {/* Photo Header block */}
                <div className="text-center font-sans relative z-10">
                  {/* Category Title centered with diamond */}
                  <h1 className="text-2xl font-black text-sky-800 tracking-wider font-sans mb-0.5">
                    {lang === 'en' ? 'FABRIC SOFTENER' : 'ទឹកក្រអូប'}
                  </h1>
                  <div className="flex items-center justify-center gap-2 max-w-[200px] mx-auto">
                    <div className="h-[1px] bg-sky-600 flex-1" />
                    <span className="text-sky-600 text-[10px]">❖</span>
                    <div className="h-[1px] bg-sky-600 flex-1" />
                  </div>
                </div>

                {/* Sub-Header Period labels in matching pill layout */}
                <div className="flex flex-wrap justify-between items-center mt-1 text-[10px] font-bold text-sky-955 px-2 relative z-10 gap-2">
                  <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
                    <Calendar className="w-3 h-3 text-sky-600" />
                    <span>{lang === 'en' ? 'Month:' : 'ខែ:'} <span className="text-sky-850 uppercase font-extrabold">{getMonthEnglish(selectedMonth)} ( {getMonthKhmer(selectedMonth)} )</span></span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 px-3 py-0.5 rounded-full">
                    <Calendar className="w-3 h-3 text-sky-600" />
                    <span>{lang === 'en' ? 'Year:' : 'ឆ្នាំ:'} <span className="text-sky-850 font-extrabold">{selectedYear}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 font-sans text-[10.5px] font-semibold">
                    <span>{lang === 'en' ? 'Printed Date:' : 'កាលបរិច្ឆេទបោះពុម្ព:'}</span>
                    <span className="font-mono text-[10px] font-bold text-slate-800">{getPrintedDateTime()}</span>
                  </div>
                </div>

                {/* Exact replication grid */}
                <div className="mt-1 relative z-10 overflow-hidden rounded-xl border border-slate-350 shadow-xs">
                  <table className="w-full border-collapse border border-slate-350">
                    <thead>
                      <tr className="bg-sky-600 text-white text-[10px] font-bold border-b border-sky-700">
                        <th rowSpan={2} className="py-1 px-1 border-r border-sky-500 text-center w-[95px] font-black">
                          {lang === 'en' ? 'Date' : 'ថ្ងៃ'}
                        </th>
                        <th rowSpan={2} className="py-1 px-1 border-r border-sky-500 text-center w-[70px] font-black">
                          {lang === 'en' ? 'Stock In' : 'ចូល'}
                        </th>
                        <th colSpan={3} className="py-0.5 px-1 border-r border-sky-500 border-b border-sky-500 text-center font-black bg-sky-700">
                          {lang === 'en' ? 'Softener Brands Usage' : 'ទឹកក្រអូបប្រើប្រាស់តាមម៉ាក'}
                        </th>
                        <th rowSpan={2} className="py-1 px-1 border-r border-sky-500 text-center w-[90px] font-black">
                          {lang === 'en' ? 'Note' : 'ចំណាំ'}
                        </th>
                        <th rowSpan={2} className="py-1 px-1 text-center w-[80px] font-black bg-sky-800">
                          {lang === 'en' ? 'Total Out' : 'សរុប'}
                        </th>
                      </tr>
                      <tr className="bg-sky-500 text-white text-[9.5px] font-bold border-b border-sky-600">
                        <th className="py-0.5 px-1 border-r border-sky-400 text-center w-[60px] font-bold">Comfort</th>
                        <th className="py-0.5 px-1 border-r border-sky-400 text-center w-[60px] font-bold">Ora</th>
                        <th className="py-0.5 px-1 border-r border-sky-400 text-center w-[60px] font-bold">Siusip</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-slate-900 font-mono divide-y divide-slate-355">
                      {localRows.map((r, i) => (
                        <tr 
                          key={i} 
                          className="hover:bg-slate-50/50 odd:bg-white even:bg-slate-50/20" 
                          style={{ height: customRowHeight > 0 ? `${customRowHeight}px` : (localRows.length <= 29 ? '31px' : localRows.length === 30 ? '30px' : '28.5px') }}
                        >
                          <td className="py-1 px-1.5 text-center border-r border-slate-355 font-bold text-slate-800">{r.label}</td>
                          <td className="py-1 px-1 text-center border-r border-slate-355 font-extrabold text-teal-850 bg-emerald-50/10">
                            {r.inQty > 0 ? r.inQty : ''}
                          </td>
                          <td className="py-1 px-1 text-center border-r border-slate-355 font-bold text-sky-900 bg-sky-50/10">
                            {r.comfort > 0 ? r.comfort : ''}
                          </td>
                          <td className="py-1 px-1 text-center border-r border-slate-355 font-bold text-sky-900 bg-sky-50/10">
                            {r.ora > 0 ? r.ora : ''}
                          </td>
                          <td className="py-1 px-1 text-center border-r border-slate-355 font-bold text-sky-900 bg-sky-50/10">
                            {r.siusip > 0 ? r.siusip : ''}
                          </td>
                          <td className="py-1 px-2 text-left border-r border-slate-355 font-sans text-slate-700 text-xs truncate max-w-[150px]">
                            {r.note || ''}
                          </td>
                          <td className="py-1 px-1.5 text-center font-black text-red-700 bg-red-50/10 text-xs">
                            {r.total > 0 ? r.total : ''}
                          </td>
                        </tr>
                      ))}

                      {/* Cumulative Total Row matching the physical document */}
                      <tr className="bg-sky-600 text-white font-extrabold text-xs border-t-2 border-sky-700" style={{ height: '26px' }}>
                        <td className="py-1.5 px-1.5 text-center border-r border-sky-500 font-black">
                          <span className="flex items-center justify-center">TOTAL:</span>
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-sky-500 bg-sky-700 font-extrabold">{sumInQty}</td>
                        <td className="py-1.5 px-1 text-center border-r border-sky-500 bg-sky-700 font-extrabold">{sumComfort}</td>
                        <td className="py-1.5 px-1 text-center border-r border-sky-500 bg-sky-700 font-extrabold">{sumOra}</td>
                        <td className="py-1.5 px-1 text-center border-r border-sky-500 bg-sky-700 font-extrabold">{sumSiusip}</td>
                        <td className="py-1.5 px-2 text-left border-r border-sky-500 font-sans font-bold text-[9px] bg-sky-50 text-sky-950">
                          <span className="flex items-center">{selectedBranchName} ({selectedBranchAddress})</span>
                        </td>
                        <td className="py-1.5 px-1.5 text-center font-black text-red-800 text-xs bg-red-100 border-l border-sky-500 rounded-br-lg">{sumTotal}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>


              </div>
            </div>

            {/* Footer buttons print-hidden */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 print:hidden rounded-b-2xl">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                {lang === 'en' ? 'Exit Print Dialog' : 'ចាកចេញ'}
              </button>
              <button
                onClick={handlePrint}
                className="px-5 py-2 bg-pink-600 hover:bg-pink-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                {lang === 'en' ? 'Print Sheet' : 'បោះពុម្ព'}
              </button>


      {/* Hidden print styling stylesheet to ensure 100% paper representation */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0.3cm;
          }
          body * {
            visibility: hidden;
          }
          #paper-form-printing-container, #paper-form-printing-container * {
            visibility: visible;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #paper-form-printing-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
          }
          #paper-form-printing-container .border-double {
            border-width: 4px !important;
            padding: 16px !important;
            border-radius: 16px !important;
          }
          #paper-form-printing-container tr {
            height: 18px !important;
          }
          #paper-form-printing-container th, 
          #paper-form-printing-container td {
            padding-top: 1px !important;
            padding-bottom: 1px !important;
            font-size: 8.5px !important;
          }
          #paper-form-printing-container h1 {
            font-size: 22px !important;
            margin-bottom: 2px !important;
          }
          #paper-form-printing-container .mt-5 {
            margin-top: 8px !important;
          }
          #paper-form-printing-container .mt-6 {
            margin-top: 8px !important;
          }
          #paper-form-printing-container .mt-8 {
            margin-top: 10px !important;
          }
          #paper-form-printing-container .border-dashed {
            margin-top: 20px !important;
          }
          #paper-form-printing-container svg {
            width: 32px !important;
            height: 32px !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

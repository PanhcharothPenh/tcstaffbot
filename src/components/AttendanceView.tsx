/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Plus, 
  ShieldAlert, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  Filter, 
  Eye, 
  Edit3, 
  Camera, 
  Building2, 
  Smartphone, 
  X,
  FileText,
  UserCheck,
  FileDown,
  Download,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Layers,
  ChevronRight,
  Send
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Attendance, Staff, Role, Branch } from '../types';
import { translations } from '../mockData';
import { printElement } from '../utils';
import { generateAttendancePdf } from '../utils/AttendancePdfService';

interface AttendanceViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  staffList: Staff[];
  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function AttendanceView({
  currentRole,
  activeBranchId,
  branches,
  staffList,
  attendance,
  setAttendance,
  lang,
  onAddLog
}: AttendanceViewProps) {
  const t = translations[lang];

  // Filters State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [filterStaffId, setFilterStaffId] = useState('all');
  const [filterBranchId, setFilterBranchId] = useState(activeBranchId);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals State
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [editingRecord, setEditingRecord] = useState<Attendance | null>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editStatus, setEditStatus] = useState<any>('Present');
  const [editReason, setEditReason] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Manual Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStaffId, setAddStaffId] = useState('');
  const [addDate, setAddDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [addCheckIn, setAddCheckIn] = useState('07:00 AM');
  const [addCheckOut, setAddCheckOut] = useState('04:00 PM');
  const [addStatus, setAddStatus] = useState<'Present' | 'Late' | 'Absent' | 'Working' | 'Completed' | 'Manual'>('Present');
  const [addReason, setAddReason] = useState('កត់ត្រាវត្តមានដោយដៃ (Manual Entry)');

  // Main Sub-Tabs State (ដូចទំព័រទឹកក្រអូប Softeners & Detergents)
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'printable'>('daily');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [summaryBranchId, setSummaryBranchId] = useState<string>('all');
  const [selectedPrintStaffId, setSelectedPrintStaffId] = useState<string>('all');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Telegram Send Modal State
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramTarget, setTelegramTarget] = useState<'staff' | 'admin' | 'custom'>('staff');
  const [telegramStaffId, setTelegramStaffId] = useState<string>('');
  const [telegramCustomChatId, setTelegramCustomChatId] = useState<string>('');
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramFeedback, setTelegramFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // PDF Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportStaffId, setReportStaffId] = useState('all');
  const [reportBranchId, setReportBranchId] = useState('all');
  const [reportPeriodType, setReportPeriodType] = useState<'month' | 'year' | 'custom'>('month');
  const [reportMonth, setReportMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(() => new Date().getFullYear());
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const isAuthorized = ['Owner', 'Admin', 'Manager'].includes(currentRole);

  // Sync active branch selection from top bar
  useEffect(() => {
    setFilterBranchId(activeBranchId);
    if (activeBranchId !== 'all') {
      setSummaryBranchId(activeBranchId);
      setReportBranchId(activeBranchId);
    }
  }, [activeBranchId]);

  if (!isAuthorized) {
    return (
      <div className="bg-white border border-rose-100 rounded-3xl p-8 text-center max-w-xl mx-auto shadow-xs">
        <ShieldAlert className="text-rose-500 mx-auto mb-4" size={48} />
        <h3 className="text-base font-bold text-slate-900">{lang === 'en' ? "Access Restriction Alert" : "ការព្រមានការកម្រិតសិទ្ធិ"}</h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          {t.warningRoleLimit}
        </p>
      </div>
    );
  }

  // Filtered List
  const filteredRecords = useMemo(() => {
    let list = Array.isArray(attendance) ? attendance : [];

    if (filterBranchId !== 'all') {
      list = list.filter(a => a.branchId === filterBranchId);
    }

    if (selectedDate) {
      list = list.filter(a => a.date === selectedDate);
    }

    if (filterStaffId !== 'all') {
      list = list.filter(a => a.staffId === filterStaffId);
    }

    if (filterStatus !== 'all') {
      list = list.filter(a => a.status === filterStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => 
        (a.staffName && a.staffName.toLowerCase().includes(q)) ||
        (a.date && a.date.includes(q))
      );
    }

    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [attendance, filterBranchId, selectedDate, filterStaffId, filterStatus, searchQuery]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const todayList = (attendance || []).filter(a => {
      const matchesBranch = filterBranchId === 'all' || a.branchId === filterBranchId;
      return matchesBranch && a.date === (selectedDate || todayStr);
    });

    const totalToday = todayList.length;
    const workingCount = todayList.filter(a => a.status === 'Working').length;
    const lateCount = todayList.filter(a => a.status === 'Late').length;
    const absentCount = todayList.filter(a => a.status === 'Absent').length;

    return {
      totalToday,
      workingCount,
      lateCount,
      absentCount
    };
  }, [attendance, filterBranchId, selectedDate]);

  // Open Edit Modal
  const handleOpenEdit = (record: Attendance) => {
    setEditingRecord(record);
    setEditCheckIn(record.checkIn || '');
    setEditCheckOut(record.checkOut || '');
    setEditStatus(record.status || 'Present');
    setEditReason('');
  };

  // Save Edit with Audit Trail
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !editReason.trim()) {
      alert(lang === 'kh' ? 'សូមបញ្ជាក់មូលហេតុនៃការកែប្រែ!' : 'Please specify modification reason!');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/attendance/${editingRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkIn: editCheckIn,
          checkOut: editCheckOut,
          status: editStatus,
          reason: editReason.trim(),
          changedBy: currentRole
        })
      });

      const data = await res.json();
      if (data.success && data.attendance) {
        setAttendance(prev => prev.map(a => a.id === data.attendance.id ? data.attendance : a));
        onAddLog(`Edited attendance for ${editingRecord.staffName} on ${editingRecord.date}: ${editReason}`);
        setEditingRecord(null);
      } else {
        // Local fallback if offline
        const nowIso = new Date().toISOString();
        const updatedRecord: Attendance = {
          ...editingRecord,
          checkIn: editCheckIn,
          checkOut: editCheckOut,
          status: editStatus,
          auditHistory: [
            ...(editingRecord.auditHistory || []),
            {
              field: 'Manual Adjustment',
              oldValue: `${editingRecord.checkIn} - ${editingRecord.checkOut} (${editingRecord.status})`,
              newValue: `${editCheckIn} - ${editCheckOut} (${editStatus})`,
              changedBy: currentRole,
              changedAt: nowIso,
              reason: editReason.trim()
            }
          ],
          updatedAt: nowIso
        };
        setAttendance(prev => prev.map(a => a.id === updatedRecord.id ? updatedRecord : a));
        onAddLog(`Edited attendance for ${editingRecord.staffName}: ${editReason}`);
        setEditingRecord(null);
      }
    } catch (err: any) {
      alert('Error updating attendance: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Save Manual Entry
  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStaffId) return;

    const staff = staffList.find(s => s.id === addStaffId);
    if (!staff) return;

    const nowIso = new Date().toISOString();
    const newAtt: Attendance = {
      id: 'att_' + Date.now(),
      branchId: staff.branchId,
      staffId: staff.id,
      staffName: staff.fullName,
      date: addDate,
      checkIn: addStatus === 'Absent' ? '' : addCheckIn,
      checkOut: addStatus === 'Absent' ? '' : addCheckOut,
      shiftType: staff.shift || 'Full Time',
      workHours: addStatus === 'Absent' ? 0 : 8,
      overtimeHours: 0,
      status: addStatus,
      source: 'manual',
      auditHistory: [
        {
          field: 'Created',
          oldValue: null,
          newValue: 'Manual Entry',
          changedBy: currentRole,
          changedAt: nowIso,
          reason: addReason.trim() || 'Manual Clock Entry'
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    setAttendance(prev => [newAtt, ...prev.filter(a => !(a.staffId === staff.id && a.date === addDate))]);
    onAddLog(`Manually recorded attendance for ${staff.fullName} on ${addDate}`);
    setShowAddModal(false);
    setAddStaffId('');
  };

  // Matching records for the PDF report
  const reportMatchingRecords = useMemo(() => {
    let list = Array.isArray(attendance) ? attendance : [];

    if (reportBranchId !== 'all') {
      list = list.filter(a => a.branchId === reportBranchId);
    }

    if (reportStaffId !== 'all') {
      list = list.filter(a => a.staffId === reportStaffId);
    }

    if (reportPeriodType === 'month') {
      const prefix = `${reportYear}-${String(reportMonth).padStart(2, '0')}`;
      list = list.filter(a => a.date && a.date.startsWith(prefix));
    } else if (reportPeriodType === 'year') {
      const prefix = `${reportYear}-`;
      list = list.filter(a => a.date && a.date.startsWith(prefix));
    } else {
      list = list.filter(a => a.date && a.date >= reportStartDate && a.date <= reportEndDate);
    }

    return [...list].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [attendance, reportBranchId, reportStaffId, reportPeriodType, reportMonth, reportYear, reportStartDate, reportEndDate]);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const targetStaff = reportStaffId !== 'all' ? staffList.find(s => s.id === reportStaffId) : null;
      const targetBranch = reportBranchId !== 'all' ? branches.find(b => b.id === reportBranchId) : null;

      await generateAttendancePdf({
        periodType: reportPeriodType,
        month: reportMonth,
        year: reportYear,
        startDate: reportStartDate,
        endDate: reportEndDate,
        staff: targetStaff || null,
        branch: targetBranch || null,
        records: reportMatchingRecords,
        generatedBy: currentRole
      });
      onAddLog(`Exported attendance PDF report (${reportMatchingRecords.length} records)`);
    } catch (err: any) {
      alert('Error generating PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getBranchName = (bId: string) => {
    const b = branches.find(x => x.id === bId);
    return b ? b.branchName : 'toto by Chichi';
  };

  const formatWorkDuration = (val?: number, overrideLang?: 'kh' | 'en') => {
    if (val === undefined || val === null || isNaN(val)) return '--';
    const useLang = overrideLang || lang;
    if (val === 0) return useLang === 'kh' ? '0 ម៉ោង' : '0h';

    const totalMinutes = Math.round(val * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (useLang === 'kh') {
      if (hours === 0) return `${minutes} នាទី`;
      if (minutes === 0) return `${hours} ម៉ោង`;
      return `${hours} ម៉ោង ${minutes} នាទី`;
    } else {
      if (hours === 0) return `${minutes}mn`;
      if (minutes === 0) return `${hours}h`;
      return `${hours}h ${minutes}m`;
    }
  };

  // ----------------------------------------------------
  // MONTHLY & PRINTABLE LEDGER HELPERS
  // ----------------------------------------------------
  const monthNamesKh = [
    'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
    'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
  ];

  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Monthly aggregated stats per staff
  const staffMonthlyStats = useMemo(() => {
    let list = staffList;
    if (summaryBranchId !== 'all') {
      list = list.filter(s => s.branchId === summaryBranchId || s.assignedBranchId === summaryBranchId);
    }

    return list.map(staff => {
      const records = (attendance || []).filter(a => a.staffId === staff.id && a.date && a.date.startsWith(monthPrefix));
      const daysWorked = records.length;
      let totalWorkHours = 0;
      let totalOtHours = 0;
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      records.forEach(r => {
        totalWorkHours += r.workHours || 0;
        totalOtHours += r.overtimeHours || 0;
        if (r.status === 'Present' || r.status === 'Completed' || r.status === 'Working') presentCount++;
        if (r.status === 'Late') lateCount++;
        if (r.status === 'Absent') absentCount++;
      });

      return {
        staff,
        records,
        daysWorked,
        presentCount,
        lateCount,
        absentCount,
        totalWorkHours,
        totalOtHours
      };
    });
  }, [staffList, attendance, monthPrefix, summaryBranchId]);

  // Records for the Printable A4 Ledger Form
  const printableLedgerRecords = useMemo(() => {
    let list = (attendance || []).filter(a => a.date && a.date.startsWith(monthPrefix));

    if (summaryBranchId !== 'all') {
      list = list.filter(a => a.branchId === summaryBranchId);
    }
    if (selectedPrintStaffId !== 'all') {
      list = list.filter(a => a.staffId === selectedPrintStaffId);
    }

    return list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [attendance, monthPrefix, summaryBranchId, selectedPrintStaffId]);

  const printableStaffObj = selectedPrintStaffId !== 'all' ? staffList.find(s => s.id === selectedPrintStaffId) : null;
  const printableBranchObj = summaryBranchId !== 'all' ? branches.find(b => b.id === summaryBranchId) : null;

  const printableTotals = useMemo(() => {
    let totalWorkHours = 0;
    let totalOtHours = 0;
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    printableLedgerRecords.forEach(r => {
      totalWorkHours += r.workHours || 0;
      totalOtHours += r.overtimeHours || 0;
      if (r.status === 'Present' || r.status === 'Completed' || r.status === 'Working') presentCount++;
      if (r.status === 'Late') lateCount++;
      if (r.status === 'Absent') absentCount++;
    });

    return {
      totalDays: printableLedgerRecords.length,
      totalWorkHours,
      totalOtHours,
      presentCount,
      lateCount,
      absentCount
    };
  }, [printableLedgerRecords]);

  // 1. Native High-Res Print / Save PDF
  const handlePrintLedger = () => {
    printElement('attendance-printable-a4-ledger', `TC Staff Attendance - ${printableStaffObj ? printableStaffObj.fullName : 'All Staff'} - ${selectedMonth}/${selectedYear}`);
    onAddLog(`Printed attendance ledger for ${printableStaffObj ? printableStaffObj.fullName : 'All Staff'}`);
  };

  // 2. Direct Canvas-to-PDF High-Definition Export
  const handleExportPdfCanvas = async () => {
    setIsExportingPdf(true);
    try {
      const element = document.getElementById('attendance-printable-a4-ledger');
      if (!element) {
        alert('Printable element not found');
        return;
      }

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      const safeName = printableStaffObj ? printableStaffObj.fullName.replace(/\s+/g, '_') : 'All_Staff';
      pdf.save(`TC_Staff_Attendance_${safeName}_${selectedMonth}_${selectedYear}.pdf`);
      onAddLog(`Exported Attendance PDF for ${safeName}`);
    } catch (err: any) {
      alert('Error exporting PDF: ' + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // 3. Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const headers = [
      '#',
      lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ',
      lang === 'en' ? 'Employee Name' : 'ឈ្មោះបុគ្គលិក',
      lang === 'en' ? 'Branch' : 'សាខា',
      lang === 'en' ? 'Shift' : 'វេន',
      lang === 'en' ? 'Check In' : 'ម៉ោងចូល',
      lang === 'en' ? 'Check Out' : 'ម៉ោងចេញ',
      lang === 'en' ? 'Work Duration' : 'រយៈពេលធ្វើការ',
      lang === 'en' ? 'OT (Hours)' : 'ម៉ោងបន្ថែម (OT)',
      lang === 'en' ? 'Status' : 'ស្ថានភាព',
      lang === 'en' ? 'Source' : 'ប្រភព'
    ];

    const rows = printableLedgerRecords.map((r, i) => [
      i + 1,
      r.date,
      r.staffName || 'Staff',
      getBranchName(r.branchId),
      r.shiftType || 'Full Time',
      r.checkIn || '--',
      r.checkOut || '--',
      formatWorkDuration(r.workHours, 'en'),
      r.overtimeHours || 0,
      r.status || 'Present',
      r.source === 'telegram' ? 'Telegram' : 'Manual'
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Ledger");

    const safeName = printableStaffObj ? printableStaffObj.fullName.replace(/\s+/g, '_') : 'All_Staff';
    XLSX.writeFile(workbook, `TC_Staff_Attendance_${safeName}_${selectedMonth}_${selectedYear}.xlsx`);
    onAddLog(`Exported Attendance to Excel for ${safeName}`);
  };

  // 4. Send Attendance Report to Telegram (with A4 Canvas snapshot & formatted breakdown)
  const handleOpenSendTelegram = (targetStaffId?: string) => {
    const sId = targetStaffId || (selectedPrintStaffId !== 'all' ? selectedPrintStaffId : (staffList[0]?.id || ''));
    setTelegramStaffId(sId);
    setTelegramTarget(sId ? 'staff' : 'admin');
    setTelegramFeedback(null);
    setShowTelegramModal(true);
  };

  const handleSendToTelegram = async () => {
    setIsSendingTelegram(true);
    setTelegramFeedback(null);
    try {
      const targetStaff = staffList.find(s => s.id === telegramStaffId);
      const targetBranch = branches.find(b => b.id === (summaryBranchId !== 'all' ? summaryBranchId : targetStaff?.branchId));

      // 1. Capture snapshot of A4 ledger if element is available (with fast 1.5s race timeout)
      let photoBase64: string | undefined = undefined;
      const element = document.getElementById('attendance-printable-a4-ledger');
      if (element) {
        try {
          const html2canvasPromise = (async () => {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(element, { 
              scale: 1.15, 
              logging: false, 
              useCORS: false, 
              allowTaint: true,
              imageTimeout: 800,
              backgroundColor: '#ffffff' 
            });
            return canvas.toDataURL('image/jpeg', 0.70);
          })();
          const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500));
          photoBase64 = await Promise.race([html2canvasPromise, timeoutPromise]);
        } catch (e) {
          console.warn('Canvas capture skipped or failed:', e);
        }
      }

      // 2. Generate clean message text
      const periodStr = `ខែ ${selectedMonth} ឆ្នាំ ${selectedYear} (${monthNamesKh[selectedMonth - 1]} / ${monthNamesEn[selectedMonth - 1]} ${selectedYear})`;
      const staffStats = staffMonthlyStats.find(s => s.staff.id === telegramStaffId);

      let msg = '';
      if (telegramTarget === 'staff' && targetStaff) {
        msg = `📊 <b>[Cafe - របាយការណ៍វត្តមានប្រចាំខែ / Monthly Attendance]</b>\n\n` +
          `👤 <b>បុគ្គលិក:</b> ${targetStaff.fullName} (${targetStaff.position || 'Staff'})\n` +
          `🏢 <b>សាខា:</b> ${targetBranch?.branchName || 'toto by Chichi'}\n` +
          `📅 <b>រយៈពេល:</b> ${periodStr}\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `✅ <b>ថ្ងៃធ្វើការសរុប:</b> <b>${staffStats ? staffStats.daysWorked : printableTotals.totalDays} ថ្ងៃ</b>\n` +
          `⏱️ <b>ម៉ោងបំពេញការងារសរុប:</b> <b>${staffStats ? formatWorkDuration(staffStats.totalWorkHours, 'kh') : formatWorkDuration(printableTotals.totalWorkHours, 'kh')}</b>\n` +
          `⚡ <b>ម៉ោងបន្ថែម (OT):</b> <b>${staffStats ? staffStats.totalOtHours : printableTotals.totalOtHours}h</b>\n` +
          `🎯 <b>ទាន់ពេល:</b> ${staffStats ? staffStats.presentCount : printableTotals.presentCount} ថ្ងៃ | ` +
          `⚠️ <b>យឺត:</b> ${staffStats ? staffStats.lateCount : printableTotals.lateCount} ថ្ងៃ | ` +
          `❌ <b>អវត្តមាន:</b> ${staffStats ? staffStats.absentCount : printableTotals.absentCount} ថ្ងៃ\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `✨ <i>សូមពិនិត្យមើលទិន្នន័យវត្តមាន និងតារាងលម្អិតភ្ជាប់ជាមួយនេះ។ អរគុណសម្រាប់ការបំពេញការងារ!</i>`;
      } else {
        msg = `📊 <b>[TC Staff Management - របាយការណ៍សង្ខេបវត្តមានរួម / Master Attendance Report]</b>\n\n` +
          `🏢 <b>សាខា:</b> ${targetBranch ? targetBranch.branchName : 'គ្រប់សាខាទាំងអស់'}\n` +
          `📅 <b>រយៈពេល:</b> ${periodStr}\n` +
          `👥 <b>ចំនួនបុគ្គលិក:</b> ${staffMonthlyStats.length} នាក់\n` +
          `⏱️ <b>ម៉ោងសរុបរួម:</b> ${formatWorkDuration(printableTotals.totalWorkHours, 'kh')}\n` +
          `⚡ <b>ម៉ោងបន្ថែម OT សរុប:</b> ${printableTotals.totalOtHours} ម៉ោង`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      let res;
      try {
        res = await fetch('/api/telegram/send-attendance-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            target: telegramTarget,
            staffId: telegramStaffId,
            customChatId: telegramCustomChatId,
            messageText: msg,
            photoBase64
          })
        });
        if (!res.ok && res.status !== 400 && res.status !== 404) {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (fErr) {
        res = await fetch('/api/telegram-send-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            target: telegramTarget,
            staffId: telegramStaffId,
            customChatId: telegramCustomChatId,
            messageText: msg,
            photoBase64
          })
        });
      }
      clearTimeout(timeoutId);

      const data = await res.json();
      if (data.success) {
        setTelegramFeedback({ success: true, message: data.message });
        onAddLog(`Sent Attendance Report to Telegram (${data.recipient})`);
        setTimeout(() => {
          setShowTelegramModal(false);
          setTelegramFeedback(null);
        }, 1800);
      } else {
        setTelegramFeedback({ success: false, message: data.error || 'បរាជ័យក្នុងការផ្ញើ' });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setTelegramFeedback({ success: false, message: 'ដំណើរការផ្ញើយូរពេក (Request Timeout)។ សូមព្យាយាមផ្ញើទៅកាន់ « Admin / Group » វិញ។' });
      } else {
        setTelegramFeedback({ success: false, message: 'កំហុសបច្ចេកទេស៖ ' + err.message });
      }
    } finally {
      setIsSendingTelegram(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SINGLE UNIFIED TOP HEADER */}
      <div className="bg-white p-3 sm:p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        {/* Row 1: Tab Switcher + Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'daily'
                  ? 'bg-white text-[#003D9B] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={14} />
              <span>{lang === 'kh' ? '📋 កត់ត្រាវត្តមានប្រចាំថ្ងៃ' : 'Daily Attendance Log'}</span>
            </button>

            <button
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'monthly'
                  ? 'bg-white text-[#003D9B] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar size={14} />
              <span>{lang === 'kh' ? '📊 សង្ខេបប្រចាំខែតាមបុគ្គលិក' : 'Monthly Staff Summary'}</span>
            </button>

            <button
              onClick={() => setActiveTab('printable')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'printable'
                  ? 'bg-[#003D9B] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer size={14} />
              <span>{lang === 'kh' ? '📄 ទម្រង់ក្រដាសបោះពុម្ព & PDF' : 'Printable Form & PDF'}</span>
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {activeTab === 'daily' && (
              <>
                <button
                  onClick={() => setShowReportModal(true)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <FileDown size={13} />
                  <span>{lang === 'kh' ? 'របាយការណ៍ PDF' : 'PDF Report'}</span>
                </button>
                {isAuthorized && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-3.5 py-2 bg-[#003D9B] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus size={14} />
                    <span>{lang === 'kh' ? 'កត់ត្រាវត្តមានដោយដៃ' : 'Manual Entry'}</span>
                  </button>
                )}
              </>
            )}

            {activeTab === 'monthly' && (
              <button
                onClick={() => setActiveTab('printable')}
                className="px-3.5 py-2 bg-[#003D9B] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Printer size={13} />
                <span>{lang === 'kh' ? 'មើលទម្រង់ក្រដាស & PDF' : 'View Printable'}</span>
              </button>
            )}

            {activeTab === 'printable' && (
              <>
                <button
                  onClick={handlePrintLedger}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Printer size={13} />
                  <span>{lang === 'kh' ? 'បោះពុម្ព' : 'Print'}</span>
                </button>
                <button
                  onClick={handleExportPdfCanvas}
                  disabled={isExportingPdf}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <FileDown size={13} />
                  <span>{isExportingPdf ? 'កំពុងទាញយក...' : 'PDF'}</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <FileSpreadsheet size={13} />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => handleOpenSendTelegram()}
                  className="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Send size={13} />
                  <span>Telegram</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Context Filter Bar (Unified inside same card for Monthly & Printable) */}
        {(activeTab === 'monthly' || activeTab === 'printable') && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {activeTab === 'printable' && (
                <div>
                  <label className="text-[10.5px] font-bold text-slate-500 block mb-1">បុគ្គលិក (Staff)</label>
                  <select
                    value={selectedPrintStaffId}
                    onChange={e => setSelectedPrintStaffId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="all">👥 គ្រប់បុគ្គលិកទាំងអស់ (All Staff)</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.fullName} ({s.position || 'Staff'})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-1">សាខា (Branch)</label>
                <select
                  value={summaryBranchId}
                  onChange={e => setSummaryBranchId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                >
                  <option value="all">🌐 គ្រប់សាខា (All Branches)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-1">ខែ (Month)</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <option key={m} value={m}>ខែ {m} ({monthNamesKh[m - 1]} / {monthNamesEn[m - 1]})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-1">ឆ្នាំ (Year)</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none font-mono"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY ATTENDANCE LOG */}
      {/* ========================================================================= */}
      {activeTab === 'daily' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 1. TOP SUMMARY METRIC CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {lang === 'kh' ? 'វត្តមានថ្ងៃនេះ' : "Today's Attendance"}
                </span>
                <UserCheck size={16} className="text-[#003D9B]" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-black text-slate-900">{summaryMetrics.totalToday}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">នាក់បានកត់ត្រា</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {lang === 'kh' ? 'កំពុងធ្វើការ' : 'Working Now'}
                </span>
                <Clock size={16} className="text-blue-600" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-black text-blue-700">{summaryMetrics.workingCount}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">នាក់មិនទាន់ចេញ</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {lang === 'kh' ? 'យឺត' : 'Late'}
                </span>
                <AlertCircle size={16} className="text-amber-600" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-black text-amber-700">{summaryMetrics.lateCount}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">នាក់មកយឺត</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {lang === 'kh' ? 'អវត្តមាន' : 'Absent'}
                </span>
                <XCircle size={16} className="text-rose-600" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-black text-rose-700">{summaryMetrics.absentCount}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">នាក់ឈប់សម្រាក</span>
              </div>
            </div>
          </div>

          {/* 2. MAIN ATTENDANCE CARD & CONTROLS */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            {/* Header & Add Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {lang === 'kh' ? 'ការចុះវត្តមានបុគ្គលិក (Staff Attendance)' : 'Staff Attendance Management'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'kh' ? 'កត់ត្រាដោយស្វ័យប្រវត្តិតាម Telegram Bot & Mini App ជាមួយ Face Verification & GPS' : 'Automated via Telegram Bot & Mini App with Face Verification & GPS'}
                </p>
              </div>

              <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-[#003D9B] rounded-full border border-blue-200 w-fit">
                {filteredRecords.length} កំណត់ត្រា
              </span>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              {/* Date Picker */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-1">កាលបរិច្ឆេទ</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Branch Filter */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-1">សាខា</label>
                <select
                  value={filterBranchId}
                  onChange={e => setFilterBranchId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">🌐 គ្រប់សាខា</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              {/* Staff Filter */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-1">បុគ្គលិក</label>
                <select
                  value={filterStaffId}
                  onChange={e => setFilterStaffId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">👥 គ្រប់បុគ្គលិក</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.fullName}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-1">ស្ថានភាព</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">✨ គ្រប់ស្ថានភាព</option>
                  <option value="Working">⏳ កំពុងធ្វើការ (Working)</option>
                  <option value="Completed">✓ បានចេញ (Completed)</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late (យឺត)</option>
                  <option value="Absent">Absent (អវត្តមាន)</option>
                  <option value="Manual">Manual Entry</option>
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-1">ស្វែងរក</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
                  <input
                    type="text"
                    placeholder="ឈ្មោះ..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Attendance Data Table */}
            {filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Calendar size={36} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold">មិនមានទិន្នន័យវត្តមានតាមការស្វែងរកឡើយ</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10.5px] uppercase font-bold tracking-wider">
                      <th className="py-3 px-3.5">ឈ្មោះបុគ្គលិក</th>
                      <th className="py-3 px-3">សាខា</th>
                      <th className="py-3 px-3 text-center">ចូល (Check In)</th>
                      <th className="py-3 px-3 text-center">ចេញ (Check Out)</th>
                      <th className="py-3 px-3 text-center">រយៈពេលធ្វើការ</th>
                      <th className="py-3 px-3 text-center">ស្ថានភាព</th>
                      <th className="py-3 px-3 text-center">ប្រភព</th>
                      <th className="py-3 px-3 text-center">ឧបករណ៍ / Device</th>
                      <th className="py-3 px-3.5 text-right">សកម្មភាព</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Staff Name */}
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-900">{rec.staffName}</div>
                          <div className="text-[10px] text-slate-400">{rec.date} • {rec.shiftType || 'Shift'}</div>
                        </td>

                        {/* Branch */}
                        <td className="py-3 px-3">
                          <span className="text-slate-600 font-medium">{getBranchName(rec.branchId)}</span>
                        </td>

                        {/* Check In */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                          {rec.checkIn || '--'}
                        </td>

                        {/* Check Out */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-rose-700">
                          {rec.checkOut || '--'}
                        </td>

                        {/* Work Hours Duration */}
                        <td className="py-3 px-3 text-center text-xs">
                          <span className="font-bold text-slate-800 bg-slate-100/90 px-2.5 py-1 rounded-xl inline-block font-sans">
                            {formatWorkDuration(rec.workHours)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold inline-block ${
                            rec.status === 'Working'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : rec.status === 'Completed' || rec.status === 'Present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : rec.status === 'Late'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : rec.status === 'Absent'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {rec.status === 'Working' ? '⏳ កំពុងធ្វើការ' : rec.status === 'Completed' ? '✓ បានចេញ' : rec.status}
                          </span>
                        </td>

                        {/* Source Badge */}
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                            rec.source === 'telegram' 
                              ? 'bg-sky-50 text-sky-700 border border-sky-200' 
                              : 'bg-slate-50 text-slate-600 border border-slate-200'
                          }`}>
                            {rec.source === 'telegram' ? <Smartphone size={11} /> : <FileText size={11} />}
                            <span>{rec.source === 'telegram' ? 'Telegram' : 'Manual'}</span>
                          </span>
                        </td>

                        {/* Device / Session Info Column */}
                        <td className="py-3 px-3 text-center">
                          {(rec.checkInDevice || rec.checkOutDevice) ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10.5px] font-medium border border-slate-200/80 transition shadow-2xs max-w-[160px] truncate cursor-default"
                              title={`Check-In: ${rec.checkInDevice || 'N/A'}\nCheck-Out: ${rec.checkOutDevice || 'N/A'}\nPlatform: ${rec.checkInPlatform || rec.checkOutPlatform || 'N/A'}`}
                            >
                              <Smartphone size={12} className="text-blue-600 shrink-0" />
                              <span className="truncate">{rec.checkInDevice || rec.checkOutDevice}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">--</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedRecord(rec)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                              title="មើលព័ត៌មានលម្អិត & Session"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(rec)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition cursor-pointer"
                              title="កែប្រែវត្តមាន"
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONTHLY STAFF SUMMARY */}
      {/* ========================================================================= */}
      {activeTab === 'monthly' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Monthly Staff Summary Table */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {lang === 'kh' ? `តារាងសង្ខេបវត្តមានប្រចាំខែ ${selectedMonth}/${selectedYear}` : `Monthly Attendance Summary (${selectedMonth}/${selectedYear})`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ចំនួនថ្ងៃធ្វើការ, ម៉ោងសរុប និងអវត្តមានសម្រាប់បុគ្គលិកម្នាក់ៗក្នុងខែ {monthNamesKh[selectedMonth - 1]}
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-[#003D9B] rounded-full border border-blue-200">
                {staffMonthlyStats.length} បុគ្គលិក
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10.5px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-3.5">បុគ្គលិក</th>
                    <th className="py-3 px-3">សាខា</th>
                    <th className="py-3 px-3 text-center">ថ្ងៃធ្វើការ</th>
                    <th className="py-3 px-3 text-center text-emerald-700">ទាន់ពេល</th>
                    <th className="py-3 px-3 text-center text-amber-700">យឺត</th>
                    <th className="py-3 px-3 text-center text-rose-700">អវត្តមាន</th>
                    <th className="py-3 px-3 text-center">ម៉ោងសរុប</th>
                    <th className="py-3 px-3 text-center">OT</th>
                    <th className="py-3 px-3.5 text-right">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {staffMonthlyStats.map(({ staff, daysWorked, presentCount, lateCount, absentCount, totalWorkHours, totalOtHours }) => (
                    <tr key={staff.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          {staff.photoUrl ? (
                            <img src={staff.photoUrl} alt={staff.fullName} className="w-8 h-8 rounded-xl object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#003D9B] flex items-center justify-center font-bold text-xs shrink-0">
                              {staff.fullName ? staff.fullName.charAt(0) : 'S'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900">{staff.fullName}</div>
                            <div className="text-[10px] text-slate-400">{staff.position || 'Staff'} • {staff.shift || 'Full Time'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-medium text-slate-600">
                        {getBranchName(staff.branchId || staff.assignedBranchId || '')}
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {daysWorked} ថ្ងៃ
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-emerald-700">
                        {presentCount}
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-amber-700">
                        {lateCount}
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-rose-700">
                        {absentCount}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-xl inline-block">
                          {formatWorkDuration(totalWorkHours)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                        {totalOtHours ? `${totalOtHours}h` : '0h'}
                      </td>

                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 ml-auto">
                          <button
                            onClick={() => {
                              setSelectedPrintStaffId(staff.id);
                              setActiveTab('printable');
                            }}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#003D9B] font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                          >
                            <Printer size={12} />
                            <span>ទម្រង់ក្រដាស</span>
                          </button>
                          <button
                            onClick={() => handleOpenSendTelegram(staff.id)}
                            className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                            title="ផ្ញើរបាយការណ៍ទៅ Telegram របស់បុគ្គលិក"
                          >
                            <Send size={12} />
                            <span>Telegram</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PRINTABLE PAPER FORM & PDF CANVAS (ដូចទំព័រទឹកក្រអូប Softener Ledger) */}
      {/* ========================================================================= */}
      {activeTab === 'printable' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* PRINTABLE A4 CONTAINER (HTML with Native Khmer Typography) */}
          <div className="flex justify-center overflow-x-auto p-4 bg-slate-200/60 rounded-3xl border border-slate-300">
            <div 
              id="attendance-printable-a4-ledger"
              className="w-full max-w-[840px] bg-white text-slate-900 p-8 sm:p-10 shadow-xl rounded-2xl space-y-6 font-sans antialiased border border-slate-100"
            >
              {/* Header Top Bar */}
              <div className="border-b-2 border-[#003D9B] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="text-xl font-black text-[#003D9B] tracking-wide">
                    TC STAFF MANAGEMENT SYSTEM
                  </h1>
                  <h2 className="text-sm font-bold text-slate-700 mt-0.5">
                    STAFF ATTENDANCE & WORKING HOURS LEDGER / សៀវភៅបញ្ជីវត្តមានបុគ្គលិក
                  </h2>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold text-slate-800">
                    {monthNamesKh[selectedMonth - 1]} ឆ្នាំ {selectedYear} ({monthNamesEn[selectedMonth - 1]} {selectedYear})
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    កាលបរិច្ឆេទបង្កើត៖ {new Date().toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>

              {/* Report Info Grid */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10.5px] font-bold text-slate-400 block">ឈ្មោះបុគ្គលិក (Staff)</span>
                  <span className="font-black text-slate-900 text-sm block mt-0.5">
                    {printableStaffObj ? printableStaffObj.fullName : 'បុគ្គលិកទាំងអស់ (All Staff)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] font-bold text-slate-400 block">តួនាទី / វេន</span>
                  <span className="font-bold text-slate-700 block mt-0.5">
                    {printableStaffObj ? `${printableStaffObj.position || 'Staff'} • ${printableStaffObj.shift || 'Full Time'}` : 'គ្រប់តួនាទី'}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] font-bold text-slate-400 block">សាខា (Branch)</span>
                  <span className="font-bold text-slate-700 block mt-0.5">
                    {printableBranchObj ? printableBranchObj.branchName : 'គ្រប់សាខា (All Branches)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] font-bold text-slate-400 block">លេខសម្គាល់ (ID Card)</span>
                  <span className="font-mono font-bold text-slate-700 block mt-0.5">
                    {printableStaffObj?.idCardNumber || printableStaffObj?.phone || 'N/A'}
                  </span>
                </div>
              </div>

              {/* 4 Summary Stat Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-center">
                  <span className="text-[10.5px] font-bold text-blue-700 block">ចំនួនថ្ងៃសរុប (Days)</span>
                  <span className="text-xl font-black text-blue-900 mt-1 block">{printableTotals.totalDays}</span>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-center">
                  <span className="text-[10.5px] font-bold text-emerald-700 block">ម៉ោងសរុប (Hours)</span>
                  <span className="text-xl font-black text-emerald-900 mt-1 block">
                    {formatWorkDuration(printableTotals.totalWorkHours)}
                  </span>
                </div>
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 text-center">
                  <span className="text-[10.5px] font-bold text-amber-700 block">ម៉ោងបន្ថែម (OT)</span>
                  <span className="text-xl font-black text-amber-900 mt-1 block">{printableTotals.totalOtHours}h</span>
                </div>
                <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3 text-center">
                  <span className="text-[10.5px] font-bold text-purple-700 block">វត្តមានទាន់ពេល</span>
                  <span className="text-xl font-black text-purple-900 mt-1 block">{printableTotals.presentCount} ថ្ងៃ</span>
                </div>
              </div>

              {/* Full Detailed Day-by-Day Table */}
              <div className="rounded-xl border border-slate-300 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#003D9B] text-white text-[10.5px] font-bold">
                      <th className="py-2.5 px-2.5 text-center w-8 border-r border-blue-800">#</th>
                      <th className="py-2.5 px-3 border-r border-blue-800">កាលបរិច្ឆេទ</th>
                      <th className="py-2.5 px-3 border-r border-blue-800">
                        {printableStaffObj ? 'វេន' : 'ឈ្មោះបុគ្គលិក'}
                      </th>
                      <th className="py-2.5 px-2.5 text-center border-r border-blue-800">ម៉ោងចូល</th>
                      <th className="py-2.5 px-2.5 text-center border-r border-blue-800">ម៉ោងចេញ</th>
                      <th className="py-2.5 px-2.5 text-center border-r border-blue-800">រយៈពេលធ្វើការ</th>
                      <th className="py-2.5 px-2.5 text-center border-r border-blue-800">OT</th>
                      <th className="py-2.5 px-2.5 text-center border-r border-blue-800">ស្ថានភាព</th>
                      <th className="py-2.5 px-2.5 text-center">ប្រភព</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {printableLedgerRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400 font-bold">
                          មិនមានទិន្នន័យវត្តមានសម្រាប់ខែ {selectedMonth}/{selectedYear} ឡើយ
                        </td>
                      </tr>
                    ) : (
                      printableLedgerRecords.map((r, i) => {
                        const d = new Date(r.date);
                        const dayNamesKhmer = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
                        const dayOfWeek = isNaN(d.getTime()) ? '' : dayNamesKhmer[d.getDay()];

                        return (
                          <tr key={r.id || i} className="hover:bg-slate-50 odd:bg-white even:bg-slate-50/40">
                            <td className="py-2 px-2.5 text-center border-r border-slate-200 font-mono text-slate-500 font-bold">{i + 1}</td>
                            <td className="py-2 px-3 border-r border-slate-200 font-medium">
                              <span className="font-mono font-bold text-slate-900">{r.date}</span>
                              <span className="text-[10px] text-slate-500 ml-1">({dayOfWeek})</span>
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900">
                              {printableStaffObj ? (r.shiftType || 'Full Time') : (r.staffName || 'Staff')}
                            </td>
                            <td className="py-2 px-2.5 text-center border-r border-slate-200 font-mono font-bold text-emerald-700">
                              {r.checkIn || '--'}
                            </td>
                            <td className="py-2 px-2.5 text-center border-r border-slate-200 font-mono font-bold text-rose-700">
                              {r.checkOut || '--'}
                            </td>
                            <td className="py-2 px-2.5 text-center border-r border-slate-200 font-bold text-slate-800">
                              {formatWorkDuration(r.workHours)}
                            </td>
                            <td className="py-2 px-2 text-center border-r border-slate-200 font-mono text-slate-600">
                              {r.overtimeHours ? `${r.overtimeHours}h` : '0h'}
                            </td>
                            <td className="py-2 px-2.5 text-center border-r border-slate-200">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                                r.status === 'Completed' || r.status === 'Present'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'Late'
                                  ? 'bg-amber-100 text-amber-800'
                                  : r.status === 'Absent'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}>
                                {r.status || 'Present'}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-center font-bold text-[10px] text-slate-500 uppercase">
                              {r.source === 'telegram' ? 'Telegram' : 'Manual'}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* Total Row */}
                    {printableLedgerRecords.length > 0 && (
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                        <td colSpan={5} className="py-2.5 px-3 text-right border-r border-slate-300">
                          សរុបរួម (TOTAL):
                        </td>
                        <td className="py-2.5 px-2.5 text-center border-r border-slate-300 text-emerald-800 font-black">
                          {formatWorkDuration(printableTotals.totalWorkHours)}
                        </td>
                        <td className="py-2.5 px-2 text-center border-r border-slate-300 font-mono">
                          {printableTotals.totalOtHours}h
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-center text-[10.5px] text-slate-500">
                          {printableTotals.totalDays} ថ្ងៃធ្វើការ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signatures Footer */}
              <div className="pt-6 grid grid-cols-3 gap-6 text-center text-xs">
                <div>
                  <div className="font-bold text-slate-900">អ្នករៀបចំ (Prepared By)</div>
                  <div className="h-14 border-b border-dashed border-slate-300 mt-2" />
                  <div className="text-[10.5px] text-slate-400 mt-1">បុគ្គលិក / រដ្ឋបាល</div>
                </div>
                <div>
                  <div className="font-bold text-slate-900">អ្នកត្រួតពិនិត្យ (Checked By)</div>
                  <div className="h-14 border-b border-dashed border-slate-300 mt-2" />
                  <div className="text-[10.5px] text-slate-400 mt-1">ប្រធានផ្នែក / Supervisor</div>
                </div>
                <div>
                  <div className="font-bold text-slate-900">អ្នកអនុម័ត (Approved By)</div>
                  <div className="h-14 border-b border-dashed border-slate-300 mt-2" />
                  <div className="text-[10.5px] text-slate-400 mt-1">ប្រធានសាខា / ម្ចាស់ហាង</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. DETAIL MODAL (ATTENDANCE DETAIL & BIOMETRICS) */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck size={18} className="text-[#003D9B]" />
                <h3 className="text-sm font-black text-slate-900">ព័ត៌មានលម្អិតវត្តមាន (Attendance Detail)</h3>
              </div>
              <button 
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Profile Bar */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block">បុគ្គលិក</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">{selectedRecord.staffName}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">កាលបរិច្ឆេទ</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">{selectedRecord.date}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">សាខា</span>
                <span className="font-bold text-slate-700 block mt-0.5">{getBranchName(selectedRecord.branchId)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">ប្រភព</span>
                <span className="font-bold text-blue-700 block mt-0.5 uppercase">{selectedRecord.source || 'Manual'}</span>
              </div>
            </div>

            {/* Check-In vs Check-Out Card */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Check In Info */}
              <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-3.5 space-y-2">
                <div className="font-black text-emerald-800 flex items-center justify-between text-[11px] pb-1 border-b border-emerald-100">
                  <span>១. ចូល (CHECK IN)</span>
                  <span className="font-mono">{selectedRecord.checkIn || '--'}</span>
                </div>
                {selectedRecord.checkInPhoto && (
                  <img 
                    src={selectedRecord.checkInPhoto} 
                    alt="Check In Selfie" 
                    className="w-full h-24 object-cover rounded-xl border border-emerald-200" 
                  />
                )}
                <div className="text-[10.5px] text-slate-600 space-y-1">
                  <div>Face Match: <strong>{selectedRecord.checkInFaceScore ? `${(selectedRecord.checkInFaceScore * 100).toFixed(1)}%` : 'Passed ✓'}</strong></div>
                  {selectedRecord.checkInDistance !== undefined && (
                    <div>ចម្ងាយ GPS: <strong>{selectedRecord.checkInDistance} ម៉ែត្រ</strong></div>
                  )}
                  {selectedRecord.checkInDevice && (
                    <div className="pt-1 border-t border-emerald-100 flex items-center gap-1 text-[10px] text-slate-700">
                      <Smartphone size={12} className="text-emerald-600 shrink-0" />
                      <span className="truncate font-semibold" title={selectedRecord.checkInDevice}>
                        {selectedRecord.checkInDevice}
                      </span>
                    </div>
                  )}
                  {selectedRecord.checkInPlatform && (
                    <div className="text-[9.5px] text-slate-500">
                      Platform: <span className="font-medium text-slate-700">{selectedRecord.checkInPlatform}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Check Out Info */}
              <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-3.5 space-y-2">
                <div className="font-black text-rose-800 flex items-center justify-between text-[11px] pb-1 border-b border-rose-100">
                  <span>២. ចេញ (CHECK OUT)</span>
                  <span className="font-mono">{selectedRecord.checkOut || '--'}</span>
                </div>
                {selectedRecord.checkOutPhoto && (
                  <img 
                    src={selectedRecord.checkOutPhoto} 
                    alt="Check Out Selfie" 
                    className="w-full h-24 object-cover rounded-xl border border-rose-200" 
                  />
                )}
                <div className="text-[10.5px] text-slate-600 space-y-1">
                  <div>Face Match: <strong>{selectedRecord.checkOutFaceScore ? `${(selectedRecord.checkOutFaceScore * 100).toFixed(1)}%` : 'Passed ✓'}</strong></div>
                  {selectedRecord.checkOutDistance !== undefined && (
                    <div>ចម្ងាយ GPS: <strong>{selectedRecord.checkOutDistance} ម៉ែត្រ</strong></div>
                  )}
                  {selectedRecord.checkOutDevice && (
                    <div className="pt-1 border-t border-rose-100 flex items-center gap-1 text-[10px] text-slate-700">
                      <Smartphone size={12} className="text-rose-600 shrink-0" />
                      <span className="truncate font-semibold" title={selectedRecord.checkOutDevice}>
                        {selectedRecord.checkOutDevice}
                      </span>
                    </div>
                  )}
                  {selectedRecord.checkOutPlatform && (
                    <div className="text-[9.5px] text-slate-500">
                      Platform: <span className="font-medium text-slate-700">{selectedRecord.checkOutPlatform}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Total Work Duration Banner */}
            {selectedRecord.workHours !== undefined && selectedRecord.workHours !== null && (
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#003D9B] flex items-center justify-center font-bold">
                    <Clock size={16} />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">រយៈពេលធ្វើការសរុប (Work Duration)</span>
                    <span className="font-black text-[#003D9B] text-sm">
                      {formatWorkDuration(selectedRecord.workHours)}
                    </span>
                  </div>
                </div>
                {selectedRecord.overtimeHours ? (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg font-bold text-[11px]">
                    OT: {selectedRecord.overtimeHours}h
                  </span>
                ) : null}
              </div>
            )}

            {/* Audit History Log */}
            {selectedRecord.auditHistory && selectedRecord.auditHistory.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <History size={13} className="text-slate-400" />
                  <span>ប្រវត្តិ Audit Log</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11px]">
                  {selectedRecord.auditHistory.map((log, idx) => (
                    <div key={idx} className="text-slate-600 pb-1 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="flex justify-between font-medium">
                        <span>{log.changedBy} ({log.field})</span>
                        <span className="text-[10px] text-slate-400">{log.changedAt?.substring(0, 16).replace('T', ' ')}</span>
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        មូលហេតុ៖ <span className="font-bold text-slate-700">{log.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedRecord(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              បិទផ្ទាំង
            </button>
          </div>
        </div>
      )}

      {/* 4. MANUAL CORRECTION MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-[#003D9B]" />
                <h3 className="text-sm font-black text-slate-900">កែប្រែវត្តមាន (Manual Correction)</h3>
              </div>
              <button 
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs text-blue-900">
              <span className="font-bold">{editingRecord.staffName}</span> • {editingRecord.date}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">ម៉ោងចូល</label>
                <input
                  type="text"
                  placeholder="07:00 AM"
                  value={editCheckIn}
                  onChange={e => setEditCheckIn(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">ម៉ោងចេញ</label>
                <input
                  type="text"
                  placeholder="04:00 PM"
                  value={editCheckOut}
                  onChange={e => setEditCheckOut(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono font-bold"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">ស្ថានភាព</label>
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="Present">Present (វត្តមាន)</option>
                <option value="Working">Working (កំពុងធ្វើការ)</option>
                <option value="Completed">Completed (បានចេញ)</option>
                <option value="Late">Late (យឺត)</option>
                <option value="Absent">Absent (អវត្តមាន)</option>
                <option value="Manual">Manual</option>
              </select>
            </div>

            <div className="text-xs">
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">
                មូលហេតុនៃការកែប្រែ (Audit Reason) *
              </label>
              <textarea
                rows={2}
                placeholder="ឧ. បុគ្គលិកភ្លេច Check-in តាមទូរស័ព្ទ..."
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="flex-1 py-2.5 bg-[#003D9B] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSavingEdit ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការកែប្រែ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. MANUAL ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={handleSaveAdd} className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-[#003D9B]" />
                <h3 className="text-sm font-black text-slate-900">កត់ត្រាវត្តមានដោយដៃ (Manual Entry)</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs">
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">ជ្រើសរើសបុគ្គលិក *</label>
              <select
                value={addStaffId}
                onChange={e => setAddStaffId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                required
              >
                <option value="">-- ជ្រើសរើសបុគ្គលិក --</option>
                {staffList.filter(s => s.status === 'Active').map(s => (
                  <option key={s.id} value={s.id}>{s.fullName} ({s.position})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">កាលបរិច្ឆេទ *</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={e => setAddDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">ស្ថានភាព *</label>
                <select
                  value={addStatus}
                  onChange={e => setAddStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="Present">Present (វត្តមាន)</option>
                  <option value="Late">Late (យឺត)</option>
                  <option value="Absent">Absent (អវត្តមាន)</option>
                  <option value="Working">Working</option>
                  <option value="Completed">Completed</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
            </div>

            {addStatus !== 'Absent' && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">ម៉ោងចូល</label>
                  <input
                    type="text"
                    value={addCheckIn}
                    onChange={e => setAddCheckIn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">ម៉ោងចេញ</label>
                  <input
                    type="text"
                    value={addCheckOut}
                    onChange={e => setAddCheckOut(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono font-bold"
                  />
                </div>
              </div>
            )}

            <div className="text-xs">
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">សម្គាល់ / មូលហេតុ</label>
              <input
                type="text"
                placeholder="ឧ. កត់ត្រាវត្តមានផ្ទាល់..."
                value={addReason}
                onChange={e => setAddReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#003D9B] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                កត់ត្រាវត្តមាន
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. PDF REPORT GENERATOR MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileDown size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">ទាញយករបាយការណ៍វត្តមាន (Attendance PDF Report)</h3>
                  <p className="text-[11px] text-slate-500">ជ្រើសរើសបុគ្គលិក និងរយៈពេលដើម្បី Generate PDF</p>
                </div>
              </div>
              <button 
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Filter Staff */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">ជ្រើសរើសបុគ្គលិក (Staff Member)</label>
                <select
                  value={reportStaffId}
                  onChange={e => setReportStaffId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="all">👥 គ្រប់បុគ្គលិកទាំងអស់ (All Staff)</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.position || 'Staff'})</option>
                  ))}
                </select>
              </div>

              {/* Filter Branch */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">ជ្រើសរើសសាខា (Branch)</label>
                <select
                  value={reportBranchId}
                  onChange={e => setReportBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="all">🌐 គ្រប់សាខាទាំងអស់ (All Branches)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              {/* Period Type Selection */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">ជ្រើសរើសប្រភេទកាលបរិច្ឆេទ (Period Type)</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl font-bold text-[11px]">
                  <button
                    type="button"
                    onClick={() => setReportPeriodType('month')}
                    className={`py-1.5 rounded-lg transition cursor-pointer ${
                      reportPeriodType === 'month' ? 'bg-white text-[#003D9B] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ប្រចាំខែ (Monthly)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportPeriodType('year')}
                    className={`py-1.5 rounded-lg transition cursor-pointer ${
                      reportPeriodType === 'year' ? 'bg-white text-[#003D9B] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ប្រចាំឆ្នាំ (Yearly)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportPeriodType('custom')}
                    className={`py-1.5 rounded-lg transition cursor-pointer ${
                      reportPeriodType === 'custom' ? 'bg-white text-[#003D9B] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ចន្លោះថ្ងៃ (Custom)
                  </button>
                </div>
              </div>

              {/* Conditional Period Selectors */}
              {reportPeriodType === 'month' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-500 block mb-1">ខែ (Month)</label>
                    <select
                      value={reportMonth}
                      onChange={e => setReportMonth(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none"
                    >
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                        <option key={m} value={m}>ខែ {m} (Month {m})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-500 block mb-1">ឆ្នាំ (Year)</label>
                    <select
                      value={reportYear}
                      onChange={e => setReportYear(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none font-mono"
                    >
                      {[2024, 2025, 2026, 2027].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {reportPeriodType === 'year' && (
                <div>
                  <label className="text-[10.5px] font-bold text-slate-500 block mb-1">ឆ្នាំ (Year)</label>
                  <select
                    value={reportYear}
                    onChange={e => setReportYear(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none font-mono"
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>ឆ្នាំ {y}</option>
                    ))}
                  </select>
                </div>
              )}

              {reportPeriodType === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-500 block mb-1">ចាប់ពីថ្ងៃ (From)</label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={e => setReportStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-500 block mb-1">ដល់ថ្ងៃ (To)</label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={e => setReportEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Preview Stat Pill */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-emerald-950">
                    រកឃើញទិន្នន័យ៖ <span className="text-emerald-700 font-mono text-xs">{reportMatchingRecords.length} ថ្ងៃ</span>
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    ម៉ោងធ្វើការសរុប៖ {reportMatchingRecords.reduce((acc, curr) => acc + (curr.workHours || 0), 0).toFixed(1)} ម៉ោង
                  </div>
                </div>
                <div className="text-emerald-600">
                  <CheckCircle2 size={24} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf || reportMatchingRecords.length === 0}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Download size={14} />
                <span>{isGeneratingPdf ? 'កំពុងបង្កើត PDF...' : 'ទាញយកជា PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReportModal(false);
                  handleOpenSendTelegram(reportStaffId !== 'all' ? reportStaffId : undefined);
                }}
                className="py-2.5 px-4 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Send size={14} />
                <span>ផ្ញើ Telegram</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. TELEGRAM REPORT DISPATCH MODAL */}
      {showTelegramModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-100">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Send size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">ផ្ញើរបាយការណ៍វត្តមានទៅ Telegram</h3>
                  <p className="text-[11px] text-slate-500">ផ្ញើសេចក្ដីសង្ខេប និងរូបភាពសន្លឹក A4 Ledger ទៅកាន់ Telegram</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTelegramModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Target Destination Selection */}
            <div className="space-y-3 text-xs">
              <label className="text-[11px] font-bold text-slate-700 block">ជ្រើសរើសគោលដៅផ្ញើ (Recipient Destination)</label>
              
              <div className="space-y-2">
                {/* 1. Send to Staff */}
                <label className={`flex items-start gap-2.5 p-3 rounded-2xl border transition cursor-pointer ${
                  telegramTarget === 'staff' ? 'bg-sky-50/70 border-sky-300 ring-1 ring-sky-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                }`}>
                  <input
                    type="radio"
                    name="tgTarget"
                    checked={telegramTarget === 'staff'}
                    onChange={() => setTelegramTarget('staff')}
                    className="mt-0.5 text-sky-600"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">១. ផ្ញើទៅកាន់បុគ្គលិកផ្ទាល់ (Staff Private Chat)</span>
                    <span className="text-[10.5px] text-slate-500 block mt-0.5">ផ្ញើជូនបុគ្គលិកដែលបានជ្រើសរើសតាមរយៈ Telegram Bot</span>
                    
                    {telegramTarget === 'staff' && (
                      <div className="mt-2.5 space-y-2">
                        <select
                          value={telegramStaffId}
                          onChange={e => {
                            setTelegramStaffId(e.target.value);
                            setTelegramFeedback(null);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none"
                        >
                          {staffList.map(s => {
                            const isLinked = Boolean(s.telegramId || s.telegramLinked);
                            return (
                              <option key={s.id} value={s.id}>
                                {isLinked ? '✅ ' : '⚠️ '}{s.fullName} ({s.position || 'Staff'}) {s.telegramUsername ? `• @${s.telegramUsername.replace(/^@/, '')}` : (s.telegramId ? `• ID: ${s.telegramId}` : '• (មិនទាន់ភ្ជាប់ TG)')}
                              </option>
                            );
                          })}
                        </select>

                        {(() => {
                          const curStaff = staffList.find(s => s.id === telegramStaffId);
                          const hasTgId = Boolean(curStaff?.telegramId || curStaff?.telegramLinked);
                          if (!hasTgId) {
                            return (
                              <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-[10.5px] text-amber-900 leading-relaxed">
                                💡 <b>ចំណាំ៖</b> បុគ្គលិកនេះមិនទាន់មាន Telegram User ID ឡើយ (សូមឱ្យបុគ្គលិកបើក Telegram Bot របស់ក្រុមហ៊ុន ហើយចុច <code>/start</code>) ឬលោកអ្នកអាចជ្រើសរើស <b>« ២. ផ្ញើទៅ Admin / Group Notification »</b> ជំនួសវិញបាន។
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                </label>

                {/* 2. Send to Admin / Group */}
                <label className={`flex items-start gap-2.5 p-3 rounded-2xl border transition cursor-pointer ${
                  telegramTarget === 'admin' ? 'bg-sky-50/70 border-sky-300 ring-1 ring-sky-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                }`}>
                  <input
                    type="radio"
                    name="tgTarget"
                    checked={telegramTarget === 'admin'}
                    onChange={() => {
                      setTelegramTarget('admin');
                      setTelegramFeedback(null);
                    }}
                    className="mt-0.5 text-sky-600"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">២. ផ្ញើទៅ Admin / Group Notification (ណែនាំ)</span>
                    <span className="text-[10.5px] text-slate-500 block mt-0.5">ផ្ញើទៅកាន់ Telegram Group គ្រប់គ្រងរួម ឬ Chat របស់ Admin</span>
                  </div>
                </label>

                {/* 3. Send to Custom Chat ID */}
                <label className={`flex items-start gap-2.5 p-3 rounded-2xl border transition cursor-pointer ${
                  telegramTarget === 'custom' ? 'bg-sky-50/70 border-sky-300 ring-1 ring-sky-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                }`}>
                  <input
                    type="radio"
                    name="tgTarget"
                    checked={telegramTarget === 'custom'}
                    onChange={() => {
                      setTelegramTarget('custom');
                      setTelegramFeedback(null);
                    }}
                    className="mt-0.5 text-sky-600"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">៣. បញ្ចូល Chat ID ឬ @username ផ្ទាល់</span>
                    <span className="text-[10.5px] text-slate-500 block mt-0.5">ផ្ញើទៅកាន់ Telegram Chat ID ឬ Username ជាក់លាក់</span>
                    
                    {telegramTarget === 'custom' && (
                      <div className="mt-2.5">
                        <input
                          type="text"
                          placeholder="ឧ. @username ឬ -100123456789"
                          value={telegramCustomChatId}
                          onChange={e => setTelegramCustomChatId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-mono font-bold text-slate-800 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Notice Card */}
              <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-3 text-[11px] text-sky-950 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <Sparkles size={13} className="text-sky-600" />
                  <span>ព័ត៌មានដែលត្រូវផ្ញើ៖</span>
                </div>
                <div className="text-sky-800 pl-4 list-disc">
                  • របាយការណ៍សង្ខេបវត្តមាន ខែ {selectedMonth}/{selectedYear}<br/>
                  • ចំនួនថ្ងៃធ្វើការ, ម៉ោងសរុប, ម៉ោងបន្ថែម OT, និងអវត្តមាន<br/>
                  • រូបភាពសន្លឹកបញ្ជីវត្តមាន A4 Ledger ច្បាស់កម្រិត HD
                </div>
              </div>

              {/* Feedback Alert */}
              {telegramFeedback && (
                <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                  telegramFeedback.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {telegramFeedback.success ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
                  <span>{telegramFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTelegramModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={handleSendToTelegram}
                disabled={isSendingTelegram}
                className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Send size={14} />
                <span>{isSendingTelegram ? 'កំពុងផ្ញើ...' : 'ផ្ញើឥឡូវនេះ (Send)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Coins, 
  Clock, 
  Calculator, 
  History, 
  Plus, 
  Search, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileSpreadsheet, 
  X, 
  Edit3, 
  Check, 
  Sparkles,
  Banknote,
  CalendarDays,
  Gift,
  Info,
  UserCheck,
  UserPlus,
  Receipt,
  ShoppingBag,
  ExternalLink,
  CreditCard,
  UserX,
  Save,
  Trash2,
  Send
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  Salary, 
  Staff, 
  Role, 
  Branch, 
  SalarySchedule, 
  SalaryAdvance, 
  Attendance,
  ExtraShift,
  TempShiftCover,
  StaffExpense
} from '../types';
import { formatCurrency, formatDualCurrency } from '../utils';
import KhmerPayrollPayslipModal from './KhmerPayrollPayslipModal';
import { db } from '../mockData';
import { notifyBranchSalaryPaydayAlert, notifySingleSalaryPayout } from '../services/branchTelegramNotifier';

interface SalaryManagementViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  staffList: Staff[];
  setStaff?: React.Dispatch<React.SetStateAction<Staff[]>>;
  salaries: Salary[];
  setSalaries: React.Dispatch<React.SetStateAction<Salary[]>>;
  salarySchedules: SalarySchedule[];
  setSalarySchedules: React.Dispatch<React.SetStateAction<SalarySchedule[]>>;
  salaryAdvances: SalaryAdvance[];
  setSalaryAdvances: React.Dispatch<React.SetStateAction<SalaryAdvance[]>>;
  attendance?: Attendance[];
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
  exchangeRate: number;
}

// Helper calculate days between start date and end date (inclusive)
export const calcDaysBetween = (startStr: string, endStr: string): number => {
  if (!startStr) return 1;
  if (!endStr || endStr === startStr) return 1;
  try {
    const s = new Date(startStr);
    const e = new Date(endStr);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
    const diffTime = e.getTime() - s.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  } catch {
    return 1;
  }
};

export default function SalaryManagementView({
  currentRole,
  activeBranchId,
  branches,
  staffList,
  setStaff,
  salaries,
  setSalaries,
  salarySchedules,
  setSalarySchedules,
  salaryAdvances,
  setSalaryAdvances,
  attendance = [],
  lang: globalLang,
  onAddLog,
  exchangeRate
}: SalaryManagementViewProps) {
  const [lang, setLang] = useState<'en' | 'kh'>(globalLang);

  useEffect(() => {
    setLang(globalLang);
  }, [globalLang]);

  // Months List
  const months = useMemo(() => [
    { value: 1, en: 'January', kh: 'មករា' },
    { value: 2, en: 'February', kh: 'កុម្ភៈ' },
    { value: 3, en: 'March', kh: 'មីនា' },
    { value: 4, en: 'April', kh: 'មេសា' },
    { value: 5, en: 'May', kh: 'ឧសភា' },
    { value: 6, en: 'June', kh: 'មិថុនា' },
    { value: 7, en: 'July', kh: 'កក្កដា' },
    { value: 8, en: 'August', kh: 'សីហា' },
    { value: 9, en: 'September', kh: 'កញ្ញា' },
    { value: 10, en: 'October', kh: 'តុលា' },
    { value: 11, en: 'November', kh: 'វិច្ឆិកា' },
    { value: 12, en: 'December', kh: 'ធ្នូ' },
  ], []);

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => 
    (activeBranchId && activeBranchId !== 'all') ? activeBranchId : (branches[0]?.id || 'b1')
  );

  useEffect(() => {
    if (activeBranchId && activeBranchId !== 'all') {
      setSelectedBranchId(activeBranchId);
    } else if (branches.length > 0 && !branches.some(b => b.id === selectedBranchId)) {
      setSelectedBranchId(branches[0].id);
    }
  }, [activeBranchId, branches]);

  // 7 Main Sections:
  // 1. payroll (គណនាប្រាក់ខែ)
  // 2. advances (ប្រាក់បើកមុន)
  // 3. extrashifts (ជំនួសវេន / វេនបន្ថែម)
  // 4. expenses (ចំណាយបុគ្គលិក)
  // 5. attendance (វត្តមាន & ឈប់សម្រាក)
  // 6. history (ប្រវត្តិបើកប្រាក់)
  const [activeTab, setActiveTab] = useState<'payroll' | 'advances' | 'extrashifts' | 'expenses' | 'attendance' | 'history'>('payroll');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Extra Shifts State (ជំនួសវេន / វេនបន្ថែម សម្រាប់បុគ្គលិកផ្លូវការ)
  const [extraShifts, setExtraShifts] = useState<ExtraShift[]>(() => {
    try {
      const saved = localStorage.getItem('clean24_payroll_extra_shifts');
      const parsed: ExtraShift[] = saved ? JSON.parse(saved) : [];
      return parsed.map(s => {
        if (s.date && s.date.includes('~')) {
          const [sDate, eDate] = s.date.split('~').map(x => x.trim());
          const days = calcDaysBetween(sDate, eDate);
          if (days > 1 && s.shiftCount === 1) {
            return {
              ...s,
              shiftCount: days,
              totalAmount: days * (s.ratePerShift || 6)
            };
          }
        }
        return s;
      });
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('clean24_payroll_extra_shifts', JSON.stringify(extraShifts));
  }, [extraShifts]);

  // 2. Temp Shift Covers State (អ្នកជំនួសបណ្តោះអាសន្ន)
  const [tempShiftCovers, setTempShiftCovers] = useState<TempShiftCover[]>(() => {
    try {
      const saved = localStorage.getItem('clean24_payroll_temp_shifts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('clean24_payroll_temp_shifts', JSON.stringify(tempShiftCovers));
  }, [tempShiftCovers]);

  // 3. Staff Expenses State (ចំណាយបុគ្គលិក / បុគ្គលិកចេញលុយមុន)
  const [staffExpenses, setStaffExpenses] = useState<StaffExpense[]>(() => {
    try {
      const saved = localStorage.getItem('clean24_payroll_staff_expenses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('clean24_payroll_staff_expenses', JSON.stringify(staffExpenses));
  }, [staffExpenses]);

  // Manual Adjustments (Inline overrides for Leaves, Dates and Deductions)
  const [adjustments, setAdjustments] = useState<Record<string, { leaveDays?: number; leaveDates?: string[]; deduction?: number; shiftOverride?: number }>>(() => {
    try {
      const saved = localStorage.getItem('clean24_payroll_adjustments_v2');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveAdjustment = (staffId: string, adj: { leaveDays?: number; leaveDates?: string[]; deduction?: number; shiftOverride?: number }) => {
    const key = `${staffId}_${selectedYear}_${selectedMonth}`;
    setAdjustments(prev => {
      const updated = { ...prev, [key]: { ...prev[key], ...adj } };
      localStorage.setItem('clean24_payroll_adjustments_v2', JSON.stringify(updated));
      return updated;
    });
  };

  const getAdjustment = (staffId: string) => {
    const key = `${staffId}_${selectedYear}_${selectedMonth}`;
    return adjustments[key] || {};
  };

  // Salary Delete Modal State
  const [salaryToDelete, setSalaryToDelete] = useState<{
    id: string;
    staffId: string;
    staffName: string;
    period: string;
    month?: number;
    year?: number;
  } | null>(null);

  const confirmDeleteSalary = () => {
    if (!salaryToDelete) return;

    // 1. Remove salary record from salaries
    const updated = salaries.filter(s => s.id !== salaryToDelete.id);
    setSalaries(updated);
    db.saveSalaries(updated);
    fetch('/api/sync-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salaries: updated })
    }).catch(() => {});

    // 2. Reset extra shifts back to Pending if applicable
    setExtraShifts(prev => prev.map(s => {
      if (s.staffId === salaryToDelete.staffId && isRecordInPeriod(s.date, selectedMonth, selectedYear)) {
        return { ...s, status: 'Pending' };
      }
      return s;
    }));

    // 3. Reset staff expenses back to Approved if applicable
    setStaffExpenses(prev => prev.map(e => {
      if (e.staffId === salaryToDelete.staffId && e.repaymentMethod === 'Payroll' && isRecordInPeriod(e.date, selectedMonth, selectedYear)) {
        return { ...e, status: 'Approved', paidDate: undefined };
      }
      return e;
    }));

    // 4. Reset salary advances back to Approved if applicable
    setSalaryAdvances(prev => prev.map(a => {
      if (a.staffId === salaryToDelete.staffId && a.status === 'Paid') {
        return { ...a, status: 'Approved' };
      }
      return a;
    }));

    onAddLog(`Deleted salary payment record for ${salaryToDelete.staffName} (${salaryToDelete.period})`);
    setSalaryToDelete(null);
  };

  // Helper calculate days between start date and end date (inclusive)
  const calcDaysBetween = (startStr: string, endStr: string): number => {
    if (!startStr) return 1;
    if (!endStr || endStr === startStr) return 1;
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
      const diffTime = e.getTime() - s.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 0 ? diffDays : 1;
    } catch {
      return 1;
    }
  };

  // Helper date checker
  const isRecordInPeriod = (dateStr: string, m: number, y: number) => {
    if (!dateStr) return false;
    const firstDate = dateStr.includes('~') ? dateStr.split('~')[0].trim() : dateStr.trim();
    const d = new Date(firstDate);
    if (isNaN(d.getTime())) return false;
    return (d.getMonth() + 1 === m) && (d.getFullYear() === y);
  };

  // Filtered active staff list based on month and year of employment
  const availableStaff = useMemo(() => {
    let list = (staffList || []).filter(s => {
      if (!s) return false;

      // 1. Check startDate: if staff joined after the selected month/year, exclude them
      if (s.startDate) {
        const parts = s.startDate.split('-');
        const startYear = parseInt(parts[0], 10);
        const startMonth = parseInt(parts[1], 10);
        if (!isNaN(startYear) && !isNaN(startMonth)) {
          if (selectedYear < startYear) return false;
          if (selectedYear === startYear && selectedMonth < startMonth) return false;
        }
      }

      // 2. Check resignationDate: if staff resigned before selected month/year, exclude them
      if (s.resignationDate) {
        const parts = s.resignationDate.split('-');
        const resYear = parseInt(parts[0], 10);
        const resMonth = parseInt(parts[1], 10);
        if (!isNaN(resYear) && !isNaN(resMonth)) {
          if (selectedYear > resYear) return false;
          if (selectedYear === resYear && selectedMonth > resMonth) return false;
        }
      } else if (s.status === 'Resigned') {
        return false;
      }

      return true;
    });

    if (selectedBranchId !== 'all') {
      list = list.filter(s => s.branchId === selectedBranchId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => 
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.position || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [staffList, selectedBranchId, searchQuery, selectedMonth, selectedYear]);

  // Modals state
  const [payModalStaff, setPayModalStaff] = useState<{ staff: Staff; calc: any } | null>(null);
  const [payMethod, setPayMethod] = useState<'Cash' | 'ABA' | 'Bank Transfer'>('ABA');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [payNote, setPayNote] = useState('');

  // Modals for additions
  const [showExtraShiftModal, setShowExtraShiftModal] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [esStaffId, setEsStaffId] = useState('');
  const [esDate, setEsDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [esEndDate, setEsEndDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [esShift, setEsShift] = useState<'Morning' | 'Afternoon' | 'Night' | 'Full Time'>('Morning');
  const [esCount, setEsCount] = useState<number>(1);
  const [esRate, setEsRate] = useState<number>(6); // Default $6
  const [esCoveredFor, setEsCoveredFor] = useState('');
  const [esNote, setEsNote] = useState('');

  const [showTempModal, setShowTempModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [tempDate, setTempDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [tempShift, setTempShift] = useState<'Morning' | 'Afternoon' | 'Night' | 'Full Time'>('Morning');
  const [tempCount, setTempCount] = useState<number>(1);
  const [tempRate, setTempRate] = useState<number>(6); // Default $6
  const [tempNote, setTempNote] = useState('');

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expStaffId, setExpStaffId] = useState('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [expCategory, setExpCategory] = useState('សាប៊ូ (Detergent)');
  const [expCustomCategory, setExpCustomCategory] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expCurrency, setExpCurrency] = useState<'USD' | 'KHR'>('USD');
  const [expAmount, setExpAmount] = useState<number>(10);
  const [expAmountKhr, setExpAmountKhr] = useState<number>(40000);
  const [expRepayMethod, setExpRepayMethod] = useState<'Payroll' | 'Separate'>('Payroll');
  const [expNote, setExpNote] = useState('');

  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advStaffId, setAdvStaffId] = useState('');
  const [advAmount, setAdvAmount] = useState<number>(30);
  const [advDate, setAdvDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [advReason, setAdvReason] = useState('');

  const [leaveModalStaff, setLeaveModalStaff] = useState<any | null>(null);
  const [leaveDaysInput, setLeaveDaysInput] = useState<number>(0);
  const [leaveDatesInput, setLeaveDatesInput] = useState<string>('');

  const [selectedPayslipRecord, setSelectedPayslipRecord] = useState<any | null>(null);
  const [bannerNotice, setBannerNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showBanner = (type: 'success' | 'error', msg: string) => {
    setBannerNotice({ type, msg });
    setTimeout(() => setBannerNotice(null), 5000);
  };

  // 4. Reactive Payroll Calculation Engine for Official Employees
  // Formula:
  // Final Payment = Base Salary + Extra Shift Payment + Staff Expense Reimbursement - Salary Advance - Other Deduction
  const payrollRows = useMemo(() => {
    return availableStaff.map(staff => {
      const adj = getAdjustment(staff.id);
      const baseSalary = Number(staff.baseSalary || 0);
      const shiftRate = 6; // Standard Clean24 rate: $6 per shift/day
      const dailyRate = 6;

      // 1. Extra Shifts for this employee in selected month & year (Rate = $6 per shift)
      const empShifts = extraShifts.filter(s => 
        s.staffId === staff.id && 
        isRecordInPeriod(s.date, selectedMonth, selectedYear) &&
        s.status !== 'Paid'
      );
      const autoShiftCount = empShifts.reduce((sum, s) => sum + Number(s.shiftCount || 0), 0);
      const autoShiftAmount = empShifts.reduce((sum, s) => sum + Number(s.totalAmount || (s.shiftCount * s.ratePerShift) || 0), 0);
      
      const finalShiftCount = adj.shiftOverride !== undefined ? adj.shiftOverride : autoShiftCount;
      const finalShiftAmount = adj.shiftOverride !== undefined ? (finalShiftCount * 6) : autoShiftAmount;

      // 2. Staff Expenses to Reimburse (repaymentMethod === 'Payroll' and status !== 'Paid')
      const empExpenses = staffExpenses.filter(e => 
        e.staffId === staff.id && 
        e.repaymentMethod === 'Payroll' && 
        e.status !== 'Paid' &&
        isRecordInPeriod(e.date, selectedMonth, selectedYear)
      );
      const staffExpenseAmount = Number(empExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2));

      // 3. Pre-salary Advances for this month
      const empAdvances = (salaryAdvances || []).filter(a => 
        a.staffId === staff.id && 
        isRecordInPeriod(a.requestDate || a.createdAt, selectedMonth, selectedYear) &&
        (a.status === 'Approved' || a.status === 'Paid' || a.status === 'Pending')
      );
      const advancesDeduct = empAdvances.reduce((sum, a) => sum + Number(a.amount || 0), 0);

      // 4. Leaves & Absences / Deductions
      const staffAttendance = (attendance || []).filter(a => 
        a.staffId === staff.id && isRecordInPeriod(a.date, selectedMonth, selectedYear)
      );
      const absentRecords = staffAttendance.filter(a => a.status === 'Absent');
      const autoAbsentDays = absentRecords.length;
      const autoAbsentDates = absentRecords.map(a => {
        const parts = a.date.split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}` : a.date;
      });

      const finalLeaveDays = adj.leaveDays !== undefined ? adj.leaveDays : autoAbsentDays;
      const finalLeaveDates = adj.leaveDates !== undefined ? adj.leaveDates : autoAbsentDates;
      const autoLeaveDeduct = Number((finalLeaveDays * dailyRate).toFixed(2));
      const finalDeduction = adj.deduction !== undefined ? adj.deduction : autoLeaveDeduct;

      // FINAL PAYMENT CALCULATION:
      // Final Payment = Base Salary + Extra Shift Payment + Staff Expense Reimbursement - Salary Advance - Other Deduction
      const calculatedFinal = baseSalary + finalShiftAmount + staffExpenseAmount - advancesDeduct - finalDeduction;
      const finalPayment = Math.max(0, Number(calculatedFinal.toFixed(2)));

      // Check if already paid in Salaries history
      const existingPaid = (salaries || []).find(sal => 
        sal.staffId === staff.id && 
        (isRecordInPeriod(sal.paymentDate, selectedMonth, selectedYear) || sal.salaryPeriod?.includes(`${selectedMonth}/${selectedYear}`))
      );
      const isPaid = Boolean(existingPaid && (existingPaid.status === 'Paid' || (existingPaid.status as any) === 'paid'));

      return {
        staff,
        baseSalary,
        dailyRate,
        extraShiftCount: finalShiftCount,
        extraShiftAmount: finalShiftAmount,
        staffExpenseAmount,
        advancesDeduct,
        leaveDays: finalLeaveDays,
        leaveDates: finalLeaveDates,
        deduction: finalDeduction,
        finalPayment: isPaid && existingPaid ? existingPaid.netSalary : finalPayment,
        isPaid,
        paidRecord: existingPaid,
        unpaidExpenses: empExpenses,
        unpaidShifts: empShifts
      };
    });
  }, [availableStaff, extraShifts, staffExpenses, salaryAdvances, attendance, adjustments, salaries, selectedMonth, selectedYear]);

  // Current Month External Temp Covers
  const currentMonthTempCovers = useMemo(() => {
    return (tempShiftCovers || []).filter(t => {
      if (selectedBranchId !== 'all' && t.branchId && t.branchId !== selectedBranchId) return false;
      return isRecordInPeriod(t.date, selectedMonth, selectedYear) || isRecordInPeriod(t.paymentDate || '', selectedMonth, selectedYear);
    });
  }, [tempShiftCovers, selectedBranchId, selectedMonth, selectedYear]);

  // Combined Payment History (Official Staff Salaries + Paid External Temp Workers)
  const combinedPaidHistory = useMemo(() => {
    // 1. Staff Salaries in this period
    const staffPaid = (salaries || [])
      .filter(sal => {
        if (selectedBranchId !== 'all' && sal.branchId && sal.branchId !== selectedBranchId) return false;
        return isRecordInPeriod(sal.paymentDate, selectedMonth, selectedYear) || 
               sal.salaryPeriod?.includes(`${selectedMonth}/${selectedYear}`) ||
               sal.salaryPeriod?.includes(months.find(m => m.value === selectedMonth)?.kh || '');
      })
      .map(sal => ({
        id: sal.id,
        type: 'staff' as const,
        name: sal.staffName,
        period: sal.salaryPeriod,
        paidDate: sal.paymentDate,
        method: sal.paymentMethod,
        details: `$${sal.baseSalary} (គោល)`,
        shifts: sal.extraShiftCount ? `${sal.extraShiftCount} វេន (+$${sal.extraShiftAmount})` : (sal.extraShiftAmount ? `+$${sal.extraShiftAmount}` : '-'),
        amount: sal.netSalary,
        raw: sal
      }));

    // 2. Paid External Temp Covers in this period
    const tempPaid = (tempShiftCovers || [])
      .filter(t => {
        if (selectedBranchId !== 'all' && t.branchId && t.branchId !== selectedBranchId) return false;
        return t.status === 'Paid' && (
          isRecordInPeriod(t.paymentDate || t.date, selectedMonth, selectedYear)
        );
      })
      .map(t => ({
        id: t.id,
        type: 'temp' as const,
        name: t.name,
        period: t.date,
        paidDate: t.paymentDate || t.date,
        method: t.paymentMethod || 'Cash',
        details: `${t.shiftCount} វេន ($${t.ratePerShift})`,
        shifts: `${t.shiftCount} វេន`,
        amount: t.totalAmount,
        raw: t
      }));

    return [...staffPaid, ...tempPaid];
  }, [salaries, tempShiftCovers, selectedBranchId, selectedMonth, selectedYear, months]);

  // Overall Totals
  const totals = useMemo(() => {
    const totalTempPaid = currentMonthTempCovers
      .filter(t => t.status === 'Paid')
      .reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);

    const baseTotals = payrollRows.reduce((acc, row) => {
      acc.totalStaff += 1;
      acc.totalBase = Number((acc.totalBase + row.baseSalary).toFixed(2));
      acc.totalExtraShifts = Number((acc.totalExtraShifts + row.extraShiftAmount).toFixed(2));
      acc.totalStaffExpenses = Number((acc.totalStaffExpenses + row.staffExpenseAmount).toFixed(2));
      acc.totalAdvances = Number((acc.totalAdvances + row.advancesDeduct).toFixed(2));
      acc.totalDeductions = Number((acc.totalDeductions + row.deduction).toFixed(2));
      acc.totalFinalPayable = Number((acc.totalFinalPayable + row.finalPayment).toFixed(2));
      if (row.isPaid) {
        acc.paidCount += 1;
        acc.totalPaidAmount = Number((acc.totalPaidAmount + row.finalPayment).toFixed(2));
      } else {
        acc.pendingCount += 1;
      }
      return acc;
    }, {
      totalStaff: 0,
      totalBase: 0,
      totalExtraShifts: 0,
      totalStaffExpenses: 0,
      totalAdvances: 0,
      totalDeductions: 0,
      totalFinalPayable: 0,
      paidCount: 0,
      pendingCount: 0,
      totalPaidAmount: 0,
      totalTempPaid: 0
    });

    baseTotals.totalTempPaid = totalTempPaid;
    return baseTotals;
  }, [payrollRows, currentMonthTempCovers]);

  // Handle Final Payment Processing
  const handleConfirmPayment = () => {
    if (!payModalStaff) return;
    const { staff, calc } = payModalStaff;

    const monthNameKh = months.find(m => m.value === selectedMonth)?.kh || selectedMonth;
    const periodStr = `${monthNameKh} ${selectedYear}`;

    const newSalaryRecord: Salary = {
      id: `sal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      branchId: staff.branchId,
      staffId: staff.id,
      staffName: staff.fullName,
      salaryPeriod: periodStr,
      baseSalary: calc.baseSalary,
      overtime: calc.extraShiftAmount,
      bonus: calc.staffExpenseAmount,
      deduction: calc.deduction,
      advancePayment: calc.advancesDeduct,
      netSalary: calc.finalPayment,
      paymentDate: payDate,
      paymentMethod: payMethod,
      paidBy: currentRole,
      note: payNote.trim() || `បើកប្រាក់ខែ ${periodStr}`,
      status: 'Paid',
      daysWorked: 26 - calc.leaveDays,
      leaveDays: calc.leaveDays,
      leaveDates: calc.leaveDates,
      extraShiftAmount: calc.extraShiftAmount,
      extraShiftCount: calc.extraShiftCount,
      staffExpenseAmount: calc.staffExpenseAmount
    };

    setSalaries(prev => [newSalaryRecord, ...prev]);

    // Mark extra shifts as Paid
    setExtraShifts(prev => prev.map(s => {
      if (s.staffId === staff.id && isRecordInPeriod(s.date, selectedMonth, selectedYear)) {
        return { ...s, status: 'Paid' };
      }
      return s;
    }));

    // Mark staff expenses as Paid
    setStaffExpenses(prev => prev.map(e => {
      if (e.staffId === staff.id && e.repaymentMethod === 'Payroll' && isRecordInPeriod(e.date, selectedMonth, selectedYear)) {
        return { ...e, status: 'Paid', paidDate: payDate };
      }
      return e;
    }));

    // Mark salary advances as Paid
    setSalaryAdvances(prev => prev.map(a => {
      if (a.staffId === staff.id && (a.status === 'Approved' || a.status === 'Pending')) {
        return { ...a, status: 'Paid' };
      }
      return a;
    }));

    onAddLog(`Disbursed salary payment of $${calc.finalPayment} to ${staff.fullName} (${periodStr})`);
    showBanner('success', lang === 'kh' ? `បានបើកប្រាក់ជូន ${staff.fullName} ចំនួន $${calc.finalPayment} ដោយជោគជ័យ!` : `Paid $${calc.finalPayment} to ${staff.fullName}!`);

    // Dispatch individual salary payslip to the branch bot
    notifySingleSalaryPayout({
      branchId: staff.branchId,
      branchName: branches.find(b => b.id === staff.branchId)?.branchName || staff.branchId,
      staffName: staff.fullName,
      position: staff.position,
      period: periodStr,
      netSalaryUsd: calc.finalPayment,
      baseSalaryUsd: calc.baseSalary,
      overtimeUsd: calc.extraShiftAmount,
      bonusUsd: calc.staffExpenseAmount,
      deductionUsd: calc.deduction,
      advanceDeductionUsd: calc.advancesDeduct,
      paymentMethod: payMethod,
      role: currentRole
    }).catch(err => console.warn('Payslip Telegram notify error:', err));

    setPayModalStaff(null);
    setPayNote('');

    // Open Payslip Preview Modal
    setSelectedPayslipRecord({
      ...newSalaryRecord,
      empNameKh: staff.fullName,
      empNameEn: staff.fullName,
      position: staff.position,
      startDate: staff.startDate,
      month: selectedMonth,
      year: selectedYear,
      period: 3,
      proratedBasic: calc.baseSalary,
      basicSalary: calc.baseSalary,
      periodBase: calc.baseSalary,
      standardDays: 26,
      workedDays: 26 - calc.leaveDays,
      leaveDays: calc.leaveDays,
      leaveDates: calc.leaveDates,
      extraShiftAmount: calc.extraShiftAmount,
      extraShiftCount: calc.extraShiftCount,
      staffExpenseAmount: calc.staffExpenseAmount,
      advancesDeduct: calc.advancesDeduct,
      leavesDeduct: calc.deduction,
      netSalary: calc.finalPayment,
      status: 'Paid'
    });
  };

  // Add or Update Extra Shift for Official Employee
  const handleSaveExtraShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!esStaffId) {
      showBanner('error', lang === 'kh' ? 'សូមជ្រើសរើសបុគ្គលិក!' : 'Select employee');
      return;
    }
    const st = staffList.find(s => s.id === esStaffId);
    const coveredSt = staffList.find(s => s.id === esCoveredFor);

    const calculatedDays = calcDaysBetween(esDate, esEndDate || esDate);
    const count = Number(esCount) > 0 ? Number(esCount) : calculatedDays;
    const rate = Number(esRate) > 0 ? Number(esRate) : 6;
    const total = count * rate;
    const dateDisplay = esEndDate && esEndDate !== esDate ? `${esDate} ~ ${esEndDate}` : esDate;

    if (editingShiftId) {
      setExtraShifts(prev => prev.map(s => {
        if (s.id === editingShiftId) {
          return {
            ...s,
            branchId: st?.branchId || selectedBranchId,
            staffId: esStaffId,
            staffName: st?.fullName || 'Staff',
            date: dateDisplay,
            shift: esShift,
            shiftCount: count,
            ratePerShift: rate,
            totalAmount: total,
            coveredForStaffId: esCoveredFor || undefined,
            coveredForStaffName: coveredSt?.fullName || undefined,
            note: esNote.trim(),
          };
        }
        return s;
      }));
      setEditingShiftId(null);
      showBanner('success', lang === 'kh' ? `បានកែប្រែទិន្នន័យជំនួសវេនជូន ${st?.fullName} ចំនួន ${count} វេន (+$${total})!` : 'Updated shift cover!');
    } else {
      const newShift: ExtraShift = {
        id: `es_${Date.now()}`,
        branchId: st?.branchId || selectedBranchId,
        staffId: esStaffId,
        staffName: st?.fullName || 'Staff',
        date: dateDisplay,
        shift: esShift,
        shiftCount: count,
        ratePerShift: rate,
        totalAmount: total,
        coveredForStaffId: esCoveredFor || undefined,
        coveredForStaffName: coveredSt?.fullName || undefined,
        note: esNote.trim(),
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      setExtraShifts(prev => [newShift, ...prev]);
      onAddLog(`Logged extra shift cover for ${st?.fullName} (${count} shifts @ $${rate})`);
      showBanner('success', lang === 'kh' ? `បានកត់ត្រាជំនួសវេនជូន ${st?.fullName} ចំនួន ${count} វេន (+$${total}) ដោយជោគជ័យ!` : `Logged extra shift cover!`);
    }

    setShowExtraShiftModal(false);
    setEsNote('');
    setEsCoveredFor('');
    setEsCount(1);
  };

  // Add External/Temp Shift Cover
  const handleSaveTempShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) {
      showBanner('error', lang === 'kh' ? 'សូមបញ្ជាក់ឈ្មោះអ្នកជំនួស!' : 'Please enter name');
      return;
    }

    const newTemp: TempShiftCover = {
      id: `temp_${Date.now()}`,
      branchId: selectedBranchId,
      name: tempName.trim(),
      phone: tempPhone.trim() || undefined,
      date: tempDate,
      shift: tempShift,
      shiftCount: Number(tempCount),
      ratePerShift: Number(tempRate),
      totalAmount: Number(tempCount) * Number(tempRate),
      note: tempNote.trim() || undefined,
      status: 'Unpaid',
      createdAt: new Date().toISOString()
    };

    setTempShiftCovers(prev => [newTemp, ...prev]);
    onAddLog(`Logged external shift cover by ${tempName} (${tempCount} shifts @ $${tempRate})`);
    showBanner('success', lang === 'kh' ? `បានកត់ត្រាអ្នកជំនួសវេនបណ្តោះអាសន្ន ${tempName} (+$${newTemp.totalAmount})!` : `Saved external shift cover!`);
    setShowTempModal(false);
    setTempName('');
    setTempPhone('');
    setTempNote('');
  };

  // Add Staff Expense
  const handleSaveStaffExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expStaffId) {
      showBanner('error', lang === 'kh' ? 'សូមជ្រើសរើសបុគ្គលិក!' : 'Select employee');
      return;
    }
    const st = staffList.find(s => s.id === expStaffId);

    const finalCategory = expCategory === 'ផ្សេងៗ (Other)' && expCustomCategory.trim() 
      ? expCustomCategory.trim() 
      : expCategory;

    const finalAmountUsd = expCurrency === 'KHR' 
      ? Number((expAmountKhr / (exchangeRate || 4000)).toFixed(2)) 
      : Number(expAmount);

    const khrInfo = expCurrency === 'KHR' 
      ? `(${expAmountKhr.toLocaleString()} ៛)` 
      : `(≈ ${(finalAmountUsd * (exchangeRate || 4000)).toLocaleString()} ៛)`;

    const newExpense: StaffExpense = {
      id: `exp_${Date.now()}`,
      branchId: st?.branchId || selectedBranchId,
      staffId: expStaffId,
      staffName: st?.fullName || 'Staff',
      date: expDate,
      category: finalCategory,
      description: expDesc.trim() || finalCategory,
      amount: finalAmountUsd,
      repaymentMethod: expRepayMethod,
      status: 'Pending',
      note: expNote.trim() ? `${expNote.trim()} ${khrInfo}` : khrInfo,
      createdAt: new Date().toISOString()
    };

    setStaffExpenses(prev => [newExpense, ...prev]);
    onAddLog(`Logged staff expense reimbursement for ${st?.fullName} of $${finalAmountUsd} ${khrInfo} (${finalCategory})`);
    showBanner('success', lang === 'kh' ? `បានកត់ត្រាចំណាយជូន ${st?.fullName} ចំនួន $${finalAmountUsd} ${khrInfo}!` : `Recorded staff expense!`);
    setShowExpenseModal(false);
    setExpDesc('');
    setExpNote('');
    setExpCustomCategory('');
  };

  // Add Salary Advance
  const handleSaveAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advStaffId) {
      showBanner('error', lang === 'kh' ? 'សូមជ្រើសរើសបុគ្គលិក!' : 'Select employee');
      return;
    }
    const st = staffList.find(s => s.id === advStaffId);

    const newAdv: SalaryAdvance = {
      id: `adv_${Date.now()}`,
      branchId: st?.branchId || selectedBranchId,
      staffId: advStaffId,
      amount: Number(advAmount),
      requestDate: advDate,
      approvedBy: currentRole,
      status: 'Approved',
      reason: advReason.trim() || 'បើកប្រាក់មុន (Salary Advance)',
      createdAt: new Date().toISOString()
    };

    setSalaryAdvances(prev => [newAdv, ...prev]);
    onAddLog(`Granted advance of $${advAmount} to ${st?.fullName}`);
    showBanner('success', lang === 'kh' ? `បានកត់ត្រាបើកប្រាក់មុន $${advAmount} ជូន ${st?.fullName}!` : `Granted advance!`);
    setShowAdvanceModal(false);
    setAdvReason('');
  };

  // Convert Temp Worker to Official Employee
  const handleConvertTempToStaff = (temp: TempShiftCover) => {
    if (!setStaff) return;
    const confirmConvert = confirm(lang === 'kh' 
      ? `តើលោកអ្នកពិតជាចង់បង្កើត "${temp.name}" ទៅជាបុគ្គលិកពេញសិទ្ធិរបស់ Clean24 មែនទេ?` 
      : `Convert "${temp.name}" into official Clean24 employee?`
    );
    if (!confirmConvert) return;

    const newStaff: Staff = {
      id: `staff_${Date.now()}`,
      branchId: temp.branchId || selectedBranchId,
      fullName: temp.name,
      phone: temp.phone || '',
      idCardNumber: '',
      emergencyContact: '',
      gender: 'Male',
      dob: '2000-01-01',
      address: 'Phnom Penh',
      position: 'Helper',
      shift: temp.shift,
      startDate: temp.date,
      baseSalary: 180, // standard base salary
      status: 'Active',
      photoUrl: ''
    };

    setStaff(prev => [...prev, newStaff]);
    onAddLog(`Converted temporary worker ${temp.name} into official Clean24 employee`);
    showBanner('success', lang === 'kh' ? `បានបង្កើត ${temp.name} ជាបុគ្គលិកពេញសិទ្ធិជោគជ័យ!` : `Converted ${temp.name} into official staff!`);
  };

  // Export Excel
  const handleExportExcel = () => {
    const monthName = months.find(m => m.value === selectedMonth)?.en || selectedMonth;

    const data = payrollRows.map((r, i) => ({
      'No.': i + 1,
      'Staff Name': r.staff.fullName,
      'Position': r.staff.position,
      'Phone': r.staff.phone,
      'Branch': branches.find(b => b.id === r.staff.branchId)?.branchName || r.staff.branchId,
      'Base Salary ($)': r.baseSalary,
      'Extra Shifts (Shifts)': r.extraShiftCount,
      'Extra Shift Pay ($)': r.extraShiftAmount,
      'Staff Expense Reimburse ($)': r.staffExpenseAmount,
      'Salary Advance ($)': r.advancesDeduct,
      'Leaves / Deductions ($)': r.deduction,
      'Final Payment ($)': r.finalPayment,
      'Final Payment (KHR)': Math.round(r.finalPayment * exchangeRate),
      'Status': r.isPaid ? 'PAID' : 'PENDING'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
    XLSX.writeFile(wb, `Clean24_Payroll_${monthName}_${selectedYear}.xlsx`);
  };

  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  const handleSendSalaryDueAlert = async () => {
    // Strict branch isolation check
    if (selectedBranchId === 'all') {
      showBanner('error', lang === 'kh' 
        ? '⚠️ សូមជ្រើសរើសសាខាជាក់លាក់មួយជាមុនសិន ដើម្បីធានាថាទិន្នន័យប្រាក់ខែមិនច្រឡូកច្រឡំចូលគ្នា!' 
        : '⚠️ Please select a specific branch first to ensure payroll data is never mixed across branches!');
      return;
    }

    const curBranch = branches.find(b => b.id === selectedBranchId);
    const branchName = curBranch?.branchName || selectedBranchId;

    setIsSendingTelegram(true);
    try {
      const res = await notifyBranchSalaryPaydayAlert({
        branchId: selectedBranchId,
        branchName: branchName,
        staffList: staffList,
        salaries: salaries,
        targetMonth: selectedMonth,
        targetYear: selectedYear,
        role: currentRole
      });

      if (res.success) {
        showBanner('success', lang === 'kh'
          ? `✓ បានផ្ញើដំណឹងដល់ថ្ងៃបើកប្រាក់ខែ (${res.staffCount} នាក់ / សរុប $${res.totalAmount.toFixed(2)}) ទៅ Telegram ${branchName} ដោយជោគជ័យ!`
          : `✓ Sent Salary Due Alert (${res.staffCount} staff / Total $${res.totalAmount.toFixed(2)}) to ${branchName} Telegram bot successfully!`);
        onAddLog(`Dispatched Telegram Salary Due Alert for ${branchName} (${res.staffCount} staff, Total: $${res.totalAmount.toFixed(2)})`);
      } else {
        showBanner('error', res.error || (lang === 'kh' ? 'បរាជ័យក្នុងការផ្ញើដំណឹងប្រាក់ខែ' : 'Failed to dispatch salary alert'));
      }
    } catch (err: any) {
      showBanner('error', err.message || 'Error dispatching salary notification');
    } finally {
      setIsSendingTelegram(false);
    }
  };

  return (
    <div className="space-y-5" id="clean24_payroll_management_view">
      
      {/* Top Banner Alert */}
      {bannerNotice && (
        <div className={`p-4 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-xs border transition-all ${
          bannerNotice.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {bannerNotice.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <AlertCircle size={16} className="shrink-0" />}
            <span>{bannerNotice.msg}</span>
          </div>
          <button onClick={() => setBannerNotice(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Navigation Tabs & Controls Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        
        {/* Top Control Bar: Branch, Month, Year & Excel Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Branch Selector */}
            {branches.length > 1 ? (
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.branchName}</option>
                ))}
              </select>
            ) : (
              <div className="px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs font-bold shadow-2xs">
                {branches[0]?.branchName || 'Branch'}
              </div>
            )}

            {/* Month Selector */}
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>
                  {lang === 'kh' ? `ខែ ${m.kh}` : m.en}
                </option>
              ))}
            </select>

            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Branch Telegram Salary Due Alert Button */}
            <button
              onClick={handleSendSalaryDueAlert}
              disabled={isSendingTelegram}
              className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0 disabled:opacity-50"
              title={lang === 'kh' ? 'ផ្ញើដំណឹងដល់ថ្ងៃបើកប្រាក់ខែតាម Telegram សាខា' : 'Send Salary Due Alert to Branch Telegram'}
            >
              <Send size={15} className={`text-sky-600 ${isSendingTelegram ? 'animate-spin' : ''}`} />
              <span>{isSendingTelegram ? (lang === 'kh' ? 'កំពុងផ្ញើ...' : 'Sending...') : (lang === 'kh' ? '📢 ដំណឹងបើកប្រាក់ខែ' : 'Salary Alert')}</span>
            </button>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
              title={lang === 'kh' ? 'ទាញយក Excel' : 'Export Excel'}
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <span>{lang === 'kh' ? 'ទាញយក Excel' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {/* 6 Clean Navigation Tabs for Official Employees (No Scrollbar, Perfectly Sized) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
          {/* 1. គណនាប្រាក់ខែ */}
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              activeTab === 'payroll' 
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Calculator size={14} className="shrink-0" />
            <span className="truncate">{lang === 'kh' ? '១. គណនាប្រាក់ខែ' : '1. Payroll'}</span>
          </button>

          {/* 2. ប្រាក់បើកមុន */}
          <button
            onClick={() => setActiveTab('advances')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              activeTab === 'advances' 
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Coins size={14} className="shrink-0" />
            <span className="truncate">{lang === 'kh' ? '២. ប្រាក់បើកមុន' : '2. Advances'}</span>
          </button>

          {/* 3. ជំនួសវេន / វេនបន្ថែម */}
          <button
            onClick={() => setActiveTab('extrashifts')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              activeTab === 'extrashifts' 
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <UserCheck size={14} className="shrink-0" />
            <span className="truncate">{lang === 'kh' ? '៣. ជំនួសវេន ($6)' : '3. Shift Covers'}</span>
          </button>

          {/* 4. ចំណាយបុគ្គលិក */}
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              activeTab === 'expenses' 
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Receipt size={14} className="shrink-0" />
            <span className="truncate">{lang === 'kh' ? '៤. ចំណាយបុគ្គលិក' : '4. Expenses'}</span>
          </button>

          {/* 5. វត្តមាន & ឈប់សម្រាក */}
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              activeTab === 'attendance' 
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <CalendarDays size={14} className="shrink-0" />
            <span className="truncate">{lang === 'kh' ? '៥. វត្តមាន' : '5. Attendance'}</span>
          </button>

          {/* 6. ប្រវត្តិបើកប្រាក់ */}
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              activeTab === 'history' 
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <History size={14} className="shrink-0" />
            <span className="truncate">{lang === 'kh' ? '៦. ប្រវត្តិបើកប្រាក់' : '6. History'}</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">{lang === 'kh' ? 'បុគ្គលិកសរុប' : 'Total Staff'}</span>
            <Users size={16} className="text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-sans">{totals.totalStaff}</span>
            <span className="text-[11px] font-bold text-emerald-600">
              {totals.paidCount} {lang === 'kh' ? 'បើករួច' : 'Paid'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">{lang === 'kh' ? 'ប្រាក់ខែគោលសរុប' : 'Total Base'}</span>
            <DollarSign size={16} className="text-indigo-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-indigo-700 font-mono">${totals.totalBase.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
              {lang === 'kh' ? 'ប្រាក់ខែគោលសរុប' : 'Base salary sum'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">{lang === 'kh' ? 'ជំនួសវេន & ចំណាយ' : 'Shifts & Expenses'}</span>
            <ArrowUpRight size={16} className="text-sky-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-sky-700 font-mono">+${Number((totals.totalExtraShifts + totals.totalStaffExpenses).toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {lang === 'kh' ? `វេន +$${totals.totalExtraShifts.toLocaleString(undefined, { maximumFractionDigits: 2 })} | ចំណាយ +$${totals.totalStaffExpenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : `Shifts +$${totals.totalExtraShifts} | Exp +$${totals.totalStaffExpenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-100">
            <span className="text-[11px] font-bold uppercase tracking-wider">{lang === 'kh' ? 'ប្រាក់ត្រូវបើកសរុប' : 'Total Payable'}</span>
            <Sparkles size={16} className="text-amber-300" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black font-mono block">${totals.totalFinalPayable.toLocaleString()}</span>
            <span className="text-[10px] text-blue-100/90 block mt-0.5 font-mono">
              ≈ {Math.round(totals.totalFinalPayable * exchangeRate).toLocaleString()} ៛
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: PAYROLL SHEET (១. គណនាប្រាក់ខែ) */}
      {activeTab === 'payroll' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3.5 flex items-start gap-3">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <span className="font-bold">{lang === 'kh' ? 'រូបមន្តគណនាផ្លូវការ៖ ' : 'Official Formula: '}</span>
              {lang === 'kh' 
                ? 'ប្រាក់ត្រូវបើក = ប្រាក់ខែគោល + ជំនួសវេន ($6/វេន) + ចំណាយបុគ្គលិក - បើកមុន - ឈប់សម្រាក/កាត់ប្រាក់' 
                : 'Final Payment = Base Salary + Extra Shift Payment ($6/shift) + Staff Expense - Advance - Deduction'}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'kh' ? `តារាងគណនាប្រាក់ខែបុគ្គលិក - ខែ ${months.find(m => m.value === selectedMonth)?.kh || selectedMonth} ${selectedYear}` : `Payroll Sheet - ${months.find(m => m.value === selectedMonth)?.en || selectedMonth} ${selectedYear}`}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {lang === 'kh' ? 'ទិន្នន័យជំនួសវេន និងចំណាយបុគ្គលិកត្រូវបានបូកបញ្ចូលដោយស្វ័យប្រវត្តិ' : 'Extra shifts and staff expenses are automatically linked'}
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder={lang === 'kh' ? 'ស្វែងរកឈ្មោះបុគ្គលិក...' : 'Search staff...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>
          </div>

          {/* Payroll Table */}
          {payrollRows.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold">{lang === 'kh' ? 'មិនមានបុគ្គលិកក្នុងសាខានេះនៅឡើយទេ' : 'No staff found for this branch'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 text-[10.5px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-3.5">{lang === 'kh' ? 'បុគ្គលិក' : 'Staff'}</th>
                    <th className="py-3 px-3 text-right">{lang === 'kh' ? 'ប្រាក់ខែគោល' : 'Base'}</th>
                    <th className="py-3 px-3 text-right text-sky-800 bg-sky-50/30">{lang === 'kh' ? '+ ជំនួសវេន ($6)' : '+ Shifts ($6)'}</th>
                    <th className="py-3 px-3 text-right text-amber-800 bg-amber-50/30">{lang === 'kh' ? '+ ចំណាយបុគ្គលិក' : '+ Staff Expense'}</th>
                    <th className="py-3 px-3 text-right text-rose-800 bg-rose-50/30">{lang === 'kh' ? '- បើកមុន' : '- Advance'}</th>
                    <th className="py-3 px-3 text-right text-purple-800 bg-purple-50/30">{lang === 'kh' ? '- ឈប់សម្រាក' : '- Deduction'}</th>
                    <th className="py-3 px-3.5 text-right font-black text-slate-900">{lang === 'kh' ? 'ប្រាក់ត្រូវបើក' : 'Final Payment'}</th>
                    <th className="py-3 px-3 text-center">{lang === 'kh' ? 'ស្ថានភាព' : 'Status'}</th>
                    <th className="py-3 px-3.5 text-right">{lang === 'kh' ? 'សកម្មភាព' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {payrollRows.map(row => {
                    const st = row.staff;
                    return (
                      <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Staff Profile */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-blue-200/50">
                              {st.photoUrl ? (
                                <img src={st.photoUrl} alt={st.fullName} className="w-full h-full object-cover" />
                              ) : (
                                st.fullName.charAt(0)
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 leading-none">{st.fullName}</div>
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">{st.position}</span>
                                <span>{st.phone}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Base Salary */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ${row.baseSalary.toLocaleString()}
                        </td>

                        {/* 1. Extra Shifts (ជំនួសវេន $6/វេន) */}
                        <td className="py-2 px-3 text-right bg-sky-50/20">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.extraShiftCount === 0 ? '' : row.extraShiftCount}
                              placeholder="0"
                              onChange={e => saveAdjustment(st.id, { shiftOverride: Math.max(0, Number(e.target.value)) })}
                              className="w-14 text-right px-2 py-1 bg-white border border-sky-200 rounded-lg text-xs font-mono font-bold text-sky-900 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs"
                            />
                            <span className="text-[10px] text-sky-600 font-medium">{lang === 'kh' ? 'វេន' : 'sh'}</span>
                          </div>
                          <div className="text-[10px] text-right font-mono font-bold text-sky-700 mt-0.5">
                            +${row.extraShiftAmount}
                          </div>
                        </td>

                        {/* 2. Staff Expense Reimbursement (ចំណាយបុគ្គលិក) */}
                        <td className="py-3 px-3 text-right bg-amber-50/20">
                          <div className="font-mono font-bold text-amber-700">
                            {row.staffExpenseAmount > 0 ? `+$${row.staffExpenseAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '$0'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {row.unpaidExpenses.length > 0 ? `${row.unpaidExpenses.length} វិក្កយបត្រ` : '-'}
                          </div>
                        </td>

                        {/* 3. Salary Advance (បើកមុន) */}
                        <td className="py-3 px-3 text-right bg-rose-50/20 font-mono font-bold text-rose-600">
                          {row.advancesDeduct > 0 ? `-$${row.advancesDeduct}` : '$0'}
                        </td>

                        {/* 4. Leaves / Deductions (ឈប់សម្រាក) */}
                        <td className="py-2 px-3 text-right bg-purple-50/20">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={row.leaveDays === 0 ? '' : row.leaveDays}
                              placeholder="0"
                              onChange={e => saveAdjustment(st.id, { leaveDays: Math.max(0, Number(e.target.value)) })}
                              className="w-14 text-right px-2 py-1 bg-white border border-purple-200 rounded-lg text-xs font-mono font-bold text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs"
                            />
                            <span className="text-[10px] text-purple-600 font-medium">{lang === 'kh' ? 'ថ្ងៃ' : 'd'}</span>
                          </div>
                          <div className="text-[10px] text-right font-mono font-bold text-rose-600 mt-0.5">
                            -${row.deduction}
                          </div>
                        </td>

                        {/* FINAL PAYMENT */}
                        <td className="py-3 px-3.5 text-right">
                          <div className="font-mono font-black text-sm text-emerald-700">
                            ${row.finalPayment.toLocaleString()}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {Math.round(row.finalPayment * exchangeRate).toLocaleString()} ៛
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 text-center">
                          {row.isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <CheckCircle2 size={12} />
                              {lang === 'kh' ? 'បើករួច' : 'Paid'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                              <Clock size={12} />
                              {lang === 'kh' ? 'មិនទាន់បើក' : 'Pending'}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Payslip */}
                            <button
                              onClick={() => {
                                setSelectedPayslipRecord({
                                  ...row.paidRecord,
                                  id: row.paidRecord?.id || `draft_${st.id}`,
                                  empNameKh: st.fullName,
                                  empNameEn: st.fullName,
                                  staffName: st.fullName,
                                  position: st.position,
                                  startDate: st.startDate,
                                  month: selectedMonth,
                                  year: selectedYear,
                                  period: 3,
                                  proratedBasic: row.baseSalary,
                                  basicSalary: row.baseSalary,
                                  periodBase: row.baseSalary,
                                  standardDays: 26,
                                  workedDays: 26 - row.leaveDays,
                                  leaveDays: row.leaveDays,
                                  leaveDates: row.leaveDates,
                                  extraShiftCount: row.extraShiftCount,
                                  extraShiftAmount: row.extraShiftAmount,
                                  staffExpenseAmount: row.staffExpenseAmount,
                                  advancesDeduct: row.advancesDeduct,
                                  leavesDeduct: row.deduction,
                                  netSalary: row.finalPayment,
                                  status: row.isPaid ? 'Paid' : 'Unpaid',
                                  paymentDate: row.paidRecord?.paymentDate || new Date().toISOString().substring(0, 10),
                                  paymentMethod: row.paidRecord?.paymentMethod || 'Cash'
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                              title={lang === 'kh' ? 'វិក្កយបត្រ / បង្កាន់ដៃ' : 'Payslip'}
                            >
                              <Printer size={15} />
                            </button>

                            {/* Pay Button / Paid Status & Delete */}
                            {!row.isPaid ? (
                              <button
                                onClick={() => {
                                  setPayModalStaff({ staff: st, calc: row });
                                  setPayNote(`បើកប្រាក់ខែ ${months.find(m => m.value === selectedMonth)?.kh || selectedMonth} ${selectedYear}`);
                                }}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1"
                              >
                                <DollarSign size={12} />
                                <span>{lang === 'kh' ? 'បើកប្រាក់' : 'Pay'}</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                                  {row.paidRecord?.paymentMethod || 'Paid'}
                                </span>
                                {['Owner', 'Admin'].includes(currentRole) && (
                                  <button
                                    onClick={() => {
                                      const recId = row.paidRecord?.id || salaries.find(s => s.staffId === st.id && (s.salaryPeriod.includes(String(selectedMonth)) || s.salaryPeriod.includes(months.find(m => m.value === selectedMonth)?.en || '')) )?.id;
                                      if (recId) {
                                        setSalaryToDelete({
                                          id: recId,
                                          staffId: st.id,
                                          staffName: st.fullName,
                                          period: `${months.find(m => m.value === selectedMonth)?.kh || selectedMonth} ${selectedYear}`,
                                          month: selectedMonth,
                                          year: selectedYear
                                        });
                                      }
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title={lang === 'kh' ? 'លុបកំណត់ត្រាបើកប្រាក់ខែនេះ' : 'Delete Salary Record'}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: SALARY ADVANCES (២. ប្រាក់បើកមុន) */}
      {activeTab === 'advances' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'kh' ? 'បញ្ជីស្នើសុំ និងបើកប្រាក់មុន (Salary Advances)' : 'Salary Advance Requests'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {lang === 'kh' ? 'ប្រាក់ដែលបុគ្គលិកបានបើកមុន នឹងត្រូវកាត់ចេញពីប្រាក់ខែស្វ័យប្រវត្តិ' : 'Advances are automatically deducted from final payout'}
              </p>
            </div>

            <button
              onClick={() => {
                setAdvStaffId(availableStaff[0]?.id || '');
                setAdvAmount(30);
                setShowAdvanceModal(true);
              }}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Plus size={14} />
              <span>{lang === 'kh' ? '+ បើកប្រាក់មុនថ្មី' : '+ New Advance'}</span>
            </button>
          </div>

          {salaryAdvances.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Coins size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold">{lang === 'kh' ? 'មិនទាន់មានទិន្នន័យបើកប្រាក់មុននៅឡើយទេ' : 'No advances recorded'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 text-[10.5px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-3.5">{lang === 'kh' ? 'បុគ្គលិក' : 'Staff'}</th>
                    <th className="py-3 px-3">{lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date'}</th>
                    <th className="py-3 px-3 text-right">{lang === 'kh' ? 'ទឹកប្រាក់' : 'Amount'}</th>
                    <th className="py-3 px-3">{lang === 'kh' ? 'មូលហេតុ' : 'Reason'}</th>
                    <th className="py-3 px-3 text-center">{lang === 'kh' ? 'ស្ថានភាព' : 'Status'}</th>
                    <th className="py-3 px-3.5 text-right">{lang === 'kh' ? 'សកម្មភាព' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {salaryAdvances.map(adv => {
                    const st = staffList.find(s => s.id === adv.staffId);
                    return (
                      <tr key={adv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-slate-900">{st?.fullName || adv.staffId}</td>
                        <td className="py-3 px-3 font-mono text-slate-500">{adv.requestDate || adv.createdAt?.substring(0, 10)}</td>
                        <td className="py-3 px-3 text-right font-mono font-black text-rose-600">${adv.amount}</td>
                        <td className="py-3 px-3 text-slate-600">{adv.reason || '-'}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            adv.status === 'Paid' ? 'bg-slate-100 text-slate-700' :
                            adv.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {adv.status}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            onClick={() => {
                              if (confirm(lang === 'kh' ? 'លុបទិន្នន័យនេះ?' : 'Delete?')) {
                                setSalaryAdvances(prev => prev.filter(a => a.id !== adv.id));
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: EXTRA SHIFTS (៣. ជំនួសវេន / វេនបន្ថែម $6) */}
      {activeTab === 'extrashifts' && (
        <div className="space-y-6">
          {/* Quick Direct Entry Form Card (Matching requested screenshot) */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <UserCheck className="text-blue-600" size={18} />
                  {lang === 'kh' ? 'កត់ត្រាការថែមម៉ោង / ជំនួសវេន (គិតជាវេន $6)' : 'Record Extra Shift Cover ($6 per shift)'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                  {lang === 'kh' 
                    ? 'សម្រាប់បុគ្គលិកផ្លូវការ Clean24 • តម្លៃស្វ័យប្រវត្តិ $6/វេន • បូកចូលប្រាក់ខែស្វ័យប្រវត្តិ (+ ជំនួសវេន)' 
                    : 'For official Clean24 employees. Default rate $6/shift. Automatically added to monthly payroll.'}
                </p>
              </div>

              <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 font-bold text-xs">
                {lang === 'kh' ? `សរុបត្រូវបើក៖ $${((Number(esCount) || 1) * (Number(esRate) || 6)).toFixed(2)}` : `Total Payout: $${((Number(esCount) || 1) * (Number(esRate) || 6)).toFixed(2)}`}
              </div>
            </div>

            <form onSubmit={handleSaveExtraShift} className="space-y-4">
              {/* Row 1: Select Employee */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                  {lang === 'kh' ? 'ជ្រើសរើសបុគ្គលិក *' : 'Select Employee *'}
                </label>
                <select
                  value={esStaffId}
                  onChange={e => setEsStaffId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">{lang === 'kh' ? '-- ជ្រើសរើសបុគ្គលិក --' : '-- Select Employee --'}</option>
                  {availableStaff.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.position} • {st.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 2: Shift Type */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                  {lang === 'kh' ? 'វេនការងារថែមម៉ោង (Overtime Shift)' : 'Overtime Shift'}
                </label>
                <select
                  value={esShift}
                  onChange={e => setEsShift(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="Morning">{lang === 'kh' ? 'វេនព្រឹក (Day / Morning Shift)' : 'Morning Shift'}</option>
                  <option value="Afternoon">{lang === 'kh' ? 'វេនរសៀល (Afternoon Shift)' : 'Afternoon Shift'}</option>
                  <option value="Night">{lang === 'kh' ? 'វេនយប់ (Night Shift)' : 'Night Shift'}</option>
                  <option value="Full Time">{lang === 'kh' ? 'ពេញមួយថ្ងៃ (Full Day Shift)' : 'Full Day Shift'}</option>
                </select>
              </div>

              {/* Row 3: Count & Rate ($6) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                    {lang === 'kh' ? 'ចំនួនថ្ងៃ/វេនដែលថែម *' : 'Number of Shifts *'}
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    placeholder="ឧ. 1 ឬ 0.5"
                    value={esCount}
                    onChange={e => setEsCount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                    {lang === 'kh' ? 'តម្លៃក្នុង១វេន (Rate per shift)' : 'Rate per Shift ($)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={esRate}
                      onChange={e => setEsRate(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 pl-7"
                    />
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                  </div>
                </div>
              </div>

              {/* Row 4: Date Start & End */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                    {lang === 'kh' ? 'ថ្ងៃចាប់ផ្តើម *' : 'Start Date *'}
                  </label>
                  <input
                    type="date"
                    value={esDate}
                    onChange={e => {
                      const newStart = e.target.value;
                      setEsDate(newStart);
                      let newEnd = esEndDate;
                      if (!newEnd || newEnd < newStart) {
                        newEnd = newStart;
                        setEsEndDate(newStart);
                      }
                      const days = calcDaysBetween(newStart, newEnd);
                      setEsCount(days);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                    {lang === 'kh' ? 'ថ្ងៃបញ្ចប់' : 'End Date'}
                  </label>
                  <input
                    type="date"
                    value={esEndDate || esDate}
                    onChange={e => {
                      const newEnd = e.target.value;
                      setEsEndDate(newEnd);
                      const days = calcDaysBetween(esDate, newEnd);
                      setEsCount(days);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Row 5: Covered for staff (optional) */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                  {lang === 'kh' ? 'ជំនួសឱ្យបុគ្គលិកណា (Covered For - Optional)' : 'Covered For Staff (Optional)'}
                </label>
                <select
                  value={esCoveredFor}
                  onChange={e => setEsCoveredFor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">{lang === 'kh' ? '-- មិនមាន / វេនបន្ថែមផ្ទាល់ខ្លួន --' : '-- None / General Shift Cover --'}</option>
                  {staffList.filter(s => s.id !== esStaffId).map(st => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.position})
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 6: Note */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                  {lang === 'kh' ? 'សម្គាល់ (Note)' : 'Note'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'kh' ? 'ឧ. បញ្ចប់គម្រោងបន្ទាន់ / ជំនួសវេនឈឺ...' : 'e.g. Covered sickness shift...'}
                  value={esNote}
                  onChange={e => setEsNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Submit / Update Button */}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-blue-200"
                >
                  <Save size={15} />
                  <span>
                    {editingShiftId 
                      ? (lang === 'kh' ? '💾 ធ្វើបច្ចុប្បន្នភាពជំនួសវេន' : 'Update Shift Cover')
                      : (lang === 'kh' ? '💾 កត់ត្រាជំនួសវេន' : 'Save Shift Cover')}
                  </span>
                </button>
                {editingShiftId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingShiftId(null);
                      setEsStaffId('');
                      setEsNote('');
                      setEsCoveredFor('');
                      setEsCount(1);
                    }}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {lang === 'kh' ? 'បោះបង់' : 'Cancel'}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List Table of Shift Covers */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'kh' ? 'បញ្ជីកត់ត្រាជំនួសវេនប្រចាំខែ' : 'Monthly Shift Cover Records'}
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                {extraShifts.length} {lang === 'kh' ? 'កំណត់ត្រា' : 'records'}
              </span>
            </div>

            {extraShifts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <UserCheck size={36} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold">{lang === 'kh' ? 'មិនទាន់មានទិន្នន័យជំនួសវេននៅឡើយទេ' : 'No extra shifts logged'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 text-[10.5px] uppercase font-bold tracking-wider">
                      <th className="py-3 px-3.5">{lang === 'kh' ? 'បុគ្គលិកធ្វើជំនួស' : 'Staff'}</th>
                      <th className="py-3 px-3">{lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date'}</th>
                      <th className="py-3 px-3">{lang === 'kh' ? 'វេន' : 'Shift'}</th>
                      <th className="py-3 px-3 text-center">{lang === 'kh' ? 'ចំនួនវេន' : 'Shifts'}</th>
                      <th className="py-3 px-3 text-right">{lang === 'kh' ? 'តម្លៃក្នុង១វេន' : 'Rate'}</th>
                      <th className="py-3 px-3 text-right font-black text-sky-700">{lang === 'kh' ? 'សរុប' : 'Total'}</th>
                      <th className="py-3 px-3">{lang === 'kh' ? 'ជំនួសឱ្យ' : 'Covered For'}</th>
                      <th className="py-3 px-3">{lang === 'kh' ? 'កំណត់សម្គាល់' : 'Notes'}</th>
                      <th className="py-3 px-3.5 text-right">{lang === 'kh' ? 'សកម្មភាព' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {extraShifts.map(shift => (
                      <tr key={shift.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-slate-900">{shift.staffName}</td>
                        <td className="py-3 px-3 font-mono text-slate-500">{shift.date}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[10.5px] font-bold text-slate-700">
                            {shift.shift}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">{shift.shiftCount}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">${shift.ratePerShift}</td>
                        <td className="py-3 px-3 text-right font-mono font-black text-sky-700">+${shift.totalAmount}</td>
                        <td className="py-3 px-3 text-slate-600">{shift.coveredForStaffName || '-'}</td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">{shift.note || '-'}</td>
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingShiftId(shift.id);
                                setEsStaffId(shift.staffId);
                                if (shift.date.includes('~')) {
                                  const [s, e] = shift.date.split('~').map(x => x.trim());
                                  setEsDate(s);
                                  setEsEndDate(e);
                                } else {
                                  setEsDate(shift.date);
                                  setEsEndDate(shift.date);
                                }
                                setEsShift(shift.shift as any);
                                setEsCount(shift.shiftCount);
                                setEsRate(shift.ratePerShift);
                                setEsCoveredFor(shift.coveredForStaffId || '');
                                setEsNote(shift.note || '');
                                window.scrollTo({ top: 350, behavior: 'smooth' });
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                              title={lang === 'kh' ? 'កែប្រែ' : 'Edit'}
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(lang === 'kh' ? 'លុបទិន្នន័យនេះ?' : 'Delete?')) {
                                  setExtraShifts(prev => prev.filter(s => s.id !== shift.id));
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title={lang === 'kh' ? 'លុប' : 'Delete'}
                            >
                              <X size={14} />
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

      {/* SECTION 4: STAFF EXPENSES (៤. ចំណាយបុគ្គលិក) */}
      {activeTab === 'expenses' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'kh' ? 'ចំណាយបុគ្គលិក / បុគ្គលិកចេញលុយផ្ទាល់ខ្លួនមុន (Staff Expense Reimbursement)' : 'Staff Expense Reimbursements'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {lang === 'kh' ? 'ទិញសាប៊ូ ទឹកក្រអូប ថង់ ឬជួសជុលហាង • មិនមែនជាការកាត់ប្រាក់ទេ គឺជាប្រាក់ដែលហាងជំពាក់បុគ្គលិក' : 'Money Clean24 owes the employee for purchases made.'}
              </p>
            </div>

            <button
              onClick={() => {
                setExpStaffId(availableStaff[0]?.id || '');
                setExpAmount(10);
                setShowExpenseModal(true);
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Plus size={14} />
              <span>{lang === 'kh' ? '+ កត់ត្រាចំណាយបុគ្គលិក' : '+ Record Expense'}</span>
            </button>
          </div>

          {staffExpenses.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Receipt size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold">{lang === 'kh' ? 'មិនទាន់មានកំណត់ត្រាចំណាយបុគ្គលិកនៅឡើយទេ' : 'No staff expenses logged'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 text-[10.5px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-3.5">{lang === 'kh' ? 'បុគ្គលិក' : 'Staff'}</th>
                    <th className="py-3 px-3">{lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date'}</th>
                    <th className="py-3 px-3">{lang === 'kh' ? 'ប្រភេទចំណាយ' : 'Category'}</th>
                    <th className="py-3 px-3">{lang === 'kh' ? 'បរិយាយ' : 'Description'}</th>
                    <th className="py-3 px-3 text-right font-black text-amber-700">{lang === 'kh' ? 'ទឹកប្រាក់' : 'Amount'}</th>
                    <th className="py-3 px-3">{lang === 'kh' ? 'វិធីសង' : 'Method'}</th>
                    <th className="py-3 px-3 text-center">{lang === 'kh' ? 'ស្ថានភាព' : 'Status'}</th>
                    <th className="py-3 px-3.5 text-right">{lang === 'kh' ? 'សកម្មភាព' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {staffExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-slate-900">{exp.staffName}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{exp.date}</td>
                      <td className="py-3 px-3 text-slate-800 font-medium">{exp.category}</td>
                      <td className="py-3 px-3 text-slate-600">{exp.description || '-'}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-amber-700">+${exp.amount}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                          exp.repaymentMethod === 'Payroll' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {exp.repaymentMethod === 'Payroll' ? (lang === 'kh' ? 'សងជាមួយប្រាក់ខែ' : 'With Payroll') : (lang === 'kh' ? 'សងដោយឡែក' : 'Separately')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          exp.status === 'Paid' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {exp.status === 'Paid' ? (lang === 'kh' ? 'បានសងរួច' : 'Paid') : (lang === 'kh' ? 'មិនទាន់សង' : 'Pending')}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {exp.status === 'Pending' && exp.repaymentMethod === 'Separate' && (
                            <button
                              onClick={() => {
                                setStaffExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, status: 'Paid', paidDate: new Date().toISOString().substring(0, 10) } : e));
                                showBanner('success', lang === 'kh' ? `បានទូទាត់សង $${exp.amount} ជូន ${exp.staffName} រួចរាល់!` : `Marked as Paid!`);
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                            >
                              {lang === 'kh' ? 'សងភ្លាមៗ' : 'Pay'}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(lang === 'kh' ? 'លុបទិន្នន័យនេះ?' : 'Delete?')) {
                                setStaffExpenses(prev => prev.filter(e => e.id !== exp.id));
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-all cursor-pointer"
                          >
                            <X size={14} />
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
      )}

      {/* SECTION 5: ATTENDANCE & LEAVES (៥. វត្តមាន & ឈប់សម្រាក) */}
      {activeTab === 'attendance' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'kh' ? 'វត្តមាន និងការឈប់សម្រាកបុគ្គលិក (Attendance & Leaves)' : 'Attendance & Leave Deductions'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {lang === 'kh' ? 'ស្តង់ដារ Clean24៖ កាត់ $6 ក្នុង ១វេន • ចុច «បញ្ជាក់ថ្ងៃឈប់» ដើម្បីកត់ត្រាកាលបរិច្ឆេទឈប់ជាក់ស្តែង' : 'Clean24 Standard: $6 per shift deduction (Days absent × $6)'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 text-[10.5px] uppercase font-bold tracking-wider">
                  <th className="py-3 px-3.5">{lang === 'kh' ? 'បុគ្គលិក' : 'Staff'}</th>
                  <th className="py-3 px-3 text-right">{lang === 'kh' ? 'ប្រាក់ខែគោល' : 'Base'}</th>
                  <th className="py-3 px-3 text-right">{lang === 'kh' ? 'អត្រាក្នុង ១វេន' : 'Rate / Shift'}</th>
                  <th className="py-3 px-3 text-right font-black text-amber-700">{lang === 'kh' ? 'ចំនួនថ្ងៃឈប់' : 'Days Absent'}</th>
                  <th className="py-3 px-3 font-bold text-slate-700">{lang === 'kh' ? 'កាលបរិច្ឆេទឈប់ជាក់ស្តែង' : 'Leave Dates'}</th>
                  <th className="py-3 px-3 text-right font-black text-rose-700">{lang === 'kh' ? 'ប្រាក់ត្រូវកាត់' : 'Deduction'}</th>
                  <th className="py-3 px-3.5 text-right">{lang === 'kh' ? 'សកម្មភាព' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {payrollRows.map(row => (
                  <tr key={row.staff.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3.5 font-bold text-slate-900">{row.staff.fullName}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">${row.baseSalary}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">$6 / វេន</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-700">{row.leaveDays} ថ្ងៃ</td>
                    <td className="py-3 px-3">
                      {row.leaveDates && row.leaveDates.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.leaveDates.map((dt: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-mono font-bold">
                              {dt}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-rose-700">-${row.deduction}</td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setLeaveModalStaff(row.staff);
                          setLeaveDaysInput(row.leaveDays);
                          setLeaveDatesInput(Array.isArray(row.leaveDates) ? row.leaveDates.join(', ') : '');
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Edit3 size={12} />
                        <span>{lang === 'kh' ? 'បញ្ជាក់ថ្ងៃឈប់' : 'Set Leave'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 6: PAYMENT HISTORY (៦. ប្រវត្តិបើកប្រាក់) */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'kh' ? 'ប្រវត្តិទូទាត់ប្រាក់បុគ្គលិក និងអ្នកជំនួសក្រៅ (Payroll & Temp History)' : 'Payroll & Temp Payout History'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {lang === 'kh' ? 'កំណត់ត្រាប្រាក់ខែបុគ្គលិកផ្លូវការ និងការទូទាត់អ្នកជំនួសក្រៅប្រចាំខែ ដើម្បីងាយស្រួលបូកសរុបចំណាយ' : 'Historical payroll records and external temp shift payments.'}
              </p>
            </div>

            {/* Total Paid in Period */}
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-mono font-black text-xs shadow-2xs">
                {lang === 'kh' ? 'សរុបទូទាត់ក្នុងខែនេះ៖ ' : 'Total Paid: '}${combinedPaidHistory.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
              </span>
            </div>
          </div>

          {combinedPaidHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <History size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold">{lang === 'kh' ? 'មិនទាន់មានប្រវត្តិបើកប្រាក់សម្រាប់ខែនេះនៅឡើយទេ' : 'No payout history'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 text-[10.5px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-3.5">{lang === 'kh' ? 'ប្រភេទ' : 'Type'}</th>
                    <th className="py-3 px-3">{lang === 'kh' ? 'ឈ្មោះ' : 'Name'}</th>
                    <th className="py-3 px-3">{lang === 'kh' ? 'ខែ/កាលបរិច្ឆេទ' : 'Period / Date'}</th>
                    <th className="py-3 px-3">{lang === 'kh' ? 'កាលបរិច្ឆេទបើក' : 'Paid Date'}</th>
                    <th className="py-3 px-3">{lang === 'kh' ? 'វិធីសាស្ត្រ' : 'Method'}</th>
                    <th className="py-3 px-3 text-right">{lang === 'kh' ? 'ប្រាក់ខែគោល/វេន' : 'Base / Shift'}</th>
                    <th className="py-3 px-3 text-right">{lang === 'kh' ? 'ជំនួសវេន' : 'Shifts'}</th>
                    <th className="py-3 px-3 text-right font-black text-emerald-700">{lang === 'kh' ? 'ប្រាក់បើកជាក់ស្តែង' : 'Net Paid'}</th>
                    <th className="py-3 px-3.5 text-right">{lang === 'kh' ? 'បង្កាន់ដៃ' : 'Receipt / Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {combinedPaidHistory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3.5">
                        {item.type === 'staff' ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                            {lang === 'kh' ? 'បុគ្គលិក' : 'Staff'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold">
                            {lang === 'kh' ? 'អ្នកជំនួសក្រៅ' : 'Temp Cover'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{item.name}</td>
                      <td className="py-3 px-3 text-slate-600 font-mono">{item.period || '-'}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{item.paidDate || '-'}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[10.5px] font-bold text-slate-700">
                          {item.method || 'Cash'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">{item.details}</td>
                      <td className="py-3 px-3 text-right font-mono text-sky-700">{item.shifts}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-700">${item.amount.toLocaleString()}</td>
                      <td className="py-3 px-3.5 text-right">
                        {item.type === 'staff' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                const st = staffList.find(s => s.id === item.raw?.staffId);
                                setSelectedPayslipRecord({
                                  ...item.raw,
                                  empNameKh: item.name,
                                  empNameEn: item.name,
                                  position: st?.position || 'Staff',
                                  startDate: st?.startDate || 'N/A',
                                  month: selectedMonth,
                                  year: selectedYear,
                                  period: 3,
                                  proratedBasic: item.raw?.baseSalary,
                                  basicSalary: item.raw?.baseSalary,
                                  periodBase: item.raw?.baseSalary,
                                  standardDays: 26,
                                  workedDays: item.raw?.daysWorked || 26,
                                  leaveDays: item.raw?.leaveDays || 0,
                                  leaveDates: item.raw?.leaveDates || [],
                                  extraShiftAmount: item.raw?.extraShiftAmount || item.raw?.overtime || 0,
                                  extraShiftCount: item.raw?.extraShiftCount || 0,
                                  staffExpenseAmount: item.raw?.staffExpenseAmount || item.raw?.bonus || 0,
                                  advancesDeduct: item.raw?.advancePayment || 0,
                                  leavesDeduct: item.raw?.deduction || 0,
                                  netSalary: item.amount,
                                  status: 'Paid'
                                });
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <Printer size={12} />
                              <span>{lang === 'kh' ? 'មើលបង្កាន់ដៃ' : 'Payslip'}</span>
                            </button>
                            {['Owner', 'Admin'].includes(currentRole) && item.raw && (
                              <button
                                onClick={() => setSalaryToDelete({
                                  id: item.raw.id,
                                  staffId: item.raw.staffId,
                                  staffName: item.name,
                                  period: item.period || `${selectedMonth}/${selectedYear}`
                                })}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                                title={lang === 'kh' ? 'លុបកំណត់ត្រាបើកប្រាក់ខែនេះ' : 'Delete'}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                            ✓ {lang === 'kh' ? 'បានទូទាត់រួច' : 'Paid'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: PAY SALARY MODAL */}
      {payModalStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Banknote className="text-blue-600" size={18} />
                  {lang === 'kh' ? 'ទូទាត់ប្រាក់ខែបុគ្គលិក' : 'Process Salary Payment'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {payModalStaff.staff.fullName} ({payModalStaff.staff.position})
                </p>
              </div>
              <button 
                onClick={() => setPayModalStaff(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Calculation Breakdown */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{lang === 'kh' ? 'ប្រាក់ខែគោល (Base):' : 'Base Salary:'}</span>
                <span className="font-mono font-bold">${payModalStaff.calc.baseSalary}</span>
              </div>
              {payModalStaff.calc.extraShiftAmount > 0 && (
                <div className="flex justify-between text-sky-700">
                  <span>{lang === 'kh' ? `+ ជំនួសវេន (${payModalStaff.calc.extraShiftCount} វេន × $6):` : `+ Shift Covers (${payModalStaff.calc.extraShiftCount} shifts × $6):`}</span>
                  <span className="font-mono font-bold">+${payModalStaff.calc.extraShiftAmount}</span>
                </div>
              )}
              {payModalStaff.calc.staffExpenseAmount > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>{lang === 'kh' ? '+ សងចំណាយបុគ្គលិក (Staff Expense):' : '+ Staff Expense Reimbursement:'}</span>
                  <span className="font-mono font-bold">+${payModalStaff.calc.staffExpenseAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {payModalStaff.calc.advancesDeduct > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span>{lang === 'kh' ? '- បើកប្រាក់មុន (Salary Advance):' : '- Salary Advance:'}</span>
                  <span className="font-mono font-bold">-${payModalStaff.calc.advancesDeduct}</span>
                </div>
              )}
              {payModalStaff.calc.deduction > 0 && (
                <div className="flex justify-between text-purple-700">
                  <span>{lang === 'kh' ? `- ឈប់សម្រាក (${payModalStaff.calc.leaveDays} ថ្ងៃ):` : `- Leave Deductions (${payModalStaff.calc.leaveDays} days):`}</span>
                  <span className="font-mono font-bold">-${payModalStaff.calc.deduction}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline text-slate-900 font-bold">
                <span className="text-sm">{lang === 'kh' ? 'ប្រាក់ត្រូវបើកជាក់ស្តែង:' : 'Final Payment:'}</span>
                <div className="text-right">
                  <span className="text-lg font-black text-emerald-700 font-mono">${payModalStaff.calc.finalPayment.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    ≈ {Math.round(payModalStaff.calc.finalPayment * exchangeRate).toLocaleString()} ៛
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Options */}
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {lang === 'kh' ? 'វិធីសាស្ត្រទូទាត់' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ABA', 'Cash', 'Bank Transfer'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        payMethod === m 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {lang === 'kh' ? 'កាលបរិច្ឆេទបើកប្រាក់' : 'Payment Date'}
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {lang === 'kh' ? 'កំណត់សម្គាល់ (Note)' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder={lang === 'kh' ? 'ឧទាហរណ៍៖ បើកប្រាក់ខែកញ្ញា ២០២៦' : 'e.g. September 2026 Payroll'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPayModalStaff(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                {lang === 'kh' ? 'បោះបង់' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>{lang === 'kh' ? 'យល់ព្រមបើកប្រាក់' : 'Confirm Payout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD EXTRA SHIFT COVER FOR OFFICIAL EMPLOYEE */}
      {showExtraShiftModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <UserCheck className="text-sky-600" size={18} />
                  {lang === 'kh' ? 'កត់ត្រាជំនួសវេន / វេនបន្ថែម' : 'Record Shift Cover'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'kh' ? 'សម្រាប់បុគ្គលិកផ្លូវការ • ១វេន = $6' : 'For Clean24 Staff • $6/shift'}
                </p>
              </div>
              <button onClick={() => setShowExtraShiftModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveExtraShift} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {lang === 'kh' ? 'បុគ្គលិកមកធ្វើជំនួស' : 'Employee'}
                </label>
                <select
                  value={esStaffId}
                  onChange={e => setEsStaffId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                >
                  {availableStaff.map(st => (
                    <option key={st.id} value={st.id}>{st.fullName} ({st.position})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date'}</label>
                  <input
                    type="date"
                    required
                    value={esDate}
                    onChange={e => setEsDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'វេន' : 'Shift'}</label>
                  <select
                    value={esShift}
                    onChange={e => setEsShift(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                  >
                    <option value="Morning">{lang === 'kh' ? 'វេនព្រឹក (Morning)' : 'Morning'}</option>
                    <option value="Afternoon">{lang === 'kh' ? 'វេនរសៀល (Afternoon)' : 'Afternoon'}</option>
                    <option value="Night">{lang === 'kh' ? 'វេនយប់ (Night)' : 'Night'}</option>
                    <option value="Full Time">{lang === 'kh' ? 'ពេញមួយថ្ងៃ (Full Day)' : 'Full Day'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-sky-800 block mb-1">{lang === 'kh' ? 'ចំនួនវេន' : 'Shift Count'}</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={esCount}
                    onChange={e => setEsCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-sky-50 border border-sky-200 rounded-xl text-xs font-mono font-bold text-sky-900 focus:outline-none focus:bg-white focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'តម្លៃក្នុង១វេន' : 'Rate / Shift'}</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={esRate}
                    onChange={e => setEsRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-200/80 flex items-center justify-between text-xs font-bold text-sky-900">
                <span>{lang === 'kh' ? 'សរុបប្រាក់វេនបន្ថែម:' : 'Total Shift Amount:'}</span>
                <span className="text-sm font-black font-mono">+${esCount * esRate} ({esCount} វេន × ${esRate})</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {lang === 'kh' ? 'មកជំនួសឱ្យបុគ្គលិកណា (Optional)' : 'Covered for Employee (Optional)'}
                </label>
                <select
                  value={esCoveredFor}
                  onChange={e => setEsCoveredFor(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                >
                  <option value="">{lang === 'kh' ? '-- មិនមានបញ្ជាក់ --' : '-- None --'}</option>
                  {availableStaff.filter(s => s.id !== esStaffId).map(st => (
                    <option key={st.id} value={st.id}>{st.fullName} ({st.position})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'កំណត់សម្គាល់' : 'Notes'}</label>
                <input
                  type="text"
                  value={esNote}
                  onChange={e => setEsNote(e.target.value)}
                  placeholder={lang === 'kh' ? 'ឧទាហរណ៍៖ មកជួយវេនចុងសប្តាហ៍...' : 'e.g. Weekend support...'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExtraShiftModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {lang === 'kh' ? 'បោះបង់' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  {lang === 'kh' ? 'រក្សាទុក' : 'Save Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD EXTERNAL / TEMP SHIFT COVER */}
      {showTempModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <UserPlus className="text-purple-600" size={20} />
                  {lang === 'kh' ? 'គ្រប់គ្រងអ្នកជំនួសវេនក្រៅ / បណ្តោះអាសន្ន (Temp Shift Covers)' : 'External Temp Shift Covers'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'kh' ? '១វេន = $6 • មិនបូកចូលបញ្ជីបុគ្គលិកផ្លូវការឡើយ • ពេលទូទាត់ប្រាក់ នឹងបង្ហាញក្នុងប្រវត្តិទូទាត់ប្រចាំខែស្វ័យប្រវត្តិ' : 'External workers • 1 shift = $6 • Included in monthly payout history upon payment'}
                </p>
              </div>
              <button onClick={() => setShowTempModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleSaveTempShift} className="bg-purple-50/50 border border-purple-200/80 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                <Plus size={14} />
                <span>{lang === 'kh' ? 'កត់ត្រាអ្នកជំនួសវេនក្រៅថ្មី' : 'Log New Temp Worker'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'ឈ្មោះអ្នកជំនួស *' : 'Name *'}</label>
                  <input
                    type="text"
                    required
                    value={tempName}
                    onChange={e => setTempName(e.target.value)}
                    placeholder={lang === 'kh' ? 'ឧ. សុភា' : 'e.g. Sothea'}
                    className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'លេខទូរស័ព្ទ' : 'Phone'}</label>
                  <input
                    type="text"
                    value={tempPhone}
                    onChange={e => setTempPhone(e.target.value)}
                    placeholder="012 345 678"
                    className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date'}</label>
                  <input
                    type="date"
                    required
                    value={tempDate}
                    onChange={e => setTempDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'វេន' : 'Shift'}</label>
                  <select
                    value={tempShift}
                    onChange={e => setTempShift(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Morning">{lang === 'kh' ? 'វេនព្រឹក' : 'Morning'}</option>
                    <option value="Afternoon">{lang === 'kh' ? 'វេនរសៀល' : 'Afternoon'}</option>
                    <option value="Night">{lang === 'kh' ? 'វេនយប់' : 'Night'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-purple-900 block mb-1">{lang === 'kh' ? 'ចំនួនវេន' : 'Shifts'}</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={tempCount}
                    onChange={e => setTempCount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-xl text-xs font-mono font-black text-purple-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'តម្លៃក្នុង១វេន' : 'Rate'}</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={tempRate}
                    onChange={e => setTempRate(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'កំណត់សម្គាល់' : 'Note'}</label>
                  <input
                    type="text"
                    value={tempNote}
                    onChange={e => setTempNote(e.target.value)}
                    placeholder={lang === 'kh' ? 'កំណត់សម្គាល់...' : 'Notes...'}
                    className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-xs font-bold text-purple-900">
                  {lang === 'kh' ? 'ទឹកប្រាក់ត្រូវបើក៖ ' : 'Payable: '}
                  <span className="font-mono font-black text-sm text-purple-700">${tempCount * tempRate} ({tempCount} វេន × ${tempRate})</span>
                </div>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>{lang === 'kh' ? 'រក្សាទុកអ្នកជំនួសក្រៅ' : 'Save Temp Cover'}</span>
                </button>
              </div>
            </form>

            {/* List of Existing Temp Shift Covers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>{lang === 'kh' ? 'បញ្ជីអ្នកជំនួសក្រៅទាំងអស់' : 'All Temp Shift Covers'}</span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {lang === 'kh' ? 'សរុប៖ ' : 'Total: '}{tempShiftCovers.length} {lang === 'kh' ? 'នាក់' : 'records'}
                </span>
              </div>

              {tempShiftCovers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  <UserPlus size={28} className="mx-auto mb-1 text-slate-300" />
                  <p className="text-xs">{lang === 'kh' ? 'មិនទាន់មានកំណត់ត្រាអ្នកជំនួសក្រៅនៅឡើយទេ' : 'No temp workers logged yet'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs">
                      <tr className="text-slate-600 border-b border-slate-200 text-[10.5px] uppercase font-bold tracking-wider">
                        <th className="py-2.5 px-3">{lang === 'kh' ? 'ឈ្មោះ' : 'Name'}</th>
                        <th className="py-2.5 px-3">{lang === 'kh' ? 'លេខទូរស័ព្ទ' : 'Phone'}</th>
                        <th className="py-2.5 px-3">{lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date'}</th>
                        <th className="py-2.5 px-3">{lang === 'kh' ? 'វេន' : 'Shift'}</th>
                        <th className="py-2.5 px-3 text-center">{lang === 'kh' ? 'ចំនួនវេន' : 'Shifts'}</th>
                        <th className="py-2.5 px-3 text-right font-black text-purple-700">{lang === 'kh' ? 'សរុប' : 'Total'}</th>
                        <th className="py-2.5 px-3 text-center">{lang === 'kh' ? 'ស្ថានភាព' : 'Status'}</th>
                        <th className="py-2.5 px-3 text-right">{lang === 'kh' ? 'សកម្មភាព' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {tempShiftCovers.map(temp => (
                        <tr key={temp.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3 font-bold text-slate-900">{temp.name}</td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{temp.phone || '-'}</td>
                          <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{temp.date}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-700">
                              {temp.shift}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold">{temp.shiftCount}</td>
                          <td className="py-2 px-3 text-right font-mono font-black text-purple-700">${temp.totalAmount}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              temp.status === 'Paid' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {temp.status === 'Paid' ? (lang === 'kh' ? 'បានបង់រួច' : 'Paid') : (lang === 'kh' ? 'មិនទាន់បង់' : 'Unpaid')}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {temp.status === 'Unpaid' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const today = new Date().toISOString().substring(0, 10);
                                    setTempShiftCovers(prev => prev.map(t => t.id === temp.id ? { ...t, status: 'Paid', paymentDate: today, paymentMethod: 'Cash' } : t));
                                    showBanner('success', lang === 'kh' ? `បានកត់ត្រាបង់ប្រាក់ $${temp.totalAmount} ជូន ${temp.name} រួចរាល់!` : `Marked as Paid!`);
                                  }}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                                >
                                  <Banknote size={12} />
                                  <span>{lang === 'kh' ? 'បង់ប្រាក់' : 'Pay'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleConvertTempToStaff(temp)}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                title={lang === 'kh' ? 'បង្កើតជាបុគ្គលិកពេញសិទ្ធិ' : 'Convert to Staff'}
                              >
                                <UserCheck size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(lang === 'kh' ? 'លុបទិន្នន័យនេះ?' : 'Delete?')) {
                                    setTempShiftCovers(prev => prev.filter(t => t.id !== temp.id));
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                title={lang === 'kh' ? 'លុប' : 'Delete'}
                              >
                                <X size={14} />
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

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTempModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                {lang === 'kh' ? 'បិទផ្ទាំង' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD STAFF EXPENSE */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <ShoppingBag className="text-amber-600" size={18} />
                  {lang === 'kh' ? 'កត់ត្រាចំណាយបុគ្គលិក' : 'Record Staff Expense'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'kh' ? 'បុគ្គលិកចេញលុយផ្ទាល់ខ្លួនទិញអីវ៉ាន់ឱ្យ Clean24' : 'Personal money spent for Clean24'}
                </p>
              </div>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveStaffExpense} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'បុគ្គលិកដែលបានចេញលុយ' : 'Staff'}</label>
                <select
                  value={expStaffId}
                  onChange={e => setExpStaffId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                >
                  {availableStaff.map(st => (
                    <option key={st.id} value={st.id}>{st.fullName} ({st.position})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date'}</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={e => setExpDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'ប្រភេទចំណាយ' : 'Category'}</label>
                  <select
                    value={expCategory}
                    onChange={e => setExpCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                  >
                    <option value="សាប៊ូ (Detergent)">សាប៊ូ (Detergent)</option>
                    <option value="ទឹកក្រអូប (Perfume)">ទឹកក្រអូប (Perfume)</option>
                    <option value="ថង់ (Bags)">ថង់ (Bags)</option>
                    <option value="សម្ភារៈបោសសម្អាត (Cleaning)">សម្ភារៈបោសសម្អាត (Cleaning)</option>
                    <option value="ជួសជុលហាង (Repairs)">ជួសជុលហាង (Repairs)</option>
                    <option value="សម្ភារៈហាង (Shop supplies)">សម្ភារៈហាង (Shop supplies)</option>
                    <option value="ផ្សេងៗ (Other)">ផ្សេងៗ (Other)</option>
                  </select>
                </div>
              </div>

              {/* Show Custom Category Input when ផ្សេងៗ (Other) is selected */}
              {expCategory === 'ផ្សេងៗ (Other)' && (
                <div className="animate-in fade-in duration-150">
                  <label className="text-[11px] font-bold text-amber-800 block mb-1">
                    {lang === 'kh' ? 'បញ្ជាក់ប្រភេទចំណាយផ្សេងៗ *' : 'Specify Other Category *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={expCustomCategory}
                    onChange={e => setExpCustomCategory(e.target.value)}
                    placeholder={lang === 'kh' ? 'វាយបញ្ចូលប្រភេទចំណាយជាក់ស្តែង (ឧ. ថ្លៃអគ្គិសនី, ទិញដបបាញ់...)' : 'Enter custom category...'}
                    className="w-full px-3 py-2 bg-amber-50/60 border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>
              )}

              {/* Dual Currency Selector & Amount Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700">
                    {lang === 'kh' ? 'ចំនួនទឹកប្រាក់ដែលបានចំណាយ' : 'Expense Amount'}
                  </label>
                  {/* Currency Switcher Pill */}
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setExpCurrency('USD')}
                      className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                        expCurrency === 'USD' 
                          ? 'bg-white text-emerald-700 shadow-2xs font-black' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      💵 $ USD
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpCurrency('KHR')}
                      className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                        expCurrency === 'KHR' 
                          ? 'bg-white text-blue-700 shadow-2xs font-black' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      🇰🇭 ៛ KHR (រៀល)
                    </button>
                  </div>
                </div>

                {expCurrency === 'USD' ? (
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={expAmount || ''}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setExpAmount(val);
                          setExpAmountKhr(Math.round(val * (exchangeRate || 4000)));
                        }}
                        className="w-full pl-8 pr-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-mono font-black text-emerald-900 focus:outline-none focus:bg-white focus:border-emerald-500"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-2 text-xs font-black text-emerald-700">$</span>
                    </div>
                    <span className="text-[10.5px] text-slate-500 mt-1 block font-mono font-medium">
                      ≈ {(Number(expAmount) * (exchangeRate || 4000)).toLocaleString()} ៛ (អត្រា៖ 1$ = {(exchangeRate || 4000).toLocaleString()}៛)
                    </span>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        min="100"
                        step="100"
                        required
                        value={expAmountKhr || ''}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setExpAmountKhr(val);
                          setExpAmount(Number((val / (exchangeRate || 4000)).toFixed(2)));
                        }}
                        className="w-full pl-8 pr-3 py-2 bg-blue-50/50 border border-blue-300 rounded-xl text-xs font-mono font-black text-blue-900 focus:outline-none focus:bg-white focus:border-blue-500"
                        placeholder="ឧ. 40000"
                      />
                      <span className="absolute left-3 top-2 text-xs font-black text-blue-700">៛</span>
                    </div>
                    <span className="text-[10.5px] text-slate-500 mt-1 block font-mono font-medium">
                      ≈ ${(Number(expAmountKhr) / (exchangeRate || 4000)).toFixed(2)} USD (អត្រា៖ 1$ = {(exchangeRate || 4000).toLocaleString()}៛)
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'បរិយាយមុខទំនិញ' : 'Description'}</label>
                <input
                  type="text"
                  value={expDesc}
                  onChange={e => setExpDesc(e.target.value)}
                  placeholder={lang === 'kh' ? 'ឧទាហរណ៍៖ ទិញសាប៊ូ ២ កាន និងថង់ធំ...' : 'e.g. Bought detergent...'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'វិធីសាស្ត្រសងប្រាក់' : 'Repayment Method'}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpRepayMethod('Payroll')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      expRepayMethod === 'Payroll' 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {lang === 'kh' ? 'សងជាមួយប្រាក់ខែ' : 'With Payroll'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpRepayMethod('Separate')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      expRepayMethod === 'Separate' 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {lang === 'kh' ? 'សងដោយឡែក' : 'Separately'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {lang === 'kh' ? 'បោះបង់' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  {lang === 'kh' ? 'រក្សាទុក' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD SALARY ADVANCE */}
      {showAdvanceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <ArrowDownLeft className="text-rose-600" size={18} />
                  {lang === 'kh' ? 'កត់ត្រាបើកប្រាក់មុន' : 'Salary Advance'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'kh' ? 'នឹងកាត់ចេញពីប្រាក់ខែចុងខែ' : 'Deducted from final payroll'}
                </p>
              </div>
              <button onClick={() => setShowAdvanceModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'បុគ្គលិក' : 'Staff'}</label>
                <select
                  value={advStaffId}
                  onChange={e => setAdvStaffId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                >
                  {availableStaff.map(st => (
                    <option key={st.id} value={st.id}>{st.fullName} ({st.position}) - Base: ${st.baseSalary}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-rose-800 block mb-1">{lang === 'kh' ? 'ចំនួនទឹកប្រាក់ ($ USD)' : 'Amount ($)'}</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={advAmount}
                  onChange={e => setAdvAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-mono font-bold text-rose-900 focus:outline-none focus:bg-white focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date'}</label>
                <input
                  type="date"
                  required
                  value={advDate}
                  onChange={e => setAdvDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">{lang === 'kh' ? 'មូលហេតុ' : 'Reason'}</label>
                <input
                  type="text"
                  value={advReason}
                  onChange={e => setAdvReason(e.target.value)}
                  placeholder={lang === 'kh' ? 'ឧទាហរណ៍៖ បើកមុនបុណ្យភ្ជុំបិណ្ឌ...' : 'Reason...'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {lang === 'kh' ? 'បោះបង់' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  {lang === 'kh' ? 'យល់ព្រមបើកមុន' : 'Grant Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: SET EMPLOYEE LEAVE & ABSENT DATES */}
      {leaveModalStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Calendar className="text-amber-600" size={18} />
                  {lang === 'kh' ? 'បញ្ជាក់ការឈប់សម្រាកបុគ្គលិក' : 'Staff Leave & Absent Dates'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {leaveModalStaff.fullName} • {leaveModalStaff.position}
                </p>
              </div>
              <button onClick={() => setLeaveModalStaff(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const datesArr = leaveDatesInput.split(',').map(d => d.trim()).filter(Boolean);
              saveAdjustment(leaveModalStaff.id, {
                leaveDays: leaveDaysInput,
                leaveDates: datesArr,
                deduction: leaveDaysInput * 6
              });
              showBanner('success', lang === 'kh' ? `បានកត់ត្រាថ្ងៃឈប់សម្រាកជូន ${leaveModalStaff.fullName} រួចរាល់!` : `Saved leave dates for ${leaveModalStaff.fullName}!`);
              setLeaveModalStaff(null);
            }} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {lang === 'kh' ? 'ចំនួនថ្ងៃ/វេនឈប់សម្រាក' : 'Days Absent'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="31"
                  required
                  value={leaveDaysInput}
                  onChange={e => setLeaveDaysInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-amber-800 block mb-1">
                  {lang === 'kh' ? 'កាលបរិច្ឆេទឈប់ជាក់ស្តែង (ឧ. 01/09, 03/09)' : 'Leave Dates (e.g. 01/09, 03/09)'}
                </label>
                <input
                  type="text"
                  value={leaveDatesInput}
                  onChange={e => setLeaveDatesInput(e.target.value)}
                  placeholder={lang === 'kh' ? 'ឧទាហរណ៍៖ 01/09, 03/09...' : 'e.g. 01/09, 03/09...'}
                  className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {lang === 'kh' ? '* បំបែកដោយសញ្ញាក្បៀស (,) ប្រសិនបើមានច្រើនថ្ងៃ' : '* Separate by commas (,) for multiple dates'}
                </p>
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200/80 flex items-center justify-between text-xs font-bold text-rose-900">
                <span>{lang === 'kh' ? 'ប្រាក់ត្រូវកាត់ ($6/វេន):' : 'Total Deduction ($6/shift):'}</span>
                <span className="text-sm font-black font-mono text-rose-700">-${leaveDaysInput * 6} ({leaveDaysInput} វេន × $6)</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLeaveModalStaff(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {lang === 'kh' ? 'បោះបង់' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  {lang === 'kh' ? 'រក្សាទុក' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: CONFIRM DELETE SALARY PAYMENT MODAL */}
      {salaryToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {lang === 'kh' ? 'បញ្ជាក់ការលុបកំណត់ត្រាប្រាក់ខែ' : 'Confirm Delete Salary Record'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'kh' ? 'តើអ្នកពិតជាចង់លុបកំណត់ត្រាបើកប្រាក់ខែនេះមែនទេ?' : 'Are you sure you want to delete this payment record?'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs space-y-1.5 text-slate-700">
              <div>បុគ្គលិក: <span className="font-bold text-slate-900">{salaryToDelete.staffName}</span></div>
              <div>កាលបរិច្ឆេទ/ខែ: <span className="font-bold">{salaryToDelete.period}</span></div>
              <div className="text-amber-600 text-[11px] pt-1">
                💡 បន្ទាប់ពីលុប ស្ថានភាពបុគ្គលិកនេះនឹងត្រឡប់ទៅជា <b>« មិនទាន់បើក (Unpaid) »</b> វិញ ដើម្បីឱ្យលោកអ្នកអាចគណនា ឬទូទាត់ឡើងវិញបាន។
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSalaryToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'kh' ? 'បោះបង់' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmDeleteSalary}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>{lang === 'kh' ? 'លុបចេញ' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: PAYSLIP PREVIEW MODAL */}
      <KhmerPayrollPayslipModal
        isOpen={Boolean(selectedPayslipRecord)}
        onClose={() => setSelectedPayslipRecord(null)}
        record={selectedPayslipRecord}
        lang={lang}
      />

    </div>
  );
}

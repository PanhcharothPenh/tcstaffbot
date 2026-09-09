/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Download, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  Briefcase, 
  Coins, 
  ShieldAlert, 
  ArrowUpRight,
  Calculator,
  CalendarDays,
  MapPin,
  User,
  Clock,
  Tag,
  Filter,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  Bookmark,
  Users,
  DollarSign,
  CreditCard,
  Wallet,
  Search,
  Crown,
  BarChart2
} from 'lucide-react';
import { 
  Income, Expense, Salary, Role, Branch, Attendance, InventoryItem, 
  Machine, CoinTransaction, RevenueRecord, GasRecord, DetergentRecord, 
  SoftenerRecord, StockTransaction, Supplier, Debt, DebtPayment, 
  CashDrawer, CashDrawerTransaction, MonthClosing, User as UserType
} from '../types';
import { translations } from '../mockData';
import { formatCurrency, formatDualCurrency, exportToCSV, formatCasesAndPackets } from '../utils';
import Clean24Logo from './Clean24Logo';

interface ReportsViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  incomes: Income[];
  expenses: Expense[];
  salaries: Salary[];
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
  exchangeRate: number;
  currentUser: UserType;
  attendance: Attendance[];
  inventory: InventoryItem[];
  machines: Machine[];
  coinTransactions: CoinTransaction[];
  revenueRecords: RevenueRecord[];
  gasRecords: GasRecord[];
  detergentRecords: DetergentRecord[];
  softenerRecords: SoftenerRecord[];
  stockTransactions: StockTransaction[];
  suppliers: Supplier[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  cashDrawers: CashDrawer[];
  cashDrawerTransactions: CashDrawerTransaction[];
  monthClosings: MonthClosing[];
}

interface PDFTemplate {
  reportKey: string;
  nameEn: string;
  nameKh: string;
  orientation: 'portrait' | 'landscape';
  categoryField: string;
  numericFields: string[];
  signatories: string[];
  brandingColor: string;
  remarksDefault: string;
}

export default function ReportsView({
  currentRole,
  activeBranchId: initialBranchId,
  branches,
  incomes,
  expenses,
  salaries,
  lang,
  onAddLog,
  exchangeRate,
  currentUser,
  attendance,
  inventory,
  machines,
  coinTransactions,
  revenueRecords,
  gasRecords,
  detergentRecords,
  softenerRecords,
  stockTransactions,
  suppliers,
  debts,
  debtPayments,
  cashDrawers,
  cashDrawerTransactions,
  monthClosings
}: ReportsViewProps) {
  const t = translations[lang];

  // 1. Authenticate roles: Lock Staff role from reports
  const isAuthorized = ['Owner', 'Admin', 'Manager'].includes(currentRole);

  // States
  const [selectedReportId, setSelectedReportId] = useState<string>('revenue');
  const [filterBranchId, setFilterBranchId] = useState<string>(initialBranchId === 'all' ? 'all' : initialBranchId);
  const [startDate, setStartDate] = useState<string>('2026-06-01');
  const [endDate, setEndDate] = useState<string>('2026-06-30');
  const [preparedBy, setPreparedBy] = useState<string>(currentUser?.fullName || 'Executive Owner');
  const [checkedBy, setCheckedBy] = useState<string>('Auditing Department');
  const [approvedBy, setApprovedBy] = useState<string>('Owner Executive Board');
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'KHR' | 'DUAL'>('DUAL');
  const [backendTemplates, setBackendTemplates] = useState<Record<string, PDFTemplate>>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [showPreparedBy, setShowPreparedBy] = useState<boolean>(false);
  const [showCheckedBy, setShowCheckedBy] = useState<boolean>(false);
  const [showApprovedBy, setShowApprovedBy] = useState<boolean>(true);

  // Reset pagination on filter or template changes
  useEffect(() => {
    setCurrentPage(0);
  }, [selectedReportId, filterBranchId, startDate, endDate]);

  // Synchronize branch filter when initial active branch shifts
  useEffect(() => {
    if (initialBranchId !== 'all') {
      setFilterBranchId(initialBranchId);
    }
  }, [initialBranchId]);

  // Fetch backend template structures
  useEffect(() => {
    fetch('/api/pdf/templates')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.templates) {
          setBackendTemplates(data.templates);
        }
      })
      .catch(err => {
        console.error("Failed to load backend PDF templates config:", err);
      });
  }, []);

  if (!isAuthorized) {
    return (
      <div className="bg-white border border-rose-100 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-sm" id="security_guard_notice">
        <ShieldAlert className="text-rose-500 mx-auto mb-4" size={54} />
        <h3 className="text-lg font-bold text-slate-800">{lang === 'en' ? "Access Restriction Alert" : "ការព្រមានការកម្រិតសិទ្ធិ"}</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {t.warningRoleLimit || 'Only administrators, supervisors or general managers hold coordinates to review administrative balancing ledgers.'}
        </p>
        <div className="mt-5 p-3.5 bg-slate-50 rounded-xl text-slate-400 font-mono text-xs">
          STRICT_DATA_SEPARATION_ENFORCED // role_required: Manager+ // user_role: {currentRole}
        </div>
      </div>
    );
  }

  // 14 Reports Index Definitions
  const REPORTS_LIST = [
    { id: 'revenue', name: 'Revenue Report', khName: 'របាយការណ៍ចំណូលលម្អិត', icon: '💰', o: 'portrait' },
    { id: 'expense', name: 'Expense Report', khName: 'របាយការណ៍លម្អិតការចំណាយ', icon: '🛒', o: 'portrait' },
    { id: 'pnl', name: 'Profit & Loss Report', khName: 'របាយការណ៍ចំណេញ-ខាតប្រតិបត្តិការ', icon: '📈', o: 'portrait' },
    { id: 'salary', name: 'Salary Report', khName: 'របាយការណ៍បៀវត្សនិងប្រាក់បុរេប្រទាន', icon: '💼', o: 'portrait' },
    { id: 'attendance', name: 'Attendance Report', khName: 'របាយការណ៍វត្តមាននិងពេលវេលាការងារ', icon: '📅', o: 'portrait' },
    { id: 'inventory', name: 'Inventory Report', khName: 'របាយការណ៍តំលៃនិងកម្រិតទំនិញស្តុក', icon: '📦', o: 'landscape' },
    { id: 'coin', name: 'Coin Report', khName: 'របាយការណ៍បម្លែងកាក់បោកគក់', icon: '🪙', o: 'portrait' },
    { id: 'gas', name: 'Gas Report', khName: 'របាយការណ៍ស្តុកនិងចំណាយហ្គាស LPG', icon: '🔥', o: 'portrait' },
    { id: 'detergent', name: 'Detergent Report', khName: 'របាយការណ៍សាប៊ូទឹកកំហាប់បាញ់ម៉ាស៊ីន', icon: '🧴', o: 'portrait' },
    { id: 'softener', name: 'Softener Report', khName: 'របាយការណ៍ទឹកក្រអូបថែរក្សាសរសៃក្រណាត់', icon: '🌸', o: 'portrait' },
    { id: 'machine', name: 'Machine Report', khName: 'របាយការណ៍គ្រឿងម៉ាស៊ីននិងការប្រើប្រាស់', icon: '⚙️', o: 'landscape' },
    { id: 'cashdrawer', name: 'Cash Drawer Report', khName: 'របាយការណ៍ផ្ទៀងផ្ទាត់ថតលុយប្រចាំវេន', icon: '🏦', o: 'portrait' },
    { id: 'monthclosing', name: 'Month-End Closing Report', khName: 'របាយការណ៍បិទបញ្ជីរដ្ឋបាលប្រចាំខែ', icon: '🔐', o: 'portrait' },
    { id: 'comparison', name: 'Branch Comparison Report', khName: 'របាយការណ៍ប្រៀបធៀបលទ្ធផលគ្រប់សាខា', icon: '📊', o: 'landscape' },
  ];

  const activeTemplate = backendTemplates[selectedReportId] || {
    reportKey: selectedReportId,
    nameEn: 'Operational Administrative Audit Statement',
    nameKh: 'របាយការណ៍លទ្ធផលសវនកម្មរដ្ឋបាល',
    orientation: REPORTS_LIST.find(r => r.id === selectedReportId)?.o as 'portrait' | 'landscape' || 'portrait',
    categoryField: 'status',
    numericFields: [],
    signatories: ['Prepared By Cashier', 'Checked By Supervisor', 'Approved By Owner'],
    brandingColor: 'emerald',
    remarksDefault: 'All local operational figures and balances are synchronized in real-time with internal company databases.'
  };

  const getBranchName = (bId: string) => {
    if (bId === 'all') return 'Consolidated All Branches';
    const b = branches.find(x => x.id === bId);
    return b ? `${b.branchName} (${b.branchCode})` : bId;
  };

  // Safe checks for filtering
  const isInBranch = (branchIdField: string) => {
    if (filterBranchId === 'all') return true;
    return branchIdField === filterBranchId;
  };

  const isInDateRange = (dateField: string) => {
    if (!dateField) return false;
    return dateField >= startDate && dateField <= endDate;
  };

  // CONSTRUCT AND TABULATE DATA FOR REPORT SPECIFICS
  const getCompiledReportData = () => {
    let listRows: any[] = [];
    let summaryCardsData: { label: string; val: string; icon?: string }[] = [];
    let grandTotalDesc = '';
    let categoryBreakdown: Record<string, number> = {};

    switch (selectedReportId) {
      case 'revenue': {
        const filteredIncomes = incomes.filter(i => isInBranch(i.branchId) && isInDateRange(i.date));
        const filteredRevenues = revenueRecords.filter(r => isInBranch(r.branchId) && isInDateRange(r.date));
        
        const washSum = filteredIncomes.reduce((s, c) => s + c.totalAmount, 0);
        const revenueSum = filteredRevenues.reduce((s, c) => s + c.amountUsd, 0);
        const totalRev = washSum + revenueSum;

        // Subtotals by Payment Methods
        const paymentSubtotals: Record<string, number> = {};
        filteredIncomes.forEach(i => {
          paymentSubtotals[i.paymentMethod] = (paymentSubtotals[i.paymentMethod] || 0) + i.totalAmount;
        });
        filteredRevenues.forEach(r => {
          paymentSubtotals[r.paymentMethod] = (paymentSubtotals[r.paymentMethod] || 0) + r.amountUsd;
        });

        // Subtotals by ServiceType
        filteredIncomes.forEach(i => {
          categoryBreakdown[i.serviceType] = (categoryBreakdown[i.serviceType] || 0) + i.totalAmount;
        });

        listRows = [
          ...filteredIncomes.map(i => ({
            ref: `WASH-${i.id.substring(0, 5).toUpperCase()}`,
            date: i.date,
            branch: branches.find(b => b.id === i.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
            desc: `${i.serviceType} (Mach: ${i.machineNumber})`,
            category: i.serviceType,
            qty: i.quantity,
            method: i.paymentMethod,
            amount: i.totalAmount
          })),
          ...filteredRevenues.map(r => ({
            ref: `REV-${r.id.substring(0, 5).toUpperCase()}`,
            date: r.date,
            branch: branches.find(b => b.id === r.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
            desc: r.note || 'Other counter revenue',
            category: 'Other Revenue',
            qty: 1,
            method: r.paymentMethod,
            amount: r.amountUsd
          }))
        ].sort((a, b) => b.date.localeCompare(a.date));

        summaryCardsData = [
          { label: 'Wash Incomes (POS)', val: `$${washSum.toFixed(2)}` },
          { label: 'Manual/Other Receipts', val: `$${revenueSum.toFixed(2)}` },
          { label: 'ABA/Cashless Sum', val: `$${((paymentSubtotals['ABA'] || 0) + (paymentSubtotals['QR Payment'] || 0)).toFixed(2)}` },
          { label: 'Grand Gross revenue', val: `$${totalRev.toFixed(2)}` }
        ];
        break;
      }

      case 'expense': {
        const filteredExpenses = expenses.filter(e => isInBranch(e.branchId) && isInDateRange(e.expenseDate));
        const totalExp = filteredExpenses.reduce((s, c) => s + c.amount, 0);

        filteredExpenses.forEach(e => {
          categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
        });

        listRows = filteredExpenses.map(e => ({
          ref: `EXP-${e.id.substring(0, 5).toUpperCase()}`,
          date: e.expenseDate,
          branch: branches.find(b => b.id === e.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
          desc: e.description,
          category: e.category,
          qty: 1,
          method: e.paymentMethod,
          amount: e.amount
        })).sort((a, b) => b.date.localeCompare(a.date));

        summaryCardsData = [
          { label: 'Total opex Count', val: `${filteredExpenses.length} Records` },
          { label: 'Cash Payments OPEX', val: `$${filteredExpenses.filter(e => e.paymentMethod === 'Cash').reduce((s, c) => s + c.amount, 0).toFixed(2)}` },
          { label: 'ABA QR opex Payouts', val: `$${filteredExpenses.filter(e => e.paymentMethod !== 'Cash').reduce((s, c) => s + c.amount, 0).toFixed(2)}` },
          { label: 'Consolidated OPEX Sum', val: `$${totalExp.toFixed(2)}` }
        ];
        break;
      }

      case 'pnl': {
        // Core Profit and Loss Calculations
        const filteredIncomes = incomes.filter(i => isInBranch(i.branchId) && isInDateRange(i.date));
        const filteredRevenues = revenueRecords.filter(r => isInBranch(r.branchId) && isInDateRange(r.date));
        const filteredExpenses = expenses.filter(e => isInBranch(e.branchId) && isInDateRange(e.expenseDate));
        const filteredSalaries = salaries.filter(s => isInBranch(s.branchId) && s.status === 'Paid'); // Paid Salaries under period
        
        const washSum = filteredIncomes.reduce((s, c) => s + c.totalAmount, 0);
        const otherRevSum = filteredRevenues.reduce((s, c) => s + c.amountUsd, 0);
        const grossIncome = washSum + otherRevSum;

        const opexSum = filteredExpenses.reduce((s, c) => s + c.amount, 0);
        const payrollSum = filteredSalaries.reduce((s, c) => s + c.netSalary, 0);
        const totalExpensesSum = opexSum + payrollSum;

        // Fake straight line mechanics depreciation $120.00 base representation
        const estDepreciation = filterBranchId === 'all' ? branches.length * 150.00 : 150.00;
        const netProfit = grossIncome - totalExpensesSum - estDepreciation;

        listRows = [
          { category: 'A. OPERATING REVENUES', desc: 'Wash Cycles Client Payouts', amount: washSum, type: 'Revenue' },
          { category: 'A. OPERATING REVENUES', desc: 'Counter Snack Supplies & Addons', amount: otherRevSum, type: 'Revenue' },
          { category: 'B. OPERATING EXPENDITURES', desc: 'Administrative Expenditures (OPEX)', amount: opexSum, type: 'Expense' },
          { category: 'B. OPERATING EXPENDITURES', desc: 'Disbursed Monthly Staff Salaries', amount: payrollSum, type: 'Expense' },
          { category: 'C. TECHNICAL DEPRECIATION', desc: 'Amortization & Machine Depreciation Reserves', amount: estDepreciation, type: 'Depreciation' },
        ];

        summaryCardsData = [
          { label: 'Aggregate Revenues', val: `$${grossIncome.toFixed(2)}` },
          { label: 'Aggregate Expenditures', val: `$${totalExpensesSum.toFixed(2)}` },
          { label: 'Depreciation Savings', val: `$${estDepreciation.toFixed(2)}` },
          { label: 'Net Profit Margin', val: `$${netProfit.toFixed(2)}` }
        ];
        break;
      }

      case 'salary': {
        const filteredSal = salaries.filter(s => isInBranch(s.branchId));
        const totalNetPaid = filteredSal.filter(s => s.status === 'Paid').reduce((s, c) => s + c.netSalary, 0);
        const totalUnpaidLiability = filteredSal.filter(s => s.status === 'Unpaid').reduce((s, c) => s + c.netSalary, 0);

        filteredSal.forEach(s => {
          categoryBreakdown[s.status] = (categoryBreakdown[s.status] || 0) + s.netSalary;
        });

        listRows = filteredSal.map(s => ({
          ref: `PAY-${s.id.substring(0, 5).toUpperCase()}`,
          staffName: s.staffName,
          branch: branches.find(b => b.id === s.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
          period: s.salaryPeriod,
          baseSalary: s.baseSalary,
          overtime: s.overtime,
          advances: s.deduction,
          netSalary: s.netSalary,
          status: s.status,
          method: s.paymentMethod
        }));

        summaryCardsData = [
          { label: 'Regular Base Wages', val: `$${filteredSal.reduce((s, c) => s + c.baseSalary, 0).toFixed(2)}` },
          { label: 'Paid Disbursements', val: `$${totalNetPaid.toFixed(2)}` },
          { label: 'Pending Liabilities', val: `$${totalUnpaidLiability.toFixed(2)}` },
          { label: 'Consolidated Payroll Base', val: `$${(totalNetPaid + totalUnpaidLiability).toFixed(2)}` }
        ];
        break;
      }

      case 'attendance': {
        const filteredAtt = attendance.filter(a => isInBranch(a.branchId) && isInDateRange(a.date));
        
        listRows = filteredAtt.map(a => ({
          date: a.date,
          staffName: a.staffName,
          branch: branches.find(b => b.id === a.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
          clockIn: a.checkIn || '--:--',
          clockOut: a.checkOut || '--:--',
          shift: a.shiftType || 'Regular Shift',
          workHours: a.workHours,
          overtime: a.overtimeHours,
          status: a.status
        })).sort((a, b) => b.date.localeCompare(a.date));

        const presentCount = filteredAtt.filter(a => a.status === 'Present').length;
        const absentCount = filteredAtt.filter(a => a.status === 'Absent').length;
        const lateCount = filteredAtt.filter(a => a.status === 'Late').length;

        summaryCardsData = [
          { label: 'Punches Gathered', val: `${filteredAtt.length} Days` },
          { label: 'Attended Days Count', val: `${presentCount} Present` },
          { label: 'Late Punch incidents', val: `${lateCount} Late` },
          { label: 'Absent/No show tallies', val: `${absentCount} Absent` }
        ];
        break;
      }

      case 'inventory': {
        const filteredInv = inventory.filter(i => isInBranch(i.branchId));
        const totalvaluation = filteredInv.reduce((s, c) => s + (c.remainingStock * c.purchasePrice), 0);

        filteredInv.forEach(i => {
          categoryBreakdown[i.category] = (categoryBreakdown[i.category] || 0) + (i.remainingStock * i.purchasePrice);
        });

        listRows = filteredInv.map(i => ({
          id: i.id,
          itemName: i.itemName,
          branch: branches.find(b => b.id === i.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
          category: i.category,
          unit: i.unit,
          stock: i.remainingStock,
          minAlert: i.minimumStockAlert,
          price: i.purchasePrice,
          valuation: i.remainingStock * i.purchasePrice,
          supplier: i.supplier || 'Internal Supply'
        }));

        summaryCardsData = [
          { label: 'Chemical / Soap Stocks', val: `$${(categoryBreakdown['Soap'] || 0).toFixed(2)}` },
          { label: 'Plastic wrap Units', val: `$${(categoryBreakdown['Plastic Bag'] || 0).toFixed(2)}` },
          { label: 'Alert Stock items', val: `${filteredInv.filter(x => x.remainingStock <= x.minimumStockAlert).length} Items` },
          { label: 'Grand Asset Valuation', val: `$${totalvaluation.toFixed(2)}` }
        ];
        break;
      }

      case 'coin': {
        const filteredCoins = coinTransactions.filter(c => isInBranch(c.branchId) && isInDateRange(c.date));
        const coinsIn = filteredCoins.filter(c => c.type === 'In').reduce((s, c) => s + c.amount, 0);
        const coinsOut = filteredCoins.filter(c => c.type === 'Out').reduce((s, c) => s + c.amount, 0);
        const coinBalance = coinsIn - coinsOut;

        listRows = filteredCoins.map(c => ({
          ref: `COIN-${c.id?.substring(0, 5).toUpperCase() || 'TX'}`,
          date: c.date,
          branch: branches.find(b => b.id === c.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
          type: c.type,
          coins: c.amount,
          valUsd: c.valueUsd,
          valKhr: Math.round(c.valueUsd * exchangeRate),
          operator: c.createdBy || 'Staff Shift',
          note: c.note || 'Default Register conversion'
        })).sort((a, b) => b.date.localeCompare(a.date));

        summaryCardsData = [
          { label: 'Dispelled Gold Coins (In)', val: `${coinsIn} Coins` },
          { label: 'Refunded/Exchanged (Out)', val: `${coinsOut} Coins` },
          { label: 'Present Cash Safe Coins', val: `${coinBalance} Coins` },
          { label: 'Capital Safe Equivalency', val: `$${(coinBalance * 1.0).toFixed(2)}` }
        ];
        break;
      }

      case 'gas': {
        const filteredGas = gasRecords.filter(g => isInBranch(g.branchId) && isInDateRange(g.date));
        const refillsCost = filteredGas.filter(g => g.type === 'Refill').reduce((s, c) => s + c.cost, 0);

        listRows = filteredGas.map(g => ({
          date: g.date,
          branch: branches.find(b => b.id === g.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
          supplier: 'Gas Supply Co.',
          qty: g.remainingKg,
          price: g.cost / (g.tankCount || 1),
          total: g.cost,
          type: g.type,
          tanks: g.tankCount,
          weight: g.remainingKg,
          cost: g.cost,
          operator: g.createdBy,
          note: g.note
        })).sort((a, b) => b.date.localeCompare(a.date));

        summaryCardsData = [
          { label: 'Gas Refills Performed', val: `${filteredGas.filter(s => s.type === 'Refill').length} Times` },
          { label: 'Dryer cylinder counts', val: `${filteredGas.filter(s => s.type === 'Use').length} Usages` },
          { label: 'Opex refueling bills', val: `$${refillsCost.toFixed(2)}` },
          { label: 'Consolidated reserves', val: `${filteredGas[0]?.remainingKg || 45} Kg Left` }
        ];
        break;
      }

      case 'detergent': {
        const filteredDet = detergentRecords.filter(d => isInBranch(d.branchId) && isInDateRange(d.date));
        const spend = filteredDet.filter(d => d.type === 'Refill').reduce((s, c) => s + c.cost, 0);

        listRows = filteredDet.map(d => ({
          label: d.date,
          branch: branches.find(b => b.id === d.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
          inQty: d.inQty || (d.type === 'Refill' ? d.quantityLiters : 0),
          soapOut: d.soap || (d.type === 'Use' ? d.quantityLiters : 0),
          powderOut: d.powder || 0,
          cleanerOut: d.cleaner || 0,
          total: d.total || (d.type === 'Use' ? d.quantityLiters : 0),
          date: d.date,
          type: d.type,
          liters: d.quantityLiters,
          remaining: d.remainingLiters,
          cost: d.cost,
          operator: d.createdBy,
          note: d.note
        })).sort((a, b) => b.date.localeCompare(a.date));

        summaryCardsData = [
          { label: 'Packets/Cases Refills', val: `${filteredDet.filter(s => s.type === 'Refill').length} Cycles` },
          { label: 'Packets/Cases Usages', val: `${filteredDet.filter(s => s.type === 'Use').length} Dispenses` },
          { label: 'Detergent Procurement Cost', val: `$${spend.toFixed(2)}` },
          { label: 'Active reserve level', val: formatCasesAndPackets(filteredDet[0]?.remainingLiters || 48, lang) }
        ];
        break;
      }

      case 'softener': {
        const filteredSoft = softenerRecords.filter(s => isInBranch(s.branchId) && isInDateRange(s.date));
        const spend = filteredSoft.filter(s => s.type === 'Refill').reduce((s, c) => s + c.cost, 0);

        listRows = filteredSoft.map(s => ({
          label: s.date,
          branch: branches.find(b => b.id === s.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
          inQty: s.inQty || (s.type === 'Refill' ? s.quantityLiters : 0),
          outQty: s.outQty || (s.type === 'Use' ? s.quantityLiters : 0),
          total: s.total || (s.type === 'Use' ? s.quantityLiters : 0),
          date: s.date,
          type: s.type,
          liters: s.quantityLiters,
          remaining: s.remainingLiters,
          cost: s.cost,
          operator: s.createdBy,
          note: s.note
        })).sort((a, b) => b.date.localeCompare(a.date));

        summaryCardsData = [
          { label: 'Fragrance refill count', val: `${filteredSoft.filter(s => s.type === 'Refill').length} Refills` },
          { label: 'Dispenser usage ticks', val: `${filteredSoft.filter(s => s.type === 'Use').length} Usages` },
          { label: 'Softeners spend OPEX', val: `$${spend.toFixed(2)}` },
          { label: 'Remaining stock (Storage)', val: formatCasesAndPackets(filteredSoft[0]?.remainingLiters || 48, lang) }
        ];
        break;
      }

      case 'machine': {
        const filteredMachines = machines.filter(m => isInBranch(m.branchId));
        const totalMachineVal = filteredMachines.length * 2800.00; // Standard $2800.00 base washer asset value

        listRows = filteredMachines.map(m => ({
          tag: m.machineNumber || m.machineId.substring(0, 5).toUpperCase(),
          model: `${m.brand} ${m.capacity}kg (${m.machineType})`,
          branch: branches.find(b => b.id === m.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
          runs: Math.round((m.revenue || 0) / 1.5),
          status: m.status === 'Available' ? 'Running' : 'Maintenance',
          lastService: '2026-06-01',
          code: m.machineId,
          number: m.machineNumber,
          type: m.machineType,
          brand: m.brand,
          capacity: m.capacity,
          liferev: m.revenue
        }));

        summaryCardsData = [
          { label: 'Dryers count', val: `${filteredMachines.filter(s => s.machineType === 'Dryer').length} Units` },
          { label: 'Washers count', val: `${filteredMachines.filter(s => s.machineType === 'Washer').length} Units` },
          { label: 'Broken / Maintenance', val: `${filteredMachines.filter(s => s.status !== 'Available').length} Units` },
          { label: 'Fixed assets value', val: `$${totalMachineVal.toFixed(2)}` }
        ];
        break;
      }

      case 'cashdrawer': {
        const filteredDrawers = cashDrawers.filter(d => isInBranch(d.branchId) && isInDateRange(d.createdAt));

        listRows = filteredDrawers.map(d => ({
          date: d.openedAt.split(' ')[0],
          branch: branches.find(b => b.id === d.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
          staffName: d.closedBy || d.openedBy || 'Shift Operator',
          expected: d.endingCash || d.startingCash || 0,
          actual: d.actualCash || 0,
          shortage: d.difference < 0 ? Math.abs(d.difference) : 0,
          approved: d.reconciled ? 'Audited & Approved' : 'Pending Review',
          openedBy: d.openedBy,
          closedBy: d.closedBy,
          openedAt: d.openedAt,
          closedAt: d.closedAt,
          starting: d.startingCash,
          ending: d.endingCash,
          diff: d.difference,
          status: d.status,
          reconciled: d.reconciled ? 'Reconciled 🟢' : 'Pending 🔴'
        }));

        summaryCardsData = [
          { label: 'Shifts registers closed', val: `${filteredDrawers.length} Draws` },
          { label: 'Aggregate excess ledger', val: `$${filteredDrawers.filter(s => s.difference > 0).reduce((s, c) => s + c.difference, 0).toFixed(2)}` },
          { label: 'Aggregate short deficits', val: `$${filteredDrawers.filter(s => s.difference < 0).reduce((s, c) => s + c.difference, 0).toFixed(2)}` },
          { label: 'Drawer status overview', val: filteredDrawers.some(s => !s.reconciled) ? 'Attention Required' : 'Ready Clean' }
        ];
        break;
      }

      case 'monthclosing': {
        const filteredClosings = monthClosings.filter(m => isInBranch(m.branchId) && m.createdAt >= startDate);

        listRows = filteredClosings.map(m => ({
          month: m.month,
          branch: branches.find(b => b.id === m.branchId)?.branchName || (branches[0]?.branchName || 'Veng Sreng'),
          revenue: m.totalRevenue,
          expense: m.totalExpenses,
          savedDep: m.depreciationSavings,
          net: m.netIncome,
          locked: m.status,
          by: m.closedBy
        }));

        summaryCardsData = [
          { label: 'Audit status lock', val: `${filteredClosings.filter(s => s.status === 'Locked').length} Locked` },
          { label: 'Revenues locked sum', val: `$${filteredClosings.reduce((s, c) => s + c.totalRevenue, 0).toFixed(2)}` },
          { label: 'Monthly net index', val: `$${filteredClosings.reduce((s, c) => s + c.netIncome, 0).toFixed(2)}` },
          { label: 'Action state', val: filteredClosings.some(x => x.status === 'Draft') ? 'Actions Pending' : 'Fully Locked' }
        ];
        break;
      }

      case 'comparison': {
        // Core Branch Multi-Unit comparisons
        listRows = branches.map(b => {
          const bIncomes = incomes.filter(i => i.branchId === b.id && isInDateRange(i.date));
          const bRevenues = revenueRecords.filter(r => r.branchId === b.id && isInDateRange(r.date));
          const bExpenses = expenses.filter(e => e.branchId === b.id && isInDateRange(e.expenseDate));
          const bSalaries = salaries.filter(s => s.branchId === b.id && s.status === 'Paid');

          const rev = bIncomes.reduce((s, c) => s + c.totalAmount, 0) + bRevenues.reduce((s, c) => s + c.amountUsd, 0);
          const exp = bExpenses.reduce((s, c) => s + c.amount, 0) + bSalaries.reduce((s, c) => s + c.netSalary, 0);
          const machCount = machines.filter(m => m.branchId === b.id).length;

          return {
            id: b.id,
            branchCode: b.branchCode,
            branchName: b.branchName,
            manager: b.managerName || 'Assigned Officer',
            machines: machCount,
            totalRevenue: rev,
            totalOpex: exp,
            netProfit: rev - exp
          };
        });

        const totalCompanyRev = listRows.reduce((s, c) => s + c.totalRevenue, 0);

        summaryCardsData = [
          { label: 'Operational Outlets', val: `${branches.length} Storefronts` },
          { label: 'Combined revenue', val: `$${totalCompanyRev.toFixed(2)}` },
          { label: 'Combined exp spend', val: `$${listRows.reduce((s, c) => s + c.totalOpex, 0).toFixed(2)}` },
          { label: 'Combined company profit', val: `$${listRows.reduce((s, c) => s + c.netProfit, 0).toFixed(2)}` }
        ];
        break;
      }
    }

    return { listRows, summaryCardsData, categoryBreakdown };
  };

  const { listRows, summaryCardsData } = getCompiledReportData();

  const itemsPerPage = 15;
  const totalPages = Math.ceil(listRows.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const paginatedRows = listRows.slice(startIndex, startIndex + itemsPerPage);

  // HIGH DENSITY EXPORT TRIGGER USING HTML2CANVAS & JSPDF (COMPLIANT FULL-STACK EXPORT SERVICE)
  const triggerExportToPDFFile = async () => {
    setIsExporting(true);
    onAddLog(`Starting corporate high-resolution PDF draft compilation for: ${activeTemplate.nameEn}`);
    
    // Call server audit endpoints to track administrative logs before downloading
    try {
      const summaryString = summaryCardsData.map(c => `${c.label}: ${c.val}`).join(' | ');
      await fetch('/api/pdf/audit-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: selectedReportId,
          branchName: getBranchName(filterBranchId),
          dateFilter: `${startDate} to ${endDate}`,
          generatedByUser: `${currentUser?.fullName || preparedBy} (${currentRole})`,
          totalsSummary: summaryString
        })
      });
      onAddLog(`Server tracked PDF generate audit successfully.`);
    } catch (e) {
      console.warn("Could not log PDF audit to server:", e);
    }

    // Capture the target viewport A4 report canvas element
    const element = document.getElementById('report_printable_a4_canvas');
    if (!element) {
      alert("Printable draft template element was not loaded inside preview pane!");
      setIsExporting(false);
      return;
    }

    // Force style rules during capturing to ensure pure white paper aesthetic
    const originalShadow = element.style.boxShadow;
    element.style.boxShadow = 'none';

    const originalGetComputedStyle = window.getComputedStyle;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

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
        } catch (e) {
          return 'rgb(0,0,0)';
        }
      };

      const replaceColorsWithRgb = (str: string): string => {
        if (!str || typeof str !== 'string') {
          return str;
        }
        if (!str.includes('oklch') && !str.includes('oklab')) {
          return str;
        }
        return str.replace(/(oklch|oklab)\([^)]+\)/g, (match) => {
          return anyColorToRgb(match);
        });
      };

      // Wrap getComputedStyle dynamically during the html2canvas DOM traversal
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
        scale: 2.2, // Generates high DPI clarity suitable for printing
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          try {
            const walker = clonedDoc.createTreeWalker(clonedDoc.body, 4 /* NodeFilter.SHOW_TEXT */);
            let textNode;
            while ((textNode = walker.nextNode())) {
              if (textNode.nodeValue) {
                textNode.nodeValue = textNode.nodeValue.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|❖/gu, '');
              }
            }
          } catch (e) {}

          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * { font-family: "MiSansKhmer", sans-serif !important; }
          `;
          clonedDoc.head.appendChild(style);
        }
      });

      // Restore style resolver
      window.getComputedStyle = originalGetComputedStyle;

      const imgData = canvas.toDataURL('image/png');
      const isPortrait = activeTemplate.orientation === 'portrait';
      
      const pdf = new jsPDF({
        orientation: activeTemplate.orientation,
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = isPortrait ? 210 : 297;
      const pdfHeight = isPortrait ? 297 : 210;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`TC_Staff_Official_${selectedReportId.toUpperCase()}_v1_${startDate}_${endDate}.pdf`);

      onAddLog(`Tied with iText-equivalent high-fidelity PDF compile. Saved TC_Staff_Official_${selectedReportId.toUpperCase()}.pdf successfully.`);
    } catch (error: any) {
      window.getComputedStyle = originalGetComputedStyle;
      console.error("PDF Generate failure:", error);
      alert("Failed generating professional PDF file correctly: " + error.message);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      element.style.boxShadow = originalShadow;
      setIsExporting(false);
    }
  };

  // CSV direct backing fallback
  const triggerCSVExport = () => {
    if (listRows.length === 0) {
      alert("No data rows available to compile spreadsheet excel export!");
      return;
    }
    const headers = Object.keys(listRows[0]);
    const dataset = listRows.map(row => headers.map(h => row[h]));
    exportToCSV(`TC_Staff_${selectedReportId}_export_ledger`, headers, dataset);
    onAddLog(`Issued complete client-side administrative CSV spreadsheet dump for ${selectedReportId}`);
  };

  // Dual Currency Helper
  const displayVal = (usdVal: number) => {
    const isNegative = usdVal < 0;
    const absUsd = Math.abs(usdVal);
    const khrVal = Math.round(absUsd * exchangeRate);
    const formattedKhr = new Intl.NumberFormat('kh-KH').format(khrVal);
    
    if (currencyMode === 'USD') {
      return (
        <span className={isNegative ? "text-red-600 font-bold" : "text-teal-600 font-extrabold"}>
          {isNegative ? '-' : ''}${absUsd.toFixed(2)}
        </span>
      );
    } else if (currencyMode === 'KHR') {
      return (
        <span className={isNegative ? "text-red-700 font-semibold" : "text-slate-700 font-bold"}>
          {isNegative ? '-' : ''}{formattedKhr} ៛
        </span>
      );
    } else {
      // DUAL
      return (
        <span className="font-mono text-[9.5px]">
          <span className={isNegative ? "text-red-600 font-extrabold" : "text-teal-600 font-extrabold"}>
            {isNegative ? '-' : ''}${absUsd.toFixed(2)}
          </span>
          <span className="text-slate-400 font-normal mx-1">/</span>
          <span className={isNegative ? "text-red-700 font-medium" : "text-slate-600 font-semibold"}>
            {isNegative ? '-' : ''}{formattedKhr} ៛
          </span>
        </span>
      );
    }
  };

  // Helper for summary card icons
  const getCardIcon = (label: string, index: number) => {
    const iconClass = "w-4 h-4 text-white";
    const lbl = label.toLowerCase();
    if (lbl.includes('wash') || lbl.includes('revenue') || lbl.includes('gross') || lbl.includes('incoming')) {
      if (index === 3) return <BarChart2 className={iconClass} />;
      return <DollarSign className={iconClass} />;
    }
    if (lbl.includes('manual') || lbl.includes('receipt') || lbl.includes('voucher') || lbl.includes('payment') || lbl.includes('payout')) {
      return <FileText className={iconClass} />;
    }
    if (lbl.includes('aba') || lbl.includes('cashless') || lbl.includes('card') || lbl.includes('wallet')) {
      return <CreditCard className={iconClass} />;
    }
    // Fallback index themes
    if (index === 0) return <DollarSign className={iconClass} />;
    if (index === 1) return <FileText className={iconClass} />;
    if (index === 2) return <CreditCard className={iconClass} />;
    return <BarChart2 className={iconClass} />;
  };

  // Helper for payment method badges
  const getPaymentMethodBadge = (method: string) => {
    if (method === 'ABA') {
      return (
        <span className="px-2.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-[9px] font-extrabold uppercase tracking-wide text-center inline-block">
          ABA
        </span>
      );
    }
    if (method === 'Cash') {
      return (
        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[9px] font-extrabold uppercase tracking-wide text-center inline-block">
          Cash
        </span>
      );
    }
    if (method === 'QR Payment' || method === 'QR Code' || method === 'Cashless') {
      return (
        <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-[9px] font-extrabold uppercase tracking-wide text-center inline-block">
          QR Payment
        </span>
      );
    }
    if (method === 'Bank Transfer') {
      return (
        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[9px] font-extrabold uppercase tracking-wide text-center inline-block">
          Bank Transfer
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-[9px] font-bold text-center inline-block">
        {method}
      </span>
    );
  };

  return (
    <div className="space-y-6" id="reports_analytic_view">
      
      {/* Export Action Bar */}
      <div className="flex flex-wrap justify-end items-center gap-2">
        <button
          onClick={triggerCSVExport}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
        >
          <FileSpreadsheet size={14} className="text-emerald-400" />
          {lang === 'kh' ? 'ទាញយក CSV' : 'Dump CSV'}
        </button>
        
        <button
          onClick={triggerExportToPDFFile}
          disabled={isExporting}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-900/20 cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-all"
        >
          {isExporting ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {lang === 'kh' ? 'កំពុងចងក្រង...' : 'Compiling...'}
            </>
          ) : (
            <>
              <Download size={14} />
              {lang === 'kh' ? 'នាំចេញរបាយការណ៍ PDF ផ្លូវការ' : 'Export Official PDF Report'}
            </>
          )}
        </button>
      </div>

      {/* Main Grid Content Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Side: Report selector and filters deck (4 Units) */}
        <div className="xl:col-span-4 space-y-5" id="reports_control_deck">
          
          {/* Group 1: 14 Selectable Reports deck Card */}
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xs p-5">
            <h4 className="text-slate-800 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Bookmark size={14} className="text-indigo-600" />
              {lang === 'kh' ? `១. ជ្រើសរើសទម្រង់របាយការណ៍ (${REPORTS_LIST.length})` : `1. Choose Report Template (${REPORTS_LIST.length})`}
            </h4>
            
            <div className="mt-3.5 space-y-1 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
              {REPORTS_LIST.map((rep) => {
                const isActive = selectedReportId === rep.id;
                return (
                  <button
                    key={rep.id}
                    onClick={() => {
                      setSelectedReportId(rep.id);
                      onAddLog(`Selected report template context: ${rep.name}`);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center justify-between group cursor-pointer
                      ${isActive 
                        ? 'bg-indigo-600 font-bold text-white shadow-md shadow-indigo-100' 
                        : 'hover:bg-slate-50 text-slate-600 font-medium'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm">{rep.icon}</span>
                      <div className="truncate">
                        <span className="block">{rep.name}</span>
                        <span className={`text-[9px] block mt-0.5 leading-none
                          ${isActive ? 'text-indigo-100 font-normal' : 'text-slate-400 group-hover:text-slate-500'}
                        `}>
                          {rep.khName}
                        </span>
                      </div>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group 2: Filter Parameters Deck Card */}
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xs p-5 space-y-4">
            <h4 className="text-slate-800 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Filter size={14} className="text-indigo-600" />
              {lang === 'kh' ? '២. លក្ខខណ្ឌតម្រង និងរូបិយប័ណ្ណ' : '2. Filter Parameters & Currency'}
            </h4>

            {/* Scope selectors */}
            <div className="space-y-3 text-xs">
              
              {/* Branch select */}
              <div>
                <label className="text-slate-500 block font-bold mb-1">{lang === 'kh' ? 'ជ្រើសរើសសាខា' : 'Branch Focus Outlet'}</label>
                <select
                  value={filterBranchId}
                  onChange={(e) => setFilterBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">{lang === 'kh' ? 'បូកសរុបគ្រប់សាខា' : 'Consolidated All Branches'}</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName} ({b.branchCode})</option>
                  ))}
                </select>
              </div>

              {/* Date Filters */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-500 block font-bold mb-1">{lang === 'kh' ? 'ថ្ងៃចាប់ផ្តើម' : 'Start Date'}</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold text-xs text-center"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block font-bold mb-1">{lang === 'kh' ? 'ថ្ងៃបញ្ចប់' : 'End Date'}</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold text-xs text-center"
                  />
                </div>
              </div>

              {/* Dual currency toggler */}
              <div>
                <label className="text-slate-500 block font-bold mb-1">{lang === 'kh' ? 'ការបង្ហាញរូបិយប័ណ្ណពន្ធ' : 'Tax Currency Representation'}</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 border border-slate-200 rounded-xl">
                  {['USD', 'KHR', 'DUAL'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setCurrencyMode(mode as any)}
                      className={`py-1.5 font-bold rounded-lg text-[10px] text-center cursor-pointer transition-all
                        ${currencyMode === mode
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-500 hover:text-slate-700'
                        }
                      `}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Group 3: Corporate Signatories Inputs Layout Card */}
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xs p-5 space-y-4">
            <h4 className="text-slate-800 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Users size={14} className="text-indigo-600" />
              {lang === 'kh' ? '៣. ហត្ថលេខីរបាយការណ៍' : '3. Report Signatories'}
            </h4>

            <div className="space-y-3.5 text-xs">
              {/* Toggle Prepared By */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPreparedBy}
                    onChange={(e) => setShowPreparedBy(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>{lang === 'kh' ? 'បង្ហាញអ្នករៀបចំ' : 'Show Prepared By'}</span>
                </label>
                {showPreparedBy && (
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    placeholder={lang === 'kh' ? 'បញ្ចូលឈ្មោះ...' : 'Enter name...'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold text-xs transition-all"
                  />
                )}
              </div>

              {/* Toggle Checked By */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCheckedBy}
                    onChange={(e) => setShowCheckedBy(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>{lang === 'kh' ? 'បង្ហាញអ្នកត្រួតពិនិត្យ' : 'Show Checked By'}</span>
                </label>
                {showCheckedBy && (
                  <input
                    type="text"
                    value={checkedBy}
                    onChange={(e) => setCheckedBy(e.target.value)}
                    placeholder={lang === 'kh' ? 'បញ្ចូលនាយកដ្ឋាន ឬឈ្មោះ...' : 'Enter department or name...'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold text-xs transition-all"
                  />
                )}
              </div>

              {/* Toggle Approved By */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showApprovedBy}
                    onChange={(e) => setShowApprovedBy(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>{lang === 'kh' ? 'បង្ហាញអ្នកអនុម័ត (ម្ចាស់)' : 'Show Approved By (Owner)'}</span>
                </label>
                {showApprovedBy && (
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    placeholder={lang === 'kh' ? 'បញ្ចូលឈ្មោះម្ចាស់...' : 'Enter owner or director...'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold text-xs transition-all"
                  />
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Virtual A4 Document Previewer Canvas (8 Units) */}
        <div className="xl:col-span-8 flex flex-col items-center justify-start bg-slate-100 border border-slate-200 p-6 rounded-3xl overflow-x-auto gap-4">
          
                                                                      {/* Perfect CSS-bounded A4 Canvas wrapper container */}
          <div 
            id="report_printable_a4_canvas"
            className={`bg-white text-slate-800 p-6 flex flex-col justify-between shadow-2xl relative select-none font-sans border border-slate-250 shrink-0
              ${activeTemplate.orientation === 'portrait' 
                ? 'w-[794px] h-[1123px]' 
                : 'w-[1123px] h-[794px]'
              }
            `}
            style={{
              fontFamily: "'MiSansKhmer', sans-serif"
            }}
          >
            {/* Target Area for exact reference replica without double border */}
            <div className="w-full h-full bg-white text-[#111827] relative antialiased p-6 flex flex-col justify-between overflow-hidden">
              
              {/* Header watermarking or corporate badge */}
              <div className="absolute top-2.5 left-4 text-[7px] text-sky-700 tracking-widest font-mono font-bold">
                TC STAFF MANAGEMENT DIGITAL AUDIT SYSTEM v3.45 | LOCALIZATION PRE-SET ACTIVE
              </div>

              {/* MAIN PORTLAND HEADER DECK */}
              <div className="space-y-3.5">
                
                {/* letterhead header */}
                <div className="flex justify-between items-start border-b border-sky-600/35 pb-3">
                  <div className="flex gap-4 items-center">
                    <Clean24Logo className="h-10 cursor-pointer" lightMode={true} />
                    <div className="h-8 w-px bg-slate-300 self-center" />
                    <div>
                      <span className="text-[10px] text-sky-700 font-extrabold tracking-widest block uppercase">Multi-Branch Operations</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Phnom Penh, Kingdom of Cambodia</span>
                    </div>
                  </div>

                  <div className="text-right text-[10px] space-y-1 font-mono">
                    <div className="text-xs font-black text-sky-955 uppercase tracking-wider mb-1.5">{lang === 'en' ? 'Official Corporate Audit' : 'ការវាយតម្លៃសាជីវកម្មផ្លូវការ'}</div>
                    <div className="flex justify-end items-center gap-1">
                      <span className="text-slate-500 inline-block w-28 text-right">{lang === 'en' ? 'Date Range' : 'កាលបរិច្ឆេទ'}</span>
                      <span className="text-slate-400">:</span>
                      <span className="text-slate-900 font-extrabold w-[160px] text-left">{startDate} to {endDate}</span>
                    </div>
                    <div className="flex justify-end items-center gap-1">
                      <span className="text-slate-500 inline-block w-28 text-right">{lang === 'en' ? 'Branch Context' : 'សាខា'}</span>
                      <span className="text-slate-400">:</span>
                      <span className="text-slate-900 font-black w-[160px] text-left">{getBranchName(filterBranchId)}</span>
                    </div>
                    <div className="flex justify-end items-center gap-1">
                      <span className="text-slate-500 inline-block w-28 text-right">{lang === 'en' ? 'Time Issued' : 'ម៉ោងចេញ'}</span>
                      <span className="text-slate-400">:</span>
                      <span className="text-slate-900 font-medium w-[160px] text-left">{new Date().toISOString().replace('T', ' ').substring(0, 16)}</span>
                    </div>
                  </div>
                </div>

                {/* Title Section with Khmer dual headings */}
                <div className="text-center py-2 bg-white border border-slate-200/80 rounded-2xl shadow-3xs">
                  <h2 className="text-lg font-black text-sky-955 tracking-wide uppercase leading-snug">{activeTemplate.nameEn}</h2>
                  <h3 className="text-xs font-semibold text-slate-500 mt-1.5 pl-1 leading-snug" style={{ fontFamily: "'MiSansKhmer', sans-serif" }}>
                    {activeTemplate.nameKh}
                  </h3>
                </div>

                {/* Sub-block summary cards widgets */}
                <div className="grid grid-cols-4 gap-3 pt-1">
                  {summaryCardsData.map((card, i) => {
                    // Determine color theme based on index
                    const themes = [
                      { bg: 'bg-teal-50/30 border-teal-100/70', iconBg: 'bg-teal-600', textCol: 'text-teal-600' },
                      { bg: 'bg-sky-50/30 border-sky-100/70', iconBg: 'bg-sky-600', textCol: 'text-sky-600' },
                      { bg: 'bg-indigo-50/30 border-indigo-100/70', iconBg: 'bg-indigo-700', textCol: 'text-indigo-700' },
                      { bg: 'bg-teal-50/30 border-teal-100/70', iconBg: 'bg-teal-700', textCol: 'text-teal-700' }
                    ];
                    const theme = themes[i % themes.length];
                    return (
                      <div key={i} className={`flex items-center gap-3 p-2.5 bg-white border ${theme.bg} rounded-2xl shadow-3xs`}>
                        <div className={`p-2 bg-sky-50 text-sky-600 ${theme.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                          {getCardIcon(card.label, i)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block truncate">{card.label}</span>
                          <strong className="text-sm font-sans font-black text-slate-800 tracking-tight block mt-0.5">
                            {card.val}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* main Data Table space */}
                <div className="pt-1.5">
                  <table className="w-full text-left font-sans text-[10px] border-collapse" id="pdf_rendering_data_table">
                    <thead>
                      <tr className="bg-sky-800 text-white border-t border-b border-sky-900 text-[10px]">
                        
                        {/* Revenue headers config */}
                        {selectedReportId === 'revenue' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase truncate max-w-[80px]">Invoice Ref</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Date</th>
                            <th className="py-2 px-2.5 font-bold uppercase truncate max-w-[100px]">Branch</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Description</th>
                            <th className="py-2 px-2.5 font-bold uppercase">P. Method</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Amount USD / KHR</th>
                          </>
                        )}

                        {/* Expense headers config */}
                        {selectedReportId === 'expense' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Voucher Ref</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Date</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Branch</th>
                            <th className="py-2 px-1 font-bold uppercase">Category Item</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Method</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Debit Balance</th>
                          </>
                        )}

                        {/* Profit Loss headers config */}
                        {selectedReportId === 'pnl' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Ledger Classification</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Administrative Segment</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Value (USD)</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Equiv. (KHR)</th>
                          </>
                        )}

                        {/* Salary headers config */}
                        {selectedReportId === 'salary' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Staff Name</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Branch</th>
                            <th className="py-2 px-2 font-bold uppercase">Period</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Base Salary</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Overtime</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Advances</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right font-bold">Net Salary</th>
                          </>
                        )}

                        {/* Attendance headers config */}
                        {selectedReportId === 'attendance' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Employee</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Station</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Date</th>
                            <th className="py-2 px-2.5 font-bold uppercase font-bold">In Time</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Out Time</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Work Hours</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Status</th>
                          </>
                        )}

                        {/* Inventory headers config */}
                        {selectedReportId === 'inventory' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Item Description</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Branch</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Current Stock</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Alert Min</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Purchase Price</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Supplier</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right font-bold">Total Value</th>
                          </>
                        )}

                        {/* Coin headers config */}
                        {selectedReportId === 'coin' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Transaction Ref</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Date</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Branch</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Coins Qty</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Value USD</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right font-bold">Value KHR</th>
                          </>
                        )}

                        {/* Gas headers config */}
                        {selectedReportId === 'gas' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Log Date</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Branch</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Supplier</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Quantity (Kg)</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Unit Price</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right font-bold">Total Cost</th>
                          </>
                        )}

                        {/* Detergent headers config */}
                        {selectedReportId === 'detergent' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Log Date</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Branch</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Refill In</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Soap Out</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Powder Out</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Cleaner Out</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Day Total Out</th>
                          </>
                        )}

                        {/* Softener headers config */}
                        {selectedReportId === 'softener' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Log Date</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Branch</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Refill In</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Softener Out</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Day Total Out</th>
                          </>
                        )}

                        {/* Machine headers config */}
                        {selectedReportId === 'machine' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Machine Tag</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Model/Type</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Branch</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Daily Runs</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Status</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Last Service</th>
                          </>
                        )}

                        {/* Cashdrawer headers config */}
                        {selectedReportId === 'cashdrawer' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Shift Date</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Branch</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Staff Name</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Expected USD</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Actual USD</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right text-red-700">Shortage</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Approval</th>
                          </>
                        )}

                        {/* Monthclosing report config */}
                        {selectedReportId === 'monthclosing' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Closing Month</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Branch Segment</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Wash Revenue</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Opex bills</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Amortization</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right font-bold">Locked Net Pro</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Status</th>
                          </>
                        )}

                        {/* Comparison report config */}
                        {selectedReportId === 'comparison' && (
                          <>
                            <th className="py-2 px-2.5 font-bold uppercase">Store Code</th>
                            <th className="py-2 px-2.5 font-bold uppercase">Branch Label</th>
                            <th className="py-2 px-2.5 font-bold uppercase font-medium">Head Manager</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-center font-bold">Active Machinery</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Revenue index</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right">Expenditures (OPEX)</th>
                            <th className="py-2 px-2.5 font-bold uppercase text-right font-bold">Consolidated Net Profit</th>
                          </>
                        )}

                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 bg-white">
                      
                      {/* Map Row Items based on selections (sliced to paginatedRows for A4 single-page layout) */}

                      {/* REVENUE ROW RENDERING */}
                      {selectedReportId === 'revenue' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="py-1 px-2 font-mono text-cyan-600 font-bold max-w-[80px] underline truncate">{r.ref}</td>
                          <td className="py-1 px-2 text-slate-455 truncate font-mono">{r.date}</td>
                          <td className="py-1 px-2 font-bold text-slate-700 max-w-[100px] truncate">{r.branch}</td>
                          <td className="py-1 px-2 text-slate-500 font-medium">{r.desc}</td>
                          <td className="py-1 px-2 text-[9px] font-bold">{getPaymentMethodBadge(r.method)}</td>
                          <td className="py-1 px-2 font-mono text-slate-900 text-right font-bold">
                            {displayVal(r.amount)}
                          </td>
                        </tr>
                      ))}

                      {/* EXPENSE ROW RENDERING */}
                      {selectedReportId === 'expense' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="py-1 px-2 font-mono text-slate-400 font-bold">{r.ref}</td>
                          <td className="py-1 px-2 text-slate-455 font-mono">{r.date}</td>
                          <td className="py-1 px-2 font-bold text-slate-600">{r.branch}</td>
                          <td className="py-1 px-2 text-slate-555 max-w-[160px] truncate">{r.desc}</td>
                          <td className="py-1 px-2 font-bold text-red-700 text-[10px]"><span className="p-1 bg-red-50 text-red-700 rounded-md border border-red-100">{r.category}</span></td>
                          <td className="py-1 px-2 font-mono text-red-655 text-right font-bold">
                            {displayVal(r.amount)}
                          </td>
                        </tr>
                      ))}

                      {/* PROFIT & LOSS BREAKOUT */}
                      {selectedReportId === 'pnl' && listRows.map((r, i) => (
                        <tr key={i} className={`border-b border-slate-200 hover:bg-slate-50/50
                          ${r.type === 'Revenue' ? 'bg-emerald-50/10' : ''}
                          ${r.type === 'Expense' ? 'bg-rose-50/10' : ''}
                        `}>
                          <td className="py-2 px-2 font-bold text-slate-505 font-mono text-[9px]">{r.category}</td>
                          <td className="py-2 px-2 font-bold text-slate-800">{r.desc}</td>
                          <td className={`py-2 px-2 font-mono text-right font-bold ${r.type === 'Revenue' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {r.type === 'Expense' ? '-' : ''}${r.amount.toFixed(2)}
                          </td>
                          <td className={`py-2 px-2 font-mono text-right font-semibold ${r.type === 'Revenue' ? 'text-slate-700' : 'text-slate-505'}`}>
                            {r.type === 'Expense' ? '-' : ''}{new Intl.NumberFormat('kh-KH').format(Math.round(r.amount * exchangeRate))} ៛
                          </td>
                        </tr>
                      ))}

                      {/* SALARY LEDGER ENTRIES */}
                      {selectedReportId === 'salary' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="py-1 px-2 font-bold text-slate-905 font-sans">{r.staffName}</td>
                          <td className="py-1 px-2 text-slate-555 font-medium">{r.branch}</td>
                          <td className="py-1 px-2 font-mono text-slate-405">{r.period}</td>
                          <td className="py-1 px-2 font-mono text-right text-slate-605">${r.baseSalary.toFixed(2)}</td>
                          <td className="py-1 px-2 font-mono text-right text-emerald-700">+${r.overtime.toFixed(2)}</td>
                          <td className="py-1 px-2 font-mono text-right text-red-605">-${r.advances.toFixed(2)}</td>
                          <td className="py-1 px-2 font-mono text-right font-black text-slate-955">${r.netSalary.toFixed(2)}</td>
                        </tr>
                      ))}

                      {/* ATTENDANCE RECORDS */}
                      {selectedReportId === 'attendance' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="py-1.5 px-2 font-bold text-slate-900 font-sans">{r.staffName}</td>
                          <td className="py-1.5 px-2 text-slate-600">{r.branch}</td>
                          <td className="py-1.5 px-2 font-mono text-slate-500">{r.date}</td>
                          <td className="py-1.5 px-2 font-mono text-emerald-700 font-bold">{r.clockIn}</td>
                          <td className="py-1.5 px-2 font-mono text-rose-700 font-bold">{r.clockOut}</td>
                          <td className="py-1.5 px-2 font-sans text-center font-bold text-slate-900">
                            {r.workHours !== undefined && r.workHours !== null ? (
                              r.workHours === 0 ? '0 ម៉ោង' :
                              r.workHours < 1 ? `${Math.round(r.workHours * 60)} នាទី` :
                              Number.isInteger(r.workHours) ? `${r.workHours} ម៉ោង` :
                              `${Math.floor(r.workHours)} ម៉ោង ${Math.round((r.workHours % 1) * 60)} នាទី`
                            ) : '--'}
                          </td>
                          <td className="py-1.5 px-2 text-[9.5px] font-bold">
                            <span className={`px-2 py-0.5 rounded-md border inline-block ${
                              r.status === 'Present' || r.status === 'Completed' || r.status === 'On Time' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : r.status === 'Late'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : r.status === 'Absent'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>{r.status === 'Working' ? 'កំពុងធ្វើការ' : r.status === 'Completed' ? 'បានចេញ' : r.status}</span>
                          </td>
                        </tr>
                      ))}

                      {/* INVENTORY LEDGER TABLES */}
                      {selectedReportId === 'inventory' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="py-2 px-2 font-bold text-slate-905 font-sans">{r.itemName}</td>
                          <td className="py-2 px-2 text-slate-505 font-medium">{r.branch}</td>
                          <td className="py-2 px-2 font-mono text-right font-bold text-slate-800">{r.stock} pcs</td>
                          <td className="py-2 px-2 font-mono text-slate-400 text-center">{r.minAlert}</td>
                          <td className="py-2 px-2 font-mono text-right text-slate-600">${r.price.toFixed(2)}</td>
                          <td className="py-2 px-2 text-slate-505 text-[9px] max-w-[90px] truncate">{r.supplier}</td>
                          <td className="py-2 px-2 font-mono text-right font-black text-indigo-955">${r.valuation.toFixed(2)}</td>
                        </tr>
                      ))}

                      {/* COIN TRANSACTIONS */}
                      {selectedReportId === 'coin' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-250 hover:bg-slate-50/50">
                          <td className="py-1 px-2 font-mono text-slate-505 font-bold">{r.ref}</td>
                          <td className="py-1 px-2 text-slate-455 font-mono">{r.date}</td>
                          <td className="py-1 px-2 font-bold text-slate-700">{r.branch}</td>
                          <td className="py-1 px-2 text-center font-mono font-bold text-slate-800">{r.coins}</td>
                          <td className="py-1 px-2 font-mono text-right text-teal-800 font-semibold">${r.valUsd.toFixed(2)}</td>
                          <td className="py-1 px-2 font-mono text-right font-bold text-slate-855">
                            {new Intl.NumberFormat('kh-KH').format(r.valKhr)} ៛
                          </td>
                        </tr>
                      ))}

                      {/* GAS DELIVERIES LOG */}
                      {selectedReportId === 'gas' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="py-1 px-2 text-slate-455 font-mono">{r.date}</td>
                          <td className="py-1 px-2 font-bold text-slate-700">{r.branch}</td>
                          <td className="py-1 px-2 text-slate-500 font-sans">{r.supplier}</td>
                          <td className="py-1 px-2 text-center font-mono font-bold text-slate-900">{r.qty} Kg</td>
                          <td className="py-1 px-2 font-mono text-right text-slate-605">${r.price.toFixed(2)}</td>
                          <td className="py-1 px-2 font-mono text-right font-black text-rose-800">${r.total.toFixed(2)}</td>
                        </tr>
                      ))}

                      {/* DETERGENT LOG */}
                      {selectedReportId === 'detergent' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="py-1 px-2 text-slate-755 font-mono font-bold">{r.label}</td>
                          <td className="py-1 px-2 text-slate-500 font-bold">{r.branch}</td>
                          <td className="py-1 px-2 text-center font-mono text-emerald-800 font-semibold">{r.inQty > 0 ? r.inQty : ''}</td>
                          <td className="py-1 px-2 text-center font-mono text-slate-800">{r.soapOut > 0 ? r.soapOut : ''}</td>
                          <td className="py-1 px-2 text-center font-mono text-slate-800">{r.powderOut > 0 ? r.powderOut : ''}</td>
                          <td className="py-1 px-2 text-center font-mono text-slate-800">{r.cleanerOut > 0 ? r.cleanerOut : ''}</td>
                          <td className="py-1 px-2 text-center font-mono font-black text-rose-800 bg-rose-50/10">{r.total > 0 ? r.total : ''}</td>
                        </tr>
                      ))}

                      {/* SOFTENER LOG */}
                      {selectedReportId === 'softener' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="py-1 px-2 text-slate-755 font-mono font-bold">{r.label}</td>
                          <td className="py-1 px-2 text-slate-505 font-bold">{r.branch}</td>
                          <td className="py-1 px-2 text-center font-mono text-emerald-800 font-semibold">{r.inQty > 0 ? r.inQty : ''}</td>
                          <td className="py-1 px-2 text-center font-mono text-slate-800">{r.outQty > 0 ? r.outQty : ''}</td>
                          <td className="py-1 px-2 text-center font-mono font-black text-rose-800 bg-rose-50/10">{r.total > 0 ? r.total : ''}</td>
                        </tr>
                      ))}

                      {/* MACHINERY AUDIT ITEMS */}
                      {selectedReportId === 'machine' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50 py-2.5">
                          <td className="py-2 px-2 font-mono font-extrabold text-indigo-955">{r.tag}</td>
                          <td className="py-2 px-2 text-slate-700 font-medium font-sans">{r.model}</td>
                          <td className="py-2 px-2 text-slate-550">{r.branch}</td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-slate-800">{r.runs} Runs</td>
                          <td className="py-2 px-2 text-[9px] font-bold">
                            <span className={`p-1 rounded-md border ${
                              r.status === 'Running' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : 'bg-red-50 text-red-700 border-red-100'
                            }`}>{r.status}</span>
                          </td>
                          <td className="py-2 px-2 font-mono text-slate-405">{r.lastService}</td>
                        </tr>
                      ))}

                      {/* CASHDRAWER LOGS */}
                      {selectedReportId === 'cashdrawer' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="py-2 px-2 font-mono text-slate-505">{r.date}</td>
                          <td className="py-2 px-2 font-bold text-slate-800">{r.branch}</td>
                          <td className="py-2 px-2 font-medium text-slate-700 font-sans">{r.staffName}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600">${r.expected.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-850 font-bold">${r.actual.toFixed(2)}</td>
                          <td className={`py-2 px-2 text-right font-mono font-extrabold ${r.shortage > 0 ? 'text-red-700' : 'text-slate-405'}`}>
                            {r.shortage > 0 ? `-$${r.shortage.toFixed(2)}` : '0.00'}
                          </td>
                          <td className="py-2 px-2 text-[9px] font-bold">
                            <span className={`p-1 rounded-md border ${
                              r.approved === 'Audited & Approved' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>{r.approved}</span>
                          </td>
                        </tr>
                      ))}

                      {/* MONTH CLOSINGS REPORT */}
                      {selectedReportId === 'monthclosing' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-2 px-2 font-mono font-bold text-slate-900">{r.month}</td>
                          <td className="py-2 px-2 font-bold text-indigo-900">{r.branch}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600">${r.revenue.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-655">-${r.expense.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-400">-${r.savedDep.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-mono font-black text-slate-900">${r.net.toFixed(2)}</td>
                          <td className="py-2 px-2 text-[9px] font-bold">
                            <span className="p-1 bg-indigo-50 border border-indigo-150 text-indigo-755 rounded-md">
                              {r.locked}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {/* COMPARATIVE MULTI-BRANCH INDEX */}
                      {selectedReportId === 'comparison' && paginatedRows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200 py-3 hover:bg-slate-50/50">
                          <td className="py-2 px-2 font-mono text-slate-550 font-bold">{r.branchCode}</td>
                          <td className="py-2 px-2 font-bold text-slate-900">{r.branchName}</td>
                          <td className="py-2 px-2 font-bold text-indigo-955 truncate max-w-[110px]">{r.manager}</td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-slate-550">{r.machines} Machinery Units</td>
                          <td className="py-2 px-2 text-right font-mono text-emerald-800 font-bold">${r.totalRevenue.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-mono text-rose-850">-${r.totalOpex.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-mono font-black border-l border-slate-200">
                            {displayVal(r.netProfit)}
                          </td>
                        </tr>
                      ))}

                      {/* EMPTY LIST STATE ROW */}
                      {listRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 italic text-xs">
                            No database log items consolidated for this branch scope within selected date parameters.
                          </td>
                        </tr>
                      )}

                      {/* PAGINATION FOOTER PRINT INDICATOR */}
                      {totalPages > 1 && (
                        <tr>
                          <td 
                            colSpan={
                              selectedReportId === 'revenue' ? 6 :
                              selectedReportId === 'expense' ? 6 :
                              selectedReportId === 'pnl' ? 4 :
                              selectedReportId === 'salary' ? 7 :
                              selectedReportId === 'attendance' ? 7 :
                              selectedReportId === 'inventory' ? 7 :
                              selectedReportId === 'coin' ? 6 :
                              selectedReportId === 'gas' ? 6 :
                              selectedReportId === 'detergent' ? 7 :
                              selectedReportId === 'softener' ? 5 :
                              selectedReportId === 'machine' ? 6 :
                              selectedReportId === 'cashdrawer' ? 7 :
                              selectedReportId === 'monthclosing' ? 7 :
                              selectedReportId === 'comparison' ? 7 : 7
                            } 
                            className="py-1 px-3 text-center text-slate-400 font-bold italic text-[8px] bg-slate-50/30 font-mono tracking-tight border-t border-slate-100"
                          >
                            * Showing items {startIndex + 1} - {Math.min(startIndex + itemsPerPage, listRows.length)} of {listRows.length} total entries *
                          </td>
                        </tr>
                      )}

                    </tbody>
                  </table>
                </div>

                {/* Remarks/Default notes info block */}
                <div className="bg-sky-50/20 border border-sky-100/80 p-3.5 rounded-2xl flex items-start gap-4">
                  <div className="p-1.5 bg-teal-600 text-white rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-sky-955 block">General Terms & Declarations</span>
                    <p className="text-[9.5px] leading-relaxed text-slate-655 font-medium italic">
                      {activeTemplate.remarksDefault}
                    </p>
                  </div>
                </div>

              </div>

              {/* LOWER PORTLAND: SIGNATORIES AND STAMP AREA */}
              <div className="space-y-3 pt-1">
                
                {/* Signatures Columns Block - Dynamic Custom Signers with Simple Underscore Lanes */}
                {(showPreparedBy || showCheckedBy || showApprovedBy) && (
                  <div className={`pt-8 border-t border-slate-150 text-[9px]
                    ${(showPreparedBy ? 1 : 0) + (showCheckedBy ? 1 : 0) + (showApprovedBy ? 1 : 0) === 3 ? 'grid grid-cols-3 gap-6 text-center' : ''}
                    ${(showPreparedBy ? 1 : 0) + (showCheckedBy ? 1 : 0) + (showApprovedBy ? 1 : 0) === 2 ? 'grid grid-cols-2 gap-12 max-w-[560px] mx-auto text-center' : ''}
                    ${(showPreparedBy ? 1 : 0) + (showCheckedBy ? 1 : 0) + (showApprovedBy ? 1 : 0) === 1 ? 'flex justify-end' : ''}
                  `}>
                    
                    {showPreparedBy && (
                      <div className={`space-y-1.5 text-center
                        ${(showPreparedBy ? 1 : 0) + (showCheckedBy ? 1 : 0) + (showApprovedBy ? 1 : 0) === 1 ? 'w-[240px]' : ''}
                      `}>
                        <div className="border-b border-slate-350 w-44 mx-auto h-6" />
                        <div className="pt-1.5">
                          <strong className="text-slate-800 block text-[10px] font-black">{preparedBy}</strong>
                          <span className="text-slate-400 block text-[8px] uppercase tracking-wider font-extrabold mt-0.5">Prepared By</span>
                        </div>
                      </div>
                    )}

                    {showCheckedBy && (
                      <div className={`space-y-1.5 text-center
                        ${(showPreparedBy ? 1 : 0) + (showCheckedBy ? 1 : 0) + (showApprovedBy ? 1 : 0) === 1 ? 'w-[240px]' : ''}
                      `}>
                        <div className="border-b border-slate-350 w-44 mx-auto h-6" />
                        <div className="pt-1.5">
                          <strong className="text-slate-800 block text-[10px] font-black">{checkedBy}</strong>
                          <span className="text-slate-400 block text-[8px] uppercase tracking-wider font-extrabold mt-0.5">Checked By</span>
                        </div>
                      </div>
                    )}

                    {showApprovedBy && (
                      <div className={`space-y-1.5 text-center
                        ${(showPreparedBy ? 1 : 0) + (showCheckedBy ? 1 : 0) + (showApprovedBy ? 1 : 0) === 1 ? 'w-[240px]' : ''}
                      `}>
                        <div className="border-b border-slate-350 w-44 mx-auto h-6" />
                        <div className="pt-1.5">
                          <strong className="text-slate-800 block text-[10px] font-black">{approvedBy}</strong>
                          <span className="text-slate-400 block text-[8px] uppercase tracking-wider font-extrabold mt-0.5">Approved By (Owner)</span>
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>

            </div>

          </div>

          </div>
        </div>
      </div>
    );
  }
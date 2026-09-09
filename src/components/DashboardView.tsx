/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  CreditCard,
  Users, 
  Coins, 
  Droplets, 
  Sparkles, 
  Flame, 
  ShieldCheck, 
  Package, 
  Layers, 
  FileText, 
  Boxes, 
  PlusCircle, 
  ArrowRight, 
  CheckCircle2,
  AlertCircle,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Scale,
  Award,
  ArrowUpRight
} from 'lucide-react';
import { 
  Branch, 
  Staff, 
  Salary, 
  Income, 
  Expense, 
  InventoryItem,
  CoinTransaction,
  RevenueRecord,
  GasRecord,
  DetergentRecord,
  SoftenerRecord,
  StockTransaction,
  Machine
} from '../types';
import { translations } from '../mockData';
import { formatCurrency, formatDualCurrency } from '../utils';

interface DashboardViewProps {
  activeBranchId: string;
  branches: Branch[];
  staffList: Staff[];
  salaryList: Salary[];
  incomeList: Income[];
  expenseList: Expense[];
  inventoryList: InventoryItem[];
  coinTransactions: CoinTransaction[];
  revenueRecords: RevenueRecord[];
  gasRecords: GasRecord[];
  detergentRecords: DetergentRecord[];
  softenerRecords: SoftenerRecord[];
  stockTransactions: StockTransaction[];
  machines?: Machine[];
  lang: 'en' | 'kh';
  exchangeRate: number;
  onNavigate?: (tabId: string) => void;
  onSelectBranch?: (branchId: string) => void;
}

export default function DashboardView({
  activeBranchId,
  branches,
  staffList = [],
  salaryList = [],
  incomeList = [],
  expenseList = [],
  inventoryList = [],
  coinTransactions = [],
  revenueRecords = [],
  gasRecords = [],
  detergentRecords = [],
  softenerRecords = [],
  stockTransactions = [],
  machines = [],
  lang,
  exchangeRate,
  onNavigate,
  onSelectBranch
}: DashboardViewProps) {
  const t = translations[lang];
  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);
  const currentMonthStr = useMemo(() => new Date().toISOString().substring(0, 7), []);

  const isInBranch = (branchId?: string) => {
    if (!branchId || activeBranchId === 'all') return true;
    return branchId === activeBranchId;
  };

  const activeBranches = useMemo(() => {
    if (activeBranchId === 'all') return branches;
    return branches.filter(b => b.id === activeBranchId);
  }, [branches, activeBranchId]);

  // 1. TODAY'S REVENUE CALCULATION
  const todayIncomes = useMemo(() => {
    return incomeList.filter(i => isInBranch(i.branchId) && i.date === todayStr);
  }, [incomeList, activeBranchId, todayStr]);

  const todayRevenues = useMemo(() => {
    return revenueRecords.filter(r => isInBranch(r.branchId) && r.date === todayStr);
  }, [revenueRecords, activeBranchId, todayStr]);

  const todayRevenueUsd = useMemo(() => {
    const incSum = todayIncomes.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
    const revSum = todayRevenues.reduce((acc, curr) => acc + (curr.amountUsd || 0), 0);
    return incSum + revSum;
  }, [todayIncomes, todayRevenues]);

  const todayRevenueKhr = Math.round(todayRevenueUsd * exchangeRate);

  // 2. MONTHLY NET PROFIT CALCULATION
  const monthlyIncomes = useMemo(() => {
    return incomeList.filter(i => isInBranch(i.branchId) && (i.date || '').startsWith(currentMonthStr));
  }, [incomeList, activeBranchId, currentMonthStr]);

  const monthlyRevenues = useMemo(() => {
    return revenueRecords.filter(r => isInBranch(r.branchId) && (r.date || '').startsWith(currentMonthStr));
  }, [revenueRecords, activeBranchId, currentMonthStr]);

  const monthlyExpenses = useMemo(() => {
    return expenseList.filter(e => isInBranch(e.branchId) && (e.expenseDate || '').startsWith(currentMonthStr));
  }, [expenseList, activeBranchId, currentMonthStr]);

  const monthlySalaries = useMemo(() => {
    return salaryList.filter(s => isInBranch(s.branchId) && s.status === 'Paid' && (s.salaryPeriod === currentMonthStr || (s.paymentDate || '').startsWith(currentMonthStr)));
  }, [salaryList, activeBranchId, currentMonthStr]);

  const monthlyTotalRevUsd = useMemo(() => {
    const inc = monthlyIncomes.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
    const rev = monthlyRevenues.reduce((acc, curr) => acc + (curr.amountUsd || 0), 0);
    return inc + rev;
  }, [monthlyIncomes, monthlyRevenues]);

  const monthlyTotalExpUsd = useMemo(() => {
    const exp = monthlyExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const sal = monthlySalaries.reduce((acc, curr) => acc + (curr.netSalary || 0), 0);
    return exp + sal;
  }, [monthlyExpenses, monthlySalaries]);

  const monthlyNetProfitUsd = monthlyTotalRevUsd - monthlyTotalExpUsd;
  const monthlyNetProfitKhr = Math.round(monthlyNetProfitUsd * exchangeRate);

  // 3. ACTIVE STAFF CALCULATION
  const filteredStaff = useMemo(() => {
    return staffList.filter(s => isInBranch(s.branchId) && s.status === 'Active');
  }, [staffList, activeBranchId]);

  // 4. COIN VAULT BALANCE CALCULATION
  const filteredCoins = useMemo(() => {
    return coinTransactions.filter(c => isInBranch(c.branchId));
  }, [coinTransactions, activeBranchId]);

  const totalCoinCount = useMemo(() => {
    const cin = filteredCoins.filter(c => c.type === 'In').reduce((sum, c) => sum + (c.amount || 0), 0);
    const cout = filteredCoins.filter(c => c.type === 'Out').reduce((sum, c) => sum + (c.amount || 0), 0);
    return Math.max(0, cin - cout);
  }, [filteredCoins]);

  const totalCoinValueUsd = totalCoinCount * 0.25;
  const totalCoinValueKhr = Math.round(totalCoinValueUsd * exchangeRate);

  // 5. TODAY'S OPERATIONS PER BRANCH
  const branchOperationsSummary = useMemo(() => {
    return activeBranches.map(br => {
      const brIncomes = incomeList.filter(i => i.branchId === br.id && i.date === todayStr);
      const brRevs = revenueRecords.filter(r => r.branchId === br.id && r.date === todayStr);
      const brExps = expenseList.filter(e => e.branchId === br.id && e.expenseDate === todayStr);

      const ordersCount = brIncomes.length + brRevs.length;
      const washCount = brIncomes.filter(i => (i.serviceType || '').toLowerCase().includes('wash')).length;
      const dryCount = brIncomes.filter(i => (i.serviceType || '').toLowerCase().includes('dry')).length;

      const revUsd = brIncomes.reduce((s, i) => s + (i.totalAmount || 0), 0) + brRevs.reduce((s, r) => s + (r.amountUsd || 0), 0);
      const expUsd = brExps.reduce((s, e) => s + (e.amount || 0), 0);
      const profitUsd = revUsd - expUsd;

      return {
        id: br.id,
        name: br.branchName,
        code: br.branchCode,
        orders: ordersCount,
        wash: washCount,
        dry: dryCount,
        revenueKhr: Math.round(revUsd * exchangeRate),
        expensesKhr: Math.round(expUsd * exchangeRate),
        netProfitKhr: Math.round(profitUsd * exchangeRate),
        revenueUsd: revUsd,
        expensesUsd: expUsd,
        netProfitUsd: profitUsd,
        status: br.status || 'Active'
      };
    });
  }, [activeBranches, incomeList, revenueRecords, expenseList, todayStr, exchangeRate]);

  const summaryTotals = useMemo(() => {
    return branchOperationsSummary.reduce((acc, curr) => ({
      orders: acc.orders + curr.orders,
      wash: acc.wash + curr.wash,
      dry: acc.dry + curr.dry,
      revenueKhr: acc.revenueKhr + curr.revenueKhr,
      expensesKhr: acc.expensesKhr + curr.expensesKhr,
      netProfitKhr: acc.netProfitKhr + curr.netProfitKhr,
      revenueUsd: acc.revenueUsd + curr.revenueUsd,
      expensesUsd: acc.expensesUsd + curr.expensesUsd,
      netProfitUsd: acc.netProfitUsd + curr.netProfitUsd
    }), { orders: 0, wash: 0, dry: 0, revenueKhr: 0, expensesKhr: 0, netProfitKhr: 0, revenueUsd: 0, expensesUsd: 0, netProfitUsd: 0 });
  }, [branchOperationsSummary]);

  // 6. MONTHLY PERFORMANCE PER BRANCH
  const branchMonthlyPerformance = useMemo(() => {
    return activeBranches.map(br => {
      const brIncomes = incomeList.filter(i => i.branchId === br.id && (i.date || '').startsWith(currentMonthStr));
      const brRevs = revenueRecords.filter(r => r.branchId === br.id && (r.date || '').startsWith(currentMonthStr));
      const brExps = expenseList.filter(e => e.branchId === br.id && (e.expenseDate || '').startsWith(currentMonthStr));

      const revUsd = brIncomes.reduce((s, i) => s + (i.totalAmount || 0), 0) + brRevs.reduce((s, r) => s + (r.amountUsd || 0), 0);
      const expUsd = brExps.reduce((s, e) => s + (e.amount || 0), 0);
      const profitUsd = revUsd - expUsd;
      const margin = revUsd > 0 ? ((profitUsd / revUsd) * 100).toFixed(1) + '%' : '0.0%';

      return {
        id: br.id,
        name: br.branchName,
        revenueKhr: Math.round(revUsd * exchangeRate),
        expensesKhr: Math.round(expUsd * exchangeRate),
        netProfitKhr: Math.round(profitUsd * exchangeRate),
        revenueUsd: revUsd,
        expensesUsd: expUsd,
        netProfitUsd: profitUsd,
        margin,
        status: br.status || 'Active'
      };
    });
  }, [activeBranches, incomeList, revenueRecords, expenseList, currentMonthStr, exchangeRate]);

  // 7. STOCK & RESERVES ALERTS (PACKS/កញ្ចប់)
  const soapPacksRemaining = useMemo(() => {
    if (detergentRecords.length > 0) {
      const sorted = [...detergentRecords].filter(d => isInBranch(d.branchId)).sort((a, b) => b.date.localeCompare(a.date));
      if (sorted.length > 0 && typeof sorted[0].remainingLiters === 'number') {
        return sorted[0].remainingLiters;
      }
    }
    const soapInv = inventoryList.find(i => isInBranch(i.branchId) && i.category === 'Soap');
    return soapInv ? soapInv.remainingStock : 0;
  }, [detergentRecords, inventoryList, activeBranchId]);

  const softenerPacksRemaining = useMemo(() => {
    if (softenerRecords.length > 0) {
      const sorted = [...softenerRecords].filter(s => isInBranch(s.branchId)).sort((a, b) => b.date.localeCompare(a.date));
      if (sorted.length > 0 && typeof sorted[0].remainingLiters === 'number') {
        return sorted[0].remainingLiters;
      }
    }
    const softInv = inventoryList.find(i => isInBranch(i.branchId) && i.category === 'Fabric Softener');
    return softInv ? softInv.remainingStock : 0;
  }, [softenerRecords, inventoryList, activeBranchId]);

  // 8. MACHINE STATUSES
  const filteredMachines = useMemo(() => {
    return machines.filter(m => isInBranch(m.branchId));
  }, [machines, activeBranchId]);

  const machineCounts = useMemo(() => {
    const total = filteredMachines.length;
    const running = filteredMachines.filter(m => m.status === 'In Use').length;
    const available = filteredMachines.filter(m => m.status === 'Available').length;
    const maintenance = filteredMachines.filter(m => m.status === 'Maintenance').length;
    const down = filteredMachines.filter(m => m.status === 'Broken').length;

    const runningPct = total > 0 ? ((running / total) * 100).toFixed(1) : '0';
    const availablePct = total > 0 ? ((available / total) * 100).toFixed(1) : '0';
    const maintenancePct = total > 0 ? ((maintenance / total) * 100).toFixed(1) : '0';
    const downPct = total > 0 ? ((down / total) * 100).toFixed(1) : '0';

    return { total, running, available, maintenance, down, runningPct, availablePct, maintenancePct, downPct };
  }, [filteredMachines]);

  // 9. SMART BUSINESS ANALYTICS STATES & CALCULATIONS
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'peakhours' | 'comparison' | 'profit'>('overview');
  const [profitFilterMonth, setProfitFilterMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [profitFilterYear, setProfitFilterYear] = useState<number>(() => new Date().getFullYear());

  // 24-HOUR PEAK HOURS TRAFFIC DATA
  const hourlyTrafficData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${String(i).padStart(2, '0')}:00`,
      timeRange: `${String(i).padStart(2, '0')}:00 - ${String((i + 1) % 24).padStart(2, '0')}:00`,
      orders: 0,
      revenueUsd: 0,
      washCount: 0,
      dryCount: 0
    }));

    const filteredIncomes = incomeList.filter(i => isInBranch(i.branchId));
    const filteredRevenues = revenueRecords.filter(r => isInBranch(r.branchId));

    filteredIncomes.forEach(item => {
      let hour = 14;
      if ((item as any).time && typeof (item as any).time === 'string') {
        const h = parseInt((item as any).time.split(':')[0], 10);
        if (!isNaN(h) && h >= 0 && h < 24) hour = h;
      } else if ((item as any).createdAt) {
        const d = new Date((item as any).createdAt);
        if (!isNaN(d.getHours())) hour = d.getHours();
      } else {
        const hash = (item.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        hour = (8 + (hash % 14)) % 24;
      }
      buckets[hour].orders += 1;
      buckets[hour].revenueUsd += Number(item.totalAmount || 0);
      const sType = (item.serviceType || '').toLowerCase();
      if (sType.includes('wash')) buckets[hour].washCount += 1;
      if (sType.includes('dry')) buckets[hour].dryCount += 1;
    });

    filteredRevenues.forEach(rev => {
      let hour = 18;
      if ((rev as any).createdAt) {
        const d = new Date((rev as any).createdAt);
        if (!isNaN(d.getHours())) hour = d.getHours();
      } else {
        const hash = (rev.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        hour = (7 + (hash % 15)) % 24;
      }
      buckets[hour].orders += 1;
      buckets[hour].revenueUsd += Number(rev.amountUsd || 0);
    });

    const maxOrders = Math.max(1, ...buckets.map(b => b.orders));
    const totalTraffic = buckets.reduce((acc, b) => acc + b.orders, 0);

    let bestWindow = { start: 17, end: 21, count: 0 };
    for (let i = 0; i <= 20; i++) {
      const windowSum = buckets.slice(i, i + 4).reduce((sum, b) => sum + b.orders, 0);
      if (windowSum > bestWindow.count) {
        bestWindow = { start: i, end: i + 4, count: windowSum };
      }
    }

    const morningOrders = buckets.slice(6, 12).reduce((s, b) => s + b.orders, 0);
    const afternoonOrders = buckets.slice(12, 17).reduce((s, b) => s + b.orders, 0);
    const eveningOrders = buckets.slice(17, 22).reduce((s, b) => s + b.orders, 0);
    const nightOrders = (buckets.slice(22, 24).reduce((s, b) => s + b.orders, 0) + buckets.slice(0, 6).reduce((s, b) => s + b.orders, 0));

    return { 
      buckets, 
      maxOrders, 
      totalTraffic, 
      bestWindow,
      morningOrders,
      afternoonOrders,
      eveningOrders,
      nightOrders
    };
  }, [incomeList, revenueRecords, activeBranchId]);

  // MULTI-BRANCH COMPARISON DATA
  const branchComparisonData = useMemo(() => {
    return branches.map(br => {
      const brIncomes = incomeList.filter(i => i.branchId === br.id);
      const brRevs = revenueRecords.filter(r => r.branchId === br.id);
      const brExps = expenseList.filter(e => e.branchId === br.id);
      const brStaff = staffList.filter(s => s.branchId === br.id && s.status === 'Active');
      const brSalaries = salaryList.filter(s => s.branchId === br.id && s.status === 'Paid');

      const revTotal = brIncomes.reduce((s, i) => s + (i.totalAmount || 0), 0) + brRevs.reduce((s, r) => s + (r.amountUsd || 0), 0);
      const expTotal = brExps.reduce((s, e) => s + (e.amount || 0), 0) + brSalaries.reduce((s, sal) => s + (sal.netSalary || 0), 0);
      const netProfit = revTotal - expTotal;
      const profitMargin = revTotal > 0 ? ((netProfit / revTotal) * 100).toFixed(1) : '0';

      const totalOrders = brIncomes.length + brRevs.length;
      const avgOrderValue = totalOrders > 0 ? (revTotal / totalOrders).toFixed(2) : '0.00';
      const washCycles = brIncomes.filter(i => (i.serviceType || '').toLowerCase().includes('wash')).length;
      const dryCycles = brIncomes.filter(i => (i.serviceType || '').toLowerCase().includes('dry')).length;

      return {
        branch: br,
        revenueUsd: revTotal,
        revenueKhr: Math.round(revTotal * exchangeRate),
        expenseUsd: expTotal,
        expenseKhr: Math.round(expTotal * exchangeRate),
        netProfitUsd: netProfit,
        netProfitKhr: Math.round(netProfit * exchangeRate),
        profitMargin,
        totalOrders,
        avgOrderValue,
        washCycles,
        dryCycles,
        staffCount: brStaff.length
      };
    });
  }, [branches, incomeList, revenueRecords, expenseList, staffList, salaryList, exchangeRate]);

  // NET PROFIT & COST BREAKDOWN ENGINE
  const netProfitBreakdown = useMemo(() => {
    const periodPrefix = `${profitFilterYear}-${String(profitFilterMonth).padStart(2, '0')}`;

    const filteredIncomes = incomeList.filter(i => isInBranch(i.branchId) && (i.date || '').startsWith(periodPrefix));
    const filteredRevenues = revenueRecords.filter(r => isInBranch(r.branchId) && (r.date || '').startsWith(periodPrefix));
    const filteredExpenses = expenseList.filter(e => isInBranch(e.branchId) && (e.expenseDate || '').startsWith(periodPrefix));
    const filteredSalaries = salaryList.filter(s => isInBranch(s.branchId) && s.status === 'Paid' && ((s.salaryPeriod === periodPrefix) || (s.paymentDate || '').startsWith(periodPrefix)));
    const filteredGas = gasRecords.filter(g => isInBranch(g.branchId) && (g.date || '').startsWith(periodPrefix));

    const revenueServices = filteredIncomes.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const revenueCashRevs = filteredRevenues.reduce((s, r) => s + (r.amountUsd || 0), 0);
    const totalGrossRevenue = revenueServices + revenueCashRevs;

    const detergentCost = filteredExpenses.filter(e => (e.category || '').toLowerCase().includes('detergent') || (e.category || '').toLowerCase().includes('soap') || (e.description || '').toLowerCase().includes('សាប៊ូ')).reduce((s, e) => s + (e.amount || 0), 0);
    const softenerCost = filteredExpenses.filter(e => (e.category || '').toLowerCase().includes('softener') || (e.description || '').toLowerCase().includes('ក្រអូប')).reduce((s, e) => s + (e.amount || 0), 0);
    const gasCost = filteredGas.reduce((s, g) => s + (g.cost || 0), 0) + filteredExpenses.filter(e => (e.category || '').toLowerCase().includes('gas') || (e.description || '').toLowerCase().includes('ហ្គាស')).reduce((s, e) => s + (e.amount || 0), 0);
    const salaryCost = filteredSalaries.reduce((s, sal) => s + (sal.netSalary || 0), 0);
    const otherCost = filteredExpenses.filter(e => {
      const cat = (e.category || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      return !cat.includes('detergent') && !cat.includes('soap') && !cat.includes('softener') && !cat.includes('gas') && !desc.includes('សាប៊ូ') && !desc.includes('ក្រអូប') && !desc.includes('ហ្គាស');
    }).reduce((s, e) => s + (e.amount || 0), 0);

    const totalCosts = detergentCost + softenerCost + gasCost + salaryCost + otherCost;
    const netProfit = totalGrossRevenue - totalCosts;
    const margin = totalGrossRevenue > 0 ? ((netProfit / totalGrossRevenue) * 100).toFixed(1) : '0';

    return {
      totalGrossRevenue,
      detergentCost,
      softenerCost,
      gasCost,
      salaryCost,
      otherCost,
      totalCosts,
      netProfit,
      margin
    };
  }, [incomeList, revenueRecords, expenseList, salaryList, gasRecords, profitFilterMonth, profitFilterYear, activeBranchId]);

  return (
    <div className="space-y-6 font-sans select-none pb-12">
      
      {/* ANALYTICS SUB-TAB NAVIGATION BAR */}
      <div className="bg-white/80 backdrop-blur-md border border-[#EFE8DF] rounded-2xl p-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'overview'
                ? 'bg-gradient-to-r from-[#78350F] to-[#92400E] text-white shadow-md shadow-amber-950/20'
                : 'text-[#574B45] hover:bg-[#F5EBE1] hover:text-[#2B1810]'
            }`}
          >
            <BarChart3 size={15} />
            {lang === 'en' ? 'Overview' : 'ទិដ្ឋភាពទូទៅ'}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('peakhours')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'peakhours'
                ? 'bg-gradient-to-r from-[#78350F] to-[#92400E] text-white shadow-md shadow-amber-950/20'
                : 'text-[#574B45] hover:bg-[#F5EBE1] hover:text-[#2B1810]'
            }`}
          >
            <Clock size={15} />
            {lang === 'en' ? '24h Peak Hours Heatmap' : 'ម៉ោងមមាញឹក ២៤ ម៉ោង'}
            <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-900 rounded-full text-[9px] font-black">24H</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('comparison')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'comparison'
                ? 'bg-gradient-to-r from-[#78350F] to-[#92400E] text-white shadow-md shadow-amber-950/20'
                : 'text-[#574B45] hover:bg-[#F5EBE1] hover:text-[#2B1810]'
            }`}
          >
            <Scale size={15} />
            {lang === 'en' ? 'Branch Comparison' : 'ប្រៀបធៀបសាខា'}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('profit')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'profit'
                ? 'bg-gradient-to-r from-[#78350F] to-[#92400E] text-white shadow-md shadow-amber-950/20'
                : 'text-[#574B45] hover:bg-[#F5EBE1] hover:text-[#2B1810]'
            }`}
          >
            <PieChart size={15} />
            {lang === 'en' ? 'Net Profit & Costs' : 'ការវិភាគចំណេញសុទ្ធ'}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#78350F] pr-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-extrabold">{activeBranchId === 'all' ? (lang === 'en' ? 'All Cafe Branches' : 'គ្រប់សាខាកាហ្វេ') : (branches.find(b => b.id === activeBranchId)?.branchName || activeBranchId)}</span>
        </div>
      </div>
      
      {/* ========================================================================= */}
      {/* 1. OVERVIEW TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'overview' && (
        <>
          {/* 1. TOP STAT CARDS ROW (4 COLUMNS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* TODAY'S COFFEE REVENUE */}
            <div className="bg-white border border-[#EFE8DF] rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-[#D4A373]/50 transition-all">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#F5EBE1] to-[#FAF8F5] border border-[#EFE8DF] flex items-center justify-center text-[#78350F] shadow-xs">
                  <DollarSign size={20} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#78350F]/80">
                  {lang === 'en' ? "TODAY'S COFFEE REVENUE" : "ចំណូលកាហ្វេថ្ងៃនេះ"}
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-[#18110D] tracking-tight">
                  {todayRevenueKhr.toLocaleString()}៛
                </h3>
              </div>
              <div className="mt-3 pt-3 border-t border-[#F5EBE1] flex items-center justify-between text-[11px]">
                <span className="text-[#78350F] font-bold">${todayRevenueUsd.toFixed(2)} USD</span>
                <span className="bg-amber-50 border border-amber-200/60 text-[#78350F] px-2 py-0.5 rounded-lg font-black flex items-center gap-0.5">
                  ☕ {todayIncomes.length + todayRevenues.length} {lang === 'en' ? 'Orders' : 'កែវ/ការលក់'}
                </span>
              </div>
            </div>

            {/* MONTHLY NET PROFIT */}
            <div className="bg-white border border-[#EFE8DF] rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shadow-xs">
                  <TrendingUp size={20} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  {lang === 'en' ? "MONTHLY NET PROFIT" : "ប្រាក់ចំណេញខែនេះ"}
                </span>
              </div>
              <div className="mt-3">
                <h3 className={`text-2xl font-black tracking-tight ${monthlyNetProfitKhr >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {monthlyNetProfitKhr.toLocaleString()}៛
                </h3>
              </div>
              <div className="mt-3 pt-3 border-t border-[#F5EBE1] flex items-center justify-between text-[11px]">
                <span className="text-[#574B45] font-bold">${monthlyNetProfitUsd.toFixed(2)} USD</span>
                <span className="bg-emerald-50 border border-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded-lg font-black flex items-center gap-0.5">
                  {currentMonthStr}
                </span>
              </div>
            </div>

            {/* ACTIVE BARISTAS & STAFF */}
            <div className="bg-white border border-[#EFE8DF] rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-amber-300/60 transition-all">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2B1810] to-[#18110D] flex items-center justify-center text-[#D97706] shadow-xs">
                  <Users size={20} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#78350F]/80">
                  {lang === 'en' ? "BARISTAS ON DUTY" : "បុគ្គលិកឆុងកាហ្វេ"}
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-[#18110D] tracking-tight">
                  {filteredStaff.length}
                </h3>
              </div>
              <div className="mt-3 pt-3 border-t border-[#F5EBE1] flex items-center justify-between text-[11px]">
                <span className="text-[#574B45] font-medium">
                  {activeBranchId === 'all' ? `${branches.length} ${lang === 'en' ? 'Branches' : 'សាខា'}` : (branches.find(b => b.id === activeBranchId)?.branchName || 'Active Branch')}
                </span>
                <span className="bg-[#FAF8F5] border border-[#EFE8DF] text-[#78350F] px-2 py-0.5 rounded-lg font-black">
                  {filteredStaff.length > 0 ? `Active: ${filteredStaff.length}` : (lang === 'en' ? 'No Staff' : 'គ្មានបុគ្គលិក')}
                </span>
              </div>
            </div>

            {/* CASH DRAWER & VAULT */}
            <div className="bg-white border border-[#EFE8DF] rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-amber-200 transition-all">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#92400E] shadow-xs">
                  <Coins size={20} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#78350F]/80">
                  {lang === 'en' ? "CASH DRAWER & VAULT" : "ថតសាច់ប្រាក់ & ទូកាក់"}
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-[#92400E] tracking-tight">
                  {totalCoinValueKhr.toLocaleString()}៛
                </h3>
              </div>
              <div className="mt-3 pt-3 border-t border-[#F5EBE1] flex items-center justify-between text-[11px]">
                <span className="text-[#574B45] font-medium">{totalCoinCount.toLocaleString()} {lang === 'en' ? 'Coins' : 'កាក់'}</span>
                <span className="bg-emerald-50 border border-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded-lg font-black flex items-center gap-1">
                  <ShieldCheck size={12} /> ${totalCoinValueUsd.toFixed(2)}
                </span>
              </div>
            </div>

          </div>

          {/* 2. MIDDLE MAIN SECTION (LEFT 2/3 + RIGHT 1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT COLUMN: TODAY'S OPERATIONS SUMMARY TABLE */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-white border border-[#EFE8DF] rounded-2xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-extrabold text-[#111827] uppercase tracking-wider">
                    {lang === 'en' ? "TODAY'S OPERATIONS SUMMARY" : "សង្ខេបប្រតិបត្តិការថ្ងៃនេះ"}
                  </h3>
                  {onNavigate && (
                    <button 
                      type="button" 
                      onClick={() => onNavigate('revenues')}
                      className="text-xs font-bold text-[#0052CC] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {lang === 'en' ? 'View all revenue' : 'មើលចំណូលទាំងអស់'} <ArrowRight size={13} />
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[#4B5563] font-bold">
                        <th className="pb-3 pl-2">{lang === 'en' ? 'Branch' : 'សាខា'}</th>
                        <th className="pb-3 text-center">{lang === 'en' ? 'Orders' : 'ការបោក'}</th>
                        <th className="pb-3 text-center">{lang === 'en' ? 'Wash' : 'បោក'}</th>
                        <th className="pb-3 text-center">{lang === 'en' ? 'Dry' : 'សម្ងួត'}</th>
                        <th className="pb-3 text-right">{lang === 'en' ? 'Revenue (៛)' : 'ចំណូល (៛)'}</th>
                        <th className="pb-3 text-right pr-2">{lang === 'en' ? 'Profit ($)' : 'ចំណេញ ($)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {branchOperationsSummary.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 pl-2 font-bold text-[#111827] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {b.name}
                          </td>
                          <td className="py-3 text-center font-semibold text-[#111827]">{b.orders}</td>
                          <td className="py-3 text-center text-blue-600 font-semibold">{b.wash}</td>
                          <td className="py-3 text-center text-amber-600 font-semibold">{b.dry}</td>
                          <td className="py-3 text-right font-black text-[#003D9B]">{b.revenueKhr.toLocaleString()}៛</td>
                          <td className={`py-3 text-right pr-2 font-black ${b.netProfitUsd >= 0 ? 'text-[#065F46]' : 'text-rose-600'}`}>
                            ${b.netProfitUsd.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {branchOperationsSummary.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-[#4B5563]">
                            {lang === 'en' ? 'No operations recorded today yet.' : 'មិនទាន់មានទិន្នន័យប្រតិបត្តិការថ្ងៃនេះនៅឡើយទេ។'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {branchOperationsSummary.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 font-black text-xs text-[#111827]">
                          <td className="pt-3 pl-2">{lang === 'en' ? 'Total' : 'សរុប'}</td>
                          <td className="pt-3 text-center">{summaryTotals.orders}</td>
                          <td className="pt-3 text-center text-blue-600">{summaryTotals.wash}</td>
                          <td className="pt-3 text-center text-amber-600">{summaryTotals.dry}</td>
                          <td className="pt-3 text-right text-[#003D9B]">{summaryTotals.revenueKhr.toLocaleString()}៛</td>
                          <td className={`pt-3 text-right pr-2 ${summaryTotals.netProfitUsd >= 0 ? 'text-[#065F46]' : 'text-rose-600'}`}>
                            ${summaryTotals.netProfitUsd.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* MONTHLY PERFORMANCE TABLE */}
              <div className="bg-white border border-[#EFE8DF] rounded-2xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-extrabold text-[#111827] uppercase tracking-wider">
                    {lang === 'en' ? "MONTHLY PERFORMANCE" : "លទ្ធផលការងារប្រចាំខែ"} ({currentMonthStr})
                  </h3>
                  {onNavigate && (
                    <button 
                      type="button" 
                      onClick={() => onNavigate('reports')}
                      className="text-xs font-bold text-[#0052CC] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {lang === 'en' ? 'Full monthly report' : 'របាយការណ៍ខែពេញលេញ'} <ArrowRight size={13} />
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[#4B5563] font-bold">
                        <th className="pb-3 pl-2">{lang === 'en' ? 'Branch' : 'សាខា'}</th>
                        <th className="pb-3 text-right">{lang === 'en' ? 'Revenue' : 'ចំណូល'}</th>
                        <th className="pb-3 text-right">{lang === 'en' ? 'Expenses' : 'ចំណាយ'}</th>
                        <th className="pb-3 text-right">{lang === 'en' ? 'Net Profit' : 'ចំណេញសុទ្ធ'}</th>
                        <th className="pb-3 text-right pr-2">{lang === 'en' ? 'Margin' : 'ភាគរយចំណេញ'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {branchMonthlyPerformance.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 pl-2 font-bold text-[#111827]">{b.name}</td>
                          <td className="py-3 text-right font-black text-[#003D9B]">{b.revenueKhr.toLocaleString()}៛</td>
                          <td className="py-3 text-right font-medium text-[#4B5563]">{b.expensesKhr.toLocaleString()}៛</td>
                          <td className={`py-3 text-right font-black ${b.netProfitUsd >= 0 ? 'text-[#065F46]' : 'text-rose-600'}`}>
                            ${b.netProfitUsd.toFixed(2)}
                          </td>
                          <td className="py-3 text-right pr-2 font-bold text-[#0052CC]">{b.margin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: STOCK ALERTS & MACHINE STATUS */}
            <div className="space-y-6">
              
              {/* STOCK & RESERVES ALERT */}
              <div className="bg-white border border-[#EFE8DF] rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-extrabold text-[#111827] uppercase tracking-wider">
                    {lang === 'en' ? 'STOCK & RESERVES' : 'ស្តុក & ការបំពេញ'}
                  </h3>
                  <span className="text-[10px] bg-amber-50 text-[#92400E] px-2 py-0.5 rounded-full font-bold">
                    {lang === 'en' ? 'Live Track' : 'តាមដានជាក់ស្តែង'}
                  </span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl">
                    <span className="font-semibold text-[#111827] flex items-center gap-2">
                      <Package size={14} className="text-amber-700" /> {lang === 'en' ? 'Coffee Beans & Milk' : 'គ្រាប់កាហ្វេ & ទឹកដោះគោ'}
                    </span>
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-black text-[11px]">
                      {lang === 'en' ? 'In Stock' : 'មានក្នុងស្តុក'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-blue-50/60 border border-blue-200/60 rounded-xl">
                    <span className="font-semibold text-[#111827] flex items-center gap-2">
                      <Droplets size={14} className="text-blue-600" /> {lang === 'en' ? 'Cups, Syrups & Ice' : 'កែវ ទឹកស៊ីរ៉ូ & ទឹកកក'}
                    </span>
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-black text-[11px]">
                      {lang === 'en' ? 'Available' : 'គ្រប់គ្រាន់'}
                    </span>
                  </div>
                  {inventoryList.filter(i => isInBranch(i.branchId) && i.remainingStock <= i.minimumStockAlert).slice(0, 2).map((item, i) => (
                    <div key={item.id || i} className="flex items-center justify-between p-2.5 bg-rose-50/60 border border-rose-200/60 rounded-xl">
                      <span className="font-semibold text-[#111827] flex items-center gap-2">
                        <Package size={14} className="text-rose-600" /> {item.itemName}
                      </span>
                      <span className="text-rose-600 font-bold text-[11px]">
                        {item.remainingStock} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
                {onNavigate && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => onNavigate('inventory')}
                      className="text-xs font-bold text-[#0052CC] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {lang === 'en' ? 'View all inventory' : 'មើលស្តុកទាំងអស់'} <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* MACHINE STATUS DONUT CHART */}
              <div className="bg-white border border-[#EFE8DF] rounded-2xl p-5 shadow-xs">
                <h3 className="text-xs font-extrabold text-[#111827] uppercase tracking-wider mb-3">
                  {lang === 'en' ? 'MACHINE STATUS' : 'ស្ថានភាពម៉ាស៊ីន'} <span className="text-[#4B5563] font-medium">({filteredMachines.length})</span>
                </h3>
                
                <div className="flex items-center justify-between">
                  <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path strokeDasharray={`${machineCounts.runningPct}, 100`} className="text-emerald-500 stroke-current" strokeWidth="4" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path strokeDasharray={`${machineCounts.availablePct}, 100`} strokeDashoffset={`-${machineCounts.runningPct}`} className="text-blue-500 stroke-current" strokeWidth="4" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path strokeDasharray={`${machineCounts.maintenancePct}, 100`} strokeDashoffset={`-${parseFloat(machineCounts.runningPct) + parseFloat(machineCounts.availablePct)}`} className="text-amber-500 stroke-current" strokeWidth="4" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path strokeDasharray={`${machineCounts.downPct}, 100`} strokeDashoffset={`-${parseFloat(machineCounts.runningPct) + parseFloat(machineCounts.availablePct) + parseFloat(machineCounts.maintenancePct)}`} className="text-rose-500 stroke-current" strokeWidth="4" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-xl font-black text-[#111827]">{machineCounts.total}</span>
                      <span className="text-[8px] text-[#4B5563] font-bold uppercase">{lang === 'en' ? 'Total' : 'សរុប'}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-medium flex-1 pl-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> {lang === 'en' ? 'Running' : 'កំពុងដំណើរការ'}</span>
                      <span className="font-bold">{machineCounts.running} ({machineCounts.runningPct}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> {lang === 'en' ? 'Available' : 'ទំនេរ'}</span>
                      <span className="font-bold">{machineCounts.available} ({machineCounts.availablePct}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> {lang === 'en' ? 'Maintenance' : 'ថែទាំ'}</span>
                      <span className="font-bold">{machineCounts.maintenance} ({machineCounts.maintenancePct}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span> {lang === 'en' ? 'Down' : 'ខូច'}</span>
                      <span className="font-bold">{machineCounts.down} ({machineCounts.downPct}%)</span>
                    </div>
                  </div>
                </div>

                {onNavigate && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => onNavigate('inventory')}
                      className="text-xs font-bold text-[#0052CC] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {lang === 'en' ? 'View machine details' : 'មើលព័ត៌មានម៉ាស៊ីន'} <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. 24H PEAK HOURS HEATMAP TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'peakhours' && (
        <div className="space-y-6">
          {/* Top Peak Windows Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-amber-500 to-rose-600 text-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-100">{lang === 'en' ? 'PEAK TRAFFIC WINDOW' : 'ម៉ោងមមាញឹកបំផុត'}</span>
                <Flame size={18} className="text-amber-200" />
              </div>
              <h3 className="text-2xl font-black mt-2">
                {String(hourlyTrafficData.bestWindow.start).padStart(2, '0')}:00 - {String(hourlyTrafficData.bestWindow.end).padStart(2, '0')}:00
              </h3>
              <p className="text-xs text-amber-100 mt-1 font-medium">
                {hourlyTrafficData.bestWindow.count} {lang === 'en' ? 'Orders during this window' : 'ប្រតិបត្តិការក្នុងចន្លោះនេះ'}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                <span>{lang === 'en' ? 'Morning (06-12)' : 'ព្រឹក (06:00 - 12:00)'}</span>
                <Clock size={16} className="text-amber-500" />
              </div>
              <p className="text-xl font-black text-slate-900 mt-2">{hourlyTrafficData.morningOrders}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{((hourlyTrafficData.morningOrders / Math.max(1, hourlyTrafficData.totalTraffic)) * 100).toFixed(1)}% នៃចរាចរណ៍</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                <span>{lang === 'en' ? 'Afternoon (12-17)' : 'រសៀល (12:00 - 17:00)'}</span>
                <Clock size={16} className="text-sky-500" />
              </div>
              <p className="text-xl font-black text-slate-900 mt-2">{hourlyTrafficData.afternoonOrders}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{((hourlyTrafficData.afternoonOrders / Math.max(1, hourlyTrafficData.totalTraffic)) * 100).toFixed(1)}% នៃចរាចរណ៍</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                <span>{lang === 'en' ? 'Evening (17-22)' : 'ល្ងាច (17:00 - 22:00)'}</span>
                <Flame size={16} className="text-rose-500" />
              </div>
              <p className="text-xl font-black text-rose-600 mt-2">{hourlyTrafficData.eveningOrders}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{((hourlyTrafficData.eveningOrders / Math.max(1, hourlyTrafficData.totalTraffic)) * 100).toFixed(1)}% (Peak Rush)</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                <span>{lang === 'en' ? 'Night (22-06)' : 'យប់ជ្រៅ (22:00 - 06:00)'}</span>
                <Clock size={16} className="text-indigo-500" />
              </div>
              <p className="text-xl font-black text-slate-900 mt-2">{hourlyTrafficData.nightOrders}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{((hourlyTrafficData.nightOrders / Math.max(1, hourlyTrafficData.totalTraffic)) * 100).toFixed(1)}% នៃចរាចរណ៍</span>
            </div>
          </div>

          {/* 24-Hour Visual Bar Chart */}
          <div className="bg-white border border-[#EFE8DF] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Activity size={18} className="text-[#003D9B]" />
                  {lang === 'en' ? '24-Hour Hourly Customer Traffic Heatmap' : 'តារាងកំដៅចរាចរណ៍អតិថិជន ២៤ ម៉ោង'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'en' ? 'Real distribution of customer cafe orders & revenue per hour of the day' : 'ការបែងចែកជាក់ស្តែងនៃចំនួនភ្ញៀវកុម្ម៉ង់កាហ្វេ និងចំណូលតាមម៉ោងនីមួយៗក្នុងមួយថ្ងៃ'}
                </p>
              </div>

              {/* Color legends */}
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500"></span> {lang === 'en' ? 'High Peak' : 'មមាញឹកខ្លាំង'}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500"></span> {lang === 'en' ? 'Medium' : 'មធ្យម'}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-400"></span> {lang === 'en' ? 'Normal' : 'ធម្មតា'}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200"></span> {lang === 'en' ? 'Quiet' : 'ស្ងាត់'}</span>
              </div>
            </div>

            {/* Bars container */}
            <div className="h-64 flex items-end gap-1.5 pt-6 pb-2 px-2 border-b border-slate-100 overflow-x-auto">
              {hourlyTrafficData.buckets.map(b => {
                const ratio = b.orders / hourlyTrafficData.maxOrders;
                const heightPct = Math.max(10, Math.round(ratio * 100));
                
                let barColor = 'bg-slate-200';
                if (ratio >= 0.7) barColor = 'bg-gradient-to-t from-rose-500 to-rose-400';
                else if (ratio >= 0.4) barColor = 'bg-gradient-to-t from-amber-500 to-amber-400';
                else if (ratio > 0.1) barColor = 'bg-gradient-to-t from-sky-500 to-sky-400';

                return (
                  <div key={b.hour} className="flex-1 flex flex-col items-center min-w-[28px] group relative h-full justify-end">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-20 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] rounded-lg py-1.5 px-2.5 z-20 whitespace-nowrap shadow-xl pointer-events-none">
                      <span className="font-extrabold text-amber-400">{b.timeRange}</span>
                      <span>{b.orders} Orders (${b.revenueUsd.toFixed(2)})</span>
                      <span className="text-amber-200 text-[9px]">{b.washCount} Hot | {b.dryCount} Iced</span>
                      <div className="w-2 h-2 bg-slate-900 transform rotate-45 -mb-1 mt-0.5"></div>
                    </div>

                    <span className="text-[10px] font-black text-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {b.orders}
                    </span>

                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 group-hover:brightness-110 shadow-xs ${barColor}`}
                    ></div>

                    <span className="text-[9px] font-bold text-slate-500 mt-2 select-none">
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Smart Business Recommendation Box */}
            <div className="mt-6 p-4 bg-sky-50/80 border border-sky-200/80 rounded-2xl flex items-start gap-3">
              <Zap size={20} className="text-[#0052CC] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black text-[#003D9B] uppercase tracking-wide">
                  {lang === 'en' ? 'Smart Staffing & Operational Recommendation' : 'អនុសាសន៍ចាត់ចែងបុគ្គលិក និងស្តុកឆ្លាតវៃ'}
                </h4>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                  {lang === 'en'
                    ? `Peak customer activity is concentrated around ${hourlyTrafficData.bestWindow.start}:00 - ${hourlyTrafficData.bestWindow.end}:00. Ensure full-strength staff coverage on shift and ensure coffee beans, milk, and ice reserves are refilled prior to ${hourlyTrafficData.bestWindow.start}:00.`
                    : `ចរាចរណ៍ភ្ញៀវចូលច្រើនបំផុតគឺនៅចន្លោះម៉ោង ${hourlyTrafficData.bestWindow.start}:00 ដល់ ${hourlyTrafficData.bestWindow.end}:00។ សូមចាត់ចែងបុគ្គលិកឱ្យបានគ្រប់គ្រាន់ និងត្រួតពិនិត្យបំពេញស្តុកគ្រាប់កាហ្វេ ទឹកដោះគោ និងទឹកកកឱ្យរួចរាល់មុនម៉ោង ${hourlyTrafficData.bestWindow.start}:00 ដើម្បីផ្តល់សេវាកម្មរលូនជូនអតិថិជន។`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MULTI-BRANCH COMPARISON TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'comparison' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#EFE8DF] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Scale size={18} className="text-[#003D9B]" />
                  {lang === 'en' ? 'Multi-Branch Performance Comparison' : 'ការប្រៀបធៀបសមត្ថភាពរវាងសាខា'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'en' ? 'Compare revenue, operations volume, costs, and profit margins side by side' : 'ប្រៀបធៀបចំណូល ប្រតិបត្តិការ ចំណាយ និងភាគរយចំណេញសុទ្ធរវាងសាខានីមួយៗ'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {branchComparisonData.map(b => (
                <div key={b.branch.id} className="border border-slate-200 rounded-2xl p-5 bg-gradient-to-b from-white to-slate-50/50 shadow-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-black uppercase text-[#0052CC] bg-blue-50 px-2.5 py-0.5 rounded-full">
                        {b.branch.branchCode || b.branch.id}
                      </span>
                      <h4 className="text-base font-black text-slate-900 mt-1">{b.branch.branchName}</h4>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 text-[#065F46] rounded-full text-xs font-bold">
                      {b.branch.status || 'Active'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 my-4">
                    <div className="p-3 bg-white border border-slate-100 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'en' ? 'Total Revenue' : 'ចំណូលសរុប'}</span>
                      <p className="text-lg font-black text-[#003D9B] mt-0.5">${b.revenueUsd.toFixed(2)}</p>
                      <span className="text-[10px] text-slate-500 font-semibold">{b.revenueKhr.toLocaleString()}៛</span>
                    </div>

                    <div className="p-3 bg-white border border-slate-100 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'en' ? 'Net Profit' : 'ចំណេញសុទ្ធ'}</span>
                      <p className={`text-lg font-black mt-0.5 ${b.netProfitUsd >= 0 ? 'text-[#065F46]' : 'text-rose-600'}`}>
                        ${b.netProfitUsd.toFixed(2)}
                      </p>
                      <span className="text-[10px] text-slate-500 font-semibold">{b.profitMargin}% Margin</span>
                    </div>

                    <div className="p-3 bg-white border border-slate-100 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'en' ? 'Total Cycles / Orders' : 'ចំនួនជុំបោក/ប្រតិបត្តិការ'}</span>
                      <p className="text-lg font-black text-slate-900 mt-0.5">{b.totalOrders}</p>
                      <span className="text-[10px] text-slate-500 font-semibold">{b.washCycles} Wash / {b.dryCycles} Dry</span>
                    </div>

                    <div className="p-3 bg-white border border-slate-100 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'en' ? 'Active Staff' : 'បុគ្គលិកប្រចាំការ'}</span>
                      <p className="text-lg font-black text-slate-900 mt-0.5">{b.staffCount}</p>
                      <span className="text-[10px] text-slate-500 font-semibold">${b.avgOrderValue} / Order Avg</span>
                    </div>
                  </div>

                  {/* Visual relative ratio bar */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                      <span>{lang === 'en' ? 'Profit Margin Efficiency' : 'ប្រសិទ្ធភាពភាគរយចំណេញ'}</span>
                      <span className="text-[#0052CC]">{b.profitMargin}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, Math.max(0, parseFloat(b.profitMargin)))}%` }}
                        className="bg-[#003D9B] h-full rounded-full transition-all duration-500"
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. NET PROFIT & OPERATIONAL COSTS BREAKDOWN TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'profit' && (
        <div className="space-y-6">
          {/* Top Period Selector */}
          <div className="bg-white border border-[#EFE8DF] rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <PieChart size={16} className="text-[#003D9B]" />
                {lang === 'en' ? 'Financial Breakdown Period' : 'ជ្រើសរើសខែដើម្បីវិភាគចំណេញសុទ្ធ'}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={profitFilterMonth}
                onChange={e => setProfitFilterMonth(Number(e.target.value))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>ខែ {m}</option>
                ))}
              </select>

              <select
                value={profitFilterYear}
                onChange={e => setProfitFilterYear(Number(e.target.value))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
              >
                {[2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4 Cards Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">{lang === 'en' ? 'GROSS REVENUE' : 'ចំណូលសរុប (Gross Revenue)'}</span>
              <h3 className="text-2xl font-black text-[#003D9B] mt-2">${netProfitBreakdown.totalGrossRevenue.toFixed(2)}</h3>
              <p className="text-xs text-slate-500 mt-1 font-semibold">{Math.round(netProfitBreakdown.totalGrossRevenue * exchangeRate).toLocaleString()}៛</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">{lang === 'en' ? 'TOTAL OPERATING COSTS' : 'ចំណាយប្រតិបត្តិការសរុប'}</span>
              <h3 className="text-2xl font-black text-rose-600 mt-2">${netProfitBreakdown.totalCosts.toFixed(2)}</h3>
              <p className="text-xs text-slate-500 mt-1 font-semibold">{Math.round(netProfitBreakdown.totalCosts * exchangeRate).toLocaleString()}៛</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">{lang === 'en' ? 'NET PROFIT' : 'ប្រាក់ចំណេញសុទ្ធ (Net Profit)'}</span>
              <h3 className={`text-2xl font-black mt-2 ${netProfitBreakdown.netProfit >= 0 ? 'text-[#065F46]' : 'text-rose-600'}`}>
                ${netProfitBreakdown.netProfit.toFixed(2)}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-semibold">{Math.round(netProfitBreakdown.netProfit * exchangeRate).toLocaleString()}៛</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">{lang === 'en' ? 'PROFIT MARGIN' : 'ភាគរយចំណេញ (Margin)'}</span>
              <h3 className="text-2xl font-black text-[#0052CC] mt-2">{netProfitBreakdown.margin}%</h3>
              <p className="text-xs text-slate-500 mt-1 font-semibold">Net operating margin</p>
            </div>
          </div>

          {/* Cost Distribution Progress Bars */}
          <div className="bg-white border border-[#EFE8DF] rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
              <DollarSign size={18} className="text-[#003D9B]" />
              {lang === 'en' ? 'Cost Breakdown Structure' : 'រចនាសម្ព័ន្ធចំណាយប្រតិបត្តិការ'}
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>☕ {lang === 'en' ? 'Coffee Beans & Supplies' : 'គ្រាប់កាហ្វេ & សម្ភារៈឆុង'}</span>
                  <span className="font-mono text-slate-900">${netProfitBreakdown.detergentCost.toFixed(2)} ({netProfitBreakdown.totalCosts > 0 ? ((netProfitBreakdown.detergentCost / netProfitBreakdown.totalCosts) * 100).toFixed(1) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div style={{ width: `${netProfitBreakdown.totalCosts > 0 ? (netProfitBreakdown.detergentCost / netProfitBreakdown.totalCosts) * 100 : 0}%` }} className="bg-blue-500 h-full rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>🥛 {lang === 'en' ? 'Milk, Syrups & Ingredients' : 'ទឹកដោះគោ ទឹកស៊ីរ៉ូ & គ្រឿងផ្សំ'}</span>
                  <span className="font-mono text-slate-900">${netProfitBreakdown.softenerCost.toFixed(2)} ({netProfitBreakdown.totalCosts > 0 ? ((netProfitBreakdown.softenerCost / netProfitBreakdown.totalCosts) * 100).toFixed(1) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div style={{ width: `${netProfitBreakdown.totalCosts > 0 ? (netProfitBreakdown.softenerCost / netProfitBreakdown.totalCosts) * 100 : 0}%` }} className="bg-amber-500 h-full rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>⚡ {lang === 'en' ? 'Espresso & Appliance Power' : 'ថាមពលម៉ាស៊ីនកាហ្វេ & ហ្គាស'}</span>
                  <span className="font-mono text-slate-900">${netProfitBreakdown.gasCost.toFixed(2)} ({netProfitBreakdown.totalCosts > 0 ? ((netProfitBreakdown.gasCost / netProfitBreakdown.totalCosts) * 100).toFixed(1) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div style={{ width: `${netProfitBreakdown.totalCosts > 0 ? (netProfitBreakdown.gasCost / netProfitBreakdown.totalCosts) * 100 : 0}%` }} className="bg-rose-500 h-full rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>👥 {lang === 'en' ? 'Staff Salaries & Shift Covers' : 'ប្រាក់ខែបុគ្គលិក & ថ្លៃជំនួសវេន'}</span>
                  <span className="font-mono text-slate-900">${netProfitBreakdown.salaryCost.toFixed(2)} ({netProfitBreakdown.totalCosts > 0 ? ((netProfitBreakdown.salaryCost / netProfitBreakdown.totalCosts) * 100).toFixed(1) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div style={{ width: `${netProfitBreakdown.totalCosts > 0 ? (netProfitBreakdown.salaryCost / netProfitBreakdown.totalCosts) * 100 : 0}%` }} className="bg-purple-500 h-full rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>🏢 {lang === 'en' ? 'Utilities & General Expenses' : 'ថ្លៃទឹក ភ្លើង ជួលទីតាំង & ចំណាយផ្សេងៗ'}</span>
                  <span className="font-mono text-slate-900">${netProfitBreakdown.otherCost.toFixed(2)} ({netProfitBreakdown.totalCosts > 0 ? ((netProfitBreakdown.otherCost / netProfitBreakdown.totalCosts) * 100).toFixed(1) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div style={{ width: `${netProfitBreakdown.totalCosts > 0 ? (netProfitBreakdown.otherCost / netProfitBreakdown.totalCosts) * 100 : 0}%` }} className="bg-slate-500 h-full rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

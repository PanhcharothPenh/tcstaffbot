/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { FileText, Eye } from 'lucide-react';
import { Staff, SalaryAdvance, Salary } from '../types';
import { OvertimeLog } from '../utils/khmerPayrollUtils';

interface KhmerPayrollCalculatorProps {
  staffList: Staff[];
  salaries: Salary[];
  setSalaries: React.Dispatch<React.SetStateAction<Salary[]>>;
  salaryAdvances: SalaryAdvance[];
  setSalaryAdvances: React.Dispatch<React.SetStateAction<SalaryAdvance[]>>;
  overtimeLogs: OvertimeLog[];
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
  onOpenPayslip: (record: any) => void;
}

export default function KhmerPayrollCalculator({
  staffList,
  salaries,
  setSalaries,
  salaryAdvances,
  setSalaryAdvances,
  overtimeLogs,
  lang,
  onAddLog,
  onOpenPayslip
}: KhmerPayrollCalculatorProps) {
  // Calculator Form State
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [month, setMonth] = useState(7); // July
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [period, setPeriod] = useState<1 | 2 | 3>(2); // Default to Period 2
  const [workedDays, setWorkedDays] = useState<number>(26);
  const [allowance, setAllowance] = useState<number>(0);
  const [deduction, setDeduction] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid');

  const selectedEmp = useMemo(() => {
    return staffList.find(e => e.id === selectedStaffId);
  }, [staffList, selectedStaffId]);

  // Set default worked days when employee changes
  useEffect(() => {
    if (selectedEmp) {
      const std = (selectedEmp as any).standardDays || 26;
      setWorkedDays(std);
    }
  }, [selectedEmp]);

  // 1. Reactive Calculation Engine
  const draftCalculation = useMemo(() => {
    if (!selectedEmp) return null;

    const stdDays = (selectedEmp as any).standardDays || 26;
    const basicSalary = selectedEmp.baseSalary;
    
    // Prorated Basic calculation
    const proratedBasic = Number(((basicSalary / stdDays) * workedDays).toFixed(2));
    
    let periodBase = 0;
    let otDays = 0;
    let otPay = 0;
    let otDaysDay = 0;
    let otPayDay = 0;
    let otDaysNight = 0;
    let otPayNight = 0;
    
    let period1Deduct = 0;
    let advancesDeduct = 0;

    if (period === 1) {
      // Period 1: 50% of the prorated basic salary
      periodBase = Number((proratedBasic * 0.5).toFixed(2));
      // No OT, advance or Period 1 deduction for P1
    } else {
      // Period 2 (Settle) & Period 3 (Full Month)
      periodBase = proratedBasic;

      // 1. Gather all overtime logs for this employee in the selected Month / Year
      const empOtLogs = overtimeLogs.filter(o => {
        const d = new Date(o.startDate);
        const matchEmp = o.empId === selectedStaffId;
        const matchMonth = d.getMonth() + 1 === month;
        const matchYear = d.getFullYear() === year;
        return matchEmp && matchMonth && matchYear;
      });

      const dayLogs = empOtLogs.filter(o => o.shift === 'day');
      const nightLogs = empOtLogs.filter(o => o.shift === 'night');

      otDaysDay = dayLogs.reduce((sum, o) => sum + Number(o.days || 0), 0);
      otPayDay = dayLogs.reduce((sum, o) => sum + Number(o.amount || 0), 0);
      
      otDaysNight = nightLogs.reduce((sum, o) => sum + Number(o.days || 0), 0);
      otPayNight = nightLogs.reduce((sum, o) => sum + Number(o.amount || 0), 0);

      otDays = otDaysDay + otDaysNight;
      otPay = otPayDay + otPayNight;

      // 2. Gather approved / disbursed advances for deduction
      const empAdvances = salaryAdvances.filter(a => {
        const isEmp = a.staffId === selectedStaffId;
        const lowerStatus = String(a.status).toLowerCase();
        const isPendingOrDisbursed = lowerStatus === 'pending' || lowerStatus === 'approved' || lowerStatus === 'disbursed';
        return isEmp && isPendingOrDisbursed;
      });
      advancesDeduct = empAdvances.reduce((sum, a) => sum + Number(a.amount || 0), 0);

      // 3. Gather period 1 payouts already saved in history to deduct in Period 2
      if (period === 2) {
        const p1Record = salaries.find(s => {
          const isEmp = s.staffId === selectedStaffId;
          const isP1 = s.salaryPeriod?.includes('Period 1') || s.salaryPeriod?.includes('1st') || s.salaryPeriod?.includes('half');
          const isMonthMatch = s.salaryPeriod?.includes(String(month)) || s.paymentDate?.includes(`-${month < 10 ? '0' + month : month}-`);
          const isYearMatch = s.salaryPeriod?.includes(String(year)) || s.paymentDate?.includes(`${year}-`);
          return isEmp && isP1 && isMonthMatch && isYearMatch;
        });

        if (p1Record) {
          period1Deduct = p1Record.netSalary;
        } else {
          // Default to 50% basic prorated if no previous record exists
          period1Deduct = Number((proratedBasic * 0.5).toFixed(2));
        }
      }
    }

    // Grand Net Total Payout
    let netPay = 0;
    if (period === 1) {
      netPay = periodBase + allowance - deduction;
    } else if (period === 2) {
      netPay = periodBase + otPay + allowance - period1Deduct - advancesDeduct - deduction;
    } else {
      netPay = periodBase + otPay + allowance - advancesDeduct - deduction;
    }

    if (netPay < 0) netPay = 0;

    return {
      empId: selectedStaffId,
      empNameKh: (selectedEmp as any).nameKh || '',
      empNameEn: (selectedEmp as any).nameEn || selectedEmp.fullName,
      position: selectedEmp.position,
      startDate: selectedEmp.startDate,
      basicSalary,
      workedDays,
      standardDays: stdDays,
      dailyRate: (selectedEmp as any).dailyRate || Number((basicSalary / stdDays).toFixed(2)),
      proratedBasic,
      periodBase,
      otDays,
      otPay,
      otDaysDay,
      otPayDay,
      otDaysNight,
      otPayNight,
      allowance,
      period1Deduct,
      advancesDeduct,
      customDeduct: deduction,
      netPay: Number(netPay.toFixed(2)),
      period,
      month,
      year,
      status: paymentStatus
    };
  }, [selectedEmp, selectedStaffId, month, year, period, workedDays, allowance, deduction, paymentStatus, overtimeLogs, salaryAdvances, salaries]);

  const handleSavePayroll = () => {
    if (!draftCalculation) return;

    // Check if duplicate calculation already exists for this staff, month, year, and cycle
    const isDuplicate = salaries.some(s => {
      const isEmp = s.staffId === draftCalculation.empId;
      const isPeriodMatch = s.salaryPeriod?.includes(`Period ${draftCalculation.period}`) || 
                            s.salaryPeriod?.includes(draftCalculation.period === 1 ? '1st' : '2nd');
      const isMonthMatch = s.salaryPeriod?.includes(`M${draftCalculation.month}`) || s.paymentDate?.includes(`-${draftCalculation.month < 10 ? '0' + draftCalculation.month : draftCalculation.month}-`);
      const isYearMatch = s.salaryPeriod?.includes(String(draftCalculation.year));
      return isEmp && isPeriodMatch && isMonthMatch && isYearMatch;
    });

    if (isDuplicate) {
      const overwrite = window.confirm(
        lang === 'kh'
          ? 'ការគណនាប្រាក់ខែបុគ្គលិកម្នាក់នេះសម្រាប់លើកនេះមានរួចហើយ។ តើអ្នកចង់គណនាឡើងវិញ និងជំនួសយកទិន្នន័យថ្មីនេះទេ?'
          : 'Payroll calculation for this employee and period already exists. Do you want to recalculate and overwrite it?'
      );
      if (!overwrite) return;

      // Remove the duplicate record
      setSalaries(prev => prev.filter(s => {
        const isEmp = s.staffId === draftCalculation.empId;
        const isPeriodMatch = s.salaryPeriod?.includes(`Period ${draftCalculation.period}`) || 
                              s.salaryPeriod?.includes(draftCalculation.period === 1 ? '1st' : '2nd');
        const isMonthMatch = s.salaryPeriod?.includes(`M${draftCalculation.month}`) || s.paymentDate?.includes(`-${draftCalculation.month < 10 ? '0' + draftCalculation.month : draftCalculation.month}-`);
        const isYearMatch = s.salaryPeriod?.includes(String(draftCalculation.year));
        return !(isEmp && isPeriodMatch && isMonthMatch && isYearMatch);
      }));
    }

    const finalPeriodLabel = `M${draftCalculation.month}-${draftCalculation.year} [Period ${draftCalculation.period}]`;

    const newSalaryRecord: Salary = {
      id: 'sal_' + Date.now(),
      branchId: selectedEmp?.branchId || 'b1',
      staffId: draftCalculation.empId,
      staffName: draftCalculation.empNameEn,
      salaryPeriod: finalPeriodLabel,
      baseSalary: draftCalculation.basicSalary,
      overtime: draftCalculation.otPay,
      bonus: draftCalculation.allowance,
      deduction: draftCalculation.customDeduct,
      advancePayment: draftCalculation.advancesDeduct,
      netSalary: draftCalculation.netPay,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'ABA',
      paidBy: 'Admin',
      note: `Prorated basic salary over ${draftCalculation.workedDays}/${draftCalculation.standardDays} days.`,
      status: (draftCalculation.status === 'paid' ? 'Paid' : 'Unpaid') as any,
      monthlyBaseSalary: draftCalculation.basicSalary,
      daysWorked: draftCalculation.workedDays,
      // Custom attached stats
      ...({
        empNameKh: draftCalculation.empNameKh,
        empNameEn: draftCalculation.empNameEn,
        month: draftCalculation.month,
        year: draftCalculation.year,
        period: draftCalculation.period,
        otDaysDay: draftCalculation.otDaysDay,
        otPayDay: draftCalculation.otPayDay,
        otDaysNight: draftCalculation.otDaysNight,
        otPayNight: draftCalculation.otPayNight,
        period1Deduct: draftCalculation.period1Deduct,
        advancesDeduct: draftCalculation.advancesDeduct,
        customDeduct: draftCalculation.customDeduct,
        netPay: draftCalculation.netPay,
        dateCalculated: new Date().toISOString().split('T')[0]
      } as any)
    };

    setSalaries(prev => [newSalaryRecord, ...prev]);

    // Flip employee advances to 'Paid' (settled/deducted) if Period 2 or Period 3 payout
    if (draftCalculation.period === 2 || draftCalculation.period === 3) {
      setSalaryAdvances(prev => prev.map(adv => {
        if (adv.staffId === draftCalculation.empId && (adv.status === 'Approved' || (adv as any).status === 'disbursed' || adv.status === 'Pending')) {
          return { ...adv, status: 'Paid' as any };
        }
        return adv;
      }));
    }

    onAddLog(`Processed payroll of $${draftCalculation.netPay.toFixed(2)} for employee: "${draftCalculation.empNameEn}"`);
    alert(lang === 'kh' ? 'រក្សាទុកការគណនាប្រាក់ខែបុគ្គលិកបានជោគជ័យ!' : 'Payroll calculation saved successfully!');

    // Reset Form
    setSelectedStaffId('');
    setAllowance(0);
    setDeduction(0);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Run Calculator Form */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm h-fit space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span>{lang === 'kh' ? 'គណនា និងបើកប្រាក់ខែ' : 'Calculate & Settle Payroll'}</span>
        </h3>

        <div>
          <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
            {lang === 'kh' ? 'ជ្រើសរើសបុគ្គលិក' : 'Select Employee *'}
          </label>
          <select
            value={selectedStaffId}
            onChange={e => setSelectedStaffId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-semibold"
            required
          >
            <option value="">{lang === 'kh' ? '-- ជ្រើសរើសបុគ្គលិក --' : '-- Select Employee --'}</option>
            {staffList.map(st => {
              const enName = (st as any).nameEn || st.fullName;
              const khName = (st as any).nameKh || '';
              return (
                <option key={st.id} value={st.id}>
                  {enName} {khName ? `(${khName})` : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
              {lang === 'kh' ? 'ជ្រើសរើសខែ' : 'Select Month'}
            </label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-semibold"
            >
              <option value={1}>មករា (January)</option>
              <option value={2}>កុម្ភៈ (February)</option>
              <option value={3}>មីនា (March)</option>
              <option value={4}>មេសា (April)</option>
              <option value={5}>ឧសភា (May)</option>
              <option value={6}>មិថុនា (June)</option>
              <option value={7}>កក្កដា (July)</option>
              <option value={8}>សីហា (August)</option>
              <option value={9}>កញ្ញា (September)</option>
              <option value={10}>តុលា (October)</option>
              <option value={11}>វិច្ឆិកា (November)</option>
              <option value={12}>ធ្នូ (December)</option>
            </select>
          </div>
          <div>
            <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
              {lang === 'kh' ? 'ឆ្នាំ' : 'Year'}
            </label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 font-mono outline-none focus:border-slate-400 focus:bg-white font-semibold"
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
            {lang === 'kh' ? 'ការបើកលើកទី (Period)' : 'Pay Cycle Period'}
          </label>
          <select
            value={period}
            onChange={e => setPeriod(Number(e.target.value) as any)}
            className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-semibold"
          >
            <option value={1}>{lang === 'kh' ? 'លើកទី១ (ពាក់កណ្តាលខែ - ៥០% នៃប្រាក់គោល)' : 'Period 1 (Mid-Month: 50% Basic)'}</option>
            <option value={2}>{lang === 'kh' ? 'លើកទី២ (ដាច់ខែ - ទូទាត់សរុប)' : 'Period 2 (End-Month: Settlement)'}</option>
            <option value={3}>{lang === 'kh' ? 'បើកពេញ ១ខែ (ទូទាត់ម្តងក្នុង ១ខែ)' : 'Full Month (Pay once a month)'}</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
              {lang === 'kh' ? 'ថ្ងៃធ្វើការជាក់ស្តែង' : 'Worked Days'}
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={workedDays === 0 ? '' : workedDays}
              onChange={e => setWorkedDays(Number(e.target.value || '0'))}
              className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold outline-none focus:border-slate-400 focus:bg-white"
            />
          </div>
          <div className="col-span-1">
            <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
              {lang === 'kh' ? 'ប្រាក់ឧបត្ថម្ភ ($)' : 'Allowances ($)'}
            </label>
            <input
              type="number"
              step="0.01"
              value={allowance === 0 ? '' : allowance}
              onChange={e => setAllowance(Number(e.target.value || '0'))}
              className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-semibold outline-none focus:border-slate-400 focus:bg-white"
            />
          </div>
          <div className="col-span-1">
            <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
              {lang === 'kh' ? 'ប្រាក់ពិន័យ ($)' : 'Deductions ($)'}
            </label>
            <input
              type="number"
              step="0.01"
              value={deduction === 0 ? '' : deduction}
              onChange={e => setDeduction(Number(e.target.value || '0'))}
              className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-semibold outline-none focus:border-slate-400 focus:bg-white"
            />
          </div>
        </div>

        <div>
          <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
            {lang === 'kh' ? 'ស្ថានភាពទូទាត់' : 'Payment Status'}
          </label>
          <select
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-semibold"
          >
            <option value="paid">{lang === 'kh' ? 'បានបើកប្រាក់រួច (Paid)' : 'Paid'}</option>
            <option value="unpaid">{lang === 'kh' ? 'មិនទាន់បើក (Not Paid)' : 'Not Paid'}</option>
          </select>
        </div>

        <button
          onClick={handleSavePayroll}
          disabled={!draftCalculation}
          className={`w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex justify-center items-center gap-1.5 shadow-md shadow-emerald-500/10 ${
            !draftCalculation ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          <FileText size={14} />
          <span>{lang === 'kh' ? 'រក្សាទុកការគណនាប្រាក់ខែ' : 'Save Payroll Calculation'}</span>
        </button>
      </div>

      {/* Real-time preview card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex justify-between items-center">
            <span>{lang === 'kh' ? 'ការគណនាប្រាក់ខែសរុប (បណ្តោះអាសន្ន)' : 'Payroll Preview Breakdown (Draft)'}</span>
            {draftCalculation && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9.5px]">
                {draftCalculation.empNameEn}
              </span>
            )}
          </h3>

          {!draftCalculation ? (
            <div className="text-slate-400 text-center py-20 text-xs font-semibold">
              {lang === 'kh' ? 'សូមជ្រើសរើសបុគ្គលិកមុននឹងមើលសន្លឹកវិក្កយបត្រ!' : 'Please select an employee to generate live calculations.'}
            </div>
          ) : (
            <div className="space-y-3.5 text-xs text-slate-700 font-medium">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{lang === 'kh' ? 'ប្រាក់ខែគោល (Basic Salary)' : 'Basic Salary'}</span>
                <span className="font-mono font-bold text-slate-800">${draftCalculation.basicSalary.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{lang === 'kh' ? 'ប្រាក់ខែគោលតាមថ្ងៃធ្វើការជាក់ស្តែង' : 'Prorated Basic'}</span>
                <span className="font-mono font-bold text-slate-800">
                  ${draftCalculation.proratedBasic.toFixed(2)}
                  <span className="text-[10px] text-slate-500 font-medium ml-1.5">
                    ({draftCalculation.workedDays}/{draftCalculation.standardDays} days)
                  </span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{lang === 'kh' ? 'ប្រាក់ខែតាមវគ្គ (Period Base)' : 'Period Base Salary'}</span>
                <span className="font-mono font-bold text-slate-800">${draftCalculation.periodBase.toFixed(2)}</span>
              </div>

              {/* Day shift OT */}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">
                  {lang === 'kh' ? 'ប្រាក់ថែមម៉ោងវេនថ្ងៃ (Day Shift OT)' : 'Overtime Day Shift'}
                  <span className="text-[10px] text-slate-500 ml-1.5">
                    ({draftCalculation.otDaysDay.toFixed(1)} {lang === 'kh' ? 'ថ្ងៃ' : 'days'})
                  </span>
                </span>
                <span className="font-mono font-bold text-emerald-600">+${draftCalculation.otPayDay.toFixed(2)}</span>
              </div>

              {/* Night shift OT */}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">
                  {lang === 'kh' ? 'ប្រាក់ថែមម៉ោងវេនយប់ (Night Shift OT)' : 'Overtime Night Shift'}
                  <span className="text-[10px] text-slate-500 ml-1.5">
                    ({draftCalculation.otDaysNight.toFixed(1)} {lang === 'kh' ? 'ថ្ងៃ' : 'days'})
                  </span>
                </span>
                <span className="font-mono font-bold text-emerald-600">+${draftCalculation.otPayNight.toFixed(2)}</span>
              </div>

              {/* Allowances */}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{lang === 'kh' ? 'ប្រាក់ឧបត្ថម្ភផ្សេងៗ (Allowances)' : 'Allowances'}</span>
                <span className="font-mono font-bold text-emerald-600">+${draftCalculation.allowance.toFixed(2)}</span>
              </div>

              {/* Deductions */}
              {draftCalculation.period === 2 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{lang === 'kh' ? 'ដកប្រាក់បើកលើកទី១ (Period 1 Payout)' : 'Period 1 Payout Deducted'}</span>
                  <span className="font-mono font-bold text-rose-600">-${draftCalculation.period1Deduct.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{lang === 'kh' ? 'ដកប្រាក់បើកមុន (Deducted Advances)' : 'Salary Advances Deducted'}</span>
                <span className="font-mono font-bold text-rose-600">-${draftCalculation.advancesDeduct.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{lang === 'kh' ? 'ប្រាក់ពិន័យ/ដកផ្សេងៗ (Deductions)' : 'Other Deductions / Fines'}</span>
                <span className="font-mono font-bold text-rose-600">-${draftCalculation.customDeduct.toFixed(2)}</span>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-sm font-bold text-slate-900">
                <span>{lang === 'kh' ? 'ប្រាក់ខែត្រូវបើកសរុប (Net Payout)' : 'Net Payout Amount'}</span>
                <span className="text-lg font-black text-teal-600 font-mono">${draftCalculation.netPay.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {draftCalculation && (
          <button
            onClick={() => onOpenPayslip(draftCalculation)}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex justify-center items-center gap-1.5 mt-4"
          >
            <Eye size={14} />
            <span>{lang === 'kh' ? 'មើលសន្លឹកវិក្កយបត្រប្រាក់ខែ (Payslip)' : 'Preview Payslip (Receipt)'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useEffect } from 'react';
import { Users, Banknote, Coins, Clock, Bell, CircleAlert, HelpCircle } from 'lucide-react';
import { Staff, SalaryAdvance, Salary } from '../types';
import { getEmployeePaydays, OvertimeLog } from '../utils/khmerPayrollUtils';

interface KhmerPayrollDashboardProps {
  staffList: Staff[];
  salaries: Salary[];
  salaryAdvances: SalaryAdvance[];
  overtimeLogs: OvertimeLog[];
  lang: 'en' | 'kh';
  onAlertsCalculated: (alerts: any[]) => void;
}

export default function KhmerPayrollDashboard({
  staffList,
  salaries,
  salaryAdvances,
  overtimeLogs,
  lang,
  onAlertsCalculated
}: KhmerPayrollDashboardProps) {
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  // 1. Core Calculations
  const totalEmployees = staffList.length;

  const totalPendingAdvances = useMemo(() => {
    return salaryAdvances
      .filter(a => a.status === 'Pending' || a.status === 'Approved')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);
  }, [salaryAdvances]);

  const totalOtDays = useMemo(() => {
    return overtimeLogs.reduce((sum, o) => sum + Number(o.days || 0), 0);
  }, [overtimeLogs]);

  // Current month payouts
  const currentMonthHistory = useMemo(() => {
    return salaries.filter(s => {
      const periodStr = s.salaryPeriod || '';
      const containsYear = periodStr.includes(String(todayYear));
      const containsMonth = periodStr.includes(todayMonth < 10 ? `0${todayMonth}` : String(todayMonth));
      return containsYear && containsMonth;
    });
  }, [salaries, todayMonth, todayYear]);

  const totalPayrollAmount = useMemo(() => {
    return currentMonthHistory.reduce((sum, s) => sum + Number(s.netSalary || 0), 0);
  }, [currentMonthHistory]);

  const totalPaid = useMemo(() => {
    return currentMonthHistory
      .filter(s => s.status === 'Paid')
      .reduce((sum, s) => sum + Number(s.netSalary || 0), 0);
  }, [currentMonthHistory]);

  const totalUnpaid = useMemo(() => {
    return currentMonthHistory
      .filter(s => s.status === 'Unpaid')
      .reduce((sum, s) => sum + Number(s.netSalary || 0), 0);
  }, [currentMonthHistory]);

  // 2. Payday Alerts Logic
  const activeAlerts = useMemo(() => {
    const alerts: any[] = [];
    staffList.forEach(emp => {
      if (emp.status !== 'Active') return;
      const paydays = getEmployeePaydays(emp.startDate);
      const periods = [
        { id: 1, day: paydays.p1, nameKh: 'លើកទី១ (ពាក់កណ្តាលខែ)', nameEn: 'Period 1 (Mid-Month)' },
        { id: 2, day: paydays.p2, nameKh: 'លើកទី២ (ដាច់ខែ)', nameEn: 'Period 2 (End-Month)' }
      ];

      periods.forEach(p => {
        // Check if already paid for this period this month/year
        const alreadyPaid = salaries.some(s => {
          const isEmp = s.staffId === emp.id;
          const isPeriodMatch = s.salaryPeriod?.includes(p.id === 1 ? '1st' : '2nd') || 
                                s.salaryPeriod?.includes(p.id === 1 ? 'half' : 'Settle') ||
                                s.salaryPeriod?.includes(`Period ${p.id}`) ||
                                (s.salaryPeriod?.includes(String(todayMonth)) && s.salaryPeriod?.includes(p.id === 1 ? '1st' : '2nd'));
          return isEmp && isPeriodMatch;
        });

        if (alreadyPaid) return;

        const diff = p.day - todayDay;
        let isUrgent = false;
        let isUpcoming = false;
        let isPastDue = false;
        let daysText = '';

        if (diff === 0) {
          isUrgent = true;
          daysText = lang === 'kh' ? 'ថ្ងៃនេះជាថ្ងៃបើក!' : 'Today is Payday!';
        } else if (diff > 0 && diff <= 3) {
          isUpcoming = true;
          daysText = lang === 'kh' ? `នៅសល់ ${diff} ថ្ងៃទៀត` : `${diff} days remaining`;
        } else if (diff < 0) {
          isPastDue = true;
          daysText = lang === 'kh' ? `ហួសថ្ងៃបើក ${Math.abs(diff)} ថ្ងៃ` : `Overdue by ${Math.abs(diff)} days`;
        }

        if (isUrgent || isUpcoming || isPastDue) {
          alerts.push({
            emp,
            periodId: p.id,
            periodName: lang === 'kh' ? p.nameKh : p.nameEn,
            daysText,
            type: isUrgent ? 'urgent' : (isPastDue ? 'pastdue' : 'upcoming'),
            dayVal: p.day
          });
        }
      });
    });

    return alerts;
  }, [staffList, salaries, todayDay, todayMonth, todayYear, lang]);

  // Handle parent notifications inside useEffect to prevent render warnings
  useEffect(() => {
    onAlertsCalculated(activeAlerts);
  }, [activeAlerts, onAlertsCalculated]);

  return (
    <div className="space-y-6">
      {/* 4 Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Employees */}
        <div className="relative overflow-hidden bg-white border border-slate-100 hover:border-indigo-200 p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 shadow-2xs group">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 group-hover:h-full transition-all"></div>
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-450 uppercase tracking-wider">
              {lang === 'kh' ? 'បុគ្គលិកសរុប' : 'Total Employees'}
            </h4>
            <div className="text-2xl font-black text-slate-800 font-mono mt-0.5">{totalEmployees}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {lang === 'kh' ? 'នាក់ ក្នុងស្ថាប័ន' : 'active in organization'}
            </p>
          </div>
        </div>

        {/* Total Month Payroll */}
        <div className="relative overflow-hidden bg-white border border-slate-100 hover:border-emerald-200 p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 shadow-2xs group">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 group-hover:h-full transition-all"></div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Banknote size={24} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-455 uppercase tracking-wider">
              {lang === 'kh' ? 'ប្រាក់ខែសរុបខែនេះ' : 'Total Month Payroll'}
            </h4>
            <div className="text-2xl font-black text-slate-800 font-mono mt-0.5">${totalPayrollAmount.toFixed(2)}</div>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight font-semibold">
              {lang === 'kh' 
                ? `បានបើក៖ $${totalPaid.toFixed(1)} | មិនទាន់៖ $${totalUnpaid.toFixed(1)}`
                : `Paid: $${totalPaid.toFixed(1)} | Unpaid: $${totalUnpaid.toFixed(1)}`
              }
            </p>
          </div>
        </div>

        {/* Total Pending Advances */}
        <div className="relative overflow-hidden bg-white border border-slate-100 hover:border-amber-200 p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 shadow-2xs group">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 group-hover:h-full transition-all"></div>
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
            <Coins size={24} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-450 uppercase tracking-wider">
              {lang === 'kh' ? 'ប្រាក់បើកមុនសរុប' : 'Total Advances'}
            </h4>
            <div className="text-2xl font-black text-slate-800 font-mono mt-0.5">${totalPendingAdvances.toFixed(2)}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              {lang === 'kh' ? 'មិនទាន់កាត់កង' : 'not yet settled/deducted'}
            </p>
          </div>
        </div>

        {/* Total OT Days */}
        <div className="relative overflow-hidden bg-white border border-slate-100 hover:border-teal-200 p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 shadow-2xs group">
          <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 group-hover:h-full transition-all"></div>
          <div className="p-3.5 bg-teal-50 text-teal-600 rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-450 uppercase tracking-wider">
              {lang === 'kh' ? 'ថ្ងៃថែមម៉ោងសរុប' : 'Total OT Days'}
            </h4>
            <div className="text-2xl font-black text-slate-800 font-mono mt-0.5">{totalOtDays.toFixed(1)}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {lang === 'kh' ? 'ថ្ងៃការងារបន្ថែមសរុប' : 'total extra work days'}
            </p>
          </div>
        </div>
      </div>

      {/* Main split sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Alerts (2/3 width) */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
              <Bell size={16} className="text-amber-500" />
              <span>{lang === 'kh' ? 'សេចក្តីជូនដំណឹងថ្ងៃបើកប្រាក់ខែបុគ្គលិក' : 'Payday Alerts & Notifications'}</span>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-black bg-amber-50 text-amber-700 rounded-full border border-amber-200">
              {activeAlerts.length} {lang === 'kh' ? 'ដំណឹង' : 'Alerts'}
            </span>
          </div>

          <div className="p-5 divide-y divide-slate-100 max-h-[350px] overflow-y-auto space-y-3">
            {activeAlerts.length === 0 ? (
              <div className="text-slate-400 text-center py-10 text-xs font-medium">
                {lang === 'kh' ? 'មិនមានថ្ងៃបើកប្រាក់ខែត្រូវដោះស្រាយនៅឡើយទេ។' : 'No paydays require action at this moment.'}
              </div>
            ) : (
              activeAlerts.map((alert, i) => {
                const isUrgent = alert.type === 'urgent' || alert.type === 'pastdue';
                return (
                  <div key={i} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-700 leading-relaxed">
                        {lang === 'kh' ? (
                          <>
                            ថ្ងៃបើកប្រាក់ខែ <strong>{alert.periodName}</strong> របស់បុគ្គលិក <strong>{alert.emp.fullName}</strong>
                          </>
                        ) : (
                          <>
                            Payday <strong>{alert.periodName}</strong> for <strong>{alert.emp.fullName}</strong>
                          </>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {lang === 'kh' ? 'កំណត់ថ្ងៃបើក៖ ថ្ងៃទី' : 'Target Payday Cycle Day: '} {alert.dayVal}
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase ${
                      isUrgent 
                        ? 'bg-rose-50 text-rose-705 border-rose-100' 
                        : 'bg-amber-50 text-amber-705 border-amber-100'
                    }`}>
                      {alert.daysText}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Policy Rules (1/3 width) */}
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2 font-bold text-sm text-slate-800">
            <HelpCircle size={16} className="text-indigo-500" />
            <span>{lang === 'kh' ? 'ព័ត៌មានប្រព័ន្ធគណនា' : 'Payroll Policy Information'}</span>
          </div>

          <div className="p-5 flex-1 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              {/* Period 1 Rule */}
              <div className="space-y-1 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <h5 className="text-xs font-bold text-indigo-600">
                  {lang === 'kh' ? 'លក្ខខណ្ឌបើកលើកទី១ (ពាក់កណ្តាលខែ)' : '1st Payout (Mid-Month)'}
                </h5>
                <p className="text-[11.5px] text-slate-500 leading-relaxed font-medium">
                  {lang === 'kh' 
                    ? 'គណនាបន្ទាប់ពីចូលធ្វើការបាន ១៥ ថ្ងៃ (ស្មើនឹង ៥០% នៃប្រាក់ខែគោល)។'
                    : 'Calculated 15 days after join date (fixed at 50% of Basic Salary).'
                  }
                </p>
              </div>

              {/* Period 2 Rule */}
              <div className="space-y-1 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <h5 className="text-xs font-bold text-emerald-600">
                  {lang === 'kh' ? 'លក្ខខណ្ឌបើកលើកទី២ (ដាច់ខែ)' : '2nd Payout (End of Month)'}
                </h5>
                <p className="text-[11.5px] text-slate-500 leading-relaxed font-medium">
                  {lang === 'kh' 
                    ? 'គណនាបន្ទាប់ពីចូលធ្វើការបាន ៣០ ថ្ងៃ (ប្រាក់ខែគោល + ប្រាក់ថែមម៉ោង - បើកមុន - លើកទី១)។'
                    : 'Calculated 30 days after join date (Basic + OT + Allowances - Adv - Period 1).'
                  }
                </p>
              </div>
            </div>

            <div className="p-2.5 bg-indigo-50/50 text-[10px] text-slate-500 leading-relaxed border border-indigo-100 rounded-xl flex gap-2">
              <CircleAlert size={14} className="text-indigo-500 shrink-0 mt-0.5" />
              <span className="font-medium">
                {lang === 'kh' 
                  ? 'ប្រព័ន្ធគណនាប្រាក់ខែស្វ័យប្រវត្តនឹងអានទិន្នន័យពីថ្ងៃចូលធ្វើការរបស់បុគ្គលិកម្នាក់ៗ និងរៀបចំថ្ងៃទូទាត់រៀងរាល់ខែ។'
                  : 'The automated engine reads employee start dates and constructs precise 15-day/30-day payout cycles.'
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

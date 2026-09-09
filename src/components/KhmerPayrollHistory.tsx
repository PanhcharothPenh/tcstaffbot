/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Download, Trash2, Eye, FileSpreadsheet, RefreshCcw } from 'lucide-react';
import { Salary, Staff } from '../types';
import { exportToCSV } from '../utils';

interface KhmerPayrollHistoryProps {
  staffList: Staff[];
  salaries: Salary[];
  setSalaries: React.Dispatch<React.SetStateAction<Salary[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
  onOpenPayslip: (record: any) => void;
}

export default function KhmerPayrollHistory({
  staffList,
  salaries,
  setSalaries,
  lang,
  onAddLog,
  onOpenPayslip
}: KhmerPayrollHistoryProps) {
  const [monthFilter, setMonthFilter] = useState<number | ''>('');
  const [periodFilter, setPeriodFilter] = useState<number | ''>('');

  const filteredHistory = useMemo(() => {
    return salaries.filter(s => {
      const recordMonth = (s as any).month;
      const recordPeriod = (s as any).period;

      const matchesMonth = monthFilter === '' || recordMonth === monthFilter;
      const matchesPeriod = periodFilter === '' || recordPeriod === periodFilter;
      return matchesMonth && matchesPeriod;
    });
  }, [salaries, monthFilter, periodFilter]);

  const handleDeleteRecord = (id: string, name: string, amt: number) => {
    const confirmDelete = window.confirm(
      lang === 'kh'
        ? `តើអ្នកប្រាកដជាចង់លុបកំណត់ត្រាបើកប្រាក់ខែចំនួន $${amt} របស់បុគ្គលិក "${name}" ពីប្រវត្តិមែនទេ?`
        : `Are you sure you want to delete the payroll payout record of $${amt} for employee "${name}"?`
    );
    if (confirmDelete) {
      setSalaries(prev => prev.filter(s => s.id !== id));
      onAddLog(`Deleted payroll payout record of $${amt} for: "${name}" [Log ID: ${id}]`);
    }
  };

  const handleClearAllHistory = () => {
    const confirmClear = window.confirm(
      lang === 'kh'
        ? 'ការប្រុងប្រយ័ត្ន៖ សកម្មភាពនេះនឹងលុបប្រវត្តិបើកប្រាក់ខែទាំងអស់នៅក្នុងប្រព័ន្ធ! តើអ្នកប្រាកដជាចង់បន្តមែនទេ?'
        : 'Warning: This will clear the ENTIRE payroll payout history ledger! Do you want to proceed?'
    );
    if (confirmClear) {
      setSalaries([]);
      onAddLog('Cleared the entire payroll history ledger');
      alert(lang === 'kh' ? 'បានលុបប្រវត្តិទាំងអស់រួចរាល់!' : 'Entire payout history ledger cleared!');
    }
  };

  const handleExportCSV = () => {
    if (filteredHistory.length === 0) {
      alert(lang === 'kh' ? 'គ្មានទិន្នន័យសម្រាប់នាំចេញទេ!' : 'No data available to export!');
      return;
    }

    const headers = [
      'Payout ID',
      'Employee Name (En)',
      'Employee Name (Kh)',
      'Position',
      'Pay Month',
      'Pay Period Cycle',
      'Basic Salary ($)',
      'Worked Days',
      'Overtime Pay ($)',
      'Allowances ($)',
      'Advance Deduct ($)',
      'Deductions ($)',
      'Net Paid ($)',
      'Date Paid',
      'Status'
    ];

    const rows = filteredHistory.map(rec => {
      const pLabel = rec.salaryPeriod || '';
      return [
        rec.id,
        rec.staffName || '',
        (rec as any).empNameKh || '',
        rec.position || 'Staff',
        (rec as any).month || 'N/A',
        (rec as any).period || 'N/A',
        rec.baseSalary || 0,
        rec.daysWorked || 0,
        rec.overtime || 0,
        rec.bonus || 0,
        rec.advancePayment || 0,
        rec.deduction || 0,
        rec.netSalary || 0,
        rec.paymentDate || '',
        rec.status || ''
      ];
    });

    exportToCSV(`Khmer_Payroll_Report_${Date.now()}`, headers, rows);
    onAddLog('Exported payroll disbursement records to CSV');
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <span>{lang === 'kh' ? 'ប្រវត្តិនៃការទូទាត់ប្រាក់ខែ' : 'Payroll disbursement records'}</span>
          <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-lg font-mono font-bold">
            {filteredHistory.length}
          </span>
        </h2>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200/40"
          >
            <FileSpreadsheet size={13} />
            <span>{lang === 'kh' ? 'នាំចេញជា CSV' : 'Export CSV'}</span>
          </button>

          <button
            onClick={handleClearAllHistory}
            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-rose-100"
          >
            <Trash2 size={13} />
            <span>{lang === 'kh' ? 'លុបប្រវត្តិទាំងអស់' : 'Clear Ledger'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
            {lang === 'kh' ? 'ជ្រើសរើសខែ' : 'Filter Month'}
          </label>
          <select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-semibold"
          >
            <option value="">{lang === 'kh' ? 'គ្រប់ខែ' : 'All Months'}</option>
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
          <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
            {lang === 'kh' ? 'ការបើកលើកទី (Period)' : 'Filter Period'}
          </label>
          <select
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-all font-semibold"
          >
            <option value="">{lang === 'kh' ? 'គ្រប់លើក' : 'All Periods'}</option>
            <option value={1}>{lang === 'kh' ? 'លើកទី១ (Period 1)' : 'Period 1'}</option>
            <option value={2}>{lang === 'kh' ? 'លើកទី២ (Period 2)' : 'Period 2'}</option>
            <option value={3}>{lang === 'kh' ? 'បើកពេញ ១ខែ (Full Month)' : 'Full Month'}</option>
          </select>
        </div>
      </div>

      {/* Records Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
              <th className="py-2.5 px-3">{lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date Paid'}</th>
              <th className="py-2.5 px-3">{lang === 'kh' ? 'បុគ្គលិក' : 'Employee'}</th>
              <th className="py-2.5 px-3">{lang === 'kh' ? 'ខែ/លើក' : 'Month/Period'}</th>
              <th className="py-2.5 px-3">{lang === 'kh' ? 'ប្រាក់ខែគោល' : 'Base Salary'}</th>
              <th className="py-2.5 px-3">{lang === 'kh' ? 'ប្រាក់ជាក់ស្តែង' : 'Net Paid'}</th>
              <th className="py-2.5 px-3">{lang === 'kh' ? 'ស្ថានភាព' : 'Status'}</th>
              <th className="py-2.5 px-3 text-center">{lang === 'kh' ? 'សកម្មភាព' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-400">
                  {lang === 'kh' ? 'គ្មានទិន្នន័យប្រវត្តិបើកប្រាក់ខែទេ' : 'No payout history matching criteria.'}
                </td>
              </tr>
            ) : (
              filteredHistory.map(rec => {
                const isPaid = rec.status === 'Paid' || rec.status === 'paid';
                const khName = (rec as any).empNameKh || '';
                const enName = (rec as any).empNameEn || rec.staffName;

                let cycleLabel = '';
                if ((rec as any).period === 1) {
                  cycleLabel = lang === 'kh' ? 'លើកទី១' : 'Period 1';
                } else if ((rec as any).period === 2) {
                  cycleLabel = lang === 'kh' ? 'លើកទី២' : 'Period 2';
                } else {
                  cycleLabel = lang === 'kh' ? 'ពេញមួយខែ' : 'Full Month';
                }

                const monthNamesKh = ['', 'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
                const monthNamesEn = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const mLabel = lang === 'kh' ? monthNamesKh[(rec as any).month || 7] : monthNamesEn[(rec as any).month || 7];

                return (
                  <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{rec.paymentDate}</td>
                    <td className="py-3 px-3">
                      <strong className="text-slate-800 block">{enName}</strong>
                      {khName && <span className="text-[10px] text-slate-450 font-medium block mt-0.5">{khName}</span>}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-700 block">{mLabel} {rec.salaryPeriod?.split(' ')[1] || (rec as any).year}</span>
                      <span className="text-[10px] text-indigo-600 font-bold block mt-0.5">{cycleLabel}</span>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-500">${rec.baseSalary.toFixed(2)}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-600">${rec.netSalary.toFixed(2)}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${
                        isPaid 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {isPaid ? (lang === 'kh' ? 'បានបើករួច' : 'Paid') : (lang === 'kh' ? 'មិនទាន់បើក' : 'Not Paid')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => onOpenPayslip(rec)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer inline-flex"
                        title={lang === 'kh' ? 'មើលសន្លឹកវិក្កយបត្រ' : 'View Payslip'}
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(rec.id, enName, rec.netSalary)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg transition-all cursor-pointer inline-flex"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

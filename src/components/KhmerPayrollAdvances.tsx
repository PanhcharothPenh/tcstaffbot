/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Save, Trash2, Clock, CheckCircle2, CheckSquare } from 'lucide-react';
import { Staff, SalaryAdvance } from '../types';

interface KhmerPayrollAdvancesProps {
  staffList: Staff[];
  salaryAdvances: SalaryAdvance[];
  setSalaryAdvances: React.Dispatch<React.SetStateAction<SalaryAdvance[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function KhmerPayrollAdvances({
  staffList,
  salaryAdvances,
  setSalaryAdvances,
  lang,
  onAddLog
}: KhmerPayrollAdvancesProps) {
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'unpaid' | 'disbursed'>('disbursed');

  // Find selected employee to compute the 50% max allowance hint
  const selectedEmp = useMemo(() => {
    return staffList.find(e => e.id === selectedStaffId);
  }, [staffList, selectedStaffId]);

  const maxAllowedAdvance = useMemo(() => {
    if (!selectedEmp) return 0;
    return Number((selectedEmp.baseSalary * 0.5).toFixed(2));
  }, [selectedEmp]);

  const handleSaveAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || amount <= 0) return;

    if (selectedEmp && amount > maxAllowedAdvance) {
      const confirmExceed = window.confirm(
        lang === 'kh'
          ? `ការប្រុងប្រយ័ត្ន៖ ចំនួនទឹកប្រាក់បើកមុន ($${amount}) លើសពី ៥០% នៃប្រាក់ខែគោលបុគ្គលិក ($${maxAllowedAdvance})។ តើអ្នកនៅតែចង់កត់ត្រាការបើកនេះទេ?`
          : `Warning: Advance amount ($${amount}) exceeds 50% of the employee's Basic Salary ($${maxAllowedAdvance}). Do you still want to log this?`
      );
      if (!confirmExceed) return;
    }

    const newAdvance: SalaryAdvance = {
      id: 'adv_' + Date.now(),
      branchId: selectedEmp?.branchId || 'b1',
      staffId: selectedStaffId,
      amount,
      requestDate: date,
      status: (status === 'disbursed' ? 'Approved' : 'Pending') as any, // Sync with type status Pending/Approved/Paid
      reason: reason || 'Salary Advance Request',
      notes: status === 'disbursed' ? 'Disbursed' : 'Unpaid Request',
      createdAt: new Date().toISOString()
    };

    setSalaryAdvances(prev => [newAdvance, ...prev]);
    onAddLog(`Logged advance of $${amount.toFixed(2)} for staff: "${selectedEmp?.fullName}"`);

    // Reset Form
    setSelectedStaffId('');
    setAmount(0);
    setReason('');
  };

  const handleDeleteAdvance = (id: string, empName: string, amt: number) => {
    const confirmDelete = window.confirm(
      lang === 'kh' 
        ? `តើអ្នកពិតជាចង់លុបការបើកលុយមុនចំនួន $${amt} របស់បុគ្គលិក "${empName}" មែនទេ?` 
        : `Are you sure you want to delete the advance of $${amt} for employee "${empName}"?`
    );
    if (confirmDelete) {
      setSalaryAdvances(prev => prev.filter(a => a.id !== id));
      onAddLog(`Deleted advance record of $${amt} for: "${empName}"`);
    }
  };

  // Toggle Pending (unpaid) <-> Approved (disbursed) status inside the list
  const toggleAdvanceStatus = (id: string) => {
    setSalaryAdvances(prev => prev.map(a => {
      if (a.id === id) {
        // Only toggle if not already Deducted/Paid
        if (a.status === 'Paid' || (a as any).status === 'deducted') return a;
        
        const currentLower = String(a.status).toLowerCase();
        let nextStatus: any = 'Approved'; // disbursed
        let nextNotes = 'Disbursed';
        
        if (currentLower === 'approved' || currentLower === 'disbursed') {
          nextStatus = 'Pending'; // unpaid
          nextNotes = 'Unpaid Request';
        }
        
        onAddLog(`Toggled advance status of log ID ${id} to: ${nextStatus}`);
        return {
          ...a,
          status: nextStatus,
          notes: nextNotes
        };
      }
      return a;
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form Log Section (1/3 width) */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm h-fit">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>{lang === 'kh' ? 'កត់ត្រាការបើកប្រាក់មុន' : 'Record Salary Advance'}</span>
        </h3>

        <form onSubmit={handleSaveAdvance} className="space-y-4">
          <div>
            <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
              {lang === 'kh' ? 'ជ្រើសរើសបុគ្គលិក' : 'Select Employee *'}
            </label>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="w-full bg-slate-55 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-semibold"
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
            {selectedEmp && (
              <span className="text-[10px] text-amber-600 font-bold block mt-1 leading-normal">
                {lang === 'kh' 
                  ? `(ប្រាក់ខែគោល៖ $${selectedEmp.baseSalary} | អាចបើកមុនបានអតិបរមា ៥០% គឺ៖ $${maxAllowedAdvance})`
                  : `(Basic Salary: $${selectedEmp.baseSalary} | Max allowed advance (50%): $${maxAllowedAdvance})`
                }
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                {lang === 'kh' ? 'ចំនួនទឹកប្រាក់ ($)' : 'Advance Amount ($) *'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={amount === 0 ? '' : amount}
                onChange={e => setAmount(Number(e.target.value || '0'))}
                className="w-full bg-slate-55 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold outline-none focus:border-slate-400 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                {lang === 'kh' ? 'ថ្ងៃខែឆ្នាំបើក' : 'Date *'}
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-55 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 font-mono outline-none focus:border-slate-400 focus:bg-white font-semibold"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
              {lang === 'kh' ? 'ស្ថានភាពបើកប្រាក់' : 'Payment Status'}
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full bg-slate-55 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-semibold"
            >
              <option value="unpaid">{lang === 'kh' ? 'មិនទាន់បើកឱ្យ (Unpaid Request)' : 'Unpaid Request'}</option>
              <option value="disbursed">{lang === 'kh' ? 'បានបើករួចរាល់ (Disbursed)' : 'Disbursed (Approved)'}</option>
            </select>
          </div>

          <div>
            <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
              {lang === 'kh' ? 'មូលហេតុ / ចំណាំ' : 'Reason / Note'}
            </label>
            <input
              type="text"
              placeholder="e.g., Medical expense, tuition..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-slate-55 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-medium"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex justify-center items-center gap-1.5 shadow-sm"
          >
            <Save size={14} />
            <span>{lang === 'kh' ? 'កត់ត្រាការបើកមុន' : 'Log Advance Payout'}</span>
          </button>
        </form>
      </div>

      {/* History List Section (2/3 width) */}
      <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">
          {lang === 'kh' ? 'ប្រវត្តិការបើកប្រាក់មុនទាំងអស់' : 'Salary Advance Logs'}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-2.5 px-3">{lang === 'kh' ? 'បុគ្គលិក' : 'Employee'}</th>
                <th className="py-2.5 px-3">{lang === 'kh' ? 'ចំនួនទឹកប្រាក់' : 'Amount'}</th>
                <th className="py-2.5 px-3">{lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date'}</th>
                <th className="py-2.5 px-3">{lang === 'kh' ? 'ស្ថានភាព' : 'Status'}</th>
                <th className="py-2.5 px-3 text-center">{lang === 'kh' ? 'សកម្មភាព' : 'Remove'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
              {salaryAdvances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    {lang === 'kh' ? 'គ្មានទិន្នន័យការបើកប្រាក់មុនទេ' : 'No advances logged.'}
                  </td>
                </tr>
              ) : (
                salaryAdvances.map(adv => {
                  const emp = staffList.find(e => e.id === adv.staffId);
                  const empName = emp ? ((emp as any).nameEn || emp.fullName) : 'Unknown Staff';
                  
                  // Read status safely
                  const lowerStatus = String(adv.status).toLowerCase();
                  const isDeducted = lowerStatus === 'paid' || lowerStatus === 'deducted';
                  const isPending = lowerStatus === 'pending' || lowerStatus === 'unpaid';

                  let badgeColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  let icon = <CheckCircle2 size={11} />;
                  let textLabel = lang === 'kh' ? 'បានបើករួច' : 'Disbursed';

                  if (isPending) {
                    badgeColorClass = 'bg-rose-50 text-rose-700 border-rose-100';
                    icon = <Clock size={11} />;
                    textLabel = lang === 'kh' ? 'មិនទាន់បើក' : 'Unpaid Request';
                  } else if (isDeducted) {
                    badgeColorClass = 'bg-slate-100 text-slate-600 border-slate-200/50';
                    icon = <CheckSquare size={11} />;
                    textLabel = lang === 'kh' ? 'បានកាត់កងរួច' : 'Settled / Deducted';
                  }

                  return (
                    <tr key={adv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <strong className="text-slate-800 block">{empName}</strong>
                        <span className="text-[10px] text-slate-450 font-medium block mt-0.5">{adv.reason}</span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-rose-600">${adv.amount.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{adv.requestDate}</td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => toggleAdvanceStatus(adv.id)}
                          disabled={isDeducted}
                          className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${badgeColorClass} ${
                            isDeducted ? 'cursor-not-allowed opacity-80' : 'hover:scale-[1.03]'
                          }`}
                          title={isDeducted ? '' : (lang === 'kh' ? 'ចុចដើម្បីប្តូរស្ថានភាព' : 'Click to toggle status')}
                        >
                          {icon}
                          <span>{textLabel}</span>
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {!isDeducted ? (
                          <button
                            onClick={() => handleDeleteAdvance(adv.id, empName, adv.amount)}
                            className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer inline-flex"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

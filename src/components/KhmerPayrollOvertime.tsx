/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Save, Trash2, Sun, Moon } from 'lucide-react';
import { Staff } from '../types';
import { OvertimeLog } from '../utils/khmerPayrollUtils';

interface KhmerPayrollOvertimeProps {
  staffList: Staff[];
  overtimeLogs: OvertimeLog[];
  setOvertimeLogs: React.Dispatch<React.SetStateAction<OvertimeLog[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function KhmerPayrollOvertime({
  staffList,
  overtimeLogs,
  setOvertimeLogs,
  lang,
  onAddLog
}: KhmerPayrollOvertimeProps) {
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [days, setDays] = useState<number>(0);
  const [shift, setShift] = useState<'day' | 'night'>('day');
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  // Automatically compute days range when start or end date changes
  useEffect(() => {
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const diffTime = e.getTime() - s.getTime();
      let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (isNaN(diffDays) || diffDays < 0) diffDays = 0;
      setDays(diffDays);
    }
  }, [startDate, endDate]);

  const selectedEmp = useMemo(() => {
    return staffList.find(e => e.id === selectedStaffId);
  }, [staffList, selectedStaffId]);

  const empDailyRate = useMemo(() => {
    if (!selectedEmp) return 0;
    return (selectedEmp as any).dailyRate || Number((selectedEmp.baseSalary / 26).toFixed(2));
  }, [selectedEmp]);

  const handleSaveOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || days <= 0) return;

    // Calculate OT amount: days * dailyRate * multiplier
    const otAmount = Number((days * empDailyRate * multiplier).toFixed(2));

    const newOt: OvertimeLog = {
      id: 'ot_' + Date.now(),
      empId: selectedStaffId,
      days,
      multiplier,
      shift,
      startDate,
      endDate,
      note: note || 'Project extra duty',
      amount: otAmount
    };

    setOvertimeLogs(prev => [newOt, ...prev]);
    onAddLog(`Logged ${days} OT days (${shift} shift, multiplier ${multiplier}x) for staff: "${selectedEmp?.fullName}"`);

    // Reset Form
    setSelectedStaffId('');
    setNote('');
    setShift('day');
    setMultiplier(1.0);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
  };

  const handleDeleteOvertime = (id: string, empName: string, amt: number) => {
    const confirmDelete = window.confirm(
      lang === 'kh'
        ? `តើអ្នកចង់លុបការថែមម៉ោងតម្លៃ $${amt} របស់បុគ្គលិក "${empName}" មែនទេ?`
        : `Are you sure you want to delete this overtime log of $${amt} for employee "${empName}"?`
    );
    if (confirmDelete) {
      setOvertimeLogs(prev => prev.filter(o => o.id !== id));
      onAddLog(`Deleted overtime record of $${amt} for: "${empName}"`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form Section (1/3 width) */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm h-fit">
        <h3 className="text-sm font-bold text-slate-800 mb-4">
          {lang === 'kh' ? 'កត់ត្រាការថែមម៉ោង (គិតជាថ្ងៃ)' : 'Record Daily Overtime'}
        </h3>

        <form onSubmit={handleSaveOvertime} className="space-y-4">
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
            {selectedEmp && (
              <span className="text-[10px] text-teal-600 font-bold block mt-1 leading-normal">
                {lang === 'kh'
                  ? `(កម្រៃថែមម៉ោងបុគ្គលិកម្នាក់នេះ៖ $${empDailyRate.toFixed(2)} ក្នុងមួយថ្ងៃ)`
                  : `(Overtime daily rate: $${empDailyRate.toFixed(2)} / day)`
                }
              </span>
            )}
          </div>

          <div>
            <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
              {lang === 'kh' ? 'វេនការងារថែមម៉ោង (Overtime Shift)' : 'Overtime Shift'}
            </label>
            <select
              value={shift}
              onChange={e => setShift(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-semibold"
            >
              <option value="day">{lang === 'kh' ? 'វេនថ្ងៃ (Day Shift)' : 'Day Shift'}</option>
              <option value="night">{lang === 'kh' ? 'វេនយប់ (Night Shift)' : 'Night Shift'}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                {lang === 'kh' ? 'ចង្កៀងថ្ងៃថែម' : 'OT Days *'}
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={days === 0 ? '' : days}
                onChange={e => setDays(Number(e.target.value || '0'))}
                className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold outline-none focus:border-slate-400 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                {lang === 'kh' ? 'មេគុណថែមម៉ោង' : 'Multiplier'}
              </label>
              <select
                value={multiplier}
                onChange={e => setMultiplier(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 font-mono outline-none focus:border-slate-400 focus:bg-white font-bold"
              >
                <option value={1.0}>1.0x (Regular)</option>
                <option value={1.5}>1.5x (Afterhours)</option>
                <option value={2.0}>2.0x (Holiday/Sunday)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                {lang === 'kh' ? 'ថ្ងៃចាប់ផ្តើម' : 'Start Date *'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 font-mono outline-none focus:border-slate-400 focus:bg-white font-semibold"
                required
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                {lang === 'kh' ? 'ថ្ងៃបញ្ចប់' : 'End Date *'}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 font-mono outline-none focus:border-slate-400 focus:bg-white font-semibold"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
              {lang === 'kh' ? 'សម្គាល់' : 'Note / Remark'}
            </label>
            <input
              type="text"
              placeholder="e.g. Critical software update..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white font-medium"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex justify-center items-center gap-1.5 shadow-sm"
          >
            <Save size={14} />
            <span>{lang === 'kh' ? 'កត់ត្រាប្រាក់ថែមម៉ោង' : 'Log Overtime Days'}</span>
          </button>
        </form>
      </div>

      {/* History table list (2/3 width) */}
      <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">
          {lang === 'kh' ? 'បញ្ជីកត់ត្រាថែមម៉ោងទាំងអស់' : 'Overtime Log history'}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-2.5 px-3">{lang === 'kh' ? 'បុគ្គលិក' : 'Employee'}</th>
                <th className="py-2.5 px-3">{lang === 'kh' ? 'ចំនួនថ្ងៃថែម' : 'OT Days'}</th>
                <th className="py-2.5 px-3">{lang === 'kh' ? 'មេគុណ' : 'Rate'}</th>
                <th className="py-2.5 px-3">{lang === 'kh' ? 'ប្រាក់ទទួលបាន' : 'Amount Earned'}</th>
                <th className="py-2.5 px-3">{lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date Range'}</th>
                <th className="py-2.5 px-3 text-center">{lang === 'kh' ? 'សកម្មភាព' : 'Remove'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
              {overtimeLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    {lang === 'kh' ? 'គ្មានទិន្នន័យថែមម៉ោងទេ' : 'No overtime logs.'}
                  </td>
                </tr>
              ) : (
                overtimeLogs.map(ot => {
                  const emp = staffList.find(e => e.id === ot.empId);
                  const empName = emp ? ((emp as any).nameEn || emp.fullName) : 'Unknown Staff';
                  const dateRangeStr = ot.startDate === ot.endDate ? ot.startDate : `${ot.startDate} ~ ${ot.endDate}`;
                  
                  return (
                    <tr key={ot.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-slate-800">{empName}</strong>
                          {ot.shift === 'night' ? (
                            <span className="p-0.5 bg-amber-50 text-amber-700 rounded-md border border-amber-100 inline-flex" title="Night Shift">
                              <Moon size={10} />
                            </span>
                          ) : (
                            <span className="p-0.5 bg-sky-50 text-sky-700 rounded-md border border-sky-100 inline-flex" title="Day Shift">
                              <Sun size={10} />
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-450 font-medium block mt-0.5">{ot.note}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">{ot.days.toFixed(1)} {lang === 'kh' ? 'ថ្ងៃ' : 'days'}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{ot.multiplier.toFixed(1)}x</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-600">${ot.amount.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-[10.5px] text-slate-500">{dateRangeStr}</td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDeleteOvertime(ot.id, empName, ot.amount)}
                          className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer inline-flex"
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
    </div>
  );
}

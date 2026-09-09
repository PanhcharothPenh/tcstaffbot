/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sunrise, 
  Sun, 
  Moon, 
  UserCheck, 
  ShieldCheck, 
  Sparkles,
  ArrowRightLeft,
  Building2,
  CalendarDays
} from 'lucide-react';
import { Branch, Staff, Attendance, Role } from '../types';

interface ShiftCalendarViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  staffList: Staff[];
  attendance: Attendance[];
  lang: 'en' | 'kh';
  onAddLog?: (msg: string) => void;
}

export default function ShiftCalendarView({
  currentRole,
  activeBranchId,
  branches,
  staffList,
  attendance,
  lang,
  onAddLog
}: ShiftCalendarViewProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    return activeBranchId && activeBranchId !== 'all' ? activeBranchId : (branches[0]?.id || 'b1');
  });

  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Modal State for Shift Cover / Swap
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapDate, setSwapDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [swapStaffId, setSwapStaffId] = useState('');
  const [swapCoveredForId, setSwapCoveredForId] = useState('');
  const [swapShift, setSwapShift] = useState<'Morning' | 'Afternoon' | 'Night' | 'Full Time'>('Morning');
  const [swapNote, setSwapNote] = useState('');
  const [isSavingSwap, setIsSavingSwap] = useState(false);

  // Telegram Broadcast State
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Local Extra Shifts state synced with localStorage
  const [extraShifts, setExtraShifts] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('clean24_payroll_extra_shifts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const monthNamesKh = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayOfWeek = useMemo(() => {
    // 0 = Sunday, 1 = Monday, etc.
    return new Date(currentYear, currentMonth - 1, 1).getDay();
  }, [currentYear, currentMonth]);

  const selectedBranch = useMemo(() => {
    return branches.find(b => b.id === selectedBranchId) || branches[0];
  }, [branches, selectedBranchId]);

  const branchStaff = useMemo(() => {
    return staffList.filter(s => s.branchId === selectedBranchId && s.status === 'Active');
  }, [staffList, selectedBranchId]);

  const prevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const todayMonth = () => {
    setCurrentDate(new Date());
  };

  // Helper to get staff assigned to shifts on a date
  const getShiftsForDate = (dateStr: string) => {
    const result: Array<{
      staff: Staff;
      shift: string;
      isCover?: boolean;
      coveredFor?: string;
      attendance?: Attendance;
    }> = [];

    // Official staff assigned to this branch
    branchStaff.forEach(st => {
      // Check if there is an extra shift / cover on this date
      const cover = extraShifts.find(es => es.staffId === st.id && es.date && es.date.includes(dateStr));
      const att = attendance.find(a => a.staffId === st.id && a.date === dateStr);

      result.push({
        staff: st,
        shift: cover?.shift || st.shift || 'Full Time',
        isCover: !!cover,
        coveredFor: cover?.coveredForStaffName,
        attendance: att
      });
    });

    return result;
  };

  // Save Shift Cover / Substitution
  const handleSaveSwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapStaffId) {
      alert(lang === 'en' ? 'Please select working employee!' : 'សូមជ្រើសរើសបុគ្គលិកដែលមកធ្វើការ!');
      return;
    }

    setIsSavingSwap(true);
    try {
      const workingStaff = staffList.find(s => s.id === swapStaffId);
      const coveredStaff = staffList.find(s => s.id === swapCoveredForId);

      const newShift = {
        id: `es_${Date.now()}`,
        branchId: selectedBranchId,
        staffId: swapStaffId,
        staffName: workingStaff?.fullName || 'Staff',
        date: swapDate,
        shift: swapShift,
        shiftCount: 1,
        ratePerShift: 6,
        totalAmount: 6,
        coveredForStaffId: swapCoveredForId || undefined,
        coveredForStaffName: coveredStaff?.fullName || undefined,
        note: swapNote.trim() || undefined,
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      const updatedShifts = [newShift, ...extraShifts];
      setExtraShifts(updatedShifts);
      localStorage.setItem('clean24_payroll_extra_shifts', JSON.stringify(updatedShifts));

      if (onAddLog) {
        onAddLog(`Scheduled shift cover: ${workingStaff?.fullName} covering for ${coveredStaff?.fullName || 'Staff'} on ${swapDate}`);
      }

      setShowSwapModal(false);
      setSwapNote('');
      setSwapCoveredForId('');
    } catch (err: any) {
      alert('Error saving shift cover: ' + err.message);
    } finally {
      setIsSavingSwap(false);
    }
  };

  // Send Weekly Shift Schedule to Branch Telegram Group
  const handleSendTelegramSchedule = async () => {
    setIsSendingTelegram(true);
    setTelegramStatus(null);

    const bName = selectedBranch?.branchName || 'toto by Chichi';
    const monthText = lang === 'kh' ? monthNamesKh[currentMonth - 1] : monthNamesEn[currentMonth - 1];

    let scheduleLines = '';
    // Generate next 7 days summary
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dStr = d.toISOString().substring(0, 10);
      const dayName = d.toLocaleDateString(lang === 'kh' ? 'km-KH' : 'en-US', { weekday: 'short' });
      const shifts = getShiftsForDate(dStr);

      scheduleLines += `\n📅 <b>${dayName} (${dStr.substring(8, 10)}/${dStr.substring(5, 7)}):</b>\n`;
      if (shifts.length === 0) {
        scheduleLines += `  • <i>គ្មានបុគ្គលិក</i>\n`;
      } else {
        shifts.forEach(s => {
          const shiftIcon = s.shift === 'Morning' ? '🌅' : s.shift === 'Afternoon' ? '☀️' : s.shift === 'Night' ? '🌙' : '🔄';
          scheduleLines += `  ${shiftIcon} <b>${s.staff.fullName}</b> (${s.shift})${s.isCover ? ` [ជំនួស ${s.coveredFor || ''}]` : ''}\n`;
        });
      }
    }

    const message = `📋 <b>[Cafe - តារាងវេនការងារប្រចាំសប្តាហ៍ / Weekly Shift Roster]</b>\n\n` +
      `☕ <b>សាខាហាង:</b> <b>${bName}</b>\n` +
      `🗓️ <b>ខែ:</b> ${monthText} ${currentYear}\n` +
      `----------------------------------------` +
      scheduleLines +
      `\n🔔 <i>សូម Barista & បុគ្គលិកទាំងអស់មកបំពេញការងារឱ្យបានទៀងម៉ោង និងចុះឈ្មោះ Check-In តាម Telegram Bot ឱ្យបានត្រឹមត្រូវ!</i>`;

    try {
      const res = await fetch('/api/telegram-trigger-instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'daily_business',
          branchId: selectedBranchId,
          branchName: bName,
          message
        })
      });

      const data = await res.json();
      if (data.success) {
        setTelegramStatus({
          success: true,
          message: lang === 'kh' ? 'បានផ្ញើតារាងវេនការងារទៅកាន់ Telegram Group សាខាដោយជោគជ័យ!' : 'Shift schedule sent to branch Telegram group successfully!'
        });
      } else {
        setTelegramStatus({
          success: false,
          message: data.error || 'Failed to dispatch Telegram message'
        });
      }
    } catch (err: any) {
      setTelegramStatus({
        success: false,
        message: err.message
      });
    } finally {
      setIsSendingTelegram(false);
      setTimeout(() => setTelegramStatus(null), 6000);
    }
  };

  return (
    <div className="space-y-6 font-sans select-none pb-12">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={22} className="text-[#003D9B]" />
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {lang === 'en' ? 'Staff Shift Roster Calendar' : 'ប្រតិទិនតារាងវេនការងារបុគ្គលិក'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'en' ? 'Schedule, view daily shifts, assign shift substitutions, and broadcast rosters to Telegram' : 'ចាត់ចែង ពិនិត្យវេនការងារប្រចាំថ្ងៃ កត់ត្រាជំនួសវេន និងផ្ញើតារាងវេនទៅ Telegram'}
          </p>
        </div>

        {/* Branch Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                🏢 {b.branchName}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSwapDate(new Date().toISOString().substring(0, 10));
              setShowSwapModal(true);
            }}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <ArrowRightLeft size={14} />
            {lang === 'en' ? 'Assign Shift Cover (+$6)' : 'ចាត់ចែងជំនួសវេន (+$6)'}
          </button>

          <button
            type="button"
            onClick={handleSendTelegramSchedule}
            disabled={isSendingTelegram}
            className="px-3.5 py-2 bg-[#0052CC] hover:bg-[#003D9B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Send size={14} />
            {isSendingTelegram 
              ? (lang === 'en' ? 'Sending...' : 'កំពុងផ្ញើ...') 
              : (lang === 'en' ? 'Send to Telegram' : 'ផ្ញើតារាងវេនទៅ Telegram')}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {telegramStatus && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all ${
          telegramStatus.success 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {telegramStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{telegramStatus.message}</span>
        </div>
      )}

      {/* Calendar Navigation & Month Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>

          <h3 className="text-base font-black text-slate-900 min-w-[160px] text-center">
            {lang === 'kh' ? monthNamesKh[currentMonth - 1] : monthNamesEn[currentMonth - 1]} {currentYear}
          </h3>

          <button
            type="button"
            onClick={nextMonth}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>

          <button
            type="button"
            onClick={todayMonth}
            className="ml-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            {lang === 'en' ? 'Today' : 'ថ្ងៃនេះ'}
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> 🌅 {lang === 'en' ? 'Morning' : 'ព្រឹក'}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span> ☀️ {lang === 'en' ? 'Afternoon' : 'រសៀល'}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> 🌙 {lang === 'en' ? 'Night' : 'យប់'}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 🔄 {lang === 'en' ? 'Cover (+$6)' : 'ជំនួសវេន (+$6)'}</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-black text-slate-600 py-3">
          <span>{lang === 'en' ? 'Sun' : 'អាទិត្យ'}</span>
          <span>{lang === 'en' ? 'Mon' : 'ចន្ទ'}</span>
          <span>{lang === 'en' ? 'Tue' : 'អង្គារ'}</span>
          <span>{lang === 'en' ? 'Wed' : 'ពុធ'}</span>
          <span>{lang === 'en' ? 'Thu' : 'ព្រហ'}</span>
          <span>{lang === 'en' ? 'Fri' : 'សុក្រ'}</span>
          <span>{lang === 'en' ? 'Sat' : 'សៅរ៍'}</span>
        </div>

        {/* Calendar Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[110px] bg-slate-50/50 p-2"></div>
          ))}

          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isToday = dateStr === new Date().toISOString().substring(0, 10);
            const shifts = getShiftsForDate(dateStr);

            return (
              <div 
                key={`day-${dayNum}`} 
                className={`min-h-[110px] p-2 transition-colors flex flex-col justify-between ${
                  isToday ? 'bg-blue-50/40 font-bold' : 'hover:bg-slate-50/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday ? 'bg-[#003D9B] text-white' : 'text-slate-700'
                    }`}>
                      {dayNum}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setSwapDate(dateStr);
                        setShowSwapModal(true);
                      }}
                      className="text-[10px] text-slate-400 hover:text-[#0052CC] p-1 rounded hover:bg-white cursor-pointer transition-colors"
                      title={lang === 'en' ? 'Add shift cover for this day' : 'កត់ត្រាជំនួសវេនថ្ងៃនេះ'}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Staff Shift Badges */}
                  <div className="space-y-1">
                    {shifts.slice(0, 3).map((s, idx) => {
                      const isPresent = s.attendance?.checkIn && s.attendance.status !== 'Absent';
                      const isAbsent = s.attendance?.status === 'Absent';

                      return (
                        <div
                          key={idx}
                          className={`text-[10px] px-1.5 py-0.5 rounded-lg font-semibold flex items-center justify-between border ${
                            s.isCover
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : s.shift === 'Morning'
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : s.shift === 'Afternoon'
                              ? 'bg-sky-50 border-sky-200 text-sky-900'
                              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                          }`}
                        >
                          <span className="truncate max-w-[80px]">
                            {s.staff.fullName}
                          </span>
                          
                          <span className="text-[9px] opacity-75 shrink-0">
                            {s.isCover ? '+$6' : (isPresent ? '✓' : isAbsent ? '✗' : '')}
                          </span>
                        </div>
                      );
                    })}

                    {shifts.length > 3 && (
                      <span className="text-[9px] font-bold text-slate-400 pl-1 block">
                        +{shifts.length - 3} {lang === 'en' ? 'more' : 'ទៀត'}
                      </span>
                    )}
                  </div>
                </div>

                {shifts.length === 0 && (
                  <span className="text-[9px] text-slate-300 text-center block my-auto">
                    {lang === 'en' ? 'Off' : 'សម្រាក'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: ASSIGN SHIFT COVER / SUBSTITUTE */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-emerald-600" />
                {lang === 'en' ? 'Assign Shift Cover' : 'កត់ត្រាការជំនួសវេនការងារ'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSwapModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSwap} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  📅 {lang === 'en' ? 'Date of Shift' : 'កាលបរិច្ឆេទជំនួសវេន'}
                </label>
                <input
                  type="date"
                  value={swapDate}
                  onChange={e => setSwapDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  👤 {lang === 'en' ? 'Employee Working (Receives +$6)' : 'បុគ្គលិកដែលមកធ្វើការ (អ្នកទទួលបាន +$6)'}
                </label>
                <select
                  value={swapStaffId}
                  onChange={e => setSwapStaffId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none cursor-pointer"
                  required
                >
                  <option value="">-- {lang === 'en' ? 'Select working staff' : 'ជ្រើសរើសបុគ្គលិក'} --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({branches.find(b => b.id === s.branchId)?.branchName || s.branchId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  🔄 {lang === 'en' ? 'Covering For (Employee on Leave)' : 'ជំនួសឱ្យ (បុគ្គលិកដែលសុំច្បាប់/អវត្តមាន)'}
                </label>
                <select
                  value={swapCoveredForId}
                  onChange={e => setSwapCoveredForId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="">-- {lang === 'en' ? 'Optional / None' : 'មិនដាក់ក៏បាន'} --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ⏰ {lang === 'en' ? 'Shift Type' : 'វេនការងារ'}
                  </label>
                  <select
                    value={swapShift}
                    onChange={e => setSwapShift(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="Morning">🌅 {lang === 'en' ? 'Morning (ព្រឹក)' : 'វេនព្រឹក'}</option>
                    <option value="Afternoon">☀️ {lang === 'en' ? 'Afternoon (រសៀល)' : 'វេនរសៀល'}</option>
                    <option value="Night">🌙 {lang === 'en' ? 'Night (យប់)' : 'វេនយប់'}</option>
                    <option value="Full Time">🔄 {lang === 'en' ? 'Full Time (ពេញម៉ោង)' : 'ពេញម៉ោង'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    💵 {lang === 'en' ? 'Shift Rate' : 'កម្រៃវេន'}
                  </label>
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700 text-center">
                    +$6.00 / វេន
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  📝 {lang === 'en' ? 'Note / Reason' : 'មូលហេតុ / សម្គាល់'}
                </label>
                <input
                  type="text"
                  value={swapNote}
                  onChange={e => setSwapNote(e.target.value)}
                  placeholder={lang === 'en' ? 'e.g. Sopheak sick leave coverage' : 'ឧ. ជំនួស សុភ័ក្ត្រ សុំច្បាប់ឈឺ'}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSwapModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  {lang === 'en' ? 'Cancel' : 'បោះបង់'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingSwap}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer transition-all shadow-xs"
                >
                  {isSavingSwap ? 'Saving...' : (lang === 'en' ? 'Save & Add to Payroll' : 'រក្សាទុក & បូកចូលប្រាក់ខែ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

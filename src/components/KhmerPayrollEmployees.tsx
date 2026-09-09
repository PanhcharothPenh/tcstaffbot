/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { Staff } from '../types';
import { getEmployeePaydays } from '../utils/khmerPayrollUtils';

interface KhmerPayrollEmployeesProps {
  staffList: Staff[];
  setStaff?: React.Dispatch<React.SetStateAction<Staff[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function KhmerPayrollEmployees({
  staffList,
  setStaff,
  lang,
  onAddLog
}: KhmerPayrollEmployeesProps) {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setReportFilter] = useState('');

  // Form Fields State
  const [empId, setEmpId] = useState('');
  const [nameKh, setNameKh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [position, setPosition] = useState<any>('Cashier');
  const [startDate, setStartDate] = useState('');
  const [basicSalary, setBasicSalary] = useState(0);
  const [standardDays, setStandardDays] = useState(26);
  const [dailyRate, setDailyRate] = useState(0);

  // Position options
  const uniquePositions = useMemo(() => {
    return Array.from(new Set(staffList.map(s => s.position).filter(Boolean)));
  }, [staffList]);

  // Live payday calculation hints for modal form
  const livePaydays = useMemo(() => {
    return getEmployeePaydays(startDate);
  }, [startDate]);

  // Auto calculate daily rate when salary/days change
  const handleSalaryChange = (salVal: number, daysVal: number) => {
    setBasicSalary(salVal);
    if (salVal > 0) {
      const calculatedRate = Number((salVal / daysVal).toFixed(2));
      setDailyRate(calculatedRate);
    }
  };

  const handleOpenModal = (editEmp: Staff | null = null) => {
    if (editEmp) {
      // Edit mode
      setEmpId(editEmp.id);
      setNameKh((editEmp as any).nameKh || '');
      setNameEn((editEmp as any).nameEn || editEmp.fullName);
      setPosition(editEmp.position);
      setStartDate(editEmp.startDate);
      setBasicSalary(editEmp.baseSalary);
      setStandardDays((editEmp as any).standardDays || 26);
      setDailyRate((editEmp as any).dailyRate || Number((editEmp.baseSalary / 26).toFixed(2)));
    } else {
      // Add mode
      setEmpId('');
      setNameKh('');
      setNameEn('');
      setPosition('Cashier');
      setStartDate(new Date().toISOString().split('T')[0]);
      setBasicSalary(500);
      setStandardDays(26);
      setDailyRate(Number((500 / 26).toFixed(2)));
    }
    setShowModal(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setStaff) return;

    const staffData: Staff = {
      id: empId || 'staff_' + Date.now(),
      branchId: 'b1', // default branch
      fullName: nameEn || nameKh || 'Staff',
      gender: 'Male',
      dob: '2000-01-01',
      phone: '012345678',
      address: 'Phnom Penh',
      position,
      shift: 'Full Time',
      startDate,
      baseSalary: basicSalary,
      status: 'Active',
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      idCardNumber: 'N/A',
      emergencyContact: '012345678',
      ...({
        nameKh,
        nameEn,
        standardDays,
        dailyRate
      } as any)
    };

    if (empId) {
      setStaff(prev => prev.map(s => s.id === empId ? { ...s, ...staffData } : s));
      onAddLog(`Updated employee: "${staffData.fullName}" [ID: ${empId}]`);
    } else {
      setStaff(prev => [staffData, ...prev]);
      onAddLog(`Added new employee: "${staffData.fullName}"`);
    }

    setShowModal(false);
  };

  const handleDeleteEmployee = (id: string, name: string) => {
    const confirmation = window.confirm(
      lang === 'kh' 
        ? `តើអ្នកប្រាកដជាចង់លុបបុគ្គលិក "${name}" ពីប្រព័ន្ធមែនទេ?` 
        : `Are you sure you want to delete employee "${name}" from the system?`
    );
    if (confirmation && setStaff) {
      setStaff(prev => prev.filter(s => s.id !== id));
      onAddLog(`Deleted employee: "${name}" [ID: ${id}]`);
    }
  };

  // Filter Table rows
  const filteredStaff = useMemo(() => {
    return staffList.filter(emp => {
      const nameMatch = 
        emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ((emp as any).nameKh || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        ((emp as any).nameEn || '').toLowerCase().includes(searchQuery.toLowerCase());
      const posMatch = positionFilter === '' || emp.position === positionFilter;
      return nameMatch && posMatch;
    });
  }, [staffList, searchQuery, positionFilter]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span>{lang === 'kh' ? 'បញ្ជីឈ្មោះបុគ្គលិក' : 'Employee Directory'}</span>
            <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-lg font-mono font-bold">
              {filteredStaff.length}
            </span>
          </h2>
          
          <button 
            onClick={() => handleOpenModal(null)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Plus size={14} />
            <span>{lang === 'kh' ? 'បន្ថែមបុគ្គលិក' : 'Add Employee'}</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px] relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <Search size={14} />
            </span>
            <input 
              type="text" 
              placeholder={lang === 'kh' ? 'ស្វែងរកឈ្មោះ ឬតួនាទី...' : 'Search name or position...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-250/80 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-750 placeholder-slate-400 outline-none focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          <select 
            value={positionFilter}
            onChange={e => setReportFilter(e.target.value)}
            className="bg-slate-50 border border-slate-250/80 rounded-xl px-3.5 py-2 text-xs text-slate-650 outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
          >
            <option value="">{lang === 'kh' ? 'គ្រប់តួនាទី' : 'All Positions'}</option>
            {uniquePositions.map((pos, idx) => (
              <option key={idx} value={pos}>{pos}</option>
            ))}
          </select>
        </div>

        {/* Employee Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[10.5px] uppercase font-bold tracking-wider bg-slate-50">
                <th className="py-3 px-4">{lang === 'kh' ? 'ឈ្មោះបុគ្គលិក' : 'Employee Name'}</th>
                <th className="py-3 px-4">{lang === 'kh' ? 'តួនាទី' : 'Position'}</th>
                <th className="py-3 px-4">{lang === 'kh' ? 'ថ្ងៃចូលធ្វើការ' : 'Start Date'}</th>
                <th className="py-3 px-4">{lang === 'kh' ? 'ប្រាក់ខែគោល' : 'Basic Salary'}</th>
                <th className="py-3 px-4">{lang === 'kh' ? 'កម្រៃថែមម៉ោង/ថ្ងៃ' : 'OT Rate/Day'}</th>
                <th className="py-3 px-4">{lang === 'kh' ? 'ថ្ងៃបើកប្រាក់ (លើក១/លើក២)' : 'Paydays (1st / 2nd)'}</th>
                <th className="py-3 px-4 text-center">{lang === 'kh' ? 'សកម្មភាព' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    {lang === 'kh' ? 'គ្មានទិន្នន័យបុគ្គលិកទេ' : 'No employees found.'}
                  </td>
                </tr>
              ) : (
                filteredStaff.map(emp => {
                  const paydays = getEmployeePaydays(emp.startDate);
                  const khName = (emp as any).nameKh || '';
                  const enName = (emp as any).nameEn || emp.fullName;
                  const stdDays = (emp as any).standardDays || 26;
                  const otRate = (emp as any).dailyRate || Number((emp.baseSalary / stdDays).toFixed(2));
                  const avatarChar = (enName.trim() || 'E').charAt(0).toUpperCase();

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-xs shadow-inner">
                          {avatarChar}
                        </div>
                        <div>
                          <strong className="text-slate-800 font-extrabold block">{enName}</strong>
                          {khName && <span className="text-[10px] text-slate-400 font-medium block">{khName}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">{emp.position}</td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">{emp.startDate}</td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-slate-800">
                        <div>${emp.baseSalary.toFixed(2)}</div>
                        <span className="text-[9.5px] text-slate-400 font-normal">
                          {stdDays} {lang === 'kh' ? 'ថ្ងៃស្តង់ដារ' : 'std days'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">${otRate.toFixed(2)}</td>
                      <td className="py-3.5 px-4 space-y-1">
                        <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded-md font-bold mr-1.5 border border-indigo-100">
                          {lang === 'kh' ? 'លើក១: ថ្ងៃ' : 'P1: Day '} {paydays.p1}
                        </span>
                        <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] rounded-md font-bold border border-emerald-100">
                          {lang === 'kh' ? 'លើក២: ថ្ងៃ' : 'P2: Day '} {paydays.p2}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center space-x-1 whitespace-nowrap">
                        <button 
                          onClick={() => handleOpenModal(emp)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-lg transition-all cursor-pointer inline-flex"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDeleteEmployee(emp.id, enName)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded-lg transition-all cursor-pointer inline-flex"
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

      {/* Modal: Add/Edit Staff Profile */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto no-print">
          <div className="bg-white border border-slate-100 rounded-2xl max-w-lg w-full shadow-lg p-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-black text-slate-800 text-base">
                {empId ? (lang === 'kh' ? 'កែសម្រួលព័ត៌មានបុគ្គលិក' : 'Edit Employee details') : (lang === 'kh' ? 'បន្ថែមបុគ្គលិកថ្មី' : 'Add New Employee')}
              </h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-slate-400 hover:text-slate-600 transition-all text-xl cursor-pointer font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4 pt-4">
              <div className="form-group">
                <label className="text-[11px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                  {lang === 'kh' ? 'ឈ្មោះជាភាសាខ្មែរ (Khmer Name) *' : 'Khmer Name *'}
                </label>
                <input 
                  type="text" 
                  value={nameKh} 
                  onChange={e => setNameKh(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 font-medium" 
                  required 
                  placeholder="ឧ. ចាន់ ធារ៉ា"
                />
              </div>

              <div className="form-group">
                <label className="text-[11px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                  {lang === 'kh' ? 'ឈ្មោះជាភាសាអង់គ្លេស (English Name) *' : 'English Name *'}
                </label>
                <input 
                  type="text" 
                  value={nameEn} 
                  onChange={e => setNameEn(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 font-medium" 
                  required 
                  placeholder="Example: Chan Theara"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {lang === 'kh' ? 'តួនាទី (Position) *' : 'Position *'}
                  </label>
                  <input 
                    type="text" 
                    value={position} 
                    onChange={e => setPosition(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 font-medium" 
                    required 
                    placeholder="Cashier, Manager, Technician"
                  />
                </div>
                <div className="form-group">
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {lang === 'kh' ? 'ថ្ងៃចូលធ្វើការ (Joining Start Date) *' : 'Joining Start Date *'}
                  </label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 font-mono font-medium" 
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {lang === 'kh' ? 'ប្រាក់ខែគោល ($) *' : 'Basic Salary ($) *'}
                  </label>
                  <input 
                    type="number" 
                    value={basicSalary === 0 ? '' : basicSalary} 
                    onChange={e => handleSalaryChange(Number(e.target.value), standardDays)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold outline-none focus:border-indigo-500" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {lang === 'kh' ? 'ថ្ងៃធ្វើការស្តង់ដារ' : 'Standard Days'}
                  </label>
                  <select 
                    value={standardDays} 
                    onChange={e => handleSalaryChange(basicSalary, Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none focus:border-indigo-500 font-bold cursor-pointer"
                  >
                    <option value={26}>{lang === 'kh' ? '២៦ ថ្ងៃ' : '26 Days'}</option>
                    <option value={30}>{lang === 'kh' ? '៣០ ថ្ងៃ' : '30 Days'}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {lang === 'kh' ? 'កម្រៃថែមម៉ោង/ថ្ងៃ ($)' : 'Daily OT Rate ($)'}
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={dailyRate === 0 ? '' : dailyRate} 
                    onChange={e => setDailyRate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold outline-none focus:border-indigo-500" 
                    required 
                  />
                </div>
              </div>

              {/* LIVE CYCLE HINTS */}
              <div className="border border-indigo-100 bg-indigo-50/40 p-4 rounded-xl space-y-2">
                <div className="text-[10.5px] font-bold text-indigo-750 uppercase tracking-wide">
                  {lang === 'kh' ? 'ថ្ងៃបើកប្រាក់ខែតាមការគណនា' : 'Calculated Payout cycle (Based on Join Date)'}
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">{lang === 'kh' ? 'លើកទី១' : 'Period 1'}</span>
                    <span className="text-slate-700 font-bold">{lang === 'kh' ? `ថ្ងៃទី ${livePaydays.p1} នៃខែ` : `Day ${livePaydays.p1} of each month`}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">{lang === 'kh' ? 'លើកទី២' : 'Period 2'}</span>
                    <span className="text-slate-700 font-bold">{lang === 'kh' ? `ថ្ងៃទី ${livePaydays.p2} នៃខែ` : `Day ${livePaydays.p2} of each month`}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {lang === 'kh' ? 'បោះបង់' : 'Cancel'}
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
                >
                  {lang === 'kh' ? 'រក្សាទុក' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

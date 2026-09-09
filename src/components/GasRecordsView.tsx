/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Flame, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Printer, 
  Download, 
  X,
  Database,
  RefreshCw,
  Gauge
} from 'lucide-react';
import { GasRecord, Role, Branch } from '../types';
import { translations } from '../mockData';
import { formatCurrency, exportToCSV, printElement } from '../utils';

interface GasRecordsViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  gasRecords: GasRecord[];
  setGasRecords: React.Dispatch<React.SetStateAction<GasRecord[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
  exchangeRate: number;
}

export default function GasRecordsView({
  currentRole,
  activeBranchId,
  branches,
  gasRecords,
  setGasRecords,
  lang,
  onAddLog,
  exchangeRate
}: GasRecordsViewProps) {
  const isOwner = currentRole === 'Owner';
  const isManager = currentRole === 'Manager';
  const isStaff = currentRole === 'Staff';
  const t = translations[lang];

  // UI State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('all');

  // Form Fields
  const [formDate, setFormDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [formBranchId, setFormBranchId] = useState('b1');
  const [formTankCount, setFormTankCount] = useState<number>(2);
  const [formRemainingKg, setFormRemainingKg] = useState<number>(45);
  const [formType, setFormType] = useState<'Refill' | 'Use'>('Use');
  const [formCost, setFormCost] = useState<number>(0);
  const [formNote, setFormNote] = useState('');

  const handleTypeChange = (nextType: 'Refill' | 'Use') => {
    setFormType(nextType);
    if (nextType === 'Use') {
      setFormCost(0);
    } else {
      setFormCost(34); // $34 typical refilling price for high capacity tank
    }
  };

  // Separation by branch
  const getFilteredRecords = () => {
    let list = gasRecords;

    if (isManager || isStaff) {
      list = list.filter(g => g.branchId === 'b1');
    } else if (currentRole === 'Admin') {
      list = list.filter(g => g.branchId === 'b1' || g.branchId === 'b2');
    }

    if (activeBranchId !== 'all') {
      list = list.filter(g => g.branchId === activeBranchId);
    } else if (filterBranchId !== 'all') {
      list = list.filter(g => g.branchId === filterBranchId);
    }

    if (startDate) {
      list = list.filter(g => g.date >= startDate);
    }
    if (endDate) {
      list = list.filter(g => g.date <= endDate);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(g => g.note.toLowerCase().includes(term) || g.createdBy.toLowerCase().includes(term));
    }

    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  };

  const filtered = getFilteredRecords();

  // Gas level calculator (latest log remaining kg)
  const getGasRemainingKg = () => {
    // Return latest entry for current selective context
    if (filtered.length > 0) {
      return filtered[0].remainingKg;
    }
    return 0;
  };

  const getRefillExpenses = () => {
    return filtered
      .filter(g => g.type === 'Refill')
      .reduce((sum, current) => sum + current.cost, 0);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const actualBranch = (isManager || isStaff) ? 'b1' : formBranchId;

    if (editingId) {
      const updated = gasRecords.map(g => {
        if (g.id === editingId) {
          return {
            ...g,
            branchId: actualBranch,
            date: formDate,
            tankCount: formTankCount,
            remainingKg: formRemainingKg,
            type: formType,
            cost: formCost,
            note: formNote,
            updatedAt: new Date().toISOString()
          };
        }
        return g;
      });
      setGasRecords(updated);
      onAddLog(`Updated dryer gas record #${editingId.substring(4, 8)} (${formRemainingKg} kg remaining)`);
      setEditingId(null);
    } else {
      const newRecord: GasRecord = {
        id: 'gas_' + Date.now().toString().slice(-6),
        branchId: actualBranch,
        date: formDate,
        tankCount: formTankCount,
        remainingKg: formRemainingKg,
        type: formType,
        cost: formCost,
        createdBy: currentRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        note: formNote
      };
      setGasRecords([newRecord, ...gasRecords]);
      onAddLog(`Created gas entry (${formRemainingKg} kg remaining, ${formType})`);
    }

    setShowForm(false);
    setFormDate(new Date().toISOString().substring(0, 10));
    setFormTankCount(2);
    setFormRemainingKg(45);
    setFormNote('');
  };

  const handleEdit = (g: GasRecord) => {
    setEditingId(g.id);
    setFormBranchId(g.branchId);
    setFormDate(g.date);
    setFormTankCount(g.tankCount);
    setFormRemainingKg(g.remainingKg);
    setFormType(g.type);
    setFormCost(g.cost);
    setFormNote(g.note);
    setShowForm(true);
  };

  const handleDelete = (id: string, kg: number) => {
    if (confirm(lang === 'en' ? 'Are you sure you want to delete this gas log?' : 'តើអ្នកពិតជាចង់លុបប័ណ្ណហ្គាសនេះមែនទេ?')) {
      const updated = gasRecords.filter(g => g.id !== id);
      setGasRecords(updated);
      onAddLog(`Deleted gas log entry with ${kg} kg`);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      lang === 'en' ? 'ID' : 'លេខកូដ',
      lang === 'en' ? 'Branch' : 'សាខា',
      lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ',
      lang === 'en' ? 'Type' : 'លក្ខណៈ',
      lang === 'en' ? 'Tanks Count' : 'ចំនួនធុង',
      lang === 'en' ? 'Remaining Gas (kg)' : 'ចំណុះហ្គាសដែលនៅសល់ (គីឡូ)',
      lang === 'en' ? 'Cost (USD)' : 'ចំណាយ',
      lang === 'en' ? 'Created By' : 'បង្កើតដោយ',
      lang === 'en' ? 'Notes' : 'កំណត់ចំណាំ'
    ];

    const rows = filtered.map(g => {
      const branchName = branches.find(b => b.id === g.branchId)?.branchName || g.branchId;
      return [
        g.id,
        branchName,
        g.date,
        g.type,
        g.tankCount,
        g.remainingKg,
        g.cost,
        g.createdBy,
        g.note
      ];
    });

    exportToCSV(`Gas_Records_Report_2026`, headers, rows);
    onAddLog('Exported gas operational ledger to Excel CSV');
  };

  const handlePrint = () => {
    printElement('gas-records-table-print', lang === 'en' ? 'Dryer Gas Level Ledger' : 'សៀវភៅបញ្ជីកម្រិតហ្គាសម៉ាស៊ីនសម្ងួត');
    onAddLog('Printed dryer gas report');
  };

  return (
    <div className="space-y-6" id="gas-records-view">
      {/* Action Button Bar */}
      <div className="flex justify-end items-center">
        <button 
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors text-sm shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          {lang === 'en' ? 'Log Gas Level' : 'កត់ត្រាហ្គាសថ្មី'}
        </button>
      </div>

      {/* Bento Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            {lang === 'en' ? 'Gas Remaining' : 'ហ្គាសនៅសល់ស្មាន'}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-sans text-rose-600">{getGasRemainingKg()}</span>
            <span className="text-sm font-semibold text-slate-500">Kg (LPG)</span>
          </div>
          <div className="mt-2 text-xs">
            {getGasRemainingKg() <= 20 ? (
              <span className="text-red-600 font-bold animate-pulse">⚠️ {lang === 'en' ? 'CRITICAL LOW LEVEL' : 'កម្រិតទាបគ្រោះថ្នាក់'}</span>
            ) : (
              <span className="text-emerald-600 font-medium font-sans">🟢 {lang === 'en' ? 'Safe Operating Margin' : 'ដំណើរការមានសុវត្ថិភាព'}</span>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            {lang === 'en' ? 'Gas Refills Expenses' : 'ចំណាយទិញហ្គាសថែម'}
          </span>
          <div className="mt-2">
            <span className="text-2xl font-bold font-sans text-slate-800">
              {formatCurrency(getRefillExpenses(), 'USD', exchangeRate)}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            ≈ {formatCurrency(getRefillExpenses(), 'KHR', exchangeRate)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            {lang === 'en' ? 'Refill Events Count' : 'ចំនួនដងនៃការបញ្ជូលគិត'}
          </span>
          <div className="mt-2">
            <span className="text-2xl font-bold font-sans text-slate-800">
              {filtered.filter(x => x.type === 'Refill').length} Times
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-sans">
            Average cost per refill: $68.00 USD
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            {lang === 'en' ? 'LPG Active Tanks' : 'ធុងហ្គាសធំសកម្ម'}
          </span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl font-bold font-sans text-slate-800">
              {filtered.length > 0 ? filtered[0].tankCount : 2} Units
            </span>
            <Gauge className="h-6 w-6 text-indigo-500" />
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Standard LPG Propane 45 Kg cylinder model
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={lang === 'en' ? "Search notes, creator..." : "ស្វែងរកកំណត់ចំណាំ ឬអ្នកបង្កើត..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white rounded-xl text-sm outline-hidden transition-all text-slate-750"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isOwner && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">{lang === 'en' ? 'Branch:' : 'សាខា:'}</span>
                <select 
                  value={filterBranchId}
                  onChange={(e) => setFilterBranchId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl py-2 px-3 outline-hidden focus:border-red-500 transition-colors"
                >
                  <option value="all">{lang === 'en' ? 'All Branches' : 'គ្រប់សាខា'}</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">{lang === 'en' ? 'From:' : 'ពី:'}</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl py-2 px-3 outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">{lang === 'en' ? 'To:' : 'ដល់:'}</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl py-2 px-3 outline-hidden"
              />
            </div>

            <button 
              onClick={handlePrint}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors border border-slate-200"
            >
              <Printer className="h-4 w-4" />
            </button>

            <button 
              onClick={handleExportExcel}
              className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition-colors border border-rose-200 flex items-center gap-2 text-xs font-semibold"
            >
              <Download className="h-4 w-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden" id="gas-records-table-print">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider font-sans">
              <th className="py-4 px-6">{lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Branch' : 'សាខា'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Event Type' : 'លក្ខណៈប្រើប្រាស់'}</th>
              <th className="py-4 px-6 text-right">{lang === 'en' ? 'Tanks Online' : 'ចំនួនធុង'}</th>
              <th className="py-4 px-6 text-right">{lang === 'en' ? 'Remaining Gas' : 'ចំណុះនៅសល់'}</th>
              <th className="py-4 px-6 text-right">{lang === 'en' ? 'Refilling Cost' : 'ចំណាយលើការទិញ'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Logged By' : 'កត់ត្រាដោយ'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Notes' : 'កំណត់ចំណាំ'}</th>
              <th className="py-4 px-6 text-center print:hidden">{lang === 'en' ? 'Actions' : 'សកម្មភាព'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 font-medium text-sm">
                  {lang === 'en' ? 'No dryer gas logs found matching selected constraints.' : 'មិនទាន់មានទិន្នន័យកត់ត្រាហ្គាសទេ។'}
                </td>
              </tr>
            ) : (
              filtered.map((g) => {
                const branchName = branches.find(b => b.id === g.branchId)?.branchName || g.branchId;
                return (
                  <tr key={g.id} className="hover:bg-slate-50/50 border-b border-slate-100 transition-colors text-slate-700 text-sm">
                    <td className="py-4 px-6 font-mono text-xs">{g.date}</td>
                    <td className="py-4 px-6 font-semibold text-slate-800">{branchName}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        g.type === 'Refill' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {g.type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-bold tracking-tight">{g.tankCount} Tanks</td>
                    <td className="py-4 px-6 text-right font-mono text-xs font-bold text-slate-900">
                      {g.remainingKg} Kg LPG
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-slate-800">
                      {g.cost > 0 ? formatCurrency(g.cost, 'USD', exchangeRate) : '-'}
                    </td>
                    <td className="py-4 px-6 text-slate-500 font-medium">{g.createdBy}</td>
                    <td className="py-4 px-6 text-slate-500 max-w-xs truncate" title={g.note}>{g.note || '-'}</td>
                    <td className="py-4 px-6 text-center space-x-1.5 print:hidden">
                      <button 
                        onClick={() => handleEdit(g)}
                        className="p-1 px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      {currentRole === 'Owner' && (
                        <button 
                          onClick={() => handleDelete(g.id, g.remainingKg)}
                          className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 text-slate-800">
              <h2 className="text-lg font-bold font-sans">
                {editingId ? 'Modify Gas Status' : 'Log Propane Consumption'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 mt-4 text-slate-800">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
                  <input type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Cylinder Status Type</label>
                  <select value={formType} onChange={(e) => handleTypeChange(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm">
                    <option value="Use">Use (Discharge)</option>
                    <option value="Refill">Refill (Purchase replacement)</option>
                  </select>
                </div>
              </div>

              {isOwner && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Branch</label>
                  <select value={formBranchId} onChange={(e) => setFormBranchId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm">
                    {branches.map(b => <option key={b.id} value={b.id}>{b.branchName}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Total Active Cylinders</label>
                  <input type="number" required min={0} value={formTankCount} onChange={(e) => setFormTankCount(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Remaining LPG (Kg)</label>
                  <input type="number" required min={0} value={formRemainingKg} onChange={(e) => setFormRemainingKg(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" />
                </div>
              </div>

              {formType === 'Refill' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Procurement Cost (USD)</label>
                  <input type="number" required min={0} value={formCost} onChange={(e) => setFormCost(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold text-red-650" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Operations Reference Note</label>
                <textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="E.g., calibration check by Khorn Sothea..." className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm h-20 resize-none" />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-400">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs">Save Log</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

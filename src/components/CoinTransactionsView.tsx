/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Coins, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Printer, 
  Download, 
  Filter,
  Check,
  X,
  PlusCircle,
  TrendingUp,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { CoinTransaction, Role, Branch } from '../types';
import { db } from '../mockData';
import { formatCurrency, formatDualCurrency, exportToCSV, printElement } from '../utils';

interface CoinTransactionsViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  coinTransactions: CoinTransaction[];
  setCoinTransactions: React.Dispatch<React.SetStateAction<CoinTransaction[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
  exchangeRate: number;
}

export default function CoinTransactionsView({
  currentRole,
  activeBranchId,
  branches,
  coinTransactions,
  setCoinTransactions,
  lang,
  onAddLog,
  exchangeRate
}: CoinTransactionsViewProps) {
  const isOwner = currentRole === 'Owner';
  const isManager = currentRole === 'Manager';
  const isStaff = currentRole === 'Staff';
  
  // UI State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('all');

  // Form Fields
  const [formDate, setFormDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [formBranchId, setFormBranchId] = useState(branches[0]?.id || 'b1');
  const [formAmount, setFormAmount] = useState<number>(100);
  const [formValueUsd, setFormValueUsd] = useState<number>(25);
  const [formType, setFormType] = useState<'In' | 'Out'>('In');
  const [formNote, setFormNote] = useState('');

  // Auto calculate USD value when coin amount is modified (assuming 1 coin = $0.25 token rate)
  const handleAmountChange = (amt: number) => {
    setFormAmount(amt);
    setFormValueUsd(amt * 0.25);
  };

  // Branch separation logic
  const getFilteredTransactions = () => {
    let list = Array.isArray(coinTransactions) ? coinTransactions : [];

    // Interactive UI filters
    if (activeBranchId !== 'all') {
      list = list.filter(tx => tx.branchId === activeBranchId);
    } else if (filterBranchId !== 'all') {
      list = list.filter(tx => tx.branchId === filterBranchId);
    }

    if (startDate) {
      list = list.filter(tx => tx.date >= startDate);
    }
    if (endDate) {
      list = list.filter(tx => tx.date <= endDate);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        tx =>
          tx.note.toLowerCase().includes(term) ||
          tx.createdBy.toLowerCase().includes(term) ||
          tx.amount.toString().includes(term)
      );
    }

    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  };

  const filtered = getFilteredTransactions();

  // Summary logic
  const totalIn = filtered.filter(t => t.type === 'In').reduce((sum, current) => sum + current.amount, 0);
  const totalOut = filtered.filter(t => t.type === 'Out').reduce((sum, current) => sum + current.amount, 0);
  const coinsBalance = totalIn - totalOut;

  // Monthly and Yearly summaries for display
  const getMonthlyTotal = () => {
    return filtered
      .filter(tx => tx.date.startsWith('2026-06'))
      .reduce((sum, current) => sum + (current.type === 'In' ? current.valueUsd : -current.valueUsd), 0);
  };

  const getYearlyTotal = () => {
    return filtered
      .filter(tx => tx.date.startsWith('2026'))
      .reduce((sum, current) => sum + (current.type === 'In' ? current.valueUsd : -current.valueUsd), 0);
  };

  // Actions
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const actualBranch = (isManager || isStaff) ? 'b1' : formBranchId;

    if (editingId) {
      const updated = coinTransactions.map(tx => {
        if (tx.id === editingId) {
          return {
            ...tx,
            branchId: actualBranch,
            date: formDate,
            amount: formAmount,
            valueUsd: formValueUsd,
            type: formType,
            note: formNote,
            updatedAt: new Date().toISOString()
          };
        }
        return tx;
      });
      setCoinTransactions(updated);
      onAddLog(`Updated coin transaction #${editingId.substring(4, 8)} (${formAmount} coins)`);
      setEditingId(null);
    } else {
      const newTx: CoinTransaction = {
        id: 'coin_' + Date.now().toString().slice(-6),
        branchId: actualBranch,
        date: formDate,
        amount: formAmount,
        valueUsd: formValueUsd,
        type: formType,
        createdBy: currentRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        note: formNote
      };
      setCoinTransactions([newTx, ...coinTransactions]);
      onAddLog(`Created new coin transaction of ${formAmount} coins (${formType})`);
    }

    // Reset Form
    setShowForm(false);
    setFormDate(new Date().toISOString().substring(0, 10));
    setFormAmount(100);
    setFormValueUsd(25);
    setFormNote('');
  };

  const handleEdit = (tx: CoinTransaction) => {
    setEditingId(tx.id);
    setFormBranchId(tx.branchId);
    setFormDate(tx.date);
    setFormAmount(tx.amount);
    setFormValueUsd(tx.valueUsd);
    setFormType(tx.type);
    setFormNote(tx.note);
    setShowForm(true);
  };

  const handleDelete = (id: string, amount: number) => {
    if (confirm(lang === 'en' ? 'Are you sure you want to delete this coin transaction?' : 'តើអ្នកពិតជាចង់លុបប្រតិបត្តិការកាក់នេះមែនទេ?')) {
      const updated = coinTransactions.filter(tx => tx.id !== id);
      setCoinTransactions(updated);
      onAddLog(`Deleted coin transaction #${id.substring(4, 8)} (${amount} coins)`);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      lang === 'en' ? 'TX ID' : 'អត្តសញ្ញាណ',
      lang === 'en' ? 'Branch' : 'សាខា',
      lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ',
      lang === 'en' ? 'Type' : 'ប្រភេទ',
      lang === 'en' ? 'Coins Count' : 'ចំនួនកាក់',
      lang === 'en' ? 'USD Value' : 'តម្លៃដុល្លារ',
      lang === 'en' ? 'KHR Value' : 'តម្លៃរៀល',
      lang === 'en' ? 'Created By' : 'បង្កើតដោយ',
      lang === 'en' ? 'Notes' : 'កំណត់ចំណាំ'
    ];

    const rows = filtered.map(tx => {
      const branchName = branches.find(b => b.id === tx.branchId)?.branchName || tx.branchId;
      return [
        tx.id,
        branchName,
        tx.date,
        tx.type,
        tx.amount,
        tx.valueUsd,
        Math.round(tx.valueUsd * exchangeRate),
        tx.createdBy,
        tx.note
      ];
    });

    exportToCSV(`Coin_Transactions_Report_2026`, headers, rows);
    onAddLog('Exported coin ledger report to Excel CSV');
  };

  const handlePrint = () => {
    printElement('coin-transactions-table-print', lang === 'en' ? 'Coin Transactions Ledger' : 'សៀវភៅបញ្ជីកាក់ដំណើរការ');
    onAddLog('Printed coin transactions ledger report');
  };

  return (
    <div className="space-y-6" id="coin-billing-view">
      {/* Action Button Bar */}
      <div className="flex justify-end items-center">
        <button 
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors text-sm shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          {lang === 'en' ? 'Add Transaction' : 'បញ្ចូលប្រតិបត្តិការថ្មី'}
        </button>
      </div>

      {/* Summary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            {lang === 'en' ? 'Refilled Coins (IN)' : 'កាក់បញ្ជូលសរុប (IN)'}
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-sans text-slate-800">{totalIn.toLocaleString()}</div>
            <div className="text-xs text-slate-500 font-mono">
              {formatCurrency(totalIn * 0.25, 'USD', exchangeRate)}
            </div>
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> +{formatCurrency(totalIn * 0.25, 'KHR', exchangeRate)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            {lang === 'en' ? 'Collected Coins (OUT)' : 'កាក់ដកចេញសរុប (OUT)'}
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-sans text-slate-800">{totalOut.toLocaleString()}</div>
            <div className="text-xs text-slate-500 font-mono">
              {formatCurrency(totalOut * 0.25, 'USD', exchangeRate)}
            </div>
          </div>
          <div className="mt-2 text-xs text-red-600 font-medium select-none">
            {formatCurrency(totalOut * 0.25, 'KHR', exchangeRate)} OUT
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            {lang === 'en' ? 'Net Vault Balance' : 'តុល្យភាពកាក់ក្នុងទូ'}
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <div className={`text-2xl font-bold font-sans ${coinsBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
              {coinsBalance.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {formatCurrency(coinsBalance * 0.25, 'USD', exchangeRate)}
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            {formatCurrency(coinsBalance * 0.25, 'KHR', exchangeRate)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            {lang === 'en' ? 'P&L Monthly / Yearly' : 'ចំណូលដកចំណាយកាក់'}
          </span>
          <div className="mt-2">
            <div className="flex justify-between items-center text-sm font-semibold text-slate-700">
              <span>{lang === 'en' ? 'June:' : 'មិថុនា:'}</span>
              <span className={getMonthlyTotal() >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {formatCurrency(getMonthlyTotal(), 'USD', exchangeRate)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm font-semibold text-slate-700 mt-1">
              <span>{lang === 'en' ? 'Year 2026:' : 'ឆ្នាំ២០២៦:'}</span>
              <span className={getYearlyTotal() >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {formatCurrency(getYearlyTotal(), 'USD', exchangeRate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Database Filters Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={lang === 'en' ? "Search by notes, amount, or creator..." : "ស្វែងរកកំណត់ចំណាំ ចំនួន ឬអ្នកបង្កើត..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-sm transition-all outline-hidden text-slate-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Branch Filter */}
            {isOwner && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">{lang === 'en' ? 'Branch:' : 'សាខា:'}</span>
                <select 
                  value={filterBranchId}
                  onChange={(e) => setFilterBranchId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl py-2 px-3 outline-hidden focus:border-emerald-500 transition-colors"
                >
                  <option value="all">{lang === 'en' ? 'All Branches' : 'គ្រប់សាខា'}</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Filters */}
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
              title={lang === 'en' ? "Print Ledger" : "បោះពុម្ភរបាយការណ៍"}
            >
              <Printer className="h-4 w-4" />
            </button>

            <button 
              onClick={handleExportExcel}
              className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors border border-emerald-200 flex items-center gap-2 text-xs font-semibold"
              title={lang === 'en' ? "Export as CSV" : "ទាញយកជា CSV"}
            >
              <Download className="h-4 w-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden" id="coin-transactions-table-print">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider font-sans">
              <th className="py-4 px-6">{lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Branch' : 'សាខា'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Type' : 'ប្រភេទ'}</th>
              <th className="py-4 px-6 text-right">{lang === 'en' ? 'Coins Amount' : 'ចំនួនកាក់'}</th>
              <th className="py-4 px-6 text-right">{lang === 'en' ? 'USD Value' : 'តម្លៃដុល្លារ'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Created By' : 'កត់ត្រាដោយ'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Notes' : 'កំណត់ចំណាំ'}</th>
              <th className="py-4 px-6 text-center print:hidden">{lang === 'en' ? 'Actions' : 'សកម្មភាព'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 font-medium text-sm">
                  {lang === 'en' ? 'No coin transactions found matching the filter criteria.' : 'មិនមានប្រតិបត្តិការកាក់ត្រូវបានរកឃើញទេ។'}
                </td>
              </tr>
            ) : (
              filtered.map((tx) => {
                const branchName = branches.find(b => b.id === tx.branchId)?.branchName || tx.branchId;
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/50 border-b border-slate-100 transition-colors text-slate-700 text-sm">
                    <td className="py-4 px-6 font-mono text-xs">{tx.date}</td>
                    <td className="py-4 px-6 font-semibold text-slate-800">{branchName}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        tx.type === 'In' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {tx.type === 'In' ? 'In (Refill)' : 'Out (Vault Collection)'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-bold tracking-tight text-slate-900">
                      {tx.amount.toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-xs font-bold text-slate-800">
                      {formatDualCurrency(tx.valueUsd, exchangeRate)}
                    </td>
                    <td className="py-4 px-6 text-slate-500 font-medium">{tx.createdBy}</td>
                    <td className="py-4 px-6 text-slate-500 max-w-xs truncate" title={tx.note}>{tx.note || '-'}</td>
                    <td className="py-4 px-6 text-center space-x-1.5 print:hidden">
                      <button 
                        onClick={() => handleEdit(tx)}
                        className="p-1 px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all inline-flex items-center gap-1 text-xs font-semibold"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      {currentRole === 'Owner' && (
                        <button 
                          onClick={() => handleDelete(tx.id, tx.amount)}
                          className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all inline-flex items-center gap-1 text-xs font-semibold"
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

      {/* Editor Modal Popup Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-100 transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 text-slate-800">
              <h2 className="text-lg font-bold font-sans">
                {editingId 
                  ? (lang === 'en' ? 'Modify Coin Transaction' : 'កែប្រែប្រតិបត្តិការកាក់') 
                  : (lang === 'en' ? 'Log Coin Transaction' : 'កត់ត្រាប្រតិបត្តិការកាក់ថ្មី')}
              </h2>
              <button 
                onClick={() => setShowForm(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ'}</label>
                  <input 
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-750 p-2.5 rounded-xl text-sm focus:bg-white focus:border-emerald-500 outline-hidden transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'en' ? 'Type' : 'ប្រភេទ'}</label>
                  <select 
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'In' | 'Out')}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-750 p-2.5 rounded-xl text-sm focus:bg-white focus:border-emerald-500 outline-hidden transition-all"
                  >
                    <option value="In">In (Vault Refill)</option>
                    <option value="Out">Out (Vault Retrieval)</option>
                  </select>
                </div>
              </div>

              {isOwner && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'en' ? 'Branch Office' : 'សាខាការិយាល័យ'}</label>
                  <select 
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-750 p-2.5 rounded-xl text-sm focus:bg-white focus:border-emerald-500 outline-hidden transition-all"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.branchName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'en' ? 'Coins Count' : 'ចំនួនកាក់'}</label>
                <input 
                  type="number"
                  required
                  min={1}
                  value={formAmount}
                  onChange={(e) => handleAmountChange(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-750 p-2.5 rounded-xl text-sm focus:bg-white focus:border-emerald-500 outline-hidden transition-all font-sans font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'en' ? 'Calculated Value' : 'តម្លៃបញ្ជាក់ដុល្លារ'}</label>
                <div className="w-full bg-slate-100/80 border border-slate-200 text-slate-600 p-2.5 rounded-xl text-sm font-semibold select-none">
                  {formatDualCurrency(formValueUsd, exchangeRate)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{lang === 'en' ? 'Description / Vault Note' : 'ការពិពណ៍នា / កំណត់ចំណាំ'}</label>
                <textarea 
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder={lang === 'en' ? "Add transaction reference info..." : "បញ្ចូលព័ត៌មានយោងផ្សេងៗ..."}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-755 p-2.5 rounded-xl text-sm focus:bg-white focus:border-emerald-500 outline-hidden transition-all h-20 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 text-sm font-semibold transition-colors"
                >
                  {lang === 'en' ? 'Cancel' : 'បោះបង់'}
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs"
                >
                  {lang === 'en' ? 'Save Transaction' : 'រក្សាទុកប្រតិបត្តិការ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

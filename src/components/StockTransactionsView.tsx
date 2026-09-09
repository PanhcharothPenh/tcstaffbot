/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Boxes, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Printer, 
  Download, 
  X,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { StockTransaction, Role, Branch } from '../types';
import { translations } from '../mockData';
import { formatCurrency, exportToCSV, printElement } from '../utils';

interface StockTransactionsViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  stockTransactions: StockTransaction[];
  setStockTransactions: React.Dispatch<React.SetStateAction<StockTransaction[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
  exchangeRate: number;
}

const COMMON_ITEMS = [
  'Bubble Lavender Soap',
  'Premium Fabric Conditioner',
  'Heavy Laundry Bags (L)',
  'Standard Dryer Sheets',
  'Wire Clothes Hangers',
  'Automatic Bleach Liquid'
];

export default function StockTransactionsView({
  currentRole,
  activeBranchId,
  branches,
  stockTransactions,
  setStockTransactions,
  lang,
  onAddLog,
  exchangeRate
}: StockTransactionsViewProps) {
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
  const [formItemName, setFormItemName] = useState('Bubble Lavender Soap');
  const [formCustomItem, setFormCustomItem] = useState('');
  const [useCustomItem, setUseCustomItem] = useState(false);
  const [formQuantity, setFormQuantity] = useState<number>(10);
  const [formCurrentStock, setFormCurrentStock] = useState<number>(45);
  const [formType, setFormType] = useState<'In' | 'Use'>('In');
  const [formNote, setFormNote] = useState('');

  const getFilteredTransactions = () => {
    let list = stockTransactions;

    if (isManager || isStaff) {
      list = list.filter(s => s.branchId === 'b1');
    } else if (currentRole === 'Admin') {
      list = list.filter(s => s.branchId === 'b1' || s.branchId === 'b2');
    }

    if (activeBranchId !== 'all') {
      list = list.filter(s => s.branchId === activeBranchId);
    } else if (filterBranchId !== 'all') {
      list = list.filter(s => s.branchId === filterBranchId);
    }

    if (startDate) {
      list = list.filter(s => s.date >= startDate);
    }
    if (endDate) {
      list = list.filter(s => s.date <= endDate);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        s =>
          s.itemName.toLowerCase().includes(term) ||
          s.note.toLowerCase().includes(term) ||
          s.createdBy.toLowerCase().includes(term)
      );
    }

    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  };

  const filtered = getFilteredTransactions();

  // Low Stock Alerts Counter (Unique item list with latest stock < 10)
  const getLowStockAlertsCount = () => {
    // Map item name -> latest stock
    const registry: Record<string, number> = {};
    const sortedChronological = [...stockTransactions].sort((a, b) => a.date.localeCompare(b.date));
    
    sortedChronological.forEach(tx => {
      registry[tx.itemName] = tx.currentStock;
    });

    return Object.values(registry).filter(stock => stock < 10).length;
  };

  const uniqueLowStockItems = () => {
    const registry: Record<string, { branchId: string; stock: number }> = {};
    const sortedChronological = [...stockTransactions].sort((a, b) => a.date.localeCompare(b.date));
    
    sortedChronological.forEach(tx => {
      registry[tx.itemName] = { branchId: tx.branchId, stock: tx.currentStock };
    });

    return Object.entries(registry)
      .filter(([_, data]) => data.stock < 10)
      .map(([name, data]) => ({ name, ...data }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const actualBranch = (isManager || isStaff) ? 'b1' : formBranchId;
    const resolvedItemName = useCustomItem ? formCustomItem : formItemName;

    if (!resolvedItemName) return;

    if (editingId) {
      const updated = stockTransactions.map(s => {
        if (s.id === editingId) {
          return {
            ...s,
            branchId: actualBranch,
            date: formDate,
            itemName: resolvedItemName,
            quantity: formQuantity,
            currentStock: formCurrentStock,
            type: formType,
            note: formNote,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      });
      setStockTransactions(updated);
      onAddLog(`Updated stock transaction #${editingId.substring(4, 8)} (${resolvedItemName})`);
      setEditingId(null);
    } else {
      const newRecord: StockTransaction = {
        id: 'stk_' + Date.now().toString().slice(-6),
        branchId: actualBranch,
        date: formDate,
        itemId: 'manual',
        itemName: resolvedItemName,
        quantity: formQuantity,
        currentStock: formCurrentStock,
        type: formType,
        cost: 0,
        createdBy: currentRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        note: formNote
      };
      setStockTransactions([newRecord, ...stockTransactions]);
      onAddLog(`Logged stock transaction: ${resolvedItemName} (${formQuantity} units, ${formType})`);
    }

    setShowForm(false);
    setFormDate(new Date().toISOString().substring(0, 10));
    setFormQuantity(10);
    setFormCurrentStock(45);
    setFormNote('');
    setFormCustomItem('');
    setUseCustomItem(false);
  };

  const handleEdit = (s: StockTransaction) => {
    setEditingId(s.id);
    setFormBranchId(s.branchId);
    setFormDate(s.date);
    
    if (COMMON_ITEMS.includes(s.itemName)) {
      setFormItemName(s.itemName);
      setUseCustomItem(false);
    } else {
      setFormCustomItem(s.itemName);
      setUseCustomItem(true);
    }

    setFormQuantity(s.quantity);
    setFormCurrentStock(s.currentStock);
    setFormType(s.type);
    setFormNote(s.note);
    setShowForm(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(lang === 'en' ? 'Are you sure you want to delete this stock transaction?' : 'តើអ្នកពិតជាចង់លុបប័ណ្ណទំនិញនេះមែនទេ?')) {
      const updated = stockTransactions.filter(s => s.id !== id);
      setStockTransactions(updated);
      onAddLog(`Deleted stock entry for ${name}`);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      lang === 'en' ? 'ID' : 'លេខបញ្ជី',
      lang === 'en' ? 'Branch' : 'សាខា',
      lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ',
      lang === 'en' ? 'Item Name' : 'ឈ្មោះទំនិញ',
      lang === 'en' ? 'Type' : 'លក្ខណៈ',
      lang === 'en' ? 'Qty Delta' : 'បរិមាណកើន/ថយ',
      lang === 'en' ? 'Current stock level' : 'កម្រិតសល់សរុប',
      lang === 'en' ? 'Creator' : 'កត់ត្រាដោយ',
      lang === 'en' ? 'Notes' : 'កំណត់ចំណាំ'
    ];

    const rows = filtered.map(s => {
      const branchName = branches.find(b => b.id === s.branchId)?.branchName || s.branchId;
      return [
        s.id,
        branchName,
        s.date,
        s.itemName,
        s.type,
        s.quantity,
        s.currentStock,
        s.createdBy,
        s.note
      ];
    });

    exportToCSV(`Stock_Transactions_Report_2026`, headers, rows);
    onAddLog('Exported stock transactions ledger report');
  };

  const handlePrint = () => {
    printElement('stock-transactions-table-print', lang === 'en' ? 'Operations Inventory Ledger' : 'សៀវភៅបញ្ជីកត់ត្រាទំនិញឃ្លាំង');
    onAddLog('Printed operations inventory report');
  };

  return (
    <div className="space-y-6" id="stock-transactions-view">
      {/* Action Button Bar */}
      <div className="flex justify-end items-center">
        <button 
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors text-sm shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          {lang === 'en' ? 'Log Supply Transaction' : 'កត់ត្រាទំនិញថ្មី'}
        </button>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Low Stock Card */}
        <div className="bg-red-50 text-red-850 p-5 rounded-2xl border border-red-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-red-600 font-semibold uppercase tracking-wider">
            {lang === 'en' ? 'Critical low stock alerts' : 'ការជូនដំណឹងទំនិញជិតអស់'}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-sans text-red-600">{getLowStockAlertsCount()}</span>
            <span className="text-sm font-semibold text-red-700">SKUs Warning</span>
          </div>
          <div className="mt-2 text-xs flex items-center gap-1.5 bg-red-100 py-1.5 px-2.5 rounded-lg font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 animate-pulse" />
            {lang === 'en' ? 'Soap reserves falling beneath safe operating levels!' : 'សាប៊ូកក់ខ្លះកំពុងជិតអស់ពីស្តុកហើយ!'}
          </div>
        </div>

        {/* List of Low Stock items */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs md:col-span-2 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            {lang === 'en' ? 'Active Low Stock Registries' : 'បញ្ជីទំនិញជិតអស់'}
          </span>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {uniqueLowStockItems().length === 0 ? (
              <p className="text-slate-400 font-medium py-3">All items safely exceed replenishment standards.</p>
            ) : (
              uniqueLowStockItems().map((it, idx) => {
                const branchName = branches.find(b => b.id === it.branchId)?.branchName || it.branchId;
                return (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-700">{it.name} <span className="font-mono text-slate-400 text-3xs">({branchName})</span></span>
                    <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-md">
                      {it.stock} Units left
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={lang === 'en' ? "Search item name, notes, creator..." : "ស្វែងរកឈ្មោះទំនិញ កំណត់ចំណាំ ឬអ្នកបង្កើត..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-sm outline-hidden transition-all text-slate-755"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors border border-emerald-200 flex items-center gap-2 text-xs font-semibold"
            >
              <Download className="h-4 w-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden" id="stock-transactions-table-print">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider font-sans">
              <th className="py-4 px-6">{lang === 'en' ? 'Date' : 'កាលបរិច្ឆេទ'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Branch' : 'សាខា'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'SKU Description Item' : 'ទំនិញ/សម្ភារៈ'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Event' : 'លក្ខណៈ'}</th>
              <th className="py-4 px-6 text-right">{lang === 'en' ? 'Qty Delta' : 'បរិមាណប្តូរ'}</th>
              <th className="py-4 px-6 text-right">{lang === 'en' ? 'Stock Balance' : 'ស្តុកសល់សរុប'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Logged By' : 'កត់ត្រាដោយ'}</th>
              <th className="py-4 px-6">{lang === 'en' ? 'Notes' : 'កំណត់ចំណាំ'}</th>
              <th className="py-4 px-6 text-center print:hidden">{lang === 'en' ? 'Actions' : 'សកម្មភាព'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 font-medium text-sm">
                  {lang === 'en' ? 'No operational supply logs found.' : 'មិនទាន់មានប្រតិបត្តិការទំនិញទេ។'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const branchName = branches.find(b => b.id === s.branchId)?.branchName || s.branchId;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 border-b border-slate-100 transition-colors text-slate-705 text-sm">
                    <td className="py-4 px-6 font-mono text-xs">{s.date}</td>
                    <td className="py-4 px-6 font-semibold text-slate-800">{branchName}</td>
                    <td className="py-4 px-6 font-semibold text-slate-900">{s.itemName}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        s.type === 'In' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {s.type === 'In' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                        {s.type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-slate-850">
                      {s.type === 'In' ? `+${s.quantity}` : `-${s.quantity}`}
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-xs font-bold">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-sans font-semibold text-xs ${
                        s.currentStock < 10 ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {s.currentStock} Units
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500 font-medium">{s.createdBy}</td>
                    <td className="py-4 px-6 text-slate-500 max-w-xs truncate" title={s.note}>{s.note || '-'}</td>
                    <td className="py-4 px-6 text-center space-x-1.5 print:hidden">
                      <button 
                        onClick={() => handleEdit(s)}
                        className="p-1 px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      {currentRole === 'Owner' && (
                        <button 
                          onClick={() => handleDelete(s.id, s.itemName)}
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-100 text-slate-800">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold font-sans">
                {editingId ? 'Modify Inventory Entry' : 'Log Supply Acquisition'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
                  <input type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Log Type</label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm">
                    <option value="In">Stock In (Refill / Procurement)</option>
                    <option value="Use">Stock Out (Regular consumption)</option>
                  </select>
                </div>
              </div>

              {isOwner && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Target Branch</label>
                  <select value={formBranchId} onChange={(e) => setFormBranchId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm">
                    {branches.map(b => <option key={b.id} value={b.id}>{b.branchName}</option>)}
                  </select>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-500">Inventory Item SKU</label>
                  <button 
                    type="button" 
                    onClick={() => setUseCustomItem(!useCustomItem)}
                    className="text-3xs text-emerald-600 font-bold hover:underline"
                  >
                    {useCustomItem ? "Select Preset" : "Write Custom Name"}
                  </button>
                </div>
                
                {useCustomItem ? (
                  <input 
                    type="text"
                    required
                    placeholder="Enter custom inventory name..."
                    value={formCustomItem}
                    onChange={(e) => setFormCustomItem(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm"
                  />
                ) : (
                  <select 
                    value={formItemName} 
                    onChange={(e) => setFormItemName(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm"
                  >
                    {COMMON_ITEMS.map((item, id) => <option key={id} value={item}>{item}</option>)}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Delta Quantity</label>
                  <input type="number" required min={1} value={formQuantity} onChange={(e) => setFormQuantity(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Remaining Stock Level</label>
                  <input type="number" required min={0} value={formCurrentStock} onChange={(e) => setFormCurrentStock(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Librarian Note</label>
                <textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Refill standard, logged by warehouse..." className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm h-20 resize-none" />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-400">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs">Apply</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

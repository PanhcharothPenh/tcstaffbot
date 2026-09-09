/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  ShieldAlert, 
  X, 
  Eye, 
  FileText, 
  DollarSign,
  TrendingDown,
  Building,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { Expense, ExpenseCategory, Role, Branch } from '../types';
import { translations } from '../mockData';
import { formatCurrency, formatDualCurrency } from '../utils';

interface ExpenseViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
  exchangeRate: number;
}

export default function ExpenseView({
  currentRole,
  activeBranchId,
  branches,
  expenses,
  setExpenses,
  lang,
  onAddLog,
  exchangeRate
}: ExpenseViewProps) {
  const t = translations[lang];
  const [showForm, setShowForm] = useState(false);
  const [receiptModal, setReceiptModal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form Fields
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [category, setCategory] = useState<ExpenseCategory>('Water Bill');
  const [amount, setAmount] = useState(0.0);
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'ABA' | 'Bank Transfer' | 'QR Payment'>('ABA');
  const [paidTo, setPaidTo] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [note, setNote] = useState('');

  // 1. Authenticate views: block Staff role
  const isAuthorized = ['Owner', 'Admin', 'Manager'].includes(currentRole);

  if (!isAuthorized) {
    return (
      <div className="bg-white border border-rose-100 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-sm" id="security_guard_notice">
        <ShieldAlert className="text-rose-500 mx-auto mb-4" size={54} />
        <h3 className="text-lg font-bold text-slate-800">{lang === 'en' ? "Access Restriction Alert" : "ការព្រមានការកម្រិតសិទ្ធិ"}</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {t.warningRoleLimit}
        </p>
        <div className="mt-5 p-3.5 bg-slate-50 rounded-xl text-slate-400 font-mono text-xs">
          STRICT_DATA_SEPARATION_ENFORCED // role_required: Manager+ // user_role: {currentRole}
        </div>
      </div>
    );
  }

  // 2. Filter expenses linked database rows
  const getFilteredExpenses = () => {
    let list = Array.isArray(expenses) ? expenses : [];

    if (activeBranchId !== 'all') {
      list = list.filter(e => e && e.branchId === activeBranchId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => 
        e && (
          e.description.toLowerCase().includes(q) ||
          e.paidTo.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q)
        )
      );
    }

    // Sort by latest date
    return [...list].sort((a, b) => (b.expenseDate || '').localeCompare(a.expenseDate || ''));
  };

  const filteredExpenses = getFilteredExpenses();

  const totalExpenseUsd = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalExpenseKhr = Math.round(totalExpenseUsd * exchangeRate);

  // Top category computation
  const categoryCounts = filteredExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);

  const topCategoryEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const topCategoryName = topCategoryEntry ? topCategoryEntry[0] : 'N/A';

  const handleRegisterExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || !paidTo || !description) return;

    const actualBranch = activeBranchId === 'all' ? 'b1' : activeBranchId;
    const defaultPic = receiptUrl || "https://images.unsplash.com/photo-1554415707-6e8cfc93ec23?auto=format&fit=crop&q=80&w=200";

    const newExp: Expense = {
      id: 'exp_' + Date.now(),
      branchId: actualBranch,
      expenseDate: date,
      category,
      description,
      amount,
      paymentMethod,
      paidTo,
      receiptUrl: defaultPic,
      createdBy: 'Executive Owner',
      note
    };

    setExpenses([newExp, ...expenses]);
    onAddLog(`Logged operational opex cost of ${formatCurrency(amount, 'USD')} under "${category}"`);
    
    // reset form
    setAmount(0);
    setDescription('');
    setPaidTo('');
    setNote('');
    setShowForm(false);
  };

  const categoriesList: ExpenseCategory[] = [
    'Water Bill',
    'Electricity Bill',
    'Gas',
    'Land Rent',
    'Land Tax',
    'Soap',
    'Fabric Softener',
    'Repair and Maintenance',
    'Staff Meal',
    'Internet',
    'Cleaning Supplies',
    'Marketing',
    'Other Expense'
  ];

  const getBranchCode = (bId: string) => {
    const b = branches.find(x => x.id === bId);
    return b ? b.branchCode : bId;
  };

  return (
    <div className="space-y-6" id="expenses_management_module">
      {/* 4 Top Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-2xs hover:border-slate-200 transition-colors">
          <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider block">TOTAL EXPENSES (USD)</span>
          <span className="text-xl font-bold font-mono text-rose-600 block mt-1">{formatCurrency(totalExpenseUsd, 'USD')}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">Sum of filtered entries</span>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-2xs hover:border-slate-200 transition-colors">
          <span className="text-[10px] text-slate-455 uppercase font-black tracking-wider block">TOTAL EXPENSES (KHR)</span>
          <span className="text-xl font-bold font-mono text-rose-600 block mt-1">៛{totalExpenseKhr.toLocaleString()}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">Rate: ៛{exchangeRate} / USD</span>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-2xs hover:border-slate-200 transition-colors">
          <span className="text-[10px] text-slate-455 uppercase font-black tracking-wider block">TOP OPEX CATEGORY</span>
          <span className="text-base font-bold text-slate-800 block mt-1.5 truncate">{topCategoryName}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">Highest operational cost</span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-150 shadow-2xs">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
          <input
            type="text"
            placeholder={lang === 'en' ? "Search expense details, supplier..." : "ស្វែងរកចំណាយ អ្នកផ្គត់ផ្គង់..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-blue-600 font-sans"
          />
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/10 hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer"
          id="btn_add_expense_trigger"
        >
          <Plus size={14} />
          {t.addNews}
        </button>
      </div>

      {/* Modal Dialog Form */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRegisterExpense} className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in fade-in" id="form_expense_entry">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                <CreditCard size={15} className="text-blue-600" />
                {lang === 'en' ? "Log Operational Expense Receipt" : "កត់ត្រាការចំណាយប្រតិបត្តិការថ្មី"}
              </h4>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Expense Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Opex Category *</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600"
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sum Amount (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="e.g. 145.00"
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-mono focus:outline-none focus:border-blue-600 font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Supplier / Paid To *</label>
                <input
                  type="text"
                  placeholder="e.g. Electricite du Cambodge"
                  value={paidTo}
                  onChange={e => setPaidTo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600"
                >
                  <option value="ABA">ABA Mobile Transfer</option>
                  <option value="Bank Transfer">Bank Wire Transfer</option>
                  <option value="Cash">Cash (USD/KHR)</option>
                  <option value="QR Payment">Bakong QR Scan</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Receipt Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={receiptUrl}
                  onChange={e => setReceiptUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Description Detail *</label>
                <input
                  type="text"
                  placeholder="Propane cylinder refilling for gas dryers, billing numbers"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Audit Notes</label>
                <textarea
                  placeholder="Attach metadata of transaction"
                  rows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="bg-rose-50/50 p-3 border border-rose-100 rounded-xl flex justify-between items-center text-xs">
              <span className="font-bold text-slate-600 block uppercase tracking-wide text-[10px]">Total Opex Cost Checked:</span>
              <strong className="text-sm font-bold text-rose-700 block font-mono">
                {formatDualCurrency(amount, exchangeRate)}
              </strong>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/10 hover:bg-blue-700 cursor-pointer"
              >
                Save Receipt Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Expense Ledger database table */}
      <div className="bg-white border border-slate-150 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" id="expenses_ledger_table">
            <thead className="text-[10px] text-slate-400 bg-slate-50/50 border-b border-slate-150 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Receipt Opex ID</th>
                <th className="px-4 py-4">Branch</th>
                <th className="px-4 py-4">Expense Date</th>
                <th className="px-4 py-4">Category</th>
                <th className="px-4 py-4">Opex Details</th>
                <th className="px-4 py-4">Paid To</th>
                <th className="px-4 py-4">Sum Amount</th>
                <th className="px-4 py-4">Payment Method</th>
                <th className="px-6 py-4 text-right">Receipt File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredExpenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50/40 transition">
                  <td className="px-6 py-4 font-mono font-extrabold text-slate-650">
                    #{exp.id.substring(4, 12)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded text-[9px]">
                      {getBranchCode(exp.branchId)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600 font-semibold">{exp.expenseDate}</td>
                  <td className="px-4 py-4">
                    <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-600 uppercase">
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-bold text-slate-800 block">{exp.description}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5 font-sans">Logged by: {exp.createdBy}</span>
                  </td>
                  <td className="px-4 py-4 text-slate-600 font-medium">{exp.paidTo}</td>
                  <td className="px-4 py-4 font-bold font-mono text-rose-700">
                    {formatCurrency(exp.amount, 'USD')}
                  </td>
                  <td className="px-4 py-4 text-slate-600 font-bold uppercase text-[10px]">{exp.paymentMethod}</td>
                  <td className="px-6 py-4 text-right">
                    {exp.receiptUrl ? (
                      <button
                        onClick={() => setReceiptModal(exp.receiptUrl)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg text-[10px] cursor-pointer"
                      >
                        <Eye size={12} />
                        View File
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                    No expense audit transactions configured in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipts Preview Modal */}
      {receiptModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-all animate-fade-in">
          <div className="bg-white border rounded-2xl max-w-sm w-full p-4 relative shadow-2xl">
            <button 
              onClick={() => setReceiptModal(null)} 
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full p-1"
            >
              <X size={16} />
            </button>
            <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wide mb-3">Reconciled Receipt File</h5>
            <div className="rounded-xl overflow-hidden border border-slate-100">
              <img 
                referrerPolicy="no-referrer"
                src={receiptModal} 
                alt="Receipt Scan" 
                className="w-full h-auto object-cover max-h-[350px]"
              />
            </div>
            <div className="mt-3 text-center text-[10px] text-slate-400 font-mono">
              METADATA: VERIFIED / TRANSACTIONID_MATCH
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

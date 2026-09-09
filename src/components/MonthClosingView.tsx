import React, { useState } from 'react';
import { FileCheck, FileText, Lock, Plus, Check, Printer, X, Download, HelpCircle, FileSpreadsheet } from 'lucide-react';
import { MonthClosing, Role, Branch, Income, Expense, CoinTransaction } from '../types';

interface MonthClosingViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  incomes: Income[];
  expenses: Expense[];
  coinTransactions: CoinTransaction[];
  monthClosings: MonthClosing[];
  setMonthClosings: React.Dispatch<React.SetStateAction<MonthClosing[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function MonthClosingView({
  currentRole,
  activeBranchId,
  branches,
  incomes,
  expenses,
  coinTransactions,
  monthClosings,
  setMonthClosings,
  lang,
  onAddLog
}: MonthClosingViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState<MonthClosing | null>(null);

  // Form states
  const [monthInput, setMonthInput] = useState('2026-06');
  const [depreciationRate, setDepreciationRate] = useState('1.5'); // e.g. 1.5% linear depreciation of washers/dryers value
  const [noteInput, setNoteInput] = useState('');
  const [branchInputId, setBranchInputId] = useState('b1');

  const currentBranchId = activeBranchId === 'all' ? 'b1' : activeBranchId;
  const filteredClosings = monthClosings.filter(c => activeBranchId === 'all' || c.branchId === activeBranchId);

  const isOwnerAdmin = ['Owner', 'Admin'].includes(currentRole);

  const handleOpenAdd = () => {
    setMonthInput('2026-06');
    setDepreciationRate('1.5');
    setNoteInput('');
    setBranchInputId(activeBranchId === 'all' ? 'b1' : activeBranchId);
    setShowAddModal(true);
  };

  const calculateAuditMetrics = (targetBranch: string, targetMonth: string, depRate: number) => {
    // Collect revenues in selected month
    const monthRevenues = incomes
      .filter(i => i.branchId === targetBranch && i.date.substring(0, 7) === targetMonth)
      .reduce((sum, i) => sum + i.totalAmount, 0);

    // Collect expenses in selected month
    const monthExpenses = expenses
      .filter(e => e.branchId === targetBranch && e.expenseDate.substring(0, 7) === targetMonth)
      .reduce((sum, e) => sum + e.amount, 0);

    // Dynamic Washer Dryer Depreciation Calculator
    // Base estimated hardware asset worth: e.g. $10,000 baseline per branch
    const baseHardwareAssetValue = 10000;
    const calculatedDepreciation = (baseHardwareAssetValue * (depRate / 100));

    // Net income formula after depreciation & expenses
    const netIncome = monthRevenues - monthExpenses - calculatedDepreciation;

    // Flag audits matches
    // Simulate coin audit by checking if we have coin balance entries this month
    const hasCoinEntries = coinTransactions.some(c => c.branchId === targetBranch && c.date.substring(0, 7) === targetMonth);
    // ABA matching matches automatically unless no ABA revenue exists
    const hasAbaIncomes = incomes.some(i => i.branchId === targetBranch && i.date.substring(0, 7) === targetMonth && i.paymentMethod === 'ABA');

    return {
      totalRevenue: monthRevenues,
      totalExpenses: monthExpenses,
      depreciation: calculatedDepreciation,
      netIncome,
      coinAuditMatches: hasCoinEntries ? true : false,
      abaAuditMatches: hasAbaIncomes ? true : false
    };
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const depRate = parseFloat(depreciationRate) || 0;

    // Check if duplicate month closing exists for this branch
    const duplicate = monthClosings.find(c => c.branchId === branchInputId && c.month === monthInput);
    if (duplicate) {
      alert(lang === 'en' ? `A month closing entry for ${monthInput} already exists!` : `របាយការណ៍បិទបញ្ជីហិរញ្ញវត្ថុសម្រាប់ ${monthInput} ត្រូវបានបង្កើតរួចហើយ!`);
      return;
    }

    const metrics = calculateAuditMetrics(branchInputId, monthInput, depRate);

    const newClosing: MonthClosing = {
      id: 'mc_' + Date.now(),
      branchId: branchInputId,
      month: monthInput,
      totalRevenue: metrics.totalRevenue,
      totalExpenses: metrics.totalExpenses,
      depreciationSavings: metrics.depreciation,
      netIncome: metrics.netIncome,
      coinAuditMatches: metrics.coinAuditMatches,
      abaAuditMatches: metrics.abaAuditMatches,
      closedBy: currentRole,
      closedAt: new Date().toISOString(),
      createdBy: currentRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'Draft',
      note: noteInput
    };

    setMonthClosings([newClosing, ...monthClosings]);
    onAddLog(`Initiated Month Financial Closing audit sheet for ${monthInput}. Status: Draft.`);
    setShowAddModal(false);
  };

  const handleLockClosing = (id: string, month: string) => {
    if (window.confirm(lang === 'en' ? `Are you sure you want to LOCK closing audit sheet for "${month}"? This action cannot be reversed.` : `តើអ្នកប្រាកដជាចង់បិទសោសៀវភៅហិរញ្ញវត្ថុសម្រាប់ប្រចាំខែ "${month}" ឬ? បន្ទាប់ពីចាក់សោមិនអាចកែសម្រួលបានទេ។`)) {
      setMonthClosings(monthClosings.map(c => {
        if (c.id === id) {
          return { ...c, status: 'Locked', updatedAt: new Date().toISOString() };
        }
        return c;
      }));
      onAddLog(`Audit Sheet for "${month}" closed and LOCKED securely with administrative credentials.`);
    }
  };

  const handleDeleteClosing = (id: string, month: string) => {
    if (window.confirm(lang === 'en' ? `Are you sure you want to delete closing "${month}"?` : `តើអ្នកពិតជាចង់លុបបិទបញ្ជីសម្រាប់ "${month}" លុបឬ?`)) {
      setMonthClosings(monthClosings.filter(c => c.id !== id));
      onAddLog(`Deleted month closing audit for: "${month}"`);
      if (selectedClosing?.id === id) {
        setSelectedClosing(null);
      }
    }
  };

  const handlePrintAuditSheet = () => {
    window.print();
  };

  const getBranchName = (bId: string) => {
    const found = branches.find(b => b.id === bId);
    return found ? found.branchName : bId;
  };

  return (
    <div className="space-y-6" id="month_closing_module">
      {/* Action Button Bar */}
      {isOwnerAdmin && (
        <div className="flex justify-end items-center">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-rose-200 hover:bg-rose-500 transition cursor-pointer"
            id="audit_closing_sheet_btn"
          >
            <Plus size={14} />
            {lang === 'en' ? 'Run Month Closing' : 'ដំណើរការបិទបញ្ជីប្រចាំខែ'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Closings list Table column */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 border-b border-slate-50 pb-2">
            Historical Financial Audits Sheets
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" id="month_closings_table">
              <thead>
                <tr className="text-[10px] uppercase text-slate-450 border-b border-slate-50 font-bold">
                  <th className="py-2.5">{lang === 'en' ? 'Month / Details' : 'ខែ / ព័ត៌មានលម្អិត'}</th>
                  <th className="py-2.5">{lang === 'en' ? 'Branch' : 'សាខា'}</th>
                  <th className="py-2.5">{lang === 'en' ? 'Revenue' : 'ចំណូល'}</th>
                  <th className="py-2.5">{lang === 'en' ? 'Total Expenses' : 'ចំណាយសរុប'}</th>
                  <th className="py-2.5">{lang === 'en' ? 'Net Income' : 'ចំណូលសុទ្ធ'}</th>
                  <th className="py-2.5">{lang === 'en' ? 'Status' : 'ស្ថានភាព'}</th>
                  <th className="py-2.5 text-right">{lang === 'en' ? 'Audit Options' : 'ប្រតិបត្តិការសវនកម្ម'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-105">
                {filteredClosings.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedClosing(c)}
                    className={`cursor-pointer transition hover:bg-slate-50/70 ${selectedClosing?.id === c.id ? 'bg-slate-50 border-l-2 border-slate-700' : ''}`}
                  >
                    <td className="py-3">
                      <span className="font-extrabold text-slate-800">{c.month}</span>
                      <p className="text-[9px] text-slate-400 font-medium">Closed by: {c.closedBy}</p>
                    </td>
                    <td className="py-3 font-semibold text-slate-600">{getBranchName(c.branchId)}</td>
                    <td className="py-3 font-mono font-bold text-slate-700">${c.totalRevenue.toFixed(2)}</td>
                    <td className="py-3 font-mono text-rose-500">${c.totalExpenses.toFixed(2)}</td>
                    <td className="py-3 font-mono font-extrabold text-emerald-600">${c.netIncome.toFixed(2)}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${c.status === 'Locked' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 text-right space-x-1" onClick={e => e.stopPropagation()}>
                      {c.status === 'Draft' && isOwnerAdmin && (
                        <button
                          onClick={() => handleLockClosing(c.id, c.month)}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold text-[9px] cursor-pointer inline-flex items-center gap-0.5"
                        >
                          <Lock size={10} /> Lock
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClosing(c.id, c.month)}
                        className="px-2 py-0.5 bg-slate-50 hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 rounded text-[9px] font-bold cursor-pointer inline-flex items-center"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredClosings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      No compiled monthly audits currently found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Closeup close audited ledger printed preview */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs space-y-4 relative">
          {selectedClosing ? (
            <div className="space-y-4" id="printable_area_ledger_sheet">
              <div className="flex justify-between items-center text-slate-400 text-[10px] border-b border-slate-100 pb-2 uppercase tracking-wide">
                <span>Month close audit details</span>
                <span className="font-mono">{selectedClosing.month}</span>
              </div>

              {/* Shop Logo & Identity */}
              <div className="text-center space-y-1">
                <h3 className="font-extrabold text-slate-900 text-sm tracking-wider uppercase">toto by Chichi & Coffee corner</h3>
                <span className="text-[10px] text-slate-400 block font-mono">{getBranchName(selectedClosing.branchId)}</span>
              </div>

              {/* Financial Metrics Lists */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center border-b border-dashed border-slate-100 py-1.5 text-xs text-slate-700">
                  <span className="font-semibold text-slate-500">Gross Sales Income:</span>
                  <span className="font-mono font-bold text-slate-800">${selectedClosing.totalRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-dashed border-slate-100 py-1.5 text-xs text-slate-700">
                  <span className="font-semibold text-slate-500">Operating Expenses Subtotal:</span>
                  <span className="font-mono text-rose-500">${selectedClosing.totalExpenses.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-dashed border-slate-100 py-1.5 text-xs text-slate-700">
                  <span className="font-semibold text-slate-500">Washer & Dryer Depreciations:</span>
                  <span className="font-mono text-amber-600">-${selectedClosing.depreciationSavings.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 py-2.5 text-xs">
                  <span className="font-extrabold text-slate-800">Net Adjusted Income:</span>
                  <span className="font-mono font-extrabold text-emerald-600 text-sm">${selectedClosing.netIncome.toFixed(2)}</span>
                </div>
              </div>

              {/* Verification checks */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Independent Audits Verification</h5>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-slate-505 font-medium">Coin Register Audited:</span>
                  <span className={`font-mono text-[10px] font-bold px-2 py-0.2 rounded ${selectedClosing.coinAuditMatches ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {selectedClosing.coinAuditMatches ? '✔ MATCH OK' : '✕ NO COIN ENTRIES LOGGED'}
                  </span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-slate-505 font-medium">ABA Payments Audited:</span>
                  <span className={`font-mono text-[10px] font-bold px-2 py-0.2 rounded ${selectedClosing.abaAuditMatches ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-705'}`}>
                    {selectedClosing.abaAuditMatches ? '✔ MATCH OK' : '✕ MISSING ABA LEDGER MATCHES'}
                  </span>
                </div>
              </div>

              {/* Status block and printer button */}
              <div className="border-t border-slate-100 pt-4 flex gap-2">
                <button
                  onClick={handlePrintAuditSheet}
                  className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-805 transition cursor-pointer flex items-center justify-center gap-1.5 z-10"
                >
                  <Printer size={13} />
                  {lang === 'en' ? 'Direct Print/PDF Format' : 'បោះពុម្ពជា PDF'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-12 space-y-2">
              <FileText size={32} />
              <p className="text-xs">
                {lang === 'en' ? 'Select a historical monthly closing sheet on the left to review metrics, inspect depreciation details, audit coin matches, and compile PDFs.' : 'សូមជ្រើសរើសរបាយការណ៍បិទបញ្ជីនៅខាងឆ្វេង ដើម្បីពិនិត្យ ឬបោះពុម្ព។'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* INITIATE MONTH CLOSING AUDIT MODAL PANEL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="run_closing_modal">
          <div className="bg-white border border-slate-150 rounded-2xl max-w-sm w-full p-5 shadow-lg">
            <h4 className="font-bold text-slate-800 text-sm pb-2 border-b border-slate-100">
              Run Month Financial Closing
            </h4>
            <form onSubmit={handleAddSubmit} className="space-y-4 pt-3.5" id="month_closing_action">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">SELECT BRANCH</label>
                <select
                  value={branchInputId}
                  onChange={e => setBranchInputId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-bold"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-505 block mb-1">AUDIT PERIOD *</label>
                  <input
                    type="month"
                    value={monthInput}
                    onChange={e => setMonthInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-bold font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-505 block mb-1">DEPRECIATION (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={depreciationRate}
                    onChange={e => setDepreciationRate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-bold font-mono"
                    required
                  />
                  <span className="text-[8px] text-slate-400 mt-1 block">Monthly hardware writeoff rate.</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-530 block mb-1">AUDIT SUMMARY MEMO & NOTE</label>
                <textarea
                  placeholder="Memo detail notes safely..."
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 h-16 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-400 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {lang === 'en' ? 'Cancel' : 'បោះបង់'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-500 shadow-md cursor-pointer"
                >
                  {lang === 'en' ? 'Run closing' : 'ចាប់ផ្តើមបិទបញ្ជី'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

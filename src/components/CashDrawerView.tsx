import React, { useState } from 'react';
import { Lock, Unlock, Plus, Minus, KeyRound, AlertTriangle, Printer, History, RefreshCcw } from 'lucide-react';
import { CashDrawer, CashDrawerTransaction, Role, Branch, Income, Expense } from '../types';

interface CashDrawerViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  incomes: Income[];
  expenses: Expense[];
  cashDrawers: CashDrawer[];
  setCashDrawers: React.Dispatch<React.SetStateAction<CashDrawer[]>>;
  cashDrawerTransactions: CashDrawerTransaction[];
  setCashDrawerTransactions: React.Dispatch<React.SetStateAction<CashDrawerTransaction[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function CashDrawerView({
  currentRole,
  activeBranchId,
  branches,
  incomes,
  expenses,
  cashDrawers,
  setCashDrawers,
  cashDrawerTransactions,
  setCashDrawerTransactions,
  lang,
  onAddLog
}: CashDrawerViewProps) {
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);

  // Form states
  const [startCash, setStartCash] = useState('100.00');
  const [actualCashInput, setActualCashInput] = useState('');

  // Drawer transaction form states
  const [txType, setTxType] = useState<'In' | 'Out'>('Out');
  const [txAmount, setTxAmount] = useState('');
  const [txReason, setTxReason] = useState('');

  const currentBranchId = activeBranchId === 'all' ? (branches[0]?.id || 'b1') : activeBranchId;

  // Get active drawer for selected branch
  const activeDrawer = cashDrawers.find(c => c.branchId === currentBranchId && c.status === 'Open');
  const finishedDrawers = cashDrawers.filter(c => c.branchId === currentBranchId && c.status === 'Closed');

  // Permissions gate:
  // Lock drawer with permissions: only cashier/staff/manager who is on duty can open, owner/admin can override.
  const hasAccessToDrawer = () => {
    if (['Owner', 'Admin'].includes(currentRole)) return true;
    // Managed staff on duty can also open
    if (['Manager', 'Staff'].includes(currentRole)) return true;
    return false;
  };

  // Calculate expected cash in active drawer
  // Expected = starting cash + cash incomes - cash expenses + minor cash ins - minor cash outs
  const getExpectedCash = () => {
    if (!activeDrawer) return 0;
    
    // Filter incomes of this branch that occurred in Cash after drawer opened
    const branchCashIncomes = incomes
      .filter(i => i.branchId === currentBranchId && i.paymentMethod === 'Cash' && (!activeDrawer.openedAt || i.date >= activeDrawer.openedAt.substring(0, 10)))
      .reduce((sum, i) => sum + i.totalAmount, 0);

    // Filter expenses of this branch paid in Cash after drawer opened
    const branchCashExpenses = expenses
      .filter(e => e.branchId === currentBranchId && e.paymentMethod === 'Cash' && (!activeDrawer.openedAt || e.expenseDate >= activeDrawer.openedAt.substring(0, 10)))
      .reduce((sum, e) => sum + e.amount, 0);

    // Drawer minor trades
    const minorTxs = cashDrawerTransactions.filter(t => t.drawerId === activeDrawer.id);
    const minorIns = minorTxs.filter(t => t.type === 'In').reduce((sum, t) => sum + t.amount, 0);
    const minorOuts = minorTxs.filter(t => t.type === 'Out').reduce((sum, t) => sum + t.amount, 0);

    return activeDrawer.startingCash + branchCashIncomes - branchCashExpenses + minorIns - minorOuts;
  };

  const expectedCashValue = getExpectedCash();

  const handleOpenDrawer = (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(startCash);
    if (isNaN(cash) || cash < 0) return;

    const newDrawer: CashDrawer = {
      id: 'draw_' + Date.now(),
      branchId: currentBranchId,
      status: 'Open',
      startingCash: cash,
      endingCash: 0,
      actualCash: 0,
      difference: 0,
      reconciled: false,
      openedBy: currentRole === 'Owner' || currentRole === 'Admin' ? 'Executive Owner' : currentRole,
      closedBy: '',
      openedAt: new Date().toISOString(),
      closedAt: '',
      createdBy: currentRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setCashDrawers([newDrawer, ...cashDrawers]);
    onAddLog(`Starting shift cash drawer opened for branch with starting cash $${cash.toFixed(2)}.`);
    setShowOpenModal(false);
  };

  const handleCloseDrawer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDrawer) return;

    const actual = parseFloat(actualCashInput);
    if (isNaN(actual) || actual < 0) return;

    const expected = expectedCashValue;
    const diff = actual - expected;

    const updated = cashDrawers.map(d => {
      if (d.id === activeDrawer.id) {
        return {
          ...d,
          status: 'Closed' as const,
          endingCash: expected,
          actualCash: actual,
          difference: diff,
          reconciled: true,
          closedBy: currentRole,
          closedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
      return d;
    });

    setCashDrawers(updated);
    onAddLog(`Closed & Reconciled cash drawer shift. Expected: $${expected.toFixed(2)}, Actual: $${actual.toFixed(2)}, Diff: ${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}.`);
    setShowCloseModal(false);
    setActualCashInput('');
  };

  const handleAddTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDrawer) return;

    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount <= 0 || !txReason.trim()) return;

    const newTx: CashDrawerTransaction = {
      id: 'cdt_' + Date.now(),
      branchId: currentBranchId,
      drawerId: activeDrawer.id,
      type: txType,
      amount,
      reason: txReason,
      createdBy: currentRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setCashDrawerTransactions([newTx, ...cashDrawerTransactions]);
    onAddLog(`Cash drawer minor trade registrado: ${txType} $${amount.toFixed(2)} - ${txReason}`);
    setShowTxModal(false);
    setTxAmount('');
    setTxReason('');
  };

  const getBranchName = (bId: string) => {
    const found = branches.find(b => b.id === bId);
    return found ? found.branchName : bId;
  };

  return (
    <div className="space-y-6" id="cash_drawer_module">

      {hasAccessToDrawer() ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Interactive Drawer Card panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className={`p-6 rounded-2xl border transition relative overflow-hidden shadow-md flex flex-col justify-between h-[320px] ${activeDrawer ? 'bg-gradient-to-br from-emerald-900 to-emerald-950 text-white border-emerald-800' : 'bg-gradient-to-br from-slate-900 to-slate-950 text-white border-slate-800'}`}>
              <div className="absolute top-0 right-0 p-8 opacity-10">
                {activeDrawer ? <Unlock size={180} /> : <Lock size={180} />}
              </div>

              {/* Status Header */}
              <div className="flex justify-between items-start z-10">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold tracking-widest text-[#a7f3d0] bg-emerald-800/60 border border-emerald-700/50 px-2 py-0.5 rounded-full uppercase">
                    {getBranchName(currentBranchId)}
                  </span>
                  <h3 className="text-lg font-bold">
                    {activeDrawer ? (lang === 'en' ? 'Cash Drawer Unlocked (Shift Active)' : 'ថតប្រាក់កំពុងដំណើរការ (វេនសកម្ម)') : (lang === 'en' ? 'Cash Drawer Blocked (Shift Locked)' : 'ថតប្រាក់ត្រូវបានចាក់សោ (វេនបិទ)')}
                  </h3>
                </div>
                <div className={`p-2.5 rounded-xl z-20 ${activeDrawer ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  {activeDrawer ? <Unlock size={18} /> : <Lock size={18} />}
                </div>
              </div>

              {/* Financial calculations */}
              <div className="z-10 py-4">
                {activeDrawer ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] text-emerald-200 uppercase tracking-wide block">Starting Cash</span>
                      <h4 className="text-lg font-extrabold font-mono">${activeDrawer.startingCash.toFixed(2)}</h4>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-200 uppercase tracking-wide block">Audited Transactions Flow</span>
                      <h4 className="text-lg font-extrabold font-mono text-emerald-300">
                        +${(expectedCashValue - activeDrawer.startingCash).toFixed(2)}
                      </h4>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-100 uppercase tracking-wide block">Expected Ending Cash</span>
                      <h4 className="text-2xl font-extrabold font-mono text-green-300">${expectedCashValue.toFixed(2)}</h4>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-300">
                      {lang === 'en' ? 'The drawer is currently locked and closed. Please open a shift by inserting starting cash logs to begin logging cash services.' : 'ទូថតហិបប្រាក់ត្រូវបានចាក់សោរបិទ។ សូមបញ្ចូលទឹកប្រាក់ដើមគ្រាដើម្បីចាប់ផ្តើមវេនការងារថ្មី។'}
                    </p>
                  </div>
                )}
              </div>

              {/* Action operations rows */}
              <div className="flex gap-2.5 z-10 pt-4 border-t border-white/10">
                {activeDrawer ? (
                  <>
                    <button
                      onClick={() => setShowTxModal(true)}
                      className="px-4 py-2 bg-emerald-700/60 border border-emerald-600/50 hover:bg-emerald-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus size={13} />
                      {lang === 'en' ? 'Log Cash In/Out' : 'បញ្ចូល/ដកប្រាក់យីហោ'}
                    </button>
                    <button
                      onClick={() => setShowCloseModal(true)}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 font-semibold rounded-xl text-xs text-slate-900 flex items-center gap-1.5 transition shadow-sm cursor-pointer ml-auto"
                    >
                      <Lock size={13} />
                      {lang === 'en' ? 'Reconcile & Close Shift' : 'ផ្ទៀងផ្ទាត់ និងបិទវេន'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowOpenModal(true)}
                    className="px-5 py-2.5 bg-[#10b981] hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                    id="open_shift_btn"
                  >
                    <KeyRound size={14} />
                    {lang === 'en' ? 'Open Cash Drawer Shift' : 'បើកហិបប្រាក់វេនថ្មី'}
                  </button>
                )}
              </div>
            </div>

            {/* Minor Transactions Flow table inside active shift */}
            {activeDrawer && (
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                  Active Shift Petty Cash Audit Logs
                </h4>
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left text-xs" id="active_drawer_minor_txs">
                    <thead>
                      <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-50">
                        <th className="py-2">{lang === 'en' ? 'Type' : 'ប្រភេទ'}</th>
                        <th className="py-2">{lang === 'en' ? 'Amount' : 'ប្រាក់'}</th>
                        <th className="py-2">{lang === 'en' ? 'Reason / Details' : 'មូលហេតុ'}</th>
                        <th className="py-2">{lang === 'en' ? 'Staff' : 'បុគ្គលិក'}</th>
                        <th className="py-2 text-right">{lang === 'en' ? 'Timestamp' : 'ពេលវេលា'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cashDrawerTransactions
                        .filter(t => t.drawerId === activeDrawer.id)
                        .map(t => (
                          <tr key={t.id}>
                            <td className="py-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${t.type === 'In' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                {t.type === 'In' ? 'CASH IN' : 'CASH OUT'}
                              </span>
                            </td>
                            <td className={`py-2 font-mono font-bold ${t.type === 'In' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              ${t.amount.toFixed(2)}
                            </td>
                            <td className="py-2 text-slate-600 font-suwannaphum">{t.reason}</td>
                            <td className="py-2 text-slate-450">{t.createdBy}</td>
                            <td className="py-2 text-right text-[10px] text-slate-400 font-mono">
                              {t.createdAt.replace('T', ' ').substring(11, 19)}
                            </td>
                          </tr>
                        ))}
                      {cashDrawerTransactions.filter(t => t.drawerId === activeDrawer.id).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-400">
                            No petty cash transactions occurred inside this active shift.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Past audited Shifts sidebar ledger */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              Audited Shifts Reports History
            </h4>

            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {finishedDrawers.map(d => (
                <div key={d.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 hover:border-slate-205 transition">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-100 pb-1">
                    <span className="font-mono font-bold uppercase">RECONCILED SHIFT</span>
                    <span className="font-mono">{d.closedAt.substring(0, 10)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase">Expected</span>
                      <span className="font-mono font-bold text-xs">${d.endingCash.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase">Actual Cash</span>
                      <span className="font-mono font-bold text-xs">${d.actualCash.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500">Shift Accrual:</span>
                    <span className={`font-mono font-bold text-xs ${d.difference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {d.difference >= 0 ? '+' : ''}${d.difference.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400 block text-right font-suwannaphum">
                    Audited by: <b className="text-slate-600 uppercase">{d.closedBy}</b>
                  </p>
                </div>
              ))}
              {finishedDrawers.length === 0 && (
                <div className="text-center text-slate-400 py-6 text-[11px]">
                  No compiled historical shifts available for this branch.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-150 p-8 rounded-2xl max-w-md mx-auto text-center space-y-4">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-xs">
            <Lock size={28} />
          </div>
          <h3 className="font-bold text-slate-800">Permission Denied</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Only cashiers, staff on duty, or managers assigned to this branch hold credentials to lock, unlock, or reconcile the cash drawer.
          </p>
        </div>
      )}

      {/* OPEN DRAWER MODAL PANEL */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="open_drawer_modal">
          <form onSubmit={handleOpenDrawer} className="bg-white border border-slate-150 rounded-2xl max-w-sm w-full p-5 shadow-lg space-y-4" id="open_drawer_action">
            <h4 className="font-bold text-slate-850 text-sm pb-2 border-b border-slate-100">
              Open Cash Drawer Shift
            </h4>
            <div>
              <p className="text-[11px] text-slate-450 leading-relaxed mb-3">
                Registering starting cash reserves locks down audit parameters. Standard backup drawer baseline is usually $100.
              </p>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">STARTING CASH VALUE ($USD) *</label>
              <input
                type="number"
                step="0.01"
                value={startCash}
                onChange={e => setStartCash(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-bold outline-none font-mono"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-400 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {lang === 'en' ? 'Cancel' : 'បោះបង់'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 cursor-pointer"
              >
                {lang === 'en' ? 'Unlock Drawer' : 'ដោះសោហិបប្រាក់'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CLOSE RECONCILE MODAL PANEL */}
      {showCloseModal && activeDrawer && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="close_drawer_modal">
          <form onSubmit={handleCloseDrawer} className="bg-white border border-slate-150 rounded-2xl max-w-sm w-full p-5 shadow-lg space-y-4" id="close_drawer_action">
            <h4 className="font-bold text-slate-850 text-sm pb-2 border-b border-slate-100">
              Shift Reconcile & Close Drawer
            </h4>

            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex justify-between text-xs text-slate-600 font-semibold">
                <span>Expected Drawer Sum:</span>
                <span className="font-mono font-bold text-slate-800">${expectedCashValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-450">
                <span>Opened Starting Cash:</span>
                <span className="font-mono">${activeDrawer.startingCash.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">ACTUAL MEASURED PHYSICAL CASH ($USD) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 155.00"
                value={actualCashInput}
                onChange={e => setActualCashInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-bold outline-none font-mono"
                required
              />
              <span className="text-[9px] text-[#b45309] flex items-center gap-1 mt-1.5 font-medium leading-relaxed">
                <AlertTriangle size={11} /> Confirm physical cash match. Excess or deficits will trigger discrepancy logs automatically.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 border border-slate-205 text-slate-400 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {lang === 'en' ? 'Cancel' : 'បោះបង់'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-500 cursor-pointer"
              >
                {lang === 'en' ? 'Submit Audits & Lock' : 'ផ្ញើសវនកម្ម និងចាក់សោ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MINOR PETTY CASH TRANSACTION MODAL PANEL */}
      {showTxModal && activeDrawer && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="drawer_minor_tx_modal">
          <form onSubmit={handleAddTx} className="bg-white border border-slate-150 rounded-2xl max-w-sm w-full p-5 shadow-lg space-y-4">
            <h4 className="font-bold text-slate-850 text-sm pb-2 border-b border-slate-100">
              Add Shift Transaction In/Out
            </h4>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">FLOW DIRECTION *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTxType('Out')}
                  className={`py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer ${txType === 'Out' ? 'bg-rose-50 border-rose-350 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  <Minus size={12} /> Petty Cash Out
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('In')}
                  className={`py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer ${txType === 'In' ? 'bg-emerald-50 border-emerald-350 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  <Plus size={12} /> Petty Cash In
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-450 block mb-1">TRANSACTION VALUE ($USD) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={txAmount}
                onChange={e => setTxAmount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 outline-none font-bold font-mono"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-450 block mb-1">REASON / OUTFLOW DETAILS *</label>
              <input
                type="text"
                placeholder="e.g. Purchased cleaner spray bottles"
                value={txReason}
                onChange={e => setTxReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
              <button
                type="button"
                onClick={() => setShowTxModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-400 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {lang === 'en' ? 'Cancel' : 'បោះបង់'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 cursor-pointer"
              >
                {lang === 'en' ? 'Commit Transaction' : 'រក្សាទុក'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

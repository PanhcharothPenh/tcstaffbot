import React, { useState } from 'react';
import { Wallet, Plus, Coins, Receipt, ArrowUpRight, Scale, CheckCircle, Clock } from 'lucide-react';
import { Debt, DebtPayment, Supplier, Role, Branch } from '../types';

interface DebtsViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  suppliers: Supplier[];
  debts: Debt[];
  setDebts: React.Dispatch<React.SetStateAction<Debt[]>>;
  debtPayments: DebtPayment[];
  setDebtPayments: React.Dispatch<React.SetStateAction<DebtPayment[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function DebtsView({
  currentRole,
  activeBranchId,
  branches,
  suppliers,
  debts,
  setDebts,
  debtPayments,
  setDebtPayments,
  lang,
  onAddLog
}: DebtsViewProps) {
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  // Auto payment trigger configuration simulations
  const [autoPaymentsEnabled, setAutoPaymentsEnabled] = useState(false);

  // Pay form states
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'ABA' | 'Bank Transfer' | 'QR Payment'>('ABA');
  const [payNote, setPayNote] = useState('');

  // Add Debt form states
  const [supplierId, setSupplierId] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [branchInputId, setBranchInputId] = useState('b1');

  const isOwnerAdminManager = ['Owner', 'Admin', 'Manager'].includes(currentRole);

  const getFilteredDebts = () => {
    let list = debts;
    if (activeBranchId !== 'all') {
      list = list.filter(d => d.branchId === activeBranchId);
    }
    return list;
  };

  const getFilteredPayments = () => {
    let list = debtPayments;
    if (activeBranchId !== 'all') {
      list = list.filter(p => p.branchId === activeBranchId);
    }
    return list;
  };

  const filteredDebts = getFilteredDebts();
  const filteredPayments = getFilteredPayments();

  const handleOpenPay = (d: Debt) => {
    setSelectedDebt(d);
    setPayAmount(d.remainingBalance.toString());
    setPayNote('');
    setShowPayModal(true);
  };

  const handleOpenAdd = () => {
    setSupplierId(suppliers[0]?.id || '');
    setDebtAmount('');
    setDescription('');
    setDueDate(new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().substring(0, 10)); // 10 days out
    setBranchInputId(activeBranchId === 'all' ? (branches[0]?.id || 'b1') : activeBranchId);
    setShowAddModal(true);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;
    const amountToPay = parseFloat(payAmount);
    if (isNaN(amountToPay) || amountToPay <= 0) return;

    if (amountToPay > selectedDebt.remainingBalance) {
      alert(lang === 'en' ? 'Payment cannot exceed the remaining balance!' : 'ចំនួនទូទាត់មិនអាចលើសពីបំណុលដែលនៅសល់ឡើយ!');
      return;
    }

    // Register Debt Payment Transaction
    const newPayment: DebtPayment = {
      id: 'pay_' + Date.now(),
      branchId: selectedDebt.branchId,
      debtId: selectedDebt.id,
      supplierName: selectedDebt.supplierName,
      amountPaid: amountToPay,
      paymentDate: new Date().toISOString().substring(0, 10),
      paymentMethod: payMethod,
      createdBy: currentRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      note: payNote
    };

    setDebtPayments([newPayment, ...debtPayments]);

    // Update Remaining balance and Status
    const updatedDebts = debts.map(d => {
      if (d.id === selectedDebt.id) {
        const nextBalance = Math.max(0, d.remainingBalance - amountToPay);
        const nextStatus = nextBalance === 0 ? 'Paid' : 'Partial';
        return {
          ...d,
          remainingBalance: nextBalance,
          status: nextStatus as 'Paid' | 'Partial' | 'Unpaid',
          updatedAt: new Date().toISOString()
        };
      }
      return d;
    });

    setDebts(updatedDebts);
    onAddLog(`Disbursed payment $${amountToPay.toFixed(2)} to ${selectedDebt.supplierName} using ${payMethod}.`);
    setShowPayModal(false);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(debtAmount);
    if (!supplierId || isNaN(amountVal) || amountVal <= 0) return;

    const supplierRef = suppliers.find(s => s.id === supplierId);
    const supplierNameText = supplierRef ? supplierRef.name : 'Unknown supplier';

    const newDebt: Debt = {
      id: 'debt_' + Date.now(),
      branchId: branchInputId,
      supplierId,
      supplierName: supplierNameText,
      amount: amountVal,
      description,
      dueDate,
      status: 'Unpaid',
      remainingBalance: amountVal,
      createdBy: currentRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setDebts([newDebt, ...debts]);
    onAddLog(`Created Debt Record of $${amountVal.toFixed(2)} for Supplier "${supplierNameText}".`);
    setShowAddModal(false);
  };

  const toggleAutoPayments = () => {
    const nextState = !autoPaymentsEnabled;
    setAutoPaymentsEnabled(nextState);
    if (nextState) {
      onAddLog("Automatic payment trigger enabled for supplier debt invoice matches.");
    } else {
      onAddLog("Automatic supplier debt payment trigger disabled.");
    }
  };

  const getBranchName = (bId: string) => {
    const found = branches.find(b => b.id === bId);
    return found ? found.branchName : bId;
  };

  // Stats block
  const totalOutstanding = filteredDebts.reduce((sum, d) => sum + d.remainingBalance, 0);
  const totalPaid = filteredPayments.reduce((sum, p) => sum + p.amountPaid, 0);

  return (
    <div className="space-y-6" id="debts_ledger_module">
      {/* Overview stats block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">
                {lang === 'en' ? 'Total Outstanding Debt' : 'សរុបបំណុលដែលត្រូវសង'}
              </span>
              <h3 className="text-2xl font-extrabold text-rose-600 mt-1">${totalOutstanding.toFixed(2)}</h3>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <Scale size={20} />
            </div>
          </div>
          <span className="text-[10px] text-slate-400 block mt-2">
            Consignment bills and invoices waiting for final cash payout reconciliation.
          </span>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">
                {lang === 'en' ? 'Paid Debt Balance' : 'ប្រាក់សងសរុប'}
              </span>
              <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">${totalPaid.toFixed(2)}</h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle size={20} />
            </div>
          </div>
          <span className="text-[10px] text-slate-400 block mt-2">
            Historical debt clearance sums dispatched to vendors safely.
          </span>
        </div>

        {/* Automatic Pay Out control container */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-500 block">
                {lang === 'en' ? 'Auto Payments Rules' : 'ការទូទាត់ស្វ័យប្រវត្តិ'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Trigger instant payout from branch cash drawer upon invoice matching and positive audit.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoPaymentsEnabled}
                onChange={toggleAutoPayments}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${autoPaymentsEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>
              {autoPaymentsEnabled ? 'TRIGGER: MATCH ACTIVE' : 'TRIGGER: OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid container with Ledger lists */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Outstanding Debts Table */}
        <div className="xl:col-span-2 space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex justify-between items-center pb-2 border-b border-slate-55">
            <div>
              <h4 className="text-xs font-bold text-slate-800">
                {lang === 'en' ? 'Outstanding Supplier Invoices & Debts' : 'បញ្ជីបំណុលលម្អិត'}
              </h4>
              <span className="text-[10px] text-slate-400">Consignment purchase log ledger.</span>
            </div>
            {isOwnerAdminManager && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold shadow-xs hover:bg-rose-500 cursor-pointer"
              >
                <Plus size={12} />
                {lang === 'en' ? 'Log New Debt' : 'កត់ត្រាបំណុលថ្មី'}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" id="debts_ledger_table">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400 font-bold border-b border-slate-50">
                  <th className="py-2.5">{lang === 'en' ? 'Supplier / Details' : 'អ្នកលក់'}</th>
                  <th className="py-2.5">{lang === 'en' ? 'Branch' : 'សាខា'}</th>
                  <th className="py-2.5">{lang === 'en' ? 'Total / Remaining' : 'ប្រាក់សរុប/នៅសល់'}</th>
                  <th className="py-2.5">{lang === 'en' ? 'Due Date' : 'ថ្ងៃត្រូវសង'}</th>
                  <th className="py-2.5">{lang === 'en' ? 'Status' : 'ស្ថានភាព'}</th>
                  {isOwnerAdminManager && <th className="py-2.5 text-right">{lang === 'en' ? 'Operation' : 'ប្រតិបត្តិការ'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDebts.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/50">
                    <td className="py-3">
                      <span className="font-bold text-slate-800 block text-xs">{d.supplierName}</span>
                      <p className="text-[10px] text-slate-400 font-suwannaphum">{d.description}</p>
                    </td>
                    <td className="py-3 font-semibold text-slate-600">{getBranchName(d.branchId)}</td>
                    <td className="py-3">
                      <span className="text-slate-400 line-through text-[10px] block">${d.amount.toFixed(2)}</span>
                      <span className="font-extrabold text-rose-600">${d.remainingBalance.toFixed(2)}</span>
                    </td>
                    <td className="py-3 font-mono font-bold text-slate-500">{d.dueDate}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${d.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : d.status === 'Partial' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                        {d.status}
                      </span>
                    </td>
                    {isOwnerAdminManager && (
                      <td className="py-3 text-right">
                        {d.status !== 'Paid' ? (
                          <button
                            onClick={() => handleOpenPay(d)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10px] shadow-xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <ArrowUpRight size={10} />
                            {lang === 'en' ? 'Pay Debt' : 'សងលុយ'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-bold">✔ Cleared</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {filteredDebts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 bg-slate-50/50 rounded-xl">
                      No debts matching query currently recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History sidebar ledger */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
          <div>
            <h4 className="text-xs font-bold text-slate-800">
              {lang === 'en' ? 'Recent Disbursed Payments' : 'ប្រវត្តិការបង់សងលុយ'}
            </h4>
            <span className="text-[10px] text-slate-400 block">Historic audit trail payments.</span>
          </div>

          <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
            {filteredPayments.map(p => (
              <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 hover:border-emerald-100 transition">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-slate-800 text-xs truncate max-w-[150px]">
                    {p.supplierName}
                  </span>
                  <span className="text-emerald-600 font-extrabold font-mono text-xs">
                    +${p.amountPaid.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span className="font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">{p.paymentMethod}</span>
                  <span className="text-slate-400 font-medium">{p.paymentDate}</span>
                </div>
                {p.note && (
                  <p className="text-[9px] text-slate-400 italic font-suwannaphum">Note: {p.note}</p>
                )}
              </div>
            ))}
            {filteredPayments.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-[11px]">
                No debt clearing disbursements executed yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DISBURSE PAYMENT MODAL PANEL */}
      {showPayModal && selectedDebt && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="pay_debt_modal">
          <div className="bg-white border border-slate-150 rounded-2xl max-w-sm w-full p-5 shadow-lg">
            <h4 className="font-bold text-slate-800 text-sm pb-2.5 border-b border-slate-100">
              Clear Outstanding Debt
            </h4>
            <form onSubmit={handlePaySubmit} className="space-y-4 pt-3" id="pay_submit_action">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">RECIPIENT SUPPLIER</label>
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 font-extrabold text-xs">
                  {selectedDebt.supplierName}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">REMAINING BALANCE DUE</label>
                <div className="p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl text-rose-600 font-mono font-bold text-xs">
                  ${selectedDebt.remainingBalance.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-450 block mb-1">PAYMENT AMOUNT ($USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedDebt.remainingBalance}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-bold outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-450 block mb-1">PAYMENT METHOD</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-semibold"
                >
                  <option value="Cash">Cash Drawer Outflow</option>
                  <option value="ABA">ABA Direct Transfer</option>
                  <option value="Bank Transfer">Bank Transfer Wire</option>
                  <option value="QR Payment">QR Payment Scan</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-455 block mb-1">RECONCILIATION NOTES</label>
                <input
                  type="text"
                  placeholder="e.g. Cleared soap batch delivery"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-400 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {lang === 'en' ? 'Cancel' : 'បោះបង់'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-200 hover:bg-emerald-500 cursor-pointer"
                >
                  {lang === 'en' ? 'Disburse Payout' : 'បញ្ចេញការទូទាត់'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DEBT RECORD MODAL PANEL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="add_debt_modal">
          <div className="bg-white border border-slate-150 rounded-2xl max-w-sm w-full p-5 shadow-lg">
            <h4 className="font-bold text-slate-800 text-sm pb-2 border-b border-slate-100">
              Record Suppliers Debt/Invoice
            </h4>
            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4" id="log_debt_action">
              <div>
                <label className="text-[10px] font-bold text-slate-450 block mb-1">SELECT SUPPLIER *</label>
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-semibold"
                  required
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.goodsSupplied})</option>
                  ))}
                  {suppliers.length === 0 && (
                    <option value="">No suppliers registered yet</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-450 block mb-1">INVOICE DEBT ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 150.00"
                    value={debtAmount}
                    onChange={e => setDebtAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-455 block mb-1">LINKED BRANCH</label>
                  <select
                    value={branchInputId}
                    onChange={e => setBranchInputId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.branchName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-450 block mb-1">DUE RECONCILIATION DATE</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-mono font-bold text-slate-650"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-450 block mb-1">PURCHASE DETAILS DESCRIPTION</label>
                <input
                  type="text"
                  placeholder="Consignment order ref #..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5"
                  required
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
                  disabled={suppliers.length === 0}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-500 shadow-md shadow-rose-100 disabled:opacity-50 cursor-pointer"
                >
                  {lang === 'en' ? 'Log Debt' : 'កត់ត្រាបំណុល'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

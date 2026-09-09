/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Coins, 
  Plus, 
  Printer, 
  Search, 
  TrendingUp, 
  X, 
  CheckCircle, 
  Sparkles,
  CreditCard,
  Building,
  Receipt,
  DollarSign,
  Calendar
} from 'lucide-react';
import { Income, LaundryServiceType, Role, Branch, Machine } from '../types';
import { translations } from '../mockData';
import { formatCurrency, formatDualCurrency } from '../utils';

interface DailyIncomeViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  machines: Machine[];
  incomes: Income[];
  setIncomes: React.Dispatch<React.SetStateAction<Income[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
  exchangeRate: number;
}

export default function DailyIncomeView({
  currentRole,
  activeBranchId,
  branches,
  machines,
  incomes,
  setIncomes,
  lang,
  onAddLog,
  exchangeRate
}: DailyIncomeViewProps) {
  const t = translations[lang];
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Income | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form Fields
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [serviceType, setServiceType] = useState<LaundryServiceType>('Washing + Drying');
  const [machineId, setMachineId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(5.0);
  const [discount, setDiscount] = useState(0.0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'ABA' | 'Bank Transfer' | 'QR Payment'>('ABA');
  const [staffInCharge, setStaffInCharge] = useState('Executive Owner');
  const [customerNote, setCustomerNote] = useState('');

  // 1. Resolve accessible branches based on roles
  const getFilteredIncomes = () => {
    let list = Array.isArray(incomes) ? incomes : [];

    if (activeBranchId !== 'all') {
      list = list.filter(inc => inc && inc.branchId === activeBranchId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(inc => 
        inc && (
          inc.serviceType.toLowerCase().includes(q) ||
          inc.staffInCharge.toLowerCase().includes(q) ||
          inc.id.toLowerCase().includes(q) ||
          (inc.customerNote && inc.customerNote.toLowerCase().includes(q))
        )
      );
    }

    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  };

  const filteredIncomes = getFilteredIncomes();

  // Metric totals
  const totalIncomeUsd = filteredIncomes.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  const totalIncomeKhr = Math.round(totalIncomeUsd * exchangeRate);
  const totalTransactionsCount = filteredIncomes.length;
  const abaDigitalCount = filteredIncomes.filter(i => i.paymentMethod === 'ABA' || i.paymentMethod === 'QR Payment').length;

  const getBranchMachines = () => {
    const selectedBranchCode = activeBranchId === 'all' ? 'b1' : activeBranchId;
    return machines.filter(m => m.branchId === selectedBranchCode);
  };

  const branchMachines = getBranchMachines();

  const handleServiceChange = (st: LaundryServiceType) => {
    setServiceType(st);
    if (st === 'Washing') setUnitPrice(3.0);
    else if (st === 'Drying') setUnitPrice(2.5);
    else if (st === 'Washing + Drying') setUnitPrice(5.0);
    else setUnitPrice(10.0);
  };

  const handleRegisterIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity < 1 || unitPrice < 0 || discount < 0) return;

    const actualBranch = activeBranchId === 'all' ? 'b1' : activeBranchId;
    const computedTotal = (quantity * unitPrice) - discount;

    const newIncome: Income = {
      id: 'inc_' + Date.now(),
      branchId: actualBranch,
      date,
      serviceType,
      machineNumber: machineId || 'Manual Washer',
      quantity,
      unitPrice,
      discount,
      totalAmount: computedTotal >= 0 ? computedTotal : 0,
      paymentMethod,
      staffInCharge: currentRole === 'Staff' ? 'Sok Reaksmey' : staffInCharge,
      customerNote
    };

    setIncomes([newIncome, ...incomes]);
    onAddLog(`Logged daily income transaction of ${formatCurrency(newIncome.totalAmount, 'USD')} for service - ${serviceType}`);
    
    setActiveInvoice(newIncome);

    setQuantity(1);
    setDiscount(0);
    setCustomerNote('');
    setShowAddForm(false);
  };

  const triggerPrint = (inc: Income) => {
    const title = `TC Staff Invoice #${inc.id.substring(4, 12)}`;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const khrAmount = Math.round(inc.totalAmount * exchangeRate);
      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body {
                font-family: 'MiSansKhmer', sans-serif;
                padding: 30px;
                max-width: 350px;
                margin: 0 auto;
                font-size: 11px;
                line-height: 1.4;
                color: #1e293b;
              }
              .center { text-align: center; }
              .divider { border-top: 1px dashed #cbd5e1; margin: 12px 0; }
              table { width: 100%; border-collapse: collapse; }
              td { padding: 4px 0; }
              .bold { font-weight: bold; }
              .large { font-size: 14px; }
              .logo { font-size: 20px; font-weight: 800; color: #1d4ed8; margin-bottom: 2px; }
              .footer { font-size: 9px; color: #64748b; margin-top: 25px; text-align: center; }
            </style>
          </head>
          <body onload="window.print();window.close()">
            <div class="center">
              <div class="logo" style="color: #b45309;">toto by Chichi • Coffee corner</div>
              <div>Premium Specialty Coffee & Bakery</div>
              <div class="bold">Tax Invoice / វិក្កយបត្រ</div>
              <div>Tel: 012 888 999</div>
            </div>

            <div class="divider"></div>

            <table>
              <tr><td>Date & Time:</td><td class="bold text-right" style="text-align: right;">${inc.date} (Today)</td></tr>
              <tr><td>Invoice ID:</td><td class="bold text-right" style="text-align: right;">${inc.id.substring(4, 12)}</td></tr>
              <tr><td>Barista / Cashier:</td><td class="bold text-right" style="text-align: right;">${inc.staffInCharge}</td></tr>
            </table>

            <div class="divider"></div>

            <table>
              <tr class="bold">
                <td>Item description</td>
                <td style="text-align: center;">Qty</td>
                <td style="text-align: right;">Price</td>
              </tr>
              <tr>
                <td>${inc.serviceType}</td>
                <td style="text-align: center;">${inc.quantity}</td>
                <td style="text-align: right;">$${inc.unitPrice.toFixed(2)}</td>
              </tr>
            </table>

            <div class="divider"></div>

            <table>
              <tr><td>Subtotal:</td><td style="text-align: right;">$${(inc.quantity * inc.unitPrice).toFixed(2)}</td></tr>
              ${inc.discount > 0 ? `<tr><td>Discount applied:</td><td style="text-align: right;">-$${inc.discount.toFixed(2)}</td></tr>` : ''}
              <tr class="bold large">
                <td>Total Net Paid:</td>
                <td style="text-align: right; color: #b45309;">$${inc.totalAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Total KHR Equivalent:</td>
                <td style="text-align: right;" class="bold">៛${khrAmount.toLocaleString()}</td>
              </tr>
              <tr><td>Payment Method:</td><td style="text-align: right;" class="bold">${inc.paymentMethod}</td></tr>
            </table>

            <div class="divider"></div>
            <div class="center footer">
              Thank you for enjoying our coffee & bakery!<br/>
              Have a wonderful day.<br/>
              *** Powered by Cafe Management AI System ***
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-6" id="daily_income_laundry_module">
      {/* 4 Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-2xs hover:border-slate-200 transition-colors">
          <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider block">TOTAL LAUNDRY REVENUE</span>
          <span className="text-xl font-bold font-mono text-emerald-600 block mt-1">{formatCurrency(totalIncomeUsd, 'USD')}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">៛{totalIncomeKhr.toLocaleString()}</span>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-2xs hover:border-slate-200 transition-colors">
          <span className="text-[10px] text-slate-455 uppercase font-black tracking-wider block">TRANSACTIONS COUNT</span>
          <span className="text-xl font-bold font-mono text-slate-800 block mt-1">{totalTransactionsCount}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">Logged sales receipts</span>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-2xs hover:border-slate-200 transition-colors">
          <span className="text-[10px] text-slate-455 uppercase font-black tracking-wider block">DIGITAL PAYMENT RATIO</span>
          <span className="text-xl font-bold font-mono text-blue-600 block mt-1">
            {totalTransactionsCount > 0 ? Math.round((abaDigitalCount / totalTransactionsCount) * 100) : 0}%
          </span>
          <span className="text-[9px] text-slate-400 block mt-0.5">ABA & Bakong QR payments</span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-150 shadow-2xs">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
          <input
            type="text"
            placeholder={lang === 'en' ? "Search invoice ID, service, staff..." : "ស្វែងរកលេខវិក្កយបត្រ សេវាកម្ម បុគ្គលិក..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-blue-600 font-sans"
          />
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/10 hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer"
          id="btn_add_income_trigger"
        >
          <Plus size={14} />
          {lang === 'en' ? "Record New Laundry Receipt" : "កត់ត្រាការលក់ថ្មី"}
        </button>
      </div>

      {/* Modal Dialog Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRegisterIncome} className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in fade-in" id="form_income_entry">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                <Receipt size={15} className="text-blue-600" />
                {lang === 'en' ? "Log Daily Laundry Sales Transaction" : "កត់ត្រាប្រតិបត្តិការលក់ថ្មី"}
              </h4>
              <button 
                type="button" 
                onClick={() => setShowAddForm(false)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transaction Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600 font-sans"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Service Package *</label>
                <select
                  value={serviceType}
                  onChange={e => handleServiceChange(e.target.value as LaundryServiceType)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600 font-sans font-bold"
                >
                  <option value="Washing">Standard Washing Only ($3.00)</option>
                  <option value="Drying">Express Drying Only ($2.50)</option>
                  <option value="Washing + Drying">Combo: Washing + Drying ($5.00)</option>
                  <option value="Full Service (Fold & Pack)">Full Service: Fold & Pack ($10.00)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Machine Appliance</label>
                <select
                  value={machineId}
                  onChange={e => setMachineId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600 font-sans"
                >
                  <option value="">Choose Machine Unit...</option>
                  {branchMachines.map(m => (
                    <option key={m.id} value={m.machineNumber}>
                      {m.machineNumber} ({m.machineType} - {m.capacity}kg)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity (Loads/Cycles) *</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Unit Price ($) *</label>
                <input
                  type="number"
                  step="0.10"
                  min={0}
                  value={unitPrice}
                  onChange={e => setUnitPrice(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Discount Coupon ($)</label>
                <input
                  type="number"
                  step="0.10"
                  min={0}
                  value={discount}
                  onChange={e => setDiscount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600 font-sans font-bold"
                >
                  <option value="ABA">ABA Mobile Transfer</option>
                  <option value="Cash">Cash (USD/KHR)</option>
                  <option value="QR Payment">Bakong QR Scan</option>
                  <option value="Bank Transfer">Bank Wire Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cashier Staff</label>
                <input
                  type="text"
                  value={staffInCharge}
                  onChange={e => setStaffInCharge(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600 font-sans"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Customer / Service Note</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Customer, Extra Softener requested"
                  value={customerNote}
                  onChange={e => setCustomerNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-600 font-sans"
                />
              </div>
            </div>

            <div className="bg-blue-50/60 p-3 border border-blue-100 rounded-xl flex justify-between items-center text-xs">
              <span className="font-bold text-slate-600 block uppercase tracking-wide text-[10px]">Net Payable Amount:</span>
              <strong className="text-sm font-bold text-blue-700 block font-mono">
                {formatDualCurrency((quantity * unitPrice) - discount, exchangeRate)}
              </strong>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/10 hover:bg-blue-700 cursor-pointer"
              >
                Print & Confirm Receipt
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Income Ledger database table */}
      <div className="bg-white border border-slate-150 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" id="income_ledger_table">
            <thead className="text-[10px] text-slate-400 bg-slate-50/50 border-b border-slate-150 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Receipt ID</th>
                <th className="px-4 py-4">Branch</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Service Type</th>
                <th className="px-4 py-4">Appliance</th>
                <th className="px-4 py-4">Qty</th>
                <th className="px-4 py-4">Total USD</th>
                <th className="px-4 py-4">Total KHR</th>
                <th className="px-4 py-4">Payment</th>
                <th className="px-4 py-4">Staff</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredIncomes.map(inc => (
                <tr key={inc.id} className="hover:bg-slate-50/40 transition">
                  <td className="px-6 py-4 font-mono font-extrabold text-slate-650">
                    #{inc.id.substring(4, 12)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded text-[9px]">
                      {inc.branchId === 'b1' ? 'C24-SN12' : inc.branchId === 'b2' ? 'C24-VS02' : inc.branchId}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600 font-semibold">{inc.date}</td>
                  <td className="px-4 py-4 font-bold text-slate-800">{inc.serviceType}</td>
                  <td className="px-4 py-4 text-slate-500 font-mono text-[10px]">{inc.machineNumber}</td>
                  <td className="px-4 py-4 font-mono font-bold text-slate-700">{inc.quantity}</td>
                  <td className="px-4 py-4 font-bold font-mono text-emerald-700">
                    {formatCurrency(inc.totalAmount, 'USD')}
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-500 text-[10px]">
                    ៛{Math.round(inc.totalAmount * exchangeRate).toLocaleString()}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border select-none
                      ${inc.paymentMethod === 'ABA' || inc.paymentMethod === 'QR Payment' 
                        ? 'bg-blue-50 border-blue-200 text-blue-700' 
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'}
                    `}>
                      {inc.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600 font-medium">{inc.staffInCharge}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => triggerPrint(inc)}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer transition"
                    >
                      <Printer size={12} />
                      Print Receipt
                    </button>
                  </td>
                </tr>
              ))}
              {filteredIncomes.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-slate-400">
                    No daily income receipts found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal Overlay */}
      {activeInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border rounded-2xl max-w-sm w-full p-5 relative shadow-2xl space-y-4">
            <button 
              onClick={() => setActiveInvoice(null)} 
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-700"
            >
              <X size={18} />
            </button>
            
            <div className="text-center pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle size={22} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">Receipt Issued Successfully</h4>
              <span className="text-[10px] text-slate-400 font-mono">ID: #{activeInvoice.id.substring(4, 12)}</span>
            </div>

            <div className="space-y-2 text-xs font-sans text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-400">Service:</span>
                <strong className="font-bold text-slate-800">{activeInvoice.serviceType}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Quantity:</span>
                <strong className="font-bold">{activeInvoice.quantity} Load(s)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment:</span>
                <strong className="font-bold">{activeInvoice.paymentMethod}</strong>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-2 text-sm">
                <span className="font-bold text-slate-800">Total Net:</span>
                <strong className="font-extrabold text-blue-600 font-mono">
                  {formatCurrency(activeInvoice.totalAmount, 'USD')}
                </strong>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setActiveInvoice(null)}
                className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => triggerPrint(activeInvoice)}
                className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/10"
              >
                <Printer size={13} />
                Print Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

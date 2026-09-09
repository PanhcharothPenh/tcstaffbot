/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  AlertTriangle, 
  ShieldAlert, 
  RefreshCw, 
  Trash2, 
  Maximize2,
  X,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { InventoryItem, InventoryCategory, Role, Branch } from '../types';
import { translations } from '../mockData';
import { formatCurrency } from '../utils';

interface InventoryViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function InventoryView({
  currentRole,
  activeBranchId,
  branches,
  inventory,
  setInventory,
  lang,
  onAddLog
}: InventoryViewProps) {
  const t = translations[lang];
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStockMoveModal, setShowStockMoveModal] = useState(false);

  // Target item for Stock In / Out Adjustment
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [moveType, setMoveType] = useState<'In' | 'Out'>('In');
  const [adjustQty, setAdjustQty] = useState(5);
  const [adjustNote, setAdjustNote] = useState('');

  // Form Fields for New Item
  const [name, setName] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('Soap');
  const [unit, setUnit] = useState('កញ្ចប់ (Packs)');
  const [stock, setStock] = useState(20);
  const [minimum, setMinimum] = useState(5);
  const [price, setPrice] = useState(8.5);
  const [supplier, setSupplier] = useState('');

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

  // 2. Filter inventories to comply with branch separation
  const getFilteredInventory = () => {
    let list = Array.isArray(inventory) ? inventory : [];

    if (activeBranchId !== 'all') {
      list = list.filter(i => i.branchId === activeBranchId);
    }

    return list;
  };

  const filteredInventory = getFilteredInventory();

  // Create new inventory item record
  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !supplier) return;

    const actualBranch = activeBranchId === 'all' ? (branches[0]?.id || 'b1') : activeBranchId;

    const newItem: InventoryItem = {
      id: 'inv_' + Date.now(),
      branchId: actualBranch,
      itemName: name,
      category,
      unit,
      currentStock: stock,
      minimumStockAlert: minimum,
      purchasePrice: price,
      supplier,
      purchaseDate: new Date().toISOString().substring(0, 10),
      usedQuantity: 0,
      remainingStock: stock // initialized
    };

    setInventory([newItem, ...inventory]);
    onAddLog(`Added new inventory item "${name}" in database.`);
    
    // reset form fields
    setName('');
    setSupplier('');
    setStock(20);
    setShowAddModal(false);
  };

  // Process Stock In / Out Adjustment
  const handleStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || adjustQty <= 0) return;

    const updated = inventory.map(item => {
      if (item.id === selectedItem.id) {
        let nextCurrent = item.currentStock;
        let nextUsed = item.usedQuantity;

        if (moveType === 'In') {
          // Stock in: increase current base stock
          nextCurrent = item.currentStock + adjustQty;
        } else {
          // Stock out: increase usedQuantity which lowers remainingStock
          nextUsed = item.usedQuantity + adjustQty;
        }

        const nextRem = nextCurrent - nextUsed;

        // Instant Telegram notification on Low Stock trigger during stock output
        if (moveType === 'Out' && nextRem < item.minimumStockAlert) {
          fetch('/api/telegram-trigger-instant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              alertType: 'Low Stock Alert (Instant)',
              branchId: item.branchId,
              details: `• Product Name: ${item.itemName}\n• Category: ${item.category}\n• Adjusted Quantity: -${adjustQty} ${item.unit}\n• Remaining Stock Level: ${nextRem} ${item.unit}\n• Minimum Safe Threshold: ${item.minimumStockAlert} ${item.unit}`,
              actionRequired: `Arrange immediate procurement order of ${item.itemName} from designated suppliers.`
            })
          }).catch(err => console.error('Failed to trigger instant stock alert:', err));
        }

        return {
          ...item,
          currentStock: nextCurrent,
          usedQuantity: nextUsed,
          remainingStock: nextRem >= 0 ? nextRem : 0
        };
      }
      return item;
    });

    setInventory(updated);
    onAddLog(`Adjusted inventory item "${selectedItem.itemName}" [Movement: ${moveType}, Qty: ${adjustQty} ${selectedItem.unit}]`);
    setShowStockMoveModal(false);
    setSelectedItem(null);
    setAdjustQty(5);
  };

  const categoriesList: InventoryCategory[] = [
    'Soap',
    'Fabric Softener',
    'Plastic Bag',
    'Basket',
    'Cleaning Supplies',
    'Other Supplies'
  ];

  const getBranchCode = (bId: string) => {
    const b = branches.find(x => x.id === bId);
    return b ? b.branchCode : bId;
  };

  return (
    <div className="space-y-6" id="inventory_management_module">
      {/* Action Button Bar */}
      <div className="flex justify-end items-center">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-200 hover:bg-emerald-500 transition cursor-pointer"
          id="btn_add_item_trigger"
        >
          <Plus size={14} />
          {t.addNews}
        </button>
      </div>

      {/* Main Inventory Board Grid list */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" id="inventory_items_grid">
        {filteredInventory.map(item => {
          const isLow = item.remainingStock <= item.minimumStockAlert;
          return (
            <div 
              key={item.id} 
              className={`bg-white border rounded-2xl p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between relative
                ${isLow ? 'border-amber-300 bg-amber-50/5' : 'border-slate-100'}
              `}
              id={`inventory_card_${item.id}`}
            >
              {/* Alert Ribbon */}
              {isLow && (
                <span className="absolute top-4 right-4 bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle size={10} />
                  LOW_STOCK
                </span>
              )}

              <div>
                <div className="flex gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 shrink-0 border border-slate-100">
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm truncate max-w-[170px]">{item.itemName}</h3>
                    <div className="flex gap-1.5 items-center mt-1.5">
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        {item.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono">
                        {getBranchCode(item.branchId)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-b border-slate-50/80 py-3.5 my-3.5 text-center">
                  <div className="border-r border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Current balance</span>
                    <strong className="text-base font-bold font-mono text-slate-800 mt-1 block">
                      {item.remainingStock} {item.unit}
                    </strong>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Purchased: {item.currentStock}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Minimum Level</span>
                    <strong className="text-base font-bold font-mono mt-1 block text-slate-800">
                      {item.minimumStockAlert} {item.unit}
                    </strong>
                    <span className="text-[9px] text-red-500 font-semibold block mt-0.5">Consumed: {item.usedQuantity}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-505 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Vendor Supplier:</span>
                    <span className="text-slate-750">{item.supplier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Purchase rate:</span>
                    <span className="text-emerald-700 font-mono font-bold">{formatCurrency(item.purchasePrice, 'USD')} / {item.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Updated On:</span>
                    <span className="text-slate-600 font-mono text-[10px]">{item.purchaseDate}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end gap-1.5">
                <button
                  onClick={() => {
                    setSelectedItem(item);
                    setMoveType('In');
                    setShowStockMoveModal(true);
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold bg-emerald-55/40 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  <TrendingUp size={11} />
                  Stock In (+)
                </button>
                <button
                  onClick={() => {
                    setSelectedItem(item);
                    setMoveType('Out');
                    setShowStockMoveModal(true);
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  <TrendingDown size={11} />
                  Stock Out (-)
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: Create Item */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="inventory_modal_add">
          <div className="bg-white border text-xs border-slate-100 rounded-2xl max-w-lg w-full shadow-lg p-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm">Add Supply Item to Stock</h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4 pt-4" id="form_create_item">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block flex justify-between items-center">
                    <span>Item Name *</span>
                    <span className="text-[9px] text-pink-600 font-bold uppercase">Preset Brands:</span>
                  </label>
                  <div className="flex items-center gap-1.5 mb-2">
                    {['Comfort', 'Ora', 'Siusip'].map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setName(prev => prev ? `${prev} (${b})` : b)}
                        className="px-2 py-0.5 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-700 text-[10px] font-bold rounded-lg transition-all"
                      >
                        + {b}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Comfort Liquid Detergent (5L)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Stock Category *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Measuring Unit *</label>
                  <input
                    type="text"
                    placeholder="e.g. Bottle (5L) or Rolls"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Initial Purchase Qty *</label>
                  <input
                    type="number"
                    value={stock}
                    onChange={e => setStock(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Alert Level Threshold *</label>
                  <input
                    type="number"
                    value={minimum}
                    onChange={e => setMinimum(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Purchase Price Unit (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Supplier Vendor Name *</label>
                  <input
                    type="text"
                    placeholder="Phnom Penh Wholesales Ltd"
                    value={supplier}
                    onChange={e => setSupplier(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-200 hover:bg-emerald-500 cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Adjust Stock Movement */}
      {showStockMoveModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="inventory_modal_adjust_move">
          <div className="bg-white border rounded-2xl max-w-sm w-full p-5 shadow-lg">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm">Stock Adjustment</h4>
              <button 
                onClick={() => {
                  setShowStockMoveModal(false);
                  setSelectedItem(null);
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleStockAdjustment} className="space-y-4 pt-4" id="form_adjust_stock">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-450 uppercase block font-bold tracking-wider">Item Selected</span>
                <strong className="text-xs text-slate-800 block mt-0.5">{selectedItem.itemName}</strong>
                <span className="text-[10px] text-slate-400 mt-1 block">Current remaining level: <strong>{selectedItem.remainingStock} {selectedItem.unit}</strong></span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1 block">Movement Type</label>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <button
                    type="button"
                    onClick={() => setMoveType('In')}
                    className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 focus:outline-none cursor-pointer
                      ${moveType === 'In' 
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800' 
                        : 'border-slate-200 hover:bg-slate-55'
                      }
                    `}
                  >
                    <Plus size={14} />
                    Stock In (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveType('Out')}
                    className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 focus:outline-none cursor-pointer
                      ${moveType === 'Out' 
                        ? 'bg-amber-50 border-amber-400 text-amber-800' 
                        : 'border-slate-200 hover:bg-slate-55'
                      }
                    `}
                  >
                    <TrendingDown size={14} />
                    Stock Out (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1 block">Quantity ({selectedItem.unit}) *</label>
                <input
                  type="number"
                  min={1}
                  value={adjustQty}
                  onChange={e => setAdjustQty(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-mono focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1 block">Movement Note</label>
                <input
                  type="text"
                  placeholder="e.g. Regular washer consumption, weekly fillup"
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowStockMoveModal(false);
                    setSelectedItem(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-200 hover:bg-emerald-500 cursor-pointer"
                >
                  Process Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

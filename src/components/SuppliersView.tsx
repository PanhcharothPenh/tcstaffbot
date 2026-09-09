import React, { useState } from 'react';
import { Truck, Plus, CheckCircle, Trash2, Edit3, X, MapPin, Contact, Phone } from 'lucide-react';
import { Supplier, Role, Branch } from '../types';

interface SuppliersViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function SuppliersView({
  currentRole,
  activeBranchId,
  branches,
  suppliers,
  setSuppliers,
  lang,
  onAddLog
}: SuppliersViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [goodsSupplied, setGoodsSupplied] = useState('');
  const [branchInputId, setBranchInputId] = useState('b1');

  const isOwnerAdminManager = ['Owner', 'Admin', 'Manager'].includes(currentRole);

  const getFilteredSuppliers = () => {
    let list = suppliers;
    if (activeBranchId !== 'all') {
      list = list.filter(s => s.branchId === activeBranchId);
    }
    return list;
  };

  const filteredSuppliers = getFilteredSuppliers();

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setName('');
    setPhone('');
    setAddress('');
    setContactPerson('');
    setGoodsSupplied('');
    setBranchInputId(activeBranchId === 'all' ? 'b1' : activeBranchId);
    setShowModal(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name);
    setPhone(s.phone);
    setAddress(s.address);
    setContactPerson(s.contactPerson);
    setGoodsSupplied(s.goodsSupplied);
    setBranchInputId(s.branchId);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingSupplier) {
      // Edit mode
      const updated = suppliers.map(s => {
        if (s.id === editingSupplier.id) {
          return {
            ...s,
            branchId: branchInputId,
            name,
            phone,
            address,
            contactPerson,
            goodsSupplied,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      });
      setSuppliers(updated);
      onAddLog(`Edited Supplier "${name}" successfully.`);
    } else {
      // Add mode
      const newItem: Supplier = {
        id: 'sup_' + Date.now(),
        branchId: branchInputId,
        name,
        phone,
        address,
        contactPerson,
        goodsSupplied,
        createdBy: currentRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setSuppliers([newItem, ...suppliers]);
      onAddLog(`Registered Supplier "${name}" successfully.`);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string, sName: string) => {
    if (window.confirm(lang === 'en' ? `Are you sure you want to delete supplier "${sName}"?` : `តើអ្នកពិតជាចង់លុបអ្នកផ្គត់ផ្គង់ "${sName}" ឬ?`)) {
      setSuppliers(suppliers.filter(s => s.id !== id));
      onAddLog(`Deleted supplier: "${sName}"`);
    }
  };

  const getBranchName = (bId: string) => {
    const found = branches.find(b => b.id === bId);
    return found ? found.branchName : bId;
  };

  return (
    <div className="space-y-6" id="suppliers_module">
      {/* Action Button Bar */}
      {isOwnerAdminManager && (
        <div className="flex justify-end items-center">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-200 hover:bg-emerald-500 transition cursor-pointer"
            id="add_new_supplier_btn"
          >
            <Plus size={14} />
            {lang === 'en' ? 'Add Supplier' : 'បង្កើតអ្នកផ្គត់ផ្គង់'}
          </button>
        </div>
      )}

      {/* Primary table element */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" id="suppliers_info_table">
            <thead className="text-[11px] text-slate-400 uppercase bg-slate-50 border-b border-slate-100 font-bold">
              <tr>
                <th className="px-6 py-3">{lang === 'en' ? 'Vendor Name' : 'ឈ្មោះដៃគូ'}</th>
                <th className="px-4 py-3">{lang === 'en' ? 'Goods Supplied' : 'ទំនិញផ្គត់ផ្គង់'}</th>
                <th className="px-4 py-3">{lang === 'en' ? 'Branch Connection' : 'សាខាទំនាក់ទំនង'}</th>
                <th className="px-4 py-3">{lang === 'en' ? 'Contact Person' : 'អ្នកតំណាង'}</th>
                <th className="px-4 py-3">{lang === 'en' ? 'Phone Number' : 'លេខទូរស័ព្ទ'}</th>
                <th className="px-4 py-3">{lang === 'en' ? 'Locality Address' : 'អាសយដ្ឋាន'}</th>
                {isOwnerAdminManager && <th className="px-6 py-3 text-right">{lang === 'en' ? 'Actions' : 'ការកែសម្រួល'}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map(s => (
                <tr key={s.id} className="hover:bg-slate-55/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6.5 h-6.5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold font-mono text-[10px] uppercase">
                        {s.name.charAt(0)}
                      </div>
                      <span className="font-extrabold text-slate-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px]">
                      {s.goodsSupplied}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {getBranchName(s.branchId)}
                  </td>
                  <td className="px-4 py-4 text-slate-600 flex items-center gap-1 font-medium">
                    <Contact size={12} className="text-slate-400" />
                    {s.contactPerson}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-650">
                    <div className="flex items-center gap-1">
                      <Phone size={12} className="text-slate-400" />
                      {s.phone}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-450 text-[10px] truncate max-w-xs font-suwannaphum">
                    <div className="flex items-center gap-1">
                      <MapPin size={11} className="text-slate-400" />
                      {s.address}
                    </div>
                  </td>
                  {isOwnerAdminManager && (
                    <td className="px-6 py-4 text-right space-x-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1 px-2.5 bg-slate-50 border border-slate-205 py-1 rounded-md text-slate-600 hover:bg-slate-100 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Edit3 size={11} /> {lang==='en'?'Edit':'កែ'}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        className="p-1 px-2.5 bg-rose-50 border border-rose-100 text-rose-600 py-1 rounded-md text-[10px] font-bold hover:bg-rose-100 cursor-pointer inline-flex items-center gap-1"
                      >
                        <Trash2 size={11} /> {lang==='en'?'Delete':'លុប'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-450 bg-slate-50/25">
                    {lang === 'en' ? 'No suppliers registered for this branch view.' : 'មិនទាន់មានអ្នកផ្គត់ផ្គង់ដែលបានទិន្នន័យឡើយ។'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT/ADD MODAL PANEL COMPONENTS */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="supplier_form_modal">
          <div className="bg-white border border-slate-100 rounded-2xl max-w-md w-full shadow-lg p-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h4 className="font-extrabold text-slate-800 text-sm">
                {editingSupplier ? (lang === 'en' ? 'Edit Supplier' : 'កែសម្រួលអ្នកផ្គត់ផ្គង់') : (lang === 'en' ? 'Register New Supplier' : 'បង្កើតអ្នកផ្គត់ផ្គង់ថ្មី')}
              </h4>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4" id="form_supplier_action">
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1 block">Supplier Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Cleanchem Supply"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 outline-none focus:border-emerald-505"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Phone Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. 023 888 777"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Contact Person</label>
                  <input
                    type="text"
                    placeholder="Representative Name"
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Goods Supplied</label>
                  <input
                    type="text"
                    placeholder="e.g. Soap and softeners"
                    value={goodsSupplied}
                    onChange={e => setGoodsSupplied(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">Linked Branch</label>
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
                <label className="text-[11px] font-bold text-slate-500 mb-1 block">Full Address Location</label>
                <textarea
                  placeholder="Street No, Sangkat, Khan, Capital/Province"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 h-16 resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  {lang === 'en' ? 'Cancel' : 'បោះបង់'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-200 hover:bg-emerald-500 cursor-pointer"
                >
                  {lang === 'en' ? 'Save Supplier' : 'រក្សាទុក'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

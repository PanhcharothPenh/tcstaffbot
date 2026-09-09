/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Save, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  AlertTriangle, 
  Plus, 
  X, 
  Users, 
  Sliders, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  ToggleLeft, 
  ToggleRight,
  Sparkles,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { Role, Branch } from '../types';

interface TelegramRecipient {
  id: string;
  branch_id: string;
  branchId: string;
  recipient_name: string;
  name: string;
  chat_id: string;
  chatId: string;
  bot_token_encrypted: string;
  botTokenEncrypted: string;
  recipient_type: 'PRIVATE_CHAT' | 'GROUP_CHAT' | 'CHANNEL';
  recipientType: 'PRIVATE_CHAT' | 'GROUP_CHAT' | 'CHANNEL';
  group_name: string;
  groupName: string;
  alert_types: string[];
  alertTypes: string[];
  is_default: boolean;
  isDefault: boolean;
  is_enabled: boolean;
  isEnabled: boolean;
  botTokenMasked: string;
  created_at?: string;
  updated_at?: string;
}

interface TelegramSettingsViewProps {
  currentRole: Role;
  branches: Branch[];
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

const alertTypesList = [
  { id: 'low_stock', label: 'Low Stock Alerts', desc: 'Detergents, softeners, gas, and coins balances shortages' },
  { id: 'salary', label: 'Salary Approaching Due', desc: 'Alerts Owner/Admins when staff payroll dates are near' },
  { id: 'daily_business', label: 'Daily Business Summary', desc: 'Consolidated end-of-day revenue vs expense reports' },
  { id: 'machine', label: 'Machine Malfunction Warnings', desc: 'Fired immediately if hardware changes to Broken or Maintenance status' },
  { id: 'custom', label: 'Custom Operations Reminders', desc: 'Dispatched on specific scheduling frequencies' }
];

export default function TelegramSettingsView({ 
  currentRole, 
  branches, 
  lang,
  onAddLog 
}: TelegramSettingsViewProps) {
  // Recipients Management state
  const [recipients, setRecipients] = useState<TelegramRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Permissions state
  const [permissions, setPermissions] = useState({ admin: true, manager: false });
  const [isPermsLoading, setIsPermsLoading] = useState(true);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState('all');
  const [recipientName, setRecipientName] = useState('');
  const [chatId, setChatId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [groupName, setGroupName] = useState('');
  const [recipientType, setRecipientType] = useState<'PRIVATE_CHAT' | 'GROUP_CHAT' | 'CHANNEL'>('GROUP_CHAT');
  const [selectedAlertTypes, setSelectedAlertTypes] = useState<string[]>(['low_stock', 'machine']);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  // UI state
  const [showToken, setShowToken] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

  // Determine configuration permissions for logged-in user
  const hasConfigurePermission = currentRole === 'Owner' || 
    (currentRole === 'Admin' && permissions.admin) || 
    (currentRole === 'Manager' && permissions.manager);

  // Fetch recipients and role permissions
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const resRec = await fetch('/api/telegram-recipients');
      const dataRec = await resRec.json();
      setRecipients(Array.isArray(dataRec) ? dataRec : []);

      const resPerm = await fetch('/api/telegram-permissions');
      const dataPerm = await resPerm.json();
      setPermissions(dataPerm || { admin: true, manager: false });
    } catch (e) {
      console.error('Failed fetching Telegram configs:', e);
    } finally {
      setIsLoading(false);
      setIsPermsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentRole]);

  // Handle saving recipient (POST / PUT)
  const handleSaveRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasConfigurePermission) {
      alert(lang === 'en' ? 'Unauthorized: You do not have permissions to modify Telegram settings.' : 'ឥតមានសិទ្ធិ៖ អ្នកមិនមានសិទ្ធិកែប្រែការកំណត់ Telegram ទេ។');
      return;
    }

    if (!recipientName.trim()) {
      alert(lang === 'en' ? 'Recipient Name is required.' : 'សូមបញ្ចូលឈ្មោះអ្នកទទួល។');
      return;
    }
    if (!chatId.trim()) {
      alert(lang === 'en' ? 'Telegram Chat ID is required.' : 'សូមបញ្ចូល Telegram Chat ID។');
      return;
    }
    if (!botToken.trim()) {
      alert(lang === 'en' ? 'Telegram Bot Token is required.' : 'សូមបញ្ចូល Telegram Bot Token។');
      return;
    }

    setIsBusy(true);
    setTestStatus(null);

    const payload = {
      branch_id: branchId,
      branchId: branchId,
      recipient_name: recipientName,
      name: recipientName,
      chat_id: chatId,
      chatId: chatId,
      bot_token: botToken,
      botToken: botToken,
      recipient_type: recipientType,
      recipientType: recipientType,
      group_name: groupName,
      groupName: groupName,
      alert_types: selectedAlertTypes,
      alertTypes: selectedAlertTypes,
      is_default: isDefault,
      isDefault: isDefault,
      is_enabled: isEnabled,
      isEnabled: isEnabled,
      createdBy: currentRole
    };

    try {
      const url = editingId ? `/api/telegram-recipients/${editingId}` : '/api/telegram-recipients';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (res.ok && result.success) {
        onAddLog(editingId 
          ? `Updated Telegram recipient target "${recipientName}"` 
          : `Created new secure Telegram recipient target "${recipientName}"`
        );
        alert(lang === 'en' 
          ? 'Telegram configuration saved & encrypted securely!' 
          : 'ការកំណត់អ្នកទទួល Telegram ត្រូវបានរក្សាទុក និងកូដនីយកម្មដោយសុវត្ថិភាព!'
        );
        resetForm();
        fetchData();
      } else {
        alert((lang === 'en' ? 'Failed to save configuration: ' : 'ការរក្សាទុកបានបរាជ័យ៖ ') + (result.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsBusy(false);
    }
  };

  // Test send to recipient prior to or after saving
  const handleTestSend = async () => {
    if (!chatId.trim() || !botToken.trim()) {
      alert(lang === 'en' ? 'Please fill out both Chat ID and Bot Token to test first!' : 'សូមបញ្ចូល Chat ID និង Bot Token ជាមុនសិនដើម្បីសាកល្បង!');
      return;
    }

    setIsBusy(true);
    setTestStatus({ msg: lang === 'en' ? 'Transmitting handshake signal...' : 'កំពុងបញ្ជូនសញ្ញាសាកល្បង...' });

    try {
      const res = await fetch('/api/telegram-recipients/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken,
          chatId,
          recipientName,
          recipientType,
          groupName
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus({ success: true, msg: lang === 'en' ? 'Handshake successful! Check Telegram chat.' : 'ជោគជ័យ! សូមពិនិត្យមើលកម្មវិធី Telegram របស់អ្នក។' });
        onAddLog(`Dispatched test validation message to Telegram Chat ${chatId}.`);
      } else {
        setTestStatus({ success: false, msg: data.error || 'Unknown Telegram Error' });
      }
    } catch (err: any) {
      setTestStatus({ success: false, msg: err.message || 'Connection timeout' });
    } finally {
      setIsBusy(false);
    }
  };

  // Setup form for editing
  const handleEdit = (rec: TelegramRecipient) => {
    setEditingId(rec.id);
    setBranchId(rec.branch_id || rec.branchId || 'all');
    setRecipientName(rec.recipient_name || rec.name || '');
    setChatId(rec.chat_id || rec.chatId || '');
    setBotToken(rec.botTokenMasked || '');
    setGroupName(rec.group_name || rec.groupName || '');
    setRecipientType(rec.recipient_type || rec.recipientType || 'GROUP_CHAT');
    setSelectedAlertTypes(rec.alert_types || rec.alertTypes || []);
    setIsEnabled(rec.is_enabled !== undefined ? rec.is_enabled : (rec.isEnabled !== undefined ? rec.isEnabled : true));
    setIsDefault(rec.is_default !== undefined ? rec.is_default : (rec.isDefault !== undefined ? rec.isDefault : false));
    setTestStatus(null);
  };

  // Delete recipient target
  const handleDelete = async (id: string, name: string) => {
    if (!hasConfigurePermission) {
      alert('Unauthorized operation.');
      return;
    }

    if (!confirm(lang === 'en' ? `Are you sure you want to delete "${name}" recipient settings?` : `តើអ្នកពិតជាចង់លុបការកំណត់ "${name}" មែនទេ?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/telegram-recipients/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        onAddLog(`Cleared Telegram recipient target "${name}"`);
        fetchData();
        if (editingId === id) resetForm();
      } else {
        alert('Could not delete.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Reset core form
  const resetForm = () => {
    setEditingId(null);
    setBranchId('all');
    setRecipientName('');
    setChatId('');
    setBotToken('');
    setGroupName('');
    setRecipientType('GROUP_CHAT');
    setSelectedAlertTypes(['low_stock', 'machine']);
    setIsEnabled(true);
    setIsDefault(false);
    setTestStatus(null);
  };

  // Handle toggling alert checkboxes
  const toggleAlertCheckbox = (id: string) => {
    setSelectedAlertTypes(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Save role permissions toggles (Owner only)
  const handleTogglePermission = async (role: 'admin' | 'manager', currentVal: boolean) => {
    if (currentRole !== 'Owner') {
      alert(lang === 'en' ? 'Only the Owner is authorized to change configuration permission scopes.' : 'មានតែម្ចាស់ប្រព័ន្ធប៉ុណ្ណោះដែលអាចកែប្រែសិទ្ធិកំណត់រចនាសម្ព័ន្ធបាន។');
      return;
    }

    const payload = {
      [role]: !currentVal
    };

    try {
      const res = await fetch('/api/telegram-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setPermissions(prev => ({ ...prev, [role]: !currentVal }));
        onAddLog(`Toggled Telegram Settings configuration permission for ${role} role to ${!currentVal}`);
      }
    } catch (e) {
      console.error('Error saving permission bounds:', e);
    }
  };

  if (currentRole === 'Staff') {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm space-y-4">
        <ShieldAlert className="text-rose-500 mx-auto" size={48} />
        <h3 className="font-bold text-slate-800 text-base">Access Restricted</h3>
        <p className="text-slate-500 text-xs leading-relaxed">
          Staff personnel are strictly forbidden from modifying or viewing Telegram connectivity configurations in compliance with strict corporate audit security policies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* SECURITY GATE WARNING */}
      {!hasConfigurePermission && (
        <div className="p-4 bg-amber-50 border border-amber-150 rounded-2xl flex gap-3 text-amber-950 text-xs leading-relaxed">
          <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div>
            <strong className="font-bold block text-amber-900 mb-0.5">Authorization Notice (View-Only Mode)</strong>
            <span>
              Your signed-in active role <span className="font-bold font-mono bg-amber-100 px-1.5 py-0.5 rounded text-amber-800">{currentRole}</span> does not currently hold management permissions for active Telegram bot credentials. Contact the system Owner to elevate authorization levels.
            </span>
          </div>
        </div>
      )}

      {/* ADMISTRATIVE ACCESS CONTROLS (Displayed only for Owner role) */}
      {currentRole === 'Owner' && (
        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="text-slate-700 shrink-0" size={16} />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
              ADMINISTRATIVE ROLE PERMISSION CONSTRAINTS
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed max-w-2xl">
            Grant or restrict configuration capabilities for auxiliary roles. When disabled, users of that role can read channel assignments and view historical archives, but are locked out of secret modification keys.
          </p>
          <div className="flex flex-wrap gap-6 pt-1">
            <button
              onClick={() => handleTogglePermission('admin', permissions.admin)}
              className="flex items-center gap-2.5 bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs transition"
            >
              <Users size={14} className="text-slate-400" />
              <span>Admin Role Edit Privilege:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${permissions.admin ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {permissions.admin ? 'ALLOWED' : 'BLOCKED'}
              </span>
            </button>

            <button
              onClick={() => handleTogglePermission('manager', permissions.manager)}
              className="flex items-center gap-2.5 bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs transition"
            >
              <Users size={14} className="text-slate-400" />
              <span>Manager Role Edit Privilege:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${permissions.manager ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {permissions.manager ? 'ALLOWED' : 'BLOCKED'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* CORE GRID: FORM AND LIST */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* RECIPIENT SETTING FORM PANEL */}
        <div className="xl:col-span-5 bg-white border border-slate-100 p-5 rounded-2xl shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="text-indigo-600" size={16} />
              {editingId ? 'Edit Telegram Target' : 'Register Telegram Target'}
            </h4>
            {editingId && (
              <button 
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <form onSubmit={handleSaveRecipient} className="space-y-4">
            
            {/* Branch and Type ROW */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 block">TARGET BRANCH</label>
                <select
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  disabled={!hasConfigurePermission}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none"
                >
                  <option value="all">Global (All Branches)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 block">RECIPIENT TYPE</label>
                <select
                  value={recipientType}
                  onChange={e => setRecipientType(e.target.value as any)}
                  disabled={!hasConfigurePermission}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none"
                >
                  <option value="GROUP_CHAT">Group Chat</option>
                  <option value="CHANNEL">Broadcast Channel</option>
                  <option value="PRIVATE_CHAT">Private Chat</option>
                </select>
              </div>
            </div>

            {/* Recipient Name */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 mb-1 block">RECIPIENT NAME (LABEL)</label>
              <input
                type="text"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                disabled={!hasConfigurePermission}
                placeholder="e.g. Toul Kork Night Shifts Alerts"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:bg-white"
                required
              />
            </div>

            {/* Group/Channel Name optional */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 mb-1 block">TELEGRAM CHAT / GROUP TITLE (REF)</label>
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                disabled={!hasConfigurePermission}
                placeholder="e.g. Clean24 Operations Room"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:bg-white"
              />
            </div>

            {/* Secure Token input */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 mb-1 block">TELEGRAM BOT TOKEN SECURE KEY *</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={botToken}
                  onChange={e => setBotToken(e.target.value)}
                  disabled={!hasConfigurePermission}
                  placeholder={editingId ? '123456:**** (Kept unchanged)' : 'e.g. 5991823190:AAF6vMy-VUr...'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono pr-10 focus:outline-none focus:bg-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 transition"
                >
                  {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <span className="text-[9px] text-slate-400 block mt-1 leading-normal">
                Encrypted via symmetric AES-256 standard on write. Raw keys are never shown outside server memories.
              </span>
            </div>

            {/* Telegram Chat ID */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 mb-1 block">TARGET TELEGRAM CHAT / THREAD ID *</label>
              <input
                type="text"
                value={chatId}
                onChange={e => setChatId(e.target.value)}
                disabled={!hasConfigurePermission}
                placeholder="e.g. -10018872213 (Group) or 8821415 (Private)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:bg-white"
                required
              />
            </div>

            {/* Subscription Checkboxes */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold text-slate-500 block">SUBSCRIBED ALERT CATEGORIES</span>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-slate-100 rounded-xl p-3 bg-slate-50">
                {alertTypesList.map(item => (
                  <label key={item.id} className="flex items-start gap-2.5 hover:bg-slate-100/50 p-1 rounded cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={selectedAlertTypes.includes(item.id)}
                      onChange={() => toggleAlertCheckbox(item.id)}
                      disabled={!hasConfigurePermission}
                      className="mt-0.5 text-slate-700 cursor-pointer accent-indigo-600 rounded"
                    />
                    <div>
                      <span className="text-[11px] font-semibold text-slate-700 block">{item.label}</span>
                      <span className="text-[9px] text-slate-400 block">{item.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Default and Enabled layout */}
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={e => setIsEnabled(e.target.checked)}
                  disabled={!hasConfigurePermission}
                  className="rounded text-slate-600 cursor-pointer accent-indigo-600"
                />
                <span>Account Enabled</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  disabled={!hasConfigurePermission}
                  className="rounded text-slate-600 cursor-pointer accent-indigo-600"
                />
                <span>Set Default</span>
              </label>
            </div>

            {/* Test Send Feedback message */}
            {testStatus && (
              <div className={`p-2.5 rounded-xl text-[11px] leading-relaxed flex gap-2 border ${testStatus.success === true ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : testStatus.success === false ? 'bg-rose-50 text-rose-800 border-rose-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                {testStatus.success === true ? (
                  <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={13} />
                ) : testStatus.success === false ? (
                  <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={13} />
                ) : (
                  <Sparkles className="text-indigo-600 shrink-0 animate-spin mt-0.5" size={13} />
                )}
                <span>{testStatus.msg}</span>
              </div>
            )}

            {/* Form actions and Test block */}
            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={handleTestSend}
                disabled={isBusy}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 px-3 rounded-xl text-xs hover:bg-slate-200 cursor-pointer transition font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send size={13} />
                Test Send
              </button>

              {hasConfigurePermission && (
                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex-1 bg-indigo-600 text-white py-2.5 px-3 rounded-xl text-xs hover:bg-indigo-500 font-medium flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-150 transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                >
                  <Save size={13} />
                  {editingId ? 'Update Target' : 'Save Config'}
                </button>
              )}
            </div>

          </form>
        </div>

        {/* RECIPIENTS TARGET MANAGEMENT WORKSPACE LIST */}
        <div className="xl:col-span-7 bg-white border border-slate-100 p-5 rounded-2xl shadow-xs space-y-4 overflow-x-auto">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
              <Sliders size={15} className="text-indigo-600" />
              Registered Telegram Recipients List
            </h5>
            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full font-bold">
              {recipients.length} Targets
            </span>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[11px]">Syncing live channel lists...</p>
            </div>
          ) : recipients.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl space-y-2">
              <Bot className="text-slate-300 mx-auto" size={36} />
              <p className="text-[11px] text-slate-400">No Telegram recipient targets registered in database.</p>
              <p className="text-[10px] text-indigo-500">Formulate and save your first alert endpoint on the left panel!</p>
            </div>
          ) : (
            <div className="overflow-x-auto min-w-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50/75 select-none text-slate-500 font-medium">
                    <th className="p-2.5 pl-3">Recipient & Chat ID</th>
                    <th className="p-2.5">Branch Context</th>
                    <th className="p-2.5">Credentials Token</th>
                    <th className="p-2.5">Alert Types</th>
                    <th className="p-2.5 pr-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recipients.map(rec => {
                    const branchName = rec.branch_id === 'all' || rec.branchId === 'all'
                      ? 'All Branches'
                      : (branches.find(b => b.id === rec.branch_id || b.id === rec.branchId)?.branchName || 'Unknown');
                    
                    return (
                      <motion.tr 
                        key={rec.id}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`hover:bg-slate-50/50 transition-colors ${rec.id === editingId ? 'bg-indigo-50/30' : ''}`}
                      >
                        {/* Name and Chat ID */}
                        <td className="p-2.5 pl-3 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 tracking-tight">
                              {rec.recipient_name || rec.name}
                            </span>
                            {rec.is_default || rec.isDefault ? (
                              <span className="text-[8px] uppercase font-bold tracking-wider px-1.5 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded">
                                Default
                              </span>
                            ) : null}
                            <span className={`w-1.5 h-1.5 rounded-full ${rec.is_enabled || rec.isEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          </div>
                          <div className="flex flex-col text-[10px] text-slate-400 font-mono space-y-0.5">
                            <span>ID: {rec.chat_id || rec.chatId}</span>
                            {rec.group_name || rec.groupName ? (
                              <span className="text-slate-500 font-sans">Group: {rec.group_name || rec.groupName}</span>
                            ) : null}
                            <span className="text-[9px] uppercase bg-slate-100 border border-slate-150 px-1 rounded self-start mt-0.5 font-bold tracking-tight text-slate-600">
                              {rec.recipient_type || rec.recipientType || 'GROUP'}
                            </span>
                          </div>
                        </td>

                        {/* Branch */}
                        <td className="p-2.5">
                          <span className="font-semibold text-slate-600">
                            {branchName}
                          </span>
                        </td>

                        {/* Masked Bot Token */}
                        <td className="p-2.5">
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-50/75 border border-slate-150 px-1.5 py-0.5 rounded block max-w-[150px] truncate" title={rec.botTokenMasked}>
                            {rec.botTokenMasked || '••••••••'}
                          </span>
                        </td>

                        {/* Alerts count */}
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {(rec.alert_types || rec.alertTypes || []).map((alt: string) => (
                              <span key={alt} className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition border border-transparent">
                                {alt === 'low_stock' ? 'Stocks' : alt === 'salary' ? 'Salary' : alt === 'daily_business' ? 'Business' : alt === 'machine' ? 'Hardware' : alt}
                              </span>
                            ))}
                            {(rec.alert_types || rec.alertTypes || []).length === 0 && (
                              <span className="text-amber-600 italic text-[10px]">None Subscribed</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-2.5 pr-3 text-right">
                          <div className="flex items-center justify-end gap-1 px-1">
                            <button
                              onClick={() => handleEdit(rec)}
                              title="Edit target properties"
                              className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 cursor-pointer transition"
                            >
                              <Edit3 size={12} />
                            </button>
                            {hasConfigurePermission && (
                              <button
                                onClick={() => handleDelete(rec.id, rec.recipient_name || rec.name)}
                                title="Delete registered target"
                                className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>

                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* QUICK TROUBLESHOOTING GUIDE */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 space-y-3">
        <h5 className="font-bold text-slate-700 text-xs flex items-center gap-1.5 uppercase tracking-wider">
          <Info size={14} className="text-slate-600" />
          Technical Handshake Integration Guidelines
        </h5>
        <div className="text-[11px] text-slate-500 space-y-2 leading-relaxed">
          <p>
            1) <b>Setting up your Bot:</b> Open Telegram and query <code>@BotFather</code>. Send <code>/newbot</code>, complete the prompts, and duplicate the resulting HTTP API Key Token directly into the left side configuration block.
          </p>
          <p>
            2) <b>Acquiring Target Thread/Chat IDs:</b> Search for your generated bot and send <code>/start</code>. For private alerts, message <code>@userinfobot</code> to copy your digital Chat ID. For groups, add the bot, invite <code>@RawDataBot</code> or dispatch any trigger, and parse the returned JSON results for the group identifier (typically begins with a negative index like <code>-100...</code>).
          </p>
          <p>
            3) <b>Handshake Verification:</b> Always hit the <b>Test Send</b> button before committing. A successful test creates a system-wide trace log verifying bot routing membership in your Telegram channels.
          </p>
        </div>
      </div>

    </div>
  );
}

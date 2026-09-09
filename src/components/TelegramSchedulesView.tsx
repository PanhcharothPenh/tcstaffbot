/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Check, X, Send, Play, AlertCircle, Info, Clock,
  Calendar, ToggleLeft, ToggleRight, RefreshCw, User, Users, Shield, Link, HelpCircle
} from 'lucide-react';

interface AlertSchedule {
  id: string;
  branchId: string;
  alertType: string;
  templateId: string;
  recipientId: string;
  frequency: 'INSTANT' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  sendTime: string; // HH:MM
  dayOfWeek: string; // Sunday, Monday, etc.
  dayOfMonth: string; // 1 to 31, or 'last'
  isEnabled: boolean;
  lastSentAt: string | null;
  nextSendAt: string | null;
  createdBy: string;
  createdAt: string;
}

interface Recipient {
  id: string;
  name: string;
  chatId: string;
  branchId: string;
  role: string | 'Group' | 'Owner' | 'Manager' | 'Staff';
  isEnabled: boolean;
  createdAt: string;
}

interface TemplateItem {
  id: string;
  name: string;
  category: string;
}

interface Branch {
  id: string;
  branchName: string;
}

interface TelegramSchedulesViewProps {
  branches: Branch[];
}

export default function TelegramSchedulesView({ branches }: TelegramSchedulesViewProps) {
  // Tabs within this view: 'schedules' or 'recipients'
  const [activeTab, setActiveTab] = useState<'schedules' | 'recipients'>('schedules');
  
  // Data list states
  const [schedules, setSchedules] = useState<AlertSchedule[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  
  // Loading & notification states
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errMessage, setErrMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Edit / Modals toggle state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [editingSchedule, setEditingSchedule] = useState<AlertSchedule | null>(null);
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState<boolean>(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);

  // Schedule form bindings
  const [schForm, setSchForm] = useState({
    branchId: 'all',
    alertType: 'Daily Revenue Summary',
    templateId: '',
    recipientId: '',
    frequency: 'DAILY' as const,
    sendTime: '21:00',
    dayOfWeek: 'Sunday',
    dayOfMonth: '1',
    isEnabled: true
  });

  // Recipient form bindings
  const [recForm, setRecForm] = useState({
    name: '',
    chatId: '',
    branchId: 'all',
    role: 'Group',
    isEnabled: true
  });

  const categories = [
    'Daily Revenue Summary',
    'Daily Expense Summary',
    'Daily Profit Summary',
    'Low Stock Alert',
    'Coin Alert',
    'Gas Alert',
    'Salary Reminder',
    'Machine Maintenance',
    'Machine Broken',
    'Cash Difference',
    'Month-End Closing',
    'Backup Success',
    'Backup Failure'
  ];

  const daysOfWeek = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  // Load everything
  const loadData = async () => {
    setLoading(true);
    try {
      const [resSch, resRec, resTpl] = await Promise.all([
        fetch('/api/telegram-schedules'),
        fetch('/api/telegram-recipients'),
        fetch('/api/telegram-templates')
      ]);

      const dataSch = await resSch.json();
      const dataRec = await resRec.json();
      const dataTpl = await resTpl.json();

      const arrSch = Array.isArray(dataSch) ? dataSch : [];
      const arrRec = Array.isArray(dataRec) ? dataRec : [];
      const arrTpl = Array.isArray(dataTpl) ? dataTpl : [];

      setSchedules(arrSch);
      setRecipients(arrRec);
      setTemplates(arrTpl);
      
      // Auto assign first recipient if available in form state
      if (arrRec.length > 0 && !schForm.recipientId) {
        setSchForm(prev => ({ ...prev, recipientId: arrRec[0].id }));
      }
      if (arrTpl.length > 0 && !schForm.templateId) {
        setSchForm(prev => ({ ...prev, templateId: arrTpl[0].id }));
      }

      setErrMessage(null);
    } catch (err: any) {
      setErrMessage('Unable to synchronize data registers from server repository.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toastSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const toastError = (msg: string) => {
    setErrMessage(msg);
    setTimeout(() => setErrMessage(null), 4000);
  };

  // Recipient deletion handling
  const handleDeleteRecipient = async (id: string) => {
    if (!window.confirm('Delete this recipient channel listing? This will detach linked triggers.')) return;
    try {
      const res = await fetch(`/api/telegram-recipients/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toastSuccess('Recipient registration retracted.');
        setRecipients(prev => prev.filter(r => r.id !== id));
      } else {
        toastError(data.error || 'Failed to remove recipient.');
      }
    } catch (e) {
      toastError('Network error on command delivery.');
    }
  };

  // Recipient Submit handler
  const handleSaveRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recForm.name || !recForm.chatId) {
      toastError('Please fill out Name and real Chat ID coordinates.');
      return;
    }
    setSubmitting(true);
    try {
      const isEdit = !!editingRecipient;
      const url = isEdit ? `/api/telegram-recipients/${editingRecipient.id}` : '/api/telegram-recipients';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recForm)
      });
      const data = await res.json();
      if (data.success) {
        toastSuccess(isEdit ? 'Recipient configs updated.' : 'New Recipient connected.');
        setIsRecipientModalOpen(false);
        setEditingRecipient(null);
        // Reload list
        const updatedRecs = await fetch('/api/telegram-recipients').then(r => r.json());
        setRecipients(Array.isArray(updatedRecs) ? updatedRecs : []);
      } else {
        toastError(data.error || 'Failed saving recipient parameters.');
      }
    } catch (err) {
      toastError('Network connection timeout.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle recipient switcher
  const toggleRecipientActive = async (rec: Recipient) => {
    try {
      const res = await fetch(`/api/telegram-recipients/${rec.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !rec.isEnabled })
      });
      const data = await res.json();
      if (data.success) {
        setRecipients(prev => prev.map(r => r.id === rec.id ? { ...r, isEnabled: !r.isEnabled } : r));
        toastSuccess(`Recipient ${rec.name} updated.`);
      }
    } catch (e) {
      toastError('Failed to toggle status.');
    }
  };

  // Open recipient modal for creation / edit
  const openRecipientModal = (rec: Recipient | null = null) => {
    if (rec) {
      setEditingRecipient(rec);
      setRecForm({
        name: rec.name,
        chatId: rec.chatId,
        branchId: rec.branchId,
        role: rec.role,
        isEnabled: rec.isEnabled
      });
    } else {
      setEditingRecipient(null);
      setRecForm({
        name: '',
        chatId: '',
        branchId: 'all',
        role: 'Group',
        isEnabled: true
      });
    }
    setIsRecipientModalOpen(true);
  };

  // Schedule deletion handler
  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm('Wipe out this automated schedule record permanently?')) return;
    try {
      const res = await fetch(`/api/telegram-schedules/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toastSuccess('Schedule deleted safely.');
        setSchedules(prev => prev.filter(s => s.id !== id));
      } else {
        toastError(data.error);
      }
    } catch (err) {
      toastError('Communication fault.');
    }
  };

  // Schedule Submit handler
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isEdit = !!editingSchedule;
      const url = isEdit ? `/api/telegram-schedules/${editingSchedule.id}` : '/api/telegram-schedules';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schForm)
      });
      const data = await res.json();
      if (data.success) {
        toastSuccess(isEdit ? 'Schedule updated.' : 'New alert schedule added successfully.');
        setIsScheduleModalOpen(false);
        setEditingSchedule(null);
        // Reload list
        const updatedSchedules = await fetch('/api/telegram-schedules').then(r => r.json());
        setSchedules(Array.isArray(updatedSchedules) ? updatedSchedules : []);
      } else {
        toastError(data.error);
      }
    } catch (err) {
      toastError('Server payload rejection.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle schedule switch
  const toggleScheduleActive = async (s: AlertSchedule) => {
    try {
      const res = await fetch(`/api/telegram-schedules/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !s.isEnabled })
      });
      const data = await res.json();
      if (data.success) {
        setSchedules(prev => prev.map(item => item.id === s.id ? { ...item, isEnabled: !item.isEnabled } : item));
        toastSuccess(`Schedule status updated.`);
      }
    } catch (e) {
      toastError('Failed to alter active state.');
    }
  };

  // Open schedule modal
  const openScheduleModal = (s: AlertSchedule | null = null) => {
    if (s) {
      setEditingSchedule(s);
      setSchForm({
        branchId: s.branchId,
        alertType: s.alertType,
        templateId: s.templateId,
        recipientId: s.recipientId,
        frequency: s.frequency,
        sendTime: s.sendTime || '21:00',
        dayOfWeek: s.dayOfWeek || 'Sunday',
        dayOfMonth: s.dayOfMonth || '1',
        isEnabled: s.isEnabled
      });
    } else {
      setEditingSchedule(null);
      setSchForm({
        branchId: 'all',
        alertType: 'Daily Revenue Summary',
        templateId: templates[0]?.id || '',
        recipientId: recipients[0]?.id || '',
        frequency: 'DAILY',
        sendTime: '21:00',
        dayOfWeek: 'Sunday',
        dayOfMonth: '1',
        isEnabled: true
      });
    }
    setIsScheduleModalOpen(true);
  };

  // MANUAL FORCE TEST LIVE DISPATCH SENDER
  const handleTriggerManualDispatch = async (s: AlertSchedule) => {
    setTestingId(s.id);
    try {
      const res = await fetch(`/api/telegram-schedules/trigger-manual/${s.id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toastSuccess(`Dispatched custom live metrics! Checked chat logs.`);
        // Reload list for lastSentAt update
        const updatedSchedules = await fetch('/api/telegram-schedules').then(r => r.json());
        setSchedules(Array.isArray(updatedSchedules) ? updatedSchedules : []);
      } else {
        toastError(`Delivery issues: ${data.error || 'Check Bot Token config'}`);
      }
    } catch (e) {
      toastError('Timeout waiting for telegram validation loops.');
    } finally {
      setTestingId(null);
    }
  };

  const calculateNextSendPreview = (s: AlertSchedule) => {
    if (!s.isEnabled) return 'Disabled';
    if (s.frequency === 'INSTANT') return 'Triggers instantly on event';
    
    // approximate time display
    return `${s.frequency} at ${s.sendTime || 'not configured'}${
      s.frequency === 'WEEKLY' ? ` (Every ${s.dayOfWeek || 'Sunday'})` : ''
    }${
      s.frequency === 'MONTHLY' ? ` (Day ${s.dayOfMonth || '1'} of Month)` : ''
    }`;
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Toasts / Alerts notifications */}
      {successMessage && (
        <div id="toast-success" className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs animate-pulse">
          <Check className="text-emerald-600 shrink-0" size={16} />
          <span>{successMessage}</span>
        </div>
      )}
      {errMessage && (
        <div id="toast-error" className="p-4 bg-rose-50 border border-rose-150 rounded-2xl flex items-center gap-3 text-rose-900 text-xs">
          <AlertCircle className="text-rose-600 shrink-0" size={16} />
          <span>{errMessage}</span>
        </div>
      )}

      {/* Main workspace navigation bar */}
      <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1.5 w-fit">
        <button
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
            activeTab === 'schedules'
              ? 'bg-white text-slate-800 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar size={13} className="inline mr-1.5 align-middle" />
          Alert Trigger Schedules ({schedules.length})
        </button>
        <button
          onClick={() => setActiveTab('recipients')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
            activeTab === 'recipients'
              ? 'bg-white text-slate-800 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={13} className="inline mr-1.5 align-middle" />
          Recipients & Channels ({recipients.length})
        </button>
      </div>

      {loading ? (
        <div className="bg-white border rounded-2xl p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
          <RefreshCw size={24} className="text-slate-400 animate-spin" />
          <span>Reading active workspace settings structures...</span>
        </div>
      ) : activeTab === 'schedules' ? (
        /* SCHEDULES PANEL LAYOUT */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                Automated Scheduling Triggers
              </h4>
              <span className="text-[11px] text-slate-400">Determine exactly who receives daily summaries, stock warnings and breakdown alerts, and matching frequencies.</span>
            </div>
            <button
              onClick={() => openScheduleModal(null)}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={14} />
              Hook Alert Trigger
            </button>
          </div>

          {schedules.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center text-xs text-slate-400">
              No alert schedules currently defined on the server DB. Hook a template above to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schedules.map(s => {
                const rec = recipients.find(r => r.id === s.recipientId);
                const tpl = templates.find(t => t.id === s.templateId);
                const branchObj = branches.find(b => b.id === s.branchId);

                return (
                  <div key={s.id} className={`bg-white border text-xs rounded-2xl p-4.5 space-y-4 shadow-xs relative transition ${
                    s.isEnabled ? 'border-amber-200/60 bg-amber-50/5' : 'border-slate-100 bg-slate-50/5'
                  }`}>
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            s.isEnabled ? 'bg-amber-100 text-amber-800' : 'bg-slate-150 text-slate-600'
                          }`}>
                            {s.frequency}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">{s.id}</span>
                        </div>
                        <h5 className="font-bold text-slate-800 text-sm mt-1">{s.alertType}</h5>
                      </div>
                      
                      {/* Active Toggle Switch */}
                      <button 
                        onClick={() => toggleScheduleActive(s)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {s.isEnabled ? (
                          <ToggleRight size={22} className="text-amber-600" />
                        ) : (
                          <ToggleLeft size={22} className="text-slate-400" />
                        )}
                      </button>
                    </div>

                    {/* Metadata Section */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-slate-100/85 py-3 text-[11px] leading-tight text-slate-600">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Associated Branch:</span>
                        <strong className="text-slate-750 font-bold">{s.branchId === 'all' ? '🌐 All Branches' : (branchObj?.branchName || 'Specific Branch')}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Template Selected:</span>
                        <strong className="text-slate-750 font-semibold">{tpl ? tpl.name : 'System Generated Default text'}</strong>
                      </div>
                      <div className="mt-1">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Target Channel Chat:</span>
                        <strong className="text-slate-750 font-bold text-indigo-600 flex items-center gap-0.5">
                          <Users size={10} className="inline shrink-0" />
                          {rec ? rec.name : 'Owner fallback chat'}
                        </strong>
                      </div>
                      <div className="mt-1">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Send Schedule Preview:</span>
                        <span className="font-mono text-slate-800 block mt-0.5 text-[10pxBG] font-semibold">{calculateNextSendPreview(s)}</span>
                      </div>
                    </div>

                    {/* Footer Stats / Manual Action Trigger tools */}
                    <div className="flex justify-between items-center text-[10px] text-slate-400 flex-wrap gap-2 pt-1">
                      <div>
                        <span>Last Dispatch: </span>
                        <span className="font-mono text-slate-600 font-medium">
                          {s.lastSentAt ? new Date(s.lastSentAt).toLocaleString() : 'Never triggered yet'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          onClick={() => openScheduleModal(s)}
                          className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer transition flex items-center gap-1 text-[11px]"
                        >
                          <Edit size={10} />
                          Modify configs
                        </button>
                        
                        <button
                          onClick={() => handleTriggerManualDispatch(s)}
                          disabled={testingId === s.id}
                          className="p-1 px-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg cursor-pointer transition flex items-center gap-1 text-[11px] disabled:opacity-50"
                        >
                          {testingId === s.id ? (
                            <RefreshCw size={10} className="animate-spin" />
                          ) : (
                            <Play size={10} />
                          )}
                          Test Message
                        </button>

                        <button
                          onClick={() => handleDeleteSchedule(s.id)}
                          className="p-1.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-500 rounded-lg cursor-pointer transition"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* RECIPIENTS PANEL LAYOUT */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                Recipient Channels & Chats List
              </h4>
              <span className="text-[11px] text-slate-400">Allows multiple Telegram Chats, private bots, and executive managers to receive branch alerts.</span>
            </div>
            <button
              onClick={() => openRecipientModal(null)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={14} />
              Register Chat Channel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipients.map(r => {
              const bObj = branches.find(b => b.id === r.branchId);
              return (
                <div key={r.id} className="bg-white border border-slate-150/70 p-4 rounded-2xl flex flex-col justify-between hover:shadow-xs transition relative">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-slate-400">{r.id}</span>
                      <button
                        onClick={() => toggleRecipientActive(r)}
                        className="cursor-pointer"
                      >
                        {r.isEnabled ? (
                          <ToggleRight size={22} className="text-indigo-600" />
                        ) : (
                          <ToggleLeft size={22} className="text-slate-400" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-start gap-2.5 mt-2.5">
                      <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl mt-0.5 shrink-0">
                        {r.role === 'Owner' || r.role === 'Manager' ? <User size={15} /> : <Users size={15} />}
                      </div>
                      <div className="text-xs">
                        <strong className="font-bold text-slate-800 text-[13px] block">{r.name}</strong>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Role/Scope: {r.role}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3.5 flex flex-col gap-1.5 text-[11px] leading-none">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Secure Telegram Chat ID:</span>
                      <span className="font-mono text-slate-800 font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-[10px] tracking-wide">{r.chatId}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Branch Attached:</span>
                      <strong className="text-slate-700 font-medium">{r.branchId === 'all' ? '🌐 All Clean24' : (bObj?.branchName || 'Assigned Branch')}</strong>
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto mt-2.5 pt-1.5 border-t border-dashed border-slate-100 w-full justify-end">
                      <button
                        onClick={() => openRecipientModal(r)}
                        className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-lg cursor-pointer text-[10px] flex items-center gap-1"
                      >
                        <Edit size={10} />
                        Edit config
                      </button>
                      <button
                        onClick={() => handleDeleteRecipient(r.id)}
                        className="p-1 px-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold rounded-lg cursor-pointer text-[10px]"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SCHEDULE SETTING FORM MODAL BOX */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative flex flex-col gap-5 border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Calendar size={15} className="text-amber-600" />
                {editingSchedule ? 'Edit Alert trigger Schedule' : 'Hook automated alerts scheduler options'}
              </h4>
              <button 
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-650 p-1 cursor-pointer hover:bg-slate-50 rounded-lg text-sm"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
              {/* Branch Picker */}
              <div>
                <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Scope Branch *</label>
                <select
                  value={schForm.branchId}
                  onChange={e => setSchForm(prev => ({ ...prev, branchId: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                >
                  <option value="all">all - System-Wide</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              {/* Alert Category Selection */}
              <div>
                <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Alert/Reports category *</label>
                <select
                  value={schForm.alertType}
                  onChange={e => setSchForm(prev => ({ ...prev, alertType: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Target Channel Recipient */}
              <div>
                <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Dispatch Recipient Group *</label>
                <select
                  value={schForm.recipientId}
                  onChange={e => setSchForm(prev => ({ ...prev, recipientId: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                  required
                >
                  <option value="">-- Choose target chat/group channel --</option>
                  {recipients.map(r => (
                    <option key={r.id} value={r.id}>{r.name} (ID: {r.chatId})</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Ensure you added recipients first in the Recipients panel tab.
                </p>
              </div>

              {/* Pair Design Template */}
              <div>
                <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Pair Message Design template *</label>
                <select
                  value={schForm.templateId}
                  onChange={e => setSchForm(prev => ({ ...prev, templateId: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 pr-8 focus:outline-none pr-8 focus:ring-1 focus:ring-amber-500 font-medium"
                  required
                >
                  <option value="">-- Choose customized layout template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                  ))}
                </select>
              </div>

              {/* Frequencies Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Schedule Frequency *</label>
                  <select
                    value={schForm.frequency}
                    onChange={e => setSchForm(prev => ({ ...prev, frequency: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                  >
                    <option value="INSTANT">⚡ Instant Alert</option>
                    <option value="DAILY">📅 Daily Alert</option>
                    <option value="WEEKLY">🗓️ Weekly Alert</option>
                    <option value="MONTHLY">🗓️ Monthly Alert</option>
                    <option value="CUSTOM">⚙️ Custom Schedule</option>
                  </select>
                </div>

                {/* Send Time */}
                {schForm.frequency !== 'INSTANT' && (
                  <div>
                    <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Prefered Send Time *</label>
                    <input
                      type="time"
                      value={schForm.sendTime}
                      onChange={e => setSchForm(prev => ({ ...prev, sendTime: e.target.value }))}
                      required
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Conditional Day choices depending on selection */}
              {schForm.frequency === 'WEEKLY' && (
                <div>
                  <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Day of the Week *</label>
                  <select
                    value={schForm.dayOfWeek}
                    onChange={e => setSchForm(prev => ({ ...prev, dayOfWeek: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none font-medium text-slate-700 focus:ring-1 focus:ring-amber-500"
                  >
                    {daysOfWeek.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              {schForm.frequency === 'MONTHLY' && (
                <div>
                  <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Day of Month *</label>
                  <select
                    value={schForm.dayOfMonth}
                    onChange={e => setSchForm(prev => ({ ...prev, dayOfMonth: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                  >
                    <option value="1">1st day of month</option>
                    <option value="5">5th day of month</option>
                    <option value="10">10th day of month</option>
                    <option value="15">15th day of month</option>
                    <option value="20">20th day of month</option>
                    <option value="25">25th day of month</option>
                    <option value="last">Last Day of Month (Dynamic)</option>
                  </select>
                </div>
              )}

              {/* Active Toggle */}
              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100/90 mt-2">
                <input
                  type="checkbox"
                  id="sch_enabled"
                  checked={schForm.isEnabled}
                  onChange={e => setSchForm(prev => ({ ...prev, isEnabled: e.target.checked }))}
                  className="w-4 h-4 text-amber-500 bg-slate-50 rounded-xs border-slate-300 focus:ring-amber-500 accent-amber-500 cursor-pointer"
                />
                <label htmlFor="sch_enabled" className="block text-slate-700 font-bold cursor-pointer select-none">
                  Enable alert trigger active schedule
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="w-1/2 p-2.5 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl cursor-pointer text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 p-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl cursor-pointer shadow-xs font-bold disabled:opacity-50"
                >
                  {submitting ? 'Encrypting...' : editingSchedule ? 'Save Changes' : 'Hook alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECIPIENT SETTING MODAL BOX */}
      {isRecipientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 relative flex flex-col gap-5 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Users size={15} className="text-indigo-600" />
                {editingRecipient ? 'Edit Recipient Settings' : 'Add Recipient register'}
              </h4>
              <button 
                onClick={() => setIsRecipientModalOpen(false)}
                className="text-slate-400 hover:text-slate-650 p-1 cursor-pointer hover:bg-slate-50 rounded-lg text-sm"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveRecipient} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Friendly Recipient Name *</label>
                <input
                  type="text"
                  placeholder="e.g. PP Manager Chat / Tech department Group"
                  value={recForm.name}
                  onChange={e => setRecForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-755"
                />
              </div>

              <div>
                <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Secure Telegram Chat ID *</label>
                <input
                  type="text"
                  placeholder="e.g. -1002019318 or 938101511"
                  value={recForm.chatId}
                  onChange={e => setRecForm(prev => ({ ...prev, chatId: e.target.value }))}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block mt-1">Give real Group Chat IDs starting with minus (-)</span>
              </div>

              <div>
                <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Target Assigned Branch</label>
                <select
                  value={recForm.branchId}
                  onChange={e => setSchForm(prev => ({ ...prev, branchId: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 pr-8 focus:outline-none pr-8 focus:ring-1 focus:ring-indigo-500 font-semibold"
                >
                  <option value="all">all - System-Wide</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-500 mb-1 block uppercase text-[10px]">Recipient Role Group</label>
                <select
                  value={recForm.role}
                  onChange={e => setRecForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none font-bold"
                >
                  <option value="Group">General Group Channel</option>
                  <option value="Owner">Primary Owner Console</option>
                  <option value="Manager">Active Manager alertbox</option>
                  <option value="Staff">Staff support team</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100/90 mt-2">
                <input
                  type="checkbox"
                  id="rec_enabled"
                  checked={recForm.isEnabled}
                  onChange={e => setRecForm(prev => ({ ...prev, isEnabled: e.target.checked }))}
                  className="w-4 h-4 text-indigo-500 bg-slate-50 rounded-xs border-slate-300 focus:ring-indigo-500 accent-indigo-500 cursor-pointer"
                />
                <label htmlFor="rec_enabled" className="block text-slate-700 font-bold cursor-pointer select-none">
                  Set Channel status to active state
                </label>
              </div>

              <div className="flex gap-2 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsRecipientModalOpen(false)}
                  className="w-1/2 p-2.5 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl cursor-pointer text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer shadow-xs font-bold disabled:opacity-50"
                >
                  {submitting ? 'Connecting...' : editingRecipient ? 'Save Changes' : 'Connect Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

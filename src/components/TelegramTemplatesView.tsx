/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Check, X, Send, Play, AlertCircle, Info, Sparkles, 
  HelpCircle, ToggleLeft, ToggleRight, CheckSquare, Square, RefreshCw, Eye, Globe, Bot
} from 'lucide-react';

interface TelegramTemplate {
  id: string;
  name: string;
  category: string;
  isEnabled: boolean;
  engTemplate: string;
  khmerTemplate: string;
  parseMode: 'HTML' | 'Markdown';
  branchId: string; // 'all' or specific branch ID
  targetGroups: string[];
}

interface Branch {
  id: string;
  branchName: string;
}

interface TelegramTemplatesViewProps {
  branches: Branch[];
}

export default function TelegramTemplatesView({ branches }: TelegramTemplatesViewProps) {
  const [templates, setTemplates] = useState<TelegramTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit/Create form state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formTemplate, setFormTemplate] = useState<Partial<TelegramTemplate>>({
    name: '',
    category: 'Daily Revenue Summary',
    isEnabled: true,
    engTemplate: '',
    khmerTemplate: '',
    parseMode: 'HTML',
    branchId: 'all',
    targetGroups: []
  });
  
  // Custom single text entry helper for targetGroups
  const [groupInput, setGroupInput] = useState<string>('');

  // Interactive message test modal/pane states
  const [testTemplate, setTestTemplate] = useState<TelegramTemplate | null>(null);
  const [testLang, setTestLang] = useState<'en' | 'kh'>('kh');
  const [testCustomChatId, setTestCustomChatId] = useState<string>('');
  const [testLogs, setTestLogs] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

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

  const variables = [
    { name: '{branch_name}', desc: 'Branch operational name' },
    { name: '{date}', desc: 'Current calendar date' },
    { name: '{time}', desc: 'Time of occurrence' },
    { name: '{revenue}', desc: 'Branch revenue amount' },
    { name: '{expense}', desc: 'Expense or payroll amount' },
    { name: '{profit}', desc: 'Net gross profitability' },
    { name: '{staff_count}', desc: 'Registered staff count' },
    { name: '{coin_balance}', desc: 'Dispenser coins balance' },
    { name: '{item_name}', desc: 'Inventory stock item name' },
    { name: '{remaining_qty}', desc: 'In-stock stock unit levels' },
    { name: '{minimum_qty}', desc: 'Low status benchmark level' },
    { name: '{machine_no}', desc: 'Chamber operational number' },
    { name: '{status}', desc: 'Performance/success status flags' },
    { name: '{message}', desc: 'Detailed log description block' }
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/telegram-templates');
      if (!res.ok) throw new Error('Could not pull existing templates from database.');
      const data = await res.json();
      setTemplates(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error pulling templates list.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setFormTemplate({
      name: '',
      category: 'Daily Revenue Summary',
      isEnabled: true,
      engTemplate: '<b>📊 {category_placeholder} Summary</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n📅 <b>Time:</b> {date} {time}\n📝 <b>Details:</b> {message}',
      khmerTemplate: '<b>📊 របាយការណ៍ {category_placeholder}</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n📅 <b>ម៉ោង:</b> {date} {time}\n📝 <b>ព័ត៌មានលម្អិត:</b> {message}',
      parseMode: 'HTML',
      branchId: 'all',
      targetGroups: []
    });
    setGroupInput('');
    setIsEditing(true);
  };

  const handleEdit = (tmpl: TelegramTemplate) => {
    setFormTemplate(tmpl);
    setGroupInput(tmpl.targetGroups ? tmpl.targetGroups.join(', ') : '');
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this Telegram template? This change is irreversible.")) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/telegram-templates/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Deletion route returned an error.');
      setSuccessMessage('Template deleted successfully!');
      fetchTemplates();
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not delete template.');
    }
  };

  const handleToggleState = async (tmpl: TelegramTemplate) => {
    try {
      const updatedEnabled = !tmpl.isEnabled;
      const res = await fetch(`/api/telegram-templates/${tmpl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: updatedEnabled })
      });
      if (res.ok) {
        setTemplates(prev => prev.map(t => t.id === tmpl.id ? { ...t, isEnabled: updatedEnabled } : t));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedGroups = groupInput
      .split(',')
      .map(g => g.trim())
      .filter(g => g.length > 0);

    const updatedTemplate = {
      ...formTemplate,
      targetGroups: parsedGroups
    };

    try {
      const isNew = !updatedTemplate.id;
      const url = isNew ? '/api/telegram-templates' : `/api/telegram-templates/${updatedTemplate.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method: method,
        heading: { 'Accept': 'application/json' },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTemplate)
      } as any);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to submit template.');
      }

      setSuccessMessage(isNew ? 'Template configured successfully!' : 'Template updated successfully!');
      setIsEditing(false);
      fetchTemplates();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing request.');
    }
  };

  const triggerTestSubmit = async () => {
    if (!testTemplate) return;
    setIsTesting(true);
    setTestLogs(null);

    try {
      const res = await fetch('/api/telegram-templates/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: testTemplate.id,
          selectedLanguage: testLang,
          customChatId: testCustomChatId ? testCustomChatId.trim() : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Test notification delivery failed.');
      }

      setTestLogs({
        success: true,
        message: data.message,
        simulated: data.simulated,
        text: data.dispatched_text,
        recipients: data.recipientsOnMockLogs
      });
    } catch (err: any) {
      setTestLogs({
        success: false,
        error: err.message || 'Handshake test route error.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const insertVariable = (variableName: string, lang: 'en' | 'kh') => {
    if (lang === 'en') {
      const cur = formTemplate.engTemplate || '';
      setFormTemplate(p => ({ ...p, engTemplate: cur + variableName }));
    } else {
      const cur = formTemplate.khmerTemplate || '';
      setFormTemplate(p => ({ ...p, khmerTemplate: cur + variableName }));
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 p-2 sm:p-6" id="telegram_template_workspace">
      {/* Messages */}
      {errorMessage && (
        <div className="max-w-5xl mx-auto mb-4 bg-rose-50 border border-rose-150 rounded-xl p-4 text-xs text-rose-800 flex items-start gap-2.5 shadow-xs" id="template_error_alert">
          <AlertCircle className="text-rose-600 mt-0.5 shrink-0" size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="max-w-5xl mx-auto mb-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs text-emerald-800 flex items-start gap-2.5 shadow-xs animate-pulse" id="template_success_alert">
          <Check className="text-emerald-600 mt-0.5 shrink-0" size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Primary header */}
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-base font-black text-indigo-950 flex items-center gap-1.5 uppercase tracking-wide">
            <Sparkles size={16} className="text-emerald-500" />
            Telegram Message Template Management
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Build and map custom event triggers, bilingual translation templates, and branch targeting for instant automated Telegram threads without changing code.
          </p>
        </div>

        {!isEditing && (
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 hover:shadow-md text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
            id="register_new_template_btn"
          >
            <Plus size={14} />
            Create Telegram Template
          </button>
        )}
      </div>

      {isEditing ? (
        /* 📝 CREATE / EDIT FORM PANEL */
        <div className="max-w-5xl mx-auto bg-white border border-slate-100 rounded-2xl shadow-sm p-6" id="template_builder_form">
          <h3 className="font-bold text-indigo-950 text-xs uppercase tracking-wider border-b border-slate-100 pb-3 mb-5 flex items-center justify-between">
            <span>{formTemplate.id ? 'Edit Telegram Template' : 'Configure New Telegram Template'}</span>
            <button
              onClick={() => setIsEditing(false)}
              className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </h3>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Settings */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">TEMPLATE NAME *</label>
                  <input
                    type="text"
                    required
                    value={formTemplate.name || ''}
                    onChange={e => setFormTemplate(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-semibold"
                    placeholder="e.g. Phnom Penh Low Soap Warning Alert"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">CATEGORY *</label>
                    <select
                      value={formTemplate.category || 'Daily Revenue Summary'}
                      onChange={e => setFormTemplate(p => ({ ...p, category: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none font-semibold cursor-pointer text-slate-700"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">PARSE FORMAT *</label>
                    <select
                      value={formTemplate.parseMode || 'HTML'}
                      onChange={e => setFormTemplate(p => ({ ...p, parseMode: e.target.value as any }))}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none font-semibold cursor-pointer text-slate-700 font-mono"
                    >
                      <option value="HTML">HTML (Recommended)</option>
                      <option value="Markdown">Markdown</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">BRANCH AFFILIATION</label>
                    <select
                      value={formTemplate.branchId || 'all'}
                      onChange={e => setFormTemplate(p => ({ ...p, branchId: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none font-semibold cursor-pointer text-slate-700"
                    >
                      <option value="all">Apply system-wide (All Branches)</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.branchName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">TARGET TELEGRAM GROUP ID(S)</label>
                    <input
                      type="text"
                      value={groupInput}
                      onChange={e => setGroupInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none font-mono"
                      placeholder="e.g. -1002931082, -1004928117 (comma separated)"
                    />
                    <span className="text-[9px] text-slate-400 block mt-1">Leaves empty to fallback to configured general Owner/Admin chat IDs.</span>
                  </div>
                </div>

                {/* Variable Tokens Helper Box */}
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 mt-2">
                  <h4 className="text-[10px] font-bold text-indigo-950 uppercase tracking-widest flex items-center gap-1 mb-2">
                    <HelpCircle size={12} className="text-indigo-600" />
                    Supported Variable Replacements
                  </h4>
                  <p className="text-[9px] text-slate-400 leading-relaxed mb-3">
                    Click onto any tag below to insert it straight at the end of active text template:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {variables.map(v => (
                      <div key={v.name} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => insertVariable(v.name, 'en')}
                          className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 text-[10px] rounded font-mono font-bold font-semibold text-left shrink-0 cursor-pointer"
                        >
                          {v.name}
                        </button>
                        <span className="text-[9px] text-slate-400 truncate block">{v.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bilingual Text Areas */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-600">
                      🇺🇸 ENGLISH TEMPLATE FORMAT *
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormTemplate(p => ({ ...p, engTemplate: (p.engTemplate || '') + '🧼 ' }))}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      Insert Soap Emoji 🧼
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    required
                    value={formTemplate.engTemplate || ''}
                    onChange={e => setFormTemplate(p => ({ ...p, engTemplate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                    placeholder="Enter English styled text payload..."
                  />
                  {formTemplate.parseMode === 'HTML' && (
                    <span className="text-[9px] text-slate-400 block mt-0.5">Supports standard HTML tags: <code>&lt;b&gt;, &lt;i&gt;, &lt;code&gt;, &lt;u&gt;</code></span>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-600">
                      🇰🇭 KHMER TEMPLATE FORMAT *
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormTemplate(p => ({ ...p, khmerTemplate: (p.khmerTemplate || '') + '🇰🇭 ' }))}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      Insert Flag 🇰🇭
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    required
                    value={formTemplate.khmerTemplate || ''}
                    onChange={e => setFormTemplate(p => ({ ...p, khmerTemplate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                    placeholder="វាយអត្ថបទជាភាសាខ្មែរ..."
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 rounded-xl text-xs cursor-pointer transition active:scale-[0.98]"
              >
                Go Back
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold hover:shadow-md rounded-xl text-xs cursor-pointer transition active:scale-[0.98]"
                id="save_template_submit_btn"
              >
                Save Template Configuration
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* 📋 MAIN GRID LIST PANE */
        <div className="max-w-5xl mx-auto space-y-6">
          {loading ? (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-12 text-center" id="templates_loading_deck">
              <RefreshCw className="animate-spin text-slate-400 mx-auto mb-3" size={24} />
              <p className="text-xs text-slate-400 font-semibold">Synchronizing localized templates ledger...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-12 text-center">
              <AlertCircle className="text-slate-300 mx-auto mb-2" size={32} />
              <h3 className="text-sm font-bold text-slate-700 mb-1">No Custom Templates Registered</h3>
              <p className="text-xs text-slate-400">Press the create button helper above to generate custom database driven templates.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="templates_grid_catalog">
              
              {/* LEFT: TEMPLATE LIST */}
              <div className="space-y-4">
                <h3 className="font-bold text-indigo-950 text-xs uppercase tracking-wider border-b border-indigo-50 pb-2 mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-indigo-600 rounded"></span>
                  Active Templates ({templates.length})
                </h3>

                <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1.5">
                  {templates.map(tmpl => (
                    <div 
                      key={tmpl.id} 
                      className={`p-4 bg-white border rounded-xl shadow-xs hover:shadow-md transition-all relative ${
                        tmpl.isEnabled ? 'border-slate-150' : 'border-slate-205 opacity-60'
                      } ${testTemplate?.id === tmpl.id ? 'border-l-indigo-600 border-l-4' : ''}`}
                    >
                      {/* Top banner info */}
                      <div className="flex items-start justify-between gap-2.5 mb-2.5">
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-indigo-950 truncate" id={`template_title_${tmpl.id}`}>
                            {tmpl.name}
                          </h4>
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-slate-50 border border-slate-200 text-[9px] font-mono font-bold text-slate-500 rounded uppercase tracking-wider">
                            {tmpl.category}
                          </span>
                        </div>

                        {/* Enable/Disable Toggle */}
                        <button
                          onClick={() => handleToggleState(tmpl)}
                          className="shrink-0 text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                          title={tmpl.isEnabled ? "Disable active template" : "Enable inactive template"}
                          id={`toggle_template_status_${tmpl.id}`}
                        >
                          {tmpl.isEnabled ? (
                            <ToggleRight size={22} className="text-indigo-600" />
                          ) : (
                            <ToggleLeft size={22} />
                          )}
                        </button>
                      </div>

                      <div className="text-[10px] text-slate-400 space-y-1 mb-3.5 leading-normal">
                        <div className="flex justify-between">
                          <span>Parser Mode:</span>
                          <strong className="font-mono font-black text-slate-500 uppercase">{tmpl.parseMode}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Target Branch:</span>
                          <strong className="text-slate-600">
                            {tmpl.branchId === 'all' ? 'All (System Wide)' : (branches.find(b => b.id === tmpl.branchId)?.branchName || tmpl.branchId)}
                          </strong>
                        </div>
                        {tmpl.targetGroups && tmpl.targetGroups.length > 0 && (
                          <div className="flex justify-between">
                            <span>Chat Targets:</span>
                            <strong className="font-mono text-emerald-600 truncate max-w-[200px]" title={tmpl.targetGroups.join(', ')}>
                              {tmpl.targetGroups.join(', ')}
                            </strong>
                          </div>
                        )}
                      </div>

                      {/* Control buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-50 justify-between">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setTestTemplate(tmpl);
                              setTestLogs(null);
                            }}
                            className="bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                            id={`test_template_sel_btn_${tmpl.id}`}
                          >
                            <Play size={11} className="fill-current" />
                            Run Tests
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(tmpl)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg shrink-0 cursor-pointer transition border border-slate-205"
                            title="Edit configurations"
                            id={`edit_template_btn_${tmpl.id}`}
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(tmpl.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg shrink-0 cursor-pointer transition border border-rose-100"
                            title="Delete template config"
                            id={`delete_template_btn_${tmpl.id}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT: TEST BENCH SIMULATOR PANEL */}
              <div>
                <h3 className="font-bold text-indigo-950 text-xs uppercase tracking-wider border-b border-indigo-50 pb-2 mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-indigo-600 rounded"></span>
                  Dynamic Telegram Test Bench
                </h3>

                {testTemplate ? (
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4" id="telegram_test_bench_envelope">
                    {/* Simulator description card */}
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1">
                      <h4 className="text-xs font-black text-indigo-900 flex items-center gap-1 uppercase">
                        <Bot size={13} className="text-indigo-600" />
                        Interactive Template Testing
                      </h4>
                      <p className="text-[10px] text-slate-550 leading-relaxed font-semibold">
                        Preview template formatting and test live message dispatch across channels. Delivery status will be displayed below.
                      </p>
                    </div>

                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                        <span className="text-[11px] font-bold text-slate-600">Selected Template:</span>
                        <strong className="text-xs font-black text-indigo-950 truncate max-w-[170px]">{testTemplate.name}</strong>
                      </div>

                      {/* Language Select */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                          <Globe size={11} className="text-indigo-600" />
                          TEST LOCALIZED LANGUAGE
                        </label>
                        <div className="flex bg-slate-50/90 border border-slate-200 p-1 rounded-xl">
                          <button
                            onClick={() => { setTestLang('en'); setTestLogs(null); }}
                            className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                              testLang === 'en'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                            id="test_lang_en_toggle"
                          >
                            English Template 🇺🇸
                          </button>
                          <button
                            onClick={() => { setTestLang('kh'); setTestLogs(null); }}
                            className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                              testLang === 'kh'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                            id="test_lang_kh_toggle"
                          >
                            Khmer Template (ភាសាខ្មែរ) 🇰🇭
                          </button>
                        </div>
                      </div>

                      {/* Custom Chat ID override optional */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 flex justify-between items-center">
                          <span>OVERRIDE RECIPIENT CHAT ID (OPTIONAL)</span>
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-slate-100 rounded block">Telegram ID</span>
                        </label>
                        <input
                          type="text"
                          value={testCustomChatId}
                          onChange={e => { setTestCustomChatId(e.target.value); setTestLogs(null); }}
                          className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                          placeholder="e.g. -1001892102, or personal ID"
                        />
                        <span className="text-[9px] text-slate-400 block mt-1 leading-normal">
                          If omitted, the backend relays tests automatically to this template's configured Target Groups, or falls back to system administrators.
                        </span>
                      </div>

                      {/* Live Actions dispatch */}
                      <button
                        onClick={triggerTestSubmit}
                        disabled={isTesting}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:text-slate-400 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-100 hover:shadow-lg transition active:scale-[0.98]"
                        id="test_message_dispatch_btn"
                      >
                        {isTesting ? (
                          <RefreshCw className="animate-spin text-white" size={14} />
                        ) : (
                          <Send size={14} />
                        )}
                        <span>Test Send Message (Replace Variables)</span>
                      </button>
                    </div>

                    {/* Simulation Mock visual Device (Realistic rendering payload) */}
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Telegram Client Preview Frame</span>
                        <span className="text-[9px] font-mono lowercase bg-slate-100 px-1 rounded block">test runner</span>
                      </h4>
                      <div className="bg-slate-900 text-white rounded-xl p-4.5 font-sans relative overflow-hidden shadow-inner text-left max-h-[220px] overflow-y-auto">
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-ping"></span>
                          <span className="text-[7.5px] font-bold text-sky-400 tracking-wider">RECEIVED</span>
                        </div>
                        
                        <div className="flex gap-2.5 items-start">
                          <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center font-extrabold text-[10px] text-slate-900 shrink-0 select-none">
                            BOT
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-sky-400 block pb-1 border-b border-slate-800">Clean24 Alert Engine</span>
                            <div className="whitespace-pre-wrap text-[11px] font-normal leading-relaxed text-slate-205 mt-2 font-mono scrollbar-none" id="telegram_parsed_preview_block">
                              {testLogs?.text || (testLang === 'en' ? testTemplate.engTemplate : testTemplate.khmerTemplate)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Real time delivery receipt log warnings */}
                    {testLogs && (
                      <div className={`p-4 rounded-xl border text-xs text-left ${
                        testLogs.success 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                          : 'bg-rose-50 border-rose-100 text-rose-800'
                      }`} id="telegram_test_logs_panel">
                        {testLogs.success ? (
                          <div className="space-y-1.5">
                            <span className="font-extrabold uppercase text-[10px] text-emerald-700 block tracking-wider">✓ TRANSIT DESPATCHED SUCCESSFUL</span>
                            <p className="text-[11px] leading-relaxed font-semibold">{testLogs.message}</p>
                            {testLogs.simulated && (
                              <div className="mt-2 text-[10px] bg-emerald-100/50 p-2 rounded text-emerald-950 leading-relaxed font-bold">
                                ℹ️ Message preview generated successfully! Please configure the Telegram Bot Token in Settings to receive live messages.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="font-extrabold uppercase text-[10px] text-rose-700 block tracking-wider">❌ TRANSMISSION FAILED</span>
                            <p className="text-[11px] leading-relaxed font-semibold">{testLogs.error}</p>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8 text-center text-slate-400">
                    <Info size={20} className="mx-auto mb-2 text-indigo-200" />
                    <p className="text-xs">Click <b>"Run Tests"</b> on any template listed on the left to test live preview variables parsing and delivery formatting.</p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

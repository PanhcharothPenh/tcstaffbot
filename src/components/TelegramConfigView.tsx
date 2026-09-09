/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Bell, 
  ShieldAlert,
  Loader2,
  Package,
  Wrench,
  DollarSign,
  TrendingUp,
  Sliders,
  Users,
  Plus,
  Trash2,
  Edit2,
  Clock
} from 'lucide-react';
import { Role } from '../types';

interface FeatureConfig {
  chatId: string;
  isEnabled: boolean;
}

interface TelegramRecipient {
  id: string;
  recipient_name: string;
  name: string;
  chat_id: string;
  chatId: string;
  recipient_type: 'PRIVATE_CHAT' | 'GROUP_CHAT' | 'CHANNEL';
  recipientType: 'PRIVATE_CHAT' | 'GROUP_CHAT' | 'CHANNEL';
  alert_types: string[];
  alertTypes: string[];
  is_enabled: boolean;
  isEnabled: boolean;
}

interface TelegramConfig {
  botToken: string;
  enabledAlerts: string[];
  chatIds: {
    owner: string;
    admin: string;
    manager: Record<string, string>;
    staff: Record<string, string>;
    branches: Record<string, string>;
  };
  features?: {
    lowStock?: FeatureConfig;
    machineAlert?: FeatureConfig;
    payrollAlert?: FeatureConfig;
    dailySummary?: FeatureConfig;
  };
}

interface TelegramConfigViewProps {
  currentRole: Role;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function TelegramConfigView({
  currentRole,
  lang,
  onAddLog
}: TelegramConfigViewProps) {
  const isAuthorized = ['Owner', 'Admin', 'Manager'].includes(currentRole);
  
  // Tab control: 'features' (by operational function) vs 'users' (by recipient permissions)
  const [activeSubTab, setActiveSubTab] = useState<'features' | 'users' | 'guide'>('features');

  // Config State
  const [config, setConfig] = useState<TelegramConfig>({
    botToken: '',
    enabledAlerts: [],
    chatIds: { owner: '', admin: '', manager: {}, staff: {}, branches: {} },
    features: {
      lowStock: { chatId: '', isEnabled: true },
      machineAlert: { chatId: '', isEnabled: true },
      payrollAlert: { chatId: '', isEnabled: true },
      dailySummary: { chatId: '', isEnabled: true }
    }
  });

  // Recipients State
  const [recipients, setRecipients] = useState<TelegramRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  
  // Recipient form states
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientChatId, setRecipientChatId] = useState('');
  const [recipientType, setRecipientType] = useState<'PRIVATE_CHAT' | 'GROUP_CHAT' | 'CHANNEL'>('GROUP_CHAT');
  const [recipientAlerts, setRecipientAlerts] = useState<string[]>(['low_stock', 'machine']);
  const [recipientEnabled, setRecipientEnabled] = useState(true);
  const [showRecipientForm, setShowRecipientForm] = useState(false);

  const [testingFeature, setTestingFeature] = useState<string | null>(null);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  const fetchConfigAndRecipients = () => {
    setIsLoading(true);
    Promise.all([
      fetch('/api/telegram-config').then(res => res.json()),
      fetch('/api/telegram-recipients').then(res => res.json())
    ])
      .then(([configData, recipientsData]) => {
        // Parse config
        const mergedConfig: TelegramConfig = {
          botToken: configData.botToken || '',
          enabledAlerts: configData.enabledAlerts || [],
          chatIds: {
            owner: configData.chatIds?.owner || '',
            admin: configData.chatIds?.admin || '',
            manager: configData.chatIds?.manager || {},
            staff: configData.chatIds?.staff || {},
            branches: configData.chatIds?.branches || {}
          },
          features: {
            lowStock: {
              chatId: configData.features?.lowStock?.chatId || configData.chatIds?.owner || '',
              isEnabled: configData.features?.lowStock?.isEnabled !== false
            },
            machineAlert: {
              chatId: configData.features?.machineAlert?.chatId || configData.chatIds?.admin || '',
              isEnabled: configData.features?.machineAlert?.isEnabled !== false
            },
            payrollAlert: {
              chatId: configData.features?.payrollAlert?.chatId || configData.chatIds?.owner || '',
              isEnabled: configData.features?.payrollAlert?.isEnabled !== false
            },
            dailySummary: {
              chatId: configData.features?.dailySummary?.chatId || configData.chatIds?.admin || '',
              isEnabled: configData.features?.dailySummary?.isEnabled !== false
            }
          }
        };
        setConfig(mergedConfig);
        setRecipients(Array.isArray(recipientsData) ? recipientsData : []);
      })
      .catch(err => console.error('Failed loading Telegram data:', err))
      .finally(() => setIsLoading(false));
  };

  const handleTestBranch = async (branchId: 'b1' | 'b2', targetChatId: string) => {
    if (!targetChatId) {
      alert(lang === 'kh' ? 'សូមបញ្ចូល Chat ID សម្រាប់សាខានេះជាមុនសិន!' : 'Please enter a Chat ID for this branch first!');
      return;
    }
    const bName = branchId === 'b1' ? 'សាខា វេងស្រេង' : 'សាខា ចំការដូង';
    setTestingFeature(branchId);
    try {
      const res = await fetch('/api/telegram-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          chatId: targetChatId,
          message: `🔔 <b>[Clean24] សារសាកល្បងតេស្តប្រព័ន្ធ (Test Alert)</b>\n\n` +
            `🏢 <b>សាខា:</b> ${bName}\n` +
            `⏰ <b>ម៉ោង:</b> <code>${new Date().toLocaleTimeString()}</code>\n` +
            `✅ ការតភ្ជាប់រវាង Clean24 App និង Telegram Chat ដំណើរការយ៉ាងរលូន ១០០%!`
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(lang === 'kh' ? `✓ សារសាកល្បងត្រូវបានផ្ញើទៅ ${bName} ជោគជ័យ!` : `✓ Test message sent to ${bName} successfully!`);
      } else {
        alert(data.error || 'Failed to send test message');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setTestingFeature(null);
    }
  };

  const handleRegisterWebhook = async () => {
    setIsRegisteringWebhook(true);
    setWebhookStatus(null);
    try {
      const res = await fetch('/api/telegram-webhook?action=set');
      const data = await res.json();
      if (res.ok && data.success) {
        setWebhookStatus(lang === 'kh' ? '✓ បានចុះឈ្មោះ Bot Webhook & Menu គ្រប់សាខាដោយជោគជ័យ!' : '✓ Registered Bot Webhooks & Menus for all branches successfully!');
        alert(lang === 'kh' ? '✓ បានចុះឈ្មោះ Bot Webhook & Menu ដោយជោគជ័យ!' : '✓ Bot Webhooks & Menus registered successfully!');
      } else {
        alert(data.error || 'Failed to register webhook');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setIsRegisteringWebhook(false);
    }
  };

  useEffect(() => {
    fetchConfigAndRecipients();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) {
      alert(lang === 'kh' ? 'អ្នកមិនមានសិទ្ធិគ្រប់គ្រាន់ទេ!' : 'Unauthorized operation.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/telegram-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onAddLog('Updated Telegram configuration');
        alert(lang === 'kh' ? 'ការកំណត់ Telegram ត្រូវបានរក្សាទុកដោយជោគជ័យ!' : 'Telegram configurations saved successfully!');
      } else {
        alert(data.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) {
      alert(lang === 'kh' ? 'អ្នកមិនមានសិទ្ធិគ្រប់គ្រាន់ទេ!' : 'Unauthorized.');
      return;
    }

    if (!recipientName.trim() || !recipientChatId.trim()) {
      alert(lang === 'kh' ? 'សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់!' : 'Please fill all required fields.');
      return;
    }

    const payload = {
      recipient_name: recipientName,
      name: recipientName,
      chat_id: recipientChatId,
      chatId: recipientChatId,
      recipient_type: recipientType,
      recipientType: recipientType,
      alert_types: recipientAlerts,
      alertTypes: recipientAlerts,
      is_enabled: recipientEnabled,
      isEnabled: recipientEnabled,
      bot_token: config.botToken,
      botToken: config.botToken
    };

    setIsSaving(true);
    try {
      const url = editingRecipientId ? `/api/telegram-recipients/${editingRecipientId}` : '/api/telegram-recipients';
      const method = editingRecipientId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onAddLog(editingRecipientId ? `Edited Telegram recipient "${recipientName}"` : `Added Telegram recipient "${recipientName}"`);
        alert(lang === 'kh' ? 'រក្សាទុកជោគជ័យ!' : 'Saved recipient successfully!');
        resetRecipientForm();
        fetchConfigAndRecipients();
      } else {
        alert(data.error || 'Failed to save recipient');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving recipient');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecipient = async (id: string, name: string) => {
    if (!isAuthorized) return;
    if (!confirm(lang === 'kh' ? `តើអ្នកចង់លុប "${name}" មែនទេ?` : `Delete recipient "${name}"?`)) return;

    try {
      const res = await fetch(`/api/telegram-recipients/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onAddLog(`Deleted Telegram recipient "${name}"`);
        fetchConfigAndRecipients();
      } else {
        alert('Failed to delete');
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleEditRecipient = (rec: TelegramRecipient) => {
    setEditingRecipientId(rec.id);
    setRecipientName(rec.recipient_name || rec.name || '');
    setRecipientChatId(rec.chat_id || rec.chatId || '');
    setRecipientType(rec.recipient_type || rec.recipientType || 'GROUP_CHAT');
    setRecipientAlerts(rec.alert_types || rec.alertTypes || []);
    setRecipientEnabled(rec.is_enabled !== false);
    setShowRecipientForm(true);
  };

  const resetRecipientForm = () => {
    setEditingRecipientId(null);
    setRecipientName('');
    setRecipientChatId('');
    setRecipientType('GROUP_CHAT');
    setRecipientAlerts(['low_stock', 'machine']);
    setRecipientEnabled(true);
    setShowRecipientForm(false);
  };

  const handleTestFeature = async (featureKey: string, targetChatId: string) => {
    if (!config.botToken) {
      alert(lang === 'kh' ? 'សូមកំណត់ Bot Token ជាមុនសិន!' : 'Please set the Bot Token first!');
      return;
    }
    if (!targetChatId) {
      alert(lang === 'kh' ? 'សូមបញ្ចូល Chat ID សម្រាប់សាកល្បង!' : 'Please enter a Chat ID to test!');
      return;
    }

    setTestingFeature(featureKey);
    try {
      const res = await fetch('/api/telegram-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: targetChatId,
          username: `Test ${featureKey}`
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(lang === 'kh' ? 'សារសាកល្បងត្រូវបានផ្ញើជោគជ័យ!' : 'Test message sent successfully!');
      } else {
        alert(data.error || 'Failed to send test message');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setTestingFeature(null);
    }
  };

  const toggleAlertCheckbox = (id: string) => {
    setRecipientAlerts(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const updateFeature = (key: 'lowStock' | 'machineAlert' | 'payrollAlert' | 'dailySummary', updates: Partial<FeatureConfig>) => {
    setConfig(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: {
          ...prev.features?.[key],
          ...updates
        }
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl" id="telegram_features_config_panel">

      {/* Global Bot Token Credentials */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
          <Sliders size={15} className="text-indigo-600" />
          <span>{lang === 'kh' ? 'គណនី Bot របស់តេឡេក្រាម' : 'Telegram Bot API Credentials'}</span>
        </h3>

        <div>
          <label className="text-[10.5px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
            {lang === 'kh' ? 'កូដសម្ងាត់ Bot (TELEGRAM BOT TOKEN) *' : 'TELEGRAM BOT TOKEN KEY *'}
          </label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={config.botToken}
              onChange={e => setConfig(prev => ({ ...prev, botToken: e.target.value }))}
              disabled={!isAuthorized}
              className="w-full bg-slate-55 border border-slate-200/60 text-xs text-slate-800 font-mono rounded-xl p-3 focus:outline-none focus:border-slate-400 focus:bg-white pr-10 disabled:opacity-70 font-semibold"
              placeholder="e.g. 6109923812:AAF_zYTr79M9XvJ..."
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Inner Sub-tab navigation */}
      <div className="flex gap-2 border-b border-slate-150 pb-2">
        <button
          onClick={() => setActiveSubTab('features')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5 ${
            activeSubTab === 'features' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/40'
          }`}
        >
          <Sliders size={13} />
          <span>{lang === 'kh' ? 'បែងចែកតាមមុខងារ' : 'Global Alert Targets'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5 ${
            activeSubTab === 'users' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/40'
          }`}
        >
          <Users size={13} />
          <span>{lang === 'kh' ? 'កំណត់សិទ្ធិអ្នកប្រើប្រាស់' : 'Recipient Alert Subscriptions'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('guide')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5 ${
            activeSubTab === 'guide' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/40'
          }`}
        >
          <Bot size={13} />
          <span>{lang === 'kh' ? 'របៀបបញ្ចូលទិន្នន័យតាម Telegram' : 'Telegram Data Entry Guide'}</span>
        </button>
      </div>

      {/* TAB A: Operational alert targets */}
      {activeSubTab === 'features' && (
        <form onSubmit={handleSaveConfig} className="space-y-6">

          {/* Webhook & Branch Status Control Bar */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black flex items-center gap-2">
                  <Bot size={18} className="text-sky-400" />
                  <span>{lang === 'kh' ? 'ការតភ្ជាប់ Bot Telegram តាមសាខា (Branch Webhook & Menus)' : 'Branch Telegram Bot Connection'}</span>
                </h4>
                <p className="text-[11px] text-slate-300 mt-1">
                  {lang === 'kh' 
                    ? 'ចុចប៊ូតុងខាងក្រោមដើម្បីឱ្យ Telegram ចុះឈ្មោះ Webhook និង Menu បញ្ជាលើទូរស័ព្ទដៃដោយស្វ័យប្រវត្ត' 
                    : 'Click below to automatically register webhook endpoints and phone command menus for branch bots.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleRegisterWebhook}
                disabled={isRegisteringWebhook}
                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isRegisteringWebhook ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                <span>{isRegisteringWebhook ? 'កំពុងចុះឈ្មោះ...' : (lang === 'kh' ? '⚡ ចុះឈ្មោះ Webhook ស្វ័យប្រវត្ត' : '⚡ Auto-Register Webhooks')}</span>
              </button>
            </div>

            {webhookStatus && (
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-xs text-emerald-200 font-medium">
                {webhookStatus}
              </div>
            )}
          </div>

          {/* Branch Target Channels Setup */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Sliders size={15} className="text-emerald-600" />
                <span>{lang === 'kh' ? 'គោលដៅទទួលដំណឹងតាមសាខា (Branch Telegram Destination Chats)' : 'Branch Telegram Destination Chats'}</span>
              </h4>
              <span className="text-[10.5px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/50">
                {lang === 'kh' ? 'ដាច់ដោយឡែកពីគ្នា ១០០%' : 'Strictly Isolated'}
              </span>
            </div>

            <div className="p-3 bg-amber-50/80 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 leading-relaxed">
              💡 <b>{lang === 'kh' ? 'របៀបភ្ជាប់ Chat ID ងាយស្រួលបំផុត៖' : 'Easiest way to connect:'}</b>{' '}
              {lang === 'kh' 
                ? 'គ្រាន់តែ Add Bot សាខាចូលក្នុង Telegram Group របស់អ្នក ឬបើក Chat ជាមួយ Bot រួចវាយពាក្យ /id ឬ /start នោះប្រព័ន្ធនឹងរកឃើញ និងភ្ជាប់ Chat ID នេះដោយស្វ័យប្រវត្តិ! ឬអ្នកក៏អាច copy លេខ Chat ID មកដាក់ក្នុងប្រអប់ខាងក្រោមបានផងដែរ។'
                : 'Simply add the branch bot to your Telegram group or send /id or /start directly to the bot. It will auto-bind the chat ID automatically! You can also paste the Chat ID directly below.'}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Branch 1: Veng Sreng */}
              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <strong className="text-xs font-bold text-slate-800">
                      {lang === 'kh' ? 'សាខា វេងស្រេង (b1)' : 'Veng Sreng Branch (b1)'}
                    </strong>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                    ID: b1
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">
                    {lang === 'kh' ? 'Telegram Chat ID / Group ID វេងស្រេង' : 'Veng Sreng Chat / Group ID'}
                  </label>
                  <input
                    type="text"
                    value={config.chatIds?.branches?.b1 || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        chatIds: {
                          ...prev.chatIds,
                          branches: {
                            ...prev.chatIds?.branches,
                            b1: val,
                            veng_sreng: val
                          }
                        }
                      }));
                    }}
                    disabled={!isAuthorized}
                    placeholder="e.g. -100xxxxxxxx ឬ Chat ID"
                    className="w-full bg-white border border-slate-200 text-xs font-mono rounded-xl p-2.5 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestBranch('b1', config.chatIds?.branches?.b1 || '')}
                    disabled={testingFeature !== null || !config.chatIds?.branches?.b1}
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Send size={11} />
                    <span>{testingFeature === 'b1' ? 'Testing...' : (lang === 'kh' ? '🚀 តេស្តផ្ញើទៅ វេងស្រេង' : 'Test Veng Sreng')}</span>
                  </button>
                </div>
              </div>

              {/* Branch 2: Chomka Doung */}
              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <strong className="text-xs font-bold text-slate-800">
                      {lang === 'kh' ? 'សាខា ចំការដូង (b2)' : 'Chomka Doung Branch (b2)'}
                    </strong>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                    ID: b2
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">
                    {lang === 'kh' ? 'Telegram Chat ID / Group ID ចំការដូង' : 'Chomka Doung Chat / Group ID'}
                  </label>
                  <input
                    type="text"
                    value={config.chatIds?.branches?.b2 || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        chatIds: {
                          ...prev.chatIds,
                          branches: {
                            ...prev.chatIds?.branches,
                            b2: val,
                            chomka_doung: val
                          }
                        }
                      }));
                    }}
                    disabled={!isAuthorized}
                    placeholder="e.g. -100xxxxxxxx ឬ Chat ID"
                    className="w-full bg-white border border-slate-200 text-xs font-mono rounded-xl p-2.5 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestBranch('b2', config.chatIds?.branches?.b2 || '')}
                    disabled={testingFeature !== null || !config.chatIds?.branches?.b2}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Send size={11} />
                    <span>{testingFeature === 'b2' ? 'Testing...' : (lang === 'kh' ? '🚀 តេស្តផ្ញើទៅ ចំការដូង' : 'Test Chomka Doung')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1: Low Stock */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                      <Package size={16} />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-slate-800 block">
                        {lang === 'kh' ? 'ដំណឹងពីទំនិញក្នុងស្តុក' : 'Low Stock Alerts'}
                      </strong>
                      <span className="text-[10px] text-slate-400 block font-medium mt-0.5">Detergent, softener, gas shortages</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateFeature('lowStock', { isEnabled: !config.features?.lowStock?.isEnabled })}
                    disabled={!isAuthorized}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      config.features?.lowStock?.isEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${config.features?.lowStock?.isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <input
                  type="text"
                  value={config.features?.lowStock?.chatId}
                  onChange={e => updateFeature('lowStock', { chatId: e.target.value })}
                  disabled={!isAuthorized || !config.features?.lowStock?.isEnabled}
                  placeholder="Chat ID e.g., -1001928812"
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl p-2.5 outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => handleTestFeature('lowStock', config.features?.lowStock?.chatId || '')}
                disabled={testingFeature !== null || !config.features?.lowStock?.isEnabled}
                className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10.5px] font-bold rounded-lg border border-slate-200/60 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send size={11} />
                <span>{testingFeature === 'lowStock' ? 'Sending...' : (lang === 'kh' ? 'សាកល្បងផ្ញើសារ' : 'Send Test Alert')}</span>
              </button>
            </div>

            {/* Card 2: Machine alerts */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-rose-50 text-rose-700 rounded-xl">
                      <Wrench size={16} />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-slate-800 block">
                        {lang === 'kh' ? 'ដំណឹងពីបញ្ហាម៉ាស៊ីន' : 'Machine Issue Alerts'}
                      </strong>
                      <span className="text-[10px] text-slate-400 block font-medium mt-0.5">Machine failures and breakdowns</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateFeature('machineAlert', { isEnabled: !config.features?.machineAlert?.isEnabled })}
                    disabled={!isAuthorized}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      config.features?.machineAlert?.isEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${config.features?.machineAlert?.isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <input
                  type="text"
                  value={config.features?.machineAlert?.chatId}
                  onChange={e => updateFeature('machineAlert', { chatId: e.target.value })}
                  disabled={!isAuthorized || !config.features?.machineAlert?.isEnabled}
                  placeholder="Chat ID e.g., -1001928812"
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl p-2.5 outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => handleTestFeature('machineAlert', config.features?.machineAlert?.chatId || '')}
                disabled={testingFeature !== null || !config.features?.machineAlert?.isEnabled}
                className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10.5px] font-bold rounded-lg border border-slate-200/60 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send size={11} />
                <span>{testingFeature === 'machineAlert' ? 'Sending...' : (lang === 'kh' ? 'សាកល្បងផ្ញើសារ' : 'Send Test Alert')}</span>
              </button>
            </div>

            {/* Card 3: Payroll */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                      <DollarSign size={16} />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-slate-800 block">
                        {lang === 'kh' ? 'ដំណឹងពីប្រាក់បៀវត្សរ៍បុគ្គលិក' : 'Payroll Due Reminders'}
                      </strong>
                      <span className="text-[10px] text-slate-400 block font-medium mt-0.5">Paydays scheduling reminders</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateFeature('payrollAlert', { isEnabled: !config.features?.payrollAlert?.isEnabled })}
                    disabled={!isAuthorized}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      config.features?.payrollAlert?.isEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${config.features?.payrollAlert?.isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <input
                  type="text"
                  value={config.features?.payrollAlert?.chatId}
                  onChange={e => updateFeature('payrollAlert', { chatId: e.target.value })}
                  disabled={!isAuthorized || !config.features?.payrollAlert?.isEnabled}
                  placeholder="Chat ID e.g., -1001928812"
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl p-2.5 outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => handleTestFeature('payrollAlert', config.features?.payrollAlert?.chatId || '')}
                disabled={testingFeature !== null || !config.features?.payrollAlert?.isEnabled}
                className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10.5px] font-bold rounded-lg border border-slate-200/60 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send size={11} />
                <span>{testingFeature === 'payrollAlert' ? 'Sending...' : (lang === 'kh' ? 'សាកល្បងផ្ញើសារ' : 'Send Test Alert')}</span>
              </button>
            </div>

            {/* Card 4: Daily summary */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <strong className="text-xs font-bold text-slate-800 block">
                        {lang === 'kh' ? 'របាយការណ៍សង្ខេបអាជីវកម្ម' : 'Daily Business Summary'}
                      </strong>
                      <span className="text-[10px] text-slate-400 block font-medium mt-0.5">End of day revenue reports</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateFeature('dailySummary', { isEnabled: !config.features?.dailySummary?.isEnabled })}
                    disabled={!isAuthorized}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      config.features?.dailySummary?.isEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${config.features?.dailySummary?.isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <input
                  type="text"
                  value={config.features?.dailySummary?.chatId}
                  onChange={e => updateFeature('dailySummary', { chatId: e.target.value })}
                  disabled={!isAuthorized || !config.features?.dailySummary?.isEnabled}
                  placeholder="Chat ID e.g., -1001928812"
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl p-2.5 outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => handleTestFeature('dailySummary', config.features?.dailySummary?.chatId || '')}
                disabled={testingFeature !== null || !config.features?.dailySummary?.isEnabled}
                className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10.5px] font-bold rounded-lg border border-slate-200/60 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send size={11} />
                <span>{testingFeature === 'dailySummary' ? 'Sending...' : (lang === 'kh' ? 'សាកល្បងផ្ញើសារ' : 'Send Test Alert')}</span>
              </button>
            </div>
          </div>

          {/* Action button */}
          {isAuthorized && (
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              <span>{lang === 'kh' ? 'រក្សាទុកការកំណត់ទូទៅ' : 'Save Operational Configurations'}</span>
            </button>
          )}
        </form>
      )}

      {/* TAB B: Recipient Alert Permissions / Subscriptions */}
      {activeSubTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200/40">
            <div>
              <h4 className="text-xs font-bold text-slate-800">
                {lang === 'kh' ? 'គ្រប់គ្រងអ្នកទទួលដំណឹង (Recipients)' : 'Manage Recipient Subscriptions'}
              </h4>
              <span className="text-[10px] text-slate-450 font-medium">Add individual Telegram chat IDs and select exactly which alerts they are authorized to receive.</span>
            </div>
            {!showRecipientForm && isAuthorized && (
              <button
                onClick={() => setShowRecipientForm(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition shadow-xs"
              >
                <Plus size={13} />
                <span>{lang === 'kh' ? 'បន្ថែមអ្នកទទួល' : 'Add Recipient'}</span>
              </button>
            )}
          </div>

          {/* New / Edit Recipient Form */}
          {showRecipientForm && (
            <form onSubmit={handleSaveRecipient} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-800">
                  {editingRecipientId ? (lang === 'kh' ? 'កែប្រែគណនីអ្នកទទួល' : 'Edit Recipient Settings') : (lang === 'kh' ? 'បន្ថែមគណនីអ្នកទទួលថ្មី' : 'Create New Recipient Registration')}
                </h4>
                <button type="button" onClick={resetRecipientForm} className="text-slate-400 hover:text-slate-600 text-sm font-bold">&times;</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Recipient Name / Label *</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    placeholder="e.g., John (Stock Manager)"
                    className="w-full bg-slate-50 border border-slate-200 text-xs p-2.5 rounded-xl outline-none focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Telegram Chat ID / Group Chat ID *</label>
                  <input
                    type="text"
                    value={recipientChatId}
                    onChange={e => setRecipientChatId(e.target.value)}
                    placeholder="e.g., 98122341 or -1001928812"
                    className="w-full bg-slate-50 border border-slate-200 text-xs font-mono p-2.5 rounded-xl outline-none focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Recipient Channel Type</label>
                  <select
                    value={recipientType}
                    onChange={e => setRecipientType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs p-2.5 rounded-xl outline-none"
                  >
                    <option value="PRIVATE_CHAT">{lang === 'kh' ? 'ឆាតផ្ទាល់ខ្លួន (Private Chat)' : 'Private Chat'}</option>
                    <option value="GROUP_CHAT">{lang === 'kh' ? 'ក្រុមតេឡេក្រាម (Group Chat)' : 'Group Chat'}</option>
                    <option value="CHANNEL">{lang === 'kh' ? 'ឆានែលផ្សព្វផ្សាយ (Channel)' : 'Public Channel'}</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recipientEnabled}
                      onChange={e => setRecipientEnabled(e.target.checked)}
                      className="rounded accent-indigo-600"
                    />
                    <span className="text-xs font-semibold text-slate-700">{lang === 'kh' ? 'បើកដំណើរការបញ្ជូន (Enabled)' : 'Enable Active Dispatch'}</span>
                  </label>
                </div>
              </div>

              {/* Checkboxes alert subscriptions */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Select Authorized Alert Types (កំណត់សិទ្ធិទទួលបានសារ)</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2 cursor-pointer hover:bg-slate-100/50">
                    <input
                      type="checkbox"
                      checked={recipientAlerts.includes('low_stock')}
                      onChange={() => toggleAlertCheckbox('low_stock')}
                      className="mt-0.5 rounded accent-indigo-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Low Stock Warnings</span>
                      <span className="text-[9px] text-slate-400 block font-medium">Soap/Softener/Gas levels</span>
                    </div>
                  </label>

                  <label className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2 cursor-pointer hover:bg-slate-100/50">
                    <input
                      type="checkbox"
                      checked={recipientAlerts.includes('machine')}
                      onChange={() => toggleAlertCheckbox('machine')}
                      className="mt-0.5 rounded accent-indigo-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Machine Maintenance Warnings</span>
                      <span className="text-[9px] text-slate-400 block font-medium">Broken statuses</span>
                    </div>
                  </label>

                  <label className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2 cursor-pointer hover:bg-slate-100/50">
                    <input
                      type="checkbox"
                      checked={recipientAlerts.includes('salary')}
                      onChange={() => toggleAlertCheckbox('salary')}
                      className="mt-0.5 rounded accent-indigo-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Salary / Payroll Notices</span>
                      <span className="text-[9px] text-slate-400 block font-medium">Mid/End cycle payday details</span>
                    </div>
                  </label>

                  <label className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2 cursor-pointer hover:bg-slate-100/50">
                    <input
                      type="checkbox"
                      checked={recipientAlerts.includes('daily_business')}
                      onChange={() => toggleAlertCheckbox('daily_business')}
                      className="mt-0.5 rounded accent-indigo-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Daily Business Summaries</span>
                      <span className="text-[9px] text-slate-400 block font-medium">Daily income/expense closing</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={resetRecipientForm}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {lang === 'kh' ? 'បោះបង់' : 'Cancel'}
                </button>
                
                <button
                  type="button"
                  onClick={() => handleTestFeature('recipient_validation', recipientChatId)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Send size={12} />
                  <span>{lang === 'kh' ? 'សាកល្បងផ្ញើសារ' : 'Test Handshake'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                  <span>{editingRecipientId ? (lang === 'kh' ? 'កែសម្រួល' : 'Update') : (lang === 'kh' ? 'រក្សាទុក' : 'Save')}</span>
                </button>
              </div>
            </form>
          )}

          {/* Registered Recipients List Table */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              {lang === 'kh' ? 'បញ្ជីឈ្មោះអ្នកទទួលដំណឹងដែលបានកំណត់សិទ្ធិរួច' : 'Authorized Recipient Directory'}
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 text-[10.5px] uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-3">{lang === 'kh' ? 'ឈ្មោះអ្នកទទួល' : 'Name / Channel'}</th>
                    <th className="py-2.5 px-3">{lang === 'kh' ? 'លេខសម្គាល់ឆាត' : 'Chat ID'}</th>
                    <th className="py-2.5 px-3">{lang === 'kh' ? 'សិទ្ធិទទួលបានសារ (Subscriptions)' : 'Authorized Alerts'}</th>
                    <th className="py-2.5 px-3">{lang === 'kh' ? 'ស្ថានភាព' : 'Status'}</th>
                    <th className="py-2.5 px-3 text-center">{lang === 'kh' ? 'សកម្មភាព' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
                  {recipients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        {lang === 'kh' ? 'គ្មានគណនីអ្នកទទួលដែលបានចុះឈ្មោះទេ' : 'No recipient rules configured yet.'}
                      </td>
                    </tr>
                  ) : (
                    recipients.map(rec => {
                      const nameStr = rec.recipient_name || rec.name || 'Unnamed Recipient';
                      const cid = rec.chat_id || rec.chatId;
                      const activeAlerts = rec.alert_types || rec.alertTypes || [];
                      const isRecEnabled = rec.is_enabled !== false && (rec as any).isEnabled !== false;

                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-3">
                            <strong className="text-slate-850 block">{nameStr}</strong>
                            <span className="text-[9.5px] text-slate-400 font-semibold block uppercase mt-0.5">
                              {rec.recipient_type || rec.recipientType || 'GROUP_CHAT'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">{cid}</td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {activeAlerts.length === 0 ? (
                                <span className="text-[9.5px] text-slate-400 italic">None</span>
                              ) : (
                                activeAlerts.map((a: string) => {
                                  let label = a;
                                  let color = 'bg-slate-50 text-slate-650';
                                  if (a === 'low_stock') {
                                    label = lang === 'kh' ? 'ស្តុកទំនិញ' : 'Stock';
                                    color = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                                  } else if (a === 'machine') {
                                    label = lang === 'kh' ? 'បញ្ហាម៉ាស៊ីន' : 'Machine';
                                    color = 'bg-rose-50 text-rose-700 border-rose-100';
                                  } else if (a === 'salary') {
                                    label = lang === 'kh' ? 'ប្រាក់ខែ' : 'Payroll';
                                    color = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                                  } else if (a === 'daily_business') {
                                    label = lang === 'kh' ? 'បិទបញ្ជី' : 'EOD Summary';
                                    color = 'bg-amber-50 text-amber-700 border-amber-100';
                                  }

                                  return (
                                    <span key={a} className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${color}`}>
                                      {label}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-lg text-[9.5px] font-bold border ${
                              isRecEnabled 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                              {isRecEnabled ? (lang === 'kh' ? 'បើកដំណើរការ' : 'Active') : (lang === 'kh' ? 'បិទ' : 'Disabled')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleEditRecipient(rec)}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition inline-flex cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteRecipient(rec.id, nameStr)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition inline-flex cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'guide' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-lg border border-emerald-500/20 inline-block">
                {lang === 'kh' ? 'សៀវភៅណែនាំផ្លូវការ' : 'Official Guide'}
              </span>
              <h3 className="text-lg font-bold">
                {lang === 'kh' ? 'របៀបចុះបញ្ជីទិន្នន័យតាម Telegram' : 'How to Input Data via Telegram'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {lang === 'kh' 
                  ? 'អ្នកគ្រប់គ្រង និងបុគ្គលិកអាចប្រើប្រាស់គណនី Telegram ដែលមានការអនុញ្ញាតដើម្បីផ្ញើសារកត់ត្រា សាប៊ូ ទឹកក្រអូប និងចំណូលប្រចាំថ្ងៃដោយផ្ទាល់។ ប្រព័ន្ធនឹងរក្សាទុកទិន្នន័យដោយស្វ័យប្រវត្តិតាមរយៈ Telegram Bot Webhook។'
                  : 'Authorized managers and staff can enter Soap, Softener, and Daily Revenues by texting commands directly in the Telegram Bot. The web portal automatically imports new entries.'}
              </p>
            </div>
            <div className="flex items-center justify-center p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 shrink-0">
              <Bot size={40} className="animate-pulse" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Soap Entry */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🧼</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {lang === 'kh' ? '១. ចុះបញ្ជីសាប៊ូ' : '1. Soap Logs'}
                  </h4>
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-bold uppercase tracking-wider">Detergent Records</span>
                </div>
              </div>
              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/50 space-y-1.5 font-mono text-[11px] text-slate-700">
                  <div className="text-[10px] text-slate-450 font-sans font-bold uppercase tracking-wide mb-1 block">Usage (ប្រើប្រាស់):</div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>សាប៊ូ ប្រើ 10</span>
                    <span className="text-[10px] text-slate-400">10 កញ្ចប់ (Packs)</span>
                  </div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>Soap use 10</span>
                    <span className="text-[10px] text-slate-400">10 Packets</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/50 space-y-1.5 font-mono text-[11px] text-slate-700">
                  <div className="text-[10px] text-slate-450 font-sans font-bold uppercase tracking-wide mb-1 block">Refill (ថែមសាប៊ូ):</div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>សាប៊ូ ថែម 20</span>
                    <span className="text-[10px] text-slate-400">20 កញ្ចប់ (Packs)</span>
                  </div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>Soap refill 20</span>
                    <span className="text-[10px] text-slate-400">20 Packets</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Softener Entry */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🌸</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {lang === 'kh' ? '២. ចុះបញ្ជីទឹកក្រអូប' : '2. Softener Logs'}
                  </h4>
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-bold uppercase tracking-wider">Softener Records</span>
                </div>
              </div>
              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/50 space-y-1.5 font-mono text-[11px] text-slate-700">
                  <div className="text-[10px] text-slate-455 font-sans font-bold uppercase tracking-wide mb-1 block">Usage (ប្រើប្រាស់):</div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>ទឹកក្រអូប ប្រើ 15</span>
                    <span className="text-[10px] text-slate-400">15 កញ្ចប់ (Packs)</span>
                  </div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>Softener use 15</span>
                    <span className="text-[10px] text-slate-400">15 Packets</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/50 space-y-1.5 font-mono text-[11px] text-slate-700">
                  <div className="text-[10px] text-slate-455 font-sans font-bold uppercase tracking-wide mb-1 block">Refill (ថែមទឹកក្រអូប):</div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>ទឹកក្រអូប ថែម 25</span>
                    <span className="text-[10px] text-slate-400">25 កញ្ចប់ (Packs)</span>
                  </div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>Softener refill 25</span>
                    <span className="text-[10px] text-slate-400">25 Packets</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Revenue Entry */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">💵</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {lang === 'kh' ? '៣. កត់ត្រាចំណូល' : '3. Revenues Entry'}
                  </h4>
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-bold uppercase tracking-wider">Revenue Records</span>
                </div>
              </div>
              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/50 space-y-1.5 font-mono text-[11px] text-slate-700">
                  <div className="text-[10px] text-slate-455 font-sans font-bold uppercase tracking-wide mb-1 block">Cash (ចំណូលសាច់ប្រាក់):</div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>ចំណូល 1000000</span>
                    <span className="text-[10px] text-slate-400">Cash 1,000,000 ៛ ($250)</span>
                  </div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>Revenue 1000000</span>
                    <span className="text-[10px] text-slate-400">Cash 1,000,000 ៛ ($250)</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/50 space-y-1.5 font-mono text-[11px] text-slate-700">
                  <div className="text-[10px] text-slate-455 font-sans font-bold uppercase tracking-wide mb-1 block">ABA / QR (ចំណូល ABA):</div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>ចំណូល ABA 1200000</span>
                    <span className="text-[10px] text-slate-400">ABA 1,200,000 ៛ ($300)</span>
                  </div>
                  <div className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span>Revenue ABA 1200000</span>
                    <span className="text-[10px] text-slate-400">ABA 1,200,000 ៛ ($300)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Guidelines Tips Section */}
          <div className="bg-amber-50 border border-amber-100 text-slate-700 rounded-3xl p-5 text-xs space-y-2">
            <h5 className="font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
              ⚠️ {lang === 'kh' ? 'ចំណុចសំខាន់ៗដែលត្រូវដឹង' : 'Important Guidelines'}
            </h5>
            <ul className="list-disc pl-4 space-y-1.5 leading-relaxed font-sans">
              <li>
                {lang === 'kh' 
                  ? 'សាខាត្រូវបានកំណត់ដោយស្វ័យប្រវត្តិតាមរយៈលេខ Chat ID របស់គណនី Telegram ដែលផ្ញើសារ។'
                  : 'The system automatically detects your branch based on the Telegram account\'s Chat ID.'}
              </li>
              <li>
                {lang === 'kh' 
                  ? 'សាប៊ូ និងទឹកក្រអូប នឹងគណនាស្តុកដែលនៅសល់ក្នុងធុងដោយស្វ័យប្រវត្តិចុងក្រោយបំផុត។'
                  : 'Detergent and Softener commands automatically compute and update the remaining reservoir capacity based on the latest EOD stock.'}
              </li>
              <li>
                {lang === 'kh' 
                  ? 'រាល់ការបញ្ចូលដែលជោគជ័យ នឹងទទួលបានសារបញ្ជាក់ពីប្រព័ន្ធ Telegram Bot ត្រឡប់មកវិញភ្លាមៗ។'
                  : 'A formatted HTML confirmation receipt will be instantly texted back to your chat window upon a successful entry.'}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

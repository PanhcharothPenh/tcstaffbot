/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  MapPin, 
  Clock, 
  Languages, 
  HelpCircle, 
  Save, 
  Database, 
  Info,
  ShieldCheck,
  Bot,
  Send,
  Bell,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle as TooltipIcon,
  Calendar,
  History,
  Download
} from 'lucide-react';
import { Role, Branch } from '../types';
import { translations } from '../mockData';
import TelegramTemplatesView from './TelegramTemplatesView';
import TelegramSchedulesView from './TelegramSchedulesView';
import TelegramLogsView from './TelegramLogsView';
import TelegramSettingsView from './TelegramSettingsView';

interface SettingsViewProps {
  currentRole: Role;
  branches: Branch[];
  lang: 'en' | 'kh';
  setLang: (l: 'en' | 'kh') => void;
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
  onAddLog: (msg: string) => void;
}

export interface TelegramConfig {
  botToken: string;
  enabledAlerts: string[];
  chatIds: {
    owner: string;
    admin: string;
    manager: Record<string, string>;
    staff: Record<string, string>;
    branches: Record<string, string>;
  };
}

export default function SettingsView({
  currentRole,
  branches,
  lang,
  setLang,
  exchangeRate,
  setExchangeRate,
  onAddLog
}: SettingsViewProps) {
  const t = translations[lang];

  const [address, setAddress] = useState('Phnom Penh, Cambodia');
  const [shopPhone, setShopPhone] = useState('');
  const [opening, setOpening] = useState('6:00 AM');
  const [closing, setClosing] = useState('10:00 PM');
  const [rateInput, setRateInput] = useState(exchangeRate);

  // Telegram Config States
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    botToken: '',
    enabledAlerts: ['low_stock', 'salary', 'daily_business', 'branch', 'machine'],
    chatIds: {
      owner: '',
      admin: '',
      manager: {},
      staff: {},
      branches: {}
    }
  });

  const [showToken, setShowToken] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState<Record<string, boolean>>({});
  const [activeTabSub, setActiveTabSub] = useState<'general' | 'telegram' | 'telegram_templates' | 'telegram_schedules' | 'telegram_logs'>('general');

  // Verify Admin Permissions
  const isOwnerOrAdmin = currentRole === 'Owner' || currentRole === 'Admin';

  // 1. Fetch live config stored on server on component mount
  useEffect(() => {
    fetch('/api/telegram-config')
      .then(res => res.json())
      .then((data: TelegramConfig) => {
        if (data && data.botToken !== undefined) {
          // Fill default branch IDs if undefined
          const nextChatIds = { ...data.chatIds };
          nextChatIds.manager = nextChatIds.manager || {};
          nextChatIds.staff = nextChatIds.staff || {};
          nextChatIds.branches = nextChatIds.branches || {};
          
          branches.forEach(b => {
            if (!nextChatIds.manager[b.id]) nextChatIds.manager[b.id] = '';
            if (!nextChatIds.staff[b.id]) nextChatIds.staff[b.id] = '';
            if (!nextChatIds.branches[b.id]) nextChatIds.branches[b.id] = '';
          });

          setTelegramConfig({
            botToken: data.botToken || '',
            enabledAlerts: data.enabledAlerts || ['low_stock', 'salary', 'daily_business', 'branch', 'machine'],
            chatIds: nextChatIds
          });
        }
      })
      .catch(err => console.error('Error fetching telegram configurations:', err));
  }, [branches]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setExchangeRate(rateInput);
    onAddLog(`System settings rewritten: Conversion Rate updated to ${rateInput} KHR.`);
    alert(lang === 'en' ? "General configuration parameters updated successfully." : "បានធ្វើបច្ចុប្បន្នភាពការកំណត់ប្រសិទ្ធិដោយជោគជ័យ។");
  };

  // Handles updating specified nested fields inside config
  const handleUpdateConfig = (updater: (prev: TelegramConfig) => TelegramConfig) => {
    setTelegramConfig(prev => updater(prev));
  };

  // Saves entire config on server filesystem
  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/telegram-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramConfig)
      });
      const data = await response.json() as any;
      if (data.success) {
        onAddLog(`Updated secure Telegram Bot credentials and Thread ID associations.`);
        alert(lang === 'en' ? "Telegram notifications configuration saved securely to backend!" : "ការកំណត់ទូរលេខទូរគមនាគមន៍ត្រូវបានរក្សាទុកដោយជោគជ័យ!");
      } else {
        alert("Error saving telegram settings: " + data.error);
      }
    } catch (err: any) {
      alert("Network failure saving configurations: " + err.message);
    }
  };

  // Triggers instant test message to verified thread
  const handleTestChatId = async (chatId: string, roleName: string, identifierKey: string) => {
    if (!telegramConfig.botToken) {
      alert(lang === 'en' ? "Please set a valid Telegram Bot Token first!" : "សូមបញ្ចូល Telegram Bot Token ជាមុនសិន!");
      return;
    }
    if (!chatId) {
      alert(lang === 'en' ? "Please input a Destination Chat ID to test!" : "សូមបញ្ចូល Chat ID សម្រាប់សាកល្បង!");
      return;
    }

    setIsTestLoading(prev => ({ ...prev, [identifierKey]: true }));
    try {
      const response = await fetch('/api/telegram-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, username: `${roleName} Notification Thread` })
      });
      const data = await response.json() as any;
      if (data.success) {
        alert(lang === 'en' ? `🎉 Perfect test connection! Message dispatched cleanly to ${roleName}.` : `🎉 បញ្ជូនសារសាកល្បងដោយជោគជ័យទៅ ${roleName}!`);
      } else {
        alert(`Failed to send test message: ${data.error}\n\nPlease check if your Bot is started (send /start to telegram bot user) and Chat ID is valid.`);
      }
    } catch (err: any) {
      alert("Test connection failed: " + err.message);
    } finally {
      setIsTestLoading(prev => ({ ...prev, [identifierKey]: false }));
    }
  };

  // Dispatch live operational alerts immediately to Telegram
  const handleDispatchLiveAlert = async (category: string, bId: string) => {
    try {
      const response = await fetch('/api/telegram-trigger-mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertCategory: category, branchId: bId })
      });
      const data = await response.json() as any;
      if (data.success) {
        alert(lang === 'en' ? `Success! Operational alert for "${category}" dispatched to [${data.targetsStr}].` : `ជោគជ័យ! សារជូនដំណឹងប្រតិបត្តិការ "${category}" បានផ្ញើទៅ Telegram រួចរាល់។`);
        onAddLog(`Dispatched Telegram Operational Alert "${category}".`);
      } else {
        alert(data.errors || (lang === 'en' ? 'No recipient Chat IDs available to dispatch.' : 'មិនទាន់មាន Chat ID សម្រាប់ផ្ញើសារឡើយ។'));
      }
    } catch (err: any) {
      alert("Telegram alert dispatch failed: " + err.message);
    }
  };

  const toggleAlertCheckbox = (alertKey: string) => {
    handleUpdateConfig(prev => {
      const current = prev.enabledAlerts || [];
      const updated = current.includes(alertKey)
        ? current.filter(k => k !== alertKey)
        : [...current, alertKey];
      return { ...prev, enabledAlerts: updated };
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" id="settings_analytic_deck">
      {/* Settings Tab selectors */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Settings size={18} className="text-emerald-600 animate-spin-slow" />
            {t.settings}
          </h2>
          <span className="text-[11px] text-slate-400 block mt-0.5">Configure exchange markets, shop schedules, backup options, and Telegram automatic notifications.</span>
        </div>

        <div className="flex gap-2 border-b sm:border-b-0 pb-2 sm:pb-0 flex-wrap">
          <button
            onClick={() => setActiveTabSub('general')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
              activeTabSub === 'general' 
                ? 'bg-slate-800 text-white shadow-xs' 
                : 'bg-slate-50 border border-slate-150 text-slate-600 hover:bg-slate-100'
            }`}
          >
            General Parameters
          </button>
          <button
            onClick={() => setActiveTabSub('telegram')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
              activeTabSub === 'telegram' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'bg-slate-50 border border-slate-150 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
            }`}
          >
            <Bot size={13} />
            Telegram Bot Alerts
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>
          </button>
          <button
            onClick={() => setActiveTabSub('telegram_templates')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
              activeTabSub === 'telegram_templates' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-slate-50 border border-slate-150 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
            }`}
          >
            Message Templates
          </button>
          <button
            onClick={() => setActiveTabSub('telegram_schedules')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
              activeTabSub === 'telegram_schedules' 
                ? 'bg-amber-600 text-white shadow-xs' 
                : 'bg-slate-50 border border-slate-150 text-slate-600 hover:bg-amber-50 hover:text-amber-600'
            }`}
          >
            <Calendar size={13} />
            Schedules & Channels
          </button>
          <button
            onClick={() => setActiveTabSub('telegram_logs')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
              activeTabSub === 'telegram_logs' 
                ? 'bg-slate-700 text-white shadow-xs' 
                : 'bg-slate-50 border border-slate-150 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History size={13} />
            Sent History Logs
          </button>
        </div>
      </div>

      {activeTabSub === 'general' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSaveSettings} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Settings size={14} className="text-emerald-500" />
                General Parameters Configuration
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">National Exchange Rate (USD ➜ KHR) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={rateInput}
                      onChange={e => setRateInput(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-mono focus:outline-none"
                      required
                    />
                    <span className="absolute right-3.5 top-2.5 text-[11px] font-bold text-slate-400">៛ / $</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">Used automatically across daily billing receipt panels.</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Application Language Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLang('en');
                        onAddLog(`System language changed to English`);
                      }}
                      className={`p-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5
                        ${lang === 'en' 
                          ? 'bg-slate-800 border-slate-900 text-white shadow-xs' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }
                      `}
                    >
                      <svg className="w-4 h-3 rounded-xs shrink-0 shadow-xs border border-slate-200/20" viewBox="0 0 741 390">
                        <rect width="741" height="390" fill="#B22234" />
                        <path d="M0,30h741M0,90h741M0,150h741M0,210h741M0,270h741M0,330h741" stroke="#FFF" strokeWidth="30" />
                        <rect width="296" height="210" fill="#3C3B6E" />
                        <g fill="#FFF">
                          <circle cx="25" cy="20" r="4" /><circle cx="75" cy="20" r="4" /><circle cx="125" cy="20" r="4" /><circle cx="175" cy="20" r="4" /><circle cx="225" cy="20" r="4" /><circle cx="275" cy="20" r="4" />
                          <circle cx="50" cy="40" r="4" /><circle cx="100" cy="40" r="4" /><circle cx="150" cy="40" r="4" /><circle cx="200" cy="40" r="4" /><circle cx="250" cy="40" r="4" />
                          <circle cx="25" cy="60" r="4" /><circle cx="75" cy="60" r="4" /><circle cx="125" cy="60" r="4" /><circle cx="175" cy="60" r="4" /><circle cx="225" cy="60" r="4" /><circle cx="275" cy="60" r="4" />
                          <circle cx="50" cy="80" r="4" /><circle cx="100" cy="80" r="4" /><circle cx="150" cy="80" r="4" /><circle cx="200" cy="80" r="4" /><circle cx="250" cy="80" r="4" />
                          <circle cx="25" cy="100" r="4" /><circle cx="75" cy="100" r="4" /><circle cx="125" cy="100" r="4" /><circle cx="175" cy="100" r="4" /><circle cx="225" cy="100" r="4" /><circle cx="275" cy="100" r="4" />
                          <circle cx="50" cy="120" r="4" /><circle cx="100" cy="120" r="4" /><circle cx="150" cy="120" r="4" /><circle cx="200" cy="120" r="4" /><circle cx="250" cy="120" r="4" />
                          <circle cx="25" cy="140" r="4" /><circle cx="75" cy="140" r="4" /><circle cx="125" cy="140" r="4" /><circle cx="175" cy="140" r="4" /><circle cx="225" cy="140" r="4" /><circle cx="275" cy="140" r="4" />
                          <circle cx="50" cy="160" r="4" /><circle cx="100" cy="160" r="4" /><circle cx="150" cy="160" r="4" /><circle cx="200" cy="160" r="4" /><circle cx="250" cy="160" r="4" />
                          <circle cx="25" cy="180" r="4" /><circle cx="75" cy="180" r="4" /><circle cx="125" cy="180" r="4" /><circle cx="175" cy="180" r="4" /><circle cx="225" cy="180" r="4" /><circle cx="275" cy="180" r="4" />
                        </g>
                      </svg>
                      <span>English</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLang('kh');
                        onAddLog(`System language changed to Khmer`);
                      }}
                      className={`p-2 rounded-xl text-xs font-bold border transition font-suwannaphum cursor-pointer flex items-center justify-center gap-1.5
                        ${lang === 'kh' 
                          ? 'bg-slate-800 border-slate-900 text-white shadow-xs' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }
                      `}
                    >
                      <svg className="w-4 h-3 rounded-xs shrink-0 shadow-xs border border-slate-200/20" viewBox="0 0 936 600">
                        <rect width="936" height="150" fill="#032EA1" />
                        <rect y="150" width="936" height="300" fill="#E51B23" />
                        <rect y="450" width="936" height="150" fill="#032EA1" />
                        <g fill="#FFF" transform="translate(368, 200)">
                          <path d="M40,170 L50,110 L60,110 L70,170 Z" />
                          <path d="M130,170 L140,110 L150,110 L160,170 Z" />
                          <path d="M85,170 L100,70 L110,70 L125,170 Z" />
                          <rect x="20" y="170" width="160" height="15" />
                          <rect x="30" y="185" width="140" height="15" />
                        </g>
                      </svg>
                      <span>ភាសាខ្មែរ</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Opening Time (Schedules) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400"><Clock size={14} /></span>
                    <input
                      type="text"
                      value={opening}
                      onChange={e => setOpening(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 p-2.5 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Closing Time (Schedules) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400"><Clock size={14} /></span>
                    <input
                      type="text"
                      value={closing}
                      onChange={e => setClosing(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 p-2.5 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Shop Hotline numbers</label>
                  <input
                    type="text"
                    value={shopPhone}
                    onChange={e => setShopPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Headquarters Legal Address *</label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 font-semibold">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4.5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs hover:bg-emerald-500 shadow-md shadow-emerald-200 cursor-pointer"
                >
                  <Save size={14} />
                  Save System Config
                </button>
              </div>
            </form>

            {/* Backup & Restore segment */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Database size={14} className="text-indigo-500" />
                Database Backup & Direct Restoration
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Save active local datasets to your local computer as standard JSON backups, or upload valid backup configurations to overwrite state variables securely after schema validations.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="backup_restore_control_deck">
                {/* Download backup card */}
                <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2.5">
                  <span className="text-[10px] font-bold text-indigo-950 block uppercase tracking-wider">Export Ledger Data</span>
                  <p className="text-[10px] text-slate-450 leading-normal">
                    Aggregates operational branches, coin registers, payroll parameters, and transactions into a single backup file.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const backupObj: Record<string, string | null> = {};
                      const keys = [
                        'clean24_branches', 'clean24_staff', 'clean24_salaries', 'clean24_attendances',
                        'clean24_incomes', 'clean24_expenses', 'clean24_coinTransactions', 'clean24_revenueRecords',
                        'clean24_gasRecords', 'clean24_detergentRecords', 'clean24_softenerRecords', 'clean24_stockTransactions',
                        'clean24_machines', 'clean24_users', 'clean24_suppliers', 'clean24_debts',
                        'clean24_debtpayments', 'clean24_cashdrawers', 'clean24_cashdrawertransactions', 'clean24_monthclosings',
                        'clean24_auditLogs'
                      ];
                      keys.forEach(k => {
                        backupObj[k] = localStorage.getItem(k);
                      });

                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `tc_staff_backup_${new Date().toISOString().substring(0, 10)}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      document.body.removeChild(downloadAnchor);
                      onAddLog("Downloaded complete system database JSON backup file.");
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Download Backup System JSON
                  </button>
                </div>

                {/* Upload restore card */}
                <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-2.5">
                  <span className="text-[10px] font-bold text-emerald-950 block uppercase tracking-wider">Import & Restore File</span>
                  <p className="text-[10px] text-slate-450 leading-normal">
                    Select a previously exported <code>.json</code> backup from your disk filesystem. Validates data integrity automatically.
                  </p>
                  <label className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 text-center">
                    Upload & Restore Backup
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const fileReader = new FileReader();
                        const files = e.target.files;
                        if (!files || files.length === 0) return;

                        fileReader.onload = (event) => {
                          try {
                            const resultText = event.target?.result as string;
                            const parsed = JSON.parse(resultText);
                            
                            // Simple schema validation checks
                            const requiredKeys = ['clean24_branches', 'clean24_staff'];
                            const hasKeys = requiredKeys.every(k => k in parsed);
                            if (!hasKeys) {
                              alert("Invalid database backup schema format! Missing critical operational keys.");
                              return;
                            }

                            // Write elements back
                            Object.keys(parsed).forEach(k => {
                              if (parsed[k] !== null) {
                                localStorage.setItem(k, parsed[k]);
                              }
                            });

                            onAddLog("Successfully restored entire local database state securely from uploaded backup file.");
                            alert("Database restored successfully! Reloading session...");
                            window.location.reload();
                          } catch (err: any) {
                            alert("Corrupted backup json structure: " + err.message);
                          }
                        };
                        fileReader.readAsText(files[0]);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Full codebase export card */}
                <div className="p-3 bg-teal-50/40 border border-teal-100 rounded-xl space-y-2.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-teal-950 block uppercase tracking-wider flex items-center gap-1">
                      <Download size={11} className="text-teal-600" />
                      Export Codebase ZIP
                    </span>
                    <p className="text-[10px] text-slate-450 leading-normal mt-1">
                      Get the complete, clean application codebase (Frontend, Backend Server, and configs) packaged as a <code>tar.gz</code> archive.
                    </p>
                  </div>
                  <a
                    href="/api/download-project"
                    download="TC-Staff-Management-project.tar.gz"
                    className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 text-center mt-auto"
                  >
                    Download Project (.tar.gz)
                  </a>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("WARNING: Are you sure you want to trigger database group reset? All of your custom records, payouts, and coin logs will be set back to original defaults!")) {
                      localStorage.clear();
                      onAddLog(`Purged simulated active database storage to defaults.`);
                      alert("Database group successfully reset! Reloading...");
                      window.location.reload();
                    }
                  }}
                  className="px-3.5 py-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-xl text-[10px] uppercase hover:bg-rose-100 cursor-pointer animate-pulse"
                >
                  Factory Reset Database Group
                </button>
              </div>
            </div>
          </div>

          {/* Right Info panels */}
          <div className="space-y-6 self-start shrink-0">
            <div className="bg-indigo-950 text-white p-5 rounded-2xl shadow-sm border border-indigo-900 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full filter blur-xl"></div>
              
              <div className="flex items-center gap-1 text-xs font-bold text-indigo-200 uppercase tracking-wide">
                <ShieldCheck size={14} />
                Security Information
              </div>

              <div className="space-y-2.5 leading-relaxed text-[11px] text-indigo-150">
                <p>
                  <strong>Strict Data Isolation:</strong> Sub-account profiles can only fetch, view, or mutate lists belonging strictly to their assigned branch.
                </p>
                <p>
                  Your active role is <strong className="text-emerald-400 bg-emerald-950 border border-emerald-900/50 px-1.5 py-0.5 rounded text-[10px] tracking-wide font-mono uppercase">{currentRole}</strong>, representing the highest administration layer of TC Staff Management.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-justify text-slate-600 text-xs">
              <div className="flex gap-2 mb-2 items-center">
                <Info className="text-slate-400" size={14} />
                <strong className="text-slate-750 font-bold">Cambodian Tax compliance</strong>
              </div>
              <p className="leading-relaxed text-[11px]">
                TC Staff Management System satisfies the Ministry of Economy guidelines inside the Kingdom of Cambodia by compiling multi-currency invoices displaying USD ($) and Khmer Riel (៛) equivalents dynamically under standard flat conversion calculations.
              </p>
            </div>
          </div>
        </div>
      ) : activeTabSub === 'telegram' ? (
        <TelegramSettingsView
          currentRole={currentRole}
          branches={branches}
          lang={lang}
          onAddLog={onAddLog}
        />
      ) : activeTabSub === 'telegram_legacy_stale' ? (
        /* ─── TELEGRAM BOT MODULE VIEW ─── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Security Guard */}
            {!isOwnerOrAdmin && (
              <div className="p-4 bg-amber-50 border border-amber-150 rounded-2xl flex gap-3 text-amber-950 text-xs leading-relaxed">
                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <strong className="font-bold block text-amber-900 mb-0.5">Authorization Notice (View Only Session)</strong>
                  Only the Owner or Admin user handles secure Telegram API credentials and Bot Token configurations on the server file structures.
                  Currently, your session is active as <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-amber-800 font-bold ml-1">{currentRole}</span>.
                </div>
              </div>
            )}

            <form onSubmit={handleSaveTelegram} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-6">
              
              {/* Bot Connection Info */}
              <div className="space-y-4">
                <h4 className="font-bold text-indigo-950 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Bot size={15} className="text-indigo-600" />
                    Telegram Bot Connectivity Integration
                  </span>
                  <span className="text-[10px] text-indigo-600 lowercase bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-mono">
                    api/telegram-config
                  </span>
                </h4>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center justify-between">
                    <span>TELEGRAM BOT TOKEN SECURE KEY *</span>
                    <a 
                      href="https://t.me/BotFather" 
                      target="_blank" 
                      rel="referrer" 
                      className="text-[10px] font-normal text-indigo-600 underline hover:text-indigo-500"
                    >
                      Acquire from @BotFather
                    </a>
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      value={telegramConfig.botToken}
                      onChange={e => handleUpdateConfig(prev => ({ ...prev, botToken: e.target.value }))}
                      disabled={!isOwnerOrAdmin}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 font-mono focus:outline-none pr-10 disabled:opacity-75"
                      placeholder="e.g. 5991823190:AAF6vMy-VUr_XN763A99B_g..."
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1 leading-relaxed">
                    Once saved, operations such as low soap supplies, device breakdowns, or payroll periods instantly serialize message statements securely dispatched to custom threads.
                  </span>
                </div>
              </div>

              {/* Central Alert Types Subscription Configuration */}
              <div className="space-y-3">
                <h5 className="text-[11px] font-bold text-slate-600 tracking-wider">CHANNELS OPERATIONAL ALERT SUBSCRIPTION:</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                  <label className="p-3 bg-slate-50 rounded-xl flex items-start gap-2.5 border border-slate-100 hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telegramConfig.enabledAlerts.includes('low_stock')}
                      onChange={() => toggleAlertCheckbox('low_stock')}
                      disabled={!isOwnerOrAdmin}
                      className="mt-0.5 rounded cursor-pointer accent-indigo-600"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">Low Stock Alerting</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Dips below 10L Soap, 10L Softener, 20kg Gas, 200 Coins</span>
                    </div>
                  </label>

                  <label className="p-3 bg-slate-50 rounded-xl flex items-start gap-2.5 border border-slate-100 hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telegramConfig.enabledAlerts.includes('salary')}
                      onChange={() => toggleAlertCheckbox('salary')}
                      disabled={!isOwnerOrAdmin}
                      className="mt-0.5 rounded cursor-pointer accent-indigo-600"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">Salary / Payroll Alerts</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Dispatches payroll approximations & payments approaching due date</span>
                    </div>
                  </label>

                  <label className="p-3 bg-slate-50 rounded-xl flex items-start gap-2.5 border border-slate-100 hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telegramConfig.enabledAlerts.includes('daily_business')}
                      onChange={() => toggleAlertCheckbox('daily_business')}
                      disabled={!isOwnerOrAdmin}
                      className="mt-0.5 rounded cursor-pointer accent-indigo-600"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">Daily Business Summary</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Autosend Daily performance statement at 20:00 (Revenue vs Expenses)</span>
                    </div>
                  </label>

                  <label className="p-3 bg-slate-50 rounded-xl flex items-start gap-2.5 border border-slate-100 hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telegramConfig.enabledAlerts.includes('machine')}
                      onChange={() => toggleAlertCheckbox('machine')}
                      disabled={!isOwnerOrAdmin}
                      className="mt-0.5 rounded cursor-pointer accent-indigo-600"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">Machine Maintenance Alert</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Fires immediately when devices change to Broken or Maintenance status</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Thread-ID Settings Config Grid */}
              <div className="space-y-4">
                <h4 className="font-bold text-indigo-950 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                  Recipient Telegram Chat / Thread IDs Integration
                </h4>

                {/* Owner and Admin Threads (Global) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">OWNER CHAT THREAED ID</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={telegramConfig.chatIds.owner}
                        onChange={e => handleUpdateConfig(prev => {
                          const next = { ...prev.chatIds, owner: e.target.value };
                          return { ...prev, chatIds: next };
                        })}
                        disabled={!isOwnerOrAdmin}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-mono p-2 rounded-xl focus:outline-none"
                        placeholder="e.g. -10018872213 or 98212351"
                      />
                      <button
                        type="button"
                        onClick={() => handleTestChatId(telegramConfig.chatIds.owner, 'Owner Thread', 'owner_test')}
                        disabled={isTestLoading['owner_test']}
                        className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shrink-0 border border-indigo-100 hover:bg-indigo-100 transition cursor-pointer"
                      >
                        <Send size={12} />
                        {isTestLoading['owner_test'] ? 'Wait' : 'Test'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">ADMIN CHAT THREAD ID</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={telegramConfig.chatIds.admin}
                        onChange={e => handleUpdateConfig(prev => {
                          const next = { ...prev.chatIds, admin: e.target.value };
                          return { ...prev, chatIds: next };
                        })}
                        disabled={!isOwnerOrAdmin}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-mono p-2 rounded-xl focus:outline-none"
                        placeholder="e.g. -10019201991"
                      />
                      <button
                        type="button"
                        onClick={() => handleTestChatId(telegramConfig.chatIds.admin, 'Admin Thread', 'admin_test')}
                        disabled={isTestLoading['admin_test']}
                        className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shrink-0 border border-indigo-100 hover:bg-indigo-100 transition cursor-pointer"
                      >
                        <Send size={12} />
                        {isTestLoading['admin_test'] ? 'Wait' : 'Test'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Branch Specific Assignments */}
                <div className="space-y-3.5 pt-2">
                  <span className="text-[11px] font-bold text-indigo-900 block bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-xl">
                    🏢 BRANCH-LEVEL CHAT CHANNELS CONFIGURATION
                  </span>

                  <div className="space-y-4">
                    {branches.map((branch) => {
                      const bId = branch.id;
                      return (
                        <div key={bId} className="bg-slate-50/60 border border-slate-150 p-4 rounded-xl space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                              <MapPin size={13} className="text-emerald-600" />
                              {branch.branchName} ({branch.branchCode})
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">Assigned Manager ID: {branch.managerName}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Branch Channel ID */}
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 mb-1 block">BRANCH NEWS GROUP/CHANNEL ID</label>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  value={telegramConfig.chatIds.branches[bId] || ''}
                                  onChange={e => handleUpdateConfig(prev => {
                                    const next = { ...prev.chatIds };
                                    next.branches[bId] = e.target.value;
                                    return { ...prev, chatIds: next };
                                  })}
                                  disabled={!isOwnerOrAdmin}
                                  className="w-full bg-white border border-slate-200 text-xs font-mono p-1.5 rounded-lg focus:outline-none"
                                  placeholder="e.g. -10091..."
                                />
                                <button
                                  type="button"
                                  onClick={() => handleTestChatId(telegramConfig.chatIds.branches[bId], `${branch.branchName} Info Channel`, `ch_${bId}`)}
                                  disabled={isTestLoading[`ch_${bId}`]}
                                  className="text-[9px] font-bold p-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-100 shrink-0 cursor-pointer"
                                >
                                  Test
                                </button>
                              </div>
                            </div>

                            {/* Manager Alert Chat ID */}
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 mb-1 block">MANAGER CHAT / DIRECT ID</label>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  value={telegramConfig.chatIds.manager[bId] || ''}
                                  onChange={e => handleUpdateConfig(prev => {
                                    const next = { ...prev.chatIds };
                                    next.manager[bId] = e.target.value;
                                    return { ...prev, chatIds: next };
                                  })}
                                  disabled={!isOwnerOrAdmin}
                                  className="w-full bg-white border border-slate-200 text-xs font-mono p-1.5 rounded-lg focus:outline-none"
                                  placeholder="e.g. 551982312"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleTestChatId(telegramConfig.chatIds.manager[bId], `Manager: ${branch.managerName}`, `mgr_${bId}`)}
                                  disabled={isTestLoading[`mgr_${bId}`]}
                                  className="text-[9px] font-bold p-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-100 shrink-0 cursor-pointer"
                                >
                                  Test
                                </button>
                              </div>
                            </div>

                            {/* Staff Alert Chat ID */}
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 mb-1 block">STAFF TEAM GROUP / THREAD ID</label>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  value={telegramConfig.chatIds.staff[bId] || ''}
                                  onChange={e => handleUpdateConfig(prev => {
                                    const next = { ...prev.chatIds };
                                    next.staff[bId] = e.target.value;
                                    return { ...prev, chatIds: next };
                                  })}
                                  disabled={!isOwnerOrAdmin}
                                  className="w-full bg-white border border-slate-200 text-xs font-mono p-1.5 rounded-lg focus:outline-none"
                                  placeholder="e.g. -112443219"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleTestChatId(telegramConfig.chatIds.staff[bId], `${branch.branchName} Staff Thread`, `stf_${bId}`)}
                                  disabled={isTestLoading[`stf_${bId}`]}
                                  className="text-[9px] font-bold p-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-100 shrink-0 cursor-pointer"
                                >
                                  Test
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action save section */}
              {isOwnerOrAdmin && (
                <div className="flex justify-end pt-3 border-t border-slate-100 font-semibold">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs hover:bg-indigo-500 shadow-md shadow-indigo-200 cursor-pointer transition transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Save size={14} />
                    Overwrite Telegram configuration
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Right Info and Simulation parameters panel */}
          <div className="space-y-6 self-start shrink-0">
            
            {/* Telegram Setup guide */}
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-justify text-slate-600 text-xs space-y-3">
              <div className="flex gap-2 items-center">
                <Bot className="text-indigo-600 animate-bounce" size={16} />
                <strong className="text-indigo-950 font-bold text-xs uppercase tracking-wide">Telegram integration Manual</strong>
              </div>
              <p className="leading-relaxed text-[11px]">
                1) Open Telegram search for <code>@BotFather</code> and send <code>/newbot</code> command to generate a bot and copy its API Token keys.
              </p>
              <p className="leading-relaxed text-[11px]">
                2) Paste Bot Token in configurations on the left side and press save.
              </p>
              <p className="leading-relaxed text-[11px]">
                3) Open Telegram search for your bot user and press <code>/start</code>. Find your User ID via <code>@userinfobot</code>, or add the bot to a Group Chat and run <code>@RawDataBot</code> to get Group Chat IDs.
              </p>
              <p className="leading-relaxed text-[11px]">
                4) Save thread IDs above and press <strong>Test</strong> to establish handshake verification!
              </p>
            </div>

            {/* Live instant alert dispatcher */}
            <div className="bg-white border border-slate-100 shadow-xs p-5 rounded-2xl space-y-3">
              <h5 className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1">
                <Bell size={13} className="text-rose-500" />
                Live Telegram Alert Dispatcher
              </h5>
              <p className="text-[10px] text-slate-400 leading-normal">
                Instantly dispatch formatted operational alert notifications to your configured Telegram channels and managers.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleDispatchLiveAlert('low_stock', 'b1')}
                  className="w-full text-left p-2.5 bg-rose-50 border border-slate-150 rounded-xl hover:bg-rose-100 transition cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <span className="text-[11px] font-bold text-rose-950 block">Dispatch Low Stock Alert</span>
                    <span className="text-[9px] text-rose-800 block">Sends Soap, Softener and Propane levels warnings</span>
                  </div>
                  <Send size={11} className="text-rose-700 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDispatchLiveAlert('salary', 'b1')}
                  className="w-full text-left p-2.5 bg-amber-50 border border-slate-150 rounded-xl hover:bg-amber-100 transition cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <span className="text-[11px] font-bold text-amber-950 block">Dispatch Salary Reminder</span>
                    <span className="text-[9px] text-amber-800 block">Sends pending unpaid payroll notifications</span>
                  </div>
                  <Send size={11} className="text-amber-700 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDispatchLiveAlert('daily_business', 'b1')}
                  className="w-full text-left p-2.5 bg-emerald-50 border border-slate-150 rounded-xl hover:bg-emerald-100 transition cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <span className="text-[11px] font-bold text-emerald-950 block">Dispatch Daily Performance</span>
                    <span className="text-[9px] text-emerald-800 block">Sends cash vs ABA payments calculation summary</span>
                  </div>
                  <Send size={11} className="text-emerald-700 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDispatchLiveAlert('machine', 'b1')}
                  className="w-full text-left p-2.5 bg-blue-50 border border-slate-150 rounded-xl hover:bg-blue-100 transition cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <span className="text-[11px] font-bold text-blue-950 block">Dispatch Machine Breakdown</span>
                    <span className="text-[9px] text-blue-800 block">Sends equipment error-code logs and lockout alerts</span>
                  </div>
                  <Send size={11} className="text-blue-700 shrink-0" />
                </button>
              </div>
            </div>

          </div>
        </div>
      ) : activeTabSub === 'telegram_templates' ? (
        <TelegramTemplatesView branches={branches} />
      ) : activeTabSub === 'telegram_schedules' ? (
        <TelegramSchedulesView branches={branches} />
      ) : activeTabSub === 'telegram_logs' ? (
        <TelegramLogsView />
      ) : (
        <div className="text-center p-12 text-slate-400 text-xs bg-white border rounded-2xl">
          Unavailable sub-tab state selection.
        </div>
      )}

    </div>
  );
}

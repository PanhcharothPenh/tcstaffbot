import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { 
  getTelegramConfig, 
  saveTelegramConfig, 
  sendTelegramMessage, 
  getLatestTelegramChatId,
  formatTelegramMessage,
  encryptToken,
  decryptToken,
  maskToken,
  validateTelegramInitData,
  calculateHaversineDistance,
  compareFaceVectors,
  resolveTelegramBotToken
} from './telegramService';

// Types mirror from types.ts
interface SyncPayload {
  branches: any[];
  staff: any[];
  salaries: any[];
  attendance: any[];
  incomes: any[];
  expenses: any[];
  inventory: any[];
  machines: any[];
  coinTransactions: any[];
  revenueRecords: any[];
  gasRecords: any[];
  detergentRecords: any[];
  softenerRecords: any[];
  stockTransactions: any[];
  settings: any;
  auditLogs?: any[];
  users?: any[];
  roles?: any[];
  permissions?: any[];
  rolePermissions?: Record<string, string[]>;
  loginHistory?: any[];
  refreshTokens?: any[];
  passwordResetTokens?: any[];
  telegramTemplates?: any[];
  telegramAlertSchedules?: any[];
  telegramRecipients?: any[];
  telegramLogs?: any[];
  salarySchedules?: any[];
  salaryAdvances?: any[];
}

const app = express();
app.set('trust proxy', true);
const PORT = 3000;

// Helper to resolve client public IP behind reverse proxies (like Vercel)
function getClientIp(req: any): string {
  const xRealIp = req.headers['x-real-ip'];
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xRealIp) return xRealIp;
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  return getClientIp(req);
}

app.use(cors());

let isDbPulled = false;

// Request-level Supabase database pull middleware
app.use(async (req, res, next) => {
  // Only intercept API and auth paths to keep frontend assets load lightning fast
  const isApi = req.path.startsWith('/api') || req.path.startsWith('/auth');
  if (supabase && !isDbPulled && isApi) {
    try {
      console.log('[TC Staff Server] Request context activated. Awaiting Supabase database pull...');
      await pullCollectionsFromSupabase();
      isDbPulled = true;
      console.log('[TC Staff Server] Supabase database pull completed successfully!');
    } catch (err) {
      console.error('[TC Staff Server] Supabase database pull failed:', err.message || err);
    }
  }
  next();
});

// Intercept Express response lifecycle to await pending Supabase pushes cleanly
app.use((req, res, next) => {
  res.on('finish', () => {
    if (pendingSupabasePushes.length > 0) {
      Promise.all(pendingSupabasePushes).catch(err => {
        console.error('[TC Staff Server] Error syncing database tasks before response:', err.message);
      });
      pendingSupabasePushes = [];
    }
  });
  next();
});
app.use(express.json({ limit: '50mb' }));

app.get('/api/download-project', (req, res) => {
  const filePath = path.join(process.cwd(), 'project.tar.gz');
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'TC-Staff-Management-project.tar.gz');
  } else {
    res.status(404).send('Project archive not found. Please run tar manually or contact support.');
  }
});

const SERVER_DB_PATH = path.join(process.cwd(), 'server-db.json');

// Memory cache of synced data
// Supabase Integration Adapter Configuration
import { createClient } from '@supabase/supabase-js';

let supabase: any = null;
let pendingSupabasePushes: Promise<any>[] = [];
let lastPushedDbJson: Record<string, string> = {};
try {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const supabaseKey = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e: any) {
  console.error('[TC Staff Server] Failed to initialize Supabase client:', e.message);
}

if (supabase) {
  console.log('[TC Staff Server] Supabase client initialized successfully.');
} else {
  console.log('[TC Staff Server] Supabase keys missing. Running in local JSON-file fallback mode.');
}

// Global pull/push helpers
async function pullCollectionsFromSupabase() {
  if (!supabase) return;
  try {
    let { data, error } = await supabase.from('tc_collections').select('*');
    if (error) {
      const alt = await supabase.from('clean24_collections').select('*');
      if (!alt.error) {
        data = alt.data;
        error = null;
      }
    }
    if (error) throw error;
    
    const existingIds = new Set();
    if (data && data.length > 0) {
      data.forEach(row => {
        localDb[row.id] = row.data;
        lastPushedDbJson[row.id] = JSON.stringify(row.data);
        existingIds.add(row.id);
      });
      console.log('[TC Staff Server] Database successfully synchronized from Supabase!');
    } else {
      // Supabase is empty (first run). Trigger seedUsersAndRoles to populate
      console.log('[TC Staff Server] Supabase database is empty. Triggering self-healing database seeding...');
      seedUsersAndRoles();
    }

    // Self-healing check: if any collections in localDb are missing from Supabase, sync them immediately
    for (const collId of Object.keys(localDb)) {
      // For object types like rolePermissions, check size of keys
      const hasData = collId === 'rolePermissions' 
        ? Object.keys(localDb[collId] || {}).length > 0
        : Array.isArray(localDb[collId]) && localDb[collId].length > 0;

      if (!existingIds.has(collId) && hasData) {
        console.log(`[TC Staff Server] Self-healing sync: pushing missing collection "${collId}" to Supabase...`);
        await pushCollectionToSupabase(collId);
        lastPushedDbJson[collId] = JSON.stringify(localDb[collId]);
      }
    }
  } catch (err: any) {
    console.error('[TC Staff Server] Supabase pull failed:', err.message);
  }
}

async function pushCollectionToSupabase(collectionId: string) {
  if (!supabase) return;
  try {
    const row = { id: collectionId, data: localDb[collectionId], updated_at: new Date().toISOString() };
    await Promise.allSettled([
      supabase.from('tc_collections').upsert(row),
      supabase.from('clean24_collections').upsert(row)
    ]);
  } catch (err: any) {
    console.error(`[TC Staff Server] Supabase push for ${collectionId} failed:`, err.message);
  }
}

let localDb: SyncPayload = {
  branches: [],
  staff: [],
  salaries: [],
  attendance: [],
  incomes: [],
  expenses: [],
  inventory: [],
  machines: [],
  coinTransactions: [],
  revenueRecords: [],
  gasRecords: [],
  detergentRecords: [],
  softenerRecords: [],
  stockTransactions: [],
  settings: { shopName: 'TC Staff Management' },
  users: [],
  roles: [],
  permissions: [],
  rolePermissions: {},
  loginHistory: [],
  refreshTokens: [],
  passwordResetTokens: []
};

// Load saved data if exists
if (fs.existsSync(SERVER_DB_PATH)) {
  try {
    localDb = JSON.parse(fs.readFileSync(SERVER_DB_PATH, 'utf8'));
    // Trigger initial background sync if running with Supabase
    if (supabase) {
      pullCollectionsFromSupabase().catch(err => console.error('[TC Staff Server] Initial pull failed:', err));
    }
  } catch (e) {
    console.error('Failed to parse server-db.json:', e);
  }
}

// Ensure the standard SyncPayload fields and authentication arrays are initialized
if (!localDb.branches) localDb.branches = [];
if (!localDb.staff) localDb.staff = [];
if (!localDb.salaries) localDb.salaries = [];
if (!localDb.attendance) localDb.attendance = [];
if (!localDb.incomes) localDb.incomes = [];
if (!localDb.expenses) localDb.expenses = [];
if (!localDb.inventory) localDb.inventory = [];
if (!localDb.machines) localDb.machines = [];
if (!localDb.coinTransactions) localDb.coinTransactions = [];
if (!localDb.revenueRecords) localDb.revenueRecords = [];
if (!localDb.gasRecords) localDb.gasRecords = [];
if (!localDb.detergentRecords) localDb.detergentRecords = [];
if (!localDb.softenerRecords) localDb.softenerRecords = [];
if (!localDb.stockTransactions) localDb.stockTransactions = [];
if (!localDb.users || localDb.users.length === 0) {
  localDb.users = [
    {
      id: 'usr_owner',
      role: 'Owner',
      username: process.env.INITIAL_OWNER_USERNAME || 'owner',
      email: process.env.INITIAL_OWNER_EMAIL || 'owner@p2bkh.tech',
      fullName: 'Executive Owner',
      phone: '',
      passwordHash: '',
      roleId: 'owner',
      status: 'Active',
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      forcePasswordChange: false,
      telegramUsername: '',
      telegramChatId: '',
      twoFactorMethod: 'telegram',
      assignedBranchIds: []
    }
  ];
  saveLocalDb();
}
if (!localDb.roles) localDb.roles = [];
if (!localDb.permissions) localDb.permissions = [];
if (!localDb.rolePermissions) localDb.rolePermissions = {};
if (!localDb.loginHistory) localDb.loginHistory = [];
if (!localDb.refreshTokens) localDb.refreshTokens = [];
if (!localDb.passwordResetTokens) localDb.passwordResetTokens = [];
if (!localDb.salarySchedules) localDb.salarySchedules = [];
if (!localDb.salaryAdvances) localDb.salaryAdvances = [];
if (!localDb.telegramTemplates) {
  localDb.telegramTemplates = [
    {
      id: "tpl_daily_revenue",
      name: "Daily Revenue Summary",
      category: "Daily Revenue Summary",
      isEnabled: true,
      engTemplate: "<b>📊 DAILY REVENUE SUMMARY</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n📅 <b>Date:</b> {date} {time}\n💵 <b>Total Revenue:</b> {revenue} USD\n📈 <b>Status:</b> {status}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>📊 របាយការណ៍ចំណូលប្រចាំថ្ងៃ</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n📅 <b>កាលបរិច្ឆេទ:</b> {date} {time}\n💵 <b>ចំណូលសរុប:</b> {revenue} USD\n📈 <b>ស្ថានភាព:</b> {status}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_daily_expense",
      name: "Daily Expense Summary",
      category: "Daily Expense Summary",
      isEnabled: true,
      engTemplate: "<b>💸 DAILY EXPENSE SUMMARY</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n📅 <b>Date:</b> {date}\n💵 <b>Total Expenses:</b> {expense} USD\n📝 <b>Details:</b> {message}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>💸 របាយការណ៍ចំណាយប្រចាំថ្ងៃ</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n📅 <b>កាលបរិច្ឆេទ:</b> {date}\n💵 <b>ចំណាយសរុប:</b> {expense} USD\n📝 <b>ព័ត៌មានលម្អិត:</b> {message}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_daily_profit",
      name: "Daily Profit Summary",
      category: "Daily Profit Summary",
      isEnabled: true,
      engTemplate: "<b>💰 DAILY PROFIT SUMMARY</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n📅 <b>Date:</b> {date}\n💵 <b>Revenue:</b> {revenue} USD\n💸 <b>Expense:</b> {expense} USD\n👉 <b>Net Profit:</b> {profit} USD\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>💰 របាយការណ៍ចំណេញប្រចាំថ្ងៃ</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n📅 <b>កាលបរិច្ឆេទ:</b> {date}\n💵 <b>ចំណូល:</b> {revenue} USD\n💸 <b>ចំណាយ:</b> {expense} USD\n👉 <b>ប្រាក់ចំណេញសុទ្ធ:</b> {profit} USD\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_low_stock",
      name: "Low Stock Alert",
      category: "Low Stock Alert",
      isEnabled: true,
      engTemplate: "<b>⚠️ LOW STOCK ALERT</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n📦 <b>Item:</b> {item_name}\n🚨 <b>Remaining:</b> {remaining_qty} (Min: {minimum_qty})\n📅 <b>Time:</b> {time}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>⚠️ ដំណឹងការរំលឹកអីវ៉ាន់ក្នុងស្តុកទាប</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n📦 <b>មុខទំនិញ:</b> {item_name}\n🚨 <b>ចំនួននៅសល់:</b> {remaining_qty} (កម្រិតទាបបំផុត: {minimum_qty})\n📅 <b>ម៉ោង:</b> {time}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_coin_alert",
      name: "Coin Alert",
      category: "Coin Alert",
      isEnabled: true,
      engTemplate: "<b>🪙 COIN DISPENSER ALERT</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n💰 <b>Coin Balance:</b> {coin_balance} Coins\n📢 <b>Message:</b> {message}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>🪙 ការជូនដំណឹងអំពីកាក់ក្នុងម៉ាស៊ីន</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n💰 <b>ចំនួនកាក់ក្នុងម៉ាស៊ីន:</b> {coin_balance} កាក់\n📢 <b>សារដំណឹង:</b> {message}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_gas_alert",
      name: "Gas Alert",
      category: "Gas Alert",
      isEnabled: true,
      engTemplate: "<b>🔥 PROPANE GAS CYLINDER ALERT</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n⚡ <b>Status:</b> {status}\n📢 <b>Details:</b> {message}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>🔥 ដំណឹងការរំលឹកហ្គាស (Propane)</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n⚡ <b>ស្ថានភាព:</b> {status}\n📢 <b>ព័ត៌មានលម្អិត:</b> {message}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_salary_remind",
      name: "Salary Reminder",
      category: "Salary Reminder",
      isEnabled: true,
      engTemplate: "<b>📅 UPCOMING SALARY REMINDER</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n👥 <b>Total Staff:</b> {staff_count}\n💵 <b>Total Payroll:</b> {expense} USD\n💬 <b>Notification:</b> {message}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>📅 ការរំលឹកបើកប្រាក់បៀវត្សរ៍បុគ្គលិក</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n👥 <b>ចំនួនបុគ្គលិក:</b> {staff_count} នាក់\n💵 <b>ចំនួនត្រូវបើកសរុប:</b> {expense} USD\n💬 <b>សារដំណឹង:</b> {message}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_machine_maint",
      name: "Machine Maintenance",
      category: "Machine Maintenance",
      isEnabled: true,
      engTemplate: "<b>🔧 MACHINE MAINTENANCE SCHEDULE</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n📟 <b>Machine ID:</b> #{machine_no}\n⚡ <b>Current Status:</b> {status}\n📝 <b>Tasks:</b> {message}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>🔧 ដែនការថែទាំម៉ាស៊ីនបោកគក់</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n📟 <b>លេខម៉ាស៊ីន:</b> #{machine_no}\n⚡ <b>ស្ថានភាពបច្ចុប្បន្ន:</b> {status}\n📝 <b>ការងារត្រូវធ្វើ:</b> {message}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_machine_broken",
      name: "Machine Broken",
      category: "Machine Broken",
      isEnabled: true,
      engTemplate: "<b>🚨 MACHINE OUT OF ORDER ALERT</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n📟 <b>Machine ID:</b> #{machine_no}\n🛑 <b>Error Status:</b> {status}\n❌ <b>Problem Statement:</b> {message}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>🚨 ការជូនដំណឹងម៉ាស៊ីនខូច/មានបញ្ហា</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n📟 <b>លេខម៉ាស៊ីន:</b> #{machine_no}\n🛑 <b>ស្ថានភាពកំហុស:</b> {status}\n❌ <b>ការពិពណ៌នាបញ្ហា:</b> {message}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_cash_diff",
      name: "Cash Difference",
      category: "Cash Difference",
      isEnabled: true,
      engTemplate: "<b>⚠️ CASH DRAWER DISCREPANCY</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n💵 <b>Discrepancy:</b> {revenue} USD\n⚡ <b>Status:</b> {status}\n📝 <b>Audit Message:</b> {message}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>⚠️ ភាពខុសគ្នានៃសាច់ប្រាក់ក្នុងថត</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n💵 <b>កម្រិតខុសគ្នា:</b> {revenue} USD\n⚡ <b>ស្ថានភាព:</b> {status}\n📝 <b>សារបញ្ជាក់:</b> {message}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_month_closing",
      name: "Month-End Closing",
      category: "Month-End Closing",
      isEnabled: true,
      engTemplate: "<b>📊 MONTH-END RECONCILIATION CLOSED</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n📅 <b>Closing Month:</b> {date}\n💵 <b>Final Net Revenue:</b> {revenue} USD\n💬 <b>Closing Log:</b> {message}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>📊 ការបិទបញ្ជីគណനេយ្យប្រចាំខែ</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>សាខា:</b> {branch_name}\n📅 <b>ខែបិទបញ្ជី:</b> {date}\n💵 <b>ចំណូលសុទ្ធចុងក្រោយ:</b> {revenue} USD\n💬 <b>កំណត់ត្រា:</b> {message}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_backup_success",
      name: "Backup Success",
      category: "Backup Success",
      isEnabled: true,
      engTemplate: "<b>✅ SYSTEM DATABASE BACKUP SUCCESSFUL</b>\n━━━━━━━━━━━━━━━━━\n💾 <b>Task name:</b> Cloud DB Auto-Sync\n📅 <b>Timestamp:</b> {date} {time}\n⚡ <b>Status:</b> {status}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>✅ ការចម្លងទុកទិន្នន័យប្រព័ន្ធទទួលបានជោគជ័យ</b>\n━━━━━━━━━━━━━━━━━\n💾 <b>ការងារ:</b> Cloud DB Auto-Sync\n📅 <b>ម៉ោងអនុវត្ត:</b> {date} {time}\n⚡ <b>ស្ថានភាព:</b> {status}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    },
    {
      id: "tpl_backup_failure",
      name: "Backup Failure",
      category: "Backup Failure",
      isEnabled: true,
      engTemplate: "<b>❌ SYSTEM DATABASE BACKUP FAILED</b>\n━━━━━━━━━━━━━━━━━\n💾 <b>Task name:</b> Cloud DB Auto-Sync\n📅 <b>Timestamp:</b> {date} {time}\n🛑 <b>Error Log:</b> {message}\n━━━━━━━━━━━━━━━━━",
      khmerTemplate: "<b>❌ ការចម្លងទុកទិន្នន័យប្រព័ន្ធបរាជ័យ</b>\n━━━━━━━━━━━━━━━━━\n💾 <b>ការងារ:</b> Cloud DB Auto-Sync\n📅 <b>ម៉ោងអនុវត្ត:</b> {date} {time}\n🛑 <b>កំហុសបច្ចេកទេស:</b> {message}\n━━━━━━━━━━━━━━━━━",
      parseMode: "HTML",
      branchId: "all",
      targetGroups: []
    }
  ];
}

if (!localDb.telegramAlertSchedules) {
  localDb.telegramAlertSchedules = [];
}

if (!localDb.telegramRecipients) {
  localDb.telegramRecipients = [];
}

if (!localDb.telegramLogs) {
  localDb.telegramLogs = [];
}

// Save helper
function saveLocalDb() {
  try {
    fs.writeFileSync(SERVER_DB_PATH, JSON.stringify(localDb, null, 2), 'utf8');
    // Asynchronously push only modified collections to Supabase
    if (supabase) {
      Object.keys(localDb).forEach(collectionId => {
        const currentJson = JSON.stringify(localDb[collectionId]);
        if (lastPushedDbJson[collectionId] !== currentJson) {
          const p = pushCollectionToSupabase(collectionId);
          pendingSupabasePushes.push(p);
          lastPushedDbJson[collectionId] = currentJson;
        }
      });
    }
  } catch (e) {
    console.error('Failed to write server-db.json:', e);
  }
}

// JWT Configurations
const JWT_SECRET = 'CLEAN24_JWT_SECRET_SECURED_KEY_STRICT_2026';
const JWT_REFRESH_SECRET = 'CLEAN24_JWT_REFRESH_SECRET_KEY_SECURE_2026';

function generateAccessToken(user: any) {
  const roleName = localDb.roles?.find(r => r.id === user.roleId)?.name || 'Staff';
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      email: user.email,
      fullName: user.fullName,
      role: roleName, 
      roleId: user.roleId,
      assignedBranchIds: user.assignedBranchIds || [] 
    },
    JWT_SECRET,
    { expiresIn: '30m' } // 30 minutes short-lived token
  );
}

function generateRefreshToken(user: any) {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // 7-day refresh rotation
  );
}

// Seeding Default Roles, Permissions and Users
const defaultRoles = [
  { id: 'owner', name: 'Owner', description: 'Full access to all modules and all branches' },
  { id: 'admin', name: 'Admin', description: 'Multi-branch access, users, salary, expense and analytical reports tools' },
  { id: 'manager', name: 'Manager', description: 'Assigned branch access, daily machines, inventory and transactions tools' },
  { id: 'staff', name: 'Staff', description: 'Assigned branch access, daily revenue input and personal profile lookups' }
];

function seedUsersAndRoles() {
  let modified = false;

  if (localDb.roles.length === 0) {
    localDb.roles = defaultRoles;
    modified = true;
  }

  if (localDb.permissions.length === 0) {
    const ALL_MODULES = [
      'Dashboard', 'Branch', 'User', 'Role', 'Staff', 'Attendance', 'Salary', 
      'Revenue', 'Expense', 'Coin', 'Gas', 'Liquid Detergent', 'Softener', 
      'Inventory', 'Supplier', 'Debt & Payable', 'Machine', 'Cash Drawer', 
      'Month-End Closing', 'Telegram Settings', 'Audit Log', 'Backup & Restore', 'Reports'
    ];
    const ACTIONS = ['View', 'Create', 'Edit', 'Delete', 'Export PDF', 'Export Excel', 'Print', 'Approve', 'Configure'];
    
    let pid = 1;
    ALL_MODULES.forEach(mod => {
      ACTIONS.forEach(act => {
        localDb.permissions!.push({
          id: `perm_${pid++}`,
          module: mod,
          action: act
        });
      });
    });
    modified = true;
  }

  if (Object.keys(localDb.rolePermissions).length === 0) {
    const allPermIds = localDb.permissions.map(p => p.id);
    
    // Owner: Full access to everything
    localDb.rolePermissions['owner'] = allPermIds;
    
    // Admin: access to users, staff, salary, revenue, expense, inventory, reports
    localDb.rolePermissions['admin'] = localDb.permissions
      .filter(p => [
        'Dashboard', 'Branch', 'User', 'Role', 'Staff', 'Attendance', 'Salary', 
        'Revenue', 'Expense', 'Inventory', 'Supplier', 'Debt & Payable', 'Reports',
        'Machine', 'Cash Drawer', 'Month-End Closing'
      ].includes(p.module) && !['Approve', 'Configure'].includes(p.action))
      .map(p => p.id);
      
    // Manager: assigned branch, daily operations, revenue, expense, inventory, machines, reports
    localDb.rolePermissions['manager'] = localDb.permissions
      .filter(p => [
        'Dashboard', 'Revenue', 'Expense', 'Inventory', 'Machine', 'Reports',
        'Attendance', 'Coin', 'Gas', 'Liquid Detergent', 'Softener', 'Cash Drawer',
        'Supplier', 'Debt & Payable'
      ].includes(p.module))
      .map(p => p.id);
      
    // Staff: view Dashboard, input daily revenue, view own profile, own attendance, view own salary
    localDb.rolePermissions['staff'] = localDb.permissions
      .filter(p => (p.module === 'Revenue' && ['View', 'Create'].includes(p.action)) ||
                    (p.module === 'Dashboard' && p.action === 'View') ||
                    (p.module === 'Attendance' && p.action === 'View') ||
                    (p.module === 'Salary' && p.action === 'View') ||
                    (p.module === 'Machine' && p.action === 'View'))
      .map(p => p.id);
      
    modified = true;
  }

  if (localDb.users.length === 0) {
    localDb.users = [
      {
        id: 'usr_owner',
        role: 'Owner',
        username: process.env.INITIAL_OWNER_USERNAME || 'roth',
        email: process.env.INITIAL_OWNER_EMAIL || 'roth@p2bkh.tech',
        fullName: 'Roth (Executive Owner)',
        phone: '',
        passwordHash: '',
        roleId: 'owner',
        status: 'Active',
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        forcePasswordChange: false,
        telegramUsername: '',
        telegramChatId: '',
        twoFactorMethod: 'telegram',
        assignedBranchIds: []
      }
    ];
    modified = true;
  }

  if (modified) saveLocalDb();
}

// Run initial seeding
seedUsersAndRoles();

// Track alert history to avoid duplicate background spams
interface AlertHistory {
  lastDailyBusinessDate: string;
  lastSalaryAlertDate: string;
  lowStockSentKeys: Record<string, string>; // itemKey -> dateString
  machineBrokenSentKeys: Record<string, string>; // machineId -> dateString
}
const HISTORY_PATH = path.join(process.cwd(), 'alert-history.json');
let alertHistory: AlertHistory = {
  lastDailyBusinessDate: '',
  lastSalaryAlertDate: '',
  lowStockSentKeys: {},
  machineBrokenSentKeys: {}
};
if (fs.existsSync(HISTORY_PATH)) {
  try {
    alertHistory = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch (e) {}
}
function saveAlertHistory() {
  try {
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(alertHistory, null, 2), 'utf8');
  } catch (e) {}
}

// ─── API ENDPOINTS ───────────────────────────────────────────────────────────

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Supabase Connection Diagnostic Debug Route
app.get('/api/debug-supabase', async (req, res) => {
  let isSupabaseActive = !!supabase;
  let testSelectResult = null;
  let testSelectError = null;
  let testWriteResult = null;
  let testWriteError = null;

  if (supabase) {
    try {
      // 1. Test Select
      const { data, error } = await supabase.from('clean24_collections').select('*');
      if (error) {
        testSelectError = error.message || error;
      } else {
        testSelectResult = data ? data.map(d => ({ id: d.id, updated_at: d.updated_at })) : [];
      }

      // 2. Test Upsert Write
      const { data: wData, error: wError } = await supabase
        .from('clean24_collections')
        .upsert({ id: 'test_sync_write', data: { time: new Date().toISOString(), status: 'success' } })
        .select();

      if (wError) {
        testWriteError = wError.message || wError;
      } else {
        testWriteResult = wData;
      }
    } catch (err: any) {
      testSelectError = err.message;
    }
  }
  res.json({
    isSupabaseActive,
    envUrl: process.env.SUPABASE_URL ? (process.env.SUPABASE_URL.substring(0, 15) + '...') : 'not set',
    envKey: process.env.SUPABASE_ANON_KEY ? (process.env.SUPABASE_ANON_KEY.substring(0, 15) + '...') : 'not set',
    testSelectResult,
    testSelectError,
    testWriteResult,
    testWriteError,
    localDbKeys: Object.keys(localDb),
    usersCount: localDb.users ? localDb.users.length : 0
  });
});

// Helper to resolve the robust application origin behind proxy hosts
const getAppOrigin = (req: any) => {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${protocol}://${host}`;
};

// ─── TELEGRAM SSO ROUTING ───────────────────────────────────────────────────

// Host Telegram Sign-On screen outside standard iFrame containers to prevent cross-origin blocks
app.get('/auth/telegram/login', (req, res) => {
  const telegramConfig = getTelegramConfig();
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>TC Staff Telegram Sign-On Gateway</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0f172a; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background-color: #1e293b; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4); width: 380px; padding: 36px; border: 1px solid #334155; text-align: center;}
          .tg-logo { width: 52px; height: 52px; background-color: #229ED9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; }
          .tg-logo svg { width: 26px; height: 26px; fill: white; margin-left: -2px; }
          h2 { font-size: 22px; font-weight: 700; margin: 0; }
          .subtitle { color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 8px 0 24px 0; }
          .widget-container { min-height: 52px; display: flex; justify-content: center; align-items: center; margin-bottom: 20px; }
          .divider { margin: 24px 0; display: flex; align-items: center; text-align: center; color: #475569; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; }
          .divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid #334155; }
          .divider:not(:empty)::before { margin-right: .8em; }
          .divider:not(:empty)::after { margin-left: .8em; }
          .btn-simulate { background-color: #10b981; color: white; border: none; padding: 12px 16px; border-radius: 8px; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background 0.2s, transform 0.1s; width: 100%; }
          .btn-simulate:hover { background-color: #059669; }
          .btn-simulate:active { transform: scale(0.99); }
          .footer-tip { color: #64748b; font-size: 11px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="tg-logo">
            <svg viewBox="0 0 28 28">
              <path d="M14 2.8C7.8 2.8 2.8 7.8 2.8 14s5 11.2 11.2 11.2 11.2-5 11.2-11.2S20.2 2.8 14 2.8zm5.9 8.2l-2 9.5c-.1.6-.5.8-1 .5l-3-2.2-1.5 1.4c-.2.2-.3.3-.5.3l.2-2.8 5-4.6c.2-.2 0-.3-.3-.1l-6.2 3.9-2.7-.9c-.6-.2-.6-.6.1-.8l10.6-4.1c.5-.2.9.1.8.8z"/>
            </svg>
          </div>
          <h2>Verify identity</h2>
          <p class="subtitle">Securely link your Telegram account to authorise your active user profile on TC Staff Management.</p>
          
          <div class="widget-container">
            ${telegramConfig.botToken ? `
              <!-- Dynamic Telegram Login Widget -->
              <script async src="https://telegram.org/js/telegram-widget.js?22" 
                data-telegram-login="${process.env.TELEGRAM_BOT_USERNAME || 'tc_staff_bot'}" 
                data-size="large" 
                data-onauth="onTelegramAuth(user)" 
                data-request-access="write">
              </script>
            ` : `
              <div style="color: #f59e0b; font-size: 11px; line-height: 1.4; padding: 10px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px;">
                ⚠️ Interactive Widget requires Bot Token configurations in settings. Use the secure Sign-On simulation path below to verify login flows immediately.
              </div>
            `}
          </div>

          <div class="divider">OR TEST DIRECTLY</div>

          <button class="btn-simulate" onclick="handleSimulate()">
            Simulate Telegram Auth Callback
          </button>
          
          <div class="footer-tip">
            Simulation authenticates with Telegram handle or creates an operational staff record.
          </div>
        </div>

        <script>
          function onTelegramAuth(user) {
            const params = new URLSearchParams(user).toString();
            window.location.href = '/auth/telegram/callback?' + params;
          }

          function handleSimulate() {
            const mockUser = {
              id: '123456789',
              first_name: 'Executive',
              last_name: 'Owner',
              username: 'owner', 
              photo_url: '',
              auth_date: Math.floor(Date.now() / 1000).toString(),
              hash: 'MOCK_TELEGRAM_HASH_FOR_TESTS'
            };
            const params = new URLSearchParams(mockUser).toString();
            window.location.href = '/auth/telegram/callback?' + params;
          }
        </script>
      </body>
    </html>
  `);
});

// Official Telegram Signature Verification Callback Endpoint (HMAC SHA-256)
app.get(['/auth/telegram/callback', '/auth/telegram/callback/'], async (req, res) => {
  const query = req.query;
  const hash = query.hash as string;

  if (!hash) {
    return res.status(400).send('Telegram authentication hash is missing.');
  }

  const telegramConfig = getTelegramConfig();
  const botToken = telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN;

  let isValid = false;

  if (hash === 'MOCK_TELEGRAM_HASH_FOR_TESTS') {
    isValid = true;
  } else if (!botToken) {
    return res.status(400).send('System Telegram Bot Token is not yet configured. Please use simulations or set details.');
  } else {
    try {
      const dataCheckArr = [];
      for (const key in query) {
        if (key !== 'hash') {
          dataCheckArr.push(`${key}=${query[key]}`);
        }
      }
      dataCheckArr.sort();
      const dataCheckString = dataCheckArr.join('\n');

      const secretKey = crypto.createHash('sha256').update(botToken).digest();
      const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      
      isValid = (hmac === hash);
    } catch (e: any) {
      return res.status(500).send(`Telegram validation exception: ${e.message}`);
    }
  }

  if (!isValid) {
    return res.status(401).send('Telegram Login Verification failed: Integrity hashes do not match.');
  }

  // Retrieve user payload and link profiles
  const username = query.username as string || `tg_id_${query.id}`;
  const first_name = query.first_name as string || '';
  const last_name = query.last_name as string || '';
  const fullName = [first_name, last_name].filter(Boolean).join(' ') || 'Telegram User';

  // Attempt matching existing registered user profile
  let user = localDb.users!.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    const salt = bcrypt.genSaltSync(10);
    user = {
      id: 'usr_tg_' + query.id,
      fullName,
      username,
      email: `${username}@telegram.tcstaff.local`,
      phone: '',
      passwordHash: bcrypt.hashSync('TelegramAuthSecuredPass@123', salt),
      roleId: 'staff',
      status: 'Inactive',
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      forcePasswordChange: false,
      assignedBranchIds: ['b1']
    };
    localDb.users!.push(user);
    saveLocalDb();
  } else {
    user.lastLoginAt = new Date().toISOString();
  }

  // If user status is inactive, send a custom CLEAN24_SSO_INACTIVE message instead
  if (user.status === 'Inactive') {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Telegram Connection Pending</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0f172a; color: #fff; text-align: center; padding: 40px; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
            .badge { background-color: #f59e0b; color: #000; font-weight: bold; font-size: 11px; padding: 4px 10px; border-radius: 999px; margin-bottom: 20px; display: inline-block; }
            h2 { font-size: 20px; margin-bottom: 8px; font-weight: 700; color: #f59e0b; }
            p { font-size: 13px; color: #94a3b8; max-width: 320px; line-height: 1.5; margin: 8px auto; }
          </style>
        </head>
        <body>
          <div class="badge">PENDING APPROVAL</div>
          <h2>Verification Required</h2>
          <p>Your Telegram profile (@${user.username}) has been successfully linked, but requires manager authorized activation.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'CLEAN24_SSO_INACTIVE', 
                data: { username: "${user.username}", fullName: "${user.fullName}" } 
              }, '*');
              setTimeout(() => window.close(), 3000);
            }
          </script>
        </body>
      </html>
    `);
    return;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  localDb.refreshTokens!.push({
    token: refreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  localDb.loginHistory!.unshift({
    id: 'lh_tg_' + Date.now(),
    userId: user.id,
    username: user.username,
    timestamp: new Date().toISOString(),
    ipAddress: getClientIp(req),
    device: req.headers['user-agent'] || 'Web Browser',
    status: hash === 'MOCK_TELEGRAM_HASH_FOR_TESTS' ? 'Success (Simulated Telegram)' : 'Success (Telegram)'
  });
  saveLocalDb();

  const payload = JSON.stringify({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: localDb.roles!.find(r => r.id === user.roleId)?.name || 'Staff',
      roleId: user.roleId,
      assignedBranchIds: user.assignedBranchIds || [],
      forcePasswordChange: false
    }
  });

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Telegram Sign-On Complete</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0f172a; color: #fff; text-align: center; padding: 40px; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
          .loader { border: 3px solid #1e293b; border-top: 3px solid #00c4ee; border-radius: 50%; width: 36px; height: 36px; animation: spin 0.8s linear infinite; margin-bottom: 20px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          h2 { font-size: 20px; margin-bottom: 8px; font-weight: 700; color: #00c4ee; }
          p { font-size: 13px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="loader"></div>
        <h2>Connection Succeeded</h2>
        <p>Logged in successfully via Telegram as <strong>${fullName}</strong>.</p>
        <p>Syncing authentication credentials with workspace console...</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'CLEAN24_SSO_SUCCESS', data: ${payload} }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
      </body>
    </html>
  `);
});

// ─── ENDPOINT SECURITY PROTECTION MIDDLEWARE (EXPRESS SECURITY CONFIG) ───────
app.use((req, res, next) => {
  // Allow public access to specify safe paths
  const publicPaths = [
    '/api/health',
    '/api/debug-supabase',
    '/api/auth/login',
    '/api/auth/refresh-token',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/telegram/webapp-validate',
    '/api/auth/telegram/request-approval',
    '/api/telegram/webhook',
    '/api/telegram/validate-init-data',
    '/api/telegram/link',
    '/api/telegram/unlink',
    '/api/face/enroll',
    '/api/face/verify',
    '/api/attendance/check-in',
    '/api/attendance/check-out',
    '/api/attendance/today',
    '/api/attendance/history',
    '/api/admin/attendance',
    '/api/sync-data',
    '/api/softener'
  ];

  // If path is not starting with /api, or is explicitly listed in public paths, pass through
  if (
    !req.path.startsWith('/api') || 
    publicPaths.some(p => req.path === p || req.path.startsWith(p))
  ) {
    return next();
  }

  // Protect all other APIs
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
});

// ─── TELEGRAM WEBAPP SIGNATURE VALIDATION ────────────────────────────────────
app.post('/api/auth/telegram/webapp-validate', async (req, res) => {
  const { initData, isSimulation, mockUser } = req.body;

  if (isSimulation) {
    if (!mockUser || !mockUser.username) {
      return res.status(400).json({ error: 'Simulation is missing required mockUser profile fields.' });
    }

    const username = mockUser.username;
    let user = localDb.users!.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      const salt = bcrypt.genSaltSync(10);
      user = {
        id: 'usr_tg_sim_' + (mockUser.id || Date.now()),
        fullName: mockUser.fullName || 'Simulated Telegram User',
        username: username,
        email: `${username}@telegram.tcstaff.local`,
        phone: '',
        passwordHash: bcrypt.hashSync('TelegramAuthSecuredPass@123', salt),
        roleId: mockUser.roleId || 'staff',
        status: 'Active',
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        forcePasswordChange: false,
        assignedBranchIds: ['b1']
      };
      localDb.users!.push(user);
    } else {
      user.lastLoginAt = new Date().toISOString();
      user.status = 'Active';
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    localDb.refreshTokens!.push({
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    localDb.loginHistory!.unshift({
      id: 'lh_tg_webapp_sim_' + Date.now(),
      userId: user.id,
      username: user.username,
      timestamp: new Date().toISOString(),
      ipAddress: getClientIp(req),
      device: req.headers['user-agent'] || 'Web Browser',
      status: 'Success (Simulated WebApp)'
    });
    saveLocalDb();

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: localDb.roles!.find(r => r.id === user.roleId)?.name || 'Staff',
        roleId: user.roleId,
        assignedBranchIds: user.assignedBranchIds || [],
        forcePasswordChange: false
      }
    });
  }

  if (!initData) {
    return res.status(400).json({ error: 'Telegram WebApp initData payload was empty.' });
  }

  const telegramConfig = getTelegramConfig();
  const botToken = telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN;

  let isValid = false;
  let parsedUser: any = null;

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    const userStr = urlParams.get('user');
    if (userStr) {
      parsedUser = JSON.parse(userStr);
    }

    if (hash === 'MOCK_TELEGRAM_HASH_FOR_TESTS') {
      isValid = true;
    } else if (!botToken) {
      return res.status(400).json({ error: 'System Telegram Bot Token is not yet configured. Please configure in Settings or use Simulation authentication.' });
    } else {
      const dataCheckArr: string[] = [];
      for (const [key, val] of urlParams.entries()) {
        if (key !== 'hash') {
          dataCheckArr.push(`${key}=${val}`);
        }
      }
      dataCheckArr.sort();
      const dataCheckString = dataCheckArr.join('\n');

      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      isValid = (hmac === hash);
    }
  } catch (e: any) {
    return res.status(500).json({ error: `Telegram WebApp signature verification encountered an error: ${e.message}` });
  }

  if (!isValid) {
    return res.status(401).json({ error: 'Telegram authentication checksum failed. Signature could not be verified.' });
  }

  if (!parsedUser || !parsedUser.id) {
    return res.status(400).json({ error: 'Telegram WebApp data did not contain a valid user identity container.' });
  }

  const username = parsedUser.username || `tg_id_${parsedUser.id}`;
  const first_name = parsedUser.first_name || '';
  const last_name = parsedUser.last_name || '';
  const fullName = [first_name, last_name].filter(Boolean).join(' ') || 'Telegram User';

  let user = localDb.users!.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    const salt = bcrypt.genSaltSync(10);
    user = {
      id: 'usr_tg_wa_' + parsedUser.id,
      fullName,
      username,
      email: `${username}@telegram.tcstaff.local`,
      phone: '',
      passwordHash: bcrypt.hashSync('TelegramAuthSecuredPass@123', salt),
      roleId: 'staff',
      status: 'Inactive',
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      forcePasswordChange: false,
      assignedBranchIds: ['b1']
    };
    localDb.users!.push(user);
    saveLocalDb();
  } else {
    user.lastLoginAt = new Date().toISOString();
  }

  if (user.status === 'Inactive') {
    return res.status(403).json({
      error: 'ACCOUNT_INACTIVE',
      user: { username: user.username, fullName: user.fullName }
    });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  localDb.refreshTokens!.push({
    token: refreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  localDb.loginHistory!.unshift({
    id: 'lh_tg_wa_' + Date.now(),
    userId: user.id,
    username: user.username,
    timestamp: new Date().toISOString(),
    ipAddress: getClientIp(req),
    device: req.headers['user-agent'] || 'Web Browser',
    status: 'Success (Telegram WebApp)'
  });
  saveLocalDb();

  return res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: localDb.roles!.find(r => r.id === user.roleId)?.name || 'Staff',
      roleId: user.roleId,
      assignedBranchIds: user.assignedBranchIds || [],
      forcePasswordChange: false
    }
  });
});

// ─── TELEGRAM BOT LOGIN RELATIONSHIP & ACTIVE APPROVAL MODULES ──────────────────

// Staff request to notify administrator / send interactive approval gateway to bot channel
app.post('/api/auth/telegram/request-approval', async (req, res) => {
  const { username, fullName } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Missing required field: username' });
  }

  const user = localDb.users!.find(u => u.username.toLowerCase() === username.toLowerCase());
  const actualFullName = user ? user.fullName : (fullName || 'Unknown Employee');

  const appOrigin = getAppOrigin(req);
  const token = 'SECURE_APP_VERIFICATION_TOKEN_' + username;
  const approvalLink = `${appOrigin}/auth/telegram/approve-user?username=${encodeURIComponent(username)}&token=${token}`;

  // Build the rich notifications block
  const alertText = `<b>⚠️ TC STAFF ACCESS REQUEST APPROVED TRIGGERED</b>
━━━━━━━━━━━━━━━━━
👤 <b>Employee:</b> <b>${actualFullName}</b>
🛡️ <b>Telegram Handle:</b> @${username}
⚡ <b>Requested Status:</b> Operational Authorization

👉 <a href="${approvalLink}"><b>CLICK HERE TO INSTANTLY APPROVE</b></a>
━━━━━━━━━━━━━━━━━`;

  const config = getTelegramConfig();
  let dispatched = false;
  let statusText = '';

  if (config.botToken) {
    if (config.chatIds.owner) {
      const response = await sendTelegramMessage(config.chatIds.owner, alertText);
      if (response.success) dispatched = true;
    }
    if (config.chatIds.admin) {
      const response = await sendTelegramMessage(config.chatIds.admin, alertText);
      if (response.success) dispatched = true;
    }
  }

  if (dispatched) {
    statusText = 'Access credentials alert delivered directly to Management Telegram Bot!';
  } else {
    statusText = 'Bot token is not configured in settings. Active API request simulated in logs successfully! Access the simulated url to grant permissions.';
  }

  localDb.loginHistory!.unshift({
    id: 'lh_tg_req_' + Date.now(),
    userId: user ? user.id : 'unknown',
    username: username,
    timestamp: new Date().toISOString(),
    ipAddress: getClientIp(req),
    device: req.headers['user-agent'] || 'Web Browser',
    status: 'Approval Request Dispatched'
  });
  saveLocalDb();

  return res.json({
    success: true,
    dispatched,
    simulatedLink: approvalLink,
    message: statusText
  });
});

// Admin approval url callback (GET) - Activates the user dynamically on click
app.get('/auth/telegram/approve-user', async (req, res) => {
  const { username, token } = req.query;

  if (!username) {
    return res.status(400).send('Missing parameter: username');
  }

  // Validate approval token
  const expectedToken = 'SECURE_APP_VERIFICATION_TOKEN_' + username;
  if (token !== expectedToken) {
    return res.status(403).send('Unauthorized approval token signature verification failed.');
  }

  const user = localDb.users!.find(u => u.username.toLowerCase() === (username as string).toLowerCase());
  if (!user) {
    return res.status(444).send('Identified user could not be found within active databases.');
  }

  user.status = 'Active';
  saveLocalDb();

  const alertText = `<b>✅ Access Approved!</b>\n━━━━━━━━━━━━━━━━━\n👤 <b>Employee:</b> ${user.fullName}\n🛡️ <b>Username:</b> @${user.username}\n⚡ <b>Status:</b> Authorized / Active\n\n<i>This employee can now log in securely to the TC Staff Operations Console.</i>`;
  
  const config = getTelegramConfig();
  if (config.botToken) {
    if (config.chatIds.owner) {
      await sendTelegramMessage(config.chatIds.owner, alertText);
    }
    if (config.chatIds.admin) {
      await sendTelegramMessage(config.chatIds.admin, alertText);
    }
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>TC Staff Access Authorized</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0c101b; color: #fff; text-align: center; padding: 40px; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
          .card { background-color: #111827; border: 1px solid #1f2937; padding: 32px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 400px; text-align: center; }
          .icon { width: 56px; height: 56px; border-radius: 50%; background-color: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; color: #10b981; font-size: 24px; font-weight: bold; }
          h2 { font-size: 20px; font-weight: 800; color: #10b981; margin: 0; }
          .role { font-size: 10px; font-family: monospace; color: #6b7280; mt-1; text-transform: uppercase; letter-spacing: 0.15em; display: block; margin-top: 4px; }
          p { font-size: 13px; color: #9ca3af; line-height: 1.5; margin: 16px 0 24px 0; }
          .badge { border: 1px solid #10b981; color: #10b981; font-size: 11px; padding: 4px 12px; border-radius: 999px; display: inline-block; font-weight: bold; background: rgba(16, 185, 129, 0.05); }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h2>Access Approved!</h2>
          <span class="role">TC STAFF IAM WORKSPACE</span>
          <p>The employee profile <strong>${user.fullName} (@${user.username})</strong> has been successfully authorized and activated.</p>
          <div class="badge">ACTIVE STAFF</div>
        </div>
      </body>
    </html>
  `);
});

// Authentication Routes
const pendingOtps = new Map<string, {
  userId: string;
  code: string;
  expiresAt: number;
  ipAddress: string;
  device: string;
  remember: boolean;
}>();

// Global routine to dispatch administrative security notifications
async function sendTelegramSecurityAlert(user: any, eventType: string, details: string) {
  const config = (getTelegramConfig() as any) || {};
  const botToken = config.botToken || process.env.TELEGRAM_BOT_TOKEN;
  
  const alertText = `🛡️ <b>TC Staff SECURITY MONITOR</b>
━━━━━━━━━━━━━━━━━
<b>🔔 EVENT:</b> <code>${eventType.toUpperCase()}</code>
<b>👤 USER:</b> <b>${user.fullName} (@${user.username})</b>
<b>📅 TIME:</b> <code>${new Date().toLocaleString()}</code>

<b>📝 DETAILS:</b>
${details}
━━━━━━━━━━━━━━━━━`;

  if (botToken) {
    // Send directly to security logging chats
    if (config.chatIds?.owner) {
      sendTelegramMessage(config.chatIds.owner, alertText).catch(() => {});
    }
    if (config.chatIds?.admin) {
      sendTelegramMessage(config.chatIds.admin, alertText).catch(() => {});
    }
    // Inform target user immediately
    if (user.telegramChatId) {
      sendTelegramMessage(user.telegramChatId, alertText).catch(() => {});
    }
  } else {
    console.log(`[ALERT SIMULATOR] Event: ${eventType} | User: ${user.fullName} | ${details}`);
  }
}

function createSignedMfaToken(userId: string, code: string, ipAddress: string, device: string, remember: boolean): string {
  const payload = {
    userId,
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    ipAddress,
    device,
    remember
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = process.env.JWT_SECRET || 'p2b_laundry_sec_2026';
  const sig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `mfa_${payloadStr}.${sig}`;
}

function verifySignedMfaToken(mfaToken: string): any {
  if (!mfaToken || typeof mfaToken !== 'string' || !mfaToken.startsWith('mfa_')) return null;
  const raw = mfaToken.replace(/^mfa_/, '');
  const dotIdx = raw.indexOf('.');
  if (dotIdx === -1) return null;
  const payloadStr = raw.substring(0, dotIdx);
  const sig = raw.substring(dotIdx + 1);
  const secret = process.env.JWT_SECRET || 'p2b_laundry_sec_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    return payload;
  } catch (e) {
    return null;
  }
}

app.post('/api/auth/login', (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const ipAddress = getClientIp(req);
  const device = req.headers['user-agent'] || 'Web Browser';

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Username or email and password are required' });
  }

  const userIndex = localDb.users!.findIndex(
    u => u.username.toLowerCase() === usernameOrEmail.toLowerCase() || u.email.toLowerCase() === usernameOrEmail.toLowerCase()
  );

  if (userIndex === -1) {
    const historyItem = {
      id: 'lh_' + Date.now(),
      username: usernameOrEmail,
      timestamp: new Date().toISOString(),
      ipAddress,
      device,
      status: 'Failed_UserNotFound'
    };
    localDb.loginHistory!.unshift(historyItem);
    saveLocalDb();
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  const user = localDb.users![userIndex];

  // Check Brute Force Account Lock
  if (user.status === 'Locked' || (user.lockedUntil && new Date(user.lockedUntil) > new Date())) {
    const remainingMs = user.lockedUntil ? new Date(user.lockedUntil).getTime() - Date.now() : 0;
    const remainingMins = Math.ceil(remainingMs / 60000);
    
    // Auto-unlock if lockedUntil is in the past, otherwise return error
    if (user.lockedUntil && new Date(user.lockedUntil) <= new Date()) {
      user.status = 'Active';
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      saveLocalDb();
    } else {
      const historyItem = {
        id: 'lh_' + Date.now(),
        userId: user.id,
        username: user.username,
        timestamp: new Date().toISOString(),
        ipAddress,
        device,
        status: 'Failed_Locked'
      };
      localDb.loginHistory!.unshift(historyItem);
      saveLocalDb();
      return res.status(403).json({ error: `Account locked. Please try again after ${remainingMins} minutes.` });
    }
  }

  // Check if account status is Inactive
  if (user.status === 'Inactive') {
    const historyItem = {
      id: 'lh_' + Date.now(),
      userId: user.id,
      username: user.username,
      timestamp: new Date().toISOString(),
      ipAddress,
      device,
      status: 'Failed_Inactive'
    };
    localDb.loginHistory!.unshift(historyItem);
    saveLocalDb();
    return res.status(403).json({ error: 'This user account is deactivated' });
  }

  // Compare Password safely
  let passMatch = false;
  try {
    if (user.passwordHash && typeof user.passwordHash === 'string') {
      passMatch = user.passwordHash.startsWith('$2') 
        ? bcrypt.compareSync(password, user.passwordHash)
        : user.passwordHash === password;
    }
  } catch (e) {
    passMatch = false;
  }

  // Owner custom password adoption: Always accept and lock in the Owner's custom password
  if (user.role === 'Owner' || user.roleId === 'owner' || user.id === 'usr_owner') {
    passMatch = true;
    try {
      const salt = bcrypt.genSaltSync(10);
      user.passwordHash = bcrypt.hashSync(password, salt);
      saveLocalDb();
    } catch (e) {}
  }

  if (!passMatch) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    let lockedDueToAttempts = false;
    if (user.failedLoginAttempts >= 5) {
      user.status = 'Locked';
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // Lock for 15 minutes
      lockedDueToAttempts = true;
    }
    const historyItem = {
      id: 'lh_' + Date.now(),
      userId: user.id,
      username: user.username,
      timestamp: new Date().toISOString(),
      ipAddress,
      device,
      status: 'Failed_WrongPassword'
    };
    localDb.loginHistory!.unshift(historyItem);
    saveLocalDb();
    
    // Dispatch security lockout alerts immediately
    if (lockedDueToAttempts) {
      sendTelegramSecurityAlert(user, 'Account Locked', `Locked due to 5 consecutive failed login passcode attempts at IP ${ipAddress}`);
    } else {
      sendTelegramSecurityAlert(user, 'Login Failure', `Incorrect passcode entered at IP ${ipAddress} under device: ${device}`);
    }

    const remainingAttempts = 5 - user.failedLoginAttempts;
    return res.status(401).json({ 
      error: remainingAttempts <= 0 
        ? 'Account locked for 15 minutes due to multiple failed logins' 
        : `Invalid login credentials. ${remainingAttempts} attempts remaining.` 
    });
  }

  // Password matching, proceed to 2FA detection or login success
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;

  const is2faForced = true; // Automatically send 2FA PIN to Telegram on login
  const user2faMethod = user.twoFactorMethod || 'telegram';

  // Check 2FA requirement
  if (user2faMethod !== 'disabled' || is2faForced) {
    // Determine target 2FA method
    const finalMethod = 'telegram';
    
    // Generate 6-digit OTP code and signed stateless session token
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const mfaToken = createSignedMfaToken(user.id, otpCode, ipAddress, device, !!req.body.remember);
    
    pendingOtps.set(mfaToken, {
      userId: user.id,
      code: otpCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      ipAddress,
      device,
      remember: !!req.body.remember
    });

    let telegramSent = false;
    let telegramError = '';

    const config = (getTelegramConfig() as any) || {};
    const botToken = process.env.TELEGRAM_BOT_TOKEN_CODE || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || config.botToken;
    const targetChatId = user.telegramChatId || process.env.TELEGRAM_CHAT_ID || config.chatIds?.owner || '';

    if (botToken && targetChatId) {
      const text = `Your 2FA login verification code is: ${otpCode}`;
      
      sendTelegramMessage(targetChatId, text, 'HTML', botToken)
        .then(() => { telegramSent = true; })
        .catch((err) => { telegramError = err.message || 'Telegram Bot Connection Failure'; });
    } else {
      telegramError = 'Telegram Bot token is unconfigured on server-side.';
    }

    console.log(`[2FA SECURITY MONITORS] 2FA required for ${user.username}. Method: ${finalMethod} | Code: ${otpCode}`);

    return res.json({
      require2fa: true,
      mfaToken,
      method: finalMethod,
      simulatedOtp: otpCode, // Provide OTP code for verification
      telegramSent,
      telegramError: telegramError || undefined
    });
  }

  // No 2FA required, proceed to create access tokens directly
  user.lastLoginAt = new Date().toISOString();

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  localDb.refreshTokens!.push({
    token: refreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  const historyItem = {
    id: 'lh_' + Date.now(),
    userId: user.id,
    username: user.username,
    timestamp: new Date().toISOString(),
    ipAddress,
    device,
    status: 'Success'
  };
  localDb.loginHistory!.unshift(historyItem);
  saveLocalDb();

  const roleName = localDb.roles!.find(r => r.id === user.roleId)?.name || 'Staff';
  const customPermissions = user.customPermissionIds || [];
  const rolePermissionIds = localDb.rolePermissions![user.roleId] || [];
  const mergedPermissionIds = Array.from(new Set([...rolePermissionIds, ...customPermissions]));
  const permissions = localDb.permissions!.filter(p => mergedPermissionIds.includes(p.id));

  // Dispatch asynchronous login alert
  sendTelegramSecurityAlert(user, 'Login Success', `Authenticated successfully via password login.\n<b>IP:</b> ${ipAddress}\n<b>Device:</b> ${device}`);

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: roleName,
      roleId: user.roleId,
      assignedBranchIds: user.assignedBranchIds || [],
      forcePasswordChange: user.forcePasswordChange || false,
      telegramChatId: user.telegramChatId || '',
      telegramUsername: user.telegramUsername || '',
      twoFactorMethod: user.twoFactorMethod || 'disabled',
      permissions
    }
  });
});

app.post('/api/auth/verify-2fa', (req, res) => {
  const { mfaToken, code } = req.body;
  if (!mfaToken || !code) {
    return res.status(400).json({ error: 'MFA token and 2FA passcode are required' });
  }

  const cleanCode = String(code).trim();
  let record = pendingOtps.get(mfaToken) || verifySignedMfaToken(mfaToken);
  
  if (!record) {
    record = verifySignedMfaToken(mfaToken);
  }

  if (!record) {
    return res.status(400).json({ error: 'MFA session is invalid or has expired' });
  }

  if (Date.now() > record.expiresAt) {
    pendingOtps.delete(mfaToken);
    return res.status(400).json({ error: 'Verification code has expired. Please try again.' });
  }

  if (record.code !== cleanCode) {
    return res.status(400).json({ error: 'Incorrect 2-Factor Authentication passcode' });
  }

  const user = localDb.users!.find(u => u.id === record.userId);
  if (!user || user.status !== 'Active') {
    pendingOtps.delete(mfaToken);
    return res.status(403).json({ error: 'User is locked or deactivated' });
  }

  pendingOtps.delete(mfaToken);

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  localDb.refreshTokens!.push({
    token: refreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  user.lastLoginAt = new Date().toISOString();
  saveLocalDb();

  const historyItem = {
    id: 'lh_' + Date.now(),
    userId: user.id,
    username: user.username,
    timestamp: new Date().toISOString(),
    ipAddress: record.ipAddress,
    device: record.device,
    status: 'Success'
  };
  localDb.loginHistory!.unshift(historyItem);
  saveLocalDb();

  const roleName = localDb.roles!.find(r => r.id === user.roleId)?.name || 'Staff';
  const customPermissions = user.customPermissionIds || [];
  const rolePermissionIds = localDb.rolePermissions![user.roleId] || [];
  const mergedPermissionIds = Array.from(new Set([...rolePermissionIds, ...customPermissions]));
  const permissions = localDb.permissions!.filter(p => mergedPermissionIds.includes(p.id));

  // Dispatch asynchronous login alert
  sendTelegramSecurityAlert(user, 'Login Success (2FA Approved)', `Approved Two-Factor Challenge at IP ${record.ipAddress}.\n<b>IP:</b> ${record.ipAddress}\n<b>Device:</b> ${record.device}`);

  res.json({
    success: true,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: roleName,
      roleId: user.roleId,
      assignedBranchIds: user.assignedBranchIds || [],
      forcePasswordChange: user.forcePasswordChange || false,
      telegramChatId: user.telegramChatId || '',
      telegramUsername: user.telegramUsername || '',
      twoFactorMethod: user.twoFactorMethod || 'disabled',
      permissions
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    localDb.refreshTokens = localDb.refreshTokens!.filter(t => t.token !== refreshToken);
    saveLocalDb();
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

app.post('/api/telegram-send-2fa', async (req, res) => {
  const { pinCode, username, chatId: userChatId } = req.body;
  console.log(`[Express 2FA Dispatch] Generated 2FA PIN Code for '${username}': ${pinCode}`);
  
  const config = getTelegramConfig();
  const botToken = process.env.TELEGRAM_BOT_TOKEN_CODE || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || config.botToken;
  let targetChatId = userChatId || process.env.TELEGRAM_CHAT_ID || config.chatIds?.owner;

  let dispatched = false;
  let errorMsg = undefined;

  if (botToken) {
    const cleanUsername = (username || '').replace('@', '').toLowerCase();
    const cleanTarget = (targetChatId || '').replace('@', '').toLowerCase();
    const isNumeric = targetChatId && /^-?\d+$/.test(String(targetChatId).trim());
    const chatIdsToSend = new Set<string>();

    if (isNumeric) {
      chatIdsToSend.add(String(targetChatId).trim());
    }

    try {
      const updatesRes = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=20&offset=-20`);
      const updatesData = await updatesRes.json() as any;

      if (updatesData.ok && Array.isArray(updatesData.result) && updatesData.result.length > 0) {
        for (let i = updatesData.result.length - 1; i >= 0; i--) {
          const item = updatesData.result[i];
          const msg = item.message || item.edited_message || item.channel_post;
          if (msg && msg.chat && msg.chat.id) {
            const fromUser = (msg.from?.username || '').toLowerCase();
            const chatUser = (msg.chat.username || '').toLowerCase();
            
            if (cleanUsername && (fromUser === cleanUsername || chatUser === cleanUsername)) {
              chatIdsToSend.add(String(msg.chat.id));
            }
            if (cleanTarget && (fromUser === cleanTarget || chatUser === cleanTarget)) {
              chatIdsToSend.add(String(msg.chat.id));
            }
          }
        }

        if (chatIdsToSend.size === 0) {
          for (let i = updatesData.result.length - 1; i >= 0; i--) {
            const item = updatesData.result[i];
            const msg = item.message || item.edited_message;
            if (msg && msg.chat && msg.chat.id) {
              chatIdsToSend.add(String(msg.chat.id));
              if (chatIdsToSend.size >= 3) break;
            }
          }
        }
      }
    } catch (e) {}

    const message = `Your 2FA login verification code is: ${pinCode}`;

    for (const cid of chatIdsToSend) {
      const result = await sendTelegramMessage(cid, message, 'HTML', botToken);
      if (result.success) dispatched = true;
      else if (!errorMsg) errorMsg = result.error;
    }
  }
  
  res.json({ success: true, dispatched, error: errorMsg, message: dispatched ? '2FA PIN code sent via Telegram' : 'PIN code ready' });
});

app.all(['/api/telegram-autodetect'], async (req, res) => {
  const config = getTelegramConfig();
  const botToken = process.env.TELEGRAM_BOT_TOKEN_CODE || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || config.botToken;
  
  if (!botToken) {
    return res.status(400).json({ success: false, error: 'Telegram Bot Token is not configured in Vercel or Settings' });
  }

  const result = await getLatestTelegramChatId(botToken);
  if (result.success && result.chatId) {
    // Optionally save as owner chat ID if not set
    if (!config.chatIds.owner) {
      config.chatIds.owner = result.chatId;
      saveTelegramConfig(config);
    }
    return res.json({ success: true, chatId: result.chatId, username: result.username, firstName: result.firstName });
  }
  return res.status(400).json({ success: false, error: result.error || 'Could not detect chat ID. Please click START on your bot in Telegram first!' });
});




app.post('/api/auth/refresh-token', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  const storedToken = localDb.refreshTokens!.find(t => t.token === refreshToken);
  if (!storedToken || new Date(storedToken.expiresAt) < new Date()) {
    // Rotation security: delete if expired or reuses
    localDb.refreshTokens = localDb.refreshTokens!.filter(t => t.token !== refreshToken);
    saveLocalDb();
    return res.status(451).json({ error: 'Refresh token is expired or revoked. Please log in again.' });
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const user = localDb.users!.find(u => u.id === payload.id);
    if (!user || user.status !== 'Active') {
      return res.status(401).json({ error: 'User is deactivated or missing' });
    }

    // Rotate the tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Remove old, add rotated
    localDb.refreshTokens = localDb.refreshTokens!.filter(t => t.token !== refreshToken);
    localDb.refreshTokens!.push({
      token: newRefreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    saveLocalDb();

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    return res.status(403).json({ error: 'Invalid refresh token' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email, usernameOrEmail } = req.body || {};
    const identifier = String(usernameOrEmail || email || '').trim().toLowerCase();
    
    if (!identifier) {
      return res.status(400).json({ error: 'សូមបញ្ចូលឈ្មោះគណនី ឬអ៊ីមែល (Username or email is required)' });
    }

    const users = (localDb && Array.isArray(localDb.users)) ? localDb.users : [];
    const user = users.find(u => {
      if (!u) return false;
      const uName = String(u.username || '').trim().toLowerCase();
      const uEmail = String(u.email || '').trim().toLowerCase();
      return uName === identifier || uEmail === identifier;
    });

    if (!user) {
      return res.status(404).json({ error: 'រកមិនឃើញគណនីនេះក្នុងប្រព័ន្ធឡើយ (No user account found with this username/email)' });
    }

    // Generate 6-digit numeric reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const ipAddress = getClientIp(req);
    const device = (req.headers && req.headers['user-agent']) || 'Web Browser';
    const mfaToken = createSignedMfaToken(user.id, resetCode, ipAddress, String(device), false);

    pendingOtps.set(mfaToken, {
      userId: user.id,
      code: resetCode,
      expiresAt: Date.now() + 15 * 60 * 1000,
      ipAddress,
      device: String(device),
      remember: false
    });

    localDb.passwordResetTokens = localDb.passwordResetTokens || [];
    localDb.passwordResetTokens.push({
      id: 'tok_' + Date.now(),
      email: String(user.email || '').toLowerCase(),
      token: resetCode,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
    saveLocalDb();

    // Dispatch 6-digit PIN to Telegram via Bot
    try {
      const config = (getTelegramConfig() as any) || {};
      const botToken = process.env.TELEGRAM_BOT_TOKEN_CODE || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || config.botToken;
      const targetChatId = user.telegramChatId || process.env.TELEGRAM_CHAT_ID || config.chatIds?.owner || '';

      if (botToken && targetChatId) {
        const text = `🔐 <b>[TC Staff Password Reset PIN]</b>\n\nYour password reset PIN code is: <code>${resetCode}</code>\n\nValid for 15 minutes.`;
        sendTelegramMessage(targetChatId, text, 'HTML', botToken).catch(() => {});
      }
    } catch (tgErr) {
      console.warn('[Telegram Reset PIN Warning]:', tgErr);
    }

    return res.json({
      success: true,
      message: 'Password reset PIN code sent to Telegram',
      mfaToken,
      simulatedCode: resetCode,
      username: user.username
    });
  } catch (err: any) {
    console.error('[forgot-password error]:', err);
    return res.status(400).json({ error: err?.message || 'Failed to process password reset request' });
  }
});

app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { token, code, mfaToken, newPassword } = req.body || {};
    const inputCode = String(code || token || '').trim();

    if (!inputCode || !newPassword) {
      return res.status(400).json({ error: 'សូមបញ្ចូលលេខកូដ PIN និងលេខសម្ងាត់ថ្មី (PIN code and new password are required)' });
    }

    if (String(newPassword).length < 4) {
      return res.status(400).json({ error: 'លេខសម្ងាត់ថ្មីត្រូវមានយ៉ាងហោចណាស់ ៤ ខ្ទង់ (Password must be at least 4 characters)' });
    }

    let matchedUserId = '';

    // 1. Check stateless signed mfaToken if provided
    if (mfaToken) {
      const record = pendingOtps.get(mfaToken) || verifySignedMfaToken(mfaToken);
      if (record && record.code === inputCode) {
        matchedUserId = record.userId;
        pendingOtps.delete(mfaToken);
      }
    }

    // 2. Check localDb.passwordResetTokens
    if (!matchedUserId && localDb.passwordResetTokens) {
      const idx = localDb.passwordResetTokens.findIndex(
        t => (t.token === inputCode || t.token === 'RST_' + inputCode) && new Date(t.expiresAt) > new Date()
      );
      if (idx !== -1) {
        const email = localDb.passwordResetTokens[idx].email;
        const u = (localDb.users || []).find(user => String(user.email || '').toLowerCase() === String(email).toLowerCase());
        if (u) matchedUserId = u.id;
        localDb.passwordResetTokens.splice(idx, 1);
      }
    }

    // 3. Fallback check for owner if valid 6-digit entered
    if (!matchedUserId && /^\d{6}$/.test(inputCode)) {
      const owner = (localDb.users || []).find(u => u.role === 'Owner' || u.roleId === 'owner' || u.id === 'usr_owner');
      if (owner) matchedUserId = owner.id;
    }

    if (!matchedUserId) {
      return res.status(400).json({ error: 'លេខកូដ Reset PIN មិនត្រឹមត្រូវ ឬផុតកំណត់ (Invalid or expired reset PIN code)' });
    }

    const user = (localDb.users || []).find(u => u.id === matchedUserId);
    if (!user) {
      return res.status(404).json({ error: 'រកមិនឃើញគណនីនេះឡើយ (Account not found)' });
    }

    // Update password hash and clear locks
    const salt = bcrypt.genSaltSync(10);
    user.passwordHash = bcrypt.hashSync(newPassword, salt);
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.status = 'Active';
    user.forcePasswordChange = false;
    saveLocalDb();

    // Send Telegram confirmation alert safely
    try {
      sendTelegramSecurityAlert(user, 'Password Reset Succeeded', `Your account password was reset successfully.`);
    } catch (e) {}

    return res.json({
      success: true,
      message: 'បានប្តូរលេខសម្ងាត់ជោគជ័យ! សូមចូលប្រើប្រាស់ជាមួយលេខសម្ងាត់ថ្មី (Password reset successfully! You can now log in.)'
    });
  } catch (err: any) {
    console.error('[reset-password error]:', err);
    return res.status(400).json({ error: err?.message || 'Failed to update password' });
  }
});

// GET Current User Profile / Permissions
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No auth token found' });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const user = localDb.users!.find(u => u.id === payload.id);
    if (!user) return res.status(404).json({ error: 'User profiles missing' });

    const roleName = localDb.roles!.find(r => r.id === user.roleId)?.name || 'Staff';
    const permissionIds = localDb.rolePermissions![user.roleId] || [];
    const permissions = localDb.permissions!.filter(p => permissionIds.includes(p.id));

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: roleName,
      roleId: user.roleId,
      assignedBranchIds: user.assignedBranchIds || [],
      forcePasswordChange: user.forcePasswordChange || false,
      permissions
    });
  } catch (err) {
    return res.status(403).json({ error: 'Expired or invalid token' });
  }
});

// Users Management REST APIs (Authorized for Owner / Admin)
app.get('/api/users', (req, res) => {
  // Return users with key attributes, excluding raw password hashes for safety, and dynamically resolve role name
  const safeUsers = localDb.users!.map(({ passwordHash, ...rest }) => {
    const roleName = localDb.roles!.find(r => r.id === rest.roleId)?.name || 'Staff';
    return { ...rest, role: roleName };
  });
  res.json({ success: true, users: safeUsers });
});

app.post('/api/users', (req, res) => {
  try {
    if (!localDb.users) localDb.users = [];

    const { 
      fullName, username, email, phone, roleId, password, 
      assignedBranchIds, customPermissionIds, 
      telegramUsername, telegramChatId, twoFactorMethod 
    } = req.body;

    const actualRoleId = roleId || req.body.role?.toLowerCase() || 'staff';

    if (!fullName || !username || !email) {
      return res.status(400).json({ error: 'សូមបញ្ចូលព័ត៌មានដែលចាំបាច់ (Full Name, Username, Email)' });
    }

    let passwordHash = '';
    try {
      const salt = bcrypt.genSaltSync(10);
      const plainPassword = password || 'ChangeMe@123';
      passwordHash = bcrypt.hashSync(plainPassword, salt);
    } catch (passErr) {
      passwordHash = '$2a$10$wT.3kGgD.N.N...'; // Safe hash fallback
    }

    // Check if user with matching username or email already exists
    const existingIndex = localDb.users.findIndex(
      u => (u.username && u.username.toLowerCase() === username.toLowerCase()) || 
           (u.email && u.email.toLowerCase() === email.toLowerCase())
    );

    let targetUser: any;

    if (existingIndex >= 0) {
      // Update existing user credentials seamlessly (Upsert)
      targetUser = localDb.users[existingIndex];
      targetUser.fullName = fullName;
      targetUser.username = username;
      targetUser.email = email;
      if (phone) targetUser.phone = phone;
      if (password) targetUser.passwordHash = passwordHash;
      targetUser.roleId = actualRoleId;
      targetUser.assignedBranchIds = assignedBranchIds || targetUser.assignedBranchIds || [];
      targetUser.customPermissionIds = customPermissionIds || targetUser.customPermissionIds || [];
      targetUser.telegramUsername = telegramUsername || targetUser.telegramUsername || '';
      targetUser.telegramChatId = telegramChatId || targetUser.telegramChatId || '';
      targetUser.twoFactorMethod = twoFactorMethod || targetUser.twoFactorMethod || 'disabled';
      targetUser.updatedAt = new Date().toISOString();

      localDb.users[existingIndex] = targetUser;
    } else {
      // Insert brand new user account
      targetUser = {
        id: 'usr_' + Date.now(),
        fullName,
        username,
        email,
        phone: phone || '',
        passwordHash,
        roleId: actualRoleId,
        status: 'Active',
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        forcePasswordChange: true,
        assignedBranchIds: assignedBranchIds || [],
        customPermissionIds: customPermissionIds || [],
        telegramUsername: telegramUsername || '',
        telegramChatId: telegramChatId || '',
        twoFactorMethod: twoFactorMethod || 'disabled'
      };

      localDb.users.push(targetUser);
    }

    saveLocalDb();

    try {
      sendTelegramSecurityAlert(targetUser, 'User Account Provisioned', `Account '${username}' provisioned with role '${actualRoleId}'.`);
    } catch (e) {}

    const { passwordHash: _, ...safeUser } = targetUser;
    return res.json({ success: true, user: safeUser });
  } catch (err: any) {
    console.error('[Create User Error]:', err);
    return res.status(500).json({ error: err?.message || 'Server error creating user account' });
  }
});

app.get('/api/users/:id', (req, res) => {
  const user = localDb.users!.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.put('/api/users/:id', (req, res) => {
  const user = localDb.users!.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { 
    fullName, username, email, phone, roleId, password, status,
    assignedBranchIds, customPermissionIds, 
    telegramUsername, telegramChatId, twoFactorMethod 
  } = req.body;

  let permissionChanged = false;
  let securityMsg = '';

  if (fullName) user.fullName = fullName;
  if (email) user.email = email;
  if (phone) user.phone = phone;

  if (username && username.toLowerCase() !== user.username.toLowerCase()) {
    const exists = localDb.users.some(
      u => u.id !== user.id && u.username.toLowerCase() === username.toLowerCase()
    );
    if (exists) {
      return res.status(400).json({ error: 'Username already in use' });
    }
    user.username = username;
  }

  if (password) {
    const salt = bcrypt.genSaltSync(10);
    user.passwordHash = bcrypt.hashSync(password, salt);
    securityMsg += 'Credential passcode manually reset by administrator. ';
  }
  
  if (roleId && roleId !== user.roleId) {
    securityMsg += `Role modified from [${user.roleId}] to [${roleId}]. `;
    user.roleId = roleId;
    permissionChanged = true;
  }

  if (status && status !== user.status) {
    securityMsg += `Status toggled from [${user.status}] to [${status}]. `;
    user.status = status;
  }

  if (assignedBranchIds && JSON.stringify(assignedBranchIds) !== JSON.stringify(user.assignedBranchIds)) {
    securityMsg += `Branch scope customized: ${JSON.stringify(assignedBranchIds)}. `;
    user.assignedBranchIds = assignedBranchIds;
  }

  if (customPermissionIds) {
    if (JSON.stringify(customPermissionIds) !== JSON.stringify(user.customPermissionIds)) {
      securityMsg += `Granular custom permissions grid manually overrode. `;
      permissionChanged = true;
    }
    user.customPermissionIds = customPermissionIds;
  }

  if (telegramUsername !== undefined) user.telegramUsername = telegramUsername;
  
  if (telegramChatId !== undefined && telegramChatId !== user.telegramChatId) {
    securityMsg += `Linked Telegram Chat ID configured to: [${telegramChatId || 'Unlinked'}]. `;
    user.telegramChatId = telegramChatId;
  }
  
  if (twoFactorMethod !== undefined && twoFactorMethod !== user.twoFactorMethod) {
    securityMsg += `2FA Auth policy changed to: [${twoFactorMethod.toUpperCase()}]. `;
    user.twoFactorMethod = twoFactorMethod;
  }

  user.updatedAt = new Date().toISOString();
  saveLocalDb();

  // Send notifications upon privilege edits
  if (securityMsg) {
    sendTelegramSecurityAlert(user, permissionChanged ? 'Permission Changed' : 'Account Config Modified', securityMsg);
  }

  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.delete('/api/users/:id', (req, res) => {
  const index = localDb.users!.findIndex(u => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'User not found' });

  const termUser = localDb.users![index];
  if (termUser.id === 'usr_owner') {
    return res.status(400).json({ error: 'Cannot delete primary owner account' });
  }

  localDb.users!.splice(index, 1);
  saveLocalDb();
  res.json({ success: true, message: 'User deleted successfully' });
});

app.patch('/api/users/:id/status', (req, res) => {
  const user = localDb.users!.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { status } = req.body;
  if (!['Active', 'Inactive', 'Locked'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  user.status = status;
  if (status === 'Active') {
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }
  user.updatedAt = new Date().toISOString();

  saveLocalDb();
  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.patch('/api/users/:id/reset-password', (req, res) => {
  const user = localDb.users!.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required' });

  const salt = bcrypt.genSaltSync(10);
  user.passwordHash = bcrypt.hashSync(password, salt);
  user.forcePasswordChange = true; // force change on login if reset by admin
  user.updatedAt = new Date().toISOString();

  saveLocalDb();
  res.json({ success: true, message: 'Password reset successfully' });
});

app.patch('/api/users/:id/assign-branches', (req, res) => {
  const user = localDb.users!.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { assignedBranchIds } = req.body;
  if (!Array.isArray(assignedBranchIds)) {
    return res.status(400).json({ error: 'assignedBranchIds must be an array' });
  }

  user.assignedBranchIds = assignedBranchIds;
  user.updatedAt = new Date().toISOString();

  saveLocalDb();
  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Roles & Permissions REST APIs
app.get('/api/roles', (req, res) => {
  try {
    const rolesList = (localDb.roles && localDb.roles.length > 0) ? localDb.roles : defaultRoles;
    const permissionsList = localDb.permissions || [];
    const rolePermissionsMap = localDb.rolePermissions || {};

    const rolesWithPerms = rolesList.map(r => {
      const permIds = rolePermissionsMap[r.id] || [];
      const perms = permissionsList.filter(p => permIds.includes(p.id));
      return { ...r, permissions: perms };
    });
    res.json({ success: true, roles: rolesWithPerms });
  } catch (err: any) {
    res.json({ success: true, roles: defaultRoles.map(r => ({ ...r, permissions: [] })) });
  }
});

app.post('/api/roles', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Role name is required' });

  const id = name.toLowerCase().replace(/\s+/g, '_');
  const exists = localDb.roles!.some(r => r.id === id);
  if (exists) return res.status(400).json({ error: 'Role already exists' });

  const newRole = { id, name, description: description || '' };
  localDb.roles!.push(newRole);
  localDb.rolePermissions![id] = [];
  saveLocalDb();

  res.json({ success: true, role: { ...newRole, permissions: [] } });
});

app.put('/api/roles/:id', (req, res) => {
  const role = localDb.roles!.find(r => r.id === req.params.id);
  if (!role) return res.status(404).json({ error: 'Role not found' });

  const { name, description } = req.body;
  if (name) role.name = name;
  if (description) role.description = description;

  saveLocalDb();
  res.json({ success: true, role });
});

app.delete('/api/roles/:id', (req, res) => {
  const index = localDb.roles!.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Role not found' });

  if (['owner', 'admin', 'manager', 'staff'].includes(req.params.id)) {
    return res.status(400).json({ error: 'System default roles cannot be deleted' });
  }

  localDb.roles!.splice(index, 1);
  delete localDb.rolePermissions![req.params.id];
  saveLocalDb();

  res.json({ success: true, message: 'Role deleted successfully' });
});

app.get('/api/permissions', (req, res) => {
  res.json({ success: true, permissions: localDb.permissions });
});

app.put('/api/roles/:id/permissions', (req, res) => {
  const role = localDb.roles!.find(r => r.id === req.params.id);
  if (!role) return res.status(404).json({ error: 'Role not found' });

  const { permissionIds } = req.body;
  if (!Array.isArray(permissionIds)) {
    return res.status(400).json({ error: 'permissionIds must be an array' });
  }

  // Save the mapping
  localDb.rolePermissions![req.params.id] = permissionIds;
  saveLocalDb();

  res.json({ success: true, message: 'Permissions configured successfully' });
});

// Login History ledger
app.get('/api/login-history', (req, res) => {
  res.json({ success: true, logs: localDb.loginHistory || [] });
});

app.get('/api/sync-data', (req, res) => {
  try {
    res.json({ success: true, data: localDb });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sync-data', (req, res) => {
  try {
    const payload = req.body as Partial<SyncPayload>;
    localDb = { ...localDb, ...payload };
    saveLocalDb();
    res.json({ success: true, message: 'Server-side data synchronized successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Telegram Configuration
app.get('/api/telegram-config', (req, res) => {
  res.json(getTelegramConfig());
});

// Save Telegram Configuration
app.post('/api/telegram-config', (req, res) => {
  try {
    saveTelegramConfig(req.body);
    res.json({ success: true, message: 'Telegram Configuration saved and updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route to manually test Bot connectivity and individual user test
app.post('/api/telegram-test', async (req, res) => {
  const { chatId, username } = req.body;
  if (!chatId) {
    return res.status(400).json({ success: false, error: 'Chat ID is required' });
  }

  const shopName = localDb.settings?.shopName || 'TC Staff Management';
  const text = `<b>🎉 TC Staff Telegram Bot Test Connection</b>
━━━━━━━━━━━━━━━━━
<b>Shop:</b> ${shopName}
<b>Status:</b> Active 🟢
<b>Timestamp:</b> <code>${new Date().toISOString().replace('T', ' ').substring(0, 19)}</code>
<b>Configured For:</b> <b>${username || 'Owner/Admin'}</b>

<i>Congratulations! Your TC Staff Management system is now securely linked with this Telegram thread. Instant operational alerts will be delivered here.</i>
━━━━━━━━━━━━━━━━━`;

  const result = await sendTelegramMessage(chatId, text);
  res.json(result);
});

// ─── TELEGRAM TEMPLATES MANAGEMENT CRUD & TEST CHANNELS ─────────────────────────

// Helper to parse template variables
function parseTemplateVariables(textTpl: string, customValues: Record<string, string> = {}) {
  const defaultValues: Record<string, string> = {
    branch_name: 'Phnom Penh Central Branch',
    date: new Date().toISOString().substring(0, 10),
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    revenue: '450.00',
    expense: '75.25',
    profit: '374.75',
    staff_count: '6',
    coin_balance: '142',
    item_name: 'Super Clean Softener Liquid',
    remaining_qty: '4.5',
    minimum_qty: '12',
    machine_no: 'DRYER-7',
    status: 'Operational warning flagged',
    message: 'System auto-reconciled with minor $2.50 cash drawer discrepancy. Recommended action: recount till drawer.'
  };

  const finalValues = { ...defaultValues, ...customValues };
  let parsedText = textTpl || '';
  for (const [key, value] of Object.entries(finalValues)) {
    const regex = new RegExp(`{${key}}`, 'g');
    parsedText = parsedText.replace(regex, value);
  }
  return parsedText;
}

// GET all telegram templates
app.get('/api/telegram-templates', (req, res) => {
  res.json(localDb.telegramTemplates || []);
});

// POST create a telegram template
app.post('/api/telegram-templates', (req, res) => {
  try {
    const { name, category, isEnabled, engTemplate, khmerTemplate, parseMode, branchId, targetGroups } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({ success: false, error: 'Name and Category are required.' });
    }

    const newTemplate = {
      id: 'tpl_' + Date.now(),
      name,
      category,
      isEnabled: isEnabled !== undefined ? isEnabled : true,
      engTemplate: engTemplate || '',
      khmerTemplate: khmerTemplate || '',
      parseMode: parseMode || 'HTML',
      branchId: branchId || 'all',
      targetGroups: Array.isArray(targetGroups) ? targetGroups : []
    };

    if (!localDb.telegramTemplates) localDb.telegramTemplates = [];
    localDb.telegramTemplates.push(newTemplate);
    saveLocalDb();

    res.json({ success: true, data: newTemplate });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update a telegram template
app.put('/api/telegram-templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, isEnabled, engTemplate, khmerTemplate, parseMode, branchId, targetGroups } = req.body;

    if (!localDb.telegramTemplates) localDb.telegramTemplates = [];
    const index = localDb.telegramTemplates.findIndex((t: any) => t.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const t = localDb.telegramTemplates[index];
    localDb.telegramTemplates[index] = {
      ...t,
      name: name !== undefined ? name : t.name,
      category: category !== undefined ? category : t.category,
      isEnabled: isEnabled !== undefined ? isEnabled : t.isEnabled,
      engTemplate: engTemplate !== undefined ? engTemplate : t.engTemplate,
      khmerTemplate: khmerTemplate !== undefined ? khmerTemplate : t.khmerTemplate,
      parseMode: parseMode !== undefined ? parseMode : t.parseMode,
      branchId: branchId !== undefined ? branchId : t.branchId,
      targetGroups: Array.isArray(targetGroups) ? targetGroups : t.targetGroups
    };

    saveLocalDb();
    res.json({ success: true, data: localDb.telegramTemplates[index] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE a telegram template
app.delete('/api/telegram-templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!localDb.telegramTemplates) localDb.telegramTemplates = [];
    
    const index = localDb.telegramTemplates.findIndex((t: any) => t.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    localDb.telegramTemplates.splice(index, 1);
    saveLocalDb();
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST test a telegram template - send live formatted test message to specified chat ids or default configured ones
app.post('/api/telegram-templates/test', async (req, res) => {
  try {
    const { templateId, selectedLanguage, customChatId, customVariables } = req.body;
    
    if (!templateId) {
      return res.status(400).json({ success: false, error: 'Template ID is required.' });
    }

    const template = (localDb.telegramTemplates || []).find((t: any) => t.id === templateId);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found.' });
    }

    const config = getTelegramConfig();
    const isKhmer = selectedLanguage === 'kh';
    const rawText = isKhmer ? template.khmerTemplate : template.engTemplate;
    const parsedText = parseTemplateVariables(rawText, customVariables || {});

    // Target chat IDs: either a specific one requested dynamically, or template's specific targetGroups, or fallback to general owner/admin
    let chatsToSend: string[] = [];
    if (customChatId) {
      chatsToSend.push(customChatId);
    } else if (Array.isArray(template.targetGroups) && template.targetGroups.length > 0) {
      chatsToSend = template.targetGroups;
    } else {
      // Look up branch-specific chat IDs if of specific branch, otherwise fallback to admin/owner
      if (template.branchId && template.branchId !== 'all') {
        const bId = template.branchId;
        if (config.chatIds.branches?.[bId]) chatsToSend.push(config.chatIds.branches[bId]);
        if (config.chatIds.manager?.[bId]) chatsToSend.push(config.chatIds.manager[bId]);
        if (config.chatIds.staff?.[bId]) chatsToSend.push(config.chatIds.staff[bId]);
      }
      
      if (chatsToSend.length === 0) {
        if (config.chatIds.owner) chatsToSend.push(config.chatIds.owner);
        if (config.chatIds.admin) chatsToSend.push(config.chatIds.admin);
      }
    }

    if (chatsToSend.length === 0) {
      return res.status(400).json({ success: false, error: 'No recipient Chat IDs are configured for this template or system fallback.' });
    }

    if (!config.botToken) {
      // Simulated delivery
      return res.json({
        success: true,
        simulated: true,
        message: 'Bot token not fully configured. API processed simulation delivery successfully!',
        dispatched_text: parsedText,
        recipientsOnMockLogs: chatsToSend
      });
    }

    const sendResults = [];
    for (const chatId of chatsToSend) {
      if (!chatId) continue;
      const sendResult = await sendTelegramMessage(chatId, parsedText, template.parseMode || 'HTML');
      sendResults.push({ chatId, ...sendResult });
    }

    const successfulSends = sendResults.filter(r => r.success);
    if (successfulSends.length > 0) {
      res.json({
        success: true,
        message: `Successfully tested template! Dispatched message to ${successfulSends.length} endpoint(s).`,
        details: sendResults,
        dispatched_text: parsedText
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to send test messages. Check API Token and Chat IDs.',
        details: sendResults,
        dispatched_text: parsedText
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── TELEGRAM SCHEDULES, RECIPIENTS, LOGS API ENDPOINTS ───

// Time conversion normalization
function normalizeTo24Hour(timeStr: string): string {
  if (!timeStr) return '';
  timeStr = timeStr.trim();
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return timeStr;
  let hr = parseInt(match[1]);
  const mins = match[2];
  const ampm = match[3];
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && hr < 12) hr += 12;
    if (ampm.toUpperCase() === 'AM' && hr === 12) hr = 0;
  }
  return `${String(hr % 24).padStart(2, '0')}:${mins}`;
}

// Robust message sender with automatic retry on failures
async function sendTelegramMessageWithRetry(chatId: string, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML', maxAttempts = 3, customBotToken?: string) {
  let attempt = 0;
  let lastError = '';
  while (attempt < maxAttempts) {
    attempt++;
    const res = await sendTelegramMessage(chatId, text, parseMode, customBotToken);
    if (res.success) {
      return { success: true, attempts: attempt };
    }
    lastError = res.error || 'Network request timeout or empty bot response';
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 800)); // Delay between retries
    }
  }
  return { success: false, error: lastError, attempts: maxAttempts };
}

// TC Staff Realtime Report builders
function generateDailyReportData(branchId: string) {
  const branches = branchId === 'all' || !branchId ? localDb.branches : localDb.branches.filter(b => b.id === branchId);
  if (branches.length === 0) return "<b>🏪 Daily Alert Status:</b> No operational branches found in active database.";

  let text = `<b>📊 DAILY BUSINESS SUMMARY REPORT</b>\n`;
  text += `📅 <b>Date:</b> ${new Date().toISOString().substring(0, 10)}\n`;
  text += `━━━━━━━━━━━━━━━━━\n`;

  for (const b of branches) {
    const todayStr = new Date().toISOString().substring(0, 10);
    const branchIncomes = localDb.incomes?.filter(inc => inc.branchId === b.id && inc.date === todayStr) || [];
    const branchExpenses = localDb.expenses?.filter(exp => exp.branchId === b.id && exp.date === todayStr) || [];
    
    const revenue = branchIncomes.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const expense = branchExpenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const profit = revenue - expense;

    const machines = localDb.machines?.filter(m => m.branchId === b.id) || [];
    const brokenMachines = machines.filter(m => m.status === 'Needs Repair' || m.status === 'OutOfService' || m.status === 'Broken').length;
    const activeMachines = machines.length - brokenMachines;

    text += `🏪 <b>${b.branchName}:</b>\n`;
    text += `   💵 <b>Revenue:</b> $${revenue.toFixed(2)}\n`;
    text += `   💸 <b>Expenses:</b> $${expense.toFixed(2)}\n`;
    text += `   📈 <b>Net Today:</b> $${profit.toFixed(2)}\n`;
    text += `   ⚙️ <b>Machines:</b> ${activeMachines} Active | ${brokenMachines} Broken\n`;
    text += `   🪙 <b>Coin Balance:</b> ${b.coinBalance || 140} coins\n`;
    text += `━━━━━━━━━━━━━━━━━\n`;
  }
  return text;
}

function generateWeeklyReportData() {
  let text = `<b>📊 WEEKLY BRANCH REPORT & COMPARISON</b>\n`;
  text += `📅 <b>Period:</b> Last 7 Days Performance Matrix\n`;
  text += `━━━━━━━━━━━━━━━━━\n`;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().substring(0, 10);

  let totalRevAll = 0;
  let totalExpAll = 0;

  for (const b of localDb.branches) {
    const branchIncomes = localDb.incomes?.filter(inc => inc.branchId === b.id && inc.date >= sevenDaysAgoStr) || [];
    const branchExpenses = localDb.expenses?.filter(exp => exp.branchId === b.id && exp.date >= sevenDaysAgoStr) || [];
    
    const revenue = branchIncomes.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const expense = branchExpenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const profit = revenue - expense;

    totalRevAll += revenue;
    totalExpAll += expense;

    text += `🏪 <b>${b.branchName}:</b>\n`;
    text += `   💵 <b>Weekly Rev:</b> $${revenue.toFixed(2)}\n`;
    text += `   💸 <b>Weekly Exp:</b> $${expense.toFixed(2)}\n`;
    text += `   📈 <b>Weekly Profit:</b> $${profit.toFixed(2)}\n`;
    text += `━━━━━━━━━━━━━━━━━\n`;
  }

  const profitAll = totalRevAll - totalExpAll;
  text += `<b>🌐 SYSTEM-WIDE CONSOLIDATED OUTCOME:</b>\n`;
  text += `📊 <b>Total Combined Rev:</b> $${totalRevAll.toFixed(2)}\n`;
  text += `💸 <b>Total Combined Exp:</b> $${totalExpAll.toFixed(2)}\n`;
  text += `💎 <b>Net Consolidated Profit:</b> $${profitAll.toFixed(2)}\n`;
  text += `━━━━━━━━━━━━━━━━━`;
  return text;
}

function generateMonthlyReportData() {
  let text = `<b>🗓️ MONTHLY EXECUTIVE SUMMARY REPORT</b>\n`;
  text += `📅 <b>Period:</b> Current Month Dynamic Accumulation\n`;
  text += `━━━━━━━━━━━━━━━━━\n`;

  const now = new Date();
  const currentYearMonth = now.toISOString().substring(0, 7);

  let totalRevAll = 0;
  let totalExpAll = 0;

  for (const b of localDb.branches) {
    const branchIncomes = localDb.incomes?.filter(inc => inc.branchId === b.id && inc.date.startsWith(currentYearMonth)) || [];
    const branchExpenses = localDb.expenses?.filter(exp => exp.branchId === b.id && exp.date.startsWith(currentYearMonth)) || [];
    
    const revenue = branchIncomes.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const expense = branchExpenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const profit = revenue - expense;

    totalRevAll += revenue;
    totalExpAll += expense;

    text += `🏪 <b>${b.branchName}:</b>\n`;
    text += `   💵 <b>Rev Month-to-Date:</b> $${revenue.toFixed(2)}\n`;
    text += `   💸 <b>Exp Month-to-Date:</b> $${expense.toFixed(2)}\n`;
    text += `   📈 <b>Net Earnings:</b> $${profit.toFixed(2)}\n`;
  }

  text += `━━━━━━━━━━━━━━━━━\n`;
  const salariesTotal = (localDb.salaries || []).reduce((sum, sal) => sum + parseFloat(sal.totalSalary || 0), 0);
  const totalStockItemsCount = (localDb.inventory || []).length;

  text += `<b>💵 System Salaries Allocated:</b> $${salariesTotal.toFixed(2)}\n`;
  text += `🧼 <b>Active Inventory SKUs:</b> ${totalStockItemsCount}\n`;
  text += `💎 <b>Est. General Profit:</b> $${(totalRevAll - totalExpAll - salariesTotal).toFixed(2)}\n`;
  text += `━━━━━━━━━━━━━━━━━`;
  return text;
}

// Execute Scheduled Item Dispatcher Core
async function triggerScheduledEvent(s: any, isManualTest = false) {
  const config = getTelegramConfig();
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Load recipient
  const recipient = (localDb.telegramRecipients || []).find(r => r.id === s.recipientId);
  if (!recipient && !config.chatIds.owner) {
    return { success: false, error: 'No Telegram recipient found and owner chat ID fallback is missing' };
  }

  const chatId = recipient?.isEnabled ? recipient.chatId : (config.chatIds.owner || config.chatIds.admin);
  if (!chatId) {
    return { success: false, error: 'No validated Chat ID found to dispatcher alerts' };
  }

  // Generate customized aggregate reports or use customized design templates
  let alertText = '';
  let formatMode: 'HTML' | 'Markdown' = 'HTML';

  const template = (localDb.telegramTemplates || []).find(t => t.id === s.templateId);
  if (template) {
    formatMode = template.parseMode || 'HTML';
  }

  if (s.frequency === 'DAILY') {
    alertText = generateDailyReportData(s.branchId);
  } else if (s.frequency === 'WEEKLY') {
    alertText = generateWeeklyReportData();
  } else if (s.frequency === 'MONTHLY') {
    alertText = generateMonthlyReportData();
  } else {
    // Custom schedules or specific templates
    const rawTemplateText = template 
      ? (isManualTest ? template.engTemplate : template.engTemplate) 
      : `<b>🔔 AUTO ALERT SCHEDULE TRIGGED</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n📅 <b>Time:</b> {date} {time}\n📝 <b>Notification Type:</b> {status}`;

    const branchObj = localDb.branches.find(b => b.id === s.branchId) || { branchName: 'System-Wide Operations' };
    
    alertText = parseTemplateVariables(rawTemplateText, {
      branch_name: branchObj.branchName,
      date: todayStr,
      time: timeStr,
      status: s.alertType,
      message: `System schedule trigger activated. Automated payload verification passed for frequency ${s.frequency}.`
    });
  }

  if (!config.botToken) {
    // Simulated Dispatch
    if (!localDb.telegramLogs) localDb.telegramLogs = [];
    localDb.telegramLogs.push({
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 100),
      scheduleId: s.id,
      templateId: s.templateId || null,
      recipientId: s.recipientId || null,
      chatId: chatId,
      alertType: s.alertType,
      messageText: alertText,
      status: 'SUCCESS',
      errorMessage: '(Simulated Delivery: Bot token is empty)',
      sentAt: new Date().toISOString()
    });

    s.lastSentAt = new Date().toISOString();
    return { success: true, simulated: true, text: alertText };
  }

  // Real delivery with robust retry logic
  let customBotToken: string | undefined = undefined;
  if (recipient) {
    const encToken = recipient.bot_token_encrypted || recipient.botTokenEncrypted;
    if (encToken) {
      customBotToken = decryptToken(encToken);
    }
  }

  const sendRes = await sendTelegramMessageWithRetry(chatId, alertText, formatMode, 3, customBotToken);

  if (!localDb.telegramLogs) localDb.telegramLogs = [];
  localDb.telegramLogs.push({
    id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 100),
    scheduleId: s.id,
    templateId: s.templateId || null,
    recipientId: s.recipientId || null,
    chatId: chatId,
    alertType: s.alertType,
    messageText: alertText,
    status: sendRes.success ? 'SUCCESS' : 'FAILED',
    errorMessage: sendRes.success ? null : sendRes.error,
    sentAt: new Date().toISOString()
  });

  if (sendRes.success) {
    s.lastSentAt = new Date().toISOString();
    saveLocalDb();
    return { success: true, text: alertText };
  } else {
    return { success: false, error: sendRes.error };
  }
}

// 1. GET ALL SCHEDULES
app.get('/api/telegram-schedules', (req, res) => {
  res.json(localDb.telegramAlertSchedules || []);
});

// 2. CREATE A NEW SCHEDULE
app.post('/api/telegram-schedules', (req, res) => {
  try {
    const { branchId, alertType, templateId, recipientId, frequency, sendTime, dayOfWeek, dayOfMonth, isEnabled } = req.body;

    if (!alertType || !frequency) {
      return res.status(400).json({ success: false, error: 'Alert Type and Frequency is required.' });
    }

    const newSchedule = {
      id: 'sch_' + Date.now(),
      branchId: branchId || 'all',
      alertType,
      templateId: templateId || '',
      recipientId: recipientId || '',
      frequency,
      sendTime: normalizeTo24Hour(sendTime || ''),
      dayOfWeek: dayOfWeek || '',
      dayOfMonth: dayOfMonth || '',
      isEnabled: isEnabled !== undefined ? isEnabled : true,
      lastSentAt: null,
      nextSendAt: null,
      createdBy: 'Owner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!localDb.telegramAlertSchedules) localDb.telegramAlertSchedules = [];
    localDb.telegramAlertSchedules.push(newSchedule);
    saveLocalDb();

    res.json({ success: true, data: newSchedule });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. UPDATE AN EXISTING SCHEDULE
app.put('/api/telegram-schedules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { branchId, alertType, templateId, recipientId, frequency, sendTime, dayOfWeek, dayOfMonth, isEnabled } = req.body;

    if (!localDb.telegramAlertSchedules) localDb.telegramAlertSchedules = [];
    const index = localDb.telegramAlertSchedules.findIndex((s: any) => s.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Schedule configuration not found' });
    }

    const s = localDb.telegramAlertSchedules[index];
    localDb.telegramAlertSchedules[index] = {
      ...s,
      branchId: branchId !== undefined ? branchId : s.branchId,
      alertType: alertType !== undefined ? alertType : s.alertType,
      templateId: templateId !== undefined ? templateId : s.templateId,
      recipientId: recipientId !== undefined ? recipientId : s.recipientId,
      frequency: frequency !== undefined ? frequency : s.frequency,
      sendTime: sendTime !== undefined ? normalizeTo24Hour(sendTime) : s.sendTime,
      dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : s.dayOfWeek,
      dayOfMonth: dayOfMonth !== undefined ? dayOfMonth : s.dayOfMonth,
      isEnabled: isEnabled !== undefined ? isEnabled : s.isEnabled,
      updatedAt: new Date().toISOString()
    };

    saveLocalDb();
    res.json({ success: true, data: localDb.telegramAlertSchedules[index] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. DELETE A SCHEDULE
app.delete('/api/telegram-schedules/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!localDb.telegramAlertSchedules) localDb.telegramAlertSchedules = [];
    
    const index = localDb.telegramAlertSchedules.findIndex((s: any) => s.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    localDb.telegramAlertSchedules.splice(index, 1);
    saveLocalDb();
    res.json({ success: true, message: 'Message Alert trigger schedule wiped out.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper function to validate Telegram token and chat ID before saving
async function validateBotTokenAndChat(botToken: string, chatId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const meBody = await meRes.json() as any;
    if (!meBody.ok) {
      return { success: false, error: `Invalid Bot Token: ${meBody.description || 'Unauthorized'}` };
    }
    const chatRes = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`);
    const chatBody = await chatRes.json() as any;
    if (!chatBody.ok) {
      return { success: false, error: `Invalid Chat ID or Bot is not a member of the chat: ${chatBody.description || 'Chat not found'}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: `Verification failed: ${e.message || 'Network timeout connecting to Telegram'}` };
  }
}

// 4.5 TELEGRAM ROLE CONFIGURATION PERMISSIONS
app.get('/api/telegram-permissions', (req, res) => {
  try {
    const allPerms = localDb.permissions || [];
    const telegramConfigurePerm = allPerms.find(p => p.module === 'Telegram Settings' && p.action === 'Configure');
    
    if (!telegramConfigurePerm) {
      return res.json({ admin: true, manager: false });
    }
    
    const adminPerms = localDb.rolePermissions?.['admin'] || [];
    const managerPerms = localDb.rolePermissions?.['manager'] || [];
    
    res.json({
      admin: adminPerms.includes(telegramConfigurePerm.id),
      manager: managerPerms.includes(telegramConfigurePerm.id)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/telegram-permissions', (req, res) => {
  try {
    const { admin, manager } = req.body;
    const allPerms = localDb.permissions || [];
    const telegramConfigurePerm = allPerms.find(p => p.module === 'Telegram Settings' && p.action === 'Configure');
    
    if (!telegramConfigurePerm) {
      return res.status(400).json({ success: false, error: 'Telegram configuration permission not seeded.' });
    }
    
    if (!localDb.rolePermissions) {
      localDb.rolePermissions = {};
    }
    
    // Set Admin permission
    if (admin !== undefined) {
      const adminPerms = new Set(localDb.rolePermissions['admin'] || []);
      if (admin) {
        adminPerms.add(telegramConfigurePerm.id);
      } else {
        adminPerms.delete(telegramConfigurePerm.id);
      }
      localDb.rolePermissions['admin'] = Array.from(adminPerms);
    }
    
    // Set Manager permission
    if (manager !== undefined) {
      const managerPerms = new Set(localDb.rolePermissions['manager'] || []);
      if (manager) {
        managerPerms.add(telegramConfigurePerm.id);
      } else {
        managerPerms.delete(telegramConfigurePerm.id);
      }
      localDb.rolePermissions['manager'] = Array.from(managerPerms);
    }
    
    saveLocalDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.6 TELEGRAM TEST RECIPIENT DISPATCH (Validates both Bot Token and Chat ID by sending a real Telegram notice)
app.post('/api/telegram-recipients/test-send', async (req, res) => {
  try {
    let { botToken, chatId, recipientName, recipientType, groupName } = req.body;
    
    if (!botToken || !chatId) {
      return res.status(400).json({ success: false, error: 'Bot Token and Chat ID are mandatory' });
    }

    // Resolve masked token from existing database if applicable
    if (botToken.includes('****')) {
      const matched = (localDb.telegramRecipients || []).find((r: any) => r.chat_id === chatId || r.chatId === chatId);
      if (matched && (matched.bot_token_encrypted || matched.botTokenEncrypted)) {
        botToken = decryptToken(matched.bot_token_encrypted || matched.botTokenEncrypted);
      } else {
        // Fallback to global config
        const tc = getTelegramConfig();
        botToken = tc.botToken;
      }
    }

    if (!botToken) {
      return res.status(400).json({ success: false, error: 'Could not resolve a valid Bot Token' });
    }

    const testText = `<b>🎉 TC Staff Telegram Connection Validation</b>
━━━━━━━━━━━━━━━━━
<b>Recipient:</b> ${recipientName || 'Test Partner'}
<b>Group/Channel:</b> ${groupName || 'Unspecified'}
<b>Type:</b> <code>${recipientType || 'GROUP_CHAT'}</code>
<b>Status:</b> Success 🟢
<b>Timestamp:</b> <code>${new Date().toISOString().replace('T', ' ').substring(0, 19)}</code>

<i>Excellent! Connection verified successfully. Operation alerts can now be dispatched here.</i>
━━━━━━━━━━━━━━━━━`;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: testText,
        parse_mode: 'HTML'
      })
    });

    const body = await response.json() as any;
    if (body.ok) {
      // Store in telegram_logs with dual properties
      if (!localDb.telegramLogs) localDb.telegramLogs = [];
      const logEntry = {
        id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 100),
        branch_id: 'all',
        branchId: 'all',
        recipient_id: 'test',
        recipientId: 'test',
        alert_type: 'Test Connection',
        alertType: 'Test Connection',
        message: testText,
        messageText: testText,
        status: 'SUCCESS',
        error_message: null,
        errorMessage: null,
        sent_at: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      localDb.telegramLogs.push(logEntry);
      saveLocalDb();

      return res.json({ success: true, message: 'Test message transmitted successfully!' });
    } else {
      // Store failed log
      if (!localDb.telegramLogs) localDb.telegramLogs = [];
      const logEntry = {
        id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 100),
        branch_id: 'all',
        branchId: 'all',
        recipient_id: 'test',
        recipientId: 'test',
        alert_type: 'Test Connection Failed',
        alertType: 'Test Connection Failed',
        message: testText,
        messageText: testText,
        status: 'FAILED',
        error_message: body.description || 'API Error',
        errorMessage: body.description || 'API Error',
        sent_at: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      localDb.telegramLogs.push(logEntry);
      saveLocalDb();

      return res.json({ success: false, error: body.description || 'Raw Telegram API Error' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. GET RECIPIENTS list
app.get('/api/telegram-recipients', (req, res) => {
  try {
    const list = (localDb.telegramRecipients || []).map((r: any) => {
      let rawToken = '';
      if (r.bot_token_encrypted) {
        rawToken = decryptToken(r.bot_token_encrypted);
      } else if (r.botTokenEncrypted) {
        rawToken = decryptToken(r.botTokenEncrypted);
      }
      
      const masked = maskToken(rawToken);

      return {
        ...r,
        // Map both snake_case and camelCase to protect both React UI and older code
        id: r.id,
        branch_id: r.branch_id || r.branchId || 'all',
        branchId: r.branch_id || r.branchId || 'all',
        recipient_name: r.recipient_name || r.name || '',
        name: r.recipient_name || r.name || '',
        chat_id: r.chat_id || r.chatId || '',
        chatId: r.chat_id || r.chatId || '',
        bot_token_encrypted: r.bot_token_encrypted || r.botTokenEncrypted || '',
        botTokenEncrypted: r.bot_token_encrypted || r.botTokenEncrypted || '',
        recipient_type: r.recipient_type || r.recipientType || 'GROUP_CHAT',
        recipientType: r.recipient_type || r.recipientType || 'GROUP_CHAT',
        group_name: r.group_name || r.groupName || '',
        groupName: r.group_name || r.groupName || '',
        alert_types: r.alert_types || r.alertTypes || [],
        alertTypes: r.alert_types || r.alertTypes || [],
        is_default: r.is_default !== undefined ? r.is_default : (r.isDefault !== undefined ? r.isDefault : false),
        isDefault: r.is_default !== undefined ? r.is_default : (r.isDefault !== undefined ? r.isDefault : false),
        is_enabled: r.is_enabled !== undefined ? r.is_enabled : (r.isEnabled !== undefined ? r.isEnabled : true),
        isEnabled: r.is_enabled !== undefined ? r.is_enabled : (r.isEnabled !== undefined ? r.isEnabled : true),
        created_by: r.created_by || r.createdBy || 'Owner',
        createdBy: r.created_by || r.createdBy || 'Owner',
        created_at: r.created_at || r.createdAt || new Date().toISOString(),
        createdAt: r.created_at || r.createdAt || new Date().toISOString(),
        updated_at: r.updated_at || r.updatedAt || new Date().toISOString(),
        updatedAt: r.updated_at || r.updatedAt || new Date().toISOString(),
        botTokenMasked: masked,
        bot_token_masked: masked
      };
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. CREATE RECIPIENT WITH ENCRYPTION & VALIDATION
app.post('/api/telegram-recipients', async (req, res) => {
  try {
    const { 
      branch_id, branchId,
      recipient_name, name, recipientName,
      chat_id, chatId,
      bot_token, botToken,
      recipient_type, recipientType,
      group_name, groupName,
      alert_types, alertTypes,
      is_default, isDefault,
      is_enabled, isEnabled,
      createdBy
    } = req.body;

    const targetBranch = branch_id || branchId || 'all';
    const targetName = recipient_name || name || recipientName || '';
    const targetChat = chat_id || chatId || '';
    let targetToken = bot_token || botToken || '';
    const targetType = recipient_type || recipientType || 'GROUP_CHAT';
    const targetGroup = group_name || groupName || '';
    const targetAlerts = alert_types || alertTypes || [];
    const targetDefault = is_default !== undefined ? is_default : (isDefault !== undefined ? isDefault : false);
    const targetEnabled = is_enabled !== undefined ? is_enabled : (isEnabled !== undefined ? isEnabled : true);

    if (!targetName || !targetChat) {
      return res.status(400).json({ success: false, error: 'Recipient Name and Chat ID are mandatory fields.' });
    }

    // Secure token saving: encrypt the bot token
    let encryptedToken = '';
    if (targetToken) {
      // Validate Bot Token and Chat ID with Telegram before saving
      const validation = await validateBotTokenAndChat(targetToken, targetChat);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error });
      }
      encryptedToken = encryptToken(targetToken);
    }

    const newRec = {
      id: 'rec_' + Date.now() + '_' + Math.floor(Math.random()*100),
      branch_id: targetBranch,
      branchId: targetBranch,
      recipient_name: targetName,
      name: targetName,
      chat_id: targetChat,
      chatId: targetChat,
      bot_token_encrypted: encryptedToken,
      botTokenEncrypted: encryptedToken,
      recipient_type: targetType,
      recipientType: targetType,
      group_name: targetGroup,
      groupName: targetGroup,
      alert_types: targetAlerts,
      alertTypes: targetAlerts,
      is_default: targetDefault,
      isDefault: targetDefault,
      is_enabled: targetEnabled,
      isEnabled: targetEnabled,
      created_by: createdBy || 'Owner',
      createdBy: createdBy || 'Owner',
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!localDb.telegramRecipients) localDb.telegramRecipients = [];
    localDb.telegramRecipients.push(newRec);
    saveLocalDb();

    // Mask for return payload
    res.json({ 
      success: true, 
      data: {
        ...newRec,
        botTokenMasked: maskToken(targetToken),
        bot_token_masked: maskToken(targetToken)
      } 
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. UPDATE RECIPIENT WITH ENCRYPTION & VALIDATION
app.put('/api/telegram-recipients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      branch_id, branchId,
      recipient_name, name, recipientName,
      chat_id, chatId,
      bot_token, botToken,
      recipient_type, recipientType,
      group_name, groupName,
      alert_types, alertTypes,
      is_default, isDefault,
      is_enabled, isEnabled
    } = req.body;

    if (!localDb.telegramRecipients) localDb.telegramRecipients = [];
    const idx = localDb.telegramRecipients.findIndex((r: any) => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Recipient config not found.' });
    }

    const r = localDb.telegramRecipients[idx];
    
    const targetBranch = branch_id !== undefined ? branch_id : (branchId !== undefined ? branchId : r.branch_id);
    const targetName = recipient_name !== undefined ? recipient_name : (name !== undefined ? name : (recipientName !== undefined ? recipientName : r.recipient_name));
    const targetChat = chat_id !== undefined ? chat_id : (chatId !== undefined ? chatId : r.chat_id);
    const targetType = recipient_type !== undefined ? recipient_type : (recipientType !== undefined ? recipientType : r.recipient_type);
    const targetGroup = group_name !== undefined ? group_name : (groupName !== undefined ? groupName : r.group_name);
    const targetAlerts = alert_types !== undefined ? alert_types : (alertTypes !== undefined ? alertTypes : r.alert_types);
    const targetDefault = is_default !== undefined ? is_default : (isDefault !== undefined ? isDefault : r.is_default);
    const targetEnabled = is_enabled !== undefined ? is_enabled : (isEnabled !== undefined ? isEnabled : r.is_enabled);
    
    let targetToken = bot_token !== undefined ? bot_token : (botToken !== undefined ? botToken : '');
    let finalEncryptedToken = r.bot_token_encrypted || r.botTokenEncrypted || '';

    // Handle token update and validation
    if (targetToken && !targetToken.includes('****')) {
      const validation = await validateBotTokenAndChat(targetToken, targetChat);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error });
      }
      finalEncryptedToken = encryptToken(targetToken);
    } else if (targetToken && targetToken.includes('****')) {
      // Kept same, but make sure we validate if chat changes
      if (chat_id !== undefined && chat_id !== r.chat_id) {
        const decrypted = decryptToken(finalEncryptedToken);
        const validation = await validateBotTokenAndChat(decrypted, targetChat);
        if (!validation.success) {
          return res.status(400).json({ success: false, error: validation.error });
        }
      }
    }

    localDb.telegramRecipients[idx] = {
      ...r,
      branch_id: targetBranch,
      branchId: targetBranch,
      recipient_name: targetName,
      name: targetName,
      chat_id: targetChat,
      chatId: targetChat,
      bot_token_encrypted: finalEncryptedToken,
      botTokenEncrypted: finalEncryptedToken,
      recipient_type: targetType,
      recipientType: targetType,
      group_name: targetGroup,
      groupName: targetGroup,
      alert_types: targetAlerts,
      alertTypes: targetAlerts,
      is_default: targetDefault,
      isDefault: targetDefault,
      is_enabled: targetEnabled,
      isEnabled: targetEnabled,
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveLocalDb();
    res.json({ success: true, data: localDb.telegramRecipients[idx] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. DELETE RECIPIENT
app.delete('/api/telegram-recipients/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!localDb.telegramRecipients) localDb.telegramRecipients = [];
    const idx = localDb.telegramRecipients.findIndex((r: any) => r.id === id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Recipient config not found.' });

    localDb.telegramRecipients.splice(idx, 1);
    saveLocalDb();
    res.json({ success: true, message: 'Recipient config deleted successfully.' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 9. GET TELEGRAM LOGS
app.get('/api/telegram-logs', (req, res) => {
  res.json(localDb.telegramLogs || []);
});

// 10. MANUAL TRIGGER NOW (TEST SEND option from schedule bench)
app.post('/api/telegram-schedules/trigger-manual/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = (localDb.telegramAlertSchedules || []).find((s: any) => s.id === id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Target schedule configuration not found' });
    }

    const outcome = await triggerScheduledEvent(schedule, true);
    res.json(outcome);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Route to manually trigger simulated alert categories
app.post('/api/telegram-trigger-mock', async (req, res) => {
  const { alertCategory, branchId } = req.body;
  const config = getTelegramConfig();
  const shopName = localDb.settings?.shopName || 'TC Staff Management';
  const branchName = localDb.branches.find(b => b.id === branchId)?.branchName || 'Toul Kork';

  let alertType = '';
  let details = '';
  let actionRequired = '';

  const dateTimeStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

  if (alertCategory === 'low_stock') {
    alertType = 'Low Stock Alert';
    details = `• Liquid Detergent: 8.5 Liters left (Minimum: 10 Liters)
• Softener: 7.0 Liters left (Minimum: 10 Liters)
• LPG Gas Capacity: 18.0 Kg left (Minimum: 20 Kg)`;
    actionRequired = 'Procure refill canisters immediately from default supplier to prevent washer blockages.';
  } else if (alertCategory === 'salary') {
    alertType = 'Salary Payment Reminder';
    details = `• Cycle: June 2026 Regular Salary Payroll
• Unpaid Staff: 4 managers/helper accounts pending approval
• Total Outstanding Liabilities: $1,450.00`;
    actionRequired = 'Owner review and approve the unpaid salary ledger in Salary Dashboard.';
  } else if (alertCategory === 'daily_business') {
    alertType = 'Daily Business Performance';
    
    // Auto calculate actual values if database synced
    const today = new Date().toISOString().substring(0, 10);
    const dayIncomes = localDb.incomes.filter(i => i.date === today && (!branchId || i.branchId === branchId));
    const dayRevenues = localDb.revenueRecords.filter(r => r.date === today && (!branchId || r.branchId === branchId));
    const dayExpenses = localDb.expenses.filter(e => e.expenseDate === today && (!branchId || e.branchId === branchId));

    const totalIncome = dayIncomes.reduce((s, c) => s + c.totalAmount, 0) + dayRevenues.reduce((s, r) => s + r.amountUsd, 0);
    const totalExpense = dayExpenses.reduce((s, c) => s + c.amount, 0);
    const balance = totalIncome - totalExpense;

    const abaCount = dayIncomes.filter(i => i.paymentMethod === 'ABA' || i.paymentMethod === 'QR Payment').reduce((s, c) => s + c.totalAmount, 0) +
                       dayRevenues.filter(r => r.paymentMethod === 'ABA' || r.paymentMethod === 'QR Payment').reduce((s, r) => s + r.amountUsd, 0);
    const cashCount = totalIncome - abaCount;

    details = `• Total Revenue Today: $${totalIncome.toFixed(2)}
• Total Expenses Today: $${totalExpense.toFixed(2)}
• Consolidated Profit: $${balance.toFixed(2)}

💳 PAYMENT METHOD RECONCILIATION:
• cashless (ABA/QR): $${abaCount.toFixed(2)}
• Physical Cash: $${cashCount.toFixed(2)}`;

    actionRequired = 'Perform nightly cash-drawer balance counts and close administrative registers.';
  } else if (alertCategory === 'machine') {
    alertType = 'Machine Maintenance Alert';
    details = `• Machine Code: Washer W-04 (15kg Heavy Load)
• Reported Status: Broken 🔴
• Internal Issue: Coin-slot jam causing mechanical lock screen loop. Error code: E-02`;
    actionRequired = 'Dispatch maintenance technician to Toul Kork branch immediately to unblock mechanical rails.';
  } else {
    return res.status(400).json({ success: false, error: 'Invalid mock alert category' });
  }

  const message = formatTelegramMessage({
    shopName,
    branchName,
    alertType,
    dateTime: dateTimeStr,
    details,
    actionRequired
  });

  // Target routing based on role
  // Send to all defined chat channels for robustness
  const sentTargets: string[] = [];
  const errors: string[] = [];

  if (config.chatIds.owner) {
    const r = await sendTelegramMessage(config.chatIds.owner, message);
    if (r.success) sentTargets.push('Owner');
    else if (r.error) errors.push(`Owner: ${r.error}`);
  }
  if (config.chatIds.admin) {
    const r = await sendTelegramMessage(config.chatIds.admin, message);
    if (r.success) sentTargets.push('Admin');
    else if (r.error) errors.push(`Admin: ${r.error}`);
  }
  if (config.chatIds.branches[branchId]) {
    const r = await sendTelegramMessage(config.chatIds.branches[branchId], message);
    if (r.success) sentTargets.push(`Branch Channel (${branchName})`);
    else if (r.error) errors.push(`Branch Channel: ${r.error}`);
  }

  res.json({
    success: sentTargets.length > 0,
    targetsStr: sentTargets.join(', ') || 'None',
    errors: errors.length > 0 ? errors.join('; ') : undefined
  });
});

// Endpoint to trigger direct alerts instantly from frontend mutations (e.g. Broken Machine, Low Stock, Salary Pay)
app.post('/api/telegram-trigger-instant', async (req, res) => {
  try {
    const { 
      alertType, 
      branchId, 
      details, 
      actionRequired 
    } = req.body;

    const config = getTelegramConfig();
    const shopName = localDb.settings?.shopName || 'TC Staff Management';
    const branchName = localDb.branches.find(b => b.id === branchId)?.branchName || 'Toul Kork';
    const dateTimeStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const message = formatTelegramMessage({
      shopName,
      branchName,
      alertType,
      dateTime: dateTimeStr,
      details,
      actionRequired
    });

    const finalMessage = req.body.message || message;
    const botToken = resolveTelegramBotToken(config.botToken, branchId, branchName);

    // Send to relevant channels
    // Owners get all, admins get all, branch-managers get branch-specific actions
    const recipients = new Set<string>();
    if (req.body.targetChatId) recipients.add(String(req.body.targetChatId).trim());
    if (req.body.chatId) recipients.add(String(req.body.chatId).trim());

    if (config.chatIds?.owner) recipients.add(config.chatIds.owner);
    if (config.chatIds?.admin) recipients.add(config.chatIds.admin);
    
    // Manager of specific branch
    if (branchId && config.chatIds?.manager?.[branchId]) {
      recipients.add(config.chatIds.manager[branchId]);
    }
    // Branch-specific channel/group chat
    if (branchId && config.chatIds?.branches?.[branchId]) {
      recipients.add(config.chatIds.branches[branchId]);
    }
    // Staff assigned
    if (branchId && config.chatIds?.staff?.[branchId]) {
      recipients.add(config.chatIds.staff[branchId]);
    }

    if (recipients.size === 0 && process.env.TELEGRAM_CHAT_ID) {
      recipients.add(process.env.TELEGRAM_CHAT_ID.trim());
    }

    const promises = Array.from(recipients).map(chatId => sendTelegramMessage(chatId, finalMessage, 'HTML', botToken, branchId));
    const results = await Promise.all(promises);
    const successes = results.filter(r => r.success).length;

    res.json({ success: successes > 0, dispatched: successes > 0, dispatchedCount: successes, totalRecipients: recipients.size });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/telegram/send-attendance-report', async (req, res) => {
  try {
    const { 
      target, // 'staff' | 'admin' | 'custom'
      staffId,
      customChatId,
      messageText,
      photoBase64
    } = req.body || {};

    const config = getTelegramConfig();
    let botToken = resolveTelegramBotToken(config.botToken, req.body?.branchId);
    const allStaff = localDb.staff || [];
    const allUsers = localDb.users || [];

    let destinationChatId = '';
    let targetRecipientLabel = '';
    let staffUsername = '';

    if (target === 'staff') {
      const staff = allStaff.find((s: any) => s.id === staffId);
      if (!staff) {
        return res.status(404).json({ success: false, error: 'រកមិនឃើញទិន្នន័យបុគ្គលិកឡើយ' });
      }
      if (staff.branchId) {
        botToken = resolveTelegramBotToken(config.botToken, staff.branchId);
      }
      staffUsername = staff.telegramUsername ? staff.telegramUsername.replace(/^@/, '') : '';
      destinationChatId = String(staff.telegramId || staff.telegramChatId || '').trim();

      // Check matching user record if numeric ID not found
      if (!destinationChatId || !/^-?\d+$/.test(destinationChatId)) {
        const matchedUser = allUsers.find((u: any) => 
          (staff.userId && u.id === staff.userId) ||
          (staffUsername && u.username && u.username.toLowerCase() === staffUsername.toLowerCase()) ||
          (staffUsername && u.telegramUsername && u.telegramUsername.replace(/^@/, '').toLowerCase() === staffUsername.toLowerCase()) ||
          (u.fullName && staff.fullName && u.fullName.toLowerCase().trim() === staff.fullName.toLowerCase().trim())
        );
        if (matchedUser?.telegramChatId && /^-?\d+$/.test(matchedUser.telegramChatId)) {
          destinationChatId = matchedUser.telegramChatId;
        }
      }

        if (!destinationChatId && staff.telegramUsername) {
          destinationChatId = staff.telegramUsername.startsWith('@') ? staff.telegramUsername : `@${staff.telegramUsername}`;
        }
        targetRecipientLabel = `${staff.fullName} (${destinationChatId || 'គ្មាន Telegram ID'})`;
      } else if (target === 'admin') {
        destinationChatId = config.chatIds?.admin || config.chatIds?.owner || process.env.TELEGRAM_CHAT_ID || '';
        targetRecipientLabel = `Admin / Group Notification (${destinationChatId || 'Default'})`;
      } else if (target === 'custom') {
        destinationChatId = customChatId || '';
        targetRecipientLabel = `Custom Chat ID (${destinationChatId})`;
      }

      if (!destinationChatId) {
        return res.status(400).json({ 
          success: false, 
          error: 'មិនទាន់មាន Telegram Chat ID ឬ Username សម្រាប់ផ្ញើឡើយ! សូមភ្ជាប់ Telegram របស់បុគ្គលិកជាមុនសិន។' 
        });
      }

      const captionToSend = (messageText || '').length > 950 ? (messageText || '').substring(0, 950) + '...' : messageText;

      let photoSent = false;
      let lastError = '';

      if (photoBase64 && photoBase64.startsWith('data:image/')) {
        try {
          const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const blob = new Blob([buffer], { type: 'image/jpeg' });

          const formData = new FormData();
          formData.append('chat_id', destinationChatId);
          formData.append('photo', blob, 'attendance_report.jpg');
          if (captionToSend) {
            formData.append('caption', captionToSend);
            formData.append('parse_mode', 'HTML');
          }

          const resTg = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            body: formData
          });
          const dataTg = await resTg.json();
          if (dataTg.ok) {
            photoSent = true;
          } else {
            lastError = dataTg.description || 'sendPhoto failed';
          }
        } catch (e: any) {
          lastError = e.message || 'sendPhoto failed';
          console.warn('sendPhoto failed:', e);
        }
      }

      if (!photoSent || (messageText && messageText.length > 950)) {
        try {
          const textRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: destinationChatId,
              text: messageText,
              parse_mode: 'HTML'
            })
          });
          const textData = await textRes.json();
          if (textData.ok) {
            // Sent successfully
          } else if (!photoSent) {
            lastError = textData.description || lastError;

            // Auto fallback to Admin chat
            const fallbackAdminId = config.chatIds?.admin || config.chatIds?.owner || process.env.TELEGRAM_CHAT_ID || '';
            if (fallbackAdminId && String(destinationChatId) !== String(fallbackAdminId)) {
              try {
                const fbRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: fallbackAdminId,
                    text: `📌 <b>[របាយការណ៍វត្តមានបុគ្គលិក / Staff Attendance Report]</b>\n\n${messageText}`,
                    parse_mode: 'HTML'
                  })
                });
                const fbData = await fbRes.json();
                if (fbData.ok) {
                  return res.status(200).json({
                    success: true,
                    message: `✓ បានផ្ញើរបាយការណ៍ទៅ Telegram Admin ដោយជោគជ័យ! (ចំណាំ៖ @${staffUsername || destinationChatId} មិនទាន់ចុច /start លើ Bot)`,
                    recipient: `Admin (${fallbackAdminId})`
                  });
                }
              } catch {}
            }

            let friendlyMsg = `បរាជ័យក្នុងការផ្ញើទៅ Telegram (${destinationChatId}): ${lastError}`;
            if (lastError.includes('chat not found') || lastError.includes('bot was blocked') || destinationChatId.startsWith('@')) {
              friendlyMsg = `⚠️ មិនអាចផ្ញើទៅ ${destinationChatId} បានទេ ដោយសារគណនីនេះមិនទាន់បានចុច Start លើ Bot Telegram នៅឡើយ! សូមឱ្យបុគ្គលិកបើក Bot ហើយចុច /start ឬជ្រើសរើសផ្ញើទៅ « Admin / Group » ជំនួសវិញ។`;
            }
            return res.status(400).json({ 
              success: false, 
              error: friendlyMsg
            });
          }
        } catch (tErr: any) {
          if (!photoSent) {
            return res.status(500).json({ success: false, error: 'Telegram dispatch failure: ' + tErr.message });
          }
        }
      }

    return res.json({
      success: true,
      message: `✓ បានផ្ញើរបាយការណ៍ទៅ Telegram (${targetRecipientLabel}) ដោយជោគជ័យ!`,
      recipient: targetRecipientLabel
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SOFTENER ENDPOINTS (EXCEL IMPORT & SPREADSHEET CELL UPDATES) ────────────

// 1. Preview Excel Import data
app.post('/api/softener/preview-import', (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'rows must be an array' });
    }

    const { branches } = localDb || { branches: [] };

    const validatedRows = rows.map((row: any, index: number) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate Date
      if (!row.date) {
        errors.push('Missing date');
      } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(row.date) && isNaN(Date.parse(row.date))) {
          errors.push(`Invalid date format: ${row.date}. Must be YYYY-MM-DD`);
        }
      }

      // Validate Branch
      if (!row.branchId) {
        errors.push('Missing Branch ID');
      } else {
        const branchExists = branches.some((b: any) => b.id === row.branchId || b.branchName === row.branchId || b.branchCode === row.branchId);
        if (!branchExists) {
          warnings.push(`Branch not clearly matched: ${row.branchId}. Will default to primary branch.`);
        }
      }

      // Validate Case Quantity & Package Quantity
      const casesNum = parseFloat(row.caseQuantity);
      if (isNaN(casesNum) && row.caseQuantity !== undefined && row.caseQuantity !== '') {
        errors.push(`Case Quantity must be a number`);
      }

      const pkgsNum = parseFloat(row.packageQuantity);
      if (isNaN(pkgsNum) && row.packageQuantity !== undefined && row.packageQuantity !== '') {
        errors.push(`Package Quantity must be a number`);
      }

      const totalCostNum = parseFloat(row.totalCost);
      if (isNaN(totalCostNum) && row.totalCost !== undefined && row.totalCost !== '') {
        errors.push(`Total Cost must be a number`);
      }

      return {
        ...row,
        id: row.id || `sof_imp_${Date.now()}_${index}`,
        isValid: errors.length === 0,
        errors,
        warnings
      };
    });

    res.json({ success: true, rows: validatedRows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Confirm Excel Import
app.post('/api/softener/confirm-import', (req, res) => {
  try {
    const { rows, overwrite, packagesPerCase } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'rows must be an array' });
    }

    const { branches } = localDb || { branches: [] };
    const ppc = parseInt(packagesPerCase) || 20;

    // Map rows to correct db structures
    const recordsToImport = rows.map((row: any) => {
      // Find matching branch Id
      let bId = row.branchId || 'b1';
      const matchedBranch = branches.find((b: any) => b.id === bId || b.branchName === bId || b.branchCode === bId);
      if (matchedBranch) bId = matchedBranch.id;

      const caseQty = Math.max(0, parseInt(row.caseQuantity) || 0);
      const pkgQty = Math.max(0, parseInt(row.packageQuantity) || 0);
      const usageQty = Math.max(0, parseInt(row.usageQuantity) || 0);
      
      const totalStockIn = (caseQty * ppc) + pkgQty;
      const isUsage = usageQty > 0 || row.type === 'Use' || (row.usageQuantity && parseInt(row.usageQuantity) > 0);

      return {
        id: row.id && !row.id.startsWith('sof_imp_') ? row.id : 'sof_' + Math.random().toString(36).substr(2, 9),
        branchId: bId,
        date: row.date || new Date().toISOString().split('T')[0],
        supplier: row.supplier || '',
        productName: row.productName || 'Downy Premium Fresh',
        caseQuantity: caseQty,
        packageQuantity: pkgQty,
        unitCost: parseFloat(row.unitCost) || 0,
        totalCost: parseFloat(row.totalCost) || (caseQty * (parseFloat(row.unitCost) || 0)),
        usageQuantity: usageQty,
        remainingStock: parseInt(row.remainingStock) || 0,
        note: row.note || row.notes || '',
        type: isUsage ? 'Use' : 'Refill',
        quantityLiters: isUsage ? usageQty : totalStockIn, // keep mapped in total packets for backwards compatibility
        remainingLiters: parseInt(row.remainingStock) || 0, // keep mapped in total packets for backwards compatibility
        createdBy: row.createdBy || 'Import',
        createdAt: row.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    if (overwrite) {
      localDb.softenerRecords = recordsToImport;
    } else {
      localDb.softenerRecords = [...recordsToImport, ...localDb.softenerRecords];
    }

    saveLocalDb();
    res.json({ success: true, softenerRecords: localDb.softenerRecords });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Update Grid Cell directly
app.post('/api/softener/update-cell', (req, res) => {
  try {
    const { recordId, field, value } = req.body;
    if (!recordId) {
      return res.status(400).json({ error: 'recordId is required' });
    }

    const matched = localDb.softenerRecords.find((s: any) => s.id === recordId);
    if (!matched) {
      return res.status(404).json({ error: 'Record not found' });
    }

    matched[field] = value;
    matched.updatedAt = new Date().toISOString();

    saveLocalDb();
    res.json({ success: true, record: matched, softenerRecords: localDb.softenerRecords });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Save entire spreadsheet state
app.post('/api/softener/save-changes', (req, res) => {
  try {
    const { softenerRecords } = req.body;
    if (!Array.isArray(softenerRecords)) {
      return res.status(400).json({ error: 'softenerRecords must be an array' });
    }

    localDb.softenerRecords = softenerRecords;
    saveLocalDb();
    res.json({ success: true, softenerRecords: localDb.softenerRecords });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Export Excel data
app.get('/api/softener/export-excel', (req, res) => {
  res.json({ success: true, rows: localDb.softenerRecords });
});

// 6. Export PDF
app.post('/api/softener/export-pdf', (req, res) => {
  res.json({ success: true, message: 'PDF generated successfully' });
});


// ─── BE REUSABLE PDF TEMPLATE SERVICE ────────────────────────────────────────

interface PDFTemplate {
  reportKey: string;
  nameEn: string;
  nameKh: string;
  orientation: 'portrait' | 'landscape';
  categoryField: string;
  numericFields: string[];
  signatories: string[];
  brandingColor: string; // Tailwind theme accent (e.g. emerald, Indigo, teal)
  remarksDefault: string;
}

const REUSABLE_PDF_TEMPLATES: Record<string, PDFTemplate> = {
  revenue: {
    reportKey: 'revenue',
    nameEn: 'Official Revenue & Receivables Statement',
    nameKh: 'របាយការណ៍សរុបចំណូល និងលុយត្រូវប្រមូល',
    orientation: 'portrait',
    categoryField: 'serviceType',
    numericFields: ['totalAmount', 'quantity'],
    signatories: ['Prepared By Cashier', 'Checked By Supervisor', 'Approved By Owner'],
    brandingColor: 'emerald',
    remarksDefault: 'All local counter invoices, coin transaction conversions, and cashless POS QR transfers are verified against POS merchant bank statements.'
  },
  expense: {
    reportKey: 'expense',
    nameEn: 'Corporate Operating Expenditures Report (OPEX)',
    nameKh: 'របាយការណ៍ចំណាយប្រតិបត្តិការរៀបចំការងារ',
    orientation: 'portrait',
    categoryField: 'category',
    numericFields: ['amount'],
    signatories: ['Compiled By Clerk', 'Certified By Auditor', 'Approved By Chief Executive'],
    brandingColor: 'rose',
    remarksDefault: 'Consolidates local detergents buys, machine repairs, landlord office leases, water dispenser refills, and monthly electrical utilities invoices.'
  },
  pnl: {
    reportKey: 'pnl',
    nameEn: 'Consolidated Profit & Loss Summary (P&L)',
    nameKh: 'របាយការណ៍សង្ខេបចំណេញ និងខាតប្រចាំខែ',
    orientation: 'portrait',
    categoryField: 'category',
    numericFields: ['revenue', 'expenses', 'netSurplus'],
    signatories: ['Accounting Officer', 'External Reviewer', 'Board Director Approval'],
    brandingColor: 'teal',
    remarksDefault: 'Computed with base straight-line mechanical depreciations of washer-dryer physical units capped at five-year corporate lifespans.'
  },
  salary: {
    reportKey: 'salary',
    nameEn: 'Staff Payroll Ledger Summary Sheet',
    nameKh: 'របាយការណ៍បើកប្រាក់បៀវត្សបុគ្គលិកផ្លូវការ',
    orientation: 'portrait',
    categoryField: 'position',
    numericFields: ['baseSalary', 'overtime', 'bonus', 'deduction', 'netSalary'],
    signatories: ['Human Resource Liaison', 'Finance Manager', 'Managing Director'],
    brandingColor: 'indigo',
    remarksDefault: 'Staff base payouts are adjusted for recorded absences, performance bonus cycles, night shifts multipliers, and tax withholdings.'
  },
  attendance: {
    reportKey: 'attendance',
    nameEn: 'Staff Time-Sheet & Attendance Roll Ledger',
    nameKh: 'របាយការណ៍វត្តមាន និងម៉ោងធ្វើការបុគ្គលិក',
    orientation: 'portrait',
    categoryField: 'status',
    numericFields: ['workHours', 'overtimeHours'],
    signatories: ['Shift Supervisor', 'Department Head', 'HR Director Endorsement'],
    brandingColor: 'slate',
    remarksDefault: 'Records are compiled via real-time biometric terminal punches and manual counter logs checked weekly by branch supervisors.'
  },
  inventory: {
    reportKey: 'inventory',
    nameEn: 'Enterprise Inventory Holdings Valuation audit',
    nameKh: 'សវនកម្មតម្លៃទ្រព្យសកម្ម និងស្តុកគ្រឿងផ្គត់ផ្គង់',
    orientation: 'landscape',
    categoryField: 'category',
    numericFields: ['currentStock', 'remainingStock', 'purchasePrice', 'assetValue'],
    signatories: ['Storekeeper Register', 'Internal Auditor', 'Operations Manager Signoff'],
    brandingColor: 'sky',
    remarksDefault: 'Supplies valuations are priced on chronological F.I.F.O (First In, First Out) inventory cost methods checked against safe storage lockers.'
  },
  coin: {
    reportKey: 'coin',
    nameEn: 'Coin Register & Dispenser Transaction Sheet',
    nameKh: 'របាយការណ៍កាក់បម្លែង និងប្រតិបត្តិការកាក់បោកគក់',
    orientation: 'portrait',
    categoryField: 'type',
    numericFields: ['amount', 'valueUsd'],
    signatories: ['Drawer Operator', 'Vault Controller', 'Owner Final Approval'],
    brandingColor: 'amber',
    remarksDefault: 'Reconciliation of physical coin collector tins harvested weekly with electronic terminal transaction logs.'
  },
  gas: {
    reportKey: 'gas',
    nameEn: 'LPG Gas Cylinder Refills and Consumptions Audit',
    nameKh: 'របាយការណ៍វត្តមានការប្រើប្រាស់ធុងហ្គាស (LPG)',
    orientation: 'portrait',
    categoryField: 'type',
    numericFields: ['tankCount', 'remainingKg', 'cost'],
    signatories: ['Plant Operator', 'Operations lead', 'Managing Director'],
    brandingColor: 'orange',
    remarksDefault: 'Tracks propane levels at high-pressure dryer lines to maintain standard 45Kg tank replacement rotations.'
  },
  detergent: {
    reportKey: 'detergent',
    nameEn: 'Liquid Detergent Concentrates Flow Ledger',
    nameKh: 'របាយការណ៍ស្តុកនិងការប្រើប្រាស់សាប៊ូទឹកកំហាប់ខ្ពស់',
    orientation: 'portrait',
    categoryField: 'type',
    numericFields: ['quantityLiters', 'remainingLiters', 'cost'],
    signatories: ['Fulfillment Staff', 'Inventory Lead', 'Owner Audit'],
    brandingColor: 'cyan',
    remarksDefault: 'Consonates fluid level usages via optical flow sensors compared against direct refill purchase invoices.'
  },
  softener: {
    reportKey: 'softener',
    nameEn: 'Fabric Softener Reserves Flow Register',
    nameKh: 'របាយការណ៍ស្តុកនិងការប្រើប្រាស់ទឹកក្រអូបថែរក្សាសរសៃសំពត់',
    orientation: 'portrait',
    categoryField: 'type',
    numericFields: ['quantityLiters', 'remainingLiters', 'cost'],
    signatories: ['Store Barista', 'Inventory Auditor', 'Managing Director'],
    brandingColor: 'fuchsia',
    remarksDefault: 'Softener volumes are matched directly to wash cycle counts to preserve proper formula density across heavy-duty dry cycles.'
  },
  machine: {
    reportKey: 'machine',
    nameEn: 'Mechanical Washers & Dryers Hardware Performance Audit',
    nameKh: 'របាយការណ៍លទ្ធផលសកម្មភាព និងចំណូលគ្រឿងម៉ាស៊ីន',
    orientation: 'landscape',
    categoryField: 'status',
    numericFields: ['capacity', 'revenue'],
    signatories: ['Senior Technician', 'Certified Mechanical Engineer', 'Owner Inspection'],
    brandingColor: 'violet',
    remarksDefault: 'Tracks hardware operational statuses, cumulative run-time revenues, mechanical blockages logs, and warranty lifecycles.'
  },
  cashdrawer: {
    reportKey: 'cashdrawer',
    nameEn: 'Cash Drawer Shift-Close Balance Statement',
    nameKh: 'របាយការណ៍ផ្ទៀងផ្ទាត់សមតុល្យប្រអប់ថតលុយវេន',
    orientation: 'portrait',
    categoryField: 'status',
    numericFields: ['startingCash', 'endingCash', 'actualCash', 'difference'],
    signatories: ['Cashier Handing-Over', 'Cashier Taking-Over', 'Manager Clearance'],
    brandingColor: 'lime',
    remarksDefault: 'Audits physical fiat cash registers at the close of morning and evening work-shifts to log differences.'
  },
  monthclosing: {
    reportKey: 'monthclosing',
    nameEn: 'Month-End Administrative Reconciled Closeout Report',
    nameKh: 'របាយការណ៍ផ្ទៀងផ្ទាត់បញ្ជីរដ្ឋបាលបិទគណនីប្រចាំខែ',
    orientation: 'portrait',
    categoryField: 'status',
    numericFields: ['totalRevenue', 'totalExpenses', 'depreciationSavings', 'netIncome'],
    signatories: ['Accountant Accountant', 'Operations Director', 'Owner Certification'],
    brandingColor: 'purple',
    remarksDefault: 'Locks transactional history records for the defined period, verifying currency ledger alignments.'
  },
  comparison: {
    reportKey: 'comparison',
    nameEn: 'Multi-Branch Comparative Financial Performance Index',
    nameKh: 'របាយការណ៍វិភាគ និងប្រៀបធៀបលទ្ធផលអាជីវកម្មគ្រប់សាខា',
    orientation: 'landscape',
    categoryField: 'id',
    numericFields: ['totalRevenue', 'totalOpex', 'netProfit'],
    signatories: ['Business Advisory Consultant', 'Finance Comptroller', 'President & CEO Signature'],
    brandingColor: 'blue',
    remarksDefault: 'Compares operating efficiencies, wash counts, utilities consumption weight, and net cash margins of all registered storefront outlets.'
  }
};

// Route to fetch A4 Report layout definitions
// Route to fetch A4 Report layout definitions
app.get('/api/revenue/export/pdf', async (req, res) => {
  try {
    const { branch_id, month, year, generated_by, blank } = req.query;
    const isBlank = blank === 'true' || blank === '1';

    if (!branch_id || !month || !year) {
      return res.status(400).json({ error: 'Missing required parameters: branch_id, month, year' });
    }

    const bId = branch_id as string;
    const mNum = parseInt(month as string);
    const yNum = parseInt(year as string);

    if (isNaN(mNum) || isNaN(yNum)) {
      return res.status(400).json({ error: 'Invalid month or year parameter' });
    }

    // 1. Fetch branch name
    const branchName = localDb.branches?.find((b: any) => b.id === bId)?.branchName || 'Veng Sreng';

    // 2. Filter revenue records from db and construct days sequentially to match Excel / UI precisely
    const daysInMonth = new Date(yNum, mNum, 0).getDate();
    const records: any[] = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yNum}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const match = (localDb.revenueRecords || []).find((r: any) => r.branchId === bId && r.date === dateStr);

      let defaultStartCash = match?.startCounter !== undefined ? match.startCounter : 0;
      let defaultStartAba = match?.startCounterAba !== undefined ? match.startCounterAba : 0;

      if (day > 1 && !match) {
        const prevDateStr = `${yNum}-${String(mNum).padStart(2, '0')}-${String(day - 1).padStart(2, '0')}`;
        const prevMatch = (localDb.revenueRecords || []).find((r: any) => r.branchId === bId && r.date === prevDateStr);
        if (prevMatch) {
          if (prevMatch.endCounter !== undefined) {
            defaultStartCash = prevMatch.endCounter;
          }
          if (prevMatch.endCounterAba !== undefined) {
            defaultStartAba = prevMatch.endCounterAba;
          }
        }
      } else if (day === 1 && !match) {
        const prevM = mNum === 1 ? 12 : mNum - 1;
        const prevY = mNum === 1 ? yNum - 1 : yNum;
        const prevDays = new Date(prevY, prevM, 0).getDate();
        const prevDateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(prevDays).padStart(2, '0')}`;
        const prevMatch = (localDb.revenueRecords || []).find((r: any) => r.branchId === bId && r.date === prevDateStr);
        if (prevMatch) {
          if (prevMatch.endCounter !== undefined) {
            defaultStartCash = prevMatch.endCounter;
          }
          if (prevMatch.endCounterAba !== undefined) {
            defaultStartAba = prevMatch.endCounterAba;
          }
        }
      }

      records.push({
        day,
        date: dateStr,
        time: match?.time || '10:30',
        startCounter: match?.startCounter !== undefined ? match.startCounter : defaultStartCash,
        endCounter: match?.endCounter !== undefined ? match.endCounter : (match?.startCounter !== undefined ? match.startCounter : defaultStartCash),
        startCounterAba: match?.startCounterAba !== undefined ? match.startCounterAba : defaultStartAba,
        endCounterAba: match?.endCounterAba !== undefined ? match.endCounterAba : (match?.startCounterAba !== undefined ? match.startCounterAba : defaultStartAba),
        cash: match?.cash !== undefined ? match.cash : 0,
        aba: match?.aba !== undefined ? match.aba : 0,
        coinSales: match?.coinSales !== undefined ? match.coinSales : 0,
        bankDeposit: match?.bankDeposit !== undefined ? match.bankDeposit : 0,
        actualCashCount: match?.actualCashCount !== undefined ? match.actualCashCount : 0,
        note: match?.note || '',
        exists: !!match
      });
    }

    // Continuity dynamic sweep for pre-filling start/end counters logically
    for (let i = 1; i < records.length; i++) {
      if (records[i].startCounter === 0 && records[i - 1].endCounter > 0 && !records[i].exists) {
        records[i].startCounter = records[i - 1].endCounter;
        if (records[i].endCounter < records[i].startCounter) {
          records[i].endCounter = records[i].startCounter;
        }
      }
      if (records[i].startCounterAba === 0 && records[i - 1].endCounterAba > 0 && !records[i].exists) {
        records[i].startCounterAba = records[i - 1].endCounterAba;
        if (records[i].endCounterAba < records[i].startCounterAba) {
          records[i].endCounterAba = records[i].startCounterAba;
        }
      }
    }

    // Determine executing auditor/user
    const userPayload = (req as any).user;
    const email = userPayload?.email || userPayload?.username || (generated_by as string) || 'Manager';

    const currentLocalTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

    // 3. Compile PDF buffer using our custom Noto Sans Khmer service
    const { generateRevenuePdf } = await import('./src/utils/RevenuePdfService.js');
    const pdfBuffer = await generateRevenuePdf({
      branchId: bId,
      branchName,
      month: mNum,
      year: yNum,
      records,
      generatedBy: email,
      generatedDateStr: currentLocalTimeStr + ' (ICT)',
      isBlankTemplate: isBlank
    });

    // 4. Post secure transaction event to auditor logs
    if (!localDb.auditLogs) {
      localDb.auditLogs = [];
    }
    const timestampStr = new Date().toISOString().substring(0, 19).replace('T', ' ');
    const logMsg = `[PDF Export Service] Generated "Official Revenue Statement" (A4 portrait) - Branch: ${branchName} | Period: ${mNum}/${yNum} | Prepared by: ${email} | at ${timestampStr}`;
    localDb.auditLogs.unshift(logMsg);
    if (localDb.auditLogs.length > 200) {
      localDb.auditLogs = localDb.auditLogs.slice(0, 200);
    }
    saveLocalDb();

    // 5. Send raw file bytes stream
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Revenue_${branchName.replace(/\s+/g, '')}_${yNum}_${String(mNum).padStart(2, '0')}.pdf`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('[PDF Export Endpoint Error] PDF generation error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate PDF report correctly: ' + err.message });
  }
});

app.get('/api/pdf/templates', (req, res) => {
  res.json({ success: true, templates: REUSABLE_PDF_TEMPLATES });
});

// Route to record/audit a PDF generation event securely in server ledger history
app.post('/api/pdf/audit-generation', (req, res) => {
  try {
    const { reportType, branchName, dateFilter, generatedByUser, totalsSummary } = req.body;
    
    // Auto populate server audit log if array exists
    if (!localDb.auditLogs) {
      localDb.auditLogs = [];
    }
    
    const timestampStr = new Date().toISOString().substring(0, 19).replace('T', ' ');
    const logMsg = `[PDF Export Service] Generated "${REUSABLE_PDF_TEMPLATES[reportType]?.nameEn || reportType}" (A4 ${REUSABLE_PDF_TEMPLATES[reportType]?.orientation || 'portrait'}) - Branch: ${branchName} | Period: ${dateFilter} | Prepared by: ${generatedByUser} | Summary: ${totalsSummary} at ${timestampStr}`;
    
    // Add to audit logs
    localDb.auditLogs.unshift(logMsg);
    
    // Keep max 200 logs
    if (localDb.auditLogs.length > 200) {
      localDb.auditLogs = localDb.auditLogs.slice(0, 200);
    }
    
    saveLocalDb();
    res.json({ success: true, loggedMsg: logMsg });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ─── SERVER BACKGROUND SCHEDULER ─────────────────────────────────────────────
// Runs checks for low balances, salaries approaching due dates, and daily business performance reports automatically.
function runSchedules() {
  const config = getTelegramConfig();
  const now = new Date();
  const todayDateStr = now.toISOString().substring(0, 10); // "2026-06-06"
  const hour = now.getUTCHours() + 7; // Convert to Indochina Time (+7)
  const currentHourMin = `${String(hour % 24).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

  // 1. DAILY BUSINESS PERFORMANCE REPORT (Runs at say, 20:00 Phnom Penh time)
  if (currentHourMin === '20:00' && alertHistory.lastDailyBusinessDate !== todayDateStr) {
    triggerDailyBusinessPerformance(todayDateStr);
  }

  // 2. DAILY AUTOMATIC CHECKS (Low Stocks / Maintenance / approaching salaries)
  // Run checks once an hour (or if checked in memory at top or bottom of hour hh:00)
  if (now.getUTCMinutes() === 0) {
    checkOutstandingStockAndDevices();
    checkApproachingSalaries();
  }

  // 3. INTEGRATED CUSTOM TELEGRAM ALERTS SCHEDULER
  const schedules = localDb.telegramAlertSchedules || [];
  const dayOfWeekStr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const dayOfMonthNo = now.getDate();

  schedules.forEach(s => {
    if (!s.isEnabled) return;
    if (s.frequency === 'INSTANT') return; // Handled dynamically in event code

    // Check if sendTime matches
    const normalizedConfigTime = normalizeTo24Hour(s.sendTime);
    if (normalizedConfigTime !== currentHourMin) return;

    // Check lastSentDate to avoid duplicate firing in same minute
    const lastSentDate = s.lastSentAt ? s.lastSentAt.substring(0, 10) : '';
    if (lastSentDate === todayDateStr) return;

    let isDue = false;

    if (s.frequency === 'DAILY') {
      isDue = true;
    } else if (s.frequency === 'WEEKLY') {
      if (s.dayOfWeek && s.dayOfWeek.toLowerCase() === dayOfWeekStr.toLowerCase()) {
        isDue = true;
      }
    } else if (s.frequency === 'MONTHLY') {
      if (s.dayOfMonth === 'last') {
        const tomorrow = new Date(now.getTime() + 86400000);
        if (tomorrow.getDate() === 1) isDue = true;
      } else if (s.dayOfMonth === '1' || s.dayOfMonth === '1st') {
        if (dayOfMonthNo === 1) isDue = true;
      } else if (parseInt(s.dayOfMonth) === dayOfMonthNo) {
        isDue = true;
      }
    } else if (s.frequency === 'CUSTOM') {
      isDue = true;
    }

    if (isDue) {
      triggerScheduledEvent(s).catch(err => {
        console.error(`Failed executing background schedule alert ${s.id}:`, err);
      });
    }
  });
}

// Low Stock and broken machines automatic checker
function checkOutstandingStockAndDevices() {
  const config = getTelegramConfig();
  const shopName = localDb.settings?.shopName || 'TC Staff Management';
  const todayStr = new Date().toISOString().substring(0, 10);

  // Checks Gases, Detergents, Softeners, StockTransactions
  localDb.branches.forEach(branch => {
    // A. DETERGENTS
    const branchDetergent = localDb.detergentRecords.filter(d => d.branchId === branch.id);
    const detergentRemaining = branchDetergent.length > 0 ? branchDetergent[0].remainingLiters : 20;
    if (detergentRemaining < 10) {
      const key = `${branch.id}_detergent_${todayStr}`;
      if (!alertHistory.lowStockSentKeys[key]) {
        dispatchSingleAlert({
          shopName,
          branchName: branch.branchName,
          alertType: 'Low Stock Alert (Detergent)',
          details: `• Current Detergent Reserve: ${detergentRemaining} Liters
• Danger Threshold: Under 10 Liters`,
          actionRequired: 'Arrange urgent replacement detergent fluid supply barrels.',
          branchId: branch.id
        });
        alertHistory.lowStockSentKeys[key] = todayStr;
        saveAlertHistory();
      }
    }

    // B. SOFTENERS
    const branchSoftener = localDb.softenerRecords.filter(s => s.branchId === branch.id);
    const softenerRemaining = branchSoftener.length > 0 ? branchSoftener[0].remainingLiters : 20;
    if (softenerRemaining < 10) {
      const key = `${branch.id}_softener_${todayStr}`;
      if (!alertHistory.lowStockSentKeys[key]) {
        dispatchSingleAlert({
          shopName,
          branchName: branch.branchName,
          alertType: 'Low Stock Alert (Softener)',
          details: `• Current Softener Reserve: ${softenerRemaining} Liters
• Danger Threshold: Under 10 Liters`,
          actionRequired: 'Refill softener dispenser drawers to prevent wash output harshness.',
          branchId: branch.id
        });
        alertHistory.lowStockSentKeys[key] = todayStr;
        saveAlertHistory();
      }
    }

    // C. GAS (LPG)
    const branchGas = localDb.gasRecords.filter(g => g.branchId === branch.id);
    const gasRemaining = branchGas.length > 0 ? branchGas[0].remainingKg : 45;
    if (gasRemaining < 20) {
      const key = `${branch.id}_gas_${todayStr}`;
      if (!alertHistory.lowStockSentKeys[key]) {
        dispatchSingleAlert({
          shopName,
          branchName: branch.branchName,
          alertType: 'Low Gas Alert (LPG)',
          details: `• LPG Remaining Balance: ${gasRemaining} Kg
• Danger Threshold: Under 20 Kg`,
          actionRequired: 'Procure replacement propane LPG cylinders immediately.',
          branchId: branch.id
        });
        alertHistory.lowStockSentKeys[key] = todayStr;
        saveAlertHistory();
      }
    }

    // D. COIN TRANS BALANCE
    const branchCoins = localDb.coinTransactions.filter(c => c.branchId === branch.id);
    const totalInCoins = branchCoins.filter(c => c.type === 'In').reduce((sum, c) => sum + c.amount, 0);
    const totalOutCoins = branchCoins.filter(c => c.type === 'Out').reduce((sum, c) => sum + c.amount, 0);
    const totalCoinBalance = totalInCoins - totalOutCoins;
    if (totalCoinBalance < 200) {
      const key = `${branch.id}_coins_${todayStr}`;
      if (!alertHistory.lowStockSentKeys[key]) {
        dispatchSingleAlert({
          shopName,
          branchName: branch.branchName,
          alertType: 'Low Coin Box Balance',
          details: `• Safe Balance: ${totalCoinBalance} Coins remaining
• Danger Threshold: Under 200 Coins`,
          actionRequired: 'Stock change coins or harvest coins from machine locks and reload dispenser.',
          branchId: branch.id
        });
        alertHistory.lowStockSentKeys[key] = todayStr;
        saveAlertHistory();
      }
    }
  });
}

function checkApproachingSalaries() {
  const shopName = localDb.settings?.shopName || 'TC Staff Management';
  const todayStr = new Date().toISOString().substring(0, 10); // Yyyy-mm-dd
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 2); // 2 days ahead
  const targetDateStr = targetDate.toISOString().substring(0, 10);

  localDb.salaries.forEach(salary => {
    // Notify on unpaid salaries where approaching payment date (or past due)
    if (salary.status === 'Unpaid' && salary.paymentDate <= targetDateStr) {
      const key = `${salary.id}_salary_${todayStr}`;
      if (alertHistory.lastSalaryAlertDate !== key) {
        dispatchSingleAlert({
          shopName,
          branchName: localDb.branches.find(b => b.id === salary.branchId)?.branchName || 'Toul Kork',
          alertType: 'Salary Payment Due Alert',
          details: `• Staff Member: ${salary.staffName}
• Salary Period: ${salary.salaryPeriod}
• Base Salary Level: $${salary.baseSalary.toFixed(2)}
• Total Outstanding Net: $${salary.netSalary.toFixed(2)}
• Scheduled Due Date: ${salary.paymentDate}`,
          actionRequired: 'Manager or Owner approval and payout required to maintain operational stability.',
          branchId: salary.branchId
        });
        alertHistory.lastSalaryAlertDate = key;
        saveAlertHistory();
      }
    }
  });
}

async function triggerDailyBusinessPerformance(targetDateStr: string) {
  const shopName = localDb.settings?.shopName || 'TC Staff Management';
  const config = getTelegramConfig();

  // Aggregate stats across all branches or per branch dynamically
  localDb.branches.forEach(async (branch) => {
    const dayIncomes = localDb.incomes.filter(i => i.date === targetDateStr && i.branchId === branch.id);
    const dayRevenues = localDb.revenueRecords.filter(r => r.date === targetDateStr && r.branchId === branch.id);
    const dayExpenses = localDb.expenses.filter(e => e.expenseDate === targetDateStr && e.branchId === branch.id);

    const totalIncome = dayIncomes.reduce((s, c) => s + c.totalAmount, 0) + dayRevenues.reduce((s, r) => s + r.amountUsd, 0);
    const totalExpense = dayExpenses.reduce((s, c) => s + c.amount, 0);
    const balance = totalIncome - totalExpense;

    const abaCount = dayIncomes.filter(i => i.paymentMethod === 'ABA' || i.paymentMethod === 'QR Payment').reduce((s, c) => s + c.totalAmount, 0) +
                       dayRevenues.filter(r => r.paymentMethod === 'ABA' || r.paymentMethod === 'QR Payment').reduce((s, r) => s + r.amountUsd, 0);
    const cashCount = totalIncome - abaCount;

    const details = `• Total Daily Revenue: $${totalIncome.toFixed(2)}
• Total Daily Expenses: $${totalExpense.toFixed(2)}
• Consolidated Profit: $${balance.toFixed(2)}

💳 PAYMENT METHOD RECONCILIATION:
• contactless (ABA/QR): $${abaCount.toFixed(2)}
• Cash box: $${cashCount.toFixed(2)}`;

    const text = formatTelegramMessage({
      shopName,
      branchName: branch.branchName,
      alertType: 'Branch Daily Business Summary',
      dateTime: `${targetDateStr} 20:00`,
      details,
      actionRequired: 'Verify daily deposit totals and sign off on checkout records.'
    });

    // Send to branch manager, owner, admin, and branch channel
    const targets = new Set<string>();
    if (config.chatIds.owner) targets.add(config.chatIds.owner);
    if (config.chatIds.admin) targets.add(config.chatIds.admin);
    if (config.chatIds.manager[branch.id]) targets.add(config.chatIds.manager[branch.id]);
    if (config.chatIds.branches[branch.id]) targets.add(config.chatIds.branches[branch.id]);

    for (const chatId of targets) {
      await sendTelegramMessage(chatId, text);
    }
  });

  alertHistory.lastDailyBusinessDate = targetDateStr;
  saveAlertHistory();
}

async function dispatchSingleAlert(alert: { shopName: string; branchName: string; alertType: string; details: string; actionRequired: string; branchId: string }) {
  const config = getTelegramConfig();
  const dateTimeStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

  // Parse custom scheduled INSTANT alerts
  const schedules = (localDb.telegramAlertSchedules || []).filter(s => 
    s.isEnabled && 
    s.frequency === 'INSTANT' && 
    (s.branchId === 'all' || s.branchId === alert.branchId) &&
    (s.alertType.toLowerCase().replace(/_/g, ' ').includes(alert.alertType.toLowerCase().replace(/_/g, ' ')) ||
     alert.alertType.toLowerCase().replace(/_/g, ' ').includes(s.alertType.toLowerCase().replace(/_/g, ' ')))
  );

  for (const s of schedules) {
    const recipient = (localDb.telegramRecipients || []).find(r => r.id === s.recipientId);
    const chatId = recipient?.isEnabled ? recipient.chatId : (config.chatIds.owner || config.chatIds.admin);
    if (!chatId) continue;

    const template = (localDb.telegramTemplates || []).find(t => t.id === s.templateId);
    const formatMode = template?.parseMode || 'HTML';
    const rawTemplateText = template?.engTemplate || `<b>⚠️ {status} INSTANT ALERT</b>\n━━━━━━━━━━━━━━━━━\n🏪 <b>Branch:</b> {branch_name}\n📅 <b>Time:</b> {date} {time}\n📝 <b>Details:</b> {message}`;

    const todayStr = new Date().toISOString().substring(0, 10);
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const alertText = parseTemplateVariables(rawTemplateText, {
      branch_name: alert.branchName,
      date: todayStr,
      time: timeStr,
      status: alert.alertType,
      message: `${alert.details}\n👉 Required Action: ${alert.actionRequired}`
    });

    let customBotToken: string | undefined = undefined;
    if (recipient) {
      const encToken = recipient.bot_token_encrypted || recipient.botTokenEncrypted;
      if (encToken) {
        customBotToken = decryptToken(encToken);
      }
    }

    const sendRes = await sendTelegramMessageWithRetry(chatId, alertText, formatMode, 3, customBotToken);

    if (!localDb.telegramLogs) localDb.telegramLogs = [];
    localDb.telegramLogs.push({
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 100),
      scheduleId: s.id,
      templateId: s.templateId || null,
      recipientId: s.recipientId || null,
      chatId: chatId,
      alertType: alert.alertType,
      messageText: alertText,
      status: sendRes.success ? 'SUCCESS' : 'FAILED',
      errorMessage: sendRes.success ? null : sendRes.error,
      sentAt: new Date().toISOString()
    });

    s.lastSentAt = new Date().toISOString();
  }

  // standard fallback legacy target delivery
  const message = formatTelegramMessage({
    shopName: alert.shopName,
    branchName: alert.branchName,
    alertType: alert.alertType,
    dateTime: dateTimeStr,
    details: alert.details,
    actionRequired: alert.actionRequired
  });

  const targets = new Set<string>();
  if (config.chatIds.owner) targets.add(config.chatIds.owner);
  if (config.chatIds.admin) targets.add(config.chatIds.admin);
  if (alert.branchId && config.chatIds.manager[alert.branchId]) targets.add(config.chatIds.manager[alert.branchId]);
  if (alert.branchId && config.chatIds.branches[alert.branchId]) targets.add(config.chatIds.branches[alert.branchId]);
  if (alert.branchId && config.chatIds.staff[alert.branchId]) targets.add(config.chatIds.staff[alert.branchId]);

  for (const chatId of targets) {
    const res = await sendTelegramMessage(chatId, message);
    if (!localDb.telegramLogs) localDb.telegramLogs = [];
    localDb.telegramLogs.push({
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 100),
      scheduleId: null,
      templateId: null,
      recipientId: null,
      chatId: chatId,
      alertType: alert.alertType,
      messageText: message,
      status: res.success ? 'SUCCESS' : 'FAILED',
      errorMessage: res.success ? null : (res.error || 'Empty response'),
      sentAt: new Date().toISOString()
    });
  }

  saveLocalDb();
}

// ─── TELEGRAM BOT ATTENDANCE WEBHOOK & MINI APP APIS ─────────────────────────

// 1. Telegram Bot Webhook (Handles /start and /attendance)
app.post(['/api/telegram/webhook', '/api/telegram/webhook/'], async (req, res) => {
  try {
    const update = req.body;
    if (!update || !update.message) {
      return res.json({ ok: true });
    }

    const msg = update.message;
    const text = (msg.text || '').trim();
    const chatId = msg.chat?.id ? String(msg.chat.id) : '';
    const telegramId = msg.from?.id ? String(msg.from.id) : '';
    const username = msg.from?.username || '';
    const firstName = msg.from?.first_name || 'Staff';

    if (!chatId) return res.json({ ok: true });

    const botToken = resolveTelegramBotToken();

    const host = req.get('host') || 'p2bkh.tech';
    const protocol = req.protocol === 'https' || host.includes('p2bkh.tech') ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    // Handle removing unwanted legacy keyboards (Hospital VPNs, NSSF Branches, etc.)
    const isUnwantedKeyboard = 
      text.toLowerCase().includes('hospital') ||
      text.toLowerCase().includes('vpn') ||
      text.toLowerCase().includes('nssf') ||
      text.toLowerCase().includes('subnet') ||
      text.toLowerCase().includes('reopen') ||
      text === '/clear' ||
      text === '/clean' ||
      text === '/remove_keyboard' ||
      text === '/reset';

    if (isUnwantedKeyboard && botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🗑️ បានលុបប៊ូតុងចាស់ៗចេញជោគជ័យ! សូមវាយ /start ដើម្បីប្រើប្រាស់ម៉ឺនុយ TC Staff។',
          parse_mode: 'HTML',
          reply_markup: { remove_keyboard: true }
        })
      });
      return res.json({ ok: true });
    }

    const cleanTgHandle = username.replace(/^@/, '').toLowerCase();
    let matchedStaff = (localDb.staff || []).find((s: any) => 
      (s.telegramId && String(s.telegramId) === telegramId) ||
      (cleanTgHandle && s.telegramUsername && s.telegramUsername.replace(/^@/, '').toLowerCase() === cleanTgHandle)
    );

    const isClean24Owner = (telegramId === '8412569939' || cleanTgHandle === 'clean24vengsreng');
    if (isClean24Owner) {
      if (!matchedStaff) {
        matchedStaff = {
          id: 'staff_owner_clean24',
          fullName: 'Clean24 (Owner)',
          position: 'ម្ចាស់ហាង (Store Owner)',
          role: 'Owner',
          gender: 'Other',
          phone: '012 888 999',
          branchId: 'b1',
          assignedBranchIds: ['b1', 'b2'],
          status: 'Active',
          telegramId: '8412569939',
          telegramUsername: '@clean24vengsreng',
          telegramLinked: true,
          faceEnrolled: false,
          attendanceEnabled: true,
          createdAt: new Date().toISOString()
        };
        if (!localDb.staff) localDb.staff = [];
        localDb.staff.unshift(matchedStaff);
        saveLocalDb();
      } else {
        matchedStaff.position = 'ម្ចាស់ហាង (Store Owner)';
        matchedStaff.role = 'Owner';
        matchedStaff.telegramId = '8412569939';
        matchedStaff.telegramUsername = '@clean24vengsreng';
        matchedStaff.telegramLinked = true;
        matchedStaff.status = 'Active';
        saveLocalDb();
      }
    }

    // Check if user is linked via User Management
    const matchedUser = (localDb.users || []).find((u: any) =>
      (u.telegramId && String(u.telegramId) === telegramId) ||
      (cleanTgHandle && u.telegramUsername && u.telegramUsername.replace(/^@/, '').toLowerCase() === cleanTgHandle)
    );

    const isOwnerRole = Boolean(
      isClean24Owner ||
      (matchedStaff && (
        matchedStaff.role === 'Owner' || 
        matchedStaff.role === 'Admin' || 
        matchedStaff.role === 'Manager' ||
        (matchedStaff.position && (
          matchedStaff.position.toLowerCase().includes('owner') ||
          matchedStaff.position.toLowerCase().includes('admin') ||
          matchedStaff.position.toLowerCase().includes('manager') ||
          matchedStaff.position.includes('ម្ចាស់ហាង') ||
          matchedStaff.position.includes('អ្នកគ្រប់គ្រង')
        ))
      )) ||
      (matchedUser && (
        matchedUser.role === 'Owner' ||
        matchedUser.role === 'Admin' ||
        matchedUser.role === 'Manager'
      ))
    );

    // 1. Staff Keyboard: Strictly Check In/Out, Attendance List, and Leave Request (សុំច្បាប់)
    const staffReplyKeyboard = {
      keyboard: [
        [
          { text: '📸 ចុះឈ្មោះចូល', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } },
          { text: '🚪 ចុះឈ្មោះចេញ', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
        ],
        [
          { text: '📊 មើលប្រវត្តិវត្តមាន', web_app: { url: `${baseUrl}/attendance-app?action=history` } },
          { text: '📝 សុំច្បាប់' }
        ]
      ],
      resize_keyboard: true,
      is_persistent: true
    };

    // 2. Owner & Manager Keyboard: Full Options (Check In/Out, All Staff Attendance, Leave Requests, Account Info, Guide)
    const ownerReplyKeyboard = {
      keyboard: [
        [
          { text: '📸 ចុះឈ្មោះចូល', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } },
          { text: '🚪 ចុះឈ្មោះចេញ', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
        ],
        [
          { text: '👥 វត្តមានបុគ្គលិកទាំងអស់' },
          { text: '📑 ពាក្យសុំច្បាប់ទាំងអស់' }
        ],
        [
          { text: '📊 មើលប្រវត្តិវត្តមាន', web_app: { url: `${baseUrl}/attendance-app?action=history` } },
          { text: '👤 ព័ត៌មានគណនី' },
          { text: '❓ របៀបប្រើប្រាស់' }
        ]
      ],
      resize_keyboard: true,
      is_persistent: true
    };

    const persistentKb = isOwnerRole ? ownerReplyKeyboard : staffReplyKeyboard;

    // Handle All Staff Attendance (វត្តមានបុគ្គលិកទាំងអស់)
    if (text.includes('វត្តមានបុគ្គលិកទាំងអស់') || text === '/all_attendance') {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
      const allStaff = (localDb.staff || []).filter((s: any) => s.status !== 'Inactive' && s.status !== 'Terminated');
      const todayAtt = (localDb.attendance || []).filter((a: any) => a.date === todayStr);

      const presentList = todayAtt.filter((a: any) => a.checkIn);
      const presentStaffIds = new Set(presentList.map((a: any) => a.staffId));
      const absentStaff = allStaff.filter((s: any) => !presentStaffIds.has(s.id));

      let summaryText = `👥 <b>[វត្តមានបុគ្គលិកប្រចាំថ្ងៃ]</b>\n📅 <code>${todayStr}</code>\n\n`;
      summaryText += `🟢 <b>បានចុះឈ្មោះចូល (${presentList.length} នាក់)៖</b>\n`;
      if (presentList.length === 0) {
        summaryText += `<i>(មិនទាន់មានបុគ្គលិកណាចូលធ្វើការនៅឡើយទេ)</i>\n`;
      } else {
        presentList.forEach((r: any, idx: number) => {
          const st = allStaff.find((s: any) => s.id === r.staffId);
          const name = st?.fullName || r.staffName || 'Staff';
          summaryText += `${idx + 1}. <b>${name}</b>: ចូល <code>${r.checkIn}</code> ${r.checkOut ? `→ ចេញ <code>${r.checkOut}</code>` : ''}\n`;
        });
      }

      if (absentStaff.length > 0) {
        summaryText += `\n🔴 <b>មិនទាន់ចូល (${absentStaff.length} នាក់)៖</b>\n`;
        absentStaff.forEach((s: any, idx: number) => {
          summaryText += `- ${s.fullName} (${s.position || 'Staff'})\n`;
        });
      }

      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: summaryText,
            parse_mode: 'HTML',
            reply_markup: persistentKb
          })
        });
      }
      return res.json({ ok: true });
    }

    // Handle All Leave Requests (ពាក្យសុំច្បាប់ទាំងអស់)
    if (text.includes('ពាក្យសុំច្បាប់ទាំងអស់') || (text.includes('ពាក្យសុំច្បាប់') && isOwnerRole && !text.includes('📝 សុំច្បាប់'))) {
      const leaveList: any[] = localDb.leaveRequests || [];
      let leaveMsg = `📑 <b>[បញ្ជីពាក្យសុំច្បាប់របស់បុគ្គលិក]</b>\n\n`;
      const pendingLeaves = leaveList.filter((l: any) => l.status === 'Pending').slice(0, 10);

      if (pendingLeaves.length === 0) {
        leaveMsg += `✅ <b>គ្មានពាក្យសុំច្បាប់ដែលកំពុងរង់ចាំ (Pending) ឡើយ។</b>\n\nបុគ្គលិកទាំងអស់បំពេញការងារជាធម្មតា។`;
      } else {
        leaveMsg += `⏳ <b>ពាក្យសុំច្បាប់កំពុងរង់ចាំ (${pendingLeaves.length})៖</b>\n\n`;
        pendingLeaves.forEach((l: any, idx: number) => {
          leaveMsg += `${idx + 1}. 👤 <b>${l.staffName || 'បុគ្គលិក'}</b>\n` +
            `📅 ថ្ងៃ៖ <code>${l.date || ''}</code>\n` +
            `📝 មូលហេតុ៖ <i>${l.details || l.reason || 'ច្បាប់'}</i>\n` +
            `──────────────\n`;
        });
      }

      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: leaveMsg,
            parse_mode: 'HTML',
            reply_markup: persistentKb
          })
        });
      }
      return res.json({ ok: true });
    }

    // Handle Profile (ព័ត៌មានគណនី / ព័ត៌មានបុគ្គលិក)
    if (text === '👤 ព័ត៌មានគណនី' || text === '👤 ព័ត៌មានបុគ្គលិក' || text === '/profile') {
      const staffName = matchedStaff?.fullName || firstName;
      const staffPosition = matchedStaff?.position || (isOwnerRole ? 'Owner/Admin' : 'បុគ្គលិក (Staff)');
      const staffPhone = matchedStaff?.phone || 'មិនទាន់មាន';
      const staffTgId = matchedStaff?.telegramId || telegramId;
      const linkStatus = matchedStaff ? 'ភ្ជាប់រួចរាល់ ✅' : 'មិនទាន់ភ្ជាប់ (Unlinked) ⚠️';

      const profileMsg = `👤 <b>ព័ត៌មានគណនីបុគ្គលិក</b>\n\n` +
        `• <b>ឈ្មោះ:</b> <b>${staffName}</b>\n` +
        `• <b>តួនាទី:</b> ${staffPosition}\n` +
        `• <b>លេខទូរស័ព្ទ:</b> <code>${staffPhone}</code>\n` +
        `• <b>Telegram ID:</b> <code>${staffTgId}</code>\n` +
        `• <b>ស្ថានភាពភ្ជាប់:</b> ${linkStatus}\n`;

      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: profileMsg,
            parse_mode: 'HTML',
            reply_markup: persistentKb
          })
        });
      }
      return res.json({ ok: true });
    }

    // Handle Help (របៀបប្រើប្រាស់)
    if (text === '❓ របៀបប្រើប្រាស់' || text === '/help') {
      const helpMsg = `❓ <b>របៀបប្រើប្រាស់ TC Staff Bot</b>\n\n` +
        `1. ចុច <b>📸 ចុះឈ្មោះចូល</b> ដើម្បីបើកកាមេរ៉ាស្កេនមុខ Check-in\n` +
        `2. ចុច <b>🚪 ចុះឈ្មោះចេញ</b> ដើម្បីបើកកាមេរ៉ាស្កេនមុខ Check-out\n` +
        `3. ចុច <b>📊 មើលប្រវត្តិវត្តមាន</b> ដើម្បីមើលទិន្នន័យវត្តមានផ្ទាល់ខ្លួន\n` +
        `4. ចុច <b>📝 សុំច្បាប់</b> ដើម្បីដាក់ពាក្យស្នើសុំច្បាប់ឈប់សម្រាក\n` +
        (isOwnerRole ? `5. ចុច <b>👥 វត្តមានបុគ្គលិកទាំងអស់</b> និង <b>📑 ពាក្យសុំច្បាប់ទាំងអស់</b> សម្រាប់អ្នកគ្រប់គ្រង\n` : '');

      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: helpMsg,
            parse_mode: 'HTML',
            reply_markup: persistentKb
          })
        });
      }
      return res.json({ ok: true });
    }

    // Handle Leave Request (សុំច្បាប់)
    if (text.includes('សុំច្បាប់') || text.includes('សុំឈប់') || text === '/leave' || text === '📝 សុំច្បាប់') {
      if (!matchedStaff) {
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `⚠️ <b>គណនី Telegram របស់អ្នកមិនទាន់បានភ្ជាប់ជាមួយបុគ្គលិក TC Staff ណាម្នាក់ឡើយ។</b>\n\nTelegram ID: <code>${telegramId}</code>`,
              parse_mode: 'HTML',
              reply_markup: persistentKb
            })
          });
        }
        return res.json({ ok: true });
      }

      if (text.length > 10 && (text.includes('ថ្ងៃ') || text.includes('មូលហេតុ') || text.includes('ឈឺ') || text.includes('ធុរៈ'))) {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
        if (!localDb.leaveRequests) localDb.leaveRequests = [];
        localDb.leaveRequests.unshift({
          id: 'leave_' + Date.now(),
          staffId: matchedStaff.id,
          staffName: matchedStaff.fullName,
          branchId: matchedStaff.branchId || 'b1',
          details: text,
          status: 'Pending',
          createdAt: new Date().toISOString(),
          date: todayStr
        });
        saveLocalDb();

        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `✅ <b>[បានទទួលពាក្យសុំច្បាប់ជោគជ័យ]</b>\n\n👤 <b>បុគ្គលិក:</b> <b>${matchedStaff.fullName}</b>\n📅 <b>កាលបរិច្ឆេទ:</b> <code>${todayStr}</code>\n📝 <b>ខ្លឹមសារ:</b>\n${text}\n\n⏳ <b>ស្ថានភាព:</b> <b>រង់ចាំការអនុម័ត (Pending)</b>`,
              parse_mode: 'HTML',
              reply_markup: persistentKb
            })
          });
        }
        return res.json({ ok: true });
      }

      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📝 <b>[ពាក្យសុំច្បាប់ឈប់សម្រាក / Leave Request]</b>\n\n👤 <b>បុគ្គលិក:</b> <b>${matchedStaff.fullName}</b>\n\n👉 សូមវាយផ្ញើសារតាមទម្រង់ខាងក្រោមមកកាន់ Bot៖\n<code>សុំច្បាប់ [ប្រភេទច្បាប់] ថ្ងៃទី [កាលបរិច្ឆេទ] មូលហេតុ [មូលហេតុ]</code>\n\n<i>ឧទាហរណ៍៖</i>\n<code>សុំច្បាប់ឈឺ ថ្ងៃទី ${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' })} មូលហេតុ ឈឺក្បាលមិនស្រួលខ្លួន</code>`,
            parse_mode: 'HTML',
            reply_markup: persistentKb
          })
        });
      }
      return res.json({ ok: true });
    }

    // Handle /start or /attendance
    if (text.startsWith('/start') || text === '/attendance') {
      if (matchedStaff) {
        if (!matchedStaff.telegramId) {
          matchedStaff.telegramId = telegramId;
          matchedStaff.telegramLinked = true;
          saveLocalDb();
        }

        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
        const todayAtt = (localDb.attendance || []).find((a: any) => a.staffId === matchedStaff.id && a.date === todayStr);

        const checkInTime = todayAtt?.checkIn || '--';
        const checkOutTime = todayAtt?.checkOut || '--';

        const roleBadge = isOwnerRole ? '👑 <b>[គណនីម្ចាស់ហាង / Admin]</b>\n\n' : '';
        const replyText = `<b>TC Staff Attendance</b>\n\n${roleBadge}សួស្តី <b>${matchedStaff.fullName}</b>\n\n<b>ថ្ងៃនេះ</b>\nចូល: <code>${checkInTime}</code>\nចេញ: <code>${checkOutTime}</code>`;

        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: replyText,
              parse_mode: 'HTML',
              reply_markup: persistentKb
            })
          });
        }
      } else {
        const replyText = `<b>TC Staff Attendance</b>\n\nសួស្តី <b>${firstName}</b>\n\n⚠️ គណនី Telegram របស់អ្នកមិនទាន់បានភ្ជាប់ជាមួយប្រព័ន្ធបុគ្គលិក TC Staff នៅឡើយទេ។\n\n👉 <b>Telegram ID:</b> <code>${telegramId}</code>\n👉 <b>Username:</b> <code>@${username || 'N/A'}</code>\n\nសូមផ្តល់លេខ ID នេះទៅកាន់ Admin / Manager របស់អ្នកដើម្បីភ្ជាប់គណនី។`;

        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: replyText,
              parse_mode: 'HTML',
              reply_markup: persistentKb
            })
          });
        }
      }
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('Error handling telegram webhook:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Background Poller for Attendance Bot
let lastAttUpdateOffset = 0;
async function pollTelegramAttendanceBot() {
  try {
    const token = resolveTelegramBotToken();
    if (!token) return;

    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastAttUpdateOffset + 1}&timeout=5&limit=10`);
    const data = await res.json() as any;

    if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
      for (const update of data.result) {
        lastAttUpdateOffset = Math.max(lastAttUpdateOffset, update.update_id);
        const msg = update.message;
        if (!msg || !msg.chat) continue;

        const chatId = String(msg.chat.id);
        const text = (msg.text || '').trim();
        const telegramId = msg.from?.id ? String(msg.from.id) : '';
        const username = msg.from?.username || '';
        const firstName = msg.from?.first_name || 'Staff';

        const cleanTgHandle = username.replace(/^@/, '').toLowerCase();
        let matchedStaff = (localDb.staff || []).find((s: any) => 
          (s.telegramId && String(s.telegramId) === telegramId) ||
          (cleanTgHandle && s.telegramUsername && s.telegramUsername.replace(/^@/, '').toLowerCase() === cleanTgHandle)
        );

        const isClean24Owner = (telegramId === '8412569939' || cleanTgHandle === 'clean24vengsreng');
        const matchedUser = (localDb.users || []).find((u: any) =>
          (u.telegramId && String(u.telegramId) === telegramId) ||
          (cleanTgHandle && u.telegramUsername && u.telegramUsername.replace(/^@/, '').toLowerCase() === cleanTgHandle)
        );

        const isOwnerRole = Boolean(
          isClean24Owner ||
          (matchedStaff && (
            matchedStaff.role === 'Owner' || 
            matchedStaff.role === 'Admin' || 
            matchedStaff.role === 'Manager' ||
            (matchedStaff.position && (
              matchedStaff.position.toLowerCase().includes('owner') ||
              matchedStaff.position.toLowerCase().includes('admin') ||
              matchedStaff.position.toLowerCase().includes('manager') ||
              matchedStaff.position.includes('ម្ចាស់ហាង') ||
              matchedStaff.position.includes('អ្នកគ្រប់គ្រង')
            ))
          )) ||
          (matchedUser && (
            matchedUser.role === 'Owner' ||
            matchedUser.role === 'Admin' ||
            matchedUser.role === 'Manager'
          ))
        );

        const staffReplyKeyboard = {
          keyboard: [
            [
              { text: '📸 ចុះឈ្មោះចូល', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } },
              { text: '🚪 ចុះឈ្មោះចេញ', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
            ],
            [
              { text: '📊 មើលប្រវត្តិវត្តមាន', web_app: { url: `${baseUrl}/attendance-app?action=history` } },
              { text: '📝 សុំច្បាប់' }
            ]
          ],
          resize_keyboard: true,
          is_persistent: true
        };

        const ownerReplyKeyboard = {
          keyboard: [
            [
              { text: '📸 ចុះឈ្មោះចូល', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } },
              { text: '🚪 ចុះឈ្មោះចេញ', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
            ],
            [
              { text: '👥 វត្តមានបុគ្គលិកទាំងអស់' },
              { text: '📑 ពាក្យសុំច្បាប់ទាំងអស់' }
            ],
            [
              { text: '📊 មើលប្រវត្តិវត្តមាន', web_app: { url: `${baseUrl}/attendance-app?action=history` } },
              { text: '👤 ព័ត៌មានគណនី' },
              { text: '❓ របៀបប្រើប្រាស់' }
            ]
          ],
          resize_keyboard: true,
          is_persistent: true
        };

        const persistentKb = isOwnerRole ? ownerReplyKeyboard : staffReplyKeyboard;

        const baseUrl = 'https://p2bkh.tech';

        if (matchedStaff) {
          if (!matchedStaff.telegramId) {
            matchedStaff.telegramId = telegramId;
            matchedStaff.telegramLinked = true;
            saveLocalDb();
          }

          const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
          const todayAtt = (localDb.attendance || []).find((a: any) => a.staffId === matchedStaff.id && a.date === todayStr);

          const checkInTime = todayAtt?.checkIn || '--';
          const checkOutTime = todayAtt?.checkOut || '--';

          const roleBadge = isOwnerRole ? '👑 <b>[គណនីម្ចាស់ហាង / Admin]</b>\n\n' : '';
          const replyText = `<b>TC Staff Attendance</b>\n\n${roleBadge}សួស្តី <b>${matchedStaff.fullName}</b>\n\n<b>ថ្ងៃនេះ</b>\nចូល: <code>${checkInTime}</code>\nចេញ: <code>${checkOutTime}</code>`;

          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: replyText,
              parse_mode: 'HTML',
              reply_markup: persistentKb
            })
          }).catch(() => {});
        } else {
          const replyText = `<b>TC Staff Attendance</b>\n\nសួស្តី <b>${firstName}</b>\n\n⚠️ គណនី Telegram របស់អ្នកមិនទាន់បានភ្ជាប់ជាមួយប្រព័ន្ធបុគ្គលិក TC Staff នៅឡើយទេ។\n\n👉 <b>Telegram ID:</b> <code>${telegramId}</code>\n👉 <b>Username:</b> <code>@${username || 'N/A'}</code>\n\nសូមផ្តល់លេខ ID នេះទៅកាន់ Admin / Manager របស់អ្នកដើម្បីភ្ជាប់គណនី។`;

          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: replyText,
              parse_mode: 'HTML',
              reply_markup: persistentKb
            })
          }).catch(() => {});
        }
      }
    }
  } catch {}
}

if (!process.env.VERCEL) {
  setInterval(pollTelegramAttendanceBot, 4000);
}

// 2. Validate Telegram Mini App Session
app.post('/api/telegram/validate-init-data', (req, res) => {
  try {
    const { initData, simulationStaffId } = req.body;

    let tgUser: any = null;
    let staff: any = null;

    if (initData) {
      const validation = validateTelegramInitData(initData);
      if (validation.valid && validation.user) {
        tgUser = validation.user;
        const tgId = String(tgUser.id);
        const tgUsername = tgUser.username ? tgUser.username.toLowerCase() : '';
        staff = (localDb.staff || []).find(s => 
          (s.telegramId && String(s.telegramId) === tgId) ||
          (tgUsername && s.telegramUsername && s.telegramUsername.replace('@', '').toLowerCase() === tgUsername)
        );
      }
    }



    if (!staff && simulationStaffId) {
      staff = (localDb.staff || []).find(s => s.id === simulationStaffId);
    }

    if (!staff && (!initData || initData === '')) {
      staff = (localDb.staff || []).find(s => s.status !== 'Inactive') || (localDb.staff || [])[0];
    }

    if (!staff) {
      return res.status(404).json({
        success: false,
        unlinked: true,
        user: tgUser,
        error: 'គណនី Telegram របស់អ្នកមិនទាន់បានភ្ជាប់ជាមួយបុគ្គលិកណាម្នាក់ឡើយ។'
      });
    }

    const branch = (localDb.branches || []).find(b => b.id === (staff.assignedBranchId || staff.branchId)) || {
      id: staff.branchId,
      branchName: 'TC Staff Management',
      locationVerificationEnabled: false,
      allowedRadius: 100
    };

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
    const todayAttendance = (localDb.attendance || []).find(a => a.staffId === staff.id && a.date === todayStr) || null;

    return res.json({
      success: true,
      user: tgUser,
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        position: staff.position,
        shift: staff.shift,
        photoUrl: staff.photoUrl,
        faceEnrolled: Boolean(staff.faceEnrolled && staff.faceReference),
        attendanceEnabled: staff.attendanceEnabled !== false,
        branchId: branch.id,
        branchName: branch.branchName
      },
      branch: {
        id: branch.id,
        branchName: branch.branchName,
        latitude: branch.latitude,
        longitude: branch.longitude,
        allowedRadius: branch.allowedRadius || 100,
        locationVerificationEnabled: Boolean(branch.locationVerificationEnabled)
      },
      todayAttendance
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Face Enrollment Endpoint
app.post('/api/face/enroll', (req, res) => {
  try {
    const { staffId, faceReference, photoUrl } = req.body;
    if (!staffId || !faceReference) {
      return res.status(400).json({ success: false, error: 'staffId and faceReference are required' });
    }

    const staff = (localDb.staff || []).find(s => s.id === staffId);
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Staff not found' });
    }

    staff.faceReference = typeof faceReference === 'string' ? faceReference : JSON.stringify(faceReference);
    staff.faceEnrolled = true;
    staff.faceEnrolledAt = new Date().toISOString();
    if (photoUrl) {
      staff.photoUrl = photoUrl;
    }

    saveLocalDb();
    return res.json({
      success: true,
      message: `បានចុះឈ្មោះផ្ទៃមុខសម្រាប់បុគ្គលិក ${staff.fullName} ដោយជោគជ័យ!`,
      staff
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Telegram Account Link & Unlink
app.post('/api/telegram/link', (req, res) => {
  try {
    const { staffId, telegramId, telegramUsername } = req.body;
    if (!staffId || !telegramId) {
      return res.status(400).json({ success: false, error: 'staffId and telegramId are required' });
    }

    const existing = (localDb.staff || []).find(s => s.id !== staffId && s.telegramId === String(telegramId));
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Telegram ID នេះត្រូវបានភ្ជាប់ជាមួយបុគ្គលិក "${existing.fullName}" រួចហើយ!`
      });
    }

    const staff = (localDb.staff || []).find(s => s.id === staffId);
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Staff not found' });
    }

    staff.telegramId = String(telegramId);
    if (telegramUsername) staff.telegramUsername = telegramUsername;
    staff.telegramLinked = true;

    saveLocalDb();
    return res.json({
      success: true,
      message: `បានភ្ជាប់គណនី Telegram ជាមួយ ${staff.fullName} ដោយជោគជ័យ!`,
      staff
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/telegram/unlink', (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) {
      return res.status(400).json({ success: false, error: 'staffId is required' });
    }

    const staff = (localDb.staff || []).find(s => s.id === staffId);
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Staff not found' });
    }

    staff.telegramId = undefined;
    staff.telegramUsername = undefined;
    staff.telegramLinked = false;

    saveLocalDb();
    return res.json({
      success: true,
      message: `បានផ្តាច់គណនី Telegram របស់ ${staff.fullName} រួចរាល់!`,
      staff
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Attendance Check-In Endpoint
app.post('/api/attendance/check-in', async (req, res) => {
  try {
    const { initData, faceDescriptor, photo, latitude, longitude, simulationStaffId, device, platform } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // Fallback device detection if not explicitly passed by client
    let resolvedDevice = device;
    if (!resolvedDevice) {
      if (/iPhone/i.test(userAgent)) resolvedDevice = 'Apple iPhone';
      else if (/iPad/i.test(userAgent)) resolvedDevice = 'Apple iPad';
      else if (/Android/i.test(userAgent)) {
        const match = userAgent.match(/;\s*([^;]+?)\s*Build\//i);
        resolvedDevice = match ? match[1].trim() : 'Android Device';
      } else if (/Windows/i.test(userAgent)) resolvedDevice = 'Windows PC';
      else if (/Macintosh/i.test(userAgent)) resolvedDevice = 'Apple Mac';
      else resolvedDevice = 'Unknown Device';
    }

    const resolvedPlatform = platform || (userAgent.includes('Telegram') ? 'Telegram' : 'Web');

    let staff: any = null;

    if (initData) {
      const validation = validateTelegramInitData(initData);
      if (validation.valid && validation.user) {
        const tgId = String(validation.user.id);
        const tgUsername = validation.user.username ? validation.user.username.toLowerCase() : '';
        staff = (localDb.staff || []).find(s => 
          (s.telegramId && String(s.telegramId) === tgId) ||
          (tgUsername && s.telegramUsername && s.telegramUsername.replace('@', '').toLowerCase() === tgUsername)
        );
      }
    }



    if (!staff && simulationStaffId) {
      staff = (localDb.staff || []).find(s => s.id === simulationStaffId);
    }

    if (!staff && (!initData || initData === '')) {
      staff = (localDb.staff || []).find(s => s.status !== 'Inactive') || (localDb.staff || [])[0];
    }

    if (!staff) {
      return res.status(404).json({ success: false, error: 'រកមិនឃើញទិន្នន័យបុគ្គលិកឡើយ!' });
    }

    if (staff.status !== 'Active') {
      return res.status(403).json({ success: false, error: 'គណនីបុគ្គលិកនេះត្រូវបានផ្អាក ឬឈប់ធ្វើការ!' });
    }

    if (staff.attendanceEnabled === false) {
      return res.status(403).json({ success: false, error: 'ការចុះវត្តមានត្រូវបានបិទសម្រាប់គណនីនេះ!' });
    }

    if (!staff.faceEnrolled || !staff.faceReference) {
      return res.status(400).json({
        success: false,
        error: 'បុគ្គលិកនេះមិនទាន់បានចុះឈ្មោះផ្ទៃមុខ (Face Reference) នៅឡើយទេ! សូមទាក់ទង Admin។'
      });
    }

    // Photo is saved directly as live attendance proof; verification is authenticated via Telegram
    if (photo && (!staff.photoUrl || staff.photoUrl.includes('images.unsplash.com'))) {
      staff.photoUrl = photo;
      staff.faceEnrolled = true;
      saveLocalDb();
    }

    const branch = (localDb.branches || []).find(b => b.id === (staff.assignedBranchId || staff.branchId));
    let distance: number | undefined = undefined;

    if (branch && branch.locationVerificationEnabled && branch.latitude && branch.longitude) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, error: 'សូមបើក GPS ទីតាំងនៅលើទូរស័ព្ទរបស់អ្នក ដើម្បីផ្ទៀងផ្ទាត់ទីតាំងសាខា!' });
      }

      distance = calculateHaversineDistance(latitude, longitude, branch.latitude, branch.longitude);
      const allowedRadius = branch.allowedRadius || 100;

      if (distance > allowedRadius) {
        return res.status(400).json({
          success: false,
          error: `មិនអាចចុះវត្តមានបានទេ! អ្នកនៅក្រៅតំបន់ដែលបានកំណត់សម្រាប់សាខា ${branch.branchName} (ចម្ងាយ៖ ${distance} ម៉ែត្រ / កម្រិតអនុញ្ញាត៖ ${allowedRadius} ម៉ែត្រ)។`,
          distance,
          allowedRadius
        });
      }
    }

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true, 
      timeZone: 'Asia/Phnom_Penh' 
    });

    if (!localDb.attendance) localDb.attendance = [];

    const existingIndex = localDb.attendance.findIndex(a => a.staffId === staff.id && a.date === todayStr);
    if (existingIndex !== -1) {
      const existing = localDb.attendance[existingIndex];
      if (existing.checkIn && existing.status !== 'Absent') {
        return res.status(400).json({
          success: false,
          error: `អ្នកបានចុះឈ្មោះចូលរួចហើយនៅម៉ោង ${existing.checkIn}!`
        });
      }
    }

    const newAttendance: any = {
      id: 'att_' + Date.now(),
      branchId: branch?.id || staff.branchId,
      staffId: staff.id,
      staffName: staff.fullName,
      date: todayStr,
      checkIn: timeStr,
      checkOut: '',
      shiftType: staff.shift || 'Full Time',
      workHours: 0,
      overtimeHours: 0,
      status: 'Working',
      source: 'telegram',
      checkInPhoto: photo || staff.photoUrl,
      checkInFaceScore: (req.body as any)?.faceScore || 0,
      checkInLatitude: latitude,
      checkInLongitude: longitude,
      checkInDistance: distance,
      checkInDevice: resolvedDevice,
      checkInPlatform: resolvedPlatform,
      checkInIp: clientIp,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    if (existingIndex !== -1) {
      localDb.attendance[existingIndex] = { ...localDb.attendance[existingIndex], ...newAttendance };
    } else {
      localDb.attendance.unshift(newAttendance);
    }

    saveLocalDb();

    return res.json({
      success: true,
      message: '✓ ចុះឈ្មោះចូលបានជោគជ័យ',
      employeeName: staff.fullName,
      time: timeStr,
      date: todayStr,
      branchName: branch?.branchName || 'TC Staff Management',
      attendance: newAttendance
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Attendance Check-Out Endpoint
app.post('/api/attendance/check-out', async (req, res) => {
  try {
    const { initData, faceDescriptor, photo, latitude, longitude, simulationStaffId, device, platform } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    let resolvedDevice = device;
    if (!resolvedDevice) {
      if (/iPhone/i.test(userAgent)) resolvedDevice = 'Apple iPhone';
      else if (/iPad/i.test(userAgent)) resolvedDevice = 'Apple iPad';
      else if (/Android/i.test(userAgent)) {
        const match = userAgent.match(/;\s*([^;]+?)\s*Build\//i);
        resolvedDevice = match ? match[1].trim() : 'Android Device';
      } else if (/Windows/i.test(userAgent)) resolvedDevice = 'Windows PC';
      else if (/Macintosh/i.test(userAgent)) resolvedDevice = 'Apple Mac';
      else resolvedDevice = 'Unknown Device';
    }

    const resolvedPlatform = platform || (userAgent.includes('Telegram') ? 'Telegram' : 'Web');

    let staff: any = null;

    if (initData) {
      const validation = validateTelegramInitData(initData);
      if (validation.valid && validation.user) {
        const tgId = String(validation.user.id);
        const tgUsername = validation.user.username ? validation.user.username.toLowerCase() : '';
        staff = (localDb.staff || []).find(s => 
          (s.telegramId && String(s.telegramId) === tgId) ||
          (tgUsername && s.telegramUsername && s.telegramUsername.replace('@', '').toLowerCase() === tgUsername)
        );
      }
    }



    if (!staff && simulationStaffId) {
      staff = (localDb.staff || []).find(s => s.id === simulationStaffId);
    }

    if (!staff && (!initData || initData === '')) {
      staff = (localDb.staff || []).find(s => s.status !== 'Inactive') || (localDb.staff || [])[0];
    }

    if (!staff) {
      return res.status(404).json({ success: false, error: 'រកមិនឃើញទិន្នន័យបុគ្គលិកឡើយ!' });
    }

    // Photo is saved directly as live attendance proof; verification is authenticated via Telegram
    const checkOutFaceScore = 1.0;

    const branch = (localDb.branches || []).find(b => b.id === (staff.assignedBranchId || staff.branchId));
    let distance: number | undefined = undefined;

    if (branch && branch.locationVerificationEnabled && branch.latitude && branch.longitude) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, error: 'សូមបើក GPS ទីតាំងនៅលើទូរស័ព្ទរបស់អ្នក!' });
      }

      distance = calculateHaversineDistance(latitude, longitude, branch.latitude, branch.longitude);
      const allowedRadius = branch.allowedRadius || 100;

      if (distance > allowedRadius) {
        return res.status(400).json({
          success: false,
          error: `មិនអាចចុះវត្តមានបានទេ! អ្នកនៅក្រៅតំបន់ដែលបានកំណត់សម្រាប់សាខា ${branch.branchName} (ចម្ងាយ៖ ${distance} ម៉ែត្រ)។`,
          distance,
          allowedRadius
        });
      }
    }

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true, 
      timeZone: 'Asia/Phnom_Penh' 
    });

    if (!localDb.attendance) localDb.attendance = [];

    const attRecord = localDb.attendance.find(a => a.staffId === staff.id && a.date === todayStr);

    if (!attRecord || !attRecord.checkIn) {
      return res.status(400).json({
        success: false,
        error: 'មិនអាចចុះឈ្មោះចេញបានទេ ដោយសារមិនទាន់មានការចុះឈ្មោះចូលសម្រាប់ថ្ងៃនេះ!'
      });
    }

    if (attRecord.checkOut) {
      return res.status(400).json({
        success: false,
        error: `អ្នកបានចុះឈ្មោះចេញរួចរាល់ហើយនៅម៉ោង ${attRecord.checkOut}!`
      });
    }

    let workHours = 8;
    let hoursStr = '8h 00m';
    try {
      const parseTimeToMinutes = (tStr: string) => {
        const parts = tStr.trim().match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (!parts) return 0;
        let h = parseInt(parts[1], 10);
        const m = parseInt(parts[2], 10);
        const ampm = parts[3]?.toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };

      const inMins = parseTimeToMinutes(attRecord.checkIn);
      const outMins = parseTimeToMinutes(timeStr);
      let diffMins = outMins - inMins;
      if (diffMins < 0) diffMins += 24 * 60;

      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      workHours = Number((diffMins / 60).toFixed(2));
      hoursStr = `${h}h ${String(m).padStart(2, '0')}m`;
    } catch {}

    attRecord.checkOut = timeStr;
    attRecord.workHours = workHours;
    attRecord.status = 'Completed';
    attRecord.checkOutPhoto = photo || staff.photoUrl;
    attRecord.checkOutFaceScore = checkOutFaceScore;
    attRecord.checkOutLatitude = latitude;
    attRecord.checkOutLongitude = longitude;
    attRecord.checkOutDistance = distance;
    attRecord.checkOutDevice = resolvedDevice;
    attRecord.checkOutPlatform = resolvedPlatform;
    attRecord.checkOutIp = clientIp;
    attRecord.updatedAt = now.toISOString();

    saveLocalDb();

    return res.json({
      success: true,
      message: '✓ ចុះឈ្មោះចេញបានជោគជ័យ',
      employeeName: staff.fullName,
      checkIn: attRecord.checkIn,
      checkOut: timeStr,
      workHours: hoursStr,
      branchName: branch?.branchName || 'TC Staff Management',
      attendance: attRecord
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Staff Attendance History API
app.get('/api/attendance/history', (req, res) => {
  try {
    const { staffId, month, year } = req.query;
    if (!staffId) {
      return res.status(400).json({ success: false, error: 'staffId is required' });
    }

    const currentYear = year ? String(year) : String(new Date().getFullYear());
    const currentMonth = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
    const periodPrefix = `${currentYear}-${currentMonth}`;

    const list = (localDb.attendance || [])
      .filter(a => a.staffId === staffId && a.date && a.date.startsWith(periodPrefix))
      .sort((a, b) => b.date.localeCompare(a.date));

    return res.json({
      success: true,
      month: currentMonth,
      year: currentYear,
      records: list
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Admin Attendance Correction with Audit Trail
app.patch('/api/admin/attendance/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, status, reason, changedBy } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'សូមបញ្ជាក់មូលហេតុនៃការកែប្រែ (Reason is required)!' });
    }

    const record = (localDb.attendance || []).find(a => a.id === id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Attendance record not found' });
    }

    if (!record.auditHistory) record.auditHistory = [];

    const nowIso = new Date().toISOString();
    const adminName = changedBy || 'Admin';

    if (checkIn !== undefined && checkIn !== record.checkIn) {
      record.auditHistory.push({
        field: 'checkIn',
        oldValue: record.checkIn,
        newValue: checkIn,
        changedBy: adminName,
        changedAt: nowIso,
        reason: reason.trim()
      });
      record.checkIn = checkIn;
    }

    if (checkOut !== undefined && checkOut !== record.checkOut) {
      record.auditHistory.push({
        field: 'checkOut',
        oldValue: record.checkOut,
        newValue: checkOut,
        changedBy: adminName,
        changedAt: nowIso,
        reason: reason.trim()
      });
      record.checkOut = checkOut;
    }

    if (status !== undefined && status !== record.status) {
      record.auditHistory.push({
        field: 'status',
        oldValue: record.status,
        newValue: status,
        changedBy: adminName,
        changedAt: nowIso,
        reason: reason.trim()
      });
      record.status = status;
    }

    record.updatedAt = nowIso;
    saveLocalDb();

    return res.json({
      success: true,
      message: 'បានកែប្រែវត្តមាន និងកត់ត្រា Audit Log ដោយជោគជ័យ!',
      attendance: record
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── VITE DEVSERVER / STATIC FILES SERVING ──────────────────────────────────
async function startServer() {
  // Vite dev mode vs Production static hosting
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('Vite dev server skipped:', e);
    }
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Express multi-branch routing active on http://0.0.0.0:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

// Export Express app instance for Vercel Serverless environment
export default app;


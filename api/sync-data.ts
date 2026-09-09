import { createClient } from '@supabase/supabase-js';
import dns from 'dns/promises';

let lastSupabaseErrorTime = 0;

const DEFAULT_USERS = [
  {
    id: 'usr_owner',
    username: 'roth',
    email: 'roth@p2bkh.tech',
    fullName: 'Roth (Executive Owner)',
    role: 'Owner',
    roleId: 'owner',
    status: 'Active',
    assignedBranchIds: [],
    telegramUsername: '',
    telegramChatId: '',
    twoFactorMethod: 'telegram'
  }
];

const DEFAULT_BRANCHES = [
  {
    id: 'b1',
    branchCode: 'C24-VS01',
    branchName: 'Veng Sreng Branch',
    address: 'Veng Sreng Blvd, Phnom Penh',
    phone: '012 888 999',
    managerId: 'usr_owner',
    managerName: 'Roth',
    openingTime: '06:00 AM',
    closingTime: '10:00 PM',
    status: 'Active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'b2',
    branchCode: 'C24-CD02',
    branchName: 'Chomka Doung Branch',
    address: 'Chomka Doung (St. 217), Phnom Penh',
    phone: '012 777 888',
    managerId: 'usr_owner',
    managerName: 'Roth',
    openingTime: '06:00 AM',
    closingTime: '10:00 PM',
    status: 'Active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  }
];

const DEFAULT_PAYLOAD: Record<string, any> = {
  branches: DEFAULT_BRANCHES,
  users: DEFAULT_USERS,
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
  suppliers: [],
  debts: [],
  debtPayments: [],
  cashDrawers: [],
  cashDrawerTransactions: [],
  monthClosings: [],
  salarySchedules: [],
  salaryAdvances: [],
  auditLogs: [],
  settings: {
    shopName: 'Clean24 Laundry',
    openingHours: '6:00 AM – 10:00 PM',
    mainCurrency: 'USD',
    khmerExchangeRate: 4100
  }
};

function getSupabaseClient() {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const supabaseKey = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = await getSupabaseClient();

  if (req.method === 'GET') {
    try {
      if (supabase) {
        let { data, error } = await supabase.from('tc_collections').select('*');
      if (error || !data || data.length === 0) {
        const alt = await supabase.from('clean24_collections').select('*');
        if (!alt.error && alt.data && alt.data.length > 0) {
          data = alt.data;
          error = null;
        }
      }
        if (!error && Array.isArray(data) && data.length > 0) {
          const db: Record<string, any> = { ...DEFAULT_PAYLOAD };
          for (const row of data) {
            if (row && row.id && row.data !== undefined) {
              db[row.id] = row.data;
            }
          }
          return res.status(200).json({
            success: true,
            data: db,
            db,
            source: 'supabase'
          });
        }
      }
    } catch (err: any) {
      lastSupabaseErrorTime = Date.now();
    }

    return res.status(200).json({
      success: true,
      data: DEFAULT_PAYLOAD,
      db: DEFAULT_PAYLOAD,
      source: 'fallback'
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    try {
      if (supabase) {
        const entries = Object.entries(body);
        const rows = entries.map(([collectionId, collectionData]) => ({
          id: collectionId,
          data: collectionData,
          updated_at: new Date().toISOString()
        }));
        if (rows.length > 0) {
          await supabase.from('clean24_collections').upsert(rows);
        }
        return res.status(200).json({
          success: true,
          data: body,
          db: body,
          source: 'supabase_upserted'
        });
      }
    } catch (err: any) {
      console.error('[Vercel Serverless] Supabase push error:', err.message);
    }

    return res.status(200).json({
      success: true,
      data: body,
      db: body,
      source: 'acknowledged'
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

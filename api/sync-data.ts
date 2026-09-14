import { createClient } from '@supabase/supabase-js';

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
    branchCode: 'TOTO-01',
    branchName: 'toto by Chichi',
    address: 'Phnom Penh, Cambodia',
    phone: '012 888 999',
    managerId: 'usr_owner',
    managerName: 'Owner / Manager',
    openingTime: '06:30 AM',
    closingTime: '09:30 PM',
    status: 'Active',
    latitude: 11.5300,
    longitude: 104.8800,
    allowedRadius: 100,
    locationVerificationEnabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'b2',
    branchCode: 'CORNER-02',
    branchName: 'Coffee corner',
    address: 'Phnom Penh, Cambodia',
    phone: '012 777 888',
    managerId: 'usr_owner',
    managerName: 'Owner / Manager',
    openingTime: '06:30 AM',
    closingTime: '09:30 PM',
    status: 'Active',
    latitude: 11.5400,
    longitude: 104.8900,
    allowedRadius: 100,
    locationVerificationEnabled: true,
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
  leaveRequests: [],
  extraShifts: [],
  tempShiftCovers: [],
  staffExpenses: [],
  adjustments: {},
  settings: {
    shopName: 'TC Staff Management',
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
    let lastError = null;
    try {
      if (supabase) {
        let tcRows: any[] = [];
        try {
          const { data, error } = await supabase.from('tc_collections').select('*');
          if (error) {
            lastError = error.message;
            console.error('[sync-data] Supabase select error:', error);
          } else if (Array.isArray(data)) {
            tcRows = data;
          }
        } catch (e: any) {
          lastError = e.message;
        }

        const collectionMap: Record<string, any> = {};
        for (const r of tcRows) {
          if (r && r.id && r.data !== undefined) {
            collectionMap[r.id] = r;
          }
        }

        const keys = Object.keys(collectionMap);
        if (keys.length > 0) {
          const db: Record<string, any> = { ...DEFAULT_PAYLOAD };
          for (const key of keys) {
            db[key] = collectionMap[key].data;
          }
          return res.status(200).json({
            success: true,
            data: db,
            db,
            source: 'supabase',
            collectionsCount: keys.length
          });
        }
      }
    } catch (err: any) {
      lastSupabaseErrorTime = Date.now();
      lastError = err.message;
    }

    return res.status(200).json({
      success: true,
      data: DEFAULT_PAYLOAD,
      db: DEFAULT_PAYLOAD,
      source: 'fallback',
      supabaseError: lastError
    });
  }

  if (req.method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    try {
      if (supabase) {
        const nowIso = new Date().toISOString();

        // 1. Explicit item deletion from a collection
        if (body.deleteCollectionItem && body.collection && body.itemId) {
          const { collection, itemId } = body;
          const { data: row } = await supabase.from('tc_collections').select('data').eq('id', collection).maybeSingle();
          const existingList = (row && Array.isArray(row.data)) ? row.data : [];
          const filtered = existingList.filter((item: any) => item && item.id !== itemId);
          const { error: delErr } = await supabase.from('tc_collections').upsert({
            id: collection,
            data: filtered,
            updated_at: nowIso
          });
          if (delErr) {
            console.error(`[sync-data] Failed to delete item ${itemId} from ${collection}:`, delErr);
            return res.status(500).json({ success: false, error: delErr.message });
          }
          return res.status(200).json({
            success: true,
            collection,
            remainingCount: filtered.length,
            deletedItemId: itemId,
            data: filtered
          });
        }

        // 2. Fetch existing collections
        const { data: existingRows } = await supabase.from('tc_collections').select('id, data');
        const existingMap: Record<string, any> = {};
        if (Array.isArray(existingRows)) {
          for (const row of existingRows) {
            if (row && row.id) existingMap[row.id] = row.data;
          }
        }

        const entries = Object.entries(body).filter(([k]) => k !== 'deleteCollectionItem' && k !== 'collection' && k !== 'itemId');
        const rows: any[] = [];

        for (const [collectionId, collectionData] of entries) {
          // Empty arrays are fully allowed (e.g. deleting staff, debts, etc down to 0)
          rows.push({
            id: collectionId,
            data: collectionData,
            updated_at: nowIso
          });
        }

        if (rows.length > 0) {
          const { error: upsertErr } = await supabase.from('tc_collections').upsert(rows);
          if (upsertErr) {
            console.error('[sync-data] Supabase upsert error:', upsertErr);
            return res.status(500).json({ success: false, error: upsertErr.message });
          }
        }
        return res.status(200).json({
          success: true,
          data: body,
          db: body,
          source: 'supabase_upserted',
          updatedCount: rows.length
        });
      }
    } catch (err: any) {
      console.error('[Vercel Serverless] Supabase push error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }

    return res.status(500).json({
      success: false,
      error: 'Supabase client is not configured on server (missing SUPABASE_URL or SUPABASE_ANON_KEY)'
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

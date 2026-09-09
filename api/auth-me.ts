import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dns from 'dns/promises';

const DEFAULT_USERS = [
  {
    id: 'usr_owner',
    username: 'roth',
    email: 'roth@p2bkh.tech',
    fullName: 'Roth (Executive Owner)',
    role: 'Owner',
    roleId: 'owner',
    status: 'Active',
    assignedBranchIds: ['b1', 'b2'],
    telegramUsername: '',
    telegramChatId: '',
    twoFactorMethod: 'telegram'
  }
];

function verifySessionToken(token: string): any {
  if (!token || typeof token !== 'string' || !token.startsWith('p2b_')) return null;
  const raw = token.substring(4);
  const dot = raw.indexOf('.');
  if (dot === -1) return null;
  const payloadStr = raw.substring(0, dot);
  const sig = raw.substring(dot + 1);
  const secret = process.env.JWT_SECRET || 'p2b_laundry_sec_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No session token found' });
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const session = verifySessionToken(token);

  // Look up user from Supabase
  const supabase = await getSupabase();
  let users: any[] = DEFAULT_USERS;
  if (supabase) {
    try {
      const { data } = await supabase.from('clean24_collections').select('data').eq('id', 'users').maybeSingle();
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        users = data.data;
      }
    } catch (e) {}
  }

  let matchedUser = null;
  if (session) {
    matchedUser = users.find(u => u.id === session.userId || u.username?.toLowerCase() === session.username?.toLowerCase());
    if (!matchedUser) {
      matchedUser = {
        id: session.userId,
        username: session.username,
        email: `${session.username}@p2bkh.tech`,
        fullName: session.username,
        role: session.role || 'Staff',
        roleId: session.roleId || 'staff',
        status: 'Active',
        assignedBranchIds: []
      };
    }
  } else {
    // If legacy token, fallback safely to roth
    matchedUser = users.find(u => u.username === 'roth') || DEFAULT_USERS[0];
  }

  return res.status(200).json({ success: true, user: matchedUser });
}
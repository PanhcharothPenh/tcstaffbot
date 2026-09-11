import { createClient } from '@supabase/supabase-js';

let lastUsersErrorTime = 0;

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

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

async function loadUsers(): Promise<any[]> {
  const supabase = await getSupabase();
  if (supabase) {
    try {
      let { data, error } = await supabase.from('tc_collections').select('data').eq('id', 'users').maybeSingle();
      if (!error && data && Array.isArray(data.data) && data.data.length > 0) {
        return data.data;
      }
    } catch (e) {
      lastUsersErrorTime = Date.now();
    }
  }
  return DEFAULT_USERS;
}

async function saveUsers(users: any[]) {
  const supabase = await getSupabase();
  if (supabase) {
    const payload = {
      id: 'users',
      data: users,
      updated_at: new Date().toISOString()
    };
    try {
      await supabase.from('tc_collections').upsert(payload);
    } catch (e) {
      console.warn('[users.ts] Failed to upsert to tc_collections:', e);
    }
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const parts = url.split('?')[0].split('/').filter(Boolean);
  const targetId = parts[2] || '';
  const subAction = parts[3] || '';

  const users = await loadUsers();

  if (req.method === 'GET') {
    if (targetId) {
      const user = users.find(u => u.id === targetId);
      if (user) return res.status(200).json({ success: true, user });
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({ success: true, users });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  if (req.method === 'POST') {
    const newUsername = String(body.username || '').trim().toLowerCase();

    if (!newUsername) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (users.some(u => u.username.toLowerCase() === newUsername)) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const rawTg = String(body.telegramChatId || body.telegramUsername || '').trim();
    const isTgNumeric = /^-?\d+$/.test(rawTg);
    const tgChatId = /^-?\d+$/.test(String(body.telegramChatId || '').trim())
      ? String(body.telegramChatId).trim()
      : (isTgNumeric ? rawTg : '');

    const newUser = {
      id: body.id || ('usr_' + Date.now()),
      username: newUsername,
      password: body.password ? String(body.password).trim() : '',
      email: body.email || `${newUsername}@p2bkh.tech`,
      fullName: body.fullName || newUsername,
      phone: body.phone || '',
      role: body.role || 'Staff',
      roleId: body.roleId || 'staff',
      status: 'Active',
      telegramUsername: isTgNumeric ? '' : (body.telegramUsername || ''),
      telegramChatId: tgChatId,
      twoFactorMethod: body.twoFactorMethod || 'disabled',
      assignedBranchIds: body.assignedBranchIds || [],
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await saveUsers(users);
    return res.status(201).json({ success: true, user: newUser });
  }

  if (req.method === 'PUT') {
    if (!targetId) return res.status(400).json({ error: 'User ID is required' });
    const idx = users.findIndex(u => u.id === targetId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    const rawTg = String(body.telegramChatId || body.telegramUsername || '').trim();
    const isTgNumeric = /^-?\d+$/.test(rawTg);
    const tgChatId = /^-?\d+$/.test(String(body.telegramChatId || '').trim())
      ? String(body.telegramChatId).trim()
      : (isTgNumeric ? rawTg : (users[idx].telegramChatId || ''));

    const updatedUser = {
      ...users[idx],
      ...body,
      id: targetId,
      telegramChatId: tgChatId,
      updatedAt: new Date().toISOString()
    };
    if (!body.password && users[idx].password) {
      updatedUser.password = users[idx].password;
    }
    users[idx] = updatedUser;
    await saveUsers(users);
    return res.status(200).json({ success: true, user: users[idx] });
  }

  if (req.method === 'PATCH' || (req.method === 'POST' && subAction === 'status')) {
    if (!targetId) return res.status(400).json({ error: 'User ID is required' });
    const idx = users.findIndex(u => u.id === targetId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    users[idx].status = body?.status || (users[idx].status === 'Active' ? 'Locked' : 'Active');
    users[idx].updatedAt = new Date().toISOString();
    await saveUsers(users);
    return res.status(200).json({ success: true, user: users[idx] });
  }

  if (req.method === 'DELETE') {
    if (!targetId) return res.status(400).json({ error: 'User ID is required' });
    if (targetId === 'usr_owner') return res.status(403).json({ error: 'Cannot delete primary owner' });

    const filtered = users.filter(u => u.id !== targetId);
    await saveUsers(filtered);
    return res.status(200).json({ success: true, message: 'User deleted' });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

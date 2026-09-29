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
  if (!supabase) {
    throw new Error('Supabase is not configured on server (missing SUPABASE_URL or SUPABASE_ANON_KEY)');
  }
  const payload = {
    id: 'users',
    data: users,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('tc_collections').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.warn('[users.ts] Supabase upsert error:', error.message, 'trying update...');
    const { error: updErr } = await supabase.from('tc_collections').update({
      data: users,
      updated_at: payload.updated_at
    }).eq('id', 'users');
    if (updErr) {
      console.warn('[users.ts] Supabase update error:', updErr.message, 'trying insert...');
      const { error: insErr } = await supabase.from('tc_collections').insert(payload);
      if (insErr) {
        console.error('[users.ts] Supabase insert error:', insErr);
        throw new Error(`Supabase error saving users: ${insErr.message}`);
      }
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

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const url = req.url || '';
  const urlPath = url.split('?')[0];
  const parts = urlPath.split('/').filter(Boolean);
  
  let targetId = '';
  let subAction = '';

  // 1. Direct URL Path: /api/users/usr_owner or /users/usr_owner
  if (parts.length >= 3 && (parts[0] === 'api' || parts[1] === 'users')) {
    targetId = parts[2] || '';
    subAction = parts[3] || '';
  } else if (parts.length >= 2 && parts[0] === 'users') {
    targetId = parts[1] || '';
    subAction = parts[2] || '';
  }

  // 2. From req.query (Vercel rewrite :path*)
  if (!targetId && req.query) {
    if (typeof req.query.path === 'string') {
      const qParts = req.query.path.split('/').filter(Boolean);
      targetId = qParts[0] || '';
      subAction = qParts[1] || '';
    } else if (Array.isArray(req.query.path) && req.query.path.length > 0) {
      targetId = req.query.path[0] || '';
      subAction = req.query.path[1] || '';
    } else if (req.query.id) {
      targetId = String(req.query.id).trim();
    }
  }

  // 3. Fallback from body.id
  if (!targetId && body && body.id) {
    targetId = String(body.id).trim();
  }

  try {
    const users = await loadUsers();

    if (req.method === 'GET') {
    if (targetId) {
      const user = users.find(u => u.id === targetId);
      if (user) return res.status(200).json({ success: true, user });
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({ success: true, users });
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
      twoFactorMethod: body.twoFactorMethod || 'telegram',
      assignedBranchIds: body.assignedBranchIds || [],
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await saveUsers(users);
    return res.status(201).json({ success: true, user: newUser });
  }

  if (req.method === 'PUT') {
    if (!targetId) return res.status(400).json({ error: 'User ID is required' });
    let idx = users.findIndex(u => u.id === targetId || u.username === targetId);
    if (idx === -1 && (targetId === 'usr_owner' || targetId === 'roth' || body.role === 'Owner' || body.roleId === 'owner')) {
      users.push({ ...DEFAULT_USERS[0] });
      idx = users.length - 1;
    }
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

  if (req.method === 'PATCH' || (req.method === 'POST' && (subAction === 'status' || subAction === 'reset-password' || subAction === 'assign-branches'))) {
    if (!targetId) return res.status(400).json({ error: 'User ID is required' });
    const idx = users.findIndex(u => u.id === targetId || u.username === targetId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    if (subAction === 'reset-password' || body.password) {
      users[idx].password = String(body.password || '').trim();
    }
    if (subAction === 'assign-branches' || body.assignedBranchIds) {
      users[idx].assignedBranchIds = Array.isArray(body.assignedBranchIds) ? body.assignedBranchIds : [];
    }
    if (subAction === 'status' || body.status) {
      users[idx].status = body.status || (users[idx].status === 'Active' ? 'Locked' : 'Active');
    }
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
  } catch (err: any) {
    console.error('[users.ts] Handler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error in users API' });
  }
}

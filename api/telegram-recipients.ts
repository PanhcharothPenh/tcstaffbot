import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabase();
  const url = req.url || '';
  const parts = url.split('?')[0].split('/').filter(Boolean);
  const targetId = parts[2] || '';

  let recipients: any[] = [];
  if (supabase) {
    try {
      const { data } = await supabase.from('tc_collections').select('data').eq('id', 'telegramRecipients').maybeSingle();
      if (data && Array.isArray(data.data)) recipients = data.data;
    } catch (e) {}
  }

  if (req.method === 'GET') {
    return res.status(200).json(recipients);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const newRec = {
      id: body.id || ('rec_' + Date.now()),
      name: body.name || 'Recipient',
      chatId: body.chatId || '',
      role: body.role || 'all',
      branchId: body.branchId || 'all',
      isActive: body.isActive !== undefined ? body.isActive : true,
      categories: body.categories || ['all'],
      createdAt: new Date().toISOString()
    };
    recipients.push(newRec);
    if (supabase) {
      try {
        await supabase.from('tc_collections').upsert({ id: 'telegramRecipients', data: recipients, updated_at: new Date().toISOString() });
      } catch (e) {}
    }
    return res.status(201).json(newRec);
  }

  if (req.method === 'PUT') {
    const idx = recipients.findIndex(r => r.id === targetId);
    if (idx === -1) return res.status(404).json({ error: 'Recipient not found' });
    recipients[idx] = { ...recipients[idx], ...req.body, id: targetId };
    if (supabase) {
      try {
        await supabase.from('tc_collections').upsert({ id: 'telegramRecipients', data: recipients, updated_at: new Date().toISOString() });
      } catch (e) {}
    }
    return res.status(200).json(recipients[idx]);
  }

  if (req.method === 'DELETE') {
    const filtered = recipients.filter(r => r.id !== targetId);
    if (supabase) {
      try {
        await supabase.from('tc_collections').upsert({ id: 'telegramRecipients', data: filtered, updated_at: new Date().toISOString() });
      } catch (e) {}
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
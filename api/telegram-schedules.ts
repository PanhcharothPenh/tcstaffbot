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

  let schedules: any[] = [];
  if (supabase) {
    try {
      const { data } = await supabase.from('tc_collections').select('data').eq('id', 'telegramSchedules').maybeSingle();
      if (data && Array.isArray(data.data)) schedules = data.data;
    } catch (e) {}
  }

  if (req.method === 'GET') {
    return res.status(200).json(schedules);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const newSchedule = {
      id: body.id || ('sched_' + Date.now()),
      title: body.title || 'Schedule',
      cron: body.cron || '0 8 * * *',
      timeOfDay: body.timeOfDay || '08:00',
      branchId: body.branchId || 'all',
      targetType: body.targetType || 'channel',
      recipientId: body.recipientId || '',
      category: body.category || 'daily_summary',
      isActive: body.isActive !== undefined ? body.isActive : true,
      lastRunAt: null,
      createdAt: new Date().toISOString()
    };
    schedules.push(newSchedule);
    if (supabase) {
      try {
        await supabase.from('tc_collections').upsert({ id: 'telegramSchedules', data: schedules, updated_at: new Date().toISOString() });
      } catch (e) {}
    }
    return res.status(201).json(newSchedule);
  }

  if (req.method === 'PUT') {
    const idx = schedules.findIndex(s => s.id === targetId);
    if (idx === -1) return res.status(404).json({ error: 'Schedule not found' });
    schedules[idx] = { ...schedules[idx], ...req.body, id: targetId };
    if (supabase) {
      try {
        await supabase.from('tc_collections').upsert({ id: 'telegramSchedules', data: schedules, updated_at: new Date().toISOString() });
      } catch (e) {}
    }
    return res.status(200).json(schedules[idx]);
  }

  if (req.method === 'DELETE') {
    const filtered = schedules.filter(s => s.id !== targetId);
    if (supabase) {
      try {
        await supabase.from('tc_collections').upsert({ id: 'telegramSchedules', data: filtered, updated_at: new Date().toISOString() });
      } catch (e) {}
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
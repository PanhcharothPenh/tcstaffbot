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

  let templates: any[] = [];
  if (supabase) {
    try {
      const { data } = await supabase.from('clean24_collections').select('data').eq('id', 'telegramTemplates').maybeSingle();
      if (data && Array.isArray(data.data)) templates = data.data;
    } catch (e) {}
  }

  if (req.method === 'GET') {
    return res.status(200).json(templates);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const newTemplate = {
      id: body.id || ('tmpl_' + Date.now()),
      title: body.title || 'New Template',
      category: body.category || 'general',
      templateText: body.templateText || '',
      variables: body.variables || [],
      createdAt: new Date().toISOString()
    };
    templates.push(newTemplate);
    if (supabase) {
      try {
        await supabase.from('clean24_collections').upsert({ id: 'telegramTemplates', data: templates, updated_at: new Date().toISOString() });
      } catch (e) {}
    }
    return res.status(201).json(newTemplate);
  }

  if (req.method === 'PUT') {
    const idx = templates.findIndex(t => t.id === targetId);
    if (idx === -1) return res.status(404).json({ error: 'Template not found' });
    templates[idx] = { ...templates[idx], ...req.body, id: targetId };
    if (supabase) {
      try {
        await supabase.from('clean24_collections').upsert({ id: 'telegramTemplates', data: templates, updated_at: new Date().toISOString() });
      } catch (e) {}
    }
    return res.status(200).json(templates[idx]);
  }

  if (req.method === 'DELETE') {
    const filtered = templates.filter(t => t.id !== targetId);
    if (supabase) {
      try {
        await supabase.from('clean24_collections').upsert({ id: 'telegramTemplates', data: filtered, updated_at: new Date().toISOString() });
      } catch (e) {}
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
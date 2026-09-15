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

  let targetId = '';
  if (req.query && req.query.path) {
    if (Array.isArray(req.query.path)) {
      targetId = req.query.path[0] || '';
    } else if (typeof req.query.path === 'string') {
      targetId = req.query.path.split('/')[0] || '';
    }
  }
  if (!targetId) {
    const url = req.url || '';
    const parts = url.split('?')[0].split('/').filter(Boolean);
    targetId = parts[2] || '';
  }

  let templates: any[] = [];
  if (supabase) {
    try {
      const { data, error } = await supabase.from('tc_collections').select('data').eq('id', 'telegramTemplates').maybeSingle();
      if (error) {
        console.error('[telegram-templates] Supabase fetch error:', error);
      } else if (data && Array.isArray(data.data)) {
        templates = data.data;
      }
    } catch (e: any) {
      console.error('[telegram-templates] Error fetching templates:', e.message);
    }
  }

  // Handle template testing
  if (targetId === 'test' && req.method === 'POST') {
    const { templateId, selectedLanguage, customChatId } = req.body || {};
    const tmpl = templates.find(t => t.id === templateId) || templates[0] || {};
    const rawText = (selectedLanguage === 'en' ? (tmpl.engTemplate || tmpl.templateText) : (tmpl.khmerTemplate || tmpl.templateText)) || 'TC Staff Notification Alert';

    const botToken = (
      process.env.TELEGRAM_BOT_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN_CODE ||
      process.env.BOT_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN_ATTENDANCE ||
      ''
    ).trim();

    const targetChatId = customChatId || '7818150707';

    if (botToken && targetChatId) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: String(targetChatId).trim(),
            text: `🧪 <b>[TC Staff Template Test]</b>\n\n${rawText}`,
            parse_mode: 'HTML'
          })
        });
        const tgData = await tgRes.json() as any;
        if (!tgData.ok) {
          return res.status(400).json({ success: false, error: tgData.description || 'Telegram dispatch failed' });
        }
        return res.status(200).json({
          success: true,
          message: 'Template notification dispatched cleanly to Telegram!',
          simulated: false,
          dispatched_text: rawText,
          recipientsOnMockLogs: [targetChatId]
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Template validated (Simulated preview).',
      simulated: true,
      dispatched_text: rawText,
      recipientsOnMockLogs: [targetChatId]
    });
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
      engTemplate: body.engTemplate || body.templateText || '',
      khmerTemplate: body.khmerTemplate || body.templateText || '',
      variables: body.variables || [],
      createdAt: new Date().toISOString()
    };
    const saveTemplates = async (data: any[]) => {
      if (!supabase) return null;
      const item = { id: 'telegramTemplates', data, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('tc_collections').upsert(item, { onConflict: 'id' });
      if (!error) return null;
      const { error: updErr } = await supabase.from('tc_collections').update({
        data,
        updated_at: item.updated_at
      }).eq('id', 'telegramTemplates');
      return updErr || null;
    };

    if (supabase) {
      const err = await saveTemplates(templates);
      if (err) return res.status(500).json({ error: err.message });
    }
    return res.status(201).json(newTemplate);
  }

  if (req.method === 'PUT') {
    const idx = templates.findIndex(t => t.id === targetId);
    if (idx === -1) return res.status(404).json({ error: 'Template not found' });
    templates[idx] = { ...templates[idx], ...req.body, id: targetId };
    if (supabase) {
      const item = { id: 'telegramTemplates', data: templates, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('tc_collections').upsert(item, { onConflict: 'id' });
      if (error) {
        const { error: updErr } = await supabase.from('tc_collections').update({
          data: templates,
          updated_at: item.updated_at
        }).eq('id', 'telegramTemplates');
        if (updErr) return res.status(500).json({ error: updErr.message });
      }
    }
    return res.status(200).json(templates[idx]);
  }

  if (req.method === 'DELETE') {
    const filtered = templates.filter(t => t.id !== targetId);
    if (supabase) {
      const item = { id: 'telegramTemplates', data: filtered, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('tc_collections').upsert(item, { onConflict: 'id' });
      if (error) {
        const { error: updErr } = await supabase.from('tc_collections').update({
          data: filtered,
          updated_at: item.updated_at
        }).eq('id', 'telegramTemplates');
        if (updErr) return res.status(500).json({ error: updErr.message });
      }
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
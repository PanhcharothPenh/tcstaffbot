import { createClient } from '@supabase/supabase-js';

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

  const botToken = 
    process.env.TELEGRAM_BOT_TOKEN_ATTENDANCE ||
    process.env.TELEGRAM_BOT_TOKEN_ATTENDENT ||
    process.env.TELEGRAM_ATTENDANCE_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN_CODE ||
    process.env.BOT_TOKEN;

  const queryUser = String(req.query?.username || req.query?.handle || '').replace(/^@/, '').trim().toLowerCase();

  // 1. Check recent user stored via Webhook from Supabase or match queryUser in registry
  const supabase = getSupabase();
  if (supabase) {
    try {
      if (queryUser) {
        let { data: regRow } = await supabase.from('tc_collections').select('data').eq('id', 'telegram_chat_registry').maybeSingle();
        const rArr = Array.isArray(regRow?.data) ? regRow.data : [];
        const matched = rArr.find((r: any) => {
          const u = String(r.username || '').replace(/^@/, '').toLowerCase().trim();
          return u === queryUser || String(r.chatId) === queryUser;
        });
        if (matched && matched.chatId) {
          return res.status(200).json({
            success: true,
            chatId: String(matched.chatId),
            username: matched.username ? String(matched.username).replace(/^@/, '') : queryUser,
            firstName: matched.firstName || 'User',
            date: matched.updatedAt || new Date().toISOString()
          });
        }
      }

      const { data } = await supabase.from('tc_collections').select('data').eq('id', 'telegramRecentUsers').maybeSingle();
      if (data && data.data && data.data.chatId) {
        return res.status(200).json({
          success: true,
          chatId: data.data.chatId,
          username: data.data.username || '',
          firstName: data.data.firstName || data.data.fullName || 'User',
          date: data.data.date || new Date().toISOString()
        });
      }
    } catch (e) {}
  }

  // 2. Fallback to Telegram getUpdates
  if (!botToken) {
    return res.status(200).json({
      success: false,
      configured: false,
      error: 'TELEGRAM_BOT_TOKEN_CODE is not set.'
    });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=10&offset=-10`);
    const data = await response.json() as any;

    if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
      for (let i = data.result.length - 1; i >= 0; i--) {
        const update = data.result[i];
        const msg = update.message || update.edited_message || update.channel_post;
        if (msg && msg.chat && msg.chat.id) {
          return res.status(200).json({
            success: true,
            chatId: String(msg.chat.id),
            username: msg.from?.username || msg.chat.username || '',
            firstName: msg.from?.first_name || msg.chat.first_name || 'User',
            date: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString()
          });
        }
      }
    }

    return res.status(200).json({
      success: false,
      error: 'No recent chat messages found. Please open your Telegram Bot and send /start first!'
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: err.message || 'Failed to connect to Telegram getUpdates API'
    });
  }
}
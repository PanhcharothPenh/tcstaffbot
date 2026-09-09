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

  if (req.method !== 'POST') {
    return res.status(200).json({ success: true, message: 'TC Staff Telegram Test Endpoint Active' });
  }

  const { chatId, branchId, message } = req.body || {};
  const bId = String(branchId || '').toLowerCase().trim();

  // Resolve bot token (Unified bot token first)
  let botToken = (
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN_CODE ||
    process.env.BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN_ATTENDANCE ||
    process.env.TELEGRAM_BOT_TOKEN_ATTENDENT ||
    process.env.TELEGRAM_ATTENDANCE_BOT_TOKEN ||
    ''
  ).trim();

  // If branch specific tokens exist as legacy fallback
  if (!botToken) {
    if (bId === 'b1' || bId.includes('veng') || bId.includes('vs')) {
      botToken = (
        process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG ||
        process.env.TELEGRAM_BOT_TOKEN_VENGSRENG ||
        process.env.TELEGRAM_BOT_TOKEN_VS ||
        process.env.TELEGRAM_BOT_TOKEN_B1 ||
        ''
      ).trim();
    } else if (bId === 'b2' || bId.includes('chomka') || bId.includes('cd')) {
      botToken = (
        process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG ||
        process.env.TELEGRAM_BOT_TOKEN_CHAMKAR_DOUNG ||
        process.env.TELEGRAM_BOT_TOKEN_CD ||
        process.env.TELEGRAM_BOT_TOKEN_B2 ||
        ''
      ).trim();
    }
  }

  if (!botToken) {
    botToken = (
      process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG ||
      process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG ||
      ''
    ).trim();
  }

  if (!botToken) {
    return res.status(400).json({ success: false, error: 'Telegram Bot Token is not configured. Please set TELEGRAM_BOT_TOKEN in Vercel.' });
  }

  if (!chatId) {
    return res.status(400).json({ success: false, error: 'Chat ID is required' });
  }

  const text = message || `🔔 <b>[TC Staff] សារសាកល្បងតេស្តប្រព័ន្ធ (Test Alert)</b>\n\n` +
    `🏢 <b>សាខា:</b> ${bId === 'b2' ? 'សាខា ចំការដូង' : 'សាខា វេងស្រេង'}\n` +
    `⏰ <b>ម៉ោង:</b> <code>${new Date().toLocaleTimeString()}</code>\n` +
    `✅ ការតភ្ជាប់រវាង TC Staff App និង Telegram Chat ដំណើរការយ៉ាងរលូន ១០០%!`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId).trim(),
        text,
        parse_mode: 'HTML'
      })
    });
    const data = await tgRes.json() as any;
    if (data.ok) {
      return res.status(200).json({ success: true, result: data.result });
    } else {
      return res.status(400).json({ success: false, error: data.description || 'Telegram API error' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

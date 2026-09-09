import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

function createSignedMfaToken(userId: string, code: string): string {
  const payload = { userId, code, expiresAt: Date.now() + 15 * 60 * 1000 };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = process.env.JWT_SECRET || 'p2b_laundry_sec_2026';
  const sig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `mfa_${payloadStr}.${sig}`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, usernameOrEmail } = req.body || {};
    const identifier = String(usernameOrEmail || email || '').trim().toLowerCase();

    if (!identifier) {
      return res.status(400).json({ error: 'សូមបញ្ចូលឈ្មោះគណនី ឬអ៊ីមែល (Username or email is required)' });
    }

    const cleanId = identifier.replace('@p2bkh.tech', '');
    const supabase = getSupabase();
    let users: any[] = [];
    if (supabase) {
      try {
        let { data, error } = await supabase.from('tc_collections').select('data').eq('id', 'users').maybeSingle();
        if (error || !data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'users').maybeSingle();
          if (alt.data) data = alt.data;
        }
        if (data && Array.isArray(data.data)) users = data.data;
      } catch (e) {}
    }

    let matchedUser = users.find(u => 
      u.username?.toLowerCase() === cleanId || 
      u.email?.toLowerCase() === identifier
    );

    if (!matchedUser && (cleanId === 'roth' || cleanId === 'owner')) {
      matchedUser = { id: 'usr_owner', username: 'roth', telegramChatId: '' };
    }

    if (!matchedUser) {
      return res.status(404).json({ error: 'រកមិនឃើញគណនីនេះក្នុងប្រព័ន្ធឡើយ (No user account found)' });
    }

    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    const mfaToken = createSignedMfaToken(matchedUser.id, randomPin);
    const botToken = 
      process.env.TELEGRAM_BOT_TOKEN_CODE || 
      process.env.TELEGRAM_BOT_TOKEN || 
      process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG ||
      process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG ||
      process.env.BOT_TOKEN;
    const targetChatId = matchedUser.telegramChatId || process.env.TELEGRAM_CHAT_ID || '';

    if (botToken) {
      const message = `🔑 <b>[Clean24 Password Reset PIN]</b>\n\nAccount: <b>@${matchedUser.username}</b>\nYour Password Reset PIN code is: <code>${randomPin}</code>\n\nValid for 15 minutes.`;
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: targetChatId, text: message, parse_mode: 'HTML' })
        }).catch(() => {});
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: 'Reset PIN code dispatched to Telegram',
      mfaToken,
      username: matchedUser.username
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to process password reset request' });
  }
}
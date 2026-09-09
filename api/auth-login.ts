import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

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

function createSignedMfaToken(userId: string, code: string, username: string): string {
  const payload = { userId, username, code, expiresAt: Date.now() + 15 * 60 * 1000 };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = process.env.JWT_SECRET || 'p2b_laundry_sec_2026';
  const sig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return 'mfa_' + payloadStr + '.' + sig;
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
    const { usernameOrEmail, password } = req.body || {};
    const identifier = String(usernameOrEmail || '').trim().toLowerCase();
    const inputPass = String(password || '').trim();

    if (!identifier || !inputPass) {
      return res.status(400).json({ error: 'សូមបញ្ចូលឈ្មោះគណនី និងលេខសម្ងាត់ (Username and password are required)' });
    }

    if (identifier === 'root' || identifier === 'root@laundry.com' || identifier === 'usr_root') {
      return res.status(401).json({ error: 'គណនី root ត្រូវបានលុបចេញពីប្រព័ន្ធជាស្ថាពរ' });
    }

    // Load registered users from Supabase Cloud Database
    const supabase = getSupabase();
    let users = DEFAULT_USERS;
    if (supabase) {
      try {
        let { data, error } = await supabase.from('tc_collections').select('data').eq('id', 'users').maybeSingle();
        if (error || !data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'users').maybeSingle();
          if (alt.data) data = alt.data;
        }
        if (data && Array.isArray(data.data) && data.data.length > 0) users = data.data;
      } catch (e) {}
    }

    const cleanId = identifier.replace('@p2bkh.tech', '');
    let matchedUser = users.find(u => 
      u.username?.toLowerCase() === cleanId || 
      u.email?.toLowerCase() === identifier ||
      u.username?.toLowerCase() === identifier
    );

    if (!matchedUser && (cleanId === 'roth' || cleanId === 'owner')) {
      matchedUser = DEFAULT_USERS[0];
    }

    if (!matchedUser && cleanId.length < 3) {
      return res.status(401).json({ error: 'ឈ្មោះគណនី ឬលេខសម្ងាត់មិនត្រឹមត្រូវឡើយ (Invalid login credentials)' });
    }

    if (matchedUser && matchedUser.status === 'Locked') {
      return res.status(403).json({ error: 'គណនីនេះត្រូវបានចាក់សោ (Account is locked. Please contact owner)' });
    }

    const userId = matchedUser?.id || 'usr_owner';
    const cleanUsername = matchedUser?.username || cleanId;
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const mfaToken = createSignedMfaToken(userId, otpCode, cleanUsername);

    // Dispatch 2FA PIN to specific User's Telegram
    const botToken = 
      process.env.TELEGRAM_BOT_TOKEN_CODE || 
      process.env.TELEGRAM_BOT_TOKEN || 
      process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG ||
      process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG ||
      process.env.TELEGRAM_BOT_TOKEN_ATTENDANCE ||
      process.env.BOT_TOKEN || 
      '';
    const isOwnerAccount = cleanUsername === 'roth' || cleanUsername === 'owner' || matchedUser?.role === 'Owner' || matchedUser?.roleId === 'owner';
    
    // Check if the user has a configured numeric Chat ID or Telegram handle
    const userTgChat = String(matchedUser?.telegramChatId || (matchedUser as any)?.telegramId || '').trim();
    const userTgHandle = String(matchedUser?.telegramUsername || '').replace(/^@/, '').trim().toLowerCase();

    let resolvedChatId: string | null = null;
    let dispatchSuccess = false;

    // 1. If user already has a numeric Telegram chat ID, use it directly!
    if (/^-?\d+$/.test(userTgChat)) {
      resolvedChatId = userTgChat;
    }

    // 2. Also check staff collection if user has linked Telegram on staff roster
    if (!resolvedChatId && supabase && (userTgHandle || cleanUsername)) {
      try {
        let { data: staffColl, error } = await supabase.from('tc_collections').select('data').eq('id', 'staff').maybeSingle();
        if (error || !staffColl) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'staff').maybeSingle();
          if (alt.data) staffColl = alt;
        }
        if (staffColl && Array.isArray(staffColl.data)) {
          const matchedSt = staffColl.data.find((s: any) => {
            const sUser = (s.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
            const sId = String(s.telegramId || '').trim();
            return /^-?\d+$/.test(sId) && ((userTgHandle && sUser === userTgHandle) || s.fullName?.toLowerCase() === cleanUsername);
          });
          if (matchedSt && matchedSt.telegramId) {
            resolvedChatId = String(matchedSt.telegramId);
          }
        }
      } catch (e) {}
    }

    // 3. Fall back to process.env.TELEGRAM_CHAT_ID ONLY for the Owner account, NEVER for other users!
    if (!resolvedChatId && isOwnerAccount && process.env.TELEGRAM_CHAT_ID && /^-?\d+$/.test(process.env.TELEGRAM_CHAT_ID)) {
      resolvedChatId = process.env.TELEGRAM_CHAT_ID;
    }

    // 4. Send message if a valid chat ID was resolved for THIS user
    if (botToken && resolvedChatId) {
      const text = `Your 2FA login verification code is: ${otpCode}`;
      try {
        const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: resolvedChatId, text })
        });
        const sendData = await sendRes.json() as any;
        if (sendData.ok) {
          dispatchSuccess = true;
        }
      } catch (tgErr) {}
    }

    return res.status(200).json({
      require2fa: true,
      mfaToken,
      method: 'telegram',
      simulatedOtp: otpCode,
      username: cleanUsername,
      user: matchedUser,
      dispatched: dispatchSuccess,
      telegramNotice: dispatchSuccess 
        ? `លេខកូដ PIN ត្រូវបានផ្ញើទៅកាន់ Telegram របស់លោកអ្នក (@${userTgHandle || cleanUsername}) រួចរាល់ហើយ។`
        : `សូមបើក Telegram រួចចុច Start លើ Bot @p2bkh_bot ដើម្បីឱ្យ Bot អាចផ្ញើលេខកូដមកកាន់គណនីរបស់អ្នកបាន។`
    });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Login failed' });
  }
}
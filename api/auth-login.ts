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
  const secret = process.env.JWT_SECRET || 'tc_staff_management_jwt_sec_2026';
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

    // Unified Bot Token resolution - strictly matches telegram-webhook.ts
    const botToken = (
      process.env.TELEGRAM_BOT_TOKEN_COFFEE ||
      process.env.TELEGRAM_BOT_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN_CODE ||
      process.env.BOT_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN_ATTENDANCE ||
      process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG ||
      process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG ||
      ''
    ).trim();

    const isOwnerAccount = cleanUsername === 'roth' || cleanUsername === 'owner' || matchedUser?.role === 'Owner' || matchedUser?.roleId === 'owner';
    
    // Check if user has numeric Telegram Chat ID or handle
    const userTgChat = String(matchedUser?.telegramChatId || (matchedUser as any)?.telegramId || '').trim();
    const userTgHandle = String(matchedUser?.telegramUsername || '').replace(/^@/, '').trim().toLowerCase();

    let resolvedChatId: string | null = null;
    let dispatchSuccess = false;
    let tgErrorDetail: string | null = null;

    // 1. Check user direct Chat ID
    if (/^-?\d+$/.test(userTgChat)) {
      resolvedChatId = userTgChat;
    }

    // 2. Query Supabase users table
    if (!resolvedChatId && supabase) {
      try {
        let { data: uRow } = await supabase.from('tc_collections').select('data').eq('id', 'users').maybeSingle();
        if (!uRow || !uRow.data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'users').maybeSingle();
          if (alt.data) uRow = alt;
        }
        if (uRow && Array.isArray(uRow.data)) {
          const found = uRow.data.find((u: any) => 
            u.id === userId || 
            (u.username && u.username.toLowerCase() === cleanUsername) ||
            (userTgHandle && u.telegramUsername && u.telegramUsername.replace(/^@/, '').toLowerCase() === userTgHandle)
          );
          if (found && /^-?\d+$/.test(String(found.telegramChatId || ''))) {
            resolvedChatId = String(found.telegramChatId);
          }
        }
      } catch (e) {}
    }

    // 3. Query Supabase staff table
    if (!resolvedChatId && supabase) {
      try {
        let { data: staffColl } = await supabase.from('tc_collections').select('data').eq('id', 'staff').maybeSingle();
        if (!staffColl || !staffColl.data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'staff').maybeSingle();
          if (alt.data) staffColl = alt;
        }
        if (staffColl && Array.isArray(staffColl.data)) {
          const matchedSt = staffColl.data.find((s: any) => {
            const sUser = (s.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
            const sId = String(s.telegramId || '').trim();
            return /^-?\d+$/.test(sId) && (
              (userTgHandle && sUser === userTgHandle) || 
              (s.fullName && s.fullName.toLowerCase() === cleanUsername) ||
              (cleanUsername === 'roth' && (sUser === 'millerppc' || sUser === 'roth'))
            );
          });
          if (matchedSt && matchedSt.telegramId) {
            resolvedChatId = String(matchedSt.telegramId);
          }
        }
      } catch (e) {}
    }

    // 4. Query telegramConfig for owner chat ID
    if (!resolvedChatId && supabase && isOwnerAccount) {
      try {
        let { data: cfgRow } = await supabase.from('tc_collections').select('data').eq('id', 'telegramConfig').maybeSingle();
        if (!cfgRow || !cfgRow.data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'telegramConfig').maybeSingle();
          if (alt.data) cfgRow = alt;
        }
        if (cfgRow && cfgRow.data) {
          const cfg = cfgRow.data;
          const ownerCid = cfg.chatIds?.owner || cfg.adminChatId || cfg.lastPrivateChatId || cfg.lastChatId;
          if (ownerCid && /^-?\d+$/.test(String(ownerCid))) {
            resolvedChatId = String(ownerCid);
          }
        }
      } catch (e) {}
    }

    // 5. Query telegram_chat_registry for latest active user/owner chat
    if (!resolvedChatId && supabase && isOwnerAccount) {
      try {
        let { data: regRow } = await supabase.from('tc_collections').select('data').eq('id', 'telegram_chat_registry').maybeSingle();
        if (!regRow || !regRow.data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'telegram_chat_registry').maybeSingle();
          if (alt.data) regRow = alt;
        }
        if (regRow && Array.isArray(regRow.data) && regRow.data.length > 0) {
          const matchEntry = regRow.data.find((r: any) => 
            r.isOwner || 
            r.username === 'roth' || 
            r.username === 'millerppc'
          ) || regRow.data[regRow.data.length - 1];
          if (matchEntry && /^-?\d+$/.test(String(matchEntry.chatId))) {
            resolvedChatId = String(matchEntry.chatId);
          }
        }
      } catch (e) {}
    }

    // 6. Fall back to process.env.TELEGRAM_CHAT_ID ONLY for Owner account
    if (!resolvedChatId && isOwnerAccount && process.env.TELEGRAM_CHAT_ID && /^-?\d+$/.test(process.env.TELEGRAM_CHAT_ID)) {
      resolvedChatId = process.env.TELEGRAM_CHAT_ID;
    }

    // 7. Dispatch 2FA PIN via Telegram Bot
    if (botToken && resolvedChatId) {
      const text = `លេខកូដផ្ទៀងផ្ទាត់សុវត្ថិភាពរបស់អ្នកគឺ៖ <code>${otpCode}</code>`;

      try {
        const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: resolvedChatId, 
            text, 
            parse_mode: 'HTML' 
          })
        });
        const sendData = await sendRes.json() as any;
        if (sendData.ok) {
          dispatchSuccess = true;
        } else {
          console.error('[2FA] Telegram API error:', sendData);
          tgErrorDetail = sendData.description || 'Telegram API Error';
        }
      } catch (tgErr: any) {
        console.error('[2FA] Telegram fetch exception:', tgErr);
        tgErrorDetail = tgErr.message || 'Network exception';
      }
    }

    // Production Response: NEVER expose simulatedOtp!
    return res.status(200).json({
      require2fa: true,
      mfaToken,
      method: 'telegram',
      username: cleanUsername,
      user: {
        id: matchedUser?.id || userId,
        username: cleanUsername,
        email: matchedUser?.email || `${cleanUsername}@p2bkh.tech`,
        fullName: matchedUser?.fullName || cleanUsername,
        role: matchedUser?.role || 'Staff',
        roleId: matchedUser?.roleId || 'staff',
        status: 'Active',
        assignedBranchIds: matchedUser?.assignedBranchIds || [],
        telegramUsername: matchedUser?.telegramUsername || userTgHandle || '',
        telegramChatId: resolvedChatId || '',
        twoFactorMethod: 'telegram'
      },
      dispatched: dispatchSuccess,
      telegramNotice: dispatchSuccess 
        ? `លេខកូដសុវត្ថិភាព 2FA ត្រូវបានផ្ញើទៅកាន់ Telegram (@TCStaffBot) របស់អ្នករួចរាល់ហើយ។`
        : (resolvedChatId 
            ? `មិនអាចផ្ញើលេខកូដទៅ Telegram បានទេ (${tgErrorDetail || 'Unknown Error'})។ សូមចុច /start លើ Bot @TCStaffBot ក្នុង Telegram។`
            : `រកមិនឃើញគណនី Telegram របស់អ្នកឡើយ។ សូមបើក Telegram រួចចុច /start លើ Bot @TCStaffBot ជាមុនសិន។`)
    });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Login failed' });
  }
}
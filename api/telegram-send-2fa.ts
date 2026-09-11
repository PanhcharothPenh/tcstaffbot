import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pinCode, username, clientChatId, targetChatId: bodyChatId, chatId } = req.body || req.query || {};

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

  const pin = String(pinCode || Math.floor(100000 + Math.random() * 900000)).trim();
  const cleanUsername = String(username || '').replace(/^@/, '').toLowerCase().trim();
  let explicitChatId = clientChatId || bodyChatId || chatId || '';
  const cleanTarget = String(explicitChatId || '').replace(/^@/, '').toLowerCase().trim();

  const chatIdsToSend = new Set<string>();

  // 1. Direct numeric chat ID if provided
  if (explicitChatId && /^-?\d+$/.test(String(explicitChatId).trim())) {
    chatIdsToSend.add(String(explicitChatId).trim());
  }

  // 2. Query Supabase users, staff, config, and registry
  const supabase = getSupabase();
  if (supabase && (cleanUsername || cleanTarget)) {
    try {
      // 2a. Check users
      let { data: uData } = await supabase.from('tc_collections').select('data').eq('id', 'users').maybeSingle();
      if (uData && Array.isArray(uData.data)) {
        for (const u of uData.data) {
          const uId = String(u.telegramChatId || u.telegramId || '').trim();
          const uUser = String(u.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
          const uAcc = String(u.username || '').toLowerCase().trim();
          const uEmail = String(u.email || '').toLowerCase().trim();
          if (
            (cleanUsername && (uAcc === cleanUsername || uUser === cleanUsername || uEmail.startsWith(cleanUsername))) ||
            (cleanTarget && (uUser === cleanTarget || uAcc === cleanTarget)) ||
            (cleanUsername === 'roth' && (uAcc === 'roth' || uUser === 'millerppc'))
          ) {
            if (/^-?\d+$/.test(uId)) chatIdsToSend.add(uId);
          }
        }
      }

      // 2b. Check staff
      let { data: sData } = await supabase.from('tc_collections').select('data').eq('id', 'staff').maybeSingle();
      if (sData && Array.isArray(sData.data)) {
        for (const s of sData.data) {
          const sId = String(s.telegramId || s.telegramChatId || '').trim();
          const sUser = String(s.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
          const sName = String(s.fullName || '').toLowerCase().trim();
          if (
            (cleanUsername && (sUser === cleanUsername || sName === cleanUsername || sName.includes(cleanUsername))) ||
            (cleanTarget && sUser === cleanTarget) ||
            (cleanUsername === 'roth' && (sUser === 'millerppc' || sUser === 'roth'))
          ) {
            if (/^-?\d+$/.test(sId)) chatIdsToSend.add(sId);
          }
        }
      }

      // 2c. Check telegramConfig
      if (chatIdsToSend.size === 0 && (cleanUsername === 'roth' || cleanUsername === 'owner')) {
        let { data: cfgRow } = await supabase.from('tc_collections').select('data').eq('id', 'telegramConfig').maybeSingle();
        if (cfgRow && cfgRow.data) {
          const cid = cfgRow.data.chatIds?.owner || cfgRow.data.adminChatId || cfgRow.data.lastPrivateChatId || cfgRow.data.lastChatId;
          if (cid && /^-?\d+$/.test(String(cid))) chatIdsToSend.add(String(cid));
        }
      }

      // 2d. Check telegram_chat_registry
      if (chatIdsToSend.size === 0 && (cleanUsername === 'roth' || cleanUsername === 'owner')) {
        let { data: regRow } = await supabase.from('tc_collections').select('data').eq('id', 'telegram_chat_registry').maybeSingle();
        if (regRow && Array.isArray(regRow.data) && regRow.data.length > 0) {
          const matchEntry = regRow.data.find((r: any) => r.isOwner || r.username === 'roth' || r.username === 'millerppc') || regRow.data[regRow.data.length - 1];
          if (matchEntry && /^-?\d+$/.test(String(matchEntry.chatId))) {
            chatIdsToSend.add(String(matchEntry.chatId));
          }
        }
      }
    } catch (e) {
      console.warn('[2FA] Supabase lookup error:', e);
    }
  }

  // 3. Fallback to process.env.TELEGRAM_CHAT_ID for owner if still empty
  if (chatIdsToSend.size === 0 && (cleanUsername === 'roth' || cleanUsername === 'owner')) {
    if (process.env.TELEGRAM_CHAT_ID && /^-?\d+$/.test(process.env.TELEGRAM_CHAT_ID)) {
      chatIdsToSend.add(process.env.TELEGRAM_CHAT_ID);
    }
  }

  // If no chat ID resolved, instruct user to open Telegram Bot
  if (chatIdsToSend.size === 0) {
    return res.status(200).json({
      success: true,
      dispatched: false,
      error: 'រកមិនឃើញគណនី Telegram របស់អ្នកឡើយ។ សូមបើក Telegram ហើយចុច /start លើ Bot ជាមុនសិន។'
    });
  }

  const message = `លេខកូដផ្ទៀងផ្ទាត់សុវត្ថិភាពរបស់អ្នកគឺ៖ <code>${pin}</code>`;

  let anySuccess = false;
  const dispatchResults: any[] = [];

  for (const cid of chatIdsToSend) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cid,
          text: message,
          parse_mode: 'HTML'
        })
      });
      const tgData = await tgRes.json() as any;
      if (tgData.ok) {
        anySuccess = true;
        dispatchResults.push({ chatId: cid, success: true });
      } else {
        dispatchResults.push({ chatId: cid, success: false, error: tgData.description });
      }
    } catch (err: any) {
      dispatchResults.push({ chatId: cid, success: false, error: err?.message });
    }
  }

  return res.status(200).json({
    success: true,
    dispatched: anySuccess,
    results: dispatchResults,
    message: anySuccess 
      ? 'លេខកូដសុវត្ថិភាព 2FA ត្រូវបានផ្ញើទៅកាន់ Telegram របស់អ្នករួចរាល់ហើយ!' 
      : 'មិនអាចផ្ញើទៅ Telegram បានទេ។ សូមប្រាកដថាអ្នកបានចុច /start លើ Bot ក្នុង Telegram។'
  });
}

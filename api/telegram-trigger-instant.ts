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
    return res.status(200).json({ success: true, message: 'Cafe Instant Telegram Alert Endpoint Active' });
  }

  const { 
    category, 
    message, 
    branchId, 
    branchName, 
    alertType, 
    details, 
    actionRequired,
    targetChatId,
    chatId 
  } = req.body || {};

  const bId = String(branchId || '').toLowerCase().trim();
  const bName = String(branchName || '').toLowerCase().trim();
  const isToto = bId === 'b1' || bId.includes('toto') || bId.includes('chichi') || bName.includes('toto') || bName.includes('chichi');
  const isCorner = bId === 'b2' || bId.includes('corner') || bId.includes('coffee') || bName.includes('corner') || bName.includes('coffee');

  // 1. Resolve Unified Telegram Bot Token
  let botToken = (
    process.env.TELEGRAM_BOT_TOKEN_COFFEE ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN_CODE ||
    process.env.BOT_TOKEN ||
    ''
  ).trim();

  // 2. Fetch Config, Recipients, and Chat Registry from Supabase
  const supabase = getSupabase();
  let storedConfig: any = null;
  let recipientsList: any[] = [];
  let chatRegistry: any[] = [];
  let allUsers: any[] = [];

  if (supabase) {
    try {
      let { data: cfg } = await supabase.from('tc_collections').select('data').eq('id', 'telegramConfig').maybeSingle();
      if (!cfg || !cfg.data) {
        const alt = await supabase.from('clean24_collections').select('data').eq('id', 'telegramConfig').maybeSingle();
        if (alt.data) cfg = alt;
      }
      if (cfg && cfg.data) storedConfig = cfg.data;

      let { data: recs } = await supabase.from('tc_collections').select('data').eq('id', 'telegramRecipients').maybeSingle();
      if (!recs || !recs.data) {
        const alt = await supabase.from('clean24_collections').select('data').eq('id', 'telegramRecipients').maybeSingle();
        if (alt.data) recs = alt;
      }
      if (recs && Array.isArray(recs.data)) recipientsList = recs.data;

      let { data: reg } = await supabase.from('tc_collections').select('data').eq('id', 'telegram_chat_registry').maybeSingle();
      if (reg && Array.isArray(reg.data)) chatRegistry = reg.data;

      let { data: uData } = await supabase.from('tc_collections').select('data').eq('id', 'users').maybeSingle();
      if (uData && Array.isArray(uData.data)) allUsers = uData.data;
    } catch (e) {
      console.warn('Supabase fetch error in telegram-trigger-instant:', e);
    }
  }

  if (!botToken && storedConfig?.botToken) {
    botToken = storedConfig.botToken.trim();
  }

  // 3. Resolve Target Chat IDs for this branch
  const targetChatIds = new Set<string>();

  if (targetChatId) targetChatIds.add(String(targetChatId).trim());
  if (chatId) targetChatIds.add(String(chatId).trim());

  // Check branch-specific Environment Variable chat IDs
  if (isToto) {
    const envB1Chat = (
      process.env.TELEGRAM_CHAT_ID_TOTO ||
      process.env.TELEGRAM_CHAT_ID_CHICHI ||
      process.env.TELEGRAM_CHAT_ID_B1 ||
      process.env.TELEGRAM_GROUP_ID_TOTO ||
      process.env.TELEGRAM_GROUP_ID_B1 ||
      process.env.CHAT_ID_TOTO ||
      process.env.CHAT_ID_B1 ||
      ''
    ).trim();
    if (envB1Chat) targetChatIds.add(envB1Chat);
  } else if (isCorner) {
    const envB2Chat = (
      process.env.TELEGRAM_CHAT_ID_CORNER ||
      process.env.TELEGRAM_CHAT_ID_COFFEE_CORNER ||
      process.env.TELEGRAM_CHAT_ID_B2 ||
      process.env.TELEGRAM_GROUP_ID_CORNER ||
      process.env.TELEGRAM_GROUP_ID_B2 ||
      process.env.CHAT_ID_CORNER ||
      process.env.CHAT_ID_B2 ||
      ''
    ).trim();
    if (envB2Chat) targetChatIds.add(envB2Chat);
  }

  // Stored Branch-specific chat IDs in Config
  if (storedConfig?.chatIds?.branches) {
    const bChats = storedConfig.chatIds.branches;
    if (branchId && bChats[branchId]) targetChatIds.add(String(bChats[branchId]).trim());
    if (isToto && (bChats.b1 || bChats['b1'] || bChats.toto || bChats['toto by Chichi'])) {
      targetChatIds.add(String(bChats.b1 || bChats['b1'] || bChats.toto || bChats['toto by Chichi']).trim());
    }
    if (isCorner && (bChats.b2 || bChats['b2'] || bChats.corner || bChats['Coffee corner'])) {
      targetChatIds.add(String(bChats.b2 || bChats['b2'] || bChats.corner || bChats['Coffee corner']).trim());
    }
  }

  // Branch manager chat IDs in Config
  if (storedConfig?.chatIds?.manager) {
    const mChats = storedConfig.chatIds.manager;
    if (branchId && mChats[branchId]) targetChatIds.add(String(mChats[branchId]).trim());
    if (isToto && (mChats.b1 || mChats['b1'] || mChats.toto)) {
      targetChatIds.add(String(mChats.b1 || mChats['b1'] || mChats.toto).trim());
    }
    if (isCorner && (mChats.b2 || mChats['b2'] || mChats.corner)) {
      targetChatIds.add(String(mChats.b2 || mChats['b2'] || mChats.corner).trim());
    }
  }

  // Check matching recipients
  if (recipientsList.length > 0) {
    for (const r of recipientsList) {
      if (r.isActive !== false && r.chatId) {
        const rBranch = String(r.branchId || '').toLowerCase().trim();
        const matchesBranch = 
          rBranch === 'all' || 
          !rBranch || 
          rBranch === bId ||
          (isToto && (rBranch === 'b1' || rBranch.includes('toto') || rBranch.includes('chichi'))) ||
          (isCorner && (rBranch === 'b2' || rBranch.includes('corner') || rBranch.includes('coffee')));

        if (matchesBranch) {
          if (!r.categories || r.categories.includes('all') || r.categories.includes(category)) {
            targetChatIds.add(String(r.chatId).trim());
          }
        }
      }
    }
  }

  // Always include Owner / Executive Admin for critical business notifications (Sales, Stock, Payroll)
  const ownerChat = storedConfig?.chatIds?.owner || storedConfig?.lastPrivateChatId || storedConfig?.chatIds?.admin;
  if (ownerChat && /^-?\d+$/.test(String(ownerChat))) {
    targetChatIds.add(String(ownerChat).trim());
  }

  // Also check chatRegistry for owner
  if (chatRegistry.length > 0) {
    const ownerReg = chatRegistry.find((r: any) => r.isOwner || r.username === 'roth' || r.username === 'millerppc') || chatRegistry[chatRegistry.length - 1];
    if (ownerReg?.chatId && /^-?\d+$/.test(String(ownerReg.chatId))) {
      targetChatIds.add(String(ownerReg.chatId).trim());
    }
  }

  // Also check users collection for owner's telegramChatId
  if (allUsers.length > 0) {
    const dbOwner = allUsers.find((u: any) => u.id === 'usr_owner' || u.username === 'roth' || u.role === 'Owner');
    if (dbOwner?.telegramChatId && /^-?\d+$/.test(String(dbOwner.telegramChatId))) {
      targetChatIds.add(String(dbOwner.telegramChatId).trim());
    }
  }

  if (process.env.TELEGRAM_CHAT_ID && /^-?\d+$/.test(process.env.TELEGRAM_CHAT_ID)) {
    targetChatIds.add(process.env.TELEGRAM_CHAT_ID.trim());
  }

  // 4. Construct message text
  let finalMessage = message;
  if (!finalMessage) {
    if (category === 'low_stock') {
      const branchDisplay = isToto ? 'toto by Chichi' : isCorner ? 'Coffee corner' : (branchName || 'Cafe Branch');
      finalMessage = `⚠️ <b>[Cafe - ការព្រមានស្តុកជិតអស់ / Low Stock Alert]</b>\n\n` +
        `☕ <b>សាខា:</b> <b>${branchDisplay}</b>\n` +
        `${details || ''}\n\n` +
        `🔔 <i>សូមអ្នកគ្រប់គ្រងសាខា ឬ Admin ត្រៀមកុម្ម៉ង់ទិញគ្រាប់កាហ្វេ/វត្ថុធាតុដើមបន្ថែមជាបន្ទាន់!</i>`;
    } else {
      const alertHeading = alertType || `[Cafe Alert: ${category || 'System'}]`;
      const detailsContent = details || 'Instant Notification Event';
      const actionContent = actionRequired ? `\n\n⚠️ <b>REQUIRED ACTION:</b>\n<u>${actionRequired}</u>` : '';
      finalMessage = `🚨 <b>${alertHeading}</b>\n\n${detailsContent}${actionContent}`;
    }
  }

  let dispatchedCount = 0;
  let lastError = null;

  if (botToken && targetChatIds.size > 0) {
    const sendPromises = Array.from(targetChatIds).map(async (cId) => {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: cId,
            text: finalMessage,
            parse_mode: 'HTML'
          })
        });
        const data = await tgRes.json() as any;
        if (data.ok) {
          return true;
        } else {
          lastError = data.description || 'Send failed';
          return false;
        }
      } catch (err: any) {
        lastError = err.message;
        return false;
      }
    });

    const results = await Promise.all(sendPromises);
    dispatchedCount = results.filter(Boolean).length;
  } else if (!botToken) {
    lastError = `Telegram Bot Token មិនទាន់ត្រូវបានកំណត់សម្រាប់សាខានេះ (${isToto ? 'toto by Chichi' : isCorner ? 'Coffee corner' : bId}) ឡើយ។`;
  } else if (targetChatIds.size === 0) {
    lastError = `រកមិនឃើញ Telegram Chat ID សម្រាប់សាខា (${isToto ? 'toto by Chichi / b1' : isCorner ? 'Coffee corner / b2' : bId}) ឡើយ។ សូម Add Bot ចូលក្នុង Group Telegram សាខា រួចវាយ /bind ដើម្បីភ្ជាប់!`;
  }

  // 5. Record audit log in Supabase
  if (supabase) {
    try {
      const { data } = await supabase.from('clean24_collections').select('data').eq('id', 'telegramLogs').maybeSingle();
      const logs = (data && Array.isArray(data.data)) ? data.data : [];
      logs.unshift({
        id: 'log_' + Date.now(),
        category: category || 'general',
        message: finalMessage ? finalMessage.substring(0, 300) : '',
        branchId: branchId || 'all',
        status: dispatchedCount > 0 ? 'SUCCESS' : 'FAILED',
        recipientsCount: targetChatIds.size,
        dispatchedCount,
        error: lastError,
        createdAt: new Date().toISOString()
      });
      if (logs.length > 500) logs.length = 500;
      await supabase.from('clean24_collections').upsert({ id: 'telegramLogs', data: logs, updated_at: new Date().toISOString() });
    } catch (e) {}
  }

  return res.status(200).json({ 
    success: dispatchedCount > 0, 
    dispatched: dispatchedCount > 0, 
    dispatchedCount, 
    totalRecipients: targetChatIds.size,
    branchId: branchId || 'all',
    error: lastError 
  });
}
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

async function loadDbCollection(supabase: any, id: string): Promise<any> {
  if (!supabase) return null;
  try {
    let { data, error } = await supabase.from('tc_collections').select('data').eq('id', id).maybeSingle();
    if (error || !data) {
      const alt = await supabase.from('clean24_collections').select('data').eq('id', id).maybeSingle();
      if (alt.data) data = alt;
    }
    return data?.data ?? null;
  } catch (e) {
    return null;
  }
}

async function saveDbCollection(supabase: any, id: string, payload: any): Promise<void> {
  if (!supabase) return;
  const item = { id, data: payload, updated_at: new Date().toISOString() };
  try {
    const res = await supabase.from('tc_collections').upsert(item);
    if (res.error) {
      await supabase.from('clean24_collections').upsert(item);
    }
  } catch (e) {
    try {
      await supabase.from('clean24_collections').upsert(item);
    } catch (_) {}
  }
}

interface CacheEntry {
  data: any;
  expires: number;
}
const MEM_CACHE: Record<string, CacheEntry> = {};

async function loadDbCollectionCached(supabase: any, id: string, ttlMs = 45000): Promise<any> {
  const now = Date.now();
  if (MEM_CACHE[id] && MEM_CACHE[id].expires > now) {
    return MEM_CACHE[id].data;
  }
  const fresh = await loadDbCollection(supabase, id);
  if (fresh !== null) {
    MEM_CACHE[id] = { data: fresh, expires: now + ttlMs };
  }
  return fresh;
}

function updateMemCache(id: string, data: any, ttlMs = 45000) {
  MEM_CACHE[id] = { data, expires: Date.now() + ttlMs };
}

function saveDbCollectionAsync(supabase: any, id: string, payload: any): void {
  updateMemCache(id, payload);
  saveDbCollection(supabase, id, payload).catch(() => {});
}

async function loadMultipleCollections(supabase: any, ids: string[], ttlMs = 45000): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  if (!supabase || ids.length === 0) return result;
  const now = Date.now();
  const missingIds: string[] = [];

  for (const id of ids) {
    if (MEM_CACHE[id] && MEM_CACHE[id].expires > now) {
      result[id] = MEM_CACHE[id].data;
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) return result;

  try {
    const { data: rows } = await supabase
      .from('tc_collections')
      .select('id, data')
      .in('id', missingIds);

    const foundSet = new Set<string>();
    if (Array.isArray(rows)) {
      for (const r of rows) {
        if (r && r.id) {
          result[r.id] = r.data;
          MEM_CACHE[r.id] = { data: r.data, expires: now + ttlMs };
          foundSet.add(r.id);
        }
      }
    }

    const stillMissing = missingIds.filter(id => !foundSet.has(id));
    if (stillMissing.length > 0) {
      const { data: altRows } = await supabase
        .from('clean24_collections')
        .select('id, data')
        .in('id', stillMissing);

      if (Array.isArray(altRows)) {
        for (const r of altRows) {
          if (r && r.id && !result[r.id]) {
            result[r.id] = r.data;
            MEM_CACHE[r.id] = { data: r.data, expires: now + ttlMs };
          }
        }
      }
    }
  } catch (e) {
    console.warn('Batch load error:', e);
  }

  return result;
}

function formatWorkDuration(hours: number): string {
  if (!hours || isNaN(hours) || hours <= 0) return '0 ម៉ោង';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h} ម៉ោង ${m} នាទី`;
  if (h > 0) return `${h} ម៉ោង`;
  return `${m} នាទី`;
}

function getTargetBots(): Array<{ token: string; branchId: string; name: string }> {
  const bots: Array<{ token: string; branchId: string; name: string }> = [];
  const unifiedToken = (
    process.env.TELEGRAM_BOT_TOKEN_COFFEE ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN_CODE ||
    process.env.BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN_ATTENDANCE ||
    ''
  ).trim();

  if (unifiedToken) {
    bots.push({ token: unifiedToken, branchId: 'all', name: 'TC Staff Management Bot' });
  }
  return bots;
}


// Fast Webhook Response helper: Uses direct HTTP 200 JSON return for 0ms roundtrip to Telegram!
function sendOrReply(res: any, botToken: string, payload: any) {
  const method = payload.method || 'sendMessage';
  const fullPayload = { method, ...payload };
  if (res && !res.headersSent) {
    return res.status(200).json(fullPayload);
  }
  return fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const allTargetBots = getTargetBots();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'p2bkh.tech';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // =================================================================================
  // MANAGEMENT GET ENDPOINT: Register/Check Webhook & Configure Commands Menu
  // =================================================================================
  if (req.method === 'GET') {
    const action = req.query?.action;

    if (allTargetBots.length === 0) {
      return res.status(200).json({ 
        success: false, 
        error: 'No Telegram bot tokens configured in environment' 
      });
    }

    const commandList = [
      { command: 'start', description: '📱 បើកកម្មវិធី TC Staff Mini App' },
      { command: 'checkin', description: '📸 ចុះឈ្មោះចូល (Check In)' },
      { command: 'checkout', description: '🚪 ចុះឈ្មោះចេញ (Check Out)' },
      { command: 'attendance', description: '📊 មើលប្រវត្តិវត្តមានរបស់ខ្ញុំ' },
      { command: 'profile', description: '👤 ព័ត៌មានគណនីបុគ្គលិក' },
      { command: 'bind', description: '🏢 កំណត់ភ្ជាប់ Group សាខា' },
      { command: 'id', description: '🆔 ពិនិត្យ Chat ID & Telegram ID' },
      { command: 'help', description: '❓ ការណែនាំអំពីការប្រើប្រាស់' }
    ];

    if (action === 'set') {
      const results: any[] = [];
      for (const bot of allTargetBots) {
        const webhookUrl = `${baseUrl}/api/telegram-webhook`;

        const setRes = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&allowed_updates=${encodeURIComponent(JSON.stringify(["message", "edited_message", "callback_query", "channel_post", "my_chat_member"]))}`);
        const setData = await setRes.json();

        // Configure Menu Commands
        await fetch(`https://api.telegram.org/bot${bot.token}/setMyCommands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commands: commandList })
        });

        // Set WebApp Chat Menu Button directly to Mini App
        await fetch(`https://api.telegram.org/bot${bot.token}/setChatMenuButton`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_button: {
              type: 'web_app',
              text: '📱 TC Staff App',
              web_app: { url: `${baseUrl}/attendance-app` }
            }
          })
        });

        results.push({ bot: bot.name, webhookUrl, ok: setData.ok, description: setData.description });
      }

      return res.status(200).json({ success: true, message: 'TC Staff Bot webhook and menus registered', results });
    }

    if (action === 'delete') {
      const results: any[] = [];
      for (const bot of allTargetBots) {
        const delRes = await fetch(`https://api.telegram.org/bot${bot.token}/deleteWebhook`);
        const delData = await delRes.json();
        results.push({ bot: bot.name, ok: delData.ok });
      }
      return res.status(200).json({ success: true, results });
    }

    // Default info
    const infos: any[] = [];
    for (const bot of allTargetBots) {
      try {
        const infoRes = await fetch(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`);
        const infoData = await infoRes.json();
        const meRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`);
        const meData = await meRes.json();
        infos.push({ bot: bot.name, branchId: bot.branchId, me: meData.result, info: infoData.result });
      } catch (e: any) {
        infos.push({ bot: bot.name, branchId: bot.branchId, error: e.message });
      }
    }
    return res.status(200).json({ success: true, count: allTargetBots.length, bots: infos });
  }

  // =================================================================================
  // HANDLE INCOMING TELEGRAM WEBHOOK UPDATE (POST)
  // =================================================================================
  if (req.method === 'POST') {
    try {
      const update = req.body;
      if (!update) return res.status(200).json({ ok: true });

      const isCallback = Boolean(update.callback_query);
      const callbackQuery = update.callback_query;
      const isMyChatMember = Boolean(update.my_chat_member);
      const chatMember = update.my_chat_member;
      const msg = isCallback 
        ? callbackQuery.message 
        : (update.message || update.edited_message || update.channel_post || (isMyChatMember ? { chat: chatMember.chat, from: chatMember.from, text: '/start' } : null));

      if (!msg || !msg.chat || !msg.chat.id) {
        return res.status(200).json({ ok: true });
      }

      const chatId = String(msg.chat.id);
      const from = isCallback ? callbackQuery.from : (msg.from || {});
      const firstName = from.first_name || msg.chat.first_name || msg.chat.title || 'Barista';
      const username = from.username || msg.chat.username || '';
      const telegramId = from.id ? String(from.id) : chatId;
      const cleanTgHandle = (username || '').replace(/^@/, '').toLowerCase().trim();
      const userText = String(isCallback ? callbackQuery.data : (msg.text || '')).trim();

      // Timezone helper (Asia/Phnom_Penh)
      const now = new Date();
      const phnomPenhTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Phnom_Penh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(now);

      const [datePart, timePart] = phnomPenhTime.split(', ');
      const [d, m, y] = (datePart || '').split('/');
      const phnomPenhDateStr = `${y}-${m}-${d}`;
      const curYear = Number(y);
      const curMonth = Number(m);

      // Supabase context
      const supabase = getSupabase();
      let matchedStaff: any = null;
      let allStaff: any[] = [];
      let allBranches: any[] = [];
      let todayAttendance: any = null;
      let staffBranch: any = null;
      let storedConfig: any = null;
      let storedRecipients: any[] = [];
      let allAtt: any[] = [];
      let allUsers: any[] = [];
      let chatRegistry: any[] = [];

      const isPrivateChat = msg.chat?.type === 'private' || !msg.chat?.type;

      if (supabase) {
        try {
          const isAttRelated = 
            userText === '/attendance' || 
            userText === '/history' || 
            userText === '/report' || 
            userText.includes('វត្តមាន') || 
            userText.toLowerCase().includes('attendance') ||
            userText.toLowerCase().includes('report') ||
            userText === '/start' ||
            userText === '/menu';

          // Ultra-Fast Targeted Loading (Only load what is needed for this request)
          const neededIds = ['staff', 'branches'];
          const isBind = userText.startsWith('/bind') || userText === '/id' || userText === '/chatid';
          if (isBind) {
            neededIds.push('telegramConfig');
            neededIds.push('telegramRecipients');
          }
          if (isAttRelated) {
            neededIds.push('attendance');
          }

          const batch = await loadMultipleCollections(supabase, neededIds, 60000);

          allStaff = Array.isArray(batch['staff']) ? batch['staff'] : [];
          allBranches = Array.isArray(batch['branches']) ? batch['branches'] : [];
          allAtt = Array.isArray(batch['attendance']) ? batch['attendance'] : [];
          storedConfig = batch['telegramConfig'] || { chatIds: { branches: {} } };
          storedRecipients = Array.isArray(batch['telegramRecipients']) ? batch['telegramRecipients'] : [];

          // 8. Find matching staff by Telegram ID or Username (Must be Active)
          matchedStaff = allStaff.find((s: any) => {
            const sId = String(s.telegramId || '').trim();
            const sUser = (s.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
            return s.status === 'Active' && (
              (telegramId && sId === telegramId) || 
              (cleanTgHandle && sUser === cleanTgHandle)
            );
          });

          // Auto-bind telegramId if matched
          if (matchedStaff && !matchedStaff.telegramId) {
            matchedStaff.telegramId = telegramId;
            matchedStaff.telegramLinked = true;
            saveDbCollectionAsync(supabase, 'staff', allStaff);
          }

          if (matchedStaff) {
            todayAttendance = allAtt.find((a: any) => a.staffId === matchedStaff.id && a.date === phnomPenhDateStr);
            staffBranch = allBranches.find((b: any) => b.id === matchedStaff.branchId);
          }
        } catch (dbErr) {
          console.error('Supabase query error in telegram webhook:', dbErr);
        }
      }

      // =================================================================================
      // DETERMINE BRANCH FOR THIS CHAT
      // =================================================================================
      let effectiveBranchId = '';

      // Check stored branch chatIds in config
      if (storedConfig?.chatIds?.branches) {
        const bMap = storedConfig.chatIds.branches;
        if (bMap.b1 === chatId || bMap.toto === chatId || bMap['b1'] === chatId) {
          effectiveBranchId = 'b1';
        } else if (bMap.b2 === chatId || bMap.corner === chatId || bMap['b2'] === chatId) {
          effectiveBranchId = 'b2';
        }
      }

      // Check recipients list
      if (!effectiveBranchId && storedRecipients.length > 0) {
        const matchedRec = storedRecipients.find((r: any) => String(r.chatId) === chatId && r.branchId && r.branchId !== 'all');
        if (matchedRec) effectiveBranchId = matchedRec.branchId;
      }

      // Check matched staff
      if (!effectiveBranchId && matchedStaff?.branchId) {
        effectiveBranchId = matchedStaff.branchId;
      }

      // Default fallback
      if (!effectiveBranchId) effectiveBranchId = 'b1';

      if (!staffBranch) {
        staffBranch = allBranches.find((b: any) => b.id === effectiveBranchId) || {
          id: effectiveBranchId,
          branchName: effectiveBranchId === 'b2' ? 'Coffee corner' : 'toto by Chichi'
        };
      }

      const branchDisplay = staffBranch?.branchName || (effectiveBranchId === 'b2' ? 'Coffee corner' : 'toto by Chichi');

      // Resolve Unified Bot Token
      let botToken = (
        process.env.TELEGRAM_BOT_TOKEN_COFFEE ||
        process.env.TELEGRAM_BOT_TOKEN ||
        process.env.TELEGRAM_BOT_TOKEN_CODE ||
        process.env.BOT_TOKEN ||
        storedConfig?.botToken ||
        ''
      ).trim();

      if (!botToken) {
        return res.status(200).json({ ok: true });
      }

      // Answer callback query if any
      if (isCallback && callbackQuery.id) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQuery.id })
          });
        } catch {}
      }

      // =================================================================================
      // ACTION: ☕ BIND GROUP TO CAFE BRANCH (/bind, /bind b1, /bind b2, or callback query)
      // =================================================================================
      const isBindCallback = isCallback && (callbackQuery.data === 'bind_branch_b1' || callbackQuery.data === 'bind_branch_b2');
      const isBindCmd = userText === '/bind' || userText.startsWith('/bind ');

      if (isBindCallback || isBindCmd) {
        let targetBranchToBind = '';
        if (isBindCallback) {
          targetBranchToBind = callbackQuery.data === 'bind_branch_b1' ? 'b1' : 'b2';
        } else if (userText.includes('b1') || userText.toLowerCase().includes('toto') || userText.toLowerCase().includes('chichi')) {
          targetBranchToBind = 'b1';
        } else if (userText.includes('b2') || userText.toLowerCase().includes('corner') || userText.toLowerCase().includes('coffee')) {
          targetBranchToBind = 'b2';
        }

        // If target branch is chosen, save and confirm
        if (targetBranchToBind) {
          const boundName = targetBranchToBind === 'b1' ? 'toto by Chichi' : 'Coffee corner';
          if (supabase) {
            try {
              const { data: cfgRow } = await supabase.from('clean24_collections').select('data').eq('id', 'telegramConfig').maybeSingle();
              const currentCfg = (cfgRow && cfgRow.data) ? cfgRow.data : { chatIds: { branches: {} } };
              if (!currentCfg.chatIds) currentCfg.chatIds = { branches: {} };
              if (!currentCfg.chatIds.branches) currentCfg.chatIds.branches = {};

              currentCfg.chatIds.branches[targetBranchToBind] = chatId;
              if (targetBranchToBind === 'b1') currentCfg.chatIds.branches['toto'] = chatId;
              if (targetBranchToBind === 'b2') currentCfg.chatIds.branches['corner'] = chatId;

              await supabase.from('clean24_collections').upsert({
                id: 'telegramConfig',
                data: currentCfg,
                updated_at: new Date().toISOString()
              });

              const { data: recRow } = await supabase.from('clean24_collections').select('data').eq('id', 'telegramRecipients').maybeSingle();
              let recs = Array.isArray(recRow?.data) ? recRow.data : [];
              const chatTitle = msg.chat?.title || firstName;
              const targetName = `${boundName} (${chatTitle})`;
              const existingIdx = recs.findIndex((r: any) => String(r.chatId) === chatId);
              if (existingIdx >= 0) {
                recs[existingIdx].branchId = targetBranchToBind;
                recs[existingIdx].name = targetName;
                recs[existingIdx].isActive = true;
              } else {
                recs.push({
                  id: 'rec_' + targetBranchToBind + '_' + Date.now(),
                  name: targetName,
                  chatId: chatId,
                  role: 'Branch Channel',
                  branchId: targetBranchToBind,
                  isActive: true,
                  categories: ['all', 'sales', 'stock', 'salary', 'attendance'],
                  createdAt: new Date().toISOString()
                });
              }
              await supabase.from('clean24_collections').upsert({
                id: 'telegramRecipients',
                data: recs,
                updated_at: new Date().toISOString()
              });
            } catch (e) {
              console.error('Failed to bind branch in DB:', e);
            }
          }

          const successMsg = `✅ <b>[ភ្ជាប់សាខាកាហ្វេបានជោគជ័យ / Cafe Branch Linked]</b>\n\n` +
            `☕ <b>សាខា:</b> <b>${boundName}</b> (Branch ID: <code>${targetBranchToBind}</code>)\n` +
            `🆔 <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
            `🔔 <b>ប្រព័ន្ធបានកត់ត្រាជោគជ័យ៖</b> ចាប់ពីពេលនេះតទៅ រាល់កំណត់ត្រា <b>ការលក់កាហ្វេប្រចាំថ្ងៃ</b>, <b>ស្តុកគ្រាប់កាហ្វេ & វត្ថុធាតុដើម</b>, <b>វត្តមាន Barista</b>, និង <b>ថ្ងៃបើកប្រាក់ខែ</b> របស់ <b>${boundName}</b> នឹងត្រូវបញ្ជូនមកកាន់ Group នេះដោយស្វ័យប្រវត្តិ (ដាច់ដោយឡែកពីសាខាផ្សេង)!`;

          return sendOrReply(res, botToken, { chat_id: chatId, text: successMsg, parse_mode: 'HTML' });
        }

        // If no target branch specified, present interactive selection buttons
        const promptMsg = `☕ <b>[កំណត់សាខាសម្រាប់ Telegram Chat នេះ / Bind Cafe Branch]</b>\n\n` +
          `🆔 <b>Chat ID បច្ចុប្បន្ន:</b> <code>${chatId}</code>\n\n` +
          `សូមជ្រើសរើសសាខាកាហ្វេដែលលោកអ្នកចង់ភ្ជាប់ជាមួយ Chat នេះ ដើម្បីឱ្យប្រព័ន្ធផ្ញើរបាយការណ៍លក់កាហ្វេ ស្តុកគ្រាប់ និងប្រាក់ខែមកកាន់ទីនេះ៖`;

        const bindButtons = {
          inline_keyboard: [
            [
              { text: '☕ ភ្ជាប់ទៅ toto by Chichi (b1)', callback_data: 'bind_branch_b1' },
              { text: '☕ ភ្ជាប់ទៅ Coffee corner (b2)', callback_data: 'bind_branch_b2' }
            ]
          ]
        };

        return sendOrReply(res, botToken, { chat_id: chatId, text: promptMsg, parse_mode: 'HTML', reply_markup: bindButtons });
      }

      // =================================================================================
      // ACTION: 📌 ពិនិត្យ CHAT ID & BINDING (/id, /chatid)
      // =================================================================================
      if (userText === '/id' || userText === '/chatid') {
        const chatType = msg.chat?.type || 'private';
        const isCurrentlyBound = storedConfig?.chatIds?.branches?.b1 === chatId || storedConfig?.chatIds?.branches?.b2 === chatId;
        const currentBoundBranch = storedConfig?.chatIds?.branches?.b1 === chatId ? 'toto by Chichi (b1)' : storedConfig?.chatIds?.branches?.b2 === chatId ? 'Coffee corner (b2)' : 'មិនទាន់ភ្ជាប់ (Unassigned)';

        const idMsg = `📌 <b>[ព័ត៌មាន Telegram Chat / Chat ID Info]</b>\n\n` +
          `🆔 <b>Chat ID:</b> <code>${chatId}</code>\n` +
          `👥 <b>ប្រភេទ Chat:</b> <code>${chatType}</code>\n` +
          `☕ <b>សាខាដែលបានភ្ជាប់:</b> <b>${currentBoundBranch}</b>\n` +
          `👤 <b>អ្នកផ្ញើ:</b> ${firstName} (${cleanTgHandle ? '@' + cleanTgHandle : 'គ្មាន Username'})\n\n` +
          (isCurrentlyBound 
            ? `✅ <b>ស្ថានភាព:</b> បានភ្ជាប់រួចរាល់! រាល់កំណត់ត្រាលក់កាហ្វេ ស្តុក និងប្រាក់ខែនៃសាខានេះ នឹងត្រូវផ្ញើមកទីនេះ។` 
            : `⚠️ <b>សម្គាល់:</b> Chat នេះមិនទាន់បានភ្ជាប់ទៅកាន់សាខាកាហ្វេណាមួយនៅឡើយទេ។ សូមវាយពាក្យ <code>/bind</code> ដើម្បីជ្រើសរើសសាខាភ្ជាប់!`);

        const idButtons = !isCurrentlyBound ? {
          inline_keyboard: [
            [
              { text: '☕ ភ្ជាប់ទៅ toto by Chichi (b1)', callback_data: 'bind_branch_b1' },
              { text: '☕ ភ្ជាប់ទៅ Coffee corner (b2)', callback_data: 'bind_branch_b2' }
            ]
          ]
        } : undefined;

        return sendOrReply(res, botToken, { 
            chat_id: chatId, 
            text: idMsg, 
            parse_mode: 'HTML',
            reply_markup: idButtons 
          });
      }

      // ---------------------------------------------------------------------------------
      // PERSISTENT BOTTOM REPLY KEYBOARD FOR TC STAFF MINI APP
      // ---------------------------------------------------------------------------------
      const persistentReplyKeyboard = {
        keyboard: [
          [
            { text: '📸 ចុះឈ្មោះចូល', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } },
            { text: '🚪 ចុះឈ្មោះចេញ', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
          ],
          [
            { text: '📊 វត្តមានរបស់ខ្ញុំ', web_app: { url: `${baseUrl}/attendance-app?action=history` } },
            { text: '👤 គណនីបុគ្គលិក' },
            { text: '❓ របៀបប្រើប្រាស់' }
          ]
        ],
        resize_keyboard: true,
        is_persistent: true
      };

      // =================================================================================
      // ACTION: 📸 ចុះឈ្មោះចូល (CHECK IN)
      // =================================================================================
      const isCheckInCmd = 
        userText === '/checkin' || 
        userText.toLowerCase() === 'checkin' || 
        userText.toLowerCase() === 'check in' || 
        (userText.includes('ចូល') && !userText.includes('ចេញ'));

      if (isCheckInCmd) {
        if (!matchedStaff) {
          const unlinkedMsg = `⚠️ <b>[TC Staff - គណនីមិនទាន់បានភ្ជាប់ / Unlinked Account]</b>\n\n` +
            `សួស្តី <b>${firstName}</b>!\n` +
            `គណនី Telegram របស់អ្នកមិនទាន់បានភ្ជាប់ជាមួយបុគ្គលិក TC Staff ណាម្នាក់នៅឡើយទេ។\n\n` +
            `🆔 <b>Telegram ID របស់អ្នក:</b> <code>${telegramId}</code>\n` +
            `👤 <b>Username:</b> ${cleanTgHandle ? '@' + cleanTgHandle : 'គ្មាន'}\n\n` +
            `👉 <b>សូមទាក់ទង Admin ឬ Manager</b> ដើម្បីចុះឈ្មោះ និងភ្ជាប់ Telegram ID នេះទៅកាន់គណនីបុគ្គលិករបស់អ្នកក្នុងប្រព័ន្ធ TC Staff ជាមុនសិន ទើបអាចចុះវត្តមានបាន!`;

          return sendOrReply(res, botToken, { chat_id: chatId, text: unlinkedMsg, parse_mode: 'HTML' });
        }

        const checkinMsg = `📸 <b>[TC Staff - ចុះឈ្មោះចូលបំពេញការងារ]</b>\n\n` +
          `👤 <b>បុគ្គលិក:</b> <b>${matchedStaff.fullName}</b>\n` +
          `🏢 <b>សាខា:</b> <b>${branchDisplay}</b>\n` +
          `📅 <b>កាលបរិច្ឆេទ:</b> <code>${phnomPenhDateStr}</code>\n\n` +
          `👇 <b>សូមចុចប៊ូតុងខាងក្រោមដើម្បីបើកស្កេន Face ID និងផ្ទៀងផ្ទាត់ទីតាំង GPS៖</b>`;

        const checkinInlineButtons = {
          inline_keyboard: [
            [
              { text: '📸 ចុះឈ្មោះចូលឥឡូវនេះ', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } }
            ]
          ]
        };

        return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: checkinMsg,
            parse_mode: 'HTML',
            reply_markup: checkinInlineButtons
          });
      }

      // =================================================================================
      // ACTION: 🚪 ចុះឈ្មោះចេញ (CHECK OUT)
      // =================================================================================
      const isCheckOutCmd = 
        userText === '/checkout' || 
        userText.toLowerCase() === 'checkout' || 
        userText.toLowerCase() === 'check out' || 
        userText.includes('ចេញ');

      if (isCheckOutCmd) {
        if (!matchedStaff) {
          const unlinkedMsg = `⚠️ <b>[TC Staff - គណនីមិនទាន់បានភ្ជាប់ / Unlinked Account]</b>\n\n` +
            `សួស្តី <b>${firstName}</b>!\n` +
            `គណនី Telegram របស់អ្នកមិនទាន់បានភ្ជាប់ជាមួយបុគ្គលិក TC Staff ណាម្នាក់នៅឡើយទេ។\n\n` +
            `🆔 <b>Telegram ID របស់អ្នក:</b> <code>${telegramId}</code>\n` +
            `👤 <b>Username:</b> ${cleanTgHandle ? '@' + cleanTgHandle : 'គ្មាន'}\n\n` +
            `👉 <b>សូមទាក់ទង Admin ឬ Manager</b> ដើម្បីចុះឈ្មោះ និងភ្ជាប់ Telegram ID នេះទៅកាន់គណនីបុគ្គលិករបស់អ្នកក្នុងប្រព័ន្ធ TC Staff ជាមុនសិន ទើបអាចចុះវត្តមានបាន!`;

          return sendOrReply(res, botToken, { chat_id: chatId, text: unlinkedMsg, parse_mode: 'HTML' });
        }

        const checkoutMsg = `🚪 <b>[TC Staff - ចុះឈ្មោះចេញពីការងារ]</b>\n\n` +
          `👤 <b>បុគ្គលិក:</b> <b>${matchedStaff.fullName}</b>\n` +
          `🏢 <b>សាខា:</b> <b>${branchDisplay}</b>\n` +
          `📅 <b>កាលបរិច្ឆេទ:</b> <code>${phnomPenhDateStr}</code>\n\n` +
          `👇 <b>សូមចុចប៊ូតុងខាងក្រោមដើម្បីបញ្ជាក់ការចេញ៖</b>`;

        const checkoutInlineButtons = {
          inline_keyboard: [
            [
              { text: '🚪 ចុះឈ្មោះចេញឥឡូវនេះ', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
            ]
          ]
        };

        return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: checkoutMsg,
            parse_mode: 'HTML',
            reply_markup: checkoutInlineButtons
          });
      }

      // =================================================================================
      // ACTION: 📊 របាយការណ៍វត្តមានរបស់ខ្ញុំ (MY ATTENDANCE)
      // =================================================================================
      if (
        userText === '/attendance' || 
        userText === '/history' || 
        userText === '/report' || 
        userText.includes('វត្តមាន') || 
        userText.toLowerCase().includes('attendance') ||
        userText.toLowerCase().includes('report')
      ) {
        if (!matchedStaff) {
          const unlinkedMsg = `⚠️ <b>[TC Staff - គណនីមិនទាន់បានភ្ជាប់ / Unlinked Account]</b>\n\n` +
            `សួស្តី <b>${firstName}</b>!\n` +
            `គណនី Telegram របស់អ្នកមិនទាន់បានភ្ជាប់ជាមួយបុគ្គលិក TC Staff ណាម្នាក់នៅឡើយទេ។\n\n` +
            `🆔 <b>Telegram ID របស់អ្នក:</b> <code>${telegramId}</code>\n` +
            `👉 សូមទាក់ទង Admin ឬ Manager ដើម្បីភ្ជាប់ Telegram ID នេះជាមុនសិន។`;

          return sendOrReply(res, botToken, { chat_id: chatId, text: unlinkedMsg, parse_mode: 'HTML' });
        }
        const monthRecords = allAtt.filter((a: any) => {
          if (!a.date) return false;
          const [y, m] = a.date.split('-').map(Number);
          return y === curYear && m === curMonth && (!matchedStaff || a.staffId === matchedStaff.id);
        });

        const daysWorked = monthRecords.filter((r: any) => r.checkIn).length;
        const totalWorkHours = monthRecords.reduce((acc: number, r: any) => acc + (Number(r.workHours || r.totalHours) || 0), 0);
        const totalOtHours = monthRecords.reduce((acc: number, r: any) => acc + (Number(r.otHours) || 0), 0);

        const reportMsg = `📊 <b>TC Staff | វត្តមានប្រចាំខែ ${curMonth}/${curYear}</b>\n\n` +
          `👤 <b>បុគ្គលិក:</b> ${matchedStaff ? matchedStaff.fullName : firstName}\n` +
          `🏢 <b>សាខា:</b> ${branchDisplay}\n\n` +
          `📅 <b>ថ្ងៃធ្វើការសរុប:</b> ${daysWorked} ថ្ងៃ\n` +
          `⏱️ <b>ម៉ោងធ្វើការសរុប:</b> ${formatWorkDuration(totalWorkHours)}\n` +
          `⚡ <b>ម៉ោងបន្ថែម (OT):</b> ${totalOtHours} ម៉ោង`;

        const reportButtons = {
          inline_keyboard: [
            [
              { text: '📊 មើលប្រវត្តិវត្តមាន', web_app: { url: `${baseUrl}/attendance-app?action=history` } }
            ]
          ]
        };

        return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: reportMsg,
            parse_mode: 'HTML',
            reply_markup: reportButtons
          });
      }

      // =================================================================================
      // ACTION: 👤 ព័ត៌មានគណនីបុគ្គលិក (STAFF PROFILE)
      // =================================================================================
      if (
        userText === '/profile' || 
        userText === '/me' || 
        userText.includes('បុគ្គលិក') || 
        userText.toLowerCase().includes('profile') ||
        userText === 'profile'
      ) {
        const staffName = matchedStaff?.fullName || firstName;
        const staffPosition = matchedStaff?.position || 'Staff';
        const staffPhone = matchedStaff?.phone || 'មិនទាន់មាន';
        const staffBranchName = staffBranch?.branchName || branchDisplay;
        const staffTgId = matchedStaff?.telegramId || telegramId;
        const linkStatus = matchedStaff ? 'ភ្ជាប់រួចរាល់ ✅' : 'មិនទាន់ភ្ជាប់ (Unlinked) ⚠️';

        const profileMsg = `👤 <b>TC Staff | ព័ត៌មានបុគ្គលិក</b>\n\n` +
          `<b>ឈ្មោះ:</b> ${staffName}\n` +
          `<b>តួនាទី:</b> ${staffPosition}\n` +
          `<b>សាខា:</b> ${staffBranchName}\n` +
          `<b>លេខទូរស័ព្ទ:</b> <code>${staffPhone}</code>\n` +
          `<b>Telegram ID:</b> <code>${staffTgId}</code>\n` +
          `<b>ស្ថានភាពគណនី:</b> ${linkStatus}`;

        const profileButtons = {
          inline_keyboard: [
            [
              { text: '📸 ចុះឈ្មោះចូល', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } },
              { text: '🚪 ចុះឈ្មោះចេញ', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
            ]
          ]
        };

        return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: profileMsg,
            parse_mode: 'HTML',
            reply_markup: profileButtons
          });
      }

      // =================================================================================
      // ACTION: ❓ ការណែនាំប្រើប្រាស់ & ជំនួយ (USER GUIDE & HELP)
      // =================================================================================
      if (
        userText === '/help' ||
        userText.includes('ណែនាំ') || 
        userText.includes('ការណែនាំ') || 
        userText.includes('guide') || 
        userText.includes('ជំនួយ') || 
        userText.includes('របៀបប្រើ') ||
        userText.toLowerCase().includes('help')
      ) {
        const helpMsg = `❓ <b>[ការណែនាំអំពីការប្រើប្រាស់ TC Staff]</b>\n\n` +
          `🔹 <b>១. ចុះឈ្មោះចូល៖</b>\n` +
          `   ចុចប៊ូតុង <code>📸 ចុះឈ្មោះចូល</code> ដើម្បីស្កេន Face ID និងផ្ទៀងផ្ទាត់ទីតាំង GPS នៅសាខា។\n\n` +
          `🔹 <b>២. ចុះឈ្មោះចេញ៖</b>\n` +
          `   ចុចប៊ូតុង <code>🚪 ចុះឈ្មោះចេញ</code> នៅពេលបញ្ចប់ម៉ោងការងារ។\n\n` +
          `🔹 <b>៣. ពិនិត្យវត្តមាន៖</b>\n` +
          `   ចុចប៊ូតុង <code>📊 វត្តមានរបស់ខ្ញុំ</code> ដើម្បីមើលចំនួនថ្ងៃ និងម៉ោងការងារប្រចាំខែ។\n\n` +
          `🏢 <b>សាខា:</b> <b>${branchDisplay}</b>\n` +
          `🆔 <b>Telegram ID របស់អ្នក:</b> <code>${telegramId}</code>`;

        return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: helpMsg,
            parse_mode: 'HTML',
            reply_markup: persistentReplyKeyboard
          });
      }

      // =================================================================================
      // DEFAULT: 🌟 MAIN MENU / START GREETING (/start or /menu)
      // =================================================================================
      if (!matchedStaff) {
        const unlinkedWelcome = `👋 <b>សួស្តី ${firstName}!</b>\n\n` +
          `សូមស្វាគមន៍មកកាន់ <b>TC Staff Management Bot</b> 📱\n\n` +
          `⚠️ <b>ស្ថានភាពគណនី:</b> <code>មិនទាន់បានភ្ជាប់ (Unlinked)</code>\n` +
          `គណនី Telegram របស់អ្នកមិនទាន់បានភ្ជាប់ជាមួយទិន្នន័យបុគ្គលិកណាមួយនៅក្នុងប្រព័ន្ធនៅឡើយទេ។\n\n` +
          `🆔 <b>Telegram ID របស់អ្នក:</b> <code>${telegramId}</code>\n` +
          `💬 <b>Chat ID:</b> <code>${chatId}</code>\n` +
          `👤 <b>Username:</b> ${cleanTgHandle ? '@' + cleanTgHandle : 'គ្មាន'}\n\n` +
          `👉 <b>ដើម្បីចុះវត្តមានបាន:</b> សូមផ្ញើលេខ <b>Telegram ID (<code>${telegramId}</code>)</b> នេះទៅកាន់ Admin ឬ Manager របស់អ្នក ដើម្បីភ្ជាប់គណនីជាមុនសិន។`;

        const unlinkedMenuButtons = {
          inline_keyboard: [
            [
              { text: '🆔 ពិនិត្យ Chat ID / Telegram ID', callback_data: '/id' }
            ]
          ]
        };

        return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: unlinkedWelcome,
            parse_mode: 'HTML',
            reply_markup: unlinkedMenuButtons
          });
      }

      const greetingName = matchedStaff.fullName;
      const checkInTime = todayAttendance?.checkIn || '--';
      const checkOutTime = todayAttendance?.checkOut || '--';
      const staffPos = matchedStaff.position || 'Staff';

      const welcomeText = `👋 <b>សួស្តី ${greetingName}!</b>\n\n` +
        `សូមស្វាគមន៍មកកាន់ <b>TC Staff Mini App</b> 📱\n` +
        `ប្រព័ន្ធគ្រប់គ្រងវត្តមានបុគ្គលិក TC Staff Management\n\n` +
        `🏢 <b>សាខា:</b> <b>${branchDisplay}</b>\n` +
        `💼 <b>តួនាទី:</b> <code>${staffPos}</code>\n` +
        `📅 <b>ថ្ងៃនេះ:</b> <code>${phnomPenhDateStr}</code>\n` +
        `⏰ <b>វត្តមាន:</b> ចូល: <code>${checkInTime}</code> | ចេញ: <code>${checkOutTime}</code>\n` +
        `🆔 <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
        `👇 <b>សូមចុចប៊ូតុងខាងក្រោមដើម្បីបើក Mini App ចុះវត្តមានភ្លាមៗ៖</b>`;

      const interactiveMenuButtons = {
        inline_keyboard: [
          [
            { text: '📸 ចុះឈ្មោះចូល', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } },
            { text: '🚪 ចុះឈ្មោះចេញ', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
          ],
          [
            { text: '📊 មើលប្រវត្តិវត្តមាន', web_app: { url: `${baseUrl}/attendance-app?action=history` } },
            { text: '👤 ព័ត៌មានបុគ្គលិក', callback_data: 'profile' }
          ]
        ]
      };

      // Send unified instant greeting with interactive action buttons in ONE request
      return sendOrReply(res, botToken, {
          chat_id: chatId,
          text: welcomeText,
          parse_mode: 'HTML',
          reply_markup: interactiveMenuButtons
        });
    } catch (e: any) {
      return res.status(200).json({ ok: true, error: e?.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
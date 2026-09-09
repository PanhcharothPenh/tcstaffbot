import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
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
    bots.push({ token: unifiedToken, branchId: 'all', name: 'toto by Chichi & Coffee corner Cafe Bot' });
  }
  return bots;
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
      { command: 'start', description: 'ផ្ដើមដំណើរការ & Menu បញ្ជា' },
      { command: 'menu', description: 'បង្ហាញផ្ទាំង Menu ទាំងអស់' },
      { command: 'bind', description: '☕ កំណត់ភ្ជាប់ Group នេះជាមួយសាខាកាហ្វេ' },
      { command: 'id', description: '🆔 ពិនិត្យ Chat ID & សាខាកាហ្វេដែលបានភ្ជាប់' },
      { command: 'sales', description: '☕ បញ្ចូលការលក់កាហ្វេប្រចាំថ្ងៃ' },
      { command: 'stock', description: '📦 គ្រាប់កាហ្វេ & វត្ថុធាតុដើម' },
      { command: 'salary', description: '💵 ពិនិត្យថ្ងៃបើកប្រាក់ខែ Barista & បុគ្គលិក' },
      { command: 'checkin', description: '📸 ចុះឈ្មោះចូល (Check In)' },
      { command: 'checkout', description: '📸 ចុះឈ្មោះចេញ (Check Out)' },
      { command: 'report', description: '📊 របាយការណ៍វត្តមានប្រចាំខែ' },
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

        // Set WebApp Chat Menu Button
        await fetch(`https://api.telegram.org/bot${bot.token}/setChatMenuButton`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_button: {
              type: 'web_app',
              text: '☕ Cafe App',
              web_app: { url: `${baseUrl}` }
            }
          })
        });

        results.push({ bot: bot.name, webhookUrl, ok: setData.ok, description: setData.description });
      }

      return res.status(200).json({ success: true, message: 'Cafe Bot webhook and menus registered', results });
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
      const infoRes = await fetch(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`);
      const infoData = await infoRes.json();
      infos.push({ bot: bot.name, branchId: bot.branchId, info: infoData.result });
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

      if (supabase) {
        try {
          // 1. Fetch Telegram Config
          const { data: cfgRow } = await supabase.from('clean24_collections').select('data').eq('id', 'telegramConfig').maybeSingle();
          if (cfgRow && cfgRow.data) storedConfig = cfgRow.data;

          // 2. Fetch Recipients
          const { data: recRow } = await supabase.from('clean24_collections').select('data').eq('id', 'telegramRecipients').maybeSingle();
          if (recRow && Array.isArray(recRow.data)) storedRecipients = recRow.data;

          // 3. Fetch staff
          const { data: staffColl } = await supabase.from('clean24_collections').select('data').eq('id', 'staff').maybeSingle();
          allStaff = (staffColl && Array.isArray(staffColl.data)) ? staffColl.data : [];

          // 4. Fetch branches
          const { data: bColl } = await supabase.from('clean24_collections').select('data').eq('id', 'branches').maybeSingle();
          allBranches = (bColl && Array.isArray(bColl.data)) ? bColl.data : [];

          // 5. Find matching staff by Telegram ID or Username
          matchedStaff = allStaff.find((s: any) => {
            const sId = String(s.telegramId || '').trim();
            const sUser = (s.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
            return (telegramId && sId === telegramId) || (cleanTgHandle && sUser === cleanTgHandle);
          });

          // Auto-bind telegramId if matched
          if (matchedStaff && !matchedStaff.telegramId) {
            matchedStaff.telegramId = telegramId;
            matchedStaff.telegramLinked = true;
            await supabase.from('clean24_collections').upsert({
              id: 'staff',
              data: allStaff,
              updated_at: new Date().toISOString()
            });
          }

          // 6. Fetch attendance records
          const { data: attColl } = await supabase.from('clean24_collections').select('data').eq('id', 'attendance').maybeSingle();
          allAtt = (attColl && Array.isArray(attColl.data)) ? attColl.data : [];

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

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: successMsg, parse_mode: 'HTML' })
          });
          return res.status(200).json({ ok: true });
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

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: promptMsg, parse_mode: 'HTML', reply_markup: bindButtons })
        });
        return res.status(200).json({ ok: true });
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

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: chatId, 
            text: idMsg, 
            parse_mode: 'HTML',
            reply_markup: idButtons 
          })
        });

        return res.status(200).json({ ok: true });
      }

      // ---------------------------------------------------------------------------------
      // PERSISTENT BOTTOM REPLY KEYBOARD (ម៉ឺនុយប៊ូតុងកាហ្វេ ងាយស្រួលប្រើប្រាស់បំផុត)
      // ---------------------------------------------------------------------------------
      const persistentReplyKeyboard = {
        keyboard: [
          [
            { text: '☕ កត់ត្រាការលក់កាហ្វេ' },
            { text: '📦 ស្តុកគ្រាប់កាហ្វេ & វត្ថុធាតុដើម' }
          ],
          [
            { text: '💵 ថ្ងៃបើកប្រាក់ខែ Barista' },
            { text: '📸 ចុះវត្តមាន (Check In/Out)', web_app: { url: `${baseUrl}/attendance-app` } },
            { text: '📊 របាយការណ៍' }
          ],
          [
            { text: '☕ បើក Cafe App', web_app: { url: `${baseUrl}` } },
            { text: '❓ ការណែនាំ (Help)' }
          ]
        ],
        resize_keyboard: true,
        is_persistent: true
      };

      // =================================================================================
      // ACTION: ☕ បញ្ចូលការលក់កាហ្វេ (SALES)
      // =================================================================================
      if (userText === '/sales' || userText === '/revenue' || userText.includes('លក់') || userText.includes('ចំណូល') || userText === 'cmd_sales') {
        const salesMsg = `☕ <b>[កត់ត្រាការលក់កាហ្វេប្រចាំថ្ងៃ / Cafe Daily Sales]</b>\n\n` +
          `☕ <b>ហាង/សាខា:</b> <b>${branchDisplay}</b>\n` +
          `📅 <b>កាលបរិច្ឆេទ:</b> <code>${phnomPenhDateStr}</code>\n\n` +
          `📝 <b>មុខទំនិញ & ភេសជ្ជៈ៖</b>\n` +
          `• កាហ្វេក្តៅ / ទឹកកក (Espresso, Latte, Americano, Cappuccino)\n` +
          `• តែ និង តែទឹកដោះគោ (Green Tea, Milk Tea, Lemon Tea)\n` +
          `• ហ្វ្រេបប៉េ & ភេសជ្ជៈក្រឡុក (Frappes & Smoothies)\n` +
          `• នំខេក និង នំប៉័ង (Croissant, Brownie, Pastries)\n\n` +
          `👇 <b>សូមចុចប៊ូតុងខាងក្រោមដើម្បីបញ្ចូលការលក់ភ្លាមៗ៖</b>`;

        const salesButtons = {
          inline_keyboard: [
            [
              { text: '☕ បើកតារាងលក់កាហ្វេ (Sales Entry)', web_app: { url: `${baseUrl}?tab=daily-sales&branch=${effectiveBranchId}` } }
            ],
            [
              { text: '🌐 បើកតាម Browser Link', url: `${baseUrl}?tab=daily-sales&branch=${effectiveBranchId}` }
            ]
          ]
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: salesMsg,
            parse_mode: 'HTML',
            reply_markup: salesButtons
          })
        });

        return res.status(200).json({ ok: true });
      }

      // =================================================================================
      // ACTION: 📦 ស្តុកគ្រាប់កាហ្វេ & វត្ថុធាតុដើម (STOCK / RAW MATERIALS)
      // =================================================================================
      if (userText === '/stock' || userText === '/inventory' || userText.includes('ស្តុក') || userText.includes('គ្រាប់កាហ្វេ') || userText === 'cmd_stock') {
        const stockMsg = `📦 <b>[ស្តុកគ្រាប់កាហ្វេ & វត្ថុធាតុដើម / Cafe Inventory]</b>\n\n` +
          `☕ <b>សាខា:</b> <b>${branchDisplay}</b>\n` +
          `📅 <b>កាលបរិច្ឆេទ:</b> <code>${phnomPenhDateStr}</code>\n\n` +
          `📥 <b>តាមដានស្តុកសំខាន់ៗ៖</b>\n` +
          `• គ្រាប់កាហ្វេ Arabica & Robusta Blend (គិតជា គីឡូ/កញ្ចប់)\n` +
          `• ទឹកដោះគោស្រស់ & ទឹកដោះគោខាប់ (កំប៉ុង/ដប)\n` +
          `• ស៊ីរ៉ូរសជាតិ (Syrups) & ម្សៅតែ\n` +
          `• កែវកាហ្វេ, គម្រប, និង បំពង់បឺត\n\n` +
          `👇 <b>សូមចុចប៊ូតុងខាងក្រោមដើម្បីគ្រប់គ្រងស្តុក៖</b>`;

        const stockButtons = {
          inline_keyboard: [
            [
              { text: '📦 បើកតារាងស្តុកកាហ្វេ (Inventory)', web_app: { url: `${baseUrl}?tab=inventory&branch=${effectiveBranchId}` } }
            ],
            [
              { text: '🌐 បើកតាម Browser Link', url: `${baseUrl}?tab=inventory&branch=${effectiveBranchId}` }
            ]
          ]
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: stockMsg,
            parse_mode: 'HTML',
            reply_markup: stockButtons
          })
        });

        return res.status(200).json({ ok: true });
      }

      // =================================================================================
      // ACTION: 💵 ថ្ងៃបើកប្រាក់ខែ (SALARY / PAYDAY DUE) - STRICT BRANCH ISOLATION
      // =================================================================================
      if (userText === '/salary' || userText.includes('ប្រាក់ខែ') || userText.includes('payday') || userText === 'cmd_salary') {
        const targetBId = String(effectiveBranchId || '').toLowerCase().trim();
        const branchStaff = allStaff.filter((s: any) => {
          const sB = String(s.branchId || '').toLowerCase().trim();
          return sB === targetBId && s.status === 'Active';
        });

        const todayDay = now.getDate();
        const isPeriod1 = todayDay <= 18;
        const periodNameKh = isPeriod1 ? 'លើកទី១ (ពាក់កណ្តាលខែ)' : 'លើកទី២ (ដាច់ខែ)';

        let totalBranchDueUsd = 0;
        let staffListDetails = '';

        if (branchStaff.length > 0) {
          staffListDetails = branchStaff.map((emp: any, idx: number) => {
            const base = Number(emp.baseSalary || 0);
            const dueHalf = Math.round((base / 2) * 100) / 100;
            const dueAmt = isPeriod1 ? dueHalf : base;
            totalBranchDueUsd += dueAmt;

            return `${idx + 1}. <b>${emp.fullName}</b> (${emp.position || 'Barista'})\n` +
              `   • ប្រាក់ខែគោល: $${base.toFixed(2)} | ត្រូវបើក ${periodNameKh}: <b>$${dueAmt.toFixed(2)}</b>`;
          }).join('\n');
        } else {
          staffListDetails = `<i>មិនទាន់មានទិន្នន័យបុគ្គលិកសកម្មនៅក្នុងសាខានេះនៅឡើយ។</i>`;
        }

        const totalKhr = Math.round(totalBranchDueUsd * 4000);

        const salaryMsg = `💵 <b>[កាលវិភាគបើកប្រាក់ខែ Barista & បុគ្គលិក / Cafe Payroll]</b>\n\n` +
          `☕ <b>សាខា:</b> <b>${branchDisplay}</b>\n` +
          `📅 <b>កាលបរិច្ឆេទ:</b> <code>${phnomPenhDateStr}</code>\n` +
          `📋 <b>វគ្គបើកប្រាក់ខែ:</b> <b>${periodNameKh}</b> (ខែ ${curMonth}/${curYear})\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👥 <b>បញ្ជី Barista/បុគ្គលិកសាខានេះ (${branchStaff.length} នាក់):</b>\n` +
          `${staffListDetails}\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `💰 <b>សរុបទឹកប្រាក់ត្រូវបើកសាខានេះ:</b> <b>$${totalBranchDueUsd.toFixed(2)}</b> (~${totalKhr.toLocaleString('en-US')} ៛)\n\n` +
          `🔒 <i>(ទិន្នន័យត្រូវបានបែងចែកដាច់ដោយឡែករវាង toto by Chichi និង Coffee corner)</i>`;

        const salaryButtons = {
          inline_keyboard: [
            [
              { text: '💵 បើកតារាងគ្រប់គ្រងប្រាក់ខែ (Payroll)', web_app: { url: `${baseUrl}?tab=salary&branch=${effectiveBranchId}` } }
            ]
          ]
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: salaryMsg,
            parse_mode: 'HTML',
            reply_markup: salaryButtons
          })
        });

        return res.status(200).json({ ok: true });
      }

      // =================================================================================
      // ACTION: 📸 ចុះឈ្មោះចូល (CHECK IN)
      // =================================================================================
      const isCheckInCmd = 
        userText === '/checkin' || 
        userText.toLowerCase() === 'checkin' || 
        userText.toLowerCase() === 'check in' || 
        (userText.includes('ចូល') && !userText.includes('ចំណូល') && !userText.includes('ចេញ') && !userText.includes('លក់'));

      if (isCheckInCmd) {
        const checkinMsg = `📸 <b>[ចុះឈ្មោះចូលបំពេញការងារ / Barista Check In]</b>\n\n` +
          `👤 <b>បុគ្គលិក:</b> ${matchedStaff ? matchedStaff.fullName : firstName}\n` +
          `☕ <b>សាខា:</b> ${branchDisplay}\n` +
          `📅 <b>ថ្ងៃនេះ:</b> ${phnomPenhDateStr}\n\n` +
          `👇 <b>សូមចុចប៊ូតុងខាងក្រោមដើម្បីស្កេនផ្ទៃមុខ (Face ID) និងផ្ទៀងផ្ទាត់ទីតាំង GPS៖</b>`;

        const checkinInlineButtons = {
          inline_keyboard: [
            [
              { text: '📸 ចុះឈ្មោះចូលឥឡូវនេះ (Face ID)', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } }
            ]
          ]
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: checkinMsg,
            parse_mode: 'HTML',
            reply_markup: checkinInlineButtons
          })
        });

        return res.status(200).json({ ok: true });
      }

      // =================================================================================
      // ACTION: 📸 ចុះឈ្មោះចេញ (CHECK OUT)
      // =================================================================================
      const isCheckOutCmd = 
        userText === '/checkout' || 
        userText.toLowerCase() === 'checkout' || 
        userText.toLowerCase() === 'check out' || 
        userText.includes('ចេញ');

      if (isCheckOutCmd) {
        const checkoutMsg = `📸 <b>[ចុះឈ្មោះចេញពីការងារ / Barista Check Out]</b>\n\n` +
          `👤 <b>បុគ្គលិក:</b> ${matchedStaff ? matchedStaff.fullName : firstName}\n` +
          `☕ <b>សាខា:</b> ${branchDisplay}\n` +
          `📅 <b>ថ្ងៃនេះ:</b> ${phnomPenhDateStr}\n\n` +
          `👇 <b>សូមចុចប៊ូតុងខាងក្រោមដើម្បីបញ្ជាក់ការចេញពីការងារ៖</b>`;

        const checkoutInlineButtons = {
          inline_keyboard: [
            [
              { text: '📸 ចុះឈ្មោះចេញ (Confirm Out)', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
            ]
          ]
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: checkoutMsg,
            parse_mode: 'HTML',
            reply_markup: checkoutInlineButtons
          })
        });

        return res.status(200).json({ ok: true });
      }

      // =================================================================================
      // ACTION: 📊 របាយការណ៍ប្រចាំខែ (MONTHLY REPORT)
      // =================================================================================
      if (userText.includes('របាយការណ៍') || userText === '/report' || userText.toLowerCase() === 'report') {
        const monthRecords = allAtt.filter((a: any) => {
          if (!a.date) return false;
          const [y, m] = a.date.split('-').map(Number);
          return y === curYear && m === curMonth && (!matchedStaff || a.staffId === matchedStaff.id);
        });

        const daysWorked = monthRecords.filter((r: any) => r.checkIn).length;
        const totalWorkHours = monthRecords.reduce((acc: number, r: any) => acc + (Number(r.totalHours) || 0), 0);
        const totalOtHours = monthRecords.reduce((acc: number, r: any) => acc + (Number(r.otHours) || 0), 0);

        const reportMsg = `📊 <b>[របាយការណ៍សង្ខេបវត្តមាន Barista ខែ ${curMonth}/${curYear}]</b>\n\n` +
          `☕ <b>សាខា:</b> ${branchDisplay}\n` +
          `👤 <b>បុគ្គលិក:</b> ${matchedStaff ? matchedStaff.fullName : firstName}\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `✅ <b>ថ្ងៃបំពេញការងារ:</b> <b>${daysWorked} ថ្ងៃ</b>\n` +
          `⏱️ <b>ម៉ោងសរុប:</b> <b>${formatWorkDuration(totalWorkHours)}</b>\n` +
          `⚡ <b>ម៉ោងបន្ថែម OT:</b> <b>${totalOtHours} ម៉ោង</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `✨ <i>លោកអ្នកអាចមើលតារាងវត្តមានលម្អិតតាមរយៈ App ខាងក្រោម។</i>`;

        const reportButtons = {
          inline_keyboard: [
            [
              { text: '📊 មើលតារាងវត្តមាន (A4 Ledger)', web_app: { url: `${baseUrl}/attendance-app?action=history` } }
            ]
          ]
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: reportMsg,
            parse_mode: 'HTML',
            reply_markup: reportButtons
          })
        });

        return res.status(200).json({ ok: true });
      }

      // =================================================================================
      // ACTION: ❓ ការណែនាំប្រើប្រាស់ & ជំនួយ (USER GUIDE & HELP)
      // =================================================================================
      if (
        userText.includes('ណែនាំ') || 
        userText.includes('ការណែនាំ') || 
        userText.includes('guide') || 
        userText.includes('ជំនួយ') || 
        userText.includes('help') || 
        userText === '/help'
      ) {
        const helpMsg = `❓ <b>[ការណែនាំអំពីការប្រើប្រាស់ Cafe Telegram Bot]</b>\n\n` +
          `🔹 <b>១. កត់ត្រាការលក់កាហ្វេ៖</b> ចុច <code>☕ កត់ត្រាការលក់កាហ្វេ</code> ដើម្បីបញ្ចូលការលក់ភេសជ្ជៈ & នំប្រចាំថ្ងៃ។\n\n` +
          `🔹 <b>២. តាមដានគ្រាប់កាហ្វេ & ស្តុក៖</b> ចុច <code>📦 ស្តុកគ្រាប់កាហ្វេ & វត្ថុធាតុដើម</code> ដើម្បីកត់ត្រាស្តុកចូល និងប្រើប្រាស់។\n\n` +
          `🔹 <b>៣. ពិនិត្យថ្ងៃបើកប្រាក់ខែ៖</b> ចុច <code>💵 ថ្ងៃបើកប្រាក់ខែ Barista</code> ដើម្បីមើលកាលវិភាគបើកប្រាក់ខែបុគ្គលិកសាខានេះ។\n\n` +
          `🔹 <b>៤. ចុះវត្តមាន៖</b> ចុច <code>📸 ចុះវត្តមាន</code> ដើម្បីស្កេន Face ID និងទីតាំង GPS នៅសាខា។\n\n` +
          `🔹 <b>៥. បើក Cafe App ពេញលេញ៖</b> ចុច <code>☕ បើក Cafe App</code> ដើម្បីចូលទៅកាន់ផ្ទាំងគ្រប់គ្រងធំ។\n\n` +
          `☕ <b>សាខាបច្ចុប្បន្ន:</b> <b>${branchDisplay}</b>\n` +
          `🆔 <b>Telegram ID របស់អ្នក:</b> <code>${telegramId}</code>`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: helpMsg,
            parse_mode: 'HTML',
            reply_markup: persistentReplyKeyboard
          })
        });

        return res.status(200).json({ ok: true });
      }

      // =================================================================================
      // DEFAULT: 🌟 MAIN MENU / START GREETING (/start or /menu)
      // =================================================================================
      const greetingName = matchedStaff ? matchedStaff.fullName : firstName;
      const checkInTime = todayAttendance?.checkIn || '--';
      const checkOutTime = todayAttendance?.checkOut || '--';

      const welcomeText = `☕ <b>សួស្តី ${greetingName}!</b>\n` +
        `សូមស្វាគមន៍មកកាន់ <b>toto by Chichi & Coffee corner Management Bot</b> 🤖\n\n` +
        `☕ <b>សាខា:</b> <b>${branchDisplay}</b>\n` +
        `🆔 <b>Chat ID:</b> <code>${chatId}</code> (បានភ្ជាប់ជោគជ័យ ✅)\n` +
        `📅 <b>ថ្ងៃនេះ:</b> <code>${phnomPenhDateStr}</code>\n` +
        `📥 <b>ម៉ោងចូល:</b> <code>${checkInTime}</code> | 📤 <b>ម៉ោងចេញ:</b> <code>${checkOutTime}</code>\n\n` +
        `🔔 <i>រាល់ការកត់ត្រាការលក់កាហ្វេ ស្តុកគ្រាប់កាហ្វេ វត្តមាន Barista និងថ្ងៃបើកប្រាក់ខែនៃសាខានេះ នឹងត្រូវផ្ញើមកកាន់ទីនេះដោយស្វ័យប្រវត្តិ។</i>\n\n` +
        `👇 <b>សូមជ្រើសរើសមុខងារដែលលោកអ្នកចង់ប្រើប្រាស់នៅខាងក្រោម៖</b>`;

      const interactiveMenuButtons = {
        inline_keyboard: [
          [
            { text: '☕ បញ្ចូលការលក់ (Daily Sales)', web_app: { url: `${baseUrl}?tab=daily-sales&branch=${effectiveBranchId}` } },
            { text: '📦 ស្តុកគ្រាប់កាហ្វេ (Inventory)', web_app: { url: `${baseUrl}?tab=inventory&branch=${effectiveBranchId}` } }
          ],
          [
            { text: '💵 ថ្ងៃបើកប្រាក់ខែ (Payday)', callback_data: 'cmd_salary' },
            { text: '📊 របាយការណ៍វត្តមាន', callback_data: 'report' }
          ],
          [
            { text: '📸 ចុះឈ្មោះចូល (Check In)', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } },
            { text: '📸 ចុះឈ្មោះចេញ (Check Out)', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
          ],
          [
            { text: '☕ បើក Cafe App ពេញលេញ', web_app: { url: `${baseUrl}` } }
          ]
        ]
      };

      // Send greeting with bottom Reply Keyboard
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: welcomeText,
          parse_mode: 'HTML',
          reply_markup: persistentReplyKeyboard
        })
      });

      // Send inline interactive buttons menu
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '⚡ <b>ផ្ទាំងម៉ឺនុយរហ័ស (Interactive Cafe Actions):</b>',
          parse_mode: 'HTML',
          reply_markup: interactiveMenuButtons
        })
      });

      return res.status(200).json({ ok: true });
    } catch (e: any) {
      return res.status(200).json({ ok: true, error: e?.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
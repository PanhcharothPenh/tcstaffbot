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
          const neededIds = ['staff', 'branches', 'users'];
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
          const allUsers = Array.isArray(batch['users']) ? batch['users'] : [];
          storedConfig = batch['telegramConfig'] || { chatIds: { branches: {} } };
          storedRecipients = Array.isArray(batch['telegramRecipients']) ? batch['telegramRecipients'] : [];

          const isNotInactive = (item: any) => {
            if (!item) return false;
            const st = String(item.status || '').toLowerCase().trim();
            return st !== 'inactive' && st !== 'terminated' && st !== 'resigned' && st !== 'disabled' && st !== 'locked';
          };

          const isTgMatch = (storedId: any, storedUser: any) => {
            const sId = String(storedId || '').trim();
            const sUser = String(storedUser || '').replace(/^@/, '').toLowerCase().trim();
            if (telegramId) {
              if (sId === telegramId || sUser === telegramId) return true;
            }
            if (cleanTgHandle) {
              if (sUser === cleanTgHandle || sId === cleanTgHandle || sId.replace(/^@/, '').toLowerCase() === cleanTgHandle) return true;
            }
            return false;
          };

          // 8. Find matching staff by Telegram ID or Username
          matchedStaff = allStaff.find((s: any) => isNotInactive(s) && isTgMatch(s.telegramId, s.telegramUsername));

          // 8b. Also check User Management accounts (Owner, Admin, Manager, Staff)
          const matchedUser = allUsers.find((u: any) => isNotInactive(u) && isTgMatch(u.telegramChatId || u.telegramId, u.telegramUsername));

          if (!matchedStaff && matchedUser) {
            const userRole = matchedUser.role || 'Admin';
            const roleTitle = 
              userRole === 'Owner' ? 'ម្ចាស់ហាង (Store Owner)' :
              userRole === 'Admin' ? 'អ្នកគ្រប់គ្រងជាន់ខ្ពស់ (Admin)' :
              userRole === 'Manager' ? 'អ្នកគ្រប់គ្រងសាខា (Manager)' :
              userRole === 'Staff' ? 'បុគ្គលិក (Staff)' : userRole;

            matchedStaff = {
              id: 'staff_usr_' + (matchedUser.id || Date.now()),
              fullName: matchedUser.fullName || matchedUser.username,
              position: roleTitle,
              role: userRole,
              gender: 'Other',
              phone: matchedUser.phone || '012 888 999',
              branchId: matchedUser.assignedBranchIds?.[0] || 'b1',
              assignedBranchIds: matchedUser.assignedBranchIds || ['b1', 'b2'],
              status: 'Active',
              telegramId: telegramId,
              telegramUsername: cleanTgHandle ? `@${cleanTgHandle}` : undefined,
              telegramLinked: true,
              faceEnrolled: false,
              attendanceEnabled: true,
              createdAt: new Date().toISOString()
            };
            allStaff.unshift(matchedStaff);
            saveDbCollectionAsync(supabase, 'staff', allStaff);

            if (!matchedUser.telegramChatId || matchedUser.telegramChatId !== telegramId) {
              matchedUser.telegramChatId = telegramId;
              matchedUser.telegramId = telegramId;
              if (cleanTgHandle && !matchedUser.telegramUsername) {
                matchedUser.telegramUsername = `@${cleanTgHandle}`;
              }
              saveDbCollectionAsync(supabase, 'users', allUsers);
            }
          }

          // Ensure any Owner, Admin, Manager is in storedRecipients
          if (matchedStaff && ['Owner', 'Admin', 'Manager'].includes(matchedStaff.role) && telegramId) {
            if (storedRecipients && Array.isArray(storedRecipients)) {
              let recIdx = storedRecipients.findIndex((r: any) => String(r.chatId) === telegramId);
              if (recIdx >= 0) {
                storedRecipients[recIdx].role = matchedStaff.role;
                storedRecipients[recIdx].branchId = 'all';
                storedRecipients[recIdx].isActive = true;
              } else {
                storedRecipients.push({
                  id: 'rec_' + telegramId,
                  name: matchedStaff.fullName,
                  chatId: telegramId,
                  role: matchedStaff.role,
                  branchId: 'all',
                  isActive: true,
                  categories: ['all', 'sales', 'stock', 'salary', 'attendance', 'leave'],
                  createdAt: new Date().toISOString()
                });
                saveDbCollectionAsync(supabase, 'telegramRecipients', storedRecipients);
              }
            }
          }

          // Assign Clean24 (@clean24vengsreng / ID: 8412569939) as Branch Owner
          const isClean24Owner = (telegramId === '8412569939' || cleanTgHandle === 'clean24vengsreng');
          if (isClean24Owner) {
            if (!matchedStaff) {
              matchedStaff = {
                id: 'staff_owner_clean24',
                fullName: 'Clean24 (Owner)',
                position: 'ម្ចាស់ហាង (Store Owner)',
                role: 'Owner',
                gender: 'Other',
                phone: '012 888 999',
                branchId: 'b1',
                assignedBranchIds: ['b1', 'b2'],
                status: 'Active',
                telegramId: '8412569939',
                telegramUsername: '@clean24vengsreng',
                telegramLinked: true,
                faceEnrolled: false,
                attendanceEnabled: true,
                createdAt: new Date().toISOString()
              };
              allStaff.unshift(matchedStaff);
              saveDbCollectionAsync(supabase, 'staff', allStaff);
            } else {
              matchedStaff.position = 'ម្ចាស់ហាង (Store Owner)';
              matchedStaff.role = 'Owner';
              matchedStaff.telegramId = '8412569939';
              matchedStaff.telegramUsername = '@clean24vengsreng';
              matchedStaff.telegramLinked = true;
              matchedStaff.status = 'Active';
              saveDbCollectionAsync(supabase, 'staff', allStaff);
            }

            // Ensure Clean24 receives all alerts & reports as Owner
            if (storedRecipients && Array.isArray(storedRecipients)) {
              let recIdx = storedRecipients.findIndex((r: any) => String(r.chatId) === '8412569939');
              if (recIdx >= 0) {
                storedRecipients[recIdx].role = 'Owner / Executive';
                storedRecipients[recIdx].branchId = 'all';
                storedRecipients[recIdx].isActive = true;
              } else {
                storedRecipients.push({
                  id: 'rec_owner_clean24',
                  name: 'Clean24 (Store Owner)',
                  chatId: '8412569939',
                  role: 'Owner / Executive',
                  branchId: 'all',
                  isActive: true,
                  categories: ['all', 'sales', 'stock', 'salary', 'attendance', 'leave'],
                  createdAt: new Date().toISOString()
                });
              }
              saveDbCollectionAsync(supabase, 'telegramRecipients', storedRecipients);
            }
          }

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

      const isOwnerRole = Boolean(
        telegramId === '8412569939' ||
        cleanTgHandle === 'clean24vengsreng' ||
        (matchedStaff && (
          matchedStaff.role === 'Owner' || 
          matchedStaff.role === 'Admin' || 
          matchedStaff.role === 'Manager' ||
          (matchedStaff.position && (
            matchedStaff.position.toLowerCase().includes('owner') ||
            matchedStaff.position.toLowerCase().includes('admin') ||
            matchedStaff.position.toLowerCase().includes('manager') ||
            matchedStaff.position.includes('ម្ចាស់ហាង') ||
            matchedStaff.position.includes('អ្នកគ្រប់គ្រង')
          ))
        ))
      );

      // Check matched staff
      if (!effectiveBranchId && matchedStaff?.branchId) {
        effectiveBranchId = matchedStaff.branchId;
      }

      // Default fallback
      if (!effectiveBranchId) effectiveBranchId = 'b1';

      if (!staffBranch) {
        staffBranch = allBranches.find((b: any) => b.id === effectiveBranchId) || {
          id: effectiveBranchId,
          branchName: effectiveBranchId === 'b2' ? 'Coffee corner' : 'Toto By Chi Chi MC Park'
        };
      }

      // Determine staff's specific branch
      const assignedIds = Array.isArray(matchedStaff?.assignedBranchIds) ? matchedStaff.assignedBranchIds : [];
      const staffSpecificBranchId = matchedStaff?.branchId || (assignedIds.length === 1 && assignedIds[0] !== 'all' ? assignedIds[0] : effectiveBranchId) || 'b1';
      const staffSpecificBranchObj = allBranches.find((b: any) => b.id === staffSpecificBranchId);
      const staffSpecificBranchName = staffSpecificBranchObj?.branchName || (staffSpecificBranchId === 'b2' ? 'Coffee corner' : 'Toto By Chi Chi MC Park');

      // Determine branch display for header:
      // Only show All Branches if Owner OR if explicitly assigned to 'all' or multiple branches
      const hasAllBranches = 
        (isOwnerRole && (assignedIds.length === 0 || assignedIds.includes('all'))) || 
        assignedIds.includes('all') || 
        (assignedIds.length > 1 && allBranches.length > 0 && assignedIds.length >= allBranches.length);

      let branchDisplay = '';
      if (hasAllBranches) {
        branchDisplay = 'គ្រប់សាខាទាំងអស់ (All Branches)';
      } else if (assignedIds.length > 1) {
        const names = assignedIds.map((id: string) => {
          const b = allBranches.find((x: any) => x.id === id);
          return b?.branchName || id;
        });
        branchDisplay = names.join(' | ');
      } else {
        branchDisplay = staffSpecificBranchName;
      }

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
      // ACTION: 🧹 REMOVE UNWANTED OLD KEYBOARD (e.g. Hospital VPNs, NSSF Branches, etc.)
      // =================================================================================
      const isUnwantedKeyboard = 
        userText.toLowerCase().includes('hospital') ||
        userText.toLowerCase().includes('vpn') ||
        userText.toLowerCase().includes('nssf') ||
        userText.toLowerCase().includes('subnet') ||
        userText.toLowerCase().includes('reopen') ||
        userText === '/clear' ||
        userText === '/clean' ||
        userText === '/remove_keyboard' ||
        userText === '/reset';

      if (isUnwantedKeyboard) {
        return sendOrReply(res, botToken, {
          chat_id: chatId,
          text: `🗑️ <b>[បានលុបប៊ូតុងចាស់ៗចេញជោគជ័យ]</b>\n\nប្រព័ន្ធបានដកចេញនូវ Keyboard ចាស់ៗរួចរាល់ហើយ។ សូមវាយ <code>/start</code> ដើម្បីប្រើប្រាស់ម៉ឺនុយ <b>TC Staff</b>។`,
          parse_mode: 'HTML',
          reply_markup: { remove_keyboard: true }
        });
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
      // 1. Staff Keyboard: Strictly Check In/Out, Attendance List, and Leave Request (សុំច្បាប់)
      const staffReplyKeyboard = {
        keyboard: [
          [
            { text: '📸 ចុះឈ្មោះចូល', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } },
            { text: '🚪 ចុះឈ្មោះចេញ', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
          ],
          [
            { text: '📊 មើលប្រវត្តិវត្តមាន', web_app: { url: `${baseUrl}/attendance-app?action=history` } },
            { text: '📝 សុំច្បាប់' }
          ]
        ],
        resize_keyboard: true,
        is_persistent: true
      };

      // 2. Owner & Manager Keyboard: Full Options (Check In/Out, All Staff Attendance, Leave Requests, Account Info, Guide)
      const ownerReplyKeyboard = {
        keyboard: [
          [
            { text: '📸 ចុះឈ្មោះចូល', web_app: { url: `${baseUrl}/attendance-app?action=checkin` } },
            { text: '🚪 ចុះឈ្មោះចេញ', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } }
          ],
          [
            { text: '👥 វត្តមានបុគ្គលិកទាំងអស់' },
            { text: '📑 ពាក្យសុំច្បាប់ទាំងអស់' }
          ],
          [
            { text: '📊 មើលប្រវត្តិវត្តមាន', web_app: { url: `${baseUrl}/attendance-app?action=history` } },
            { text: '👤 ព័ត៌មានគណនី' },
            { text: '❓ របៀបប្រើប្រាស់' }
          ]
        ],
        resize_keyboard: true,
        is_persistent: true
      };

      const persistentReplyKeyboard = isOwnerRole ? ownerReplyKeyboard : staffReplyKeyboard;

      // =================================================================================
      // NOTICE: ⚠️ គណនីមិនទាន់បានភ្ជាប់ (Item 1 ខ)
      // =================================================================================
      const cleanUsername = cleanTgHandle ? `@${cleanTgHandle}` : 'គ្មាន';
      const unlinkedStaffNotice = `👋 <b>សួស្តី ${firstName}!</b>\n\n` +
        `⚠️ <b>គណនីមិនទាន់បានភ្ជាប់</b>\n\n` +
        `គណនី Telegram របស់អ្នកមិនទាន់បានភ្ជាប់ជាមួយព័ត៌មានបុគ្គលិកក្នុងប្រព័ន្ធនៅឡើយទេ។\n\n` +
        `🆔 <b>Telegram ID:</b> <code>${telegramId}</code>\n` +
        `💬 <b>Chat ID:</b> <code>${chatId}</code>\n` +
        `👤 <b>Username:</b> ${cleanUsername}\n\n` +
        `👉 សូមផ្ញើ <b>Telegram ID</b> ខាងលើទៅកាន់ <b>ម្ចាស់ហាង</b> ដើម្បីភ្ជាប់គណនី និងចាប់ផ្តើមប្រើប្រាស់ប្រព័ន្ធ។`;

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
          return sendOrReply(res, botToken, { chat_id: chatId, text: unlinkedStaffNotice, parse_mode: 'HTML' });
        }

        // If staff already checked in today, show started confirmation (Item 2 ក)
        if (todayAttendance?.checkIn) {
          const startedMsg = `✅ <b>បានចាប់ផ្តើមការងារសម្រាប់ថ្ងៃនេះ</b>\n\n` +
            `👤 <b>បុគ្គលិក:</b> ${matchedStaff.fullName}\n` +
            `💼 <b>តួនាទី:</b> ${matchedStaff.position || 'Staff'}\n` +
            `🏢 <b>សាខា:</b> ${branchDisplay}\n` +
            `📅 <b>កាលបរិច្ឆេទ:</b> <code>${phnomPenhDateStr}</code>\n` +
            `🕒 <b>ម៉ោងចូល:</b> <code>${todayAttendance.checkIn}</code>\n\n` +
            `✨ <i>សូមជូនពរឱ្យការងារថ្ងៃនេះប្រព្រឹត្តទៅដោយរលូន។</i>`;

          const startedButtons = {
            inline_keyboard: [
              [
                { text: '🚪 ចុះឈ្មោះចេញ (Check Out)', web_app: { url: `${baseUrl}/attendance-app?action=checkout` } },
                { text: '📊 មើលប្រវត្តិវត្តមាន', web_app: { url: `${baseUrl}/attendance-app?action=history` } }
              ]
            ]
          };

          return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: startedMsg,
            parse_mode: 'HTML',
            reply_markup: startedButtons
          });
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
          return sendOrReply(res, botToken, { chat_id: chatId, text: unlinkedStaffNotice, parse_mode: 'HTML' });
        }

        // If staff already checked out today, show completion confirmation
        if (todayAttendance?.checkOut) {
          const completedMsg = `✅ <b>បានបញ្ចប់ការងារសម្រាប់ថ្ងៃនេះ</b>\n\n` +
            `👤 <b>បុគ្គលិក:</b> ${matchedStaff.fullName}\n` +
            `💼 <b>តួនាទី:</b> ${matchedStaff.position || 'Staff'}\n` +
            `🏢 <b>សាខា:</b> ${branchDisplay}\n` +
            `📅 <b>កាលបរិច្ឆេទ:</b> <code>${phnomPenhDateStr}</code>\n` +
            `🕒 <b>ម៉ោងចេញ:</b> <code>${todayAttendance.checkOut}</code>\n\n` +
            `🙏 <i>សូមអរគុណសម្រាប់ការបំពេញការងារថ្ងៃនេះ។</i>`;

          const completedButtons = {
            inline_keyboard: [
              [
                { text: '📊 មើលប្រវត្តិវត្តមាន', web_app: { url: `${baseUrl}/attendance-app?action=history` } }
              ]
            ]
          };

          return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: completedMsg,
            parse_mode: 'HTML',
            reply_markup: completedButtons
          });
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
      // ACTION: 👥 របាយការណ៍វត្តមានបុគ្គលិកទាំងអស់ (OWNER: ALL STAFF ATTENDANCE TODAY)
      // =================================================================================
      if (userText.includes('វត្តមានបុគ្គលិកទាំងអស់') || (userText.includes('វត្តមានបុគ្គលិក') && isOwnerRole)) {
        const todayRecords = allAtt.filter((a: any) => a.date === phnomPenhDateStr);
        const presentStaff = todayRecords.filter((a: any) => a.checkIn);
        const absentStaff = allStaff.filter((s: any) => s.status === 'Active' && !todayRecords.some((a: any) => a.staffId === s.id && a.checkIn));

        let summaryText = `👥 <b>[របាយការណ៍វត្តមានបុគ្គលិកថ្ងៃនេះ]</b>\n` +
          `📅 <b>កាលបរិច្ឆេទ:</b> <code>${phnomPenhDateStr}</code>\n\n` +
          `🟢 <b>បានចុះឈ្មោះចូល (${presentStaff.length} នាក់)៖</b>\n`;

        if (presentStaff.length === 0) {
          summaryText += `<i>(មិនទាន់មានបុគ្គលិកចុះឈ្មោះចូលនៅឡើយទេ)</i>\n`;
        } else {
          presentStaff.forEach((r: any, idx: number) => {
            const st = allStaff.find((s: any) => s.id === r.staffId);
            const name = st?.fullName || r.staffName || 'Staff';
            const bName = allBranches.find((b: any) => b.id === (st?.branchId || r.branchId))?.branchName || '';
            summaryText += `${idx + 1}. <b>${name}</b> ${bName ? `(${bName})` : ''}: ចូល <code>${r.checkIn}</code> ${r.checkOut ? `→ ចេញ <code>${r.checkOut}</code>` : ''}\n`;
          });
        }

        if (absentStaff.length > 0) {
          summaryText += `\n🔴 <b>មិនទាន់ចូល (${absentStaff.length} នាក់)៖</b>\n`;
          absentStaff.forEach((s: any, idx: number) => {
            summaryText += `- ${s.fullName} (${s.position || 'Staff'})\n`;
          });
        }

        return sendOrReply(res, botToken, {
          chat_id: chatId,
          text: summaryText,
          parse_mode: 'HTML',
          reply_markup: persistentReplyKeyboard
        });
      }

      // =================================================================================
      // ACTION: ✅ អនុម័ត ឬ ❌ បដិសេធពាក្យសុំច្បាប់ (APPROVE / REJECT LEAVE REQUEST)
      // =================================================================================
      const isLeaveApprove = isCallback && callbackQuery.data?.startsWith('leave_appr_');
      const isLeaveReject = isCallback && callbackQuery.data?.startsWith('leave_rejc_');

      if (isLeaveApprove || isLeaveReject) {
        const leaveId = (callbackQuery.data || '').replace(isLeaveApprove ? 'leave_appr_' : 'leave_rejc_', '');
        const approverName = matchedStaff?.fullName || firstName || (cleanTgHandle ? `@${cleanTgHandle}` : 'Admin / Owner');

        let leaveList: any[] = [];
        if (supabase) {
          try {
            const { data: row } = await supabase.from('clean24_collections').select('data').eq('id', 'leaveRequests').maybeSingle();
            leaveList = Array.isArray(row?.data) ? row.data : [];
            if (leaveList.length === 0) {
              const { data: tcRow } = await supabase.from('tc_collections').select('data').eq('id', 'leaveRequests').maybeSingle();
              leaveList = Array.isArray(tcRow?.data) ? tcRow.data : [];
            }
          } catch (e) {}
        }

        const leaveIndex = leaveList.findIndex((l: any) => l.id === leaveId);
        if (leaveIndex === -1) {
          if (callbackQuery.id) {
            fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: callbackQuery.id, text: 'រកមិនឃើញពាក្យសុំច្បាប់នេះ ឬត្រូវបានដំណើរការរួចហើយ!' })
            }).catch(() => {});
          }
          return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: `⚠️ <b>រកមិនឃើញពាក្យសុំច្បាប់នេះឡើយ (ID: <code>${leaveId}</code>) ឬត្រូវបានដំណើរការរួចហើយ!</b>`,
            parse_mode: 'HTML'
          });
        }

        const targetLeave = leaveList[leaveIndex];
        const staffObj = (allStaff || []).find((s: any) => s.id === targetLeave.staffId) || { fullName: targetLeave.staffName };
        const staffNotifyTarget = String(targetLeave.staffChatId || targetLeave.staffTelegramId || staffObj?.telegramId || '');

        if (isLeaveApprove) {
          targetLeave.status = 'Approved';
          targetLeave.approvedBy = approverName;
          targetLeave.approvedAt = new Date().toISOString();

          // Auto record into attendance as 'Permission'
          if (supabase) {
            try {
              const { data: attRow } = await supabase.from('clean24_collections').select('data').eq('id', 'attendance').maybeSingle();
              let attList = Array.isArray(attRow?.data) ? attRow.data : [];
              const leaveDate = targetLeave.date || phnomPenhDateStr;
              const existAttIdx = attList.findIndex((a: any) => a.staffId === targetLeave.staffId && a.date === leaveDate);
              
              if (existAttIdx >= 0) {
                attList[existAttIdx].status = 'Permission';
                attList[existAttIdx].notes = `ច្បាប់ឈប់សម្រាក (${targetLeave.details || 'Approved by Admin'})`;
              } else {
                attList.unshift({
                  id: 'att_' + Date.now(),
                  staffId: targetLeave.staffId,
                  staffName: targetLeave.staffName,
                  branchId: targetLeave.branchId || 'b1',
                  branchName: targetLeave.branchName || 'Toto By Chi Chi MC Park',
                  date: leaveDate,
                  checkIn: '--',
                  checkOut: '--',
                  workHours: 0,
                  overtimeHours: 0,
                  status: 'Permission',
                  source: 'manual',
                  notes: `ច្បាប់ឈប់សម្រាក (${targetLeave.details || 'Approved by Admin'})`,
                  createdAt: new Date().toISOString()
                });
              }

              await supabase.from('clean24_collections').upsert({
                id: 'attendance',
                data: attList,
                updated_at: new Date().toISOString()
              });
              await supabase.from('tc_collections').upsert({
                id: 'attendance',
                data: attList,
                updated_at: new Date().toISOString()
              });
            } catch (err) {
              console.error('Failed to sync attendance for approved leave:', err);
            }
          }

          // Save leaveRequests
          if (supabase) {
            try {
              await supabase.from('clean24_collections').upsert({
                id: 'leaveRequests',
                data: leaveList,
                updated_at: new Date().toISOString()
              });
              await supabase.from('tc_collections').upsert({
                id: 'leaveRequests',
                data: leaveList,
                updated_at: new Date().toISOString()
              });
            } catch (err) {}
          }

          // Answer callback query toast
          if (callbackQuery.id) {
            fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: callbackQuery.id, text: `✅ បានអនុម័តច្បាប់របស់ ${targetLeave.staffName} រួចរាល់!` })
            }).catch(() => {});
          }

          // 1. Notify the staff member who requested leave DIRECTLY back on Telegram
          if (staffNotifyTarget) {
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: staffNotifyTarget,
                  text: `✅ <b>[ពាក្យសុំច្បាប់ត្រូវបានអនុម័ត / Leave Approved]</b>\n\n` +
                    `👋 សួស្តី <b>${targetLeave.staffName}</b>!\n` +
                    `📅 កាលបរិច្ឆេទ៖ <code>${targetLeave.date || phnomPenhDateStr}</code>\n` +
                    `🏢 សាខា៖ <b>${targetLeave.branchName || 'Toto By Chi Chi MC Park'}</b>\n` +
                    `📝 ខ្លឹមសារ៖ <b>${targetLeave.details || 'សុំច្បាប់'}</b>\n` +
                    `👤 អនុម័តដោយ៖ <b>${approverName}</b>\n\n` +
                    `✨ ប្រព័ន្ធបានកត់ត្រាវត្តមានជា «ច្បាប់សម្រាក (Permission)» ជូនរួចរាល់ហើយ។`,
                  parse_mode: 'HTML'
                })
              });
            } catch (notifyErr) {
              console.error('Failed to send approval notice to staff:', notifyErr);
            }
          }

          // 2. Update the original alert message in the group/chat to show approved status & disable buttons
          if (msg?.message_id && chatId) {
            try {
              const updatedText = (msg.text || '')
                .replace('👉 ចុចប៊ូតុងខាងក្រោមដើម្បី «អនុម័ត» ឬ «បដិសេធ» ភ្លាមៗ៖', '')
                .trim() +
                `\n\n━━━━━━━━━━━━━━━━━\n` +
                `✅ <b>[បានអនុម័តដោយ ${approverName}]</b>\n` +
                `🕒 <b>ម៉ោងអនុម័ត:</b> <code>${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Phnom_Penh' })}</code>\n` +
                `🔔 <i>បានជូនដំណឹងទៅកាន់បុគ្គលិក <b>${targetLeave.staffName}</b> រួចរាល់ហើយ។</i>`;

              await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: msg.message_id,
                  text: updatedText,
                  parse_mode: 'HTML',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: `✅ បានអនុម័តរួចរាល់ (${approverName})`, callback_data: 'noop' }
                      ]
                    ]
                  }
                })
              });
            } catch (e) {}
          }

          const responseText = `✅ <b>[បានអនុម័តពាក្យសុំច្បាប់ជោគជ័យ]</b>\n\n` +
            `👤 <b>បុគ្គលិក:</b> <b>${targetLeave.staffName}</b>\n` +
            `🏢 <b>សាខា:</b> <b>${targetLeave.branchName || 'Toto By Chi Chi MC Park'}</b>\n` +
            `📅 <b>កាលបរិច្ឆេទ:</b> <code>${targetLeave.date || phnomPenhDateStr}</code>\n` +
            `📝 ខ្លឹមសារ: ${targetLeave.details || 'ច្បាប់'}\n` +
            `👤 <b>អ្នកអនុម័ត:</b> <b>${approverName}</b>\n\n` +
            `✨ ប្រព័ន្ធបានកត់ត្រាវត្តមាន និងបានជូនដំណឹងទៅកាន់បុគ្គលិករួចរាល់ហើយ។`;

          return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: responseText,
            parse_mode: 'HTML'
          });
        }

        if (isLeaveReject) {
          targetLeave.status = 'Rejected';
          targetLeave.rejectedBy = approverName;
          targetLeave.rejectedAt = new Date().toISOString();

          // Save leaveRequests
          if (supabase) {
            try {
              await supabase.from('clean24_collections').upsert({
                id: 'leaveRequests',
                data: leaveList,
                updated_at: new Date().toISOString()
              });
              await supabase.from('tc_collections').upsert({
                id: 'leaveRequests',
                data: leaveList,
                updated_at: new Date().toISOString()
              });
            } catch (err) {}
          }

          // Answer callback toast
          if (callbackQuery.id) {
            fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: callbackQuery.id, text: `❌ បានបដិសេធច្បាប់របស់ ${targetLeave.staffName}!` })
            }).catch(() => {});
          }

          // 1. Notify the staff member who requested leave DIRECTLY back on Telegram
          if (staffNotifyTarget) {
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: staffNotifyTarget,
                  text: `❌ <b>[ពាក្យសុំច្បាប់ត្រូវបានបដិសេធ / Leave Rejected]</b>\n\n` +
                    `👋 សួស្តី <b>${targetLeave.staffName}</b>!\n` +
                    `📅 កាលបរិច្ឆេទ៖ <code>${targetLeave.date || ''}</code>\n` +
                    `🏢 សាខា៖ <b>${targetLeave.branchName || 'Toto By Chi Chi MC Park'}</b>\n` +
                    `📝 ខ្លឹមសារ៖ ${targetLeave.details || ''}\n` +
                    `👤 ពិនិត្យដោយ៖ <b>${approverName}</b>\n\n` +
                    `សូមទាក់ទងមកកាន់អ្នកគ្រប់គ្រងផ្ទាល់សម្រាប់ព័ត៌មានបន្ថែម។`,
                  parse_mode: 'HTML'
                })
              });
            } catch (e) {}
          }

          // 2. Update the original alert message in the group/chat to show rejected status & disable buttons
          if (msg?.message_id && chatId) {
            try {
              const updatedText = (msg.text || '')
                .replace('👉 ចុចប៊ូតុងខាងក្រោមដើម្បី «អនុម័ត» ឬ «បដិសេធ» ភ្លាមៗ៖', '')
                .trim() +
                `\n\n━━━━━━━━━━━━━━━━━\n` +
                `❌ <b>[បានបដិសេធដោយ ${approverName}]</b>\n` +
                `🕒 <b>ម៉ោង:</b> <code>${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Phnom_Penh' })}</code>\n` +
                `🔔 <i>បានជូនដំណឹងទៅកាន់បុគ្គលិក <b>${targetLeave.staffName}</b> រួចរាល់ហើយ។</i>`;

              await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: msg.message_id,
                  text: updatedText,
                  parse_mode: 'HTML',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: `❌ បានបដិសេធ (${approverName})`, callback_data: 'noop' }
                      ]
                    ]
                  }
                })
              });
            } catch (e) {}
          }

          const responseText = `❌ <b>[បានបដិសេធពាក្យសុំច្បាប់]</b>\n\n` +
            `👤 <b>បុគ្គលិក:</b> <b>${targetLeave.staffName}</b>\n` +
            `🏢 <b>សាខា:</b> <b>${targetLeave.branchName || 'Toto By Chi Chi MC Park'}</b>\n` +
            `📅 <b>កាលបរិច្ឆេទ:</b> <code>${targetLeave.date || ''}</code>\n` +
            `📝 ខ្លឹមសារ: ${targetLeave.details || ''}\n` +
            `👤 <b>អ្នកពិនិត្យ:</b> <b>${approverName}</b>\n\n` +
            `បានជូនដំណឹងទៅកាន់បុគ្គលិករួចរាល់ហើយ។`;

          return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: responseText,
            parse_mode: 'HTML'
          });
        }
      }

      // =================================================================================
      // ACTION: 📑 បញ្ជីពាក្យសុំច្បាប់ទាំងអស់ (OWNER: ALL LEAVE REQUESTS)
      // =================================================================================
      if (userText.includes('ពាក្យសុំច្បាប់ទាំងអស់') || (userText.includes('ពាក្យសុំច្បាប់') && isOwnerRole)) {
        let leaveList: any[] = [];
        if (supabase) {
          try {
            const { data } = await supabase.from('clean24_collections').select('data').eq('id', 'leaveRequests').maybeSingle();
            leaveList = Array.isArray(data?.data) ? data.data : [];
            if (leaveList.length === 0) {
              const { data: tcRow } = await supabase.from('tc_collections').select('data').eq('id', 'leaveRequests').maybeSingle();
              leaveList = Array.isArray(tcRow?.data) ? tcRow.data : [];
            }
          } catch {}
        }

        let leaveMsg = `📑 <b>[បញ្ជីពាក្យសុំច្បាប់របស់បុគ្គលិក]</b>\n\n`;
        const pendingLeaves = leaveList.filter((l: any) => l.status === 'Pending').slice(0, 8);

        const inlineKeyboardButtons: any[] = [];

        if (pendingLeaves.length === 0) {
          leaveMsg += `✅ <b>គ្មានពាក្យសុំច្បាប់ដែលកំពុងរង់ចាំ (Pending) ឡើយ។</b>\n\nបុគ្គលិកទាំងអស់បំពេញការងារជាធម្មតា។`;
        } else {
          leaveMsg += `⏳ <b>ពាក្យសុំច្បាប់កំពុងរង់ចាំ (${pendingLeaves.length})៖</b>\n\n`;
          pendingLeaves.forEach((l: any, idx: number) => {
            leaveMsg += `${idx + 1}. 👤 <b>${l.staffName || 'បុគ្គលិក'}</b> (${l.branchName || ''})\n` +
              `📅 ថ្ងៃ៖ <code>${l.date || ''}</code>\n` +
              `📝 មូលហេតុ៖ ${l.details || l.reason || 'ច្បាប់'}\n` +
              `──────────────\n`;

            inlineKeyboardButtons.push([
              { text: `✅ អនុម័ត (${l.staffName || 'បុគ្គលិក'})`, callback_data: `leave_appr_${l.id}` },
              { text: `❌ បដិសេធ`, callback_data: `leave_rejc_${l.id}` }
            ]);
          });
          leaveMsg += `👉 ចុចប៊ូតុងខាងក្រោមដើម្បី «អនុម័ត» ឬ «បដិសេធ» ភ្លាមៗ៖`;
        }

        return sendOrReply(res, botToken, {
          chat_id: chatId,
          text: leaveMsg,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboardButtons.length > 0 ? { inline_keyboard: inlineKeyboardButtons } : persistentReplyKeyboard
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
          return sendOrReply(res, botToken, { chat_id: chatId, text: unlinkedStaffNotice, parse_mode: 'HTML' });
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
      // ACTION: 📝 សុំច្បាប់ឈប់សម្រាក (LEAVE REQUEST)
      // =================================================================================
      const isLeaveCallback = isCallback && (
        callbackQuery.data === 'leave_sick' ||
        callbackQuery.data === 'leave_personal' ||
        callbackQuery.data === 'leave_annual' ||
        (callbackQuery.data?.startsWith('leave_') && !callbackQuery.data?.startsWith('leave_appr_') && !callbackQuery.data?.startsWith('leave_rejc_'))
      );
      const isLeaveCmd = 
        userText === '📝 សុំច្បាប់' || 
        userText === 'សុំច្បាប់' || 
        userText === '/leave' || 
        userText.toLowerCase().includes('leave') || 
        userText.includes('សុំច្បាប់') ||
        userText.includes('សុំឈប់');

      if (isLeaveCallback || isLeaveCmd) {
        if (!matchedStaff) {
          return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: unlinkedStaffNotice,
            parse_mode: 'HTML',
            reply_markup: persistentReplyKeyboard
          });
        }

        // 1. Handle specific leave type button clicks
        if (isLeaveCallback) {
          const typeCode = callbackQuery.data.replace('leave_', '');
          const typeName = 
            typeCode === 'sick' ? 'ឈឺ' :
            typeCode === 'personal' ? 'ធុរៈផ្ទាល់ខ្លួន' :
            typeCode === 'annual' ? 'សម្រាកប្រចាំឆ្នាំ' : 'ច្បាប់ទូទៅ';

          const typeTitle = 
            typeCode === 'sick' ? 'ឈឺ (Sick Leave)' :
            typeCode === 'personal' ? 'ធុរៈផ្ទាល់ខ្លួន (Personal Leave)' :
            typeCode === 'annual' ? 'សម្រាកប្រចាំឆ្នាំ (Annual Leave)' : 'ច្បាប់ទូទៅ';

          const leavePrompt = `📝 <b>[ពាក្យសុំច្បាប់៖ ${typeTitle}]</b>\n\n` +
            `👤 <b>បុគ្គលិក៖</b> <b>${matchedStaff.fullName}</b>\n` +
            `🏢 <b>សាខា៖</b> <b>${staffSpecificBranchName}</b>\n\n` +
            `👉 <b>សូមវាយផ្ញើសារតាមទម្រង់ខាងក្រោមមកកាន់ Bot៖</b>\n` +
            `សុំច្បាប់ ${typeName} ថ្ងៃទី ${phnomPenhDateStr} មូលហេតុ [មូលហេតុរបស់អ្នក]\n\n` +
            `📌 <b>ឧទាហរណ៍៖</b>\n` +
            `សុំច្បាប់ ${typeName} ថ្ងៃទី ${phnomPenhDateStr} មូលហេតុ ឈឺក្បាលក្តៅខ្លួនមិនអាចមកធ្វើការបាន`;

          return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: leavePrompt,
            parse_mode: 'HTML',
            reply_markup: persistentReplyKeyboard
          });
        }

        // 2. Handle detailed leave submission text (e.g. "សុំច្បាប់ឈឺ ថ្ងៃទី... មូលហេតុ...")
        const isDetailedLeaveSubmission = userText.length > 10 && (
          userText.includes('ថ្ងៃ') || 
          userText.includes('មូលហេតុ') || 
          userText.includes('ឈឺ') || 
          userText.includes('ធុរៈ') || 
          userText.includes('ខែ')
        );

        if (isDetailedLeaveSubmission) {
          const newLeaveId = 'leave_' + Date.now();
          // Record leave request into database
          if (supabase) {
            try {
              const { data: leaveRow } = await supabase.from('clean24_collections').select('data').eq('id', 'leaveRequests').maybeSingle();
              let leaveList = Array.isArray(leaveRow?.data) ? leaveRow.data : [];
              if (leaveList.length === 0) {
                const { data: tcRow } = await supabase.from('tc_collections').select('data').eq('id', 'leaveRequests').maybeSingle();
                leaveList = Array.isArray(tcRow?.data) ? tcRow.data : [];
              }
              const newLeave = {
                id: newLeaveId,
                staffId: matchedStaff.id,
                staffName: matchedStaff.fullName,
                staffTelegramId: String(telegramId || matchedStaff.telegramId || chatId || ''),
                staffChatId: String(chatId || ''),
                branchId: staffSpecificBranchId,
                branchName: staffSpecificBranchName,
                details: userText,
                status: 'Pending',
                createdAt: new Date().toISOString(),
                date: phnomPenhDateStr
              };
              leaveList.unshift(newLeave);
              await supabase.from('clean24_collections').upsert({
                id: 'leaveRequests',
                data: leaveList,
                updated_at: new Date().toISOString()
              });
              await supabase.from('tc_collections').upsert({
                id: 'leaveRequests',
                data: leaveList,
                updated_at: new Date().toISOString()
              });
            } catch (err) {
              console.error('Failed to save leave request:', err);
            }
          }

          const confirmStaffMsg = `✅ <b>[បានទទួលពាក្យសុំច្បាប់ជោគជ័យ]</b>\n\n` +
            `👤 <b>បុគ្គលិក:</b> <b>${matchedStaff.fullName}</b>\n` +
            `🏢 <b>សាខា:</b> <b>${staffSpecificBranchName}</b>\n` +
            `📅 <b>កាលបរិច្ឆេទស្នើសុំ:</b> <code>${phnomPenhDateStr}</code>\n` +
            `📝 <b>ខ្លឹមសារស្នើសុំ:</b>\n${userText}\n\n` +
            `⏳ <b>ស្ថានភាព:</b> <b>រង់ចាំការអនុម័ត (Pending)</b>\n\n` +
            `🔔 ប្រព័ន្ធបានកត់ត្រា និងជូនដំណឹងទៅកាន់អ្នកគ្រប់គ្រងរួចរាល់ហើយ។`;

          // Forward notification with Approve & Reject buttons to Branch Group & Owner
          const leaveActionButtons = {
            inline_keyboard: [
              [
                { text: `✅ អនុម័ត (${matchedStaff.fullName})`, callback_data: `leave_appr_${newLeaveId}` },
                { text: '❌ បដិសេធ', callback_data: `leave_rejc_${newLeaveId}` }
              ]
            ]
          };

          const alertMsg = `🔔 <b>[ដំណឹងសុំច្បាប់ឈប់សម្រាកបុគ្គលិក]</b>\n\n` +
            `👤 <b>បុគ្គលិក:</b> <b>${matchedStaff.fullName}</b>\n` +
            `💼 <b>តួនាទី:</b> ${matchedStaff.position || 'Staff'}\n` +
            `🏢 <b>សាខា:</b> <b>${staffSpecificBranchName}</b>\n` +
            `📅 <b>កាលបរិច្ឆេទ:</b> <code>${phnomPenhDateStr}</code>\n\n` +
            `📝 <b>ខ្លឹមសារស្នើសុំ:</b>\n${userText}\n\n` +
            `🕒 <b>ម៉ោងស្នើសុំ:</b> <code>${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Phnom_Penh' })}</code>\n\n` +
            `👉 ចុចប៊ូតុងខាងក្រោមដើម្បី «អនុម័ត» ឬ «បដិសេធ» ភ្លាមៗ៖`;

          const branchTargetChatId = storedConfig?.chatIds?.branches?.[staffSpecificBranchId] || storedConfig?.chatIds?.branches?.[effectiveBranchId] || storedConfig?.chatIds?.branches?.b1;
          const targetRecipients = new Set<string>();
          if (branchTargetChatId && branchTargetChatId !== chatId) targetRecipients.add(branchTargetChatId);
          // Also send to owner chat (8412569939) if different from current sender
          if (chatId !== '8412569939' && matchedStaff.telegramId !== '8412569939') targetRecipients.add('8412569939');

          for (const targetId of targetRecipients) {
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: targetId,
                  text: alertMsg,
                  parse_mode: 'HTML',
                  reply_markup: leaveActionButtons
                })
              });
            } catch (e) {}
          }

          return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: confirmStaffMsg,
            parse_mode: 'HTML',
            reply_markup: persistentReplyKeyboard
          });
        }

        // 3. If staff clicked "📝 សុំច្បាប់", provide interactive leave type options
        const leaveMenuMsg = `📝 <b>[ទម្រង់សុំច្បាប់ឈប់សម្រាក / Leave Request]</b>\n\n` +
          `👤 <b>បុគ្គលិក:</b> <b>${matchedStaff.fullName}</b>\n` +
          `🏢 <b>សាខា:</b> <b>${branchDisplay}</b>\n` +
          `📅 <b>ថ្ងៃនេះ:</b> <code>${phnomPenhDateStr}</code>\n\n` +
          `👇 <b>សូមជ្រើសរើសប្រភេទច្បាប់ដែលអ្នកចង់ស្នើសុំ៖</b>`;

        const leaveButtons = {
          inline_keyboard: [
            [
              { text: '🤒 សុំច្បាប់ឈឺ (Sick Leave)', callback_data: 'leave_sick' }
            ],
            [
              { text: '👨‍👩‍👧 ធុរៈផ្ទាល់ខ្លួន (Personal Leave)', callback_data: 'leave_personal' }
            ],
            [
              { text: '🏖️ ឈប់សម្រាកប្រចាំឆ្នាំ (Annual Leave)', callback_data: 'leave_annual' }
            ]
          ]
        };

        return sendOrReply(res, botToken, {
          chat_id: chatId,
          text: leaveMenuMsg,
          parse_mode: 'HTML',
          reply_markup: leaveButtons
        });
      }

      // =================================================================================
      // DEFAULT: 🌟 MAIN MENU / START GREETING (/start or /menu)
      // =================================================================================
      if (!matchedStaff) {
        const unlinkedMenuButtons = {
          inline_keyboard: [
            [
              { text: '🆔 ពិនិត្យ Chat ID / Telegram ID', callback_data: '/id' }
            ]
          ]
        };

        return sendOrReply(res, botToken, {
            chat_id: chatId,
            text: unlinkedStaffNotice,
            parse_mode: 'HTML',
            reply_markup: unlinkedMenuButtons
          });
      }

      const greetingName = matchedStaff.fullName;
      const checkInTime = todayAttendance?.checkIn || '--';
      const checkOutTime = todayAttendance?.checkOut || '--';
      const staffPos = matchedStaff.position || 'Staff';

      const welcomeText = `👋 <b>សួស្តី ${greetingName}!</b>\n\n` +
        `🏢 <b>សាខា:</b> ${branchDisplay}\n` +
        `💼 <b>តួនាទី:</b> ${staffPos}\n` +
        `📅 <b>ថ្ងៃនេះ:</b> <code>${phnomPenhDateStr}</code>\n\n` +
        `⏱️ <b>វត្តមាន:</b> 🟢 <code>${checkInTime}</code> → 🔴 <code>${checkOutTime}</code>\n\n` +
        `👇 <i>ជ្រើសរើសមុខងារពីប៊ូតុងម៉ឺនុយខាងក្រោម៖</i>`;

      // Set the 5 persistent bottom reply keyboard buttons for instant access
      return sendOrReply(res, botToken, {
          chat_id: chatId,
          text: welcomeText,
          parse_mode: 'HTML',
          reply_markup: persistentReplyKeyboard
        });
    } catch (e: any) {
      return res.status(200).json({ ok: true, error: e?.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
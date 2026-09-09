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
    return res.status(200).json({ success: true, message: 'Clean24 Telegram Attendance Report Endpoint Active' });
  }

  try {
    const { 
      target, // 'staff' | 'admin' | 'custom'
      staffId,
      customChatId,
      messageText,
      photoBase64
    } = req.body || {};

    let botToken = '';
    const reqBranchId = (req.body?.branchId || '').toLowerCase();
    if (reqBranchId === 'b1' || reqBranchId.includes('vs') || reqBranchId.includes('veng')) {
      botToken = process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG || '';
    } else if (reqBranchId === 'b2' || reqBranchId.includes('cd') || reqBranchId.includes('chomka')) {
      botToken = process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG || '';
    }
    if (!botToken) {
      botToken = (
        process.env.TELEGRAM_BOT_TOKEN_COFFEE ||
        process.env.TELEGRAM_BOT_TOKEN ||
        process.env.TELEGRAM_BOT_TOKEN_CODE ||
        process.env.BOT_TOKEN ||
        process.env.TELEGRAM_BOT_TOKEN_ATTENDANCE ||
        process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG ||
        process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG ||
        ''
      ).trim();
    }

    const supabase = getSupabase();
    let allStaff: any[] = [];
    let allUsers: any[] = [];
    let storedConfig: any = null;
    let chatRegistry: any[] = [];

    if (supabase) {
      try {
        let { data: sData } = await supabase.from('tc_collections').select('data').eq('id', 'staff').maybeSingle();
        if (!sData || !sData.data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'staff').maybeSingle();
          if (alt.data) sData = alt;
        }
        if (sData && Array.isArray(sData.data)) allStaff = sData.data;

        let { data: uData } = await supabase.from('tc_collections').select('data').eq('id', 'users').maybeSingle();
        if (!uData || !uData.data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'users').maybeSingle();
          if (alt.data) uData = alt;
        }
        if (uData && Array.isArray(uData.data)) allUsers = uData.data;

        let { data: cfgData } = await supabase.from('tc_collections').select('data').eq('id', 'telegramConfig').maybeSingle();
        if (!cfgData || !cfgData.data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'telegramConfig').maybeSingle();
          if (alt.data) cfgData = alt;
        }
        if (cfgData?.data) storedConfig = cfgData.data;

        let { data: regData } = await supabase.from('tc_collections').select('data').eq('id', 'telegram_chat_registry').maybeSingle();
        if (!regData || !regData.data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'telegram_chat_registry').maybeSingle();
          if (alt.data) regData = alt;
        }
        if (regData && Array.isArray(regData.data)) chatRegistry = regData.data;
      } catch (e) {
        console.warn('Supabase fetch collections warning:', e);
      }
    }

    let destinationChatId = '';
    let targetRecipientLabel = '';
    let staffUsername = '';

    if (target === 'staff') {
      const staff = allStaff.find((s: any) => s.id === staffId);
      if (staff) {
        staffUsername = staff.telegramUsername ? staff.telegramUsername.replace(/^@/, '') : '';
        destinationChatId = String(staff.telegramId || staff.telegramChatId || '').trim();

        if (staff.branchId) {
          const sBranch = String(staff.branchId).toLowerCase();
          if ((sBranch === 'b1' || sBranch.includes('vs') || sBranch.includes('veng')) && process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG) {
            botToken = process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG;
          } else if ((sBranch === 'b2' || sBranch.includes('cd') || sBranch.includes('chomka')) && process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG) {
            botToken = process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG;
          }
        }

        if (!destinationChatId || !/^-?\d+$/.test(destinationChatId)) {
          const matchedUser = allUsers.find((u: any) => 
            (staff.userId && u.id === staff.userId) ||
            (staffUsername && u.username && u.username.toLowerCase() === staffUsername.toLowerCase()) ||
            (staffUsername && u.telegramUsername && u.telegramUsername.replace(/^@/, '').toLowerCase() === staffUsername.toLowerCase()) ||
            (u.fullName && staff.fullName && u.fullName.toLowerCase().trim() === staff.fullName.toLowerCase().trim())
          );
          if (matchedUser?.telegramChatId && /^-?\d+$/.test(matchedUser.telegramChatId)) {
            destinationChatId = matchedUser.telegramChatId;
          }
        }

        if (!destinationChatId && staff.telegramUsername) {
          destinationChatId = staff.telegramUsername.startsWith('@') ? staff.telegramUsername : `@${staff.telegramUsername}`;
        }
        targetRecipientLabel = `${staff.fullName} (${destinationChatId || 'Telegram'})`;
      } else {
        destinationChatId = '';
        targetRecipientLabel = `Staff (${destinationChatId || 'គ្មាន Telegram'})`;
      }
    } else if (target === 'admin') {
      const ownerUser = allUsers.find((u: any) => u.role === 'Owner' || u.id === 'usr_owner');
      if (ownerUser?.telegramChatId && /^-?\d+$/.test(ownerUser.telegramChatId)) {
        destinationChatId = ownerUser.telegramChatId;
      }
      if (!destinationChatId && storedConfig?.chatIds?.owner) {
        destinationChatId = String(storedConfig.chatIds.owner);
      }
      if (!destinationChatId && storedConfig?.lastPrivateChatId) {
        destinationChatId = String(storedConfig.lastPrivateChatId);
      }
      if (!destinationChatId && chatRegistry.length > 0) {
        const ownerReg = chatRegistry.find((r: any) => r.isOwner || r.username === 'roth' || r.username === 'millerppc') || chatRegistry[chatRegistry.length - 1];
        if (ownerReg?.chatId) destinationChatId = String(ownerReg.chatId);
      }
      if (!destinationChatId) {
        destinationChatId = process.env.TELEGRAM_CHAT_ID || '';
      }
      targetRecipientLabel = `Admin / TC Staff Bot (${destinationChatId || 'Default'})`;
    } else if (target === 'custom') {
      destinationChatId = customChatId || '';
      targetRecipientLabel = `Custom Chat (${destinationChatId})`;
    }

    if (!destinationChatId) {
      if (storedConfig?.chatIds?.owner) destinationChatId = String(storedConfig.chatIds.owner);
      else if (chatRegistry.length > 0) destinationChatId = String(chatRegistry[chatRegistry.length - 1].chatId);
      else destinationChatId = process.env.TELEGRAM_CHAT_ID || '';
      targetRecipientLabel = `Admin (${destinationChatId || 'Default'})`;
    }

    const captionToSend = (messageText || '').length > 950 ? (messageText || '').substring(0, 950) + '...' : messageText;
    let photoSent = false;
    let lastError = '';

    if (photoBase64 && photoBase64.startsWith('data:image/')) {
      try {
        const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append('chat_id', destinationChatId);
        formData.append('photo', blob, 'attendance_report.jpg');
        if (captionToSend) {
          formData.append('caption', captionToSend);
          formData.append('parse_mode', 'HTML');
        }

        const resTg = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          body: formData
        });
        const dataTg = await resTg.json() as any;
        if (dataTg.ok) {
          photoSent = true;
        } else {
          lastError = dataTg.description || 'sendPhoto failed';
        }
      } catch (e: any) {
        lastError = e.message || 'sendPhoto failed';
      }
    }

    if (!photoSent || (messageText && messageText.length > 950)) {
      try {
        const textRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: destinationChatId,
            text: messageText,
            parse_mode: 'HTML'
          })
        });
        const textData = await textRes.json() as any;
        if (textData.ok) {
          // Sent successfully
        } else if (!photoSent) {
          lastError = textData.description || lastError;

          // Auto fallback to Admin chat if target user hasn't started the bot
          const fallbackAdminId = process.env.TELEGRAM_CHAT_ID || '';
          if (fallbackAdminId && String(destinationChatId) !== String(fallbackAdminId)) {
            try {
              const fbRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: fallbackAdminId,
                  text: `📌 <b>[របាយការណ៍វត្តមានបុគ្គលិក / Staff Attendance Report]</b>\n\n${messageText}`,
                  parse_mode: 'HTML'
                })
              });
              const fbData = await fbRes.json() as any;
              if (fbData.ok) {
                return res.status(200).json({
                  success: true,
                  message: `✓ បានផ្ញើរបាយការណ៍ទៅ Telegram Admin ដោយជោគជ័យ! (ចំណាំ៖ @${staffUsername || destinationChatId} មិនទាន់ចុច /start លើ Bot)`,
                  recipient: `Admin (${fallbackAdminId})`
                });
              }
            } catch {}
          }

          let friendlyMsg = `បរាជ័យក្នុងការផ្ញើទៅ Telegram (${destinationChatId}): ${lastError}`;
          if (lastError.includes('chat not found') || lastError.includes('bot was blocked') || destinationChatId.startsWith('@')) {
            friendlyMsg = `⚠️ មិនអាចផ្ញើទៅ ${destinationChatId} បានទេ ដោយសារគណនីនេះមិនទាន់បានចុច Start លើ Bot Telegram នៅឡើយ! សូមឱ្យបុគ្គលិកបើក Bot ហើយចុច /start ឬជ្រើសរើសផ្ញើទៅ « Admin / Group » ជំនួសវិញ។`;
          }
          return res.status(400).json({ 
            success: false, 
            error: friendlyMsg
          });
        }
      } catch (tErr: any) {
        if (!photoSent) {
          return res.status(500).json({ success: false, error: 'Telegram dispatch failure: ' + tErr.message });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `✓ បានផ្ញើរបាយការណ៍ទៅ Telegram (${targetRecipientLabel}) ដោយជោគជ័យ!`,
      recipient: targetRecipientLabel
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

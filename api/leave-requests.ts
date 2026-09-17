import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

function resolveBotToken(): string {
  return (
    process.env.TELEGRAM_BOT_TOKEN_COFFEE ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN_CODE ||
    process.env.BOT_TOKEN ||
    ''
  ).trim();
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabase();

  // Helper to load collection from production Supabase
  const loadCollection = async (id: string): Promise<any[]> => {
    if (!supabase) return [];
    try {
      const { data: tcRow, error } = await supabase.from('tc_collections').select('data, updated_at').eq('id', id).maybeSingle();
      if (error) {
        console.warn(`[leave-requests] Error loading ${id}:`, error.message);
        return [];
      }
      return Array.isArray(tcRow?.data) ? tcRow.data : [];
    } catch (err: any) {
      console.error(`[leave-requests] Exception loading ${id}:`, err?.message);
      return [];
    }
  };

  // Helper to save collection to production Supabase
  const saveCollection = async (id: string, list: any[]) => {
    if (!supabase) return false;
    const item = { id, data: list, updated_at: new Date().toISOString() };
    try {
      const { error: upsertErr } = await supabase.from('tc_collections').upsert(item, { onConflict: 'id' });
      if (!upsertErr) return true;

      console.warn(`[leave-requests] Upsert failed for ${id}: ${upsertErr.message}, trying update...`);
      const { error: updateErr } = await supabase.from('tc_collections').update({
        data: list,
        updated_at: item.updated_at
      }).eq('id', id);

      if (!updateErr) return true;

      console.warn(`[leave-requests] Update failed for ${id}: ${updateErr.message}, trying insert...`);
      const { error: insertErr } = await supabase.from('tc_collections').insert(item);
      return !insertErr;
    } catch (err: any) {
      console.error(`[leave-requests] Exception saving ${id}:`, err?.message);
      return false;
    }
  };

  // GET: Fetch leave requests
  if (req.method === 'GET') {
    const list = await loadCollection('leaveRequests');
    return res.status(200).json({ success: true, leaveRequests: list, data: list });
  }

  // POST: Actions (approve, reject, create)
  if (req.method === 'POST') {
    try {
      const { action, leaveId, approvedBy, rejectedBy, note, leaveData, deductionType, deductionAmount } = req.body || {};
      let leaveList = await loadCollection('leaveRequests');

      if (action === 'approve') {
        const idx = leaveList.findIndex((l: any) => l.id === leaveId);
        if (idx === -1) {
          return res.status(404).json({ success: false, error: 'Leave request not found' });
        }

        const leave = leaveList[idx];
        const isLateRequest = 
          leave.requestType === 'late_excused' || 
          leave.requestType === 'late_deduct' || 
          (leave.leaveType && leave.leaveType.includes('យឺត')) || 
          (leave.details && leave.details.includes('យឺត')) || 
          (leave.reason && leave.reason.includes('យឺត')) ||
          deductionType === 'no_deduct' ||
          deductionType === 'with_deduct';

        const isExcused = deductionType === 'no_deduct' || (!deductionType && (leave.requestType === 'late_excused' || (leave.leaveType && leave.leaveType.includes('មិនកាត់លុយ')) || (leave.details && leave.details.includes('មិនកាត់លុយ'))));
        const deductAmt = isExcused ? 0 : (Number(deductionAmount) > 0 ? Number(deductionAmount) : (Number(leave.deductionAmount) > 0 ? Number(leave.deductionAmount) : 1));

        leave.status = 'Approved';
        leave.approvedBy = approvedBy || 'Admin / Owner';
        leave.approvedAt = new Date().toISOString();
        leave.isLateExcused = isExcused;
        leave.deductionAmount = isLateRequest ? (isExcused ? 0 : deductAmt) : 0;
        if (note) leave.reviewNote = note;

        await saveCollection('leaveRequests', leaveList);

        // Also add or update attendance record for that day
        const allAtt = await loadCollection('attendance');
        const leaveDate = leave.date || new Date().toISOString().substring(0, 10);
        const existingAttIdx = allAtt.findIndex((a: any) => a.staffId === leave.staffId && a.date === leaveDate);

        const attStatus = isLateRequest ? 'Late' : 'Permission';
        const attNotes = isLateRequest 
          ? (isExcused 
              ? `មកយឺតអនុគ្រោះ (មិនកាត់ប្រាក់) - ${leave.details || leave.reason || 'សុំយឺត'}` 
              : `មកយឺត (កាត់ប្រាក់ $${deductAmt}) - ${leave.details || leave.reason || 'សុំយឺត'}`)
          : `ច្បាប់ឈប់សម្រាក (${leave.details || 'Approved by Admin'})`;

        if (existingAttIdx >= 0) {
          allAtt[existingAttIdx].status = attStatus;
          allAtt[existingAttIdx].notes = attNotes;
          allAtt[existingAttIdx].isLateExcused = isExcused;
          allAtt[existingAttIdx].lateDeduction = isExcused ? 0 : deductAmt;
        } else {
          allAtt.unshift({
            id: 'att_' + (isLateRequest ? 'late_' : 'perm_') + Date.now(),
            staffId: leave.staffId,
            staffName: leave.staffName,
            branchId: leave.branchId || 'b1',
            branchName: leave.branchName || 'Toto By Chi Chi MC Park',
            date: leaveDate,
            checkIn: isLateRequest ? 'Late' : '--',
            checkOut: '--',
            workHours: 0,
            overtimeHours: 0,
            status: attStatus,
            source: 'manual',
            notes: attNotes,
            isLateExcused: isExcused,
            lateDeduction: isExcused ? 0 : deductAmt,
            createdAt: new Date().toISOString()
          });
        }
        await saveCollection('attendance', allAtt);

        const formatDisplayDate = (dt?: string): string => {
          if (!dt) return '';
          if (dt.includes('/')) return dt;
          const p = dt.split('-');
          if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
          return dt;
        };

        // Notify staff on Telegram directly back
        const allStaff = await loadCollection('staff');
        const matchedStaff = allStaff.find((s: any) => s.id === leave.staffId);
        const botToken = resolveBotToken();
        const staffChatTarget = String(leave.staffChatId || leave.staffTelegramId || matchedStaff?.telegramId || '');

        const staffStatusLine = `🟢 <b>ស្ថានភាព:</b> <b>អនុម័ត</b>`;
        const groupStatusLine = isLateRequest
          ? (isExcused ? `🟢 <b>ស្ថានភាព:</b> <b>អនុម័តយឺត (មិនកាត់ប្រាក់ / Excused)</b>` : `⚠️ <b>ស្ថានភាព:</b> <b>អនុម័តយឺត (កាត់ប្រាក់ $${deductAmt})</b>`)
          : `🟢 <b>ស្ថានភាព:</b> <b>អនុម័ត</b>`;

        const titleHeader = isLateRequest ? 'ពាក្យស្នើសុំមកយឺតត្រូវបានអនុម័ត' : 'ពាក្យសុំច្បាប់ត្រូវបានអនុម័ត';

        if (botToken && staffChatTarget) {
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: staffChatTarget,
                text: `✅ <b>${titleHeader}</b>\n\n` +
                  `👋 សួស្តី <b>${leave.staffName}</b>!\n\n` +
                  `${titleHeader}។\n\n` +
                  `📅 <b>កាលបរិច្ឆេទ:</b> <code>${formatDisplayDate(leave.date || leaveDate)}</code>\n` +
                  `🏢 <b>សាខា:</b> ${leave.branchName || 'Toto By Chi Chi MC Park'}\n\n` +
                  `📝 <b>ខ្លឹមសារស្នើសុំ:</b>\n${leave.details || leave.reason || 'ស្នើសុំ'}\n\n` +
                  `👤 <b>អនុម័តដោយ:</b> ${leave.approvedBy}\n` +
                  staffStatusLine,
                parse_mode: 'HTML'
              })
            });
          } catch (e) {}
        }

        // Also broadcast notification to Branch Telegram Group and all Owners/Admins
        const config = await loadCollection('telegramConfig');
        const allUsers = await loadCollection('users');
        const broadcastTargets = new Set<string>();

        const branchGroupChatId = config?.chatIds?.branches?.[leave.branchId] || config?.chatIds?.branches?.b1;
        if (branchGroupChatId) broadcastTargets.add(String(branchGroupChatId).trim());
        if (config?.chatIds?.owner) broadcastTargets.add(String(config.chatIds.owner).trim());
        if (config?.chatIds?.admin) broadcastTargets.add(String(config.chatIds.admin).trim());

        if (Array.isArray(allUsers)) {
          for (const u of allUsers) {
            const r = String(u.role || u.roleId || '').toLowerCase();
            if (r === 'owner' || r === 'admin' || u.id === 'usr_owner') {
              const tgId = String(u.telegramChatId || u.telegramId || '').trim();
              if (tgId && /^-?\d+$/.test(tgId)) broadcastTargets.add(tgId);
            }
          }
        }

        const broadcastMsg = `📢 <b>[ដំណឹងអនុម័ត / Approval Notice]</b>\n\n` +
          `✅ ពាក្យស្នើសុំរបស់ <b>${leave.staffName}</b> ត្រូវបានអនុម័តរួចរាល់ហើយ!\n\n` +
          `👤 <b>បុគ្គលិក:</b> ${leave.staffName}\n` +
          `🏢 <b>សាខា:</b> ${leave.branchName || 'Toto By Chi Chi MC Park'}\n` +
          `📅 <b>កាលបរិច្ឆេទ:</b> <code>${formatDisplayDate(leave.date || leaveDate)}</code>\n\n` +
          `📝 <b>ខ្លឹមសារស្នើសុំ:</b>\n${leave.details || leave.reason || 'ស្នើសុំ'}\n\n` +
          `👤 <b>អ្នកអនុម័ត:</b> <b>${leave.approvedBy}</b>\n` +
          groupStatusLine + `\n\n` +
          `🔔 បានជូនដំណឹងទៅកាន់បុគ្គលិករួចរាល់។`;

        if (botToken) {
          for (const cid of broadcastTargets) {
            if (cid !== staffChatTarget) {
              try {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: cid,
                    text: broadcastMsg,
                    parse_mode: 'HTML'
                  })
                });
              } catch (e) {}
            }
          }
        }

        return res.status(200).json({ success: true, message: 'Request approved', leave, attendance: allAtt });
      }

      if (action === 'reject') {
        const idx = leaveList.findIndex((l: any) => l.id === leaveId);
        if (idx === -1) {
          return res.status(404).json({ success: false, error: 'Leave request not found' });
        }

        const leave = leaveList[idx];
        leave.status = 'Rejected';
        leave.rejectedBy = rejectedBy || 'Admin / Owner';
        leave.rejectedAt = new Date().toISOString();
        if (note) leave.reviewNote = note;

        await saveCollection('leaveRequests', leaveList);

        const formatDisplayDate = (dt?: string): string => {
          if (!dt) return '';
          if (dt.includes('/')) return dt;
          const p = dt.split('-');
          if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
          return dt;
        };

        // Notify staff on Telegram directly back
        const allStaff = await loadCollection('staff');
        const matchedStaff = allStaff.find((s: any) => s.id === leave.staffId);
        const botToken = resolveBotToken();
        const staffChatTarget = String(leave.staffChatId || leave.staffTelegramId || matchedStaff?.telegramId || '');

        if (botToken && staffChatTarget) {
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: staffChatTarget,
                text: `❌ <b>ពាក្យសុំច្បាប់ត្រូវបានបដិសេធ</b>\n\n` +
                  `👋 សួស្តី <b>${leave.staffName}</b>!\n\n` +
                  `ពាក្យសុំច្បាប់របស់អ្នកត្រូវបាន <b>បដិសេធ</b>។\n\n` +
                  `📅 <b>កាលបរិច្ឆេទ:</b> <code>${formatDisplayDate(leave.date)}</code>\n` +
                  `🏢 <b>សាខា:</b> ${leave.branchName || 'Toto By Chi Chi MC Park'}\n\n` +
                  `📝 <b>មូលហេតុសុំច្បាប់:</b>\n${leave.details || ''}\n\n` +
                  `💬 <b>មូលហេតុបដិសេធ:</b>\n${note || 'មិនមានការបញ្ជាក់មូលហេតុបន្ថែម'}\n\n` +
                  `👤 <b>ពិនិត្យដោយ:</b> ${leave.rejectedBy}\n` +
                  `🔴 <b>ស្ថានភាព:</b> <b>បដិសេធ</b>\n\n` +
                  `ℹ️ សម្រាប់ព័ត៌មានបន្ថែម សូមទាក់ទងអ្នកគ្រប់គ្រងដោយផ្ទាល់។`,
                parse_mode: 'HTML'
              })
            });
          } catch (e) {}
        }

        // Also broadcast rejection to Branch Telegram Group and all Owners/Admins
        const config = await loadCollection('telegramConfig');
        const allUsers = await loadCollection('users');
        const broadcastTargets = new Set<string>();

        const branchGroupChatId = config?.chatIds?.branches?.[leave.branchId] || config?.chatIds?.branches?.b1;
        if (branchGroupChatId) broadcastTargets.add(String(branchGroupChatId).trim());
        if (config?.chatIds?.owner) broadcastTargets.add(String(config.chatIds.owner).trim());
        if (config?.chatIds?.admin) broadcastTargets.add(String(config.chatIds.admin).trim());

        if (Array.isArray(allUsers)) {
          for (const u of allUsers) {
            const r = String(u.role || u.roleId || '').toLowerCase();
            if (r === 'owner' || r === 'admin' || u.id === 'usr_owner') {
              const tgId = String(u.telegramChatId || u.telegramId || '').trim();
              if (tgId && /^-?\d+$/.test(tgId)) broadcastTargets.add(tgId);
            }
          }
        }

        const rejectNotice = `📢 <b>[ដំណឹងបដិសេធ / Rejection Notice]</b>\n\n` +
          `❌ ពាក្យសុំច្បាប់របស់ <b>${leave.staffName}</b> ត្រូវបានបដិសេធ!\n\n` +
          `👤 <b>បុគ្គលិក:</b> ${leave.staffName}\n` +
          `🏢 <b>សាខា:</b> ${leave.branchName || 'Toto By Chi Chi MC Park'}\n` +
          `📅 <b>កាលបរិច្ឆេទ:</b> <code>${formatDisplayDate(leave.date)}</code>\n\n` +
          `📝 <b>មូលហេតុសុំច្បាប់:</b>\n${leave.details || ''}\n\n` +
          `💬 <b>មូលហេតុបដិសេធ:</b>\n${note || 'មិនមានការបញ្ជាក់មូលហេតុបន្ថែម'}\n\n` +
          `👤 <b>អ្នកពិនិត្យ:</b> <b>${leave.rejectedBy}</b>\n` +
          `🔴 <b>ស្ថានភាព:</b> <b>បដិសេធ</b>\n\n` +
          `🔔 បានជូនដំណឹងទៅកាន់បុគ្គលិករួចរាល់។`;

        if (botToken) {
          for (const cid of broadcastTargets) {
            if (cid !== staffChatTarget) {
              try {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: cid,
                    text: rejectNotice,
                    parse_mode: 'HTML'
                  })
                });
              } catch (e) {}
            }
          }
        }

        return res.status(200).json({ success: true, message: 'Leave request rejected', leave });
      }

      if (action === 'create' && leaveData) {
        leaveList.unshift(leaveData);
        await saveCollection('leaveRequests', leaveList);
        return res.status(200).json({ success: true, leave: leaveData });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

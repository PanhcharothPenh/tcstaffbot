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
      const { data: tcRow } = await supabase.from('tc_collections').select('data, updated_at').eq('id', id).maybeSingle().catch(() => ({ data: null }));
      return Array.isArray(tcRow?.data) ? tcRow.data : [];
    } catch {
      return [];
    }
  };

  // Helper to save collection to production Supabase
  const saveCollection = async (id: string, list: any[]) => {
    if (!supabase) return false;
    const item = { id, data: list, updated_at: new Date().toISOString() };
    try {
      await supabase.from('tc_collections').upsert(item);
      return true;
    } catch {
      return false;
    }
  };

  // GET: Fetch leave requests
  if (req.method === 'GET') {
    const list = await loadCollection('leaveRequests');
    return res.status(200).json({ success: true, leaveRequests: list });
  }

  // POST: Actions (approve, reject, create)
  if (req.method === 'POST') {
    try {
      const { action, leaveId, approvedBy, rejectedBy, note, leaveData } = req.body || {};
      let leaveList = await loadCollection('leaveRequests');

      if (action === 'approve') {
        const idx = leaveList.findIndex((l: any) => l.id === leaveId);
        if (idx === -1) {
          return res.status(404).json({ success: false, error: 'Leave request not found' });
        }

        const leave = leaveList[idx];
        leave.status = 'Approved';
        leave.approvedBy = approvedBy || 'Admin / Owner';
        leave.approvedAt = new Date().toISOString();
        if (note) leave.reviewNote = note;

        await saveCollection('leaveRequests', leaveList);

        // Also add attendance record for that day as Permission
        const allAtt = await loadCollection('attendance');
        const leaveDate = leave.date || new Date().toISOString().substring(0, 10);
        const existingAttIdx = allAtt.findIndex((a: any) => a.staffId === leave.staffId && a.date === leaveDate);

        if (existingAttIdx >= 0) {
          allAtt[existingAttIdx].status = 'Permission';
          allAtt[existingAttIdx].notes = `ច្បាប់ឈប់សម្រាក (${leave.details || 'Approved by Admin'})`;
        } else {
          allAtt.unshift({
            id: 'att_perm_' + Date.now(),
            staffId: leave.staffId,
            staffName: leave.staffName,
            branchId: leave.branchId || 'b1',
            branchName: leave.branchName || 'Toto By Chi Chi MC Park',
            date: leaveDate,
            checkIn: '--',
            checkOut: '--',
            workHours: 0,
            overtimeHours: 0,
            status: 'Permission',
            source: 'manual',
            notes: `ច្បាប់ឈប់សម្រាក (${leave.details || 'Approved by Admin'})`,
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

        if (botToken && staffChatTarget) {
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: staffChatTarget,
                text: `✅ <b>ពាក្យសុំច្បាប់ត្រូវបានអនុម័ត</b>\n\n` +
                  `👋 សួស្តី <b>${leave.staffName}</b>!\n\n` +
                  `ពាក្យសុំច្បាប់របស់អ្នកត្រូវបាន <b>អនុម័ត</b>។\n\n` +
                  `📅 <b>កាលបរិច្ឆេទ:</b> <code>${formatDisplayDate(leave.date || leaveDate)}</code>\n` +
                  `🏢 <b>សាខា:</b> ${leave.branchName || 'Toto By Chi Chi MC Park'}\n\n` +
                  `📝 <b>មូលហេតុសុំច្បាប់:</b>\n${leave.details || 'សុំច្បាប់'}\n\n` +
                  `👤 <b>អនុម័តដោយ:</b> ${leave.approvedBy}\n` +
                  `🟢 <b>ស្ថានភាព:</b> <b>អនុម័ត</b>`,
                parse_mode: 'HTML'
              })
            });
          } catch (e) {}
        }

        // Also broadcast notification to Branch Telegram Group
        const config = await loadCollection('telegramConfig');
        const branchGroupChatId = config?.chatIds?.branches?.[leave.branchId] || config?.chatIds?.branches?.b1;
        if (botToken && branchGroupChatId && branchGroupChatId !== staffChatTarget) {
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: branchGroupChatId,
                text: `✅ <b>ពាក្យសុំច្បាប់ត្រូវបានអនុម័ត</b>\n\n` +
                  `👤 <b>បុគ្គលិក:</b> ${leave.staffName}\n` +
                  `🏢 <b>សាខា:</b> ${leave.branchName || 'Toto By Chi Chi MC Park'}\n` +
                  `📅 <b>កាលបរិច្ឆេទ:</b> <code>${formatDisplayDate(leave.date || leaveDate)}</code>\n\n` +
                  `📝 <b>មូលហេតុសុំច្បាប់:</b>\n${leave.details || 'សុំច្បាប់'}\n\n` +
                  `👤 <b>អ្នកអនុម័ត:</b> ${leave.approvedBy}\n` +
                  `🟢 <b>ស្ថានភាព:</b> <b>អនុម័ត</b>\n\n` +
                  `🔔 បានជូនដំណឹងទៅកាន់បុគ្គលិករួចរាល់។`,
                parse_mode: 'HTML'
              })
            });
          } catch (e) {}
        }

        return res.status(200).json({ success: true, message: 'Leave request approved', leave, attendance: allAtt });
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

        // Also broadcast rejection to Branch Telegram Group
        const config = await loadCollection('telegramConfig');
        const branchGroupChatId = config?.chatIds?.branches?.[leave.branchId] || config?.chatIds?.branches?.b1;
        if (botToken && branchGroupChatId && branchGroupChatId !== staffChatTarget) {
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: branchGroupChatId,
                text: `❌ <b>ពាក្យសុំច្បាប់ត្រូវបានបដិសេធ</b>\n\n` +
                  `👤 <b>បុគ្គលិក:</b> ${leave.staffName}\n` +
                  `🏢 <b>សាខា:</b> ${leave.branchName || 'Toto By Chi Chi MC Park'}\n` +
                  `📅 <b>កាលបរិច្ឆេទ:</b> <code>${formatDisplayDate(leave.date)}</code>\n\n` +
                  `📝 <b>មូលហេតុសុំច្បាប់:</b>\n${leave.details || ''}\n\n` +
                  `💬 <b>មូលហេតុបដិសេធ:</b>\n${note || 'មិនមានការបញ្ជាក់មូលហេតុបន្ថែម'}\n\n` +
                  `👤 <b>អ្នកពិនិត្យ:</b> ${leave.rejectedBy}\n` +
                  `🔴 <b>ស្ថានភាព:</b> <b>បដិសេធ</b>\n\n` +
                  `🔔 បានជូនដំណឹងទៅកាន់បុគ្គលិករួចរាល់។`,
                parse_mode: 'HTML'
              })
            });
          } catch (e) {}
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

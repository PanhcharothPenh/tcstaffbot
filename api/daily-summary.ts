import { applySecurityHeaders, verifyCron, requireAuth, getSession, escHtml } from './_lib/security.js';
import { getSupabase, getBotToken } from './_lib/users-store.js';
import { adminChatIds } from './_lib/link-request.js';

async function load(id: string): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.from('tc_collections').select('data').eq('id', id).maybeSingle();
  return Array.isArray(data?.data) ? data.data : [];
}

const isReal = (t?: string) => Boolean(t && t !== '--' && /\d/.test(String(t)));
const activeStaff = (s: any) => {
  const st = String(s?.status || '').toLowerCase();
  const pos = String(s?.position || '').toLowerCase();
  return s && st !== 'inactive' && st !== 'terminated' && st !== 'resigned' && st !== 'suspended' && st !== 'disabled'
    && String(s.role || '').toLowerCase() !== 'owner' && String(s.roleId || '').toLowerCase() !== 'owner' && !pos.includes('owner');
};

/** Evening summary per branch, sent to owners/admins. Triggered by cron (CRON_SECRET) or by an owner/admin. */
export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const session = getSession(req);
  const manual = Boolean(session && ['owner', 'admin'].includes(String(session.roleId).toLowerCase()));
  if (!verifyCron(req) && !manual) return res.status(401).json({ error: 'Unauthorized' });

  const token = getBotToken();
  if (!token) return res.status(200).json({ success: false, error: 'Bot token not configured' });

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
  const [staff, branches, attendance, leaves] = await Promise.all([load('staff'), load('branches'), load('attendance'), load('leaveRequests')]);
  const todays = attendance.filter(a => a?.date === today);

  const approvedLeaveToday = new Set<string>(
    leaves.filter(l => l?.status === 'Approved' && l.date === today && (!l.requestType || l.requestType === 'leave')).map(l => String(l.staffId))
  );

  const lines: string[] = [];
  for (const b of branches.length ? branches : [{ id: 'all', branchName: 'ទាំងអស់' }]) {
    const members = staff.filter(s => activeStaff(s) && (b.id === 'all' || s.branchId === b.id));
    if (!members.length) continue;
    const recs = new Map<string, any>();
    for (const a of todays) if (a?.staffId) recs.set(String(a.staffId), a);

    const present: string[] = [], late: string[] = [], absent: string[] = [], onLeave: string[] = [];
    for (const s of members) {
      const r = recs.get(String(s.id));
      const name = String(s.fullName || s.id);
      if (r && isReal(r.checkIn)) {
        present.push(name);
        if (r.status === 'Late' || Number(r.lateMinutes) > 0) late.push(`${name}${r.lateMinutes ? ` (${r.lateMinutes} នាទី)` : ''}`);
      } else if (approvedLeaveToday.has(String(s.id)) || r?.status === 'Permission') {
        onLeave.push(name);
      } else {
        absent.push(name);
      }
    }
    const list = (arr: string[]) => arr.slice(0, 10).map(n => `• ${escHtml(n)}`).join('\n') + (arr.length > 10 ? `\n… និង ${arr.length - 10} នាក់ទៀត` : '');
    let block = `🏢 <b>${escHtml(b.branchName || b.id)}</b>\n✅ មកធ្វើការ: <b>${present.length}</b>/${members.length}   ⏰ យឺត: <b>${late.length}</b>   🏖️ ច្បាប់: <b>${onLeave.length}</b>   ❌ អវត្តមាន: <b>${absent.length}</b>`;
    if (late.length) block += `\n\n⏰ <b>មកយឺត</b>\n${list(late)}`;
    if (absent.length) block += `\n\n❌ <b>អវត្តមាន</b>\n${list(absent)}`;
    lines.push(block);
  }

  if (!lines.length) return res.status(200).json({ success: true, sent: 0, note: 'No data' });

  const text = `📊 <b>សង្ខេបវត្តមានថ្ងៃនេះ</b> — <code>${today}</code>\n\n${lines.join('\n\n━━━━━━━━━━\n\n')}`;
  const admins = await adminChatIds();
  let sent = 0;
  for (const cid of admins) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cid, text, parse_mode: 'HTML' })
      });
      if ((await r.json() as any).ok) sent++;
    } catch { /* continue */ }
  }
  return res.status(200).json({ success: true, sent });
}

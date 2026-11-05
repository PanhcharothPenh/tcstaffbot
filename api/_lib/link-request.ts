import { getSupabase } from './users-store.js';
import { escHtml } from './security.js';

const OWNER_CHAT_ID = (process.env.OWNER_TELEGRAM_CHAT_ID || '').trim() || '__unset__';

async function load(id: string): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.from('tc_collections').select('data').eq('id', id).maybeSingle();
  return Array.isArray(data?.data) ? data.data : [];
}

export async function adminChatIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  if (OWNER_CHAT_ID !== '__unset__') ids.add(OWNER_CHAT_ID);
  for (const u of await load('users')) {
    const r = String(u?.roleId || '').toLowerCase();
    const cid = String(u?.telegramChatId || '').trim();
    if ((r === 'owner' || r === 'admin') && /^-?\d+$/.test(cid) && u.status !== 'Locked') ids.add(cid);
  }
  return ids;
}

async function tgSend(token: string, chatId: string, text: string, reply_markup?: any) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup })
    });
  } catch { /* best effort */ }
}

const isActive = (s: any) => {
  const st = String(s?.status || '').toLowerCase();
  return st !== 'inactive' && st !== 'terminated' && st !== 'resigned' && st !== 'suspended' && st !== 'disabled';
};

/** Tell all admins that a Telegram user wants to be linked, with one-tap buttons for unlinked staff. */
export async function notifyAdminsOfLinkRequest(
  botToken: string,
  tg: { id: string | number; username?: string; first_name?: string; last_name?: string }
): Promise<number> {
  const tgId = String(tg.id);
  const staff = await load('staff');
  // already linked? nothing to do
  if (staff.some(s => String(s?.telegramId || '') === tgId)) return 0;

  const unlinked = staff
    .filter(s => s && isActive(s) && !s.telegramId && !String(s.role || '').toLowerCase().includes('owner'))
    .slice(0, 10);

  const name = [tg.first_name, tg.last_name].filter(Boolean).join(' ') || '-';
  const text =
    `🔔 <b>សំណើភ្ជាប់គណនី Telegram</b>\n\n` +
    `👤 ឈ្មោះ Telegram: ${escHtml(name)}\n` +
    `🆔 Telegram ID: <code>${escHtml(tgId)}</code>\n` +
    `👤 Username: ${tg.username ? '@' + escHtml(tg.username) : '-'}\n\n` +
    `👇 ជ្រើសរើសបុគ្គលិកដែលត្រូវភ្ជាប់ ឬបដិសេធ៖`;

  const rows: any[] = unlinked.map(s => [{ text: `✅ ${String(s.fullName || s.id).slice(0, 30)}`, callback_data: `lk_${tgId}_${s.id}` }]);
  rows.push([{ text: '❌ បដិសេធ', callback_data: `lkx_${tgId}` }]);

  const admins = await adminChatIds();
  for (const cid of admins) await tgSend(botToken, cid, text, { inline_keyboard: rows });
  return admins.size;
}

/** Handles the admin's button taps. Returns the text to show the admin, or null if not a link action. */
export async function handleLinkCallback(botToken: string, data: string, actorId: string): Promise<string | null> {
  if (!/^lkx?_/.test(data)) return null;
  const admins = await adminChatIds();
  if (!admins.has(String(actorId))) return '⛔ អ្នកមិនមានសិទ្ធិធ្វើសកម្មភាពនេះទេ។';

  if (data.startsWith('lkx_')) {
    const tgId = data.slice(4);
    await tgSend(botToken, tgId, '❌ សំណើភ្ជាប់គណនីរបស់អ្នកត្រូវបានបដិសេធ។ សូមទាក់ទង Admin ដោយផ្ទាល់។');
    return `❌ បានបដិសេធសំណើរបស់ ${tgId}`;
  }

  const m = data.match(/^lk_(-?\d+)_(.+)$/);
  if (!m) return '⚠️ ទិន្នន័យមិនត្រឹមត្រូវ';
  const [, tgId, staffId] = m;

  const sb = getSupabase();
  if (!sb) return '⚠️ មិនអាចភ្ជាប់មូលដ្ឋានទិន្នន័យបានទេ';
  const staff = await load('staff');
  const idx = staff.findIndex(s => s?.id === staffId);
  if (idx === -1) return '⚠️ រកមិនឃើញបុគ្គលិកនេះទេ';
  if (staff.some(s => String(s?.telegramId || '') === tgId)) return 'ℹ️ Telegram ID នេះត្រូវបានភ្ជាប់រួចហើយ។';
  if (staff[idx].telegramId && String(staff[idx].telegramId) !== tgId) return 'ℹ️ បុគ្គលិកនេះមាន Telegram ភ្ជាប់រួចហើយ។';

  staff[idx] = { ...staff[idx], telegramId: tgId, telegramLinked: true, updatedAt: new Date().toISOString() };
  const { error } = await sb.from('tc_collections').upsert({ id: 'staff', data: staff, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) return '⚠️ រក្សាទុកមិនបានទេ សូមព្យាយាមម្តងទៀត។';

  await tgSend(botToken, tgId, `✅ គណនីរបស់អ្នកត្រូវបានភ្ជាប់ជាមួយ <b>${escHtml(staff[idx].fullName || '')}</b> រួចរាល់។\nផ្ញើ /start ដើម្បីចាប់ផ្តើមចុះវត្តមាន។`);
  return `✅ បានភ្ជាប់ ${staff[idx].fullName || staffId} ជាមួយ Telegram ${tgId}`;
}

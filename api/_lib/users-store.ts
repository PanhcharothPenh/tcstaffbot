import { createClient } from '@supabase/supabase-js';
import { hashPassword } from './security.js';

/**
 * Prefer SUPABASE_SERVICE_ROLE_KEY (server only, never shipped to the browser) so that Row Level Security
 * can be enabled on tc_collections with NO public policies. Falls back to the anon key for compatibility.
 */
export function getSupabase() {
  const clean = (v?: string) => (v || '').replace(/['"]/g, '').trim();
  const url = clean(process.env.SUPABASE_URL);
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY) || clean(process.env.SUPABASE_ANON_KEY);
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

/** Throws when the database is unreachable (callers must fail closed). */
export async function loadUsers(): Promise<any[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await supabase.from('tc_collections').select('data').eq('id', 'users').maybeSingle();
  if (error) throw new Error('Database error');
  const list: any[] = Array.isArray(data?.data) ? data.data : [];
  if (list.length === 0) return bootstrapOwner();
  return list;
}

/**
 * First-run only: if the users table is empty, an owner can be provisioned from env vars
 * BOOTSTRAP_OWNER_USERNAME / BOOTSTRAP_OWNER_PASSWORD / BOOTSTRAP_OWNER_TELEGRAM_CHAT_ID.
 * Remove the variables once the real owner account exists.
 */
function bootstrapOwner(): any[] {
  const username = (process.env.BOOTSTRAP_OWNER_USERNAME || '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD || '';
  const chat = (process.env.BOOTSTRAP_OWNER_TELEGRAM_CHAT_ID || '').trim();
  if (!username || password.length < 10 || !/^-?\d+$/.test(chat)) return [];
  return [{
    id: 'usr_bootstrap_owner', username, password: hashPassword(password), email: `${username}@p2bkh.tech`,
    fullName: username, role: 'Owner', roleId: 'owner', status: 'Active', assignedBranchIds: [],
    telegramUsername: '', telegramChatId: chat, twoFactorMethod: 'telegram'
  }];
}

export async function saveUsers(users: any[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Database not configured');
  const payload = { id: 'users', data: users, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('tc_collections').upsert(payload, { onConflict: 'id' });
  if (error) throw new Error('Database error saving users');
}

export function getBotToken(): string {
  return (
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

/** Only ever the user's OWN stored numeric chat id - no fuzzy matching on names. */
export function chatIdForUser(user: any): string | null {
  const id = String(user?.telegramChatId || user?.telegramId || '').trim();
  return /^-?\d+$/.test(id) ? id : null;
}

export async function sendTelegram(chatId: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const token = getBotToken();
  if (!token) return { ok: false, error: 'bot not configured' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML' })
    });
    const j: any = await r.json();
    return j.ok ? { ok: true } : { ok: false, error: j.description || 'telegram error' };
  } catch (e: any) {
    return { ok: false, error: 'network error' };
  }
}

export function parseBody(req: any): any {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = {}; }
  }
  return b && typeof b === 'object' ? b : {};
}

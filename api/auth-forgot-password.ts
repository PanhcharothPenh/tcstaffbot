import { applySecurityHeaders, limit, createMfaToken, generateOtp, escHtml } from './_lib/security';
import { loadUsers, chatIdForUser, sendTelegram, parseBody } from './_lib/users-store';

export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = parseBody(req);
  const identifier = String(body.usernameOrEmail || body.email || '').trim().toLowerCase().slice(0, 120);
  if (!identifier) return res.status(400).json({ error: 'Username or email is required' });

  if (!limit(req, res, 'forgot-ip', 10, 15 * 60_000)) return;
  if (!limit(req, res, 'forgot-acct', 3, 15 * 60_000, identifier)) return;

  const cleanId = identifier.replace('@p2bkh.tech', '');
  let users: any[] = [];
  try { users = await loadUsers(); } catch { return res.status(503).json({ error: 'Service temporarily unavailable' }); }

  const user = users.find(u =>
    String(u.username || '').toLowerCase() === cleanId || String(u.email || '').toLowerCase() === identifier
  );

  // Always return the same shape (no account enumeration). The PIN is sent ONLY to the
  // account's own Telegram chat and is never returned to the caller.
  const otp = generateOtp();
  const chatId = user ? chatIdForUser(user) : null;
  const mfaToken = createMfaToken(String(user?.id || 'unknown'), String(user?.username || cleanId), otp, 'reset');

  if (user && chatId && user.status !== 'Locked') {
    await sendTelegram(chatId,
      `🔑 <b>[TC Staff Password Reset PIN]</b>\n\nAccount: <b>@${escHtml(user.username)}</b>\nPIN: <code>${otp}</code>\n\nValid for 10 minutes. If you did not request this, ignore this message.`
    );
  }

  return res.status(200).json({
    success: true,
    message: 'If the account exists and has Telegram linked, a reset PIN has been sent.',
    mfaToken
  });
}

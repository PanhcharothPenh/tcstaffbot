import { applySecurityHeaders, limit, checkMfaToken, issueSession, sanitizeUser, escHtml } from './_lib/security';
import { loadUsers, chatIdForUser, sendTelegram, parseBody } from './_lib/users-store';

export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = parseBody(req);
    const mfaToken = String(body.mfaToken || '');
    const code = String(body.code || '').trim();

    if (!code || !mfaToken) return res.status(400).json({ error: '2FA code and token are required' });

    // 6-digit code => keep guesses very low per IP and per token
    if (!limit(req, res, 'mfa-ip', 15, 10 * 60_000)) return;
    if (!limit(req, res, 'mfa-tok', 5, 10 * 60_000, mfaToken.slice(-24))) return;

    const claims = checkMfaToken(mfaToken, code, 'login');
    if (!claims) {
      return res.status(400).json({ error: 'លេខកូដ 2FA មិនត្រឹមត្រូវ ឬផុតកំណត់ (Invalid or expired 2FA code)' });
    }

    let users: any[];
    try { users = await loadUsers(); } catch { return res.status(503).json({ error: 'Service temporarily unavailable' }); }

    const user = users.find(u => u.id === claims.sub);
    if (!user || user.status === 'Locked' || user.status === 'Inactive') {
      return res.status(401).json({ error: 'Account unavailable' });
    }

    const tokens = issueSession(user);

    // Login notice (best effort)
    const chatId = chatIdForUser(user);
    if (chatId) {
      const when = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Phnom_Penh', dateStyle: 'short', timeStyle: 'medium', hour12: false }).format(new Date());
      sendTelegram(chatId,
        `✅ <b>[TC Staff Management - ចូលប្រើប្រាស់ជោគជ័យ]</b>\n\n👤 <b>គណនី:</b> ${escHtml(user.fullName || user.username)} (${escHtml(user.role)})\n📅 <code>${escHtml(when)}</code>\n\nប្រសិនបើមិនមែនជាអ្នកទេ សូមទាក់ទងម្ចាស់ភ្លាមៗ។`
      ).catch(() => {});
    }

    return res.status(200).json({ success: true, ...tokens, user: sanitizeUser(user) });
  } catch (err: any) {
    console.error('[auth-verify-2fa]', err?.message);
    return res.status(500).json({ error: '2FA verification failed' });
  }
}

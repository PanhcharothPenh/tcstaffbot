import { applySecurityHeaders, limit, checkMfaToken, hashPassword, validatePasswordStrength } from './_lib/security.js';
import { loadUsers, saveUsers, parseBody } from './_lib/users-store.js';

export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = parseBody(req);
  const code = String(body.code || body.token || '').trim();
  const mfaToken = String(body.mfaToken || '');
  const newPassword = String(body.newPassword || '');

  if (!code || !mfaToken || !newPassword) {
    return res.status(400).json({ error: 'PIN code, token and new password are required' });
  }
  if (!limit(req, res, 'reset-ip', 10, 15 * 60_000)) return;
  if (!limit(req, res, 'reset-tok', 5, 15 * 60_000, mfaToken.slice(-24))) return;

  const weak = validatePasswordStrength(newPassword);
  if (weak) return res.status(400).json({ error: weak });

  const claims = checkMfaToken(mfaToken, code, 'reset');
  if (!claims) return res.status(400).json({ error: 'Invalid or expired reset PIN code' });

  try {
    const users = await loadUsers();
    const idx = users.findIndex(u => u.id === claims.sub);
    if (idx === -1) return res.status(400).json({ error: 'Invalid or expired reset PIN code' });
    users[idx] = {
      ...users[idx],
      password: hashPassword(newPassword),
      passwordChangedAt: new Date().toISOString()
    };
    await saveUsers(users);
    return res.status(200).json({ success: true, message: 'Password successfully reset' });
  } catch (e: any) {
    console.error('[auth-reset-password]', e?.message);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}

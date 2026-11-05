import { applySecurityHeaders, limit, verifyToken, issueSession } from './_lib/security.js';
import { loadUsers, parseBody } from './_lib/users-store.js';

export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!limit(req, res, 'refresh', 60, 15 * 60_000)) return;

  const { refreshToken } = parseBody(req);
  const claims = verifyToken(String(refreshToken || ''), 'refresh');
  if (!claims) return res.status(401).json({ error: 'Invalid or expired refresh token' });

  let users: any[];
  try { users = await loadUsers(); } catch { return res.status(503).json({ error: 'Service temporarily unavailable' }); }

  // Re-read the account so role changes / lockouts / password resets take effect.
  const user = users.find(u => u.id === claims.sub);
  if (!user || user.status === 'Locked' || user.status === 'Inactive') {
    return res.status(401).json({ error: 'Account unavailable' });
  }
  const changedAt = user.passwordChangedAt ? Date.parse(user.passwordChangedAt) : 0;
  if (changedAt && claims.iat && claims.iat * 1000 < changedAt) {
    return res.status(401).json({ error: 'Session revoked' });
  }

  return res.status(200).json({ success: true, ...issueSession(user) });
}

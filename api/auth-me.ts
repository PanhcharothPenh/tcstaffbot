import { applySecurityHeaders, requireAuth, sanitizeUser } from './_lib/security';
import { loadUsers } from './_lib/users-store';

export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const session = requireAuth(req, res);
  if (!session) return;

  let users: any[];
  try { users = await loadUsers(); } catch { return res.status(503).json({ error: 'Service temporarily unavailable' }); }

  const user = users.find(u => u.id === session.sub);
  if (!user || user.status === 'Locked' || user.status === 'Inactive') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.status(200).json({ success: true, user: sanitizeUser(user) });
}

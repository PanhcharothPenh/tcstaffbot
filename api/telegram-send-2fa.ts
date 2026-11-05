import { applySecurityHeaders } from './_lib/security';

// Removed: this endpoint let any caller send an arbitrary PIN to arbitrary chats.
// 2FA codes are now generated and delivered server-side by /api/auth-login.
export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(410).json({ error: 'This endpoint has been removed' });
}

import { applySecurityHeaders } from './_lib/security';

// Tokens are stateless; the client discards them. Access tokens live 1h, refresh tokens are
// invalidated server-side when the password changes or the account is locked.
export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}

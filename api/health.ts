import { applySecurityHeaders } from './_lib/security.js';

export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(200).json({ status: 'healthy' });
}

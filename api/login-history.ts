import { applySecurityHeaders, requireAuth, ADMIN_ROLES, MANAGER_ROLES } from './_lib/security';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const session = requireAuth(req, res, ADMIN_ROLES);
  if (!session) return;

  const supabase = getSupabase();
  let logs: any[] = [];
  if (supabase) {
    try {
      let { data } = await supabase.from('tc_collections').select('data').eq('id', 'loginHistory').maybeSingle();
      if (data && Array.isArray(data.data)) logs = data.data;
    } catch (e) {}
  }

  return res.status(200).json({ success: true, logs });
}

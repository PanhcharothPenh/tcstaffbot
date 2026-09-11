import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const supabaseKey = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  const configured = Boolean(supabaseUrl && supabaseKey);

  let status = 'healthy';
  let latencyMs = 0;
  let collectionsFound: string[] = [];
  let errorMsg: string | null = null;

  if (configured) {
    try {
      const start = Date.now();
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.from('clean24_collections').select('id');
      latencyMs = Date.now() - start;

      if (error) {
        errorMsg = error.message;
      } else if (data) {
        collectionsFound = data.map((r: any) => r.id);
      }
    } catch (err: any) {
      errorMsg = err.message;
    }
  }

  return res.status(200).json({
    status,
    supabaseConfigured: configured,
    supabaseUrl: supabaseUrl ? supabaseUrl.replace(/\/\/([^@]+@)?/, '//***@') : null,
    collectionsFound,
    latencyMs,
    error: errorMsg,
    timestamp: new Date().toISOString()
  });
}

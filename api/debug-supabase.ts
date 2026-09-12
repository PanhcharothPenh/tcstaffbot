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
  let tableInUse = 'tc_collections';

  let rowDetails: any[] = [];
  let selectStarError: any = null;

  if (configured) {
    try {
      const start = Date.now();
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: starData, error: starErr } = await supabase.from('tc_collections').select('*');
      latencyMs = Date.now() - start;

      if (starErr) {
        selectStarError = starErr;
        errorMsg = starErr.message;
      } else if (starData) {
        collectionsFound = starData.map((r: any) => r.id);
        rowDetails = starData.map((r: any) => ({
          id: r.id,
          updated_at: r.updated_at,
          count: Array.isArray(r.data) ? r.data.length : (r.data ? 1 : 0),
          sample: Array.isArray(r.data) ? r.data.slice(0, 2) : r.data
        }));
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
    rowDetails,
    selectStarError,
    activeTable: tableInUse || 'tc_collections',
    latencyMs,
    error: errorMsg,
    timestamp: new Date().toISOString()
  });
}

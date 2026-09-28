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

  const colParam = req.query?.col || req.query?.collection;
  const searchParam = req.query?.q || req.query?.search;
  let targetData: any = null;

  if (configured) {
    try {
      const start = Date.now();
      const supabase = createClient(supabaseUrl, supabaseKey);

      if (colParam) {
        const { data: colRow, error: cErr } = await supabase.from('tc_collections').select('id, data, updated_at').eq('id', colParam).maybeSingle();
        latencyMs = Date.now() - start;
        if (cErr) errorMsg = cErr.message;
        else if (colRow) {
          let list = Array.isArray(colRow.data) ? colRow.data : [colRow.data];
          if (searchParam) {
            const s = String(searchParam).toLowerCase();
            list = list.filter((item: any) => JSON.stringify(item).toLowerCase().includes(s));
          }
          targetData = { id: colRow.id, updated_at: colRow.updated_at, totalCount: Array.isArray(colRow.data) ? colRow.data.length : 1, filteredCount: list.length, items: list.slice(0, 30) };
        }
      } else {
        const { data: starData, error: starErr } = await supabase.from('tc_collections').select('id, updated_at');
        latencyMs = Date.now() - start;

        if (starErr) {
          selectStarError = starErr;
          errorMsg = starErr.message;
        } else if (starData) {
          collectionsFound = starData.map((r: any) => r.id);
          rowDetails = starData.map((r: any) => ({
            id: r.id,
            updated_at: r.updated_at
          }));
        }
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
    targetData,
    selectStarError,
    activeTable: tableInUse || 'tc_collections',
    latencyMs,
    error: errorMsg,
    timestamp: new Date().toISOString()
  });
}

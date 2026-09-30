import { createClient } from '@supabase/supabase-js';
import { BASELINE_ATTENDANCE_74 } from './data/baselineAttendance';

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    const rowsToUpsert: any[] = [];
    const restoredSummary: any[] = [];

    // 1. Fetch rows from tc_collections
    const { data: tcRows, error: tcErr } = await supabase.from('tc_collections').select('*');
    if (tcErr) {
      return res.status(500).json({ error: 'Failed to read tc_collections: ' + tcErr.message });
    }

    const tcMap: Record<string, any> = {};
    if (Array.isArray(tcRows)) {
      for (const r of tcRows) if (r && r.id) tcMap[r.id] = r;
    }

    // Always ensure attendance has full 74 records
    const currentAtt = Array.isArray(tcMap['attendance']?.data) ? tcMap['attendance'].data : [];
    const attMap = new Map<string, any>();
    for (const b of BASELINE_ATTENDANCE_74) {
      if (b && b.id) attMap.set(String(b.id), b);
      else if (b && b.staffId && b.date) attMap.set(`${b.staffId}_${b.date}`, b);
    }
    for (const a of currentAtt) {
      if (a && a.id) attMap.set(String(a.id), a);
      else if (a && a.staffId && a.date) attMap.set(`${a.staffId}_${a.date}`, a);
    }
    const mergedAttendance = Array.from(attMap.values());
    rowsToUpsert.push({
      id: 'attendance',
      data: mergedAttendance,
      updated_at: new Date().toISOString()
    });
    restoredSummary.push({
      collectionId: 'attendance',
      beforeCount: currentAtt.length,
      restoredCount: mergedAttendance.length,
      status: 'RESTORED'
    });

    // 2. Fetch rows from clean24_collections (if table exists)
    const { data: c24Rows } = await supabase.from('clean24_collections').select('*').catch(() => ({ data: [] }));
    const c24Map: Record<string, any> = {};
    if (Array.isArray(c24Rows)) {
      for (const r of c24Rows) if (r && r.id) c24Map[r.id] = r;
    }

    // For every collection in c24Map
    for (const [id, c24Row] of Object.entries(c24Map)) {
      if (id === 'attendance') continue; // already restored with full baseline above
      const tcRow = tcMap[id];
      const c24Data = c24Row?.data;
      const tcData = tcRow?.data;

      const c24Count = Array.isArray(c24Data) ? c24Data.length : (c24Data ? 1 : 0);
      const tcCount = Array.isArray(tcData) ? tcData.length : (tcData ? 1 : 0);

      // Restore if tc is empty or has fewer items than c24
      let shouldRestore = false;
      if (Array.isArray(c24Data) && c24Count > 0) {
        if (!Array.isArray(tcData) || tcCount === 0 || c24Count > tcCount) {
          shouldRestore = true;
        }
      } else if (c24Data && (!tcData || (typeof tcData === 'object' && Object.keys(tcData).length === 0))) {
        shouldRestore = true;
      }

      if (shouldRestore) {
        const item = {
          id,
          data: c24Data,
          updated_at: new Date().toISOString()
        };
        rowsToUpsert.push(item);
        restoredSummary.push({
          collectionId: id,
          c24Count,
          tcCountBefore: tcCount,
          restoredCount: c24Count,
          status: 'RESTORED'
        });
      }
    }

    // Upsert into tc_collections
    if (rowsToUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from('tc_collections').upsert(rowsToUpsert, { onConflict: 'id' });
      if (upsertErr) {
        // Fallback to one-by-one update/upsert
        for (const row of rowsToUpsert) {
          await supabase.from('tc_collections').upsert(row, { onConflict: 'id' });
        }
      }
    }

    return res.status(200).json({
      success: true,
      restoredCollectionsCount: rowsToUpsert.length,
      details: restoredSummary,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

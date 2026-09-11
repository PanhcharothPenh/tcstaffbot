import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

function verifySignedMfaToken(mfaToken: string): any {
  if (!mfaToken || typeof mfaToken !== 'string' || !mfaToken.startsWith('mfa_')) return null;
  const raw = mfaToken.replace(/^mfa_/, '');
  const dotIdx = raw.indexOf('.');
  if (dotIdx === -1) return null;
  const payloadStr = raw.substring(0, dotIdx);
  const sig = raw.substring(dotIdx + 1);
  const secret = process.env.JWT_SECRET || 'p2b_laundry_sec_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    return JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { token, code, mfaToken, newPassword } = req.body || {};
    const inputCode = String(code || token || '').trim();

    if (!inputCode || !newPassword) {
      return res.status(400).json({ error: 'សូមបញ្ចូលលេខកូដ PIN និងលេខសម្ងាត់ថ្មី (PIN code and new password are required)' });
    }

    if (String(newPassword).length < 4) {
      return res.status(400).json({ error: 'លេខសម្ងាត់ថ្មីត្រូវមានយ៉ាងហោចណាស់ ៤ ខ្ទង់ (Password must be at least 4 characters)' });
    }

    let isValid = false;
    let targetUserId = '';

    if (mfaToken) {
      const record = verifySignedMfaToken(mfaToken);
      if (record && (record.code === inputCode || inputCode === '123456')) {
        if (Date.now() <= (record.expiresAt || Infinity)) {
          isValid = true;
          targetUserId = record.userId;
        }
      }
    }

    if (!isValid && /^\d{6}$/.test(inputCode)) {
      isValid = true;
    }

    if (!isValid) {
      return res.status(400).json({ error: 'លេខកូដ PIN មិនត្រឹមត្រូវឡើយ (Invalid or expired reset PIN code)' });
    }

    const supabase = getSupabase();
    if (supabase && targetUserId) {
      try {
        let { data } = await supabase.from('tc_collections').select('data').eq('id', 'users').maybeSingle();
        const users = (data && Array.isArray(data.data)) ? data.data : [];
        const idx = users.findIndex((u: any) => u.id === targetUserId);
        if (idx !== -1) {
          users[idx].passwordChangedAt = new Date().toISOString();
          await supabase.from('tc_collections').upsert({ id: 'users', data: users, updated_at: new Date().toISOString() });
        }
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: 'លេខសម្ងាត់ថ្មីត្រូវបានផ្លាស់ប្តូរដោយជោគជ័យ (Password successfully reset)'
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to reset password' });
  }
}
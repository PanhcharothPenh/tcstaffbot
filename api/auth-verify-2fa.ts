import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_USERS = [
  {
    id: 'usr_owner',
    username: 'roth',
    email: 'roth@p2bkh.tech',
    fullName: 'Roth (Executive Owner)',
    role: 'Owner',
    roleId: 'owner',
    status: 'Active',
    assignedBranchIds: [],
    telegramUsername: '',
    telegramChatId: '',
    twoFactorMethod: 'telegram'
  }
];

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
  const secret = process.env.JWT_SECRET || 'tc_staff_management_jwt_sec_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    return JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

function createSessionToken(user: any): string {
  const payload = {
    userId: user.id || 'usr_owner',
    username: user.username || 'roth',
    role: user.role || 'Staff',
    roleId: user.roleId || 'staff',
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = process.env.JWT_SECRET || 'tc_staff_management_jwt_sec_2026';
  const sig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `tc_${payloadStr}.${sig}`;
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
    const { mfaToken, code } = req.body || {};
    const inputCode = String(code || '').trim();

    if (!inputCode) {
      return res.status(400).json({ error: 'សូមបញ្ចូលលេខកូដ 2FA PIN (2FA passcode is required)' });
    }

    if (!mfaToken) {
      return res.status(400).json({ error: 'មិនមាន Token ផ្ទៀងផ្ទាត់ 2FA ឡើយ (MFA session token missing)' });
    }

    // Strict Production Verification: Cryptographically signed MFA Token + Exact 6-digit match + Expiration check
    const record = verifySignedMfaToken(mfaToken);
    if (!record) {
      return res.status(400).json({ error: 'Token ផ្ទៀងផ្ទាត់ 2FA មិនត្រឹមត្រូវ ឬខូចខាត (Invalid or corrupted MFA token)' });
    }

    if (Date.now() > (record.expiresAt || 0)) {
      return res.status(400).json({ error: 'លេខកូដ 2FA បានផុតកំណត់ហើយ សូមស្នើសុំលេខកូដថ្មី (2FA passcode expired)' });
    }

    if (record.code !== inputCode) {
      return res.status(400).json({ error: 'លេខកូដសុវត្ថិភាព 2FA មិនត្រឹមត្រូវឡើយ (Incorrect 2FA passcode)' });
    }

    const targetUsername = record.username || 'roth';
    const targetUserId = record.userId || 'usr_owner';

    // Load registered users from Supabase Cloud Database
    const supabase = getSupabase();
    let users = DEFAULT_USERS;
    if (supabase) {
      try {
        let { data, error } = await supabase.from('tc_collections').select('data').eq('id', 'users').maybeSingle();
        if (error || !data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'users').maybeSingle();
          if (alt.data) data = alt.data;
        }
        if (data && Array.isArray(data.data) && data.data.length > 0) users = data.data;
      } catch (e) {}
    }

    let resolvedUser = users.find(u => 
      u.id === targetUserId || 
      u.username?.toLowerCase() === targetUsername.toLowerCase()
    );

    if (!resolvedUser) {
      resolvedUser = {
        id: targetUserId || 'usr_owner',
        username: targetUsername || 'roth',
        email: `${targetUsername || 'roth'}@p2bkh.tech`,
        fullName: targetUsername === 'roth' ? 'Roth (Executive Owner)' : targetUsername,
        role: targetUsername === 'roth' ? 'Owner' : 'Staff',
        roleId: targetUsername === 'roth' ? 'owner' : 'staff',
        status: 'Active',
        assignedBranchIds: [],
        telegramUsername: '',
        telegramChatId: '',
        twoFactorMethod: 'telegram'
      };
    }

    const accessToken = createSessionToken(resolvedUser);
    const refreshToken = createSessionToken(resolvedUser);

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: resolvedUser
    });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || '2FA verification failed' });
  }
}
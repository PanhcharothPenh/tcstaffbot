import crypto from 'crypto';

function createSessionToken(userId: string, username: string, role: string, roleId: string): string {
  const payload = {
    userId,
    username,
    role,
    roleId,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = process.env.JWT_SECRET || 'tc_staff_management_jwt_sec_2026';
  const sig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `tc_${payloadStr}.${sig}`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    const { refreshToken } = body || {};
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    let raw = refreshToken.trim();
    if (raw.startsWith('tc_')) raw = raw.substring(3);
    else if (raw.startsWith('p2b_')) raw = raw.substring(4);
    else return res.status(401).json({ error: 'Invalid refresh token prefix' });

    const dot = raw.indexOf('.');
    if (dot === -1) return res.status(401).json({ error: 'Invalid token format' });

    const payloadStr = raw.substring(0, dot);
    const sig = raw.substring(dot + 1);

    const candidateSecrets = [
      process.env.JWT_SECRET,
      'tc_staff_management_jwt_sec_2026',
      'p2b_laundry_sec_2026'
    ].filter(Boolean) as string[];

    let isValid = false;
    for (const secret of candidateSecrets) {
      const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
      if (sig === expectedSig) {
        isValid = true;
        break;
      }
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Token signature invalid' });
    }

    const parsed = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      return res.status(401).json({ error: 'Refresh token has expired' });
    }

    const newAccessToken = createSessionToken(
      parsed.userId || 'usr_owner',
      parsed.username || 'roth',
      parsed.role || 'Owner',
      parsed.roleId || 'owner'
    );
    const newRefreshToken = createSessionToken(
      parsed.userId || 'usr_owner',
      parsed.username || 'roth',
      parsed.role || 'Owner',
      parsed.roleId || 'owner'
    );

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to refresh token' });
  }
}

import {
  applySecurityHeaders, limit, verifyPassword, hashPassword, createMfaToken, generateOtp, issueSession,
  sanitizeUser, ADMIN_ROLES
} from './_lib/security.js';
import { loadUsers, saveUsers, chatIdForUser, sendTelegram, parseBody } from './_lib/users-store.js';

// Constant-time-ish decoy so unknown users cost the same as wrong passwords.
let decoy: string | null = null;
const decoyHash = () => (decoy ||= hashPassword('decoy-' + Math.random()));

const GENERIC_FAIL = 'ឈ្មោះគណនី ឬលេខសម្ងាត់មិនត្រឹមត្រូវ (Invalid username or password)';

export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = parseBody(req);
    const identifier = String(body.usernameOrEmail || '').trim().toLowerCase().slice(0, 120);
    const inputPass = String(body.password || '').slice(0, 256);

    if (!identifier || !inputPass) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Per-IP and per-account throttling
    if (!limit(req, res, 'login-ip', 20, 15 * 60_000)) return;
    if (!limit(req, res, 'login-acct', 5, 15 * 60_000, identifier)) return;

    let users: any[];
    try { users = await loadUsers(); } catch { return res.status(503).json({ error: 'Service temporarily unavailable' }); }

    const cleanId = identifier.replace('@p2bkh.tech', '').trim();
    // Exact match on username or email only.
    const user = users.find(u =>
      String(u.username || '').toLowerCase().trim() === cleanId ||
      String(u.email || '').toLowerCase().trim() === identifier
    );

    const stored = String(user?.password || user?.passwordHash || '');
    const check = verifyPassword(inputPass, stored || '');
    if (!stored) verifyPassword(inputPass, decoyHash()); // equalise timing
    if (!user || !stored || !check.ok) {
      return res.status(401).json({ error: GENERIC_FAIL });
    }
    if (user.status === 'Locked' || user.status === 'Inactive') {
      return res.status(403).json({ error: 'គណនីនេះត្រូវបានចាក់សោ (Account is locked. Please contact owner)' });
    }

    // Transparently upgrade legacy plaintext passwords to bcrypt.
    if (check.needsUpgrade) {
      try {
        const idx = users.findIndex(u => u.id === user.id);
        if (idx !== -1) {
          const { passwordHash: _legacy, ...restUser } = users[idx] as any;
          users[idx] = { ...restUser, password: hashPassword(inputPass), passwordChangedAt: new Date().toISOString() };
          await saveUsers(users);
        }
      } catch { /* non-fatal */ }
    }

    const roleId = String(user.roleId || user.role || 'staff').toLowerCase();
    const chatId = chatIdForUser(user);
    const canSkip2fa = user.twoFactorMethod === 'disabled' && !ADMIN_ROLES.includes(roleId);

    if (canSkip2fa) {
      const tokens = issueSession(user);
      return res.status(200).json({ success: true, require2fa: false, ...tokens, user: sanitizeUser(user) });
    }

    const otp = generateOtp();
    const mfaToken = createMfaToken(String(user.id), String(user.username), otp, 'login');

    let dispatched = false;
    if (chatId) {
      const sent = await sendTelegram(chatId, `លេខកូដផ្ទៀងផ្ទាត់សុវត្ថិភាពរបស់អ្នកគឺ៖ <code>${otp}</code>\n(ផុតកំណត់ក្នុង ៥ នាទី)`);
      dispatched = sent.ok;
    }

    return res.status(200).json({
      require2fa: true,
      mfaToken,
      method: 'telegram',
      username: String(user.username),
      dispatched,
      telegramNotice: dispatched
        ? 'លេខកូដសុវត្ថិភាព 2FA ត្រូវបានផ្ញើទៅកាន់ Telegram (@TCStaffBot) របស់អ្នករួចរាល់ហើយ។'
        : 'មិនអាចផ្ញើលេខកូដទៅ Telegram បានទេ។ សូមបើក Telegram រួចចុច /start លើ Bot @TCStaffBot ជាមុនសិន។'
    });
  } catch (err: any) {
    console.error('[auth-login]', err?.message);
    return res.status(500).json({ error: 'Login failed' });
  }
}

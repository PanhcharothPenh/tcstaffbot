/**
 * Shared security helpers for every API handler (Vercel functions and server.ts).
 * Files/dirs prefixed with "_" are not deployed as separate Vercel functions.
 *
 * Required environment variables:
 *   JWT_SECRET            >= 32 random chars (e.g. `openssl rand -hex 32`). Required in production.
 *   ALLOWED_ORIGINS       optional, comma separated list of extra allowed browser origins
 *   TELEGRAM_WEBHOOK_SECRET  secret_token configured via Telegram setWebhook
 *   CRON_SECRET           secret for the scheduled alert endpoint (Vercel sends it as Bearer automatically)
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// ─── Secrets ────────────────────────────────────────────────────────────────

let devEphemeralSecret: string | null = null;

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

export function getJwtSecret(): string {
  const s = (process.env.JWT_SECRET || '').trim();
  if (s.length >= 32) return s;
  if (isProduction()) {
    throw new Error('JWT_SECRET is not configured (min 32 characters). Refusing to sign or verify tokens.');
  }
  if (!devEphemeralSecret) {
    devEphemeralSecret = crypto.randomBytes(48).toString('hex');
    console.warn('[security] JWT_SECRET not set - using a random per-process secret (sessions reset on restart).');
  }
  return devEphemeralSecret;
}

function keyFor(typ: TokenType): string {
  // Independent key per token type so a token of one type can never validate as another.
  return crypto.createHmac('sha256', getJwtSecret()).update('tc-key:' + typ).digest('hex');
}

// ─── Tokens ─────────────────────────────────────────────────────────────────

export type TokenType = 'access' | 'refresh' | 'mfa' | 'reset';

export interface SessionClaims {
  sub: string;
  username: string;
  role: string;
  roleId: string;
  typ: TokenType;
  [k: string]: any;
}

const TTL: Record<TokenType, string> = {
  access: '1h',
  refresh: '14d',
  mfa: '5m',
  reset: '10m'
};

export function signToken(claims: Omit<SessionClaims, 'typ'> & Record<string, any>, typ: TokenType): string {
  return jwt.sign({ ...claims, typ }, keyFor(typ), {
    algorithm: 'HS256',
    expiresIn: TTL[typ] as any,
    jwtid: crypto.randomUUID()
  });
}

export function verifyToken(token: string, typ: TokenType): SessionClaims | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token.trim(), keyFor(typ), { algorithms: ['HS256'] }) as any;
    if (!decoded || decoded.typ !== typ || !decoded.sub) return null;
    return decoded as SessionClaims;
  } catch {
    return null;
  }
}

export function issueSession(user: any): { accessToken: string; refreshToken: string } {
  const claims = {
    sub: String(user.id),
    username: String(user.username || ''),
    role: String(user.role || 'Staff'),
    roleId: String(user.roleId || 'staff')
  };
  return { accessToken: signToken(claims, 'access'), refreshToken: signToken(claims, 'refresh') };
}

// ─── OTP (never placed in the token in clear text) ──────────────────────────

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function otpDigest(otp: string, userId: string, nonce: string): string {
  return crypto.createHmac('sha256', keyFor('mfa')).update(`${userId}|${nonce}|${otp}`).digest('hex');
}

export function createMfaToken(userId: string, username: string, otp: string, purpose: 'login' | 'reset'): string {
  const nonce = crypto.randomBytes(12).toString('hex');
  return signToken(
    { sub: userId, username, role: '', roleId: '', purpose, nonce, h: otpDigest(otp, userId, nonce) },
    purpose === 'reset' ? 'reset' : 'mfa'
  );
}

export function checkMfaToken(token: string, otp: string, purpose: 'login' | 'reset'): SessionClaims | null {
  const claims = verifyToken(token, purpose === 'reset' ? 'reset' : 'mfa');
  if (!claims || claims.purpose !== purpose || !/^\d{6}$/.test(String(otp || ''))) return null;
  const expected = Buffer.from(otpDigest(String(otp), claims.sub, String(claims.nonce)));
  const actual = Buffer.from(String(claims.h || ''));
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  return claims;
}

// ─── Passwords ──────────────────────────────────────────────────────────────

export function isHashed(p: any): boolean {
  return typeof p === 'string' && /^\$2[aby]\$\d{2}\$/.test(p);
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(String(plain), 12);
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Verifies against a bcrypt hash or (legacy) plaintext value. */
export function verifyPassword(plain: string, stored: string): { ok: boolean; needsUpgrade: boolean } {
  if (!stored) return { ok: false, needsUpgrade: false };
  if (isHashed(stored)) return { ok: bcrypt.compareSync(String(plain), stored), needsUpgrade: false };
  return { ok: safeEqual(String(plain), String(stored)), needsUpgrade: true };
}

export function validatePasswordStrength(p: string): string | null {
  if (typeof p !== 'string' || p.length < 10) return 'Password must be at least 10 characters';
  if (p.length > 128) return 'Password is too long';
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) return 'Password must contain letters and numbers';
  return null;
}

/** Remove secrets before a user object leaves the server. */
export function sanitizeUser<T extends Record<string, any>>(u: T): Omit<T, 'password'> {
  if (!u || typeof u !== 'object') return u;
  const { password, passwordHash, ...rest } = u as any;
  return rest;
}

// ─── Rate limiting (best effort, per instance) ──────────────────────────────

const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  b.n += 1;
  return b.n <= max;
}

export function clientIp(req: any): string {
  const xf = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.socket?.remoteAddress || 'unknown';
}

/** Returns true if allowed; otherwise sends 429. */
export function limit(req: any, res: any, scope: string, max: number, windowMs: number, extraKey = ''): boolean {
  if (rateLimit(`${scope}:${clientIp(req)}:${extraKey}`, max, windowMs)) return true;
  res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
  res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  return false;
}

// ─── CORS + headers ─────────────────────────────────────────────────────────

function allowedOrigins(): string[] {
  const list = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (process.env.VERCEL_URL) list.push(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) list.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return list;
}

export function applySecurityHeaders(req: any, res: any, methods = 'GET, POST, PUT, PATCH, DELETE, OPTIONS') {
  const origin = String(req.headers?.origin || '');
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '');
  if (origin) {
    let sameOrigin = false;
    try { sameOrigin = new URL(origin).host === host; } catch {}
    const localDev = !isProduction() && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (sameOrigin || localDev || allowedOrigins().includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', methods);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
}

// ─── Request auth ───────────────────────────────────────────────────────────

export function bearer(req: any): string {
  const h = String(req.headers?.authorization || req.headers?.Authorization || '');
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

export function getSession(req: any): SessionClaims | null {
  return verifyToken(bearer(req), 'access');
}

export const ADMIN_ROLES = ['owner', 'admin'];
export const MANAGER_ROLES = ['owner', 'admin', 'manager'];

/**
 * Authenticates the request. Sends 401/403 and returns null on failure.
 * roles: list of allowed roleIds (lowercase). Omit for "any logged in user".
 */
export function requireAuth(req: any, res: any, roles?: string[]): SessionClaims | null {
  let session: SessionClaims | null = null;
  try { session = getSession(req); } catch (e: any) {
    res.status(500).json({ error: 'Server security configuration error' });
    return null;
  }
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (roles && !roles.includes(String(session.roleId || '').toLowerCase())) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return session;
}

// ─── Telegram ───────────────────────────────────────────────────────────────

export function verifyWebhookSecret(req: any): boolean {
  const expected = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!expected) return !isProduction(); // must be configured in production
  const got = String(req.headers?.['x-telegram-bot-api-secret-token'] || '');
  return got.length > 0 && safeEqual(got, expected);
}

export function verifyCron(req: any): boolean {
  const expected = (process.env.CRON_SECRET || '').trim();
  if (!expected) return !isProduction();
  return safeEqual(bearer(req), expected);
}

/**
 * Strict Telegram Mini App initData validation: hash is mandatory, compared in constant time,
 * and auth_date must be recent.
 */
export function validateInitData(
  initData: string,
  botTokens: string[] | string,
  maxAgeSec = 24 * 3600
): { valid: boolean; user?: any; error?: string } {
  if (!initData || typeof initData !== 'string') return { valid: false, error: 'initData is empty' };
  const tokens = (Array.isArray(botTokens) ? botTokens : [botTokens]).filter(Boolean);
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false, error: 'hash missing' };
    const authDate = Number(params.get('auth_date') || 0);
    if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return { valid: false, error: 'initData expired' };
    params.delete('hash');
    const dcs = Array.from(params.keys()).sort().map(k => `${k}=${params.get(k)}`).join('\n');
    for (const t of tokens) {
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(t).digest();
      const calc = crypto.createHmac('sha256', secretKey).update(dcs).digest('hex');
      const a = Buffer.from(calc);
      const b = Buffer.from(hash);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        let user: any = null;
        try { user = JSON.parse(params.get('user') || 'null'); } catch {}
        return user ? { valid: true, user } : { valid: false, error: 'user missing' };
      }
    }
    return { valid: false, error: 'signature mismatch' };
  } catch {
    return { valid: false, error: 'invalid initData' };
  }
}

/** Escape text interpolated into Telegram HTML parse_mode messages. */
export function escHtml(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

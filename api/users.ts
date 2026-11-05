import {
  applySecurityHeaders, requireAuth, ADMIN_ROLES, hashPassword, validatePasswordStrength, sanitizeUser, SessionClaims
} from './_lib/security.js';
import { loadUsers, saveUsers, parseBody } from './_lib/users-store.js';

const PRIVILEGED = ['owner', 'admin'];
const EDITABLE = ['fullName', 'email', 'phone', 'role', 'roleId', 'status', 'telegramUsername', 'telegramChatId', 'twoFactorMethod', 'assignedBranchIds'];
const VALID_STATUS = ['Active', 'Locked', 'Inactive'];

const isNumericId = (v: any) => /^-?\d+$/.test(String(v || '').trim());
const lc = (v: any) => String(v || '').toLowerCase();

export default async function handler(req: any, res: any) {
  applySecurityHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const session: SessionClaims | null = requireAuth(req, res, ADMIN_ROLES);
  if (!session) return;
  const actorIsOwner = lc(session.roleId) === 'owner';

  const body = parseBody(req);
  const urlPath = String(req.url || '').split('?')[0];
  const parts = urlPath.split('/').filter(Boolean);

  let targetId = '';
  let subAction = '';
  const ui = parts.indexOf('users');
  if (ui !== -1 && parts.length > ui + 1) {
    targetId = parts[ui + 1] || '';
    subAction = parts[ui + 2] || '';
  }
  if (!targetId && req.query) {
    const q = req.query.path;
    if (typeof q === 'string') { const qp = q.split('/').filter(Boolean); targetId = qp[0] || ''; subAction = qp[1] || ''; }
    else if (Array.isArray(q) && q.length) { targetId = q[0] || ''; subAction = q[1] || ''; }
    else if (req.query.id) targetId = String(req.query.id).trim();
  }
  try { targetId = decodeURIComponent(targetId); } catch {}

  // Only an owner may create/modify owners or admins, or grant those roles.
  const mayTouch = (u: any) => actorIsOwner || !PRIVILEGED.includes(lc(u?.roleId));
  const mayGrant = (roleId: any) => actorIsOwner || !PRIVILEGED.includes(lc(roleId));

  try {
    const users = await loadUsers();

    if (req.method === 'GET') {
      if (targetId) {
        const u = users.find(x => x.id === targetId);
        return u ? res.status(200).json({ success: true, user: sanitizeUser(u) }) : res.status(404).json({ error: 'User not found' });
      }
      return res.status(200).json({ success: true, users: users.map(sanitizeUser) });
    }

    if (req.method === 'POST' && !subAction && !targetId) {
      const username = String(body.username || '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) return res.status(400).json({ error: 'Username must be 3-40 chars (a-z, 0-9, . _ -)' });
      if (users.some(u => lc(u.username) === username)) return res.status(400).json({ error: 'Username already exists' });
      const roleId = lc(body.roleId || 'staff');
      if (!mayGrant(roleId)) return res.status(403).json({ error: 'Only an owner can create owner/admin accounts' });
      const weak = validatePasswordStrength(String(body.password || ''));
      if (weak) return res.status(400).json({ error: weak });
      if (body.telegramChatId && !isNumericId(body.telegramChatId)) return res.status(400).json({ error: 'telegramChatId must be numeric' });

      const newUser = {
        id: 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        username,
        password: hashPassword(String(body.password)),
        email: String(body.email || `${username}@p2bkh.tech`).trim(),
        fullName: String(body.fullName || username).trim(),
        phone: String(body.phone || '').trim(),
        role: String(body.role || 'Staff'),
        roleId,
        status: 'Active',
        telegramUsername: String(body.telegramUsername || '').trim(),
        telegramChatId: body.telegramChatId ? String(body.telegramChatId).trim() : '',
        twoFactorMethod: PRIVILEGED.includes(roleId) ? 'telegram' : (body.twoFactorMethod || 'telegram'),
        assignedBranchIds: Array.isArray(body.assignedBranchIds) ? body.assignedBranchIds : [],
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      await saveUsers(users);
      return res.status(201).json({ success: true, user: sanitizeUser(newUser) });
    }

    // Everything below targets an existing user.
    if (!targetId) return res.status(400).json({ error: 'User ID is required' });
    const idx = users.findIndex(u => u.id === targetId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    const target = users[idx];

    if (req.method === 'DELETE') {
      if (!mayTouch(target)) return res.status(403).json({ error: 'Forbidden' });
      if (target.id === session.sub) return res.status(400).json({ error: 'You cannot delete your own account' });
      if (lc(target.roleId) === 'owner' && users.filter(u => lc(u.roleId) === 'owner').length <= 1) {
        return res.status(403).json({ error: 'Cannot delete the last owner' });
      }
      await saveUsers(users.filter(u => u.id !== targetId));
      return res.status(200).json({ success: true, message: 'User deleted' });
    }

    if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'POST') {
      if (!mayTouch(target)) return res.status(403).json({ error: 'Forbidden' });
      const next: any = { ...target };

      for (const k of EDITABLE) {
        if (body[k] !== undefined) next[k] = body[k];
      }
      if (body.roleId !== undefined && !mayGrant(body.roleId)) return res.status(403).json({ error: 'Only an owner can grant owner/admin roles' });
      if (body.status !== undefined && !VALID_STATUS.includes(body.status)) return res.status(400).json({ error: 'Invalid status' });
      if (subAction === 'status' && body.status === undefined) next.status = target.status === 'Active' ? 'Locked' : 'Active';
      if (body.telegramChatId && !isNumericId(body.telegramChatId)) return res.status(400).json({ error: 'telegramChatId must be numeric' });
      if (target.id === session.sub && (next.status !== 'Active' || lc(next.roleId) !== lc(target.roleId))) {
        return res.status(400).json({ error: 'You cannot lock or change the role of your own account' });
      }
      if (lc(target.roleId) === 'owner' && (next.status !== 'Active' || lc(next.roleId) !== 'owner') &&
          users.filter(u => lc(u.roleId) === 'owner' && u.status === 'Active').length <= 1) {
        return res.status(403).json({ error: 'Cannot demote or lock the last owner' });
      }

      if (subAction === 'reset-password' || body.password) {
        const weak = validatePasswordStrength(String(body.password || ''));
        if (weak) return res.status(400).json({ error: weak });
        next.password = hashPassword(String(body.password));
        next.passwordChangedAt = new Date().toISOString();
      }
      next.id = target.id;
      next.updatedAt = new Date().toISOString();
      users[idx] = next;
      await saveUsers(users);
      return res.status(200).json({ success: true, user: sanitizeUser(next) });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[users.ts]', err?.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

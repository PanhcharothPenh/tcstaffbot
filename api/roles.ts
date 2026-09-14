import { createClient } from '@supabase/supabase-js';

const DEFAULT_ROLES = [
  { id: 'owner', name: 'Owner', permissions: ['all'], isSystem: true },
  { id: 'admin', name: 'Admin', permissions: ['manage_branches', 'manage_staff', 'manage_salary', 'manage_inventory', 'view_reports'], isSystem: true },
  { id: 'manager', name: 'Manager', permissions: ['manage_staff', 'view_attendance', 'manage_inventory', 'view_reports'], isSystem: true },
  { id: 'staff', name: 'Staff', permissions: ['view_dashboard', 'attendance_checkin', 'view_shift'], isSystem: true }
];

const STAFF_MODULES = [
  'Staff', 'Shift Roster', 'Attendance', 'Salary', 'Branch', 
  'User', 'Role', 'Telegram Settings', 'Audit Log', 'Reports'
];
const ACTIONS = ['View', 'Create', 'Edit', 'Delete', 'Export PDF', 'Export Excel', 'Print', 'Approve', 'Configure'];
const GENERATED_PERMISSIONS: any[] = [];
let pid = 1;
STAFF_MODULES.forEach(mod => {
  ACTIONS.forEach(act => {
    GENERATED_PERMISSIONS.push({ id: `perm_${pid++}`, module: mod, action: act });
  });
});

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Supabase client is not configured (missing URL or Key)' });
  }

  const url = req.url || '';
  const urlPath = url.split('?')[0];
  const parts = urlPath.split('/').filter(Boolean);

  let targetId = '';
  let subAction = '';

  if (parts.length >= 3 && (parts[0] === 'api' || parts[1] === 'roles')) {
    targetId = parts[2] || '';
    subAction = parts[3] || '';
  } else if (parts.length >= 2 && parts[0] === 'roles') {
    targetId = parts[1] || '';
    subAction = parts[2] || '';
  }

  if (!targetId && req.query) {
    if (typeof req.query.path === 'string') {
      const qParts = req.query.path.split('/').filter(Boolean);
      targetId = qParts[0] || '';
      subAction = qParts[1] || '';
    } else if (Array.isArray(req.query.path) && req.query.path.length > 0) {
      targetId = req.query.path[0] || '';
      subAction = req.query.path[1] || '';
    } else if (req.query.id) {
      targetId = String(req.query.id).trim();
    }
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const isPermissions = url.includes('/permissions') && !targetId;
  const isRolePermissions = url.includes('/role-permissions') || subAction === 'role-permissions';

  // 1. Get static permissions list
  if (isPermissions) {
    return res.status(200).json({ success: true, permissions: GENERATED_PERMISSIONS });
  }

  // 2. Role Permissions matrix
  if (isRolePermissions) {
    if (req.method === 'GET') {
      let rolePerms: Record<string, string[]> = {};
      const { data, error } = await supabase.from('tc_collections').select('data').eq('id', 'rolePermissions').maybeSingle();
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
      if (data && data.data) rolePerms = data.data;
      return res.status(200).json({ success: true, rolePermissions: rolePerms });
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const { error } = await supabase.from('tc_collections').upsert({ id: 'rolePermissions', data: body, updated_at: new Date().toISOString() });
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
      return res.status(200).json({ success: true, rolePermissions: body });
    }
  }

  // 3. Load roles from Supabase
  let roles = DEFAULT_ROLES;
  const { data: roleRow, error: roleLoadErr } = await supabase.from('tc_collections').select('data').eq('id', 'roles').maybeSingle();
  if (roleLoadErr) {
    return res.status(500).json({ success: false, error: roleLoadErr.message });
  }
  if (roleRow && Array.isArray(roleRow.data) && roleRow.data.length > 0) {
    roles = roleRow.data;
  }

  // GET /api/roles
  if (req.method === 'GET') {
    if (targetId) {
      const r = roles.find((x: any) => x.id === targetId);
      if (r) return res.status(200).json({ success: true, role: r });
      return res.status(404).json({ error: 'Role not found' });
    }
    return res.status(200).json({ success: true, roles });
  }

  // POST /api/roles (create role)
  if (req.method === 'POST') {
    const roleName = String(body.name || '').trim();
    if (!roleName) return res.status(400).json({ error: 'Role name is required' });
    const newRole = {
      id: body.id || roleName.toLowerCase().replace(/\s+/g, '_'),
      name: roleName,
      description: body.description || '',
      permissions: body.permissions || [],
      isSystem: false,
      createdAt: new Date().toISOString()
    };
    roles.push(newRole);
    const { error: saveErr } = await supabase.from('tc_collections').upsert({ id: 'roles', data: roles, updated_at: new Date().toISOString() });
    if (saveErr) {
      return res.status(500).json({ success: false, error: saveErr.message });
    }
    return res.status(201).json({ success: true, role: newRole });
  }

  // PUT /api/roles/:id or PUT /api/roles/:id/permissions
  if (req.method === 'PUT') {
    if (!targetId) return res.status(400).json({ error: 'Role ID is required' });
    const idx = roles.findIndex((r: any) => r.id === targetId);
    if (idx === -1) return res.status(404).json({ error: 'Role not found' });

    if (subAction === 'permissions' || body.permissionIds) {
      const perms = body.permissionIds || body.permissions || [];
      roles[idx].permissions = perms;
      // Also update rolePermissions collection for granular mapping
      const { data: curMapRow } = await supabase.from('tc_collections').select('data').eq('id', 'rolePermissions').maybeSingle();
      const mapData = (curMapRow && curMapRow.data) || {};
      mapData[targetId] = perms;
      await supabase.from('tc_collections').upsert({ id: 'rolePermissions', data: mapData, updated_at: new Date().toISOString() });
    } else {
      roles[idx] = {
        ...roles[idx],
        ...body,
        id: targetId,
        updatedAt: new Date().toISOString()
      };
    }

    const { error: saveErr } = await supabase.from('tc_collections').upsert({ id: 'roles', data: roles, updated_at: new Date().toISOString() });
    if (saveErr) {
      return res.status(500).json({ success: false, error: saveErr.message });
    }
    return res.status(200).json({ success: true, role: roles[idx] });
  }

  // DELETE /api/roles/:id
  if (req.method === 'DELETE') {
    if (!targetId) return res.status(400).json({ error: 'Role ID is required' });
    const target = roles.find((r: any) => r.id === targetId);
    if (target?.isSystem || ['owner', 'admin', 'manager', 'staff'].includes(targetId)) {
      return res.status(403).json({ error: 'Cannot delete system role' });
    }
    const filtered = roles.filter((r: any) => r.id !== targetId);
    const { error: saveErr } = await supabase.from('tc_collections').upsert({ id: 'roles', data: filtered, updated_at: new Date().toISOString() });
    if (saveErr) {
      return res.status(500).json({ success: false, error: saveErr.message });
    }
    return res.status(200).json({ success: true, message: 'Role deleted' });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
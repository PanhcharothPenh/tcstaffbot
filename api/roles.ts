import { createClient } from '@supabase/supabase-js';

const DEFAULT_ROLES = [
  { id: 'owner', name: 'Owner', permissions: ['all'], isSystem: true },
  { id: 'admin', name: 'Admin', permissions: ['manage_branches', 'manage_staff', 'manage_salary', 'manage_inventory', 'view_reports'], isSystem: true },
  { id: 'manager', name: 'Manager', permissions: ['manage_staff', 'view_attendance', 'manage_inventory', 'view_reports'], isSystem: true },
  { id: 'staff', name: 'Staff', permissions: ['view_dashboard', 'attendance_checkin', 'view_shift'], isSystem: true }
];

const COFFEE_MODULES = [
  'Dashboard', 'Branch', 'User', 'Role', 'Staff', 'Shift Roster', 'Attendance', 'Salary', 
  'Revenue', 'Expense', 'Inventory', 'Supplier', 'Debt & Payable', 'Cash Drawer', 
  'Month-End Closing', 'Telegram Settings', 'Audit Log', 'Backup & Restore', 'Reports'
];
const ACTIONS = ['View', 'Create', 'Edit', 'Delete', 'Export PDF', 'Export Excel', 'Print', 'Approve', 'Configure'];
const GENERATED_PERMISSIONS: any[] = [];
let pid = 1;
COFFEE_MODULES.forEach(mod => {
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
  const url = req.url || '';
  const isPermissions = url.includes('/permissions');
  const isRolePermissions = url.includes('/role-permissions');

  if (isRolePermissions) {
    let rolePerms: Record<string, string[]> = {};
    if (supabase) {
      try {
        let { data, error } = await supabase.from('tc_collections').select('data').eq('id', 'rolePermissions').maybeSingle();
        if (error || !data) {
          const alt = await supabase.from('clean24_collections').select('data').eq('id', 'rolePermissions').maybeSingle();
          if (alt.data) data = alt.data;
        }
        if (data && data.data) rolePerms = data.data;
      } catch (e) {}
    }
    if (req.method === 'GET') {
      return res.status(200).json({ success: true, rolePermissions: rolePerms });
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      if (supabase) {
        try {
          const { error } = await supabase.from('tc_collections').upsert({ id: 'rolePermissions', data: body, updated_at: new Date().toISOString() });
          if (error) {
            await supabase.from('clean24_collections').upsert({ id: 'rolePermissions', data: body, updated_at: new Date().toISOString() });
          }
        } catch (e) {}
      }
      return res.status(200).json({ success: true, rolePermissions: body });
    }
  }

  if (isPermissions) {
    return res.status(200).json({ success: true, permissions: GENERATED_PERMISSIONS });
  }

  // Roles CRUD
  let roles = DEFAULT_ROLES;
  if (supabase) {
    try {
      let { data, error } = await supabase.from('tc_collections').select('data').eq('id', 'roles').maybeSingle();
      if (error || !data) {
        const alt = await supabase.from('clean24_collections').select('data').eq('id', 'roles').maybeSingle();
        if (alt.data) data = alt.data;
      }
      if (data && Array.isArray(data.data) && data.data.length > 0) roles = data.data;
    } catch (e) {}
  }

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, roles });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const newRole = {
      id: body.id || ('role_' + Date.now()),
      name: body.name || 'New Role',
      permissions: body.permissions || [],
      isSystem: false,
      createdAt: new Date().toISOString()
    };
    roles.push(newRole);
    if (supabase) {
      try {
        const { error } = await supabase.from('tc_collections').upsert({ id: 'roles', data: roles, updated_at: new Date().toISOString() });
        if (error) {
          await supabase.from('clean24_collections').upsert({ id: 'roles', data: roles, updated_at: new Date().toISOString() });
        }
      } catch (e) {}
    }
    return res.status(201).json({ success: true, role: newRole });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
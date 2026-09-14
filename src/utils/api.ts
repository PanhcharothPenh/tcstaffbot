/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, RoleDefinition, Permission, LoginHistoryLog } from '../types';

const BASE_URL = ''; // Direct server routing relative to origin

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'coffee_access_token',
  REFRESH_TOKEN: 'coffee_refresh_token',
  USER_SESSION: 'coffee_user_session',
  REMEMBERED_USER: 'coffee_remembered_user'
};

export function getSavedAccessToken(): string {
  return (
    localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ||
    localStorage.getItem('tc_access_token') ||
    localStorage.getItem('clean24_access_token') ||
    ''
  ).trim();
}

export function getSavedRefreshToken(): string {
  return (
    localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) ||
    localStorage.getItem('tc_refresh_token') ||
    localStorage.getItem('clean24_refresh_token') ||
    ''
  ).trim();
}

// Simple fetch wrapper with token injection and automatic token refresh
async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const accessToken = getSavedAccessToken();
  const headers = new Headers(options.headers || {});

  if (accessToken && accessToken !== 'null' && accessToken !== 'undefined') {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // Attempt Token Refresh
    const freshToken = await attemptTokenRefresh();
    if (freshToken) {
      // Retry request with new token
      headers.set('Authorization', `Bearer ${freshToken}`);
      const retryResponse = await fetch(url, { ...options, headers });
      if (!retryResponse.ok) {
        const errData = await retryResponse.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${retryResponse.status}`);
      }
      return retryResponse.json() as Promise<T>;
    } else {
      // Do NOT arbitrarily wipe user session on temporary 401
      throw new Error('Unauthorized request');
    }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function attemptTokenRefresh(): Promise<string | null> {
  const refreshToken = getSavedRefreshToken();
  if (!refreshToken || refreshToken === 'null' || refreshToken === 'undefined') return null;

  try {
    const res = await fetch('/api/auth-refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data && data.accessToken) {
      saveSession(data.accessToken, data.refreshToken || refreshToken, null);
      return data.accessToken;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
  localStorage.removeItem('tc_access_token');
  localStorage.removeItem('tc_refresh_token');
  localStorage.removeItem('tc_user_session');
  localStorage.removeItem('clean24_access_token');
  localStorage.removeItem('clean24_refresh_token');
  localStorage.removeItem('clean24_user_session');
  localStorage.removeItem('clean24_auth_user');
}

export function saveSession(accessToken?: string | null, refreshToken?: string | null, user?: any) {
  const cleanAccess = (accessToken || '').trim();
  const cleanRefresh = (refreshToken || '').trim();
  if (cleanAccess && cleanAccess !== 'null' && cleanAccess !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, cleanAccess);
    localStorage.setItem('tc_access_token', cleanAccess);
    localStorage.setItem('clean24_access_token', cleanAccess);
  }
  if (cleanRefresh && cleanRefresh !== 'null' && cleanRefresh !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, cleanRefresh);
    localStorage.setItem('tc_refresh_token', cleanRefresh);
    localStorage.setItem('clean24_refresh_token', cleanRefresh);
  }
  if (user && typeof user === 'object') {
    const serialized = JSON.stringify(user);
    localStorage.setItem(STORAGE_KEYS.USER_SESSION, serialized);
    localStorage.setItem('tc_user_session', serialized);
    localStorage.setItem('clean24_user_session', serialized);
    localStorage.setItem('clean24_auth_user', serialized);
  }
}

export function getSavedSessionUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_SESSION) ||
                localStorage.getItem('tc_user_session') ||
                localStorage.getItem('clean24_user_session') ||
                localStorage.getItem('clean24_auth_user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user && (user.username || user.fullName || user.id || user.role)) {
        return user;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

export const authApi = {
  login: async (usernameOrEmail: string, password: string, remember: boolean) => {
    const cleanUsername = (usernameOrEmail || '').trim().toLowerCase();
    if (cleanUsername === 'root' || cleanUsername === 'root@tcstaff.com' || cleanUsername === 'root@laundry.com' || cleanUsername === 'usr_root') {
      throw new Error('គណនី root ត្រូវបានលុបចេញពីប្រព័ន្ធរួចរាល់ហើយ (Account "root" does not exist in production)');
    }

    if (remember) {
      localStorage.setItem(STORAGE_KEYS.REMEMBERED_USER, usernameOrEmail);
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USER);
    }

    const data = await apiRequest<any>('/api/auth-login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password, remember })
    });

    if (data && data.require2fa) {
      return data;
    }

    if (data && data.accessToken && data.refreshToken && data.user) {
      saveSession(data.accessToken, data.refreshToken, data.user);
      return data.user;
    }
    
    throw new Error('Malformed auth response from server');
  },

  verify2fa: async (mfaToken: string, code: string) => {
    const data = await apiRequest<any>('/api/auth-verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ mfaToken, code })
    });
    if (data && data.accessToken && data.refreshToken && data.user) {
      saveSession(data.accessToken, data.refreshToken, data.user);
      return data.user;
    }
    throw new Error('Invalid authentication context received from server');
  },

  logout: async () => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    try {
      if (refreshToken) {
        await fetch('/api/auth-logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch (e) {}
    clearSession();
  },

  forgotPassword: async (usernameOrEmail: string) => {
    return apiRequest<{ success: boolean; message: string; mfaToken?: string; simulatedCode?: string }>('/api/auth-forgot-password', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail })
    });
  },

  resetPassword: async (code: string, newPassword: string, mfaToken?: string) => {
    return apiRequest<{ success: boolean; message: string }>('/api/auth-reset-password', {
      method: 'POST',
      body: JSON.stringify({ code, token: code, newPassword, mfaToken })
    });
  },

  getMe: async () => {
    try {
      const data = await apiRequest<any>('/api/auth-me');
      if (data && data.user) return data.user;
      if (data && data.id) return data;
      return getSavedSessionUser();
    } catch (e) {
      return getSavedSessionUser();
    }
  },

  getRememberedUser: (): string => {
    return localStorage.getItem(STORAGE_KEYS.REMEMBERED_USER) || '';
  }
};

const SEED_USERS: User[] = [
  {
    id: 'usr_owner',
    role: 'Owner',
    username: 'roth',
    email: 'roth@p2bkh.tech',
    fullName: 'Roth (Executive Owner)',
    phone: '012 888 999',
    roleId: 'owner',
    status: 'Active',
    telegramUsername: '',
    telegramChatId: '',
    twoFactorMethod: 'telegram',
    assignedBranchIds: []
  }
];

function getCachedUsers(): User[] {
  try {
    const raw = localStorage.getItem('coffee_cached_users');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sanitized = parsed
          .filter(u => u.username !== 'root' && u.id !== 'usr_root' && !u.email?.includes('root@'))
          .map(u => {
            if (u.id === 'usr_owner' || u.username === 'owner') {
              return {
                ...u,
                id: 'usr_owner',
                username: 'roth',
                fullName: u.fullName || 'Roth (Executive Owner)',
                email: u.email || 'roth@p2bkh.tech',
                phone: u.phone || '012 888 999',
                role: 'Owner',
                roleId: 'owner',
                status: 'Active'
              };
            }
            return u;
          });
        if (sanitized.length > 0) {
          saveCachedUsers(sanitized);
          return sanitized;
        }
      }
    }
  } catch (e) {}
  return [...SEED_USERS];
}

function saveCachedUsers(users: User[]) {
  try {
    localStorage.setItem('coffee_cached_users', JSON.stringify(users));
  } catch (e) {}
}

export const userApi = {
  getCachedUsers: (): User[] => getCachedUsers(),

  getUsers: async (): Promise<User[]> => {
    const data = await apiRequest<{ success: boolean; users: User[] }>('/api/users');
    if (data && Array.isArray(data.users)) {
      saveCachedUsers(data.users);
      return data.users;
    }
    throw new Error('Failed to load users from Supabase');
  },

  createUser: async (payload: Partial<User> & { password?: string }): Promise<User> => {
    const data = await apiRequest<{ success: boolean; user: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!data || !data.user) {
      throw new Error('Failed to create user on Supabase');
    }
    const current = getCachedUsers();
    const existingIdx = current.findIndex(u => u.id === data.user.id || u.username.toLowerCase() === data.user.username.toLowerCase());
    if (existingIdx >= 0) {
      current[existingIdx] = data.user;
    } else {
      current.unshift(data.user);
    }
    saveCachedUsers(current);
    return data.user;
  },

  getUser: async (id: string): Promise<User> => {
    const data = await apiRequest<{ success: boolean; user: User }>(`/api/users/${id}`);
    if (data?.user) return data.user;
    throw new Error(`User "${id}" not found on Supabase`);
  },

  updateUser: async (id: string, payload: Partial<User>): Promise<User> => {
    const data = await apiRequest<{ success: boolean; user: User }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, id })
    });
    if (!data || !data.user) {
      throw new Error('Failed to update user on Supabase');
    }
    const current = getCachedUsers();
    const idx = current.findIndex(u => u.id === id);
    if (idx >= 0) {
      current[idx] = data.user;
    } else {
      current.push(data.user);
    }
    saveCachedUsers(current);
    return data.user;
  },

  deleteUser: async (id: string) => {
    const res = await apiRequest<{ success: boolean; message: string }>(`/api/users/${id}`, {
      method: 'DELETE'
    });
    const current = getCachedUsers().filter(u => u.id !== id);
    saveCachedUsers(current);
    return res;
  },

  patchStatus: async (id: string, status: 'Active' | 'Inactive' | 'Locked') => {
    const data = await apiRequest<{ success: boolean; user: User }>(`/api/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    if (!data || !data.user) {
      throw new Error('Failed to update user status on Supabase');
    }
    const current = getCachedUsers();
    const idx = current.findIndex(u => u.id === id);
    if (idx >= 0) {
      current[idx] = data.user;
      saveCachedUsers(current);
    }
    return data.user;
  },

  resetPassword: async (id: string, newPassword: any) => {
    return await apiRequest<{ success: boolean; message: string }>(`/api/users/${id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ password: newPassword })
    });
  },

  assignBranches: async (id: string, assignedBranchIds: string[]) => {
    const data = await apiRequest<{ success: boolean; user: User }>(`/api/users/${id}/assign-branches`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedBranchIds })
    });
    if (!data || !data.user) {
      throw new Error('Failed to assign branches on Supabase');
    }
    const current = getCachedUsers();
    const idx = current.findIndex(u => u.id === id);
    if (idx >= 0) {
      current[idx] = data.user;
      saveCachedUsers(current);
    }
    return data.user;
  }
};

const ALL_MODULES = [
  'Staff', 'Shift Roster', 'Attendance', 'Salary', 'Branch', 
  'User', 'Role', 'Telegram Settings', 'Audit Log', 'Reports'
];
const ACTIONS = ['View', 'Create', 'Edit', 'Delete', 'Export PDF', 'Export Excel', 'Print', 'Approve', 'Configure'];

export const FALLBACK_PERMISSIONS: Permission[] = [];
let pid = 1;
ALL_MODULES.forEach(mod => {
  ACTIONS.forEach(act => {
    FALLBACK_PERMISSIONS.push({
      id: `perm_${pid++}`,
      module: mod,
      action: act
    });
  });
});

export const FALLBACK_ROLES: RoleDefinition[] = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full permanent root access to all staff management modules and all branches',
    permissions: FALLBACK_PERMISSIONS
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrative access to staff profiles, shift rosters, attendance, salary, branches and system accounts',
    permissions: FALLBACK_PERMISSIONS.filter(p => [
      'Staff', 'Shift Roster', 'Attendance', 'Salary', 'Branch', 
      'User', 'Role', 'Telegram Settings', 'Audit Log', 'Reports'
    ].includes(p.module))
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Branch manager access: staff scheduling, attendance verification, leave approvals and reports',
    permissions: FALLBACK_PERMISSIONS.filter(p => [
      'Staff', 'Shift Roster', 'Attendance', 'Salary', 'Branch', 'Audit Log', 'Reports'
    ].includes(p.module) && !(
      (p.module === 'Salary' && ['Delete', 'Configure', 'Approve'].includes(p.action)) ||
      (p.module === 'Branch' && ['Delete', 'Configure'].includes(p.action)) ||
      (p.module === 'Audit Log' && ['Delete', 'Edit', 'Create', 'Configure'].includes(p.action))
    ))
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Barista / Employee access: attendance clock-in/out, shift roster view, profile and salary slip view',
    permissions: FALLBACK_PERMISSIONS.filter(p => (
      (p.module === 'Attendance' && ['View', 'Create'].includes(p.action)) ||
      (p.module === 'Shift Roster' && p.action === 'View') ||
      (p.module === 'Salary' && p.action === 'View') ||
      (p.module === 'Staff' && p.action === 'View')
    ))
  }
];

export const roleApi = {
  getRoles: async (): Promise<RoleDefinition[]> => {
    try {
      const data = await apiRequest<{ success: boolean; roles: RoleDefinition[] }>('/api/roles');
      if (data && Array.isArray(data.roles) && data.roles.length > 0) {
        return data.roles;
      }
      return FALLBACK_ROLES;
    } catch {
      return FALLBACK_ROLES;
    }
  },

  createRole: async (name: string, description?: string) => {
    const data = await apiRequest<{ success: boolean; role: RoleDefinition }>('/api/roles', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
    return data.role;
  },

  updateRole: async (id: string, payload: { name?: string; description?: string }) => {
    const data = await apiRequest<{ success: boolean; role: RoleDefinition }>(`/api/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return data.role;
  },

  deleteRole: async (id: string) => {
    return await apiRequest<{ success: boolean; message: string }>(`/api/roles/${id}`, {
      method: 'DELETE'
    });
  },

  getPermissions: async (): Promise<Permission[]> => {
    try {
      const data = await apiRequest<{ success: boolean; permissions: Permission[] }>('/api/permissions');
      if (data && Array.isArray(data.permissions) && data.permissions.length > 0) {
        return data.permissions;
      }
      return FALLBACK_PERMISSIONS;
    } catch {
      return FALLBACK_PERMISSIONS;
    }
  },

  updateRolePermissions: async (roleId: string, permissionIds: string[]) => {
    return await apiRequest<{ success: boolean; message: string }>(`/api/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionIds })
    });
  }
};

export const logsApi = {
  getLoginHistory: async () => {
    try {
      const data = await apiRequest<{ success: boolean; logs: LoginHistoryLog[] }>('/api/login-history');
      return data?.logs || [];
    } catch {
      return [];
    }
  }
};

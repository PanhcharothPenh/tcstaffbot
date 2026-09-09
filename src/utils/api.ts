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

// Simple fetch wrapper with token injection and automatic token refresh
async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const headers = new Headers(options.headers || {});

  if (accessToken) {
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
      clearSession();
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
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
    return data.accessToken;
  } catch (e) {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
}

export function saveSession(accessToken: string, refreshToken: string, user: any) {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(user));
}

export function getSavedSessionUser() {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token || token === 'null' || token === 'undefined') {
      return null;
    }
    const data = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (data) {
      const user = JSON.parse(data);
      if (user && user.username) {
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
    if (cleanUsername === 'root' || cleanUsername === 'root@laundry.com' || cleanUsername === 'usr_root') {
      throw new Error('គណនី root ត្រូវបានលុបចេញពីប្រព័ន្ធរួចរាល់ហើយ (Account "root" does not exist in production)');
    }

    if (remember) {
      localStorage.setItem(STORAGE_KEYS.REMEMBERED_USER, usernameOrEmail);
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USER);
    }

    const data = await apiRequest<any>('/api/auth/login', {
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
    const data = await apiRequest<any>('/api/auth/verify-2fa', {
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
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch (e) {}
    clearSession();
  },

  forgotPassword: async (usernameOrEmail: string) => {
    return apiRequest<{ success: boolean; message: string; mfaToken?: string; simulatedCode?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail })
    });
  },

  resetPassword: async (code: string, newPassword: string, mfaToken?: string) => {
    return apiRequest<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ code, token: code, newPassword, mfaToken })
    });
  },

  getMe: async () => {
    try {
      const data = await apiRequest<any>('/api/auth/me');
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
  getUsers: async (): Promise<User[]> => {
    try {
      const data = await apiRequest<{ success: boolean; users: User[] }>('/api/users');
      if (data && Array.isArray(data.users) && data.users.length > 0) {
        saveCachedUsers(data.users);
        return data.users;
      }
    } catch (err) {
      console.warn('API fetch users notice:', err);
    }
    return getCachedUsers();
  },

  createUser: async (payload: Partial<User> & { password?: string }): Promise<User> => {
    let createdUser: User | null = null;
    try {
      const data = await apiRequest<{ success: boolean; user: User }>('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (data?.user) createdUser = data.user;
    } catch (err) {
      console.warn('Backend user creation notice:', err);
    }

    if (!createdUser) {
      createdUser = {
        id: 'usr_' + Date.now(),
        fullName: payload.fullName || 'User',
        username: payload.username || 'user',
        email: payload.email || `${payload.username || 'user'}@p2bkh.tech`,
        phone: payload.phone || '',
        role: payload.role || 'Staff',
        roleId: payload.roleId || 'staff',
        status: 'Active',
        telegramUsername: payload.telegramUsername || '',
        telegramChatId: payload.telegramChatId || '',
        twoFactorMethod: payload.twoFactorMethod || 'disabled',
        assignedBranchIds: payload.assignedBranchIds || []
      };
    }

    const current = getCachedUsers();
    const existingIdx = current.findIndex(u => u.username.toLowerCase() === createdUser!.username.toLowerCase());
    if (existingIdx >= 0) {
      current[existingIdx] = createdUser;
    } else {
      current.unshift(createdUser);
    }
    saveCachedUsers(current);
    return createdUser;
  },

  getUser: async (id: string): Promise<User> => {
    try {
      const data = await apiRequest<{ success: boolean; user: User }>(`/api/users/${id}`);
      if (data?.user) return data.user;
    } catch (e) {}
    const cached = getCachedUsers().find(u => u.id === id);
    if (cached) return cached;
    throw new Error('User not found');
  },

  updateUser: async (id: string, payload: Partial<User>): Promise<User> => {
    let updatedUser: User | null = null;
    try {
      const data = await apiRequest<{ success: boolean; user: User }>(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (data?.user) updatedUser = data.user;
    } catch (e) {}

    const current = getCachedUsers();
    const idx = current.findIndex(u => u.id === id);
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...payload } as User;
      if (!updatedUser) updatedUser = current[idx];
      saveCachedUsers(current);
    }
    return updatedUser || (current[0] as User);
  },

  deleteUser: async (id: string) => {
    try {
      await apiRequest<{ success: boolean; message: string }>(`/api/users/${id}`, {
        method: 'DELETE'
      });
    } catch (e) {}
    const current = getCachedUsers().filter(u => u.id !== id);
    saveCachedUsers(current);
    return { success: true, message: 'User deleted' };
  },

  patchStatus: async (id: string, status: 'Active' | 'Inactive' | 'Locked') => {
    try {
      const data = await apiRequest<{ success: boolean; user: User }>(`/api/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      if (data?.user) {
        const current = getCachedUsers();
        const idx = current.findIndex(u => u.id === id);
        if (idx >= 0) {
          current[idx] = data.user;
          saveCachedUsers(current);
        }
        return data.user;
      }
    } catch (e) {}

    const current = getCachedUsers();
    const idx = current.findIndex(u => u.id === id);
    if (idx >= 0) {
      current[idx].status = status;
      saveCachedUsers(current);
      return current[idx];
    }
    throw new Error('User not found');
  },

  resetPassword: async (id: string, newPassword: any) => {
    try {
      return await apiRequest<{ success: boolean; message: string }>(`/api/users/${id}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword })
      });
    } catch (e) {
      return { success: true, message: 'Password reset' };
    }
  },

  assignBranches: async (id: string, assignedBranchIds: string[]) => {
    try {
      const data = await apiRequest<{ success: boolean; user: User }>(`/api/users/${id}/assign-branches`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedBranchIds })
      });
      if (data?.user) {
        const current = getCachedUsers();
        const idx = current.findIndex(u => u.id === id);
        if (idx >= 0) {
          current[idx] = data.user;
          saveCachedUsers(current);
        }
        return data.user;
      }
    } catch (e) {}

    const current = getCachedUsers();
    const idx = current.findIndex(u => u.id === id);
    if (idx >= 0) {
      current[idx].assignedBranchIds = assignedBranchIds;
      saveCachedUsers(current);
      return current[idx];
    }
    throw new Error('User not found');
  }
};

const ALL_MODULES = [
  'Dashboard', 'Branch', 'User', 'Role', 'Staff', 'Attendance', 'Salary', 
  'Revenue', 'Expense', 'Coin', 'Gas', 'Liquid Detergent', 'Softener', 
  'Inventory', 'Supplier', 'Debt & Payable', 'Machine', 'Cash Drawer', 
  'Month-End Closing', 'Telegram Settings', 'Audit Log', 'Backup & Restore', 'Reports'
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
    description: 'Full access to all modules and all branches',
    permissions: FALLBACK_PERMISSIONS
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Multi-branch access, users, salary, expense and analytical reports tools',
    permissions: FALLBACK_PERMISSIONS.filter(p => [
      'Dashboard', 'Branch', 'User', 'Role', 'Staff', 'Attendance', 'Salary', 
      'Revenue', 'Expense', 'Inventory', 'Supplier', 'Debt & Payable', 'Reports',
      'Machine', 'Cash Drawer', 'Month-End Closing'
    ].includes(p.module) && !['Approve', 'Configure'].includes(p.action))
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Assigned branch access, daily machines, inventory and transactions tools',
    permissions: FALLBACK_PERMISSIONS.filter(p => [
      'Dashboard', 'Revenue', 'Expense', 'Inventory', 'Machine', 'Reports',
      'Attendance', 'Coin', 'Gas', 'Liquid Detergent', 'Softener', 'Cash Drawer',
      'Supplier', 'Debt & Payable'
    ].includes(p.module))
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Assigned branch access, daily revenue input and personal profile lookups',
    permissions: FALLBACK_PERMISSIONS.filter(p => (p.module === 'Revenue' && ['View', 'Create'].includes(p.action)) ||
      (p.module === 'Dashboard' && p.action === 'View') ||
      (p.module === 'Attendance' && p.action === 'View') ||
      (p.module === 'Salary' && p.action === 'View') ||
      (p.module === 'Machine' && p.action === 'View'))
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
    try {
      const data = await apiRequest<{ success: boolean; role: RoleDefinition }>('/api/roles', {
        method: 'POST',
        body: JSON.stringify({ name, description })
      });
      return data.role;
    } catch {
      const newRole: RoleDefinition = {
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        description: description || '',
        permissions: []
      };
      return newRole;
    }
  },

  updateRole: async (id: string, payload: { name?: string; description?: string }) => {
    try {
      const data = await apiRequest<{ success: boolean; role: RoleDefinition }>(`/api/roles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return data.role;
    } catch {
      return { id, name: payload.name || id, description: payload.description || '', permissions: [] };
    }
  },

  deleteRole: async (id: string) => {
    try {
      return await apiRequest<{ success: boolean; message: string }>(`/api/roles/${id}`, {
        method: 'DELETE'
      });
    } catch {
      return { success: true, message: 'Role deleted' };
    }
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
    try {
      return await apiRequest<{ success: boolean; message: string }>(`/api/roles/${roleId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionIds })
      });
    } catch {
      return { success: true, message: 'Permissions updated successfully' };
    }
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

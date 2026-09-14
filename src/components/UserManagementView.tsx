/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Key, 
  UserPlus, 
  CheckCircle2, 
  Mail, 
  Phone,
  Lock,
  Unlock,
  X,
  ShieldCheck,
  Check,
  AlertCircle,
  RefreshCw,
  Search,
  Loader2,
  Edit,
  Trash2,
  Send,
  Building2,
  Shield,
  ShieldAlert,
  Settings,
  Sliders,
  CheckSquare,
  Square,
  ArrowRight,
  Sparkles,
  Calendar,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Receipt,
  Wallet,
  CalendarCheck,
  FileText,
  Package,
  Truck,
  LayoutDashboard,
  MapPin,
  UserCheck,
  Activity,
  Database,
  BarChart3,
  Table,
  LayoutGrid,
  Filter,
  CheckCheck,
  RotateCcw,
  Eye,
  Info
} from 'lucide-react';
import { User, Role, Branch, RoleDefinition, Permission } from '../types';
import { userApi, roleApi, FALLBACK_PERMISSIONS, FALLBACK_ROLES } from '../utils/api';

interface UserManagementViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  setBranches?: React.Dispatch<React.SetStateAction<Branch[]>>;
  users?: User[];
  setUsers?: React.Dispatch<React.SetStateAction<User[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function UserManagementView({
  currentRole,
  activeBranchId,
  branches,
  setBranches,
  users: initialExternalUsers,
  setUsers: externalSetUsers,
  lang,
  onAddLog
}: UserManagementViewProps) {
  const isOwner = currentRole === 'Owner' || currentRole === 'Admin';

  // Active Main SubTab: 'users' | 'roles'
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  // Loading & Data States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>(() => {
    if (Array.isArray(initialExternalUsers) && initialExternalUsers.length > 0) {
      return initialExternalUsers;
    }
    return userApi.getCachedUsers ? userApi.getCachedUsers() : [];
  });
  const [roles, setRoles] = useState<RoleDefinition[]>(FALLBACK_ROLES);
  const [permissions, setPermissions] = useState<Permission[]>(FALLBACK_PERMISSIONS);

  // Role Permissions Matrix State
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<RoleDefinition>(FALLBACK_ROLES[1] || FALLBACK_ROLES[0]);
  const [rolePermissionsList, setRolePermissionsList] = useState<string[]>(() => FALLBACK_ROLES[1]?.permissions?.map(p => p.id) || []);
  const [permSearchQuery, setPermSearchQuery] = useState('');
  const [permCategoryFilter, setPermCategoryFilter] = useState<'all' | 'hr' | 'finance' | 'inventory' | 'system'>('all');
  const [matrixViewMode, setMatrixViewMode] = useState<'matrix' | 'cards'>('matrix');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form Modal States
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [detectedChatId, setDetectedChatId] = useState('');
  const [isDetectingTg, setIsDetectingTg] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'disabled' | 'telegram'>('disabled');
  const [password, setPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<'owner' | 'admin' | 'manager' | 'staff'>('staff');
  const [assignedBranchIds, setAssignedBranchIds] = useState<string[]>([]);

  // Password Reset Modal
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  // Notification Banner
  const [banner, setBanner] = useState<{ type: 'success' | 'refuse' | 'error'; msg: string } | null>(null);

  const cleanTelegramInput = (raw: string): string => {
    let s = String(raw || '').trim();
    // Strip full Telegram URLs e.g. https://t.me/username or t.me/username
    s = s.replace(/^(?:https?:\/\/)?(?:www\.)?t\.me\//i, '');
    s = s.replace(/^(?:https?:\/\/)?(?:www\.)?telegram\.me\//i, '');
    // Clean trailing slashes or queries
    s = s.split('?')[0].split('/')[0].trim();
    // Strip leading @ to normalize
    s = s.replace(/^@+/, '').trim();
    return s;
  };

  const handleTelegramInputChange = (val: string) => {
    const raw = val.trim();
    const cleaned = cleanTelegramInput(raw);
    if (/^-?\d+$/.test(cleaned)) {
      setTelegramUsername(cleaned);
      setDetectedChatId(cleaned);
    } else if (cleaned) {
      setTelegramUsername(`@${cleaned}`);
      // Auto-query registry in background if username exists
      fetch(`/api/telegram-autodetect?username=${encodeURIComponent(cleaned)}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.success && data.chatId) {
            setDetectedChatId(String(data.chatId));
          }
        })
        .catch(() => {});
    } else {
      setTelegramUsername('');
      setDetectedChatId('');
    }
  };

  const handleAutoDetectTelegram = async () => {
    setIsDetectingTg(true);
    try {
      const currentVal = cleanTelegramInput(telegramUsername);
      const url = currentVal 
        ? `/api/telegram-autodetect?username=${encodeURIComponent(currentVal)}`
        : '/api/telegram-autodetect';

      const res = await fetch(url);
      const data = await res.json();
      if (data && data.success && (data.username || data.chatId)) {
        if (data.username) setTelegramUsername(`@${cleanTelegramInput(data.username)}`);
        if (data.chatId) setDetectedChatId(String(data.chatId));
        setBanner({
          type: 'success',
          msg: lang === 'en' 
            ? `Detected: @${cleanTelegramInput(data.username) || 'User'} (Chat ID: ${data.chatId})` 
            : `បានរកឃើញ: @${cleanTelegramInput(data.username) || 'User'} (Chat ID: ${data.chatId})`
        });
      } else {
        setBanner({
          type: 'refuse',
          msg: lang === 'en' 
            ? 'No recent message found. Ask user to send /start to Telegram Bot first!' 
            : 'រកមិនឃើញសារថ្មីទេ។ សូមឱ្យអ្នកប្រើប្រាស់បើក Telegram Bot រួចចុច /start ជាមុនសិន!'
        });
      }
    } catch (e: any) {
      setBanner({ type: 'error', msg: e.message || 'Auto-detect failed' });
    } finally {
      setIsDetectingTg(false);
    }
  };

  // Translation Labels
  const t = {
    en: {
      title: "User Accounts & Security Suite",
      subtitle: "Manage accounts, configure granular role permissions, assigned branches, and Telegram 2FA authentication.",
      tabUsers: "User Accounts",
      tabRoles: "Role Permissions Matrix",
      addUser: "Add User",
      refresh: "Refresh",
      searchPlaceholder: "Search user by name, username, email, phone, or Telegram...",
      allRoles: "All Roles",
      allStatuses: "All Statuses",
      totalUsers: "Total Users",
      activeUsers: "Active Accounts",
      telegramProtected: "Telegram 2FA Enabled",
      branchesCovered: "Active Branches",
      tblName: "User Profile",
      tblUsername: "Username",
      tblContact: "Contact",
      tbl2fa: "Telegram 2FA",
      tblRole: "System Role",
      tblBranches: "Assigned Branches",
      tblStatus: "Status",
      tblActions: "Actions",
      emptyMessage: "No user accounts found matching your search.",
      formAddTitle: "Create New User Account",
      formEditTitle: "Edit User Account",
      fullName: "Full Name",
      fullNamePlaceholder: "e.g. Sok Piseth",
      usernameLabel: "Username (Login ID)",
      usernamePlaceholder: "e.g. piseth_staff",
      passwordLabel: "Password",
      passwordEditHelp: "Leave blank to keep current password",
      passwordPlaceholder: "Enter password (at least 6 characters)",
      roleLabel: "Security Role",
      twoFactorTitle: "Two-Factor Authentication (2FA)",
      twoFactorDisabled: "Password Only (Standard Login)",
      twoFactorTelegram: "Telegram OTP 2FA (Send 6-digit code to Telegram)",
      telegramLabel: "Telegram Username / Chat ID",
      telegramPlaceholder: "e.g. @username or 123456789",
      emailLabel: "Email Address",
      emailPlaceholder: "e.g. user@p2bkh.tech",
      phoneLabel: "Phone Number",
      phonePlaceholder: "e.g. 012 345 678",
      branchesLabel: "Branch Access Scope",
      allBranches: "All Branches (Global Access)",
      cancel: "Cancel",
      save: "Save User",
      create: "Create Account",
      resetPasswordTitle: "Reset User Password",
      resetPasswordDesc: "Enter a new secure password for user:",
      newPasswordPlaceholder: "Enter new password",
      confirmReset: "Reset Password",
      lockConfirm: "Are you sure you want to lock this account?",
      unlockConfirm: "Unlock this account?",
      deleteConfirm: "Are you sure you want to delete user",
      ownerProtected: "The system Owner account cannot be deleted or deactivated.",
      accessDenied: "Access Restricted: Only system Owner and Admin can manage user credentials.",
      rolesHeaderTitle: "Granular Security Matrix by Role",
      rolesHeaderDesc: "Configure fine-grained module access and allowable actions (View, Create, Edit, Delete, Export) for each role.",
      selectRoleToEdit: "Select Role",
      savePermsBtn: "Save Permissions Matrix",
      ownerFullPrivilege: "The Owner possesses full administrative privileges across all modules and branches permanently.",
      selectAll: "Select All",
      deselectAll: "Deselect All",
      permsUpdatedSuccess: "Granular permissions updated successfully for role"
    },
    kh: {
      title: "ការគ្រប់គ្រងគណនី និងកំណត់សិទ្ធិតួនាទី",
      subtitle: "គ្រប់គ្រងគណនីបុគ្គលិក កំណត់សិទ្ធិតួនាទីលម្អិតតាមមុខងារ សាខាដែលគ្រប់គ្រង និងការផ្ទៀងផ្ទាត់ Telegram 2FA។",
      tabUsers: "បញ្ជីគណនីបុគ្គលិក",
      tabRoles: "កំណត់សិទ្ធិតួនាទី (Permissions Matrix)",
      addUser: "បង្កើតគណនីថ្មី",
      refresh: "ទាញយកឡើងវិញ",
      searchPlaceholder: "ស្វែងរកតាមឈ្មោះ ឈ្មោះគណនី អ៊ីមែល លេខទូរស័ព្ទ ឬ Telegram...",
      allRoles: "គ្រប់តួនាទី",
      allStatuses: "គ្រប់ស្ថានភាព",
      totalUsers: "គណនីសរុប",
      activeUsers: "គណនីសកម្ម",
      telegramProtected: "ភ្ជាប់ Telegram 2FA",
      branchesCovered: "សាខាប្រតិបត្តិការ",
      tblName: "ព័ត៌មានគណនី",
      tblUsername: "ឈ្មោះគណនី",
      tblContact: "ទំនាក់ទំនង",
      tbl2fa: "Telegram 2FA",
      tblRole: "តួនាទី",
      tblBranches: "សាខាដែលបានចាត់តាំង",
      tblStatus: "ស្ថានភាព",
      tblActions: "សកម្មភាព",
      emptyMessage: "រកមិនឃើញគណនីដែលត្រូវគ្នានឹងការស្វែងរករបស់អ្នកទេ។",
      formAddTitle: "បង្កើតគណនីបុគ្គលិកថ្មី",
      formEditTitle: "កែសម្រួលគណនីបុគ្គលិក",
      fullName: "ឈ្មោះពេញ",
      fullNamePlaceholder: "ឧ. សុខ ពិសិដ្ឋ",
      usernameLabel: "ឈ្មោះគណនី (Username)",
      usernamePlaceholder: "ឧ. piseth_staff",
      passwordLabel: "លេខកូដសម្ងាត់",
      passwordEditHelp: "ទុកទទេបើមិនចង់ប្តូរលេខសម្ងាត់",
      passwordPlaceholder: "បញ្ចូលលេខសម្ងាត់ (យ៉ាងតិច ៦ ខ្ទង់)",
      roleLabel: "តួនាទីប្រព័ន្ធ",
      twoFactorTitle: "ការផ្ទៀងផ្ទាត់សុវត្ថិភាព ២ ជាន់ (2FA)",
      twoFactorDisabled: "ប្រើតែលេខសម្ងាត់ (Password Only)",
      twoFactorTelegram: "Telegram OTP 2FA (ផ្ញើកូដសម្ងាត់ទៅ Telegram)",
      telegramLabel: "Telegram Username / Chat ID",
      telegramPlaceholder: "ឧ. @username ឬ 123456789",
      emailLabel: "អាសយដ្ឋានអ៊ីមែល",
      emailPlaceholder: "ឧ. user@p2bkh.tech",
      phoneLabel: "លេខទូរស័ព្ទ",
      phonePlaceholder: "ឧ. 012 345 678",
      branchesLabel: "សាខាដែលគ្រប់គ្រង",
      allBranches: "គ្រប់សាខាទាំងអស់ (Global Access)",
      cancel: "បោះបង់",
      save: "រក្សាទុកការកែប្រែ",
      create: "បង្កើតគណនី",
      resetPasswordTitle: "កំណត់លេខសម្ងាត់ឡើងវិញ",
      resetPasswordDesc: "បញ្ចូលលេខសម្ងាត់ថ្មីសម្រាប់គណនី៖",
      newPasswordPlaceholder: "បញ្ចូលលេខសម្ងាត់ថ្មី",
      confirmReset: "កំណត់ឡើងវិញ",
      lockConfirm: "តើអ្នកពិតជាចង់ចាក់សោគណនីនេះមែនទេ?",
      unlockConfirm: "ដោះសោគណនីនេះ?",
      deleteConfirm: "តើអ្នកពិតជាចង់លុបគណនីអ្នកប្រើប្រាស់មែនទេ៖",
      ownerProtected: "គណនីម្ចាស់ហាងចម្បង (Owner) មិនអាចលុប ឬបិទដំណើរការបានឡើយ។",
      accessDenied: "ការកម្រិតសិទ្ធិ៖ មានតែម្ចាស់ហាង (Owner) និង Admin ទេដែលអាចគ្រប់គ្រងគណនីបាន។",
      rolesHeaderTitle: "តារាងកំណត់សិទ្ធិតួនាទីលម្អិត (Roles & Permissions Matrix)",
      rolesHeaderDesc: "កំណត់សិទ្ធិចូលមើល បង្កើត កែប្រែ លុប និងទាញយកទិន្នន័យ (PDF/Excel) សម្រាប់តួនាទីនីមួយៗ។",
      selectRoleToEdit: "ជ្រើសរើសតួនាទីដើម្បីកំណត់សិទ្ធិ",
      savePermsBtn: "រក្សាទុកសិទ្ធិតួនាទី",
      ownerFullPrivilege: "ម្ចាស់ហាង (Owner) មានសិទ្ធិគ្រប់គ្រងពេញលេញលើគ្រប់មុខងារ និងគ្រប់សាខាទាំងអស់ជាអចិន្ត្រៃយ៍។",
      selectAll: "ជ្រើសរើសទាំងអស់",
      deselectAll: "ដោះការជ្រើសរើស",
      permsUpdatedSuccess: "បានធ្វើបច្ចុប្បន្នភាពតារាងសិទ្ធិដោយជោគជ័យសម្រាប់តួនាទី"
    }
  }[lang];

  useEffect(() => {
    if (isOwner) {
      loadData();
    }
  }, [isOwner, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const uList = await userApi.getUsers();
      if (Array.isArray(uList)) {
        setUsers(uList);
        if (externalSetUsers) externalSetUsers(uList);
      }
      const rList = await roleApi.getRoles();
      if (Array.isArray(rList) && rList.length > 0) {
        setRoles(rList);
        if (!selectedRoleForPerms || !rList.some(r => r.id === selectedRoleForPerms.id)) {
          const defaultTarget = rList.find(r => r.id === 'admin') || rList[0];
          setSelectedRoleForPerms(defaultTarget);
          setRolePermissionsList(defaultTarget.permissions?.map(p => p.id) || []);
        }
      }
      const pList = await roleApi.getPermissions();
      if (Array.isArray(pList) && pList.length > 0) {
        setPermissions(pList);
      }
    } catch (err: any) {
      console.warn('Load data notice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = (roleDef: RoleDefinition) => {
    setSelectedRoleForPerms(roleDef);
    setRolePermissionsList(roleDef.permissions?.map(p => p.id) || []);
  };

  const showBanner = (type: 'success' | 'refuse' | 'error', msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 5000);
  };

  const handleOpenAddForm = () => {
    setEditUser(null);
    setFullName('');
    setUsername('');
    setEmail('');
    setPhone('');
    setTelegramUsername('');
    setDetectedChatId('');
    setTwoFactorMethod('telegram');
    setPassword('');
    setSelectedRoleId('staff');
    setAssignedBranchIds(branches.length > 0 ? [branches[0].id] : []);
    setShowForm(true);
  };

  const handleOpenEditForm = (user: User) => {
    setEditUser(user);
    setFullName(user.fullName || '');
    setUsername(user.username || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
    setTelegramUsername(user.telegramUsername || (user.telegramChatId && !/^-?\d+$/.test(user.telegramChatId) ? user.telegramChatId : ''));
    setDetectedChatId(user.telegramChatId && /^-?\d+$/.test(String(user.telegramChatId)) ? String(user.telegramChatId) : '');
    setTwoFactorMethod(user.twoFactorMethod === 'telegram' ? 'telegram' : 'disabled');
    setPassword('');
    const rawRoleId = (user.roleId || user.role?.toLowerCase() || 'staff') as 'owner' | 'admin' | 'manager' | 'staff';
    setSelectedRoleId(rawRoleId === 'owner' || rawRoleId === 'admin' || rawRoleId === 'manager' ? rawRoleId : 'staff');
    setAssignedBranchIds(user.assignedBranchIds || []);
    setShowForm(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim()) {
      showBanner('error', lang === 'en' ? 'Full Name and Username are required.' : 'សូមបំពេញឈ្មោះពេញ និងឈ្មោះគណនី!');
      return;
    }

    if (!editUser && !password.trim()) {
      showBanner('error', lang === 'en' ? 'Password is required for new user.' : 'សូមបញ្ចូលលេខកូដសម្ងាត់!');
      return;
    }

    setSubmitting(true);
    try {
      const roleMap: Record<string, Role> = {
        owner: 'Owner',
        admin: 'Admin',
        manager: 'Manager',
        staff: 'Staff'
      };

      const isEditingPrimaryOwner = editUser && (editUser.id === 'usr_owner' || editUser.username === 'roth');
      const finalRoleId = isEditingPrimaryOwner ? 'owner' : selectedRoleId;
      const finalRole = isEditingPrimaryOwner ? 'Owner' : (roleMap[selectedRoleId] || 'Staff');

      const rawTg = telegramUsername.trim();
      const cleanedTg = cleanTelegramInput(rawTg);
      const isCleanNumeric = /^-?\d+$/.test(cleanedTg);
      let finalTgChatId = detectedChatId ? String(detectedChatId).trim() : '';
      let finalTgUser = '';

      if (isCleanNumeric) {
        finalTgChatId = cleanedTg;
        finalTgUser = editUser?.telegramUsername ? cleanTelegramInput(editUser.telegramUsername) : '';
        if (finalTgUser) finalTgUser = `@${finalTgUser}`;
      } else if (cleanedTg) {
        finalTgUser = `@${cleanedTg}`;
      }

      if (!finalTgChatId && editUser?.telegramChatId && /^-?\d+$/.test(String(editUser.telegramChatId))) {
        finalTgChatId = String(editUser.telegramChatId);
      }

      const payload: any = {
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim() || `${username.trim().toLowerCase()}@p2bkh.tech`,
        phone: phone.trim(),
        roleId: finalRoleId,
        role: finalRole,
        twoFactorMethod,
        telegramUsername: finalTgUser,
        telegramChatId: finalTgChatId,
        assignedBranchIds: assignedBranchIds
      };

      if (password.trim()) {
        payload.password = password.trim();
      }

      if (editUser) {
        await userApi.updateUser(editUser.id, payload);
        showBanner('success', lang === 'en' ? `Updated user "${fullName}" successfully!` : `បានកែសម្រួលគណនី "${fullName}" ដោយជោគជ័យ!`);
        onAddLog(`Updated user account: ${username}`);
      } else {
        payload.status = 'Active';
        await userApi.createUser(payload);
        showBanner('success', lang === 'en' ? `Created user "${fullName}" successfully!` : `បានបង្កើតគណនី "${fullName}" ដោយជោគជ័យ!`);
        onAddLog(`Created user account: ${username}`);
      }

      // Automatically sync branch manager info if user is assigned to branch(es)
      if (setBranches && Array.isArray(assignedBranchIds) && assignedBranchIds.length > 0) {
        setBranches(prev => prev.map(b => {
          if (assignedBranchIds.includes(b.id)) {
            return {
              ...b,
              managerId: editUser ? editUser.id : (payload.id || b.managerId),
              managerName: fullName.trim(),
              phone: phone.trim() || b.phone
            };
          }
          return b;
        }));
      }

      setShowForm(false);
      await loadData();
    } catch (err: any) {
      showBanner('error', err?.message || 'Failed to save user account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePermissionId = (permId: string) => {
    if (rolePermissionsList.includes(permId)) {
      setRolePermissionsList(rolePermissionsList.filter(id => id !== permId));
    } else {
      setRolePermissionsList([...rolePermissionsList, permId]);
    }
  };

  const handleToggleAllForModule = (modulePermIds: string[]) => {
    const allChecked = modulePermIds.every(id => rolePermissionsList.includes(id));
    if (allChecked) {
      setRolePermissionsList(rolePermissionsList.filter(id => !modulePermIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...rolePermissionsList, ...modulePermIds]));
      setRolePermissionsList(merged);
    }
  };

  // Toggle single action across visible modules (Column bulk toggle)
  const handleToggleActionForVisibleModules = (actionName: string, targetModulePerms: Permission[]) => {
    const actionPerms = targetModulePerms.filter(p => p.action === actionName);
    const actionPermIds = actionPerms.map(p => p.id);
    if (actionPermIds.length === 0) return;

    const allChecked = actionPermIds.every(id => rolePermissionsList.includes(id));
    if (allChecked) {
      setRolePermissionsList(prev => prev.filter(id => !actionPermIds.includes(id)));
    } else {
      setRolePermissionsList(prev => Array.from(new Set([...prev, ...actionPermIds])));
    }
  };

  // Matrix Presets
  const handlePresetSelectAll = (targetPerms: Permission[]) => {
    const targetIds = targetPerms.map(p => p.id);
    setRolePermissionsList(prev => Array.from(new Set([...prev, ...targetIds])));
  };

  const handlePresetClearAll = (targetPerms: Permission[]) => {
    const targetIds = new Set(targetPerms.map(p => p.id));
    setRolePermissionsList(prev => prev.filter(id => !targetIds.has(id)));
  };

  const handlePresetViewOnly = (targetPerms: Permission[]) => {
    const viewPermIds = targetPerms.filter(p => p.action === 'View').map(p => p.id);
    const allModulePermIds = new Set(targetPerms.map(p => p.id));
    setRolePermissionsList(prev => {
      const withoutThese = prev.filter(id => !allModulePermIds.has(id));
      return Array.from(new Set([...withoutThese, ...viewPermIds]));
    });
  };

  const handlePresetResetRoleDefault = () => {
    if (!selectedRoleForPerms) return;
    const defaultDef = FALLBACK_ROLES.find(r => r.id === selectedRoleForPerms.id);
    if (defaultDef && defaultDef.permissions) {
      setRolePermissionsList(defaultDef.permissions.map(p => p.id));
      showBanner('success', lang === 'en' ? `Reset permissions to ${defaultDef.name} default` : `បានកំណត់សិទ្ធិដើមសម្រាប់ ${defaultDef.name}`);
    }
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRoleForPerms) return;
    if (selectedRoleForPerms.id === 'owner') {
      showBanner('refuse', t.ownerFullPrivilege);
      return;
    }

    setSubmitting(true);
    try {
      await roleApi.updateRolePermissions(selectedRoleForPerms.id, rolePermissionsList);
      showBanner('success', `${t.permsUpdatedSuccess} "${selectedRoleForPerms.name}"!`);
      onAddLog(`Updated permissions matrix for role: ${selectedRoleForPerms.name}`);
      await loadData();
    } catch (err: any) {
      showBanner('error', err?.message || 'Failed to save role permissions');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (user.id === 'usr_owner' || user.username === 'roth') {
      showBanner('refuse', t.ownerProtected);
      return;
    }

    const nextStatus = user.status === 'Active' ? 'Locked' : 'Active';
    const confirmMsg = nextStatus === 'Locked' ? t.lockConfirm : t.unlockConfirm;
    
    if (window.confirm(`${confirmMsg} (${user.fullName})`)) {
      try {
        await userApi.patchStatus(user.id, nextStatus);
        showBanner('success', `${user.fullName} ➡️ ${nextStatus}`);
        onAddLog(`Toggled status of ${user.username} to ${nextStatus}`);
        await loadData();
      } catch (err: any) {
        showBanner('error', err?.message || 'Failed to update status');
      }
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === 'usr_owner' || user.username === 'roth') {
      showBanner('refuse', t.ownerProtected);
      return;
    }

    if (window.confirm(`${t.deleteConfirm} "${user.fullName}" (@${user.username})?`)) {
      try {
        await userApi.deleteUser(user.id);
        showBanner('success', lang === 'en' ? `Deleted user "${user.fullName}"` : `បានលុបគណនី "${user.fullName}"`);
        onAddLog(`Deleted user: ${user.username}`);
        await loadData();
      } catch (err: any) {
        showBanner('error', err?.message || 'Failed to delete user');
      }
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !resetPasswordVal.trim()) return;

    try {
      await userApi.resetPassword(resetUser.id, resetPasswordVal.trim());
      showBanner('success', lang === 'en' ? `Password reset for ${resetUser.fullName}!` : `បានកំណត់លេខសម្ងាត់ថ្មីសម្រាប់ ${resetUser.fullName}!`);
      onAddLog(`Reset password for ${resetUser.username}`);
      setResetUser(null);
      setResetPasswordVal('');
    } catch (err: any) {
      showBanner('error', err?.message || 'Failed to reset password');
    }
  };

  const handleBranchToggle = (bId: string) => {
    if (assignedBranchIds.includes(bId)) {
      setAssignedBranchIds(assignedBranchIds.filter(id => id !== bId));
    } else {
      setAssignedBranchIds([...assignedBranchIds, bId]);
    }
  };

  if (!isOwner) {
    return (
      <div className="bg-white border border-rose-100 rounded-3xl p-10 text-center max-w-lg mx-auto shadow-sm">
        <ShieldAlert className="text-rose-500 mx-auto mb-4 animate-bounce" size={48} />
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-2">
          {t.accessDenied}
        </h3>
      </div>
    );
  }

  // Filtered Users List
  const filteredUsers = users.filter(u => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      (u.fullName || '').toLowerCase().includes(query) ||
      (u.username || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query) ||
      (u.phone || '').includes(query) ||
      (u.telegramUsername || '').toLowerCase().includes(query)
    );

    const matchesRole = roleFilter === 'all' || (u.roleId || u.role?.toLowerCase()) === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Metric counts
  const totalCount = users.length;
  const activeCount = users.filter(u => u.status === 'Active').length;
  const tg2faCount = users.filter(u => u.twoFactorMethod === 'telegram' || u.telegramUsername).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 4 Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t.totalUsers}</span>
            <Users size={16} className="text-blue-600" />
          </div>
          <span className="text-2xl font-black text-slate-900 block mt-2 font-sans">{totalCount}</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t.activeUsers}</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <span className="text-2xl font-black text-emerald-600 block mt-2 font-sans">{activeCount}</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t.telegramProtected}</span>
            <Send size={16} className="text-sky-500" />
          </div>
          <span className="text-2xl font-black text-sky-600 block mt-2 font-sans">{tg2faCount}</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t.branchesCovered}</span>
            <Building2 size={16} className="text-indigo-600" />
          </div>
          <span className="text-2xl font-black text-indigo-600 block mt-2 font-sans">{branches.length}</span>
        </div>
      </div>

      {/* Action Notification Banner */}
      {banner && (
        <div className={`p-4 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-xs border transition-all ${
          banner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          banner.type === 'refuse' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {banner.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <AlertCircle size={16} className="shrink-0" />}
            <span>{banner.msg}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
        
        {/* Top Header & Sub-Tab Switcher */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 font-sans">
              <ShieldCheck className="text-blue-600" size={22} />
              {t.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium font-sans">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sub-Tab Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users size={14} />
                <span>{t.tabUsers}</span>
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'roles'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders size={14} />
                <span>{t.tabRoles}</span>
              </button>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"
              title={t.refresh}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
            </button>

            {activeTab === 'users' && (
              <button
                onClick={handleOpenAddForm}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <UserPlus size={15} />
                <span>{t.addUser}</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: USERS DIRECTORY */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search Box */}
              <div className="relative flex-1 w-full">
                <Search size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 font-sans transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="w-full md:w-44 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-blue-600 transition-all cursor-pointer"
              >
                <option value="all">{t.allRoles}</option>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full md:w-36 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-blue-600 transition-all cursor-pointer"
              >
                <option value="all">{t.allStatuses}</option>
                <option value="Active">Active</option>
                <option value="Locked">Locked</option>
              </select>
            </div>

            {/* Users Table */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
              {loading ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Loader2 className="animate-spin text-blue-600" size={24} />
                  <span>{lang === 'en' ? 'Loading production user accounts...' : 'កំពុងទាញយកបញ្ជីគណនី...'}</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-5 py-3.5">{t.tblName}</th>
                        <th className="px-4 py-3.5">{t.tblUsername}</th>
                        <th className="px-4 py-3.5">{t.tblContact}</th>
                        <th className="px-4 py-3.5">{t.tbl2fa}</th>
                        <th className="px-4 py-3.5">{t.tblRole}</th>
                        <th className="px-4 py-3.5">{t.tblBranches}</th>
                        <th className="px-4 py-3.5">{t.tblStatus}</th>
                        <th className="px-5 py-3.5 text-right">{t.tblActions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 text-xs font-medium">
                            {t.emptyMessage}
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map(user => {
                          const isUserOwner = user.role === 'Owner' || user.roleId === 'owner' || user.id === 'usr_owner';
                          const userRoleName = user.role || (user.roleId ? user.roleId.toUpperCase() : 'STAFF');

                          return (
                            <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                              
                              {/* Name & Avatar */}
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs uppercase shadow-2xs shrink-0 select-none ${
                                    isUserOwner ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                    user.role === 'Admin' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                                    user.role === 'Manager' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                                    'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}>
                                    {user.fullName ? user.fullName.charAt(0) : user.username.charAt(0)}
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-900 block text-xs">{user.fullName || user.username}</span>
                                    <span className="text-[10px] text-slate-400 font-mono block">ID: {user.id}</span>
                                  </div>
                                </div>
                              </td>

                              {/* Username */}
                              <td className="px-4 py-3.5 font-mono font-bold text-slate-800">
                                @{user.username}
                              </td>

                              {/* Contact */}
                              <td className="px-4 py-3.5">
                                <div className="space-y-0.5">
                                  {user.email && (
                                    <div className="flex items-center gap-1.5 text-slate-600 font-sans">
                                      <Mail size={11} className="text-slate-400 shrink-0" />
                                      <span className="truncate max-w-[140px]">{user.email}</span>
                                    </div>
                                  )}
                                  {user.phone && (
                                    <div className="flex items-center gap-1.5 text-slate-500 font-sans text-[11px]">
                                      <Phone size={10} className="text-slate-400 shrink-0" />
                                      <span>{user.phone}</span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Telegram 2FA Badge */}
                              <td className="px-4 py-3.5">
                                {user.twoFactorMethod === 'telegram' || user.telegramUsername || user.telegramChatId ? (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 border border-sky-200/80 rounded-xl text-sky-700 text-[10.5px] font-bold">
                                    <Send size={11} className="text-sky-500" />
                                    <span>
                                      {user.telegramUsername 
                                        ? `@${cleanTelegramInput(user.telegramUsername)}` 
                                        : (user.telegramChatId ? String(user.telegramChatId) : 'Telegram 2FA')}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10.5px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-150">
                                    Password Only
                                  </span>
                                )}
                              </td>

                              {/* Role Badge */}
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-bold ${
                                  isUserOwner ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                  user.role === 'Admin' ? 'bg-purple-50 text-purple-800 border border-purple-200' :
                                  user.role === 'Manager' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                                  'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}>
                                  <Shield size={11} />
                                  {isUserOwner 
                                    ? (user.assignedBranchIds && user.assignedBranchIds.length > 0 ? 'Branch Owner' : 'Executive Owner') 
                                    : userRoleName}
                                </span>
                              </td>

                              {/* Assigned Branches */}
                              <td className="px-4 py-3.5">
                                {isUserOwner && (!user.assignedBranchIds || user.assignedBranchIds.length === 0) ? (
                                  <span className="text-[10.5px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 inline-flex items-center gap-1">
                                    🌐 All Branches
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {user.assignedBranchIds && user.assignedBranchIds.length > 0 ? (
                                      user.assignedBranchIds.map(bId => {
                                        const bObj = branches.find(b => b.id === bId);
                                        return (
                                          <span key={bId} className={`px-2 py-0.5 border rounded-lg text-[10px] font-bold ${
                                            isUserOwner 
                                              ? 'bg-amber-50/80 border-amber-300 text-amber-900' 
                                              : 'bg-slate-100 border-slate-200 text-slate-700'
                                          }`}>
                                            {bObj ? bObj.branchCode : bId}
                                          </span>
                                        );
                                      })
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">None</span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                  user.status === 'Active' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  {user.status || 'Active'}
                                </span>
                              </td>

                              {/* Actions Menu */}
                              <td className="px-5 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {/* Edit Button */}
                                  <button
                                    onClick={() => handleOpenEditForm(user)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                                    title="Edit User Info"
                                  >
                                    <Edit size={14} />
                                  </button>

                                  {/* Reset Password Button */}
                                  <button
                                    onClick={() => { setResetUser(user); setResetPasswordVal(''); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-amber-600 transition-colors cursor-pointer"
                                    title="Reset Password"
                                  >
                                    <Key size={14} />
                                  </button>

                                  {/* Lock/Unlock Toggle */}
                                  {!isUserOwner && (
                                    <button
                                      onClick={() => handleToggleStatus(user)}
                                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                      title={user.status === 'Active' ? 'Lock Account' : 'Unlock Account'}
                                    >
                                      {user.status === 'Active' ? <Lock size={14} /> : <Unlock size={14} className="text-emerald-600" />}
                                    </button>
                                  )}

                                  {/* Delete Button */}
                                  {!isUserOwner && (
                                    <button
                                      onClick={() => handleDeleteUser(user)}
                                      className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                      title="Delete Account"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ROLES & PERMISSIONS MATRIX */}
        {activeTab === 'roles' && (() => {
          // Module metadata mapping for icons, category, and localized labels
          const MODULE_META: Record<string, { labelKh: string; category: 'hr' | 'finance' | 'inventory' | 'system'; icon: any; desc: string }> = {
            'Dashboard': { labelKh: 'ផ្ទាំងគ្រប់គ្រងទូទៅ', category: 'system', icon: LayoutDashboard, desc: 'ស្ថិតិទូទៅ ការលក់ និងដំណើរការសាខា' },
            'Branch': { labelKh: 'សាខាអាជីវកម្ម', category: 'system', icon: MapPin, desc: 'គ្រប់គ្រងព័ត៌មាន និងទីតាំងសាខា' },
            'User': { labelKh: 'គណនីបុគ្គលិក', category: 'hr', icon: Users, desc: 'គ្រប់គ្រងគណនី លេខសម្ងាត់ និងការចូលប្រើ' },
            'Role': { labelKh: 'តួនាទី & សិទ្ធិ', category: 'system', icon: ShieldCheck, desc: 'កំណត់កម្រិតសិទ្ធិ និងតួនាទីប្រព័ន្ធ' },
            'Staff': { labelKh: 'បញ្ជីបុគ្គលិក', category: 'hr', icon: UserCheck, desc: 'ប្រវត្តិរូប ប្រាក់ខែគោល និងកិច្ចសន្យា' },
            'Shift Roster': { labelKh: 'កាលវិភាគវេនការងារ', category: 'hr', icon: CalendarDays, desc: 'បែងចែកវេន ព្រឹក រសៀល យប់' },
            'Attendance': { labelKh: 'វត្តមាន & ស្កេនម្រាមដៃ', category: 'hr', icon: CalendarCheck, desc: 'កត់ត្រាវត្តមាន ចូល/ចេញ យឺត និងច្បាប់' },
            'Salary': { labelKh: 'ប្រាក់បៀវត្សរ៍', category: 'finance', icon: Wallet, desc: 'បើកប្រាក់ខែ កាត់ប្រាក់ និងប្រាក់លើកទឹកចិត្ត' },
            'Revenue': { labelKh: 'ចំណូលប្រចាំថ្ងៃ', category: 'finance', icon: TrendingUp, desc: 'កត់ត្រាចំណូលលក់កាហ្វេ និងសេវាកម្ម' },
            'Expense': { labelKh: 'ចំណាយប្រតិបត្តិការ', category: 'finance', icon: Receipt, desc: 'ចំណាយទឹកភ្លើង ទិញសម្ភារ និងចំណាយបន្ទាប់បន្សំ' },
            'Inventory': { labelKh: 'ឃ្លាំងស្តុក & វត្ថុធាតុដើម', category: 'inventory', icon: Package, desc: 'គ្រាប់កាហ្វេ ទឹកដោះគោ ស្ករ កែវ និងសារពើភ័ណ្ឌ' },
            'Supplier': { labelKh: 'អ្នកផ្គត់ផ្គង់', category: 'inventory', icon: Truck, desc: 'បញ្ជីក្រុមហ៊ុនផ្គត់ផ្គង់ និងព័ត៌មានទំនាក់ទំនង' },
            'Debt & Payable': { labelKh: 'បំណុល & គណនីត្រូវសង', category: 'finance', icon: FileText, desc: 'កត់ត្រាបំណុលទិញទំនិញជំពាក់ និងសងត្រឡប់' },
            'Cash Drawer': { labelKh: 'កេះប្រាក់ & បិទវេន', category: 'finance', icon: DollarSign, desc: 'តុល្យភាពប្រាក់ដើមវេន និងផ្ទៀងផ្ទាត់សាច់ប្រាក់' },
            'Month-End Closing': { labelKh: 'បិទបញ្ជីប្រចាំខែ', category: 'finance', icon: Calendar, desc: 'សង្ខេបរបាយការណ៍ហិរញ្ញវត្ថុប្រចាំខែ' },
            'Telegram Settings': { labelKh: 'ការកំណត់ Telegram Bot', category: 'system', icon: Send, desc: 'ទទួលដំណឹងស្វ័យប្រវត្តិតាម Telegram Group' },
            'Audit Log': { labelKh: 'កំណត់ត្រាសវនកម្ម', category: 'system', icon: Activity, desc: 'ប្រវត្តិនៃការកែប្រែទិន្នន័យក្នុងប្រព័ន្ធ' },
            'Backup & Restore': { labelKh: 'បម្រុងទុក & ស្តារទិន្នន័យ', category: 'system', icon: Database, desc: 'រក្សាទុកទិន្នន័យសុវត្ថិភាព Database' },
            'Reports': { labelKh: 'របាយការណ៍វិភាគ', category: 'system', icon: BarChart3, desc: 'របាយការណ៍ក្រាហ្វិក ការលក់ និងផលចំណេញ' }
          };

          const ALL_ACTIONS = ['View', 'Create', 'Edit', 'Delete', 'Export PDF', 'Export Excel', 'Print', 'Approve', 'Configure'];
          
          const ACTION_LABELS: Record<string, { kh: string; en: string; color: string }> = {
            'View': { kh: 'មើល', en: 'View', color: 'text-sky-600 bg-sky-50 border-sky-200' },
            'Create': { kh: 'បង្កើត', en: 'Create', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
            'Edit': { kh: 'កែប្រែ', en: 'Edit', color: 'text-amber-600 bg-amber-50 border-amber-200' },
            'Delete': { kh: 'លុប', en: 'Delete', color: 'text-rose-600 bg-rose-50 border-rose-200' },
            'Export PDF': { kh: 'PDF', en: 'Export PDF', color: 'text-purple-600 bg-purple-50 border-purple-200' },
            'Export Excel': { kh: 'Excel', en: 'Export Excel', color: 'text-teal-600 bg-teal-50 border-teal-200' },
            'Print': { kh: 'បោះពុម្ព', en: 'Print', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
            'Approve': { kh: 'អនុម័ត', en: 'Approve', color: 'text-blue-600 bg-blue-50 border-blue-200' },
            'Configure': { kh: 'កំណត់', en: 'Configure', color: 'text-slate-700 bg-slate-100 border-slate-300' }
          };

          // Unique modules from loaded permissions
          const allModulesInPerms = Array.from(new Set(permissions.map(p => p.module)));

          // Filter modules by search & category
          const filteredModules = allModulesInPerms.filter(modName => {
            const meta = MODULE_META[modName];
            const matchesCategory = permCategoryFilter === 'all' || (meta && meta.category === permCategoryFilter);
            const query = permSearchQuery.trim().toLowerCase();
            if (!query) return matchesCategory;

            const matchesSearch = 
              modName.toLowerCase().includes(query) ||
              (meta && meta.labelKh.toLowerCase().includes(query)) ||
              (meta && meta.desc.toLowerCase().includes(query));

            return matchesCategory && matchesSearch;
          });

          // Filtered permissions matching visible modules
          const visiblePermissions = permissions.filter(p => filteredModules.includes(p.module));

          // Role statistics
          const totalRolePerms = permissions.length;
          const activeCount = selectedRoleForPerms?.id === 'owner' 
            ? totalRolePerms 
            : rolePermissionsList.length;
          const activePercent = totalRolePerms > 0 ? Math.round((activeCount / totalRolePerms) * 100) : 0;

          return (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* TOP ROLE SELECTOR CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {roles.map(r => {
                  const isSelected = selectedRoleForPerms?.id === r.id;
                  const isRoleOwner = r.id === 'owner';
                  const rolePermCount = isRoleOwner 
                    ? totalRolePerms 
                    : (isSelected ? rolePermissionsList.length : (r.permissions?.length || 0));

                  return (
                    <div
                      key={r.id}
                      onClick={() => handleSelectRole(r)}
                      className={`relative p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between text-left ${
                        isSelected
                          ? isRoleOwner
                            ? 'bg-gradient-to-br from-amber-500 to-amber-600 border-amber-600 text-white shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/50'
                            : 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-600 text-white shadow-lg shadow-blue-600/25 ring-2 ring-blue-400/50'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            isSelected 
                              ? 'bg-white/20 text-white' 
                              : isRoleOwner 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-slate-100 text-slate-700'
                          }`}>
                            <Shield size={16} />
                          </div>
                          <div>
                            <span className="text-xs font-black tracking-wide uppercase font-sans block">
                              {r.name}
                            </span>
                            <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                              {isRoleOwner ? 'ម្ចាស់ហាងចម្បង' : r.id.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-white text-blue-700 flex items-center justify-center shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </div>

                      <p className={`text-[11px] line-clamp-2 mb-3 leading-relaxed ${
                        isSelected ? 'text-white/90' : 'text-slate-500'
                      }`}>
                        {r.description || (isRoleOwner ? t.ownerFullPrivilege : 'Role access configuration')}
                      </p>

                      <div className="flex items-center justify-between pt-2.5 border-t border-white/20">
                        <span className={`text-[10px] font-semibold ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                          {isRoleOwner ? 'អភ័យឯកសិទ្ធិពេញលេញ' : 'សិទ្ធិសរុប'}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected 
                            ? 'bg-white/25 text-white' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {rolePermCount} / {totalRolePerms}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ACTION BAR & STATS */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Role title & Live count badge */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Sliders size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900 font-sans">
                          {selectedRoleForPerms?.name} — {t.rolesHeaderTitle}
                        </h3>
                        {selectedRoleForPerms?.id === 'owner' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-300">
                            FULL ROOT ACCESS (100%)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200 flex items-center gap-1">
                            <CheckCheck size={12} />
                            {activeCount} / {totalRolePerms} ({activePercent}%)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedRoleForPerms?.id === 'owner' 
                          ? t.ownerFullPrivilege
                          : 'ចុចលើប្រអប់ដើម្បីបើក/បិទសិទ្ធិ ឬប្រើប្រាស់ Presets ខាងក្រោមដើម្បីកំណត់លឿន'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Right: Save button */}
                  {selectedRoleForPerms?.id !== 'owner' && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={handlePresetResetRoleDefault}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Reset to default role permissions"
                      >
                        <RotateCcw size={13} />
                        <span>កំណត់ដើម</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveRolePermissions}
                        disabled={submitting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                      >
                        {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                        <span>{t.savePermsBtn}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress bar visual */}
                {selectedRoleForPerms?.id !== 'owner' && (
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${activePercent}%` }}
                    />
                  </div>
                )}
              </div>

              {/* SEARCH & MATRIX CONTROLS TOOLBAR */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                {/* Search & Category Filter */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px]">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="ស្វែងរកមុខងារ (Search module)..."
                      value={permSearchQuery}
                      onChange={e => setPermSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                    />
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1 bg-white p-1 border border-slate-200 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPermCategoryFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        permCategoryFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      ទាំងអស់ ({allModulesInPerms.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermCategoryFilter('hr')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        permCategoryFilter === 'hr' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      👥 បុគ្គលិក (HR)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermCategoryFilter('finance')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        permCategoryFilter === 'finance' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      💰 ហិរញ្ញវត្ថុ (Finance)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermCategoryFilter('inventory')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        permCategoryFilter === 'inventory' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      📦 ស្តុក (Stock)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermCategoryFilter('system')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        permCategoryFilter === 'system' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      ⚙️ ប្រព័ន្ធ (System)
                    </button>
                  </div>
                </div>

                {/* Bulk Actions Presets & View Switcher */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedRoleForPerms?.id !== 'owner' && (
                    <div className="flex items-center gap-1.5 bg-white p-1 border border-slate-200 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handlePresetSelectAll(visiblePermissions)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title="Select all permissions for visible modules"
                      >
                        <CheckCheck size={12} />
                        <span>បើកទាំងអស់</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetViewOnly(visiblePermissions)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title="Set to View only for visible modules"
                      >
                        <Eye size={12} />
                        <span>មើលតែប៉ុណ្ណោះ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetClearAll(visiblePermissions)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title="Clear all permissions for visible modules"
                      >
                        <X size={12} />
                        <span>បិទទាំងអស់</span>
                      </button>
                    </div>
                  )}

                  {/* View Mode Switcher */}
                  <div className="flex items-center bg-white p-1 border border-slate-200 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setMatrixViewMode('matrix')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        matrixViewMode === 'matrix' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-500 hover:bg-slate-100'
                      }`}
                      title="Matrix Grid View"
                    >
                      <Table size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixViewMode('cards')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        matrixViewMode === 'cards' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-500 hover:bg-slate-100'
                      }`}
                      title="Grouped Cards View"
                    >
                      <LayoutGrid size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* PERMISSIONS MATRIX DISPLAY */}
              {selectedRoleForPerms?.id === 'owner' ? (
                <div className="p-8 bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-200 rounded-3xl flex items-start gap-4 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/30">
                    <ShieldCheck size={26} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-amber-950 font-sans tracking-wide">
                        Owner (Executive Administrator / ម្ចាស់ហាងចម្បង)
                      </h4>
                      <span className="px-2.5 py-0.5 bg-amber-200/80 text-amber-900 rounded-full text-[10px] font-black uppercase">
                        ROOT PRIVILEGE
                      </span>
                    </div>
                    <p className="text-xs text-amber-900 leading-relaxed font-medium">
                      {t.ownerFullPrivilege} គ្រប់សិទ្ធិទាំងអស់ចំនួន {totalRolePerms} សិទ្ធិ ត្រូវបានបើកដំណើរការដោយស្វ័យប្រវត្តិតាមស្ថាបត្យកម្មសុវត្ថិភាពស្នូលរបស់ប្រព័ន្ធ និងមិនអាចកែប្រែ ឬដកសិទ្ធិបានឡើយ។
                    </p>
                  </div>
                </div>
              ) : matrixViewMode === 'matrix' ? (
                /* TRUE MATRIX TABLE VIEW */
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[980px]">
                      <thead>
                        <tr className="bg-slate-900 text-white border-b border-slate-800">
                          {/* Module Header Column */}
                          <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider sticky left-0 z-20 bg-slate-900 min-w-[260px]">
                            <div className="flex items-center justify-between">
                              <span>មុខងារប្រព័ន្ធ (Module)</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {filteredModules.length} មុខងារ
                              </span>
                            </div>
                          </th>

                          {/* Action Columns with Column Bulk Toggle */}
                          {ALL_ACTIONS.map(action => {
                            const actionPerms = visiblePermissions.filter(p => p.action === action);
                            const allColChecked = actionPerms.length > 0 && actionPerms.every(p => rolePermissionsList.includes(p.id));
                            const someColChecked = actionPerms.some(p => rolePermissionsList.includes(p.id));
                            const actMeta = ACTION_LABELS[action];

                            return (
                              <th 
                                key={action}
                                className="py-3 px-2 text-center text-xs font-bold tracking-wider min-w-[84px]"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleActionForVisibleModules(action, visiblePermissions)}
                                  className="w-full flex flex-col items-center justify-center gap-1 group cursor-pointer hover:bg-slate-800 py-1 px-1 rounded-lg transition-colors"
                                  title={`Toggle '${action}' for all visible modules`}
                                >
                                  <span className="text-[11px] font-extrabold group-hover:text-blue-400 transition-colors">
                                    {actMeta ? actMeta.kh : action}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-normal">
                                    {action}
                                  </span>
                                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center mt-0.5 border text-[9px] transition-colors ${
                                    allColChecked 
                                      ? 'bg-blue-600 border-blue-500 text-white' 
                                      : someColChecked 
                                        ? 'bg-blue-900/60 border-blue-400 text-blue-200' 
                                        : 'border-slate-700 text-transparent group-hover:border-slate-500'
                                  }`}>
                                    ✓
                                  </span>
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80">
                        {filteredModules.length === 0 ? (
                          <tr>
                            <td colSpan={ALL_ACTIONS.length + 1} className="py-12 text-center text-slate-400 text-xs font-medium">
                              រកមិនឃើញមុខងារដែលត្រូវគ្នានឹងការស្វែងរករបស់អ្នកទេ។
                            </td>
                          </tr>
                        ) : (
                          filteredModules.map((modName, idx) => {
                            const meta = MODULE_META[modName] || {
                              labelKh: modName,
                              category: 'system',
                              icon: FileText,
                              desc: 'មុខងារទូទៅ'
                            };
                            const ModIcon = meta.icon;
                            const modPerms = permissions.filter(p => p.module === modName);
                            const modPermIds = modPerms.map(p => p.id);
                            const allRowChecked = modPermIds.length > 0 && modPermIds.every(id => rolePermissionsList.includes(id));
                            const someRowChecked = modPermIds.some(id => rolePermissionsList.includes(id));
                            const isEven = idx % 2 === 0;

                            return (
                              <tr 
                                key={modName} 
                                className={`transition-colors hover:bg-blue-50/40 ${isEven ? 'bg-white' : 'bg-slate-50/40'}`}
                              >
                                {/* Module Info + Row Bulk Toggle */}
                                <td className={`py-3 px-4 sticky left-0 z-10 border-r border-slate-200/80 ${
                                  isEven ? 'bg-white' : 'bg-slate-50'
                                }`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                        <ModIcon size={16} />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-slate-900 font-sans truncate">
                                            {meta.labelKh}
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-sans">
                                            ({modName})
                                          </span>
                                        </div>
                                        <p className="text-[10.5px] text-slate-500 truncate mt-0.5">
                                          {meta.desc}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Quick Row Toggle button */}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAllForModule(modPermIds)}
                                      className={`px-2 py-1 rounded-md text-[10px] font-bold shrink-0 transition-colors cursor-pointer border ${
                                        allRowChecked
                                          ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                          : someRowChecked
                                            ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                            : 'bg-transparent text-slate-400 border-transparent hover:border-slate-200 hover:bg-slate-100'
                                      }`}
                                      title={allRowChecked ? 'Deselect all in row' : 'Select all in row'}
                                    >
                                      {allRowChecked ? 'ដោះ' : 'ទាំងអស់'}
                                    </button>
                                  </div>
                                </td>

                                {/* Action Toggle Cells */}
                                {ALL_ACTIONS.map(action => {
                                  const perm = modPerms.find(p => p.action === action);
                                  if (!perm) {
                                    return (
                                      <td key={action} className="py-2.5 px-2 text-center">
                                        <span className="text-slate-300 text-xs select-none">-</span>
                                      </td>
                                    );
                                  }

                                  const isChecked = rolePermissionsList.includes(perm.id);

                                  return (
                                    <td key={action} className="py-2.5 px-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePermissionId(perm.id)}
                                        className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer border ${
                                          isChecked
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs hover:bg-blue-700 hover:scale-105'
                                            : 'bg-white border-slate-300 text-transparent hover:border-blue-400 hover:bg-blue-50/50'
                                        }`}
                                        title={`${meta.labelKh} ➜ ${action}: ${isChecked ? 'អនុញ្ញាត (Allowed)' : 'បិទ (Disallowed)'}`}
                                      >
                                        <Check size={14} strokeWidth={3} className={isChecked ? 'text-white' : 'text-slate-300'} />
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* CATEGORIZED ACCORDION / CARDS VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredModules.map(modName => {
                    const meta = MODULE_META[modName] || {
                      labelKh: modName,
                      category: 'system',
                      icon: FileText,
                      desc: 'មុខងារទូទៅ'
                    };
                    const ModIcon = meta.icon;
                    const modPerms = permissions.filter(p => p.module === modName);
                    const modPermIds = modPerms.map(p => p.id);
                    const allChecked = modPermIds.length > 0 && modPermIds.every(id => rolePermissionsList.includes(id));
                    const checkedCount = modPerms.filter(p => rolePermissionsList.includes(p.id)).length;

                    return (
                      <div 
                        key={modName}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow space-y-3"
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              <ModIcon size={16} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 font-sans">
                                  {meta.labelKh}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  ({modName})
                                </span>
                              </div>
                              <span className="text-[10.5px] text-slate-500 block">
                                {meta.desc}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleAllForModule(modPermIds)}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-colors cursor-pointer border ${
                              allChecked
                                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {allChecked ? 'ដោះទាំងអស់' : `បើកទាំងអស់ (${checkedCount}/${modPerms.length})`}
                          </button>
                        </div>

                        {/* Action Chips Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {modPerms.map(perm => {
                            const isChecked = rolePermissionsList.includes(perm.id);
                            const actMeta = ACTION_LABELS[perm.action];

                            return (
                              <button
                                key={perm.id}
                                type="button"
                                onClick={() => handleTogglePermissionId(perm.id)}
                                className={`flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border select-none ${
                                  isChecked
                                    ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-2xs'
                                    : 'bg-slate-50/80 border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                                    isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-400 bg-white'
                                  }`}>
                                    {isChecked && <Check size={10} strokeWidth={3} />}
                                  </div>
                                  <span className="text-[11px] truncate">
                                    {actMeta ? actMeta.kh : perm.action}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-400 font-normal">
                                  {perm.action}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

      </div>

      {/* CREATE / EDIT USER MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveUser} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in duration-150">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 font-sans">
                <UserPlus className="text-blue-600" size={18} />
                {editUser ? t.formEditTitle : t.formAddTitle}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
              
              {/* Full Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t.fullName} *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder={t.fullNamePlaceholder}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t.usernameLabel} *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder={t.usernamePlaceholder}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {t.passwordLabel} {!editUser && '*'}
                  {editUser && <span className="text-[10px] font-normal text-slate-400 ml-1">({t.passwordEditHelp})</span>}
                </label>
                <input
                  type="password"
                  required={!editUser}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
                />
              </div>

              {/* Security Role Selection */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">{t.roleLabel} *</label>
                {editUser && (editUser.id === 'usr_owner' || editUser.username === 'roth') ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2">
                    <Shield size={15} className="text-amber-600" />
                    <span>👑 PRIMARY EXECUTIVE OWNER (Protected)</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['owner', 'admin', 'manager', 'staff'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSelectedRoleId(r)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer text-center border ${
                          selectedRoleId === r
                            ? r === 'owner' 
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                              : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {r === 'owner' ? '👑 Owner' : r}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Telegram 2FA Section */}
              <div className="p-3.5 bg-sky-50/70 border border-sky-200/80 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Send size={13} className="text-sky-600" />
                    {t.twoFactorTitle}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={twoFactorMethod === 'telegram'}
                      onChange={e => setTwoFactorMethod(e.target.checked ? 'telegram' : 'disabled')}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-bold text-slate-700 block">Telegram Username ឬ Chat ID (សម្រាប់ Bot & វត្តមាន)</label>
                    <button
                      type="button"
                      onClick={handleAutoDetectTelegram}
                      disabled={isDetectingTg}
                      className="text-[10px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 bg-sky-50 px-2 py-0.5 rounded-md hover:bg-sky-100 transition-all cursor-pointer"
                    >
                      {isDetectingTg ? 'កំពុងស្វែងរក...' : '🔍 ស្វែងរក / Auto-detect'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={telegramUsername}
                    onChange={e => handleTelegramInputChange(e.target.value)}
                    onPaste={e => {
                      const pasteText = e.clipboardData.getData('text');
                      if (pasteText) {
                        e.preventDefault();
                        handleTelegramInputChange(pasteText);
                      }
                    }}
                    placeholder="@username ឬ Chat ID លេខ (ឧ. @username)"
                    className="w-full px-3 py-2 bg-white border border-sky-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-600 transition-all"
                  />
                  {(detectedChatId || (editUser?.telegramChatId && /^-?\d+$/.test(String(editUser.telegramChatId)))) && (
                    <div className="flex items-center justify-between text-[11px] px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl font-sans text-emerald-800">
                      <span className="font-bold">✅ Telegram Chat ID:</span>
                      <span className="font-mono font-bold">{detectedChatId || editUser?.telegramChatId}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    💡 <b>ចំណាំ៖</b> បំពេញ Telegram Username (@username) ឬ Telegram ID របស់គាត់ ដើម្បីឱ្យ Bot និង Mini App ស្គាល់សិទ្ធិ (Owner, Admin, Manager) របស់គាត់ដោយស្វ័យប្រវត្តិ។
                  </p>
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t.emailLabel}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t.phoneLabel}</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={t.phonePlaceholder}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              {/* Branch Scope Assignment */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 block">{t.branchesLabel}</label>
                  {selectedRoleId === 'owner' && (
                    <button
                      type="button"
                      onClick={() => setAssignedBranchIds([])}
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        assignedBranchIds.length === 0
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      🌐 {lang === 'en' ? 'All Branches (Executive)' : 'គ្រប់សាខា (Executive Owner)'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {branches.map(b => {
                    const isSelected = assignedBranchIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleBranchToggle(b.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected && <Check size={12} className="text-blue-600" />}
                        <span>{b.branchName} ({b.branchCode})</span>
                      </button>
                    );
                  })}
                </div>
                {selectedRoleId === 'owner' && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {assignedBranchIds.length === 0
                      ? (lang === 'en' ? '👑 Executive Owner: Has complete oversight across all company branches.' : '👑 Executive Owner៖ មានសិទ្ធិមើលការខុសត្រូវគ្រប់សាខាទាំងអស់។')
                      : (lang === 'en' ? '👑 Branch Owner: Assigned specifically to manage selected branch location(s).' : '👑 Branch Owner៖ គ្រប់គ្រងសាខាជាក់លាក់ដែលបានកំណត់។')}
                  </p>
                )}
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                <span>{editUser ? t.save : t.create}</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetUser && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleResetPasswordSubmit} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in duration-150">
            
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 font-sans">
                <Key className="text-amber-500" size={16} />
                {t.resetPasswordTitle}
              </h3>
              <button 
                type="button" 
                onClick={() => setResetUser(null)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              {t.resetPasswordDesc} <strong className="text-slate-900">"{resetUser.fullName}" (@{resetUser.username})</strong>
            </p>

            <div>
              <input
                type="password"
                required
                value={resetPasswordVal}
                onChange={e => setResetPasswordVal(e.target.value)}
                placeholder={t.newPasswordPlaceholder}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetUser(null)}
                className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                {t.confirmReset}
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}

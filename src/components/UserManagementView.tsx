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
  Sparkles
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
  // Active Main SubTab: 'users' | 'roles'
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  // Loading & Data States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>(FALLBACK_ROLES);
  const [permissions, setPermissions] = useState<Permission[]>(FALLBACK_PERMISSIONS);

  // Role Permissions Matrix State
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<RoleDefinition>(FALLBACK_ROLES[1] || FALLBACK_ROLES[0]);
  const [rolePermissionsList, setRolePermissionsList] = useState<string[]>(() => FALLBACK_ROLES[1]?.permissions?.map(p => p.id) || []);

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

  const isOwner = currentRole === 'Owner' || currentRole === 'Admin';

  const handleAutoDetectTelegram = async () => {
    setIsDetectingTg(true);
    try {
      const res = await fetch('/api/telegram-autodetect');
      const data = await res.json();
      if (data && data.success && (data.username || data.chatId)) {
        if (data.username) setTelegramUsername(`@${data.username}`);
        if (data.chatId) setDetectedChatId(String(data.chatId));
        setBanner({
          type: 'success',
          msg: lang === 'en' 
            ? `Detected: @${data.username || 'User'} (Chat ID: ${data.chatId})` 
            : `បានរកឃើញ: @${data.username || 'User'} (Chat ID: ${data.chatId})`
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
    setTwoFactorMethod('disabled');
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
    setTelegramUsername(user.telegramUsername || user.telegramChatId || '');
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

      const cleanTelegram = telegramUsername.trim();
      const payload: any = {
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim() || `${username.trim().toLowerCase()}@p2bkh.tech`,
        phone: phone.trim(),
        roleId: finalRoleId,
        role: finalRole,
        twoFactorMethod,
        telegramUsername: cleanTelegram.startsWith('@') ? cleanTelegram : (cleanTelegram ? `@${cleanTelegram}` : ''),
        telegramChatId: detectedChatId || cleanTelegram,
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
                                    <span>{user.telegramUsername || user.telegramChatId || 'Telegram 2FA'}</span>
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
        {activeTab === 'roles' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header info & Save Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="text-blue-600" size={18} />
                  {t.rolesHeaderTitle}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.rolesHeaderDesc}
                </p>
              </div>

              {selectedRoleForPerms?.id !== 'owner' && (
                <button
                  onClick={handleSaveRolePermissions}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer self-start sm:self-auto"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>{t.savePermsBtn}</span>
                </button>
              )}
            </div>

            {/* Role Switcher Tabs */}
            <div className="flex flex-wrap gap-2">
              {roles.map(r => {
                const isSelected = selectedRoleForPerms?.id === r.id;
                const isRoleOwner = r.id === 'owner';

                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelectRole(r)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? isRoleOwner
                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                          : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Shield size={14} className={isSelected ? 'text-white' : 'text-slate-400'} />
                    <span>{r.name}</span>
                    {isRoleOwner && <span className="text-[9px] bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded font-black">FULL ACCESS</span>}
                  </button>
                );
              })}
            </div>

            {/* Permissions Matrix Content */}
            {selectedRoleForPerms?.id === 'owner' ? (
              <div className="p-6 bg-amber-50/70 border border-amber-200/90 rounded-2xl flex items-start gap-3">
                <CheckCircle2 size={22} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="text-xs font-bold text-amber-950 block">Owner (Executive Administrator / ម្ចាស់ហាង)</strong>
                  <p className="text-xs text-amber-850 font-medium">
                    {t.ownerFullPrivilege}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from(new Set(permissions.map(p => p.module))).map(moduleName => {
                  const modulePerms = permissions.filter(p => p.module === moduleName);
                  const modulePermIds = modulePerms.map(p => p.id);
                  const allChecked = modulePermIds.every(id => rolePermissionsList.includes(id));
                  const someChecked = modulePermIds.some(id => rolePermissionsList.includes(id));

                  return (
                    <div key={moduleName} className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                      {/* Module Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                        <span className="text-xs font-black text-slate-900 tracking-wide uppercase font-sans">
                          {moduleName}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleAllForModule(modulePermIds)}
                          className="text-[10.5px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                        >
                          {allChecked ? t.deselectAll : t.selectAll}
                        </button>
                      </div>

                      {/* Action Checkboxes */}
                      <div className="space-y-1.5">
                        {modulePerms.map(perm => {
                          const isChecked = rolePermissionsList.includes(perm.id);

                          return (
                            <label
                              key={perm.id}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer select-none transition-all border ${
                                isChecked
                                  ? 'bg-white border-blue-200 text-slate-900 shadow-2xs font-semibold'
                                  : 'bg-transparent border-transparent text-slate-500 hover:bg-white/60'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermissionId(perm.id)}
                                  className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-0 cursor-pointer"
                                />
                                <span className="font-sans">{perm.action}</span>
                              </div>
                              {isChecked && <Check size={13} className="text-blue-600 shrink-0" />}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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

                {twoFactorMethod === 'telegram' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10.5px] font-bold text-slate-700 block">{t.telegramLabel}</label>
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
                      onChange={e => setTelegramUsername(e.target.value)}
                      placeholder="@username ឬ Chat ID លេខ"
                      className="w-full px-3 py-2 bg-white border border-sky-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-600 transition-all"
                    />
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      💡 <b>ចំណាំ៖</b> បុគ្គលិកត្រូវបើក Telegram រួចចុច <b>/start</b> លើ Bot Telegram របស់ក្រុមហ៊ុនជាមុនសិន ទើប Bot អាចផ្ញើលេខកូដ 2FA ទៅកាន់ Telegram ផ្ទាល់ខ្លួនរបស់គាត់បាន។
                    </p>
                  </div>
                )}
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

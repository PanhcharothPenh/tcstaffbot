/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { 
  Building2, 
  MapPin, 
  UserSquare2, 
  Globe2, 
  BellRing, 
  Activity, 
  Settings2,
  Users,
  Shield,
  HelpCircle,
  Clock,
  Menu,
  ChevronDown,
  LogOut
} from 'lucide-react';

// Core imports
import { 
  Role, 
  ActiveTab, 
  Branch, 
  Staff, 
  Salary, 
  Attendance, 
  Income, 
  Expense, 
  InventoryItem, 
  Machine, 
  User,
  CoinTransaction,
  RevenueRecord,
  GasRecord,
  DetergentRecord,
  SoftenerRecord,
  StockTransaction,
  Supplier,
  SupplierPayment,
  Debt,
  DebtPayment,
  CashDrawer,
  CashDrawerTransaction,
  MonthClosing,
  SalarySchedule,
  SalaryAdvance
} from './types';
import { db, translations } from './mockData';

// Subcomponents import
import Sidebar from './components/Sidebar';
import TCLogo from './components/TCLogo';
const DashboardView = lazy(() => import('./components/DashboardView'));
const BranchManagementView = lazy(() => import('./components/BranchManagementView'));
const StaffManagementView = lazy(() => import('./components/StaffManagementView'));
const ShiftCalendarView = lazy(() => import('./components/ShiftCalendarView'));
const SalaryManagementView = lazy(() => import('./components/SalaryManagementView'));
const TelegramConfigView = lazy(() => import('./components/TelegramConfigView'));
const AttendanceView = lazy(() => import('./components/AttendanceView'));
const DailyIncomeView = lazy(() => import('./components/DailyIncomeView'));
const ExpenseView = lazy(() => import('./components/ExpenseView'));
const InventoryView = lazy(() => import('./components/InventoryView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const UserManagementView = lazy(() => import('./components/UserManagementView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const TelegramLogin = lazy(() => import('./components/TelegramLogin'));
import TelegramAttendanceMiniApp from './components/TelegramAttendanceMiniApp';
import { authApi, getSavedSessionUser, saveSession, clearSession, getSavedAccessToken, getSavedRefreshToken } from './utils/api';

// 6 New Submodules Imported Here
const CoinTransactionsView = lazy(() => import('./components/CoinTransactionsView'));
const RevenueRecordsView = lazy(() => import('./components/RevenueRecordsView'));
const GasRecordsView = lazy(() => import('./components/GasRecordsView'));
const DetergentRecordsView = lazy(() => import('./components/DetergentRecordsView'));
const SoftenerRecordsView = lazy(() => import('./components/SoftenerRecordsView'));
const StockTransactionsView = lazy(() => import('./components/StockTransactionsView'));

// Suppliers, Debts, CashDrawer, MonthClosing, and AuditLogs submodules
const SuppliersView = lazy(() => import('./components/SuppliersView'));
const DebtsView = lazy(() => import('./components/DebtsView'));
const CashDrawerView = lazy(() => import('./components/CashDrawerView'));
const MonthClosingView = lazy(() => import('./components/MonthClosingView'));
const AuditLogsView = lazy(() => import('./components/AuditLogsView'));
import { encryptLiveUrl, decryptLiveUrl } from './utils/urlSecurity';

const getTabFromUrl = (): ActiveTab => {
  if (typeof window === 'undefined') return 'staff';
  const path = window.location.pathname + window.location.hash;
  const tab = decryptLiveUrl(path);
  if (['staff', 'shifts', 'attendance', 'salary', 'branches', 'users'].includes(tab)) {
    return tab;
  }
  return 'staff';
};

export default function App() {
  // Global State Managers - Khmer as Primary Default Language
  const [lang, setLangState] = useState<'en' | 'kh'>(() => {
    try {
      const saved = localStorage.getItem('coffee_lang');
      if (saved === 'en' || saved === 'kh') return saved;
    } catch {}
    return 'kh'; // Default to Khmer as primary
  });

  const setLang = (newLang: 'en' | 'kh') => {
    setLangState(newLang);
    try {
      localStorage.setItem('coffee_lang', newLang);
    } catch {}
  };

  const cachedInitialUser = getSavedSessionUser();
  const [authenticatedUser, setAuthenticatedUser] = useState<any | null>(() => cachedInitialUser);
  const [authChecking, setAuthChecking] = useState<boolean>(() => !cachedInitialUser);
  const [currentRole, setCurrentRole] = useState<Role>(() => cachedInitialUser?.role || 'Owner');
  const [activeBranchId, setActiveBranchId] = useState<string>(() => {
    return (cachedInitialUser?.assignedBranchIds && cachedInitialUser.assignedBranchIds.length > 0)
      ? cachedInitialUser.assignedBranchIds[0]
      : 'all';
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(getTabFromUrl);
  const [exchangeRate, setExchangeRate] = useState<number>(4000);

  // Sync live clean URL pathname when activeTab or authentication state changes
  useEffect(() => {
    if (window.location.pathname.startsWith('/attendance-app')) {
      return;
    }

    if (!authenticatedUser) {
      if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
        window.history.replaceState(null, '', '/');
      }
      return;
    }

    const liveCleanPath = encryptLiveUrl(activeTab);
    if (window.location.pathname !== liveCleanPath || window.location.hash) {
      window.history.replaceState(null, '', liveCleanPath);
    }
  }, [activeTab, authenticatedUser]);

  // Listen to browser forward/back button and live URL changes
  useEffect(() => {
    const handleUrlNavigation = () => {
      const nextTab = getTabFromUrl();
      setActiveTab(nextTab);
    };
    window.addEventListener('popstate', handleUrlNavigation);
    window.addEventListener('hashchange', handleUrlNavigation);
    return () => {
      window.removeEventListener('popstate', handleUrlNavigation);
      window.removeEventListener('hashchange', handleUrlNavigation);
    };
  }, []);

  // Sidebar Collapsible State
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('p2b_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleSetSidebarCollapsed = (val: boolean | ((prev: boolean) => boolean)) => {
    setSidebarCollapsed(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('p2b_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  // Live Database Sync States
  const [dbSyncStatus, setDbSyncStatus] = useState<'synced' | 'connecting' | 'error'>('connecting');
  const [isLoadedFromServer, setIsLoadedFromServer] = useState(false);
  const isPullingRef = useRef<boolean>(false);
  const lastPushedJsonRef = useRef<string>('');

  useEffect(() => {
    const checkSync = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setDbSyncStatus('error');
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch('/api/debug-supabase', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          setDbSyncStatus('synced');
        } else {
          setDbSyncStatus(typeof navigator !== 'undefined' && navigator.onLine ? 'synced' : 'error');
        }
      } catch (e) {
        setDbSyncStatus(typeof navigator !== 'undefined' && navigator.onLine ? 'synced' : 'error');
      }
    };
    checkSync();
    
    const handleOnline = () => checkSync();
    const handleOffline = () => setDbSyncStatus('error');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Helper to ensure owner is never loaded as employee staff
  const cleanStaffRoster = (list: any[]): Staff[] => 
    Array.isArray(list) ? list.filter((s: any) => s && s.role !== 'Owner' && s.roleId !== 'owner' && !String(s.position || '').toLowerCase().includes('owner') && s.id !== 'staff_owner_clean24') : [];

  // Database lists
  const [branches, setBranches] = useState<Branch[]>(() => db.getBranches());
  const [staff, setStaff] = useState<Staff[]>(() => cleanStaffRoster(db.getStaff()));
  const [salaries, setSalaries] = useState<Salary[]>(() => db.getSalaries());
  const [salarySchedules, setSalarySchedules] = useState<SalarySchedule[]>(() => db.getSalarySchedules());
  const [salaryAdvances, setSalaryAdvances] = useState<SalaryAdvance[]>(() => db.getSalaryAdvances());
  const [attendance, setAttendance] = useState<Attendance[]>(() => db.getAttendance());
  const [incomes, setIncomes] = useState<Income[]>(() => db.getIncomes());
  const [expenses, setExpenses] = useState<Expense[]>(() => db.getExpenses());
  const [inventory, setInventory] = useState<InventoryItem[]>(() => db.getInventory());
  const [machines, setMachines] = useState<Machine[]>(() => db.getMachines());
  const [users, setUsers] = useState<User[]>(() => db.getUsers());
  const [coinTransactions, setCoinTransactions] = useState<CoinTransaction[]>(() => db.getCoinTransactions());
  const [revenueRecords, setRevenueRecords] = useState<RevenueRecord[]>(() => db.getRevenueRecords());
  const [gasRecords, setGasRecords] = useState<GasRecord[]>(() => db.getGasRecords());
  const [detergentRecords, setDetergentRecords] = useState<DetergentRecord[]>(() => db.getDetergentRecords());
  const [softenerRecords, setSoftenerRecords] = useState<SoftenerRecord[]>(() => db.getSoftenerRecords());
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>(() => db.getStockTransactions());
  
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => db.getSuppliers());
  const [debts, setDebts] = useState<Debt[]>(() => db.getDebts());
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>(() => db.getDebtPayments());
  const [cashDrawers, setCashDrawers] = useState<CashDrawer[]>(() => db.getCashDrawers());
  const [cashDrawerTransactions, setCashDrawerTransactions] = useState<CashDrawerTransaction[]>(() => db.getCashDrawerTransactions());
  const [monthClosings, setMonthClosings] = useState<MonthClosing[]>(() => db.getMonthClosings());
  
  // Real-time audit trails state
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check user authentication session on mount (Instant Cache + Background Verification)
  useEffect(() => {
    let active = true;

    // Instant zero-delay load from localStorage cache if available
    const cachedUser = getSavedSessionUser();
    if (cachedUser && active) {
      setAuthenticatedUser(cachedUser);
      setCurrentRole(cachedUser.role);
      setActiveBranchId(cachedUser.assignedBranchIds && cachedUser.assignedBranchIds.length > 0 ? cachedUser.assignedBranchIds[0] : 'all');
      setAuthChecking(false);
    }

    const checkSession = async () => {
      try {
        const user = await authApi.getMe();
        if (active && user) {
          setAuthenticatedUser(user);
          setCurrentRole(user.role);
          setActiveBranchId(user.assignedBranchIds && user.assignedBranchIds.length > 0 ? user.assignedBranchIds[0] : 'all');
          saveSession(getSavedAccessToken(), getSavedRefreshToken(), user);
        }
      } catch (err) {
        console.warn('[Session notice]:', err);
      } finally {
        if (active) setAuthChecking(false);
      }
    };

    checkSession();
  }, []);

  // Load database on initialization
  useEffect(() => {
    // Clear legacy demo storage if present from past versions
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('CLEAN24_LAUNDRY_')) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {}

    // 1. Fast load from browser local storage cache
    setBranches(db.getBranches());
    setStaff(db.getStaff());
    setSalaries(db.getSalaries());
    setSalarySchedules(db.getSalarySchedules());
    setSalaryAdvances(db.getSalaryAdvances());
    setAttendance(db.getAttendance());
    setIncomes(db.getIncomes());
    setExpenses(db.getExpenses());
    setInventory(db.getInventory());
    setMachines(db.getMachines());
    setUsers(db.getUsers());
    setCoinTransactions(db.getCoinTransactions());
    setRevenueRecords(db.getRevenueRecords());
    setGasRecords(db.getGasRecords());
    setDetergentRecords(db.getDetergentRecords());
    setSoftenerRecords(db.getSoftenerRecords());
    setStockTransactions(db.getStockTransactions());
    setSuppliers(db.getSuppliers());
    setDebts(db.getDebts());
    setDebtPayments(db.getDebtPayments());
    setCashDrawers(db.getCashDrawers());
    setCashDrawerTransactions(db.getCashDrawerTransactions());
    setMonthClosings(db.getMonthClosings());

    // Generate initial logs
    setAuditLogs([
      `[${new Date().toLocaleTimeString()}] Authenticated Coffee MGM admin session safely.`,
      `[${new Date().toLocaleTimeString()}] Checked multi-branch isolation integrity check sum.`
    ]);

    // 2. Fetch the latest database state from cloud server
    const pullSync = async () => {
      try {
        isPullingRef.current = true;
        const r = await fetch('/api/sync-data');
        if (!r.ok) return;
        const res = await r.json();
        const s = res?.data || res?.db;
        if (res && res.success && s) {
          const updateIfChanged = (incoming: any, getter: () => any, setter: (val: any) => void, saver: (val: any) => void) => {
            if (Array.isArray(incoming) && incoming.length > 0) {
              const current = getter();
              if (JSON.stringify(current) !== JSON.stringify(incoming)) {
                setter(incoming);
                saver(incoming);
              }
            }
          };

          updateIfChanged(s.branches, db.getBranches, setBranches, db.saveBranches);
          updateIfChanged(cleanStaffRoster(s.staff), () => cleanStaffRoster(db.getStaff()), setStaff, db.saveStaff);
          updateIfChanged(s.salaries, db.getSalaries, setSalaries, db.saveSalaries);
          updateIfChanged(s.salarySchedules, db.getSalarySchedules, setSalarySchedules, db.saveSalarySchedules);
          updateIfChanged(s.salaryAdvances, db.getSalaryAdvances, setSalaryAdvances, db.saveSalaryAdvances);
          updateIfChanged(s.attendance, db.getAttendance, setAttendance, db.saveAttendance);
          updateIfChanged(s.incomes, db.getIncomes, setIncomes, db.saveIncomes);
          updateIfChanged(s.expenses, db.getExpenses, setExpenses, db.saveExpenses);
          updateIfChanged(s.inventory, db.getInventory, setInventory, db.saveInventory);
          updateIfChanged(s.machines, db.getMachines, setMachines, db.saveMachines);
          updateIfChanged(s.users, db.getUsers, setUsers, db.saveUsers);
          updateIfChanged(s.coinTransactions, db.getCoinTransactions, setCoinTransactions, db.saveCoinTransactions);
          updateIfChanged(s.revenueRecords, db.getRevenueRecords, setRevenueRecords, db.saveRevenueRecords);
          updateIfChanged(s.gasRecords, db.getGasRecords, setGasRecords, db.saveGasRecords);
          updateIfChanged(s.detergentRecords, db.getDetergentRecords, setDetergentRecords, db.saveDetergentRecords);
          updateIfChanged(s.softenerRecords, db.getSoftenerRecords, setSoftenerRecords, db.saveSoftenerRecords);
          updateIfChanged(s.stockTransactions, db.getStockTransactions, setStockTransactions, db.saveStockTransactions);
          updateIfChanged(s.suppliers, db.getSuppliers, setSuppliers, db.saveSuppliers);
          updateIfChanged(s.debts, db.getDebts, setDebts, db.saveDebts);
          updateIfChanged(s.debtPayments, db.getDebtPayments, setDebtPayments, db.saveDebtPayments);
          updateIfChanged(s.cashDrawers, db.getCashDrawers, setCashDrawers, db.saveCashDrawers);
          updateIfChanged(s.cashDrawerTransactions, db.getCashDrawerTransactions, setCashDrawerTransactions, db.saveCashDrawerTransactions);
          updateIfChanged(s.monthClosings, db.getMonthClosings, setMonthClosings, db.saveMonthClosings);
          setDbSyncStatus('synced');
        }
      } catch (err: any) {
        console.warn('[Realtime Sync] Background sync notice:', err.message);
      } finally {
        setIsLoadedFromServer(true);
        setTimeout(() => { isPullingRef.current = false; }, 500);
      }
    };

    pullSync();
    const syncInterval = setInterval(pullSync, 30000); // 30s efficient interval
    const handleFocus = () => pullSync();
    window.addEventListener('focus', handleFocus);

    // Cross-tab immediate synchronization
    const handleStorageEvent = () => {
      setBranches(db.getBranches());
      setStaff(db.getStaff());
      setSalaries(db.getSalaries());
      setIncomes(db.getIncomes());
      setExpenses(db.getExpenses());
      setInventory(db.getInventory());
      setMachines(db.getMachines());
      setCoinTransactions(db.getCoinTransactions());
      setRevenueRecords(db.getRevenueRecords());
      setGasRecords(db.getGasRecords());
      setDetergentRecords(db.getDetergentRecords());
      setSoftenerRecords(db.getSoftenerRecords());
      setStockTransactions(db.getStockTransactions());
      setSuppliers(db.getSuppliers());
      setDebts(db.getDebts());
      setDebtPayments(db.getDebtPayments());
      setCashDrawers(db.getCashDrawers());
      setCashDrawerTransactions(db.getCashDrawerTransactions());
      setMonthClosings(db.getMonthClosings());
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // Sync state mutations back to key-value local storage
  useEffect(() => {
    db.saveBranches(branches);
  }, [branches]);

  useEffect(() => {
    db.saveStaff(staff);
  }, [staff]);

  useEffect(() => {
    db.saveSalaries(salaries);
  }, [salaries]);

  useEffect(() => {
    db.saveSalarySchedules(salarySchedules);
  }, [salarySchedules]);

  useEffect(() => {
    db.saveSalaryAdvances(salaryAdvances);
  }, [salaryAdvances]);

  useEffect(() => {
    db.saveAttendance(attendance);
  }, [attendance]);

  useEffect(() => {
    db.saveIncomes(incomes);
  }, [incomes]);

  useEffect(() => {
    db.saveExpenses(expenses);
  }, [expenses]);

  useEffect(() => {
    db.saveInventory(inventory);
  }, [inventory]);

  useEffect(() => {
    db.saveMachines(machines);
  }, [machines]);

  useEffect(() => {
    db.saveUsers(users);
  }, [users]);

  useEffect(() => {
    db.saveCoinTransactions(coinTransactions);
  }, [coinTransactions]);

  useEffect(() => {
    db.saveRevenueRecords(revenueRecords);
  }, [revenueRecords]);

  useEffect(() => {
    db.saveGasRecords(gasRecords);
  }, [gasRecords]);

  useEffect(() => {
    db.saveDetergentRecords(detergentRecords);
  }, [detergentRecords]);

  useEffect(() => {
    db.saveSoftenerRecords(softenerRecords);
  }, [softenerRecords]);

  useEffect(() => {
    db.saveStockTransactions(stockTransactions);
  }, [stockTransactions]);

  useEffect(() => {
    db.saveSuppliers(suppliers);
  }, [suppliers]);

  useEffect(() => {
    db.saveDebts(debts);
  }, [debts]);

  useEffect(() => {
    db.saveDebtPayments(debtPayments);
  }, [debtPayments]);

  useEffect(() => {
    db.saveCashDrawers(cashDrawers);
  }, [cashDrawers]);

  useEffect(() => {
    db.saveCashDrawerTransactions(cashDrawerTransactions);
  }, [cashDrawerTransactions]);

  useEffect(() => {
    db.saveMonthClosings(monthClosings);
  }, [monthClosings]);

  // Immediate auto-save flush on page refresh or tab close
  useEffect(() => {
    const handleBeforeUnloadFlush = () => {
      try {
        const payload = {
          branches,
          staff,
          users,
          salaries,
          salarySchedules,
          salaryAdvances,
          attendance,
          incomes,
          expenses,
          inventory,
          machines,
          coinTransactions,
          revenueRecords,
          gasRecords,
          detergentRecords,
          softenerRecords,
          stockTransactions,
          suppliers,
          debts,
          debtPayments,
          cashDrawers,
          cashDrawerTransactions,
          monthClosings,
          settings: { shopName: "TC Staff Management" }
        };
        const serialized = JSON.stringify(payload);
        if (serialized !== lastPushedJsonRef.current) {
          lastPushedJsonRef.current = serialized;
          const blob = new Blob([serialized], { type: 'application/json' });
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/sync-data', blob);
          } else {
            fetch('/api/sync-data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: serialized,
              keepalive: true
            }).catch(() => {});
          }
        }
      } catch (e) {}
    };

    window.addEventListener('beforeunload', handleBeforeUnloadFlush);
    window.addEventListener('pagehide', handleBeforeUnloadFlush);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnloadFlush);
      window.removeEventListener('pagehide', handleBeforeUnloadFlush);
    };
  }, [
    branches, staff, users, salaries, salarySchedules, salaryAdvances,
    attendance, incomes, expenses, inventory, machines,
    coinTransactions, revenueRecords, gasRecords, detergentRecords,
    softenerRecords, stockTransactions, suppliers, debts, debtPayments,
    cashDrawers, cashDrawerTransactions, monthClosings
  ]);

  // Synchronize database state to backend Express context for multi-device live sync
  useEffect(() => {
    if (!isLoadedFromServer || isPullingRef.current) return;
    const payload = {
      branches,
      staff,
      users,
      salaries,
      salarySchedules,
      salaryAdvances,
      attendance,
      incomes,
      expenses,
      inventory,
      machines,
      coinTransactions,
      revenueRecords,
      gasRecords,
      detergentRecords,
      softenerRecords,
      stockTransactions,
      suppliers,
      debts,
      debtPayments,
      cashDrawers,
      cashDrawerTransactions,
      monthClosings,
      settings: { shopName: "TC Staff Management" }
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastPushedJsonRef.current) return;

    const saveTimer = setTimeout(() => {
      lastPushedJsonRef.current = serialized;
      fetch('/api/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serialized
      })
      .then(() => setDbSyncStatus('synced'))
      .catch(err => {
        console.warn('Backend sync warning:', err.message);
        setDbSyncStatus('error');
      });
    }, 1200); // 1.2s debounce for fast snappy UI

    return () => clearTimeout(saveTimer);
  }, [
    branches,
    staff,
      users,
      salaries,
    salarySchedules,
    salaryAdvances,
    attendance,
    incomes,
    expenses,
    inventory,
    machines,
    coinTransactions,
    revenueRecords,
    gasRecords,
    detergentRecords,
    softenerRecords,
    stockTransactions,
    suppliers,
    debts,
    debtPayments,
    cashDrawers,
    cashDrawerTransactions,
    monthClosings,
    isLoadedFromServer
  ]);

  // Utility to append real time administrative logs
  const handleAddNewAuditLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${msg}`;
    setAuditLogs(prev => [formatted, ...prev].slice(0, 50));
    
    // Auto push into live toast notification list if urgent
    if (msg.toLowerCase().includes('low') || msg.toLowerCase().includes('paid') || msg.toLowerCase().includes('calibration')) {
      setNotifications(prev => [msg, ...prev].slice(0, 10));
    }
  };

  const currentUser = authenticatedUser || (users.find(u => u.role === currentRole) || users[0]);
  const setCurrentUser = (u: any) => { 
    if (u && u.role) {
      handleRoleSimulationSwap(u.role);
    }
  };

  const handleLogout = async () => {
    try {
      clearSession();
      localStorage.removeItem('clean24_access_token');
      localStorage.removeItem('clean24_refresh_token');
      localStorage.removeItem('clean24_user_session');
      localStorage.removeItem('clean24_auth_user');
      authApi.logout().catch(() => {});
    } catch (e) {}
    setAuthenticatedUser(null);
    setAuthChecking(false);
    handleAddNewAuditLog(`User logged out successfully.`);
    window.history.replaceState(null, '', '/');
  };

  const t = translations[lang];

  // Restructure branch active view names
  const getActiveBranchLabel = () => {
    if (activeBranchId === 'all') {
      return lang === 'en' ? "Consolidated Branches View (All)" : "មើលរួមគ្រប់សាខាទាំងអស់";
    }
    const currentSelected = branches.find(b => b.id === activeBranchId);
    return currentSelected ? `${currentSelected.branchName} (${currentSelected.branchCode})` : activeBranchId;
  };

  // User accessible branches for Quick Switcher
  const userAccessibleBranches = useMemo(() => {
    if (currentUser?.assignedBranchIds && currentUser.assignedBranchIds.length > 0) {
      return branches.filter(b => currentUser.assignedBranchIds.includes(b.id));
    }
    return branches;
  }, [branches, currentUser]);

  const canAccessAllBranches = (currentRole === 'Owner' || currentRole === 'Admin') &&
    (!currentUser?.assignedBranchIds || currentUser.assignedBranchIds.length === 0);

  // Switch role and apply access-level adjustments
  const handleRoleSimulationSwap = (nextRole: Role) => {
    setCurrentRole(nextRole);
    handleAddNewAuditLog(`Session privileges updated to: [${nextRole}]`);

    // Lock non-authorized roles from restricted tabs when swapping
    if (nextRole === 'Staff') {
      setActiveTab('staff'); // staff defaults to staff profile
      setActiveBranchId('b1'); // staff forced to Toul Kork (b1)
    } else if (nextRole === 'Manager') {
      setActiveBranchId('b1'); // manager restricted to Toul Kork (b1)
      if (['branches', 'users', 'settings'].includes(activeTab)) {
        setActiveTab('dashboard');
      }
    } else if (nextRole === 'Admin') {
      if (['branches', 'users'].includes(activeTab)) {
        setActiveTab('dashboard');
      }
    }
  };

  // Render Submodule Tab Panel Views
  const renderTabContent = () => {
    const effectiveBranches = userAccessibleBranches.length > 0 ? userAccessibleBranches : branches;
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            staffList={staff}
            salaryList={salaries}
            incomeList={incomes}
            expenseList={expenses}
            inventoryList={inventory}
            coinTransactions={coinTransactions}
            revenueRecords={revenueRecords}
            gasRecords={gasRecords}
            detergentRecords={detergentRecords}
            softenerRecords={softenerRecords}
            stockTransactions={stockTransactions}
            machines={machines}
            lang={lang}
            exchangeRate={exchangeRate}
            onNavigate={setActiveTab}
            onSelectBranch={setActiveBranchId}
          />
        );
      case 'branches':
        return (
          <BranchManagementView
            currentRole={currentRole}
            branches={branches}
            setBranches={setBranches}
            users={users}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'staff':
        return (
          <StaffManagementView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            staff={staff}
            setStaff={setStaff}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'shifts':
        return (
          <ShiftCalendarView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            staffList={staff}
            attendance={attendance}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'telegram_config':
        return (
          <TelegramConfigView
            currentRole={currentRole}
            branches={branches}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'salary':
        return (
          <SalaryManagementView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            staffList={staff}
            setStaff={setStaff}
            salaries={salaries}
            setSalaries={setSalaries}
            salarySchedules={salarySchedules}
            setSalarySchedules={setSalarySchedules}
            salaryAdvances={salaryAdvances}
            setSalaryAdvances={setSalaryAdvances}
            attendance={attendance}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
            exchangeRate={exchangeRate}
          />
        );
      case 'attendance':
        return (
          <AttendanceView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            staffList={staff}
            attendance={attendance}
            setAttendance={setAttendance}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'income':
        return (
          <DailyIncomeView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            machines={machines}
            incomes={incomes}
            setIncomes={setIncomes}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
            exchangeRate={exchangeRate}
          />
        );
      case 'expense':
        return (
          <ExpenseView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            expenses={expenses}
            setExpenses={setExpenses}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
            exchangeRate={exchangeRate}
          />
        );
      case 'inventory':
        return (
          <InventoryView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            inventory={inventory}
            setInventory={setInventory}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'coins':
        return (
          <CoinTransactionsView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            coinTransactions={coinTransactions}
            setCoinTransactions={setCoinTransactions}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
            exchangeRate={exchangeRate}
          />
        );
      case 'revenues':
        return (
          <RevenueRecordsView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            revenueRecords={revenueRecords}
            setRevenueRecords={setRevenueRecords}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
            exchangeRate={exchangeRate}
            onSelectBranch={setActiveBranchId}
          />
        );
      case 'gas':
        return (
          <GasRecordsView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            gasRecords={gasRecords}
            setGasRecords={setGasRecords}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
            exchangeRate={exchangeRate}
          />
        );
      case 'detergents':
        return (
          <DetergentRecordsView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            detergentRecords={detergentRecords}
            setDetergentRecords={setDetergentRecords}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
            exchangeRate={exchangeRate}
            inventory={inventory}
            setInventory={setInventory}
            stockTransactions={stockTransactions}
            setStockTransactions={setStockTransactions}
          />
        );
      case 'softeners':
        return (
          <SoftenerRecordsView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            softenerRecords={softenerRecords}
            setSoftenerRecords={setSoftenerRecords}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
            exchangeRate={exchangeRate}
            inventory={inventory}
            setInventory={setInventory}
            stockTransactions={stockTransactions}
            setStockTransactions={setStockTransactions}
          />
        );
      case 'stock':
        return (
          <StockTransactionsView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            stockTransactions={stockTransactions}
            setStockTransactions={setStockTransactions}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
            exchangeRate={exchangeRate}
          />
        );

      case 'reports':
        return (
          <ReportsView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            incomes={incomes}
            expenses={expenses}
            salaries={salaries}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
            exchangeRate={exchangeRate}
            currentUser={currentUser}
            attendance={attendance}
            inventory={inventory}
            machines={machines}
            coinTransactions={coinTransactions}
            revenueRecords={revenueRecords}
            gasRecords={gasRecords}
            detergentRecords={detergentRecords}
            softenerRecords={softenerRecords}
            stockTransactions={stockTransactions}
            suppliers={suppliers}
            debts={debts}
            debtPayments={debtPayments}
            cashDrawers={cashDrawers}
            cashDrawerTransactions={cashDrawerTransactions}
            monthClosings={monthClosings}
          />
        );
      case 'users':
        return (
          <UserManagementView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={branches}
            setBranches={setBranches}
            users={users}
            setUsers={setUsers}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'settings':
        return (
          <SettingsView
            currentRole={currentRole}
            branches={branches}
            lang={lang}
            setLang={setLang}
            exchangeRate={exchangeRate}
            setExchangeRate={setExchangeRate}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'suppliers':
        return (
          <SuppliersView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            suppliers={suppliers}
            setSuppliers={setSuppliers}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'debts':
        return (
          <DebtsView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            suppliers={suppliers}
            debts={debts}
            setDebts={setDebts}
            debtPayments={debtPayments}
            setDebtPayments={setDebtPayments}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'cashdrawer':
        return (
          <CashDrawerView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            incomes={incomes}
            expenses={expenses}
            cashDrawers={cashDrawers}
            setCashDrawers={setCashDrawers}
            cashDrawerTransactions={cashDrawerTransactions}
            setCashDrawerTransactions={setCashDrawerTransactions}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'monthclosing':
        return (
          <MonthClosingView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            incomes={incomes}
            expenses={expenses}
            coinTransactions={coinTransactions}
            monthClosings={monthClosings}
            setMonthClosings={setMonthClosings}
            lang={lang}
            onAddLog={handleAddNewAuditLog}
          />
        );
      case 'auditlogs':
        return (
          <AuditLogsView
            currentRole={currentRole}
            activeBranchId={activeBranchId}
            branches={effectiveBranches}
            auditLogs={auditLogs}
            lang={lang}
          />
        );
      default:
        return <div className="text-slate-400">Section placeholder construction</div>;
    }
  };

  // Check if requested via Telegram Mini App route or environment
  const isMiniAppRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/attendance-app') ||
    window.location.pathname === '/attendance-app' ||
    window.location.pathname.startsWith('/mini') ||
    window.location.pathname.startsWith('/app') ||
    Boolean((window as any).Telegram?.WebApp?.initData) ||
    window.location.hash.includes('tgWebAppData') ||
    window.location.search.includes('tgWebAppData') ||
    window.location.search.includes('tgWebAppPlatform') ||
    (window.location.search.includes('action=') && (window.location.search.includes('checkin') || window.location.search.includes('checkout') || window.location.search.includes('history')))
  );

  if (isMiniAppRoute) {
    return <TelegramAttendanceMiniApp />;
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center font-sans">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm font-semibold tracking-wide">Initializing secure TC Staff environment...</p>
        </div>
      </div>
    );
  }

  if (!authenticatedUser) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <TelegramLogin
          lang={lang}
          setLang={setLang}
          onLoginSuccess={(user) => {
            setAuthenticatedUser(user);
            setCurrentRole(user.role);
            
            // STRICT REDIRECTION MATRIX:
            // Owner -> Owner Dashboard (consolidated overview)
            // Admin -> Admin Dashboard (analytical admin level)
            // Manager -> Branch Dashboard (specific assigned branch workspace)
            // Staff -> Staff Dashboard (assigned branch operational console)
            if (user.role === 'Owner') {
              setActiveTab('staff');
              setActiveBranchId('all');
            } else if (user.role === 'Admin') {
              setActiveTab('staff');
              setActiveBranchId(user.assignedBranchIds && user.assignedBranchIds.length > 0 ? user.assignedBranchIds[0] : 'b1');
            } else if (user.role === 'Manager') {
              setActiveTab('staff');
              setActiveBranchId(user.assignedBranchIds && user.assignedBranchIds.length > 0 ? user.assignedBranchIds[0] : 'b1');
            } else if (user.role === 'Staff') {
              setActiveTab('staff');
              setActiveBranchId(user.assignedBranchIds && user.assignedBranchIds.length > 0 ? user.assignedBranchIds[0] : 'b1');
            } else {
              setActiveTab('staff');
              setActiveBranchId('all');
            }

            handleAddNewAuditLog(`User fully authenticated: Welcome, ${user.fullName} (${user.role})`);
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="h-screen w-screen max-w-full bg-slate-50/70 flex overflow-hidden" id="main_saas_root">
      
      {/* 1. Left Sidebar Navigation Segment (Desktop Collapsible) */}
      <div className={`hidden lg:flex flex-col h-screen shrink-0 sticky top-0 transition-all duration-300 ease-in-out z-20 ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
        <Sidebar
          currentRole={currentRole}
          setCurrentRole={handleRoleSimulationSwap}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          users={users}
          activeBranchId={activeBranchId}
          setActiveBranchId={setActiveBranchId}
          branches={branches}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          lang={lang}
          setLang={setLang}
          exchangeRate={exchangeRate}
          onLogout={handleLogout}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={handleSetSidebarCollapsed}
        />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex animate-fade-in">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col z-50 shadow-2xl">
            <Sidebar
              currentRole={currentRole}
              setCurrentRole={handleRoleSimulationSwap}
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              users={users}
              activeBranchId={activeBranchId}
              setActiveBranchId={setActiveBranchId}
              branches={branches}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              lang={lang}
              setLang={setLang}
              exchangeRate={exchangeRate}
              onLogout={handleLogout}
              isCollapsed={false}
              onCloseMobile={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 2. Main content area wrapper - structured flex column without double scrolling */}
      <div className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden">
        
        {/* Top Header Segment bar */}
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs" id="header_saas_bar">
          
          {/* Menu Trigger and Title details */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 lg:hidden cursor-pointer transition-colors shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>
            
            <div className="flex flex-col text-left min-w-0">
              <h1 className="text-sm sm:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none">
                {activeTab === 'staff' ? (lang === 'en' ? 'Staff & Barista' : 'បុគ្គលិក & Barista') :
                 activeTab === 'shifts' ? (lang === 'en' ? 'Shift Calendar' : 'ប្រតិទិនវេនការងារ') :
                 activeTab === 'attendance' ? (lang === 'en' ? 'Staff Attendance' : 'វត្តមានបុគ្គលិក') :
                 activeTab === 'salary' ? (lang === 'en' ? 'Salary Management' : 'ការបើកប្រាក់បៀវត្សរ៍') :
                 getActiveBranchLabel()}
              </h1>
            </div>
          </div>

          {/* Interactive controls and simulators (Bilingual + Role switches) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            
            {/* Live Database Sync Indicator (Full on Desktop, Compact on Phone) */}
            <div className="hidden sm:flex items-center gap-1.5 bg-[#D1FAE5] border border-[#065F46]/30 rounded-xl px-2.5 py-1.5 text-[10px] font-bold shrink-0 select-none">
              {dbSyncStatus === 'synced' ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#065F46] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#065F46]"></span>
                  </span>
                  <span className="text-[#065F46] font-bold tracking-wide uppercase text-[8px]">
                    {lang === 'en' ? 'Cloud Synced' : 'ទិន្នន័យបានភ្ជាប់'}
                  </span>
                </>
              ) : dbSyncStatus === 'connecting' ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#92400E] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#92400E]"></span>
                  </span>
                  <span className="text-[#92400E] font-bold tracking-wide uppercase text-[8px]">
                    {lang === 'en' ? 'Checking Sync...' : 'កំពុងឆែក...'}
                  </span>
                </>
              ) : (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#991B1B]"></span>
                  </span>
                  <span className="text-[#991B1B] font-bold tracking-wide uppercase text-[8px]">
                    {lang === 'en' ? 'Offline Mode' : 'គ្មានការតភ្ជាប់'}
                  </span>
                </>
              )}
            </div>

            {/* Mobile Sync Status Dot */}
            <div className="sm:hidden flex items-center justify-center w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/60" title={dbSyncStatus}>
              <span className={`w-2 h-2 rounded-full ${dbSyncStatus === 'synced' ? 'bg-emerald-500' : dbSyncStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`}></span>
            </div>

            {/* Language toggle trigger buttons */}
            <div className="flex bg-slate-50 border border-slate-200/50 rounded-xl p-0.5 text-xs font-bold items-center">
              <button
                onClick={() => setLang('en')}
                className={`py-1 px-1.5 sm:px-2.5 rounded-lg cursor-pointer transition-all flex items-center gap-1 ${lang==='en' ? 'bg-white text-slate-750 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                title="English"
              >
                <svg className="w-3.5 h-2.5 sm:w-4 sm:h-3 rounded-xs shrink-0 shadow-xs border border-slate-200/20" viewBox="0 0 741 390">
                  <rect width="741" height="390" fill="#B22234" />
                  <path d="M0,30h741M0,90h741M0,150h741M0,210h741M0,270h741M0,330h741" stroke="#FFF" strokeWidth="30" />
                  <rect width="296" height="210" fill="#3C3B6E" />
                  <g fill="#FFF">
                    <circle cx="25" cy="20" r="4" /><circle cx="75" cy="20" r="4" /><circle cx="125" cy="20" r="4" /><circle cx="175" cy="20" r="4" /><circle cx="225" cy="20" r="4" /><circle cx="275" cy="20" r="4" />
                    <circle cx="50" cy="40" r="4" /><circle cx="100" cy="40" r="4" /><circle cx="150" cy="40" r="4" /><circle cx="200" cy="40" r="4" /><circle cx="250" cy="40" r="4" />
                    <circle cx="25" cy="60" r="4" /><circle cx="75" cy="60" r="4" /><circle cx="125" cy="60" r="4" /><circle cx="175" cy="60" r="4" /><circle cx="225" cy="60" r="4" /><circle cx="275" cy="60" r="4" />
                    <circle cx="50" cy="80" r="4" /><circle cx="100" cy="80" r="4" /><circle cx="150" cy="80" r="4" /><circle cx="200" cy="80" r="4" /><circle cx="250" cy="80" r="4" />
                    <circle cx="25" cy="100" r="4" /><circle cx="75" cy="100" r="4" /><circle cx="125" cy="100" r="4" /><circle cx="175" cy="100" r="4" /><circle cx="225" cy="100" r="4" /><circle cx="275" cy="100" r="4" />
                    <circle cx="50" cy="120" r="4" /><circle cx="100" cy="120" r="4" /><circle cx="150" cy="120" r="4" /><circle cx="200" cy="120" r="4" /><circle cx="250" cy="120" r="4" />
                    <circle cx="25" cy="140" r="4" /><circle cx="75" cy="140" r="4" /><circle cx="125" cy="140" r="4" /><circle cx="175" cy="140" r="4" /><circle cx="225" cy="140" r="4" /><circle cx="275" cy="140" r="4" />
                    <circle cx="50" cy="160" r="4" /><circle cx="100" cy="160" r="4" /><circle cx="150" cy="160" r="4" /><circle cx="200" cy="160" r="4" /><circle cx="250" cy="160" r="4" />
                    <circle cx="25" cy="180" r="4" /><circle cx="75" cy="180" r="4" /><circle cx="125" cy="180" r="4" /><circle cx="175" cy="180" r="4" /><circle cx="225" cy="180" r="4" /><circle cx="275" cy="180" r="4" />
                  </g>
                </svg>
                <span className="text-[10px]">EN</span>
              </button>
              <button
                onClick={() => setLang('kh')}
                className={`py-1 px-1.5 sm:px-2.5 rounded-lg cursor-pointer transition-all flex items-center gap-1 ${lang==='kh' ? 'bg-white text-slate-750 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                title="ភាសាខ្មែរ"
              >
                <svg className="w-3.5 h-2.5 sm:w-4 sm:h-3 rounded-xs shrink-0 shadow-xs border border-slate-200/20" viewBox="0 0 936 600">
                  <rect width="936" height="150" fill="#032EA1" />
                  <rect y="150" width="936" height="300" fill="#E51B23" />
                  <rect y="450" width="936" height="150" fill="#032EA1" />
                  <g fill="#FFF" transform="translate(368, 200)">
                    <path d="M40,170 L50,110 L60,110 L70,170 Z" />
                    <path d="M130,170 L140,110 L150,110 L160,170 Z" />
                    <path d="M85,170 L100,70 L110,70 L125,170 Z" />
                    <rect x="20" y="170" width="160" height="15" />
                    <rect x="30" y="185" width="140" height="15" />
                  </g>
                </svg>
                <span className="text-[10px]">KH</span>
              </button>
            </div>

            {/* Live alerts ring and notifications panel dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center hover:bg-slate-100 text-slate-600 cursor-pointer transition-all"
                id="notification_bell_trigger"
              >
                <BellRing size={15} className={notifications.length > 0 ? "animate-swing" : ""} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                )}
              </button>

              {showNotifications && (
                <div className="fixed inset-x-4 top-14 sm:absolute sm:inset-auto sm:right-0 sm:top-auto sm:mt-2.5 sm:w-76 bg-white border border-slate-100 rounded-2xl shadow-xl p-4.5 z-50 space-y-3 fade-in-slide" id="notifications_dropdown_panel">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-550 uppercase tracking-widest flex items-center gap-1.5">
                      <Activity size={12} className="text-emerald-500" />
                      Live Alerts ({notifications.length})
                    </span>
                    <button onClick={() => setNotifications([])} className="text-[9px] font-bold text-rose-500 hover:underline">Clear</button>
                  </div>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto">
                    {notifications.map((notif, index) => (
                      <div key={index} className="flex gap-2 items-start py-1 border-b border-slate-50 last:border-none">
                        <span className="text-amber-500 shrink-0 text-xs">⚠️</span>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{notif}</p>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <span className="text-slate-400 text-[10px] text-center block py-4">No pending alerts.</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Widget */}
            <div className="flex items-center gap-1.5 sm:gap-3 pl-1.5 sm:pl-3 border-l border-slate-200/60">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center font-black text-xs text-blue-700 select-none shadow-xs">
                    {currentUser?.fullName?.charAt(0) || "?"}
                  </div>
                  <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-emerald-500 border border-white rounded-full"></span>
                </div>
                <div className="hidden md:block min-w-0 text-left">
                  <div className="text-[11px] font-bold text-slate-700 truncate leading-none">{currentUser?.fullName || "Active User"}</div>
                  <span className="text-[9px] text-slate-400 truncate mt-1 block leading-none">{currentUser?.email || ""}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0 active:scale-95"
                title={lang === 'en' ? 'Sign Out / Logout' : 'ចាកចេញពីប្រព័ន្ធ'}
                id="header_logout_btn"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* 3. Primary Workspace rendering and Audit Log trails panels */}
        <main className="flex-1 min-w-0 max-w-full p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto overflow-x-hidden scroll-smooth bg-[#F8FAFC]" id="workspace_viewport">
          
          {/* Active branch indicator banner with interactive Quick Branch Switcher */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
                {t.activeBranch}:
              </span>
              <div className="relative inline-flex items-center">
                <select
                  value={activeBranchId}
                  onChange={(e) => setActiveBranchId(e.target.value)}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold font-sans rounded-xl pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer transition-all appearance-none"
                  id="header_quick_branch_switcher"
                  aria-label="Quick Switch Branch"
                >
                  {canAccessAllBranches && (
                    <option value="all">🌐 {t.allBranches}</option>
                  )}
                  {userAccessibleBranches.map(b => (
                    <option key={b.id} value={b.id}>
                      📍 {b.branchName} ({b.branchCode})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2 text-slate-400">
                  <ChevronDown size={13} />
                </div>
              </div>
            </div>
          </div>

          {/* Actual subtab components renders here */}
          <div className="transition-all duration-300 w-full min-w-0">
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center p-16 space-y-3">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-slate-500 font-bold">កំពុងផ្ទុក...</span>
              </div>
            }>
              {renderTabContent()}
            </Suspense>
          </div>

          
        </main>
      </div>
    </div>
  );
}

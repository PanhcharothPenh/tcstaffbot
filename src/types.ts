/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'Owner' | 'Admin' | 'Manager' | 'Staff';

export type ActiveTab =
  | 'dashboard'
  | 'branches'
  | 'staff'
  | 'shifts'
  | 'salary'
  | 'telegram_config'
  | 'attendance'
  | 'income'
  | 'expense'
  | 'inventory'
  | 'reports'
  | 'users'
  | 'settings'
  | 'coins'
  | 'revenues'
  | 'gas'
  | 'detergents'
  | 'softeners'
  | 'stock'
  | 'suppliers'
  | 'debts'
  | 'cashdrawer'
  | 'monthclosing'
  | 'auditlogs';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  roleId?: string;
  assignedBranchIds: string[]; // Owner has empty or all access
  status: 'Active' | 'Inactive' | 'Locked';
  phone?: string;
  forcePasswordChange?: boolean;
  telegramUsername?: string;
  telegramChatId?: string;
  twoFactorMethod?: 'disabled' | 'telegram';
}

export interface Permission {
  id: string;
  module: string;
  action: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface LoginHistoryLog {
  id: string;
  userId?: string;
  username: string;
  timestamp: string;
  ipAddress: string;
  device: string;
  status: string;
}

export interface Branch {
  id: string;
  branchCode: string;
  branchName: string;
  address: string;
  phone: string;
  managerId: string;
  managerName: string;
  openingTime: string;
  closingTime: string;
  status: 'Active' | 'Inactive';
  latitude?: number;
  longitude?: number;
  allowedRadius?: number; // e.g. 100 meters
  locationVerificationEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: string;
  branchId: string;
  fullName: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string;
  phone: string;
  address: string;
  position: string;
  shift: 'Morning' | 'Afternoon' | 'Night' | 'Full Time';
  startDate: string;
  resignationDate?: string;
  baseSalary: number;
  status: 'Active' | 'Resigned' | 'Suspended';
  photoUrl: string;
  idCardNumber: string;
  emergencyContact: string;
  telegramId?: string;
  telegramUsername?: string;
  telegramLinked?: boolean;
  faceReference?: string; // Stored facial biometric vector/template
  faceEnrolled?: boolean;
  faceEnrolledAt?: string;
  attendanceEnabled?: boolean;
  assignedBranchId?: string;
}

export interface SalarySchedule {
  id: string;
  branchId: string;
  paymentFrequency: 'Once' | 'Twice';
  paymentDay1: number;
  paymentDay2?: number;
  isActive: boolean;
}

export interface SalaryAdvance {
  id: string;
  branchId: string;
  staffId: string;
  amount: number;
  requestDate: string;
  approvedBy?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
  reason: string;
  notes?: string;
  createdAt: string;
}

export interface Salary {
  id: string;
  branchId: string;
  staffId: string;
  staffName: string;
  salaryPeriod: string; // e.g. "June 2026", "June 1-15 2026"
  baseSalary: number;
  overtime: number;
  bonus: number;
  deduction: number;
  advancePayment: number;
  netSalary: number;
  paymentDate: string;
  paymentMethod: 'Cash' | 'ABA' | 'Bank Transfer' | 'QR Payment';
  paidBy: string;
  note: string;
  status: 'Paid' | 'Unpaid';
  monthlyBaseSalary?: number;
  daysWorked?: number;
  leaveDays?: number;
  leaveDates?: string[];
  extraShiftAmount?: number;
  extraShiftCount?: number;
  staffExpenseAmount?: number;
}

export interface ExtraShift {
  id: string;
  branchId: string;
  staffId: string;
  staffName: string;
  date: string;
  shift: 'Morning' | 'Afternoon' | 'Night' | 'Full Time';
  shiftCount: number;
  ratePerShift: number; // default 6
  totalAmount: number; // shiftCount * ratePerShift
  coveredForStaffId?: string;
  coveredForStaffName?: string;
  note?: string;
  status?: 'Pending' | 'Paid';
  createdAt: string;
}

export interface TempShiftCover {
  id: string;
  branchId: string;
  name: string;
  phone?: string;
  date: string;
  shift: 'Morning' | 'Afternoon' | 'Night' | 'Full Time';
  shiftCount: number;
  ratePerShift: number; // default 6
  totalAmount: number; // shiftCount * ratePerShift
  note?: string;
  status: 'Unpaid' | 'Paid'; // មិនទាន់បង់ / បានបង់រួច
  paymentDate?: string;
  paymentMethod?: string;
  createdAt: string;
}

export interface StaffExpense {
  id: string;
  branchId: string;
  staffId: string;
  staffName: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  receiptUrl?: string;
  note?: string;
  repaymentMethod: 'Payroll' | 'Separate'; // 'សងជាមួយប្រាក់ខែ' | 'សងដោយឡែក'
  status: 'Pending' | 'Paid'; // 'មិនទាន់សង' | 'បានសងរួច'
  paidDate?: string;
  createdAt: string;
}

export interface AttendanceAuditLog {
  field: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

export interface Attendance {
  id: string;
  branchId: string;
  staffId: string;
  staffName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  shiftType: string;
  workHours: number;
  overtimeHours: number;
  status: 'Present' | 'Working' | 'Completed' | 'Late' | 'Absent' | 'Missing Check-Out' | 'Manual' | 'Day Off';
  source?: 'telegram' | 'manual' | 'web';
  checkInPhoto?: string;
  checkOutPhoto?: string;
  checkInFaceScore?: number;
  checkOutFaceScore?: number;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkInDistance?: number;
  checkOutDistance?: number;
  auditHistory?: AttendanceAuditLog[];
  createdAt?: string;
  updatedAt?: string;
}

export type LaundryServiceType = 'Washing' | 'Drying' | 'Washing + Drying' | 'Other';

export interface Income {
  id: string;
  branchId: string;
  date: string;
  serviceType: LaundryServiceType;
  machineNumber: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalAmount: number;
  paymentMethod: 'Cash' | 'ABA' | 'Bank Transfer' | 'QR Payment';
  staffInCharge: string;
  customerNote: string;
}

export type ExpenseCategory =
  | 'Water Bill'
  | 'Electricity Bill'
  | 'Gas'
  | 'Land Rent'
  | 'Land Tax'
  | 'Soap'
  | 'Fabric Softener'
  | 'Repair and Maintenance'
  | 'Staff Meal'
  | 'Internet'
  | 'Cleaning Supplies'
  | 'Marketing'
  | 'Other Expense';

export interface Expense {
  id: string;
  branchId: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: 'Cash' | 'ABA' | 'Bank Transfer' | 'QR Payment';
  paidTo: string;
  receiptUrl: string;
  createdBy: string;
  note: string;
}

export type InventoryCategory =
  | 'Soap'
  | 'Fabric Softener'
  | 'Plastic Bag'
  | 'Basket'
  | 'Cleaning Supplies'
  | 'Other Supplies';

export interface InventoryItem {
  id: string;
  branchId: string;
  itemName: string;
  category: InventoryCategory;
  unit: string; // e.g., "kg", "pcs", "bottle"
  currentStock: number;
  minimumStockAlert: number;
  purchasePrice: number;
  supplier: string;
  purchaseDate: string;
  usedQuantity: number;
  remainingStock: number;
}

export interface InventoryTransaction {
  id: string;
  branchId: string;
  itemId: string;
  itemName: string;
  type: 'In' | 'Out';
  quantity: number;
  date: string;
  note: string;
}

export interface Machine {
  id: string;
  branchId: string;
  machineId: string; // SKU code
  machineType: 'Washer' | 'Dryer';
  machineNumber: string;
  brand: string;
  capacity: number; // e.g., 9, 12, 15 (in kg)
  status: 'Available' | 'In Use' | 'Maintenance' | 'Broken';
  purchaseDate: string;
  maintenanceNote: string;
  revenue: number; // calculated revenue for tracking
}

export interface MachineMaintenance {
  id: string;
  branchId: string;
  machineId: string;
  date: string;
  description: string;
  cost: number;
  repairedBy: string;
}

export interface AppSettings {
  shopName: string;
  openingHours: string;
  mainCurrency: 'USD' | 'KHR';
  khmerExchangeRate: number; // e.g., 4100
  language: 'kh' | 'en';
  darkMode: boolean;
  expenseCategories: string[];
  incomeCategories: string[];
  paymentMethods: string[];
}

export interface CoinTransaction {
  id: string;
  branchId: string;
  date: string;
  amount: number; // coin amount or count
  valueUsd: number; // calculated USD value
  type: 'In' | 'Out';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  note: string;
}

export interface RevenueRecord {
  id: string;
  branchId: string;
  date: string;
  amountUsd: number;
  amountKhr: number;
  paymentMethod: 'Cash' | 'ABA' | 'Bank Transfer' | 'QR Payment';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  note: string;
  // Clean24 Revenue Sheet fields
  time?: string;
  startCounter?: number;
  endCounter?: number;
  startCounterAba?: number;
  endCounterAba?: number;
  counterRevenue?: number;
  cash?: number;
  aba?: number;
  coinCount?: number;
  coinSales?: number;
  dailyRevenue?: number;
  bankDeposit?: number;
  remainingCash?: number;
  actualCashCount?: number;
  difference?: number;
  status?: 'Draft' | 'Submitted' | 'Approved' | 'Closed';
  attachments?: {
    revenueSheetPhoto?: string;
    depositSlip?: string;
    abaScreenshot?: string;
    bankReceipt?: string;
  };
}

export interface GasRecord {
  id: string;
  branchId: string;
  date: string;
  tankCount: number;
  remainingKg: number; // remaining gas
  type: 'Refill' | 'Use';
  cost: number; // 0 if type is 'Use'
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  note: string;
}

export interface DetergentRecord {
  id: string;
  branchId: string;
  date: string;
  quantityLiters: number;
  remainingLiters: number; // detergent remaining
  type: 'Refill' | 'Use';
  cost: number; // 0 if type is 'Use'
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  note: string;
  powder?: number;
  soap?: number;
  cleaner?: number;
  total?: number;
  inQty?: number;
  outQty?: number;
}

export interface SoftenerRecord {
  id: string;
  branchId: string;
  date: string;
  quantityLiters: number;
  remainingLiters: number; // softener remaining
  type: 'Refill' | 'Use';
  cost: number; // 0 if type is 'Use'
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  note: string;
  supplier?: string;
  productName?: string;
  caseQuantity?: number;
  packageQuantity?: number;
  usageQuantity?: number;
  unitCost?: number;
  totalCost?: number;
  remainingStock?: number;
  inQty?: number;
  outQty?: number;
  comfort?: number;
  ora?: number;
  siusip?: number;
  total?: number;
}

export interface StockTransaction {
  id: string;
  branchId: string;
  date: string;
  itemId: string;
  itemName: string;
  quantity: number;
  currentStock: number;
  type: 'In' | 'Use' | 'Out';
  cost: number; // 0 if type is 'Out' or 'Use'
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  note: string;
}

export interface Supplier {
  id: string;
  branchId: string;
  name: string;
  phone: string;
  address: string;
  contactPerson: string;
  goodsSupplied: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayment {
  id: string;
  branchId: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'Cash' | 'ABA' | 'Bank Transfer' | 'QR Payment';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  note: string;
}

export interface Debt {
  id: string;
  branchId: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  description: string;
  dueDate: string;
  status: 'Unpaid' | 'Partial' | 'Paid';
  remainingBalance: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtPayment {
  id: string;
  branchId: string;
  debtId: string;
  supplierName: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: 'Cash' | 'ABA' | 'Bank Transfer' | 'QR Payment';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  note: string;
}

export interface CashDrawer {
  id: string;
  branchId: string;
  status: 'Open' | 'Closed';
  startingCash: number;
  endingCash: number;
  actualCash: number;
  difference: number; // actualCash - expectedCash (difference surplus/deficit)
  reconciled: boolean;
  openedBy: string;
  closedBy: string;
  openedAt: string;
  closedAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashDrawerTransaction {
  id: string;
  branchId: string;
  drawerId: string;
  type: 'In' | 'Out';
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthClosing {
  id: string;
  branchId: string;
  month: string; // "YYYY-MM"
  totalRevenue: number;
  totalExpenses: number;
  depreciationSavings: number; // custom depreciation calculations of washers and dryers
  netIncome: number;
  coinAuditMatches: boolean;
  abaAuditMatches: boolean;
  closedBy: string;
  closedAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: 'Draft' | 'Locked';
  note: string;
}


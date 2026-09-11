/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  Branch,
  Staff,
  Salary,
  Attendance,
  Income,
  Expense,
  InventoryItem,
  Machine,
  AppSettings,
  InventoryTransaction,
  MachineMaintenance,
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

// Translation Dictionary for English and Khmer
export const translations = {
  en: {
    dashboard: "Dashboard",
    multiBranch: "Branches",
    staff: "Staff Management",
    salary: "Salary Management",
    attendance: "Attendance",
    income: "Daily Incomes",
    expense: "Expenses",
    inventory: "Inventory & Supplies",
    machine: "Machine Status",
    reports: "Analytical Reports",
    settings: "Settings",
    rolePermissions: "Roles & Security",
    
    // Stats
    todayIncome: "Today's Income",
    todayExpense: "Today's Expense",
    todayProfit: "Today's Profit",
    monthlyIncome: "Monthly Income",
    monthlyExpense: "Monthly Expense",
    monthlyProfit: "Monthly Profit",
    yearlyIncome: "Yearly Income",
    yearlyExpense: "Yearly Expense",
    yearlyProfit: "Yearly Profit",
    salaryExpense: "Salary Expense",
    utilityExpense: "Utility Expense",
    supplyExpense: "Supply Expense",
    profitRange: "P&L Summary",
    lowStockAlert: "Low Stock Alert",
    salaryReminder: "Salary Payment Reminder",
    machineMaintenanceReminder: "Machine Maintenance Due",
    unpaidTransactions: "Unpaid Transactions",
    
    // General terms
    activeBranch: "Active Branch",
    allBranches: "All Branches (Consolidated)",
    branchSelector: "Select Branch",
    addNews: "Create New",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    actions: "Actions",
    search: "Search...",
    print: "Print",
    exportExcel: "Export Excel",
    exportPDF: "Export PDF",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    currency: "Currency",
    exchangeRate: "Exchange Rate",
    totalAmount: "Total Amount",
    paymentMethod: "Payment Method",
    note: "Note",
    date: "Date",
    quantity: "Quantity",
    unitPrice: "Unit Price",
    discount: "Discount",
    
    // Multi branch labels
    branchCode: "Branch Code",
    branchName: "Branch Name",
    branchAddress: "Branch Address",
    branchPhone: "Branch Phone",
    branchManager: "Branch Manager",
    openingHours: "Opening Hours",
    bestPerforming: "Best Performing Branch",
    branchRanking: "Branch Performance Ranking",
    compareIncome: "Income Comparison",
    compareExpense: "Expense Comparison",
    compareProfit: "Profit Comparison",
    
    // Staff metrics
    staffId: "Staff ID",
    fullName: "Full Name",
    gender: "Gender",
    dob: "Date of Birth",
    phone: "Phone Number",
    address: "Address",
    position: "Position",
    shift: "Shift Type",
    startDate: "Start Date",
    baseSalary: "Base Salary",
    idCard: "ID Card Number",
    emergency: "Emergency Contact",
    photo: "Profile Photo",
    resigned: "Resigned",
    suspended: "Suspended",
    
    // Salary metrics
    salaryPeriod: "Salary Period",
    overtime: "Overtime (OT)",
    bonus: "Bonus",
    deduction: "Deductions",
    advance: "Advance Payment",
    netSalary: "Net Salary",
    paymentDate: "Payment Date",
    paidBy: "Paid By",
    paid: "Paid",
    unpaid: "Unpaid",
    customPeriod: "Custom Period",
    
    // Attendance
    checkIn: "Check In",
    checkOut: "Check Out",
    workHours: "Work Hours",
    overtimeHours: "OT Hours",
    present: "Present",
    absent: "Absent",
    late: "Late",
    dayOff: "Day Off",
    
    // Machine list
    machineId: "Machine ID",
    machineType: "Machine Type",
    machineNumber: "Machine No.",
    brand: "Brand",
    capacity: "Capacity (kg)",
    available: "Available",
    inUse: "In Use",
    maintenance: "Maintenance",
    broken: "Broken",
    maintenanceHistory: "Maintenance History",
    revenueByMachine: "Revenue by Machine",
    washer: "Washer",
    dryer: "Dryer",
    
    // Inventory
    itemName: "Item Name",
    category: "Category",
    unit: "Unit",
    currentStock: "Current Stock",
    minStock: "Min Alert Level",
    purchasePrice: "Purchase Price",
    supplier: "Supplier",
    remainingStock: "Remaining Stock",
    stockIn: "Stock In (+)",
    stockOut: "Stock Out (-)",
    
    // Reports list
    dailyIncomeRep: "Daily Income Report",
    monthlyIncomeRep: "Monthly Income Report",
    yearlyIncomeRep: "Yearly Income Report",
    dailyExpenseRep: "Daily Expense Report",
    monthlyExpenseRep: "Monthly Expense Report",
    yearlyExpenseRep: "Yearly Expense Report",
    salaryRep: "Salary Payroll Report",
    staffRep: "Staff Directory Report",
    attendanceRep: "Attendance Log Report",
    inventoryRep: "Inventory Stock Report",
    paymentRep: "Payment Reconciliation Report",
    machineRevenueRep: "Machine Revenue Report",
    profitLossRep: "Profit & Loss (P&L) Report",
    branchCompareRep: "Branch Comparison Report",
    
    // Settings
    shopInfo: "Shop Information",
    backupRestore: "Backup & Restore Data",
    backupSuccess: "Database backup created successfully! Download started.",
    restoreSuccess: "Database restored successfully!",
    khmerFont: "Khmer Font Support Active",
    
    // User credentials
    roleOwner: "Owner (All Branches)",
    roleAdmin: "Admin (Assigned Branches)",
    roleManager: "Manager (One Branch)",
    roleStaff: "Staff (Add Income Only)",
    currentUserLabel: "Active User Role",
    warningRoleLimit: "This module is locked for your current role due to data access security policies."
  },
  kh: {
    dashboard: "ផ្ទាំងព័ត៌មាន",
    multiBranch: "ការគ្រប់គ្រងសាខា",
    staff: "បុគ្គលិក",
    salary: "ការបើកប្រាក់បៀវត្សរ៍",
    attendance: "វត្តមានបុគ្គលិក",
    income: "ចំណូលប្រចាំថ្ងៃ",
    expense: "ចំណាយនានា",
    inventory: "ស្តុក និងការផ្គត់ផ្គង់",
    machine: "ស្ថានភាពម៉ាស៊ីន",
    reports: "របាយការណ៍វិភាគ",
    settings: "ការកំណត់",
    rolePermissions: "សិទ្ធិ និងសុវត្ថិភាព",
    
    // Stats
    todayIncome: "ចំណូលថ្ងៃនេះ",
    todayExpense: "ចំណាយថ្ងៃនេះ",
    todayProfit: "ប្រាក់ចំណេញថ្ងៃនេះ",
    monthlyIncome: "ចំណូលខែនេះ",
    monthlyExpense: "ចំណាយខែនេះ",
    monthlyProfit: "ប្រាក់ចំណេញខែនេះ",
    yearlyIncome: "ចំណូលឆ្នាំនេះ",
    yearlyExpense: "ចំណាយឆ្នាំនេះ",
    yearlyProfit: "ប្រាក់ចំណេញឆ្នាំនេះ",
    salaryExpense: "ចំណាយប្រាក់ខែបុគ្គលិក",
    utilityExpense: "ចំណាយទឹកភ្លើង",
    supplyExpense: "ចំណាយសាប៊ូ/ទឹកក្រអូប",
    profitRange: "តារាងចំណូលចំណាយ",
    lowStockAlert: "ការដាស់តឿនស្តុកទាប",
    salaryReminder: "រំលឹកការបើកប្រាក់ខែ",
    machineMaintenanceReminder: "ម៉ាស៊ីនដល់ពេលថែទាំ",
    unpaidTransactions: "ប្រតិបត្តិការមិនទាន់ទូទាត់",
    
    // General terms
    activeBranch: "សាខាសកម្ម",
    allBranches: "សាខាទាំងអស់ (រួមបញ្ចូលគ្នា)",
    branchSelector: "ជ្រើសរើសសាខា",
    addNews: "បង្កើតថ្មី",
    edit: "កែសម្រួល",
    delete: "លុប",
    save: "រក្សាទុក",
    cancel: "បោះបង់",
    actions: "សកម្មភាព",
    search: "ស្វែងរក...",
    print: "បោះពុម្ព",
    exportExcel: "ទាញយកជា Excel",
    exportPDF: "ទាញយកជា PDF",
    status: "ស្ថានភាព",
    active: "ដំណើរការ",
    inactive: "ផ្អាកដំណើរការ",
    currency: "រូបិយប័ណ្ណ",
    exchangeRate: "អត្រាប្តូរប្រាក់",
    totalAmount: "ទឹកប្រាក់សរុប",
    paymentMethod: "វិធីសាស្ត្រទូទាត់",
    note: "កំណត់ចំណាំ",
    date: "កាលបរិច្ឆេទ",
    quantity: "ចំនួន",
    unitPrice: "តម្លៃរាយ",
    discount: "បញ្ចុះតម្លៃ",
    
    // Multi branch labels
    branchCode: "កូដសាខា",
    branchName: "ឈ្មោះសាខា",
    branchAddress: "អាសយដ្ឋានសាខា",
    branchPhone: "លេខទូរស័ព្ទសាខា",
    branchManager: "អ្នកគ្រប់គ្រងសាខា",
    openingHours: "ម៉ោងបើកទ្វារ",
    bestPerforming: "សាខាដំណើរការល្អបំផុត",
    branchRanking: "ចំណាត់ថ្នាក់របស់សាខា",
    compareIncome: "ប្រៀបធៀបចំណូល",
    compareExpense: "ប្រៀបធៀបចំណាយ",
    compareProfit: "ប្រៀបធៀបប្រាក់ចំណេញ",
    
    // Staff metrics
    staffId: "អត្តសញ្ញាណប័ណ្ណបុគ្គលិក",
    fullName: "ឈ្មោះពេញ",
    gender: "ភេទ",
    dob: "ថ្ងៃខែឆ្នាំកំណើត",
    phone: "លេខទូរស័ព្ទ",
    address: "អាសយដ្ឋាន",
    position: "តួនាទី",
    shift: "វេនការងារ",
    startDate: "ថ្ងៃចូលបម្រើការងារ",
    baseSalary: "ប្រាក់ខែគោល",
    idCard: "លេខអត្តសញ្ញាណប័ណ្ណ",
    emergency: "ទំនាក់ទំនងបន្ទាន់",
    photo: "រូបថត",
    resigned: "លាឈប់",
    suspended: "ព្យួរការងារ",
    
    // Salary metrics
    salaryPeriod: "វដ្តបើកប្រាក់ខែ",
    overtime: "ថែមម៉ោង (OT)",
    bonus: "ប្រាក់លើកទឹកចិត្ត",
    deduction: "ការផាកពិន័យ/កាត់កង",
    advance: "បុរេប្រទាន/បើកមុន",
    netSalary: "ប្រាក់ខែសុទ្ធ",
    paymentDate: "ថ្ងៃបើកប្រាក់",
    paidBy: "បើកប្រាក់ដោយ",
    paid: "បានបើក",
    unpaid: "មិនទាន់បើក",
    customPeriod: "កាលកំណត់ផ្ទាល់ខ្លួន",
    
    // Attendance
    checkIn: "ម៉ោងចូល",
    checkOut: "ម៉ោងចេញ",
    workHours: "ម៉ោងធ្វើការសរុប",
    overtimeHours: "ម៉ោងថែមសរុប",
    present: "វត្តមាន",
    absent: "អវត្តមាន",
    late: "យឺត",
    dayOff: "ថ្ងៃសម្រាក",
    
    // Machine list
    machineId: "លេខកូដម៉ាស៊ីន",
    machineType: "ប្រភេទម៉ាស៊ីន",
    machineNumber: "លេខម៉ាស៊ីន",
    brand: "ម៉ាក",
    capacity: "ចំណុះ (គីឡូ)",
    available: "ទំនេរ",
    inUse: "កំពុងបោក/សមោ្ងត",
    maintenance: "កំពុងថែទាំ",
    broken: "ខូច",
    maintenanceHistory: "ប្រវត្តិនៃការថែទាំ",
    revenueByMachine: "ចំណូលតាមម៉ាស៊ីន",
    washer: "ម៉ាស៊ីនបោក",
    dryer: "ម៉ាស៊ីនសម្ងួត",
    
    // Inventory
    itemName: "ឈ្មោះមុខទំនិញ",
    category: "ប្រភេទ",
    unit: "ឯកតា",
    currentStock: "ស្តុកបច្ចុប្បន្ន",
    minStock: "កម្រិតដាស់តឿនស្តុក",
    purchasePrice: "តម្លៃទិញចូល",
    supplier: "អ្នកផ្គត់ផ្គង់",
    remainingStock: "ស្តុកនៅសល់",
    stockIn: "ទិញចូល (+)",
    stockOut: "ប្រើប្រាស់ (-)",
    
    // Reports list
    dailyIncomeRep: "របាយការណ៍ចំណូលប្រចាំថ្ងៃ",
    monthlyIncomeRep: "របាយការណ៍ចំណូលប្រចាំខែ",
    yearlyIncomeRep: "របាយការណ៍ចំណូលប្រចាំឆ្នាំ",
    dailyExpenseRep: "របាយការណ៍ចំណាយប្រចាំថ្ងៃ",
    monthlyExpenseRep: "របាយការណ៍ចំណាយប្រចាំខែ",
    yearlyExpenseRep: "របាយការណ៍ចំណាយប្រចាំឆ្នាំ",
    salaryRep: "របាយការណ៍ប្រាក់បៀវត្សរ៍",
    staffRep: "បញ្ជីឈ្មោះបុគ្គលិក",
    attendanceRep: "របាយការណ៍វត្តមាន",
    inventoryRep: "របាយការណ៍សន្និធិស្តុក",
    paymentRep: "របាយការណ៍ទូទាត់ការបង្វែរប្រាក់",
    machineRevenueRep: "របាយការណ៍ចំណូលតាមម៉ាស៊ីន",
    profitLossRep: "របាយការណ៍ចំណេញ និងខាត (P&L)",
    branchCompareRep: "របាយការណ៍ប្រៀបធៀបតាមសាខា",
    
    // Settings
    shopInfo: "ព័ត៌មានហាង",
    backupRestore: "ចម្លងទុកបំរុង & ស្ដារទិន្នន័យ",
    backupSuccess: "ការចម្លងទិ​ន្នន័យបំរុងបានជោគជ័យ! ការទាញយកបានចាប់ផ្ដើម។",
    restoreSuccess: "ការស្ដារទិន្នន័យត្រូវបានបញ្ចប់ដោយជោគជ័យ!",
    khmerFont: "ប្រើប្រាស់ពុម្ពអក្សរខ្មែរទំនើប",
    
    // User credentials
    roleOwner: "ម្ចាស់ហាង (មើលគ្រប់សាខា)",
    roleAdmin: "អតីតអភិបាល (មើលសាខាដែលចាត់តាំង)",
    roleManager: "អ្នកគ្រប់គ្រង (មើលតែសាខាខ្លួន)",
    roleStaff: "បុគ្គលិក (បញ្ចូលតែចំណូល)",
    currentUserLabel: "តួនាទីគណនីបច្ចុប្បន្ន",
    warningRoleLimit: "ទំព័រនេះត្រូវបានចាក់សោសម្រាប់តួនាទីបច្ចុប្បន្នរបស់អ្នក ដោយសារច្បាប់បំបែកទិន្នន័យសាខាយ៉ាងតឹងរ៉ឹង។"
  }
};

// Initial Production Users
export const initialUsers: User[] = [
  { id: 'usr_owner', username: 'roth', email: 'roth@p2bkh.tech', fullName: 'Roth (Executive Owner)', role: 'Owner', roleId: 'owner', assignedBranchIds: [], status: 'Active' },
  { id: 'usr_clean24', username: 'clean24vengsreng', email: 'clean24@tcstaff.com', fullName: 'Clean24 (Store Owner)', role: 'Owner', roleId: 'owner', assignedBranchIds: [], status: 'Active' }
];

// Initial Production Branches
export const initialBranches: Branch[] = [
  {
    id: 'b1',
    branchCode: 'TOTO-01',
    branchName: 'toto by Chichi',
    address: 'Phnom Penh, Cambodia',
    phone: '012 888 999',
    managerId: 'usr_admin',
    managerName: 'Admin',
    openingTime: '06:30 AM',
    closingTime: '09:30 PM',
    status: 'Active',
    latitude: 11.5300,
    longitude: 104.8800,
    allowedRadius: 100,
    locationVerificationEnabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'b2',
    branchCode: 'CORNER-02',
    branchName: 'Coffee corner',
    address: 'Phnom Penh, Cambodia',
    phone: '012 777 888',
    managerId: 'usr_admin',
    managerName: 'Admin',
    openingTime: '06:30 AM',
    closingTime: '09:30 PM',
    status: 'Active',
    latitude: 11.5400,
    longitude: 104.8900,
    allowedRadius: 100,
    locationVerificationEnabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  }
];

// Initial Staff Roster linked to branchIds
export const initialStaff: Staff[] = [];

// Initial Salaries Paid
export const initialSalaries: Salary[] = [];

// Initial Attendance Records
export const initialAttendance: Attendance[] = [];

// Initial Incomes
export const initialIncomes: Income[] = [];

// Initial Expenses
export const initialExpenses: Expense[] = [];

// Initial Inventory
export const initialInventory: InventoryItem[] = [];

// Initial Machines list
export const initialMachines: Machine[] = [];

// App Settings
export const initialSettings: AppSettings = {
  shopName: "TC Staff Management",
  openingHours: "6:30 AM – 9:30 PM",
  mainCurrency: "USD",
  khmerExchangeRate: 4000,
  language: "kh",
  darkMode: false,
  expenseCategories: [
    'Coffee Beans (គ្រាប់កាហ្វេ)',
    'Milk & Cream (ទឹកដោះគោ & ក្រែម)',
    'Syrups & Flavors (ស៊ីរ៉ូ)',
    'Ice & Drinking Water (ទឹកកក & ទឹកបរិសុទ្ធ)',
    'Cups, Lids & Straws (កែវ គម្រប ទុយោ)',
    'Bakery & Pastries (នំចំណី)',
    'Electricity & Water (ភ្លើង & ទឹក)',
    'Shop Rent (ជួលទីតាំង)',
    'Equipment Maintenance (ជួសជុលម៉ាស៊ីនកាហ្វេ)',
    'Other (ចំណាយផ្សេងៗ)'
  ],
  incomeCategories: [
    'Coffee & Espresso (កាហ្វេ)',
    'Milk Tea & Tea (តែ & តែទឹកដោះគោ)',
    'Frappe & Smoothies (ក្រឡុក & ហ្វ្រាប៉េ)',
    'Soda & Refreshers (សូដា & ភេសជ្ជៈស្រស់)',
    'Bakery & Pastries (នំ & នំបុ័ង)',
    'Other (ផ្សេងៗ)'
  ],
  paymentMethods: [
    'Cash',
    'ABA',
    'Bank Transfer',
    'QR Payment'
  ]
};

// Initial Coin Transactions
export const initialCoinTransactions: CoinTransaction[] = [];

// Initial Revenue Records
export const initialRevenueRecords: RevenueRecord[] = [];

// Initial Gas Records
export const initialGasRecords: GasRecord[] = [];

// Initial Detergent Records
export const initialDetergentRecords: DetergentRecord[] = [];

// Initial Softener Records
export const initialSoftenerRecords: SoftenerRecord[] = [];

// Initial Stock Transactions
export const initialStockTransactions: StockTransaction[] = [];

// Initial Suppliers
export const initialSuppliers: Supplier[] = [];

// Initial Supplier Debts
export const initialDebts: Debt[] = [];

// Initial Debt Payments
export const initialDebtPayments: DebtPayment[] = [];

// Initial Cash Drawers
export const initialCashDrawers: CashDrawer[] = [];

// Initial Cash Drawer Transactions
export const initialCashDrawerTransactions: CashDrawerTransaction[] = [];

// Initial Month Closings
export const initialMonthClosings: MonthClosing[] = [];

// Database local storage persistent helper functions
const STORAGE_PREFIX = "COFFEE_MGM_PROD_v1_";

function getStored<T>(key: string, initial: T): T {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : initial;
  } catch (e) {
    return initial;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {}
}

export const initialSalarySchedules: SalarySchedule[] = [];

export const initialSalaryAdvances: SalaryAdvance[] = [];

export const db = {
  getSalarySchedules: (): SalarySchedule[] => getStored('SALARY_SCHEDULES', initialSalarySchedules),
  saveSalarySchedules: (data: SalarySchedule[]) => setStored('SALARY_SCHEDULES', data),

  getSalaryAdvances: (): SalaryAdvance[] => getStored('SALARY_ADVANCES', initialSalaryAdvances),
  saveSalaryAdvances: (data: SalaryAdvance[]) => setStored('SALARY_ADVANCES', data),

  getBranches: (): Branch[] => getStored('BRANCHES', initialBranches),
  saveBranches: (data: Branch[]) => setStored('BRANCHES', data),
  
  getStaff: (): Staff[] => getStored('STAFF', initialStaff),
  saveStaff: (data: Staff[]) => setStored('STAFF', data),
  
  getSalaries: (): Salary[] => getStored('SALARIES', initialSalaries),
  saveSalaries: (data: Salary[]) => setStored('SALARIES', data),
  
  getAttendance: (): Attendance[] => getStored('ATTENDANCE', initialAttendance),
  saveAttendance: (data: Attendance[]) => setStored('ATTENDANCE', data),
  
  getIncomes: (): Income[] => getStored('INCOMES', initialIncomes),
  saveIncomes: (data: Income[]) => setStored('INCOMES', data),
  
  getExpenses: (): Expense[] => getStored('EXPENSES', initialExpenses),
  saveExpenses: (data: Expense[]) => setStored('EXPENSES', data),
  
  getInventory: (): InventoryItem[] => getStored('INVENTORY', initialInventory),
  saveInventory: (data: InventoryItem[]) => setStored('INVENTORY', data),
  
  getMachines: (): Machine[] => getStored('MACHINES', initialMachines),
  saveMachines: (data: Machine[]) => setStored('MACHINES', data),
  
  getSettings: (): AppSettings => getStored('SETTINGS', initialSettings),
  saveSettings: (data: AppSettings) => setStored('SETTINGS', data),
  
  getUsers: (): User[] => getStored('USERS', initialUsers),
  saveUsers: (data: User[]) => setStored('USERS', data),

  getCoinTransactions: (): CoinTransaction[] => getStored('COIN_TRANSACTIONS', initialCoinTransactions),
  saveCoinTransactions: (data: CoinTransaction[]) => setStored('COIN_TRANSACTIONS', data),

  getRevenueRecords: (): RevenueRecord[] => getStored('REVENUE_RECORDS', initialRevenueRecords),
  saveRevenueRecords: (data: RevenueRecord[]) => setStored('REVENUE_RECORDS', data),

  getGasRecords: (): GasRecord[] => getStored('GAS_RECORDS', initialGasRecords),
  saveGasRecords: (data: GasRecord[]) => setStored('GAS_RECORDS', data),

  getDetergentRecords: (): DetergentRecord[] => getStored('DETERGENT_RECORDS', initialDetergentRecords),
  saveDetergentRecords: (data: DetergentRecord[]) => setStored('DETERGENT_RECORDS', data),

  getSoftenerRecords: (): SoftenerRecord[] => getStored('SOFTENER_RECORDS', initialSoftenerRecords),
  saveSoftenerRecords: (data: SoftenerRecord[]) => setStored('SOFTENER_RECORDS', data),

  getStockTransactions: (): StockTransaction[] => getStored('STOCK_TRANSACTIONS', initialStockTransactions),
  saveStockTransactions: (data: StockTransaction[]) => setStored('STOCK_TRANSACTIONS', data),

  getSuppliers: (): Supplier[] => getStored('SUPPLIERS', initialSuppliers),
  saveSuppliers: (data: Supplier[]) => setStored('SUPPLIERS', data),

  getDebts: (): Debt[] => getStored('DEBTS', initialDebts),
  saveDebts: (data: Debt[]) => setStored('DEBTS', data),

  getDebtPayments: (): DebtPayment[] => getStored('DEBT_PAYMENTS', initialDebtPayments),
  saveDebtPayments: (data: DebtPayment[]) => setStored('DEBT_PAYMENTS', data),

  getCashDrawers: (): CashDrawer[] => getStored('CASH_DRAWERS', initialCashDrawers),
  saveCashDrawers: (data: CashDrawer[]) => setStored('CASH_DRAWERS', data),

  getCashDrawerTransactions: (): CashDrawerTransaction[] => getStored('CASH_DRAWER_TRANSACTIONS', initialCashDrawerTransactions),
  saveCashDrawerTransactions: (data: CashDrawerTransaction[]) => setStored('CASH_DRAWER_TRANSACTIONS', data),

  getMonthClosings: (): MonthClosing[] => getStored('MONTH_CLOSINGS', initialMonthClosings),
  saveMonthClosings: (data: MonthClosing[]) => setStored('MONTH_CLOSINGS', data),
  
  getAuditLogs: (): string[] => getStored('AUDIT_LOGS', []),
  saveAuditLogs: (logs: string[]) => setStored('AUDIT_LOGS', logs),
  
  addAuditLog: (message: string) => {
    const logs = db.getAuditLogs();
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    logs.unshift(`${timestamp}: ${message}`);
    db.saveAuditLogs(logs.slice(0, 100)); // limit 100 most recent
  },

  resetDatabase: () => {
    localStorage.removeItem(STORAGE_PREFIX + 'BRANCHES');
    localStorage.removeItem(STORAGE_PREFIX + 'STAFF');
    localStorage.removeItem(STORAGE_PREFIX + 'SALARIES');
    localStorage.removeItem(STORAGE_PREFIX + 'ATTENDANCE');
    localStorage.removeItem(STORAGE_PREFIX + 'INCOMES');
    localStorage.removeItem(STORAGE_PREFIX + 'EXPENSES');
    localStorage.removeItem(STORAGE_PREFIX + 'INVENTORY');
    localStorage.removeItem(STORAGE_PREFIX + 'MACHINES');
    localStorage.removeItem(STORAGE_PREFIX + 'SETTINGS');
    localStorage.removeItem(STORAGE_PREFIX + 'USERS');
    localStorage.removeItem(STORAGE_PREFIX + 'COIN_TRANSACTIONS');
    localStorage.removeItem(STORAGE_PREFIX + 'REVENUE_RECORDS');
    localStorage.removeItem(STORAGE_PREFIX + 'GAS_RECORDS');
    localStorage.removeItem(STORAGE_PREFIX + 'DETERGENT_RECORDS');
    localStorage.removeItem(STORAGE_PREFIX + 'SOFTENER_RECORDS');
    localStorage.removeItem(STORAGE_PREFIX + 'STOCK_TRANSACTIONS');
    localStorage.removeItem(STORAGE_PREFIX + 'SUPPLIERS');
    localStorage.removeItem(STORAGE_PREFIX + 'DEBTS');
    localStorage.removeItem(STORAGE_PREFIX + 'DEBT_PAYMENTS');
    localStorage.removeItem(STORAGE_PREFIX + 'CASH_DRAWERS');
    localStorage.removeItem(STORAGE_PREFIX + 'CASH_DRAWER_TRANSACTIONS');
    localStorage.removeItem(STORAGE_PREFIX + 'MONTH_CLOSINGS');
    localStorage.removeItem(STORAGE_PREFIX + 'AUDIT_LOGS');
    window.location.reload();
  }
};

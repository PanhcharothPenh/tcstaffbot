/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Staff, SalaryAdvance, Salary } from '../types';

export interface OvertimeLog {
  id: string;
  empId: string;
  days: number;
  multiplier: number;
  shift: 'day' | 'night';
  startDate: string;
  endDate: string;
  note: string;
  amount: number;
}

export interface DailyExpense {
  id: string;
  date: string;
  empId: string;
  amount: number;
  note: string;
}

export const khmerPayrollTranslations: Record<string, Record<string, string>> = {
  kh: {
    'app-title': 'ប្រព័ន្ធគ្រប់គ្រង និងគណនាប្រាក់ខែបុគ្គលិក',
    'app-subtitle': 'គ្រប់គ្រងបុគ្គលិក គណនាប្រាក់ខែ ២ដង/ខែ កត់ត្រាបើកមុន ថែមម៉ោង និងជូនដំណឹង',
    'stat-total-emp': 'បុគ្គលិកសរុប',
    'stat-total-emp-desc': 'នាក់ ក្នុងស្ថាប័ន',
    'stat-total-payroll': 'ប្រាក់ខែសរុបខែនេះ',
    'stat-total-payroll-desc': 'គិតទាំងពីរលើក និង OT',
    'stat-total-advances': 'ប្រាក់បើកមុនសរុប',
    'stat-total-advances-desc': 'មិនទាន់កាត់កង',
    'stat-ot-days': 'ថ្ងៃថែមម៉ោងសរុប',
    'stat-ot-days-desc': 'ថ្ងៃការងារបន្ថែមសរុប',
    'tab-dashboard': 'ផ្ទាំងគ្រប់គ្រង',
    'tab-employees': 'គ្រប់គ្រងបុគ្គលិក',
    'tab-advances': 'បើកប្រាក់មុន',
    'tab-overtime': 'កត់ត្រាថែមម៉ោង',
    'tab-calculate': 'គណនាប្រាក់ខែ',
    'tab-history': 'ប្រវត្តិបើកប្រាក់ខែ',
    'dash-alerts': 'សេចក្តីជូនដំណឹងថ្ងៃបើកប្រាក់ខែបុគ្គលិក',
    'no-alerts': 'មិនមានថ្ងៃបើកប្រាក់ខែត្រូវដោះស្រាយនៅឡើយទេ។',
    'dash-sys-info': 'ព័ត៌មានប្រព័ន្ធគណនា',
    'rule-period-1': 'លក្ខខណ្ឌបើកលើកទី១ (ពាក់កណ្តាលខែ)',
    'rule-period-1-desc': 'គណនាបន្ទាប់ពីចូលធ្វើការបាន ១៥ ថ្ងៃ (ស្មើនឹង ៥០% នៃប្រាក់ខែគោល)។',
    'rule-period-2': 'លក្ខខណ្ឌបើកលើកទី២ (ដាច់ខែ)',
    'rule-period-2-desc': 'គណនាបន្ទាប់ពីចូលធ្វើការបាន ៣០ ថ្ងៃ (ប្រាក់ខែគោល + ប្រាក់ថែមម៉ោង - បើកមុន - លើកទី១)។',
    'emp-list-title': 'បញ្ជីឈ្មោះបុគ្គលិក',
    'add-emp': 'បន្ថែមបុគ្គលិក',
    'all-positions': 'គ្រប់តួនាទី',
    'th-name': 'ឈ្មោះបុគ្គលិក',
    'th-position': 'តួនាទី',
    'th-start-date': 'ថ្ងៃចូលធ្វើការ',
    'th-basic-salary': 'ប្រាក់ខែគោល',
    'th-daily-rate': 'កម្រៃថែមម៉ោង/ថ្ងៃ',
    'th-paydays': 'ថ្ងៃបើកប្រាក់ (លើក១/លើក២)',
    'th-action': 'សកម្មភាព',
    'adv-form-title': 'កត់ត្រាការបើកប្រាក់មុន',
    'label-select-emp': 'ជ្រើសរើសបុគ្គលិក',
    'select-emp-placeholder': '-- ជ្រើសរើសបុគ្គលិក --',
    'label-adv-amount': 'ចំនួនប្រាក់បើកមុន ($)',
    'label-date': 'ថ្ងៃខែឆ្នាំបើក',
    'label-reason': 'មូលហេតុ / ចំណាំ',
    'btn-save-adv': 'កត់ត្រាការបើកមុន',
    'adv-history-title': 'ប្រវត្តិការបើកប្រាក់មុនទាំងអស់',
    'th-amount': 'ចំនួនទឹកប្រាក់',
    'th-status': 'ស្ថានភាព',
    'ot-form-title': 'កត់ត្រាការថែមម៉ោង (គិតជាថ្ងៃ)',
    'label-ot-days': 'ចំនួនថ្ងៃដែលថែម',
    'label-ot-mult': 'មេគុណថែមម៉ោង (Multiplier)',
    'label-note': 'សម្គាល់',
    'btn-save-ot': 'កត់ត្រាប្រាក់ថែមម៉ោង',
    'ot-history-title': 'បញ្ជីកត់ត្រាថែមម៉ោងទាំងអស់',
    'label-ot-shift': 'វេនការងារថែមម៉ោង (Overtime Shift)',
    'shift-day': 'វេនថ្ងៃ (Day Shift)',
    'shift-night': 'វេនយប់ (Night Shift)',
    'th-ot-days': 'ចំនួនថ្ងៃថែម',
    'th-rate': 'មេគុណ',
    'payroll-calc-title': 'គណនា និងបើកប្រាក់ខែ',
    'label-select-month': 'ជ្រើសរើសខែ',
    'label-select-year': 'ឆ្នាំ',
    'label-select-period': 'ការបើកលើកទី (Period)',
    'period-1': 'លើកទី១ (ពាក់កណ្តាលខែ - ៥០% នៃប្រាក់គោល)',
    'period-2': 'លើកទី២ (ដាច់ខែ - ទូទាត់សរុប)',
    'period-3': 'បើកពេញ ១ខែ (ទូទាត់ម្តងក្នុង ១ខែ)',
    'label-allowance': 'ប្រាក់ឧបត្ថម្ភផ្សេងៗ ($)',
    'label-deductions': 'ប្រាក់ពិន័យ/ដកផ្សេងៗ ($)',
    'btn-calculate-save': 'រក្សាទុកការគណនាប្រាក់ខែ',
    'payroll-preview-title': 'ការគណនាប្រាក់ខែសរុប (បណ្តោះអាសន្ន)',
    'lbl-base-salary': 'ប្រាក់ខែគោល',
    'lbl-period-type': 'ការបើកលើកទី២',
    'lbl-ot-pay': 'ប្រាក់ថែមម៉ោងសរុប',
    'lbl-advances-deduct': 'ប្រាក់បើកមុន (ដក)',
    'br-base-sal': 'ប្រាក់ខែគោល (Basic Salary)',
    'br-period-sal': 'ប្រាក់ខែតាមវគ្គ (Period Base Salary)',
    'br-ot-label': 'ប្រាក់ថែមម៉ោង (OT 0 ថ្ងៃ)',
    'br-allowance': 'ប្រាក់ឧបត្ថម្ភផ្សេងៗ (Allowances)',
    'br-period1-deduct': 'ដកប្រាក់បើកលើកទី១ (Period 1 Payout)',
    'br-advances': 'ដកប្រាក់បើកមុន (Deducted Advances)',
    'br-custom-deduct': 'ប្រាក់ពិន័យ/ដកផ្សេងៗ (Deductions)',
    'br-net-pay': 'ប្រាក់ខែត្រូវបើកសរុប (Net Payout)',
    'btn-preview-slip': 'មើលសន្លឹកវិក្កយបត្រប្រាក់ខែ (Payslip)',
    'history-list-title': 'ប្រវត្តិនៃការទូទាត់ប្រាក់ខែ',
    'btn-export-csv': 'នាំចេញជា CSV',
    'btn-clear-history': 'លុបប្រវត្តិទាំងអស់',
    'all-months': 'គ្រប់ខែ',
    'all-periods': 'គ្រប់លើក',
    'th-period-payout': 'ខែ/លើក',
    'th-net-pay-short': 'ប្រាក់ជាក់ស្តែង',
    'lbl-emp-name-kh': 'ឈ្មោះជាភាសាខ្មែរ (Khmer Name)',
    'lbl-emp-name-en': 'ឈ្មោះជាភាសាអង់គ្លេស (English Name)',
    'lbl-position': 'តួនាទី (Position)',
    'lbl-start-date': 'ថ្ងៃចូលធ្វើការ (Joining Start Date)',
    'lbl-daily-rate': 'កម្រៃថែមម៉ោង/ថ្ងៃ (Daily Rate - $)',
    'lbl-paydays-hint': 'ថ្ងៃបើកប្រាក់ខែតាមការគណនា (Payday cycle calculated based on Join Date):',
    'btn-cancel': 'បោះបង់',
    'btn-save': 'រក្សាទុក',
    'btn-print': 'បោះពុម្ភ (Print)',
    'adv-status-pending': 'មិនទាន់កាត់',
    'adv-status-deducted': 'បានកាត់កង',
    'label-worked-days': 'ចំនួនថ្ងៃធ្វើការជាក់ស្តែង (ថ្ងៃ)',
    'label-payment-status': 'ស្ថានភាពទូទាត់',
    'status-paid': 'បានបើកប្រាក់រួច (Paid)',
    'status-unpaid': 'មិនទាន់បើក (Not Paid)',
    'label-start-date': 'ថ្ងៃចាប់ផ្តើម',
    'label-end-date': 'ថ្ងៃបញ្ចប់',
    'btn-copy-text': 'ចម្លងអត្ថបទ (Copy)',
    'btn-send-telegram': 'ផ្ញើទៅ Telegram',
    'btn-save-image': 'ទាញយកជារូបភាព',
    'lbl-standard-days': 'ថ្ងៃធ្វើការស្តង់ដារ/ខែ',
    'std-days-26': '២៦ ថ្ងៃ (មានថ្ងៃឈប់)',
    'std-days-30': '៣០ ថ្ងៃ (៧ថ្ងៃពេញ គ្មានឈប់)',
    'status-unpaid-adv': 'មិនទាន់បើកឱ្យ',
    'status-disbursed-adv': 'បានបើករួចរាល់',
    'tab-expenses': 'ចំណាយប្រចាំថ្ងៃ',
    'expenses-form-title': 'បញ្ចូលការចំណាយប្រចាំថ្ងៃ',
    'ocr-upload-title': 'ផ្ទុកឡើងរូបភាពចំណាយកត់ត្រាដៃ',
    'ocr-upload-desc': 'អូសនិងទម្លាក់ ឬចុចដើម្បីជ្រើសរើសរូបភាព'
  },
  en: {
    'app-title': 'Khmer Payroll Management System',
    'app-subtitle': 'Manage employees, calculate salary twice/month, track advances, overtime & payday alerts',
    'stat-total-emp': 'Total Employees',
    'stat-total-emp-desc': 'active in organization',
    'stat-total-payroll': 'Total Payroll This Month',
    'stat-total-payroll-desc': 'includes Period 1, 2 & OT',
    'stat-total-advances': 'Total Advances Logged',
    'stat-total-advances-desc': 'not yet deducted',
    'stat-ot-days': 'Total OT Days',
    'stat-ot-days-desc': 'total extra work days',
    'tab-dashboard': 'Dashboard',
    'tab-employees': 'Employees',
    'tab-advances': 'Advances',
    'tab-overtime': 'Overtime',
    'tab-calculate': 'Calculate Payroll',
    'tab-history': 'Payroll History',
    'dash-alerts': 'Payday Alerts & Notifications',
    'no-alerts': 'No paydays require action at this moment.',
    'dash-sys-info': 'Payroll Policy Information',
    'rule-period-1': '1st Payout (Mid-Month)',
    'rule-period-1-desc': 'Calculated 15 days after join date (fixed at 50% of Basic Salary).',
    'rule-period-2': '2nd Payout (End of Month)',
    'rule-period-2-desc': 'Calculated 30 days after join date (Basic + OT + Allowances - Adv - Period 1).',
    'emp-list-title': 'Employee List',
    'add-emp': 'Add Employee',
    'all-positions': 'All Positions',
    'th-name': 'Employee Name',
    'th-position': 'Position',
    'th-start-date': 'Start Date',
    'th-basic-salary': 'Basic Salary',
    'th-daily-rate': 'OT Rate/Day',
    'th-paydays': 'Paydays (1st / 2nd)',
    'th-action': 'Actions',
    'adv-form-title': 'Record Salary Advance',
    'label-select-emp': 'Select Employee',
    'select-emp-placeholder': '-- Select Employee --',
    'label-adv-amount': 'Advance Amount ($)',
    'label-date': 'Date',
    'label-reason': 'Reason / Note',
    'btn-save-adv': 'Save Advance',
    'adv-history-title': 'Advance Payout History (All)',
    'th-amount': 'Amount',
    'th-status': 'Status',
    'ot-form-title': 'Record Daily Overtime',
    'label-ot-days': 'Overtime Days Worked',
    'label-ot-mult': 'OT Multiplier',
    'label-note': 'Note / Remark',
    'btn-save-ot': 'Save Overtime',
    'ot-history-title': 'Overtime Logs (All)',
    'label-ot-shift': 'Overtime Shift',
    'shift-day': 'Day Shift',
    'shift-night': 'Night Shift',
    'th-ot-days': 'OT Days',
    'th-rate': 'Multiplier',
    'payroll-calc-title': 'Calculate & Pay Salary',
    'label-select-month': 'Select Month',
    'label-select-year': 'Year',
    'label-select-period': 'Pay Cycle Period',
    'period-1': 'Period 1 (Mid-Month: 50% Basic)',
    'period-2': 'Period 2 (End-Month: Settle)',
    'period-3': 'Full Month (Pay once a month)',
    'label-allowance': 'Allowances ($)',
    'label-deductions': 'Deductions/Fines ($)',
    'btn-calculate-save': 'Save Payroll Calculation',
    'payroll-preview-title': 'Payroll Calculation (Draft)',
    'lbl-base-salary': 'Basic Salary',
    'lbl-period-type': 'Period 2 Net Payout',
    'lbl-ot-pay': 'Total OT Pay',
    'lbl-advances-deduct': 'Salary Advance (Deduct)',
    'br-base-sal': 'Basic Salary',
    'br-period-sal': 'Period Base Salary',
    'br-ot-label': 'Overtime Pay (OT 0 Days)',
    'br-allowance': 'Allowances',
    'br-period1-deduct': 'Deduct Period 1 Payout',
    'br-advances': 'Deduct Advances',
    'br-custom-deduct': 'Other Deductions',
    'br-net-pay': 'Net Payout',
    'btn-preview-slip': 'Preview Payslip',
    'history-list-title': 'Payroll Disbursement Records',
    'btn-export-csv': 'Export CSV',
    'btn-clear-history': 'Clear All History',
    'all-months': 'All Months',
    'all-periods': 'All Periods',
    'th-period-payout': 'Month/Period',
    'th-net-pay-short': 'Net Paid',
    'lbl-emp-name-kh': 'Khmer Name',
    'lbl-emp-name-en': 'English Name',
    'lbl-position': 'Position',
    'lbl-start-date': 'Joining Start Date',
    'lbl-daily-rate': 'Daily Rate ($)',
    'lbl-paydays-hint': 'Payday cycle calculated based on Join Date:',
    'btn-cancel': 'Cancel',
    'btn-save': 'Save',
    'btn-print': 'Print Payslip',
    'btn-save-image': 'Save as Image',
    'adv-status-pending': 'Pending Settle',
    'adv-status-deducted': 'Settled / Deducted',
    'label-worked-days': 'Actual Worked Days (Days)',
    'label-payment-status': 'Payment Status',
    'status-paid': 'Paid',
    'status-unpaid': 'Not Paid',
    'label-start-date': 'Start Date',
    'label-end-date': 'End Date',
    'btn-copy-text': 'Copy Text',
    'btn-send-telegram': 'Send to Telegram',
    'lbl-standard-days': 'Standard Worked Days/Month',
    'std-days-26': '26 Days (With day-off)',
    'std-days-30': '30 Days (7 Days, No day-off)',
    'status-unpaid-adv': 'Not Disbursed',
    'status-disbursed-adv': 'Disbursed',
    'tab-expenses': 'Daily Expenses',
    'expenses-form-title': 'Input Daily Expenses',
    'ocr-upload-title': 'Upload Handwritten Expenses Image',
    'ocr-upload-desc': 'Drag & drop or click to choose an image'
  }
};

export function getEmployeePaydays(startDateStr: string) {
  if (!startDateStr) return { p1: 15, p2: 30 };
  const date = new Date(startDateStr);
  const startDay = date.getDate();
  
  let p2 = startDay;
  let p1 = (startDay + 15) % 30;
  if (p1 === 0) p1 = 30;
  
  return { p1, p2 };
}

export function generatePayslipText(record: any, lang: 'en' | 'kh') {
  const monthNamesKh = ['', 'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const monthNamesEn = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthStr = lang === 'kh' ? (monthNamesKh[record.month] || `ខែ ${record.month}`) : (monthNamesEn[record.month] || `Month ${record.month}`);
  
  const name = lang === 'kh' ? (record.empNameKh || record.staffName) : (record.empNameEn || record.staffName);
  const position = record.position || 'Staff';
  const payDate = record.paymentDate || record.dateCalculated || new Date().toISOString().substring(0, 10);
  const payMethod = record.paymentMethod || 'Cash';

  const baseSalary = Number(record.basicSalary || record.baseSalary || 0);
  const extraShiftAmount = Number(record.extraShiftAmount || record.overtime || 0);
  const extraShiftCount = Number(record.extraShiftCount || 0);
  const staffExpenseAmount = Number(record.staffExpenseAmount || 0);
  const bonus = Number(record.bonus || record.allowance || 0);
  const advancePayment = Number(record.advancePayment || record.advancesDeduct || 0);
  const leaveDeduction = Number(record.leavesDeduct || 0);
  const otherDeduction = Number(record.deduction || record.customDeduct || 0);
  const netSalary = Number(record.netSalary || record.netPay || 0);
  const netSalaryKhr = Math.round(netSalary * 4000);

  const statusVal = record.status === 'paid' || record.status === 'Paid'
    ? (lang === 'kh' ? '✓ បានទូទាត់រួច (PAID)' : '✓ PAID') 
    : (lang === 'kh' ? '⏳ មិនទាន់ទូទាត់ (PENDING)' : '⏳ PENDING');

  let text = `=======================================\n`;
  text += `   ✨ TC STAFF MANAGEMENT ✨\n`;
  text += lang === 'kh' ? `      បង្កាន់ដៃបើកប្រាក់បៀវត្សរ៍បុគ្គលិក\n` : `       OFFICIAL SALARY PAYSLIP\n`;
  text += `=======================================\n`;
  text += `${lang === 'kh' ? 'ឈ្មោះបុគ្គលិក' : 'Employee'}: ${name}\n`;
  text += `${lang === 'kh' ? 'តួនាទី' : 'Position'}: ${position}\n`;
  text += `${lang === 'kh' ? 'ប្រចាំខែ' : 'Period'}: ${record.salaryPeriod || `${monthStr} ${record.year || 2026}`}\n`;
  text += `${lang === 'kh' ? 'កាលបរិច្ឆេទ' : 'Pay Date'}: ${payDate}\n`;
  text += `${lang === 'kh' ? 'វិធីសាស្ត្រ' : 'Method'}: ${payMethod}\n`;
  text += `---------------------------------------\n`;
  text += `📈 ${lang === 'kh' ? 'ចំណូល & ប្រាក់បន្ថែម' : 'Earnings & Additions'}:\n`;
  text += `  • ${lang === 'kh' ? 'ប្រាក់ខែគោល' : 'Base Salary'}: $${baseSalary.toFixed(2)}\n`;
  if (extraShiftAmount > 0) {
    text += `  • ${lang === 'kh' ? 'ជំនួសវេន (Shift Cover)' : 'Shift Covers'}: +$${extraShiftAmount.toFixed(2)} ${extraShiftCount > 0 ? `(${extraShiftCount} វេន)` : ''}\n`;
  }
  if (staffExpenseAmount > 0) {
    text += `  • ${lang === 'kh' ? 'សងថ្លៃចំណាយ' : 'Staff Expense'}: +$${staffExpenseAmount.toFixed(2)}\n`;
  }
  if (bonus > 0) {
    text += `  • ${lang === 'kh' ? 'ប្រាក់ឧបត្ថម្ភ' : 'Bonus'}: +$${bonus.toFixed(2)}\n`;
  }

  text += `---------------------------------------\n`;
  text += `📉 ${lang === 'kh' ? 'ការកាត់ប្រាក់' : 'Deductions'}:\n`;
  if (advancePayment > 0) {
    text += `  • ${lang === 'kh' ? 'បើកប្រាក់មុន' : 'Advance'}: -$${advancePayment.toFixed(2)}\n`;
  }
  if (leaveDeduction > 0) {
    let datesStr = '';
    if (Array.isArray(record.leaveDates) && record.leaveDates.length > 0) {
      datesStr = ` [ថ្ងៃ៖ ${record.leaveDates.join(', ')}]`;
    } else if (typeof record.leaveDates === 'string' && record.leaveDates.trim()) {
      datesStr = ` [ថ្ងៃ៖ ${record.leaveDates}]`;
    }
    text += `  • ${lang === 'kh' ? 'ឈប់សម្រាក (Absence)' : 'Absence Deduction'}: -$${leaveDeduction.toFixed(2)} ${record.leaveDays ? `(${record.leaveDays} វេន)` : ''}${datesStr}\n`;
  }
  if (otherDeduction > 0) {
    text += `  • ${lang === 'kh' ? 'កាត់ផ្សេងៗ' : 'Other'}: -$${otherDeduction.toFixed(2)}\n`;
  }
  if (advancePayment === 0 && leaveDeduction === 0 && otherDeduction === 0) {
    text += `  • ${lang === 'kh' ? 'គ្មានការកាត់ប្រាក់' : 'No Deductions'}: $0.00\n`;
  }

  text += `=======================================\n`;
  text += `💰 ${lang === 'kh' ? 'ប្រាក់បើកជាក់ស្តែង' : 'NET SALARY'}: $${netSalary.toFixed(2)}\n`;
  text += `---------------------------------------\n`;
  text += `📌 ${lang === 'kh' ? 'ស្ថានភាព' : 'Status'}: ${statusVal}\n`;
  text += `=======================================`;

  return text;
}

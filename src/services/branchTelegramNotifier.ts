/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BranchTelegramPayload {
  branchId: string;
  branchName?: string;
  category: 'revenue' | 'detergent' | 'softener' | 'stock' | 'salary' | 'general';
  alertType?: string;
  message?: string;
  details?: string;
  actionRequired?: string;
  data?: any;
  userRole?: string;
}

export function formatKhmerCurrency(amount: number): string {
  return (amount || 0).toLocaleString('en-US') + ' ៛';
}

export function getBranchKhmerDisplayName(branchId: string, branchName?: string): { kh: string; en: string } {
  const bId = (branchId || '').toLowerCase();
  const bName = (branchName || '').toLowerCase();

  if (bId === 'b1' || bId.includes('toto') || bName.includes('toto') || bName.includes('chichi')) {
    return { kh: 'ហាង toto by Chichi', en: 'toto by Chichi' };
  }
  if (bId === 'b2' || bId.includes('corner') || bName.includes('corner') || bName.includes('coffee')) {
    return { kh: 'ហាង Coffee corner', en: 'Coffee corner' };
  }

  const cleanName = branchName || branchId || 'Unknown';
  return { kh: `ហាង ${cleanName}`, en: `${cleanName}` };
}

export async function sendBranchTelegramAlert(payload: BranchTelegramPayload): Promise<{ success: boolean; dispatched?: boolean; error?: string }> {
  // 3-4 no need: Disable sales/revenue & stock/detergent notifications
  const cat = String(payload.category || '').toLowerCase().trim();
  if (['revenue', 'sales', 'stock', 'low_stock', 'detergent', 'softener', 'inventory'].includes(cat)) {
    return { success: true, dispatched: false };
  }

  try {
    const res = await fetch('/api/telegram-trigger-instant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    return {
      success: Boolean(data.success || data.dispatched),
      dispatched: Boolean(data.dispatched || data.success),
      error: data.error
    };
  } catch (err: any) {
    console.error('Error dispatching branch Telegram notification:', err);
    return { success: false, dispatched: false, error: err.message };
  }
}

export async function notifyRevenueRecordSaved(params: {
  branchId: string;
  branchName: string;
  dateLabel: string;
  row: {
    startCounter?: number;
    endCounter?: number;
    startCounterAba?: number;
    endCounterAba?: number;
    cash: number;
    aba: number;
    coinCount?: number;
    coinSales?: number;
    dailyRevenue: number;
    bankDeposit?: number;
    remainingCash?: number;
    note?: string;
  };
  exchangeRate?: number;
  role?: string;
  customNote?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { branchId, branchName, dateLabel, row, exchangeRate = 4000, role = 'Staff', customNote } = params;
  const branchInfo = getBranchKhmerDisplayName(branchId, branchName);
  const usdAmount = (row.dailyRevenue / exchangeRate).toFixed(2);
  const noteText = (customNote || row.note || '').trim();

  const msg = [
    '📊 <b>[Cafe] របាយការណ៍ចំណូលប្រចាំថ្ងៃ (Revenue)</b>',
    `🏢 <b>សាខា/Branch:</b> <b>${branchInfo.kh}</b> (${branchInfo.en})`,
    `📅 <b>កាលបរិច្ឆេទ/Date:</b> <code>${dateLabel}</code>`,
    '━━━━━━━━━━━━━━━━━',
    `💰 <b>ចំណូលសរុប (Total):</b> <b>${formatKhmerCurrency(row.dailyRevenue)}</b> (~$${usdAmount})`,
    `💵 <b>សាច់ប្រាក់ (Cash):</b> ${formatKhmerCurrency(row.cash)}`,
    `💳 <b>ធនាគារ (ABA):</b> ${formatKhmerCurrency(row.aba)}`,
    row.coinSales || row.coinCount
      ? `🪙 <b>កាក់ (Coin):</b> ${formatKhmerCurrency(row.coinSales || 0)} (${row.coinCount || 0} កាក់)`
      : null,
    row.bankDeposit ? `🏦 <b>ដាក់ធនាគារ (Bank Deposit):</b> ${formatKhmerCurrency(row.bankDeposit)}` : null,
    row.remainingCash ? `👛 <b>សាច់ប្រាក់នៅសល់ (Remaining):</b> ${formatKhmerCurrency(row.remainingCash)}` : null,
    noteText ? `📝 <b>ចំណាំ (Note):</b> ${noteText}` : null,
    '━━━━━━━━━━━━━━━━━',
    `👤 <b>កត់ត្រាដោយ:</b> ${role}`,
    `⏰ <b>ម៉ោងកត់ត្រា:</b> <code>${new Date().toLocaleTimeString()}</code>`
  ].filter((x): x is string => Boolean(x)).join('\n');

  return sendBranchTelegramAlert({
    branchId,
    branchName,
    category: 'revenue',
    alertType: `Daily Revenue - ${branchInfo.kh}`,
    message: msg,
    userRole: role,
    data: {
      date: dateLabel,
      totalRevenue: row.dailyRevenue,
      cash: row.cash,
      aba: row.aba
    }
  });
}

export async function notifyDetergentRecordSaved(params: {
  branchId: string;
  branchName: string;
  dateLabel: string;
  row: {
    inQty: number;
    outQty: number;
    balance: number;
    note?: string;
  };
  role?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { branchId, branchName, dateLabel, row, role = 'Staff' } = params;
  const branchInfo = getBranchKhmerDisplayName(branchId, branchName);
  const noteText = (row.note || '').trim();

  const msg = [
    '🧴 <b>[Cafe] កំណត់ត្រាសាប៊ូប្រចាំថ្ងៃ (Detergent)</b>',
    `🏢 <b>សាខា/Branch:</b> <b>${branchInfo.kh}</b> (${branchInfo.en})`,
    `📅 <b>កាលបរិច្ឆេទ/Date:</b> <code>${dateLabel}</code>`,
    '━━━━━━━━━━━━━━━━━',
    `📥 <b>ស្តុកចូល (Stock In):</b> +${row.inQty || 0} កាន/ដប`,
    `📤 <b>ប្រើប្រាស់ (Usage):</b> -${row.outQty || 0} កាន/ដប`,
    `📦 <b>ស្តុកនៅសល់ (Balance):</b> <b>${row.balance || 0} កាន/ដប</b>`,
    noteText ? `📝 <b>ចំណាំ (Note):</b> ${noteText}` : null,
    '━━━━━━━━━━━━━━━━━',
    `👤 <b>កត់ត្រាដោយ:</b> ${role}`,
    `⏰ <b>ម៉ោងកត់ត្រា:</b> <code>${new Date().toLocaleTimeString()}</code>`
  ].filter((x): x is string => Boolean(x)).join('\n');

  return sendBranchTelegramAlert({
    branchId,
    branchName,
    category: 'detergent',
    alertType: `Daily Detergent - ${branchInfo.kh}`,
    message: msg,
    userRole: role,
    data: {
      date: dateLabel,
      inQty: row.inQty,
      outQty: row.outQty,
      balance: row.balance
    }
  });
}

export async function notifySoftenerRecordSaved(params: {
  branchId: string;
  branchName: string;
  dateLabel: string;
  row: {
    inQty: number;
    outQty: number;
    total: number;
    note?: string;
  };
  role?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { branchId, branchName, dateLabel, row, role = 'Staff' } = params;
  const branchInfo = getBranchKhmerDisplayName(branchId, branchName);
  const noteText = (row.note || '').trim();

  const msg = [
    '🌸 <b>[Cafe] កំណត់ត្រាទឹកក្រអូបប្រចាំថ្ងៃ (Softener)</b>',
    `🏢 <b>សាខា/Branch:</b> <b>${branchInfo.kh}</b> (${branchInfo.en})`,
    `📅 <b>កាលបរិច្ឆេទ/Date:</b> <code>${dateLabel}</code>`,
    '━━━━━━━━━━━━━━━━━',
    `📥 <b>ស្តុកចូល (Stock In):</b> +${row.inQty || 0} កាន/ដប`,
    `📤 <b>ប្រើប្រាស់ (Usage):</b> -${row.outQty || 0} កាន/ដប`,
    `📦 <b>សរុបប្រចាំថ្ងៃ (Total):</b> <b>${row.total || 0} កាន/ដប</b>`,
    noteText ? `📝 <b>ចំណាំ (Note):</b> ${noteText}` : null,
    '━━━━━━━━━━━━━━━━━',
    `👤 <b>កត់ត្រាដោយ:</b> ${role}`,
    `⏰ <b>ម៉ោងកត់ត្រា:</b> <code>${new Date().toLocaleTimeString()}</code>`
  ].filter((x): x is string => Boolean(x)).join('\n');

  return sendBranchTelegramAlert({
    branchId,
    branchName,
    category: 'softener',
    alertType: `Daily Softener - ${branchInfo.kh}`,
    message: msg,
    userRole: role,
    data: {
      date: dateLabel,
      inQty: row.inQty,
      outQty: row.outQty,
      total: row.total
    }
  });
}

export async function notifyBatchSaveCompleted(params: {
  branchId: string;
  branchName: string;
  category: 'revenue' | 'detergent' | 'softener';
  month: number;
  year: number;
  count: number;
  role?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { branchId, branchName, category, month, year, count, role = 'Staff' } = params;
  const branchInfo = getBranchKhmerDisplayName(branchId, branchName);

  const categoryLabels = {
    revenue: { icon: '📊', nameKh: 'ចំណូលប្រចាំថ្ងៃ (Revenue)' },
    detergent: { icon: '🧴', nameKh: 'តារាងតាមដានសាប៊ូ (Detergent)' },
    softener: { icon: '🌸', nameKh: 'តារាងតាមដានទឹកក្រអូប (Softener)' }
  }[category];

  const msg = [
    `${categoryLabels.icon} <b>[Cafe] រក្សាទុកទិន្នន័យប្រចាំខែ (Batch Saved)</b>`,
    `🏢 <b>សាខា/Branch:</b> <b>${branchInfo.kh}</b> (${branchInfo.en})`,
    `📋 <b>តារាង:</b> ${categoryLabels.nameKh}`,
    `📅 <b>សម្រាប់ខែ:</b> <code>${month.toString().padStart(2, '0')}/${year}</code>`,
    `🔢 <b>ចំនួនកំណត់ត្រាដែលបានរក្សាទុក:</b> <b>${count} ថ្ងៃ</b>`,
    '━━━━━━━━━━━━━━━━━',
    `👤 <b>កត់ត្រាដោយ:</b> ${role}`,
    `⏰ <b>ម៉ោងកត់ត្រា:</b> <code>${new Date().toLocaleTimeString()}</code>`
  ].join('\n');

  return sendBranchTelegramAlert({
    branchId,
    branchName,
    category,
    alertType: `Batch Save (${categoryLabels.nameKh}) - ${branchInfo.kh}`,
    message: msg,
    userRole: role
  });
}

/**
 * Formats & dispatches Salary Payday Due Alert strictly for a single branch.
 * ZERO cross-branch data leakage!
 */
export async function notifyBranchSalaryPaydayAlert(params: {
  branchId: string;
  branchName: string;
  staffList: Array<{
    id: string;
    fullName: string;
    position?: string;
    branchId: string;
    baseSalary: number;
    startDate?: string;
    status: string;
  }>;
  salaries?: Array<{
    staffId: string;
    branchId: string;
    status: string;
    netSalary: number;
    salaryPeriod?: string;
  }>;
  targetMonth?: number;
  targetYear?: number;
  role?: string;
}): Promise<{ success: boolean; staffCount: number; totalAmount: number; error?: string }> {
  const {
    branchId,
    branchName,
    staffList = [],
    targetMonth = new Date().getMonth() + 1,
    targetYear = new Date().getFullYear(),
    role = 'Manager'
  } = params;

  const branchInfo = getBranchKhmerDisplayName(branchId, branchName);
  const today = new Date();
  const todayDay = today.getDate();

  // 1. STRICTLY FILTER STAFF BELONGING ONLY TO THIS BRANCH
  const bId = (branchId || '').toLowerCase().trim();
  const branchStaff = staffList.filter(s => {
    const sB = String(s.branchId || '').toLowerCase().trim();
    return sB === bId && s.status === 'Active';
  });

  if (branchStaff.length === 0) {
    return {
      success: false,
      staffCount: 0,
      totalAmount: 0,
      error: `មិនមានបុគ្គលិកសកម្មនៅក្នុង ${branchInfo.kh} ឡើយ`
    };
  }

  // 2. Determine who has salary due or upcoming in this branch
  // Periods: Period 1 (15th - Mid month) and Period 2 (end of month)
  const isPeriod1 = todayDay <= 18;
  const periodLabel = isPeriod1 ? 'លើកទី១ (ពាក់កណ្តាលខែ)' : 'លើកទី២ (ដាច់ខែ)';

  let totalPayoutDueUsd = 0;
  const staffLines: string[] = [];

  branchStaff.forEach((emp, index) => {
    const base = Number(emp.baseSalary || 0);
    // Prorated or period half
    const halfBase = Math.round((base / 2) * 100) / 100;
    const dueAmount = isPeriod1 ? halfBase : base;
    totalPayoutDueUsd += dueAmount;

    staffLines.push(
      `${index + 1}. <b>${emp.fullName}</b> (${emp.position || 'Staff'})\n` +
      `   • ប្រាក់ខែគោល: $${base.toFixed(2)} | ត្រូវបើក ${periodLabel}: <b>$${dueAmount.toFixed(2)}</b>`
    );
  });

  const totalKhrApprox = Math.round(totalPayoutDueUsd * 4000);
  const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const msg = [
    `💵 <b>[Cafe] ដំណឹងដល់ថ្ងៃបើកប្រាក់ខែបុគ្គលិក (Salary Due Alert)</b>`,
    `🏢 <b>សាខា:</b> <b>${branchInfo.kh}</b> (${branchInfo.en})`,
    `📅 <b>កាលបរិច្ឆេទ:</b> <code>${dateStr}</code>`,
    `📋 <b>វគ្គបើកប្រាក់ខែ:</b> <b>${periodLabel}</b> (ខែ ${targetMonth}/${targetYear})`,
    `━━━━━━━━━━━━━━━━━`,
    `👥 <b>បញ្ជីបុគ្គលិកសាខានេះត្រូវបើកប្រាក់ខែ (${branchStaff.length} នាក់):</b>`,
    staffLines.join('\n'),
    `━━━━━━━━━━━━━━━━━`,
    `💰 <b>ទឹកប្រាក់ត្រូវបើកសរុបសាខានេះ:</b> <b>$${totalPayoutDueUsd.toFixed(2)}</b> (~${totalKhrApprox.toLocaleString('en-US')} ៛)`,
    `⚠️ <b>ចំណាំ:</b> សូមម្ចាស់សាខា ឬអ្នកគ្រប់គ្រងពិនិត្យ និងអនុម័តការបើកប្រាក់ខែក្នុងប្រព័ន្ធ។`,
    `━━━━━━━━━━━━━━━━━`,
    `👤 <b>ផ្ញើចេញដោយ:</b> ${role}`,
    `⏰ <b>ម៉ោងកត់ត្រា:</b> <code>${today.toLocaleTimeString()}</code>`
  ].join('\n');

  const alertRes = await sendBranchTelegramAlert({
    branchId,
    branchName,
    category: 'salary',
    alertType: `Salary Due Alert - ${branchInfo.kh}`,
    message: msg,
    userRole: role,
    data: {
      branchId,
      staffCount: branchStaff.length,
      totalAmountUsd: totalPayoutDueUsd,
      month: targetMonth,
      year: targetYear
    }
  });

  return {
    success: alertRes.success,
    staffCount: branchStaff.length,
    totalAmount: totalPayoutDueUsd,
    error: alertRes.error
  };
}

/**
 * Dispatches an individual staff salary payout confirmation slip to the branch bot.
 */
export async function notifySingleSalaryPayout(params: {
  branchId: string;
  branchName: string;
  staffName: string;
  position?: string;
  period: string;
  netSalaryUsd: number;
  baseSalaryUsd: number;
  overtimeUsd?: number;
  bonusUsd?: number;
  deductionUsd?: number;
  advanceDeductionUsd?: number;
  paymentMethod?: string;
  role?: string;
}): Promise<{ success: boolean; error?: string }> {
  const {
    branchId,
    branchName,
    staffName,
    position,
    period,
    netSalaryUsd,
    baseSalaryUsd,
    overtimeUsd = 0,
    bonusUsd = 0,
    deductionUsd = 0,
    advanceDeductionUsd = 0,
    paymentMethod = 'Cash / ABA',
    role = 'Manager'
  } = params;

  const branchInfo = getBranchKhmerDisplayName(branchId, branchName);
  const netKhr = Math.round(netSalaryUsd * 4000);

  const msg = [
    `🧾 <b>[Cafe] ប័ណ្ណទូទាត់ប្រាក់ខែបុគ្គលិក (Salary Payslip)</b>`,
    `🏢 <b>សាខា:</b> <b>${branchInfo.kh}</b> (${branchInfo.en})`,
    `👤 <b>បុគ្គលិក:</b> <b>${staffName}</b> (${position || 'បុគ្គលិក'})`,
    `📋 <b>កាលវិភាគ:</b> <code>${period}</code>`,
    `━━━━━━━━━━━━━━━━━`,
    `💵 <b>ប្រាក់ខែគោល:</b> $${baseSalaryUsd.toFixed(2)}`,
    overtimeUsd > 0 ? `⚡ <b>បន្ថែមម៉ោង (OT):</b> +$${overtimeUsd.toFixed(2)}` : null,
    bonusUsd > 0 ? `🎁 <b>ប្រាក់លើកទឹកចិត្ត:</b> +$${bonusUsd.toFixed(2)}` : null,
    deductionUsd > 0 ? `⚠️ <b>ការកាត់ប្រាក់:</b> -$${deductionUsd.toFixed(2)}` : null,
    advanceDeductionUsd > 0 ? `👛 <b>កាត់ប្រាក់បើកមុន:</b> -$${advanceDeductionUsd.toFixed(2)}` : null,
    `━━━━━━━━━━━━━━━━━`,
    `💰 <b>ប្រាក់ខែបើកជាក់ស្តែង (Net Pay):</b> <b>$${netSalaryUsd.toFixed(2)}</b> (~${netKhr.toLocaleString('en-US')} ៛)`,
    `💳 <b>វិធីសាស្ត្រទូទាត់:</b> ${paymentMethod}`,
    `━━━━━━━━━━━━━━━━━`,
    `👤 <b>អ្នករៀបចំ:</b> ${role}`,
    `⏰ <b>កាលបរិច្ឆេទ:</b> <code>${new Date().toLocaleString()}</code>`
  ].filter((x): x is string => Boolean(x)).join('\n');

  return sendBranchTelegramAlert({
    branchId,
    branchName,
    category: 'salary',
    alertType: `Salary Payslip - ${staffName} (${branchInfo.kh})`,
    message: msg,
    userRole: role
  });
}
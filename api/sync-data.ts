import { createClient } from '@supabase/supabase-js';
import { BASELINE_ATTENDANCE_74 } from './data/baselineAttendance';

let lastSupabaseErrorTime = 0;

const DEFAULT_USERS = [
  {
    id: 'usr_root',
    username: 'root',
    email: 'root@p2bkh.tech',
    fullName: 'Root (Executive Owner)',
    role: 'Owner',
    roleId: 'owner',
    status: 'Active',
    assignedBranchIds: ['b1', 'b2'],
    telegramUsername: '@root',
    telegramChatId: '',
    phone: '',
    twoFactorMethod: 'telegram'
  },
  {
    id: 'usr_penh',
    username: 'penh',
    email: 'penh@p2bkh.tech',
    fullName: 'Penh (Owner)',
    role: 'Owner',
    roleId: 'owner',
    status: 'Active',
    assignedBranchIds: ['b1', 'b2'],
    telegramUsername: '@mrknowitall56',
    telegramChatId: '508412077',
    phone: '',
    twoFactorMethod: 'telegram'
  },
  {
    id: 'usr_miller',
    username: 'miller',
    email: 'miller@p2bkh.tech',
    fullName: 'Miller (Owner)',
    role: 'Owner',
    roleId: 'owner',
    status: 'Active',
    assignedBranchIds: ['b1', 'b2'],
    telegramUsername: '@millerppc',
    telegramChatId: '7818150707',
    phone: '',
    twoFactorMethod: 'telegram'
  },
  {
    id: 'usr_theary',
    username: 'theary',
    email: 'theary@p2bkh.tech',
    fullName: 'Tha Theary (Owner)',
    role: 'Owner',
    roleId: 'owner',
    status: 'Active',
    assignedBranchIds: ['b1', 'b2'],
    telegramUsername: '@theary5686',
    telegramChatId: '719054686',
    phone: '',
    twoFactorMethod: 'telegram'
  }
];

const DEFAULT_BRANCHES = [
  {
    id: 'b1',
    branchCode: 'TOTO-01',
    branchName: 'toto by Chichi',
    address: 'Phnom Penh, Cambodia',
    phone: '012 888 999',
    managerId: 'usr_owner',
    managerName: 'Owner / Manager',
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
    managerId: 'usr_owner',
    managerName: 'Owner / Manager',
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

const DEFAULT_STAFF = [
  {
    id: 's_1789445212450',
    fullName: 'Liza',
    branchId: 'b1',
    position: 'Barista / Staff',
    shift: 'Shift 2',
    baseSalary: 220,
    status: 'Active',
    telegramId: '6853226183',
    telegramUsername: '@travelexpresskh',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Female',
    dob: '2002-05-15',
    phone: '012 888 991',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789634905188',
    fullName: 'លី រ៉ូហ្សា',
    branchId: 'b1',
    position: 'Barista',
    shift: 'Shift 2',
    baseSalary: 220,
    status: 'Active',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Female',
    dob: '2003-08-20',
    phone: '012 888 992',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789699005396',
    fullName: 'Lina',
    branchId: 'b1',
    position: 'Staff',
    shift: 'Shift 2',
    baseSalary: 200,
    status: 'Active',
    telegramId: '1233881723',
    telegramUsername: '@cheaweii',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Female',
    dob: '2004-03-12',
    phone: '012 888 993',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789699274989',
    fullName: 'Jing',
    branchId: 'b1',
    position: 'Staff',
    shift: 'Shift 2',
    baseSalary: 200,
    status: 'Active',
    telegramId: '1884877543',
    telegramUsername: '@chory_sreyching30',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Female',
    dob: '2003-11-05',
    phone: '012 888 994',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789715204283',
    fullName: 'កូវ គឹមហ័រ',
    branchId: 'b1',
    position: 'Staff',
    shift: 'Shift 2',
    baseSalary: 200,
    status: 'Active',
    telegramId: '5518297760',
    telegramUsername: '@hori100kim',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Female',
    dob: '2002-09-18',
    phone: '012 888 995',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789699051035',
    fullName: 'Sa',
    branchId: 'b2',
    position: 'Staff',
    shift: 'Shift 1',
    baseSalary: 200,
    status: 'Active',
    telegramId: '6614199703',
    telegramUsername: '@ykittsmora',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Female',
    dob: '2004-01-22',
    phone: '012 777 881',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789699227348',
    fullName: 'ជិន មុីលី ( Chin Meyly )',
    branchId: 'b1',
    position: 'Staff',
    shift: 'Shift 2',
    baseSalary: 200,
    status: 'Active',
    telegramId: '2126714694',
    telegramUsername: '@lyly_379',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Female',
    dob: '2003-06-30',
    phone: '012 888 996',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789699381356',
    fullName: 'Sovanrith ជឹម',
    branchId: 'b1',
    position: 'Staff',
    shift: 'Shift 1',
    baseSalary: 200,
    status: 'Active',
    telegramId: '7993479240',
    telegramUsername: '@aarithz',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Male',
    dob: '2001-12-10',
    phone: '012 888 997',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789699770628',
    fullName: 'Un Vatanak',
    branchId: 'b1',
    position: 'Staff',
    shift: 'Shift 1',
    baseSalary: 200,
    status: 'Active',
    telegramId: '1396834848',
    telegramUsername: '@unvatanak',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Male',
    dob: '2002-07-25',
    phone: '012 888 998',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789699931356',
    fullName: 'PR',
    branchId: 'b2',
    position: 'Staff',
    shift: 'Shift 1',
    baseSalary: 200,
    status: 'Active',
    telegramId: '366357620',
    telegramUsername: '@p6c5r',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Male',
    dob: '2000-04-14',
    phone: '012 777 882',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789701385492',
    fullName: 'Ly',
    branchId: 'b2',
    position: 'Staff',
    shift: 'Shift 1',
    baseSalary: 200,
    status: 'Active',
    telegramId: '8050507337',
    telegramUsername: '@pka_chuk_sor',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Female',
    dob: '2003-02-17',
    phone: '012 777 883',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1790569493073',
    fullName: 'អ៊ុជ',
    branchId: 'b2',
    position: 'Staff',
    shift: 'Shift 2',
    baseSalary: 200,
    status: 'Active',
    telegramId: '5050683180',
    telegramUsername: '@thavory_168',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Female',
    dob: '2002-10-09',
    phone: '012 777 884',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789699991145',
    fullName: 'Traa',
    branchId: 'b1',
    position: 'Staff',
    shift: 'Shift 1',
    baseSalary: 200,
    status: 'Active',
    telegramId: '1145957339',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Female',
    dob: '2004-05-10',
    phone: '012 888 980',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789699995024',
    fullName: 'Raa',
    branchId: 'b2',
    position: 'Staff',
    shift: 'Shift 2',
    baseSalary: 200,
    status: 'Active',
    telegramId: '5024959565',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Female',
    dob: '2003-08-11',
    phone: '012 777 885',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  },
  {
    id: 's_1789699996853',
    fullName: 'Travel Express',
    branchId: 'b1',
    position: 'Staff',
    shift: 'Shift 1',
    baseSalary: 200,
    status: 'Active',
    telegramId: '6853226183',
    telegramUsername: '@travelexpresskh',
    telegramLinked: true,
    attendanceEnabled: true,
    faceEnrolled: true,
    gender: 'Other',
    dob: '2000-01-01',
    phone: '012 888 981',
    address: 'Phnom Penh',
    startDate: '2026-01-01',
    idCardNumber: '',
    emergencyContact: '',
    photoUrl: ''
  }
];

const DEFAULT_EXTRA_SHIFTS = [
  {
    id: 'es_1789638395058',
    date: '2026-09-17',
    note: 'ថ្ងៃសម្រាកប្រចាំសប្តាហ៍',
    shift: 'Day Off',
    status: 'Pending',
    staffId: 's_1789445212450',
    branchId: 'all',
    createdAt: '2026-09-17T09:46:35.058Z',
    staffName: 'Liza',
    shiftCount: 1,
    totalAmount: 0,
    ratePerShift: 0,
    coveredForStaffId: 's_1789634905188',
    coveredForStaffName: 'លី រ៉ូហ្សា '
  }
];

const DEFAULT_LEAVE_REQUESTS = [
  {
    id: 'leave_1789863683009',
    staffId: 's_1789699005396',
    staffName: 'Lina',
    staffTelegramId: '1233881723',
    branchId: 'b1',
    branchName: 'toto by Chichi',
    date: '2026-09-20',
    leaveType: 'ឈឺ (Sick Leave)',
    requestType: 'leave',
    details: 'ឈឺ',
    reason: 'ឈឺ',
    status: 'Pending',
    createdAt: '2026-09-20T00:21:23.009Z'
  },
  {
    id: 'leave_1790312533806',
    staffId: 's_1789699274989',
    staffName: 'Jing',
    staffTelegramId: '1884877543',
    branchId: 'b1',
    branchName: 'toto by Chichi',
    date: '2026-09-25',
    leaveType: 'សម្រាកប្រចាំឆ្នាំ (Annual Leave)',
    requestType: 'leave',
    details: 'សម្រាកប្រចាំឆ្នាំ',
    reason: 'សម្រាកប្រចាំឆ្នាំ',
    status: 'Pending',
    createdAt: '2026-09-25T05:02:13.806Z'
  },
  {
    id: 'leave_1790495990226',
    staffId: 's_1789715204283',
    staffName: 'កូវ គឹមហ័រ',
    staffTelegramId: '5518297760',
    branchId: 'b1',
    branchName: 'toto by Chichi',
    date: '2026-09-27',
    leaveType: '⏰ ស្នើសុំមកយឺត (Late Arrival)',
    requestType: 'late_excused',
    details: 'សុំយឺត',
    reason: 'សុំយឺត',
    status: 'Pending',
    createdAt: '2026-09-27T07:59:50.226Z'
  },
  {
    id: 'leave_1789716470005',
    staffId: 's_1789445212450',
    staffName: 'Liza',
    staffTelegramId: '6853226183',
    branchId: 'b1',
    branchName: 'toto by Chichi',
    date: '2026-09-18',
    leaveType: '⏰ ស្នើសុំមកយឺត (Late Arrival)',
    requestType: 'late_excused',
    details: 'សុំយឺត',
    reason: 'សុំយឺត',
    status: 'Pending',
    createdAt: '2026-09-18T07:27:50.005Z'
  }
];

const DEFAULT_PAYLOAD: Record<string, any> = {
  branches: DEFAULT_BRANCHES,
  users: DEFAULT_USERS,
  staff: DEFAULT_STAFF,
  salaries: [],
  attendance: BASELINE_ATTENDANCE_74,
  incomes: [],
  expenses: [],
  inventory: [],
  machines: [],
  coinTransactions: [],
  revenueRecords: [],
  gasRecords: [],
  detergentRecords: [],
  softenerRecords: [],
  stockTransactions: [],
  suppliers: [],
  debts: [],
  debtPayments: [],
  cashDrawers: [],
  cashDrawerTransactions: [],
  monthClosings: [],
  salarySchedules: [],
  salaryAdvances: [],
  auditLogs: [],
  leaveRequests: DEFAULT_LEAVE_REQUESTS,
  extraShifts: DEFAULT_EXTRA_SHIFTS,
  tempShiftCovers: [],
  staffExpenses: [],
  adjustments: {},
  settings: {
    shopName: 'TC Staff Management',
    openingHours: '6:00 AM – 10:00 PM',
    mainCurrency: 'USD',
    khmerExchangeRate: 4100
  }
};

function normalizeKhmerDigits(str?: string): string {
  if (!str) return '';
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  let res = String(str);
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(khmerDigits[i], String(i));
  }
  return res;
}

function parseTimeToHours(tStr?: string): number | null {
  if (!tStr || tStr === '--' || !/\S/.test(tStr)) return null;
  let clean = normalizeKhmerDigits(tStr).trim();
  const isKhmerPM = /រសៀល|ល្ងាច|យប់/i.test(clean);
  const isKhmerAM = /ព្រឹក/i.test(clean);
  clean = clean.replace(/(\d{1,2})[.;](\d{2})/, '$1:$2');
  const match = clean.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|ព្រឹក|រសៀល|ល្ងាច|យប់)?/i);
  if (!match) {
    const singleMatch = clean.match(/^(\d{1,2})\s*(AM|PM|ព្រឹក|រសៀល|ល្ងាច|យប់)?$/i);
    if (!singleMatch) return null;
    let h = parseInt(singleMatch[1], 10);
    let ampm = (singleMatch[2] || '').toUpperCase();
    if (isKhmerPM) ampm = 'PM';
    if (isKhmerAM) ampm = 'AM';
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h;
  }
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  let ampm = (match[3] || '').toUpperCase();
  if (isKhmerPM) ampm = 'PM';
  if (isKhmerAM) ampm = 'AM';
  if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes >= 60) return null;
  if (ampm === 'PM' || ampm === 'រសៀល' || ampm === 'ល្ងាច' || ampm === 'យប់') {
    if (hours < 12) hours += 12;
  } else if (ampm === 'AM' || ampm === 'ព្រឹក') {
    if (hours === 12) hours = 0;
  }
  return hours + minutes / 60;
}

function calculateWorkHours(checkIn?: string, checkOut?: string, status?: string): number {
  if (status === 'Absent' || status === 'Permission') return 0;
  if (!checkIn || !checkOut || checkIn === '--' || checkOut === '--') return 0;
  const inH = parseTimeToHours(checkIn);
  const outH = parseTimeToHours(checkOut);
  if (inH === null || outH === null) return 0;
  let diff = outH - inH;
  if (diff < 0) diff += 24;
  return Math.round(diff * 100) / 100;
}

function getSupabaseClient() {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const supabaseKey = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = await getSupabaseClient();

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    let lastError = null;
    try {
      if (supabase) {
        const { data: tcRows, error: tcErr } = await supabase.from('tc_collections').select('id, data');
        if (tcErr) {
          lastError = tcErr.message;
          console.error('[sync-data] Supabase select error:', tcErr);
        }

        const db: Record<string, any> = { ...DEFAULT_PAYLOAD };
        if (Array.isArray(tcRows)) {
          for (const r of tcRows) {
            if (r && r.id && r.data !== undefined) {
              db[r.id] = r.data;
            }
          }
        }

        // Auto-heal only if collection row NEVER existed in Supabase database
        let needsDbHeal = false;
        const rowsToHeal: any[] = [];
        const existingRowIds = new Set((tcRows || []).map((r: any) => r && r.id).filter(Boolean));

        if (!existingRowIds.has('staff') && (!Array.isArray(db.staff) || db.staff.length === 0)) {
          db.staff = DEFAULT_STAFF;
          rowsToHeal.push({ id: 'staff', data: DEFAULT_STAFF, updated_at: new Date().toISOString() });
          needsDbHeal = true;
        }

        if (!existingRowIds.has('branches') && (!Array.isArray(db.branches) || db.branches.length === 0)) {
          db.branches = DEFAULT_BRANCHES;
          rowsToHeal.push({ id: 'branches', data: DEFAULT_BRANCHES, updated_at: new Date().toISOString() });
          needsDbHeal = true;
        }

        if (!existingRowIds.has('users') && (!Array.isArray(db.users) || db.users.length === 0)) {
          db.users = DEFAULT_USERS;
          rowsToHeal.push({ id: 'users', data: DEFAULT_USERS, updated_at: new Date().toISOString() });
          needsDbHeal = true;
        }

        if (!existingRowIds.has('extraShifts') && (!Array.isArray(db.extraShifts) || db.extraShifts.length === 0)) {
          db.extraShifts = DEFAULT_EXTRA_SHIFTS;
          rowsToHeal.push({ id: 'extraShifts', data: DEFAULT_EXTRA_SHIFTS, updated_at: new Date().toISOString() });
          needsDbHeal = true;
        }

        if (!existingRowIds.has('leaveRequests') && (!Array.isArray(db.leaveRequests) || db.leaveRequests.length === 0)) {
          db.leaveRequests = DEFAULT_LEAVE_REQUESTS;
          rowsToHeal.push({ id: 'leaveRequests', data: DEFAULT_LEAVE_REQUESTS, updated_at: new Date().toISOString() });
          needsDbHeal = true;
        }

        if (!Array.isArray(db.attendance) || db.attendance.length < 10) {
          const currentAtt = Array.isArray(db.attendance) ? db.attendance : [];
          const mergedMap = new Map<string, any>();
          for (const b of BASELINE_ATTENDANCE_74) {
            if (b && b.id) mergedMap.set(String(b.id), b);
            else if (b && b.staffId && b.date) mergedMap.set(`${b.staffId}_${b.date}`, b);
          }
          for (const a of currentAtt) {
            if (a && a.id) mergedMap.set(String(a.id), a);
            else if (a && a.staffId && a.date) mergedMap.set(`${a.staffId}_${a.date}`, a);
          }
          db.attendance = Array.from(mergedMap.values());
          rowsToHeal.push({ id: 'attendance', data: db.attendance, updated_at: new Date().toISOString() });
          needsDbHeal = true;
        }

        if (needsDbHeal && rowsToHeal.length > 0) {
          supabase.from('tc_collections').upsert(rowsToHeal, { onConflict: 'id' }).catch((e: any) => console.warn('Auto-heal upsert error:', e?.message));
        }

        const keys = Object.keys(db);
        if (keys.length > 0) {
          return res.status(200).json({
            success: true,
            data: db,
            db,
            source: 'supabase',
            collectionsCount: keys.length
          });
        }
      }
    } catch (err: any) {
      lastSupabaseErrorTime = Date.now();
      lastError = err.message;
    }

    return res.status(200).json({
      success: true,
      data: DEFAULT_PAYLOAD,
      db: DEFAULT_PAYLOAD,
      source: 'fallback',
      supabaseError: lastError
    });
  }

  if (req.method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    try {
      if (supabase) {
        const nowIso = new Date().toISOString();

        // Helper to reliably save or update a single collection row
        const saveOrUpdateRow = async (row: { id: string; data: any; updated_at: string }) => {
          // 1. Try upsert with updated_at
          const { error: upsertErr } = await supabase.from('tc_collections').upsert(row, { onConflict: 'id' });
          if (!upsertErr) return true;

          // 2. If upsert failed, try upsert WITHOUT updated_at (in case column doesn't exist)
          const { error: upsertNoDateErr } = await supabase.from('tc_collections').upsert({ id: row.id, data: row.data }, { onConflict: 'id' });
          if (!upsertNoDateErr) return true;

          // 3. Try update with updated_at
          const { error: updateErr } = await supabase.from('tc_collections').update({
            data: row.data,
            updated_at: row.updated_at
          }).eq('id', row.id);
          if (!updateErr) return true;

          // 4. Try update without updated_at
          const { error: updateNoDateErr } = await supabase.from('tc_collections').update({
            data: row.data
          }).eq('id', row.id);
          if (!updateNoDateErr) return true;

          // 5. Try insert with updated_at
          const { error: insertErr } = await supabase.from('tc_collections').insert(row);
          if (!insertErr) return true;

          // 6. Try insert without updated_at
          const { error: insertNoDateErr } = await supabase.from('tc_collections').insert({ id: row.id, data: row.data });
          if (!insertNoDateErr) return true;

          console.error(`[sync-data] All save strategies failed for ${row.id}:`, insertNoDateErr?.message || upsertErr?.message);
          return false;
        };

        // 1. Explicit item deletion from a collection
        if (body.deleteCollectionItem && body.collection && body.itemId) {
          const { collection, itemId } = body;
          const { data: row } = await supabase.from('tc_collections').select('data').eq('id', collection).maybeSingle();
          const existingList = (row && Array.isArray(row.data)) ? row.data : [];
          const clientList = Array.isArray(body[collection]) ? body[collection] : null;
          const baseList = clientList || existingList;
          const filtered = baseList.filter((item: any) => item && item.id !== itemId);

          const ok = await saveOrUpdateRow({
            id: collection,
            data: filtered,
            updated_at: nowIso
          });

          if (!ok) {
            console.error(`[sync-data] Failed to delete item ${itemId} from ${collection}`);
            return res.status(500).json({ success: false, error: `Failed to delete item from ${collection}` });
          }

          return res.status(200).json({
            success: true,
            collection,
            remainingCount: filtered.length,
            deletedItemId: itemId,
            data: filtered
          });
        }

        // 1b. Ultra-lightweight Single Item Upsert (< 5KB payload)
        if (body.updateCollectionItem && body.updateCollectionItem.collection && body.updateCollectionItem.item) {
          const { collection, item } = body.updateCollectionItem;
          const { data: row } = await supabase.from('tc_collections').select('data').eq('id', collection).maybeSingle();
          let list = (row && Array.isArray(row.data)) ? [...row.data] : [];

          if (collection === 'attendance') {
            const idx = list.findIndex((a: any) => (a && item) && (a.id === item.id || (a.staffId === item.staffId && a.date === item.date)));
            if (idx >= 0) {
              const existing = list[idx];
              const isValidTime = (t: any) => Boolean(t && t !== '--' && String(t).trim().length > 0 && !String(t).toLowerCase().includes('absent'));
              const checkIn = isValidTime(item.checkIn) ? item.checkIn : (isValidTime(existing.checkIn) ? existing.checkIn : (item.checkIn || '--'));
              const checkOut = isValidTime(item.checkOut) ? item.checkOut : (isValidTime(existing.checkOut) ? existing.checkOut : (item.checkOut || '--'));
              let status = item.status || existing.status || 'Present';
              if (isValidTime(checkOut) && (status === 'Working' || !status)) status = 'Completed';
              let workHours = item.workHours;
              if (workHours === undefined || workHours === null || workHours <= 0) {
                if (isValidTime(checkIn) && isValidTime(checkOut) && status !== 'Absent' && status !== 'Permission') {
                  workHours = calculateWorkHours(checkIn, checkOut, status);
                }
              }
              list[idx] = {
                ...existing,
                ...item,
                checkIn,
                checkOut,
                status,
                workHours: workHours ?? 0,
                checkInPhoto: item.checkInPhoto || existing.checkInPhoto,
                checkOutPhoto: item.checkOutPhoto || existing.checkOutPhoto,
                updatedAt: nowIso
              };
            } else {
              const isValidTime = (t: any) => Boolean(t && t !== '--' && String(t).trim().length > 0 && !String(t).toLowerCase().includes('absent'));
              const checkIn = item.checkIn || '--';
              const checkOut = item.checkOut || '--';
              let status = item.status || (isValidTime(checkOut) ? 'Completed' : (isValidTime(checkIn) ? 'Present' : 'Absent'));
              if (isValidTime(checkOut) && (status === 'Working' || !status)) status = 'Completed';
              let workHours = item.workHours;
              if (workHours === undefined || workHours === null || workHours <= 0) {
                if (isValidTime(checkIn) && isValidTime(checkOut) && status !== 'Absent' && status !== 'Permission') {
                  workHours = calculateWorkHours(checkIn, checkOut, status);
                } else {
                  workHours = 0;
                }
              }
              list.unshift({
                ...item,
                checkIn,
                checkOut,
                status,
                workHours: workHours ?? 0,
                updatedAt: nowIso
              });
            }
          } else {
            const idx = list.findIndex((x: any) => x && item && x.id === item.id);
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...item, updatedAt: nowIso };
            } else {
              list.unshift(item);
            }
          }

          const ok = await saveOrUpdateRow({
            id: collection,
            data: list,
            updated_at: nowIso
          });

          if (!ok) {
            return res.status(500).json({ success: false, error: `Failed to update item in ${collection}` });
          }

          return res.status(200).json({
            success: true,
            collection,
            updatedItem: item,
            totalCount: list.length
          });
        }

        // 1c. Attendance Delta Upsert (Array of modified records)
        if (body.attendanceDelta && Array.isArray(body.attendanceDelta) && body.attendanceDelta.length > 0) {
          const { data: row } = await supabase.from('tc_collections').select('data').eq('id', 'attendance').maybeSingle();
          let list = (row && Array.isArray(row.data)) ? [...row.data] : [];

          for (const item of body.attendanceDelta) {
            if (!item) continue;
            const idx = list.findIndex((a: any) => a && (a.id === item.id || (a.staffId === item.staffId && a.date === item.date)));
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...item, updatedAt: nowIso };
            } else {
              list.unshift(item);
            }
          }

          const ok = await saveOrUpdateRow({
            id: 'attendance',
            data: list,
            updated_at: nowIso
          });

          if (!ok) {
            return res.status(500).json({ success: false, error: 'Failed to save attendance delta' });
          }

          return res.status(200).json({
            success: true,
            collection: 'attendance',
            updatedCount: body.attendanceDelta.length,
            totalCount: list.length
          });
        }

        // 2. Fetch existing collections
        const { data: existingRows } = await supabase.from('tc_collections').select('id, data');
        const existingMap: Record<string, any> = {};
        if (Array.isArray(existingRows)) {
          for (const r of existingRows) {
            if (r && r.id) existingMap[r.id] = r.data;
          }
        }

        const entries = Object.entries(body).filter(([k]) => k !== 'deleteCollectionItem' && k !== 'collection' && k !== 'itemId');
        const rows: any[] = [];

        for (const [collectionId, collectionData] of entries) {
          let finalData = collectionData;

          // Guard: Never wipe an existing populated collection with an empty array or empty object unless explicitly deleting
          if (Array.isArray(collectionData) && collectionData.length === 0) {
            const serverItems = existingMap[collectionId];
            if (Array.isArray(serverItems) && serverItems.length > 0) {
              console.warn(`[sync-data] WIPE GUARD: Blocked overwriting collection "${collectionId}" (${serverItems.length} items) with empty array.`);
              continue;
            }
          } else if (collectionData && typeof collectionData === 'object' && !Array.isArray(collectionData) && Object.keys(collectionData).length === 0) {
            const serverObj = existingMap[collectionId];
            if (serverObj && typeof serverObj === 'object' && !Array.isArray(serverObj) && Object.keys(serverObj).length > 0) {
              console.warn(`[sync-data] WIPE GUARD: Blocked overwriting collection "${collectionId}" with empty object.`);
              continue;
            }
          }

          // Smart-merge attendance: Never erase live scan records created via mobile/Telegram/Face or admin edits
          if (collectionId === 'attendance' && Array.isArray(collectionData)) {
            const isValidTime = (t: any): boolean => {
              if (!t || t === '--' || typeof t !== 'string') return false;
              return /\d/.test(t.trim()) && !t.toLowerCase().includes('absent');
            };

            const mergeAttendance = (serverItem: any, clientItem: any) => {
              const clientTime = new Date(clientItem.updatedAt || clientItem.createdAt || 0).getTime();
              const serverTime = new Date(serverItem.updatedAt || serverItem.createdAt || 0).getTime();
              const isClientNewer = clientTime >= serverTime;

              const base = isClientNewer ? { ...serverItem, ...clientItem } : { ...clientItem, ...serverItem };

              // Resolve checkIn: Never wipe a valid checkIn with empty or '--'
              if (isValidTime(clientItem.checkIn) && !isValidTime(serverItem.checkIn)) {
                base.checkIn = clientItem.checkIn;
              } else if (isValidTime(serverItem.checkIn) && !isValidTime(clientItem.checkIn)) {
                base.checkIn = serverItem.checkIn;
              } else if (isValidTime(clientItem.checkIn) && isValidTime(serverItem.checkIn)) {
                base.checkIn = isClientNewer ? clientItem.checkIn : serverItem.checkIn;
              } else {
                base.checkIn = clientItem.checkIn || serverItem.checkIn || '--';
              }

              // Resolve checkOut: Never wipe a valid checkOut with empty or '--'
              if (isValidTime(clientItem.checkOut) && !isValidTime(serverItem.checkOut)) {
                base.checkOut = clientItem.checkOut;
                base.status = (base.status === 'Working' || !base.status) ? 'Completed' : base.status;
              } else if (isValidTime(serverItem.checkOut) && !isValidTime(clientItem.checkOut)) {
                base.checkOut = serverItem.checkOut;
                base.status = (base.status === 'Working' || !base.status) ? 'Completed' : base.status;
              } else if (isValidTime(clientItem.checkOut) && isValidTime(serverItem.checkOut)) {
                base.checkOut = isClientNewer ? clientItem.checkOut : serverItem.checkOut;
              } else {
                base.checkOut = clientItem.checkOut || serverItem.checkOut || '--';
              }

              if (isValidTime(base.checkOut) && (base.status === 'Working' || !base.status)) {
                base.status = 'Completed';
              }

              if (isValidTime(base.checkIn) && isValidTime(base.checkOut) && base.status !== 'Absent' && base.status !== 'Permission') {
                base.workHours = calculateWorkHours(base.checkIn, base.checkOut, base.status);
              } else if (base.status === 'Absent' || base.status === 'Permission') {
                base.workHours = 0;
              }

              base.checkInPhoto = clientItem.checkInPhoto || serverItem.checkInPhoto;
              base.checkOutPhoto = clientItem.checkOutPhoto || serverItem.checkOutPhoto;
              base.checkInFaceScore = clientItem.checkInFaceScore ?? serverItem.checkInFaceScore;
              base.checkOutFaceScore = clientItem.checkOutFaceScore ?? serverItem.checkOutFaceScore;
              base.checkInLatitude = clientItem.checkInLatitude ?? serverItem.checkInLatitude;
              base.checkInLongitude = clientItem.checkInLongitude ?? serverItem.checkInLongitude;
              base.checkOutLatitude = clientItem.checkOutLatitude ?? serverItem.checkOutLatitude;
              base.checkOutLongitude = clientItem.checkOutLongitude ?? serverItem.checkOutLongitude;

              const historyMap = new Map<string, any>();
              (serverItem.auditHistory || []).forEach((h: any) => historyMap.set(h.changedAt || JSON.stringify(h), h));
              (clientItem.auditHistory || []).forEach((h: any) => historyMap.set(h.changedAt || JSON.stringify(h), h));
              base.auditHistory = Array.from(historyMap.values());

              base.updatedAt = new Date(Math.max(clientTime, serverTime, Date.now())).toISOString();

              return base;
            };

            const serverAtt = Array.isArray(existingMap['attendance']) ? existingMap['attendance'] : [];
            const mergedMap = new Map<string, any>();

            for (const item of serverAtt) {
              if (item && item.id) {
                mergedMap.set(String(item.id), item);
              } else if (item && item.staffId && item.date) {
                mergedMap.set(`${item.staffId}_${item.date}`, item);
              }
            }

            for (const clientItem of collectionData) {
              if (!clientItem) continue;
              let existingKey: string | null = null;
              if (clientItem.id && mergedMap.has(String(clientItem.id))) {
                existingKey = String(clientItem.id);
              } else if (clientItem.staffId && clientItem.date && mergedMap.has(`${clientItem.staffId}_${clientItem.date}`)) {
                existingKey = `${clientItem.staffId}_${clientItem.date}`;
              } else {
                for (const [k, v] of mergedMap.entries()) {
                  if (v && v.staffId === clientItem.staffId && v.date === clientItem.date) {
                    existingKey = k;
                    break;
                  }
                }
              }

              if (!existingKey) {
                const newKey = clientItem.id ? String(clientItem.id) : `${clientItem.staffId}_${clientItem.date}`;
                mergedMap.set(newKey, clientItem);
              } else {
                const existing = mergedMap.get(existingKey);
                mergedMap.set(existingKey, mergeAttendance(existing, clientItem));
              }
            }

            finalData = Array.from(mergedMap.values()).map(item => {
              if (item && isValidTime(item.checkIn) && isValidTime(item.checkOut) && item.status !== 'Absent' && item.status !== 'Permission') {
                if (item.workHours === undefined || item.workHours === null || item.workHours <= 0) {
                  item.workHours = calculateWorkHours(item.checkIn, item.checkOut, item.status);
                }
              }
              return item;
            });
          }

          // Smart-merge leaveRequests
          if (collectionId === 'leaveRequests' && Array.isArray(collectionData)) {
            const serverLeaves = Array.isArray(existingMap['leaveRequests']) ? existingMap['leaveRequests'] : [];
            const mergedMap = new Map<string, any>();
            for (const item of serverLeaves) {
              if (item && item.id) mergedMap.set(String(item.id), item);
            }
            for (const clientItem of collectionData) {
              if (clientItem && clientItem.id) {
                const exist = mergedMap.get(String(clientItem.id));
                if (!exist || new Date(clientItem.updatedAt || 0).getTime() >= new Date(exist.updatedAt || 0).getTime()) {
                  mergedMap.set(String(clientItem.id), { ...(exist || {}), ...clientItem });
                }
              }
            }
            finalData = Array.from(mergedMap.values());
          }

          // Smart-merge staff (Preserve photoUrl and faceReference when sanitized payload is pushed)
          if (collectionId === 'staff' && Array.isArray(collectionData)) {
            const serverStaff = Array.isArray(existingMap['staff']) ? existingMap['staff'] : [];
            const mergedMap = new Map<string, any>();
            for (const item of serverStaff) {
              if (item && item.id) mergedMap.set(String(item.id), item);
            }
            for (const clientItem of collectionData) {
              if (clientItem && clientItem.id) {
                const exist = mergedMap.get(String(clientItem.id));
                if (exist) {
                  mergedMap.set(String(clientItem.id), {
                    ...exist,
                    ...clientItem,
                    photoUrl: clientItem.photoUrl || exist.photoUrl,
                    faceReference: clientItem.faceReference || exist.faceReference,
                    updatedAt: clientItem.updatedAt || exist.updatedAt || nowIso
                  });
                } else {
                  mergedMap.set(String(clientItem.id), clientItem);
                }
              }
            }
            finalData = Array.from(mergedMap.values());
          }

          rows.push({
            id: collectionId,
            data: finalData,
            updated_at: nowIso
          });
        }

        if (rows.length > 0) {
          // Parallel, high-speed, non-blocking row saving for all collections
          await Promise.all(rows.map(row => saveOrUpdateRow(row)));
        }

        return res.status(200).json({
          success: true,
          data: body,
          db: body,
          source: 'supabase_upserted',
          updatedCount: rows.length
        });
      }
    } catch (err: any) {
      console.error('[Vercel Serverless] Supabase push error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }

    return res.status(500).json({
      success: false,
      error: 'Supabase client is not configured on server (missing SUPABASE_URL or SUPABASE_ANON_KEY)'
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

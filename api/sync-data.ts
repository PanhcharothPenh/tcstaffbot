import { createClient } from '@supabase/supabase-js';


let lastSupabaseErrorTime = 0;


const BASELINE_ATTENDANCE_74: any[] = [
  {
    "id": "att_1790606624979",
    "date": "2026-09-28",
    "notes": "មកយឺត 523 នាទី (ស្មើ ~$8.35 - មិនកាត់ប្រាក់) [មូលហេតុ: jos hz ai]",
    "source": "telegram",
    "status": "Late",
    "checkIn": "09:43 PM",
    "isOwner": false,
    "staffId": "s_1789699227348",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-28T14:43:44.978Z",
    "shiftType": "Shift 2",
    "staffName": "អ៊ុជ ថាវរី (ToTo B)",
    "updatedAt": "2026-09-28T14:43:44.978Z",
    "workHours": 0,
    "lateReason": "jos hz ai",
    "lateMinutes": 523,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 18,
    "checkInLatitude": 11.541522131614926,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89208950920812,
    "indicativeLateAmount": 8.35
  },
  {
    "id": "att_1790587320662",
    "date": "2026-09-28",
    "notes": "កត់ត្រាវត្តមានដោយដៃ (Manual Entry)",
    "source": "manual",
    "status": "Completed",
    "checkIn": "02:២0 PM",
    "isOwner": false,
    "staffId": "s_1789634905188",
    "branchId": "b2",
    "checkOut": "09:01 PM",
    "createdAt": "2026-09-28T09:22:00.662Z",
    "shiftType": "Shift 2",
    "staffName": "លី រ៉ូហ្សា (Corner B)",
    "updatedAt": "2026-09-28T14:01:01.532Z",
    "workHours": 21.02,
    "auditHistory": [
      {
        "field": "Created",
        "reason": "កត់ត្រាវត្តមានដោយដៃ (Manual Entry)",
        "newValue": "Manual Entry",
        "oldValue": null,
        "changedAt": "2026-09-28T09:22:00.662Z",
        "changedBy": "Owner"
      },
      {
        "field": "checkIn",
        "reason": "ស្ទះផ្លូវ",
        "newValue": "02:២0 PM",
        "oldValue": "02:00 PM",
        "changedAt": "2026-09-28T09:23:52.262Z",
        "changedBy": "Owner"
      },
      {
        "field": "checkOut",
        "reason": "ស្ទះផ្លូវ",
        "newValue": "",
        "oldValue": "09:00 PM",
        "changedAt": "2026-09-28T09:23:52.262Z",
        "changedBy": "Owner"
      },
      {
        "field": "status",
        "reason": "ស្ទះផ្លូវ",
        "newValue": "Late",
        "oldValue": "Present",
        "changedAt": "2026-09-28T09:23:52.262Z",
        "changedBy": "Owner"
      }
    ],
    "overtimeHours": 0,
    "checkOutDistance": 269,
    "checkOutLatitude": 11.534271828551597,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88150871723063
  },
  {
    "id": "att_1790575115367",
    "date": "2026-09-28",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "12:58 PM",
    "isOwner": false,
    "staffId": "s_1790569493073",
    "branchId": "b1",
    "checkOut": "09:30 PM",
    "createdAt": "2026-09-28T05:58:35.367Z",
    "shiftType": "Shift 2",
    "staffName": "អ៊ុន វឌ្ឍនៈ (ToTo B)",
    "updatedAt": "2026-09-28T14:30:51.697Z",
    "workHours": 8.53,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 13,
    "checkInLatitude": 11.5414692,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.892075,
    "checkOutDistance": 14,
    "checkOutLatitude": 11.5414926,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.8920638,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_perm_1790570873474",
    "date": "2026-09-20",
    "notes": "ច្បាប់ឈប់សម្រាក (សុំច្បាប់ ធុរៈផ្ទាល់ខ្លួន (មកកម្មវិធីសិក្ខាសាលា))",
    "source": "manual",
    "status": "Permission",
    "checkIn": "--",
    "staffId": "s_1789699274989",
    "branchId": "b1",
    "checkOut": "--",
    "createdAt": "2026-09-28T04:47:53.474Z",
    "staffName": "ចយ ស្រីជីង (ToTo B)",
    "workHours": 0,
    "branchName": "Toto By Chi Chi MC Park",
    "isLateExcused": false,
    "lateDeduction": 1,
    "overtimeHours": 0
  },
  {
    "id": "att_perm_1790570791573",
    "date": "2026-09-25",
    "notes": "ច្បាប់ឈប់សម្រាក (សុំច្បាប់ សម្រាកប្រចាំឆ្នាំ (ចូលរួមកម្មវិធីស្ម័គ្រចិត្តនៅកំពត))",
    "source": "manual",
    "status": "Permission",
    "checkIn": "--",
    "staffId": "s_1789699274989",
    "branchId": "b1",
    "checkOut": "--",
    "createdAt": "2026-09-28T04:46:31.573Z",
    "staffName": "ចយ ស្រីជីង (ToTo B)",
    "workHours": 0,
    "branchName": "Toto By Chi Chi MC Park",
    "isLateExcused": false,
    "lateDeduction": 1,
    "overtimeHours": 0
  },
  {
    "id": "att_1790566718260",
    "date": "2026-09-28",
    "notes": "មកយឺត 248 នាទី (ស្មើ ~$2.47 - មិនកាត់ប្រាក់) [មូលហេតុ: បើក app អត់ចេញ]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "10:38 AM",
    "isOwner": false,
    "staffId": "s_1789699931356",
    "branchId": "b1",
    "checkOut": "04:11 PM",
    "createdAt": "2026-09-28T03:38:38.259Z",
    "shiftType": "Shift 1",
    "staffName": "ជឹម សុវណ្ណរិទ្ធ (ToTo A)",
    "updatedAt": "2026-09-28T09:11:50.793Z",
    "workHours": 5.55,
    "lateReason": "បើក app អត់ចេញ",
    "lateMinutes": 248,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 13,
    "checkInLatitude": 11.5414597,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.892072,
    "checkOutDistance": 13,
    "checkOutLatitude": 11.5414597,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.892072,
    "indicativeLateAmount": 2.47
  },
  {
    "id": "att_1790553436284",
    "date": "2026-09-28",
    "notes": "មកយឺត 27 នាទី (ស្មើ ~$0.34 - មិនកាត់ប្រាក់) [មូលហេតុ: អាវអត់ស្ងួតទេបងយប់មិញOTទៀតអស់អាវ]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:57 AM",
    "isOwner": false,
    "staffId": "s_1789699051035",
    "branchId": "b2",
    "checkOut": "05:04 PM",
    "createdAt": "2026-09-27T23:57:16.253Z",
    "shiftType": "Shift 1",
    "staffName": "សា សុមរកត (Corner A)",
    "updatedAt": "2026-09-28T10:04:39.044Z",
    "workHours": 10.12,
    "lateReason": "អាវអត់ស្ងួតទេបងយប់មិញOTទៀតអស់អាវ",
    "lateMinutes": 27,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 270,
    "checkInLatitude": 11.534194486737578,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88151909236088,
    "checkOutDistance": 277,
    "checkOutLatitude": 11.534151010915163,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.8815915463347,
    "indicativeLateAmount": 0.34
  },
  {
    "id": "att_1790552900786",
    "date": "2026-09-28",
    "notes": "មកយឺត 18 នាទី (ស្មើ ~$0.22 - មិនកាត់ប្រាក់) [មូលហេតុ: 🙏]",
    "source": "telegram",
    "status": "Late",
    "checkIn": "06:48 AM",
    "isOwner": false,
    "staffId": "s_1789699381356",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-27T23:48:20.786Z",
    "shiftType": "Shift 1",
    "staffName": "កុង តារា (ToTo A)",
    "updatedAt": "2026-09-27T23:48:20.786Z",
    "workHours": 0,
    "lateReason": "🙏",
    "lateMinutes": 18,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 8,
    "checkInLatitude": 11.541452155648734,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89202832179019,
    "indicativeLateAmount": 0.22
  },
  {
    "id": "att_1790551776432",
    "date": "2026-09-28",
    "source": "telegram",
    "status": "Working",
    "checkIn": "06:29 AM",
    "isOwner": false,
    "staffId": "s_1789701385492",
    "branchId": "b2",
    "checkOut": "",
    "createdAt": "2026-09-27T23:29:36.430Z",
    "shiftType": "Shift 1",
    "staffName": "ជិន មុីលី (Corner A)",
    "updatedAt": "2026-09-27T23:29:36.430Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 274,
    "checkInLatitude": 11.534177484528989,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88156033560237,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790501235874",
    "date": "2026-09-27",
    "notes": "មកយឺត 597 នាទី (ស្មើ ~$7.33 - មិនកាត់ប្រាក់) [មូលហេតុ: ចូលម្ដងហើយ]",
    "source": "telegram",
    "status": "Late",
    "checkIn": "04:27 PM",
    "isOwner": false,
    "staffId": "s_1789699381356",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-27T09:27:15.874Z",
    "shiftType": "Shift 1",
    "staffName": "កុង តារា (ToTo A)",
    "updatedAt": "2026-09-27T09:27:15.874Z",
    "workHours": 0,
    "lateReason": "ចូលម្ដងហើយ",
    "lateMinutes": 597,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 12,
    "checkInLatitude": 11.541495562017456,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89203998370627,
    "indicativeLateAmount": 7.33
  },
  {
    "id": "att_1790492948176",
    "date": "2026-09-27",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "02:09 PM",
    "isOwner": false,
    "staffId": "s_1789634905188",
    "branchId": "b2",
    "checkOut": "09:02 PM",
    "createdAt": "2026-09-27T07:09:08.175Z",
    "shiftType": "Shift 2",
    "staffName": "លី រ៉ូហ្សា (Corner B)",
    "updatedAt": "2026-09-27T14:02:11.600Z",
    "workHours": 6.88,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 268,
    "checkInLatitude": 11.534188025449737,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88150393404045,
    "checkOutDistance": 266,
    "checkOutLatitude": 11.53429481518462,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88148014884156,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790488761430",
    "date": "2026-09-27",
    "source": "telegram",
    "status": "Working",
    "checkIn": "12:59 PM",
    "isOwner": false,
    "staffId": "s_1789699227348",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-27T05:59:21.429Z",
    "shiftType": "Shift 2",
    "staffName": "អ៊ុជ ថាវរី (ToTo B)",
    "updatedAt": "2026-09-27T05:59:21.429Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 25,
    "checkInLatitude": 11.541431215385108,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89219500717485,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790466460103",
    "date": "2026-09-27",
    "source": "telegram",
    "status": "Working",
    "checkIn": "06:47 AM",
    "isOwner": false,
    "staffId": "s_1789699005396",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-26T23:47:40.102Z",
    "shiftType": "Shift 2",
    "staffName": "ជុន សុលីណា (Corner)",
    "updatedAt": "2026-09-26T23:47:40.102Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 19,
    "checkInLatitude": 11.541553992421328,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89207523069803,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790465391878",
    "date": "2026-09-27",
    "source": "telegram",
    "status": "Working",
    "checkIn": "06:29 AM",
    "isOwner": false,
    "staffId": "s_1789699051035",
    "branchId": "b2",
    "checkOut": "",
    "createdAt": "2026-09-26T23:29:51.877Z",
    "shiftType": "Shift 1",
    "staffName": "សា សុមរកត (Corner A)",
    "updatedAt": "2026-09-26T23:29:51.877Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 271,
    "checkInLatitude": 11.53416170899843,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88153394115822,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790465314494",
    "date": "2026-09-27",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:28 AM",
    "isOwner": false,
    "staffId": "s_1789701385492",
    "branchId": "b2",
    "checkOut": "02:17 PM",
    "createdAt": "2026-09-26T23:28:34.492Z",
    "shiftType": "Shift 1",
    "staffName": "ជិន មុីលី (Corner A)",
    "updatedAt": "2026-09-27T07:17:11.404Z",
    "workHours": 7.82,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 279,
    "checkInLatitude": 11.534076368387108,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88161134696018,
    "checkOutDistance": 269,
    "checkOutLatitude": 11.534173106717608,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88151413106449,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790402767266",
    "date": "2026-09-26",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:06 PM",
    "isOwner": false,
    "staffId": "s_1789715204283",
    "branchId": "b1",
    "checkOut": "09:13 PM",
    "createdAt": "2026-09-26T06:06:07.265Z",
    "shiftType": "Shift 2",
    "staffName": "កូវ គឹមហ័រ (ToTo B)",
    "updatedAt": "2026-09-26T14:13:04.267Z",
    "workHours": 8.12,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 19,
    "checkInLatitude": 11.541581428487014,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.8920260278765,
    "checkOutDistance": 18,
    "checkOutLatitude": 11.54156967899013,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89201293629607,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790402242730",
    "date": "2026-09-26",
    "source": "telegram",
    "status": "Working",
    "checkIn": "12:57 PM",
    "isOwner": false,
    "staffId": "s_1789699227348",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-26T05:57:22.728Z",
    "shiftType": "Shift 2",
    "staffName": "អ៊ុជ ថាវរី (ToTo B)",
    "updatedAt": "2026-09-26T05:57:22.728Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 15,
    "checkInLatitude": 11.541546774107536,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89201337108844,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790380681037",
    "date": "2026-09-26",
    "source": "telegram",
    "status": "Working",
    "checkIn": "06:58 AM",
    "isOwner": false,
    "staffId": "s_1789699005396",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-25T23:58:01.037Z",
    "shiftType": "Shift 2",
    "staffName": "ជុន សុលីណា (Corner)",
    "updatedAt": "2026-09-25T23:58:01.037Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 29,
    "checkInLatitude": 11.541569279517551,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.8921863735699,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790379931089",
    "date": "2026-09-26",
    "notes": "មកយឺត 15 នាទី (ស្មើ ~$0.19 - មិនកាត់ប្រាក់) [មូលហេតុ: មេឃភ្លៀងអត់ទាន់រាំងទេបង😭]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:45 AM",
    "isOwner": false,
    "staffId": "s_1789699051035",
    "branchId": "b2",
    "checkOut": "02:12 PM",
    "createdAt": "2026-09-25T23:45:31.088Z",
    "shiftType": "Shift 1",
    "staffName": "សា សុមរកត (Corner A)",
    "updatedAt": "2026-09-26T07:12:46.467Z",
    "workHours": 7.45,
    "lateReason": "មេឃភ្លៀងអត់ទាន់រាំងទេបង😭",
    "lateMinutes": 15,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 268,
    "checkInLatitude": 11.534173205087123,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88150366858741,
    "checkOutDistance": 277,
    "checkOutLatitude": 11.534151010915163,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.8815915463347,
    "indicativeLateAmount": 0.19
  },
  {
    "id": "att_1790379807403",
    "date": "2026-09-26",
    "notes": "មកយឺត 13 នាទី (ស្មើ ~$0.16 - មិនកាត់ប្រាក់) [មូលហេតុ: 🙏]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:43 AM",
    "isOwner": false,
    "staffId": "s_1789699381356",
    "branchId": "b1",
    "checkOut": "04:35 PM",
    "createdAt": "2026-09-25T23:43:27.402Z",
    "shiftType": "Shift 1",
    "staffName": "កុង តារា (ToTo A)",
    "updatedAt": "2026-09-26T09:35:26.433Z",
    "workHours": 9.87,
    "lateReason": "🙏",
    "lateMinutes": 13,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 22,
    "checkInLatitude": 11.541611141270945,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89201387179209,
    "checkOutDistance": 13,
    "checkOutLatitude": 11.541505597742168,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89204066570849,
    "indicativeLateAmount": 0.16
  },
  {
    "id": "att_1790378952014",
    "date": "2026-09-26",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:29 AM",
    "isOwner": false,
    "staffId": "s_1789701385492",
    "branchId": "b2",
    "checkOut": "02:05 PM",
    "createdAt": "2026-09-25T23:29:12.013Z",
    "shiftType": "Shift 1",
    "staffName": "ជិន មុីលី (Corner A)",
    "updatedAt": "2026-09-26T07:05:50.221Z",
    "workHours": 7.6,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 267,
    "checkInLatitude": 11.534259188419801,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88149056106684,
    "checkOutDistance": 268,
    "checkOutLatitude": 11.534225064693686,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88150049908008,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790319719676",
    "date": "2026-09-25",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "02:01 PM",
    "isOwner": false,
    "staffId": "s_1789634905188",
    "branchId": "b2",
    "checkOut": "09:03 PM",
    "createdAt": "2026-09-25T07:01:59.675Z",
    "shiftType": "Shift 2",
    "staffName": "លី រ៉ូហ្សា (Corner B)",
    "updatedAt": "2026-09-25T14:03:20.999Z",
    "workHours": 7.03,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 269,
    "checkInLatitude": 11.534172894973338,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.8815187029252,
    "checkOutDistance": 266,
    "checkOutLatitude": 11.53429481518462,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88148014884156,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790316313993",
    "date": "2026-09-25",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:05 PM",
    "isOwner": false,
    "staffId": "s_1789715204283",
    "branchId": "b1",
    "checkOut": "09:08 PM",
    "createdAt": "2026-09-25T06:05:13.992Z",
    "shiftType": "Shift 2",
    "staffName": "កូវ គឹមហ័រ (ToTo B)",
    "updatedAt": "2026-09-25T14:08:39.147Z",
    "workHours": 8.05,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 19,
    "checkInLatitude": 11.541583431953283,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89202359720667,
    "checkOutDistance": 8,
    "checkOutLatitude": 11.541358390833755,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89201127561265,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790315483072",
    "date": "2026-09-25",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "12:51 PM",
    "isOwner": false,
    "staffId": "s_1789699227348",
    "branchId": "b1",
    "checkOut": "09:08 PM",
    "createdAt": "2026-09-25T05:51:23.071Z",
    "shiftType": "Shift 2",
    "staffName": "អ៊ុជ ថាវរី (ToTo B)",
    "updatedAt": "2026-09-25T14:08:19.628Z",
    "workHours": 8.28,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 18,
    "checkInLatitude": 11.541514555348302,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89209894702421,
    "checkOutDistance": 18,
    "checkOutLatitude": 11.541514555348302,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89209894702421,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790293599511",
    "date": "2026-09-25",
    "notes": "មកយឺត 16 នាទី (ស្មើ ~$0.20 - មិនកាត់ប្រាក់) [មូលហេតុ: 🙏]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:46 AM",
    "isOwner": false,
    "staffId": "s_1789699381356",
    "branchId": "b1",
    "checkOut": "04:23 PM",
    "createdAt": "2026-09-24T23:46:39.510Z",
    "shiftType": "Shift 1",
    "staffName": "កុង តារា (ToTo A)",
    "updatedAt": "2026-09-25T09:23:04.998Z",
    "workHours": 9.62,
    "lateReason": "🙏",
    "lateMinutes": 16,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 15,
    "checkInLatitude": 11.541520706683505,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89205559052358,
    "checkOutDistance": 21,
    "checkOutLatitude": 11.54157069942887,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89207219397895,
    "indicativeLateAmount": 0.2
  },
  {
    "id": "att_1790293128990",
    "date": "2026-09-25",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:38 AM",
    "isOwner": false,
    "staffId": "s_1789699051035",
    "branchId": "b2",
    "checkOut": "02:20 PM",
    "createdAt": "2026-09-24T23:38:48.989Z",
    "shiftType": "Shift 1",
    "staffName": "សា សុមរកត (Corner A)",
    "updatedAt": "2026-09-25T07:20:43.337Z",
    "workHours": 7.7,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 277,
    "checkInLatitude": 11.534151010915163,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.8815915463347,
    "checkOutDistance": 268,
    "checkOutLatitude": 11.534176710339567,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88150128741205,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790292566743",
    "date": "2026-09-25",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:29 AM",
    "isOwner": false,
    "staffId": "s_1789701385492",
    "branchId": "b2",
    "checkOut": "02:05 PM",
    "createdAt": "2026-09-24T23:29:26.742Z",
    "shiftType": "Shift 1",
    "staffName": "ជិន មុីលី (Corner A)",
    "updatedAt": "2026-09-25T07:05:05.474Z",
    "workHours": 7.6,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 276,
    "checkInLatitude": 11.534011233608735,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88157832073502,
    "checkOutDistance": 268,
    "checkOutLatitude": 11.534197934988178,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88150025226376,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790233100142",
    "date": "2026-09-24",
    "source": "telegram",
    "status": "Working",
    "checkIn": "01:58 PM",
    "isOwner": false,
    "staffId": "s_1789634905188",
    "branchId": "b2",
    "checkOut": "",
    "createdAt": "2026-09-24T06:58:20.142Z",
    "shiftType": "Shift 2",
    "staffName": "លី រ៉ូហ្សា (Corner B)",
    "updatedAt": "2026-09-24T06:58:20.142Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 270,
    "checkInLatitude": 11.534178591003796,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88152156825767,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790229736215",
    "date": "2026-09-24",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:02 PM",
    "isOwner": false,
    "staffId": "s_1789715204283",
    "branchId": "b1",
    "checkOut": "09:07 PM",
    "createdAt": "2026-09-24T06:02:16.214Z",
    "shiftType": "Shift 2",
    "staffName": "កូវ គឹមហ័រ (ToTo B)",
    "updatedAt": "2026-09-24T14:07:49.084Z",
    "workHours": 8.08,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 28,
    "checkInLatitude": 11.541629922586997,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89210582348042,
    "checkOutDistance": 19,
    "checkOutLatitude": 11.54158068251516,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89202471221769,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790229110585",
    "date": "2026-09-24",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "12:51 PM",
    "isOwner": false,
    "staffId": "s_1789699227348",
    "branchId": "b1",
    "checkOut": "09:06 PM",
    "createdAt": "2026-09-24T05:51:50.584Z",
    "shiftType": "Shift 2",
    "staffName": "អ៊ុជ ថាវរី (ToTo B)",
    "updatedAt": "2026-09-24T14:06:53.896Z",
    "workHours": 8.25,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 18,
    "checkInLatitude": 11.541514555348302,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89209894702421,
    "checkOutDistance": 18,
    "checkOutLatitude": 11.541514555348302,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89209894702421,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790206743320",
    "date": "2026-09-24",
    "source": "telegram",
    "status": "Working",
    "checkIn": "06:39 AM",
    "isOwner": false,
    "staffId": "s_1789699005396",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-23T23:39:03.319Z",
    "shiftType": "Shift 2",
    "staffName": "ជុន សុលីណា (Corner)",
    "updatedAt": "2026-09-23T23:39:03.319Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 12,
    "checkInLatitude": 11.5414734743643,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89205754371815,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790206281268",
    "date": "2026-09-24",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:31 AM",
    "isOwner": false,
    "staffId": "s_1789699051035",
    "branchId": "b2",
    "checkOut": "02:15 PM",
    "createdAt": "2026-09-23T23:31:21.268Z",
    "shiftType": "Shift 1",
    "staffName": "សា សុមរកត (Corner A)",
    "updatedAt": "2026-09-24T07:15:09.471Z",
    "workHours": 7.73,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 270,
    "checkInLatitude": 11.534073079668644,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88152053419192,
    "checkOutDistance": 267,
    "checkOutLatitude": 11.53417852606365,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88149923264547,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790206068864",
    "date": "2026-09-24",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:27 AM",
    "isOwner": false,
    "staffId": "s_1789701385492",
    "branchId": "b2",
    "checkOut": "02:01 PM",
    "createdAt": "2026-09-23T23:27:48.863Z",
    "shiftType": "Shift 1",
    "staffName": "ជិន មុីលី (Corner A)",
    "updatedAt": "2026-09-24T07:01:53.999Z",
    "workHours": 7.57,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 276,
    "checkInLatitude": 11.53412747114536,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88158297361842,
    "checkOutDistance": 270,
    "checkOutLatitude": 11.534175224067088,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88152034386934,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790147147056",
    "date": "2026-09-23",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "02:05 PM",
    "isOwner": false,
    "staffId": "s_1789634905188",
    "branchId": "b2",
    "checkOut": "09:11 PM",
    "createdAt": "2026-09-23T07:05:47.055Z",
    "shiftType": "Shift 2",
    "staffName": "លី រ៉ូហ្សា (Corner B)",
    "updatedAt": "2026-09-23T14:11:27.761Z",
    "workHours": 7.1,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 267,
    "checkInLatitude": 11.534288945238332,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.8814878355995,
    "checkOutDistance": 266,
    "checkOutLatitude": 11.53429481518462,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88148014884156,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790143360487",
    "date": "2026-09-23",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:02 PM",
    "isOwner": false,
    "staffId": "s_1789699274989",
    "branchId": "b1",
    "checkOut": "08:56 PM",
    "createdAt": "2026-09-23T06:02:40.486Z",
    "shiftType": "Shift 2",
    "staffName": "ចយ ស្រីជីង (ToTo B)",
    "updatedAt": "2026-09-23T13:56:15.366Z",
    "workHours": 7.9,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 15,
    "checkInLatitude": 11.541556798593962,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89195650388525,
    "checkOutDistance": 34,
    "checkOutLatitude": 11.541631478963648,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.8921859823741,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790143260605",
    "date": "2026-09-23",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:01 PM",
    "isOwner": false,
    "staffId": "s_1789715204283",
    "branchId": "b1",
    "checkOut": "09:04 PM",
    "createdAt": "2026-09-23T06:01:00.604Z",
    "shiftType": "Shift 2",
    "staffName": "កូវ គឹមហ័រ (ToTo B)",
    "updatedAt": "2026-09-23T14:04:45.944Z",
    "workHours": 8.05,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 17,
    "checkInLatitude": 11.541560351224467,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89202638286828,
    "checkOutDistance": 13,
    "checkOutLatitude": 11.541437635937216,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89184869426292,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790121015714",
    "date": "2026-09-23",
    "source": "telegram",
    "status": "Working",
    "checkIn": "06:50 AM",
    "isOwner": false,
    "staffId": "s_1789699005396",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-22T23:50:15.713Z",
    "shiftType": "Shift 2",
    "staffName": "ជុន សុលីណា (Corner)",
    "updatedAt": "2026-09-22T23:50:15.713Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 17,
    "checkInLatitude": 11.541548360217789,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89204688427608,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790120891362",
    "date": "2026-09-23",
    "notes": "មកយឺត 18 នាទី (ស្មើ ~$0.22 - មិនកាត់ប្រាក់) [មូលហេតុ: 🙏]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:48 AM",
    "isOwner": false,
    "staffId": "s_1789699381356",
    "branchId": "b1",
    "checkOut": "04:22 PM",
    "createdAt": "2026-09-22T23:48:11.362Z",
    "shiftType": "Shift 1",
    "staffName": "កុង តារា (ToTo A)",
    "updatedAt": "2026-09-23T09:22:38.016Z",
    "workHours": 9.57,
    "lateReason": "🙏",
    "lateMinutes": 18,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 15,
    "checkInLatitude": 11.541521149734523,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89205581570656,
    "checkOutDistance": 15,
    "checkOutLatitude": 11.5415207887852,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89205587393988,
    "indicativeLateAmount": 0.22
  },
  {
    "id": "att_1790120023473",
    "date": "2026-09-23",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:33 AM",
    "isOwner": false,
    "staffId": "s_1789699051035",
    "branchId": "b2",
    "checkOut": "02:06 PM",
    "createdAt": "2026-09-22T23:33:43.472Z",
    "shiftType": "Shift 1",
    "staffName": "សា សុមរកត (Corner A)",
    "updatedAt": "2026-09-23T07:06:24.334Z",
    "workHours": 7.55,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 267,
    "checkInLatitude": 11.534119143809605,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.8815005786253,
    "checkOutDistance": 278,
    "checkOutLatitude": 11.53414521497604,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88159879398903,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790119574847",
    "date": "2026-09-23",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:26 AM",
    "isOwner": false,
    "staffId": "s_1789701385492",
    "branchId": "b2",
    "checkOut": "02:00 PM",
    "createdAt": "2026-09-22T23:26:14.846Z",
    "shiftType": "Shift 1",
    "staffName": "ជិន មុីលី (Corner A)",
    "updatedAt": "2026-09-23T07:00:56.203Z",
    "workHours": 7.57,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 281,
    "checkInLatitude": 11.534114494322468,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88162774121362,
    "checkOutDistance": 270,
    "checkOutLatitude": 11.53417882094779,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88152131498822,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790060214363",
    "date": "2026-09-22",
    "source": "telegram",
    "status": "Working",
    "checkIn": "01:56 PM",
    "isOwner": false,
    "staffId": "s_1789634905188",
    "branchId": "b2",
    "checkOut": "",
    "createdAt": "2026-09-22T06:56:54.362Z",
    "shiftType": "Shift 2",
    "staffName": "លី រ៉ូហ្សា (Corner B)",
    "updatedAt": "2026-09-22T06:56:54.362Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 261,
    "checkInLatitude": 11.534112787560868,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88143904866536,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790057171075",
    "date": "2026-09-22",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:06 PM",
    "isOwner": false,
    "staffId": "s_1789699227348",
    "branchId": "b1",
    "checkOut": "09:13 PM",
    "createdAt": "2026-09-22T06:06:11.075Z",
    "shiftType": "Shift 2",
    "staffName": "អ៊ុជ ថាវរី (ToTo B)",
    "updatedAt": "2026-09-22T14:13:57.413Z",
    "workHours": 8.12,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 17,
    "checkInLatitude": 11.54152957503512,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89207494445635,
    "checkOutDistance": 18,
    "checkOutLatitude": 11.541514201771408,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89209390755366,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790056402217",
    "date": "2026-09-22",
    "source": "telegram",
    "status": "Working",
    "checkIn": "12:53 PM",
    "isOwner": false,
    "staffId": "s_1789699274989",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-22T05:53:22.216Z",
    "shiftType": "Shift 2",
    "staffName": "ចយ ស្រីជីង (ToTo B)",
    "updatedAt": "2026-09-22T05:53:22.216Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 36,
    "checkInLatitude": 11.541681984471689,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89215685077544,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790034460764",
    "date": "2026-09-22",
    "notes": "មកយឺត 17 នាទី (ស្មើ ~$0.21 - មិនកាត់ប្រាក់) [មូលហេតុ: rain]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:47 AM",
    "isOwner": false,
    "staffId": "s_1789699381356",
    "branchId": "b1",
    "checkOut": "04:25 PM",
    "createdAt": "2026-09-21T23:47:40.763Z",
    "shiftType": "Shift 1",
    "staffName": "កុង តារា (ToTo A)",
    "updatedAt": "2026-09-22T09:25:13.829Z",
    "workHours": 9.63,
    "lateReason": "rain",
    "lateMinutes": 17,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 15,
    "checkInLatitude": 11.54152247738486,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89205590241743,
    "checkOutDistance": 15,
    "checkOutLatitude": 11.541521121168472,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89205580923425,
    "indicativeLateAmount": 0.21
  },
  {
    "id": "att_1790033497340",
    "date": "2026-09-22",
    "source": "telegram",
    "status": "Working",
    "checkIn": "06:31 AM",
    "isOwner": false,
    "staffId": "s_1789699005396",
    "branchId": "b2",
    "checkOut": "",
    "createdAt": "2026-09-21T23:31:37.339Z",
    "shiftType": "Shift 2",
    "staffName": "ជុន សុលីណា (Corner)",
    "updatedAt": "2026-09-21T23:31:37.339Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 266,
    "checkInLatitude": 11.534101758162988,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88149005929462,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1790033359256",
    "date": "2026-09-22",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:29 AM",
    "isOwner": false,
    "staffId": "s_1789701385492",
    "branchId": "b2",
    "checkOut": "02:25 PM",
    "createdAt": "2026-09-21T23:29:19.255Z",
    "shiftType": "Shift 1",
    "staffName": "ជិន មុីលី (Corner A)",
    "updatedAt": "2026-09-22T07:25:19.073Z",
    "workHours": 7.93,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 282,
    "checkInLatitude": 11.53412051029074,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88163906252328,
    "checkOutDistance": 271,
    "checkOutLatitude": 11.534315199347326,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88152747384247,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789973542678",
    "date": "2026-09-21",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:52 PM",
    "isOwner": false,
    "staffId": "s_1789699005396",
    "branchId": "b2",
    "checkOut": "09:04 PM",
    "createdAt": "2026-09-21T06:52:22.677Z",
    "shiftType": "Shift 2",
    "staffName": "ជុន សុលីណា (Corner)",
    "updatedAt": "2026-09-21T14:04:07.984Z",
    "workHours": 7.2,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 269,
    "checkInLatitude": 11.534167494082281,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88151107141543,
    "checkOutDistance": 268,
    "checkOutLatitude": 11.534367969364235,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88149386247422,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789972444531",
    "date": "2026-09-21",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:34 PM",
    "isOwner": false,
    "staffId": "s_1789634905188",
    "branchId": "b2",
    "checkOut": "09:04 PM",
    "createdAt": "2026-09-21T06:34:04.530Z",
    "shiftType": "Shift 2",
    "staffName": "លី រ៉ូហ្សា (Corner B)",
    "updatedAt": "2026-09-21T14:04:24.774Z",
    "workHours": 7.5,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 266,
    "checkInLatitude": 11.53429481518462,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88148014884156,
    "checkOutDistance": 266,
    "checkOutLatitude": 11.53429481518462,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88148014884156,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789971144975",
    "date": "2026-09-21",
    "notes": "មកយឺត 12 នាទី (ស្មើ ~$0.17 - មិនកាត់ប្រាក់) [មូលហេតុ: របងបន្ទប់ជួលស្កេចគាំង]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:12 PM",
    "isOwner": false,
    "staffId": "s_1789715204283",
    "branchId": "b1",
    "checkOut": "10:09 PM",
    "createdAt": "2026-09-21T06:12:24.974Z",
    "shiftType": "Shift 2",
    "staffName": "កូវ គឹមហ័រ (ToTo B)",
    "updatedAt": "2026-09-21T15:09:07.152Z",
    "workHours": 8.95,
    "lateReason": "របងបន្ទប់ជួលស្កេចគាំង",
    "lateMinutes": 12,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 17,
    "checkInLatitude": 11.541566889579224,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89200437332548,
    "checkOutDistance": 17,
    "checkOutLatitude": 11.541567789436462,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.892005904705,
    "indicativeLateAmount": 0.17
  },
  {
    "id": "att_1789970274362",
    "date": "2026-09-21",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "12:57 PM",
    "isOwner": false,
    "staffId": "s_1789699274989",
    "branchId": "b1",
    "checkOut": "09:18 PM",
    "createdAt": "2026-09-21T05:57:54.361Z",
    "shiftType": "Shift 2",
    "staffName": "ចយ ស្រីជីង (ToTo B)",
    "updatedAt": "2026-09-21T14:18:55.206Z",
    "workHours": 8.35,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 29,
    "checkInLatitude": 11.541639274617628,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89210947693711,
    "checkOutDistance": 34,
    "checkOutLatitude": 11.541632189877902,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89218955580547,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789969413541",
    "date": "2026-09-21",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "12:43 PM",
    "isOwner": false,
    "staffId": "s_1789699227348",
    "branchId": "b1",
    "checkOut": "10:01 PM",
    "createdAt": "2026-09-21T05:43:33.540Z",
    "shiftType": "Shift 2",
    "staffName": "អ៊ុជ ថាវរី (ToTo B)",
    "updatedAt": "2026-09-21T15:01:00.602Z",
    "workHours": 9.3,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 18,
    "checkInLatitude": 11.541514201771408,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89209390755366,
    "checkOutDistance": 18,
    "checkOutLatitude": 11.541514201771408,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89209390755366,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789947944383",
    "date": "2026-09-21",
    "notes": "មកយឺត 15 នាទី (ស្មើ ~$0.18 - មិនកាត់ប្រាក់) [មូលហេតុ: ធ្វើម្ហូប]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:45 AM",
    "isOwner": false,
    "staffId": "s_1789699381356",
    "branchId": "b1",
    "checkOut": "04:32 PM",
    "createdAt": "2026-09-20T23:45:44.382Z",
    "shiftType": "Shift 1",
    "staffName": "កុង តារា (ToTo A)",
    "updatedAt": "2026-09-21T09:32:38.547Z",
    "workHours": 9.78,
    "lateReason": "ធ្វើម្ហូប",
    "lateMinutes": 15,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 14,
    "checkInLatitude": 11.541530744548982,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89202197418517,
    "checkOutDistance": 13,
    "checkOutLatitude": 11.541448274308305,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.8920811208883,
    "indicativeLateAmount": 0.18
  },
  {
    "id": "att_1789947172294",
    "date": "2026-09-21",
    "source": "telegram",
    "status": "Working",
    "checkIn": "06:32 AM",
    "isOwner": false,
    "staffId": "s_1789699051035",
    "branchId": "b2",
    "checkOut": "",
    "createdAt": "2026-09-20T23:32:52.293Z",
    "shiftType": "Shift 1",
    "staffName": "សា សុមរកត (Corner A)",
    "updatedAt": "2026-09-20T23:32:52.293Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 277,
    "checkInLatitude": 11.534230039843179,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88158956623529,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789947025311",
    "date": "2026-09-21",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:30 AM",
    "isOwner": false,
    "staffId": "s_1789701385492",
    "branchId": "b2",
    "checkOut": "02:06 PM",
    "createdAt": "2026-09-20T23:30:25.310Z",
    "shiftType": "Shift 1",
    "staffName": "ជិន មុីលី (Corner A)",
    "updatedAt": "2026-09-21T07:06:07.092Z",
    "workHours": 7.6,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 286,
    "checkInLatitude": 11.53405907950202,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88167049077542,
    "checkOutDistance": 270,
    "checkOutLatitude": 11.534174784640948,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88152028458694,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789890332419",
    "date": "2026-09-20",
    "notes": "មកយឺត 105 នាទី (ស្មើ ~$1.53 - មិនកាត់ប្រាក់) [មូលហេតុ: check in អត់កើតពេលមកដល់ហាង]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "02:45 PM",
    "isOwner": false,
    "staffId": "s_1789715204283",
    "branchId": "b1",
    "checkOut": "09:25 PM",
    "createdAt": "2026-09-20T07:45:32.419Z",
    "shiftType": "Shift 2",
    "staffName": "កូវ គឹមហ័រ (ToTo B)",
    "updatedAt": "2026-09-20T14:25:13.022Z",
    "workHours": 6.67,
    "lateReason": "check in អត់កើតពេលមកដល់ហាង",
    "lateMinutes": 105,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 20,
    "checkInLatitude": 11.54159092540619,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89202919926414,
    "checkOutDistance": 31,
    "checkOutLatitude": 11.541694463241418,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89199518235856,
    "indicativeLateAmount": 1.53
  },
  {
    "id": "att_1789883485622",
    "date": "2026-09-20",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "12:51 PM",
    "isOwner": false,
    "staffId": "s_1789699227348",
    "branchId": "b1",
    "checkOut": "09:25 PM",
    "createdAt": "2026-09-20T05:51:25.621Z",
    "shiftType": "Shift 2",
    "staffName": "អ៊ុជ ថាវរី (ToTo B)",
    "updatedAt": "2026-09-20T14:25:18.060Z",
    "workHours": 8.57,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 18,
    "checkInLatitude": 11.541514201771408,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89209390755366,
    "checkOutDistance": 18,
    "checkOutLatitude": 11.541514201771408,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89209390755366,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789877319193",
    "date": "2026-09-20",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "11:08 AM",
    "isOwner": false,
    "staffId": "s_1789634905188",
    "branchId": "b2",
    "checkOut": "09:08 PM",
    "createdAt": "2026-09-20T04:08:39.192Z",
    "shiftType": "Shift 2",
    "staffName": "លី រ៉ូហ្សា (Corner B)",
    "updatedAt": "2026-09-20T14:08:00.278Z",
    "workHours": 10,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 266,
    "checkInLatitude": 11.53429481518462,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88148014884156,
    "checkOutDistance": 266,
    "checkOutLatitude": 11.53429481518462,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88148014884156,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_late_1789862886535",
    "date": "2026-09-20",
    "notes": "មកយឺត 30 នាទី (ស្មើ ~$0.43 - មិនកាត់ប្រាក់) [មូលហេតុ: គេងយឺត]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "02:30 PM",
    "isOwner": false,
    "staffId": "s_1789699005396",
    "branchId": "b2",
    "checkOut": "09:08 PM",
    "createdAt": "2026-09-20T00:08:06.535Z",
    "shiftType": "Shift 2",
    "staffName": "ជុន សុលីណា (Corner)",
    "updatedAt": "2026-09-20T14:08:06.803Z",
    "workHours": 6.63,
    "branchName": "Coffee Corner SMC",
    "lateReason": "គេងយឺត",
    "lateMinutes": 30,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 268,
    "checkInLatitude": 11.534183617078936,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.8815053013754,
    "checkOutDistance": 268,
    "checkOutLatitude": 11.534367953424509,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88149367216334,
    "indicativeLateAmount": 0.43
  },
  {
    "id": "att_1789861852437",
    "date": "2026-09-20",
    "notes": "មកយឺត 20 នាទី (ស្មើ ~$0.25 - មិនកាត់ប្រាក់) [មូលហេតុ: គេងច្រុល]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:50 AM",
    "isOwner": false,
    "staffId": "s_1789699381356",
    "branchId": "b1",
    "checkOut": "04:30 PM",
    "createdAt": "2026-09-19T23:50:52.437Z",
    "shiftType": "Shift 1",
    "staffName": "កុង តារា (ToTo A)",
    "updatedAt": "2026-09-20T09:30:24.514Z",
    "workHours": 9.67,
    "lateReason": "គេងច្រុល",
    "lateMinutes": 20,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 18,
    "checkInLatitude": 11.5415382092814,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89207155846927,
    "checkOutDistance": 15,
    "checkOutLatitude": 11.541522678201986,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89205498209267,
    "indicativeLateAmount": 0.25
  },
  {
    "id": "att_1789861000022",
    "date": "2026-09-20",
    "source": "telegram",
    "status": "Working",
    "checkIn": "06:36 AM",
    "isOwner": false,
    "staffId": "s_1789699051035",
    "branchId": "b2",
    "checkOut": "",
    "createdAt": "2026-09-19T23:36:40.021Z",
    "shiftType": "Shift 1",
    "staffName": "សា សុមរកត (Corner A)",
    "updatedAt": "2026-09-19T23:36:40.021Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 278,
    "checkInLatitude": 11.534145362929351,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88159956073477,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789860399935",
    "date": "2026-09-20",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:26 AM",
    "isOwner": false,
    "staffId": "s_1789701385492",
    "branchId": "b2",
    "checkOut": "02:02 PM",
    "createdAt": "2026-09-19T23:26:39.934Z",
    "shiftType": "Shift 1",
    "staffName": "ជិន មុីលី (Corner A)",
    "updatedAt": "2026-09-20T07:02:03.467Z",
    "workHours": 7.6,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 273,
    "checkInLatitude": 11.534126632920238,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.8815527102696,
    "checkOutDistance": 270,
    "checkOutLatitude": 11.53417455545168,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.8815206740674,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789820301221",
    "date": "2026-09-19",
    "notes": "មកយឺត 378 នាទី (ស្មើ ~$6.04 - មិនកាត់ប្រាក់) [មូលហេតុ: terb ban phone]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "07:18 PM",
    "isOwner": false,
    "staffId": "s_1789699227348",
    "branchId": "b1",
    "checkOut": "09:13 PM",
    "createdAt": "2026-09-19T12:18:21.220Z",
    "shiftType": "Shift 2",
    "staffName": "អ៊ុជ ថាវរី (ToTo B)",
    "updatedAt": "2026-09-19T14:13:01.470Z",
    "workHours": 1.92,
    "lateReason": "terb ban phone",
    "lateMinutes": 378,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 18,
    "checkInLatitude": 11.541514201771408,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89209390755366,
    "checkOutDistance": 18,
    "checkOutLatitude": 11.541514201771408,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89209390755366,
    "indicativeLateAmount": 6.04
  },
  {
    "id": "att_1789797647656",
    "date": "2026-09-19",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:00 PM",
    "isOwner": false,
    "staffId": "s_1789699274989",
    "branchId": "b1",
    "checkOut": "09:12 PM",
    "createdAt": "2026-09-19T06:00:47.655Z",
    "shiftType": "Shift 2",
    "staffName": "ចយ ស្រីជីង (ToTo B)",
    "updatedAt": "2026-09-19T14:12:31.460Z",
    "workHours": 8.2,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 20,
    "checkInLatitude": 11.541577534483205,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89204932850127,
    "checkOutDistance": 34,
    "checkOutLatitude": 11.541629154443978,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89218930999573,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789797606639",
    "date": "2026-09-19",
    "source": "telegram",
    "status": "Working",
    "checkIn": "01:00 PM",
    "isOwner": false,
    "staffId": "s_1789715204283",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-19T06:00:06.637Z",
    "shiftType": "Shift 2",
    "staffName": "កូវ គឹមហ័រ (ToTo B)",
    "updatedAt": "2026-09-19T06:00:06.637Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 18,
    "checkInLatitude": 11.541569492559514,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89202188664743,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789793674706",
    "date": "2026-09-19",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "11:54 AM",
    "isOwner": false,
    "staffId": "s_1789634905188",
    "branchId": "b2",
    "checkOut": "09:02 PM",
    "createdAt": "2026-09-19T04:54:34.705Z",
    "shiftType": "Shift 2",
    "staffName": "លី រ៉ូហ្សា (Corner B)",
    "updatedAt": "2026-09-19T14:02:08.061Z",
    "workHours": 9.13,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 266,
    "checkInLatitude": 11.53429481518462,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88148014884156,
    "checkOutDistance": 266,
    "checkOutLatitude": 11.53429481518462,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88148014884156,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789775086355",
    "date": "2026-09-19",
    "notes": "មកយឺត 14 នាទី (ស្មើ ~$0.17 - មិនកាត់ប្រាក់) [មូលហេតុ: ធ្វើម្ហូបញាំ]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:44 AM",
    "isOwner": false,
    "staffId": "s_1789699381356",
    "branchId": "b1",
    "checkOut": "04:28 PM",
    "createdAt": "2026-09-18T23:44:46.355Z",
    "shiftType": "Shift 1",
    "staffName": "កុង តារា (ToTo A)",
    "updatedAt": "2026-09-19T09:28:56.987Z",
    "workHours": 9.73,
    "lateReason": "ធ្វើម្ហូបញាំ",
    "lateMinutes": 14,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 17,
    "checkInLatitude": 11.541541975812567,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89205430886194,
    "checkOutDistance": 18,
    "checkOutLatitude": 11.541538080178906,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89207154815078,
    "indicativeLateAmount": 0.17
  },
  {
    "id": "att_1789774770489",
    "date": "2026-09-19",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:39 AM",
    "isOwner": false,
    "staffId": "s_1789701385492",
    "branchId": "b2",
    "checkOut": "02:03 PM",
    "createdAt": "2026-09-18T23:39:30.488Z",
    "shiftType": "Shift 1",
    "staffName": "ជិន មុីលី (Corner A)",
    "updatedAt": "2026-09-19T07:03:34.844Z",
    "workHours": 7.4,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 271,
    "checkInLatitude": 11.534316481484138,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88152749656498,
    "checkOutDistance": 270,
    "checkOutLatitude": 11.534172393139569,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88152081572316,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789774580027",
    "date": "2026-09-19",
    "notes": "ចេញមុនម៉ោង 478 នាទី (ស្មើ ~$5.98 - មិនកាត់ប្រាក់) [មូលហេតុ: break Tv work nv corner]",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "06:36 AM",
    "isOwner": false,
    "staffId": "s_1789699005396",
    "branchId": "b1",
    "checkOut": "01:02 PM",
    "createdAt": "2026-09-18T23:36:20.026Z",
    "shiftType": "Shift 2",
    "staffName": "ជុន សុលីណា (Corner)",
    "updatedAt": "2026-09-19T06:02:06.251Z",
    "workHours": 6.43,
    "earlyReason": "break Tv work nv corner",
    "lateMinutes": 0,
    "earlyMinutes": 478,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "earlyDeduction": 0,
    "isEarlyExcused": true,
    "checkInDistance": 17,
    "checkInLatitude": 11.54153881244288,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89206774743526,
    "checkOutDistance": 18,
    "checkOutLatitude": 11.54157444155994,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.8920234217684,
    "indicativeLateAmount": 0,
    "indicativeEarlyAmount": 5.98
  },
  {
    "id": "att_1789774166757",
    "date": "2026-09-19",
    "source": "telegram",
    "status": "Working",
    "checkIn": "06:29 AM",
    "isOwner": false,
    "staffId": "s_1789699051035",
    "branchId": "b2",
    "checkOut": "",
    "createdAt": "2026-09-18T23:29:26.755Z",
    "shiftType": "Shift 1",
    "staffName": "សា សុមរកត (Corner A)",
    "updatedAt": "2026-09-18T23:29:26.755Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 278,
    "checkInLatitude": 11.534145362929351,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88159956073477,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789718897791",
    "date": "2026-09-18",
    "notes": "មកយឺត 128 នាទី (ស្មើ ~$1.87 - មិនកាត់ប្រាក់) [មូលហេតុ: មូលហេតុ ជាប់សោរបន្ទប់ ត្រូវវាយសោរ]",
    "source": "telegram",
    "status": "Late",
    "checkIn": "03:08 PM",
    "isOwner": false,
    "staffId": "s_1789715204283",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-18T08:08:17.790Z",
    "shiftType": "Shift 2",
    "staffName": "កូវ គឹមហ័រ",
    "updatedAt": "2026-09-18T08:08:17.790Z",
    "workHours": 0,
    "lateReason": "មូលហេតុ ជាប់សោរបន្ទប់ ត្រូវវាយសោរ",
    "lateMinutes": 128,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 18,
    "checkInLatitude": 11.541577471672138,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89201552049212,
    "indicativeLateAmount": 1.87
  },
  {
    "id": "att_1789714408119",
    "date": "2026-09-18",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:53 PM",
    "isOwner": false,
    "staffId": "s_1789699005396",
    "branchId": "b2",
    "checkOut": "09:00 PM",
    "createdAt": "2026-09-18T06:53:28.117Z",
    "shiftType": "Shift 2",
    "staffName": "ជុន សុលីណា (Corner)",
    "updatedAt": "2026-09-18T14:00:56.065Z",
    "workHours": 7.12,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 266,
    "checkInLatitude": 11.534209001078139,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88148236753568,
    "checkOutDistance": 270,
    "checkOutLatitude": 11.534398688439317,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88150533178616,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789714028895",
    "date": "2026-09-18",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "01:47 PM",
    "isOwner": false,
    "staffId": "s_1789634905188",
    "branchId": "b2",
    "checkOut": "09:01 PM",
    "createdAt": "2026-09-18T06:47:08.894Z",
    "shiftType": "Shift 2",
    "staffName": "លី រ៉ូហ្សា (Corner)",
    "updatedAt": "2026-09-18T14:01:18.321Z",
    "workHours": 7.23,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 271,
    "checkInLatitude": 11.534100044620297,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.88153621579363,
    "checkOutDistance": 266,
    "checkOutLatitude": 11.53429481518462,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.88148014884156,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789711293267",
    "date": "2026-09-18",
    "source": "telegram",
    "status": "Working",
    "checkIn": "01:01 PM",
    "isOwner": false,
    "staffId": "s_1789699274989",
    "branchId": "b1",
    "checkOut": "",
    "createdAt": "2026-09-18T06:01:33.266Z",
    "shiftType": "Shift 2",
    "staffName": "ចយ ស្រីជីង (ToTo)",
    "updatedAt": "2026-09-18T06:01:33.266Z",
    "workHours": 0,
    "lateMinutes": 0,
    "isLateExcused": true,
    "lateDeduction": 0,
    "overtimeHours": 0,
    "checkInDistance": 34,
    "checkInLatitude": 11.541623956179066,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89219174585017,
    "indicativeLateAmount": 0
  },
  {
    "id": "att_1789701981761",
    "date": "2026-09-18",
    "source": "telegram",
    "status": "Completed",
    "checkIn": "10:26 AM",
    "isOwner": false,
    "staffId": "s_1789699381356",
    "branchId": "b1",
    "checkOut": "04:25 PM",
    "createdAt": "2026-09-18T03:26:21.760Z",
    "shiftType": "Shift 1",
    "staffName": "កុង តារា (ToTo)",
    "updatedAt": "2026-09-18T09:25:20.705Z",
    "workHours": 5.98,
    "overtimeHours": 0,
    "checkInDistance": 18,
    "checkInLatitude": 11.541570203691657,
    "checkInFaceScore": 1,
    "checkInLongitude": 104.89201011288212,
    "checkOutDistance": 17,
    "checkOutLatitude": 11.541569676196916,
    "checkOutFaceScore": 1,
    "checkOutLongitude": 104.89201061078464
  }
];

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

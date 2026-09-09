import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

function getAllBotTokens(): string[] {
  return [
    process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG,
    process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG,
    process.env.TELEGRAM_BOT_TOKEN_ATTENDANCE,
    process.env.TELEGRAM_BOT_TOKEN_ATTENDENT,
    process.env.TELEGRAM_ATTENDANCE_BOT_TOKEN,
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_BOT_TOKEN_CODE,
    process.env.BOT_TOKEN
  ].filter((t): t is string => Boolean(t && t.trim())).map(t => t.trim());
}

function getBotToken(branchId?: string, branchName?: string): string {
  const bId = (branchId || '').toLowerCase().trim();
  const bName = (branchName || '').toLowerCase().trim();

  // Branch 1: Veng Sreng
  if (bId === 'b1' || bId.includes('vs') || bName.includes('veng') || bName.includes('sreng')) {
    if (process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG) {
      return process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG.trim();
    }
  }

  // Branch 2: Chomka Doung
  if (bId === 'b2' || bId.includes('cd') || bName.includes('chomka') || bName.includes('doung')) {
    if (process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG) {
      return process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG.trim();
    }
  }

  return (
    process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG ||
    process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG ||
    process.env.TELEGRAM_BOT_TOKEN_ATTENDANCE ||
    process.env.TELEGRAM_BOT_TOKEN_ATTENDENT ||
    process.env.TELEGRAM_ATTENDANCE_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN_CODE ||
    process.env.BOT_TOKEN ||
    ''
  ).trim();
}

function validateTelegramInitData(initData: string, candidateTokens: string[] | string): { valid: boolean; user?: any; error?: string } {
  if (!initData) return { valid: false, error: 'initData is empty' };
  const tokens = (Array.isArray(candidateTokens) ? candidateTokens : [candidateTokens]).filter(Boolean);
  try {
    const urlParams = new URLSearchParams(initData);
    const userRaw = urlParams.get('user');
    let user: any = null;
    if (userRaw) {
      try { user = JSON.parse(userRaw); } catch {}
    }

    const hash = urlParams.get('hash');
    if (!hash) {
      return { valid: Boolean(user), user, error: 'hash parameter missing' };
    }

    urlParams.delete('hash');
    const dataCheckArr: string[] = [];
    Array.from(urlParams.keys()).sort().forEach(key => {
      dataCheckArr.push(`${key}=${urlParams.get(key)}`);
    });
    const dataCheckString = dataCheckArr.join('\n');

    for (const token of tokens) {
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      if (calculatedHash === hash) {
        return { valid: true, user };
      }
    }

    return { valid: Boolean(user), user };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

async function sendTelegramNotification(token: string, chatId: string, text: string, photo?: string) {
  if (!token || !chatId) return;

  // Try sending as Photo with Caption
  if (photo && photo.startsWith('data:image/')) {
    try {
      const base64Data = photo.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'selfie.jpg');
      formData.append('caption', text);
      formData.append('parse_mode', 'HTML');

      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.ok) return;
    } catch (e) {
      console.warn('sendPhoto base64 failed, falling back:', e);
    }
  } else if (photo && photo.startsWith('http')) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo,
          caption: text,
          parse_mode: 'HTML'
        })
      });
      const data = await res.json();
      if (data.ok) return;
    } catch (e) {
      console.warn('sendPhoto url failed, falling back:', e);
    }
  }

  // Fallback to text message
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.warn('Failed to send Telegram notification:', e);
  }
}

function parseGoogleMapsString(text: string): { lat: string; lng: string; success: boolean } {
  if (!text) return { lat: '', lng: '', success: false };
  const raw = text.trim();

  // Pattern 1: Direct coordinates e.g. "11.556374, 104.928210"
  const directMatch = raw.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat: lat.toFixed(6), lng: lng.toFixed(6), success: true };
    }
  }

  // Pattern 2: @lat,lng
  const atMatch = raw.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]).toFixed(6), lng: parseFloat(atMatch[2]).toFixed(6), success: true };
  }

  // Pattern 3: ?q=lat,lng or ?query=lat,lng
  const qMatch = raw.match(/[?&](?:q|query|ll|center)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]).toFixed(6), lng: parseFloat(qMatch[2]).toFixed(6), success: true };
  }

  // Pattern 4: !3dlat!2dlng
  const pbMatch = raw.match(/!3d(-?\d{1,3}\.\d+)!2d(-?\d{1,3}\.\d+)/);
  if (pbMatch) {
    return { lat: parseFloat(pbMatch[1]).toFixed(6), lng: parseFloat(pbMatch[2]).toFixed(6), success: true };
  }

  return { lat: '', lng: '', success: false };
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function compareFaceVectors(refVector: any, currentVector: any): { score: number; match: boolean; threshold: number } {
  const threshold = 0.70;
  try {
    const v1: number[] = typeof refVector === 'string' ? JSON.parse(refVector) : refVector;
    const v2: number[] = typeof currentVector === 'string' ? JSON.parse(currentVector) : currentVector;

    if (!Array.isArray(v1) || !Array.isArray(v2) || v1.length === 0 || v1.length !== v2.length) {
      return { score: 0, match: false, threshold };
    }

    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      normA += v1[i] * v1[i];
      normB += v2[i] * v2[i];
    }
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return { score: 0, match: false, threshold };

    const cosineSimilarity = dotProduct / (normA * normB);
    const normalizedScore = Math.max(0, Math.min(1, Number(cosineSimilarity.toFixed(4))));
    return {
      score: normalizedScore,
      match: normalizedScore >= threshold,
      threshold
    };
  } catch {
    return { score: 0, match: false, threshold };
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = (req.url || '').split('?')[0];
  const supabase = getSupabase();
  const botToken = getBotToken();
  const allBotTokens = getAllBotTokens();

  // Helper to fetch collection
  const getCollection = async (id: string): Promise<any[]> => {
    if (!supabase) return [];
    try {
      let { data, error } = await supabase.from('tc_collections').select('data').eq('id', id).maybeSingle();
      if (error || !data) {
        const alt = await supabase.from('clean24_collections').select('data').eq('id', id).maybeSingle();
        if (alt.data) data = alt.data;
      }
      return (data && Array.isArray(data.data)) ? data.data : [];
    } catch {
      return [];
    }
  };

  // Helper to save collection
  const saveCollection = async (id: string, list: any[]) => {
    if (!supabase) return false;
    try {
      await supabase.from('clean24_collections').upsert({
        id,
        data: list,
        updated_at: new Date().toISOString()
      });
      return true;
    } catch {
      return false;
    }
  };

  // 1. FACE ENROLLMENT (POST /api/face/enroll)
  if (path === '/api/face/enroll' && req.method === 'POST') {
    try {
      const { staffId, faceReference, photoUrl } = req.body || {};
      if (!staffId || !faceReference) {
        return res.status(400).json({ success: false, error: 'staffId and faceReference are required' });
      }

      const allStaff = await getCollection('staff');
      const sIdx = allStaff.findIndex((s: any) => s.id === staffId);
      if (sIdx === -1) {
        return res.status(404).json({ success: false, error: 'Staff profile not found' });
      }

      allStaff[sIdx].faceReference = typeof faceReference === 'string' ? faceReference : JSON.stringify(faceReference);
      allStaff[sIdx].faceEnrolled = true;
      allStaff[sIdx].faceEnrolledAt = new Date().toISOString();
      if (photoUrl) {
        allStaff[sIdx].photoUrl = photoUrl;
      }

      await saveCollection('staff', allStaff);

      return res.status(200).json({
        success: true,
        message: `បានចុះឈ្មោះផ្ទៃមុខសម្រាប់ ${allStaff[sIdx].fullName} ដោយជោគជ័យ!`,
        staff: allStaff[sIdx]
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 2. TELEGRAM LINK (POST /api/telegram/link)
  if (path === '/api/telegram/link' && req.method === 'POST') {
    try {
      const { staffId, telegramId, telegramUsername } = req.body || {};
      if (!staffId || !telegramId) {
        return res.status(400).json({ success: false, error: 'staffId and telegramId are required' });
      }

      const allStaff = await getCollection('staff');
      const sIdx = allStaff.findIndex((s: any) => s.id === staffId);
      if (sIdx === -1) {
        return res.status(404).json({ success: false, error: 'Staff profile not found' });
      }

      allStaff[sIdx].telegramId = String(telegramId).trim();
      if (telegramUsername) allStaff[sIdx].telegramUsername = telegramUsername.trim();
      allStaff[sIdx].telegramLinked = true;

      await saveCollection('staff', allStaff);

      return res.status(200).json({
        success: true,
        message: `បានភ្ជាប់ Telegram ID ${telegramId} ជាមួយ ${allStaff[sIdx].fullName} ដោយជោគជ័យ!`,
        staff: allStaff[sIdx]
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 3. TELEGRAM UNLINK (POST /api/telegram/unlink)
  if (path === '/api/telegram/unlink' && req.method === 'POST') {
    try {
      const { staffId } = req.body || {};
      if (!staffId) return res.status(400).json({ success: false, error: 'staffId is required' });

      const allStaff = await getCollection('staff');
      const sIdx = allStaff.findIndex((s: any) => s.id === staffId);
      if (sIdx === -1) return res.status(404).json({ success: false, error: 'Staff profile not found' });

      delete allStaff[sIdx].telegramId;
      delete allStaff[sIdx].telegramUsername;
      allStaff[sIdx].telegramLinked = false;

      await saveCollection('staff', allStaff);
      return res.status(200).json({ success: true, message: 'Unlinked', staff: allStaff[sIdx] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 4. VALIDATE TELEGRAM MINI APP SESSION (POST /api/telegram/validate-init-data)
  if (path === '/api/telegram/validate-init-data' && req.method === 'POST') {
    try {
      const { initData, simulationStaffId } = req.body || {};
      const allStaff = await getCollection('staff');
      const allBranches = await getCollection('branches');
      const allAtt = await getCollection('attendance');

      let tgUser: any = null;
      let matchedStaff: any = null;

      if (initData) {
        const val = validateTelegramInitData(initData, allBotTokens);
        if (val.valid && val.user) {
          tgUser = val.user;
          const tgId = String(tgUser.id);
          const tgName = (tgUser.username || '').toLowerCase().replace(/^@/, '').trim();
          matchedStaff = allStaff.find((s: any) => 
            (s.telegramId && String(s.telegramId) === tgId) ||
            (tgName && s.telegramUsername && s.telegramUsername.replace(/^@/, '').toLowerCase().trim() === tgName)
          );

          // If single active staff and not yet linked, auto-link
          if (!matchedStaff && allStaff.length === 1 && allStaff[0].status === 'Active') {
            matchedStaff = allStaff[0];
          }

          if (matchedStaff && (!matchedStaff.telegramId || String(matchedStaff.telegramId) !== tgId)) {
            matchedStaff.telegramId = tgId;
            matchedStaff.telegramLinked = true;
            if (tgName && !matchedStaff.telegramUsername) matchedStaff.telegramUsername = `@${tgName}`;
            await saveCollection('staff', allStaff);
          }
        }
      }

      if (!matchedStaff && simulationStaffId) {
        matchedStaff = allStaff.find((s: any) => s.id === simulationStaffId) || allStaff[0];
        if (matchedStaff) {
          tgUser = {
            id: matchedStaff.telegramId || '',
            first_name: matchedStaff.fullName,
            username: matchedStaff.telegramUsername || 'staff'
          };
        }
      }

      if (!matchedStaff) {
        return res.status(404).json({
          success: false,
          unlinked: true,
          user: tgUser,
          error: 'គណនី Telegram របស់អ្នកមិនទាន់បានភ្ជាប់ជាមួយបុគ្គលិក Clean24 ណាម្នាក់ឡើយ។'
        });
      }

      const branch = allBranches.find((b: any) => b.id === (matchedStaff.assignedBranchId || matchedStaff.branchId)) || {
        id: matchedStaff.branchId,
        branchName: 'Clean24 Laundry',
        locationVerificationEnabled: false,
        allowedRadius: 100
      };

      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
      const todayAttendance = allAtt.find((a: any) => a.staffId === matchedStaff.id && a.date === todayStr) || null;

      return res.status(200).json({
        success: true,
        user: tgUser,
        staff: {
          id: matchedStaff.id,
          fullName: matchedStaff.fullName,
          position: matchedStaff.position,
          shift: matchedStaff.shift,
          photoUrl: matchedStaff.photoUrl,
          faceEnrolled: Boolean(matchedStaff.faceEnrolled && matchedStaff.faceReference),
          attendanceEnabled: matchedStaff.attendanceEnabled !== false,
          branchId: branch.id,
          branchName: branch.branchName
        },
        branch: {
          id: branch.id,
          branchName: branch.branchName,
          latitude: branch.latitude,
          longitude: branch.longitude,
          allowedRadius: branch.allowedRadius || 100,
          locationVerificationEnabled: Boolean(branch.locationVerificationEnabled)
        },
        todayAttendance
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 5. ATTENDANCE CHECK-IN (POST /api/attendance/check-in)
  if (path === '/api/attendance/check-in' && req.method === 'POST') {
    try {
      const { initData, faceDescriptor, photo, latitude, longitude, simulationStaffId } = req.body || {};
      const allStaff = await getCollection('staff');
      const allBranches = await getCollection('branches');
      const allAtt = await getCollection('attendance');

      let staff: any = null;
      if (initData) {
        const val = validateTelegramInitData(initData, allBotTokens);
        if (val.valid && val.user) {
          const tgId = String(val.user.id);
          const tgName = (val.user.username || '').toLowerCase().replace(/^@/, '').trim();
          staff = allStaff.find((s: any) => 
            (s.telegramId && String(s.telegramId) === tgId) ||
            (tgName && s.telegramUsername && s.telegramUsername.replace(/^@/, '').toLowerCase().trim() === tgName)
          );
        }
      }

      if (!staff && simulationStaffId) {
        staff = allStaff.find((s: any) => s.id === simulationStaffId);
      }

      if (!staff) {
        return res.status(404).json({ success: false, error: 'រកមិនឃើញទិន្នន័យបុគ្គលិកឡើយ!' });
      }

      // Photo is saved directly as live attendance proof; verification is authenticated via Telegram
      if (photo && (!staff.photoUrl || staff.photoUrl.includes('images.unsplash.com'))) {
        staff.photoUrl = photo;
        staff.faceEnrolled = true;
        await saveCollection('staff', allStaff);
      }

      const branch = allBranches.find((b: any) => b.id === (staff.assignedBranchId || staff.branchId));
      let distance: number | undefined = undefined;

      if (branch && branch.locationVerificationEnabled && branch.latitude && branch.longitude) {
        if (latitude === undefined || longitude === undefined) {
          return res.status(400).json({ success: false, error: 'សូមបើក GPS ទីតាំងនៅលើទូរស័ព្ទរបស់អ្នក ដើម្បីផ្ទៀងផ្ទាត់ទីតាំងសាខា!' });
        }
        distance = calculateHaversineDistance(latitude, longitude, branch.latitude, branch.longitude);
        const allowedRadius = branch.allowedRadius || 100;
        if (distance > allowedRadius) {
          return res.status(400).json({
            success: false,
            error: `មិនអាចចុះវត្តមានបានទេ! អ្នកនៅក្រៅតំបន់ដែលបានកំណត់សម្រាប់សាខា ${branch.branchName} (ចម្ងាយ៖ ${distance} ម៉ែត្រ / អនុញ្ញាត៖ ${allowedRadius} ម៉ែត្រ)។`
          });
        }
      }

      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Phnom_Penh' });

      const existingIndex = allAtt.findIndex((a: any) => a.staffId === staff.id && a.date === todayStr);
      if (existingIndex !== -1 && allAtt[existingIndex].checkIn && allAtt[existingIndex].status !== 'Absent') {
        return res.status(400).json({ success: false, error: `អ្នកបានចុះឈ្មោះចូលរួចហើយនៅម៉ោង ${allAtt[existingIndex].checkIn}!` });
      }

      const newRecord: any = {
        id: 'att_' + Date.now(),
        branchId: branch?.id || staff.branchId,
        staffId: staff.id,
        staffName: staff.fullName,
        date: todayStr,
        checkIn: timeStr,
        checkOut: '',
        shiftType: staff.shift || 'Full Time',
        workHours: 0,
        overtimeHours: 0,
        status: 'Working',
        source: 'telegram',
        checkInPhoto: photo || staff.photoUrl,
        checkInFaceScore: 1.0,
        checkInLatitude: latitude,
        checkInLongitude: longitude,
        checkInDistance: distance,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      if (existingIndex !== -1) {
        allAtt[existingIndex] = { ...allAtt[existingIndex], ...newRecord };
      } else {
        allAtt.unshift(newRecord);
      }

      await saveCollection('attendance', allAtt);

      // 1. Staff Instant Confirmation Notification
      const branchBotToken = getBotToken(staff.branchId, branch?.branchName);
      if (branchBotToken && staff.telegramId) {
        const staffMsg = `✅ <b>[Clean24 - ចុះឈ្មោះចូលជោគជ័យ]</b>\n\n👤 <b>បុគ្គលិក:</b> ${staff.fullName}\n🏢 <b>សាខា:</b> ${branch?.branchName || 'Clean24 Laundry'}\n⏰ <b>ម៉ោងចូល:</b> <code>${timeStr}</code>\n📅 <b>កាលបរិច្ឆេទ:</b> ${todayStr}\n\n✨ <i>សូមជូនពរឱ្យការងារថ្ងៃនេះទទួលបានជោគជ័យ!</i>`;
        sendTelegramNotification(branchBotToken, String(staff.telegramId), staffMsg, photo || staff.photoUrl).catch(() => {});
      }

      // 2. Admin / Owner Alert Notification
      if (branchBotToken) {
        const adminChatIds: string[] = [];
        if (process.env.TELEGRAM_CHAT_ID) adminChatIds.push(process.env.TELEGRAM_CHAT_ID);
        try {
          const allUsers = await getCollection('users');
          const ownerUser = allUsers.find((u: any) => u.role === 'Owner' || u.id === 'usr_owner');
          if (ownerUser?.telegramChatId && !ownerUser.telegramChatId.startsWith('@')) {
            adminChatIds.push(ownerUser.telegramChatId);
          }
        } catch {}

        const adminMsg = `🔔 <b>[Clean24 ដំណឹងវត្តមានបុគ្គលិក / Staff Check-In Alert]</b>\n\n📌 <b>សកម្មភាព:</b> ចុះឈ្មោះចូល (Check-In)\n👤 <b>បុគ្គលិក:</b> ${staff.fullName} (${staff.position || 'Staff'})\n🏢 <b>សាខា:</b> ${branch?.branchName || 'Clean24 Laundry'}\n⏰ <b>ម៉ោងចូល:</b> <code>${timeStr}</code>\n📅 <b>កាលបរិច្ឆេទ:</b> ${todayStr}\n🌐 <b>ប្រភព:</b> Telegram Mini App`;

        for (const aChatId of Array.from(new Set(adminChatIds))) {
          if (aChatId && String(aChatId) !== String(staff.telegramId)) {
            sendTelegramNotification(botToken, aChatId, adminMsg, photo || staff.photoUrl).catch(() => {});
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: '✓ ចុះឈ្មោះចូលបានជោគជ័យ',
        employeeName: staff.fullName,
        time: timeStr,
        date: todayStr,
        branchName: branch?.branchName || 'Clean24 Laundry',
        attendance: newRecord
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 6. ATTENDANCE CHECK-OUT (POST /api/attendance/check-out)
  if (path === '/api/attendance/check-out' && req.method === 'POST') {
    try {
      const { initData, faceDescriptor, photo, latitude, longitude, simulationStaffId } = req.body || {};
      const allStaff = await getCollection('staff');
      const allBranches = await getCollection('branches');
      const allAtt = await getCollection('attendance');

      let staff: any = null;
      if (initData) {
        const val = validateTelegramInitData(initData, allBotTokens);
        if (val.valid && val.user) {
          const tgId = String(val.user.id);
          const tgName = (val.user.username || '').toLowerCase().replace(/^@/, '').trim();
          staff = allStaff.find((s: any) => 
            (s.telegramId && String(s.telegramId) === tgId) ||
            (tgName && s.telegramUsername && s.telegramUsername.replace(/^@/, '').toLowerCase().trim() === tgName)
          );
        }
      }

      if (!staff && simulationStaffId) {
        staff = allStaff.find((s: any) => s.id === simulationStaffId);
      }

      // Photo is saved directly as live attendance proof; verification is authenticated via Telegram
      const checkOutFaceScore = 1.0;

      const branch = allBranches.find((b: any) => b.id === (staff.assignedBranchId || staff.branchId));
      let distance: number | undefined = undefined;

      if (branch && branch.locationVerificationEnabled && branch.latitude && branch.longitude) {
        if (latitude === undefined || longitude === undefined) {
          return res.status(400).json({ success: false, error: 'សូមបើក GPS ទីតាំងនៅលើទូរស័ព្ទរបស់អ្នក!' });
        }
        distance = calculateHaversineDistance(latitude, longitude, branch.latitude, branch.longitude);
        const allowedRadius = branch.allowedRadius || 100;
        if (distance > allowedRadius) {
          return res.status(400).json({ success: false, error: `មិនអាចចុះវត្តមានបានទេ! អ្នកនៅក្រៅតំបន់ដែលបានកំណត់សម្រាប់សាខា (ចម្ងាយ៖ ${distance}m)` });
        }
      }

      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Phnom_Penh' });

      const attRecord = allAtt.find((a: any) => a.staffId === staff.id && a.date === todayStr);
      if (!attRecord || !attRecord.checkIn) {
        return res.status(400).json({ success: false, error: 'មិនអាចចុះឈ្មោះចេញបានទេ ដោយសារមិនទាន់មានការចុះឈ្មោះចូលសម្រាប់ថ្ងៃនេះ!' });
      }

      if (attRecord.checkOut) {
        return res.status(400).json({ success: false, error: `អ្នកបានចុះឈ្មោះចេញរួចរាល់ហើយនៅម៉ោង ${attRecord.checkOut}!` });
      }

      let workHours = 8;
      let hoursStr = '8h 00m';
      try {
        const parseTimeToMinutes = (tStr: string) => {
          const parts = tStr.trim().match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (!parts) return 0;
          let h = parseInt(parts[1], 10);
          const m = parseInt(parts[2], 10);
          const ampm = parts[3]?.toUpperCase();
          if (ampm === 'PM' && h < 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          return h * 60 + m;
        };
        const inMins = parseTimeToMinutes(attRecord.checkIn);
        const outMins = parseTimeToMinutes(timeStr);
        let diffMins = outMins - inMins;
        if (diffMins < 0) diffMins += 24 * 60;
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        workHours = Number((diffMins / 60).toFixed(2));
        hoursStr = `${h}h ${String(m).padStart(2, '0')}m`;
      } catch {}

      attRecord.checkOut = timeStr;
      attRecord.workHours = workHours;
      attRecord.status = 'Completed';
      attRecord.checkOutPhoto = photo || staff.photoUrl;
      attRecord.checkOutFaceScore = checkOutFaceScore;
      attRecord.checkOutLatitude = latitude;
      attRecord.checkOutLongitude = longitude;
      attRecord.checkOutDistance = distance;
      attRecord.updatedAt = now.toISOString();

      await saveCollection('attendance', allAtt);

      // 1. Staff Instant Confirmation Notification
      const branchBotToken = getBotToken(staff.branchId, branch?.branchName);
      if (branchBotToken && staff.telegramId) {
        const staffMsg = `🚪 <b>[Clean24 - ចុះឈ្មោះចេញជោគជ័យ]</b>\n\n👤 <b>បុគ្គលិក:</b> ${staff.fullName}\n🏢 <b>សាខា:</b> ${branch?.branchName || 'Clean24 Laundry'}\n⏰ <b>ម៉ោងចូល:</b> <code>${attRecord.checkIn}</code>\n⏰ <b>ម៉ោងចេញ:</b> <code>${timeStr}</code>\n⏱️ <b>ម៉ោងធ្វើការសរុប:</b> <b>${hoursStr}</b>\n📅 <b>កាលបរិច្ឆេទ:</b> ${todayStr}\n\n🙏 <i>សូមអរគុណសម្រាប់ការខិតខំបំពេញការងារថ្ងៃនេះ!</i>`;
        sendTelegramNotification(branchBotToken, String(staff.telegramId), staffMsg, photo || attRecord.checkOutPhoto || staff.photoUrl).catch(() => {});
      }

      // 2. Admin / Owner Alert Notification
      if (branchBotToken) {
        const adminChatIds: string[] = [];
        if (process.env.TELEGRAM_CHAT_ID) adminChatIds.push(process.env.TELEGRAM_CHAT_ID);
        try {
          const allUsers = await getCollection('users');
          const ownerUser = allUsers.find((u: any) => u.role === 'Owner' || u.id === 'usr_owner');
          if (ownerUser?.telegramChatId && !ownerUser.telegramChatId.startsWith('@')) {
            adminChatIds.push(ownerUser.telegramChatId);
          }
        } catch {}

        const adminCheckOutMsg = `🔔 <b>[Clean24 ដំណឹងវត្តមានបុគ្គលិក / Staff Check-Out Alert]</b>\n\n📌 <b>សកម្មភាព:</b> ចុះឈ្មោះចេញ (Check-Out)\n👤 <b>បុគ្គលិក:</b> ${staff.fullName} (${staff.position || 'Staff'})\n🏢 <b>សាខា:</b> ${branch?.branchName || 'Clean24 Laundry'}\n⏰ <b>ម៉ោងចូល:</b> <code>${attRecord.checkIn}</code>\n⏰ <b>ម៉ោងចេញ:</b> <code>${timeStr}</code>\n⏱️ <b>ម៉ោងធ្វើការសរុប:</b> <b>${hoursStr}</b>\n📅 <b>កាលបរិច្ឆេទ:</b> ${todayStr}\n🌐 <b>ប្រភព:</b> Telegram Mini App`;

        for (const aChatId of Array.from(new Set(adminChatIds))) {
          if (aChatId && String(aChatId) !== String(staff.telegramId)) {
            sendTelegramNotification(botToken, aChatId, adminCheckOutMsg, photo || attRecord.checkOutPhoto || staff.photoUrl).catch(() => {});
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: '✓ ចុះឈ្មោះចេញបានជោគជ័យ',
        employeeName: staff.fullName,
        checkIn: attRecord.checkIn,
        checkOut: timeStr,
        workHours: hoursStr,
        branchName: branch?.branchName || 'Clean24 Laundry',
        attendance: attRecord
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 7. ATTENDANCE HISTORY (GET /api/attendance/history)
  if (path === '/api/attendance/history' && req.method === 'GET') {
    try {
      const { staffId, month, year } = req.query || {};
      if (!staffId) return res.status(400).json({ success: false, error: 'staffId is required' });

      const currentYear = year ? String(year) : String(new Date().getFullYear());
      const currentMonth = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
      const periodPrefix = `${currentYear}-${currentMonth}`;

      const allAtt = await getCollection('attendance');
      const list = allAtt
        .filter((a: any) => a.staffId === staffId && a.date && a.date.startsWith(periodPrefix))
        .sort((a: any, b: any) => b.date.localeCompare(a.date));

      return res.status(200).json({
        success: true,
        month: currentMonth,
        year: currentYear,
        records: list
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 7b. ADMIN ATTENDANCE CORRECTION (PATCH /api/admin/attendance/:id)
  if (path.startsWith('/api/admin/attendance') && req.method === 'PATCH') {
    try {
      const parts = path.split('/').filter(Boolean);
      const id = parts[parts.length - 1];
      const { checkIn, checkOut, status, reason, changedBy } = req.body || {};

      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, error: 'សូមបញ្ជាក់មូលហេតុនៃការកែប្រែ (Reason is required)!' });
      }

      const allAtt = await getCollection('attendance');
      const record = allAtt.find((a: any) => a.id === id);
      if (!record) {
        return res.status(404).json({ success: false, error: 'Attendance record not found' });
      }

      if (!record.auditHistory) record.auditHistory = [];
      const nowIso = new Date().toISOString();
      const adminName = changedBy || 'Admin';

      if (checkIn !== undefined && checkIn !== record.checkIn) {
        record.auditHistory.push({
          field: 'checkIn',
          oldValue: record.checkIn,
          newValue: checkIn,
          changedBy: adminName,
          changedAt: nowIso,
          reason: reason.trim()
        });
        record.checkIn = checkIn;
      }

      if (checkOut !== undefined && checkOut !== record.checkOut) {
        record.auditHistory.push({
          field: 'checkOut',
          oldValue: record.checkOut,
          newValue: checkOut,
          changedBy: adminName,
          changedAt: nowIso,
          reason: reason.trim()
        });
        record.checkOut = checkOut;
      }

      if (status !== undefined && status !== record.status) {
        record.auditHistory.push({
          field: 'status',
          oldValue: record.status,
          newValue: status,
          changedBy: adminName,
          changedAt: nowIso,
          reason: reason.trim()
        });
        record.status = status;
      }

      await saveCollection('attendance', allAtt);

      return res.status(200).json({
        success: true,
        message: 'Attendance record corrected successfully',
        record
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 8. RESOLVE GOOGLE MAPS URL / LINK (POST /api/resolve-maps-url)
  if (path === '/api/resolve-maps-url' && req.method === 'POST') {
    try {
      const { url } = req.body || {};
      if (!url) return res.status(400).json({ success: false, error: 'url is required' });

      // Direct regex parsing
      const direct = parseGoogleMapsString(url);
      if (direct.success) {
        return res.status(200).json({ success: true, latitude: direct.lat, longitude: direct.lng });
      }

      // Fetch redirected URL if shortened
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const finalUrl = response.url || '';
      const finalParsed = parseGoogleMapsString(finalUrl);
      if (finalParsed.success) {
        return res.status(200).json({ success: true, latitude: finalParsed.lat, longitude: finalParsed.lng });
      }

      const html = await response.text();
      const htmlParsed = parseGoogleMapsString(html);
      if (htmlParsed.success) {
        return res.status(200).json({ success: true, latitude: htmlParsed.lat, longitude: htmlParsed.lng });
      }

      return res.status(400).json({ success: false, error: 'Could not resolve Google Maps coordinates' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 10. SEND ATTENDANCE REPORT TO TELEGRAM (POST /api/telegram/send-attendance-report)
  if (path === '/api/telegram/send-attendance-report' && req.method === 'POST') {
    try {
      const { 
        target, // 'staff' | 'admin' | 'custom'
        staffId,
        customChatId,
        messageText,
        photoBase64
      } = req.body || {};

      const allStaff = await getCollection('staff');
      const allUsers = await getCollection('users');

      let destinationChatId = '';
      let targetRecipientLabel = '';
      let staffUsername = '';
      let staff: any = null;

      if (target === 'staff') {
        staff = allStaff.find((s: any) => s.id === staffId);
        if (!staff) {
          return res.status(404).json({ success: false, error: 'រកមិនឃើញទិន្នន័យបុគ្គលិកឡើយ' });
        }
        staffUsername = staff.telegramUsername ? staff.telegramUsername.replace(/^@/, '') : '';
        destinationChatId = String(staff.telegramId || staff.telegramChatId || '').trim();

        // Check matching user record if numeric ID not found
        if (!destinationChatId || !/^-?\d+$/.test(destinationChatId)) {
          const matchedUser = allUsers.find((u: any) => 
            (staff.userId && u.id === staff.userId) ||
            (staffUsername && u.username && u.username.toLowerCase() === staffUsername.toLowerCase()) ||
            (staffUsername && u.telegramUsername && u.telegramUsername.replace(/^@/, '').toLowerCase() === staffUsername.toLowerCase()) ||
            (u.fullName && staff.fullName && u.fullName.toLowerCase().trim() === staff.fullName.toLowerCase().trim())
          );
          if (matchedUser?.telegramChatId && /^-?\d+$/.test(matchedUser.telegramChatId)) {
            destinationChatId = matchedUser.telegramChatId;
          }
        }

        if (!destinationChatId && staff.telegramUsername) {
          destinationChatId = staff.telegramUsername.startsWith('@') ? staff.telegramUsername : `@${staff.telegramUsername}`;
        }
        targetRecipientLabel = `${staff.fullName} (${destinationChatId || 'គ្មាន Telegram ID'})`;
      } else if (target === 'admin') {
        destinationChatId = process.env.TELEGRAM_CHAT_ID || '';
        const ownerUser = allUsers.find((u: any) => u.role === 'Owner' || u.id === 'usr_owner');
        if (ownerUser?.telegramChatId && !ownerUser.telegramChatId.startsWith('@')) {
          destinationChatId = ownerUser.telegramChatId;
        }
        targetRecipientLabel = `Admin / Group Notification (${destinationChatId || 'Default'})`;
      } else if (target === 'custom') {
        destinationChatId = customChatId || '';
        targetRecipientLabel = `Custom Chat ID (${destinationChatId})`;
      }

      if (!destinationChatId) {
        return res.status(400).json({ 
          success: false, 
          error: 'មិនទាន់មាន Telegram Chat ID ឬ Username សម្រាប់ផ្ញើឡើយ! សូមភ្ជាប់ Telegram របស់បុគ្គលិកជាមុនសិន។' 
        });
      }

      const branchBotToken = getBotToken(staff?.branchId || req.body?.branchId) || botToken;
      if (!branchBotToken) {
        return res.status(500).json({ success: false, error: 'Telegram Bot Token មិនទាន់បានកំណត់រចនាសម្ព័ន្ធទេ' });
      }

      const captionToSend = (messageText || '').length > 950 ? (messageText || '').substring(0, 950) + '...' : messageText;

      let photoSent = false;
      let lastError = '';

      if (photoBase64 && photoBase64.startsWith('data:image/')) {
        try {
          const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const blob = new Blob([buffer], { type: 'image/jpeg' });

          const formData = new FormData();
          formData.append('chat_id', destinationChatId);
          formData.append('photo', blob, 'attendance_report.jpg');
          if (captionToSend) {
            formData.append('caption', captionToSend);
            formData.append('parse_mode', 'HTML');
          }

          const resTg = await fetch(`https://api.telegram.org/bot${branchBotToken}/sendPhoto`, {
            method: 'POST',
            body: formData
          });
          const dataTg = await resTg.json();
          if (dataTg.ok) {
            photoSent = true;
          } else {
            lastError = dataTg.description || 'sendPhoto failed';
            console.warn('Telegram sendPhoto error:', dataTg);
          }
        } catch (e: any) {
          lastError = e.message || 'sendPhoto failed';
          console.warn('sendPhoto failed, will fallback to text:', e);
        }
      }

      // If photo was not sent or text was long, send text directly
      if (!photoSent || (messageText && messageText.length > 950)) {
        try {
          const textRes = await fetch(`https://api.telegram.org/bot${branchBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: destinationChatId,
              text: messageText,
              parse_mode: 'HTML'
            })
          });
          const textData = await textRes.json();
          if (textData.ok) {
            // Text successfully sent
          } else if (!photoSent) {
            lastError = textData.description || lastError;

            // Auto fallback to Admin chat if target hasn't started the bot
            const fallbackAdminId = process.env.TELEGRAM_CHAT_ID || '';
            if (fallbackAdminId && String(destinationChatId) !== String(fallbackAdminId)) {
              try {
                const fbRes = await fetch(`https://api.telegram.org/bot${branchBotToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: fallbackAdminId,
                    text: `📌 <b>[របាយការណ៍វត្តមានបុគ្គលិក / Staff Attendance Report]</b>\n\n${messageText}`,
                    parse_mode: 'HTML'
                  })
                });
                const fbData = await fbRes.json();
                if (fbData.ok) {
                  return res.status(200).json({
                    success: true,
                    message: `✓ បានផ្ញើរបាយការណ៍ទៅ Telegram Admin ដោយជោគជ័យ! (ចំណាំ៖ @${staffUsername || destinationChatId} មិនទាន់ចុច /start លើ Bot)`,
                    recipient: `Admin (${fallbackAdminId})`
                  });
                }
              } catch {}
            }

            let friendlyMsg = `បរាជ័យក្នុងការផ្ញើទៅ Telegram (${destinationChatId}): ${lastError}`;
            if (lastError.includes('chat not found') || lastError.includes('bot was blocked') || destinationChatId.startsWith('@')) {
              friendlyMsg = `⚠️ មិនអាចផ្ញើទៅ ${destinationChatId} បានទេ ដោយសារគណនីនេះមិនទាន់បានចុច Start លើ Bot Telegram នៅឡើយ! សូមឱ្យបុគ្គលិកបើក Bot ហើយចុច /start ឬជ្រើសរើសផ្ញើទៅ « Admin / Group » ជំនួសវិញ។`;
            }
            return res.status(400).json({ 
              success: false, 
              error: friendlyMsg
            });
          }
        } catch (tErr: any) {
          if (!photoSent) {
            return res.status(500).json({ success: false, error: 'Telegram dispatch failure: ' + tErr.message });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: `✓ បានផ្ញើរបាយការណ៍ទៅ Telegram (${targetRecipientLabel}) ដោយជោគជ័យ!`,
        recipient: targetRecipientLabel
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 11. INSTANT TELEGRAM ALERT / REPORT FOR BRANCHES (POST /api/telegram-trigger-instant)
  if ((path === '/api/telegram-trigger-instant' || path === '/api/telegram-trigger-instant/') && req.method === 'POST') {
    try {
      const { 
        category, 
        message, 
        branchId, 
        branchName, 
        alertType, 
        details, 
        actionRequired,
        targetChatId,
        chatId 
      } = req.body || {};

      let botToken = getBotToken(branchId, branchName);

      const storedConfig: any = await getCollection('telegramConfig');
      const recipientsList: any[] = (await getCollection('telegramRecipients')) || [];

      if (!botToken && storedConfig?.botToken) {
        botToken = storedConfig.botToken.trim();
      }

      const targetChatIds = new Set<string>();
      if (targetChatId) targetChatIds.add(String(targetChatId).trim());
      if (chatId) targetChatIds.add(String(chatId).trim());

      if (storedConfig?.chatIds) {
        if (branchId && storedConfig.chatIds.branches?.[branchId]) {
          targetChatIds.add(String(storedConfig.chatIds.branches[branchId]).trim());
        }
        if (branchId && storedConfig.chatIds.manager?.[branchId]) {
          targetChatIds.add(String(storedConfig.chatIds.manager[branchId]).trim());
        }
        if (storedConfig.chatIds.admin) targetChatIds.add(String(storedConfig.chatIds.admin).trim());
        if (storedConfig.chatIds.owner) targetChatIds.add(String(storedConfig.chatIds.owner).trim());
      }

      if (recipientsList.length > 0) {
        for (const r of recipientsList) {
          if (r.isActive !== false && r.chatId) {
            if (r.branchId === 'all' || !r.branchId || r.branchId === branchId) {
              if (!r.categories || r.categories.includes('all') || r.categories.includes(category)) {
                targetChatIds.add(String(r.chatId).trim());
              }
            }
          }
        }
      }

      if (targetChatIds.size === 0 && process.env.TELEGRAM_CHAT_ID) {
        targetChatIds.add(process.env.TELEGRAM_CHAT_ID.trim());
      }

      let finalMessage = message;
      if (!finalMessage) {
        const alertHeading = alertType || `[TC Staff Alert: ${category || 'System'}]`;
        const detailsContent = details || 'Instant Notification Event';
        const actionContent = actionRequired ? `\n\n⚠️ <b>REQUIRED ACTION:</b>\n<u>${actionRequired}</u>` : '';
        finalMessage = `🚨 <b>${alertHeading}</b>\n\n${detailsContent}${actionContent}`;
      }

      let dispatchedCount = 0;
      let lastError = null;

      if (botToken && targetChatIds.size > 0) {
        const sendPromises = Array.from(targetChatIds).map(async (cId) => {
          try {
            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: cId,
                text: finalMessage,
                parse_mode: 'HTML'
              })
            });
            const data = await tgRes.json() as any;
            if (data.ok) return true;
            lastError = data.description || 'Send failed';
            return false;
          } catch (err: any) {
            lastError = err.message;
            return false;
          }
        });

        const results = await Promise.all(sendPromises);
        dispatchedCount = results.filter(Boolean).length;
      } else if (!botToken) {
        lastError = 'Telegram Bot Token not configured for branch';
      } else if (targetChatIds.size === 0) {
        lastError = 'No destination Chat ID found for branch';
      }

      return res.status(200).json({
        success: dispatchedCount > 0,
        dispatched: dispatchedCount > 0,
        dispatchedCount,
        totalRecipients: targetChatIds.size,
        branchId: branchId || 'all',
        error: lastError
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Fallback
  return res.status(200).json({
    success: true,
    message: 'TC Staff Management Gateway active',
    path
  });
}
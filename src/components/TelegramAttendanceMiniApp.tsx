/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  User, 
  Building2, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  History, 
  X, 
  Loader2,
  ShieldCheck,
  Smartphone,
  Coffee
} from 'lucide-react';

interface TelegramAttendanceMiniAppProps {
  initialAction?: 'checkin' | 'checkout' | 'history';
}

export default function TelegramAttendanceMiniApp({ initialAction }: TelegramAttendanceMiniAppProps) {
  // Query parameters or initial action
  const searchParams = new URLSearchParams(window.location.search);
  const actionParam = (searchParams.get('action') || initialAction || 'checkin') as 'checkin' | 'checkout' | 'history';
  
  const [activeView, setActiveView] = useState<'action' | 'history'>(actionParam === 'history' ? 'history' : 'action');
  const [currentAction, setCurrentAction] = useState<'checkin' | 'checkout'>(actionParam === 'checkout' ? 'checkout' : 'checkin');

  // Camera State & Mirror Settings (Default to natural mirror view with ZERO flipping on capture)
  const [isMirrored, setIsMirrored] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tc_camera_mirrored');
      return saved !== null ? saved === 'true' : true; // Default true (mirror preview & capture match 100%)
    } catch {
      return true;
    }
  });
  const cameraFacingMode = 'user';

  // Telegram WebApp & Auth State
  const [initData, setInitData] = useState<string>('');
  const [isTelegramWebview, setIsTelegramWebview] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [staffInfo, setStaffInfo] = useState<any>(null);
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Camera & Capture State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVector, setCapturedVector] = useState<number[] | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Result state
  const [resultData, setResultData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // History State
  const [historyMonth, setHistoryMonth] = useState(() => new Date().getMonth() + 1);
  const [historyYear, setHistoryYear] = useState(() => new Date().getFullYear());
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // DOM Video & Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Initialize Telegram WebApp SDK & Validate Session
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setIsTelegramWebview(true);
      const rawInitData = tg.initData || '';
      setInitData(rawInitData);
      validateSession(rawInitData);
    } else {
      // In standalone browser test mode
      validateSession('');
    }

    // Get device GPS location proactively
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => {
          console.warn('Geolocation warning:', err.message);
          setLocationError('មិនអាចទទួលទីតាំង GPS បានទេ។');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  const validateSession = async (dataStr: string, isSilent: boolean = false) => {
    if (!isSilent) {
      setIsLoadingUser(true);
    }
    setAuthError(null);
    try {
      const res = await fetch('/api/telegram/validate-init-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          initData: dataStr
        })
      });

      const data = await res.json();
      if (data.success && data.staff) {
        setStaffInfo(data.staff);
        setBranchInfo(data.branch);
        setTodayAttendance(data.todayAttendance);
        
        // Auto-switch action if already checked in today
        if (data.todayAttendance?.checkIn && !data.todayAttendance?.checkOut && actionParam !== 'history') {
          setCurrentAction('checkout');
        }

        // Only auto-start camera on initial load, never during background/silent refresh after verification
        if (!isSilent) {
          setTimeout(() => {
            startCamera();
          }, 150);
        }
      } else {
        setAuthError(data.error || 'គណនី Telegram របស់អ្នកមិនទាន់បានភ្ជាប់ជាមួយបុគ្គលិក TC Staff ណាម្នាក់ឡើយ។');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error communicating with TC Staff server');
    } finally {
      if (!isSilent) {
        setIsLoadingUser(false);
      }
    }
  };

  // 2. Camera Functions
  const startCamera = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebRTC getUserMedia not supported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.warn('Video play error:', e));
        }
      }, 50);
    } catch (err: any) {
      console.warn('Camera access error:', err);
      if (fileInputRef.current) {
        fileInputRef.current.click();
      } else {
        setErrorMessage('មិនអាចបើក Camera ផ្ទាល់បានទេ! សូមអនុញ្ញាត Camera Permissions លើទូរស័ព្ទរបស់អ្នក។');
      }
    }
  };

  const handleNativeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 64, 64);
            const vector = generateFaceDescriptorFromCanvas(canvas);
            setCapturedVector(vector);
            submitAttendance(dataUrl, vector);
          }
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Detect detailed phone model, OS, and hardware environment
  const detectDeviceInfo = (): { device: string; platform: string } => {
    const ua = navigator.userAgent || '';
    const tg = (window as any).Telegram?.WebApp;
    const tgPlatform = tg?.platform || '';

    let deviceModel = 'Unknown Device';
    let osPlatform = 'Web Browser';

    // 1. Detect iOS devices
    if (/iPhone/i.test(ua)) {
      const match = ua.match(/OS (\d+[_.]\d+)/);
      const osVer = match ? match[1].replace('_', '.') : '';
      deviceModel = osVer ? `iPhone (iOS ${osVer})` : 'Apple iPhone';
      osPlatform = tgPlatform ? `Telegram (${tgPlatform})` : 'iOS Safari';
    } else if (/iPad/i.test(ua)) {
      deviceModel = 'Apple iPad';
      osPlatform = tgPlatform ? `Telegram (${tgPlatform})` : 'iPadOS';
    } else if (/Android/i.test(ua)) {
      // 2. Detect Android phone models (e.g. SM-S918B, Pixel 8, Redmi Note, etc.)
      const modelMatch = ua.match(/;\s*([^;]+?)\s*Build\//i);
      const androidVer = ua.match(/Android\s*([0-9.]+)/i);
      const verStr = androidVer ? `Android ${androidVer[1]}` : 'Android';
      if (modelMatch && modelMatch[1]) {
        deviceModel = `${modelMatch[1].trim()} (${verStr})`;
      } else {
        deviceModel = `Android Device (${verStr})`;
      }
      osPlatform = tgPlatform ? `Telegram (${tgPlatform})` : 'Android Web';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      deviceModel = 'Apple Mac';
      osPlatform = tgPlatform ? `Telegram Desktop (${tgPlatform})` : 'macOS';
    } else if (/Windows/i.test(ua)) {
      deviceModel = 'Windows PC';
      osPlatform = tgPlatform ? `Telegram Desktop (${tgPlatform})` : 'Windows';
    }

    // Additional check for Telegram WebApp platform metadata
    if (tgPlatform && !osPlatform.includes('Telegram')) {
      osPlatform = `Telegram (${tgPlatform})`;
    }

    return { device: deviceModel, platform: osPlatform };
  };

  // Generate lightweight facial descriptor vector from canvas
  const generateFaceDescriptorFromCanvas = (canvas: HTMLCanvasElement): number[] => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    // Scale to a standard 64x64 feature grid
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 64;
    tempCanvas.height = 64;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return [];

    tempCtx.drawImage(canvas, 0, 0, 64, 64);
    const imgData = tempCtx.getImageData(0, 0, 64, 64).data;

    // Extract 64-dimensional luminance distribution vector
    const vector: number[] = new Array(64).fill(0);
    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const bin = Math.floor((i / 4) / 64) % 64;
      vector[bin] += luma;
    }

    // Normalize vector
    const sum = vector.reduce((a, b) => a + b * b, 0);
    const mag = Math.sqrt(sum) || 1;
    return vector.map(v => Number((v / mag).toFixed(4)));
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 640;

    // Crop center square to match circular frame exactly (prevents any stretching or facial distortion)
    const minDim = Math.min(vWidth, vHeight);
    const startX = (vWidth - minDim) / 2;
    const startY = (vHeight - minDim) / 2;

    canvas.width = minDim;
    canvas.height = minDim;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If mirrored, mirror canvas so captured photo matches preview pixel-for-pixel with ZERO surprise flip!
    if (isMirrored) {
      ctx.translate(minDim, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, minDim, minDim);

    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const vector = generateFaceDescriptorFromCanvas(canvas);

    setCapturedImage(photoDataUrl);
    setCapturedVector(vector);
    stopCamera();

    // Trigger verification automatically
    submitAttendance(photoDataUrl, vector);
  };

  // 3. Submit Attendance Check-In / Check-Out
  const submitAttendance = async (photo: string, vector: number[]) => {
    setIsVerifying(true);
    setErrorMessage(null);
    setResultData(null);

    const endpoint = currentAction === 'checkin' ? '/api/attendance/check-in' : '/api/attendance/check-out';
    const deviceInfo = detectDeviceInfo();

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          faceDescriptor: vector,
          photo,
          latitude: locationCoords?.lat,
          longitude: locationCoords?.lng,
          device: deviceInfo.device,
          platform: deviceInfo.platform
        })
      });

      const data = await res.json();
      if (data.success) {
        setResultData(data);
        // Refresh status silently in background without resetting UI to loading screen
        validateSession(initData, true);
      } else {
        setErrorMessage(data.error || 'ការចុះវត្តមានបរាជ័យ!');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network connection failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  // 4. Fetch Attendance History
  const fetchHistory = async (m: number, y: number) => {
    if (!staffInfo?.id) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/attendance/history?staffId=${staffInfo.id}&month=${m}&year=${y}`);
      const data = await res.json();
      if (data.success) {
        setHistoryRecords(data.records || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeView === 'history' && staffInfo?.id) {
      fetchHistory(historyMonth, historyYear);
    }
  }, [activeView, historyMonth, historyYear, staffInfo]);

  const monthNamesKh = ['', 'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

  const handlePrevMonth = () => {
    if (historyMonth === 1) {
      setHistoryMonth(12);
      setHistoryYear(historyYear - 1);
    } else {
      setHistoryMonth(historyMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (historyMonth === 12) {
      setHistoryMonth(1);
      setHistoryYear(historyYear + 1);
    } else {
      setHistoryMonth(historyMonth + 1);
    }
  };

  const closeMiniApp = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.close) {
      tg.close();
    } else {
      window.close();
    }
  };

  // ─── RENDER: LOADING OR ERROR STATE ─────────────────────────────────────────
  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-3 rounded-2xl shadow-md mb-4 inline-flex">
          <img src="/logo.png" alt="TC Staff Management" className="h-14 w-auto object-contain" />
        </div>
        <Loader2 className="animate-spin text-amber-500 mb-2" size={32} />
        <h2 className="text-base font-bold text-slate-200">TC Staff Management</h2>
        <p className="text-xs text-slate-400 mt-1">កំពុងផ្ទៀងផ្ទាត់គណនី Telegram...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
            <AlertCircle size={36} />
          </div>
          <h2 className="text-base font-black text-slate-900">គណនីមិនទាន់បានភ្ជាប់ / Unlinked</h2>
          <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-2xl text-xs text-amber-950 font-medium leading-relaxed text-left">
            {authError}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            សូមទាក់ទង <b>Admin ឬ Manager</b> របស់អ្នកដើម្បីចុះឈ្មោះ និងភ្ជាប់គណនី Telegram នេះទៅកាន់ប្រព័ន្ធ TC Staff មុនពេលចុះវត្តមាន។
          </p>
          <div className="flex gap-2 pt-2">
            <button 
              onClick={() => validateSession(initData)}
              className="flex-1 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer transition"
            >
              ផ្ទៀងផ្ទាត់ឡើងវិញ
            </button>
            <button 
              onClick={closeMiniApp}
              className="flex-1 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
            >
              ចាកចេញ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col max-w-md mx-auto relative font-sans select-none pb-8">
      {/* Top Mobile App Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 sticky top-0 z-30 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="TC Staff" className="h-9 w-auto object-contain shrink-0" />
          <div className="border-l border-slate-200 pl-2">
            <div className="text-[10px] font-black text-amber-900 uppercase leading-none">TC STAFF</div>
            <div className="text-xs font-bold text-slate-800 leading-tight mt-0.5">{staffInfo?.fullName || 'Staff Member'}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setActiveView(activeView === 'action' ? 'history' : 'action')}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
              activeView === 'history' ? 'bg-blue-50 text-[#003D9B] border border-blue-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
            }`}
          >
            <History size={15} />
            <span className="text-[11px]">{activeView === 'history' ? 'វត្តមាន' : 'ប្រវត្តិ'}</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="p-4 space-y-4 flex-1">
        {/* VIEW 1: ATTENDANCE CHECK-IN / CHECK-OUT */}
        {activeView === 'action' && (
          <div className="space-y-4">
            {/* Staff & Today's Status Header Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Building2 size={14} className="text-[#003D9B]" />
                  <span className="font-bold">{branchInfo?.branchName || 'TC Staff Management'}</span>
                </div>
                <div className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {staffInfo?.position || 'Staff'}
                </div>
              </div>

              {/* Status Pills */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <div className="text-[10.5px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock size={12} className="text-emerald-500" />
                    <span>ម៉ោងចូល៖</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                    {todayAttendance?.checkIn || '--'}
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <div className="text-[10.5px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock size={12} className="text-rose-500" />
                    <span>ម៉ោងចេញ៖</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                    {todayAttendance?.checkOut || '--'}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Mode Toggle (Check In vs Check Out) */}
            {!resultData && (
              <div className="bg-slate-200/80 p-1 rounded-2xl flex gap-1 text-xs font-bold">
                <button
                  onClick={() => {
                    setCurrentAction('checkin');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    currentAction === 'checkin'
                      ? 'bg-[#003D9B] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  <span>ចុះឈ្មោះចូល</span>
                </button>

                <button
                  onClick={() => {
                    setCurrentAction('checkout');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    currentAction === 'checkout'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock size={14} />
                  <span>ចុះឈ្មោះចេញ</span>
                </button>
              </div>
            )}

            {/* SUCCESS RESULT VIEW */}
            {resultData ? (
              <div className="bg-white rounded-3xl p-6 border border-emerald-200 shadow-md text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
                {/* Verified Photo or Success Icon */}
                <div className="relative mx-auto w-24 h-24">
                  {capturedImage ? (
                    <img
                      src={capturedImage}
                      alt="Verified Face"
                      className="w-24 h-24 rounded-full object-cover border-4 border-emerald-500 shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                      <CheckCircle2 size={48} />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1.5 shadow-md border-2 border-white">
                    <CheckCircle2 size={16} />
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-2">
                    <span>✓ COMPLETE / ជោគជ័យ</span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900">{resultData.message}</h2>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{staffInfo?.fullName}</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2 text-left">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>កាលបរិច្ឆេទ ៖</span>
                    <span className="font-bold text-slate-900">{resultData.date || new Date().toISOString().substring(0, 10)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>ម៉ោង ៖</span>
                    <span className="font-bold text-blue-700 font-mono text-sm">{resultData.time || resultData.checkOut}</span>
                  </div>
                  {resultData.workHours && (
                    <div className="flex justify-between items-center text-slate-600">
                      <span>ម៉ោងធ្វើការសរុប ៖</span>
                      <span className="font-bold text-emerald-700 font-mono text-sm">{resultData.workHours}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-600">
                    <span>សាខា ៖</span>
                    <span className="font-bold text-slate-900">{resultData.branchName || branchInfo?.branchName}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setResultData(null);
                      setCapturedImage(null);
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    ត្រឡប់ក្រោយ
                  </button>
                  <button
                    onClick={closeMiniApp}
                    className="flex-1 py-2.5 bg-[#003D9B] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    បិទ
                  </button>
                </div>
              </div>
            ) : (
              /* CAMERA & VERIFICATION CARD */
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 text-center">
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900">
                    {currentAction === 'checkin' ? 'ចុះឈ្មោះចូល' : 'ចុះឈ្មោះចេញ'}
                  </h3>
                  <p className="text-xs text-slate-500">សូមថតរូបមុខរបស់អ្នកដើម្បីផ្ទៀងផ្ទាត់វត្តមាន</p>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-2xl flex items-start gap-2 text-left">
                    <AlertCircle size={16} className="shrink-0 text-rose-500 mt-0.5" />
                    <span className="font-medium leading-relaxed">{errorMessage}</span>
                  </div>
                )}

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  capture="user" 
                  className="hidden" 
                  onChange={handleNativeFileUpload} 
                />

                {/* Camera / Photo Frame */}
                <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-[#003D9B]/20 bg-slate-900 flex items-center justify-center shadow-inner">
                  {isCameraActive ? (
                    <>
                      <video 
                        ref={(el) => {
                          videoRef.current = el;
                          if (el && streamRef.current && el.srcObject !== streamRef.current) {
                            el.srcObject = streamRef.current;
                            el.play().catch(() => {});
                          }
                        }}
                        autoPlay
                        playsInline 
                        muted 
                        className="w-full h-full object-cover transition-transform duration-150"
                        style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
                      />
                      {/* Face positioning oval overlay */}
                      <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-full pointer-events-none" />
                    </>
                  ) : capturedImage ? (
                    <img 
                      src={capturedImage} 
                      alt="Selfie" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div 
                      onClick={startCamera}
                      className="text-slate-400 space-y-2 p-4 cursor-pointer hover:text-white transition"
                    >
                      <Camera size={48} className="mx-auto text-slate-500" />
                      <p className="text-[11px]">ចុចទីនេះដើម្បីបើក Camera</p>
                    </div>
                  )}

                  {isVerifying && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
                      <Loader2 size={32} className="animate-spin text-blue-400" />
                      <span className="text-xs font-bold">កំពុងផ្ទៀងផ្ទាត់ផ្ទៃមុខ...</span>
                    </div>
                  )}
                </div>

                {/* Mirror / Orientation Control Toggle */}
                {isCameraActive && (
                  <div className="flex items-center justify-center pt-1 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isMirrored;
                        setIsMirrored(next);
                        try { localStorage.setItem('tc_camera_mirrored', String(next)); } catch (_) {}
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer border shadow-xs ${
                        isMirrored 
                          ? 'bg-amber-50 border-amber-300 text-amber-900' 
                          : 'bg-slate-100 border-slate-300 text-slate-700'
                      }`}
                      title="ត្រឡប់រូបភាព / Toggle Mirror"
                    >
                      <span>{isMirrored ? '🪞 កញ្ចក់ឆ្លុះ (Mirror): បើក' : '📷 រូបភាពធម្មតា (Normal)'}</span>
                    </button>
                  </div>
                )}

                {/* Camera Buttons */}
                {!isCameraActive ? (
                  <button
                    onClick={startCamera}
                    disabled={isVerifying}
                    className="w-full py-3 bg-[#003D9B] hover:bg-blue-800 text-white rounded-2xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-blue-900/10"
                  >
                    <Camera size={16} />
                    <span>បើក Camera</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={stopCamera}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer"
                    >
                      បោះបង់
                    </button>
                    <button
                      onClick={capturePhoto}
                      disabled={isVerifying}
                      className={`flex-1 py-3 text-white rounded-2xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-md ${
                        currentAction === 'checkin'
                          ? 'bg-[#003D9B] hover:bg-blue-800 shadow-blue-900/10'
                          : 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/10'
                      }`}
                    >
                      <Camera size={16} />
                      <span>{currentAction === 'checkin' ? 'ថតរូបចុះឈ្មោះចូល' : 'ថតរូបចុះឈ្មោះចេញ'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: ATTENDANCE HISTORY */}
        {activeView === 'history' && (
          <div className="space-y-3">
            {/* Month Selector Bar */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex items-center justify-between">
              <button 
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="text-center">
                <div className="text-xs font-black text-slate-900">
                  ខែ {monthNamesKh[historyMonth]} {historyYear}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">ប្រវត្តិវត្តមានប្រចាំខែ</div>
              </div>

              <button 
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* History Records List */}
            {isLoadingHistory ? (
              <div className="text-center py-12 text-slate-400">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-[#003D9B]" />
                <p className="text-xs">កំពុងទាញយកប្រវត្តិ...</p>
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-400 space-y-2">
                <Calendar size={36} className="mx-auto text-slate-300" />
                <p className="text-xs font-bold">មិនមានទិន្នន័យវត្តមានក្នុងខែនេះទេ</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyRecords.map((rec) => (
                  <div 
                    key={rec.id} 
                    className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-black text-slate-900">
                        {rec.date}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 space-x-2">
                        <span>ចូល: <strong className="text-slate-800">{rec.checkIn || '--'}</strong></span>
                        <span>ចេញ: <strong className="text-slate-800">{rec.checkOut || '--'}</strong></span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-emerald-700 font-mono">
                        {rec.workHours ? `${rec.workHours} ម៉ោង` : '--'}
                      </div>
                      <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                        rec.status === 'Completed' || rec.status === 'Present'
                          ? 'bg-emerald-50 text-emerald-700'
                          : rec.status === 'Working'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {rec.status === 'Completed' ? '✓ បញ្ចប់' : rec.status === 'Working' ? '⏳ កំពុងធ្វើការ' : rec.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

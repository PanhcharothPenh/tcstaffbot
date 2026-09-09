/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Users, 
  Plus, 
  MapPin, 
  PhoneCall, 
  Briefcase, 
  Clock, 
  UserPlus, 
  ShieldAlert, 
  CreditCard,
  Edit2,
  Trash2,
  Contact2,
  Upload,
  Camera,
  User as UserIcon,
  X,
  Image as ImageIcon,
  CheckCircle2,
  Smartphone,
  ShieldCheck,
  Loader2,
  Send,
  UserX,
  UserCheck,
  AlertTriangle
} from 'lucide-react';
import { Staff, Role, Branch } from '../types';
import { translations, db } from '../mockData';
import { formatCurrency } from '../utils';
import { userApi } from '../utils/api';

interface StaffManagementViewProps {
  currentRole: Role;
  activeBranchId: string;
  branches: Branch[];
  staff: Staff[];
  setStaff: React.Dispatch<React.SetStateAction<Staff[]>>;
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function StaffManagementView({
  currentRole,
  activeBranchId,
  branches,
  staff,
  setStaff,
  lang,
  onAddLog
}: StaffManagementViewProps) {
  const t = translations[lang];
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Resigned'>('all');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [branchId, setBranchId] = useState(() => branches[0]?.id || 'b1');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dob, setDob] = useState('1998-01-01');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [position, setPosition] = useState<string>('Helper');
  const [shift, setShift] = useState<'Morning' | 'Afternoon' | 'Night' | 'Full Time'>('Morning');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [resignationDate, setResignationDate] = useState('');
  const [status, setStatus] = useState<'Active' | 'Resigned' | 'Suspended'>('Active');
  const [baseSalary, setBaseSalary] = useState(250);
  const [idCardNumber, setIdCardNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [attendanceEnabled, setAttendanceEnabled] = useState(true);

  // User Account Auto-Creation Toggle
  const [createUserAccount, setCreateUserAccount] = useState(false);
  const [userAccountUsername, setUserAccountUsername] = useState('');
  const [userAccountEmail, setUserAccountEmail] = useState('');
  const [userAccountPassword, setUserAccountPassword] = useState('Coffee@123');
  const [userAccountRole, setUserAccountRole] = useState<string>('Staff');
  const [userAccountBranches, setUserAccountBranches] = useState<string[]>([]);

  // Delete & Resign Modals State
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [resignModalStaff, setResignModalStaff] = useState<Staff | null>(null);
  const [resignDateInput, setResignDateInput] = useState(() => new Date().toISOString().substring(0, 10));

  // Face Enrollment Modal State
  const [enrollingStaff, setEnrollingStaff] = useState<Staff | null>(null);
  const [isFaceCameraOpen, setIsFaceCameraOpen] = useState(false);
  const [faceCapturedPhoto, setFaceCapturedPhoto] = useState<string | null>(null);
  const [isEnrollingFace, setIsEnrollingFace] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);

  // Telegram Link Modal State
  const [linkingStaff, setLinkingStaff] = useState<Staff | null>(null);
  const [linkTelegramId, setLinkTelegramId] = useState('');
  const [linkTelegramUsername, setLinkTelegramUsername] = useState('');
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);

  // Handle image upload from file picker
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(lang === 'kh' ? 'រូបភាពធំពេក (លើសពី 5MB)!' : 'Image file is too large (max 5MB)!');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setPhotoUrl(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle image paste from clipboard (Ctrl+V)
  const handleImagePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (ev.target?.result) {
              setPhotoUrl(ev.target.result as string);
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  // 1. Roles access
  const isAuthorized = ['Owner', 'Admin', 'Manager'].includes(currentRole);

  if (!isAuthorized) {
    return (
      <div className="bg-white border border-rose-100 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-sm" id="security_guard_notice">
        <ShieldAlert className="text-rose-500 mx-auto mb-4" size={54} />
        <h3 className="text-lg font-bold text-slate-800">{lang === 'en' ? "Access Restriction Alert" : "ការព្រមានការកម្រិតសិទ្ធិ"}</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {t.warningRoleLimit}
        </p>
      </div>
    );
  }

  // 2. Filter list based on branch rules and active branch selection
  const getFilteredStaff = () => {
    let list = Array.isArray(staff) ? staff : [];

    if (activeBranchId !== 'all') {
      list = list.filter(s => s.branchId === activeBranchId);
    }

    if (statusFilter !== 'all') {
      list = list.filter(s => statusFilter === 'Active' ? (s.status === 'Active' || !s.status) : s.status === statusFilter);
    }

    return list;
  };

  const filteredStaff = getFilteredStaff();

  const handleCreateOrEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !idCardNumber) return;

    const pic = (photoUrl || '').trim();

    if (editingStaff) {
      // Edit
      const updated = staff.map(s => s.id === editingStaff.id ? {
        ...s,
        fullName,
        branchId,
        gender,
        dob,
        phone,
        address,
        position,
        shift,
        startDate,
        resignationDate: status === 'Resigned' ? (resignationDate || s.resignationDate || new Date().toISOString().substring(0, 10)) : undefined,
        status,
        baseSalary: Number(baseSalary),
        idCardNumber,
        emergencyContact,
        photoUrl: pic,
        telegramId: telegramId || s.telegramId,
        telegramUsername: telegramUsername || s.telegramUsername,
        telegramLinked: Boolean(telegramId || s.telegramId),
        attendanceEnabled: status === 'Active' ? attendanceEnabled : false
      } : s);
      setStaff(updated);
      db.saveStaff(updated);
      fetch('/api/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff: updated })
      }).catch(() => {});
      onAddLog(`Updated staff profile for ${fullName}`);
      setEditingStaff(null);
    } else {
      // Create
      const newStaff: Staff = {
        id: 's_' + Date.now(),
        fullName,
        branchId,
        gender,
        dob,
        phone,
        address,
        position,
        shift,
        startDate,
        baseSalary: Number(baseSalary),
        status: 'Active',
        photoUrl: pic,
        idCardNumber,
        emergencyContact,
        telegramId: telegramId || undefined,
        telegramUsername: telegramUsername || undefined,
        telegramLinked: Boolean(telegramId),
        attendanceEnabled
      };
      const updated = [...staff, newStaff];
      setStaff(updated);
      db.saveStaff(updated);
      fetch('/api/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff: updated })
      }).catch(() => {});
      onAddLog(`Registered new staff "${fullName}" under position ${position}`);

      if (createUserAccount) {
        userApi.createUser({
          fullName,
          username: userAccountUsername || fullName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          email: userAccountEmail || `${fullName.toLowerCase().replace(/[^a-z0-9]/g, '')}@clean24.com`,
          phone,
          password: userAccountPassword || 'Clean24@123',
          role: userAccountRole as Role,
          assignedBranchIds: userAccountBranches.length > 0 ? userAccountBranches : [branchId],
          status: 'Active',
          twoFactorMethod: 'disabled'
        } as any).then(() => {
          onAddLog(`Linked login user account was auto-created for staff member ${fullName}`);
        }).catch((err) => {
          console.error('Failed to auto-create credentials during staff setup:', err);
          alert(`Staff registered successfully, but automatic login account creation failed: ${err.message}`);
        });
      }
    }

    resetForm();
  };

  const resetForm = () => {
    setEditingStaff(null);
    setFullName('');
    setPhone('');
    setAddress('');
    setIdCardNumber('');
    setEmergencyContact('');
    setPhotoUrl('');
    setTelegramId('');
    setTelegramUsername('');
    setGender('Female');
    setPosition('Staff');
    setShift('Morning');
    setStartDate(new Date().toISOString().substring(0, 10));
    setResignationDate('');
    setStatus('Active');
    setBaseSalary(250);
    setAttendanceEnabled(true);
    setCreateUserAccount(false);
    setUserAccountUsername('');
    setUserAccountEmail('');
    setUserAccountPassword('');
    setUserAccountRole('Staff');
    setUserAccountBranches([]);
    setShowForm(false);
  };

  const startEdit = (s: Staff) => {
    setEditingStaff(s);
    setFullName(s.fullName);
    setBranchId(s.branchId);
    setGender(s.gender);
    setDob(s.dob);
    setPhone(s.phone);
    setAddress(s.address);
    setPosition(s.position);
    setShift(s.shift);
    setStartDate(s.startDate);
    setResignationDate(s.resignationDate || '');
    setStatus(s.status || 'Active');
    setBaseSalary(s.baseSalary);
    setIdCardNumber(s.idCardNumber);
    setEmergencyContact(s.emergencyContact);
    setPhotoUrl(s.photoUrl && !s.photoUrl.includes('images.unsplash.com') ? s.photoUrl : '');
    setTelegramId(s.telegramId || '');
    setTelegramUsername(s.telegramUsername || '');
    setAttendanceEnabled(s.attendanceEnabled !== false);
    setShowForm(true);
  };

  const handleOpenResignModal = (s: Staff) => {
    setResignModalStaff(s);
    setResignDateInput(s.resignationDate || new Date().toISOString().substring(0, 10));
  };

  const confirmToggleResign = () => {
    if (!resignModalStaff) return;
    const isCurrentlyActive = resignModalStaff.status === 'Active' || !resignModalStaff.status;
    const updatedStatus: 'Active' | 'Resigned' = isCurrentlyActive ? 'Resigned' : 'Active';

    const updated = staff.map(st => st.id === resignModalStaff.id ? {
      ...st,
      status: updatedStatus,
      resignationDate: isCurrentlyActive ? resignDateInput : undefined,
      attendanceEnabled: !isCurrentlyActive
    } : st);

    setStaff(updated);
    db.saveStaff(updated);
    fetch('/api/sync-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff: updated })
    }).catch(() => {});

    onAddLog(isCurrentlyActive 
      ? `Staff member "${resignModalStaff.fullName}" marked as Resigned on ${resignDateInput}`
      : `Staff member "${resignModalStaff.fullName}" re-activated to Active`
    );
    setResignModalStaff(null);
  };

  const confirmDeleteStaff = () => {
    if (!staffToDelete) return;
    const updated = staff.filter(s => s.id !== staffToDelete.id);
    setStaff(updated);
    db.saveStaff(updated);
    fetch('/api/sync-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff: updated })
    }).catch(() => {});

    onAddLog(`Deleted staff record: "${staffToDelete.fullName}"`);
    setStaffToDelete(null);
  };

  const toggleStaffStatus = (id: string, status: 'Active' | 'Resigned' | 'Suspended') => {
    const updated = staff.map(s => s.id === id ? { ...s, status } : s);
    setStaff(updated);
    db.saveStaff(updated);
    fetch('/api/sync-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff: updated })
    }).catch(() => {});
    onAddLog(`Toggled staff ID ${id} status to ${status}`);
  };

  const getBranchCode = (bId: string) => {
    const b = branches.find(x => x.id === bId);
    return b ? b.branchCode : bId;
  };

  // ─── FACE ENROLLMENT HANDLERS ────────────────────────────────────────────────
  const openFaceModal = (s: Staff) => {
    setEnrollingStaff(s);
    setFaceCapturedPhoto(s.photoUrl || null);
    setIsFaceCameraOpen(false);
  };

  const startFaceCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      faceStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsFaceCameraOpen(true);
    } catch (err: any) {
      alert('Cannot open camera: ' + err.message);
    }
  };

  const stopFaceCamera = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach(t => t.stop());
      faceStreamRef.current = null;
    }
    setIsFaceCameraOpen(false);
  };

  const captureFaceFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL('image/jpeg', 0.9);
    setFaceCapturedPhoto(photo);
    stopFaceCamera();
  };

  // Generate lightweight facial descriptor vector from canvas
  const generateFaceDescriptor = (imageSrc: string): Promise<number[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve([]);
          return;
        }
        ctx.drawImage(img, 0, 0, 64, 64);
        const imgData = ctx.getImageData(0, 0, 64, 64).data;

        const vector: number[] = new Array(64).fill(0);
        for (let i = 0; i < imgData.length; i += 4) {
          const luma = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
          const bin = Math.floor((i / 4) / 64) % 64;
          vector[bin] += luma;
        }
        const sum = vector.reduce((a, b) => a + b * b, 0);
        const mag = Math.sqrt(sum) || 1;
        resolve(vector.map(v => Number((v / mag).toFixed(4))));
      };
      img.src = imageSrc;
    });
  };

  const handleSaveFaceEnrollment = async () => {
    if (!enrollingStaff || !faceCapturedPhoto) {
      alert('សូមថតរូប ឬ Upload រូបថតផ្ទៃមុខជាមុនសិន!');
      return;
    }

    setIsEnrollingFace(true);
    try {
      const vector = await generateFaceDescriptor(faceCapturedPhoto);
      const vectorStr = JSON.stringify(vector);

      const updated = staff.map(s => s.id === enrollingStaff.id ? {
        ...s,
        faceEnrolled: true,
        faceEnrolledAt: new Date().toISOString(),
        faceReference: vectorStr,
        photoUrl: faceCapturedPhoto
      } : s);

      setStaff(updated);
      db.saveStaff(updated);
      fetch('/api/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff: updated })
      }).catch(() => {});

      await fetch('/api/face/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: enrollingStaff.id,
          faceReference: vectorStr,
          photoUrl: faceCapturedPhoto
        })
      });

      onAddLog(`Enrolled face verification for ${enrollingStaff.fullName}`);
      alert(lang === 'kh' ? `✓ បានចុះឈ្មោះផ្ទៃមុខសម្រាប់ ${enrollingStaff.fullName} ដោយជោគជ័យ!` : 'Face successfully enrolled!');
      setEnrollingStaff(null);
    } catch (err: any) {
      alert('Error saving face enrollment: ' + err.message);
    } finally {
      setIsEnrollingFace(false);
    }
  };

  // ─── TELEGRAM LINK / UNLINK HANDLERS ─────────────────────────────────────────
  const openTelegramModal = (s: Staff) => {
    setLinkingStaff(s);
    setLinkTelegramId(s.telegramId || '');
    setLinkTelegramUsername(s.telegramUsername || '');
  };

  const handleSaveTelegramLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingStaff || !linkTelegramId.trim()) return;

    setIsSavingTelegram(true);
    try {
      const updated = staff.map(s => s.id === linkingStaff.id ? {
        ...s,
        telegramId: linkTelegramId.trim(),
        telegramUsername: linkTelegramUsername.trim(),
        telegramLinked: true
      } : s);

      setStaff(updated);
      db.saveStaff(updated);
      fetch('/api/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff: updated })
      }).catch(() => {});

      await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: linkingStaff.id,
          telegramId: linkTelegramId.trim(),
          telegramUsername: linkTelegramUsername.trim()
        })
      });

      onAddLog(`Linked Telegram ID ${linkTelegramId.trim()} to ${linkingStaff.fullName}`);
      setLinkingStaff(null);
    } catch (err: any) {
      alert('Error linking Telegram: ' + err.message);
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!linkingStaff) return;
    if (!confirm(`តើអ្នកពិតជាចង់ផ្តាច់ Telegram របស់ ${linkingStaff.fullName} មែនទេ?`)) return;

    setIsSavingTelegram(true);
    try {
      const updated = staff.map(s => {
        if (s.id === linkingStaff.id) {
          const clone = { ...s, telegramLinked: false };
          delete clone.telegramId;
          delete clone.telegramUsername;
          return clone;
        }
        return s;
      });

      setStaff(updated);
      db.saveStaff(updated);
      fetch('/api/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff: updated })
      }).catch(() => {});

      await fetch('/api/telegram/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: linkingStaff.id })
      });

      onAddLog(`Unlinked Telegram for ${linkingStaff.fullName}`);
      setLinkingStaff(null);
    } catch (err: any) {
      alert('Error unlinking Telegram: ' + err.message);
    } finally {
      setIsSavingTelegram(false);
    }
  };

  return (
    <div className="space-y-6" id="staff_management_module">
      {/* Top Controls & Status Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 sm:p-4 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {lang === 'kh' ? 'ទាំងអស់' : 'All'} ({staff.length})
          </button>
          <button
            onClick={() => setStatusFilter('Active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'Active' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-emerald-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{lang === 'kh' ? 'សកម្ម' : 'Active'} ({staff.filter(s => s.status === 'Active' || !s.status).length})</span>
          </button>
          <button
            onClick={() => setStatusFilter('Resigned')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'Resigned' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-rose-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>{lang === 'kh' ? 'ឈប់ធ្វើការ' : 'Resigned'} ({staff.filter(s => s.status === 'Resigned').length})</span>
          </button>
        </div>

        {['Owner', 'Admin'].includes(currentRole) && (
          <button
            onClick={() => {
              if (!showForm) {
                resetForm();
                setShowForm(true);
              } else {
                resetForm();
              }
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#003D9B] text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-blue-800 transition cursor-pointer"
            id="add_staff_trigger"
          >
            <Plus size={14} />
            {t.addNews}
          </button>
        )}
      </div>

      {/* CREATE / EDIT STAFF FORM */}
      {showForm && (
        <form onSubmit={handleCreateOrEdit} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4" id="form_staff_entry">
          <h4 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
            {editingStaff ? `${t.edit} - ${editingStaff.fullName}` : t.addNews}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.fullName} *</label>
              <input
                type="text"
                placeholder="e.g. Srey Pich"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">Branch *</label>
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.branchName} ({b.branchCode})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.gender} *</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.phone} *</label>
              <input
                type="text"
                placeholder="e.g. 096 111 222"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.position} *</label>
              <input
                type="text"
                list="staff_positions_list"
                placeholder={lang === 'kh' ? 'បញ្ចូល ឬជ្រើសរើសតួនាទី...' : 'Enter or select position...'}
                value={position}
                onChange={e => setPosition(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-medium text-slate-800"
                required
              />
              <datalist id="staff_positions_list">
                <option value="Helper">Helper (បុគ្គលិកទូទៅ)</option>
                <option value="Cashier">Cashier (គិតលុយ)</option>
                <option value="Laundry Operator">Laundry Operator (អ្នកបោកគក់)</option>
                <option value="Supervisor">Supervisor (ប្រធានផ្នែក)</option>
                <option value="Manager">Manager (អ្នកគ្រប់គ្រង)</option>
                <option value="Technician">Technician (ជាងបច្ចេកទេស)</option>
                <option value="Delivery">Delivery (ដឹកជញ្ជូន)</option>
                <option value="Cleaner">Cleaner (អនាម័យ)</option>
              </datalist>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.shift} *</label>
              <select
                value={shift}
                onChange={e => setShift(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
              >
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Night">Night</option>
                <option value="Full Time">Full Time</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.idCard} *</label>
              <input
                type="text"
                placeholder="e.g. 012098755"
                value={idCardNumber}
                onChange={e => setIdCardNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.emergency} *</label>
              <input
                type="text"
                placeholder="e.g. 012 999 881 (Mother)"
                value={emergencyContact}
                onChange={e => setEmergencyContact(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.baseSalary} (USD) *</label>
              <input
                type="number"
                min="0"
                step="5"
                value={baseSalary}
                onChange={e => setBaseSalary(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none font-mono"
                required
              />
            </div>

            {/* Status Selector when editing */}
            {editingStaff && (
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1 block">ស្ថានភាពបុគ្គលិក (Status)</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none font-bold"
                >
                  <option value="Active">🟢 ដំណើរការ (Active)</option>
                  <option value="Resigned">🛑 ឈប់ធ្វើការ (Resigned)</option>
                  <option value="Suspended">⚠️ ផ្អាកបណ្តោះអាសន្ន (Suspended)</option>
                </select>
              </div>
            )}

            {/* Resignation date when editing and resigned */}
            {editingStaff && status === 'Resigned' && (
              <div>
                <label className="text-[11px] font-bold text-rose-600 mb-1 block">កាលបរិច្ឆេទឈប់ (Resignation Date)</label>
                <input
                  type="date"
                  value={resignationDate}
                  onChange={e => setResignationDate(e.target.value)}
                  className="w-full bg-rose-50/50 border border-rose-200 text-xs rounded-xl p-2.5 focus:outline-none font-bold text-rose-900"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">Telegram User ID (លេខសម្គាល់)</label>
              <input
                type="text"
                placeholder="e.g. 123456789"
                value={telegramId}
                onChange={e => setTelegramId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">Telegram Username</label>
              <input
                type="text"
                placeholder="e.g. @sreypich"
                value={telegramUsername}
                onChange={e => setTelegramUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="chk_attendance_enabled"
                checked={attendanceEnabled}
                onChange={e => setAttendanceEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="chk_attendance_enabled" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                អនុញ្ញាតឱ្យចុះវត្តមាន (Enable Attendance)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#003D9B] text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition cursor-pointer shadow-xs"
            >
              {t.save}
            </button>
          </div>
        </form>
      )}

      {/* STAFF CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.map((s) => (
          <div key={s.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs relative flex flex-col justify-between hover:border-slate-300 transition-all">
            {/* Status Pill */}
            <span className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              s.status === 'Active' || !s.status ? 'bg-emerald-100 text-emerald-800' : s.status === 'Suspended' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {s.status === 'Active' || !s.status ? t.active : s.status === 'Suspended' ? t.suspended : t.resigned}
            </span>

            {/* Profile Section */}
            <div>
              <div className="flex gap-3.5 items-center mb-3.5">
                {s.photoUrl ? (
                  <img 
                    referrerPolicy="no-referrer"
                    src={s.photoUrl} 
                    alt={s.fullName} 
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-100 shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-[#003D9B] flex items-center justify-center font-bold text-lg border-2 border-slate-100 shrink-0 shadow-2xs">
                    {s.fullName ? s.fullName.charAt(0).toUpperCase() : 'S'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{s.fullName}</h3>
                  <div className="flex gap-1.5 mt-1 items-center">
                    <span className="text-[9px] font-bold uppercase py-0.5 px-2 bg-slate-100 text-slate-700 rounded">
                      {s.position}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium font-mono">
                      {getBranchCode(s.branchId)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Attendance & Biometric Integration Badges */}
              <div className="grid grid-cols-2 gap-2 mb-3 text-[10.5px]">
                {/* Face Verification Badge */}
                <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                  s.faceEnrolled 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  <ShieldCheck size={13} className={s.faceEnrolled ? 'text-emerald-600' : 'text-slate-400'} />
                  <span className="font-bold truncate">
                    {s.faceEnrolled ? 'Face: Enrolled ✓' : 'Face: Not Set'}
                  </span>
                </div>

                {/* Telegram Linked Badge */}
                <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                  s.telegramId 
                    ? 'bg-sky-50 text-sky-800 border-sky-200' 
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  <Smartphone size={13} className={s.telegramId ? 'text-sky-600' : 'text-slate-400'} />
                  <span className="font-bold truncate">
                    {s.telegramId ? (s.telegramUsername ? `@${s.telegramUsername.replace('@', '')}` : 'TG Linked ✓') : 'TG: Not Linked'}
                  </span>
                </div>
              </div>

              {/* Roster fields listing */}
              <div className="space-y-1.5 text-xs border-t border-slate-100 pt-2.5 text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">{t.phone}:</span>
                  <span className="font-semibold text-slate-800 font-mono">{s.phone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">{t.shift}:</span>
                  <div className="flex items-center gap-1 font-semibold text-slate-800">
                    <Clock size={12} className="text-slate-400" />
                    <span>{s.shift}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">{t.baseSalary}:</span>
                  <span className="font-bold text-emerald-700 font-mono">{formatCurrency(s.baseSalary, 'USD')}</span>
                </div>
                {s.status === 'Resigned' && s.resignationDate && (
                  <div className="flex items-center justify-between text-rose-600 font-bold text-[11px] pt-1">
                    <span>ថ្ងៃឈប់:</span>
                    <span>{s.resignationDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            {['Owner', 'Admin'].includes(currentRole) && (
              <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 justify-end">
                {/* Face Registration Button */}
                <button
                  onClick={() => openFaceModal(s)}
                  className="flex items-center gap-1 text-[10.5px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  title="ចុះឈ្មោះ / ផ្លាស់ប្តូរផ្ទៃមុខសម្រាប់ស្កេនវត្តមាន"
                >
                  <Camera size={12} className="text-emerald-600" />
                  <span>Face ID</span>
                </button>

                {/* Telegram Link Button */}
                <button
                  onClick={() => openTelegramModal(s)}
                  className="flex items-center gap-1 text-[10.5px] font-bold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  title="ភ្ជាប់គណនី Telegram"
                >
                  <Send size={12} className="text-sky-600" />
                  <span>Telegram</span>
                </button>

                {/* Edit Button */}
                <button
                  onClick={() => startEdit(s)}
                  className="flex items-center gap-1 text-[10.5px] font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                >
                  <Edit2 size={11} />
                  <span>{t.edit}</span>
                </button>

                {/* Resign / Re-activate Toggle Button */}
                {s.status === 'Resigned' ? (
                  <button
                    onClick={() => handleOpenResignModal(s)}
                    className="flex items-center gap-1 text-[10.5px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                    title={lang === 'kh' ? 'កំណត់ជាបុគ្គលិកសកម្មឡើងវិញ' : 'Re-activate Staff'}
                  >
                    <UserCheck size={12} className="text-emerald-600" />
                    <span>{lang === 'kh' ? 'ចូលវិញ' : 'Active'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenResignModal(s)}
                    className="flex items-center gap-1 text-[10.5px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                    title={lang === 'kh' ? 'កំណត់ជាបុគ្គលិកឈប់ធ្វើការ (Resigned)' : 'Mark as Resigned'}
                  >
                    <UserX size={12} className="text-amber-600" />
                    <span>{lang === 'kh' ? 'ឈប់' : 'Resign'}</span>
                  </button>
                )}

                {/* Delete Staff Button */}
                <button
                  onClick={() => setStaffToDelete(s)}
                  className="flex items-center gap-1 text-[10.5px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  title={lang === 'kh' ? 'លុបទិន្នន័យបុគ្គលិកនេះចេញ' : 'Delete Staff'}
                >
                  <Trash2 size={12} className="text-rose-600" />
                  <span>{lang === 'kh' ? 'លុប' : 'Delete'}</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ─── FACE ENROLLMENT MODAL ────────────────────────────────────────────── */}
      {enrollingStaff && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-left">
              <div>
                <h3 className="text-sm font-black text-slate-900">ចុះឈ្មោះផ្ទៃមុខ (Face Enrollment)</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{enrollingStaff.fullName}</p>
              </div>
              <button 
                onClick={() => {
                  stopFaceCamera();
                  setEnrollingStaff(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Camera View or Photo Preview */}
            <div className="relative w-56 h-56 mx-auto rounded-full overflow-hidden border-4 border-emerald-500/20 bg-slate-900 flex items-center justify-center shadow-inner">
              {isFaceCameraOpen ? (
                <>
                  <video 
                    ref={videoRef} 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-full pointer-events-none" />
                </>
              ) : faceCapturedPhoto ? (
                <img 
                  src={faceCapturedPhoto} 
                  alt="Reference Face" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="text-slate-400 space-y-2 p-4">
                  <Camera size={42} className="mx-auto text-slate-500" />
                  <p className="text-[11px]">ចុចខាងក្រោមដើម្បីបើក Camera</p>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            {!isFaceCameraOpen ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startFaceCamera}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Camera size={14} />
                  <span>បើក Camera ថតរូប</span>
                </button>
                <label className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5">
                  <Upload size={14} />
                  <span>Upload រូបថត</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const r = new FileReader();
                        r.onload = ev => setFaceCapturedPhoto(ev.target?.result as string);
                        r.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={stopFaceCamera}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="button"
                  onClick={captureFaceFrame}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Camera size={14} />
                  <span>ថតយករូបភាពនេះ</span>
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  stopFaceCamera();
                  setEnrollingStaff(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                បិទ
              </button>
              <button
                type="button"
                disabled={isEnrollingFace || !faceCapturedPhoto}
                onClick={handleSaveFaceEnrollment}
                className="flex-1 py-2.5 bg-[#003D9B] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isEnrollingFace ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>{isEnrollingFace ? 'កំពុងរក្សាទុក...' : 'ចុះឈ្មោះផ្ទៃមុខ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TELEGRAM LINK / UNLINK MODAL ─────────────────────────────────────── */}
      {linkingStaff && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={handleSaveTelegramLink} className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-[#003D9B]" />
                <h3 className="text-sm font-black text-slate-900">ភ្ជាប់គណនី Telegram (Telegram Link)</h3>
              </div>
              <button 
                type="button"
                onClick={() => setLinkingStaff(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-sky-50 p-3 rounded-2xl border border-sky-100 text-xs text-sky-900">
              <span className="font-bold">{linkingStaff.fullName}</span> ({linkingStaff.position})
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Telegram User ID (លេខសម្គាល់) *</label>
                <input
                  type="text"
                  placeholder="e.g. 589210984"
                  value={linkTelegramId}
                  onChange={e => setLinkTelegramId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono font-bold"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  💡 បុគ្គលិកត្រូវបើក Telegram រួចចុច <b>/start</b> លើ Bot Telegram របស់ក្រុមហ៊ុន ដើម្បីមើលលេខ ID និងកត់ត្រាវត្តមាន។
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">Telegram Username (@)</label>
                <input
                  type="text"
                  placeholder="e.g. @sreypich"
                  value={linkTelegramUsername}
                  onChange={e => setLinkTelegramUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              {linkingStaff.telegramId && (
                <button
                  type="button"
                  onClick={handleUnlinkTelegram}
                  disabled={isSavingTelegram}
                  className="px-3 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition cursor-pointer border border-rose-200"
                >
                  ផ្តាច់គណនី
                </button>
              )}
              <button
                type="button"
                onClick={() => setLinkingStaff(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="submit"
                disabled={isSavingTelegram}
                className="flex-1 py-2.5 bg-[#003D9B] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSavingTelegram ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── RESIGN / RE-ACTIVATE CONFIRMATION MODAL ───────────────────────── */}
      {resignModalStaff && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl border ${
                resignModalStaff.status === 'Resigned'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-amber-50 text-amber-600 border-amber-200'
              }`}>
                {resignModalStaff.status === 'Resigned' ? <UserCheck size={24} /> : <UserX size={24} />}
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {resignModalStaff.status === 'Resigned'
                    ? (lang === 'kh' ? 'ចូលធ្វើការវិញ (Re-activate Staff)' : 'Re-activate Staff')
                    : (lang === 'kh' ? 'បុគ្គលិកឈប់ធ្វើការ (Mark as Resigned)' : 'Mark as Resigned')
                  }
                </h3>
                <p className="text-xs text-slate-500">
                  {resignModalStaff.fullName} ({resignModalStaff.position})
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs space-y-2 text-slate-700">
              {resignModalStaff.status === 'Resigned' ? (
                <p className="leading-relaxed">
                  តើអ្នកចង់ឱ្យបុគ្គលិក <b>{resignModalStaff.fullName}</b> ត្រឡប់មកមានស្ថានភាព <b>« សកម្ម (Active) »</b> និងអនុញ្ញាតឱ្យកត់ត្រាវត្តមានឡើងវិញមែនទេ?
                </p>
              ) : (
                <>
                  <p className="leading-relaxed">
                    កំណត់ឱ្យបុគ្គលិក <b>{resignModalStaff.fullName}</b> មានស្ថានភាព <b>« ឈប់ធ្វើការ (Resigned) »</b>។ ប្រព័ន្ធនឹងរក្សាទុកប្រវត្តិកន្លងមក ប៉ុន្តែនឹងបិទសិទ្ធិចុះវត្តមានថ្មី។
                  </p>
                  <div className="pt-2">
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">កាលបរិច្ឆេទឈប់ (Resignation Date):</label>
                    <input
                      type="date"
                      value={resignDateInput}
                      onChange={e => setResignDateInput(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResignModalStaff(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'kh' ? 'បោះបង់' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmToggleResign}
                className={`flex-1 py-2.5 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5 ${
                  resignModalStaff.status === 'Resigned'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {resignModalStaff.status === 'Resigned' ? <UserCheck size={14} /> : <UserX size={14} />}
                <span>
                  {resignModalStaff.status === 'Resigned'
                    ? (lang === 'kh' ? 'បញ្ជាក់ចូលវិញ' : 'Confirm Activate')
                    : (lang === 'kh' ? 'បញ្ជាក់ការឈប់' : 'Confirm Resign')
                  }
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE STAFF CONFIRMATION MODAL ───────────────────────────────── */}
      {staffToDelete && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {lang === 'kh' ? 'បញ្ជាក់ការលុបបុគ្គលិក' : 'Confirm Delete Staff'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'kh' ? 'តើអ្នកពិតជាចង់លុបទិន្នន័យបុគ្គលិកនេះមែនទេ?' : 'Are you sure you want to delete this staff member?'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs space-y-1.5 text-slate-700">
              <div className="font-bold text-slate-900 text-sm">{staffToDelete.fullName}</div>
              <div>តួនាទី: <span className="font-bold">{staffToDelete.position}</span></div>
              <div>សាខា: <span className="font-bold">{getBranchCode(staffToDelete.branchId)}</span></div>
              <div className="text-rose-600 text-[11px] pt-1">
                ⚠️ ចំណាំ៖ ការលុបនេះនឹងដកទិន្នន័យបុគ្គលិកចេញពីប្រព័ន្ធទាំងស្រុង។ ប្រសិនបើបុគ្គលិកគ្រាន់តែឈប់ធ្វើការ សូមប្រើប្រាស់ប៊ូតុង « ឈប់ (Resign) » ជំនួសវិញ។
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                {lang === 'kh' ? 'បោះបង់' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmDeleteStaff}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>{lang === 'kh' ? 'លុបចេញ' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

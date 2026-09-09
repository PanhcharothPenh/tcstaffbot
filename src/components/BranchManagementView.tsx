/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Edit3, 
  MapPin, 
  PhoneCall, 
  UserPlus, 
  Clock, 
  ShieldAlert, 
  Trophy, 
  BarChart, 
  TrendingUp, 
  CheckCircle,
  XCircle,
  Navigation,
  Crosshair,
  Link2,
  Loader2,
  Trash2
} from 'lucide-react';
import { Branch, Role, User } from '../types';
import { translations, db } from '../mockData';
import { formatCurrency } from '../utils';

interface BranchManagementViewProps {
  currentRole: Role;
  branches: Branch[];
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
  users: User[];
  lang: 'en' | 'kh';
  onAddLog: (msg: string) => void;
}

export default function BranchManagementView({
  currentRole,
  branches,
  setBranches,
  users,
  lang,
  onAddLog
}: BranchManagementViewProps) {
  const t = translations[lang];
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [managerId, setManagerId] = useState('');
  const [openTime, setOpenTime] = useState('06:00 AM');
  const [closeTime, setCloseTime] = useState('10:00 PM');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [allowedRadius, setAllowedRadius] = useState<number>(100);
  const [locationVerificationEnabled, setLocationVerificationEnabled] = useState<boolean>(true);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [googleMapsInput, setGoogleMapsInput] = useState('');
  const [isResolvingMapUrl, setIsResolvingMapUrl] = useState(false);

    const parseGoogleMapsInput = (text: string): { lat: string; lng: string; success: boolean } => {
    if (!text) return { lat: '', lng: '', success: false };
    let raw = '';
    try {
      raw = decodeURIComponent(text.trim());
    } catch (e) {
      raw = text.trim();
    }

    // Extract URL or target if there's surrounding text
    const urlMatch = raw.match(/https?:\/\/[^\s"'<>]+/);
    const target = urlMatch ? urlMatch[0] : raw;

    // 1. Direct coordinates e.g. "11.556374, 104.928210" or "11.556374 104.928210"
    const directMatch = target.match(/(-?\d{1,3}\.\d+)[,\s;]+(-?\d{1,3}\.\d+)/);
    if (directMatch) {
      const lat = parseFloat(directMatch[1]);
      const lng = parseFloat(directMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat: lat.toFixed(6), lng: lng.toFixed(6), success: true };
      }
    }

    // 2. Google Maps @lat,lng e.g. /@11.556374,104.928210,17z
    const atMatch = target.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
    if (atMatch) {
      return { lat: parseFloat(atMatch[1]).toFixed(6), lng: parseFloat(atMatch[2]).toFixed(6), success: true };
    }

    // 3. PB embed !3dlat!4dlng or !3dlat!2dlng
    const pbMatch = target.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/) || target.match(/!3d(-?\d{1,3}\.\d+)!2d(-?\d{1,3}\.\d+)/);
    if (pbMatch) {
      return { lat: parseFloat(pbMatch[1]).toFixed(6), lng: parseFloat(pbMatch[2]).toFixed(6), success: true };
    }

    // 4. Query params ?q=lat,lng or ?query=lat,lng or center=lat,lng
    const qMatch = target.match(/(?:[?&](?:q|query|ll|center|sll|daddr)=|center=)(-?\d{1,3}\.\d+)[,%2C\s]+(-?\d{1,3}\.\d+)/i);
    if (qMatch) {
      return { lat: parseFloat(qMatch[1]).toFixed(6), lng: parseFloat(qMatch[2]).toFixed(6), success: true };
    }

    // 5. DMS coordinates e.g. 11°33'22.9"N 104°55'41.6"E
    const dmsMatch = target.match(/(\d+)°(\d+)'([\d.]+)"([NS])[\s,]+(\d+)°(\d+)'([\d.]+)"([EW])/i);
    if (dmsMatch) {
      let lat = Number(dmsMatch[1]) + Number(dmsMatch[2])/60 + Number(dmsMatch[3])/3600;
      let lng = Number(dmsMatch[5]) + Number(dmsMatch[6])/60 + Number(dmsMatch[7])/3600;
      if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
      if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;
      return { lat: lat.toFixed(6), lng: lng.toFixed(6), success: true };
    }

    return { lat: '', lng: '', success: false };
  };

  const handleProcessGoogleMapsInput = async (val: string) => {
    setGoogleMapsInput(val);
    if (!val.trim()) return;

    // 1. Instant client-side regex extraction
    const parsed = parseGoogleMapsInput(val);
    if (parsed.success) {
      setLatitude(parsed.lat);
      setLongitude(parsed.lng);
      return;
    }

    // 2. If it's a URL, resolve through API
    const hasUrl = val.includes('http://') || val.includes('https://') || val.includes('goo.gl') || val.includes('google.com/maps') || val.includes('maps.app');
    if (hasUrl) {
      setIsResolvingMapUrl(true);
      try {
        const res = await fetch('/api/resolve-maps-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: val.trim() })
        });
        const data = await res.json();
        if (data && data.success && data.latitude && data.longitude) {
          setLatitude(String(data.latitude));
          setLongitude(String(data.longitude));
        }
      } catch (err) {
        console.warn('Map URL resolve error:', err);
      } finally {
        setIsResolvingMapUrl(false);
      }
    }
  };

  // Verify Role (Permissions: Owner and Admin have full access to this page)
  if (currentRole !== 'Owner' && currentRole !== 'Admin') {
    return (
      <div className="bg-white border border-rose-100 rounded-3xl p-8 text-center max-w-xl mx-auto shadow-xs" id="security_guard_notice">
        <ShieldAlert className="text-rose-500 mx-auto mb-4" size={54} />
        <h3 className="text-lg font-bold text-slate-800">{lang === 'en' ? "Access Restriction Alert" : "ការព្រមានការកម្រិតសិទ្ធិ"}</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {t.warningRoleLimit}
        </p>
      </div>
    );
  }

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Browser does not support Geolocation.');
      return;
    }
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGoogleMapsInput(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setIsDetectingGps(false);
      },
      (err) => {
        alert('Failed to get GPS location: ' + err.message);
        setIsDetectingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCreateOrEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      alert(lang === 'kh' ? 'សូមបញ្ចូលកូដ និងឈ្មោះសាខា!' : 'Please enter branch code and branch name!');
      return;
    }

    const managerObj = users.find(u => u.id === managerId);
    const mName = managerObj ? managerObj.fullName : 'Unassigned';

    let latNum = latitude ? parseFloat(latitude) : undefined;
    let lngNum = longitude ? parseFloat(longitude) : undefined;

    // Direct fallback from googleMapsInput if available
    if (googleMapsInput) {
      const parsed = parseGoogleMapsInput(googleMapsInput);
      if (parsed.success) {
        latNum = parseFloat(parsed.lat);
        lngNum = parseFloat(parsed.lng);
      }
    }

    let finalBranches: Branch[] = [];
    if (editingBranch) {
      // Edit
      finalBranches = branches.map(b => b.id === editingBranch.id ? {
        ...b,
        branchCode: code.trim(),
        branchName: name.trim(),
        address: address.trim() || 'Phnom Penh, Cambodia',
        phone: phone.trim(),
        managerId,
        managerName: mName,
        openingTime: openTime || '06:00 AM',
        closingTime: closeTime || '10:00 PM',
        status,
        latitude: latNum,
        longitude: lngNum,
        allowedRadius: Number(allowedRadius) || 100,
        locationVerificationEnabled,
        updatedAt: new Date().toISOString()
      } : b);
      setBranches(finalBranches);
      db.saveBranches(finalBranches);
      fetch('/api/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branches: finalBranches })
      }).catch(err => console.warn('Cloud sync error for branches:', err));
      onAddLog(`Edited branch "${name.trim()}" details (${code.trim()})`);
      setEditingBranch(null);
    } else {
      // Create
      const newB: Branch = {
        id: 'b_' + Date.now(),
        branchCode: code.trim(),
        branchName: name.trim(),
        address: address.trim() || 'Phnom Penh, Cambodia',
        phone: phone.trim(),
        managerId,
        managerName: mName,
        openingTime: openTime || '06:00 AM',
        closingTime: closeTime || '10:00 PM',
        status,
        latitude: latNum,
        longitude: lngNum,
        allowedRadius: Number(allowedRadius) || 100,
        locationVerificationEnabled,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      finalBranches = [...branches, newB];
      setBranches(finalBranches);
      db.saveBranches(finalBranches);
      fetch('/api/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branches: finalBranches })
      }).catch(err => console.warn('Cloud sync error for branches:', err));
      onAddLog(`Created new branch "${name.trim()}" with code ${code.trim()}`);
    }

    // Reset Form
    setCode('');
    setName('');
    setAddress('');
    setPhone('');
    setManagerId('');
    setOpenTime('06:00 AM');
    setCloseTime('10:00 PM');
    setStatus('Active');
    setLatitude('');
    setLongitude('');
    setGoogleMapsInput('');
    setAllowedRadius(100);
    setLocationVerificationEnabled(true);
    setShowForm(false);
  };

  const startEdit = (b: Branch) => {
    setEditingBranch(b);
    setCode(b.branchCode);
    setName(b.branchName);
    setAddress(b.address);
    setPhone(b.phone || '');
    setManagerId(b.managerId || '');
    setOpenTime(b.openingTime || '06:00 AM');
    setCloseTime(b.closingTime || '10:00 PM');
    setStatus(b.status);
    setLatitude(b.latitude ? String(b.latitude) : '');
    setLongitude(b.longitude ? String(b.longitude) : '');
    setGoogleMapsInput(b.latitude && b.longitude ? `${b.latitude}, ${b.longitude}` : '');
    setAllowedRadius(b.allowedRadius || 100);
    setLocationVerificationEnabled(b.locationVerificationEnabled !== false);
    setShowForm(true);
  };

  const toggleStatus = (b: Branch) => {
    const nextStatus = b.status === 'Active' ? 'Inactive' : 'Active';
    const updated = branches.map(x => x.id === b.id ? { ...x, status: nextStatus, updatedAt: new Date().toISOString() } : x);
    setBranches(updated);
    db.saveBranches(updated);
    fetch('/api/sync-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branches: updated })
    }).catch(err => console.warn('Cloud sync error for branches:', err));
    onAddLog(`Toggled status of branch "${b.branchName}" to ${nextStatus}`);
  };

  const handleDeleteBranch = (b: Branch) => {
    if (branches.length <= 1) {
      alert(lang === 'kh' ? 'មិនអាចលុបសាខាចុងក្រោយបានទេ!' : 'Cannot delete the only remaining branch!');
      return;
    }
    const confirmMsg = lang === 'kh' 
      ? `តើអ្នកពិតជាចង់លុបសាខា "${b.branchName}" (${b.branchCode}) មែនទេ?` 
      : `Are you sure you want to delete branch "${b.branchName}" (${b.branchCode})?`;
    if (!window.confirm(confirmMsg)) return;

    const updated = branches.filter(x => x.id !== b.id);
    setBranches(updated);
    db.saveBranches(updated);
    fetch('/api/sync-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branches: updated })
    }).catch(err => console.warn('Cloud sync error for branches:', err));
    onAddLog(`Deleted branch "${b.branchName}" (${b.branchCode})`);
  };

  return (
    <div className="space-y-6" id="branch_management_module">
      {/* Action Button Bar */}
      <div className="flex justify-end items-center">
        <button
          onClick={() => {
            setEditingBranch(null);
            setShowForm(!showForm);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#003D9B] text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-900/10 hover:bg-blue-800 transition cursor-pointer"
          id="btn_add_branch_trigger"
        >
          <Plus size={14} />
          {t.addNews}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateOrEdit} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4" id="form_branch_entry">
          <h4 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
            {editingBranch ? `${t.edit} - ${editingBranch.branchName}` : t.addNews}
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.branchCode} *</label>
              <input
                type="text"
                placeholder="e.g. TC-TK01"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.branchName} *</label>
              <input
                type="text"
                placeholder="e.g. Toul Kork Branch"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.branchPhone}</label>
              <input
                type="text"
                placeholder="e.g. 012 345 678"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.branchManager}</label>
              <select
                value={managerId}
                onChange={e => setManagerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
              >
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.openingHours}</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="e.g. 06:00 AM"
                  value={openTime}
                  onChange={e => setOpenTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="e.g. 10:00 PM"
                  value={closeTime}
                  onChange={e => setCloseTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.status}</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none"
              >
                <option value="Active">{t.active}</option>
                <option value="Inactive">{t.inactive}</option>
              </select>
            </div>

            {/* GPS Geolocation Settings */}
            <div className="sm:col-span-2 bg-blue-50/40 border border-blue-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
                  <MapPin size={15} className="text-[#003D9B]" />
                  <span>ទីតាំង GPS និងការកំណត់កាំវត្តមាន (Branch GPS & Attendance Geofence)</span>
                </div>
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isDetectingGps}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-[#003D9B] border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Crosshair size={12} />
                  <span>{isDetectingGps ? 'កំពុងស្វែងរក GPS...' : '📍 យកទីតាំងបច្ចុប្បន្ន'}</span>
                </button>
              </div>

              {/* Google Maps Link / Coordinates Auto-Generator Box */}
              <div className="bg-white p-3 rounded-xl border border-blue-200/80 shadow-2xs space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Link2 size={13} className="text-[#003D9B]" />
                    <span>បិទភ្ជាប់តំណ Google Maps (Paste Google Maps Link / Coordinates)</span>
                  </span>
                  {isResolvingMapUrl && (
                    <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
                      <Loader2 size={11} className="animate-spin" /> កំពុងទាញយកកូអរដោនេ...
                    </span>
                  )}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="បិទភ្ជាប់ Link (ឧ. https://maps.app.goo.gl/... ឬ 11.5305, 104.8821)"
                    value={googleMapsInput}
                    onChange={e => handleProcessGoogleMapsInput(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  {googleMapsInput && (
                    <button
                      type="button"
                      onClick={() => setGoogleMapsInput('')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      សម្អាត
                    </button>
                  )}
                </div>
                <p className="text-[10.5px] text-slate-500 leading-normal">
                  💡 គ្រាន់តែ Copy link ពី Google Maps (ឬលេខកូអរដោនេ) រួច Paste ចូលទីនេះ ប្រព័ន្ធនឹងទាញយក <b>Latitude</b> & <b>Longitude</b> ដោយស្វ័យប្រវត្តិតែម្តង។
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1">Latitude (រយៈទទឹង)</label>
                  <input
                    type="text"
                    placeholder="e.g. 11.556374"
                    value={latitude}
                    onChange={e => setLatitude(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1">Longitude (រយៈបណ្តោយ)</label>
                  <input
                    type="text"
                    placeholder="e.g. 104.928210"
                    value={longitude}
                    onChange={e => setLongitude(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1">កាំអនុញ្ញាត (Radius ម៉ែត្រ)</label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    step="10"
                    value={allowedRadius}
                    onChange={e => setAllowedRadius(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-xs rounded-xl p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk_location_verification"
                  checked={locationVerificationEnabled}
                  onChange={e => setLocationVerificationEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chk_location_verification" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                  បើកដំណើរការផ្ទៀងផ្ទាត់ទីតាំង GPS នៅពេលបុគ្គលិកចុះវត្តមាន (Enable Geofence Verification)
                </label>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{t.address}</label>
              <textarea
                rows={2}
                placeholder="e.g. Street 1986, Phnom Penh"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingBranch(null);
              }}
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

      {/* BRANCHES LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((b) => (
          <div key={b.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs relative flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-blue-50 text-[#003D9B] rounded-md border border-blue-100">
                    {b.branchCode}
                  </span>
                  <h3 className="font-black text-slate-900 text-base mt-1.5">{b.branchName}</h3>
                </div>
                <button
                  onClick={() => toggleStatus(b)}
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full cursor-pointer transition ${
                    b.status === 'Active' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {b.status === 'Active' ? t.active : t.inactive}
                </button>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                <div className="flex items-center gap-2">
                  <UserPlus size={13} className="text-slate-400 shrink-0" />
                  <span>{t.branchManager}: <strong className="text-slate-800">{b.managerName || 'Unassigned'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-slate-400 shrink-0" />
                  <span>{b.openingTime || '06:00 AM'} - {b.closingTime || '10:00 PM'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                  <span className="truncate">{b.address || 'Phnom Penh, Cambodia'}</span>
                </div>

                {/* GPS Badge */}
                {b.latitude && b.longitude && (
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 text-[10.5px] font-mono text-slate-600 flex items-center justify-between mt-2">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Navigation size={11} className="text-[#003D9B]" />
                      <span>{b.latitude}, {b.longitude}</span>
                    </span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                      ±{b.allowedRadius || 100}m
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
              {branches.length > 1 && (
                <button
                  onClick={() => handleDeleteBranch(b)}
                  className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
                  title="Delete Branch"
                >
                  <Trash2 size={13} />
                  <span>{t.delete}</span>
                </button>
              )}
              <button
                onClick={() => startEdit(b)}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                <Edit3 size={13} />
                <span>{t.edit}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

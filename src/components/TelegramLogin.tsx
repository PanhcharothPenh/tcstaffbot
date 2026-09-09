/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import { Languages, Loader2, User, Lock, Check, Send, ExternalLink, Eye, EyeOff, Globe, ChevronDown, Shield, KeyRound, Sparkles } from 'lucide-react';
import { saveSession, authApi } from '../utils/api';
import TCLogo from './TCLogo';

interface TelegramLoginProps {
  onLoginSuccess: (user: any) => void;
  lang?: 'en' | 'kh';
  setLang?: (lang: 'en' | 'kh') => void;
}

export default function TelegramLogin({ onLoginSuccess, lang: propLang, setLang: propSetLang }: TelegramLoginProps) {
  const [internalLang, setInternalLang] = useState<'kh' | 'en'>(() => {
    try {
      const saved = localStorage.getItem('clean24_lang');
      if (saved === 'en' || saved === 'kh') return saved;
    } catch {}
    return 'kh'; // Default Khmer as primary
  });

  const lang = propLang || internalLang;
  const handleToggleLang = () => {
    const nextLang = lang === 'en' ? 'kh' : 'en';
    try {
      localStorage.setItem('clean24_lang', nextLang);
    } catch {}
    setInternalLang(nextLang);
    if (propSetLang) propSetLang(nextLang);
  };

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Real authentication input states
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [remember, setRemember] = useState<boolean>(false);

  // Telegram Bot 2FA Gateway states
  const [mfaRequired, setMfaRequired] = useState<boolean>(false);
  const [mfaToken, setMfaToken] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');

  // Telegram Password Reset States
  const [isResetMode, setIsResetMode] = useState<boolean>(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetIdentifier, setResetIdentifier] = useState<string>('');
  const [resetMfaToken, setResetMfaToken] = useState<string>('');
  const [resetPinCode, setResetPinCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);

  // Retrieve remembered username on mount
  useEffect(() => {
    const remembered = authApi.getRememberedUser();
    if (remembered) {
      setUsername(remembered.replace('@tcstaff.com', ''));
      setRemember(true);
    }
  }, []);

  // Set pristine body background
  useEffect(() => {
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#ffffff';
    return () => {
      document.body.style.backgroundColor = originalBg;
    };
  }, []);

  // Handle Login Authentication & Automatic Telegram 2FA PIN Dispatch
  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const inputUser = username.trim();
    const inputPass = password.trim();

    if (!inputUser || !inputPass) {
      setError(lang === 'en' ? 'Please enter your username and password' : 'សូមបញ្ចូលឈ្មោះប្រើប្រាស់ និងលេខកូដសម្ងាត់');
      setLoading(false);
      return;
    }

    try {
      // 1. Authenticate login credentials with server
      const result = await authApi.login(inputUser, inputPass, remember);
      
      // If server returns full user directly without 2FA
      if (result && result.id && !result.require2fa) {
        setSuccess(lang === 'en' ? 'Login successful! Opening dashboard...' : 'ចូលប្រើប្រាស់ជោគជ័យ!');
        setTimeout(() => onLoginSuccess(result), 300);
        return;
      }
      
      // Switch to 2FA PIN Verification Step (Server already dispatched 1 Telegram PIN notification)
      const mfaTok = result?.mfaToken || ('mfa_token_' + Date.now());
      setMfaRequired(true);
      setMfaToken(mfaTok);
      if (result?.dispatched) {
        setSuccess(null);
        setError(null);
      } else {
        setError(result?.telegramNotice || (lang === 'en' ? 'Could not reach Telegram. Please press /start on the bot.' : 'រកមិនឃើញគណនី Telegram របស់អ្នកឡើយ។ សូមបើក Telegram រួចចុច /start លើ Bot ជាមុនសិន។'));
        setSuccess(null);
      }
    } catch (err: any) {
      // STRICT ERROR HANDLING: Show error directly and NEVER enter 2FA or send Telegram OTP!
      setError(err?.message || (lang === 'en' ? 'Invalid username or password' : 'ឈ្មោះគណនី ឬលេខសម្ងាត់មិនត្រឹមត្រូវឡើយ'));
    } finally {
      setLoading(false);
    }
  };

  // Handle Request Telegram Password Reset Code
  const handleRequestResetPIN = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const identifier = resetIdentifier.trim();
    if (!identifier) {
      setError(lang === 'en' ? 'Please enter your username or email' : 'សូមបញ្ចូលឈ្មោះគណនី ឬអ៊ីមែល');
      setLoading(false);
      return;
    }

    try {
      const res = await authApi.forgotPassword(identifier);
      if (res && res.success) {
        setResetMfaToken(res.mfaToken || '');
        setResetStep(2);
        setSuccess(null);
      } else {
        setError(res?.message || (lang === 'en' ? 'User account not found' : 'រកមិនឃើញគណនីនេះក្នុងប្រព័ន្ធឡើយ'));
      }
    } catch (err: any) {
      // IF USER DOES NOT EXIST: RETURN EXPLICIT ERROR NOTIFICATION
      setError(err?.message || (lang === 'en' ? 'No registered account found with this username/email' : 'រកមិនឃើញគណនីនេះក្នុងប្រព័ន្ធឡើយ! សូមពិនិត្យឈ្មោះគណនីឡើងវិញ'));
    } finally {
      setLoading(false);
    }
  };

  // Handle Confirm New Password with Telegram Reset PIN
  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const pin = resetPinCode.trim();
    const newPass = newPassword.trim();

    if (!pin || !newPass) {
      setError(lang === 'en' ? 'Please enter the PIN code and your new password' : 'សូមបញ្ចូលលេខកូដ PIN និងលេខសម្ងាត់ថ្មី');
      setLoading(false);
      return;
    }

    try {
      const res = await authApi.resetPassword(pin, newPass, resetMfaToken);
      if (res && res.success) {
        setSuccess(
          lang === 'en'
            ? '✅ Password reset successfully! Please log in with your new password.'
            : '✅ បានប្តូរលេខសម្ងាត់ជោគជ័យ! សូមចូលប្រើប្រាស់ជាមួយលេខសម្ងាត់ថ្មីរបស់អ្នក។'
        );
        setUsername(resetIdentifier);
        setPassword('');
        setTimeout(() => {
          setIsResetMode(false);
          setResetStep(1);
          setResetPinCode('');
          setNewPassword('');
        }, 1200);
      } else {
        setError(res?.message || (lang === 'en' ? 'Failed to reset password' : 'មិនអាចប្តូរលេខសម្ងាត់បានឡើយ'));
      }
    } catch (err: any) {
      setError(err?.message || (lang === 'en' ? 'Invalid PIN code or reset failed' : 'លេខកូដ PIN មិនត្រឹមត្រូវ ឬការប្តូរលេខសម្ងាត់មិនជោគជ័យឡើយ'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend2FA = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Re-trigger login to generate a fresh signed MFA token and dispatch PIN via Telegram
      const loginRes = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: username.trim(), password: password.trim() })
      });
      const loginData = await loginRes.json();
      if (loginData && loginData.mfaToken) {
        setMfaToken(loginData.mfaToken);
      }
      if (loginData?.dispatched) {
        setSuccess(null);
        setError(null);
      } else {
        setError(loginData?.telegramNotice || (lang === 'en' ? 'Could not dispatch 2FA to Telegram. Please press /start on the bot first.' : 'មិនអាចផ្ញើលេខកូដទៅ Telegram បានទេ។ សូមចុច /start លើ Bot ជាមុនសិន។'));
        setSuccess(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to resend PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#e8f1ff] via-[#f4f7fe] to-[#eaf2ff] font-sans select-none overflow-x-hidden relative flex flex-col justify-between items-center px-4 py-8 sm:py-12">
      
      {/* BACKGROUND DECORATIVE GLOWS & ARCS */}
      <div className="absolute -top-40 -left-40 w-[480px] h-[480px] bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] bg-indigo-400/15 rounded-full blur-3xl pointer-events-none" />
      
      {/* Ambient Decorative SVG Wave Lines */}
      <svg className="absolute bottom-0 right-0 w-[600px] h-[600px] pointer-events-none opacity-40 text-blue-300" viewBox="0 0 600 600" fill="none">
        <circle cx="600" cy="600" r="300" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 6" />
        <circle cx="600" cy="600" r="450" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="600" cy="600" r="580" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
      </svg>
      <svg className="absolute top-0 left-0 w-[500px] h-[500px] pointer-events-none opacity-30 text-blue-300" viewBox="0 0 500 500" fill="none">
        <circle cx="0" cy="0" r="240" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="0" cy="0" r="380" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      {/* TOP BAR: LANGUAGE SWITCHER */}
      <div className="w-full max-w-6xl flex justify-end items-center z-20">
        <button
          type="button"
          onClick={handleToggleLang}
          className="flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white border border-blue-100/80 rounded-full text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-sm hover:shadow backdrop-blur-md"
          id="login_lang_toggle"
        >
          <Globe size={14} className="text-blue-600" />
          <span>{lang === 'en' ? 'English (US)' : 'ភាសាខ្មែរ (KH)'}</span>
          <ChevronDown size={12} className="text-slate-400 ml-0.5" />
        </button>
      </div>

      {/* MAIN CONTAINER: AUTHENTICATION FORM CARD */}
      <div className="w-full max-w-[430px] my-auto z-10 flex flex-col items-center text-center space-y-6">
        
        {/* TC Staff Brand Logo */}
        <div className="flex flex-col items-center justify-center">
          <TCLogo className="h-28 sm:h-32" showText={true} lightMode={true} />
        </div>

        {/* AUTHENTICATION CARD */}
        <div className="w-full bg-white/90 backdrop-blur-xl rounded-3xl p-7 sm:p-9 shadow-[0_20px_50px_rgba(30,80,180,0.06)] border border-white/80 space-y-5">
          
          {/* Sub-Header */}
          <div className="text-center space-y-1">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight font-sans">
              {isResetMode ? (
                resetStep === 1 
                  ? (lang === 'en' ? 'Reset Password' : 'ផ្លាស់ប្តូរលេខសម្ងាត់') 
                  : (lang === 'en' ? 'Set New Password' : 'កំណត់លេខសម្ងាត់ថ្មី')
              ) : !mfaRequired ? (
                lang === 'en' ? 'Welcome to Management System' : 'សូមស្វាគមន៍មកកាន់ប្រព័ន្ធគ្រប់គ្រង'
              ) : (
                lang === 'en' ? '2FA Passcode Verification' : 'ផ្ទៀងផ្ទាត់លេខកូដសម្ងាត់ 2FA'
              )}
            </h2>
            <p className="text-xs font-medium text-slate-500 font-sans">
              {isResetMode ? (
                resetStep === 1
                  ? (lang === 'en' ? 'Enter username or email to receive Telegram PIN' : 'បញ្ចូលឈ្មោះគណនី ឬអ៊ីមែលដើម្បីទទួលលេខកូដតាម Telegram')
                  : (lang === 'en' ? 'Enter the PIN from Telegram and your new password' : 'បញ្ចូលលេខកូដពី Telegram និងលេខសម្ងាត់ថ្មីរបស់អ្នក')
              ) : !mfaRequired ? (
                lang === 'en' ? 'Enter your username and password' : 'បញ្ចូលឈ្មោះគណនី និងលេខកូដសម្ងាត់របស់អ្នក'
              ) : (
                lang === 'en' ? 'Enter the 6-digit passcode sent to your Telegram' : 'បញ្ចូលលេខកូដ ៦ ខ្ទង់ដែលបានផ្ញើទៅ Telegram របស់អ្នក'
              )}
            </p>
          </div>

          {/* Alert Error / Success Messages */}
          {error && (
            <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-3.5 text-rose-700 text-xs font-medium flex items-start gap-2.5 shadow-xs text-left" id="login_error_alert">
              <span className="w-2 h-2 bg-rose-500 rounded-full mt-1.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {!mfaRequired && success && (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3.5 text-emerald-700 text-xs font-medium flex items-start gap-2.5 shadow-xs text-left" id="login_success_alert">
              <Check size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* MODE A: FORGOT / RESET PASSWORD VIA TELEGRAM BOT */}
          {isResetMode ? (
            resetStep === 1 ? (
              /* Reset Step 1: Request PIN via Telegram */
              <form onSubmit={handleRequestResetPIN} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block ml-0.5">
                    {lang === 'en' ? 'Username or Email' : 'ឈ្មោះគណនី ឬអ៊ីមែល'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={resetIdentifier}
                      onChange={(e) => setResetIdentifier(e.target.value)}
                      placeholder={lang === 'en' ? 'Enter username or email' : 'បញ្ចូលឈ្មោះគណនី ឬអ៊ីមែល'}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-sans text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2.5">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                    <span>{loading ? (lang === 'en' ? 'Checking & Sending PIN...' : 'កំពុងផ្ទៀងផ្ទាត់ និងផ្ញើលេខកូដ...') : (lang === 'en' ? 'Send Reset PIN to Telegram' : 'ផ្ញើលេខកូដ Reset ទៅ Telegram')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(false);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors text-center cursor-pointer block"
                  >
                    {lang === 'en' ? '← Back to Sign In' : '← ត្រឡប់ទៅចូលប្រើប្រាស់វិញ'}
                  </button>
                </div>
              </form>
            ) : (
              /* Reset Step 2: Enter PIN & Set New Password */
              <form onSubmit={handleConfirmResetPassword} className="space-y-4 text-left">
                {/* PIN Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block ml-0.5">
                    {lang === 'en' ? '6-Digit Telegram PIN' : 'លេខកូដ PIN ៦ ខ្ទង់ពី Telegram'}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    value={resetPinCode}
                    onChange={(e) => setResetPinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder=""
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-base font-mono font-bold tracking-[0.2em] text-center text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                  />
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block ml-0.5">
                    {lang === 'en' ? 'New Password' : 'លេខសម្ងាត់ថ្មី'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={lang === 'en' ? 'Enter new password' : 'បញ្ចូលលេខសម្ងាត់ថ្មី'}
                      className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-sans text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 space-y-2.5">
                  <button
                    type="submit"
                    disabled={loading || resetPinCode.length < 4}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={15} />}
                    <span>{loading ? (lang === 'en' ? 'Updating Password...' : 'កំពុងប្តូរលេខសម្ងាត់...') : (lang === 'en' ? 'Confirm & Set New Password' : 'បញ្ជាក់ការប្តូរលេខសម្ងាត់ថ្មី')}</span>
                  </button>

                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setResetStep(1);
                        setError(null);
                      }}
                      className="hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      {lang === 'en' ? '← Re-enter Username' : '← ប្តូរឈ្មោះគណនី'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(false);
                        setResetStep(1);
                        setError(null);
                      }}
                      className="hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      {lang === 'en' ? 'Cancel' : 'បោះបង់'}
                    </button>
                  </div>
                </div>
              </form>
            )
          ) : (
            /* MODE B: NORMAL LOGIN FORM & 2FA STEP */
            !mfaRequired ? (
              <form onSubmit={handleCredentialsLogin} className="space-y-4 text-left">
                
                {/* Username Input Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block ml-0.5">
                    {lang === 'en' ? 'Username' : 'ឈ្មោះប្រើប្រាស់'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={lang === 'en' ? 'Enter username' : 'បញ្ចូលឈ្មោះគណនី'}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-sans text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>
                </div>

                {/* Password Input Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 block ml-0.5">
                      {lang === 'en' ? 'Password' : 'លេខកូដសម្ងាត់'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setResetStep(1);
                        setResetIdentifier(username);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                    >
                      {lang === 'en' ? 'Forgot password?' : 'ភ្លេចលេខសម្ងាត់?'}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={lang === 'en' ? 'Enter password' : 'បញ្ចូលលេខកូដសម្ងាត់'}
                      className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-sans text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={15} />}
                    <span>{loading ? (lang === 'en' ? 'Authenticating & Sending 2FA...' : 'កំពុងផ្ទៀងផ្ទាត់ និងផ្ញើលេខកូដ 2FA...') : (lang === 'en' ? 'Sign In' : 'ចូលប្រើប្រាស់')}</span>
                  </button>
                </div>

              </form>
            ) : (
              
              /* STEP 2: TELEGRAM 2FA OTP PIN VERIFICATION (CLEAN INPUT ONLY) */
              <div className="space-y-4 text-left">
                
                {/* 6-Digit PIN Code Input */}
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block ml-0.5">
                      {lang === 'en' ? 'Enter 6-Digit Code' : 'បញ្ចូលលេខកូដ 2FA ៦ ខ្ទង់'}
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder=""
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-lg font-mono font-bold tracking-[0.25em] text-center text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                  </div>

                  {/* Verify Button */}
                  <button
                    type="button"
                    disabled={loading || otpCode.length < 4}
                    onClick={async () => {
                      setLoading(true);
                      setError(null);
                      try {
                        const res = await fetch('/api/auth/verify-2fa', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ mfaToken, code: otpCode.trim() })
                        });
                        const data = await res.json();
                        if (data.user || (data.success && (data.user || data.accessToken))) {
                          const verifiedUser = data.user || data;
                          saveSession(data.accessToken || '', data.refreshToken || '', verifiedUser);
                          setSuccess(lang === 'en' ? '2FA Verified! Logging in...' : 'ផ្ទៀងផ្ទាត់ 2FA ជោគជ័យ!');
                          setTimeout(() => onLoginSuccess(verifiedUser), 300);
                        } else {
                          setError(data.error || (lang === 'en' ? 'Invalid 2FA PIN code' : 'លេខកូដសុវត្ថិភាព 2FA មិនត្រឹមត្រូវឡើយ'));
                        }
                      } catch (err: any) {
                        setError(err?.message || (lang === 'en' ? 'Verification failed' : 'ការផ្ទៀងផ្ទាត់មិនជោគជ័យឡើយ'));
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    <span>{lang === 'en' ? 'Verify 2FA & Login' : 'ផ្ទៀងផ្ទាត់ និងចូលប្រើប្រាស់'}</span>
                  </button>

                  {/* Resend and Back Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMfaRequired(false);
                        setOtpCode('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      {lang === 'en' ? '← Back to Login' : '← ត្រឡប់ក្រោយ'}
                    </button>

                    <button
                      type="button"
                      onClick={handleResend2FA}
                      disabled={loading}
                      className="text-xs font-bold text-blue-600 hover:underline transition-all cursor-pointer"
                    >
                      {lang === 'en' ? 'Resend PIN' : 'ផ្ញើលេខកូដម្តងទៀត'}
                    </button>
                  </div>
                </div>

              </div>
            )
          )}

        </div>

      </div>

      {/* FOOTER COPYRIGHT (MATCHES DESIGN EXACTLY) */}
      <div className="w-full text-center text-[11px] text-slate-400 font-sans tracking-wide z-10 pt-4">
        © 2026 TC Staff Management System. All Rights Reserved.
      </div>

    </div>
  );
}
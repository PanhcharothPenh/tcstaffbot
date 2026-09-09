import React from 'react';
import { Users } from 'lucide-react';

interface Clean24LogoProps {
  className?: string;
  showText?: boolean;
  lightMode?: boolean;
  iconSize?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Clean24Logo({
  className = "h-14",
  showText = true,
  lightMode = true,
  iconSize = 'md'
}: Clean24LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#020617] text-white flex items-center justify-center shadow-md border border-slate-700/40 shrink-0 group">
        <Users size={20} className="stroke-[2.4] text-blue-400 group-hover:scale-105 transition-transform" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
      </div>
      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5 leading-none">
            <span className={`text-base font-black tracking-tight ${lightMode ? 'text-slate-900' : 'text-white'}`}>
              TC <span className="text-blue-500 font-extrabold text-sm">STAFF</span>
            </span>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mt-1 ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Staff Management Suite
          </span>
        </div>
      )}
    </div>
  );
}

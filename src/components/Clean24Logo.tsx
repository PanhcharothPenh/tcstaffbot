import React from 'react';
import { Coffee, Sparkles } from 'lucide-react';

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
      <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-[#78350F] via-[#92400E] to-[#2B1810] text-amber-100 flex items-center justify-center shadow-md shadow-amber-950/25 border border-amber-500/20 shrink-0 group">
        <Coffee size={21} className="stroke-[2.4] text-amber-200 group-hover:scale-105 transition-transform" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
      </div>
      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5 leading-none">
            <span className={`text-base font-black tracking-tight ${lightMode ? 'text-[#18110D]' : 'text-white'}`}>
              TC <span className="text-amber-700 font-extrabold text-sm">COFFEE</span>
            </span>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mt-1 ${lightMode ? 'text-[#78350F]/70' : 'text-amber-200/60'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            Cafe & Staff Suite
          </span>
        </div>
      )}
    </div>
  );
}

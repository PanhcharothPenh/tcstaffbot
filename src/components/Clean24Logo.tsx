import React from 'react';
import { Coffee } from 'lucide-react';

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
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-900 text-white flex items-center justify-center shadow-md shadow-amber-900/20 shrink-0">
        <Coffee size={22} className="stroke-[2.5]" />
      </div>
      {showText && (
        <div className="flex flex-col text-left">
          <span className="text-sm font-black tracking-tight text-slate-900 leading-tight">
            toto <span className="text-amber-700 font-extrabold text-xs">by Chichi</span>
          </span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            Coffee corner
          </span>
        </div>
      )}
    </div>
  );
}

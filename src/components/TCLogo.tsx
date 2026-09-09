import React from 'react';

interface TCLogoProps {
  className?: string;
  showText?: boolean;
  lightMode?: boolean;
  iconSize?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function TCLogo({
  className = "h-14",
  showText = true,
  lightMode = true,
  iconSize = 'md'
}: TCLogoProps) {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <img 
        src="/logo.png" 
        alt="TC Staff Management" 
        className="h-full w-auto object-contain max-h-20"
      />
    </div>
  );
}

export { TCLogo };

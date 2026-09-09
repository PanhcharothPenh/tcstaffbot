import React from 'react';

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
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <img 
        src="/logo.png" 
        alt="TC Staff Management" 
        className="h-full w-auto object-contain max-h-20"
      />
    </div>
  );
}

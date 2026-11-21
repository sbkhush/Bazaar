import React from 'react';
import { BRAND } from '../../config/brand';

interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  tone?: 'light' | 'dark';
  subtitle?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  tone = 'dark',
  subtitle,
  className = '',
  size = 'md',
}) => {
  const iconDim =
    size === 'lg' ? 'w-11 h-11 rounded-2xl' : size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-9 h-9 rounded-xl';
  const titleSize =
    size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-[17px]';

  const textColor = tone === 'light' ? 'text-white' : 'text-slate-900';
  const accentColor = tone === 'light' ? 'text-emerald-300' : 'text-[#065F46]';
  const subColor = tone === 'light' ? 'text-slate-300/90' : 'text-slate-500';

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <span
        className={`${iconDim} relative inline-flex items-center justify-center shrink-0 overflow-hidden shadow-md shadow-emerald-950/15 ring-1 ring-white/20`}
        style={{
          background: 'linear-gradient(135deg, #065F46 0%, #0F766E 58%, #3730A3 100%)',
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 64" className="w-[78%] h-[78%]" fill="none">
          <path
            d="M20 22.5C20 17.8 24.5 14.5 31 14.5C37 14.5 41 17.2 41.6 21.4H35.1C34.6 19.8 33.2 19 31 19C28.2 19 26.5 20.3 26.5 22.1C26.5 24.1 28.6 24.9 32.6 25.8C38.4 27 42.5 29 42.5 34.8C42.5 40.3 37.8 44 30.8 44C24.1 44 19.6 40.8 19.1 35.8H25.7C26.2 38.1 28.1 39.4 31 39.4C34.2 39.4 36.1 38 36.1 35.7C36.1 33.4 34 32.5 29.7 31.6C24.2 30.3 20 28.3 20 22.5Z"
            fill="#FFFFFF"
          />
          <circle cx="45" cy="18.5" r="4.5" fill="#F59E0B" />
          <path d="M17 49H47" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      </span>

      {variant !== 'icon' && (
        <span className="flex flex-col leading-none text-left">
          <span className={`${titleSize} font-extrabold tracking-tight ${textColor}`}>
            <span>SB </span>
            <span className={accentColor}>Khush</span>
          </span>
          {variant === 'full' && subtitle && (
            <span className={`text-[10px] font-semibold tracking-wide mt-0.5 ${subColor}`}>
              {subtitle}
            </span>
          )}
          {variant === 'compact' && subtitle && (
            <span className={`text-[9px] font-semibold tracking-wider uppercase mt-0.5 ${subColor}`}>
              {subtitle}
            </span>
          )}
        </span>
      )}
      <span className="sr-only">{BRAND.name}</span>
    </span>
  );
};

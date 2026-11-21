import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackSrc?: string;
  fallbackText?: string;
  fallbackClassName?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  fallbackSrc,
  fallbackText,
  fallbackClassName = '',
  alt = '',
  className = '',
  onError,
  ...rest
}) => {
  const cleanSrc = typeof src === 'string' ? src.trim() : '';
  const [activeSrc, setActiveSrc] = useState<string>(cleanSrc || fallbackSrc || '');
  const [exhausted, setExhausted] = useState<boolean>(!cleanSrc && !fallbackSrc);

  useEffect(() => {
    const next = cleanSrc || fallbackSrc || '';
    setActiveSrc(next);
    setExhausted(!next);
  }, [cleanSrc, fallbackSrc]);

  if (exhausted || !activeSrc) {
    return (
      <div
        role="img"
        aria-label={alt || fallbackText || 'Image unavailable'}
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 select-none ${className} ${fallbackClassName}`}
      >
        <ImageOff className="w-5 h-5 opacity-70" />
        {fallbackText && (
          <span className="mt-1 px-2 text-[10px] font-medium text-slate-500 text-center line-clamp-2">
            {fallbackText}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      className={className}
      onError={(e) => {
        if (fallbackSrc && activeSrc !== fallbackSrc) {
          setActiveSrc(fallbackSrc);
        } else {
          setExhausted(true);
        }
        onError?.(e);
      }}
      {...rest}
    />
  );
};

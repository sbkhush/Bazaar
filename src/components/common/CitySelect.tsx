import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, MapPin, Search, X } from 'lucide-react';
import {
  PAKISTAN_LOCATIONS,
  PakistanLocation,
  getPakistanLocation,
  searchPakistanLocations,
} from '../../data/locations';

export interface CitySelectProps {
  value: string;
  onChange: (city: string) => void;
  includeAllOption?: boolean;
  allLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

export const CitySelect: React.FC<CitySelectProps> = ({
  value,
  onChange,
  includeAllOption = false,
  allLabel = 'All Cities',
  placeholder = 'Select city...',
  disabled = false,
  required = false,
  id,
  name,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedLocation = useMemo(() => getPakistanLocation(value), [value]);
  const filteredLocations: PakistanLocation[] = useMemo(
    () => searchPakistanLocations(query),
    [query]
  );

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => searchInputRef.current?.focus(), 20);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  const handleSelect = (cityValue: string) => {
    onChange(cityValue);
    setOpen(false);
    setQuery('');
  };

  const displayText =
    includeAllOption && !value
      ? allLabel
      : value
      ? selectedLocation
        ? `${selectedLocation.city} (${selectedLocation.province})`
        : value
      : placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
          readOnly
        />
      )}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-left flex items-center justify-between gap-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-[#065F46] ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:border-slate-300 cursor-pointer'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className={`truncate ${!value && !includeAllOption ? 'text-slate-400' : 'text-slate-800'}`}>
            {displayText}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden min-w-[220px]"
        >
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city or district (e.g. Chichawatni)..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#065F46]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear city search"
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 text-xs">
            {includeAllOption && (!query || allLabel.toLowerCase().includes(query.toLowerCase())) && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => handleSelect('')}
                className={`w-full px-3 py-2 text-left flex items-center justify-between transition ${
                  !value ? 'bg-emerald-50 text-[#065F46] font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{allLabel}</span>
                <span className="text-[10px] text-slate-400">{PAKISTAN_LOCATIONS.length} cities</span>
              </button>
            )}

            {filteredLocations.length === 0 ? (
              <div className="px-3 py-4 text-center text-slate-400 text-[11px]">
                No city matched &ldquo;{query}&rdquo;
              </div>
            ) : (
              filteredLocations.map((loc) => {
                const isSelected = loc.city.toLowerCase() === String(value || '').trim().toLowerCase();
                return (
                  <button
                    key={loc.city}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(loc.city)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition ${
                      isSelected
                        ? 'bg-emerald-50 text-[#065F46] font-bold'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{loc.city}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {loc.district === loc.city ? loc.province : `${loc.district}, ${loc.province}`}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

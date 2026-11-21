import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PlatformSettings } from '../../types';
import { BRAND } from '../../config/brand';
import { BrandLogo } from '../../components/common/BrandLogo';
import { SafeImage } from '../../components/common/SafeImage';

interface NavAnchor {
  id: string;
  label: string;
}

const NAV_ANCHORS: NavAnchor[] = [
  { id: 'top', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'solutions', label: 'Solutions' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'faq', label: 'FAQ' },
];

export const PublicNavbar: React.FC<{ platformSettings?: PlatformSettings | null }> = ({
  platformSettings,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const brandName = (platformSettings?.platformName || BRAND.name).trim();
  const brandLogoUrl = platformSettings?.logoUrl || '';

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  const scrollToSection = (id: string) => {
    setMobileOpen(false);
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#070B19]/88 backdrop-blur-xl border-b border-white/10 shadow-[0_8px_30px_rgba(3,7,18,0.45)]'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Clean Brand Mark — No extra badge/subtitle clutter */}
          <Link
            to="/"
            onClick={(e) => {
              if (window.location.pathname === '/') {
                e.preventDefault();
                scrollToSection('top');
              }
            }}
            className="flex items-center gap-2.5 group shrink-0"
          >
            {brandLogoUrl ? (
              <SafeImage
                src={brandLogoUrl}
                alt={brandName}
                className="w-9 h-9 rounded-xl object-cover border border-white/20 shadow-md shadow-indigo-500/25 shrink-0"
              />
            ) : (
              <BrandLogo variant="icon" tone="light" size="md" />
            )}
            <span className="font-extrabold text-lg tracking-tight text-white">
              {brandName}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-7">
            {NAV_ANCHORS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer py-2"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Desktop & Tablet Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/register"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition flex items-center gap-1.5"
            >
              Start Free
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {/* Mobile Drawer Trigger (>=44px tap target) */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              className="lg:hidden w-11 h-11 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.aside
              initial={prefersReducedMotion ? { opacity: 0 } : { x: '100%' }}
              animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: '100%' }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              aria-label="Mobile Navigation"
              className="fixed right-0 top-0 bottom-0 w-full max-w-xs bg-[#090F22] border-l border-white/10 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto"
            >
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-white/10">
                  <span className="font-extrabold text-lg text-white tracking-tight">{brandName}</span>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close navigation menu"
                    className="w-11 h-11 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-6 flex flex-col gap-1">
                  {NAV_ANCHORS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      className="w-full text-left px-3 py-3 rounded-xl text-sm font-semibold text-slate-200 hover:text-white hover:bg-white/8 transition cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 space-y-3">
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center gap-2"
                >
                  Start Free <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  PackageCheck,
  Receipt,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

export const Hero3DShowcase: React.FC<{ announcement?: string }> = ({ announcement }) => {
  const prefersReducedMotion = useReducedMotion();
  const [canHover, setCanHover] = useState(false);
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const enableParallax = canHover && !prefersReducedMotion;

  const handleStageMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!enableParallax) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setPointerOffset({
      x: Math.max(-1, Math.min(1, nx * 2)),
      y: Math.max(-1, Math.min(1, ny * 2)),
    });
  };

  const handleStageLeave = () => {
    if (enableParallax) setPointerOffset({ x: 0, y: 0 });
  };

  const scrollToFeatures = () => {
    const el = document.getElementById('features');
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const barHeights = [42, 64, 54, 78, 68, 92, 86];

  return (
    <section
      id="top"
      onMouseMove={handleStageMove}
      onMouseLeave={handleStageLeave}
      className="relative overflow-hidden bg-[#070B19] text-white pt-28 pb-20 sm:pt-32 sm:pb-24 lg:pt-36 lg:pb-28"
    >
      {/* Subtle architectural grid & ambient indigo/violet lighting */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-grid-surface opacity-70" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[820px] h-[520px] rounded-full bg-indigo-600/25 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 w-[520px] h-[420px] rounded-full bg-violet-600/20 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-0 w-[340px] h-[340px] rounded-full bg-cyan-500/10 blur-[110px]"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {announcement && announcement.trim() && (
          <div className="mb-7 rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-4 py-2.5 text-center text-xs font-semibold text-cyan-200 backdrop-blur-md">
            {announcement.trim()}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left Copy Column */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6 space-y-6"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
              Pakistani Retail Commerce SaaS · Storefront + POS + Inventory
            </p>

            <h1
              className="font-extrabold tracking-tight leading-[1.06] text-white"
              style={{ fontSize: 'clamp(2.1rem, 4.4vw, 3.75rem)' }}
            >
              Apna Business Online.{' '}
              <span className="bg-gradient-to-r from-indigo-300 via-violet-200 to-cyan-300 bg-clip-text text-transparent">
                Smart Business Management.
              </span>
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-slate-300 leading-relaxed max-w-xl">
              Products, inventory, sales, customers aur online orders — sab kuch ek hi powerful
              platform par manage karein. SB Khush ke saath apne business ko digital banayein.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <Link
                to="/register"
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-sm font-bold shadow-[0_12px_32px_rgba(99,102,241,0.38)] transition flex items-center gap-2"
              >
                Start Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={scrollToFeatures}
                className="px-6 py-3.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition cursor-pointer"
              >
                Explore Features
              </button>
            </div>

            <p className="text-xs font-medium text-slate-400 pt-0.5">
              Free plan available — no complicated setup.
            </p>
          </motion.div>

          {/* Right Interactive 3D Retail Showcase Composition */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6 perspective-stage"
          >
            <div
              className="relative mx-auto max-w-xl preserve-3d transition-transform duration-200 ease-out"
              style={
                enableParallax
                  ? {
                      transform: `rotateX(${(-pointerOffset.y * 5.5).toFixed(2)}deg) rotateY(${(pointerOffset.x * 6.5).toFixed(2)}deg)`,
                    }
                  : undefined
              }
            >
              {/* Main Glass Workspace Frame */}
              <div className="relative rounded-2xl border border-white/15 bg-gradient-to-b from-slate-900/95 to-[#0B1022]/95 backdrop-blur-xl p-4 sm:p-5 shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
                {/* Browser / Workspace Chrome */}
                <div className="flex items-center justify-between gap-3 pb-3.5 mb-4 border-b border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80 shrink-0" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 shrink-0" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 shrink-0" />
                    <span className="ml-2 font-mono text-[11px] text-slate-400 truncate">
                      sbkhush.com/s/your-store
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300 shrink-0">
                    Capability Preview
                  </span>
                </div>

                {/* Inner Miniature Storefront + Analytics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                  {/* Analytics Chart Card */}
                  <div className="sm:col-span-7 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-medium text-slate-400">Daily Revenue &amp; Profit</p>
                        <p className="text-lg font-extrabold text-white">Live PKR Ledger</p>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="h-24 flex items-end justify-between gap-1.5 pt-2">
                      {barHeights.map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                          <div
                            className={`w-full rounded-t-md ${
                              i === 5
                                ? 'bg-gradient-to-t from-indigo-500 via-violet-500 to-cyan-400'
                                : 'bg-indigo-500/45'
                            }`}
                            style={{ height: `${h}%` }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/10">
                      <span>Online + Counter POS</span>
                      <span className="text-cyan-300 font-semibold tabular-nums">COD · EasyPaisa</span>
                    </div>
                  </div>

                  {/* Catalog & Stock Capabilities Card */}
                  <div className="sm:col-span-5 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-cyan-300" /> Live Catalog
                      </span>
                      <span className="text-[10px] text-slate-400">Tenant Isolated</span>
                    </div>

                    <div className="space-y-2">
                      {[
                        { name: 'SKUs & Variants', detail: 'Size, color & weight options', badge: 'Synced' },
                        { name: 'Low-Stock Alerts', detail: 'Auto deduct on POS & web', badge: 'Live' },
                        { name: 'Barcode & Units', detail: 'Piece, KG, Gram, Litre & Box', badge: 'Ready' },
                      ].map((item) => (
                        <div
                          key={item.name}
                          className="rounded-lg bg-black/25 border border-white/8 px-2.5 py-2 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-white truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-400">{item.detail}</p>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-300 shrink-0">
                            {item.badge}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Layered Row inside Main Frame (replaces overflowing negative offsets on mobile) */}
                <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* POS Counter Terminal Summary */}
                  <div className="rounded-xl border border-indigo-400/25 bg-indigo-950/50 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/25 text-indigo-300 flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">Counter POS Billing</p>
                        <p className="text-[11px] text-slate-300 truncate">Barcode Scan · Thermal Print</p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-cyan-300 shrink-0">
                      Instant
                    </span>
                  </div>

                  {/* Online Order + Self-Pickup Card */}
                  <div className="rounded-xl border border-violet-400/25 bg-violet-950/40 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-violet-500/25 text-violet-200 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">Online Order Workflow</p>
                        <p className="text-[11px] text-slate-300 truncate">JazzCash Proof · TCS Ready</p>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Subtle Floating 3D Layer Cards on Desktop Only (lg+) */}
              <div
                aria-hidden="true"
                className="hidden xl:flex items-center gap-2.5 absolute -left-8 -bottom-6 rounded-xl border border-cyan-400/30 bg-[#0D152E]/95 backdrop-blur-lg px-3.5 py-2.5 shadow-2xl animate-float-gentle"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white">Inventory Synced</p>
                  <p className="text-[10px] text-slate-300">Auto stock deduction active</p>
                </div>
              </div>

              <div
                aria-hidden="true"
                className="hidden xl:flex items-center gap-2.5 absolute -right-6 -top-5 rounded-xl border border-indigo-400/30 bg-[#0D152E]/95 backdrop-blur-lg px-3.5 py-2.5 shadow-2xl animate-float-gentle-alt"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <div>
                  <p className="text-[11px] font-bold text-white">Storefront + Khata</p>
                  <p className="text-[10px] text-slate-300">EasyPaisa · JazzCash · COD</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

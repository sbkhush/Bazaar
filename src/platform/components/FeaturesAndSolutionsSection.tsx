import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Boxes,
  Check,
  ClipboardList,
  CreditCard,
  Package,
  ShoppingCart,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import generalStoreImg from '../../assets/images/solution_general_store_1795085193366.webp';
import cosmeticsStoreImg from '../../assets/images/solution_cosmetics_store_1795085193246.webp';
import clothingStoreImg from '../../assets/images/solution_clothing_store_1795085192837.webp';
import { SafeImage } from '../../components/common/SafeImage';
import { Tilt3DCard } from './Tilt3DCard';

const CORE_BENEFITS = [
  {
    icon: Package,
    title: 'Manage Products',
    desc: 'Organize products with retail units (Piece, KG, Gram, Litre, Carton), barcodes, cost prices, and variant options.',
  },
  {
    icon: Boxes,
    title: 'Track Inventory',
    desc: 'Monitor real-time stock counts, low-stock thresholds, purchase restocks, and stock movement history automatically.',
  },
  {
    icon: ClipboardList,
    title: 'Manage Orders',
    desc: 'Handle online orders alongside counter POS sales, verify payment proofs, and track courier deliveries.',
  },
  {
    icon: Store,
    title: 'Create Online Store',
    desc: 'Launch an isolated storefront (/s/your-shop) supporting COD, EasyPaisa, JazzCash, Bank IBFT, and Store Self-Pickup.',
  },
  {
    icon: Users,
    title: 'Manage Customers',
    desc: 'Maintain customer directories, repeat order visibility, and digital Khata credit/Udhaar ledger balances.',
  },
  {
    icon: TrendingUp,
    title: 'Track Business Performance',
    desc: 'Review daily sales, COGS cost tracking, monthly expenses, and net business profit in Pakistani Rupees.',
  },
];

const FEATURE_CARDS = [
  {
    id: 'inventory',
    icon: Boxes,
    title: 'Smart Inventory',
    desc: 'Prevent out-of-stock surprises with automated stock deduction on online orders and POS counter sales.',
    accent: 'from-cyan-500/20 to-indigo-500/20 border-cyan-400/25',
    visual: (
      <div className="rounded-xl border border-white/10 bg-[#070B19]/90 p-3 space-y-2 text-[11px]">
        <div className="flex items-center justify-between text-slate-300">
          <span className="font-semibold">Basmati Rice 5KG</span>
          <span className="text-emerald-400 font-bold tabular-nums">42 In Stock</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500" />
        </div>
        <div className="flex items-center justify-between text-slate-400 pt-1">
          <span>Cooking Oil 1L</span>
          <span className="text-amber-300 font-semibold tabular-nums">Low: 4 left</span>
        </div>
      </div>
    ),
  },
  {
    id: 'pos',
    icon: CreditCard,
    title: 'POS & Billing',
    desc: 'Fast counter checkout with barcode lookup, instant cash or wallet billing, and printable thermal receipts.',
    accent: 'from-indigo-500/20 to-violet-500/20 border-indigo-400/25',
    visual: (
      <div className="rounded-xl border border-white/10 bg-[#070B19]/90 p-3 space-y-2 text-[11px]">
        <div className="flex items-center justify-between text-slate-400 border-b border-white/10 pb-1.5">
          <span className="font-mono">INV-2084</span>
          <span className="text-cyan-300 font-semibold">Counter POS</span>
        </div>
        <div className="flex items-center justify-between text-slate-200">
          <span>2 items · Tea &amp; Sugar</span>
          <span className="font-bold text-white tabular-nums">Rs. 1,240</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Cash Tendered</span>
          <span className="text-emerald-400 font-semibold">Print Ready</span>
        </div>
      </div>
    ),
  },
  {
    id: 'store',
    icon: ShoppingCart,
    title: 'Online Store',
    desc: 'Your own public store link with branded hero banners, categories, cart drawer, and mobile-first checkout.',
    accent: 'from-violet-500/20 to-fuchsia-500/20 border-violet-400/25',
    visual: (
      <div className="rounded-xl border border-white/10 bg-[#070B19]/90 p-3 space-y-2 text-[11px]">
        <div className="font-mono text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-400/20 rounded-md px-2 py-1 truncate">
          /s/your-business-name
        </div>
        <div className="flex items-center justify-between text-slate-300 pt-0.5">
          <span>EasyPaisa · JazzCash · COD</span>
          <span className="text-emerald-400 font-semibold">Active</span>
        </div>
        <div className="text-[10px] text-slate-400">Includes Store Self-Pickup counter option</div>
      </div>
    ),
  },
  {
    id: 'orders',
    icon: ClipboardList,
    title: 'Order Management',
    desc: 'Verify customer payment receipts, assign TCS, Leopards, or Trax tracking numbers, and update order stages.',
    accent: 'from-blue-500/20 to-cyan-500/20 border-blue-400/25',
    visual: (
      <div className="rounded-xl border border-white/10 bg-[#070B19]/90 p-3 space-y-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-white font-semibold">PK-482190</span>
          <span className="text-cyan-300 font-semibold">Shipped · TCS</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 pt-1 text-center text-[10px]">
          <div className="rounded bg-indigo-500/20 text-indigo-200 py-1 font-semibold">Confirmed</div>
          <div className="rounded bg-indigo-500/20 text-indigo-200 py-1 font-semibold">Packed</div>
          <div className="rounded bg-emerald-500/25 text-emerald-300 py-1 font-semibold">Dispatched</div>
        </div>
      </div>
    ),
  },
  {
    id: 'customers',
    icon: BookOpen,
    title: 'Customer & Khata Management',
    desc: 'Track loyal buyers, shipping details, and trusted customer Udhaar/Khata balances with payment settlements.',
    accent: 'from-emerald-500/20 to-cyan-500/20 border-emerald-400/25',
    visual: (
      <div className="rounded-xl border border-white/10 bg-[#070B19]/90 p-3 space-y-2 text-[11px]">
        <div className="flex items-center justify-between text-slate-200">
          <span className="font-semibold">Customer Khata Ledger</span>
          <span className="font-bold text-amber-300">Credit Tracking</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Partial &amp; Full Settlements</span>
          <span className="text-emerald-400 font-semibold">Auto Updated</span>
        </div>
      </div>
    ),
  },
  {
    id: 'reports',
    icon: BarChart3,
    title: 'Business Reports',
    desc: 'Clear revenue, cost of goods sold (COGS), operating expenses, and net profit visibility without spreadsheets.',
    accent: 'from-purple-500/20 to-indigo-500/20 border-purple-400/25',
    visual: (
      <div className="rounded-xl border border-white/10 bg-[#070B19]/90 p-3 space-y-2 text-[11px]">
        <div className="flex items-center justify-between text-slate-300">
          <span>Gross Sales &amp; COGS</span>
          <span className="font-bold text-white">Auto-Calculated</span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span>Expenses &amp; Net Profit</span>
          <span className="font-bold text-emerald-400">PKR Ledger</span>
        </div>
      </div>
    ),
  },
];

const SOLUTION_CARDS = [
  {
    id: 'general_store',
    title: 'General Stores & Kiryana',
    subtitle: 'Groceries, Daily Staples & Household Goods',
    image: generalStoreImg,
    imageAlt: 'Pakistani general store shelves with rice, cooking oil, spices, and barcode price tags',
    points: [
      'Barcode counter billing & fast thermal receipts',
      'Flexible units: Piece, KG, Gram, Litre & Carton',
      'Supplier purchase bills & customer Khata credit',
    ],
  },
  {
    id: 'cosmetics',
    title: 'Cosmetics & Beauty Stores',
    subtitle: 'Skincare, Makeup Shades, Serums & Fragrances',
    image: cosmeticsStoreImg,
    imageAlt: 'Cosmetics and skincare store display with glass serum bottles, matte lipsticks, and cream jars',
    points: [
      'Clean product showcase with shade & volume variants',
      'Inventory tracking across skincare & fragrance lines',
      'Smooth EasyPaisa, JazzCash & nationwide courier delivery',
    ],
  },
  {
    id: 'clothing',
    title: 'Clothing & Garments',
    subtitle: 'Eastern Wear, Lawn Collections & Footwear',
    image: clothingStoreImg,
    imageAlt: 'Boutique apparel table featuring folded tailored kurtas and handcrafted leather sandals',
    points: [
      'Size, color & fabric variant management on every item',
      'Promotional collection banners & discount coupons',
      'Store self-pickup counter & parcel tracking numbers',
    ],
  },
];

export const FeaturesAndSolutionsSection: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <>
      {/* Section 4: Trust & Value Proposition */}
      <section id="trust" className="bg-white text-slate-900 py-20 sm:py-24 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45 }}
            className="max-w-2xl mb-12 sm:mb-14 space-y-3"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
              Unified Retail Operations
            </p>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Everything Your Business Needs. In One Place.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Replace scattered notebooks, disconnected spreadsheets, and manual WhatsApp order logs
              with a connected commerce system tailored for Pakistani retailers.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {CORE_BENEFITS.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.4, delay: idx * 0.04 }}
                className="group rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-indigo-300/80 hover:shadow-[0_14px_38px_rgba(79,70,229,0.08)] p-6 transition-all duration-200 flex flex-col gap-3.5"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <item.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: Interactive 3D Features Grid */}
      <section
        id="features"
        className="relative overflow-hidden bg-[#0A0F20] text-white py-20 sm:py-24"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-1/3 w-[580px] h-[380px] rounded-full bg-indigo-600/15 blur-[130px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-1/4 w-[460px] h-[360px] rounded-full bg-violet-600/15 blur-[130px]"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12 sm:mb-14"
          >
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                Core Platform Modules
              </p>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Built-In Tools That Keep Stock, Sales, and Cash Accurate
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed">
              Every module shares one tenant-isolated database so counter billing, online orders,
              and financial summaries stay synchronized.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURE_CARDS.map((card, idx) => (
              <motion.div
                key={card.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.45, delay: idx * 0.05 }}
              >
                <Tilt3DCard
                  maxTiltDeg={5.5}
                  className={`h-full rounded-2xl border bg-gradient-to-b ${card.accent} bg-[#111831]/80 backdrop-blur-xl p-6 flex flex-col justify-between gap-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]`}
                >
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 text-cyan-300 flex items-center justify-center">
                      <card.icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-white tracking-tight">{card.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{card.desc}</p>
                  </div>

                  {card.visual}
                </Tilt3DCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 6: Business Solutions Showcase */}
      <section id="solutions" className="bg-white text-slate-900 py-20 sm:py-24 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45 }}
            className="max-w-2xl mb-12 sm:mb-14 space-y-3"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
              Tailored Store Setup
            </p>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Designed Around Real Pakistani Retail Categories
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Choose your business type during registration and SB Khush pre-configures default
              categories, retail measurement units, and matching storefront flows.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-7">
            {SOLUTION_CARDS.map((sol, idx) => (
              <motion.article
                key={sol.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.45, delay: idx * 0.06 }}
                className="group rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between hover:border-indigo-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.08)] transition-all duration-300"
              >
                <div>
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
                    <SafeImage
                      src={sol.image}
                      alt={sol.imageAlt}
                      width={640}
                      height={480}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                        {sol.subtitle}
                      </p>
                      <h3 className="text-xl font-extrabold text-slate-950 mt-1 tracking-tight">
                        {sol.title}
                      </h3>
                    </div>

                    <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600">
                      {sol.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-2">
                  <Link
                    to={`/register?type=${sol.id}`}
                    className="w-full py-3 px-4 rounded-xl bg-slate-950 hover:bg-indigo-600 text-white text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    Explore SB Khush
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

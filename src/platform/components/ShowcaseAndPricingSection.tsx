import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ExternalLink,
  Layers,
  Lock,
  Monitor,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Truck,
  Zap,
  Globe,
  Mail,
  Phone,
  Facebook,
  Instagram,
  Music2,
  Youtube,
  Linkedin,
  MessageCircle,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PlatformSettings, ShopPublic, SubscriptionPlan } from '../../types';
import { DEFAULT_SHOP_ID, formatPKR } from '../../data/seedData';
import { BRAND } from '../../config/brand';
import { BrandLogo } from '../../components/common/BrandLogo';
import { SafeImage } from '../../components/common/SafeImage';
import { Tilt3DCard } from './Tilt3DCard';
import { getConfiguredSocialLinks, SocialPlatformKey } from '../../utils/socialLinks';

function renderPlatformSocialIcon(platform: SocialPlatformKey) {
  switch (platform) {
    case 'facebook':
      return <Facebook className="w-4 h-4" />;
    case 'instagram':
      return <Instagram className="w-4 h-4" />;
    case 'tiktok':
      return <Music2 className="w-4 h-4" />;
    case 'youtube':
      return <Youtube className="w-4 h-4" />;
    case 'linkedin':
      return <Linkedin className="w-4 h-4" />;
    case 'whatsapp':
      return <MessageCircle className="w-4 h-4" />;
    default:
      return <Globe className="w-4 h-4" />;
  }
}

interface ShowcaseAndPricingSectionProps {
  plans: SubscriptionPlan[];
  shops: ShopPublic[];
  platformSettings?: PlatformSettings | null;
}

const STEPS = [
  {
    num: '01',
    title: 'Create Your Account',
    desc: 'Register your shop owner account with your email, city, and business type in under a minute.',
  },
  {
    num: '02',
    title: 'Set Up Your Store',
    desc: 'Pick your store slug (/s/your-shop), add your logo, bank/wallet details, and delivery or self-pickup options.',
  },
  {
    num: '03',
    title: 'Manage Your Business',
    desc: 'Add products with prices & stock, bill counter walk-ins on POS, track suppliers, and maintain Khata.',
  },
  {
    num: '04',
    title: 'Start Selling Online',
    desc: 'Share your storefront URL with customers anywhere in Pakistan and manage incoming orders from one desk.',
  },
];

const DASHBOARD_TABS = [
  {
    id: 'overview',
    label: 'Sales Overview',
    stats: [
      { label: 'Sales Channels', value: 'Online + POS', note: 'Unified Order Ledger' },
      { label: 'Payment Verification', value: 'PKR Native', note: 'COD, EasyPaisa & JazzCash' },
      { label: 'Product Catalog', value: 'Custom SKUs', note: 'Units, Barcodes & Variants' },
      { label: 'Stock Monitoring', value: 'Auto Alerts', note: 'Low-Stock Notifications' },
    ],
    transactions: [
      { ref: 'ORD-FLOW', channel: 'Online Store · EasyPaisa Proof', status: 'Verification Queue', amount: 'Synced' },
      { ref: 'POS-BILL', channel: 'Counter POS · Cash Receipt', status: 'Thermal Print', amount: 'Instant' },
      { ref: 'PICKUP', channel: 'Self-Pickup · Counter Hold', status: 'Ready Status', amount: 'Trackable' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & Stock',
    stats: [
      { label: 'Stock Movements', value: 'Auto Deduct', note: 'Synced on Orders & POS' },
      { label: 'Cost Accounting', value: 'Cost Price', note: 'Purchase Basis Tracking' },
      { label: 'Selling Catalog', value: 'Live Margin', note: 'PKR Retail Pricing' },
      { label: 'Supplier Restocks', value: 'Purchase Bills', note: 'Batch & Vendor Logs' },
    ],
    transactions: [
      { ref: 'RESTOCK', channel: 'Supplier Purchase Entry', status: 'Stock Increased', amount: 'Logged' },
      { ref: 'DEDUCT', channel: 'Online & Counter Checkout', status: 'Auto Adjusted', amount: 'Live' },
      { ref: 'ALERT', channel: 'Reorder Threshold Monitor', status: 'Below Minimum', amount: 'Flagged' },
    ],
  },
  {
    id: 'profit',
    label: 'Profit & Reports',
    stats: [
      { label: 'Gross Revenue', value: 'Real-Time', note: 'Completed Orders & POS' },
      { label: 'COGS Deducted', value: 'Per Item', note: 'Purchase Cost Tracking' },
      { label: 'Store Expenses', value: 'Categorized', note: 'Rent, Utilities & Logistics' },
      { label: 'Net Profit', value: 'Clear Margin', note: 'After COGS & Expenses' },
    ],
    transactions: [
      { ref: 'RPT-WEB', channel: 'Online Storefront Breakdown', status: 'Margin Report', amount: 'Exportable' },
      { ref: 'RPT-POS', channel: 'Counter POS Daily Closing', status: 'Cash & Wallet', amount: 'Audited' },
      { ref: 'EXP-LOG', channel: 'Packaging & Store Expenses', status: 'Monthly Ledger', amount: 'Tracked' },
    ],
  },
];

const SAMPLE_STORE_ITEMS = [
  { id: 's1', name: 'Super Kernel Basmati 5KG', category: 'Staples', price: 1950 },
  { id: 's2', name: 'Cold Pressed Olive Oil 500ml', category: 'Pantry', price: 1450 },
  { id: 's3', name: 'Stitched Cotton Kurta Set', category: 'Apparel', price: 3600 },
];

const WHY_POINTS = [
  {
    icon: Zap,
    title: 'Fast Onboarding',
    desc: 'Go from registration to a live public store URL and product catalog in minutes.',
  },
  {
    icon: Smartphone,
    title: 'Mobile-Friendly Controls',
    desc: 'Add items, process orders, and check daily sales directly from your phone or laptop.',
  },
  {
    icon: Receipt,
    title: 'PKR-Native Billing & Wallets',
    desc: 'Built for Pakistani rupees, COD, EasyPaisa, JazzCash, bank IBFT, and Store Self-Pickup.',
  },
  {
    icon: Truck,
    title: 'Courier Tracking Workflow',
    desc: 'Attach TCS, Leopards, Trax, or PostEx tracking numbers with non-PII parcel tracking.',
  },
  {
    icon: Layers,
    title: 'Role-Based Team Permissions',
    desc: 'Assign staff accounts for orders, POS counter, or inventory without exposing owner settings.',
  },
  {
    icon: Lock,
    title: 'Strict Tenant Isolation',
    desc: 'Security rules keep every business’s products, orders, receipts, and customers separate.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'What is SB Khush?',
    a: 'SB Khush is a multi-tenant retail management and eCommerce SaaS platform built for Pakistani businesses. It combines a branded online storefront (/s/your-shop), counter POS billing, inventory tracking, customer Khata ledger, and profit reports in one workspace.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes. The Free Plan costs Rs. 0 permanently and gives you a live online storefront with 1 active product, order receiving, and self-pickup support so you can test and publish your store before upgrading.',
  },
  {
    q: 'Can I upgrade later?',
    a: 'Yes. Whenever your catalog grows beyond your current product limit or you want Counter POS, barcode scanning, customer Khata, or COGS profit reports, you can upgrade to Starter, Business, or Professional directly from your Shop Dashboard.',
  },
  {
    q: 'How do customers order from my store?',
    a: 'Customers visit your unique storefront link (/s/your-shop), browse categories, add products to their cart, and check out using Cash on Delivery, EasyPaisa, JazzCash, Bank Transfer with receipt upload, or Store Self-Pickup.',
  },
  {
    q: 'Can I use it on mobile?',
    a: 'Yes. Both your public storefront and your Shop Admin Dashboard are mobile-responsive so customers can shop smoothly on phones and you can manage orders and inventory on the go.',
  },
  {
    q: 'Can I add staff accounts?',
    a: 'Yes. Paid plans include team member seats with granular role-based permissions, letting cashiers or managers handle POS, orders, or products without accessing owner-only subscription or security settings.',
  },
  {
    q: 'Is my business data separate and secure?',
    a: 'Yes. SB Khush isolates each shop inside its own tenant scope under Firebase Authentication and strict Firestore and Cloud Storage security rules, keeping your inventory, orders, payment proofs, and customer records private to your store.',
  },
  {
    q: 'How do I get started?',
    a: 'Click Start Free, enter your shop name, email, and business category, and verify your store details. Your dedicated storefront and dashboard workspace are provisioned immediately.',
  },
];

export const ShowcaseAndPricingSection: React.FC<ShowcaseAndPricingSectionProps> = ({
  plans,
  shops,
  platformSettings,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [activeTabId, setActiveTabId] = useState<'overview' | 'inventory' | 'profit'>('overview');
  const [sampleCartIds, setSampleCartIds] = useState<string[]>(['s1']);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const platformName = (platformSettings?.platformName || BRAND.name).trim();
  const platformSocials = getConfiguredSocialLinks(platformSettings?.socialLinks);

  const activeTab = DASHBOARD_TABS.find((t) => t.id === activeTabId) || DASHBOARD_TABS[0];

  const toggleSampleCart = (id: string) => {
    setSampleCartIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const sampleCartTotal = SAMPLE_STORE_ITEMS.filter((i) => sampleCartIds.includes(i.id)).reduce(
    (sum, i) => sum + i.price,
    0
  );

  return (
    <>
      {/* Section 7: How It Works */}
      <section id="how-it-works" className="bg-slate-50 text-slate-900 py-20 sm:py-24 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45 }}
            className="text-center max-w-2xl mx-auto mb-14 space-y-3"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
              Simple Launch Workflow
            </p>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Launch in Four Straightforward Steps
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Go from zero setup to managing products, counter sales, and online orders cleanly.
            </p>
          </motion.div>

          <div className="relative">
            {/* Connecting Line (Desktop horizontal) */}
            <div
              aria-hidden="true"
              className="hidden lg:block absolute top-8 left-[12%] right-[12%] h-[2px] bg-gradient-to-r from-indigo-200 via-violet-400 to-cyan-300"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {STEPS.map((step, idx) => (
                <motion.div
                  key={step.num}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.4, delay: idx * 0.06 }}
                  className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col gap-4 shadow-sm hover:border-indigo-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-mono text-sm font-extrabold flex items-center justify-center shadow-md shadow-indigo-500/20">
                      {step.num}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Step {idx + 1} of 4
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-950 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 8: Dashboard Showcase */}
      <section
        id="dashboard-showcase"
        className="relative overflow-hidden bg-[#070B19] text-white py-20 sm:py-24"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[440px] rounded-full bg-indigo-600/15 blur-[140px]"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10"
          >
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                Shop Control Center
              </p>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Your Complete Business. One Powerful Dashboard.
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Switch views below to inspect how merchants track sales, stock levels, and net
                business profit without messy spreadsheets.
              </p>
            </div>

            {/* Interactive View Switcher */}
            <div className="inline-flex flex-wrap gap-1.5 p-1.5 rounded-xl border border-white/15 bg-white/5 self-start">
              {DASHBOARD_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id as 'overview' | 'inventory' | 'profit')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTabId === tab.id
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Elevated SaaS Dashboard Frame */}
          <Tilt3DCard maxTiltDeg={3} glowColor="rgba(56, 189, 248, 0.14)">
            <div className="rounded-2xl border border-white/15 bg-[#0E152B]/95 backdrop-blur-xl shadow-[0_32px_90px_rgba(0,0,0,0.6)] overflow-hidden">
              {/* Top Bar */}
              <div className="px-4 sm:px-6 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-white/[0.03]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shrink-0">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      Shop Admin Workspace · Sample Retail Store
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      Illustrative Capability Preview — {activeTab.label}
                    </p>
                  </div>
                </div>
                <Link
                  to="/register"
                  className="text-xs font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1 shrink-0"
                >
                  Launch Yours <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Content Body */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="p-4 sm:p-6 space-y-6"
                >
                  {/* 4 KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {activeTab.stats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-1.5"
                      >
                        <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
                        <p className="text-xl sm:text-2xl font-extrabold text-white tabular-nums tracking-tight">
                          {stat.value}
                        </p>
                        <p className="text-[11px] text-indigo-300">{stat.note}</p>
                      </div>
                    ))}
                  </div>

                  {/* Graph + Recent Transactions Split */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-7 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 flex flex-col justify-between space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-cyan-300" />
                            7-Day Store Activity
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Combined storefront orders and POS counter receipts
                          </p>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">PKR</span>
                      </div>

                      <div className="h-36 flex items-end gap-2 sm:gap-3 pt-4">
                        {[
                          { day: 'Mon', h: 48 },
                          { day: 'Tue', h: 65 },
                          { day: 'Wed', h: 58 },
                          { day: 'Thu', h: 82 },
                          { day: 'Fri', h: 94 },
                          { day: 'Sat', h: 86 },
                          { day: 'Sun', h: 72 },
                        ].map((bar, i) => (
                          <div key={bar.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                            <div
                              className={`w-full rounded-t-lg transition-all ${
                                i === 4
                                  ? 'bg-gradient-to-t from-indigo-500 via-violet-500 to-cyan-400'
                                  : 'bg-indigo-500/40'
                              }`}
                              style={{ height: `${bar.h}%` }}
                            />
                            <span className="text-[10px] font-medium text-slate-400">{bar.day}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="lg:col-span-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-white">Recent Activity</p>
                        <span className="text-[10px] font-medium text-slate-400">Sample Feed</span>
                      </div>

                      <div className="space-y-2.5">
                        {activeTab.transactions.map((tx) => (
                          <div
                            key={tx.ref}
                            className="rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                <span className="font-mono text-indigo-300 mr-1.5">{tx.ref}</span>
                                {tx.channel}
                              </p>
                              <p className="text-[11px] text-slate-400">{tx.status}</p>
                            </div>
                            <span className="text-xs font-extrabold text-cyan-300 tabular-nums shrink-0">
                              {tx.amount}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </Tilt3DCard>
        </div>
      </section>

      {/* Section 9: Online Storefront Showcase + Live Store Directory */}
      <section
        id="storefront-showcase"
        className="bg-white text-slate-900 py-20 sm:py-24 border-b border-slate-200/80"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45 }}
              className="lg:col-span-5 space-y-5"
            >
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                Branded Customer Storefront
              </p>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
                Your Own Online Store. Your Own Business Identity.
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Customers shop from a fast mobile-responsive store customized with your logo,
                theme colors, banners, and transparent COD, EasyPaisa, JazzCash, Bank Transfer, or
                Self-Pickup checkout.
              </p>

              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Custom store URL &amp; dynamic SEO meta tags per product</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>EasyPaisa, JazzCash &amp; Bank IBFT payment screenshot upload</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Guest parcel tracking without exposing personal addresses</span>
                </li>
              </ul>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to={`/s/${DEFAULT_SHOP_ID}`}
                  className="px-5 py-3 rounded-xl bg-slate-950 hover:bg-indigo-600 text-white text-xs sm:text-sm font-bold transition flex items-center gap-2"
                >
                  Visit Flagship Store
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-3 rounded-xl border border-slate-300 hover:border-indigo-400 text-slate-800 text-xs sm:text-sm font-semibold transition"
                >
                  Create Your Store
                </Link>
              </div>
            </motion.div>

            {/* Interactive Desktop + Mobile Storefront Preview */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-7"
            >
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
                {/* Browser Frame Header */}
                <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        S
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 truncate">
                          Sample General Store (Interactive Preview)
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 truncate">
                          /s/your-store
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 text-xs font-bold text-indigo-700 shrink-0">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{sampleCartIds.length}</span>
                    </div>
                  </div>

                  {/* Sample Product Cards inside Storefront Mockup */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {SAMPLE_STORE_ITEMS.map((item) => {
                      const inCart = sampleCartIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200 p-3 flex flex-col justify-between gap-3 bg-white"
                        >
                          <div className="space-y-1.5">
                            <div className="h-16 rounded-lg bg-gradient-to-br from-indigo-50 via-slate-100 to-violet-50 flex items-center justify-center text-indigo-500">
                              <Package className="w-6 h-6" />
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              {item.category}
                            </p>
                            <p className="text-xs font-bold text-slate-900 leading-snug">
                              {item.name}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-extrabold text-slate-950 tabular-nums">
                              {formatPKR(item.price)}
                            </p>
                            <button
                              type="button"
                              onClick={() => toggleSampleCart(item.id)}
                              className={`w-full py-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                inCart
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-900 hover:bg-indigo-600 text-white'
                              }`}
                            >
                              {inCart ? 'Added to Cart ✓' : 'Add to Cart'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Interactive Cart Drawer Bar */}
                  <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-slate-300">
                      Sample Cart Total:{' '}
                      <strong className="text-white tabular-nums">
                        {formatPKR(sampleCartTotal)}
                      </strong>
                    </span>
                    <span className="text-cyan-300 font-semibold">
                      Checkout: COD · EasyPaisa · Self-Pickup
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Live Public Directory of Real Storefronts */}
          <div id="stores" className="pt-4 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight">
                  Live Storefronts Powered by {platformName}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Explore active stores running live on this multi-tenant platform.
                </p>
              </div>
              <Link
                to={`/s/${DEFAULT_SHOP_ID}`}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                Open Flagship Store <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {!shops.some((s) => s.slug === DEFAULT_SHOP_ID) && (
                <Link
                  to={`/s/${DEFAULT_SHOP_ID}`}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-white transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <BrandLogo variant="icon" size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{platformName} Flagship</p>
                      <p className="text-xs text-slate-500 truncate">/s/{DEFAULT_SHOP_ID} · Karachi</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                </Link>
              )}

              {shops.slice(0, 6).map((s) => (
                <Link
                  key={s.id}
                  to={`/s/${s.slug}`}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-white transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {s.logoUrl ? (
                      <SafeImage
                        src={s.logoUrl}
                        alt={s.name}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{s.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        /s/{s.slug} · {s.city || 'Pakistan'}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 10: Real Subscription Pricing Plans */}
      <section id="pricing" className="bg-slate-50 text-slate-900 py-20 sm:py-24 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center gap-5 max-w-2xl mx-auto mb-12">
            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                Transparent PKR Plans
              </p>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
                Start Free, Upgrade Only as Your Store Scales
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Every plan includes your dedicated public store link and isolated cloud workspace.
              </p>
            </div>

            {/* Monthly / Yearly Toggle */}
            <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-xl shadow-xs">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  billingCycle === 'yearly'
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Yearly (2 Months Free)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap justify-center items-stretch gap-6">
            {plans.map((plan) => {
              const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
              const isHighlighted = Boolean(plan.isPopular);
              const cardWidthClass =
                plans.length === 1
                  ? 'w-full max-w-md'
                  : plans.length === 2
                    ? 'w-full max-w-md md:max-w-none md:w-[calc(50%-0.75rem)] lg:w-[360px]'
                    : plans.length === 3
                      ? 'w-full max-w-md md:max-w-none md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]'
                      : 'w-full max-w-md md:max-w-none md:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]';
              return (
                <div
                  key={plan.id}
                  className={`${cardWidthClass} rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 ${
                    isHighlighted
                      ? 'bg-[#090F22] text-white border-2 border-indigo-500 shadow-[0_24px_60px_rgba(79,70,229,0.24)]'
                      : 'bg-white text-slate-900 border border-slate-200 hover:border-indigo-300 shadow-xs'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className={`text-lg font-extrabold tracking-tight ${
                          isHighlighted ? 'text-white' : 'text-slate-950'
                        }`}
                      >
                        {plan.name}
                      </h3>
                      {isHighlighted && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-500/20 border border-indigo-400/40 text-cyan-300 shrink-0">
                          Recommended
                        </span>
                      )}
                    </div>

                    <p
                      className={`text-xs leading-relaxed min-h-[40px] ${
                        isHighlighted ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      {plan.description}
                    </p>

                    <div
                      className={`pt-2 pb-4 border-b ${
                        isHighlighted ? 'border-white/10' : 'border-slate-100'
                      }`}
                    >
                      <span className="text-3xl font-extrabold tabular-nums">
                        {price === 0 ? 'Rs. 0' : formatPKR(price)}
                      </span>
                      <span
                        className={`text-xs ml-1.5 ${
                          isHighlighted ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {price === 0
                          ? '/ forever'
                          : `/${billingCycle === 'yearly' ? 'year' : 'month'}`}
                      </span>
                    </div>

                    <ul
                      className={`space-y-2.5 text-xs ${
                        isHighlighted ? 'text-slate-200' : 'text-slate-700'
                      }`}
                    >
                      <li className="flex items-start gap-2">
                        <Check
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isHighlighted ? 'text-cyan-300' : 'text-indigo-600'
                          }`}
                        />
                        <span>
                          {plan.maxProducts === -1 ? (
                            <strong>Unlimited Active Products (Fair-use storage)</strong>
                          ) : (
                            <>
                              Up to <strong className="tabular-nums">{plan.maxProducts}</strong>{' '}
                              Active {plan.maxProducts === 1 ? 'Product' : 'Products'}
                            </>
                          )}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isHighlighted ? 'text-cyan-300' : 'text-indigo-600'
                          }`}
                        />
                        <span>
                          <strong className="tabular-nums">{plan.maxStorageMB} MB</strong> Cloud
                          Media Storage
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isHighlighted ? 'text-cyan-300' : 'text-indigo-600'
                          }`}
                        />
                        <span>
                          Up to <strong className="tabular-nums">{plan.maxStaff}</strong> Team{' '}
                          {plan.maxStaff === 1 ? 'Member' : 'Members'}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isHighlighted ? 'text-cyan-300' : 'text-indigo-600'
                          }`}
                        />
                        <span>COD, EasyPaisa, JazzCash &amp; Self-Pickup</span>
                      </li>
                      {plan.features?.pos && (
                        <li className="flex items-start gap-2">
                          <Check
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              isHighlighted ? 'text-cyan-300' : 'text-indigo-600'
                            }`}
                          />
                          <span>Counter POS Billing &amp; Barcode Scanner</span>
                        </li>
                      )}
                      {plan.features?.khata && (
                        <li className="flex items-start gap-2">
                          <Check
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              isHighlighted ? 'text-cyan-300' : 'text-indigo-600'
                            }`}
                          />
                          <span>Suppliers, Purchases &amp; Customer Khata</span>
                        </li>
                      )}
                      {plan.features?.advancedReports && (
                        <li className="flex items-start gap-2">
                          <Check
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              isHighlighted ? 'text-cyan-300' : 'text-indigo-600'
                            }`}
                          />
                          <span>COGS, Expenses &amp; Net Profit Analytics</span>
                        </li>
                      )}
                      {plan.features?.prioritySupport && (
                        <li className="flex items-start gap-2">
                          <Check
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              isHighlighted ? 'text-cyan-300' : 'text-indigo-600'
                            }`}
                          />
                          <span>Priority Merchant Support</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <Link
                    to={`/register?plan=${plan.id}&cycle=${billingCycle}`}
                    className={`mt-7 w-full py-3 px-4 rounded-xl text-xs font-bold text-center transition ${
                      isHighlighted
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/30'
                        : 'bg-slate-950 hover:bg-indigo-600 text-white'
                    }`}
                  >
                    {price === 0 ? 'Start Free Forever' : `Get ${plan.name}`}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 11 & 12: Why SB Khush & Built for Pakistani Businesses */}
      <section className="bg-white text-slate-900 py-20 sm:py-24 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
              Built for Pakistani Commerce
            </p>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Business Management Made Simple.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Designed from the ground up for local payment workflows, Urdu-friendly store operations,
              and multi-city courier shipping across Pakistan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {WHY_POINTS.map((pt) => (
              <div
                key={pt.title}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <pt.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-950">{pt.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{pt.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 13: FAQ Accordion */}
      <section id="faq" className="bg-slate-50 text-slate-900 py-20 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
              Common Questions
            </p>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="w-full px-5 sm:px-6 py-4 sm:py-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition"
                  >
                    <span className="text-sm sm:text-base font-bold text-slate-950">{item.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-indigo-600' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 sm:px-6 pb-5 pt-0 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                          <div className="pt-3">{item.a}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 14: Final CTA */}
      <section className="relative overflow-hidden bg-[#070B19] text-white py-20 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hero-grid-surface opacity-45"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[360px] rounded-full bg-indigo-600/25 blur-[130px]"
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            Ready to Take Your Business Online?
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Start managing your products, inventory, sales, and online orders with {platformName}.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <Link
              to="/register"
              className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-sm font-bold shadow-[0_12px_32px_rgba(99,102,241,0.38)] transition flex items-center gap-2"
            >
              Start Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to={`/s/${DEFAULT_SHOP_ID}`}
              className="px-6 py-3.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition flex items-center gap-1.5"
            >
              <Store className="w-4 h-4 text-cyan-300" />
              Explore Flagship Store
            </Link>
          </div>
        </div>
      </section>

      {/* Section 15: Clean Public Footer */}
      <footer className="bg-[#050814] text-slate-400 border-t border-white/10 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-white/10">
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-2.5">
                {platformSettings?.logoUrl ? (
                  <SafeImage
                    src={platformSettings.logoUrl}
                    alt={platformName}
                    className="w-8 h-8 rounded-lg object-cover border border-white/15 shrink-0"
                  />
                ) : (
                  <BrandLogo variant="icon" tone="light" size="sm" />
                )}
                <span className="font-extrabold text-base text-white tracking-tight">{platformName}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
                {platformSettings?.tagline ||
                  'Multi-tenant retail business management and online storefront SaaS engineered for growing Pakistani shops.'}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-300 shrink-0" />
                  Tenant-Isolated Cloud Storefronts
                </span>
                {platformSettings?.supportEmail && (
                  <a
                    href={`mailto:${platformSettings.supportEmail}`}
                    className="inline-flex items-center gap-1.5 hover:text-white transition"
                  >
                    <Mail className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    {platformSettings.supportEmail}
                  </a>
                )}
                {platformSettings?.supportPhone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    {platformSettings.supportPhone}
                  </span>
                )}
              </div>

              {platformSocials.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {platformSocials.map((entry) => (
                    <a
                      key={entry.platform}
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${platformName} on ${entry.label}`}
                      title={entry.label}
                      className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 hover:bg-indigo-500/20 hover:border-indigo-400/50 text-slate-300 hover:text-white flex items-center justify-center transition"
                    >
                      {renderPlatformSocialIcon(entry.platform)}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-3 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-white">Platform</p>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <a href="#features" className="hover:text-white transition">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#solutions" className="hover:text-white transition">
                    Solutions
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-white transition">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                Product &amp; Legal
              </p>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <Link to="/register" className="hover:text-white transition">
                    Create Free Store
                  </Link>
                </li>
                <li>
                  <Link to={`/s/${DEFAULT_SHOP_ID}`} className="hover:text-white transition">
                    Flagship Storefront
                  </Link>
                </li>
                {platformSettings?.websiteUrl && (
                  <li>
                    <a
                      href={platformSettings.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white transition"
                    >
                      {platformSettings.websiteUrl.replace(/^https?:\/\//i, '')}
                    </a>
                  </li>
                )}
                <li>
                  <Link to="/privacy-policy" className="hover:text-white transition">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms-and-conditions" className="hover:text-white transition">
                    Terms &amp; Conditions
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} {platformName}. Built for Pakistani Retail Businesses.</p>
            <p>COD · EasyPaisa · JazzCash · Self-Pickup</p>
          </div>
        </div>
      </footer>
    </>
  );
};

import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  ExternalLink,
  Eye,
  Database,
  Download,
  Trash2,
  CheckCircle2,
  PauseCircle,
  Loader2,
  SlidersHorizontal,
  FileSearch,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  getAllShopsAdmin,
  getSubscriptionPlans,
  updateShopStatus,
  assignShopSubscription,
  extendShopSubscription,
  deleteShopComplete,
  getShopSubscriptionStatus,
} from '../services/platformService';
import { migrateLegacyBazaarPKToTenant } from '../services/migrationService';
import { getAllSalesLeads } from '../services/salesService';
import { buildDemoDataAuditReport, AuditClassification, DemoDataAuditReport } from '../utils/demoDataAudit';
import { Shop, SubscriptionPlan, MigrationResult, BillingCycle, BusinessType } from '../types';
import { BUSINESS_TYPE_OPTIONS } from '../data/seedData';
import { useAuth } from '../context/AuthContext';
import { SafeImage } from '../components/common/SafeImage';

export const SuperAdminShopsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [businessTypeFilter, setBusinessTypeFilter] = useState<'all' | BusinessType>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [subFilter, setSubFilter] = useState<'all' | 'free' | 'paid' | 'trial' | 'expired' | 'active_sub'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'products' | 'orders'>('newest');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Migration state
  const [migrateModalOpen, setMigrateModalOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  // Plan modal state
  const [planModalShop, setPlanModalShop] = useState<Shop | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('starter');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [extraDays, setExtraDays] = useState(30);
  const [freeOverride, setFreeOverride] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<Shop | null>(null);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState('');

  // Demo & Legacy Data Audit state (non-destructive inspection)
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditReport, setAuditReport] = useState<DemoDataAuditReport | null>(null);
  const [auditFilter, setAuditFilter] = useState<'all' | AuditClassification>('all');

  const loadShops = async () => {
    setLoading(true);
    try {
      const [sList, pList] = await Promise.all([getAllShopsAdmin(), getSubscriptionPlans()]);
      setShops(sList);
      setPlans(pList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, []);

  const filtered = useMemo(() => {
    let res = [...shops];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.ownerEmail.toLowerCase().includes(q) ||
          s.ownerName.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      res = res.filter((s) => s.status === statusFilter);
    }
    if (businessTypeFilter !== 'all') {
      res = res.filter((s) => (s.businessType || 'general_store') === businessTypeFilter);
    }
    if (planFilter !== 'all') {
      res = res.filter((s) => s.subscription?.planId === planFilter);
    }
    if (subFilter !== 'all') {
      const planMap = new Map(plans.map((p) => [p.id, p]));
      res = res.filter((s) => {
        const planObj = planMap.get(s.subscription?.planId || '');
        const subStats = getShopSubscriptionStatus(s);
        const isFree = !planObj || planObj.monthlyPrice === 0 || s.subscription?.isFreeOverride;
        if (subFilter === 'free') return isFree;
        if (subFilter === 'paid') return !isFree;
        if (subFilter === 'trial') return s.subscription?.status === 'trial';
        if (subFilter === 'expired') return subStats.isExpired;
        if (subFilter === 'active_sub') return !subStats.isExpired && !subStats.isSuspended;
        return true;
      });
    }
    res.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'products') return (b.usage?.productsCount || 0) - (a.usage?.productsCount || 0);
      if (sortBy === 'orders') return (b.usage?.ordersCount || 0) - (a.usage?.ordersCount || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return res;
  }, [shops, plans, searchQuery, statusFilter, businessTypeFilter, planFilter, subFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleRunMigration = async () => {
    setMigrating(true);
    setMigrationError(null);
    try {
      const res = await migrateLegacyBazaarPKToTenant({
        ownerUid: currentUser?.uid,
        ownerEmail: currentUser?.email || undefined,
        ownerName: currentUser?.displayName || undefined,
      });
      setMigrationResult(res);
      setMigrateModalOpen(false);
      await loadShops();
    } catch (err: any) {
      setMigrationError(err?.message || 'Legacy migration failed.');
    } finally {
      setMigrating(false);
    }
  };

  const downloadBackup = () => {
    if (!migrationResult?.backupJson) return;
    const blob = new Blob([migrationResult.backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sbkhush-legacy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunDemoAudit = async () => {
    setAuditLoading(true);
    setAuditOpen(true);
    try {
      const leads = await getAllSalesLeads().catch(() => []);
      const report = buildDemoDataAuditReport({ shops, leads });
      setAuditReport(report);
    } finally {
      setAuditLoading(false);
    }
  };

  const downloadAuditReport = () => {
    if (!auditReport) return;
    const blob = new Blob([JSON.stringify(auditReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sbkhush-demo-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyPlan = async () => {
    if (!planModalShop) return;
    setActionBusy(true);
    try {
      await assignShopSubscription(planModalShop.id, {
        planId: selectedPlanId,
        billingCycle,
        durationDays: extraDays,
        isFreeOverride: freeOverride,
        status: 'active',
      });
      setPlanModalShop(null);
      await loadShops();
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteShop = async () => {
    if (!deleteTarget || deleteConfirmSlug !== deleteTarget.slug) return;
    setActionBusy(true);
    try {
      await deleteShopComplete(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirmSlug('');
      await loadShops();
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Shops Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect tenant stores, manage subscriptions, audit demo records safely, or migrate legacy store data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRunDemoAudit}
            disabled={auditLoading}
            className="px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-2 transition"
          >
            {auditLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4 text-[#065F46]" />}
            Demo &amp; Legacy Audit
          </button>
          <button
            type="button"
            onClick={() => setMigrateModalOpen(true)}
            disabled={migrating}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition"
          >
            {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Migrate Legacy Store -&gt; Tenant
          </button>
        </div>
      </div>

      {/* Non-Destructive Demo & Legacy Data Audit Panel */}
      {auditOpen && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#065F46]" />
                Production Data &amp; Demo Classification Audit
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Non-destructive inspection only. Real and uncertain records are never auto-deleted. Export JSON backup before any manual cleanup.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {auditReport && (
                <button
                  type="button"
                  onClick={downloadAuditReport}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Audit JSON
                </button>
              )}
              <button
                type="button"
                onClick={() => setAuditOpen(false)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900"
                aria-label="Close audit panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {auditLoading || !auditReport ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#065F46]" /> Classifying stores &amp; leads...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                {(['all', 'real', 'demo', 'test', 'sample', 'uncertain'] as const).map((cls) => {
                  const count =
                    cls === 'all' ? auditReport.items.length : auditReport.totals[cls];
                  const active = auditFilter === cls;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setAuditFilter(cls)}
                      className={`p-2.5 rounded-lg border text-left transition ${
                        active
                          ? 'border-[#065F46] bg-emerald-50/70 text-[#065F46]'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <p className="text-[10px] uppercase font-bold tracking-wider">{cls}</p>
                      <p className="text-base font-extrabold tabular-nums mt-0.5">{count}</p>
                    </button>
                  );
                })}
              </div>

              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                {auditReport.items
                  .filter((item) => auditFilter === 'all' || item.classification === auditFilter)
                  .slice(0, 50)
                  .map((item) => (
                    <div key={`${item.collection}-${item.id}`} className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {item.label}{' '}
                          <span className="text-[10px] font-mono font-normal text-slate-400">
                            ({item.collection})
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{item.sublabel}</p>
                        <p className="text-[10px] text-slate-400 truncate">{item.reasons.join(' · ')}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                          item.classification === 'real'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.classification === 'uncertain'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.classification}
                      </span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {migrationError && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          {migrationError}
        </div>
      )}

      {/* Migration Summary Card */}
      {migrationResult && (
        <div className="bg-white border border-emerald-300 rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Legacy Migration Report ({migrationResult.shopSlug}) —{' '}
                <span className={migrationResult.success ? 'text-emerald-700' : 'text-amber-700'}>
                  {migrationResult.success ? 'Verified Success' : 'Completed With Warnings'}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Idempotent transfer complete ({migrationResult.migratedCounts.orderTracking} tracking docs indexed). Legacy collections preserved untouched.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadBackup}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              Download Legacy JSON Backup
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg">Products: <strong>{migrationResult.migratedCounts.products}</strong></div>
            <div className="p-2.5 bg-slate-50 rounded-lg">Categories: <strong>{migrationResult.migratedCounts.categories}</strong></div>
            <div className="p-2.5 bg-slate-50 rounded-lg">Banners: <strong>{migrationResult.migratedCounts.banners}</strong></div>
            <div className="p-2.5 bg-slate-50 rounded-lg">Orders: <strong>{migrationResult.migratedCounts.orders}</strong></div>
            <div className="p-2.5 bg-slate-50 rounded-lg">Coupons: <strong>{migrationResult.migratedCounts.coupons}</strong></div>
          </div>

          {Object.keys(migrationResult.verifiedCounts || {}).length > 0 && (
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex flex-wrap gap-3">
              {Object.entries(migrationResult.verifiedCounts).map(([col, v]) => (
                <span key={col} className={v.matched ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                  {col}: {v.actual}/{v.expectedMin} {v.matched ? 'OK' : 'MISMATCH'}
                </span>
              ))}
            </div>
          )}

          {Object.values(migrationResult.skippedRecords || {}).some((n) => n > 0) && (
            <p className="text-[11px] text-slate-500">
              Already-present records skipped idempotently:{' '}
              {Object.entries(migrationResult.skippedRecords)
                .filter(([, count]) => count > 0)
                .map(([col, count]) => `${col} (${count})`)
                .join(', ')}
            </p>
          )}

          {(migrationResult.failedRecords?.length > 0 || migrationResult.errors?.length > 0) && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
              {migrationResult.failedRecords?.map((f, i) => (
                <p key={i}>
                  Failed {f.collection}/{f.id}: {f.error}
                </p>
              ))}
              {migrationResult.errors?.map((e, i) => (
                <p key={`err-${i}`}>{e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search shop, slug, or owner email..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
          />
        </div>
        <select
          value={businessTypeFilter}
          onChange={(e) => { setBusinessTypeFilter(e.target.value as any); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
        >
          <option value="all">All Store Types</option>
          {BUSINESS_TYPE_OPTIONS.map((bt) => (
            <option key={bt.value} value={bt.value}>{bt.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
        >
          <option value="all">All Shop Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={subFilter}
          onChange={(e) => { setSubFilter(e.target.value as any); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
        >
          <option value="all">All Subscription States</option>
          <option value="active_sub">Active Subscription</option>
          <option value="trial">Trial Stores</option>
          <option value="paid">Paid Tiers</option>
          <option value="free">Free / Comp Tier</option>
          <option value="expired">Expired</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
        >
          <option value="all">All Plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
        >
          <option value="newest">Sort: Newest Registered</option>
          <option value="name">Sort: Shop Name (A-Z)</option>
          <option value="products">Sort: Most Products</option>
          <option value="orders">Sort: Most Orders</option>
        </select>
      </div>

      {/* Shops Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center text-xs text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading shops...
          </div>
        ) : paginated.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            No matching tenant shops found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Shop &amp; Slug</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Plan &amp; Expiry</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Products / Orders</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {s.logoUrl ? (
                          <SafeImage src={s.logoUrl} alt={s.name} className="w-9 h-9 rounded-lg object-cover border border-slate-200" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-[#065F46] text-white flex items-center justify-center font-bold">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <Link to={`/super-admin/shops/${s.id}`} className="font-bold text-slate-900 hover:text-[#065F46]">
                            {s.name}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-mono text-slate-500">/s/{s.slug}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                              {BUSINESS_TYPE_OPTIONS.find((b) => b.value === (s.businessType || 'general_store'))?.label || 'General Store'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{s.ownerName}</p>
                      <p className="text-[11px] text-slate-500">{s.ownerEmail}</p>
                      <p className="text-[11px] text-slate-400">{s.ownerPhone}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{s.subscription?.planName || 'Starter'}</p>
                      <p className="text-[11px] text-slate-500">
                        Exp: {s.subscription?.expiryDate ? new Date(s.subscription.expiryDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 font-bold uppercase text-[11px] ${
                          s.status === 'active'
                            ? 'text-emerald-700'
                            : s.status === 'suspended'
                            ? 'text-red-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      <span className="font-bold text-slate-900">{s.usage?.productsCount || 0}</span> prod ·{' '}
                      <span className="font-bold text-slate-900">{s.usage?.ordersCount || 0}</span> ord
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/super-admin/shops/${s.id}`}
                          title="10-Tab Shop Profile"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          to={`/dashboard?inspectShopId=${s.id}`}
                          title="Inspect Dashboard (Read-Only)"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          to={`/s/${s.slug}`}
                          target="_blank"
                          title="Open Public Storefront"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        {s.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => updateShopStatus(s.id, 'suspended').then(loadShops)}
                            title="Suspend Shop"
                            className="p-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50"
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateShopStatus(s.id, 'active').then(loadShops)}
                            title="Activate Shop"
                            className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPlanModalShop(s);
                            setSelectedPlanId(s.subscription?.planId || 'starter');
                          }}
                          className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold"
                        >
                          Plan
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          title="Delete Shop"
                          className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {page} of {totalPages} ({filtered.length} shops)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Change / Extend Plan Modal */}
      {planModalShop && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Manage Subscription: {planModalShop.name}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subscription Plan</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (Rs. {p.monthlyPrice}/mo)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cycle</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={extraDays}
                    onChange={(e) => setExtraDays(Number(e.target.value) || 30)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={freeOverride}
                  onChange={(e) => setFreeOverride(e.target.checked)}
                />
                Assign as Free Comp / Override (Rs. 0)
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => extendShopSubscription(planModalShop.id, 30).then(() => { setPlanModalShop(null); loadShops(); })}
                className="px-3 py-2 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-50 mr-auto"
              >
                +30 Days Quick Extend
              </button>
              <button
                type="button"
                onClick={() => setPlanModalShop(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleApplyPlan}
                className="px-4 py-2 bg-[#065F46] text-white rounded-lg text-xs font-bold"
              >
                {actionBusy ? 'Saving...' : 'Save Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shop Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-red-700">Delete Shop Permanently</h3>
            <p className="text-xs text-slate-600">
              This removes <strong>{deleteTarget.name}</strong> and all products, orders, settings, and slug reservation. Type{' '}
              <code className="font-mono font-bold text-slate-900">{deleteTarget.slug}</code> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmSlug}
              onChange={(e) => setDeleteConfirmSlug(e.target.value)}
              placeholder={deleteTarget.slug}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmSlug(''); }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusy || deleteConfirmSlug !== deleteTarget.slug}
                onClick={handleDeleteShop}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold"
              >
                {actionBusy ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Migration Confirmation Modal */}
      {migrateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Confirm Legacy Store Migration</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will idempotently copy legacy top-level collections (products, categories, banners, coupons, orders, settings) into the isolated <code className="font-mono font-bold">/shops/bazaarpk</code> tenant, generate non-PII tracking tokens, sync <code className="font-mono font-bold">/shops_public/bazaarpk</code>, and generate a downloadable JSON backup. Existing tenant documents are skipped safely.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMigrateModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={migrating}
                onClick={handleRunMigration}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-50"
              >
                {migrating ? 'Migrating & Verifying...' : 'Run Idempotent Migration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

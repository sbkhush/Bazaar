import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  CheckCircle2,
  PauseCircle,
  Clock,
  Receipt,
  Package,
  ShoppingBag,
  Users,
  ArrowRight,
  Database,
  Loader2,
} from 'lucide-react';
import {
  getPlatformAnalytics,
  getAllShopsAdmin,
  getAllPlatformPayments,
  PlatformAnalyticsSummary,
} from '../services/platformService';
import { migrateLegacyBazaarPKToTenant } from '../services/migrationService';
import { Shop, PlatformPayment } from '../types';
import { formatPKR } from '../data/seedData';
import { SimpleBarChart, DistributionMeters } from '../components/common/SimpleCharts';
import { useAuth } from '../context/AuthContext';

export const SuperAdminDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<PlatformAnalyticsSummary | null>(null);
  const [recentShops, setRecentShops] = useState<Shop[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PlatformPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrateConfirmOpen, setMigrateConfirmOpen] = useState(false);
  const [migrationBanner, setMigrationBanner] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analytics, shops, payments] = await Promise.all([
        getPlatformAnalytics(),
        getAllShopsAdmin(),
        getAllPlatformPayments(),
      ]);
      setStats(analytics);
      setRecentShops(shops.slice(0, 6));
      setPendingPayments(payments.filter((p) => p.status === 'pending').slice(0, 5));
    } catch (err) {
      console.warn('Super Admin analytics load note:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickMigration = async () => {
    setMigrating(true);
    setMigrationBanner(null);
    try {
      const res = await migrateLegacyBazaarPKToTenant({
        ownerUid: currentUser?.uid,
        ownerEmail: currentUser?.email || undefined,
        ownerName: currentUser?.displayName || undefined,
      });
      setMigrationBanner(
        res.success
          ? `Synced legacy flagship tenant (${res.migratedCounts.products} products, ${res.migratedCounts.orders} orders, ${res.migratedCounts.categories} categories, ${res.migratedCounts.orderTracking} tracking records verified).`
          : `Migration finished with notes: ${res.errors.join(', ')}`
      );
      setMigrateConfirmOpen(false);
      await loadData();
    } catch (err: any) {
      setMigrationBanner(`Migration failed: ${err?.message || 'Unauthorized or network error'}`);
      setMigrateConfirmOpen(false);
    } finally {
      setMigrating(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="py-20 flex items-center justify-center text-xs text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" />
        Loading real-time Firestore platform metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Migration Callout if needed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">SaaS Platform Overview</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live metrics aggregated across all registered general store tenants.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMigrateConfirmOpen(true)}
            disabled={migrating}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2 transition"
          >
            {migrating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-[#065F46]" />}
            Sync Legacy Flagship Tenant
          </button>
          <Link
            to="/super-admin/shops"
            className="px-4 py-2 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition"
          >
            Manage All Shops
          </Link>
        </div>
      </div>

      {migrationBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium">
          {migrationBanner}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Registered Shops',
            value: stats.totalShops,
            sub: `${stats.shopsRegisteredThisMonth} registered this month`,
            icon: Store,
          },
          {
            label: 'Active / Trial / Suspended',
            value: `${stats.activeShops} / ${stats.trialShops} / ${stats.suspendedShops}`,
            sub: `${stats.inactiveShops} inactive · ${stats.expiredSubscriptions} expired`,
            icon: CheckCircle2,
          },
          {
            label: 'Subscription Revenue',
            value: formatPKR(stats.totalSubscriptionRevenue),
            sub: `MRR: ${formatPKR(stats.monthlyRecurringRevenue)}/mo`,
            icon: Receipt,
          },
          {
            label: 'Pending Payment Proofs',
            value: stats.pendingPaymentsCount,
            sub: 'Awaiting manual TID verification',
            icon: Clock,
          },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className="w-4 h-4 text-[#065F46]" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">{kpi.value}</p>
            <p className="text-[11px] text-slate-500">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Secondary Cross-Tenant Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <Package className="w-5 h-5 text-slate-600 shrink-0" />
          <div>
            <p className="text-lg font-extrabold text-slate-900 tabular-nums">{stats.totalProductsAcrossShops}</p>
            <p className="text-[11px] text-slate-500">Products Across Shops</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <ShoppingBag className="w-5 h-5 text-slate-600 shrink-0" />
          <div>
            <p className="text-lg font-extrabold text-slate-900 tabular-nums">{stats.totalOrdersAcrossShops}</p>
            <p className="text-[11px] text-slate-500">Total Tenant Orders</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-slate-600 shrink-0" />
          <div>
            <p className="text-lg font-extrabold text-slate-900 tabular-nums">{stats.totalRegisteredOwners}</p>
            <p className="text-[11px] text-slate-500">Unique Shop Owners</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <PauseCircle className="w-5 h-5 text-slate-600 shrink-0" />
          <div>
            <p className="text-lg font-extrabold text-slate-900 tabular-nums">
              {stats.paidShops} / {stats.freeShops}
            </p>
            <p className="text-[11px] text-slate-500">Paid vs Free Shops</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">New Shop Registrations (6 Months)</h3>
              <p className="text-[11px] text-slate-500">Monthly tenant onboarding trend</p>
            </div>
          </div>
          <SimpleBarChart
            data={stats.monthlyRegistrationsChart.map((m) => ({ label: m.label, value: m.count }))}
            barColor="#065F46"
          />
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Subscription Plan Distribution</h3>
          {stats.planBreakdown.length > 0 ? (
            <DistributionMeters
              items={stats.planBreakdown.map((p, idx) => ({
                label: p.planName,
                count: p.count,
                color: ['#065F46', '#0f172a', '#d97706', '#0284c7'][idx % 4],
              }))}
            />
          ) : (
            <p className="text-xs text-slate-500 py-8 text-center">No shops registered yet.</p>
          )}
        </div>
      </div>

      {/* Recent Shops & Pending Payment Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Recent Store Registrations</h3>
            <Link to="/super-admin/shops" className="text-xs font-semibold text-[#065F46] hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentShops.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No registered shops yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentShops.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <Link to={`/super-admin/shops/${s.id}`} className="font-bold text-slate-900 hover:text-[#065F46] truncate block">
                      {s.name}
                    </Link>
                    <p className="text-[11px] text-slate-500 truncate">
                      /s/{s.slug} · {s.ownerEmail}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[11px] font-bold uppercase ${
                      s.status === 'active' ? 'text-emerald-700' : s.status === 'suspended' ? 'text-red-600' : 'text-slate-500'
                    }`}>
                      {s.status}
                    </span>
                    <p className="text-[11px] text-slate-400">{s.subscription?.planName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Pending Payment Approvals</h3>
            <Link to="/super-admin/payments" className="text-xs font-semibold text-[#065F46] hover:underline flex items-center gap-1">
              Review Queue <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {pendingPayments.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No pending subscription payments.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingPayments.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{p.shopName}</p>
                    <p className="text-[11px] text-slate-500">
                      {p.planName} ({p.billingCycle}) · TID: {p.transactionId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-slate-900 tabular-nums">{formatPKR(p.amount)}</p>
                    <Link to="/super-admin/payments" className="text-[11px] font-semibold text-[#065F46] hover:underline">
                      Verify Proof
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {migrateConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Sync Legacy Flagship Store to Tenant?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This idempotently copies top-level legacy records into the isolated legacy flagship tenant (<code className="font-mono font-bold">/shops/bazaarpk</code>) and updates public mirrors without deleting any legacy collections.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMigrateConfirmOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={migrating}
                onClick={handleQuickMigration}
                className="px-4 py-2 bg-[#065F46] hover:bg-emerald-900 text-white rounded-lg text-xs font-bold disabled:opacity-50"
              >
                {migrating ? 'Syncing...' : 'Confirm Migration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

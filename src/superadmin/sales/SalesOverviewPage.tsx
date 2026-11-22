import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  Briefcase,
  Sparkles,
  Clock,
  CheckCircle2,
  Store,
  ShieldCheck,
  CreditCard,
  TrendingUp,
  Coins,
  Wallet,
  BadgeDollarSign,
  Filter,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  getAllSalesMembers,
  getAllSalesLeads,
  getAllReferralAttributions,
  getAllCommissionLedger,
  getAllSalesTargets,
  computeSalesDashboardAnalytics,
} from '../../services/salesService';
import { getAllShopsAdmin, getAllPlatformPayments } from '../../services/platformService';
import { BUSINESS_TYPE_OPTIONS, PAKISTAN_CITIES, formatPKR } from '../../data/seedData';
import { SimpleBarChart, DistributionMeters } from '../../components/common/SimpleCharts';
import {
  CommissionLedgerEntry,
  PlatformPayment,
  ReferralAttribution,
  SalesAnalyticsFilter,
  SalesDatePreset,
  SalesLead,
  SalesMember,
  SalesTarget,
  Shop,
} from '../../types';

export const SalesOverviewPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [members, setMembers] = useState<SalesMember[]>([]);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [referrals, setReferrals] = useState<ReferralAttribution[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [payments, setPayments] = useState<PlatformPayment[]>([]);
  const [commissions, setCommissions] = useState<CommissionLedgerEntry[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);

  const [filter, setFilter] = useState<SalesAnalyticsFilter>({
    preset: 'last_30_days',
    city: 'all',
    industry: 'all',
  });

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [m, l, r, s, p, c, t] = await Promise.all([
        getAllSalesMembers(),
        getAllSalesLeads(),
        getAllReferralAttributions(),
        getAllShopsAdmin(),
        getAllPlatformPayments(),
        getAllCommissionLedger(),
        getAllSalesTargets(),
      ]);
      setMembers(m);
      setLeads(l);
      setReferrals(r);
      setShops(s);
      setPayments(p);
      setCommissions(c);
      setTargets(t);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load sales analytics from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const managers = useMemo(() => members.filter((m) => m.role === 'sales_manager'), [members]);

  const analytics = useMemo(
    () =>
      computeSalesDashboardAnalytics(
        { members, leads, referrals, shops, payments, commissions, targets },
        filter
      ),
    [members, leads, referrals, shops, payments, commissions, targets, filter]
  );

  const kpiCards = [
    { label: 'Total Salesmen', value: analytics.totalSalesmen, icon: Users, tone: 'bg-slate-100 text-slate-800' },
    { label: 'Active Salesmen', value: analytics.activeSalesmen, icon: UserCheck, tone: 'bg-emerald-50 text-[#065F46]' },
    { label: 'Inactive Salesmen', value: analytics.inactiveSalesmen, icon: UserX, tone: 'bg-rose-50 text-rose-700' },
    { label: 'Total Assigned Leads', value: analytics.totalAssignedLeads, icon: Briefcase, tone: 'bg-blue-50 text-blue-700' },
    { label: 'New Leads', value: analytics.newLeads, icon: Sparkles, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Follow-up Required', value: analytics.followUpRequiredLeads, icon: Clock, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Converted Leads', value: analytics.convertedLeads, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Total Registered Shops', value: analytics.totalRegisteredShops, icon: Store, tone: 'bg-teal-50 text-teal-800' },
    { label: 'Verified Shops', value: analytics.verifiedShops, icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-800' },
    { label: 'Paid Subscriptions', value: analytics.paidSubscriptions, icon: CreditCard, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Total Sales Revenue', value: formatPKR(analytics.totalSalesRevenue), icon: TrendingUp, tone: 'bg-emerald-50 text-[#065F46]' },
    { label: 'Total Commission Generated', value: formatPKR(analytics.totalCommissionGenerated), icon: Coins, tone: 'bg-amber-50 text-amber-800' },
    { label: 'Pending Commission', value: formatPKR(analytics.pendingCommission), icon: Wallet, tone: 'bg-orange-50 text-orange-700' },
    { label: 'Commission Paid', value: formatPKR(analytics.commissionPaid), icon: BadgeDollarSign, tone: 'bg-emerald-100 text-emerald-900' },
  ];

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs">
          <p className="font-bold text-rose-800">{loadError}</p>
          <button
            type="button"
            onClick={loadAll}
            className="px-3 py-1.5 rounded-lg bg-rose-700 text-white font-bold shrink-0"
          >
            Retry
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Sales Overview Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Live Firestore analytics across field representatives, leads, referred shops, subscription revenue, and commissions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/super-admin/sales/members/new"
            className="px-4 py-2 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white text-xs font-bold transition"
          >
            + Add Salesman
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Filter className="w-3.5 h-3.5 text-[#065F46]" />
          Dashboard Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date Range</label>
            <select
              value={filter.preset}
              onChange={(e) => setFilter((f) => ({ ...f, preset: e.target.value as SalesDatePreset }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="all_time">All Time</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {filter.preset === 'custom' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filter.customStart || ''}
                  onChange={(e) => setFilter((f) => ({ ...f, customStart: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={filter.customEnd || ''}
                  onChange={(e) => setFilter((f) => ({ ...f, customEnd: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Salesman</label>
            <select
              value={filter.salesmanId || ''}
              onChange={(e) => setFilter((f) => ({ ...f, salesmanId: e.target.value || undefined }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
            >
              <option value="">All Salesmen</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sales Manager</label>
            <select
              value={filter.managerId || ''}
              onChange={(e) => setFilter((f) => ({ ...f, managerId: e.target.value || undefined }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
            >
              <option value="">All Managers</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">City</label>
            <select
              value={filter.city || 'all'}
              onChange={(e) => setFilter((f) => ({ ...f, city: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
            >
              <option value="all">All Cities</option>
              {PAKISTAN_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Business Industry</label>
            <select
              value={filter.industry || 'all'}
              onChange={(e) => setFilter((f) => ({ ...f, industry: e.target.value as any }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
            >
              <option value="all">All Industries</option>
              {BUSINESS_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
        </div>
      ) : (
        <>
          {/* 14 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {kpiCards.map((card) => (
              <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.tone}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <p className="text-[11px] font-semibold text-slate-500 leading-tight">{card.label}</p>
                <p className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums truncate">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* 7 Real-Data Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Daily Sales Performance */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Daily Subscription Revenue (7 Days)</h3>
                <p className="text-[11px] text-slate-500">Approved subscription payments per day</p>
              </div>
              <SimpleBarChart data={analytics.dailyPerformanceChart} valuePrefix="Rs. " barColor="#065F46" />
            </div>

            {/* 2. Monthly Sales Performance */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Monthly Sales Performance (6 Months)</h3>
                <p className="text-[11px] text-slate-500">Platform subscription collections across months</p>
              </div>
              <SimpleBarChart data={analytics.monthlyPerformanceChart} valuePrefix="Rs. " barColor="#0284c7" />
            </div>

            {/* 3. Salesman-wise Conversions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Salesman-Wise Shop Registrations</h3>
                <p className="text-[11px] text-slate-500">Verified referral attributions by representative</p>
              </div>
              {analytics.salesmanConversionsChart.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No salesman records match current filters.</p>
              ) : (
                <SimpleBarChart data={analytics.salesmanConversionsChart} barColor="#7c3aed" />
              )}
            </div>

            {/* 4. Subscription Revenue by Salesman */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Subscription Revenue by Salesman</h3>
                <p className="text-[11px] text-slate-500">Approved PKR revenue generated per rep</p>
              </div>
              {analytics.revenueBySalesmanChart.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No revenue data matches current filters.</p>
              ) : (
                <SimpleBarChart data={analytics.revenueBySalesmanChart} valuePrefix="Rs. " barColor="#d97706" />
              )}
            </div>

            {/* 5. Leads vs Successful Registrations */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Leads vs Successful Registrations</h3>
                <p className="text-[11px] text-slate-500">Assigned pipeline volume against converted shops</p>
              </div>
              {analytics.leadsVsRegistrations.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No salesman conversion comparison available.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.leadsVsRegistrations.map((row) => {
                    const maxVal = Math.max(1, row.leads, row.registrations);
                    return (
                      <div key={row.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-800">{row.label}</span>
                          <span className="text-slate-500 tabular-nums">
                            {row.leads} leads / <strong className="text-[#065F46]">{row.registrations} shops</strong>
                          </span>
                        </div>
                        <div className="flex gap-1.5 h-2">
                          <div
                            className="bg-slate-300 rounded-full"
                            style={{ width: `${Math.round((row.leads / maxVal) * 50)}%` }}
                            title={`Leads: ${row.leads}`}
                          />
                          <div
                            className="bg-[#065F46] rounded-full"
                            style={{ width: `${Math.round((row.registrations / maxVal) * 50)}%` }}
                            title={`Registrations: ${row.registrations}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 6. Commission Distribution */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Commission Distribution (PKR)</h3>
                <p className="text-[11px] text-slate-500">Breakdown across Paid, Approved, Pending & Reversed</p>
              </div>
              <DistributionMeters items={analytics.commissionDistribution} />
            </div>

            {/* 7a. Sales Target vs Achievement */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sales Target vs Achievement</h3>
                <p className="text-[11px] text-slate-500">Monthly revenue goal attainment & lead conversion rate</p>
              </div>
              {analytics.targetVsAchievement.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">Add salesmen to track target attainment.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.targetVsAchievement.map((t) => (
                    <div key={t.salesmanId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <Link
                          to={`/super-admin/sales/members/${t.salesmanId}`}
                          className="font-bold text-slate-800 hover:text-[#065F46]"
                        >
                          {t.salesmanName}
                        </Link>
                        <span className="text-slate-600 tabular-nums">
                          {formatPKR(t.achieved)} / {formatPKR(t.target)} ({t.pct}%) · Conv: {t.conversionRate}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#065F46] rounded-full transition-all"
                          style={{ width: `${Math.min(100, t.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 7b. Industry-wise Shop Registrations */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Industry-Wise Shop Registrations</h3>
                <p className="text-[11px] text-slate-500">Referred storefronts grouped by business vertical</p>
              </div>
              {analytics.industryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No attributed shop registrations yet.</p>
              ) : (
                <DistributionMeters items={analytics.industryBreakdown} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

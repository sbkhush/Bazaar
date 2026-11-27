import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  getPlatformAnalytics,
  getPlatformActivityLogs,
  PlatformAnalyticsSummary,
} from '../services/platformService';
import { ActivityLog } from '../types';
import { formatPKR } from '../data/seedData';
import { SimpleBarChart, DistributionMeters } from '../components/common/SimpleCharts';

export const SuperAdminAnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<PlatformAnalyticsSummary | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPlatformAnalytics(), getPlatformActivityLogs(60)])
      .then(([s, l]) => {
        setStats(s);
        setLogs(l);
      })
      .catch((err: any) => {
        setError(err?.message || 'Could not load platform analytics.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex justify-center text-xs text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading platform analytics...
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
        {error || 'Platform analytics could not be loaded.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Platform Growth &amp; Audit Analytics</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Real-time revenue, tenant registrations, and cross-platform administrative actions.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Collected Subscription Revenue</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {formatPKR(stats.totalSubscriptionRevenue)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Monthly Recurring Revenue (MRR)</p>
          <p className="text-2xl font-extrabold text-[#065F46] mt-1 tabular-nums">
            {formatPKR(stats.monthlyRecurringRevenue)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Cross-Tenant Catalog / Orders</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {stats.totalProductsAcrossShops} / {stats.totalOrdersAcrossShops}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">6-Month Shop Registration Velocity</h3>
          <SimpleBarChart
            data={stats.monthlyRegistrationsChart.map((m) => ({ label: m.label, value: m.count }))}
            barColor="#065F46"
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Tenant Distribution by Tier</h3>
          <DistributionMeters
            items={stats.planBreakdown.map((p, i) => ({
              label: p.planName,
              count: p.count,
              color: ['#065F46', '#0f172a', '#d97706'][i % 3],
            }))}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Platform Audit Trail</h3>
        {logs.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No platform logs recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {logs.map((log) => (
              <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">{log.action}</span>{' '}
                  <span className="text-slate-600">— {log.details}</span>
                  <p className="text-[11px] text-slate-400">Actor: {log.actorEmail}</p>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

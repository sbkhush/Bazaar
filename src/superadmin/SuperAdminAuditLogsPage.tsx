import React, { useEffect, useState, useMemo } from 'react';
import { Search, Loader2, ShieldCheck } from 'lucide-react';
import { getPlatformActivityLogs } from '../services/platformService';
import { ActivityLog } from '../types';

export const SuperAdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<'all' | ActivityLog['targetType']>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getPlatformActivityLogs(200);
        setLogs(list);
      } catch (err: any) {
        setError(err?.message || 'Could not load audit trail.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (targetTypeFilter !== 'all' && l.targetType !== targetTypeFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.actorEmail.toLowerCase().includes(q) ||
        l.targetId.toLowerCase().includes(q)
      );
    });
  }, [logs, searchQuery, targetTypeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Platform Audit Logs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable platform-wide audit trail across shops, plans, payments, settings, and support tickets.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold self-start">
          <ShieldCheck className="w-4 h-4" /> {filtered.length} Events
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by actor email, shop ID, action, or details..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs"
          />
        </div>
        <select
          value={targetTypeFilter}
          onChange={(e) => setTargetTypeFilter(e.target.value as any)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
        >
          <option value="all">All Event Categories</option>
          <option value="shop">Shop Events</option>
          <option value="plan">Subscription Plans</option>
          <option value="payment">Payment Verification</option>
          <option value="ticket">Support Tickets</option>
          <option value="settings">Platform Settings</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading audit trail...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-500">No audit events match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 tabular-nums">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{l.actorEmail}</td>
                    <td className="py-3 px-4 font-bold text-[#065F46]">{l.action}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {l.targetType}:{l.targetId}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

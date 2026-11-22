import React, { useEffect, useMemo, useState } from 'react';
import { History, PhoneCall, ShieldCheck, Loader2 } from 'lucide-react';
import {
  ALL_ACTIVITY_TYPES,
  getAllSalesActivities,
  getAllSalesMembers,
  getSalesAuditLogs,
} from '../../services/salesService';
import { SalesActivity, SalesAuditLog, SalesMember } from '../../types';

export const SalesActivityLogsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<'activities' | 'audit'>('activities');
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [auditLogs, setAuditLogs] = useState<SalesAuditLog[]>([]);
  const [members, setMembers] = useState<SalesMember[]>([]);
  const [salesmanFilter, setSalesmanFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [a, logs, m] = await Promise.all([
        getAllSalesActivities(),
        getSalesAuditLogs(200),
        getAllSalesMembers(),
      ]);
      setActivities(a);
      setAuditLogs(logs);
      setMembers(m);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load sales activity and audit logs from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredActivities = useMemo(
    () =>
      activities.filter((a) => {
        if (salesmanFilter && a.salesmanId !== salesmanFilter) return false;
        if (typeFilter && a.activityType !== typeFilter) return false;
        return true;
      }),
    [activities, salesmanFilter, typeFilter]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Sales Activity & Audit Logs</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review field visits, calls, WhatsApp follow-ups, demos, and immutable financial/admin security logs.
          </p>
        </div>

        <div className="inline-flex bg-white border border-slate-200 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setTab('activities')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              tab === 'activities' ? 'bg-[#065F46] text-white' : 'text-slate-600'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" /> Field & Call Activities ({activities.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              tab === 'audit' ? 'bg-[#065F46] text-white' : 'text-slate-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Financial & Security Audit ({auditLogs.length})
          </button>
        </div>
      </div>

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-rose-800">{loadError}</span>
          <button
            type="button"
            onClick={loadData}
            className="px-3.5 py-1.5 rounded-lg bg-rose-700 text-white font-bold hover:bg-rose-800 self-start sm:self-auto"
          >
            Retry
          </button>
        </div>
      )}

      {tab === 'activities' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <select
            value={salesmanFilter}
            onChange={(e) => setSalesmanFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white"
          >
            <option value="">All Salesmen</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName} ({m.employeeId})
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white"
          >
            <option value="">All Activity Types</option>
            {ALL_ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
          </div>
        ) : tab === 'activities' ? (
          filteredActivities.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 space-y-2">
              <PhoneCall className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">No sales activities recorded yet</p>
              <p>Field & call logs submitted by salesmen in the Salesman Portal appear here automatically.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredActivities.map((a) => (
                <div key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-900">{a.salesmanName}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#065F46] font-bold text-[11px]">
                        {a.activityType}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px] capitalize">
                        {a.resultStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-slate-600">{a.notes}</p>
                    {(a.leadName || a.shopName || a.nextFollowUpDate) && (
                      <p className="text-[11px] text-slate-500">
                        {a.leadName ? `Lead: ${a.leadName} · ` : ''}
                        {a.shopName ? `Shop: ${a.shopName} · ` : ''}
                        {a.nextFollowUpDate ? `Next Follow-up: ${a.nextFollowUpDate}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 shrink-0">
                    {new Date(a.activityDateTime).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : auditLogs.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 space-y-2">
            <History className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No audit logs recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{log.actorEmail}</p>
                      <p className="text-[10px] uppercase text-slate-400">{log.actorRole}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{log.action}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {log.entityType}:{log.entityId}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{log.details}</td>
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

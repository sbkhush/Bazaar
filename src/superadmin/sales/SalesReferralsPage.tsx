import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Download, Loader2, ShieldAlert } from 'lucide-react';
import { getAllReferralAttributions } from '../../services/salesService';
import { buildCsvContent, downloadCsvFile } from '../../utils/csvUtils';
import { formatPKR } from '../../data/seedData';
import { useToast } from '../../components/common/Toast';
import { ReferralAttribution } from '../../types';

export const SalesReferralsPage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralAttribution[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await getAllReferralAttributions();
      setReferrals(list);
    } catch (err: any) {
      const msg = err?.message || 'Unable to load referral attributions from Firestore.';
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(
    () => referrals.filter((r) => statusFilter === 'all' || r.attributionStatus === statusFilter),
    [referrals, statusFilter]
  );

  const exportCsv = () => {
    downloadCsvFile(
      `sbkhush-referrals-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Shop ID', 'Shop Name', 'Owner Email', 'Referral Code', 'Salesman', 'Source', 'Attribution Status', 'Revenue Generated', 'Date'],
      filtered.map((r) => [
        r.shopId,
        r.shopName,
        r.ownerEmail,
        r.referralCode,
        r.salesmanName,
        r.source,
        r.attributionStatus,
        r.totalRevenueGenerated,
        r.createdAt,
      ])
    );
    showToast('Exported referrals CSV.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Referrals & Attribution Audit</h1>
          <p className="text-xs text-slate-500 mt-1">
            Inspect attribution sources (QR scan, link, manual, code entry) and self-referral protection blocks.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="registered">Registered</option>
            <option value="verified">Verified</option>
            <option value="subscribed">Subscribed</option>
            <option value="rejected_self_referral">Blocked Self-Referrals</option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
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

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Link2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No referral attributions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Shop</th>
                  <th className="px-4 py-3">Referral Code & Salesman</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{r.shopName}</p>
                      <p className="text-[11px] text-slate-500">{r.ownerEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/super-admin/sales/members/${r.salesmanId}`} className="font-bold text-[#065F46] hover:underline">
                        {r.salesmanName}
                      </Link>
                      <p className="font-mono text-[11px] text-slate-500">{r.referralCode}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">{r.source.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          r.attributionStatus === 'rejected_self_referral'
                            ? 'bg-rose-50 text-rose-700'
                            : r.attributionStatus === 'subscribed'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {r.attributionStatus === 'rejected_self_referral' && <ShieldAlert className="w-3 h-3" />}
                        {r.attributionStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-bold">{formatPKR(r.totalRevenueGenerated)}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
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

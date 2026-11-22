import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Search, Loader2, ExternalLink } from 'lucide-react';
import { getAllReferralAttributions } from '../../services/salesService';
import { getAllShopsAdmin } from '../../services/platformService';
import { formatPKR } from '../../data/seedData';
import { ReferralAttribution, Shop } from '../../types';

export const SalesRegistrationsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralAttribution[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [r, s] = await Promise.all([getAllReferralAttributions(), getAllShopsAdmin()]);
      setReferrals(r);
      setShops(s);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load attributed shop registrations from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const shopMap = useMemo(() => new Map(shops.map((s) => [s.id, s])), [shops]);

  const rows = useMemo(() => {
    return referrals.filter((r) => {
      if (r.attributionStatus === 'rejected_self_referral') return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${r.shopName} ${r.shopSlug} ${r.salesmanName} ${r.referralCode} ${r.city || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [referrals, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Sales Shop Registrations</h1>
          <p className="text-xs text-slate-500 mt-1">
            All merchant storefronts registered through salesman referral links, QR scans, and assisted signups.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shop, city, salesman..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
          />
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
        ) : rows.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Store className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No attributed shop registrations yet</p>
            <p className="text-xs text-slate-500">When a merchant signs up with a salesman referral code or QR link, it appears here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Shop & City</th>
                  <th className="px-4 py-3">Salesman</th>
                  <th className="px-4 py-3">Plan & Status</th>
                  <th className="px-4 py-3">Revenue Generated</th>
                  <th className="px-4 py-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const shop = shopMap.get(r.shopId);
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{r.shopName}</p>
                        <p className="text-[11px] text-slate-500">/s/{r.shopSlug} · {r.city || shop?.city || 'Pakistan'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/super-admin/sales/members/${r.salesmanId}`} className="font-bold text-[#065F46] hover:underline">
                          {r.salesmanName}
                        </Link>
                        <p className="text-[11px] font-mono text-slate-500">{r.referralCode}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{shop?.subscription?.planName || 'Free Plan'}</span>
                        <div className="text-[11px] capitalize text-slate-500">
                          Store: {shop?.status || 'active'} · {r.attributionStatus}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums text-slate-900">
                        {formatPKR(r.totalRevenueGenerated)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/super-admin/shops/${r.shopId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold"
                        >
                          Shop <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

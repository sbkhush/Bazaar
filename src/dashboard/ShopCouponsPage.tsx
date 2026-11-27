import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Lock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDashboard } from './DashboardContext';
import {
  getShopCoupons,
  saveShopCoupon,
  deleteShopCoupon,
} from '../services/tenantService';
import { Coupon } from '../types';
import { formatPKR } from '../data/seedData';

export const ShopCouponsPage: React.FC = () => {
  const { shopId, canUseFeature, isReadOnly } = useDashboard();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Coupon>>({
    code: '',
    discountType: 'percentage',
    discountValue: 10,
    minOrderValue: 1500,
    expiryDate: '2027-12-31',
    isActive: true,
  });

  const allowed = canUseFeature('coupons');

  const loadCoupons = async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      setCoupons(await getShopCoupons(shopId));
    } catch (err: any) {
      setError(err?.message || 'Could not load coupons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, [shopId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setError(null);
    try {
      await saveShopCoupon(shopId, form);
      setCreating(false);
      setForm({ code: '', discountType: 'percentage', discountValue: 10, minOrderValue: 1500, expiryDate: '2027-12-31', isActive: true });
      await loadCoupons();
    } catch (err: any) {
      setError(err?.message || 'Could not save coupon');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Coupons &amp; Discounts</h2>
          <p className="text-xs text-slate-500 mt-0.5">Create promo codes for customer checkout.</p>
        </div>
        {!isReadOnly && allowed && (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="px-4 py-2.5 bg-[#065F46] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 self-start"
          >
            <Plus className="w-4 h-4" /> Create Coupon
          </button>
        )}
      </div>

      {!allowed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-medium">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Discount Coupons are unlocked on Growth Business &amp; Enterprise Pro plans.</span>
          </div>
          <Link to="/dashboard/subscription" className="px-3.5 py-1.5 bg-amber-900 text-white rounded-lg font-bold">
            Upgrade Plan
          </Link>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{error}</div>
      )}

      {creating && (
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
          <input
            type="text"
            required
            placeholder="CODE (e.g. EID15)"
            value={form.code || ''}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className="px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase"
          />
          <select
            value={form.discountType}
            onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed PKR</option>
          </select>
          <input
            type="number"
            required
            min={1}
            value={form.discountValue || 10}
            onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
            placeholder="Value"
            className="px-3 py-2 border border-slate-200 rounded-lg"
          />
          <input
            type="number"
            min={0}
            value={form.minOrderValue || 0}
            onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })}
            placeholder="Min Order (PKR)"
            className="px-3 py-2 border border-slate-200 rounded-lg"
          />
          <button type="submit" className="py-2 bg-[#065F46] text-white rounded-lg font-bold">
            Save Coupon
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center text-xs text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading coupons...
          </div>
        ) : coupons.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No coupons configured yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {coupons.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <span className="font-mono font-extrabold text-sm text-slate-900">{c.code}</span>
                  <p className="text-[11px] text-slate-500">
                    {c.discountType === 'percentage' ? `${c.discountValue}% off` : `${formatPKR(c.discountValue)} off`} · Min order {formatPKR(c.minOrderValue)} · Expires {c.expiryDate}
                  </p>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() =>
                      deleteShopCoupon(shopId, c.id)
                        .then(loadCoupons)
                        .catch((err: any) => setError(err?.message || 'Could not delete coupon.'))
                    }
                    className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Check, Loader2 } from 'lucide-react';
import {
  getSubscriptionPlans,
  saveSubscriptionPlan,
  deleteSubscriptionPlan,
  seedDefaultPlansIfEmpty,
} from '../services/platformService';
import { SubscriptionPlan, PlanFeatures } from '../types';
import { formatPKR } from '../data/seedData';

const EMPTY_FEATURES: PlanFeatures = {
  customBranding: true,
  coupons: true,
  banners: true,
  analytics: true,
  selfPickup: true,
  buyingGuide: true,
  staffAccounts: true,
  customPages: true,
  pos: true,
  barcode: true,
  suppliersPurchases: true,
  khata: true,
  advancedInventory: true,
  advancedReports: true,
  prioritySupport: false,
};

export const SuperAdminPlansPage: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Partial<SubscriptionPlan> | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      await seedDefaultPlansIfEmpty();
      const list = await getSubscriptionPlans();
      setPlans(list);
    } catch (err: any) {
      setError(err?.message || 'Could not load subscription plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await saveSubscriptionPlan(editing);
      setEditing(null);
      await loadPlans();
    } catch (err: any) {
      setError(err?.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planId: string) => {
    setError(null);
    try {
      await deleteSubscriptionPlan(planId);
      await loadPlans();
    } catch (err: any) {
      setError(err?.message || 'Could not delete plan');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Subscription Plans (PKR)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Define product limits, Cloud Storage quotas, staff seats, and feature toggles per tier.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              name: '',
              description: '',
              monthlyPrice: 1500,
              yearlyPrice: 15000,
              durationDays: 30,
              maxProducts: 100,
              maxStorageMB: 250,
              maxStaff: 3,
              features: { ...EMPTY_FEATURES },
              isActive: true,
              order: plans.length + 1,
            })
          }
          className="px-4 py-2.5 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" /> Create Plan
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading plans...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{plan.name}</h3>
                    <p className="text-[11px] font-mono text-slate-400">{plan.id}</p>
                  </div>
                  <span className={`text-[11px] font-bold uppercase ${plan.isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {plan.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <p className="text-xs text-slate-600">{plan.description}</p>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs tabular-nums">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Monthly</span>
                    <strong>{plan.monthlyPrice === 0 ? 'Free' : formatPKR(plan.monthlyPrice)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Yearly</span>
                    <strong>{plan.yearlyPrice === 0 ? 'Free' : formatPKR(plan.yearlyPrice)}</strong>
                  </div>
                </div>

                <div className="text-xs text-slate-700 space-y-1 pt-2 border-t border-slate-100 tabular-nums">
                  <p>Max Active Products: <strong>{plan.maxProducts === -1 ? 'Unlimited' : plan.maxProducts}</strong></p>
                  <p>Storage Limit: <strong>{plan.maxStorageMB} MB</strong></p>
                  <p>Staff Accounts: <strong>{plan.maxStaff}</strong></p>
                  <p>Cycle Duration: <strong>{plan.durationDays} days</strong></p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                  {Object.entries(plan.features || {}).map(([k, v]) => (
                    <span
                      key={k}
                      className={`px-2 py-0.5 rounded border ${
                        v ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                      }`}
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditing(plan)}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    saveSubscriptionPlan({ ...plan, isActive: !plan.isActive })
                      .then(loadPlans)
                      .catch((err: any) => setError(err?.message || 'Could not update plan status.'))
                  }
                  className="px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  {plan.isActive ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(plan.id)}
                  className="p-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Editor Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 my-8">
            <h3 className="text-base font-extrabold text-slate-900">
              {editing.id ? `Edit Plan: ${editing.name}` : 'Create Subscription Plan'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plan Name *</label>
                <input
                  type="text"
                  required
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={editing.order || 1}
                  onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Monthly Price (PKR)</label>
                <input
                  type="number"
                  min={0}
                  value={editing.monthlyPrice || 0}
                  onChange={(e) => setEditing({ ...editing, monthlyPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Yearly Price (PKR)</label>
                <input
                  type="number"
                  min={0}
                  value={editing.yearlyPrice || 0}
                  onChange={(e) => setEditing({ ...editing, yearlyPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Max Active Products (-1 = Unlimited)</label>
                <input
                  type="number"
                  min={-1}
                  value={editing.maxProducts ?? 50}
                  onChange={(e) => setEditing({ ...editing, maxProducts: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Max Storage (MB)</label>
                <input
                  type="number"
                  min={10}
                  value={editing.maxStorageMB || 50}
                  onChange={(e) => setEditing({ ...editing, maxStorageMB: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Max Staff Seats</label>
                <input
                  type="number"
                  min={1}
                  value={editing.maxStaff || 1}
                  onChange={(e) => setEditing({ ...editing, maxStaff: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  value={editing.durationDays || 30}
                  onChange={(e) => setEditing({ ...editing, durationDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <p className="text-xs font-bold text-slate-700">Feature Toggles</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {Object.keys(EMPTY_FEATURES).map((fk) => {
                  const key = fk as keyof PlanFeatures;
                  const checked = Boolean(editing.features?.[key]);
                  return (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            features: { ...(editing.features || EMPTY_FEATURES), [key]: e.target.checked },
                          })
                        }
                      />
                      <span className="truncate">{key}</span>
                    </label>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold pt-2">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isPopular)}
                  onChange={(e) => setEditing({ ...editing, isPopular: e.target.checked })}
                />
                Highlight as &ldquo;Most Popular&rdquo;
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#065F46] text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Plan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

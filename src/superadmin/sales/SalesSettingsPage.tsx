import React, { useEffect, useState } from 'react';
import { Settings, Save, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  DEFAULT_SALES_SETTINGS,
  getSalesSettings,
  updateSalesSettings,
} from '../../services/salesService';
import { formatPKR } from '../../data/seedData';
import { useToast } from '../../components/common/Toast';
import { CommissionRuleTier, SalesSettings } from '../../types';

export const SalesSettingsPage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SalesSettings>(DEFAULT_SALES_SETTINGS);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const s = await getSalesSettings();
        setSettings(s);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateTier = (idx: number, patch: Partial<CommissionRuleTier>) => {
    setSettings((prev) => ({
      ...prev,
      commissionPlans: prev.commissionPlans.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));
  };

  const addTier = () => {
    const id = `tier-${Date.now().toString().slice(-4)}`;
    setSettings((prev) => ({
      ...prev,
      commissionPlans: [
        ...prev.commissionPlans,
        {
          id,
          name: 'Custom Commission Plan',
          firstSubRatePct: 15,
          renewalRatePct: 5,
          verifiedShopBonus: 300,
          yearlyPlanBonusPct: 3,
          minRevenueForBonus: 50000,
          targetBonusAmount: 5000,
        },
      ],
    }));
  };

  const removeTier = (idx: number) => {
    if (settings.commissionPlans.length <= 1) {
      showToast('At least one commission plan tier is required.', 'error');
      return;
    }
    setSettings((prev) => ({
      ...prev,
      commissionPlans: prev.commissionPlans.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateSalesSettings(settings);
      setSettings(updated);
      showToast('Sales settings and commission plans saved.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Sales & Commission Settings</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure portal base URL, referral guardrails, minimum payout threshold, and server-verified commission rate tiers.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white text-xs font-bold inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* General & Security Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#065F46]" /> General & Attribution Rules
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Portal Base URL</label>
            <input
              required
              value={settings.portalBaseUrl}
              onChange={(e) => setSettings({ ...settings, portalBaseUrl: e.target.value })}
              placeholder="https://sbkhush.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Default First Subscription Rate (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.defaultFirstSubRatePct}
              onChange={(e) => setSettings({ ...settings, defaultFirstSubRatePct: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Default Renewal Rate (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.defaultRenewalRatePct}
              onChange={(e) => setSettings({ ...settings, defaultRenewalRatePct: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Verified Shop Flat Bonus (PKR)</label>
            <input
              type="number"
              min={0}
              value={settings.verifiedShopFlatBonus}
              onChange={(e) => setSettings({ ...settings, verifiedShopFlatBonus: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Min Payout Threshold (PKR)</label>
            <input
              type="number"
              min={0}
              value={settings.minPayoutThreshold}
              onChange={(e) => setSettings({ ...settings, minPayoutThreshold: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Attribution Window (Days)</label>
            <input
              type="number"
              min={1}
              value={settings.attributionWindowDays}
              onChange={(e) => setSettings({ ...settings, attributionWindowDays: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.preventSelfReferral}
              onChange={(e) => setSettings({ ...settings, preventSelfReferral: e.target.checked })}
              className="accent-[#065F46]"
            />
            <div>
              <p className="font-bold text-slate-800">Block Self-Referrals</p>
              <p className="text-[11px] text-slate-500">Prevent reps earning on own UID/email/phone</p>
            </div>
          </label>
          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoSyncCommissionOnPaymentApproval}
              onChange={(e) =>
                setSettings({ ...settings, autoSyncCommissionOnPaymentApproval: e.target.checked })
              }
              className="accent-[#065F46]"
            />
            <div>
              <p className="font-bold text-slate-800">Auto-Sync on Approval</p>
              <p className="text-[11px] text-slate-500">Create ledger entry when payment verified</p>
            </div>
          </label>
          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowManualReferralEntry}
              onChange={(e) =>
                setSettings({ ...settings, allowManualReferralEntry: e.target.checked })
              }
              className="accent-[#065F46]"
            />
            <div>
              <p className="font-bold text-slate-800">Manual Referral Code Input</p>
              <p className="text-[11px] text-slate-500">Allow merchants to enter rep code at signup</p>
            </div>
          </label>
        </div>
      </div>

      {/* Commission Rule Tiers */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Commission Plan Tiers</h2>
            <p className="text-[11px] text-slate-500">
              Positive achievement bonuses only — base compensation is never penalized.
            </p>
          </div>
          <button
            type="button"
            onClick={addTier}
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Tier
          </button>
        </div>

        <div className="space-y-4">
          {settings.commissionPlans.map((tier, idx) => (
            <div key={tier.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <input
                  value={tier.name}
                  onChange={(e) => updateTier(idx, { name: e.target.value })}
                  className="font-extrabold text-sm text-slate-900 bg-white px-3 py-1.5 border border-slate-200 rounded-lg flex-1"
                />
                <span className="font-mono text-[11px] text-slate-400">{tier.id}</span>
                <button
                  type="button"
                  onClick={() => removeTier(idx)}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">First Sub %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={tier.firstSubRatePct}
                    onChange={(e) => updateTier(idx, { firstSubRatePct: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Renewal %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={tier.renewalRatePct}
                    onChange={(e) => updateTier(idx, { renewalRatePct: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Yearly Extra %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={tier.yearlyPlanBonusPct}
                    onChange={(e) => updateTier(idx, { yearlyPlanBonusPct: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Shop Bonus (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    value={tier.verifiedShopBonus}
                    onChange={(e) => updateTier(idx, { verifiedShopBonus: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Min Rev ({formatPKR(tier.minRevenueForBonus)})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={tier.minRevenueForBonus}
                    onChange={(e) => updateTier(idx, { minRevenueForBonus: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Bonus (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    value={tier.targetBonusAmount}
                    onChange={(e) => updateTier(idx, { targetBonusAmount: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { Target, Trophy, Loader2, ShieldCheck } from 'lucide-react';
import {
  getAllSalesMembers,
  getAllSalesTargets,
  getAllSalesLeads,
  getAllReferralAttributions,
  getAllCommissionLedger,
  saveSalesTarget,
} from '../../services/salesService';
import { formatPKR } from '../../data/seedData';
import { useToast } from '../../components/common/Toast';
import {
  CommissionLedgerEntry,
  ReferralAttribution,
  SalesLead,
  SalesMember,
  SalesTarget,
} from '../../types';

export const SalesTargetsPage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<SalesMember[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [referrals, setReferrals] = useState<ReferralAttribution[]>([]);
  const [commissions, setCommissions] = useState<CommissionLedgerEntry[]>([]);

  const [periodKey, setPeriodKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedSalesmanId, setSelectedSalesmanId] = useState('');
  const [dailyActivityTarget, setDailyActivityTarget] = useState('10');
  const [weeklyLeadTarget, setWeeklyLeadTarget] = useState('15');
  const [monthlyRegistrationTarget, setMonthlyRegistrationTarget] = useState('12');
  const [monthlyPaidSubscriptionTarget, setMonthlyPaidSubscriptionTarget] = useState('6');
  const [revenueTarget, setRevenueTarget] = useState('50000');
  const [conversionTarget, setConversionTarget] = useState('25');
  const [bonusAmount, setBonusAmount] = useState('5000');
  const [bonusThresholdPct, setBonusThresholdPct] = useState('100');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, t, l, r, c] = await Promise.all([
        getAllSalesMembers().catch(() => []),
        getAllSalesTargets().catch(() => []),
        getAllSalesLeads().catch(() => []),
        getAllReferralAttributions().catch(() => []),
        getAllCommissionLedger().catch(() => []),
      ]);
      setMembers(m);
      setTargets(t);
      setLeads(l);
      setReferrals(r);
      setCommissions(c);
      if (!selectedSalesmanId && m[0]) {
        setSelectedSalesmanId(m[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = members.find((mem) => mem.id === selectedSalesmanId);
    if (!m) {
      showToast('Select a salesman first.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveSalesTarget({
        salesmanId: m.id,
        salesmanUid: m.uid,
        salesmanName: m.fullName,
        periodType: 'monthly',
        periodKey,
        dailyActivityTarget: Number(dailyActivityTarget) || 0,
        weeklyLeadTarget: Number(weeklyLeadTarget) || 0,
        monthlyRegistrationTarget: Number(monthlyRegistrationTarget) || 0,
        monthlyPaidSubscriptionTarget: Number(monthlyPaidSubscriptionTarget) || 0,
        revenueTarget: Number(revenueTarget) || 0,
        conversionTarget: Number(conversionTarget) || 0,
        bonusAmount: Number(bonusAmount) || 0,
        bonusThresholdPct: Number(bonusThresholdPct) || 100,
      });
      showToast(`Saved KPI targets for ${m.fullName} (${periodKey}).`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save target.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const leaderboard = useMemo(() => {
    return members
      .map((m) => {
        const tgt = targets.find((t) => t.salesmanId === m.id && t.periodKey === periodKey);
        const mLeads = leads.filter((l) => l.assignedSalesmanId === m.id && l.createdAt.startsWith(periodKey));
        const mRegs = referrals.filter(
          (r) => r.salesmanId === m.id && r.attributionStatus !== 'rejected_self_referral' && r.createdAt.startsWith(periodKey)
        );
        const mComms = commissions.filter(
          (c) => c.salesmanId === m.id && c.status !== 'rejected' && c.status !== 'reversed' && c.createdAt.startsWith(periodKey)
        );
        const revAchieved = mComms.reduce((sum, c) => sum + Number(c.paymentAmount || 0), 0);
        const revGoal = tgt?.revenueTarget || m.monthlyTarget || 50000;
        const pct = revGoal > 0 ? Math.round((revAchieved / revGoal) * 100) : 0;
        const convRate = mLeads.length > 0 ? Math.round((mRegs.length / mLeads.length) * 100) : 0;
        const bonusQualified = tgt ? pct >= tgt.bonusThresholdPct && tgt.bonusAmount > 0 : false;

        return {
          member: m,
          target: tgt,
          leadsCount: mLeads.length,
          regsCount: mRegs.length,
          paidSubsCount: mComms.length,
          revAchieved,
          revGoal,
          pct,
          convRate,
          bonusQualified,
        };
      })
      .sort((a, b) => b.pct - a.pct || b.revAchieved - a.revAchieved);
  }, [members, targets, leads, referrals, commissions, periodKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Sales Targets & Leaderboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure monthly activity, lead, registration, paid subscription, and revenue goals with positive bonus tiers.
          </p>
        </div>
        <div>
          <input
            type="month"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-semibold"
          />
        </div>
      </div>

      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
        <ShieldCheck className="w-4 h-4 text-[#065F46] shrink-0" />
        <span>
          Fair Compensation Policy: Targets drive performance rankings and positive bonus eligibility only. Base salaries are never automatically penalized or deducted for unattained targets.
        </span>
      </div>

      {/* Config Form */}
      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
          <Target className="w-4 h-4 text-[#065F46]" />
          Configure Individual Salesman Targets ({periodKey})
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Salesman</label>
            <select
              value={selectedSalesmanId}
              onChange={(e) => setSelectedSalesmanId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName} ({m.employeeId})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Daily Activity Target</label>
            <input type="number" min="0" value={dailyActivityTarget} onChange={(e) => setDailyActivityTarget(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Weekly Lead Target</label>
            <input type="number" min="0" value={weeklyLeadTarget} onChange={(e) => setWeeklyLeadTarget(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Monthly Shop Reg Target</label>
            <input type="number" min="0" value={monthlyRegistrationTarget} onChange={(e) => setMonthlyRegistrationTarget(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Monthly Paid Subs Target</label>
            <input type="number" min="0" value={monthlyPaidSubscriptionTarget} onChange={(e) => setMonthlyPaidSubscriptionTarget(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Monthly Revenue Target (PKR)</label>
            <input type="number" min="0" value={revenueTarget} onChange={(e) => setRevenueTarget(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Bonus (PKR)</label>
            <input type="number" min="0" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Bonus Threshold (%)</label>
            <input type="number" min="1" value={bonusThresholdPct} onChange={(e) => setBonusThresholdPct(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving || members.length === 0} className="px-5 py-2 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white font-bold">
            {saving ? 'Saving...' : 'Save Target Plan'}
          </button>
        </div>
      </form>

      {/* Leaderboard */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-900">Performance Ranking ({periodKey})</h3>
        </div>
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#065F46]" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Representative</th>
                  <th className="px-4 py-3">Leads / Shops / Paid</th>
                  <th className="px-4 py-3">Conv. Rate</th>
                  <th className="px-4 py-3">Revenue vs Goal</th>
                  <th className="px-4 py-3">Attainment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboard.map((row, idx) => (
                  <tr key={row.member.id}>
                    <td className="px-4 py-3 font-extrabold text-slate-700">#{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{row.member.fullName}</p>
                      <p className="text-[11px] text-slate-500">{row.member.city}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.leadsCount} leads · {row.regsCount} shops · <strong>{row.paidSubsCount} paid</strong>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{row.convRate}%</td>
                    <td className="px-4 py-3 tabular-nums">
                      <strong>{formatPKR(row.revAchieved)}</strong> / {formatPKR(row.revGoal)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#065F46] rounded-full" style={{ width: `${Math.min(100, row.pct)}%` }} />
                        </div>
                        <span className="font-bold tabular-nums">{row.pct}%</span>
                        {row.bonusQualified && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px]">
                            Bonus Qualified
                          </span>
                        )}
                      </div>
                    </td>
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

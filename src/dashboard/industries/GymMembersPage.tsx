import React, { useEffect, useState } from 'react';
import {
  Loader2,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  cancelGymMembership,
  computeGymExpiryDate,
  computeGymMemberStatus,
  deleteGymPlan,
  freezeGymMembership,
  getGymMembers,
  getGymPlans,
  getGymTrainers,
  renewGymMembership,
  saveGymMember,
  saveGymPlan,
} from '../../services/gymService';
import {
  formatWhatsAppReminderUrl,
  recordIndustryPayment,
} from '../../services/industryCommonService';
import { GymMember, GymPlan, GymTrainer, ManualPaymentMethod } from '../../types';
import { formatPKR } from '../../data/seedData';

export const GymMembersPage: React.FC = () => {
  const { shopId, shop, isReadOnly } = useDashboard();
  const [members, setMembers] = useState<GymMember[]>([]);
  const [plans, setPlans] = useState<GymPlan[]>([]);
  const [trainers, setTrainers] = useState<GymTrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'frozen'>('all');

  // Plan Form
  const [planName, setPlanName] = useState('');
  const [planDurationType, setPlanDurationType] = useState<GymPlan['durationType']>('monthly');
  const [planDays, setPlanDays] = useState('30');
  const [planPrice, setPlanPrice] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  // Member Form
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>('cash');
  const [savingMember, setSavingMember] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const [m, p, t] = await Promise.all([
        getGymMembers(shopId),
        getGymPlans(shopId),
        getGymTrainers(shopId),
      ]);
      setMembers(m);
      setPlans(p);
      setTrainers(t);
      if (!selectedPlanId && p.length > 0) {
        setSelectedPlanId(p[0].id);
        setPaidAmount(String(p[0].price));
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load gym members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly) return;
    setSavingPlan(true);
    setError(null);
    try {
      await saveGymPlan(shopId, {
        name: planName,
        durationType: planDurationType,
        durationDays: Number(planDays) || 30,
        price: Number(planPrice) || 0,
      });
      setPlanName('');
      setPlanPrice('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save membership plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly) return;
    setSavingMember(true);
    setError(null);
    try {
      const plan = plans.find((p) => p.id === selectedPlanId);
      const trainer = trainers.find((t) => t.id === selectedTrainerId);
      const feeAmount = plan ? plan.price : Number(paidAmount || 0);
      const paidNow = Math.max(0, Number(paidAmount || 0));
      const expiryDate = computeGymExpiryDate(startDate, plan?.durationDays || 30);

      const saved = await saveGymMember(shopId, {
        name: memberName,
        phone: memberPhone,
        email: memberEmail || undefined,
        planId: plan?.id,
        planName: plan?.name || 'Standard Monthly',
        trainerId: trainer?.id,
        trainerName: trainer?.name,
        startDate,
        expiryDate,
        feeAmount,
        paidAmount: paidNow,
        pendingAmount: Math.max(0, feeAmount - paidNow),
      });

      if (paidNow > 0) {
        await recordIndustryPayment(shopId, {
          module: 'gym',
          referenceType: 'membership',
          referenceId: saved.id,
          customerName: saved.name,
          customerPhone: saved.phone,
          amount: paidNow,
          method: paymentMethod,
          status: 'paid',
          notes: `Membership enrollment (${saved.planName})`,
        });
      }

      setMemberName('');
      setMemberPhone('');
      setMemberEmail('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not register member.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleRenew = async (member: GymMember) => {
    if (isReadOnly) return;
    const plan = plans.find((p) => p.id === member.planId) || plans[0];
    if (!plan) {
      setError('Create a membership plan first to renew.');
      return;
    }
    try {
      const updated = await renewGymMembership(shopId, member, plan, plan.price);
      await recordIndustryPayment(shopId, {
        module: 'gym',
        referenceType: 'membership',
        referenceId: updated.id,
        customerName: updated.name,
        customerPhone: updated.phone,
        amount: plan.price,
        method: 'cash',
        status: 'paid',
        notes: `Renewed ${plan.name}`,
      });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Renewal failed.');
    }
  };

  const filtered = members.filter((m) => {
    const eff = computeGymMemberStatus(m);
    if (statusFilter !== 'all' && eff !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${m.name} ${m.phone} ${m.memberCode} ${m.planName || ''}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Gym Members &amp; Membership Plans</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage Monthly, Quarterly, 6-Month, and Annual packages, renewals, freezes, and member fees.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plans Manager */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
          <h3 className="text-sm font-extrabold text-slate-900">Membership Plans</h3>
          {!isReadOnly && (
            <form onSubmit={handleCreatePlan} className="space-y-2.5">
              <input
                type="text"
                required
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Plan Name (e.g. Monthly Pro)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={planDurationType}
                  onChange={(e) => {
                    const val = e.target.value as GymPlan['durationType'];
                    setPlanDurationType(val);
                    if (val === 'monthly') setPlanDays('30');
                    else if (val === 'quarterly') setPlanDays('90');
                    else if (val === 'half_yearly') setPlanDays('180');
                    else if (val === 'annual') setPlanDays('365');
                  }}
                  className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="monthly">Monthly (30d)</option>
                  <option value="quarterly">Quarterly (90d)</option>
                  <option value="half_yearly">6-Month (180d)</option>
                  <option value="annual">Annual (365d)</option>
                  <option value="custom">Custom Days</option>
                </select>
                <input
                  type="number"
                  min="1"
                  required
                  value={planDays}
                  onChange={(e) => setPlanDays(e.target.value)}
                  placeholder="Days"
                  className="px-2.5 py-2 border border-slate-200 rounded-lg tabular-nums"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  required
                  value={planPrice}
                  onChange={(e) => setPlanPrice(e.target.value)}
                  placeholder="Fee (PKR)"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                />
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-4 py-2 bg-[#065F46] text-white rounded-lg font-bold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-slate-100">
            {plans.length === 0 ? (
              <p className="text-slate-400 py-4 text-center">No plans added yet.</p>
            ) : (
              plans.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{p.name}</p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {p.durationDays} days · {formatPKR(p.price)}
                    </p>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => deleteGymPlan(shopId, p.id).then(load)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Register Member Form */}
        {!isReadOnly && (
          <form
            onSubmit={handleAddMember}
            className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs"
          >
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#065F46]" /> Register New Gym Member
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Member Full Name *"
                className="px-3 py-2 border border-slate-200 rounded-lg"
              />
              <input
                type="tel"
                required
                value={memberPhone}
                onChange={(e) => setMemberPhone(e.target.value)}
                placeholder="Mobile / WhatsApp *"
                className="px-3 py-2 border border-slate-200 rounded-lg"
              />
              <input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="Email (optional)"
                className="px-3 py-2 border border-slate-200 rounded-lg"
              />
              <select
                value={selectedPlanId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedPlanId(id);
                  const found = plans.find((p) => p.id === id);
                  if (found) setPaidAmount(String(found.price));
                }}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Select Membership Plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatPKR(p.price)} / {p.durationDays}d)
                  </option>
                ))}
              </select>
              <select
                value={selectedTrainerId}
                onChange={(e) => setSelectedTrainerId(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Assign Trainer (Optional)</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.specialty})
                  </option>
                ))}
              </select>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg"
              />
              <input
                type="number"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="Fee Paid Today (PKR)"
                className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
              />
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as ManualPaymentMethod)}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="cash">Cash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="jazzcash">JazzCash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="ibft">IBFT</option>
              </select>
              <button
                type="submit"
                disabled={savingMember}
                className="px-4 py-2 bg-[#065F46] text-white rounded-lg font-bold"
              >
                {savingMember ? 'Saving...' : 'Enroll Member'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Member Directory */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden text-xs">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member name, code, or phone..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'active', 'expired', 'frozen'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold capitalize ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading member roster...
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-slate-500">No gym members found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Plan &amp; Trainer</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((m) => {
                  const eff = computeGymMemberStatus(m);
                  return (
                    <tr key={m.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">
                          {m.name} <span className="font-mono text-slate-400">· {m.memberCode}</span>
                        </p>
                        <p className="text-[11px] text-slate-500">{m.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{m.planName || 'Custom'}</p>
                        {m.trainerName && (
                          <p className="text-[11px] text-slate-500">Trainer: {m.trainerName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[11px] text-slate-600">
                        <p>Start: {m.startDate}</p>
                        <p>Expiry: {m.expiryDate}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold capitalize ${
                            eff === 'active'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : eff === 'expired'
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {eff}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-amber-700">
                        {formatPKR(m.pendingAmount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={formatWhatsAppReminderUrl(
                              m.phone,
                              `Hello ${m.name}, reminder from ${shop?.name || 'Gym'}: Your plan (${m.planName}) expires on ${m.expiryDate}.`
                            )}
                            target="_blank"
                            rel="noreferrer"
                            title="WhatsApp Expiry Reminder"
                            className="p-1.5 border border-emerald-200 text-emerald-700 rounded-lg"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                          {!isReadOnly && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRenew(m)}
                                title="Renew Membership"
                                className="px-2 py-1 bg-[#065F46] text-white rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3" /> Renew
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  freezeGymMembership(shopId, m.id, eff !== 'frozen').then(load)
                                }
                                title={eff === 'frozen' ? 'Unfreeze' : 'Freeze Membership'}
                                className="p-1.5 border border-slate-200 text-slate-700 rounded-lg"
                              >
                                {eff === 'frozen' ? (
                                  <PlayCircle className="w-3.5 h-3.5" />
                                ) : (
                                  <PauseCircle className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelGymMembership(shopId, m.id).then(load)}
                                title="Cancel Membership"
                                className="p-1.5 border border-red-200 text-red-600 rounded-lg"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
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

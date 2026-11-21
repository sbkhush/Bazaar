import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  UsersRound,
  Target,
  ClipboardList,
  Award,
  Gift,
  Download,
  Loader2,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  assignLeadWithinManagerTeam,
  getBonusRecommendationsForManager,
  getSalesActivitiesForTeam,
  getSalesLeadsForManager,
  getSalesMembersForManager,
  getSalesTargetsForTeam,
  submitBonusRecommendation,
} from '../services/salesService';
import { downloadCsvFile } from '../utils/csvUtils';
import { formatPKR } from '../data/seedData';
import { useToast } from '../components/common/Toast';
import {
  SalesActivity,
  SalesBonusRecommendation,
  SalesLead,
  SalesMember,
  SalesTarget,
} from '../types';

type ManagerSection = 'overview' | 'team' | 'leads' | 'activities' | 'targets' | 'reports' | 'bonuses';

export const SalesManagerDashboardPage: React.FC = () => {
  const { currentUser, salesMember } = useAuth();
  const { showToast } = useToast();
  const { pathname } = useLocation();

  const section: ManagerSection = useMemo(() => {
    if (pathname.endsWith('/team')) return 'team';
    if (pathname.endsWith('/leads')) return 'leads';
    if (pathname.endsWith('/activities')) return 'activities';
    if (pathname.endsWith('/targets')) return 'targets';
    if (pathname.endsWith('/reports')) return 'reports';
    if (pathname.endsWith('/bonuses')) return 'bonuses';
    return 'overview';
  }, [pathname]);

  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<SalesMember[]>([]);
  const [teamLeads, setTeamLeads] = useState<SalesLead[]>([]);
  const [teamActivities, setTeamActivities] = useState<SalesActivity[]>([]);
  const [teamTargets, setTeamTargets] = useState<SalesTarget[]>([]);
  const [recommendations, setRecommendations] = useState<SalesBonusRecommendation[]>([]);

  const [assignLeadId, setAssignLeadId] = useState('');
  const [assignMemberId, setAssignMemberId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [bonusForm, setBonusForm] = useState({
    salesmanId: '',
    recommendedAmount: '3000',
    periodKey: new Date().toISOString().slice(0, 7),
    reason: '',
  });
  const [submittingBonus, setSubmittingBonus] = useState(false);

  const loadData = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      const uid = currentUser.uid;
      const [members, leads, recs] = await Promise.all([
        getSalesMembersForManager(uid),
        getSalesLeadsForManager(uid, true),
        getBonusRecommendationsForManager(uid),
      ]);
      const strictlyMyTeam = members.filter((m) => m.assignedManagerUid === uid && m.uid !== uid);
      setTeamMembers(strictlyMyTeam);
      setTeamLeads(leads.filter((l) => l.assignedManagerUid === uid));
      setRecommendations(recs);

      const repUids = strictlyMyTeam.map((m) => m.uid).filter((x): x is string => Boolean(x));
      const [acts, tgts] = await Promise.all([
        getSalesActivitiesForTeam(repUids),
        getSalesTargetsForTeam(strictlyMyTeam),
      ]);
      setTeamActivities(acts);
      setTeamTargets(tgts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  if (!currentUser || !salesMember) return null;

  const teamStats = useMemo(() => {
    const converted = teamLeads.filter((l) => l.status === 'Converted').length;
    const followUps = teamLeads.filter((l) => l.status === 'Follow-up Required').length;
    const conversionRate = teamLeads.length > 0 ? Math.round((converted / teamLeads.length) * 100) : 0;
    const totalTarget = teamMembers.reduce((s, m) => s + Number(m.monthlyTarget || 0), 0);
    return {
      membersCount: teamMembers.length,
      activeReps: teamMembers.filter((m) => m.accountStatus === 'active').length,
      totalLeads: teamLeads.length,
      converted,
      followUps,
      conversionRate,
      activitiesCount: teamActivities.length,
      totalTarget,
    };
  }, [teamMembers, teamLeads, teamActivities]);

  const handleAssignLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetRep = teamMembers.find((m) => m.id === assignMemberId);
    if (!assignLeadId || !targetRep) {
      showToast('Select both a team lead and an authorized team representative.', 'error');
      return;
    }
    setAssigning(true);
    try {
      await assignLeadWithinManagerTeam({
        leadIds: [assignLeadId],
        targetSalesman: targetRep,
        managerUid: currentUser.uid,
      });
      showToast(`Lead assigned within your team to ${targetRep.fullName}.`, 'success');
      setAssignLeadId('');
      setAssignMemberId('');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Team lead assignment blocked.', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleBonusRecommend = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetRep = teamMembers.find((m) => m.id === bonusForm.salesmanId);
    if (!targetRep) {
      showToast('Select an assigned representative from your team.', 'error');
      return;
    }
    setSubmittingBonus(true);
    try {
      await submitBonusRecommendation({
        managerId: salesMember.id,
        managerUid: currentUser.uid,
        managerName: salesMember.fullName,
        targetRep,
        recommendedAmount: Number(bonusForm.recommendedAmount),
        periodKey: bonusForm.periodKey,
        reason: bonusForm.reason,
      });
      showToast('Performance bonus recommendation submitted for Super Admin approval.', 'success');
      setBonusForm({ ...bonusForm, salesmanId: '', reason: '' });
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Bonus recommendation failed.', 'error');
    } finally {
      setSubmittingBonus(false);
    }
  };

  const handleExportTeamReport = () => {
    downloadCsvFile(
      `team-performance-${salesMember.employeeId}.csv`,
      ['Employee ID', 'Representative', 'City', 'Territory', 'Monthly Target', 'Assigned Leads', 'Converted Leads', 'Activities'],
      teamMembers.map((m) => {
        const repLeads = teamLeads.filter((l) => l.assignedSalesmanId === m.id);
        const repActs = teamActivities.filter((a) => a.salesmanId === m.id || a.salesmanUid === m.uid);
        return [
          m.employeeId,
          m.fullName,
          m.city,
          m.territory,
          m.monthlyTarget,
          repLeads.length,
          repLeads.filter((l) => l.status === 'Converted').length,
          repActs.length,
        ];
      })
    );
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(section === 'overview' || section === 'reports') && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                {section === 'reports' ? 'Authorized Team Reports' : `Welcome, ${salesMember.fullName}`}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Scoped regional leadership view · Territory: {salesMember.territory || salesMember.city}
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportTeamReport}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export Team CSV
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-slate-500 font-semibold">Team Representatives</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{teamStats.membersCount}</p>
              <p className="text-[11px] text-emerald-700 mt-1">{teamStats.activeReps} Active</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-slate-500 font-semibold">Team Leads</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{teamStats.totalLeads}</p>
              <p className="text-[11px] text-amber-700 mt-1">{teamStats.followUps} Follow-ups</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-slate-500 font-semibold">Lead Conversion Rate</p>
              <p className="text-2xl font-extrabold text-[#065F46] mt-1">{teamStats.conversionRate}%</p>
              <p className="text-[11px] text-slate-500 mt-1">{teamStats.converted} Converted</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-slate-500 font-semibold">Combined Monthly Quota</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{formatPKR(teamStats.totalTarget)}</p>
              <p className="text-[11px] text-slate-500 mt-1">{teamStats.activitiesCount} Logged activities</p>
            </div>
          </div>
        </div>
      )}

      {(section === 'overview' || section === 'team' || section === 'reports') && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <UsersRound className="w-4 h-4 text-[#065F46]" /> Assigned Sales Team ({teamMembers.length})
            </h3>
          </div>
          {teamMembers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No sales representatives have been assigned to your manager profile yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Representative</th>
                    <th className="px-4 py-3">Role &amp; City</th>
                    <th className="px-4 py-3">Monthly Target</th>
                    <th className="px-4 py-3">Team Leads</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamMembers.map((m) => {
                    const mLeads = teamLeads.filter((l) => l.assignedSalesmanId === m.id);
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{m.fullName}</p>
                          <p className="text-[11px] text-slate-500">{m.employeeId} · {m.email}</p>
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {m.role.replace('_', ' ')} · {m.city}
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums">{formatPKR(m.monthlyTarget)}</td>
                        <td className="px-4 py-3 font-bold">
                          {mLeads.length} ({mLeads.filter((l) => l.status === 'Converted').length} converted)
                        </td>
                        <td className="px-4 py-3 capitalize">{m.accountStatus}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {section === 'leads' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-[#065F46]" /> Assign Lead Within Authorized Team
            </h2>
            <form onSubmit={handleAssignLead} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <select
                required
                value={assignLeadId}
                onChange={(e) => setAssignLeadId(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl bg-white"
              >
                <option value="">Select team lead...</option>
                {teamLeads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.businessName} ({l.city}) — {l.assignedSalesmanName || 'Unassigned'}
                  </option>
                ))}
              </select>
              <select
                required
                value={assignMemberId}
                onChange={(e) => setAssignMemberId(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl bg-white"
              >
                <option value="">Select team member...</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.city})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={assigning}
                className="py-2.5 px-4 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl font-bold inline-flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                {assigning ? 'Assigning...' : 'Assign Within Team'}
              </button>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 font-extrabold text-sm text-slate-900">
              Team CRM Pipeline ({teamLeads.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Business</th>
                    <th className="px-4 py-3">Assigned Rep</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamLeads.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{l.businessName}</p>
                        <p className="text-[11px] text-slate-500">{l.ownerName} · {l.phone}</p>
                      </td>
                      <td className="px-4 py-3">{l.assignedSalesmanName || 'Unassigned'}</td>
                      <td className="px-4 py-3">{l.city}</td>
                      <td className="px-4 py-3 font-semibold">{l.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {section === 'activities' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#065F46]" /> Assigned Team Activity Stream ({teamActivities.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {teamActivities.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">No activities recorded by your team yet.</p>
            ) : (
              teamActivities.map((a) => (
                <div key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">
                      {a.salesmanName} · <span className="text-[#065F46]">{a.activityType}</span>
                    </p>
                    <p className="text-slate-600 mt-0.5">{a.notes}</p>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(a.activityDateTime).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {section === 'targets' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#065F46]" /> Team Quota Targets ({teamTargets.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rep</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Revenue Quota</th>
                  <th className="px-4 py-3">Shop Registrations</th>
                  <th className="px-4 py-3">Bonus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamTargets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No custom team targets set yet.
                    </td>
                  </tr>
                ) : (
                  teamTargets.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3 font-bold text-slate-900">{t.salesmanName}</td>
                      <td className="px-4 py-3">{t.periodKey}</td>
                      <td className="px-4 py-3 font-semibold">{formatPKR(t.revenueTarget)}</td>
                      <td className="px-4 py-3">{t.monthlyRegistrationTarget} shops</td>
                      <td className="px-4 py-3 text-emerald-700 font-bold">{formatPKR(t.bonusAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'bonuses' && (
        <div className="space-y-6">
          <form onSubmit={handleBonusRecommend} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#065F46]" /> Recommend Performance Bonus
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">
                Managers can recommend bonuses strictly for reps on their team. Final approval &amp; payout settlement are controlled exclusively by Super Admin.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                required
                value={bonusForm.salesmanId}
                onChange={(e) => setBonusForm({ ...bonusForm, salesmanId: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-xl bg-white"
              >
                <option value="">Select team representative *</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.employeeId})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="100"
                required
                placeholder="Bonus Amount (PKR) *"
                value={bonusForm.recommendedAmount}
                onChange={(e) => setBonusForm({ ...bonusForm, recommendedAmount: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-xl"
              />
              <input
                type="month"
                required
                value={bonusForm.periodKey}
                onChange={(e) => setBonusForm({ ...bonusForm, periodKey: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <textarea
              required
              minLength={5}
              rows={2}
              placeholder="Performance justification (converted shops, target overachievement, etc.) *"
              value={bonusForm.reason}
              onChange={(e) => setBonusForm({ ...bonusForm, reason: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
            <button
              type="submit"
              disabled={submittingBonus}
              className="px-5 py-2.5 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl font-bold inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submittingBonus ? 'Submitting...' : 'Submit Recommendation for Super Admin Review'}
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 font-extrabold text-sm text-slate-900">
              Submitted Recommendations ({recommendations.length})
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {recommendations.length === 0 ? (
                <p className="p-8 text-center text-slate-500">No bonus recommendations submitted yet.</p>
              ) : (
                recommendations.map((r) => (
                  <div key={r.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">
                        {r.salesmanName} · {formatPKR(r.recommendedAmount)} ({r.periodKey})
                      </p>
                      <p className="text-slate-600 mt-0.5">{r.reason}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${
                        r.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : r.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Target,
  Share2,
  Coins,
  Wallet,
  Award,
  ClipboardList,
  QrCode,
  Bell,
  UsersRound,
  Plus,
  Copy,
  Check,
  Download,
  Printer,
  Store,
  Loader2,
  CheckCheck,
  FileDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  ALL_ACTIVITY_TYPES,
  ALL_LEAD_STATUSES,
  createSalesLead,
  getCommissionsForSalesman,
  getPayoutsForSalesman,
  getReferralsForSalesman,
  getSalesActivitiesBySalesman,
  getSalesExpensesForMember,
  getSalesLeadsForSalesman,
  getSalesNotifications,
  getSalesTargetsForMember,
  getApprovedSalesMaterials,
  markAllSalesNotificationsRead,
  markSalesNotificationRead,
  recordSalesActivity,
  submitSalesExpense,
  updateSalesLead,
  updateSalesMember,
} from '../services/salesService';
import { formatPKR } from '../data/seedData';
import {
  downloadPayoutStatementPdf,
  downloadSalesmanQrPdf,
  downloadSalesmanQrPng,
  generateQrDataUrl,
} from '../utils/qrPdfUtils';
import { useToast } from '../components/common/Toast';
import {
  BusinessType,
  CommissionLedgerEntry,
  CommissionPayout,
  PayoutMethod,
  ReferralAttribution,
  SalesActivity,
  SalesExpense,
  SalesLead,
  SalesLeadStatus,
  SalesMaterial,
  SalesNotification,
  SalesTarget,
} from '../types';

type PortalSection =
  | 'overview'
  | 'leads'
  | 'referrals'
  | 'targets'
  | 'commissions'
  | 'payouts'
  | 'expenses'
  | 'materials'
  | 'activities'
  | 'qr'
  | 'notifications';

export const SalesmanDashboardPage: React.FC = () => {
  const { currentUser, salesMember, refreshSalesMember } = useAuth();
  const { showToast } = useToast();
  const { pathname } = useLocation();

  const section: PortalSection = useMemo(() => {
    if (pathname.endsWith('/leads')) return 'leads';
    if (pathname.endsWith('/referrals')) return 'referrals';
    if (pathname.endsWith('/targets')) return 'targets';
    if (pathname.endsWith('/commissions')) return 'commissions';
    if (pathname.endsWith('/payouts')) return 'payouts';
    if (pathname.endsWith('/expenses')) return 'expenses';
    if (pathname.endsWith('/materials')) return 'materials';
    if (pathname.endsWith('/activities')) return 'activities';
    if (pathname.endsWith('/qr')) return 'qr';
    if (pathname.endsWith('/notifications')) return 'notifications';
    return 'overview';
  }, [pathname]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [referrals, setReferrals] = useState<ReferralAttribution[]>([]);
  const [commissions, setCommissions] = useState<CommissionLedgerEntry[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [notifications, setNotifications] = useState<SalesNotification[]>([]);
  const [expenses, setExpenses] = useState<SalesExpense[]>([]);
  const [materials, setMaterials] = useState<SalesMaterial[]>([]);
  const [expenseForm, setExpenseForm] = useState({
    category: 'travel' as SalesExpense['category'],
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    description: '',
    receiptUrl: '',
  });
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Modals & forms
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    city: salesMember?.city || 'Karachi',
    industry: 'general_store' as BusinessType,
    nextFollowUpDate: '',
    notes: '',
  });

  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({
    leadId: '',
    leadName: '',
    activityType: 'Business visit' as SalesActivity['activityType'],
    activityDateTime: new Date().toISOString().slice(0, 16),
    resultStatus: 'positive' as SalesActivity['resultStatus'],
    nextFollowUpDate: '',
    notes: '',
  });

  // Payout account preferences (editable by salesman; payout records remain strictly read-only)
  const [payoutPref, setPayoutPref] = useState({
    preferredMethod: (salesMember?.payoutDetails?.preferredMethod || 'bank_transfer') as PayoutMethod,
    accountTitle: salesMember?.payoutDetails?.accountTitle || salesMember?.fullName || '',
    accountNumber: salesMember?.payoutDetails?.accountNumber || '',
    bankName: salesMember?.payoutDetails?.bankName || '',
  });

  const loadData = async () => {
    if (!currentUser?.uid || !salesMember?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const uid = currentUser.uid;
      const mid = salesMember.id;
      const [l, r, c, p, a, t, n, ex, mats] = await Promise.all([
        getSalesLeadsForSalesman(mid, uid),
        getReferralsForSalesman(mid, uid),
        getCommissionsForSalesman(mid, uid),
        getPayoutsForSalesman(mid, uid),
        getSalesActivitiesBySalesman(mid, uid),
        getSalesTargetsForMember(mid, uid),
        getSalesNotifications(mid, uid),
        getSalesExpensesForMember(uid),
        getApprovedSalesMaterials(),
      ]);
      setLeads(l);
      setReferrals(r);
      setCommissions(c);
      setPayouts(p);
      setActivities(a);
      setTargets(t);
      setNotifications(n);
      setExpenses(ex);
      setMaterials(mats.filter((m) => m.audience === 'all_sales' || m.audience === 'salesmen_only'));

      if (salesMember.referralLink) {
        const url = await generateQrDataUrl(salesMember.referralLink, 480);
        setQrDataUrl(url);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load sales representative workspace data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid, salesMember?.id]);

  const stats = useMemo(() => {
    const validRefs = referrals.filter((r) => r.attributionStatus !== 'rejected_self_referral');
    const paidRefs = validRefs.filter((r) => r.attributionStatus === 'subscribed');
    const totalRevenue = validRefs.reduce((s, r) => s + Number(r.totalRevenueGenerated || 0), 0);
    const pendingComm = commissions
      .filter((c) => c.status === 'pending' || c.status === 'approved')
      .reduce((s, c) => s + Number(c.commissionAmount || 0), 0);
    const approvedReady = commissions
      .filter((c) => c.status === 'approved')
      .reduce((s, c) => s + Number(c.commissionAmount || 0), 0);
    const paidOut = commissions
      .filter((c) => c.status === 'paid')
      .reduce((s, c) => s + Number(c.commissionAmount || 0), 0);
    const monthlyTarget = salesMember?.monthlyTarget || 0;
    const targetPct =
      monthlyTarget > 0
        ? Math.min(200, Math.round((totalRevenue / monthlyTarget) * 100))
        : 0;
    return {
      totalLeads: leads.length,
      convertedLeads: leads.filter((l) => l.status === 'Converted').length,
      referredShops: validRefs.length,
      paidSubscriptions: paidRefs.length,
      totalRevenue,
      pendingComm,
      approvedReady,
      paidOut,
      targetPct,
    };
  }, [leads, referrals, commissions, salesMember?.monthlyTarget]);

  if (!salesMember || !currentUser) return null;

  const handleCopyRef = async () => {
    await navigator.clipboard?.writeText(salesMember.referralLink).catch(() => {});
    setCopied(true);
    showToast('Referral link copied.', 'success');
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSalesLead(
        {
          businessName: leadForm.businessName,
          ownerName: leadForm.ownerName,
          phone: leadForm.phone,
          email: leadForm.email || undefined,
          city: leadForm.city,
          industry: leadForm.industry,
          assignedSalesmanId: salesMember.id,
          assignedSalesmanUid: currentUser.uid,
          assignedSalesmanName: salesMember.fullName,
          assignedManagerId: salesMember.assignedManagerId,
          assignedManagerUid: salesMember.assignedManagerUid,
          leadSource: 'field_visit',
          nextFollowUpDate: leadForm.nextFollowUpDate || undefined,
          notes: leadForm.notes || undefined,
          status: 'Assigned',
        },
        leads
      );
      showToast('Lead added to your pipeline.', 'success');
      setLeadModalOpen(false);
      setLeadForm({
        businessName: '',
        ownerName: '',
        phone: '',
        email: '',
        city: salesMember.city,
        industry: 'general_store',
        nextFollowUpDate: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Unable to create lead.', 'error');
    }
  };

  const handleLeadStatusChange = async (leadId: string, status: SalesLeadStatus) => {
    try {
      await updateSalesLead(leadId, { status });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
      showToast(`Lead marked as ${status}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update lead status.', 'error');
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordSalesActivity({
        salesmanId: salesMember.id,
        salesmanUid: currentUser.uid,
        salesmanName: salesMember.fullName,
        leadId: activityForm.leadId || undefined,
        leadName: activityForm.leadName || undefined,
        activityType: activityForm.activityType,
        activityDateTime: new Date(activityForm.activityDateTime).toISOString(),
        resultStatus: activityForm.resultStatus,
        nextFollowUpDate: activityForm.nextFollowUpDate || undefined,
        notes: activityForm.notes,
      });
      showToast('Sales activity recorded.', 'success');
      setActivityModalOpen(false);
      setActivityForm({
        leadId: '',
        leadName: '',
        activityType: 'Business visit',
        activityDateTime: new Date().toISOString().slice(0, 16),
        resultStatus: 'positive',
        nextFollowUpDate: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Unable to record activity.', 'error');
    }
  };

  const handleSavePayoutPref = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSalesMember(salesMember.id, { payoutDetails: payoutPref });
      await refreshSalesMember();
      showToast('Preferred payout account saved.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not update payout account details.', 'error');
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expenseForm.amount);
    if (!Number.isFinite(amt) || amt <= 0 || !expenseForm.description.trim()) {
      showToast('Enter a valid expense amount and description.', 'error');
      return;
    }
    setSubmittingExpense(true);
    try {
      await submitSalesExpense({
        salesmanId: salesMember.id,
        salesmanUid: currentUser.uid,
        salesmanName: salesMember.fullName,
        managerUid: salesMember.assignedManagerUid,
        category: expenseForm.category,
        amount: amt,
        expenseDate: expenseForm.expenseDate,
        description: expenseForm.description,
        receiptUrl: expenseForm.receiptUrl.trim() || undefined,
      });
      showToast('Expense claim submitted as pending Super Admin approval.', 'success');
      setExpenseForm({
        category: 'travel',
        amount: '',
        expenseDate: new Date().toISOString().slice(0, 10),
        description: '',
        receiptUrl: '',
      });
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Unable to submit expense.', 'error');
    } finally {
      setSubmittingExpense(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-3">
        <p className="text-sm font-bold text-rose-700">{loadError}</p>
        <button
          type="button"
          onClick={loadData}
          className="px-4 py-2 rounded-xl bg-[#065F46] text-white text-xs font-bold hover:bg-emerald-900"
        >
          Retry Loading Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* OVERVIEW */}
      {section === 'overview' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Welcome, {salesMember.fullName}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Territory: {salesMember.territory} ({salesMember.city}) · Commission Tier: {salesMember.commissionPlanName}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLeadModalOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Lead
              </button>
              <button
                type="button"
                onClick={() => setActivityModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <ClipboardList className="w-3.5 h-3.5" /> Log Visit / Call
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'My Assigned Leads', value: stats.totalLeads, sub: `${stats.convertedLeads} converted`, icon: Target },
              { label: 'Referred Shops', value: stats.referredShops, sub: `${stats.paidSubscriptions} paid subscriptions`, icon: Share2 },
              { label: 'Sales Revenue', value: formatPKR(stats.totalRevenue), sub: `${stats.targetPct}% of monthly target`, icon: Award },
              { label: 'Commission Earned', value: formatPKR(stats.paidOut + stats.pendingComm), sub: `${formatPKR(stats.approvedReady)} ready for payout`, icon: Coins },
            ].map((card) => (
              <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wide">{card.label}</span>
                  <card.icon className="w-4 h-4 text-[#065F46]" />
                </div>
                <p className="text-xl font-extrabold text-slate-900 tabular-nums">{card.value}</p>
                <p className="text-[11px] text-slate-500">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Monthly Target Progress</h3>
                <span className="text-xs font-bold text-[#065F46] tabular-nums">
                  {formatPKR(stats.totalRevenue)} / {formatPKR(salesMember.monthlyTarget)}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-[#065F46] rounded-full transition-all"
                  style={{ width: `${Math.min(100, stats.targetPct)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Achieving 100% unlocks tier performance bonuses. Base salary is never penalized.
              </p>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-xs font-extrabold text-slate-800">Recent Follow-up Leads</p>
                {leads.slice(0, 4).map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="font-bold text-slate-900">{l.businessName}</p>
                      <p className="text-[11px] text-slate-500">{l.ownerName} · {l.phone} · {l.city}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                      {l.status}
                    </span>
                  </div>
                ))}
                {leads.length === 0 && (
                  <p className="text-xs text-slate-500">No leads assigned yet. Click Add Lead to start prospecting.</p>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
              <h3 className="text-sm font-extrabold text-slate-900">My Referral Link & QR</h3>
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="Personal Referral QR" className="w-24 h-24 rounded-lg bg-white border border-slate-200" />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="font-mono text-sm font-extrabold text-[#065F46]">{salesMember.referralCode}</p>
                  <p className="text-[11px] text-slate-500 truncate">{salesMember.referralLink}</p>
                  <button
                    type="button"
                    onClick={handleCopyRef}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-bold inline-flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#065F46]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy Link'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => downloadSalesmanQrPng(salesMember)}
                  className="py-2 rounded-xl border border-slate-200 font-semibold flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download PNG
                </button>
                <button
                  type="button"
                  onClick={() => downloadSalesmanQrPdf(salesMember)}
                  className="py-2 rounded-xl bg-[#065F46] text-white font-bold flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print PDF Card
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* LEADS */}
      {section === 'leads' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">My Assigned Leads ({leads.length})</h2>
              <p className="text-xs text-slate-500">Update follow-up statuses, log calls/visits, or launch assisted shop registration.</p>
            </div>
            <button
              type="button"
              onClick={() => setLeadModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#065F46] text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Lead
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {leads.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">No leads assigned yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Business & Owner</th>
                      <th className="px-4 py-3">Contact & City</th>
                      <th className="px-4 py-3">Follow-Up</th>
                      <th className="px-4 py-3">Pipeline Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{l.businessName}</p>
                          <p className="text-[11px] text-slate-500">{l.ownerName} · {l.industry.replace('_', ' ')}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-slate-800">{l.phone}</p>
                          <p className="text-[11px] text-slate-500">{l.city}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{l.nextFollowUpDate || 'Not set'}</td>
                        <td className="px-4 py-3">
                          <select
                            value={l.status}
                            onChange={(e) => handleLeadStatusChange(l.id, e.target.value as SalesLeadStatus)}
                            className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-xs font-semibold"
                          >
                            {ALL_LEAD_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setActivityForm((prev) => ({
                                ...prev,
                                leadId: l.id,
                                leadName: l.businessName,
                              }));
                              setActivityModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 font-semibold"
                          >
                            Log Activity
                          </button>
                          <Link
                            to={`/register?ref=${encodeURIComponent(salesMember.referralCode)}&leadId=${encodeURIComponent(l.id)}`}
                            className="px-2.5 py-1 rounded-lg bg-[#065F46] text-white font-bold inline-flex items-center gap-1"
                          >
                            <Store className="w-3 h-3" /> Assist Signup
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REFERRALS */}
      {section === 'referrals' && (
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold text-slate-900">My Referred Shops ({referrals.length})</h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {referrals.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Share your referral link or QR code to onboard merchants automatically under your attribution.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Shop</th>
                      <th className="px-4 py-3">City & Source</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Verified Revenue</th>
                      <th className="px-4 py-3">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {referrals.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-bold text-slate-900">{r.shopName}</td>
                        <td className="px-4 py-3 text-slate-600">{r.city || '-'} · {r.source.replace('_', ' ')}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#065F46] font-bold capitalize">
                            {r.attributionStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 tabular-nums">
                          {formatPKR(r.totalRevenueGenerated)}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TARGETS */}
      {section === 'targets' && (
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold text-slate-900">My Sales Targets & Bonuses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
              <p className="text-[11px] uppercase font-bold text-slate-400">Standing Profile Quotas</p>
              <p className="text-lg font-extrabold text-slate-900">
                Monthly Revenue Target: {formatPKR(salesMember.monthlyTarget)}
              </p>
              <p className="text-slate-600">Yearly Target: {formatPKR(salesMember.yearlyTarget)}</p>
              <p className="text-slate-600">Current Attainment: <strong className="text-[#065F46]">{stats.targetPct}%</strong></p>
            </div>
            {targets.map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">{t.periodKey}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#065F46] font-bold">
                    Bonus: {formatPKR(t.bonusAmount)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                  <span>Daily Activities: <strong>{t.dailyActivityTarget}</strong></span>
                  <span>Weekly Leads: <strong>{t.weeklyLeadTarget}</strong></span>
                  <span>Monthly Regs: <strong>{t.monthlyRegistrationTarget}</strong></span>
                  <span>Paid Subs: <strong>{t.monthlyPaidSubscriptionTarget}</strong></span>
                  <span>Revenue Goal: <strong>{formatPKR(t.revenueTarget)}</strong></span>
                  <span>Bonus Threshold: <strong>{t.bonusThresholdPct}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMMISSIONS (STRICT READ-ONLY) */}
      {section === 'commissions' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">My Commissions (Read-Only)</h2>
            <p className="text-xs text-slate-500 mt-1">
              Commissions are automatically calculated from Super Admin verified subscription payments. Pending/Approved/Paid amounts are locked for financial integrity.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {commissions.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">No commissions recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Shop</th>
                      <th className="px-4 py-3">Plan & Payment</th>
                      <th className="px-4 py-3">Rate + Bonus</th>
                      <th className="px-4 py-3">Commission</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {commissions.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-bold text-slate-900">{c.shopName}</td>
                        <td className="px-4 py-3">
                          {c.planName} ({c.billingCycle}) · {formatPKR(c.paymentAmount)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {c.commissionRatePct}% {c.flatBonusAmount > 0 ? `+ ${formatPKR(c.flatBonusAmount)}` : ''}
                        </td>
                        <td className="px-4 py-3 font-extrabold text-[#065F46] tabular-nums">
                          {formatPKR(c.commissionAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold capitalize">
                            {c.status}
                          </span>
                          {(c.rejectionReason || c.reversalReason) && (
                            <p className="text-[10px] text-rose-600 mt-1">{c.rejectionReason || c.reversalReason}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYOUTS (READ-ONLY STATEMENTS + OWN ACCOUNT PREFERENCE) */}
      {section === 'payouts' && (
        <div className="space-y-6">
          <h2 className="text-xl font-extrabold text-slate-900">My Payouts & Account Details</h2>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSavePayoutPref}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs"
            >
              <h3 className="text-sm font-extrabold text-slate-900">Preferred Payout Account</h3>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Method</label>
                <select
                  value={payoutPref.preferredMethod}
                  onChange={(e) => setPayoutPref({ ...payoutPref, preferredMethod: e.target.value as PayoutMethod })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="jazzcash">JazzCash</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Title</label>
                <input
                  required
                  value={payoutPref.accountTitle}
                  onChange={(e) => setPayoutPref({ ...payoutPref, accountTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Account / Wallet Number</label>
                <input
                  required
                  value={payoutPref.accountNumber}
                  onChange={(e) => setPayoutPref({ ...payoutPref, accountNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              {payoutPref.preferredMethod === 'bank_transfer' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                  <input
                    value={payoutPref.bankName}
                    onChange={(e) => setPayoutPref({ ...payoutPref, bankName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              )}
              <button type="submit" className="w-full py-2 rounded-xl bg-[#065F46] text-white font-bold">
                Save Payout Account
              </button>
            </form>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Disbursed Payout History</h3>
              </div>
              {payouts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No payouts processed yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Statement #</th>
                        <th className="px-4 py-3">Method & TID</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3 text-right">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payouts.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">{p.payoutNumber}</td>
                          <td className="px-4 py-3">
                            {p.method.toUpperCase()} · {p.transactionReference}
                          </td>
                          <td className="px-4 py-3 font-extrabold text-[#065F46] tabular-nums">
                            {formatPKR(p.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => downloadPayoutStatementPdf(p)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 font-semibold inline-flex items-center gap-1"
                            >
                              <FileDown className="w-3.5 h-3.5" /> PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITIES */}
      {section === 'activities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">My Sales Activities ({activities.length})</h2>
              <p className="text-xs text-slate-500">Log business visits, calls, WhatsApp follow-ups, demos, and registration help.</p>
            </div>
            <button
              type="button"
              onClick={() => setActivityModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#065F46] text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Log Activity
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {activities.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">No activities logged yet.</div>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#065F46] font-bold">
                        {a.activityType}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold capitalize">
                        {a.resultStatus.replace('_', ' ')}
                      </span>
                      {a.leadName && <span className="font-bold text-slate-800">{a.leadName}</span>}
                    </div>
                    <p className="text-slate-600 mt-1">{a.notes}</p>
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

      {/* QR & REFERRAL CARD */}
      {section === 'qr' && (
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-[#065F46] text-xs font-bold">
            <QrCode className="w-4 h-4" /> Official Representative Onboarding Card
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">{salesMember.fullName}</h2>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="My QR Code"
              className="w-56 h-56 mx-auto rounded-2xl border border-slate-200 p-2 bg-white"
            />
          )}
          <div className="space-y-1">
            <p className="font-mono text-lg font-extrabold text-[#065F46]">{salesMember.referralCode}</p>
            <p className="text-xs text-slate-500 break-all">{salesMember.referralLink}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-2">
            <button
              type="button"
              onClick={handleCopyRef}
              className="py-2.5 rounded-xl border border-slate-200 font-bold flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-[#065F46]" /> : <Copy className="w-4 h-4" />}
              Copy Link
            </button>
            <button
              type="button"
              onClick={() => downloadSalesmanQrPng(salesMember)}
              className="py-2.5 rounded-xl border border-slate-200 font-bold flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Save PNG
            </button>
            <button
              type="button"
              onClick={() => downloadSalesmanQrPdf(salesMember)}
              className="py-2.5 rounded-xl bg-[#065F46] text-white font-bold flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> A5 PDF Card
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {section === 'notifications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-slate-900">Notifications ({notifications.length})</h2>
            <button
              type="button"
              onClick={async () => {
                await markAllSalesNotificationsRead(notifications);
                setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={async () => {
                    if (!n.isRead) {
                      await markSalesNotificationRead(n.id);
                      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
                    }
                  }}
                  className={`p-4 flex items-center justify-between gap-3 text-xs cursor-pointer ${
                    n.isRead ? 'opacity-75' : 'bg-emerald-50/40'
                  }`}
                >
                  <div>
                    <p className="font-bold text-slate-900">{n.title}</p>
                    <p className="text-slate-600 mt-0.5">{n.message}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* BUSINESS EXPENSES (PENDING SUPER ADMIN APPROVAL; NO SELF-APPROVAL) */}
      {section === 'expenses' && (
        <div className="space-y-6">
          <form onSubmit={handleSubmitExpense} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Submit Field Business Expense</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                All expense claims start as pending and require independent Super Admin approval.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as SalesExpense['category'] })}
                className="px-3 py-2 border border-slate-200 rounded-xl bg-white"
              >
                <option value="travel">Travel &amp; Conveyance</option>
                <option value="fuel">Fuel Allowance</option>
                <option value="meals">Client Meals</option>
                <option value="internet_calls">Mobile / Data Package</option>
                <option value="client_demo">Client Demo Supplies</option>
                <option value="other">Other Authorized Expense</option>
              </select>
              <input
                type="number"
                min="1"
                required
                placeholder="Amount (PKR) *"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-xl"
              />
              <input
                type="date"
                required
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <input
              type="text"
              required
              placeholder="Expense description & shop visit purpose *"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
            <button
              type="submit"
              disabled={submittingExpense}
              className="px-5 py-2.5 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl font-bold"
            >
              {submittingExpense ? 'Submitting...' : 'Submit Expense Claim'}
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 font-extrabold text-sm text-slate-900">
              My Expense Claims ({expenses.length})
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {expenses.length === 0 ? (
                <p className="p-8 text-center text-slate-500">No expense claims submitted yet.</p>
              ) : (
                expenses.map((ex) => (
                  <div key={ex.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900 capitalize">
                        {ex.category.replace('_', ' ')} · {formatPKR(ex.amount)}
                      </p>
                      <p className="text-slate-600 mt-0.5">{ex.description} ({ex.expenseDate})</p>
                      {ex.rejectionReason && (
                        <p className="text-rose-700 text-[11px] mt-0.5">Reason: {ex.rejectionReason}</p>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${
                        ex.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : ex.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {ex.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* APPROVED SALES MATERIALS */}
      {section === 'materials' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Approved Sales Materials</h2>
            <p className="text-xs text-slate-500 mt-1">
              Official merchant pitch decks, pricing sheets, and onboarding brochures approved by Super Admin.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {materials.length === 0 ? (
              <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
                No sales collateral uploaded by Super Admin yet.
              </div>
            ) : (
              materials.map((m) => (
                <div key={m.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-3">
                  <div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#065F46] text-[10px] font-bold uppercase">
                      {m.category.replace('_', ' ')}
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900 mt-2">{m.title}</h3>
                    <p className="text-slate-600 mt-1 leading-relaxed">{m.description}</p>
                  </div>
                  {m.fileUrl && (
                    <a
                      href={m.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#065F46] hover:underline"
                    >
                      <FileDown className="w-4 h-4" /> Open / Download Resource
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ADD LEAD MODAL */}
      {leadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateLead} className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-3 text-xs">
            <h3 className="text-base font-extrabold text-slate-900">Add Field Sales Lead</h3>
            <input
              required
              placeholder="Business / Shop Name *"
              value={leadForm.businessName}
              onChange={(e) => setLeadForm({ ...leadForm, businessName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
            <input
              required
              placeholder="Owner Name *"
              value={leadForm.ownerName}
              onChange={(e) => setLeadForm({ ...leadForm, ownerName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <input
                required
                placeholder="Phone (03xx...) *"
                value={leadForm.phone}
                onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
              />
              <input
                required
                placeholder="City *"
                value={leadForm.city}
                onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={leadForm.industry}
                onChange={(e) => setLeadForm({ ...leadForm, industry: e.target.value as BusinessType })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
              >
                <option value="general_store">General Store</option>
                <option value="cosmetics">Cosmetics</option>
                <option value="clothing">Clothing</option>
                <option value="other_retail">Other Retail</option>
              </select>
              <input
                type="date"
                value={leadForm.nextFollowUpDate}
                onChange={(e) => setLeadForm({ ...leadForm, nextFollowUpDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <textarea
              rows={2}
              placeholder="Visit / call notes"
              value={leadForm.notes}
              onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setLeadModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 font-semibold">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#065F46] text-white font-bold">
                Save Lead
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LOG ACTIVITY MODAL */}
      {activityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleLogActivity} className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-3 text-xs">
            <h3 className="text-base font-extrabold text-slate-900">Log Sales Activity</h3>
            <select
              value={activityForm.activityType}
              onChange={(e) =>
                setActivityForm({ ...activityForm, activityType: e.target.value as SalesActivity['activityType'] })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
            >
              {ALL_ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={activityForm.leadId}
              onChange={(e) => {
                const selected = leads.find((l) => l.id === e.target.value);
                setActivityForm({
                  ...activityForm,
                  leadId: e.target.value,
                  leadName: selected?.businessName || '',
                });
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
            >
              <option value="">General activity (no specific lead)</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.businessName} ({l.city})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="datetime-local"
                value={activityForm.activityDateTime}
                onChange={(e) => setActivityForm({ ...activityForm, activityDateTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
              />
              <select
                value={activityForm.resultStatus}
                onChange={(e) =>
                  setActivityForm({
                    ...activityForm,
                    resultStatus: e.target.value as SalesActivity['resultStatus'],
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
              >
                <option value="positive">Positive</option>
                <option value="follow_up_needed">Follow-up Needed</option>
                <option value="completed">Completed</option>
                <option value="no_answer">No Answer</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="converted">Converted</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Next Follow-Up Date (Optional)</label>
              <input
                type="date"
                value={activityForm.nextFollowUpDate}
                onChange={(e) => setActivityForm({ ...activityForm, nextFollowUpDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <textarea
              required
              rows={3}
              placeholder="Activity summary & outcome notes *"
              value={activityForm.notes}
              onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setActivityModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 font-semibold">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#065F46] text-white font-bold">
                Save Activity
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

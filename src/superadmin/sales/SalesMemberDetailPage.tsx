import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileText,
  RefreshCw,
  Mail,
  Loader2,
  QrCode,
  Copy,
} from 'lucide-react';
import {
  getSalesMemberById,
  getSalesLeadsForSalesman,
  getReferralsForSalesman,
  getCommissionsForSalesman,
  getPayoutsForSalesman,
  getSalesActivitiesBySalesman,
  regenerateSalesmanReferralCode,
  sendSalesmanPortalReset,
} from '../../services/salesService';
import { getAllShopsAdmin, getAllPlatformPayments } from '../../services/platformService';
import {
  generateQrDataUrl,
  downloadSalesmanQrPng,
  downloadSalesmanQrPdf,
  downloadPayoutStatementPdf,
} from '../../utils/qrPdfUtils';
import { formatPKR } from '../../data/seedData';
import { useToast } from '../../components/common/Toast';
import {
  CommissionLedgerEntry,
  CommissionPayout,
  PlatformPayment,
  ReferralAttribution,
  SalesActivity,
  SalesLead,
  SalesMember,
  Shop,
} from '../../types';

type TabKey =
  | 'overview'
  | 'leads'
  | 'referrals'
  | 'shops'
  | 'subscriptions'
  | 'commissions'
  | 'payouts'
  | 'activities';

export const SalesMemberDetailPage: React.FC = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [member, setMember] = useState<SalesMember | null>(null);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [referrals, setReferrals] = useState<ReferralAttribution[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [payments, setPayments] = useState<PlatformPayment[]>([]);
  const [commissions, setCommissions] = useState<CommissionLedgerEntry[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [tab, setTab] = useState<TabKey>('overview');

  const loadProfile = async () => {
    if (!memberId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const m = await getSalesMemberById(memberId);
      setMember(m);
      if (m) {
        const [l, r, allShops, allPays, c, p, a, qrUrl] = await Promise.all([
          getSalesLeadsForSalesman(m.id),
          getReferralsForSalesman(m.id),
          getAllShopsAdmin(),
          getAllPlatformPayments(),
          getCommissionsForSalesman(m.id),
          getPayoutsForSalesman(m.id),
          getSalesActivitiesBySalesman(m.id),
          generateQrDataUrl(m.referralLink),
        ]);
        const referredShopIds = new Set(r.map((ref) => ref.shopId));
        setLeads(l);
        setReferrals(r);
        setShops(allShops.filter((s) => referredShopIds.has(s.id)));
        setPayments(allPays.filter((pay) => referredShopIds.has(pay.shopId)));
        setCommissions(c);
        setPayouts(p);
        setActivities(a);
        setQrDataUrl(qrUrl);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load salesman profile data from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [memberId]);

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3">
        <p className="text-sm font-bold text-rose-800">{loadError}</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={loadProfile}
            className="px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold hover:bg-rose-800"
          >
            Retry
          </button>
          <Link to="/super-admin/sales/members" className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700">
            Back to All Salesmen
          </Link>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
        <p className="text-sm font-bold text-slate-800">Salesman record not found.</p>
        <Link to="/super-admin/sales/members" className="text-xs font-bold text-[#065F46] hover:underline">
          Back to All Salesmen
        </Link>
      </div>
    );
  }

  const totalRevenue = payments
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalCommission = commissions
    .filter((c) => c.status !== 'rejected' && c.status !== 'reversed')
    .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);
  const paidCommission = commissions
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);
  const pendingCommission = commissions
    .filter((c) => c.status === 'pending' || c.status === 'approved')
    .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);

  const handleRegenerate = async () => {
    try {
      await regenerateSalesmanReferralCode(member.id);
      showToast('Referral code & QR regenerated.', 'success');
      await loadProfile();
    } catch (err: any) {
      showToast(err?.message || 'Failed to regenerate code.', 'error');
    }
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'leads', label: 'Leads', count: leads.length },
    { key: 'referrals', label: 'Referrals', count: referrals.length },
    { key: 'shops', label: 'Registered Shops', count: shops.length },
    { key: 'subscriptions', label: 'Subscriptions', count: payments.length },
    { key: 'commissions', label: 'Commissions', count: commissions.length },
    { key: 'payouts', label: 'Payout History', count: payouts.length },
    { key: 'activities', label: 'Activities', count: activities.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/super-admin/sales/members"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to All Salesmen
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              sendSalesmanPortalReset(member.email, member.id)
                .then(() => showToast(`Invite/reset email sent to ${member.email}`, 'success'))
                .catch((e) => showToast(e.message, 'error'))
            }
            className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" /> Send Portal Invite
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate Code
          </button>
        </div>
      </div>

      {/* Header Card with QR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">{member.fullName}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#065F46] capitalize">
              {member.accountStatus}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
              {member.role.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-slate-400">Employee ID</p>
              <p className="font-bold text-slate-800 font-mono">{member.employeeId}</p>
            </div>
            <div>
              <p className="text-slate-400">Email</p>
              <p className="font-semibold text-slate-800 truncate">{member.email}</p>
            </div>
            <div>
              <p className="text-slate-400">Phone</p>
              <p className="font-semibold text-slate-800">{member.phone}</p>
            </div>
            <div>
              <p className="text-slate-400">City & Territory</p>
              <p className="font-semibold text-slate-800">{member.city} · {member.territory}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] text-slate-500">Revenue Generated</p>
              <p className="text-sm font-extrabold text-slate-900 tabular-nums mt-0.5">{formatPKR(totalRevenue)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] text-slate-500">Total Commission</p>
              <p className="text-sm font-extrabold text-[#065F46] tabular-nums mt-0.5">{formatPKR(totalCommission)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] text-slate-500">Pending / Unpaid</p>
              <p className="text-sm font-extrabold text-amber-700 tabular-nums mt-0.5">{formatPKR(pendingCommission)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] text-slate-500">Commission Paid</p>
              <p className="text-sm font-extrabold text-emerald-700 tabular-nums mt-0.5">{formatPKR(paidCommission)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <QrCode className="w-4 h-4 text-[#065F46]" />
            Referral QR & Code
          </div>
          {qrDataUrl && <img src={qrDataUrl} alt={member.referralCode} className="w-32 h-32 rounded-xl border border-slate-200 bg-white p-1" />}
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-xs text-[#065F46] bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
              {member.referralCode}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(member.referralLink).catch(() => {});
                showToast('Referral link copied.', 'success');
              }}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100"
              title="Copy referral URL"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={() => downloadSalesmanQrPng(member)}
              className="flex-1 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-bold flex items-center justify-center gap-1"
            >
              <Download className="w-3 h-3" /> PNG
            </button>
            <button
              type="button"
              onClick={() => downloadSalesmanQrPdf(member)}
              className="flex-1 py-1.5 rounded-lg bg-[#065F46] hover:bg-emerald-900 text-white text-[11px] font-bold flex items-center justify-center gap-1"
            >
              <FileText className="w-3 h-3" /> Printable PDF
            </button>
          </div>
        </div>
      </div>

      {/* 8 Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200 px-3 pt-2 gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition ${
                tab === t.key
                  ? 'border-[#065F46] text-[#065F46]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label} {t.count !== undefined ? `(${t.count})` : ''}
            </button>
          ))}
        </div>

        <div className="p-5 text-xs">
          {tab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 space-y-2">
                <p className="font-bold text-slate-900">Employment & Targets</p>
                <p>Joining Date: <strong>{member.joiningDate}</strong></p>
                <p>Employment Status: <strong className="capitalize">{member.employmentStatus.replace('_', ' ')}</strong></p>
                <p>Monthly Target: <strong>{formatPKR(member.monthlyTarget)}</strong></p>
                <p>Yearly Target: <strong>{formatPKR(member.yearlyTarget)}</strong></p>
                <p>Commission Tier: <strong>{member.commissionPlanName}</strong></p>
                <p>Manager: <strong>{member.assignedManagerName || 'Super Admin'}</strong></p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 space-y-2">
                <p className="font-bold text-slate-900">Payout Account & Portal Access</p>
                <p>Invite Status: <strong className="capitalize">{member.inviteStatus || 'pending'}</strong></p>
                <p>Last Login: <strong>{member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : 'Not claimed yet'}</strong></p>
                <p>Preferred Method: <strong className="uppercase">{member.payoutDetails?.preferredMethod || 'Not configured'}</strong></p>
                <p>Account Title: <strong>{member.payoutDetails?.accountTitle || '—'}</strong></p>
                <p>Account / IBAN: <strong>{member.payoutDetails?.accountNumber || '—'}</strong></p>
              </div>
            </div>
          )}

          {tab === 'leads' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="p-2.5">Business</th>
                    <th className="p-2.5">Contact</th>
                    <th className="p-2.5">City</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Next Follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-400">No leads assigned yet.</td></tr>
                  ) : (
                    leads.map((l) => (
                      <tr key={l.id}>
                        <td className="p-2.5 font-bold text-slate-900">{l.businessName}</td>
                        <td className="p-2.5">{l.ownerName} · {l.phone}</td>
                        <td className="p-2.5">{l.city}</td>
                        <td className="p-2.5 font-semibold">{l.status}</td>
                        <td className="p-2.5">{l.nextFollowUpDate || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'referrals' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="p-2.5">Shop Name</th>
                    <th className="p-2.5">Source</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Revenue</th>
                    <th className="p-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {referrals.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-400">No referral attributions yet.</td></tr>
                  ) : (
                    referrals.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2.5 font-bold">{r.shopName}</td>
                        <td className="p-2.5 capitalize">{r.source.replace('_', ' ')}</td>
                        <td className="p-2.5 font-semibold">{r.attributionStatus}</td>
                        <td className="p-2.5 tabular-nums">{formatPKR(r.totalRevenueGenerated)}</td>
                        <td className="p-2.5">{new Date(r.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'shops' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="p-2.5">Shop</th>
                    <th className="p-2.5">Owner</th>
                    <th className="p-2.5">Plan</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shops.length === 0 ? (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-400">No registered shops yet.</td></tr>
                  ) : (
                    shops.map((s) => (
                      <tr key={s.id}>
                        <td className="p-2.5 font-bold">
                          <Link to={`/super-admin/shops/${s.id}`} className="text-[#065F46] hover:underline">
                            {s.name}
                          </Link>
                        </td>
                        <td className="p-2.5">{s.ownerName} ({s.ownerEmail})</td>
                        <td className="p-2.5">{s.subscription?.planName}</td>
                        <td className="p-2.5 capitalize font-semibold">{s.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'subscriptions' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="p-2.5">Shop</th>
                    <th className="p-2.5">Plan</th>
                    <th className="p-2.5">Amount</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-400">No subscription payments recorded.</td></tr>
                  ) : (
                    payments.map((pay) => (
                      <tr key={pay.id}>
                        <td className="p-2.5 font-bold">{pay.shopName}</td>
                        <td className="p-2.5">{pay.planName} ({pay.billingCycle})</td>
                        <td className="p-2.5 tabular-nums font-bold">{formatPKR(pay.amount)}</td>
                        <td className="p-2.5 capitalize">{pay.status}</td>
                        <td className="p-2.5">{new Date(pay.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'commissions' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="p-2.5">Shop</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Payment</th>
                    <th className="p-2.5">Commission</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commissions.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-400">No commission ledger entries yet.</td></tr>
                  ) : (
                    commissions.map((c) => (
                      <tr key={c.id}>
                        <td className="p-2.5 font-bold">{c.shopName}</td>
                        <td className="p-2.5 capitalize">{c.commissionType.replace('_', ' ')}</td>
                        <td className="p-2.5 tabular-nums">{formatPKR(c.paymentAmount)}</td>
                        <td className="p-2.5 tabular-nums font-bold text-[#065F46]">{formatPKR(c.commissionAmount)}</td>
                        <td className="p-2.5 capitalize font-semibold">{c.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'payouts' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="p-2.5">Payout #</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5">TID</th>
                    <th className="p-2.5">Amount</th>
                    <th className="p-2.5 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payouts.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-400">No payouts processed yet.</td></tr>
                  ) : (
                    payouts.map((po) => (
                      <tr key={po.id}>
                        <td className="p-2.5 font-mono font-bold">{po.payoutNumber}</td>
                        <td className="p-2.5 uppercase">{po.method}</td>
                        <td className="p-2.5 font-mono">{po.transactionReference}</td>
                        <td className="p-2.5 tabular-nums font-bold text-[#065F46]">{formatPKR(po.totalAmount)}</td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => downloadPayoutStatementPdf(po)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold"
                          >
                            Statement PDF
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'activities' && (
            <div className="space-y-2.5">
              {activities.length === 0 ? (
                <p className="text-center text-slate-400 py-6">No field or call activities logged yet.</p>
              ) : (
                activities.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900">
                        {a.activityType} {a.leadName ? `· ${a.leadName}` : ''}
                      </p>
                      <p className="text-slate-600 mt-0.5">{a.notes}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold capitalize">
                        {a.resultStatus.replace('_', ' ')}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(a.activityDateTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { QrCode, Copy, Check, Download, Printer, Store, Award, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getReferralRewardsForAgent, getReferralsForSalesman } from '../services/salesService';
import { downloadSalesmanQrPdf, downloadSalesmanQrPng, generateQrDataUrl } from '../utils/qrPdfUtils';
import { formatPKR } from '../data/seedData';
import { useToast } from '../components/common/Toast';
import { CommissionLedgerEntry, ReferralAttribution } from '../types';

type ReferralSection = 'overview' | 'qr' | 'referrals' | 'rewards';

export const ReferralDashboardPage: React.FC = () => {
  const { currentUser, salesMember } = useAuth();
  const { showToast } = useToast();
  const { pathname } = useLocation();

  const section: ReferralSection = useMemo(() => {
    if (pathname.endsWith('/qr')) return 'qr';
    if (pathname.endsWith('/referrals')) return 'referrals';
    if (pathname.endsWith('/rewards')) return 'rewards';
    return 'overview';
  }, [pathname]);

  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<ReferralAttribution[]>([]);
  const [rewards, setRewards] = useState<CommissionLedgerEntry[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid || !salesMember?.id) return;
    setLoading(true);
    Promise.all([
      getReferralsForSalesman(salesMember.id, currentUser.uid),
      getReferralRewardsForAgent(salesMember.id, currentUser.uid),
      salesMember.referralLink ? generateQrDataUrl(salesMember.referralLink, 440) : Promise.resolve(''),
    ])
      .then(([r, rew, qr]) => {
        setReferrals(r);
        setRewards(rew);
        setQrDataUrl(qr);
      })
      .finally(() => setLoading(false));
  }, [currentUser?.uid, salesMember?.id, salesMember?.referralLink]);

  if (!currentUser || !salesMember) return null;

  const eligibleRefs = useMemo(
    () => referrals.filter((r) => r.attributionStatus !== 'rejected_self_referral'),
    [referrals]
  );

  const totalApprovedReward = useMemo(
    () => rewards.reduce((s, c) => s + Number(c.commissionAmount || 0), 0),
    [rewards]
  );

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(salesMember.referralLink).catch(() => {});
    setCopied(true);
    showToast('Referral link copied.', 'success');
    setTimeout(() => setCopied(false), 1500);
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
      {section === 'overview' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Welcome, {salesMember.fullName}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Referral Agent Partner Dashboard · Share your link &amp; track approved partner rewards
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-slate-500 font-semibold">QR &amp; Link Scans</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{salesMember.qrScanCount || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-slate-500 font-semibold">Eligible Referred Shops</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{eligibleRefs.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-slate-500 font-semibold">Approved Rewards</p>
              <p className="text-2xl font-extrabold text-[#065F46] mt-1">{formatPKR(totalApprovedReward)}</p>
            </div>
          </div>
        </div>
      )}

      {(section === 'overview' || section === 'qr') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-[#065F46] text-xs font-bold">
            <QrCode className="w-4 h-4" /> Your Referral QR &amp; Link
          </div>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="Referral QR Code"
              className="w-48 h-48 mx-auto rounded-2xl border border-slate-200 p-2 bg-white"
            />
          )}
          <div>
            <p className="font-mono text-lg font-extrabold text-[#065F46]">{salesMember.referralCode}</p>
            <p className="text-xs text-slate-500 break-all mt-1">{salesMember.referralLink}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5 text-xs">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 rounded-xl border border-slate-200 font-bold inline-flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-[#065F46]" /> : <Copy className="w-4 h-4" />}
              Copy Referral Link
            </button>
            <button
              type="button"
              onClick={() => downloadSalesmanQrPng(salesMember)}
              className="px-4 py-2 rounded-xl border border-slate-200 font-bold inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Save QR PNG
            </button>
            <button
              type="button"
              onClick={() => downloadSalesmanQrPdf(salesMember)}
              className="px-4 py-2 rounded-xl bg-[#065F46] text-white font-bold inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print A5 Card
            </button>
          </div>
        </div>
      )}

      {(section === 'overview' || section === 'referrals') && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Store className="w-4 h-4 text-[#065F46]" /> Eligible Referred Shop Registrations ({eligibleRefs.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Shop</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registered On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eligibleRefs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No referred shop registrations recorded yet.
                    </td>
                  </tr>
                ) : (
                  eligibleRefs.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-bold text-slate-900">{r.shopName}</td>
                      <td className="px-4 py-3 text-slate-600">{r.city || '-'}</td>
                      <td className="px-4 py-3 capitalize font-semibold">{r.attributionStatus}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(section === 'overview' || section === 'rewards') && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#065F46]" /> Approved Referral Rewards ({rewards.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Referred Shop</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Approved Reward</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rewards.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No approved rewards yet. Rewards appear once Super Admin approves eligible subscription commissions.
                    </td>
                  </tr>
                ) : (
                  rewards.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-bold text-slate-900">{c.shopName}</td>
                      <td className="px-4 py-3">{c.planName}</td>
                      <td className="px-4 py-3 font-extrabold text-[#065F46]">{formatPKR(c.commissionAmount)}</td>
                      <td className="px-4 py-3 capitalize font-semibold">{c.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { QrCode, Download, Printer, RefreshCw, Copy, Check, Search, Loader2 } from 'lucide-react';
import {
  getAllReferralAttributions,
  getAllSalesMembers,
  getAllSalesQrEvents,
  regenerateSalesmanReferralCode,
} from '../../services/salesService';
import {
  downloadSalesmanQrPdf,
  downloadSalesmanQrPng,
  generateQrDataUrl,
} from '../../utils/qrPdfUtils';
import { useToast } from '../../components/common/Toast';
import { ReferralAttribution, SalesMember, SalesQrEvent } from '../../types';

export const SalesQrCodesPage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<SalesMember[]>([]);
  const [referrals, setReferrals] = useState<ReferralAttribution[]>([]);
  const [qrEvents, setQrEvents] = useState<SalesQrEvent[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, r, q] = await Promise.all([
        getAllSalesMembers().catch(() => []),
        getAllReferralAttributions().catch(() => []),
        getAllSalesQrEvents().catch(() => []),
      ]);
      setMembers(m);
      setReferrals(r);
      setQrEvents(q);

      const previews: Record<string, string> = {};
      await Promise.all(
        m.map(async (member) => {
          previews[member.id] = await generateQrDataUrl(member.referralLink, 240);
        })
      );
      setQrImages(previews);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter(
      (m) =>
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        m.employeeId.toLowerCase().includes(q) ||
        m.referralCode.toLowerCase().includes(q) ||
        m.city.toLowerCase().includes(q)
    );
  }, [members, search]);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    showToast('Referral link copied.', 'success');
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleRegenerate = async (member: SalesMember) => {
    setBusyId(member.id);
    try {
      const res = await regenerateSalesmanReferralCode(member.id);
      showToast(`Generated new code ${res.referralCode} for ${member.fullName}.`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to regenerate code.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">QR Code Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate, download (PNG), print (A5 PDF card), regenerate referral QR codes, and monitor field scan-to-conversion volume.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search salesman, ID, code, city..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-500 space-y-2">
          <QrCode className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">No salesmen match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((m) => {
            const memberReferrals = referrals.filter(
              (r) => r.salesmanId === m.id && r.attributionStatus !== 'rejected_self_referral'
            );
            const eventScans = qrEvents.filter((ev) => ev.salesmanId === m.id).length;
            const totalScans = Math.max(m.qrScanCount || 0, eventScans);
            const conversionPct =
              totalScans > 0 ? Math.round((memberReferrals.length / totalScans) * 100) : 0;

            return (
              <div
                key={m.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {m.employeeId}
                    </span>
                    <h2 className="text-sm font-extrabold text-slate-900">{m.fullName}</h2>
                    <p className="text-[11px] text-slate-500">
                      {m.city} · {m.territory}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      m.accountStatus === 'active'
                        ? 'bg-emerald-50 text-[#065F46]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {m.accountStatus}
                  </span>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-xl p-3">
                  {qrImages[m.id] ? (
                    <img
                      src={qrImages[m.id]}
                      alt={`QR for ${m.fullName}`}
                      className="w-24 h-24 rounded-lg border border-slate-200 bg-white shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg border border-slate-200 bg-white flex items-center justify-center">
                      <QrCode className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                    <p className="font-mono font-extrabold text-[#065F46] text-sm">
                      {m.referralCode}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{m.referralLink}</p>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Scans</span>
                        <span className="font-bold text-slate-800 tabular-nums">{totalScans}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Shops</span>
                        <span className="font-bold text-slate-800 tabular-nums">
                          {memberReferrals.length}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Conv %</span>
                        <span className="font-bold text-[#065F46] tabular-nums">{conversionPct}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => downloadSalesmanQrPng(m)}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold flex items-center justify-center gap-1.5 text-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" /> PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSalesmanQrPdf(m)}
                    className="px-3 py-2 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white font-bold flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" /> PDF Card
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(m.id, m.referralLink)}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold flex items-center justify-center gap-1.5 text-slate-700"
                  >
                    {copiedId === m.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#065F46]" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Link
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => handleRegenerate(m)}
                    className="px-3 py-2 rounded-xl border border-amber-200 text-amber-800 hover:bg-amber-50 font-semibold flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${busyId === m.id ? 'animate-spin' : ''}`} />
                    Regenerate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

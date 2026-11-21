import React, { useEffect, useMemo, useState } from 'react';
import { FileBarChart2, Download, Loader2 } from 'lucide-react';
import {
  getAllCommissionLedger,
  getAllCommissionPayouts,
  getAllReferralAttributions,
  getAllSalesLeads,
  getAllSalesMembers,
  getAllSalesTeams,
} from '../../services/salesService';
import { getAllPlatformPayments, getAllShopsAdmin } from '../../services/platformService';
import { formatPKR } from '../../data/seedData';
import { downloadCsvFile } from '../../utils/csvUtils';
import {
  CommissionLedgerEntry,
  CommissionPayout,
  PlatformPayment,
  ReferralAttribution,
  SalesLead,
  SalesMember,
  SalesTeam,
  Shop,
} from '../../types';

type ReportType =
  | 'daily_sales'
  | 'monthly_sales'
  | 'salesman_performance'
  | 'team_performance'
  | 'lead_conversion'
  | 'referral_registration'
  | 'subscription_revenue'
  | 'commission_report'
  | 'payout_report';

const REPORT_TABS: { id: ReportType; label: string }[] = [
  { id: 'daily_sales', label: 'Daily Sales' },
  { id: 'monthly_sales', label: 'Monthly Sales' },
  { id: 'salesman_performance', label: 'Salesman-wise' },
  { id: 'team_performance', label: 'Team-wise' },
  { id: 'lead_conversion', label: 'Lead Conversion' },
  { id: 'referral_registration', label: 'Referral Registrations' },
  { id: 'subscription_revenue', label: 'Subscription Revenue' },
  { id: 'commission_report', label: 'Commissions' },
  { id: 'payout_report', label: 'Payouts' },
];

export const SalesReportsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<ReportType>('salesman_performance');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salesmanId, setSalesmanId] = useState('');

  const [members, setMembers] = useState<SalesMember[]>([]);
  const [teams, setTeams] = useState<SalesTeam[]>([]);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [referrals, setReferrals] = useState<ReferralAttribution[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [payments, setPayments] = useState<PlatformPayment[]>([]);
  const [commissions, setCommissions] = useState<CommissionLedgerEntry[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [m, t, l, r, s, p, c, po] = await Promise.all([
          getAllSalesMembers().catch(() => []),
          getAllSalesTeams().catch(() => []),
          getAllSalesLeads().catch(() => []),
          getAllReferralAttributions().catch(() => []),
          getAllShopsAdmin().catch(() => []),
          getAllPlatformPayments().catch(() => []),
          getAllCommissionLedger().catch(() => []),
          getAllCommissionPayouts().catch(() => []),
        ]);
        setMembers(m);
        setTeams(t);
        setLeads(l);
        setReferrals(r);
        setShops(s);
        setPayments(p);
        setCommissions(c);
        setPayouts(po);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const inRange = (iso?: string) => {
    if (!iso) return false;
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return false;
    if (startDate && ms < new Date(startDate).getTime()) return false;
    if (endDate && ms > new Date(endDate).getTime() + 86399999) return false;
    return true;
  };

  const reportData = useMemo<{ headers: string[]; rows: (string | number)[][] }>(() => {
    const refByShop = new Map(referrals.map((r) => [r.shopId, r]));
    const shopMap = new Map(shops.map((s) => [s.id, s]));

    const approvedPayments = payments.filter((p) => {
      if (p.status !== 'approved' || !inRange(p.createdAt)) return false;
      if (salesmanId) {
        const ref = refByShop.get(p.shopId);
        return ref?.salesmanId === salesmanId;
      }
      return true;
    });

    const filteredLeads = leads.filter(
      (l) => inRange(l.createdAt) && (!salesmanId || l.assignedSalesmanId === salesmanId)
    );
    const filteredReferrals = referrals.filter(
      (r) => inRange(r.createdAt) && (!salesmanId || r.salesmanId === salesmanId)
    );
    const filteredCommissions = commissions.filter(
      (c) => inRange(c.createdAt) && (!salesmanId || c.salesmanId === salesmanId)
    );
    const filteredPayouts = payouts.filter(
      (p) => inRange(p.processedAt) && (!salesmanId || p.salesmanId === salesmanId)
    );

    switch (reportType) {
      case 'daily_sales': {
        const map = new Map<string, { regs: number; payments: number; revenue: number }>();
        for (const r of filteredReferrals) {
          const day = r.createdAt.slice(0, 10);
          const cur = map.get(day) || { regs: 0, payments: 0, revenue: 0 };
          cur.regs++;
          map.set(day, cur);
        }
        for (const p of approvedPayments) {
          const day = p.createdAt.slice(0, 10);
          const cur = map.get(day) || { regs: 0, payments: 0, revenue: 0 };
          cur.payments++;
          cur.revenue += Number(p.amount) || 0;
          map.set(day, cur);
        }
        const rows = Array.from(map.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([day, v]) => [day, v.regs, v.payments, formatPKR(v.revenue)]);
        return {
          headers: ['Date', 'Shop Registrations', 'Paid Subscriptions', 'Subscription Revenue'],
          rows,
        };
      }

      case 'monthly_sales': {
        const map = new Map<string, { regs: number; payments: number; revenue: number }>();
        for (const r of filteredReferrals) {
          const m = r.createdAt.slice(0, 7);
          const cur = map.get(m) || { regs: 0, payments: 0, revenue: 0 };
          cur.regs++;
          map.set(m, cur);
        }
        for (const p of approvedPayments) {
          const m = p.createdAt.slice(0, 7);
          const cur = map.get(m) || { regs: 0, payments: 0, revenue: 0 };
          cur.payments++;
          cur.revenue += Number(p.amount) || 0;
          map.set(m, cur);
        }
        const rows = Array.from(map.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([month, v]) => [month, v.regs, v.payments, formatPKR(v.revenue)]);
        return {
          headers: ['Month', 'Shop Registrations', 'Paid Subscriptions', 'Subscription Revenue'],
          rows,
        };
      }

      case 'salesman_performance': {
        const list = salesmanId ? members.filter((m) => m.id === salesmanId) : members;
        const rows = list.map((m) => {
          const mLeads = filteredLeads.filter((l) => l.assignedSalesmanId === m.id);
          const mRefs = filteredReferrals.filter(
            (r) => r.salesmanId === m.id && r.attributionStatus !== 'rejected_self_referral'
          );
          const mShopIds = new Set(mRefs.map((r) => r.shopId));
          const mRev = approvedPayments
            .filter((p) => mShopIds.has(p.shopId))
            .reduce((s, p) => s + Number(p.amount || 0), 0);
          const mComm = filteredCommissions
            .filter((c) => c.salesmanId === m.id && c.status !== 'rejected' && c.status !== 'reversed')
            .reduce((s, c) => s + Number(c.commissionAmount || 0), 0);
          const conv = mLeads.length > 0 ? `${Math.round((mRefs.length / mLeads.length) * 100)}%` : '0%';
          return [m.employeeId, m.fullName, m.city, mLeads.length, mRefs.length, conv, formatPKR(mRev), formatPKR(mComm)];
        });
        return {
          headers: ['Employee ID', 'Salesman', 'City', 'Leads', 'Registrations', 'Conv %', 'Revenue', 'Commission'],
          rows,
        };
      }

      case 'team_performance': {
        const rows = teams.map((t) => {
          const idSet = new Set(t.memberIds);
          const tLeads = filteredLeads.filter((l) => l.assignedSalesmanId && idSet.has(l.assignedSalesmanId));
          const tRefs = filteredReferrals.filter((r) => idSet.has(r.salesmanId));
          const tShopIds = new Set(tRefs.map((r) => r.shopId));
          const tRev = approvedPayments
            .filter((p) => tShopIds.has(p.shopId))
            .reduce((s, p) => s + Number(p.amount || 0), 0);
          return [t.name, t.managerName, t.territory, t.memberIds.length, tLeads.length, tRefs.length, formatPKR(t.monthlyTeamTarget), formatPKR(tRev)];
        });
        return {
          headers: ['Team', 'Manager', 'Territory', 'Members', 'Leads', 'Registrations', 'Monthly Target', 'Revenue'],
          rows,
        };
      }

      case 'lead_conversion':
        return {
          headers: ['Business', 'Owner', 'City', 'Industry', 'Assigned To', 'Status', 'Created'],
          rows: filteredLeads.map((l) => [
            l.businessName,
            l.ownerName,
            l.city,
            l.industry,
            l.assignedSalesmanName || 'Unassigned',
            l.status,
            l.createdAt.slice(0, 10),
          ]),
        };

      case 'referral_registration':
        return {
          headers: ['Shop Name', 'City', 'Salesman', 'Code', 'Source', 'Attribution Status', 'Date'],
          rows: filteredReferrals.map((r) => [
            r.shopName,
            r.city || '-',
            r.salesmanName,
            r.referralCode,
            r.source,
            r.attributionStatus,
            r.createdAt.slice(0, 10),
          ]),
        };

      case 'subscription_revenue':
        return {
          headers: ['Payment ID', 'Shop', 'Plan', 'Cycle', 'Amount', 'Referred By', 'Date'],
          rows: approvedPayments.map((p) => [
            p.id,
            p.shopName,
            p.planName,
            p.billingCycle,
            formatPKR(p.amount),
            refByShop.get(p.shopId)?.salesmanName || 'Organic',
            p.createdAt.slice(0, 10),
          ]),
        };

      case 'commission_report':
        return {
          headers: ['Entry ID', 'Salesman', 'Shop', 'Plan', 'Rate + Bonus', 'Commission', 'Status', 'Date'],
          rows: filteredCommissions.map((c) => [
            c.id,
            c.salesmanName,
            shopMap.get(c.shopId)?.name || c.shopName,
            c.planName,
            `${c.commissionRatePct}% + ${formatPKR(c.flatBonusAmount)}`,
            formatPKR(c.commissionAmount),
            c.status,
            c.createdAt.slice(0, 10),
          ]),
        };

      case 'payout_report':
        return {
          headers: ['Payout #', 'Salesman', 'Method', 'Account #', 'TID', 'Amount', 'Processed Date'],
          rows: filteredPayouts.map((p) => [
            p.payoutNumber,
            p.salesmanName,
            p.method,
            p.accountNumber,
            p.transactionReference,
            formatPKR(p.totalAmount),
            p.processedAt.slice(0, 10),
          ]),
        };
    }
  }, [reportType, startDate, endDate, salesmanId, members, teams, leads, referrals, shops, payments, commissions, payouts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Sales Reports & Export</h1>
          <p className="text-xs text-slate-500 mt-1">
            Nine live database reports with date-range and salesman filters plus formula-safe CSV export.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsvFile(`bazaarpk-${reportType}-report`, reportData.headers, reportData.rows)}
          className="px-4 py-2 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV ({reportData.rows.length})
        </button>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setReportType(t.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              reportType === t.id
                ? 'bg-[#065F46] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block font-bold text-slate-600 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-600 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-600 mb-1">Salesman Filter</label>
          <select
            value={salesmanId}
            onChange={(e) => setSalesmanId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
          >
            <option value="">All Salesmen</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName} ({m.employeeId})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setSalesmanId('');
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
          </div>
        ) : reportData.rows.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 space-y-2">
            <FileBarChart2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No records match the selected filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  {reportData.headers.map((h) => (
                    <th key={h} className="px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.rows.map((row, idx) => (
                  <tr key={idx}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-3 text-slate-800 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
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

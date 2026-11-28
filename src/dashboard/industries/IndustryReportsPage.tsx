import React, { useEffect, useState } from 'react';
import { BarChart3, Download, Loader2 } from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  computeGymDashboardMetrics,
  getGymAttendance,
  getGymMembers,
} from '../../services/gymService';
import {
  computeClinicMetrics,
  getClinicAppointments,
  getClinicDoctors,
  getClinicPatients,
} from '../../services/clinicService';
import {
  computeCarWashMetrics,
  getCarWashJobs,
} from '../../services/carwashService';
import {
  computeDealerMetrics,
  getDealerDeals,
  getDealerInquiries,
  getDealerLeads,
  getDealerVehicles,
} from '../../services/carDealerService';
import {
  calculatePaymentTotals,
  getIndustryPayments,
  getPaymentMethodDisplay,
} from '../../services/industryCommonService';
import { getIndustryMeta } from '../../config/industryConfig';
import { formatPKR } from '../../data/seedData';
import {
  CarWashJobCard,
  ClinicAppointment,
  DealerDeal,
  DealerVehicle,
  GymAttendanceRecord,
  GymMember,
  IndustryPaymentRecord,
} from '../../types';

export const IndustryReportsPage: React.FC = () => {
  const { shopId, shop, businessType, industryGroup, hasPermission } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<IndustryPaymentRecord[]>([]);
  const [gymMembers, setGymMembers] = useState<GymMember[]>([]);
  const [gymAttendance, setGymAttendance] = useState<GymAttendanceRecord[]>([]);
  const [clinicAppointments, setClinicAppointments] = useState<ClinicAppointment[]>([]);
  const [clinicSummary, setClinicSummary] = useState<ReturnType<typeof computeClinicMetrics> | null>(null);
  const [carwashJobs, setCarwashJobs] = useState<CarWashJobCard[]>([]);
  const [dealerVehicles, setDealerVehicles] = useState<DealerVehicle[]>([]);
  const [dealerDeals, setDealerDeals] = useState<DealerDeal[]>([]);
  const [dealerSummary, setDealerSummary] = useState<ReturnType<typeof computeDealerMetrics> | null>(null);

  const canViewDealerProfit = hasPermission('dealer_private_pricing');
  const meta = getIndustryMeta(businessType);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    const loadData = async () => {
      try {
        const pay = await getIndustryPayments(shopId).catch(() => []);
        setPayments(pay);

        if (industryGroup === 'gym') {
          const [m, a] = await Promise.all([
            getGymMembers(shopId).catch(() => []),
            getGymAttendance(shopId).catch(() => []),
          ]);
          setGymMembers(m);
          setGymAttendance(a);
        } else if (industryGroup === 'clinic') {
          const [p, d, a] = await Promise.all([
            getClinicPatients(shopId).catch(() => []),
            getClinicDoctors(shopId).catch(() => []),
            getClinicAppointments(shopId).catch(() => []),
          ]);
          setClinicAppointments(a);
          setClinicSummary(computeClinicMetrics(p, d, a, pay));
        } else if (industryGroup === 'carwash') {
          const j = await getCarWashJobs(shopId).catch(() => []);
          setCarwashJobs(j);
        } else if (industryGroup === 'car_dealer') {
          const [v, i, l, dl] = await Promise.all([
            getDealerVehicles(shopId).catch(() => []),
            getDealerInquiries(shopId).catch(() => []),
            getDealerLeads(shopId).catch(() => []),
            getDealerDeals(shopId).catch(() => []),
          ]);
          setDealerVehicles(v);
          setDealerDeals(dl);
          setDealerSummary(computeDealerMetrics(v, i, l, dl));
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [shopId, industryGroup]);

  const exportCsv = () => {
    const rows: string[][] = [['Date', 'Customer', 'Phone', 'Description', 'Method', 'Status', 'Amount (PKR)']];
    payments.forEach((p) => {
      rows.push([
        p.createdAt.slice(0, 10),
        p.customerName.replace(/,/g, ' '),
        p.customerPhone || '',
        (p.description || p.notes || '').replace(/,/g, ' '),
        getPaymentMethodDisplay(p.method),
        p.status,
        String(p.amount),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shop?.slug || 'business'}-${industryGroup}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Compiling {meta.shortLabel} Reports...
      </div>
    );
  }

  const payTotals = calculatePaymentTotals(payments);
  const gymStats =
    industryGroup === 'gym' ? computeGymDashboardMetrics(gymMembers, gymAttendance, payments) : null;
  const cwStats =
    industryGroup === 'carwash' ? computeCarWashMetrics(carwashJobs, payments) : null;

  // Package / doctor breakdown helpers
  const doctorBreakdown = clinicAppointments.reduce((acc, a) => {
    const key = a.doctorName || 'Unassigned';
    const cur = acc.get(key) || { count: 0, billed: 0 };
    cur.count += 1;
    cur.billed += Number(a.paidAmount || 0);
    acc.set(key, cur);
    return acc;
  }, new Map<string, { count: number; billed: number }>());

  const carwashPackageBreakdown = carwashJobs
    .filter((j) => j.status !== 'Cancelled')
    .reduce((acc, j) => {
      const key = j.packageName || 'Wash Service';
      const cur = acc.get(key) || { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(j.totalAmount || 0);
      acc.set(key, cur);
      return acc;
    }, new Map<string, { count: number; revenue: number }>());

  return (
    <div className="space-y-6 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#065F46]" /> {meta.shortLabel} Reports &amp; Revenue
          </h2>
          <p className="text-slate-500 mt-0.5">
            Vertical-specific operational performance, collections &amp; CSV ledger export.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl font-bold inline-flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5 text-[#065F46]" /> Export Payments CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Collected This Month</p>
          <p className="text-xl font-extrabold text-[#065F46] mt-1 tabular-nums">
            {formatPKR(payTotals.monthlyPaid)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">All-Time Verified Revenue</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {formatPKR(payTotals.paidTotal)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Pending Payment Entries</p>
          <p className="text-xl font-extrabold text-red-700 mt-1 tabular-nums">
            {formatPKR(payTotals.pendingTotal)}
          </p>
        </div>
      </div>

      {gymStats && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900">Membership &amp; Renewal Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
            <div><span className="text-slate-500 block">Active</span><strong className="text-base">{gymStats.activeMembers}</strong></div>
            <div><span className="text-slate-500 block">Expired</span><strong className="text-base text-red-700">{gymStats.expiredMembers}</strong></div>
            <div><span className="text-slate-500 block">Frozen</span><strong className="text-base">{gymStats.frozenMembers}</strong></div>
            <div><span className="text-slate-500 block">Due Within 7 Days</span><strong className="text-base text-amber-700">{gymStats.upcomingRenewalsCount}</strong></div>
          </div>
        </div>
      )}

      {clinicSummary && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900">Doctor-Wise Appointments &amp; Collections</h3>
          {doctorBreakdown.size === 0 ? (
            <p className="text-slate-400 py-4">No appointments recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {Array.from(doctorBreakdown.entries()).map(([docName, stat]) => (
                <div key={docName} className="py-2.5 flex items-center justify-between">
                  <span className="font-bold text-slate-900">{docName}</span>
                  <span className="text-slate-600 tabular-nums">
                    {stat.count} visits · Collected {formatPKR(stat.billed)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {cwStats && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900">Wash &amp; Detailing Package Breakdown</h3>
          {carwashPackageBreakdown.size === 0 ? (
            <p className="text-slate-400 py-4">No completed or active job cards yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {Array.from(carwashPackageBreakdown.entries()).map(([pkgName, stat]) => (
                <div key={pkgName} className="py-2.5 flex items-center justify-between">
                  <span className="font-bold text-slate-900">{pkgName}</span>
                  <span className="text-slate-700 tabular-nums font-semibold">
                    {stat.count} jobs · {formatPKR(stat.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {dealerSummary && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900">Showroom Valuation &amp; Sales Report</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
            <div><span className="text-slate-500 block">Vehicles in Stock</span><strong className="text-base">{dealerVehicles.filter((v) => v.status !== 'Sold').length}</strong></div>
            <div><span className="text-slate-500 block">Asking Value</span><strong className="text-base">{formatPKR(dealerSummary.stockAskingValue)}</strong></div>
            <div><span className="text-slate-500 block">Sales Volume ({dealerDeals.length})</span><strong className="text-base">{formatPKR(dealerSummary.totalSalesVolume)}</strong></div>
            <div>
              <span className="text-slate-500 block">Realized Net Profit</span>
              <strong className="text-base text-[#065F46]">
                {canViewDealerProfit ? formatPKR(dealerSummary.realizedProfit) : 'Restricted'}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

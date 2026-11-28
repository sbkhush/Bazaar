import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  ExternalLink,
  Loader2,
  Package,
  Plus,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  computeCarWashMetrics,
  getCarWashJobs,
  updateCarWashJobStatus,
} from '../../services/carwashService';
import { getIndustryPayments } from '../../services/industryCommonService';
import { CarWashJobCard, CarWashJobStatus, IndustryPaymentRecord } from '../../types';
import { formatPKR } from '../../data/seedData';

export const CarWashOverviewPage: React.FC = () => {
  const { shopId, shop, publicStorePath, isReadOnly } = useDashboard();
  const [jobs, setJobs] = useState<CarWashJobCard[]>([]);
  const [payments, setPayments] = useState<IndustryPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [j, p] = await Promise.all([
        getCarWashJobs(shopId).catch(() => []),
        getIndustryPayments(shopId).catch(() => []),
      ]);
      setJobs(j);
      setPayments(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading Car Wash Operations...
      </div>
    );
  }

  const metrics = computeCarWashMetrics(jobs, payments);
  const activeQueue = jobs.filter(
    (j) => j.status === 'Booked' || j.status === 'Waiting' || j.status === 'In Progress'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {shop?.name || 'Car Wash & Detailing'} — Station Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live bay queue, job cards, vehicle history &amp; daily sales.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/carwash/queue"
            className="px-3.5 py-2 bg-[#065F46] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New Job Card / Walk-In
          </Link>
          <Link
            to="/dashboard/carwash/packages"
            className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5"
          >
            <Package className="w-3.5 h-3.5 text-[#065F46]" /> Wash Packages
          </Link>
          <Link
            to={publicStorePath}
            target="_blank"
            className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5"
          >
            Public Booking Page <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Required 6 Car Wash Dashboard Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Today&apos;s Bookings</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {metrics.todayBookings}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Vehicles in Queue</p>
          <p className="text-2xl font-extrabold text-amber-700 mt-1 tabular-nums">
            {metrics.vehiclesInQueue}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Jobs in Progress</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {metrics.jobsInProgress}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Completed Services</p>
          <p className="text-2xl font-extrabold text-[#065F46] mt-1 tabular-nums">
            {metrics.completedServices}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Today&apos;s Revenue</p>
          <p className="text-lg font-extrabold text-slate-900 mt-1 tabular-nums">
            {formatPKR(metrics.todayRevenue)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Pending Payments</p>
          <p className="text-lg font-extrabold text-red-700 mt-1 tabular-nums">
            {formatPKR(metrics.pendingPayments)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#065F46]" /> Live Service Bay Queue
          </h3>
          <Link to="/dashboard/carwash/queue" className="font-semibold text-[#065F46]">
            Open All Job Cards
          </Link>
        </div>
        {activeQueue.length === 0 ? (
          <p className="py-8 text-center text-slate-400">
            No vehicles currently waiting or in progress.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeQueue.slice(0, 8).map((j) => (
              <div key={j.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">
                    <span className="font-mono">{j.plateNumber}</span> · {j.vehicleModel}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {j.jobNumber} · {j.packageName} · {j.customerName} ({j.customerPhone})
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-900 tabular-nums">
                    {formatPKR(j.totalAmount)}
                  </span>
                  {!isReadOnly && (
                    <select
                      value={j.status}
                      onChange={(e) =>
                        updateCarWashJobStatus(
                          shopId,
                          j.id,
                          e.target.value as CarWashJobStatus
                        ).then(load)
                      }
                      className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-[11px] font-semibold"
                    >
                      {(['Booked', 'Waiting', 'In Progress', 'Completed', 'Delivered', 'Cancelled'] as CarWashJobStatus[]).map(
                        (st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        )
                      )}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <Link
          to="/dashboard/carwash/vehicles"
          className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-[#065F46] transition flex items-center gap-3"
        >
          <Car className="w-5 h-5 text-[#065F46]" />
          <div>
            <p className="font-bold text-slate-900">Customer &amp; Vehicle Registry</p>
            <p className="text-[11px] text-slate-500">Plate numbers, vehicle history &amp; repeat customers</p>
          </div>
        </Link>
        <Link
          to="/dashboard/payments"
          className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-[#065F46] transition flex items-center gap-3"
        >
          <Wallet className="w-5 h-5 text-[#065F46]" />
          <div>
            <p className="font-bold text-slate-900">Station Payments &amp; Pending Bills</p>
            <p className="text-[11px] text-slate-500">Record cash, EasyPaisa, JazzCash &amp; bank payments</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

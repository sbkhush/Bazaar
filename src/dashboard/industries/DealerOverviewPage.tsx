import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Car,
  ExternalLink,
  Handshake,
  Loader2,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  computeDealerMetrics,
  getDealerDeals,
  getDealerInquiries,
  getDealerLeads,
  getDealerVehicles,
} from '../../services/carDealerService';
import { DealerDeal, DealerInquiry, DealerLead, DealerVehicle } from '../../types';
import { formatPKR } from '../../data/seedData';

export const DealerOverviewPage: React.FC = () => {
  const { shopId, shop, publicStorePath, hasPermission } = useDashboard();
  const [vehicles, setVehicles] = useState<DealerVehicle[]>([]);
  const [inquiries, setInquiries] = useState<DealerInquiry[]>([]);
  const [leads, setLeads] = useState<DealerLead[]>([]);
  const [deals, setDeals] = useState<DealerDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const canViewPrivatePricing = hasPermission('dealer_private_pricing');

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    Promise.all([
      getDealerVehicles(shopId).catch(() => []),
      getDealerInquiries(shopId).catch(() => []),
      getDealerLeads(shopId).catch(() => []),
      getDealerDeals(shopId).catch(() => []),
    ])
      .then(([v, i, l, d]) => {
        setVehicles(v);
        setInquiries(i);
        setLeads(l);
        setDeals(d);
      })
      .finally(() => setLoading(false));
  }, [shopId]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading Showroom Inventory &amp; Deals...
      </div>
    );
  }

  const m = computeDealerMetrics(vehicles, inquiries, leads, deals);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {shop?.name || 'Car Showroom'} — Dealer Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Showroom stock, public inquiries, test drives, buyer leads &amp; deal profit tracking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/dealer/inventory"
            className="px-3.5 py-2 bg-[#065F46] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Vehicle
          </Link>
          <Link
            to="/dashboard/dealer/leads-deals"
            className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5"
          >
            <Handshake className="w-3.5 h-3.5 text-[#065F46]" /> Inquiries &amp; Deals
          </Link>
          <Link
            to={publicStorePath}
            target="_blank"
            className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5"
          >
            Public Showroom <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Required Car Dealer Dashboard Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Vehicles</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{m.totalVehicles}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Available</p>
          <p className="text-2xl font-extrabold text-[#065F46] mt-1 tabular-nums">{m.available}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Reserved</p>
          <p className="text-2xl font-extrabold text-amber-700 mt-1 tabular-nums">{m.reserved}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Sold</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{m.sold}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Open Inquiries</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{m.openInquiries}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Active Leads</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{m.activeLeads}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">
            {canViewPrivatePricing ? 'Realized Profit' : 'Deals Closed'}
          </p>
          <p className="text-lg font-extrabold text-[#065F46] mt-1 tabular-nums">
            {canViewPrivatePricing ? formatPKR(m.realizedProfit) : m.dealsCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Car className="w-4 h-4 text-[#065F46]" /> Latest Showroom Vehicles
            </h3>
            <Link to="/dashboard/dealer/inventory" className="font-semibold text-[#065F46]">
              Manage Stock
            </Link>
          </div>
          {vehicles.length === 0 ? (
            <p className="py-8 text-center text-slate-400">No vehicles added to showroom yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {vehicles.slice(0, 6).map((v) => (
                <div key={v.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{v.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {v.registrationCity} · {v.mileageKm.toLocaleString()} km · {v.transmission} · {v.status}
                    </p>
                  </div>
                  <span className="font-extrabold text-[#065F46] tabular-nums">
                    {formatPKR(v.askingPrice)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#065F46]" /> Recent Buyer Inquiries
            </h3>
            <Link to="/dashboard/dealer/leads-deals" className="font-semibold text-[#065F46]">
              Open Pipeline
            </Link>
          </div>
          {inquiries.length === 0 ? (
            <p className="py-8 text-center text-slate-400">No test drive or buyer inquiries yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {inquiries.slice(0, 6).map((iq) => (
                <div key={iq.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{iq.vehicleTitle}</p>
                    <p className="text-[11px] text-slate-500">
                      {iq.customerName} ({iq.customerPhone}) · {iq.inquiryType.replace('_', ' ')}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                    {iq.status}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <BadgeCheck className="w-3.5 h-3.5 text-[#065F46]" /> Active Inventory Asking Value
            </span>
            <span className="font-extrabold text-slate-900 tabular-nums">
              {formatPKR(m.stockAskingValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

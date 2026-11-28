import React, { useEffect, useState } from 'react';
import {
  Handshake,
  Loader2,
  MessageCircle,
  PhoneCall,
  Plus,
  UserCheck,
} from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  getDealerDeals,
  getDealerInquiries,
  getDealerLeads,
  getDealerVehicles,
  recordDealerDeal,
  saveDealerLead,
  updateDealerInquiryStatus,
} from '../../services/carDealerService';
import {
  formatWhatsAppReminderUrl,
  recordIndustryPayment,
} from '../../services/industryCommonService';
import { getShopStaff } from '../../services/tenantService';
import {
  DealerDeal,
  DealerInquiry,
  DealerLead,
  DealerVehicle,
  ManualPaymentMethod,
  StaffMember,
} from '../../types';
import { formatPKR } from '../../data/seedData';

export const DealerLeadsDealsPage: React.FC = () => {
  const { shopId, isReadOnly, hasPermission } = useDashboard();
  const canViewPrivatePricing = hasPermission('dealer_private_pricing');
  const canCloseDeals = hasPermission('dealer_deals');

  const [tab, setTab] = useState<'inquiries' | 'leads' | 'deals'>('inquiries');
  const [vehicles, setVehicles] = useState<DealerVehicle[]>([]);
  const [inquiries, setInquiries] = useState<DealerInquiry[]>([]);
  const [leads, setLeads] = useState<DealerLead[]>([]);
  const [deals, setDeals] = useState<DealerDeal[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lead form
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadVehicleId, setLeadVehicleId] = useState('');
  const [leadSalespersonId, setLeadSalespersonId] = useState('');
  const [leadFollowUp, setLeadFollowUp] = useState('');
  const [leadNotes, setLeadNotes] = useState('');
  const [savingLead, setSavingLead] = useState(false);

  // Deal form
  const [dealVehicleId, setDealVehicleId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [dealSalespersonId, setDealSalespersonId] = useState('');
  const [agreedPrice, setAgreedPrice] = useState('');
  const [bookingAmount, setBookingAmount] = useState('');
  const [commissionAmount, setCommissionAmount] = useState('0');
  const [deliveryStatus, setDeliveryStatus] =
    useState<DealerDeal['deliveryStatus']>('booked');
  const [paymentMethod, setPaymentMethod] =
    useState<ManualPaymentMethod>('bank_transfer');
  const [dealNotes, setDealNotes] = useState('');
  const [savingDeal, setSavingDeal] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const [v, i, l, d, s] = await Promise.all([
        getDealerVehicles(shopId),
        getDealerInquiries(shopId),
        getDealerLeads(shopId),
        getDealerDeals(shopId),
        getShopStaff(shopId).catch(() => ({ staff: [] as StaffMember[], invites: [] })),
      ]);
      setVehicles(v);
      setInquiries(i);
      setLeads(l);
      setDeals(d);
      setStaffList(s.staff.filter((st) => st.status === 'active'));
      const availableVehicles = v.filter((veh) => veh.status !== 'Sold');
      if (!dealVehicleId && availableVehicles.length > 0) {
        setDealVehicleId(availableVehicles[0].id);
        setAgreedPrice(String(availableVehicles[0].askingPrice));
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load showroom leads & deals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const handleInquiryStatus = async (
    inquiryId: string,
    status: DealerInquiry['status']
  ) => {
    if (!shopId || isReadOnly) return;
    await updateDealerInquiryStatus(shopId, inquiryId, status);
    await load();
  };

  const handlePromoteInquiryToLead = async (inq: DealerInquiry) => {
    if (!shopId || isReadOnly) return;
    await saveDealerLead(shopId, {
      customerName: inq.customerName,
      customerPhone: inq.customerPhone,
      interestedVehicleId: inq.vehicleId,
      interestedVehicleTitle: inq.vehicleTitle,
      stage: 'contacted',
      notes: inq.message || `Promoted from ${inq.inquiryType}`,
    });
    await updateDealerInquiryStatus(shopId, inq.id, 'contacted');
    setTab('leads');
    await load();
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly) return;
    setSavingLead(true);
    setError(null);
    try {
      const veh = vehicles.find((v) => v.id === leadVehicleId);
      const sp = staffList.find((st) => st.uid === leadSalespersonId);
      await saveDealerLead(shopId, {
        customerName: leadName,
        customerPhone: leadPhone,
        interestedVehicleId: veh?.id,
        interestedVehicleTitle: veh?.title,
        assignedSalespersonId: sp?.uid,
        assignedSalespersonName: sp?.name,
        stage: 'new',
        followUpDate: leadFollowUp || undefined,
        notes: leadNotes,
      });
      setLeadName('');
      setLeadPhone('');
      setLeadNotes('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save sales lead.');
    } finally {
      setSavingLead(false);
    }
  };

  const handleLeadStageChange = async (
    lead: DealerLead,
    stage: DealerLead['stage']
  ) => {
    if (!shopId || isReadOnly) return;
    await saveDealerLead(shopId, { ...lead, stage });
    await load();
  };

  const handleRecordDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly || !canCloseDeals) return;
    setSavingDeal(true);
    setError(null);
    try {
      const veh = vehicles.find((v) => v.id === dealVehicleId);
      const sp = staffList.find((st) => st.uid === dealSalespersonId);
      const numericBooking = Math.max(0, Number(bookingAmount || 0));
      const deal = await recordDealerDeal(
        shopId,
        {
          vehicleId: veh?.id || '',
          vehicleTitle: veh?.title || 'Showroom Vehicle',
          buyerName,
          buyerPhone,
          salespersonId: sp?.uid,
          salespersonName: sp?.name,
          agreedPrice: Number(agreedPrice) || 0,
          bookingAmount: numericBooking,
          commissionAmount: Number(commissionAmount) || 0,
          deliveryStatus,
          paymentMethod,
          notes: dealNotes,
        },
        Number(veh?.purchasePrice || 0)
      );

      if (numericBooking > 0) {
        await recordIndustryPayment(shopId, {
          businessType: 'car_dealer',
          customerName: deal.buyerName,
          customerPhone: deal.buyerPhone,
          referenceType: 'dealer_deal',
          referenceId: deal.id,
          description: `Vehicle Deal (${deal.deliveryStatus}) · ${deal.vehicleTitle}`,
          amount: numericBooking,
          method: paymentMethod,
          status: 'paid',
        });
      }

      setBuyerName('');
      setBuyerPhone('');
      setBookingAmount('');
      setDealNotes('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to record vehicle deal.');
    } finally {
      setSavingDeal(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading Showroom Pipeline...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Inquiries, Test Drives, Leads &amp; Deals
          </h2>
          <p className="text-slate-500 mt-0.5">
            Track buyer inquiries from your showroom page, manage follow-ups, assign salespersons &amp; record deals.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setTab('inquiries')}
            className={`px-3.5 py-2 rounded-xl font-bold border ${
              tab === 'inquiries'
                ? 'bg-[#065F46] text-white border-[#065F46]'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            Inquiries ({inquiries.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('leads')}
            className={`px-3.5 py-2 rounded-xl font-bold border ${
              tab === 'leads'
                ? 'bg-[#065F46] text-white border-[#065F46]'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            Sales Leads ({leads.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('deals')}
            className={`px-3.5 py-2 rounded-xl font-bold border ${
              tab === 'deals'
                ? 'bg-[#065F46] text-white border-[#065F46]'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            Closed &amp; Booked Deals ({deals.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium">
          {error}
        </div>
      )}

      {tab === 'inquiries' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-[#065F46]" /> Public Inquiries &amp; Test-Drive Requests
          </h3>
          {inquiries.length === 0 ? (
            <p className="py-10 text-center text-slate-400">
              No public inquiries received yet. Buyers can submit inquiries on your showroom page.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {inquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {inq.vehicleTitle}{' '}
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase ml-1">
                        {inq.inquiryType.replace('_', ' ')}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {inq.customerName} ({inq.customerPhone})
                      {inq.preferredDate ? ` · Preferred Date: ${inq.preferredDate}` : ''}
                    </p>
                    {inq.message && <p className="text-[11px] text-slate-700 mt-1">{inq.message}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isReadOnly && (
                      <>
                        <select
                          value={inq.status}
                          onChange={(e) =>
                            handleInquiryStatus(
                              inq.id,
                              e.target.value as DealerInquiry['status']
                            )
                          }
                          className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="scheduled">Test Drive Scheduled</option>
                          <option value="closed">Closed</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handlePromoteInquiryToLead(inq)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#065F46] font-semibold"
                        >
                          Move to Leads
                        </button>
                      </>
                    )}
                    <a
                      href={formatWhatsAppReminderUrl(
                        inq.customerPhone,
                        `Assalam-o-Alaikum ${inq.customerName}, regarding your inquiry for ${inq.vehicleTitle}: `
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#065F46] font-semibold inline-flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'leads' && (
        <div className="space-y-6">
          {!isReadOnly && (
            <form
              onSubmit={handleSaveLead}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
            >
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#065F46]" /> Add Showroom Buyer Lead
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <input
                  required
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="Buyer Name *"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
                <input
                  required
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="Buyer Phone *"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
                <select
                  value={leadVehicleId}
                  onChange={(e) => setLeadVehicleId(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Interested Vehicle (Optional)</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({formatPKR(v.askingPrice)})
                    </option>
                  ))}
                </select>
                <select
                  value={leadSalespersonId}
                  onChange={(e) => setLeadSalespersonId(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Assign Salesperson</option>
                  {staffList.map((st) => (
                    <option key={st.uid} value={st.uid}>
                      {st.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={leadFollowUp}
                  onChange={(e) => setLeadFollowUp(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <input
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  placeholder="Buyer budget, exchange vehicle or follow-up notes"
                  className="flex-1 min-w-[240px] px-3 py-2 border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={savingLead}
                  className="px-5 py-2 bg-[#065F46] text-white rounded-xl font-bold disabled:opacity-60"
                >
                  {savingLead ? 'Saving...' : 'Save Lead'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#065F46]" /> Active Lead Follow-Ups
            </h3>
            {leads.length === 0 ? (
              <p className="py-10 text-center text-slate-400">No leads added yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {leads.map((l) => (
                  <div
                    key={l.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {l.customerName} ({l.customerPhone})
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {l.interestedVehicleTitle || 'General Showroom Inquiry'}
                        {l.assignedSalespersonName ? ` · Salesperson: ${l.assignedSalespersonName}` : ''}
                        {l.followUpDate ? ` · Follow-up: ${l.followUpDate}` : ''}
                      </p>
                      {l.notes && <p className="text-[11px] text-slate-600 mt-0.5">{l.notes}</p>}
                    </div>
                    {!isReadOnly && (
                      <select
                        value={l.stage}
                        onChange={(e) =>
                          handleLeadStageChange(l, e.target.value as DealerLead['stage'])
                        }
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="test_drive">Test Drive</option>
                        <option value="negotiation">Negotiation</option>
                        <option value="closed_won">Closed Won</option>
                        <option value="closed_lost">Closed Lost</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'deals' && (
        <div className="space-y-6">
          {!isReadOnly && canCloseDeals && (
            <form
              onSubmit={handleRecordDeal}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
            >
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Handshake className="w-4 h-4 text-[#065F46]" /> Record Booking / Vehicle Sale Deal
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <select
                  required
                  value={dealVehicleId}
                  onChange={(e) => {
                    setDealVehicleId(e.target.value);
                    const found = vehicles.find((v) => v.id === e.target.value);
                    if (found) setAgreedPrice(String(found.askingPrice));
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Select Vehicle *</option>
                  {vehicles
                    .filter((v) => v.status !== 'Sold')
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({formatPKR(v.askingPrice)})
                      </option>
                    ))}
                </select>
                <input
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Buyer Full Name *"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
                <input
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="Buyer Phone *"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
                <select
                  value={dealSalespersonId}
                  onChange={(e) => setDealSalespersonId(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Salesperson (Optional)</option>
                  {staffList.map((st) => (
                    <option key={st.uid} value={st.uid}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <input
                  required
                  type="number"
                  min="0"
                  value={agreedPrice}
                  onChange={(e) => setAgreedPrice(e.target.value)}
                  placeholder="Final Agreed Price (PKR) *"
                  className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums font-bold"
                />
                <input
                  required
                  type="number"
                  min="0"
                  value={bookingAmount}
                  onChange={(e) => setBookingAmount(e.target.value)}
                  placeholder="Token / Paid Amount (PKR) *"
                  className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                />
                {canViewPrivatePricing && (
                  <input
                    type="number"
                    min="0"
                    value={commissionAmount}
                    onChange={(e) => setCommissionAmount(e.target.value)}
                    placeholder="Commission (PKR)"
                    className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                )}
                <select
                  value={deliveryStatus}
                  onChange={(e) =>
                    setDeliveryStatus(e.target.value as DealerDeal['deliveryStatus'])
                  }
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="booked">Booked / Token Received (Reserves Car)</option>
                  <option value="payment_pending">Payment Pending (Reserves Car)</option>
                  <option value="delivered">Delivered &amp; Closed (Marks Sold)</option>
                </select>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as ManualPaymentMethod)
                  }
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="ibft">IBFT</option>
                  <option value="cash">Cash</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="jazzcash">JazzCash</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-3">
                <input
                  value={dealNotes}
                  onChange={(e) => setDealNotes(e.target.value)}
                  placeholder="Biometric transfer, token receipt & delivery terms"
                  className="flex-1 min-w-[240px] px-3 py-2 border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={savingDeal}
                  className="px-5 py-2 bg-[#065F46] text-white rounded-xl font-bold disabled:opacity-60"
                >
                  {savingDeal ? 'Recording...' : 'Save Deal'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">Deals &amp; Sales Ledger</h3>
            {deals.length === 0 ? (
              <p className="py-10 text-center text-slate-400">No vehicle deals recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {deals.map((d) => (
                  <div
                    key={d.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{d.vehicleTitle}</p>
                      <p className="text-[11px] text-slate-500">
                        Buyer: {d.buyerName} ({d.buyerPhone}) · Status: {d.deliveryStatus}
                        {d.salespersonName ? ` · Salesperson: ${d.salespersonName}` : ''}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-extrabold text-slate-900">
                        Agreed: {formatPKR(d.agreedPrice)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Paid: {formatPKR(d.bookingAmount)} · Balance: {formatPKR(d.remainingPayment)}
                        {canViewPrivatePricing && d.netProfit !== undefined
                          ? ` · Net Profit: ${formatPKR(d.netProfit)}`
                          : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

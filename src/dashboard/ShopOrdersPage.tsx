import React, { useEffect, useState } from 'react';
import {
  Search,
  Eye,
  Printer,
  Download,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Store,
  ShieldCheck,
  MapPin,
  Calendar,
  Clock,
  KeyRound,
  PackageCheck,
} from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  getAllShopOrdersAdmin,
  updateShopOrderStatus,
  updateSelfPickupStatus,
  verifyAndCollectSelfPickupOrder,
} from '../services/tenantService';
import { Order, OrderStatus, PaymentStatus } from '../types';
import {
  COURIERS,
  formatPKR,
  getPaymentMethodLabel,
  getFulfillmentLabel,
} from '../data/seedData';
import { PrivateReceiptImage } from '../components/common/PrivateReceiptImage';
import { downloadCsvFile } from '../utils/csvUtils';

const STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Accepted',
  'Preparing',
  'Ready for Pickup',
  'Collected',
  'Completed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Returned',
  'Refunded',
];

const PICKUP_STEPS: OrderStatus[] = ['Pending', 'Accepted', 'Preparing', 'Ready for Pickup', 'Collected', 'Completed'];

export const ShopOrdersPage: React.FC = () => {
  const { shopId, shop, isReadOnly } = useDashboard();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'all' | 'delivery' | 'self_pickup'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [courierName, setCourierName] = useState('TCS Express');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [pickupOtpInput, setPickupOtpInput] = useState('');
  const [pickupNoteInput, setPickupNoteInput] = useState('');
  const [markCashCollected, setMarkCashCollected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modalNotice, setModalNotice] = useState<string | null>(null);

  const loadOrders = async () => {
    if (!shopId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await getAllShopOrdersAdmin(shopId);
      setOrders(list);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [shopId]);

  const deliveryCount = orders.filter((o) => o.fulfillmentMethod !== 'self_pickup').length;
  const selfPickupCount = orders.filter((o) => o.fulfillmentMethod === 'self_pickup').length;

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchText =
      !q ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.toLowerCase().includes(q) ||
      o.customer.city.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.orderStatus === statusFilter;
    const matchFulfillment =
      fulfillmentFilter === 'all' ||
      (fulfillmentFilter === 'self_pickup'
        ? o.fulfillmentMethod === 'self_pickup'
        : o.fulfillmentMethod !== 'self_pickup');
    return matchText && matchStatus && matchFulfillment;
  });

  const openModal = (ord: Order) => {
    setSelectedOrder(ord);
    setCourierName(ord.courierName || 'TCS Express');
    setTrackingNumber(ord.trackingNumber || '');
    setPickupOtpInput('');
    setPickupNoteInput('');
    setMarkCashCollected(ord.paymentMethod === 'cod' && ord.paymentStatus !== 'paid');
    setModalNotice(null);
    setErrorMsg(null);
  };

  const handleUpdate = async (
    nextStatus: OrderStatus,
    nextPayment: PaymentStatus
  ) => {
    if (!selectedOrder || isReadOnly) return;
    setSaving(true);
    setErrorMsg(null);
    setModalNotice(null);
    try {
      await updateShopOrderStatus(
        shopId,
        selectedOrder.id,
        {
          orderStatus: nextStatus,
          paymentStatus: nextPayment,
          courierName,
          trackingNumber,
        },
        selectedOrder.orderNumber
      );
      await loadOrders();
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              orderStatus: nextStatus,
              paymentStatus: nextPayment,
              courierName,
              trackingNumber,
            }
          : null
      );
      setModalNotice(`Order updated: ${nextStatus} · Payment ${nextPayment.toUpperCase()}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not update order status.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickupTransition = async (nextStatus: OrderStatus) => {
    if (!selectedOrder || isReadOnly || saving) return;
    setSaving(true);
    setErrorMsg(null);
    setModalNotice(null);
    try {
      const updated = await updateSelfPickupStatus(shopId, selectedOrder.id, nextStatus, pickupNoteInput);
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setPickupNoteInput('');
      setModalNotice(`Self-Pickup status updated to ${updated.orderStatus}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not update pickup order status.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyPickupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || isReadOnly || saving) return;
    setSaving(true);
    setErrorMsg(null);
    setModalNotice(null);
    try {
      const updated = await verifyAndCollectSelfPickupOrder({
        shopId,
        orderId: selectedOrder.id,
        otp: pickupOtpInput,
        markCashPaid: markCashCollected,
      });
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setPickupOtpInput('');
      setModalNotice('6-digit OTP verified, stock deducted cleanly, and order marked Collected.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'OTP verification failed.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    downloadCsvFile(
      `${shop?.slug || shopId}-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ['OrderNumber', 'Date', 'Customer', 'Phone', 'City', 'Fulfillment', 'Payment', 'PaymentStatus', 'OrderStatus', 'TotalPKR'],
      filtered.map((o) => [
        o.orderNumber,
        o.createdAt,
        o.customer.name,
        o.customer.phone,
        o.customer.city,
        o.fulfillmentMethod || 'delivery',
        o.paymentMethod,
        o.paymentStatus,
        o.orderStatus,
        o.total,
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Orders &amp; Invoices</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verify EasyPaisa/JazzCash/IBFT payment receipts, sync courier tracking, and print customer invoices.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start"
        >
          <Download className="w-3.5 h-3.5" /> Export Orders CSV
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2 no-print">
          <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setFulfillmentFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap shrink-0 tabular-nums ${
              fulfillmentFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setFulfillmentFilter('delivery')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap shrink-0 tabular-nums ${
              fulfillmentFilter === 'delivery' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Home Delivery ({deliveryCount})
          </button>
          <button
            type="button"
            onClick={() => setFulfillmentFilter('self_pickup')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap shrink-0 tabular-nums inline-flex items-center gap-1.5 ${
              fulfillmentFilter === 'self_pickup' ? 'bg-white text-emerald-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" /> Self-Pickup ({selfPickupCount})
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order #, customer name, phone, city..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
          >
            <option value="all">All Order Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
        {loading ? (
          <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading orders...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">No orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Method &amp; Fulfillment</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <span className="font-bold font-mono text-slate-900">{o.orderNumber}</span>
                      <span className="block text-[10px] text-slate-400">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{o.customer.name}</p>
                      <p className="text-[11px] text-slate-500">{o.customer.phone} · {o.customer.city}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{getPaymentMethodLabel(o.paymentMethod, o.fulfillmentMethod)}</p>
                      <p className="text-[11px] text-slate-500">{getFulfillmentLabel(o.fulfillmentMethod)}</p>
                      {o.fulfillmentMethod === 'self_pickup' && o.pickupDetails?.pickupDate && (
                        <p className="text-[10px] text-emerald-800 font-semibold tabular-nums mt-0.5">
                          {o.pickupDetails.pickupDate} · {o.pickupDetails.pickupSlotLabel || o.pickupDetails.preferredTime}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold uppercase text-[11px] ${
                        o.paymentStatus === 'paid' ? 'text-emerald-700' : o.paymentStatus === 'failed' ? 'text-red-600' : 'text-amber-700'
                      }`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{o.orderStatus}</td>
                    <td className="py-3 px-4 text-right font-extrabold tabular-nums">{formatPKR(o.total)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openModal(o)}
                        className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg font-semibold inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail & Invoice Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Invoice {selectedOrder.orderNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  {shop?.name} · Placed {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-slate-50"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl">
              <div>
                <p className="font-bold text-slate-900 mb-1">Customer &amp; Shipping</p>
                <p>{selectedOrder.customer.name}</p>
                <p>{selectedOrder.customer.phone}</p>
                <p>{selectedOrder.customer.address}, {selectedOrder.customer.city}</p>
              </div>
              <div>
                <p className="font-bold text-slate-900 mb-1">Payment &amp; Fulfillment</p>
                <p>{getFulfillmentLabel(selectedOrder.fulfillmentMethod)}</p>
                <p>{getPaymentMethodLabel(selectedOrder.paymentMethod, selectedOrder.fulfillmentMethod)}</p>
                {(selectedOrder.paymentReference || selectedOrder.bankSlipReference) && (
                  <p className="font-mono mt-1">
                    TID/Ref: <strong>{selectedOrder.paymentReference || selectedOrder.bankSlipReference}</strong>
                  </p>
                )}
                {selectedOrder.senderAccountNumber && (
                  <p>Sender Account: {selectedOrder.senderAccountNumber}</p>
                )}
                {selectedOrder.fulfillmentMethod === 'self_pickup' && selectedOrder.pickupDetails && (
                  <div className="mt-2 pt-2 border-t border-slate-200 space-y-1 text-[11px]">
                    <p className="font-semibold text-emerald-900 flex items-center gap-1">
                      <Store className="w-3.5 h-3.5" /> {selectedOrder.pickupDetails.locationName}
                    </p>
                    {selectedOrder.pickupDetails.pickupDate && (
                      <p className="text-slate-700 tabular-nums flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-emerald-700" />
                        {selectedOrder.pickupDetails.pickupDate} · {selectedOrder.pickupDetails.pickupSlotLabel || selectedOrder.pickupDetails.preferredTime}
                      </p>
                    )}
                    {selectedOrder.pickupDetails.mapUrl && (
                      <a
                        href={selectedOrder.pickupDetails.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#065F46] font-semibold inline-flex items-center gap-1 hover:underline"
                      >
                        <MapPin className="w-3 h-3" /> Open Outlet Map
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedOrder.paymentProofImage && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-800">Uploaded Payment Proof Receipt</p>
                <PrivateReceiptImage
                  src={selectedOrder.paymentProofImage}
                  alt="Customer payment receipt"
                  className="max-h-60 rounded-xl border border-slate-200 object-contain bg-slate-50"
                />
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="divide-y divide-slate-100">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="text-[11px] text-slate-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-bold tabular-nums">{formatPKR(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between font-extrabold text-sm tabular-nums">
                <span>Total Payable</span>
                <span>{formatPKR(selectedOrder.total)}</span>
              </div>
            </div>

            {modalNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 no-print">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {modalNotice}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2 no-print">
                <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
              </div>
            )}

            {!isReadOnly && selectedOrder.fulfillmentMethod === 'self_pickup' && (
              <div className="pt-4 border-t border-slate-200 space-y-4 text-xs no-print">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <PackageCheck className="w-4 h-4 text-[#065F46]" /> Self-Pickup Counter Workflow
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Advance preparation status and verify customer 6-digit Pickup OTP at handover.
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-600 tabular-nums">
                    Payment:{' '}
                    <span className={`font-bold uppercase ${selectedOrder.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {selectedOrder.paymentStatus}
                    </span>
                    {' · '}
                    Stock:{' '}
                    <span className="font-bold text-slate-900">
                      {selectedOrder.stockDeducted ? 'Deducted' : 'Pending Handover'}
                    </span>
                  </div>
                </div>

                {/* Progress Timeline Strip */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {PICKUP_STEPS.map((step, idx) => {
                    const effectiveStatus = selectedOrder.orderStatus === 'Confirmed' ? 'Accepted' : selectedOrder.orderStatus;
                    const currentIdx = PICKUP_STEPS.indexOf(effectiveStatus as OrderStatus);
                    const reached = currentIdx >= idx;
                    return (
                      <div
                        key={step}
                        className={`px-2 py-1.5 rounded-lg border text-center text-[10px] font-bold ${
                          reached
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        {idx + 1}. {step}
                      </div>
                    );
                  })}
                </div>

                {/* Optional staff note + step action buttons */}
                {selectedOrder.orderStatus !== 'Cancelled' &&
                  selectedOrder.orderStatus !== 'Returned' &&
                  selectedOrder.orderStatus !== 'Refunded' && (
                    <div className="space-y-3">
                      {(selectedOrder.orderStatus === 'Pending' ||
                        selectedOrder.orderStatus === 'Confirmed' ||
                        selectedOrder.orderStatus === 'Accepted' ||
                        selectedOrder.orderStatus === 'Preparing' ||
                        selectedOrder.orderStatus === 'Collected') && (
                        <input
                          type="text"
                          value={pickupNoteInput}
                          onChange={(e) => setPickupNoteInput(e.target.value)}
                          placeholder="Optional counter/packing note for pickup audit log..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                        />
                      )}

                      <div className="flex flex-wrap gap-2">
                        {(selectedOrder.orderStatus === 'Pending' || selectedOrder.orderStatus === 'Confirmed') && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handlePickupTransition('Accepted')}
                            className="px-3.5 py-2.5 bg-[#065F46] hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg font-bold whitespace-nowrap"
                          >
                            Accept Pickup Order
                          </button>
                        )}
                        {(selectedOrder.orderStatus === 'Pending' ||
                          selectedOrder.orderStatus === 'Confirmed' ||
                          selectedOrder.orderStatus === 'Accepted') && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handlePickupTransition('Preparing')}
                            className="px-3.5 py-2.5 bg-slate-900 hover:bg-black disabled:opacity-50 text-white rounded-lg font-bold whitespace-nowrap"
                          >
                            Start Preparing
                          </button>
                        )}
                        {(selectedOrder.orderStatus === 'Accepted' || selectedOrder.orderStatus === 'Preparing') && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handlePickupTransition('Ready for Pickup')}
                            className="px-3.5 py-2.5 bg-[#D97706] hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-bold whitespace-nowrap"
                          >
                            Mark Ready for Pickup
                          </button>
                        )}
                        {selectedOrder.orderStatus === 'Collected' && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handlePickupTransition('Completed')}
                            className="px-3.5 py-2.5 bg-[#065F46] hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg font-bold whitespace-nowrap"
                          >
                            Mark Completed
                          </button>
                        )}
                        {selectedOrder.paymentStatus !== 'paid' && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleUpdate(selectedOrder.orderStatus, 'paid')}
                            className="px-3.5 py-2.5 border border-emerald-300 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 rounded-lg font-bold whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> Mark Payment Paid
                          </button>
                        )}
                        {selectedOrder.orderStatus !== 'Collected' && selectedOrder.orderStatus !== 'Completed' && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handlePickupTransition('Cancelled')}
                            className="px-3.5 py-2.5 border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50 ml-auto whitespace-nowrap"
                          >
                            Cancel Pickup Order
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                {/* Counter OTP Verification Form when Ready for Pickup */}
                {selectedOrder.orderStatus === 'Ready for Pickup' && (
                  <form
                    onSubmit={handleVerifyPickupOtp}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="font-extrabold text-slate-900 flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-[#065F46]" /> Counter 6-Digit Pickup OTP Verification
                      </label>
                      <span className="text-[11px] text-slate-500">Deducts stock once upon verification</span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={pickupOtpInput}
                        onChange={(e) => setPickupOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg font-mono text-sm tracking-[0.25em] tabular-nums bg-white focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={saving || pickupOtpInput.length !== 6}
                        className="px-4 py-2.5 bg-[#065F46] hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Verify OTP &amp; Mark Collected
                      </button>
                    </div>

                    {selectedOrder.paymentMethod === 'cod' && selectedOrder.paymentStatus !== 'paid' && (
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={markCashCollected}
                          onChange={(e) => setMarkCashCollected(e.target.checked)}
                        />
                        Confirm Cash Collected at Counter ({formatPKR(selectedOrder.total)})
                      </label>
                    )}
                  </form>
                )}

                {selectedOrder.pickupVerifiedAt && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" /> Verified &amp; Collected
                    </span>
                    <span className="text-[11px] tabular-nums">
                      {new Date(selectedOrder.pickupVerifiedAt).toLocaleString()} · By {selectedOrder.pickupVerifiedBy}
                    </span>
                  </div>
                )}

                {selectedOrder.pickupHistory && selectedOrder.pickupHistory.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Pickup Audit Timeline
                    </p>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {selectedOrder.pickupHistory.map((h, i) => (
                        <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-[11px] py-1 border-b border-slate-100 last:border-b-0">
                          <div>
                            <span className="font-bold text-slate-800">{h.status}</span>
                            {h.note && <span className="text-slate-500"> · {h.note}</span>}
                          </div>
                          <span className="text-slate-400 tabular-nums">
                            {new Date(h.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isReadOnly && selectedOrder.fulfillmentMethod !== 'self_pickup' && (
              <div className="pt-3 border-t border-slate-200 space-y-3 text-xs no-print">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Courier Service</label>
                    <select
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      {COURIERS.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Courier Tracking Number</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. TCS-77281920"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleUpdate('Confirmed', 'paid')}
                    className="px-3.5 py-2 bg-[#065F46] text-white rounded-lg font-bold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirm &amp; Mark Paid
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleUpdate('Shipped', selectedOrder.paymentStatus)}
                    className="px-3.5 py-2 bg-slate-900 text-white rounded-lg font-bold"
                  >
                    Mark Shipped
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleUpdate('Delivered', 'paid')}
                    className="px-3.5 py-2 border border-emerald-300 text-emerald-800 rounded-lg font-bold hover:bg-emerald-50"
                  >
                    Mark Delivered &amp; Settled
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleUpdate('Cancelled', 'failed')}
                    className="px-3.5 py-2 border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50 ml-auto"
                  >
                    Cancel Order
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

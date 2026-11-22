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
} from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  getAllShopOrdersAdmin,
  updateShopOrderStatus,
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
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Returned',
  'Refunded',
];

export const ShopOrdersPage: React.FC = () => {
  const { shopId, shop, isReadOnly } = useDashboard();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [courierName, setCourierName] = useState('TCS Express');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchText =
      !q ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.toLowerCase().includes(q) ||
      o.customer.city.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.orderStatus === statusFilter;
    return matchText && matchStatus;
  });

  const openModal = (ord: Order) => {
    setSelectedOrder(ord);
    setCourierName(ord.courierName || 'TCS Express');
    setTrackingNumber(ord.trackingNumber || '');
  };

  const handleUpdate = async (
    nextStatus: OrderStatus,
    nextPayment: PaymentStatus
  ) => {
    if (!selectedOrder || isReadOnly) return;
    setSaving(true);
    setErrorMsg(null);
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
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not update order status.');
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

      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
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

            {!isReadOnly && (
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

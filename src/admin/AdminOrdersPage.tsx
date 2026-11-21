import React, { useState, useEffect } from 'react';
import { Search, Download, Printer, X, Store, Image as ImageIcon, ZoomIn } from 'lucide-react';
import { getAllOrdersAdmin, updateOrderStatus } from '../services/storeService';
import { Order, OrderStatus } from '../types';
import { formatPKR, COURIERS, getPaymentMethodLabel, getFulfillmentLabel, FALLBACK_PRODUCT_IMAGE } from '../data/seedData';
import { useToast } from '../components/common/Toast';

export const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [zoomedProof, setZoomedProof] = useState<string | null>(null);

  // Edit order modal fields
  const [editingStatus, setEditingStatus] = useState<OrderStatus>('Pending');
  const [courierName, setCourierName] = useState('TCS Express');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'failed'>('pending');
  const [updating, setUpdating] = useState(false);

  const { showToast } = useToast();

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getAllOrdersAdmin();
      setOrders(data || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const openOrderDrawer = (ord: Order) => {
    setSelectedOrder(ord);
    setEditingStatus(ord.orderStatus);
    setCourierName(ord.courierName || 'TCS Express');
    setTrackingNumber(ord.trackingNumber || '');
    setPaymentStatus(ord.paymentStatus);
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      await updateOrderStatus(
        selectedOrder.id,
        {
          orderStatus: editingStatus,
          courierName: courierName.trim(),
          trackingNumber: trackingNumber.trim(),
          paymentStatus,
        },
        selectedOrder.orderNumber
      );
      showToast(`Order ${selectedOrder.orderNumber} updated!`, 'success');
      setSelectedOrder(null);
      await loadOrders();
    } catch (err: any) {
      showToast(err.message || 'Failed to update order', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (orders.length === 0) {
      showToast('No orders to export', 'info');
      return;
    }
    const headers = [
      'Order Number',
      'Date',
      'Customer Name',
      'Phone',
      'Email',
      'City',
      'Address',
      'Items Count',
      'Subtotal',
      'Shipping Fee',
      'Discount',
      'Total',
      'Fulfillment Method',
      'Payment Method',
      'Payment Status',
      'Payment Reference',
      'Sender Account',
      'Proof Image Attached',
      'Order Status',
      'Courier',
      'Tracking Number',
    ];

    const rows = orders.map((o) => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleDateString(),
      `"${o.customer?.name || ''}"`,
      `"${o.customer?.phone || ''}"`,
      `"${o.customer?.email || ''}"`,
      `"${o.customer?.city || ''}"`,
      `"${(o.customer?.address || '').replace(/"/g, '""')}"`,
      o.items.length,
      o.subtotal,
      o.shippingFee,
      o.discount,
      o.total,
      getFulfillmentLabel(o.fulfillmentMethod),
      getPaymentMethodLabel(o.paymentMethod, o.fulfillmentMethod),
      o.paymentStatus,
      `"${o.paymentReference || o.bankSlipReference || ''}"`,
      `"${o.senderAccountNumber || ''}"`,
      o.paymentProofImage ? 'Yes' : 'No',
      o.orderStatus,
      `"${o.courierName || ''}"`,
      `"${o.trackingNumber || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sbkhush_orders_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Orders exported to CSV file!', 'success');
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.orderStatus !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer?.name?.toLowerCase().includes(q) ||
        o.customer?.phone?.toLowerCase().includes(q) ||
        o.customer?.city?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Admin Table View (hidden on print when invoice modal is open) */}
      <div className={`space-y-6 ${selectedOrder ? 'print:hidden' : ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order Management</h1>
            <p className="text-xs text-slate-500">
              Fulfill consignments, verify EasyPaisa/JazzCash/IBFT transactions, and assign couriers
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
          >
            <Download className="w-4 h-4" /> Export Orders to CSV
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by order number (PK-XXXXXX), customer name, phone, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white w-full sm:w-auto font-medium"
          >
            <option value="all">All Statuses ({orders.length})</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Returned">Returned</option>
            <option value="Refunded">Refunded</option>
          </select>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">
              No orders found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Customer & Destination</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Total (PKR)</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div>{ord.orderNumber}</div>
                        {ord.fulfillmentMethod === 'self_pickup' && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded mt-0.5 font-sans">
                            <Store className="w-2.5 h-2.5" /> Self-Pickup
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800 block truncate max-w-[140px]">
                          {ord.customer?.name}
                        </span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {ord.customer?.city} • 📞 {ord.customer?.phone}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-semibold whitespace-nowrap">
                        {ord.items?.length || 0} items
                      </td>
                      <td className="py-3 px-3 font-extrabold text-slate-900 whitespace-nowrap">
                        {formatPKR(ord.total)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[10px] font-bold block text-slate-700">
                          {getPaymentMethodLabel(ord.paymentMethod, ord.fulfillmentMethod)}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                              ord.paymentStatus === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ord.paymentStatus === 'failed'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ord.paymentStatus}
                          </span>
                          {ord.paymentProofImage && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                              <ImageIcon className="w-2.5 h-2.5" /> Proof
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            ord.orderStatus === 'Delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ord.orderStatus === 'Shipped'
                              ? 'bg-sky-100 text-sky-800'
                              : ord.orderStatus === 'Cancelled'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ord.orderStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openOrderDrawer(ord)}
                          className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail, Management & Printable Invoice Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in print:static print:bg-white print:p-0">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-2xl border border-slate-100 space-y-5 print:max-h-none print:shadow-none print:border-none">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="text-xs text-slate-400 block">Order Invoice & Management</span>
                <h3 className="font-mono font-black text-xl text-slate-900">
                  {selectedOrder.orderNumber}
                </h3>
                <span className="text-[11px] text-slate-400">
                  Placed {new Date(selectedOrder.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700 print:hidden"
                aria-label="Close Order Details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Payment Details */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold text-slate-800 block mb-1">Customer Info:</span>
                <p className="text-slate-900 font-semibold">{selectedOrder.customer.name}</p>
                <p className="text-slate-500 break-all">{selectedOrder.customer.email}</p>
                <p className="text-emerald-800 font-semibold mt-1">
                  📞 {selectedOrder.customer.phone}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-800">
                    {selectedOrder.fulfillmentMethod === 'self_pickup'
                      ? 'Self-Pickup Outlet:'
                      : 'Delivery Address:'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {getFulfillmentLabel(selectedOrder.fulfillmentMethod)}
                  </span>
                </div>
                {selectedOrder.fulfillmentMethod === 'self_pickup' && selectedOrder.pickupDetails ? (
                  <>
                    <p className="font-semibold text-emerald-900">
                      {selectedOrder.pickupDetails.locationName}
                    </p>
                    <p>{selectedOrder.pickupDetails.address}</p>
                    {selectedOrder.pickupDetails.preferredTime && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Preferred Window: {selectedOrder.pickupDetails.preferredTime}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p>{selectedOrder.customer.address}</p>
                    <p className="font-semibold text-slate-900">
                      {selectedOrder.customer.city}, {selectedOrder.customer.postalCode}
                    </p>
                  </>
                )}
              </div>
              <div className="sm:col-span-2 pt-2 border-t border-slate-200 flex flex-wrap justify-between gap-2">
                <div>
                  <span className="text-slate-400 block">Payment Method:</span>
                  <span className="font-bold text-slate-900">
                    {getPaymentMethodLabel(selectedOrder.paymentMethod, selectedOrder.fulfillmentMethod)}
                  </span>
                </div>
                {selectedOrder.senderAccountNumber && (
                  <div>
                    <span className="text-slate-400 block">Sender Wallet #:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedOrder.senderAccountNumber}
                    </span>
                  </div>
                )}
                {(selectedOrder.paymentReference || selectedOrder.bankSlipReference) && (
                  <div>
                    <span className="text-slate-400 block">Transaction TID / Ref:</span>
                    <span className="font-mono font-bold text-emerald-800">
                      {selectedOrder.paymentReference || selectedOrder.bankSlipReference}
                    </span>
                  </div>
                )}
              </div>

              {selectedOrder.paymentProofImage && (
                <div className="sm:col-span-2 pt-3 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block mb-2">
                    Customer Uploaded Payment Proof Screenshot:
                  </span>
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-white border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setZoomedProof(selectedOrder.paymentProofImage!)}
                      className="relative group shrink-0 print:hidden"
                      title="Click to enlarge payment proof"
                    >
                      <img
                        src={selectedOrder.paymentProofImage}
                        alt="Payment Proof Receipt"
                        className="w-20 h-20 object-cover rounded-xl border border-slate-200"
                      />
                      <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center text-white transition">
                        <ZoomIn className="w-5 h-5" />
                      </span>
                    </button>
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-800">
                        Receipt Screenshot Attached
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Inspect the screenshot to verify EasyPaisa / JazzCash / IBFT transfer amount ({formatPKR(selectedOrder.total)}) before marking as Paid.
                      </p>
                      <button
                        type="button"
                        onClick={() => setZoomedProof(selectedOrder.paymentProofImage!)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline print:hidden"
                      >
                        <ZoomIn className="w-3.5 h-3.5" /> View Full-Size Screenshot
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Purchased Items ({selectedOrder.items.length})
              </h4>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto print:max-h-none">
                {selectedOrder.items.map((it, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={it.image || FALLBACK_PRODUCT_IMAGE}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
                        }}
                        alt={it.title}
                        className="w-10 h-10 object-cover rounded-lg border shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{it.title}</p>
                        <p className="text-[10px] text-slate-400">
                          Qty: {it.quantity} • {formatPKR(it.price)}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900 shrink-0">
                      {formatPKR(it.price * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between text-sm font-black text-slate-900">
                <span>Grand Total</span>
                <span className="text-emerald-800">{formatPKR(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Status Update Form */}
            <form onSubmit={handleUpdateOrder} className="space-y-4 pt-4 border-t border-slate-100 print:hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Order Status *
                  </label>
                  <select
                    value={editingStatus}
                    onChange={(e) => setEditingStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Returned">Returned</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Verification Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="pending">Pending Verification</option>
                    <option value="paid">Paid (Verified)</option>
                    <option value="failed">Failed / Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign Courier
                  </label>
                  <select
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    {COURIERS.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tracking / Consignment #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 74829104829"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex flex-wrap justify-between items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintInvoice}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Invoice
                </button>

                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-5 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition disabled:opacity-50"
                  >
                    {updating ? 'Updating...' : 'Save Order Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-Size Payment Proof Lightbox */}
      {zoomedProof && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setZoomedProof(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-2xl p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomedProof(null)}
              aria-label="Close proof preview"
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg hover:bg-black"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={zoomedProof}
              alt="Full Payment Proof"
              className="w-full max-h-[80vh] object-contain rounded-xl bg-slate-50"
            />
          </div>
        </div>
      )}
    </div>
  );
};

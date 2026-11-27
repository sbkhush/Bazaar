import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useSearchParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { CheckCircle2, Truck, Printer, ArrowRight, Store, Image as ImageIcon, Copy, Check, KeyRound, MapPin, Calendar, Clock, Bell, Phone } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { trackShopOrder } from '../services/tenantService';
import { Order } from '../types';
import {
  formatPKR,
  getPaymentMethodLabel,
  getFulfillmentLabel,
  derivePickupStatusFromOrderStatus,
  FALLBACK_PRODUCT_IMAGE,
} from '../data/seedData';
import { useTenant } from '../context/TenantContext';
import { PickupQrPass } from '../components/common/PickupQrPass';
import { PrivateReceiptImage } from '../components/common/PrivateReceiptImage';

export const OrderSuccessPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { shopId, storeBasePath } = useTenant();
  const [order, setOrder] = useState<Order | null>(location.state?.order || null);
  const [copiedToken, setCopiedToken] = useState(false);

  const qOrder = searchParams.get('order') || '';
  const qToken = searchParams.get('token') || '';

  useEffect(() => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}

    if (order) return;

    if (qOrder && qToken) {
      trackShopOrder(shopId, qOrder, qToken)
        .then((res) => {
          if (res) setOrder({ ...res, trackingToken: qToken });
        })
        .catch(() => {});
      return;
    }

    if (id && auth.currentUser?.uid) {
      getDoc(doc(db, 'shops', shopId, 'orders', id))
        .then((snap) => {
          if (snap.exists()) {
            setOrder({ ...(snap.data() as Order), id: snap.id });
          }
        })
        .catch((err) => {
          console.warn('Could not load order receipt directly:', err);
        });
    }
  }, [id, order, shopId, qOrder, qToken]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-6 sm:space-y-8">
      {/* Success banner */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-3xl flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <span className="inline-block text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
          Order Placed Successfully
        </span>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900">
          Shukriya, {order?.customer?.name || 'Customer'}!
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          We have received your order and our dispatch team has begun preparing your parcel.
        </p>
      </div>

      {/* Invoice Card */}
      <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200/80 shadow-lg space-y-6 print:border-none print:shadow-none">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-5">
          <div>
            <span className="text-xs text-slate-400 block">Order Number</span>
            <span className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {order?.orderNumber || `PK-${id?.slice(-6) || '729182'}`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
              Status: {order?.orderStatus || 'Pending'}
            </span>
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition print:hidden"
              title="Print Order Receipt"
              aria-label="Print Order Receipt"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {order?.trackingToken && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-start gap-2">
              <KeyRound className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-950">Secret Parcel Tracking Token</p>
                <p className="text-[11px] text-emerald-800">
                  Save this token with your Order Number to track live parcel updates securely:
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(order.trackingToken || '');
                setCopiedToken(true);
                setTimeout(() => setCopiedToken(false), 2000);
              }}
              className="px-3 py-1.5 bg-white border border-emerald-300 rounded-xl font-mono font-bold text-emerald-900 flex items-center gap-1.5 self-start sm:self-auto shrink-0 hover:bg-emerald-100/50 transition"
            >
              <span>{order.trackingToken}</span>
              {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            </button>
          </div>
        )}

        {order?.fulfillmentMethod === 'self_pickup' && order?.pickupOtp && order.orderStatus !== 'Cancelled' && (
          <PickupQrPass
            orderNumber={order.orderNumber}
            pickupOtp={order.pickupOtp}
            locationName={order.pickupDetails?.locationName}
            pickupVerifiedAt={order.pickupVerifiedAt}
            pickupVerifiedBy={order.pickupVerifiedBy}
          />
        )}

        {order ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-800">
                    {order.fulfillmentMethod === 'self_pickup'
                      ? 'Self-Pickup Location:'
                      : 'Shipping Details:'}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      order.fulfillmentMethod === 'self_pickup'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {getFulfillmentLabel(order.fulfillmentMethod)}
                  </span>
                </div>
                {order.fulfillmentMethod === 'self_pickup' && order.pickupDetails ? (
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-slate-900 font-semibold flex items-center gap-1">
                        <Store className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        {order.pickupDetails.locationName}
                      </p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {order.pickupStatus || derivePickupStatusFromOrderStatus(order.orderStatus)}
                      </span>
                    </div>
                    <p>{order.pickupDetails.address}</p>
                    <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-700" /> {order.pickupDetails.timings}
                      </span>
                      {order.pickupDetails.contactPhone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-700" /> {order.pickupDetails.contactPhone}
                        </span>
                      )}
                    </p>
                    {order.pickupDetails.preparationTime && (
                      <p className="text-[11px] text-slate-600">
                        Estimated Preparation Time: <strong className="text-slate-900">{order.pickupDetails.preparationTime}</strong>
                      </p>
                    )}
                    {(order.pickupDetails.pickupDate || order.pickupDetails.preferredTime) && (
                      <p className="text-[11px] text-emerald-800 font-semibold tabular-nums flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {order.pickupDetails.pickupDate
                          ? `${order.pickupDetails.pickupDate} · ${order.pickupDetails.pickupSlotLabel || ''}`
                          : order.pickupDetails.preferredTime}
                      </p>
                    )}
                    {order.pickupDetails.mapUrl && (
                      <a
                        href={order.pickupDetails.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#065F46] hover:underline"
                      >
                        <MapPin className="w-3 h-3" /> Open Google Maps Directions
                      </a>
                    )}
                    {order.pickupDetails.instructions && (
                      <p className="text-[11px] text-slate-600 pt-0.5">{order.pickupDetails.instructions}</p>
                    )}
                    <p className="text-emerald-800 font-medium mt-1">
                      Collector: {order.customer.name} ({order.customer.phone})
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-slate-900 font-medium">{order.customer.name}</p>
                    <p>{order.customer.address}</p>
                    <p>
                      {order.customer.city}, {order.customer.postalCode}
                    </p>
                    <p className="text-emerald-800 font-medium mt-1">{order.customer.phone}</p>
                  </>
                )}
              </div>
              <div>
                <span className="font-bold text-slate-800 block mb-1">Payment Method:</span>
                <p className="font-semibold text-slate-900">
                  {getPaymentMethodLabel(order.paymentMethod, order.fulfillmentMethod)}
                </p>
                <p className="text-slate-500 mt-1">
                  Payment Status:{' '}
                  <span className="font-bold text-amber-700 capitalize">{order.paymentStatus}</span>
                </p>
                {order.senderAccountNumber && (
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Sender Account:{' '}
                    <span className="font-mono text-slate-800">{order.senderAccountNumber}</span>
                  </p>
                )}
                {(order.paymentReference || order.bankSlipReference) && (
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Transaction Ref:{' '}
                    <span className="font-mono text-slate-800">
                      {order.paymentReference || order.bankSlipReference}
                    </span>
                  </p>
                )}
                {order.paymentProofImage && (
                  <div className="mt-2 pt-2 border-t border-slate-200 flex items-center gap-2.5">
                    <PrivateReceiptImage
                      src={order.paymentProofImage}
                      alt="Uploaded payment proof"
                      className="w-16 h-16 rounded-lg object-cover border border-emerald-200 bg-white shrink-0"
                    />
                    <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" /> Payment Proof Attached
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Order Items</h4>
              <div className="divide-y divide-slate-100">
                {order.items.map((item, index) => (
                  <div key={index} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.image || FALLBACK_PRODUCT_IMAGE}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
                        }}
                        alt={item.title}
                        className="w-12 h-12 object-cover rounded-lg border border-slate-100 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{item.title}</p>
                        <p className="text-[10px] text-slate-400 tabular-nums">
                          Qty: {item.quantity} • {formatPKR(item.price)} each
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-900 shrink-0 tabular-nums">
                      {formatPKR(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2 text-xs text-slate-600 tabular-nums">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900">{formatPKR(order.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping Charges</span>
                <span className="font-medium text-slate-900">
                  {order.shippingFee === 0 ? 'FREE' : formatPKR(order.shippingFee || 0)}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Discount</span>
                  <span>-{formatPKR(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
                <span>Grand Total</span>
                <span className="text-emerald-800">{formatPKR(order.total || 0)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 text-xs text-slate-600">
            Your order is confirmed! Use the Live Courier Tracking button below with your order number to view real-time dispatch updates anytime.
          </div>
        )}
        {order?.customerNotifications && order.customerNotifications.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs print:hidden">
            <p className="font-bold text-slate-800 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-[#065F46]" /> Latest Pickup Updates
            </p>
            {order.customerNotifications.slice(-3).reverse().map((notif) => (
              <p key={notif.id} className="text-[11px] text-slate-600">
                <strong className="text-slate-900">{notif.title}:</strong> {notif.message}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 print:hidden">
        <Link
          to={`${storeBasePath}/tracking?order=${order?.orderNumber || ''}${order?.trackingToken ? `&token=${encodeURIComponent(order.trackingToken)}` : ''}`}
          state={order ? { order } : undefined}
          className="flex-1 py-3 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md"
        >
          {order?.fulfillmentMethod === 'self_pickup' ? (
            <>
              <Store className="w-4 h-4" /> Track Pickup Status
            </>
          ) : (
            <>
              <Truck className="w-4 h-4" /> Live Courier Tracking
            </>
          )}
        </Link>
        <Link
          to={`${storeBasePath}/shop`}
          className="flex-1 py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
        >
          Continue Shopping <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

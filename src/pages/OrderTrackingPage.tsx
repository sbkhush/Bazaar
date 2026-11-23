import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Truck, Search, CheckCircle2, AlertCircle, ExternalLink, Store, Clock, Phone, KeyRound, MapPin, Calendar, ShieldCheck, Bell } from 'lucide-react';
import { Order } from '../types';
import {
  formatPKR,
  COURIERS,
  FALLBACK_PRODUCT_IMAGE,
  getPaymentMethodLabel,
  getFulfillmentLabel,
  derivePickupStatusFromOrderStatus,
} from '../data/seedData';
import { trackShopOrder } from '../services/tenantService';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { PickupQrPass } from '../components/common/PickupQrPass';

export const OrderTrackingPage: React.FC = () => {
  const { shopId, settings } = useTenant();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const stateOrder = (location.state as { order?: Order } | null)?.order || null;
  const initialOrder = searchParams.get('order') || '';
  const initialToken = searchParams.get('token') || '';

  const [inputVal, setInputVal] = useState(initialOrder);
  const [tokenVal, setTokenVal] = useState(initialToken);
  const [order, setOrder] = useState<Order | null>(stateOrder);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async (orderRefToSearch?: string, tokenToUse?: string) => {
    const rawRef = (orderRefToSearch ?? inputVal).trim();
    const rawToken = (tokenToUse ?? tokenVal).trim();
    if (!rawRef) return;

    if (!currentUser && !rawToken) {
      setOrder(null);
      setError('Guest order tracking requires your secret Tracking Token from your order receipt.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const found = await trackShopOrder(shopId, rawRef, rawToken);
      if (found) {
        const preservedOtp =
          !found.pickupOtp &&
          stateOrder?.orderNumber?.toUpperCase() === found.orderNumber?.toUpperCase()
            ? stateOrder.pickupOtp
            : undefined;
        setOrder(preservedOtp ? { ...found, pickupOtp: preservedOtp } : found);
      } else {
        setOrder(null);
        setError(
          currentUser
            ? `No order found matching "${rawRef}" at ${settings.siteName}. Check your order number (e.g. PK-123456) or include your Tracking Token.`
            : `No matching order found for "${rawRef}" with that Tracking Token at ${settings.siteName}.`
        );
      }
    } catch (err) {
      console.warn(err);
      setOrder(null);
      setError('Could not query order status right now. Please try again or contact WhatsApp support.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrder) {
      setInputVal(initialOrder);
      setTokenVal(initialToken);
      if (initialToken || currentUser) {
        handleTrack(initialOrder, initialToken);
      }
    }
  }, [initialOrder, initialToken, shopId, currentUser?.uid]);

  const isSelfPickup = order?.fulfillmentMethod === 'self_pickup';

  const getStepIndex = (status: string, selfPickup: boolean) => {
    if (selfPickup) {
      switch (status) {
        case 'Pending':
          return 0;
        case 'Confirmed':
        case 'Accepted':
          return 1;
        case 'Preparing':
        case 'Processing':
          return 2;
        case 'Ready for Pickup':
          return 3;
        case 'Collected':
        case 'Completed':
        case 'Delivered':
          return 4;
        default:
          return 0;
      }
    }
    switch (status) {
      case 'Pending':
        return 0;
      case 'Confirmed':
        return 1;
      case 'Processing':
        return 2;
      case 'Shipped':
        return 3;
      case 'Delivered':
        return 4;
      default:
        return 0;
    }
  };

  const steps = isSelfPickup
    ? [
        { title: 'Order Placed', desc: 'Order received' },
        { title: 'Confirmed', desc: 'Confirmed by store' },
        { title: 'Preparing', desc: 'Packing items' },
        { title: 'Ready for Pickup', desc: 'Ready at counter' },
        { title: 'Picked Up', desc: 'Code / QR verified' },
      ]
    : [
        { title: 'Order Placed', desc: 'Received & verified' },
        { title: 'Confirmed', desc: 'Order confirmed' },
        { title: 'Processing', desc: 'Quality checked & packed' },
        { title: 'Dispatched / Shipped', desc: 'Handed to courier' },
        { title: 'Delivered', desc: 'Delivered to doorstep' },
      ];

  const currentStep = order ? getStepIndex(order.orderStatus, isSelfPickup) : 0;
  const isCancelled = order?.orderStatus === 'Cancelled' || order?.orderStatus === 'Returned' || order?.orderStatus === 'Refunded';

  const courierInfo = COURIERS.find(
    (c) => c.name.toLowerCase() === order?.courierName?.toLowerCase()
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
          <Truck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Track Your Pickup &amp; Delivery
        </h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Enter your {settings.siteName} Order Number (e.g. PK-123456) to check live store pickup readiness &amp; courier updates.
        </p>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-md max-w-2xl mx-auto space-y-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTrack();
          }}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2"
        >
          <div className="relative sm:col-span-5">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={currentUser ? 'Order # or Mobile' : 'Order # (e.g. PK-123456)'}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-medium"
            />
          </div>
          <div className="relative sm:col-span-4">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={currentUser ? 'Token (optional)' : 'Secret Tracking Token *'}
              value={tokenVal}
              onChange={(e) => setTokenVal(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="sm:col-span-3 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm disabled:opacity-60"
          >
            {loading ? 'Searching...' : 'Track Order'}
          </button>
        </form>
        <p className="text-[11px] text-slate-400">
          {currentUser
            ? 'Signed-in shoppers can look up personal orders by Order # / phone, or enter any guest Tracking Token.'
            : 'For customer privacy, guest parcel tracking requires both your Order Number and Secret Tracking Token.'}
        </p>
      </div>

      {error && (
        <div className="max-w-xl mx-auto p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {order && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg p-5 sm:p-8 space-y-6 sm:space-y-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5">
            <div>
              <span className="text-xs text-slate-400 block">Tracking Order</span>
              <span className="text-xl font-black text-slate-900 font-mono">
                {order.orderNumber}
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                {isSelfPickup ? 'Self-Pickup Outlet:' : 'Destination:'}{' '}
                <strong className="text-slate-800">{order.customer.city}</strong> • {order.customer.name}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {getFulfillmentLabel(order.fulfillmentMethod)} • Payment:{' '}
                {getPaymentMethodLabel(order.paymentMethod, order.fulfillmentMethod)} ({order.paymentStatus})
              </span>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
              <span
                className={`px-3 py-1 rounded-md text-xs font-bold ${
                  isCancelled
                    ? 'bg-rose-100 text-rose-800'
                    : order.orderStatus === 'Delivered' || order.orderStatus === 'Collected' || order.orderStatus === 'Completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : order.orderStatus === 'Ready for Pickup'
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isSelfPickup
                  ? `Pickup Status: ${order.pickupStatus || derivePickupStatusFromOrderStatus(order.orderStatus)}`
                  : `Status: ${order.orderStatus}`}
              </span>
              <span className="text-xs font-extrabold text-slate-900 tabular-nums">
                Amount: {formatPKR(order.total)}
              </span>
            </div>
          </div>

          {isCancelled ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              This order is currently marked as <strong>{order.orderStatus}</strong>. Please contact our customer desk on WhatsApp if you need assistance.
            </div>
          ) : (
            <div className="space-y-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isSelfPickup ? 'Pickup Progress' : 'Delivery Progress'}
              </h4>
              <div className="relative">
                <div className="hidden sm:block absolute top-4 left-6 right-6 h-1 bg-slate-100 z-0">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-700"
                    style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                  />
                </div>
                <div className="sm:hidden absolute top-4 bottom-4 left-4 w-0.5 bg-slate-100 z-0" />

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 relative z-10">
                  {steps.map((step, idx) => {
                    const isDone = idx <= currentStep;
                    return (
                      <div
                        key={idx}
                        className={`flex sm:flex-col items-start sm:items-center sm:text-center gap-3 sm:gap-2 ${
                          isDone ? 'text-slate-900' : 'text-slate-400 opacity-60'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 z-10 ${
                            isDone
                              ? 'bg-emerald-700 text-white shadow-md'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-xs leading-tight">{step.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {isSelfPickup && order.pickupDetails ? (
            <div className="space-y-4">
              {order.pickupOtp && !isCancelled && (
                <PickupQrPass
                  orderNumber={order.orderNumber}
                  pickupOtp={order.pickupOtp}
                  locationName={order.pickupDetails.locationName}
                  pickupVerifiedAt={order.pickupVerifiedAt}
                  pickupVerifiedBy={order.pickupVerifiedBy}
                />
              )}

              {order.pickupVerifiedAt && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Pickup confirmed on <span className="tabular-nums">{new Date(order.pickupVerifiedAt).toLocaleString()}</span>
                    {order.pickupVerifiedBy ? ` (${order.pickupVerifiedBy})` : ''}.
                  </span>
                </div>
              )}

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-emerald-700" />
                    Pickup Counter: {order.pickupDetails.locationName}
                  </div>
                  {order.pickupDetails.mapUrl && (
                    <a
                      href={order.pickupDetails.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[#065F46] text-white rounded-lg font-bold text-[11px] hover:bg-emerald-900 transition inline-flex items-center gap-1"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Google Maps Directions <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-slate-700">{order.pickupDetails.address}</p>
                {(order.pickupDetails.pickupDate || order.pickupDetails.preferredTime) && (
                  <p className="text-[11px] font-semibold text-emerald-900 tabular-nums flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    Scheduled:{' '}
                    {order.pickupDetails.pickupDate
                      ? `${order.pickupDetails.pickupDate} · ${order.pickupDetails.pickupSlotLabel || ''}`
                      : order.pickupDetails.preferredTime}
                  </p>
                )}
                {order.pickupDetails.preparationTime && (
                  <p className="text-[11px] text-slate-600">
                    Estimated Preparation Time: <strong className="text-slate-900">{order.pickupDetails.preparationTime}</strong>
                  </p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-700" /> {order.pickupDetails.timings}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-700" /> {order.pickupDetails.contactPhone}
                  </span>
                </div>
                {order.pickupDetails.instructions && (
                  <p className="text-[11px] text-emerald-900 bg-white/80 p-2 rounded-lg border border-emerald-100">
                    {order.pickupDetails.instructions}
                  </p>
                )}
              </div>

              {order.customerNotifications && order.customerNotifications.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-[#065F46]" /> Store Pickup Notifications
                  </p>
                  {order.customerNotifications.slice(-3).reverse().map((notif) => (
                    <p key={notif.id} className="text-[11px] text-slate-600">
                      <strong className="text-slate-900">{notif.title}:</strong> {notif.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            order.trackingNumber && (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-[11px] font-bold text-emerald-900 block">
                    Courier Partner: {order.courierName || 'TCS Express'}
                  </span>
                  <span className="text-xs text-slate-700">
                    Consignment / Tracking #: <strong className="font-mono">{order.trackingNumber}</strong>
                  </span>
                </div>
                {courierInfo?.trackingUrl && (
                  <a
                    href={`${courierInfo.trackingUrl}?track=${order.trackingNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition flex items-center gap-1.5 shadow-xs"
                  >
                    Open on {order.courierName || 'Courier'} Portal <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )
          )}

          <div className="space-y-3 pt-2">
            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Items in Parcel ({order.items.length})
            </h5>
            <div className="divide-y divide-slate-100">
              {order.items.map((it, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-3 min-w-0">
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
                      <p className="text-[10px] text-slate-400 tabular-nums">Qty: {it.quantity}</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 shrink-0 tabular-nums">{formatPKR(it.price * it.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  Truck,
  Tag,
  Check,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useTenant } from '../context/TenantContext';
import { formatPKR, FALLBACK_PRODUCT_IMAGE, isSelfPickupEnabled } from '../data/seedData';
import { useToast } from '../components/common/Toast';

export const CartPage: React.FC = () => {
  const {
    items,
    removeFromCart,
    updateQuantity,
    clearCart,
    subtotal,
    shippingFee,
    discount,
    total,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    settings,
    fulfillmentMethod,
    setFulfillmentMethod,
  } = useCart();
  const { storeBasePath } = useTenant();

  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    const res = await applyCoupon(couponInput);
    setCouponLoading(false);
    if (res.success) {
      showToast(res.message, 'success');
      setCouponInput('');
    } else {
      showToast(res.message, 'error');
    }
  };

  const threshold = settings.freeShippingThreshold || 3500;
  const remainingForFreeShipping = Math.max(0, threshold - subtotal);
  const progressPercent = Math.min(100, Math.round((subtotal / threshold) * 100));

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-700 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Your Shopping Cart is Empty</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
          You don't have any items in your cart. Explore {settings.siteName} products now!
        </p>
        <Link
          to={`${storeBasePath}/shop`}
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition shadow-md"
        >
          <ArrowLeft className="w-4 h-4" /> Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Shopping Cart</h1>
          <p className="text-xs text-slate-500 mt-1">Review your items before proceeding to checkout</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Trash2 className="w-4 h-4" /> Empty Cart
        </button>
      </div>

      {/* Free Delivery Bar */}
      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-900">
          <Truck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="tabular-nums">
            {remainingForFreeShipping > 0
              ? `Add ${formatPKR(remainingForFreeShipping)} more to get FREE nationwide delivery!`
              : 'You have unlocked FREE Shipping to anywhere in Pakistan!'}
          </span>
        </div>
        <div className="w-full sm:w-48 bg-emerald-200/60 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
            {items.map((item) => {
              const price = item.product.salePrice ?? item.product.regularPrice;
              return (
                <div key={item.itemKey} className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex gap-3 sm:gap-4 items-center min-w-0 w-full sm:w-auto">
                    <img
                      src={item.product.images[0] || FALLBACK_PRODUCT_IMAGE}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
                      }}
                      alt={item.product.title}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-slate-100 bg-slate-50 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                        {item.product.brand}
                      </span>
                      <Link
                        to={`${storeBasePath}/product/${item.product.id}`}
                        className="block font-semibold text-slate-800 text-sm hover:text-emerald-700 transition truncate"
                      >
                        {item.product.title}
                      </Link>
                      {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {Object.entries(item.selectedVariants).map(([k, v]) => (
                            <span
                              key={k}
                              className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium"
                            >
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs font-bold text-slate-900 mt-1 sm:hidden tabular-nums">
                        {formatPKR(price)} each
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto tabular-nums">
                    <div className="hidden sm:block text-right">
                      <span className="text-xs text-slate-400 block">Unit Price</span>
                      <span className="text-xs font-bold text-slate-800">{formatPKR(price)}</span>
                    </div>

                    <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50">
                      <button
                        onClick={() => updateQuantity(item.itemKey, item.quantity - 1)}
                        className="p-2 text-slate-600 hover:bg-slate-200 rounded-l-xl transition"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-bold text-slate-800">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.itemKey, item.quantity + 1)}
                        className="p-2 text-slate-600 hover:bg-slate-200 rounded-r-xl transition"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <div>
                        <span className="text-xs text-slate-400 hidden sm:block">Total</span>
                        <span className="text-sm font-extrabold text-slate-900">
                          {formatPKR(price * item.quantity)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.itemKey)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                        title="Remove item"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-2">
            <Link
              to={`${storeBasePath}/shop`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950"
            >
              <ArrowLeft className="w-4 h-4" /> Continue Shopping
            </Link>
          </div>
        </div>

        {/* Order Summary Card */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Order Summary
          </h3>

          {appliedCoupon ? (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <div>
                  <span className="font-bold text-emerald-900">{appliedCoupon.code}</span>
                  <p className="text-[11px] text-emerald-700">Coupon discount applied</p>
                </div>
              </div>
              <button
                onClick={removeCoupon}
                className="text-rose-600 font-bold hover:underline text-xs"
              >
                Remove
              </button>
            </div>
          ) : (
            <form onSubmit={handleApply} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Voucher Code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 uppercase font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <button
                type="submit"
                disabled={couponLoading}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                Apply
              </button>
            </form>
          )}

          {isSelfPickupEnabled(settings) && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setFulfillmentMethod('delivery')}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                  fulfillmentMethod === 'delivery'
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-900 font-bold'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Truck className="w-4 h-4 shrink-0" />
                <div>
                  <span className="block leading-tight">Delivery</span>
                  <span className="text-[10px] font-normal text-slate-500 tabular-nums">
                    {subtotal >= threshold ? 'Free' : formatPKR(settings.shippingFee)}
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentMethod('self_pickup')}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                  fulfillmentMethod === 'self_pickup'
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-900 font-bold'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Store className="w-4 h-4 shrink-0" />
                <div>
                  <span className="block leading-tight">Self-Pickup</span>
                  <span className="text-[10px] font-bold text-emerald-700">Free (Rs. 0)</span>
                </div>
              </button>
            </div>
          )}

          <div className="space-y-3 text-xs text-slate-600 border-t border-slate-100 pt-4 tabular-nums">
            <div className="flex justify-between">
              <span>Items Subtotal</span>
              <span className="font-semibold text-slate-800">{formatPKR(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>
                {fulfillmentMethod === 'self_pickup'
                  ? 'Self-Pickup (Store Outlet)'
                  : 'Nationwide Courier Delivery'}
              </span>
              <span className="font-semibold text-slate-800">
                {shippingFee === 0 ? (
                  <span className="text-emerald-700 font-bold uppercase text-[11px]">Free</span>
                ) : (
                  formatPKR(shippingFee)
                )}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Voucher Discount</span>
                <span>-{formatPKR(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-200 pt-3">
              <span>Total Amount</span>
              <span className="text-emerald-800">{formatPKR(total)}</span>
            </div>
          </div>

          <button
            onClick={() => navigate(`${storeBasePath}/checkout`)}
            className="w-full py-3.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition"
          >
            Proceed to Checkout <ArrowRight className="w-4 h-4" />
          </button>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-700" /> Secure Pakistani Checkout
            </div>
            <p>Cash on Delivery, EasyPaisa, JazzCash, Bank Transfer, and Card Gateway supported.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

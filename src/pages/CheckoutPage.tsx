import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Truck,
  Building,
  Lock,
  Phone,
  Mail,
  User,
  MapPin,
  AlertCircle,
  Loader2,
  Smartphone,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Store,
  Clock,
  Upload,
  Trash2,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { createShopOrder, getSelfPickupSlotAvailability } from '../services/tenantService';
import { uploadCheckoutPaymentProof } from '../services/storageService';
import {
  formatPKR,
  isValidPakistaniPhone,
  FALLBACK_PRODUCT_IMAGE,
  buildPickupDateOptions,
  isSelfPickupEnabled,
  isCashOnPickupAllowed,
} from '../data/seedData';
import { PaymentMethod, PickupSlotAvailability } from '../types';
import { CitySelect } from '../components/common/CitySelect';
import { useToast } from '../components/common/Toast';

export const CheckoutPage: React.FC = () => {
  const {
    items,
    subtotal,
    shippingFee,
    discount,
    total,
    appliedCoupon,
    clearCart,
    settings,
    fulfillmentMethod,
    setFulfillmentMethod,
  } = useCart();
  const { currentUser, userProfile } = useAuth();
  const { shopId, shop, storeBasePath } = useTenant();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Form Fields
  const [fullName, setFullName] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(userProfile?.phoneNumber || '');
  const [address, setAddress] = useState(userProfile?.addresses?.[0]?.address || '');
  const [city, setCity] = useState(userProfile?.addresses?.[0]?.city || 'Karachi');
  const [postalCode, setPostalCode] = useState(userProfile?.addresses?.[0]?.postalCode || '');
  const pickupDateOptions = React.useMemo(
    () => buildPickupDateOptions(settings.selfPickupDetails?.advanceDays || 5),
    [settings.selfPickupDetails?.advanceDays]
  );
  const [pickupDate, setPickupDate] = useState<string>(() => buildPickupDateOptions(5)[0]?.date || '');
  const [pickupSlots, setPickupSlots] = useState<PickupSlotAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotLoadError, setSlotLoadError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState('');

  // Sync user profile defaults when loaded
  useEffect(() => {
    if (currentUser?.displayName && !fullName) setFullName(currentUser.displayName);
    if (currentUser?.email && !email) setEmail(currentUser.email);
    if (userProfile?.phoneNumber && !phone) setPhone(userProfile.phoneNumber);
    if (userProfile?.addresses?.[0] && !address) {
      setAddress(userProfile.addresses[0].address);
      setCity(userProfile.addresses[0].city || 'Karachi');
      setPostalCode(userProfile.addresses[0].postalCode || '');
    }
  }, [currentUser, userProfile]);

  useEffect(() => {
    if (!pickupDate || !pickupDateOptions.some((d) => d.date === pickupDate)) {
      setPickupDate(pickupDateOptions[0]?.date || '');
    }
  }, [pickupDateOptions, pickupDate]);

  const selfPickupEnabled = isSelfPickupEnabled(settings);

  useEffect(() => {
    if (fulfillmentMethod !== 'self_pickup' || !selfPickupEnabled || !pickupDate) {
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setSlotLoadError(null);
    getSelfPickupSlotAvailability(shopId, pickupDate, settings.selfPickupDetails?.pickupSlots)
      .then((list) => {
        if (!active) return;
        setPickupSlots(list);
        setSelectedSlotId((prev) => {
          const existingAvailable = list.find((s) => s.id === prev && !s.isFull);
          if (existingAvailable) return existingAvailable.id;
          const firstOpen = list.find((s) => !s.isFull);
          return firstOpen ? firstOpen.id : '';
        });
      })
      .catch(() => {
        if (!active) return;
        setSlotLoadError('Could not load pickup slot capacity right now.');
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [fulfillmentMethod, shopId, pickupDate, selfPickupEnabled, settings.selfPickupDetails?.pickupSlots]);

  const codEnabled = settings.codEnabled !== false;
  const allowCashPayment =
    fulfillmentMethod === 'self_pickup' && selfPickupEnabled
      ? isCashOnPickupAllowed(settings)
      : codEnabled;
  const easypaisaEnabled = settings.easypaisaDetails?.enabled !== false;
  const jazzcashEnabled = settings.jazzcashDetails?.enabled !== false;
  const bankEnabled = settings.bankDetails?.enabled !== false;
  const hasEnabledPaymentMethod = allowCashPayment || easypaisaEnabled || jazzcashEnabled || bankEnabled;

  // Payment Selection
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [bankRef, setBankRef] = useState('');
  const [walletRef, setWalletRef] = useState('');
  const [senderWalletPhone, setSenderWalletPhone] = useState('');
  const [paymentProofImage, setPaymentProofImage] = useState<string>('');
  const [paymentProofPreviewUrl, setPaymentProofPreviewUrl] = useState<string>('');
  const [paymentProofFileName, setPaymentProofFileName] = useState<string>('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [checkoutSessionId] = useState(
    () => `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const enabledMap: Record<'cod' | 'easypaisa' | 'jazzcash' | 'bank_transfer', boolean> = {
      cod: allowCashPayment,
      easypaisa: easypaisaEnabled,
      jazzcash: jazzcashEnabled,
      bank_transfer: bankEnabled,
    };
    if (paymentMethod === 'online' || !enabledMap[paymentMethod as keyof typeof enabledMap]) {
      const firstAvailable = (['cod', 'easypaisa', 'jazzcash', 'bank_transfer'] as const).find(
        (m) => enabledMap[m]
      );
      if (firstAvailable) setPaymentMethod(firstAvailable);
    }
  }, [allowCashPayment, easypaisaEnabled, jazzcashEnabled, bankEnabled, paymentMethod]);

  useEffect(() => {
    return () => {
      if (paymentProofPreviewUrl) {
        URL.revokeObjectURL(paymentProofPreviewUrl);
      }
    };
  }, [paymentProofPreviewUrl]);

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    setErrorMessage(null);
    try {
      const uploaded = await uploadCheckoutPaymentProof(shopId, checkoutSessionId, file);
      if (paymentProofPreviewUrl) {
        URL.revokeObjectURL(paymentProofPreviewUrl);
      }
      const localPreview = URL.createObjectURL(file);
      setPaymentProofPreviewUrl(localPreview);
      setPaymentProofImage(uploaded.url);
      setPaymentProofFileName(file.name);
      showToast('Payment proof uploaded securely (private to store admins)!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not upload payment proof', 'error');
      setErrorMessage(err.message || 'Could not upload payment proof image.');
    } finally {
      setUploadingProof(false);
      e.target.value = '';
    }
  };

  const renderPaymentProofUploader = (accentLabel: string) => (
    <div className="pt-3 border-t border-slate-100 space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-slate-700">
          Upload Payment Proof Screenshot / Slip ({accentLabel})
        </label>
        {paymentProofImage && (
          <button
            type="button"
            onClick={() => {
              if (paymentProofPreviewUrl) URL.revokeObjectURL(paymentProofPreviewUrl);
              setPaymentProofPreviewUrl('');
              setPaymentProofImage('');
              setPaymentProofFileName('');
            }}
            className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        )}
      </div>

      {paymentProofImage ? (
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
          <img
            src={paymentProofPreviewUrl || paymentProofImage}
            alt="Payment proof preview"
            className="w-14 h-14 object-cover rounded-lg border border-emerald-300 shrink-0 bg-white"
          />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-emerald-900 block truncate">
              {paymentProofFileName || 'Payment Receipt Attached'}
            </span>
            <span className="text-[10px] text-emerald-700 block">
              Verified screenshot ready to submit with order
            </span>
          </div>
          <label className="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 cursor-pointer shrink-0">
            Change
            <input
              type="file"
              accept="image/*"
              onChange={handleProofFileChange}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <label className="flex flex-col sm:flex-row items-center justify-center gap-2 p-3.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 cursor-pointer transition text-center">
          {uploadingProof ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
              <span className="text-xs font-semibold text-slate-600">Optimizing receipt image...</span>
            </>
          ) : (
            <>
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-emerald-700 shadow-2xs">
                <Upload className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-slate-800 block">
                  Click to Upload Screenshot / Receipt Image
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Supports JPG, PNG, WebP from mobile gallery or camera
                </span>
              </div>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleProofFileChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  );

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    showToast(`${label} copied to clipboard`, 'info');
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">No Items to Checkout</h2>
        <p className="text-xs text-slate-500 mb-6">Your shopping cart is currently empty.</p>
        <Link
          to={`${storeBasePath}/shop`}
          className="px-6 py-3 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition"
        >
          Return to Shop
        </Link>
      </div>
    );
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!isValidPakistaniPhone(phone)) {
      setErrorMessage(
        'Please enter a valid Pakistani mobile number (e.g. 03001234567 or +923001234567).'
      );
      return;
    }
    if (fulfillmentMethod === 'delivery') {
      if (!address.trim()) {
        setErrorMessage('Please provide your complete delivery street address.');
        return;
      }
      if (!city) {
        setErrorMessage('Please select your destination city.');
        return;
      }
    }

    if (paymentMethod === 'bank_transfer' && !bankRef.trim() && !paymentProofImage) {
      setErrorMessage('Please provide your bank transaction ID or upload your transfer slip screenshot.');
      return;
    }

    if (paymentMethod === 'easypaisa' || paymentMethod === 'jazzcash') {
      if (!isValidPakistaniPhone(senderWalletPhone)) {
        setErrorMessage(
          `Please enter your valid ${paymentMethod === 'easypaisa' ? 'EasyPaisa' : 'JazzCash'} mobile account number (e.g. 03001234567).`
        );
        return;
      }
      if (!walletRef.trim() && !paymentProofImage) {
        setErrorMessage(
          `Please enter the ${paymentMethod === 'easypaisa' ? 'EasyPaisa' : 'JazzCash'} Transaction ID (TID) or upload a payment proof image.`
        );
        return;
      }
    }

    if (!hasEnabledPaymentMethod) {
      setErrorMessage('No payment methods are currently enabled for this store. Please contact support.');
      return;
    }

    if (paymentMethod === 'cod' && !allowCashPayment) {
      setErrorMessage('Advance payment is required for Self-Pickup orders at this store. Please select EasyPaisa, JazzCash, or Bank Transfer.');
      return;
    }

    setIsSubmitting(true);

    try {
      const pickup = settings.selfPickupDetails;
      const isPickup = fulfillmentMethod === 'self_pickup' && selfPickupEnabled;
      const selectedSlot = pickupSlots.find((s) => s.id === selectedSlotId);
      if (isPickup) {
        if (!pickupDate) {
          setErrorMessage('Please select a pickup date.');
          setIsSubmitting(false);
          return;
        }
        if (!selectedSlot || selectedSlot.isFull) {
          setErrorMessage('Please choose an available pickup time slot before placing your order.');
          setIsSubmitting(false);
          return;
        }
      }

      const orderPayload = {
        userId: currentUser?.uid || 'guest',
        customer: isPickup
          ? {
              name: fullName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              address: `SELF-PICKUP: ${pickup.title} — ${pickup.address}`,
              city: pickup.city || settings.city || shop?.city || 'Pakistan',
              postalCode: 'PICKUP',
            }
          : {
              name: fullName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              address: address.trim(),
              city,
              postalCode: postalCode.trim() || 'N/A',
            },
        items: items.map((i) => ({
          productId: i.productId,
          title: i.product.title,
          price: i.product.salePrice ?? i.product.regularPrice,
          quantity: i.quantity,
          image: i.product.images[0] || FALLBACK_PRODUCT_IMAGE,
          selectedVariants: i.selectedVariants,
        })),
        subtotal,
        shippingFee,
        discount,
        total,
        couponCode: appliedCoupon?.code,
        fulfillmentMethod: isPickup ? ('self_pickup' as const) : ('delivery' as const),
        pickupDetails: isPickup
          ? {
              locationName: pickup.title,
              address: pickup.address,
              city: pickup.city,
              timings: pickup.timings,
              contactPhone: pickup.contactPhone,
              mapUrl: pickup.mapUrl,
              preparationTime: pickup.preparationTime || '30–45 mins',
              pickupDate,
              pickupSlotId: selectedSlot?.id,
              pickupSlotLabel: selectedSlot?.label,
              preferredTime: selectedSlot ? `${pickupDate} · ${selectedSlot.label}` : pickupDate,
              instructions: pickup.instructions,
            }
          : undefined,
        paymentMethod,
        paymentStatus: 'pending' as const,
        orderStatus: 'Pending' as const,
        notes: orderNotes.trim() || undefined,
        bankSlipReference: paymentMethod === 'bank_transfer' ? bankRef.trim() || undefined : undefined,
        paymentReference:
          paymentMethod === 'easypaisa' || paymentMethod === 'jazzcash'
            ? walletRef.trim() || undefined
            : paymentMethod === 'bank_transfer'
            ? bankRef.trim() || undefined
            : undefined,
        senderAccountNumber:
          paymentMethod === 'easypaisa' || paymentMethod === 'jazzcash'
            ? senderWalletPhone.trim()
            : undefined,
        paymentProofImage:
          paymentMethod === 'easypaisa' ||
          paymentMethod === 'jazzcash' ||
          paymentMethod === 'bank_transfer'
            ? paymentProofImage || undefined
            : undefined,
        idempotencyKey: checkoutSessionId,
      };

      const placedOrder = await createShopOrder(shopId, orderPayload);
      clearCart();
      showToast('Mubarak! Your order has been placed successfully.', 'success');
      navigate(`${storeBasePath}/order-success/${placedOrder.id}`, { state: { order: placedOrder } });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to place order. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      {/* Title */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Checkout & Delivery
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Complete your order via Cash on Delivery, EasyPaisa, JazzCash, or Bank Transfer across Pakistan
        </p>
      </div>

      {/* Mobile Compact Order Total Bar */}
      <div className="lg:hidden mb-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
          className="w-full p-4 flex items-center justify-between text-xs font-bold text-slate-800 bg-slate-50"
        >
          <span className="flex items-center gap-1.5">
            {mobileSummaryOpen ? <ChevronUp className="w-4 h-4 text-emerald-700" /> : <ChevronDown className="w-4 h-4 text-emerald-700" />}
            Order Summary ({items.length} {items.length === 1 ? 'item' : 'items'})
          </span>
          <span className="text-sm font-black text-emerald-800">{formatPKR(total)}</span>
        </button>

        {mobileSummaryOpen && (
          <div className="p-4 border-t border-slate-100 space-y-3 text-xs">
            {items.map((i) => (
              <div key={i.itemKey} className="flex items-center justify-between gap-2">
                <span className="text-slate-700 truncate">
                  {i.quantity}x {i.product.title}
                </span>
                <span className="font-bold text-slate-900 shrink-0">
                  {formatPKR((i.product.salePrice ?? i.product.regularPrice) * i.quantity)}
                </span>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-2 space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPKR(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>{fulfillmentMethod === 'self_pickup' ? 'Self-Pickup' : 'Shipping'}</span>
                <span>{shippingFee === 0 ? 'FREE' : formatPKR(shippingFee)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount</span>
                  <span>-{formatPKR(discount)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
          {/* Left Column: Customer details & Payment */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            {/* 1. Fulfillment Option & Customer Details */}
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center">
                    1
                  </div>
                  <h3 className="font-bold text-base text-slate-900">
                    Choose Your Order Fulfillment Method
                  </h3>
                </div>

                {/* Quick Saved Address Picker for logged-in customers (delivery mode) */}
                {fulfillmentMethod === 'delivery' && userProfile?.addresses && userProfile.addresses.length > 0 && (
                  <select
                    onChange={(e) => {
                      const picked = userProfile.addresses.find((a) => a.id === e.target.value);
                      if (picked) {
                        setFullName(picked.fullName);
                        setPhone(picked.phone);
                        setAddress(picked.address);
                        setCity(picked.city);
                        setPostalCode(picked.postalCode || '');
                        showToast('Saved address filled in!', 'info');
                      }
                    }}
                    defaultValue=""
                    className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden"
                  >
                    <option value="" disabled>
                      Fill Saved Address...
                    </option>
                    {userProfile.addresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.fullName} — {addr.city}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Fulfillment Selector: Home Delivery vs Self-Pickup */}
              {selfPickupEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod('delivery')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                      fulfillmentMethod === 'delivery'
                        ? 'border-emerald-700 bg-emerald-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        fulfillmentMethod === 'delivery'
                          ? 'bg-emerald-800 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900">
                          Home Delivery
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {subtotal >= settings.freeShippingThreshold
                            ? 'FREE'
                            : formatPKR(settings.shippingFee)}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Courier delivery across Pakistan (TCS / Leopards / Trax)
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod('self_pickup')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                      fulfillmentMethod === 'self_pickup'
                        ? 'border-emerald-700 bg-emerald-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        fulfillmentMethod === 'self_pickup'
                          ? 'bg-emerald-800 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900">
                          Self Pickup / Store Pickup
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                          FREE (Rs. 0)
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Collect from {settings.selfPickupDetails.city} outlet · Ready in {settings.selfPickupDetails.preparationTime || '30–45 mins'}
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {/* Store Self-Pickup Outlet Details Banner */}
              {fulfillmentMethod === 'self_pickup' && selfPickupEnabled && (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-emerald-700" />
                      {settings.selfPickupDetails.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {settings.selfPickupDetails.mapUrl && (
                        <a
                          href={settings.selfPickupDetails.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#065F46] text-white font-bold text-[11px] hover:bg-emerald-900 transition"
                        >
                          <MapPin className="w-3 h-3" /> Open in Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy('Pickup Address', settings.selfPickupDetails.address)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 font-bold text-[11px] hover:bg-emerald-100 transition"
                      >
                        {copiedField === 'Pickup Address' ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        Copy Address
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-700 font-medium flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    <span>{settings.selfPickupDetails.address}, {settings.selfPickupDetails.city}</span>
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-700" />
                      Hours: {settings.selfPickupDetails.timings}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-700" />
                      {settings.selfPickupDetails.contactPhone}
                    </span>
                    <span className="font-semibold text-emerald-800">
                      Est. Preparation Time: {settings.selfPickupDetails.preparationTime || '30–45 mins'}
                    </span>
                  </div>
                  {settings.selfPickupDetails.instructions && (
                    <p className="text-[11px] text-emerald-900 bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                      {settings.selfPickupDetails.instructions}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Asad Qureshi"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pakistani Mobile Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      placeholder="0300 1234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {fulfillmentMethod === 'self_pickup'
                      ? 'Used by store counter staff to notify you when pickup is ready.'
                      : 'Used by TCS / Leopards courier rider prior to delivery.'}
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="yourname@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {fulfillmentMethod === 'delivery' ? (
                  <>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Complete Street Address (House / Flat / Street / Area) *
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          required
                          placeholder="House # 14-B, Street 3, Sector F-8/2..."
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        City / Destination *
                      </label>
                      <CitySelect
                        value={city}
                        onChange={setCity}
                        required
                        placeholder="Select destination city..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Postal Code (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 75500"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-700" /> Select Pickup Date *
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {pickupDateOptions.map((opt) => (
                          <button
                            key={opt.date}
                            type="button"
                            onClick={() => setPickupDate(opt.date)}
                            className={`px-3 py-2 min-h-[44px] rounded-xl border text-xs font-semibold transition whitespace-nowrap tabular-nums ${
                              pickupDate === opt.date
                                ? 'border-emerald-700 bg-emerald-800 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-700" /> Select Pickup Time Slot *
                      </label>
                      {loadingSlots ? (
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-700" /> Checking real-time slot capacity...
                        </div>
                      ) : slotLoadError ? (
                        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700">
                          {slotLoadError}
                        </div>
                      ) : pickupSlots.length === 0 ? (
                        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
                          No active pickup slots configured for this store. Please switch to Home Delivery or contact store support.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {pickupSlots.map((slot) => {
                            const isSelected = selectedSlotId === slot.id && !slot.isFull;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                disabled={slot.isFull}
                                onClick={() => setSelectedSlotId(slot.id)}
                                className={`p-3 min-h-[44px] rounded-xl border-2 text-left transition ${
                                  slot.isFull
                                    ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-70'
                                    : isSelected
                                    ? 'border-emerald-700 bg-emerald-50/70 text-slate-900'
                                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                                }`}
                              >
                                <span className="block text-xs font-bold leading-snug">{slot.label}</span>
                                <span className="block text-[11px] mt-1 tabular-nums">
                                  <span className="text-slate-500">{slot.startTime} – {slot.endTime}</span>
                                  <span aria-hidden="true"> · </span>
                                  <span className={slot.isFull ? 'font-bold text-rose-600' : 'font-semibold text-emerald-700'}>
                                    {slot.isFull ? 'Full' : `${slot.remaining} left`}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {fulfillmentMethod === 'self_pickup'
                      ? 'Pickup Notes (Optional)'
                      : 'Order Delivery Instructions (Optional)'}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={
                      fulfillmentMethod === 'self_pickup'
                        ? 'e.g. Someone else will collect on my behalf (mention name)...'
                        : 'e.g. Please deliver after 2 PM or call before arriving...'
                    }
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* 2. Payment Method */}
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-7 h-7 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <h3 className="font-bold text-base text-slate-900">Payment Option</h3>
              </div>

              {fulfillmentMethod === 'self_pickup' && selfPickupEnabled && !allowCashPayment && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {settings.selfPickupDetails?.requireAdvancePayment
                      ? 'This store requires advance payment for Self-Pickup orders. Please pay via EasyPaisa, JazzCash, or Bank Transfer.'
                      : 'Cash on Pickup is disabled for Self-Pickup at this store. Please pay via EasyPaisa, JazzCash, or Bank Transfer.'}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {/* Option 1: Cash on Delivery / Cash on Pickup */}
                {allowCashPayment && (
                  <label
                    className={`block p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition ${
                      paymentMethod === 'cod'
                        ? 'border-emerald-700 bg-emerald-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cod"
                          checked={paymentMethod === 'cod'}
                          onChange={() => setPaymentMethod('cod')}
                          className="mt-1 text-emerald-700 focus:ring-emerald-600"
                        />
                        <div>
                          <span className="font-bold text-sm text-slate-900 block">
                            {fulfillmentMethod === 'self_pickup'
                              ? 'Cash on Pickup (Pay at Counter)'
                              : 'Cash on Delivery (COD)'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {fulfillmentMethod === 'self_pickup'
                              ? 'Pay in cash when collecting your order from our pickup desk.'
                              : 'Pay cash to the courier rider when your parcel arrives at your doorstep.'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md shrink-0">
                        Most Popular 🇵🇰
                      </span>
                    </div>
                  </label>
                )}

                {/* Option 2: EasyPaisa Mobile Wallet */}
                {settings.easypaisaDetails?.enabled !== false && (
                  <label
                    className={`block p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition ${
                      paymentMethod === 'easypaisa'
                        ? 'border-emerald-600 bg-emerald-50/60'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="easypaisa"
                          checked={paymentMethod === 'easypaisa'}
                          onChange={() => setPaymentMethod('easypaisa')}
                          className="mt-1 text-emerald-600 focus:ring-emerald-600"
                        />
                        <div>
                          <span className="font-bold text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                            <span>EasyPaisa Mobile Account</span>
                            <span className="text-[10px] bg-[#00A859] text-white font-bold px-2 py-0.5 rounded-md">
                              EasyPaisa
                            </span>
                          </span>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            Send {formatPKR(total)} directly from your EasyPaisa App / USSD *786#.
                          </span>
                        </div>
                      </div>
                      <Smartphone className="w-5 h-5 text-[#00A859] shrink-0" />
                    </div>

                    {paymentMethod === 'easypaisa' && (
                      <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-white border border-emerald-200 space-y-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <h5 className="font-bold text-[#00A859] uppercase tracking-wider text-[11px]">
                            Official EasyPaisa Account
                          </h5>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy('EasyPaisa Number', settings.easypaisaDetails.accountNumber)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-[11px] hover:bg-emerald-100 transition"
                          >
                            {copiedField === 'EasyPaisa Number' ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            Copy Number
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                          <div>
                            <span className="text-slate-400 block">Account Title:</span>
                            <span className="font-bold text-slate-900">
                              {settings.easypaisaDetails.accountTitle}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">EasyPaisa Mobile #:</span>
                            <span className="font-bold text-slate-900 font-mono">
                              {settings.easypaisaDetails.accountNumber}
                            </span>
                          </div>
                        </div>

                        {settings.easypaisaDetails.instructions && (
                          <p className="text-[11px] text-emerald-900 bg-emerald-50/70 p-2.5 rounded-lg">
                            {settings.easypaisaDetails.instructions}
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Your EasyPaisa Account Number *
                            </label>
                            <input
                              type="tel"
                              required={paymentMethod === 'easypaisa'}
                              placeholder="03XX XXXXXXX"
                              value={senderWalletPhone}
                              onChange={(e) => setSenderWalletPhone(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              EasyPaisa Transaction ID (TID)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 29481029384"
                              value={walletRef}
                              onChange={(e) => setWalletRef(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-mono"
                            />
                          </div>
                        </div>

                        {renderPaymentProofUploader('EasyPaisa')}

                        <span className="text-[10px] text-slate-400 block">
                          Payment status stays pending until our accounts team verifies the TID / screenshot.
                        </span>
                      </div>
                    )}
                  </label>
                )}

                {/* Option 3: JazzCash Mobile Wallet */}
                {settings.jazzcashDetails?.enabled !== false && (
                  <label
                    className={`block p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition ${
                      paymentMethod === 'jazzcash'
                        ? 'border-rose-700 bg-rose-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="jazzcash"
                          checked={paymentMethod === 'jazzcash'}
                          onChange={() => setPaymentMethod('jazzcash')}
                          className="mt-1 text-rose-700 focus:ring-rose-600"
                        />
                        <div>
                          <span className="font-bold text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                            <span>JazzCash Mobile Account</span>
                            <span className="text-[10px] bg-rose-700 text-white font-bold px-2 py-0.5 rounded-md">
                              JazzCash
                            </span>
                          </span>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            Pay securely via JazzCash Mobile App or *786# wallet transfer.
                          </span>
                        </div>
                      </div>
                      <Smartphone className="w-5 h-5 text-rose-700 shrink-0" />
                    </div>

                    {paymentMethod === 'jazzcash' && (
                      <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-white border border-rose-200 space-y-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <h5 className="font-bold text-rose-700 uppercase tracking-wider text-[11px]">
                            Official JazzCash Account
                          </h5>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy('JazzCash Number', settings.jazzcashDetails.accountNumber)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 font-bold text-[11px] hover:bg-rose-100 transition"
                          >
                            {copiedField === 'JazzCash Number' ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            Copy Number
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                          <div>
                            <span className="text-slate-400 block">Account Title:</span>
                            <span className="font-bold text-slate-900">
                              {settings.jazzcashDetails.accountTitle}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">JazzCash Mobile #:</span>
                            <span className="font-bold text-slate-900 font-mono">
                              {settings.jazzcashDetails.accountNumber}
                            </span>
                          </div>
                        </div>

                        {settings.jazzcashDetails.instructions && (
                          <p className="text-[11px] text-rose-900 bg-rose-50/70 p-2.5 rounded-lg">
                            {settings.jazzcashDetails.instructions}
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Your JazzCash Account Number *
                            </label>
                            <input
                              type="tel"
                              required={paymentMethod === 'jazzcash'}
                              placeholder="03XX XXXXXXX"
                              value={senderWalletPhone}
                              onChange={(e) => setSenderWalletPhone(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              JazzCash Transaction ID (TID)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 04192837465"
                              value={walletRef}
                              onChange={(e) => setWalletRef(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-mono"
                            />
                          </div>
                        </div>

                        {renderPaymentProofUploader('JazzCash')}

                        <span className="text-[10px] text-slate-400 block">
                          Order processes as soon as JazzCash TID or proof screenshot is confirmed.
                        </span>
                      </div>
                    )}
                  </label>
                )}

                {/* Option 4: Direct Bank Transfer */}
                {bankEnabled && (
                <label
                  className={`block p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition ${
                    paymentMethod === 'bank_transfer'
                      ? 'border-emerald-700 bg-emerald-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="bank_transfer"
                        checked={paymentMethod === 'bank_transfer'}
                        onChange={() => setPaymentMethod('bank_transfer')}
                        className="mt-1 text-emerald-700 focus:ring-emerald-600"
                      />
                      <div>
                        <span className="font-bold text-sm text-slate-900 block">
                          Direct Bank Transfer / IBFT (Raast)
                        </span>
                        <span className="text-xs text-slate-500">
                          Transfer directly into our {settings.bankDetails.bankName} corporate account via banking app.
                        </span>
                      </div>
                    </div>
                    <Building className="w-5 h-5 text-slate-400 shrink-0" />
                  </div>

                  {paymentMethod === 'bank_transfer' && (
                    <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-white border border-emerald-200 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                          Official Bank Account Details
                        </h5>
                        <button
                          type="button"
                          onClick={() => handleCopy('IBAN', settings.bankDetails.iban)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] hover:bg-slate-200 transition"
                        >
                          {copiedField === 'IBAN' ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          Copy IBAN
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                        <div>
                          <span className="text-slate-400 block">Bank Name:</span>
                          <span className="font-bold text-slate-800">
                            {settings.bankDetails.bankName}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Account Title:</span>
                          <span className="font-bold text-slate-800">
                            {settings.bankDetails.accountTitle}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Account Number:</span>
                          <span className="font-bold text-slate-800 font-mono break-all">
                            {settings.bankDetails.accountNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">IBAN:</span>
                          <span className="font-bold text-slate-800 font-mono text-[11px] break-all">
                            {settings.bankDetails.iban}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Transfer Reference / Transaction ID
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. IBFT-9847291 or Sender Name"
                            value={bankRef}
                            onChange={(e) => setBankRef(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                          />
                        </div>

                        {renderPaymentProofUploader('Bank Receipt')}

                        <span className="text-[10px] text-slate-400 block">
                          Order will be confirmed once transfer slip or reference is verified by our finance desk.
                        </span>
                      </div>
                    </div>
                  )}
                </label>
                )}

                {!hasEnabledPaymentMethod && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      No checkout payment methods are currently enabled by this store. Please contact customer support before placing an order.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Order Review Box */}
          <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6 lg:sticky lg:top-24">
            <h3 className="font-bold text-base text-slate-900 border-b border-slate-100 pb-3">
              Order Items ({items.length})
            </h3>

            {/* Items summary */}
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1 space-y-2">
              {items.map((i) => (
                <div key={i.itemKey} className="pt-2 flex items-center gap-3">
                  <img
                    src={i.product.images[0] || FALLBACK_PRODUCT_IMAGE}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_PRODUCT_IMAGE;
                    }}
                    alt={i.product.title}
                    className="w-12 h-12 rounded-lg object-cover border border-slate-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-semibold text-slate-800 truncate">
                      {i.product.title}
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      Qty: {i.quantity}
                      {i.selectedVariants && Object.keys(i.selectedVariants).length > 0 && (
                        <span> • {Object.values(i.selectedVariants).join(', ')}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-900 shrink-0">
                    {formatPKR((i.product.salePrice ?? i.product.regularPrice) * i.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Pre-Submit Self-Pickup Summary */}
            {fulfillmentMethod === 'self_pickup' && selfPickupEnabled && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                <div className="font-bold text-emerald-900 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-emerald-700" /> Self-Pickup Reservation
                  </span>
                  <span className="text-emerald-800 font-extrabold tabular-nums">Rs. 0 Fee</span>
                </div>
                <p className="text-slate-700 font-medium">{settings.selfPickupDetails.title}</p>
                <p className="text-[11px] text-slate-600 tabular-nums">
                  {pickupDate || 'Select date'} ·{' '}
                  {pickupSlots.find((s) => s.id === selectedSlotId)?.label || 'Select a time slot'}
                </p>
              </div>
            )}

            {/* Cost Breakdown */}
            <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4 tabular-nums">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-800">{formatPKR(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>
                  {fulfillmentMethod === 'self_pickup' ? 'Self-Pickup (Store)' : 'Nationwide Shipping'}
                </span>
                <span className="font-semibold text-slate-800">
                  {shippingFee === 0 ? (
                    <span className="text-emerald-700 font-bold uppercase text-[11px]">
                      {fulfillmentMethod === 'self_pickup' ? 'Free (Pickup)' : 'Free'}
                    </span>
                  ) : (
                    formatPKR(shippingFee)
                  )}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Coupon ({appliedCoupon?.code})</span>
                  <span>-{formatPKR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-3">
                <span>Payable Amount</span>
                <span className="text-emerald-800">{formatPKR(total)}</span>
              </div>
            </div>

            {/* Place Order CTA */}
            <button
              type="submit"
              disabled={isSubmitting || uploadingProof || !hasEnabledPaymentMethod}
              className="w-full py-3.5 sm:py-4 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              {uploadingProof ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading Proof Image...
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Placing Order...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Place Order ({formatPKR(total)})
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              By placing your order, you agree to {settings.siteName}'s terms of service and 7-day return policy.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
};

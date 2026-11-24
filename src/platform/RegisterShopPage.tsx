import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Store,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase/config';
import {
  BUSINESS_TYPE_OPTIONS,
  formatPKR,
  isValidPakistaniPhone,
  isValidShopSlug,
  sanitizeShopSlug,
} from '../data/seedData';
import { BillingCycle, BusinessType, PlatformSettings, SubscriptionPlan } from '../types';
import {
  checkSlugAvailability,
  getPlatformSettings,
  getSubscriptionPlans,
  ownerHasPendingCnicAudit,
  registerNewShop,
} from '../services/platformService';
import {
  clearStoredReferralContext,
  getReferralCodeOwner,
  getStoredReferralContext,
} from '../services/salesService';
import { CitySelect } from '../components/common/CitySelect';
import { CNIC_AUDIT_BLOCK_MESSAGE, formatCnicInput, isValidCnic } from '../utils/cnic';
import { ImageUploader } from '../components/common/ImageUploader';
import { BrandLogo } from '../components/common/BrandLogo';
import { BRAND } from '../config/brand';

export const RegisterShopPage: React.FC = () => {
  const { currentUser, loginWithGoogle, registerWithEmail, refreshMemberships, setActiveShopId } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);

  // Auth fields (if not logged in)
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');

  // Store details
  const [shopName, setShopName] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{ checking: boolean; available?: boolean; reason?: string }>({
    checking: false,
  });
  const [ownerPhone, setOwnerPhone] = useState('');
  const [cnic, setCnic] = useState('');
  const [pendingCnicAudit, setPendingCnicAudit] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType>('general_store');
  const [city, setCity] = useState('Karachi');
  const [address, setAddress] = useState('');

  // Plan & Optional Payment Proof
  const [selectedPlanId, setSelectedPlanId] = useState(searchParams.get('plan') || 'free-starter');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    searchParams.get('cycle') === 'yearly' ? 'yearly' : 'monthly'
  );
  const [submitPaymentNow, setSubmitPaymentNow] = useState(false);
  const [payMethod, setPayMethod] = useState<'easypaisa' | 'jazzcash' | 'bank_transfer'>('easypaisa');
  const [transactionId, setTransactionId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [proofImages, setProofImages] = useState<string[]>([]);

  // Referral / Salesman Attribution
  const [referralCode, setReferralCode] = useState(() => {
    const paramRef = searchParams.get('ref');
    if (paramRef) return paramRef.trim().toUpperCase();
    return getStoredReferralContext().code;
  });
  const [referralOwnerName, setReferralOwnerName] = useState<string | null>(null);
  const [leadId] = useState(() => searchParams.get('leadId') || '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSubscriptionPlans(true).then(setPlans).catch(() => {});
    getPlatformSettings().then(setPlatformSettings).catch(() => {});
  }, []);

  useEffect(() => {
    const code = referralCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      setReferralOwnerName(null);
      return;
    }
    const t = setTimeout(async () => {
      const owner = await getReferralCodeOwner(code);
      setReferralOwnerName(owner && owner.accountStatus === 'active' ? owner.salesmanName : null);
    }, 300);
    return () => clearTimeout(t);
  }, [referralCode]);

  useEffect(() => {
    if (currentUser) {
      setOwnerName((prev) => prev || currentUser.displayName || '');
      setOwnerEmail((prev) => prev || currentUser.email || '');
      ownerHasPendingCnicAudit(currentUser.uid)
        .then(setPendingCnicAudit)
        .catch(() => setPendingCnicAudit(false));
    } else {
      setPendingCnicAudit(false);
    }
  }, [currentUser]);

  // Auto-generate slug from shop name unless manually edited
  useEffect(() => {
    if (!slugTouched && shopName) {
      setShopSlug(sanitizeShopSlug(shopName));
    }
  }, [shopName, slugTouched]);

  // Debounced live slug availability check
  useEffect(() => {
    if (!shopSlug || shopSlug.length < 3) {
      setSlugStatus({ checking: false, available: false, reason: 'Minimum 3 characters required.' });
      return;
    }
    setSlugStatus({ checking: true });
    const timer = setTimeout(async () => {
      const res = await checkSlugAvailability(shopSlug);
      setSlugStatus({ checking: false, available: res.available, reason: res.reason });
    }, 350);
    return () => clearTimeout(timer);
  }, [shopSlug]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
  const isPaidPlan = selectedPlan && selectedPlan.monthlyPrice > 0;
  const planAmount = selectedPlan
    ? billingCycle === 'yearly'
      ? selectedPlan.yearlyPrice
      : selectedPlan.monthlyPrice
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!shopName.trim()) {
      setError('Please enter your store name.');
      return;
    }
    if (!slugStatus.available) {
      setError(slugStatus.reason || 'Please choose an available store URL slug.');
      return;
    }
    if (pendingCnicAudit) {
      setError(CNIC_AUDIT_BLOCK_MESSAGE);
      return;
    }
    if (!isValidPakistaniPhone(ownerPhone)) {
      setError('Please enter a valid Pakistani mobile number (e.g. 03001234567).');
      return;
    }
    if (!isValidCnic(cnic)) {
      setError('Please enter a valid 13-digit Pakistani CNIC number (e.g. 35202-1234567-1).');
      return;
    }
    if (!city.trim()) {
      setError('Please select your store city.');
      return;
    }
    if (!address.trim()) {
      setError('Please enter your store address.');
      return;
    }
    if (isPaidPlan && submitPaymentNow && (!transactionId.trim() || !senderNumber.trim())) {
      setError('Please enter your Transaction ID and sender mobile/account number, or start with the 14-day free trial.');
      return;
    }

    setSubmitting(true);
    try {
      let uid = currentUser?.uid;
      let finalEmail = currentUser?.email || ownerEmail.trim();
      let finalName = ownerName.trim() || currentUser?.displayName || 'Store Owner';

      if (!uid) {
        if (!finalEmail || password.length < 6) {
          throw new Error('Please enter a valid email and a password of at least 6 characters.');
        }
        await registerWithEmail(finalName, finalEmail, password, ownerPhone);
        uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Account created, please try again.');
      }

      let referralSource: 'referral_link' | 'qr_scan' | 'manual_assisted' | 'code_entry' = 'code_entry';
      let referralCapturedAt: string | undefined;
      const storedCtx = getStoredReferralContext();
      if (!storedCtx.expired && storedCtx.code && storedCtx.code === referralCode.trim().toUpperCase()) {
        referralSource = storedCtx.source;
        referralCapturedAt = storedCtx.capturedAt;
      } else if (leadId) {
        referralSource = 'manual_assisted';
      }

      const newShop = await registerNewShop({
        ownerId: uid,
        ownerName: finalName,
        ownerEmail: finalEmail,
        ownerPhone: ownerPhone.trim(),
        cnic: cnic.trim(),
        shopName: shopName.trim(),
        shopSlug,
        businessType,
        city,
        address: address.trim(),
        planId: selectedPlanId,
        billingCycle,
        referralCode: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
        referralSource: referralCode.trim() ? referralSource : undefined,
        referralCapturedAt,
        leadId: leadId || undefined,
        paymentProof:
          isPaidPlan && submitPaymentNow
            ? {
                method: payMethod,
                transactionId: transactionId.trim(),
                senderNumber: senderNumber.trim(),
                proofUrl: proofImages[0] || '',
              }
            : undefined,
      });

      clearStoredReferralContext();

      await refreshMemberships();
      setActiveShopId(newShop.id);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please review your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center">
            <BrandLogo variant="full" tone="dark" size="md" />
          </Link>
          <Link to="/merchant/login" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
            Already have a store? <span className="text-[#065F46] font-bold">Sign In</span>
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="border-b border-slate-100 pb-5 mb-6">
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <Store className="w-6 h-6 text-[#065F46]" />
              Open Your Online Store
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Provision your isolated multi-tenant storefront, inventory admin, and checkout in 60 seconds.
            </p>
          </div>

          {pendingCnicAudit && (
            <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>{CNIC_AUDIT_BLOCK_MESSAGE}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Account Step */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  1. Merchant Account
                </h2>
                {!currentUser && (
                  <button
                    type="button"
                    onClick={() => loginWithGoogle().catch((e) => setError(e.message))}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 transition"
                  >
                    Continue with Google
                  </button>
                )}
              </div>

              {currentUser ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-900">Signed in as:</span>{' '}
                    <span className="text-emerald-800">{currentUser.email}</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Full Name *</label>
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Ali Raza"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="owner@myshop.pk"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Store Profile Step */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                2. Store Identity &amp; Location
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Shop Name *</label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Lahore Heritage Store"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unique Store URL Slug *
                  </label>
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#065F46]">
                    <span className="px-3 py-2.5 bg-slate-50 border-r border-slate-200 text-xs font-mono text-slate-500">
                      /s/
                    </span>
                    <input
                      type="text"
                      required
                      value={shopSlug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setShopSlug(sanitizeShopSlug(e.target.value));
                      }}
                      placeholder="lahore-heritage"
                      className="flex-1 px-3 py-2.5 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div className="mt-1 text-[11px] flex items-center gap-1">
                    {slugStatus.checking ? (
                      <span className="text-slate-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking availability...
                      </span>
                    ) : slugStatus.available ? (
                      <span className="text-emerald-700 font-medium">Available: /s/{shopSlug}</span>
                    ) : (
                      <span className="text-red-600">{slugStatus.reason}</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Mobile (WhatsApp / Support) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="0300 1234567"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Owner CNIC Number (13 digits) *
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={15}
                    value={cnic}
                    onChange={(e) => setCnic(formatCnicInput(e.target.value))}
                    placeholder="35202-1234567-1"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    One SB Khush shop is allowed per CNIC. Verified securely on the server.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <CitySelect
                    value={city}
                    onChange={setCity}
                    required
                    placeholder="Select store city..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Type *</label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                  >
                    {BUSINESS_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Shop Address (also used for Self-Pickup counter) *
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Shop 14, Main Boulevard, Gulberg III"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sales Representative / Referral Code <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder={`e.g. ${BRAND.salesEmployeePrefix}1024`}
                      className="sm:w-72 px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                    />
                    {referralOwnerName && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Referred by {referralOwnerName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Plan Step */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  3. Choose Subscription Plan
                </h2>
                <div className="inline-flex border border-slate-200 rounded-lg p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1 rounded-md ${billingCycle === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-3 py-1 rounded-md ${billingCycle === 'yearly' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                  >
                    Yearly
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {plans.map((p) => {
                  const pPrice = billingCycle === 'yearly' ? p.yearlyPrice : p.monthlyPrice;
                  const active = selectedPlanId === p.id;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`text-left p-4 rounded-xl border transition ${
                        active
                          ? 'border-[#065F46] bg-emerald-50/50 ring-1 ring-[#065F46]'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">{p.name}</span>
                        {active && <CheckCircle2 className="w-4 h-4 text-[#065F46]" />}
                      </div>
                      <p className="text-lg font-extrabold text-slate-900 mt-1 tabular-nums">
                        {pPrice === 0 ? 'Rs. 0 / Free' : `${formatPKR(pPrice)}/${billingCycle === 'yearly' ? 'yr' : 'mo'}`}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {p.maxProducts === -1 ? 'Unlimited' : p.maxProducts}{' '}
                        {p.maxProducts === 1 ? 'product' : 'products'} · {p.maxStorageMB} MB · {p.maxStaff} staff
                      </p>
                    </button>
                  );
                })}
              </div>

              {isPaidPlan && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        Paid Tier Requested ({selectedPlan?.name} — {formatPKR(planAmount)})
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Your store provisions immediately on the active Free Plan (1 active product). Submit payment proof now or anytime in Dashboard -&gt; Subscription so Super Admin activates {selectedPlan?.name}.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={submitPaymentNow}
                        onChange={(e) => setSubmitPaymentNow(e.target.checked)}
                        className="rounded text-[#065F46]"
                      />
                      Submit payment proof now
                    </label>
                  </div>

                  {submitPaymentNow && platformSettings && (
                    <div className="pt-3 border-t border-slate-200 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setPayMethod('easypaisa')}
                          className={`p-2.5 rounded-lg border text-left ${payMethod === 'easypaisa' ? 'border-[#065F46] bg-white' : 'border-slate-200'}`}
                        >
                          <p className="font-bold">EasyPaisa</p>
                          <p className="text-[11px] text-slate-500">{platformSettings.easypaisaDetails.accountNumber}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayMethod('jazzcash')}
                          className={`p-2.5 rounded-lg border text-left ${payMethod === 'jazzcash' ? 'border-[#065F46] bg-white' : 'border-slate-200'}`}
                        >
                          <p className="font-bold">JazzCash</p>
                          <p className="text-[11px] text-slate-500">{platformSettings.jazzcashDetails.accountNumber}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayMethod('bank_transfer')}
                          className={`p-2.5 rounded-lg border text-left ${payMethod === 'bank_transfer' ? 'border-[#065F46] bg-white' : 'border-slate-200'}`}
                        >
                          <p className="font-bold">{platformSettings.bankDetails.bankName}</p>
                          <p className="text-[11px] text-slate-500">{platformSettings.bankDetails.accountNumber}</p>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          placeholder="Transaction ID (TID)"
                          className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                        <input
                          type="text"
                          value={senderNumber}
                          onChange={(e) => setSenderNumber(e.target.value)}
                          placeholder="Your Sender Account / Mobile"
                          className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>

                      {currentUser && isValidShopSlug(sanitizeShopSlug(shopSlug)) ? (
                        <ImageUploader
                          shopId={sanitizeShopSlug(shopSlug)}
                          folder="platform_subscription"
                          images={proofImages}
                          onChange={setProofImages}
                          label="Payment Receipt Screenshot"
                        />
                      ) : (
                        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                          Sign in with Google above (or finish creating your store first and upload your receipt directly inside Dashboard -&gt; Subscription) so your screenshot is securely stored under your merchant account.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Lock className="w-3.5 h-3.5 text-[#065F46]" />
                <span>Isolated tenant storefront &amp; database provisioned automatically.</span>
              </div>

              <button
                type="submit"
                disabled={submitting || !slugStatus.available}
                className="w-full sm:w-auto px-7 py-3.5 bg-[#065F46] hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Provisioning Store...
                  </>
                ) : (
                  <>
                    Launch My Store
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

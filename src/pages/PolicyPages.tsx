import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Store, MapPin, Phone, Mail } from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { getShopPageContent } from '../services/tenantService';
import { ShopPageContent } from '../types';
import { DynamicSeoHead } from '../components/common/DynamicSeoHead';
import { SafeImage } from '../components/common/SafeImage';

const CustomCMSBody: React.FC<{ pageKey: ShopPageContent['key']; fallback: React.ReactNode; titleFallback: string }> = ({
  pageKey,
  fallback,
  titleFallback,
}) => {
  const { shopId, shop, settings } = useTenant();
  const [cmsPage, setCmsPage] = useState<ShopPageContent | null>(null);

  useEffect(() => {
    let active = true;
    getShopPageContent(shopId, pageKey)
      .then((res) => {
        if (active) setCmsPage(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shopId, pageKey]);

  const resolvedTitle = `${cmsPage?.title || titleFallback} | ${settings.siteName}`;
  const resolvedDesc = cmsPage?.content
    ? cmsPage.content.replace(/\s+/g, ' ').trim().slice(0, 155)
    : `${titleFallback} for ${settings.siteName} (${settings.city || 'Pakistan'}).`;

  if (cmsPage && cmsPage.content && cmsPage.content.trim()) {
    return (
      <>
        <DynamicSeoHead
          shop={shop}
          settings={settings}
          pageTitle={resolvedTitle}
          pageDescription={resolvedDesc}
        />
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
          <h1 className="text-3xl font-black text-slate-900">{cmsPage.title || titleFallback}</h1>
          {cmsPage.imageUrl && (
            <SafeImage
              src={cmsPage.imageUrl}
              alt={cmsPage.title || titleFallback}
              className="w-full max-h-72 object-cover rounded-3xl border border-slate-200 shadow-xs"
            />
          )}
          <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {cmsPage.content}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <DynamicSeoHead
        shop={shop}
        settings={settings}
        pageTitle={resolvedTitle}
        pageDescription={resolvedDesc}
      />
      {fallback}
    </>
  );
};

export const AboutPage: React.FC = () => {
  const { settings } = useTenant();
  return (
    <CustomCMSBody
      pageKey="about"
      titleFallback={`About ${settings.siteName}`}
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
          <div className="space-y-2">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
              Our Store
            </span>
            <h1 className="text-3xl font-black text-slate-900">About {settings.siteName}</h1>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <p>
              Welcome to <strong>{settings.siteName}</strong> — your trusted general store in{' '}
              <strong>{settings.city || 'Pakistan'}</strong> offering curated quality essentials with transparent pricing in Pakistani Rupees (PKR).
            </p>
            <p>
              We make shopping convenient with nationwide Cash on Delivery (COD), verified EasyPaisa and JazzCash transfers, bank IBFT, and a free Rs. 0 Self-Pickup counter at our outlet.
            </p>
            {(settings.address || settings.contactPhone || settings.contactEmail) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
                {settings.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 block">Location</span>
                      <span>{settings.address}</span>
                    </div>
                  </div>
                )}
                {settings.contactPhone && (
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 block">Phone / WhatsApp</span>
                      <span>{settings.contactPhone}</span>
                    </div>
                  </div>
                )}
                {settings.contactEmail && (
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 block">Email</span>
                      <span className="break-all">{settings.contactEmail}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {settings.selfPickupDetails?.enabled !== false && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3 text-xs">
                <Store className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-950 block">{settings.selfPickupDetails.title}</span>
                  <span className="text-emerald-800">{settings.selfPickupDetails.timings}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      }
    />
  );
};

export const FAQPage: React.FC = () => {
  const { settings } = useTenant();
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does Cash on Delivery (COD) work across Pakistan?',
      a: `${settings.siteName} offers Cash on Delivery to all major cities and towns via TCS, Leopards Courier, and Trax. Place your order online and pay cash to the rider when your parcel arrives.`,
    },
    {
      q: 'What is your standard delivery timeframe?',
      a: 'Orders shipped to Karachi, Lahore, Rawalpindi, and Islamabad typically arrive in 2-3 business days. Other cities take 3-5 business days.',
    },
    {
      q: 'How can I pay via EasyPaisa, JazzCash, or Bank Transfer?',
      a: 'During checkout, choose EasyPaisa, JazzCash, or Bank Transfer. Send the exact order total, enter your Transaction ID (TID), and upload a screenshot of your payment receipt directly on the checkout page.',
    },
    {
      q: 'Do you offer a Self-Pickup service?',
      a: `Yes! Select "Self-Pickup Service" in your Cart or Checkout to waive shipping charges (Rs. 0). Collect from ${settings.selfPickupDetails?.address || settings.address} once your order status says Ready for Pickup.`,
    },
    {
      q: 'What is your Return and Exchange policy?',
      a: 'We offer a 7-day return and exchange guarantee on unused items in original packaging. Reach out via WhatsApp with your Order Number.',
    },
  ];

  return (
    <CustomCMSBody
      pageKey="faq"
      titleFallback="Frequently Asked Questions"
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
              Help Desk
            </span>
            <h1 className="text-3xl font-black text-slate-900">Frequently Asked Questions</h1>
            <p className="text-xs text-slate-500">
              Everything you need to know about ordering from {settings.siteName}.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs"
                >
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition"
                  >
                    <span className="font-bold text-xs sm:text-sm text-slate-900">{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      }
    />
  );
};

export const ReturnPolicyPage: React.FC = () => {
  const { settings } = useTenant();
  return (
    <CustomCMSBody
      pageKey="return-policy"
      titleFallback="Return & Exchange Policy"
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
          <h1 className="text-3xl font-black text-slate-900">Return & Exchange Policy</h1>
          <p className="text-xs text-slate-500">Store: {settings.siteName}</p>

          <div className="prose max-w-none text-xs text-slate-600 space-y-4 leading-relaxed bg-white p-5 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900">7-Day Guarantee</h3>
            <p>
              At {settings.siteName}, we strive for 100% customer satisfaction. You may request a return or exchange within 7 calendar days from the delivery date.
            </p>
            <h3 className="font-bold text-sm text-slate-900">Eligible Conditions</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>The item must be unused, unwashed, and in its original packaging with tags intact.</li>
              <li>Sealed fragrances, cosmetics, and consumables must remain unopened.</li>
            </ul>
            <h3 className="font-bold text-sm text-slate-900">How to Initiate a Return</h3>
            <p>
              {settings.contactPhone || settings.contactEmail
                ? `Reach out via ${[settings.contactPhone && `WhatsApp desk (${settings.contactPhone})`, settings.contactEmail].filter(Boolean).join(' or ')} with your Order Number and photos of the parcel.`
                : 'Contact our customer support team using the Contact Helpdesk page with your Order Number and photos of the parcel.'}
            </p>
          </div>
        </div>
      }
    />
  );
};

export const TermsPage: React.FC = () => {
  const { settings } = useTenant();
  return (
    <CustomCMSBody
      pageKey="terms"
      titleFallback="Terms & Conditions"
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
          <h1 className="text-3xl font-black text-slate-900">Terms & Conditions</h1>
          <div className="prose max-w-none text-xs text-slate-600 space-y-4 leading-relaxed bg-white p-5 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900">1. Acceptance of Terms</h3>
            <p>
              By purchasing products from {settings.siteName}, you agree to these terms under applicable commerce regulations in Pakistan.
            </p>
            <h3 className="font-bold text-sm text-slate-900">2. Pricing and Currency</h3>
            <p>
              All product prices are quoted in Pakistani Rupees (PKR / Rs.). Shipping fees are calculated at checkout unless Self-Pickup is selected.
            </p>
            <h3 className="font-bold text-sm text-slate-900">3. Orders & Verification</h3>
            <p>
              Orders placed via EasyPaisa, JazzCash, or Bank Transfer are dispatched once payment slip / TID verification is completed by the store finance team.
            </p>
          </div>
        </div>
      }
    />
  );
};

export const PrivacyPage: React.FC = () => {
  const { settings } = useTenant();
  return (
    <CustomCMSBody
      pageKey="privacy"
      titleFallback="Privacy Policy"
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
          <h1 className="text-3xl font-black text-slate-900">Privacy Policy</h1>
          <div className="prose max-w-none text-xs text-slate-600 space-y-4 leading-relaxed bg-white p-5 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900">Data Protection Commitment</h3>
            <p>
              {settings.siteName} respects your privacy and collects customer details (name, Pakistani mobile number, and delivery address) strictly for order fulfillment and parcel tracking.
            </p>
            <h3 className="font-bold text-sm text-slate-900">Payment Security</h3>
            <p>
              Uploaded transfer screenshots are securely stored for transaction reconciliation only and never shared with unauthorized third parties.
            </p>
          </div>
        </div>
      }
    />
  );
};

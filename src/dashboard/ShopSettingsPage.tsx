import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, CheckCircle2, AlertCircle, FileText, ExternalLink, Sparkles } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  updateShopSettings,
  getShopPageContent,
  saveShopPageContent,
} from '../services/tenantService';
import { StoreSettings } from '../types';
import { BRAND, buildShopLegalStarterTemplates } from '../config/brand';

export const ShopSettingsPage: React.FC = () => {
  const { shopId, shop, settings, refreshDashboard, isReadOnly } = useDashboard();
  const [form, setForm] = useState<StoreSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Store-specific legal policies
  const [privacyPolicyText, setPrivacyPolicyText] = useState('');
  const [termsText, setTermsText] = useState('');
  const [savingLegal, setSavingLegal] = useState(false);
  const [legalNotice, setLegalNotice] = useState<string | null>(null);
  const [templateConfirmTarget, setTemplateConfirmTarget] = useState<'privacy' | 'terms' | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    if (!shopId) return;
    let active = true;
    Promise.all([
      getShopPageContent(shopId, 'privacy'),
      getShopPageContent(shopId, 'terms'),
    ])
      .then(([priv, terms]) => {
        if (!active) return;
        setPrivacyPolicyText(priv?.content || '');
        setTermsText(terms?.content || '');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shopId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setSaving(true);
    setSaved(false);
    setErrorMsg(null);
    try {
      await updateShopSettings(shopId, {
        contactPhone: form.contactPhone,
        whatsappNumber: form.whatsappNumber,
        contactEmail: form.contactEmail,
        address: form.address,
        city: form.city,
        shippingFee: Number(form.shippingFee) || 0,
        freeShippingThreshold: Number(form.freeShippingThreshold) || 0,
        codEnabled: form.codEnabled !== false,
        easypaisaDetails: form.easypaisaDetails,
        jazzcashDetails: form.jazzcashDetails,
        bankDetails: {
          ...form.bankDetails,
          enabled: form.bankDetails?.enabled !== false,
        },
        selfPickupDetails: form.selfPickupDetails,
      });
      await refreshDashboard();
      setSaved(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save store settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const applyStarterTemplate = (target: 'privacy' | 'terms') => {
    const slug = shop?.slug || shopId;
    const starter = buildShopLegalStarterTemplates({
      shopName: shop?.name || form.siteName || 'My Store',
      city: form.city || shop?.city,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      storeUrl: `${BRAND.primaryUrl}/s/${slug}`,
    });
    if (target === 'privacy') {
      setPrivacyPolicyText(starter.privacyContent);
    } else {
      setTermsText(starter.termsContent);
    }
    setTemplateConfirmTarget(null);
  };

  const requestStarterTemplate = (target: 'privacy' | 'terms') => {
    const current = target === 'privacy' ? privacyPolicyText : termsText;
    if (current.trim().length > 0) {
      setTemplateConfirmTarget(target);
    } else {
      applyStarterTemplate(target);
    }
  };

  const handleSaveLegalPages = async () => {
    if (isReadOnly || !shopId) return;
    setSavingLegal(true);
    setLegalNotice(null);
    setErrorMsg(null);
    try {
      const storeTitle = shop?.name || form.siteName || 'Our Store';
      const now = new Date().toISOString();
      await Promise.all([
        saveShopPageContent(shopId, {
          key: 'privacy',
          title: `Privacy Policy — ${storeTitle}`,
          content: privacyPolicyText.trim(),
          updatedAt: now,
        }),
        saveShopPageContent(shopId, {
          key: 'terms',
          title: `Terms & Conditions — ${storeTitle}`,
          content: termsText.trim(),
          updatedAt: now,
        }),
      ]);
      setLegalNotice('Store Privacy Policy and Terms & Conditions saved to your storefront.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save store legal pages.');
    } finally {
      setSavingLegal(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Payment, Delivery &amp; Self-Pickup</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure COD, EasyPaisa, JazzCash, Bank Transfer IBFT, shipping charges, and Store Self-Pickup outlet details.
          </p>
        </div>
        {!isReadOnly && (
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-[#065F46] hover:bg-emerald-900 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 self-start"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        )}
      </div>

      {saved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Store settings saved cleanly to your tenant workspace.
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Contact & Shipping */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2 lg:col-span-3 font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
          Contact Details &amp; Nationwide Shipping Rates
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
          <input
            type="text"
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">WhatsApp Order Support Number</label>
          <input
            type="text"
            value={form.whatsappNumber}
            onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Support Email</label>
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Standard Delivery Fee (PKR)</label>
          <input
            type="number"
            min={0}
            value={form.shippingFee}
            onChange={(e) => setForm({ ...form, shippingFee: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Free Shipping Threshold (PKR)</label>
          <input
            type="number"
            min={0}
            value={form.freeShippingThreshold}
            onChange={(e) => setForm({ ...form, freeShippingThreshold: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Store City</label>
          <input
            type="text"
            value={form.city || ''}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Karachi / Lahore / Islamabad"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block font-semibold text-slate-700 mb-1">Store Street Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
      </div>

      {/* COD Global Switch */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Cash on Delivery (COD)</h3>
          <p className="text-[11px] text-slate-500">
            Allow customers to pay cash on delivery to courier riders across Pakistan.
          </p>
        </div>
        <label className="flex items-center gap-2 font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={form.codEnabled !== false}
            onChange={(e) => setForm({ ...form, codEnabled: e.target.checked })}
          />
          Enable COD
        </label>
      </div>

      {/* EasyPaisa, JazzCash & Bank */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">EasyPaisa Wallet</h3>
            <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={form.easypaisaDetails.enabled}
                onChange={(e) =>
                  setForm({ ...form, easypaisaDetails: { ...form.easypaisaDetails, enabled: e.target.checked } })
                }
              />
              Enabled
            </label>
          </div>
          <input
            type="text"
            value={form.easypaisaDetails.accountTitle}
            onChange={(e) =>
              setForm({ ...form, easypaisaDetails: { ...form.easypaisaDetails, accountTitle: e.target.value } })
            }
            placeholder="Account Title"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={form.easypaisaDetails.accountNumber}
            onChange={(e) =>
              setForm({ ...form, easypaisaDetails: { ...form.easypaisaDetails, accountNumber: e.target.value } })
            }
            placeholder="0345 1234567"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
          <textarea
            rows={2}
            value={form.easypaisaDetails.instructions || ''}
            onChange={(e) =>
              setForm({ ...form, easypaisaDetails: { ...form.easypaisaDetails, instructions: e.target.value } })
            }
            placeholder="Checkout instructions"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">JazzCash Wallet</h3>
            <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={form.jazzcashDetails.enabled}
                onChange={(e) =>
                  setForm({ ...form, jazzcashDetails: { ...form.jazzcashDetails, enabled: e.target.checked } })
                }
              />
              Enabled
            </label>
          </div>
          <input
            type="text"
            value={form.jazzcashDetails.accountTitle}
            onChange={(e) =>
              setForm({ ...form, jazzcashDetails: { ...form.jazzcashDetails, accountTitle: e.target.value } })
            }
            placeholder="Account Title"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={form.jazzcashDetails.accountNumber}
            onChange={(e) =>
              setForm({ ...form, jazzcashDetails: { ...form.jazzcashDetails, accountNumber: e.target.value } })
            }
            placeholder="0300 1234567"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
          <textarea
            rows={2}
            value={form.jazzcashDetails.instructions || ''}
            onChange={(e) =>
              setForm({ ...form, jazzcashDetails: { ...form.jazzcashDetails, instructions: e.target.value } })
            }
            placeholder="Checkout instructions"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">Bank Transfer / IBFT</h3>
            <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={form.bankDetails.enabled !== false}
                onChange={(e) =>
                  setForm({ ...form, bankDetails: { ...form.bankDetails, enabled: e.target.checked } })
                }
              />
              Enabled
            </label>
          </div>
          <input
            type="text"
            value={form.bankDetails.bankName}
            onChange={(e) => setForm({ ...form, bankDetails: { ...form.bankDetails, bankName: e.target.value } })}
            placeholder="Bank Name"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={form.bankDetails.accountTitle}
            onChange={(e) =>
              setForm({ ...form, bankDetails: { ...form.bankDetails, accountTitle: e.target.value } })
            }
            placeholder="Account Title"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={form.bankDetails.accountNumber}
            onChange={(e) =>
              setForm({ ...form, bankDetails: { ...form.bankDetails, accountNumber: e.target.value } })
            }
            placeholder="Account Number"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
          />
          <input
            type="text"
            value={form.bankDetails.iban}
            onChange={(e) => setForm({ ...form, bankDetails: { ...form.bankDetails, iban: e.target.value } })}
            placeholder="PK.. IBAN"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
          />
        </div>
      </div>

      {/* Self-Pickup Service */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Self-Pickup Outlet Service</h3>
            <p className="text-[11px] text-slate-500">
              Allow local customers to pick up parcels in person with zero courier charges.
            </p>
          </div>
          <label className="flex items-center gap-2 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={form.selfPickupDetails.enabled}
              onChange={(e) =>
                setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, enabled: e.target.checked } })
              }
            />
            Enable Self-Pickup
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={form.selfPickupDetails.title}
            onChange={(e) =>
              setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, title: e.target.value } })
            }
            placeholder="Outlet Name"
            className="px-3 py-2 border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={form.selfPickupDetails.city}
            onChange={(e) =>
              setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, city: e.target.value } })
            }
            placeholder="City"
            className="px-3 py-2 border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={form.selfPickupDetails.address}
            onChange={(e) =>
              setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, address: e.target.value } })
            }
            placeholder="Street Address"
            className="px-3 py-2 border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={form.selfPickupDetails.timings}
            onChange={(e) =>
              setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, timings: e.target.value } })
            }
            placeholder="Opening Hours"
            className="px-3 py-2 border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={form.selfPickupDetails.contactPhone}
            onChange={(e) =>
              setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, contactPhone: e.target.value } })
            }
            placeholder="Pickup Desk Phone Number"
            className="px-3 py-2 border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={form.selfPickupDetails.instructions || ''}
            onChange={(e) =>
              setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, instructions: e.target.value } })
            }
            placeholder="Customer Pickup Instructions"
            className="px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
      </div>

      {/* Store-Specific Legal Policies (/s/:shopSlug/privacy-policy & /terms-and-conditions) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#065F46]" />
              Store Privacy Policy &amp; Terms &amp; Conditions
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Published exclusively for shoppers visiting your storefront (separate from {BRAND.name} platform policies).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/s/${shop?.slug || shopId}/privacy-policy`}
              target="_blank"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold inline-flex items-center gap-1"
            >
              Preview Privacy <ExternalLink className="w-3 h-3" />
            </Link>
            <Link
              to={`/s/${shop?.slug || shopId}/terms-and-conditions`}
              target="_blank"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold inline-flex items-center gap-1"
            >
              Preview Terms <ExternalLink className="w-3 h-3" />
            </Link>
            {!isReadOnly && (
              <button
                type="button"
                disabled={savingLegal}
                onClick={handleSaveLegalPages}
                className="px-3.5 py-1.5 rounded-lg bg-[#065F46] hover:bg-emerald-900 disabled:opacity-60 text-white text-[11px] font-bold inline-flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {savingLegal ? 'Saving Policies...' : 'Save Legal Policies'}
              </button>
            )}
          </div>
        </div>

        {legalNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {legalNotice}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700">
                Store Privacy Policy (<code className="font-mono text-[11px]">/s/{shop?.slug || shopId}/privacy-policy</code>)
              </label>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => requestStarterTemplate('privacy')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#065F46] hover:underline"
                >
                  <Sparkles className="w-3 h-3" /> Load Starter Template
                </button>
              )}
            </div>
            <textarea
              rows={8}
              value={privacyPolicyText}
              onChange={(e) => setPrivacyPolicyText(e.target.value)}
              placeholder="Write your store's customer privacy policy or click 'Load Starter Template'..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl leading-relaxed"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700">
                Store Terms &amp; Conditions (<code className="font-mono text-[11px]">/s/{shop?.slug || shopId}/terms-and-conditions</code>)
              </label>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => requestStarterTemplate('terms')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#065F46] hover:underline"
                >
                  <Sparkles className="w-3 h-3" /> Load Starter Template
                </button>
              )}
            </div>
            <textarea
              rows={8}
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              placeholder="Write your store's purchase, shipping & return terms or click 'Load Starter Template'..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl leading-relaxed"
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
          Starter templates are general operational drafts for Pakistani eCommerce stores (not formal legal advice). Review and tailor them to match your store&apos;s refund, courier, and payment terms.
        </p>
      </div>

      {templateConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Replace Existing {templateConfirmTarget === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Loading the starter template will overwrite your current draft in this editor box. Your published storefront won&apos;t change until you click <strong>Save Legal Policies</strong>.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTemplateConfirmTarget(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => applyStarterTemplate(templateConfirmTarget)}
                className="px-4 py-2 bg-[#065F46] hover:bg-emerald-900 text-white rounded-lg text-xs font-bold"
              >
                Replace Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

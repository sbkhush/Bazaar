import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, CheckCircle2, AlertCircle, FileText, ExternalLink, Sparkles, MapPin, Clock, Plus, Trash2, RotateCcw } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  updateShopSettings,
  getShopPageContent,
  saveShopPageContent,
  normalizePickupSlots,
} from '../services/tenantService';
import { StoreSettings, PickupSlotConfig } from '../types';
import { BRAND, buildShopLegalStarterTemplates } from '../config/brand';
import { getDefaultPickupSlots } from '../data/seedData';

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
        selfPickupDetails: {
          ...form.selfPickupDetails,
          enabled: form.selfPickupDetails.enabled === true,
          preparationTime: form.selfPickupDetails.preparationTime?.trim() || '30–45 mins',
          requireAdvancePayment: Boolean(form.selfPickupDetails.requireAdvancePayment),
          cashOnPickupEnabled: form.selfPickupDetails.requireAdvancePayment
            ? false
            : form.selfPickupDetails.cashOnPickupEnabled !== false,
          mapUrl: form.selfPickupDetails.mapUrl?.trim() || undefined,
          advanceDays: Math.max(1, Math.min(14, Number(form.selfPickupDetails.advanceDays) || 5)),
          pickupSlots: normalizePickupSlots(form.selfPickupDetails.pickupSlots),
        },
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

      {/* Order Fulfillment Settings */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Order Fulfillment Settings (Self Pickup / Store Pickup)
            </h3>
            <p className="text-[11px] text-slate-500">
              Disabled by default. Enable Store Pickup, set preparation time, pickup rules, payment rules, and time-slot capacity.
            </p>
          </div>
          <label className="flex items-center gap-2 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={form.selfPickupDetails.enabled === true}
              onChange={(e) =>
                setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, enabled: e.target.checked } })
              }
            />
            Enable Self-Pickup
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Outlet Name</label>
            <input
              type="text"
              value={form.selfPickupDetails.title}
              onChange={(e) =>
                setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, title: e.target.value } })
              }
              placeholder="Outlet Name"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Outlet City</label>
            <input
              type="text"
              value={form.selfPickupDetails.city}
              onChange={(e) =>
                setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, city: e.target.value } })
              }
              placeholder="City"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Pickup Desk Phone Number</label>
            <input
              type="text"
              value={form.selfPickupDetails.contactPhone}
              onChange={(e) =>
                setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, contactPhone: e.target.value } })
              }
              placeholder="+92 300 0000000"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Outlet Street Address</label>
            <input
              type="text"
              value={form.selfPickupDetails.address}
              onChange={(e) =>
                setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, address: e.target.value } })
              }
              placeholder="Street Address & Landmark"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Opening Hours</label>
            <input
              type="text"
              value={form.selfPickupDetails.timings}
              onChange={(e) =>
                setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, timings: e.target.value } })
              }
              placeholder="10:00 AM – 9:30 PM"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Estimated Preparation Time</label>
            <input
              type="text"
              value={form.selfPickupDetails.preparationTime || ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  selfPickupDetails: { ...form.selfPickupDetails, preparationTime: e.target.value },
                })
              }
              placeholder="e.g. 30–45 mins"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#065F46]" /> Google Maps Link (Optional)
            </label>
            <input
              type="url"
              value={form.selfPickupDetails.mapUrl || ''}
              onChange={(e) =>
                setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, mapUrl: e.target.value } })
              }
              placeholder="https://maps.google.com/?q=..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Advance Booking Window (Days)</label>
            <input
              type="number"
              min={1}
              max={14}
              value={form.selfPickupDetails.advanceDays ?? 5}
              onChange={(e) =>
                setForm({
                  ...form,
                  selfPickupDetails: {
                    ...form.selfPickupDetails,
                    advanceDays: Math.max(1, Math.min(14, Number(e.target.value) || 5)),
                  },
                })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block font-semibold text-slate-700 mb-1">Customer Pickup Instructions</label>
            <input
              type="text"
              value={form.selfPickupDetails.instructions || ''}
              onChange={(e) =>
                setForm({ ...form, selfPickupDetails: { ...form.selfPickupDetails, instructions: e.target.value } })
              }
              placeholder="e.g. Show your Order Number and 6-digit Pickup Code or QR at the store counter."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.selfPickupDetails.requireAdvancePayment === true}
                onChange={(e) => {
                  const reqAdv = e.target.checked;
                  setForm({
                    ...form,
                    selfPickupDetails: {
                      ...form.selfPickupDetails,
                      requireAdvancePayment: reqAdv,
                      cashOnPickupEnabled: reqAdv ? false : form.selfPickupDetails.cashOnPickupEnabled !== false,
                    },
                  });
                }}
              />
              <div>
                <span className="font-bold text-slate-900 block">Require Advance Payment for Self-Pickup</span>
                <span className="text-[11px] text-slate-500">
                  Only allow EasyPaisa, JazzCash, or Bank Transfer on pickup orders (disables Cash on Pickup).
                </span>
              </div>
            </label>
            <label
              className={`flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 ${
                form.selfPickupDetails.requireAdvancePayment ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                disabled={form.selfPickupDetails.requireAdvancePayment === true}
                checked={
                  !form.selfPickupDetails.requireAdvancePayment &&
                  form.selfPickupDetails.cashOnPickupEnabled !== false
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    selfPickupDetails: {
                      ...form.selfPickupDetails,
                      cashOnPickupEnabled: e.target.checked,
                    },
                  })
                }
              />
              <div>
                <span className="font-bold text-slate-900 block">Enable Cash on Pickup (Pay at Counter)</span>
                <span className="text-[11px] text-slate-500">
                  Allow customers to pay cash directly at the store counter when collecting their order.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Pickup Time Slots Editor */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#065F46]" /> Scheduled Pickup Time Slots
              </h4>
              <p className="text-[11px] text-slate-500">
                Shoppers pick an open date and time window at checkout. Full slots lock automatically.
              </p>
            </div>
            {!isReadOnly && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      selfPickupDetails: {
                        ...prev.selfPickupDetails,
                        pickupSlots: getDefaultPickupSlots(),
                      },
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentSlots = normalizePickupSlots(form.selfPickupDetails.pickupSlots);
                    const nextSlot: PickupSlotConfig = {
                      id: `slot_${Date.now().toString(36)}`,
                      label: `Custom Slot ${currentSlots.length + 1} (5:00 PM – 8:00 PM)`,
                      startTime: '17:00',
                      endTime: '20:00',
                      maxOrdersPerSlot: 10,
                      isActive: true,
                    };
                    setForm((prev) => ({
                      ...prev,
                      selfPickupDetails: {
                        ...prev.selfPickupDetails,
                        pickupSlots: [...currentSlots, nextSlot],
                      },
                    }));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#065F46] hover:bg-emerald-900 text-white text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Time Slot
                </button>
              </div>
            )}
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {normalizePickupSlots(form.selfPickupDetails.pickupSlots).map((slot, idx, allSlots) => {
              const updateSlot = (patch: Partial<PickupSlotConfig>) => {
                const updated = allSlots.map((item, i) => (i === idx ? { ...item, ...patch } : item));
                setForm((prev) => ({
                  ...prev,
                  selfPickupDetails: {
                    ...prev.selfPickupDetails,
                    pickupSlots: updated,
                  },
                }));
              };
              const removeSlot = () => {
                if (allSlots.length <= 1) return;
                const updated = allSlots.filter((_, i) => i !== idx);
                setForm((prev) => ({
                  ...prev,
                  selfPickupDetails: {
                    ...prev.selfPickupDetails,
                    pickupSlots: updated,
                  },
                }));
              };

              return (
                <div
                  key={slot.id}
                  className="p-3 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center bg-white hover:bg-slate-50/50"
                >
                  <div className="md:col-span-5">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Window Label</label>
                    <input
                      type="text"
                      value={slot.label}
                      onChange={(e) => updateSlot({ label: e.target.value })}
                      placeholder="Morning (10:00 AM – 1:00 PM)"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Start</label>
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateSlot({ startTime: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">End</label>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => updateSlot({ endTime: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Cap</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={slot.maxOrdersPerSlot}
                      onChange={(e) =>
                        updateSlot({ maxOrdersPerSlot: Math.max(1, Math.min(500, Number(e.target.value) || 10)) })
                      }
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-4">
                    <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slot.isActive !== false}
                        onChange={(e) => updateSlot({ isActive: e.target.checked })}
                      />
                      Active
                    </label>
                    {!isReadOnly && (
                      <button
                        type="button"
                        disabled={allSlots.length <= 1}
                        onClick={removeSlot}
                        title={allSlots.length <= 1 ? 'Keep at least one slot' : 'Remove slot'}
                        aria-label={`Remove ${slot.label}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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

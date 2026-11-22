import React, { useEffect, useState } from 'react';
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Activity,
  RefreshCw,
  HardDrive,
  ExternalLink,
} from 'lucide-react';
import { getPlatformSettingsStrict, updatePlatformSettings } from '../services/platformService';
import { checkStorageHealth, StorageHealthReport } from '../services/storageService';
import { PlatformSettings } from '../types';
import { DEFAULT_PLATFORM_SETTINGS } from '../data/seedData';
import { ImageUploader } from '../components/common/ImageUploader';
import { SOCIAL_PLATFORM_META, getConfiguredSocialLinks } from '../utils/socialLinks';
import {
  BRAND,
  DEFAULT_PLATFORM_PRIVACY_POLICY,
  DEFAULT_PLATFORM_TERMS,
} from '../config/brand';
import { buildApiUrl, isBackendApiAvailable } from '../config/api';

interface ApiHealthReport {
  ok: boolean;
  mode?: string;
  environment?: string;
  firebaseProjectId?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  geminiConfigured?: boolean;
  message?: string;
}

export const SuperAdminSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [diagLoading, setDiagLoading] = useState(false);
  const [storageHealth, setStorageHealth] = useState<StorageHealthReport | null>(null);
  const [apiHealth, setApiHealth] = useState<ApiHealthReport | null>(null);

  const runDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const backendAvailable = isBackendApiAvailable();
      const [sh, apiRes] = await Promise.all([
        checkStorageHealth(),
        backendAvailable
          ? fetch(buildApiUrl('/api/health'))
              .then(async (r) => {
                const ct = r.headers.get('content-type') || '';
                if (r.ok && ct.includes('application/json')) {
                  return (await r.json()) as ApiHealthReport;
                }
                return { ok: false, message: 'Express backend endpoint did not return JSON.' };
              })
              .catch(() => ({
                ok: false,
                message: 'Express API backend unreachable at configured URL.',
              }))
          : Promise.resolve({
              ok: false,
              message:
                'Static GitHub Pages hosting active. Firebase Auth, Firestore, and Storage work directly; set VITE_API_BASE_URL at build time to connect an external Express backend.',
            }),
      ]);
      setStorageHealth(sh);
      setApiHealth(apiRes);
    } finally {
      setDiagLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorBanner(null);
      try {
        const res = await getPlatformSettingsStrict();
        setSettings(res.settings);
        if (res.error) {
          setErrorBanner(res.error);
        }
      } catch (err: any) {
        setErrorBanner(err?.message || 'Could not load platform settings from Firestore.');
      } finally {
        setLoading(false);
      }
    };
    load();
    runDiagnostics();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedBanner(false);
    setErrorBanner(null);
    try {
      const updated = await updatePlatformSettings({
        ...settings,
        gracePeriodDays: Math.max(0, Number(settings.gracePeriodDays ?? 5)),
        legalUpdatedAt: new Date().toISOString(),
      });
      setSettings(updated);
      setSavedBanner(true);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to save platform settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading platform configuration...
      </div>
    );
  }

  const configuredSocials = getConfiguredSocialLinks(settings.socialLinks);

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Platform Settings, Branding &amp; Diagnostics</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure SaaS branding, SEO metadata, platform social links, receiving accounts, and cloud health diagnostics.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-[#065F46] hover:bg-emerald-900 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 self-start"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Platform Settings'}
        </button>
      </div>

      {savedBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Platform settings saved to Firestore (`platform_settings/general`).
        </div>
      )}

      {errorBanner && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {errorBanner}
        </div>
      )}

      {/* 1. Core Brand Identity & Contacts */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 text-xs">
        <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
          Platform Identity &amp; Support Contacts
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Platform Brand Name</label>
            <input
              type="text"
              required
              value={settings.platformName}
              onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Platform Tagline</label>
            <input
              type="text"
              value={settings.tagline || ''}
              onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Support Email</label>
            <input
              type="email"
              required
              value={settings.supportEmail}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Support Phone</label>
            <input
              type="text"
              value={settings.supportPhone}
              onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Platform Support WhatsApp</label>
            <input
              type="text"
              value={settings.whatsappNumber}
              onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Platform Website URL</label>
            <div className="relative">
              <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={settings.websiteUrl || ''}
                onChange={(e) => setSettings({ ...settings, websiteUrl: e.target.value })}
                placeholder={BRAND.primaryUrl}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Public Landing Announcement Banner (Optional — shows on SaaS homepage when set)
            </label>
            <input
              type="text"
              value={settings.announcement || ''}
              onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
              placeholder="e.g. Eid Launch Offer: Get 2 months free on all annual merchant plans!"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Subscription Renewal Grace Period (Days)</label>
            <input
              type="number"
              min={0}
              max={60}
              value={settings.gracePeriodDays ?? 5}
              onChange={(e) => setSettings({ ...settings, gracePeriodDays: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Paid shops remain operational during this grace window after expiry before reverting to read-only notice.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Platform Currency</label>
              <input
                type="text"
                value={settings.currency || 'PKR'}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={settings.currencySymbol || 'Rs.'}
                onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        <ImageUploader
          shopId="platform"
          folder="platform_brand"
          images={settings.logoUrl ? [settings.logoUrl] : []}
          onChange={(imgs) => setSettings({ ...settings, logoUrl: imgs[0] || '' })}
          label="Platform SaaS Brand Logo (/platform/brand/...)"
        />
      </div>

      {/* 2. Platform SEO & OpenGraph Defaults */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs">
        <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
          Public SaaS Website SEO &amp; OpenGraph
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Platform SEO Title</label>
            <input
              type="text"
              maxLength={70}
              value={settings.seoTitle || ''}
              onChange={(e) => setSettings({ ...settings, seoTitle: e.target.value })}
              placeholder={BRAND.seoTitle}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Canonical Domain URL</label>
            <input
              type="text"
              value={settings.canonicalDomain || ''}
              onChange={(e) => setSettings({ ...settings, canonicalDomain: e.target.value })}
              placeholder={BRAND.primaryUrl}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">OG Social Share Image URL</label>
            <input
              type="url"
              value={settings.ogImageUrl || ''}
              onChange={(e) => setSettings({ ...settings, ogImageUrl: e.target.value })}
              placeholder="https://... (defaults to platform logo)"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">SEO Meta Description (max 165 chars)</label>
            <textarea
              rows={2}
              maxLength={165}
              value={settings.seoDescription || ''}
              onChange={(e) => setSettings({ ...settings, seoDescription: e.target.value })}
              placeholder={`Describe ${BRAND.name} SaaS features for Google Search & social cards...`}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* 3. Platform Social Media Links */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Platform Official Social Media Links</h3>
            <p className="text-[11px] text-slate-500">
              Shown inside the main {BRAND.name} SaaS public website footer (independent from individual merchant stores).
            </p>
          </div>
          {configuredSocials.length > 0 && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              {configuredSocials.length} active links
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {SOCIAL_PLATFORM_META.map((meta) => (
            <div key={meta.key}>
              <label className="block font-semibold text-slate-700 mb-1">{meta.label}</label>
              <input
                type="text"
                value={settings.socialLinks?.[meta.key] || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    socialLinks: {
                      ...(settings.socialLinks || {}),
                      [meta.key]: e.target.value,
                    },
                  })
                }
                placeholder={meta.placeholder}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          ))}
        </div>

        {configuredSocials.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500 font-semibold">Live Landing Footer Preview:</span>
            {configuredSocials.map((entry) => (
              <a
                key={entry.platform}
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 border border-slate-200 text-slate-700 text-[11px] font-semibold"
              >
                <span>{entry.label}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* 4. SaaS Receiving Accounts */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs">
        <h3 className="text-sm font-extrabold text-slate-900">SaaS Receiving Accounts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-slate-200 rounded-xl space-y-2">
            <p className="font-bold text-slate-900">EasyPaisa</p>
            <input
              type="text"
              value={settings.easypaisaDetails.accountTitle}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  easypaisaDetails: { ...settings.easypaisaDetails, accountTitle: e.target.value },
                })
              }
              placeholder="Account Title"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              value={settings.easypaisaDetails.accountNumber}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  easypaisaDetails: { ...settings.easypaisaDetails, accountNumber: e.target.value },
                })
              }
              placeholder="Account Number"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="p-4 border border-slate-200 rounded-xl space-y-2">
            <p className="font-bold text-slate-900">JazzCash</p>
            <input
              type="text"
              value={settings.jazzcashDetails.accountTitle}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  jazzcashDetails: { ...settings.jazzcashDetails, accountTitle: e.target.value },
                })
              }
              placeholder="Account Title"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              value={settings.jazzcashDetails.accountNumber}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  jazzcashDetails: { ...settings.jazzcashDetails, accountNumber: e.target.value },
                })
              }
              placeholder="Account Number"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="p-4 border border-slate-200 rounded-xl space-y-2">
            <p className="font-bold text-slate-900">Bank Transfer (IBFT)</p>
            <input
              type="text"
              value={settings.bankDetails.bankName}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bankDetails: { ...settings.bankDetails, bankName: e.target.value },
                })
              }
              placeholder="Bank Name"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              value={settings.bankDetails.accountNumber}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bankDetails: { ...settings.bankDetails, accountNumber: e.target.value },
                })
              }
              placeholder="Account Number"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              value={settings.bankDetails.iban}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bankDetails: { ...settings.bankDetails, iban: e.target.value },
                })
              }
              placeholder="IBAN"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* 4B. Platform Legal Pages (/privacy-policy & /terms-and-conditions) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Platform Legal Pages ({BRAND.name} SaaS Only)
            </h3>
            <p className="text-[11px] text-slate-500">
              Shown at <code className="font-mono">/privacy-policy</code> and{' '}
              <code className="font-mono">/terms-and-conditions</code>. Completely separate from individual merchant store policies.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold inline-flex items-center gap-1"
            >
              Preview Privacy <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="/terms-and-conditions"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold inline-flex items-center gap-1"
            >
              Preview Terms <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700">Platform Privacy Policy</label>
              <button
                type="button"
                onClick={() =>
                  setSettings({ ...settings, privacyPolicyContent: DEFAULT_PLATFORM_PRIVACY_POLICY })
                }
                className="text-[11px] font-semibold text-[#065F46] hover:underline"
              >
                Load Default {BRAND.name} Policy
              </button>
            </div>
            <textarea
              rows={7}
              value={settings.privacyPolicyContent ?? DEFAULT_PLATFORM_PRIVACY_POLICY}
              onChange={(e) => setSettings({ ...settings, privacyPolicyContent: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-sans leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700">Platform Terms &amp; Conditions</label>
              <button
                type="button"
                onClick={() =>
                  setSettings({ ...settings, termsContent: DEFAULT_PLATFORM_TERMS })
                }
                className="text-[11px] font-semibold text-[#065F46] hover:underline"
              >
                Load Default {BRAND.name} Terms
              </button>
            </div>
            <textarea
              rows={7}
              value={settings.termsContent ?? DEFAULT_PLATFORM_TERMS}
              onChange={(e) => setSettings({ ...settings, termsContent: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-sans leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* 5. Cloud Storage & Backend API Health Diagnostics */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#065F46]" />
            <h3 className="text-sm font-extrabold text-slate-900">System &amp; Firebase Storage Diagnostics</h3>
          </div>
          <button
            type="button"
            disabled={diagLoading}
            onClick={runDiagnostics}
            className="px-3 py-1.5 border border-slate-200 rounded-lg font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${diagLoading ? 'animate-spin' : ''}`} />
            Re-run Probes
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-[#065F46]" /> Firebase Storage Probe
              </span>
              {storageHealth && (
                <span
                  className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                    storageHealth.status === 'healthy' || storageHealth.status === 'permission_denied'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {storageHealth.status.replace('_', ' ')}
                </span>
              )}
            </div>
            <p className="font-mono text-[11px] text-slate-600">
              Bucket: {storageHealth?.bucketName || 'checking...'}
            </p>
            {storageHealth?.corsOrigin && (
              <p className="font-mono text-[11px] text-slate-500">
                Current Origin: {storageHealth.corsOrigin}
              </p>
            )}
            <p className="text-slate-600">{storageHealth?.message || 'Probing Firebase Storage endpoint...'}</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">Express Backend Health (`/api/health`)</span>
              {apiHealth && (
                <span
                  className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                    apiHealth.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {apiHealth.ok ? 'Online' : 'Static SPA'}
                </span>
              )}
            </div>
            {apiHealth?.ok ? (
              <>
                <p className="font-mono text-[11px] text-slate-600">
                  Project: {apiHealth.firebaseProjectId} · DB: {apiHealth.firestoreDatabaseId}
                </p>
                <p className="text-slate-600">
                  Mode: {apiHealth.mode} ({apiHealth.environment}) · Gemini Grounding:{' '}
                  {apiHealth.geminiConfigured ? 'Configured' : 'Fallback Active'}
                </p>
              </>
            ) : (
              <p className="text-slate-600">
                {apiHealth?.message || 'Probing backend health endpoint...'}
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};

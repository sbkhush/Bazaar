import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, ShieldCheck } from 'lucide-react';
import {
  BRAND,
  DEFAULT_PLATFORM_PRIVACY_POLICY,
  DEFAULT_PLATFORM_TERMS,
} from '../config/brand';
import { DEFAULT_PLATFORM_SETTINGS } from '../data/seedData';
import { getPlatformSettings } from '../services/platformService';
import { PlatformSettings } from '../types';
import { DynamicSeoHead } from '../components/common/DynamicSeoHead';
import { PublicNavbar } from '../platform/components/PublicNavbar';
import { BrandLogo } from '../components/common/BrandLogo';

interface PlatformLegalPageProps {
  type: 'privacy' | 'terms';
}

export const PlatformLegalPage: React.FC<PlatformLegalPageProps> = ({ type }) => {
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(
    DEFAULT_PLATFORM_SETTINGS
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPlatformSettings()
      .then((res) => {
        if (active && res) setPlatformSettings(res);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isPrivacy = type === 'privacy';
  const brandName = (platformSettings.platformName || BRAND.name).trim();
  const title = isPrivacy ? `${brandName} Privacy Policy` : `${brandName} Terms & Conditions`;
  const customBody = isPrivacy
    ? platformSettings.privacyPolicyContent
    : platformSettings.termsContent;
  const body = customBody && customBody.trim()
    ? customBody.trim()
    : isPrivacy
      ? DEFAULT_PLATFORM_PRIVACY_POLICY
      : DEFAULT_PLATFORM_TERMS;

  const updatedLabel = platformSettings.legalUpdatedAt
    ? new Date(platformSettings.legalUpdatedAt).toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Production Release';

  return (
    <div className="min-h-screen bg-[#070B19] text-slate-100 flex flex-col">
      <DynamicSeoHead
        mode="platform"
        platformSettings={platformSettings}
        pageTitle={`${title} — ${brandName}`}
        pageDescription={body.replace(/\s+/g, ' ').slice(0, 155)}
      />
      <PublicNavbar platformSettings={platformSettings} />

      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {brandName} Home
            </Link>
            <div className="flex items-center gap-2 text-xs">
              <Link
                to={isPrivacy ? '/terms-and-conditions' : '/privacy-policy'}
                className="px-3.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold transition"
              >
                {isPrivacy ? 'Read Terms & Conditions' : 'Read Privacy Policy'}
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold transition"
              >
                Start Free Store
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0D1326] p-6 sm:p-10 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-white/10">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
                  {isPrivacy ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  <span>Platform Legal Governance · {BRAND.domain}</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                  {title}
                </h1>
                <p className="text-xs text-slate-400">
                  Last Updated: <span className="text-slate-200 font-semibold">{updatedLabel}</span>{' '}
                  · Support:{' '}
                  <a
                    href={`mailto:${platformSettings.supportEmail || BRAND.supportEmail}`}
                    className="text-cyan-300 hover:underline"
                  >
                    {platformSettings.supportEmail || BRAND.supportEmail}
                  </a>
                </p>
              </div>
              <BrandLogo variant="compact" tone="light" size="sm" />
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                Loading platform legal policy...
              </div>
            ) : (
              <div className="text-xs sm:text-sm text-slate-200 leading-7 whitespace-pre-line font-normal">
                {body}
              </div>
            )}

            <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-400">
              <p>
                Looking for an individual store&apos;s customer policy? Open the Privacy Policy or
                Terms link inside that store&apos;s footer (
                <span className="font-mono text-slate-300">/s/shop-slug/privacy-policy</span>).
              </p>
              <span className="shrink-0 text-slate-500">
                © {new Date().getFullYear()} {brandName}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

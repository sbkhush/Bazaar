import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Share2,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useDashboard } from './DashboardContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import {
  assertMerchantMarketingAccess,
  buildShopPublicUrl,
  downloadDataUrl,
  downloadSvgString,
  generateShopMarketingPosterPng,
  generateShopQrDataUrl,
  generateShopQrSvg,
} from '../utils/shopMarketing';

export const ShopMarketingPage: React.FC = () => {
  const { shop, settings, loading, hasPermission } = useDashboard();
  const { currentUser, shopMemberships, isSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [posterDataUrl, setPosterDataUrl] = useState<string>('');
  const [generatingQr, setGeneratingQr] = useState<boolean>(false);
  const [generatingPoster, setGeneratingPoster] = useState<boolean>(false);
  const [posterHeadline, setPosterHeadline] = useState<string>('Shop Online');
  const [posterSubline, setPosterSubline] = useState<string>(
    'Scan QR code with your camera to browse products & order'
  );
  const [includeLogo, setIncludeLogo] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const access = useMemo(
    () =>
      assertMerchantMarketingAccess({
        targetShop: shop,
        currentUserUid: currentUser?.uid,
        shopMemberships,
        isSuperAdmin,
      }),
    [shop, currentUser?.uid, shopMemberships, isSuperAdmin]
  );

  const shopSlug = shop?.slug || '';
  const shopName = (settings.siteName || shop?.name || 'Your Online Store').trim();
  const shopLogoUrl = (settings.logoUrl || shop?.logoUrl || '').trim();
  const shopCity = (settings.city || shop?.city || '').trim();

  const shopPublicUrl = useMemo(() => {
    if (!shopSlug || !access.allowed) return '';
    try {
      return buildShopPublicUrl(shopSlug);
    } catch {
      return '';
    }
  }, [shopSlug, access.allowed]);

  // Generate unique tenant QR PNG + SVG whenever this merchant's store URL changes
  useEffect(() => {
    let active = true;
    if (!shopPublicUrl) {
      setQrDataUrl('');
      setQrSvg('');
      return;
    }

    setGeneratingQr(true);
    setErrorMsg(null);
    Promise.all([
      generateShopQrDataUrl(shopPublicUrl, 512),
      generateShopQrSvg(shopPublicUrl),
    ])
      .then(([pngUrl, svgMarkup]) => {
        if (!active) return;
        setQrDataUrl(pngUrl);
        setQrSvg(svgMarkup);
      })
      .catch((err: any) => {
        if (!active) return;
        setErrorMsg(err?.message || 'Could not generate store QR code.');
      })
      .finally(() => {
        if (active) setGeneratingQr(false);
      });

    return () => {
      active = false;
    };
  }, [shopPublicUrl]);

  // Generate live Canvas PNG marketing poster preview whenever QR or customization changes
  useEffect(() => {
    let active = true;
    if (!qrDataUrl || !shopPublicUrl || !shopSlug) {
      setPosterDataUrl('');
      return;
    }

    setGeneratingPoster(true);
    generateShopMarketingPosterPng({
      shopName,
      shopSlug,
      shopUrl: shopPublicUrl,
      qrDataUrl,
      logoUrl: includeLogo && shopLogoUrl ? shopLogoUrl : undefined,
      city: shopCity,
      tagline: posterHeadline,
      subline: posterSubline,
      primaryColor: settings.primaryColor || shop?.theme?.primaryColor || '#065f46',
      accentColor: settings.accentColor || shop?.theme?.accentColor || '#d97706',
    })
      .then(({ dataUrl }) => {
        if (!active) return;
        setPosterDataUrl(dataUrl);
      })
      .catch(() => {
        if (!active) return;
        setPosterDataUrl('');
      })
      .finally(() => {
        if (active) setGeneratingPoster(false);
      });

    return () => {
      active = false;
    };
  }, [
    qrDataUrl,
    shopPublicUrl,
    shopSlug,
    shopName,
    shopLogoUrl,
    shopCity,
    includeLogo,
    posterHeadline,
    posterSubline,
    settings.primaryColor,
    settings.accentColor,
    shop?.theme?.primaryColor,
    shop?.theme?.accentColor,
  ]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center text-xs text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading store marketing kit...
      </div>
    );
  }

  if (!access.allowed || !hasPermission('overview') || !shop) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3 max-w-lg mx-auto my-8">
        <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
        <h2 className="text-lg font-extrabold text-slate-900">Restricted Store Marketing Access</h2>
        <p className="text-xs text-slate-600">
          {access.reason || 'You can only view and download marketing materials for your own authorized store.'}
        </p>
      </div>
    );
  }

  const handleCopyUrl = async () => {
    if (!shopPublicUrl) return;
    try {
      await navigator.clipboard.writeText(shopPublicUrl);
      setCopied(true);
      showToast('Storefront URL copied to clipboard!', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy automatically — please copy the URL from the box.', 'error');
    }
  };

  const handleShareStore = async () => {
    if (!shopPublicUrl) return;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${shopName} — Shop Online`,
          text: `Browse products and order online from ${shopName} on SB Khush:`,
          url: shopPublicUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    await handleCopyUrl();
  };

  const handleDownloadQrPng = () => {
    if (!qrDataUrl || !shopSlug) return;
    downloadDataUrl(qrDataUrl, `${shopSlug}-store-qr.png`);
    showToast('Store QR PNG downloaded.', 'success');
  };

  const handleDownloadQrSvg = () => {
    if (!qrSvg || !shopSlug) return;
    downloadSvgString(qrSvg, `${shopSlug}-store-qr.svg`);
    showToast('Store QR SVG downloaded.', 'success');
  };

  const handleDownloadPoster = async () => {
    if (!shopPublicUrl || !qrDataUrl || !shopSlug) return;
    try {
      let downloadUrl = posterDataUrl;
      if (!downloadUrl) {
        const res = await generateShopMarketingPosterPng({
          shopName,
          shopSlug,
          shopUrl: shopPublicUrl,
          qrDataUrl,
          logoUrl: includeLogo && shopLogoUrl ? shopLogoUrl : undefined,
          city: shopCity,
          tagline: posterHeadline,
          subline: posterSubline,
          primaryColor: settings.primaryColor || shop?.theme?.primaryColor || '#065f46',
          accentColor: settings.accentColor || shop?.theme?.accentColor || '#d97706',
        });
        downloadUrl = res.dataUrl;
      }
      downloadDataUrl(downloadUrl, `${shopSlug}-shop-online-poster.png`);
      showToast('Marketing poster PNG downloaded!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to export marketing poster PNG.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Shop QR &amp; Marketing Kit</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Share your unique store link, print counter QR codes, and download branded Shop Online posters.
          </p>
        </div>

        <Link
          to={`/s/${shop.slug}`}
          target="_blank"
          className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 self-start"
        >
          <span>Open Public Storefront</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Unique Store URL + QR Code Downloads */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#065F46] flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Unique Store QR Code</h3>
                  <p className="text-[11px] text-slate-500">Opens directly to {shopName}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-[#065F46] text-[10px] font-bold uppercase tracking-wider">
                Tenant Scoped
              </span>
            </div>

            {/* QR Preview Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-3">
              {generatingQr ? (
                <div className="w-48 h-48 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
                  Generating QR...
                </div>
              ) : qrDataUrl ? (
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                  <img
                    src={qrDataUrl}
                    alt={`${shopName} Store QR Code`}
                    data-testid="shop-qr-image"
                    className="w-48 h-48 object-contain"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                  QR unavailable
                </div>
              )}

              <div className="w-full space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Direct Storefront Link
                </p>
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2">
                  <input
                    type="text"
                    readOnly
                    value={shopPublicUrl}
                    aria-label="Unique Storefront URL"
                    data-testid="shop-public-url-input"
                    className="w-full text-[11px] font-mono text-slate-800 bg-transparent focus:outline-none select-all"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopyUrl}
                disabled={!shopPublicUrl}
                className="px-3.5 py-2.5 bg-[#065F46] hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareStore}
                disabled={!shopPublicUrl}
                className="px-3.5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Store</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadQrPng}
                disabled={!qrDataUrl}
                className="px-3.5 py-2.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadQrSvg}
                disabled={!qrSvg}
                className="px-3.5 py-2.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download SVG</span>
              </button>
            </div>
          </div>

          {/* Poster Customization Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#065F46]" />
              <h3 className="text-sm font-extrabold text-slate-900">Customize Counter &amp; Social Poster</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Poster Headline</label>
                <input
                  type="text"
                  maxLength={32}
                  value={posterHeadline}
                  onChange={(e) => setPosterHeadline(e.target.value)}
                  placeholder="Shop Online"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#065F46]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Call-to-Action Subtitle</label>
                <input
                  type="text"
                  maxLength={62}
                  value={posterSubline}
                  onChange={(e) => setPosterSubline(e.target.value)}
                  placeholder="Scan QR code with your camera to browse products & order"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#065F46]"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="font-semibold text-slate-800">Show Store Logo on Poster</p>
                  <p className="text-[11px] text-slate-500">
                    {shopLogoUrl
                      ? 'Uses your uploaded storefront logo.'
                      : 'No logo uploaded yet — renders clean monogram badge automatically.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={includeLogo}
                  onChange={(e) => setIncludeLogo(e.target.checked)}
                  className="w-4 h-4 accent-[#065F46]"
                  aria-label="Include Store Logo"
                />
              </div>

              {!shopLogoUrl && (
                <Link
                  to="/dashboard/appearance"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#065F46] hover:underline"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Upload Store Logo in Appearance
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Printable Shop Marketing Poster Preview + PNG Download */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Downloadable Marketing Poster (1080×1350 PNG)
              </h3>
              <p className="text-[11px] text-slate-500">
                Print for your shop counter, packaging flyers, or share on WhatsApp Status &amp; Instagram.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadPoster}
              disabled={generatingQr || (!posterDataUrl && !qrDataUrl)}
              data-testid="download-poster-btn"
              className="px-4 py-2.5 bg-[#065F46] hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
            >
              <Download className="w-4 h-4" />
              <span>Download Poster PNG</span>
            </button>
          </div>

          <div className="bg-slate-100/80 border border-slate-200 rounded-2xl p-4 sm:p-6 flex justify-center">
            {generatingPoster && !posterDataUrl ? (
              <div className="w-full max-w-sm aspect-[4/5] bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
                Rendering high-resolution poster...
              </div>
            ) : posterDataUrl ? (
              <img
                src={posterDataUrl}
                alt={`${shopName} Shop Online Marketing Poster`}
                data-testid="shop-poster-preview"
                className="w-full max-w-sm rounded-2xl shadow-lg border border-slate-200 bg-white"
              />
            ) : (
              /* Clean DOM preview fallback if Canvas PNG is disabled in headless tests */
              <div
                data-testid="shop-poster-fallback-preview"
                className="w-full max-w-sm rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-white text-center"
              >
                <div className="bg-[#065F46] text-white p-6 space-y-2">
                  {includeLogo && shopLogoUrl ? (
                    <img
                      src={shopLogoUrl}
                      alt={shopName}
                      className="w-14 h-14 rounded-xl object-contain bg-white mx-auto p-1"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/30 text-white font-black text-xl flex items-center justify-center mx-auto">
                      {shopName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <h4 className="text-lg font-black">{shopName}</h4>
                  {shopCity && <p className="text-xs text-emerald-100">{shopCity}</p>}
                </div>
                <div className="p-6 space-y-3">
                  <p className="text-lg font-extrabold text-slate-900">{posterHeadline || 'Shop Online'}</p>
                  <p className="text-xs text-slate-500">{posterSubline}</p>
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt="Store QR" className="w-40 h-40 mx-auto border border-slate-200 rounded-xl p-2" />
                  )}
                  <p className="text-[11px] font-mono bg-slate-100 rounded-lg px-3 py-2 text-slate-800 break-all">
                    {shopPublicUrl}
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold">Powered by SB Khush</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

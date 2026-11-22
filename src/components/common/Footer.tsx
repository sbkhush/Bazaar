import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  ShieldCheck,
  Truck,
  RefreshCw,
  Headphones,
  ExternalLink,
  Globe,
  MessageCircle,
  Youtube,
  Linkedin,
  Facebook,
  Instagram,
  Music2,
  Loader2,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useToast } from './Toast';
import { getShopCategories, subscribeToShopNewsletter } from '../../services/tenantService';
import { Category } from '../../types';
import { getConfiguredSocialLinks, SocialPlatformKey } from '../../utils/socialLinks';
import { SafeImage } from './SafeImage';
import { BRAND } from '../../config/brand';

function renderSocialIcon(platform: SocialPlatformKey) {
  switch (platform) {
    case 'facebook':
      return <Facebook className="w-4 h-4" />;
    case 'instagram':
      return <Instagram className="w-4 h-4" />;
    case 'tiktok':
      return <Music2 className="w-4 h-4" />;
    case 'youtube':
      return <Youtube className="w-4 h-4" />;
    case 'linkedin':
      return <Linkedin className="w-4 h-4" />;
    case 'whatsapp':
      return <MessageCircle className="w-4 h-4" />;
    default:
      return <Globe className="w-4 h-4" />;
  }
}

export const Footer: React.FC = () => {
  const { shopId, settings, storeBasePath } = useTenant();
  const { showToast } = useToast();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let active = true;
    getShopCategories(shopId)
      .then((cats) => {
        if (!active) return;
        setCategories(cats.slice(0, 6));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shopId]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim() || subscribing) return;
    setSubscribeError(null);
    setSubscribing(true);
    try {
      await subscribeToShopNewsletter(shopId, newsletterEmail, 'footer');
      showToast(`Shukriya! You are now subscribed to ${settings.siteName} offers & discounts.`, 'success');
      setNewsletterEmail('');
    } catch (err: any) {
      const msg = err?.message || 'Could not complete newsletter subscription.';
      setSubscribeError(msg);
      showToast(msg, 'error');
    } finally {
      setSubscribing(false);
    }
  };

  const brandColor = settings.primaryColor || '#065f46';
  const configuredSocials = getConfiguredSocialLinks(settings.socialLinks);

  return (
    <footer className="bg-slate-950 text-slate-300 pt-12 sm:pt-14 pb-8 border-t border-slate-800">
      {/* 1. Value propositions row */}
      <div className="max-w-7xl mx-auto px-4 pb-10 sm:pb-12 border-b border-slate-800/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Nationwide Delivery</h4>
              <p className="text-xs text-slate-400 mt-0.5">TCS, Leopards &amp; Trax express to all cities</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">COD &amp; Mobile Wallets</h4>
              <p className="text-xs text-slate-400 mt-0.5">Cash on Delivery, EasyPaisa &amp; JazzCash</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0">
              <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">7-Day Easy Returns</h4>
              <p className="text-xs text-slate-400 mt-0.5">Hassle-free exchange &amp; refund guarantee</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Headphones className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">WhatsApp Support</h4>
              <p className="text-xs text-slate-400 mt-0.5">Direct agent response 7 days a week</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main footer links */}
      <div className="max-w-7xl mx-auto px-4 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand info */}
          <div className="sm:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              {settings.logoUrl ? (
                <SafeImage
                  src={settings.logoUrl}
                  alt={settings.siteName}
                  className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                  {(settings.siteName || 'S')[0].toUpperCase()}
                </div>
              )}
              <span className="text-2xl font-black text-white">
                {settings.siteName === 'SB Khush' ? (
                  <>
                    SB <span className="text-emerald-400">Khush</span>
                  </>
                ) : (
                  settings.siteName
                )}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Trusted online store serving shoppers across {settings.city || 'Pakistan'} with nationwide courier dispatch, self-pickup service, and verified mobile wallet payments.
            </p>

            <div className="space-y-2 text-xs text-slate-300">
              {settings.address && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{settings.address}</span>
                </div>
              )}
              {settings.contactPhone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{settings.contactPhone}</span>
                </div>
              )}
              {settings.contactEmail && (
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{settings.contactEmail}</span>
                </div>
              )}
              {settings.websiteUrl && (
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                  <a
                    href={settings.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-emerald-400 transition truncate"
                  >
                    {settings.websiteUrl.replace(/^https?:\/\//i, '')}
                  </a>
                </div>
              )}
            </div>

            {configuredSocials.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {configuredSocials.map((entry) => (
                  <a
                    key={entry.platform}
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${settings.siteName} on ${entry.label}`}
                    title={entry.label}
                    className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/70 hover:text-emerald-400 text-slate-300 flex items-center justify-center transition"
                  >
                    {renderSocialIcon(entry.platform)}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div>
            <h5 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Customer Care</h5>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <Link to={`${storeBasePath}/tracking`} className="hover:text-emerald-400 transition">
                  Track Your Order
                </Link>
              </li>
              <li>
                <Link to={`${storeBasePath}/about`} className="hover:text-emerald-400 transition">
                  About Us
                </Link>
              </li>
              <li>
                <Link to={`${storeBasePath}/contact`} className="hover:text-emerald-400 transition">
                  Contact Helpdesk
                </Link>
              </li>
              <li>
                <Link to={`${storeBasePath}/faq`} className="hover:text-emerald-400 transition">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link to={`${storeBasePath}/return-policy`} className="hover:text-emerald-400 transition">
                  Return &amp; Exchange Policy
                </Link>
              </li>
              <li>
                <Link to={`${storeBasePath}/terms-and-conditions`} className="hover:text-emerald-400 transition">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link to={`${storeBasePath}/privacy-policy`} className="hover:text-emerald-400 transition">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Shop categories */}
          <div>
            <h5 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Shop Categories</h5>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <Link to={`${storeBasePath}/shop`} className="hover:text-emerald-400 transition font-semibold text-slate-200">
                  All Products
                </Link>
              </li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`${storeBasePath}/shop?category=${cat.slug}`}
                    className="hover:text-emerald-400 transition"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to={`${storeBasePath}/shop?featured=true`} className="hover:text-emerald-400 transition">
                  Featured Deals
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter subscription */}
          <div>
            <h5 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Get Special Offers</h5>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Subscribe to receive exclusive promo alerts and festive discounts from {settings.siteName}.
            </p>
            <form onSubmit={handleSubscribe} className="space-y-2">
              <input
                type="email"
                required
                placeholder="Enter your email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              {subscribeError && (
                <p className="text-[11px] text-rose-400">{subscribeError}</p>
              )}
              <button
                type="submit"
                disabled={subscribing}
                className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                {subscribing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subscribing...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Subscribe Now
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-500 block mb-1.5">Supported Payments:</span>
              <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-300 font-medium">
                {settings.codEnabled !== false && (
                  <span className="bg-slate-900 px-2 py-1 rounded border border-slate-800">Cash on Delivery</span>
                )}
                {settings.easypaisaDetails?.enabled !== false && (
                  <span className="bg-slate-900 px-2 py-1 rounded border border-emerald-800/60 text-emerald-300">EasyPaisa</span>
                )}
                {settings.jazzcashDetails?.enabled !== false && (
                  <span className="bg-slate-900 px-2 py-1 rounded border border-rose-800/60 text-rose-300">JazzCash</span>
                )}
                {settings.bankDetails?.enabled !== false && (
                  <span className="bg-slate-900 px-2 py-1 rounded border border-slate-800">Bank Transfer</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom bar */}
      <div className="max-w-7xl mx-auto px-4 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3 text-center sm:text-left">
        <p>© {new Date().getFullYear()} {settings.siteName}. All rights reserved.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-emerald-400 transition"
        >
          <span>Powered by {BRAND.name}</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </footer>
  );
};

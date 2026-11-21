import { DEFAULT_SHOP_ID, sanitizeShopSlug } from '../data/seedData';

export const KNOWN_APP_ROOTS = [
  'register',
  'login',
  'merchant',
  'super-admin',
  'dashboard',
  's',
  'shop',
  'product',
  'cart',
  'checkout',
  'order-success',
  'account',
  'tracking',
  'contact',
  'about',
  'faq',
  'return-policy',
  'terms',
  'privacy',
  'privacy-policy',
  'terms-and-conditions',
  'salesman',
  'sales-manager',
  'referral',
  'r',
  'admin',
];

const CUSTOM_DOMAIN_MAP: Record<string, string> = {};

/**
 * Resolves a tenant slug from custom domains or subdomains (`*.sbkhush.com`, legacy `*.bazaarpk.pk`)
 * while ignoring local development, Firebase, AI Studio, and GitHub Pages hostnames.
 */
export function resolveTenantFromHostname(hostname?: string): string | null {
  const host = (hostname || (typeof window !== 'undefined' ? window.location.hostname : ''))
    .toLowerCase()
    .trim();
  if (!host) return null;

  if (CUSTOM_DOMAIN_MAP[host]) {
    return CUSTOM_DOMAIN_MAP[host];
  }

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.github.io') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com') ||
    host.endsWith('.run.app')
  ) {
    return null;
  }

  // Subdomain multi-tenancy foundation: e.g. <shopSlug>.sbkhush.com (or legacy *.bazaarpk.pk)
  if (host.endsWith('.sbkhush.com') || host.endsWith('.bazaarpk.pk')) {
    const sub = host.replace(/\.(sbkhush\.com|bazaarpk\.pk)$/, '');
    if (sub && sub !== 'www' && sub !== 'app' && !KNOWN_APP_ROOTS.includes(sub)) {
      return sanitizeShopSlug(sub);
    }
  }

  return null;
}

/**
 * Returns BrowserRouter basename cleanly across root custom domains, Vercel/Cloud Run,
 * and GitHub Pages repository subpaths (`/repo-name`).
 */
export function getRouterBasename(baseUrl?: string, pathname?: string, hostname?: string): string {
  const envBase = baseUrl ?? import.meta.env.BASE_URL ?? '/';
  if (envBase && envBase !== '/' && envBase !== './') {
    return envBase.endsWith('/') ? envBase.slice(0, -1) : envBase;
  }

  if (typeof window !== 'undefined' || (pathname && hostname)) {
    const host = (hostname || window.location.hostname || '').toLowerCase();
    const path = pathname || window.location.pathname || '/';
    if (host.endsWith('.github.io')) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 0 && !KNOWN_APP_ROOTS.includes(parts[0])) {
        return `/${parts[0]}`;
      }
    }
  }

  return '';
}

export function buildStorefrontPath(shopSlug?: string, subpath = ''): string {
  const slug = sanitizeShopSlug(shopSlug || DEFAULT_SHOP_ID) || DEFAULT_SHOP_ID;
  const cleanSub = subpath ? (subpath.startsWith('/') ? subpath : `/${subpath}`) : '';
  return `/s/${slug}${cleanSub}`;
}

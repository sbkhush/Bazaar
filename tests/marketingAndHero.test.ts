import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import {
  getAccessibleContrastText,
  normalizeHexColor,
  resolveHeroButtonLabel,
  resolveHeroStoreLink,
} from '../src/utils/storefrontHero';
import {
  assertMerchantMarketingAccess,
  buildShopPublicUrl,
  generateShopMarketingPosterPng,
  generateShopQrDataUrl,
  generateShopQrSvg,
} from '../src/utils/shopMarketing';
import { getRouterBasename, KNOWN_APP_ROOTS } from '../src/utils/tenantDomain';
import type { Shop } from '../src/types';

const WORKSPACE_ROOT = process.cwd();

function readWorkspaceFile(relPath: string): string {
  return fs.readFileSync(path.join(WORKSPACE_ROOT, relPath), 'utf-8');
}

describe('Task 1: Shop Hero Banner CTA Visibility, Contrast & Routing Fix', () => {
  const homePageSrc = readWorkspaceFile('src/pages/HomePage.tsx');
  const bannersPageSrc = readWorkspaceFile('src/dashboard/ShopBannersPage.tsx');

  it('computes accessible foreground text contrast over dark, bright, and fallback brand colors', () => {
    expect(normalizeHexColor('#065F46')).toBe('#065f46');
    expect(normalizeHexColor('#fff')).toBe('#ffffff');
    expect(normalizeHexColor('invalid-color', '#065f46')).toBe('#065f46');

    expect(getAccessibleContrastText('#065f46')).toBe('#ffffff');
    expect(getAccessibleContrastText('#0f172a')).toBe('#ffffff');
    expect(getAccessibleContrastText('#ffffff')).toBe('#0f172a');
    expect(getAccessibleContrastText('#facc15')).toBe('#0f172a');
  });

  it('falls back to "Shop Now" when banner buttonText is missing or whitespace', () => {
    expect(resolveHeroButtonLabel(undefined)).toBe('Shop Now');
    expect(resolveHeroButtonLabel('')).toBe('Shop Now');
    expect(resolveHeroButtonLabel('   ')).toBe('Shop Now');
    expect(resolveHeroButtonLabel('Order Fresh')).toBe('Order Fresh');
  });

  it('resolves banner CTA links cleanly under GitHub Pages /Bazaar/ basename and storefront paths', () => {
    expect(resolveHeroStoreLink('', '/s/al-noor', '/Bazaar')).toEqual({
      href: '/s/al-noor/shop',
      isExternal: false,
    });
    expect(resolveHeroStoreLink('   ', '/s/al-noor', '/Bazaar')).toEqual({
      href: '/s/al-noor/shop',
      isExternal: false,
    });
    expect(resolveHeroStoreLink('/shop', '/s/al-noor', '/Bazaar')).toEqual({
      href: '/s/al-noor/shop',
      isExternal: false,
    });
    expect(resolveHeroStoreLink('/Bazaar/s/al-noor/shop?featured=true', '/s/al-noor', '/Bazaar')).toEqual({
      href: '/s/al-noor/shop?featured=true',
      isExternal: false,
    });
    expect(resolveHeroStoreLink('https://example.com/offer', '/s/al-noor', '/Bazaar')).toEqual({
      href: 'https://example.com/offer',
      isExternal: true,
    });
  });

  it('uses responsive CSS grid stacking ([grid-area:1/1]) in HomePage so hero CTA is never clipped on mobile', () => {
    expect(homePageSrc).toContain('[grid-area:1/1]');
    expect(homePageSrc).toContain('data-testid="hero-primary-cta"');
    expect(homePageSrc).toContain('getAccessibleContrastText');
    expect(homePageSrc).toContain('resolveHeroButtonLabel');
    expect(bannersPageSrc).toContain("String(editing.buttonText || '').trim() || 'Shop Now'");
  });
});

describe('Tasks 2 & 3: Unique Per-Shop QR Codes & Downloadable Marketing Poster PNG', () => {
  const originalDocument = (globalThis as any).document;
  const originalImage = (globalThis as any).Image;

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    (globalThis as any).Image = originalImage;
  });

  it('builds unique tenant URLs preserving /Bazaar/ and never pointing to platform root /', () => {
    const urlA = buildShopPublicUrl('merchant-alpha', {
      origin: 'https://sbkhush.github.io',
      basePath: '/Bazaar/',
    });
    const urlB = buildShopPublicUrl('merchant-beta', {
      origin: 'https://sbkhush.github.io',
      basePath: '/Bazaar/',
    });

    expect(urlA).toBe('https://sbkhush.github.io/Bazaar/s/merchant-alpha');
    expect(urlB).toBe('https://sbkhush.github.io/Bazaar/s/merchant-beta');
    expect(urlA).not.toBe(urlB);
    expect(() => buildShopPublicUrl('')).toThrow();
  });

  it('generates distinct QR PNG DataURLs and SVG markup for Shop A vs Shop B', async () => {
    const urlA = buildShopPublicUrl('lahore-kiryana', {
      origin: 'https://sbkhush.github.io',
      basePath: '/Bazaar/',
    });
    const urlB = buildShopPublicUrl('karachi-beauty', {
      origin: 'https://sbkhush.github.io',
      basePath: '/Bazaar/',
    });

    const [pngA, pngB, svgA, svgB] = await Promise.all([
      generateShopQrDataUrl(urlA, 256),
      generateShopQrDataUrl(urlB, 256),
      generateShopQrSvg(urlA),
      generateShopQrSvg(urlB),
    ]);

    expect(pngA.startsWith('data:image/png;base64,')).toBe(true);
    expect(pngB.startsWith('data:image/png;base64,')).toBe(true);
    expect(pngA).not.toBe(pngB);

    expect(svgA).toContain('<svg');
    expect(svgB).toContain('<svg');
    expect(svgA).not.toBe(svgB);
  });

  it('renders downloadable Canvas PNG marketing poster cleanly both with and without shop logo', async () => {
    const drawnTexts: string[] = [];
    const mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetY: 0,
      font: '',
      textAlign: 'center',
      textBaseline: 'alphabetic',
      fillRect: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      save: () => {},
      restore: () => {},
      clip: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      closePath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      drawImage: () => {},
      measureText: (t: string) => ({ width: t.length * 14 }),
      fillText: (text: string) => {
        drawnTexts.push(text);
      },
    };

    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => mockCtx,
            toDataURL: () => 'data:image/png;base64,MOCK_POSTER_PNG',
          };
        }
        return {};
      },
    };

    class MockImage {
      crossOrigin: string | null = null;
      naturalWidth = 200;
      naturalHeight = 200;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    (globalThis as any).Image = MockImage;

    const shopUrl = 'https://sbkhush.github.io/Bazaar/s/al-madina-mart';
    const qrDataUrl = await generateShopQrDataUrl(shopUrl, 256);

    const withoutLogo = await generateShopMarketingPosterPng({
      shopName: 'Al-Madina General Store',
      shopSlug: 'al-madina-mart',
      shopUrl,
      qrDataUrl,
      city: 'Lahore',
    });
    expect(withoutLogo.usedLogoImage).toBe(false);
    expect(withoutLogo.dataUrl).toBe('data:image/png;base64,MOCK_POSTER_PNG');
    expect(drawnTexts).toContain('Al-Madina General Store');
    expect(drawnTexts).toContain('Shop Online');
    expect(drawnTexts.some((t) => t.includes('Powered by SB Khush'))).toBe(true);

    const withLogo = await generateShopMarketingPosterPng({
      shopName: 'Al-Madina General Store',
      shopSlug: 'al-madina-mart',
      shopUrl,
      qrDataUrl,
      logoUrl: 'https://firebasestorage.googleapis.com/v0/b/example/logo.png',
      city: 'Lahore',
    });
    expect(withLogo.usedLogoImage).toBe(true);
    expect(withLogo.dataUrl).toBe('data:image/png;base64,MOCK_POSTER_PNG');
  });
});

describe('Tasks 4 & 5: Strict Tenant Isolation, GitHub Pages /Bazaar/ Routing & Atomic CF Seeding', () => {
  it('allows Merchant A only to generate/download Merchant A QR & poster and blocks cross-tenant access', () => {
    const shopA = { id: 'shop-a', slug: 'shop-a', ownerId: 'uid_merchant_a', name: 'Shop A' } as Shop;
    const shopB = { id: 'shop-b', slug: 'shop-b', ownerId: 'uid_merchant_b', name: 'Shop B' } as Shop;

    const ownAccess = assertMerchantMarketingAccess({
      targetShop: shopA,
      currentUserUid: 'uid_merchant_a',
      shopMemberships: [{ shopId: 'shop-a', shopName: 'Shop A', shopSlug: 'shop-a', role: 'shop_owner', joinedAt: '' }],
      isSuperAdmin: false,
    });
    expect(ownAccess.allowed).toBe(true);

    const crossTenantAccess = assertMerchantMarketingAccess({
      targetShop: shopB,
      currentUserUid: 'uid_merchant_a',
      shopMemberships: [{ shopId: 'shop-a', shopName: 'Shop A', shopSlug: 'shop-a', role: 'shop_owner', joinedAt: '' }],
      isSuperAdmin: false,
    });
    expect(crossTenantAccess.allowed).toBe(false);
    expect(crossTenantAccess.reason).toContain('Access denied');
  });

  it('preserves /Bazaar/ basename for direct visits and refreshes on sbkhush.github.io/Bazaar/s/<slug>', () => {
    expect(getRouterBasename('/Bazaar/', '/Bazaar/s/demo-store', 'sbkhush.github.io')).toBe('/Bazaar');
    expect(getRouterBasename('/', '/Bazaar/s/demo-store', 'sbkhush.github.io')).toBe('/Bazaar');
    expect(getRouterBasename('/', '/s/demo-store', 'localhost')).toBe('');

    const html404 = readWorkspaceFile('public/404.html');
    const indexHtml = readWorkspaceFile('index.html');
    expect(html404).toContain("knownAppRoots.indexOf(parts[0]) === -1 ? 1 : 0");
    for (const root of ['register', 'login', 'dashboard', 'super-admin', 's', 'shop']) {
      expect(KNOWN_APP_ROOTS).toContain(root);
      expect(html404).toContain(`'${root}'`);
    }
    expect(indexHtml).toContain("if (l.search[1] === '/')");
  });

  it('wires /dashboard/marketing cleanly and seeds default categories & aboutUs inside Cloud Function transaction', () => {
    const appSrc = readWorkspaceFile('src/App.tsx');
    const layoutSrc = readWorkspaceFile('src/dashboard/ShopDashboardLayout.tsx');
    const marketingSrc = readWorkspaceFile('src/dashboard/ShopMarketingPage.tsx');
    const functionsSrc = readWorkspaceFile('functions/src/index.ts');

    expect(appSrc).toContain('path="marketing" element={<ShopMarketingPage />}');
    expect(layoutSrc).toContain("to: '/dashboard/marketing'");
    expect(marketingSrc).toContain('assertMerchantMarketingAccess');
    expect(functionsSrc).toContain('getDefaultCategoriesForBusinessTypeServer');
    expect(functionsSrc).toContain('aboutUs:');
  });
});

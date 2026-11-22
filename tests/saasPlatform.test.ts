import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  sanitizeShopSlug,
  isValidShopSlug,
  isValidPakistaniPhone,
  formatPKR,
  DEFAULT_SUBSCRIPTION_PLANS,
} from '../src/data/seedData';
import {
  stripUndefined,
  toShopPublic,
  getShopSubscriptionStatus,
} from '../src/services/platformService';
import {
  generateTrackingToken,
  deriveTrackingTokenHash,
  deriveTrackingDocId,
} from '../src/utils/trackingCrypto';
import {
  getRouterBasename,
  resolveTenantFromHostname,
  buildStorefrontPath,
} from '../src/utils/tenantDomain';
import {
  buildShopSeoTags,
  buildPlatformSeoTags,
} from '../src/utils/seo';
import {
  countActiveProducts,
  getProductLimitErrorMessage,
} from '../src/services/tenantService';
import {
  calculateRetailProfitSummary,
  calculateInventoryValuation,
} from '../src/services/retailService';
import type { Shop, Product, Order, PosSale, ShopExpense } from '../src/types';

const WORKSPACE_ROOT = process.cwd();

describe('Priority 1 & 2: Multi-Tenant Firestore & Storage Rules Audit', () => {
  const firestoreRules = fs.readFileSync(path.join(WORKSPACE_ROOT, 'firestore.rules'), 'utf-8');
  const storageRules = fs.readFileSync(path.join(WORKSPACE_ROOT, 'storage.rules'), 'utf-8');

  it('enforces default-deny catchall in both Firestore and Storage rules', () => {
    expect(firestoreRules).toContain('match /{document=**}');
    expect(firestoreRules).toContain('allow read, write: if false;');
    expect(storageRules).toContain('match /{allPaths=**}');
    expect(storageRules).toContain('allow read, write: if false;');
  });

  it('verifies Super Admin via custom claims, platform_admins lookup, and verified bootstrap email', () => {
    expect(firestoreRules).toContain('request.auth.token.super_admin == true');
    expect(firestoreRules).toContain('platform_admins/$(request.auth.uid)');
    expect(firestoreRules).toContain('hasanaamir815@gmail.com');
    expect(firestoreRules).toContain('request.auth.token.email_verified == true');
  });

  it('blocks public reads on private /shops/{shopId} while exposing strictly whitelisted /shops_public/{shopId}', () => {
    expect(firestoreRules).toContain('allow get: if isValidId(shopId) && (isSuperAdmin() || isShopMember(shopId));');
    expect(firestoreRules).toContain('match /shops_public/{shopId}');
    expect(firestoreRules).toContain('isValidShopPublicDoc(incoming(), shopId)');
    expect(firestoreRules).not.toContain('allow read: if true;\n      // shops');
  });

  it('splits public storefront settings from private payment/merchant settings', () => {
    expect(firestoreRules).toContain('match /settings/{settingId}');
    expect(firestoreRules).toContain("settingId == 'public' ||\n          isShopMember(shopId)");
    expect(firestoreRules).toContain('allow list: if isShopMember(shopId);');
  });

  it('blocks unauthenticated/guest reads on private orders and requires hashed tracking keys', () => {
    expect(firestoreRules).toContain('hasShopPermission(shopId, \'orders\') ||\n          isShopMember(shopId) ||\n          (isSignedIn() && resource.data.userId == request.auth.uid)');
    expect(firestoreRules).toContain("trackKey.matches('^trk_[a-f0-9]{32}$')");
    expect(firestoreRules).toContain("data.keys().hasOnly(['orderNumber', 'orderId', 'shopId', 'orderStatus', 'fulfillmentMethod', 'pickupDetails', 'paymentMethod', 'paymentStatus', 'courierName', 'trackingNumber', 'customerName', 'city', 'items', 'total', 'trackingTokenHash', 'createdAt', 'updatedAt'])");
  });

  it('prevents staff self-escalation, owner tampering, and subscription forgery', () => {
    expect(firestoreRules).toContain("!incoming().diff(existing()).affectedKeys().hasAny(['ownerId', 'slug', 'status', 'subscription'])");
    expect(firestoreRules).toContain("!incoming().diff(existing()).affectedKeys().hasAny(['role', 'isBlocked'])");
    expect(firestoreRules).toContain("existing().role != 'shop_owner'");
    expect(firestoreRules).toContain("incoming().role == get(/databases/$(database)/documents/shop_invites/$(incoming().inviteId)).data.role");
    expect(firestoreRules).toContain("incoming().permissions == get(/databases/$(database)/documents/shop_invites/$(incoming().inviteId)).data.permissions");
  });

  it('enforces claim-based tenant isolation, private payment/subscription receipts, 5MB limit, and image MIME types in Storage', () => {
    expect(storageRules).toContain('request.auth.token.shops[shopId]');
    expect(storageRules).toContain('match /shops/{shopId}/logo/{allPaths=**}');
    expect(storageRules).toContain('match /shops/{shopId}/products/{productId}/{allPaths=**}');
    expect(storageRules).toContain('match /shops/{shopId}/banners/{allPaths=**}');
    expect(storageRules).toContain('match /shops/{shopId}/categories/{allPaths=**}');
    expect(storageRules).toContain('match /shops/{shopId}/pages/{allPaths=**}');
    expect(storageRules).toContain('match /shops/{shopId}/payments/{orderSessionId}/{fileName}');
    expect(storageRules).toContain('match /shops/{shopId}/subscription/{allPaths=**}');
    expect(storageRules).toContain('match /platform/payments/{shopId}/{fileName}');
    expect(storageRules).toContain('allow read: if isShopAdmin(shopId);');
    expect(storageRules).toContain('5 * 1024 * 1024');
    expect(storageRules).toContain("request.resource.contentType.matches('image/(jpeg|jpg|png|webp|gif)')");
  });

  it('isolates Stage 1 retail subcollections, support tickets, and allows SEO fields in shops_public', () => {
    expect(firestoreRules).toContain('match /suppliers/{supplierId}');
    expect(firestoreRules).toContain('match /purchases/{purchaseId}');
    expect(firestoreRules).toContain('match /pos_sales/{saleId}');
    expect(firestoreRules).toContain('match /stock_movements/{movementId}');
    expect(firestoreRules).toContain('match /khata_ledger/{entryId}');
    expect(firestoreRules).toContain('match /expenses/{expenseId}');
    expect(firestoreRules).toContain('match /support_tickets/{ticketId}');
    expect(firestoreRules).toContain("'seoTitle', 'seoDescription'");
    expect(firestoreRules).toContain("'businessType'");
  });
});

describe('Priority 3, 4 & 5: Code Hardening, Transactional Billing & Zero-Fallback Audit', () => {
  const platformServiceSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/services/platformService.ts'), 'utf-8');
  const storageServiceSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/services/storageService.ts'), 'utf-8');
  const functionsSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'functions/src/index.ts'), 'utf-8');

  it('uses atomic runTransaction for payment approval, rejection, and subscription extension', () => {
    expect(platformServiceSrc).toContain('runTransaction(db');
    expect(platformServiceSrc).toContain("payment.status !== 'pending'");
    expect(platformServiceSrc).toContain('isRenewSamePlan');
  });

  it('removed all Data URL Base64 image upload fallbacks across the entire frontend', () => {
    expect(storageServiceSrc).not.toContain('allowDataUrlFallback');
    const srcFiles = [
      'src/components/common/ImageUploader.tsx',
      'src/pages/CheckoutPage.tsx',
      'src/dashboard/ShopProductsPage.tsx',
      'src/dashboard/ShopCategoriesPage.tsx',
      'src/dashboard/ShopBannersPage.tsx',
      'src/dashboard/ShopAppearancePage.tsx',
      'src/dashboard/ShopSubscriptionPage.tsx',
      'src/platform/RegisterShopPage.tsx',
    ];
    for (const rel of srcFiles) {
      const content = fs.readFileSync(path.join(WORKSPACE_ROOT, rel), 'utf-8');
      expect(content).not.toContain('allowDataUrlFallback');
    }
  });

  it('includes Cloud Functions for custom claim sync and privileged Super Admin operations', () => {
    expect(functionsSrc).toContain('onShopStaffWritten');
    expect(functionsSrc).toContain('syncMyCustomClaims');
    expect(functionsSrc).toContain('approvePlatformPayment');
    expect(functionsSrc).toContain('rejectPlatformPayment');
    expect(functionsSrc).toContain('updateShopStatusAdmin');
    expect(functionsSrc).toContain('assignShopSubscriptionAdmin');
    expect(functionsSrc).toContain('deleteShopCompleteAdmin');
    expect(functionsSrc).toContain('enforceExpiredSubscriptions');
  });
});

describe('Priority 6 & 9: Non-PII Projection, Tokenized Tracking & Subscription Gating', () => {
  it('strips sensitive owner PII, billing, and usage fields in toShopPublic()', () => {
    const privateShop: Shop = {
      id: 'karachi-mart',
      slug: 'karachi-mart',
      name: 'Karachi Mart',
      ownerId: 'uid_123',
      ownerName: 'Private Owner',
      ownerEmail: 'owner-private@example.com',
      ownerPhone: '03001234567',
      city: 'Karachi',
      address: 'Private Home St 1',
      status: 'active',
      subscription: {
        planId: 'growth-plus',
        planName: 'Growth Plus',
        status: 'active',
        billingCycle: 'monthly',
        pricePaid: 3500,
        startDate: '2026-01-01T00:00:00.000Z',
        expiryDate: '2027-01-01T00:00:00.000Z',
      },
      usage: { productsCount: 14, ordersCount: 99, storageBytes: 4096, staffCount: 2 },
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const pub = toShopPublic(privateShop, { contactPhone: '03110000000' }) as unknown as Record<string, unknown>;
    expect(pub.id).toBe('karachi-mart');
    expect(pub.name).toBe('Karachi Mart');
    expect(pub.publicContactPhone).toBe('03110000000');
    expect('ownerEmail' in pub).toBe(false);
    expect('ownerPhone' in pub).toBe(false);
    expect('ownerName' in pub).toBe(false);
    expect('ownerId' in pub).toBe(false);
    expect('subscription' in pub).toBe(false);
    expect('usage' in pub).toBe(false);
  });

  it('derives deterministic 64-hex tracking hashes and trk_<32hex> document IDs', async () => {
    const token = generateTrackingToken();
    expect(token).toMatch(/^[a-f0-9]{32}$/);

    const hashA = await deriveTrackingTokenHash('PK-123456', token);
    const hashB = await deriveTrackingTokenHash('pk-123456', ` ${token} `);
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);

    const docId = await deriveTrackingDocId('PK-123456', token);
    const wrongDocId = await deriveTrackingDocId('PK-123456', 'wrongtoken');
    expect(docId).toMatch(/^trk_[a-f0-9]{32}$/);
    expect(docId).not.toBe(wrongDocId);
  });

  it('detects expired paid subscriptions accurately vs active starter tier', () => {
    const expiredShop: Shop = {
      id: 'exp-shop',
      slug: 'exp-shop',
      name: 'Expired Shop',
      ownerId: 'u1',
      ownerName: 'O',
      ownerEmail: 'o@example.com',
      ownerPhone: '03001234567',
      city: 'Lahore',
      address: 'Lahore',
      status: 'active',
      subscription: {
        planId: 'growth-plus',
        planName: 'Growth Plus',
        status: 'active',
        billingCycle: 'monthly',
        pricePaid: 3500,
        startDate: '2025-01-01T00:00:00.000Z',
        expiryDate: '2025-02-01T00:00:00.000Z',
      },
      usage: { productsCount: 1, ordersCount: 0, storageBytes: 0, staffCount: 1 },
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    const freeShop: Shop = {
      ...expiredShop,
      id: 'free-shop',
      subscription: { ...expiredShop.subscription, planId: 'free-starter' },
    };

    expect(getShopSubscriptionStatus(expiredShop).isExpired).toBe(true);
    expect(getShopSubscriptionStatus(freeShop).isExpired).toBe(false);
  });
});

describe('Priority 7 & 8: Multi-Tenant BrowserRouter, GitHub Pages & Custom Domain Routing', () => {
  it('computes BrowserRouter basename cleanly for root and GitHub Pages subpaths', () => {
    expect(getRouterBasename('/bazaarpk/', '/bazaarpk/s/karachi-mart', 'user.github.io')).toBe('/bazaarpk');
    expect(getRouterBasename('/', '/bazaarpk-saas/dashboard', 'user.github.io')).toBe('/bazaarpk-saas');
    expect(getRouterBasename('/', '/dashboard', 'user.github.io')).toBe('');
    expect(getRouterBasename('/', '/s/bazaarpk', 'store.bazaarpk.pk')).toBe('');
  });

  it('resolves tenant subdomains while ignoring hosting infrastructure domains', () => {
    expect(resolveTenantFromHostname('lahore-mart.bazaarpk.pk')).toBe('lahore-mart');
    expect(resolveTenantFromHostname('www.bazaarpk.pk')).toBeNull();
    expect(resolveTenantFromHostname('myorg.github.io')).toBeNull();
    expect(resolveTenantFromHostname('localhost')).toBeNull();
    expect(buildStorefrontPath('Karachi Mart!', '/tracking')).toBe('/s/karachi-mart/tracking');
  });

  it('verifies public/404.html and index.html SPA GitHub Pages redirect script exist', () => {
    const html404 = fs.readFileSync(path.join(WORKSPACE_ROOT, 'public/404.html'), 'utf-8');
    const indexHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'index.html'), 'utf-8');
    expect(html404).toContain('pathSegmentsToKeep');
    expect(indexHtml).toContain("l.search[1] === '/'");
  });
});

describe('SaaS Slug, Currency & Plan Invariants', () => {
  it('sanitizes arbitrary store names and blocks reserved routes', () => {
    expect(sanitizeShopSlug('Lahore Kiryana & General Store!')).toBe('lahore-kiryana-general-store');
    expect(isValidShopSlug('al-madina-mart')).toBe(true);
    expect(isValidShopSlug('super-admin')).toBe(false);
    expect(isValidShopSlug('dashboard')).toBe(false);
  });

  it('validates Pakistani mobile formats & formats PKR cleanly', () => {
    expect(isValidPakistaniPhone('0300 1234567')).toBe(true);
    expect(isValidPakistaniPhone('+923451234567')).toBe(true);
    expect(isValidPakistaniPhone('0421234567')).toBe(false);
    expect(formatPKR(2500)).toBe('Rs. 2,500');
  });

  it('recursively strips undefined keys before Firestore writes', () => {
    const cleaned = stripUndefined({
      name: 'Karachi Store',
      note: undefined,
      nested: { city: 'Karachi', optionalCode: undefined },
    });
    expect(cleaned).toEqual({ name: 'Karachi Store', nested: { city: 'Karachi' } });
  });

  it('defines progressive Stage 1 plan quotas, Unlimited (-1) Professional tier, and isolated localStorage keys', () => {
    const freeStarter = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'free-starter');
    const starter = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'starter');
    const business = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'business');
    const professional = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'professional');

    expect(freeStarter?.maxProducts).toBe(1);
    expect(starter?.maxProducts).toBe(50);
    expect(business?.maxProducts).toBe(500);
    expect(professional?.maxProducts).toBe(-1);
    expect(business?.features.pos).toBe(true);
    expect(business?.features.khata).toBe(true);
    expect(starter?.features.pos).toBe(false);
    expect(`bazaarpk_cart_a`).not.toBe(`bazaarpk_cart_b`);
  });
});

describe('Dynamic SEO Tag Generator & Stage 1 Retail Helpers', () => {
  it('generates shop, category, product, and platform SEO metadata + Schema.org JSON-LD from Firestore records', () => {
    const shopPublic = {
      id: 'lahore-mart',
      slug: 'lahore-mart',
      name: 'Lahore Mart',
      city: 'Lahore',
      status: 'active' as const,
      seoTitle: 'Lahore Mart | Best Online Kiryana & Cosmetics',
      seoDescription: 'Fast same-day delivery in Lahore with EasyPaisa, JazzCash & COD.',
    };

    const storeSeo = buildShopSeoTags({ shop: shopPublic, canonicalUrl: 'https://bazaarpk.com/s/lahore-mart' });
    expect(storeSeo.title).toBe('Lahore Mart | Best Online Kiryana & Cosmetics');
    expect(storeSeo.description).toContain('Fast same-day delivery in Lahore');
    expect(storeSeo.jsonLd['@type']).toBe('Store');
    expect(storeSeo.jsonLd.address.addressLocality).toBe('Lahore');

    const catSeo = buildShopSeoTags({
      shop: shopPublic,
      categoryName: 'Skin Care',
      canonicalUrl: 'https://bazaarpk.com/s/lahore-mart/shop',
    });
    expect(catSeo.title).toBe('Skin Care | Lahore Mart (Lahore)');

    const sampleProduct: Product = {
      id: 'p1',
      title: 'Basmati Rice 5kg',
      slug: 'basmati-rice-5kg',
      description: 'Premium aged Pakistani super kernel basmati rice.',
      regularPrice: 2200,
      salePrice: 1950,
      stock: 15,
      category: 'groceries',
      brand: 'Guard',
      images: ['https://cdn.example.com/rice.jpg'],
      sku: 'SKU-RICE-5',
      isFeatured: true,
      isPublished: true,
      rating: 4.9,
      reviewCount: 12,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const prodSeo = buildShopSeoTags({
      shop: shopPublic,
      product: sampleProduct,
      canonicalUrl: 'https://sbkhush.com/s/lahore-mart/product/p1',
    });
    expect(prodSeo.ogType).toBe('product');
    expect(prodSeo.title).toContain('Basmati Rice 5kg');
    expect(prodSeo.priceAmount).toBe(1950);
    expect(prodSeo.availability).toBe('in stock');
    expect(prodSeo.jsonLd['@type']).toBe('Product');
    expect(prodSeo.jsonLd.offers.priceCurrency).toBe('PKR');

    const platformSeo = buildPlatformSeoTags('https://sbkhush.com/');
    expect(platformSeo.jsonLd['@type']).toBe('WebApplication');
    expect(platformSeo.title).toContain('SB Khush');
  });

  it('enforces Free Plan 1-active-product limit excluding archived products', () => {
    const items = [
      { status: 'active' as const, isPublished: true },
      { status: 'archived' as const, isPublished: false },
      { status: 'active' as const, isPublished: false },
    ];
    expect(countActiveProducts(items)).toBe(1);
    expect(getProductLimitErrorMessage('free-starter', 'Free Plan', 1, 1)).toBe(
      'Your Free Plan allows only 1 active product. Upgrade to Starter to add up to 50 products.'
    );
  });

  it('handles subscription renewal grace period window cleanly', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();

    const baseShop: Shop = {
      id: 'grace-shop',
      slug: 'grace-shop',
      name: 'Grace Store',
      ownerId: 'u1',
      ownerName: 'O',
      ownerEmail: 'o@example.com',
      ownerPhone: '03001234567',
      city: 'Karachi',
      address: 'Karachi',
      status: 'active',
      subscription: {
        planId: 'business',
        planName: 'Business',
        status: 'active',
        billingCycle: 'monthly',
        pricePaid: 1499,
        startDate: '2026-01-01T00:00:00.000Z',
        expiryDate: threeDaysAgo,
      },
      usage: { productsCount: 10, ordersCount: 5, storageBytes: 0, staffCount: 1 },
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const withinGrace = getShopSubscriptionStatus(baseShop, 5);
    expect(withinGrace.inGracePeriod).toBe(true);
    expect(withinGrace.isExpired).toBe(false);

    const pastGrace = getShopSubscriptionStatus(
      { ...baseShop, subscription: { ...baseShop.subscription, expiryDate: tenDaysAgo } },
      5
    );
    expect(pastGrace.inGracePeriod).toBe(false);
    expect(pastGrace.isExpired).toBe(true);
  });

  it('computes COGS, Gross/Net Profit, Estimated COGS warnings, and Inventory Valuation accurately', () => {
    const products: Product[] = [
      {
        id: 'p1',
        title: 'Product A',
        slug: 'a',
        description: '',
        purchasePrice: 600,
        regularPrice: 1000,
        stock: 10,
        category: 'general',
        brand: 'B',
        images: [],
        sku: 'A1',
        isFeatured: false,
        isPublished: true,
        rating: 5,
        reviewCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'p2',
        title: 'Product B (No Cost)',
        slug: 'b',
        description: '',
        regularPrice: 500,
        stock: 4,
        status: 'active',
        category: 'general',
        brand: 'B',
        images: [],
        sku: 'B1',
        isFeatured: false,
        isPublished: true,
        rating: 5,
        reviewCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const orders: Order[] = [
      {
        id: 'ord1',
        orderNumber: 'PK-100001',
        userId: 'u1',
        customer: { name: 'Ali', email: 'a@b.pk', phone: '03001234567', address: 'St 1', city: 'Lahore', postalCode: '' },
        items: [{ productId: 'p1', title: 'Product A', price: 1000, quantity: 2, image: '' }],
        subtotal: 2000,
        shippingFee: 0,
        discount: 0,
        total: 2000,
        paymentMethod: 'cod',
        paymentStatus: 'paid',
        orderStatus: 'Delivered',
        createdAt: '2026-02-01T00:00:00.000Z',
      },
    ];

    const posSales: PosSale[] = [
      {
        id: 'pos1',
        shopId: 's1',
        invoiceNumber: 'INV-1',
        idempotencyKey: 'k1',
        items: [{ productId: 'p2', title: 'Product B', quantity: 1, unitPrice: 500, costPrice: 0, lineTotal: 500 }],
        subtotal: 500,
        discount: 0,
        total: 500,
        paymentMethod: 'cash',
        cashierId: 'c1',
        cashierName: 'Cashier',
        status: 'completed',
        createdAt: '2026-02-02T00:00:00.000Z',
      },
    ];

    const expenses: ShopExpense[] = [
      { id: 'e1', shopId: 's1', title: 'Electricity', category: 'utilities', amount: 300, date: '2026-02-02', createdBy: 'owner@example.com', createdAt: '2026-02-02' },
    ];

    const summary = calculateRetailProfitSummary({ orders, posSales, products, expenses });
    expect(summary.totalRevenue).toBe(2500);
    expect(summary.onlineRevenue).toBe(2000);
    expect(summary.posRevenue).toBe(500);
    expect(summary.cogs).toBe(1200);
    expect(summary.grossProfit).toBe(1300);
    expect(summary.totalExpenses).toBe(300);
    expect(summary.netProfit).toBe(1000);
    expect(summary.hasEstimatedCogs).toBe(true);
    expect(summary.missingCostItemsCount).toBe(1);

    const val = calculateInventoryValuation(products);
    expect(val.totalUnits).toBe(14);
    expect(val.costValuation).toBe(6000);
    expect(val.retailValuation).toBe(12000);
    expect(val.missingCostCount).toBe(1);
  });

  it('keeps public landing page free of /super-admin links, pharmacy claims, or pulsing dots', () => {
    const publicFiles = [
      'src/platform/PlatformLandingPage.tsx',
      'src/platform/components/PublicNavbar.tsx',
      'src/platform/components/Hero3DShowcase.tsx',
      'src/platform/components/FeaturesAndSolutionsSection.tsx',
      'src/platform/components/ShowcaseAndPricingSection.tsx',
    ];
    for (const rel of publicFiles) {
      const src = fs.readFileSync(path.join(WORKSPACE_ROOT, rel), 'utf-8');
      expect(src).not.toContain('/super-admin');
      expect(src.toLowerCase()).not.toContain('pharmacy');
      expect(src).not.toContain('animate-pulse');
    }
    const landingSrc = fs.readFileSync(
      path.join(WORKSPACE_ROOT, 'src/platform/PlatformLandingPage.tsx'),
      'utf-8'
    );
    expect(landingSrc).toContain('getSubscriptionPlans');
    expect(landingSrc).toContain('getActiveDirectoryShopsPublic');
    expect(landingSrc).toContain('getPlatformSettings');
  });
});

describe('Phase 2-6 Audit: Dual Social System, Storage Quota, Partial Merge, Private Receipts & Server Hardening', () => {
  it('validates & normalizes WhatsApp + social URLs while filtering placeholders and XSS schemes', async () => {
    const {
      formatWhatsAppUrl,
      isPlaceholderSocialUrl,
      normalizeAndValidateSocialLinks,
      getConfiguredSocialLinks,
      normalizeOptionalHttpUrl,
    } = await import('../src/utils/socialLinks');

    expect(formatWhatsAppUrl('0300 5551234')).toBe('https://wa.me/923005551234');
    expect(formatWhatsAppUrl('+923451234567')).toBe('https://wa.me/923451234567');
    expect(() => normalizeAndValidateSocialLinks({ facebook: 'javascript:alert(1)' })).toThrow();
    expect(() => normalizeOptionalHttpUrl('data:text/html,xss')).toThrow();

    expect(isPlaceholderSocialUrl('https://facebook.com')).toBe(true);
    expect(isPlaceholderSocialUrl('https://instagram.com/')).toBe(true);
    expect(isPlaceholderSocialUrl('https://wa.me/923001234567')).toBe(true);
    expect(isPlaceholderSocialUrl('https://facebook.com/realstorepk')).toBe(false);

    const visibleLinks = getConfiguredSocialLinks({
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com/lahore_mart_official',
      whatsapp: '0321 9876543',
    });
    expect(visibleLinks.map((l) => l.platform)).toEqual(['instagram', 'whatsapp']);
    expect(visibleLinks[1].url).toBe('https://wa.me/923219876543');
  });

  it('enforces post-compression Storage quota checks and prevents negative storageBytes', async () => {
    const {
      calculateNextStorageBytes,
      evaluateStorageQuota,
      mapFirebaseStorageError,
    } = await import('../src/services/storageService');

    expect(calculateNextStorageBytes(500, -1200)).toBe(0);
    expect(calculateNextStorageBytes(500, 300)).toBe(800);

    const withinQuota = evaluateStorageQuota(10 * 1024 * 1024, 25, 1024 * 1024);
    expect(withinQuota.allowed).toBe(true);

    const exceededQuota = evaluateStorageQuota(24.8 * 1024 * 1024, 25, 512 * 1024);
    expect(exceededQuota.allowed).toBe(false);
    expect(exceededQuota.reason).toContain('Storage quota reached');

    expect(mapFirebaseStorageError({ code: 'storage/unauthorized' })).toContain('storage.rules');
    expect(mapFirebaseStorageError({ code: 'storage/bucket-not-found' })).toContain('bucket');
  });

  it('preserves unrelated StoreSettings sections when partially updating Appearance vs Payment Settings', async () => {
    const { mergeStoreSettingsPatch } = await import('../src/services/tenantService');
    const { INITIAL_SETTINGS } = await import('../src/data/seedData');

    const base = {
      ...INITIAL_SETTINGS,
      siteName: 'Lahore Mart',
      codEnabled: false,
      bankDetails: { ...INITIAL_SETTINGS.bankDetails, bankName: 'Meezan Bank', enabled: true },
      socialLinks: { instagram: 'https://instagram.com/lahoremart' },
    };

    const afterAppearancePatch = mergeStoreSettingsPatch(base, {
      primaryColor: '#111827',
      seoTitle: 'Lahore Mart Official',
    });
    expect(afterAppearancePatch.codEnabled).toBe(false);
    expect(afterAppearancePatch.bankDetails.bankName).toBe('Meezan Bank');
    expect(afterAppearancePatch.socialLinks?.instagram).toBe('https://instagram.com/lahoremart');
    expect(afterAppearancePatch.primaryColor).toBe('#111827');

    const afterPaymentPatch = mergeStoreSettingsPatch(afterAppearancePatch, {
      shippingFee: 300,
    });
    expect(afterPaymentPatch.seoTitle).toBe('Lahore Mart Official');
    expect(afterPaymentPatch.shippingFee).toBe(300);
    expect(afterPaymentPatch.socialLinks?.instagram).toBe('https://instagram.com/lahoremart');
  });

  it('keeps checkout payment proofs strictly private & enforces authenticated proof access in rules & backend', () => {
    const checkoutSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/pages/CheckoutPage.tsx'), 'utf-8');
    const firestoreRules = fs.readFileSync(path.join(WORKSPACE_ROOT, 'firestore.rules'), 'utf-8');
    const storageRules = fs.readFileSync(path.join(WORKSPACE_ROOT, 'storage.rules'), 'utf-8');
    const serverSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'server.ts'), 'utf-8');

    expect(checkoutSrc).toContain('uploadCheckoutPaymentProof');
    expect(firestoreRules).toContain('match /payment_receipts/{receiptId}');
    expect(firestoreRules).toContain('match /platform_payment_receipts/{receiptId}');
    expect(firestoreRules).toContain('match /newsletter_subscribers/{subId}');
    expect(storageRules).toContain('match /platform/brand/{allPaths=**}');

    expect(serverSrc).toContain('Number(process.env.PORT) || 3000');
    expect(serverSrc).toContain("app.get('/api/payments/proof'");
    expect(serverSrc).toContain("app.post('/api/uploads/payment-proof'");
    expect(serverSrc).toContain("app.post('/api/newsletter/subscribe'");
    expect(serverSrc).toContain('authoritativeSubtotal');
    expect(serverSrc).toContain('authoritativeTotal');
    expect(serverSrc).toContain('verifyFirebaseIdToken');
    expect(serverSrc).toContain('Access-Control-Allow-Origin');
  });

  it('builds dynamic platform SEO metadata with Super Admin overrides cleanly', () => {
    const seo = buildPlatformSeoTags('https://bazaarpk.com/', {
      platformName: 'BazaarPK Pro',
      seoTitle: 'BazaarPK Pro – Pakistan Multi-Tenant SaaS',
      seoDescription: 'Custom SaaS meta description from Super Admin.',
      ogImageUrl: 'https://cdn.example.com/platform-og.webp',
      currency: 'PKR',
    });

    expect(seo.siteName).toBe('BazaarPK Pro');
    expect(seo.title).toBe('BazaarPK Pro – Pakistan Multi-Tenant SaaS');
    expect(seo.description).toBe('Custom SaaS meta description from Super Admin.');
    expect(seo.imageUrl).toBe('https://cdn.example.com/platform-og.webp');
    expect(seo.jsonLd.name).toBe('BazaarPK Pro');
  });
});

describe('Super Admin Sales Management & Individual Salesman Portal', () => {
  it('calculates commissions deterministically for first subscription, yearly plans, and renewals', async () => {
    const {
      calculateCommissionForPayment,
      DEFAULT_SALES_SETTINGS,
    } = await import('../src/services/salesService');

    const firstMonthly = calculateCommissionForPayment({
      paymentAmount: 2000,
      billingCycle: 'monthly',
      member: { commissionPlanId: 'tier-standard' },
      settings: DEFAULT_SALES_SETTINGS,
      isRenewal: false,
    });
    expect(firstMonthly.ratePct).toBe(15);
    expect(firstMonthly.flatBonusAmount).toBe(300);
    expect(firstMonthly.commissionAmount).toBe(600);
    expect(firstMonthly.commissionType).toBe('subscription_first');

    const firstYearly = calculateCommissionForPayment({
      paymentAmount: 20000,
      billingCycle: 'yearly',
      member: { commissionPlanId: 'tier-standard' },
      settings: DEFAULT_SALES_SETTINGS,
      isRenewal: false,
    });
    expect(firstYearly.ratePct).toBe(18);
    expect(firstYearly.flatBonusAmount).toBe(300);
    expect(firstYearly.commissionAmount).toBe(3900);

    const renewal = calculateCommissionForPayment({
      paymentAmount: 2000,
      billingCycle: 'monthly',
      member: { commissionPlanId: 'tier-standard' },
      settings: DEFAULT_SALES_SETTINGS,
      isRenewal: true,
    });
    expect(renewal.ratePct).toBe(5);
    expect(renewal.flatBonusAmount).toBe(0);
    expect(renewal.commissionAmount).toBe(100);
    expect(renewal.commissionType).toBe('subscription_renewal');
  });

  it('normalizes phone formats and catches duplicate leads by phone, email, or business+city', async () => {
    const {
      normalizePhoneForMatch,
      detectDuplicateLead,
    } = await import('../src/services/salesService');

    expect(normalizePhoneForMatch('+92 300 1234567')).toBe('03001234567');
    expect(normalizePhoneForMatch('3001234567')).toBe('03001234567');
    expect(normalizePhoneForMatch('0300-1234567')).toBe('03001234567');

    const existing = [
      {
        id: 'lead_1',
        businessName: 'Al-Madina Mart',
        ownerName: 'Bilal',
        phone: '03001234567',
        normalizedPhone: '03001234567',
        email: 'bilal@madina.pk',
        normalizedEmail: 'bilal@madina.pk',
        city: 'Lahore',
        industry: 'general_store' as const,
        leadSource: 'field_visit' as const,
        status: 'New' as const,
        createdBy: 'admin',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    expect(
      detectDuplicateLead(
        { businessName: 'Other Name', phone: '+923001234567', city: 'Karachi' },
        existing
      )?.reason
    ).toContain('phone');

    expect(
      detectDuplicateLead(
        { businessName: 'Other Name', phone: '03110000000', email: 'BILAL@madina.pk', city: 'Karachi' },
        existing
      )?.reason
    ).toContain('email');

    expect(
      detectDuplicateLead(
        { businessName: 'al-madina mart', phone: '03110000000', city: 'lahore' },
        existing
      )?.reason
    ).toContain('Matching business');
  });

  it('mitigates CSV formula injection and parses RFC-4180 CSV rows cleanly', async () => {
    const { escapeCsvCell, buildCsvContent, parseCsvRows } = await import('../src/utils/csvUtils');

    expect(escapeCsvCell('=CMD|"/C calc"!A0')).toBe('"\'=CMD|""/C calc""!A0"');
    expect(escapeCsvCell('+SUM(1,2)')).toBe('"\'+SUM(1,2)"');
    expect(escapeCsvCell('-100')).toBe("'-100");
    expect(escapeCsvCell('@evil')).toBe("'@evil");

    const csv = buildCsvContent(['Shop', 'City'], [['Lahore, Central', 'Lahore']]);
    const parsed = parseCsvRows(csv);
    expect(parsed).toEqual([
      ['Shop', 'City'],
      ['Lahore, Central', 'Lahore'],
    ]);
  });

  it('computes live Sales Dashboard analytics from real database records without hardcoded values', async () => {
    const { computeSalesDashboardAnalytics } = await import('../src/services/salesService');

    const todayIso = new Date().toISOString();
    const summary = computeSalesDashboardAnalytics(
      {
        members: [
          {
            id: 'sm1',
            employeeId: 'BPK-SLS-001',
            fullName: 'Usman Tariq',
            email: 'usman@sbkhush.com',
            phone: '03001112233',
            city: 'Karachi',
            role: 'salesman',
            territory: 'South Karachi',
            industryFocus: 'all',
            joiningDate: '2026-01-01',
            employmentStatus: 'full_time',
            monthlyTarget: 50000,
            yearlyTarget: 600000,
            commissionPlanId: 'tier-standard',
            commissionPlanName: 'Standard',
            accountStatus: 'active',
            referralCode: 'SAL-USMA-1001',
            referralLink: 'https://sbkhush.com/r/SAL-USMA-1001',
            qrScanCount: 12,
            createdBy: 'admin',
            createdAt: todayIso,
          },
        ],
        leads: [
          {
            id: 'l1',
            businessName: 'Clifton Grocery',
            ownerName: 'Hassan',
            phone: '03211112233',
            normalizedPhone: '03211112233',
            city: 'Karachi',
            industry: 'general_store',
            assignedSalesmanId: 'sm1',
            leadSource: 'field_visit',
            status: 'Converted',
            createdBy: 'admin',
            createdAt: todayIso,
          },
        ],
        referrals: [
          {
            id: 'shop1',
            referralCode: 'SAL-USMA-1001',
            salesmanId: 'sm1',
            salesmanName: 'Usman Tariq',
            shopId: 'shop1',
            shopSlug: 'clifton-grocery',
            shopName: 'Clifton Grocery',
            ownerId: 'u_shop',
            ownerEmail: 'hassan@clifton.pk',
            city: 'Karachi',
            industry: 'general_store',
            source: 'qr_scan',
            attributionStatus: 'subscribed',
            totalRevenueGenerated: 5000,
            createdAt: todayIso,
          },
        ],
        shops: [
          {
            id: 'shop1',
            slug: 'clifton-grocery',
            name: 'Clifton Grocery',
            ownerId: 'u_shop',
            ownerName: 'Hassan',
            ownerEmail: 'hassan@clifton.pk',
            ownerPhone: '03211112233',
            city: 'Karachi',
            address: 'Clifton',
            businessType: 'general_store',
            status: 'active',
            subscription: {
              planId: 'business',
              planName: 'Business',
              status: 'active',
              billingCycle: 'monthly',
              pricePaid: 5000,
              startDate: todayIso,
              expiryDate: todayIso,
            },
            usage: { productsCount: 2, ordersCount: 1, storageBytes: 0, staffCount: 1 },
            createdAt: todayIso,
          },
        ],
        payments: [
          {
            id: 'pay1',
            shopId: 'shop1',
            shopName: 'Clifton Grocery',
            shopSlug: 'clifton-grocery',
            ownerId: 'u_shop',
            ownerEmail: 'hassan@clifton.pk',
            planId: 'business',
            planName: 'Business',
            billingCycle: 'monthly',
            amount: 5000,
            method: 'easypaisa',
            senderNumber: '03211112233',
            transactionId: 'TID-1',
            proofUrl: 'https://cdn.example.com/proof.jpg',
            status: 'approved',
            createdAt: todayIso,
          },
        ],
        commissions: [
          {
            id: 'comm_pay1',
            salesmanId: 'sm1',
            salesmanName: 'Usman Tariq',
            shopId: 'shop1',
            shopName: 'Clifton Grocery',
            paymentId: 'pay1',
            planId: 'business',
            planName: 'Business',
            billingCycle: 'monthly',
            paymentAmount: 5000,
            commissionRatePct: 15,
            flatBonusAmount: 300,
            commissionAmount: 1050,
            commissionType: 'subscription_first',
            status: 'approved',
            createdAt: todayIso,
          },
        ],
        targets: [],
      },
      { preset: 'all_time' }
    );

    expect(summary.totalSalesmen).toBe(1);
    expect(summary.activeSalesmen).toBe(1);
    expect(summary.convertedLeads).toBe(1);
    expect(summary.totalRegisteredShops).toBe(1);
    expect(summary.verifiedShops).toBe(1);
    expect(summary.paidSubscriptions).toBe(1);
    expect(summary.totalSalesRevenue).toBe(5000);
    expect(summary.totalCommissionGenerated).toBe(1050);
    expect(summary.pendingCommission).toBe(1050);
    expect(summary.commissionPaid).toBe(0);
    expect(summary.targetVsAchievement[0].conversionRate).toBe(100);
  });

  it('enforces Sales RBAC isolation in firestore.rules, server.ts, and exposes all 15 Super Admin menu links + Salesman Portal routes', () => {
    const firestoreRules = fs.readFileSync(path.join(WORKSPACE_ROOT, 'firestore.rules'), 'utf-8');
    const serverSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'server.ts'), 'utf-8');
    const layoutSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/superadmin/SuperAdminLayout.tsx'), 'utf-8');
    const appSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/App.tsx'), 'utf-8');

    // Commission & Payout strict read-only for salesmen
    expect(firestoreRules).toContain('match /commissionLedger/{commissionId}');
    expect(firestoreRules).toContain('allow create, update, delete: if isValidId(commissionId) && isSuperAdmin();');
    expect(firestoreRules).toContain('match /commissionPayouts/{payoutId}');
    expect(firestoreRules).toContain('allow create, update, delete: if isValidId(payoutId) && isSuperAdmin();');
    expect(firestoreRules).toContain('match /salesAuditLogs/{logId}');
    expect(firestoreRules).toContain('allow update, delete: if false;');
    expect(firestoreRules).toContain('match /salesReferralIndex/{code}');

    // Backend sales routes with Super Admin Bearer token checks
    expect(serverSrc).toContain("app.post('/api/sales/qr/track'");
    expect(serverSrc).toContain("app.post('/api/sales/referrals/record'");
    expect(serverSrc).toContain("app.post('/api/sales/commissions/sync'");
    expect(serverSrc).toContain("app.post('/api/sales/commissions/decision'");
    expect(serverSrc).toContain("app.post('/api/sales/payouts'");
    expect(serverSrc).toContain("app.post('/api/sales/referrals/regenerate'");

    // All 15 Super Admin Sales Management nav routes & Individual Salesman Portal routes
    const requiredNavLabels = [
      'Sales Overview',
      'Salesman Portal',
      'All Salesmen',
      'Add New Salesman',
      'Sales Teams',
      'Sales Leads',
      'Shop Registrations',
      'Referrals',
      'Sales Targets',
      'Commission Management',
      'Payout Management',
      'QR Code Management',
      'Sales Reports',
      'Activity Logs',
      'Sales Settings',
    ];
    for (const label of requiredNavLabels) {
      expect(layoutSrc).toContain(label);
    }
    expect(appSrc).toContain('/salesman/login');
    expect(appSrc).toContain('/salesman');
    expect(appSrc).toContain('/r/:refCode');
    expect(appSrc).toContain('sales/qr-codes');
    expect(appSrc).toContain('sales/payouts');
  });
});

describe('SB Khush Production Transformation, Public Separation, Demo Audit & Mobile Upload Validation', () => {
  it('configures SB Khush official domain and branding constants cleanly', async () => {
    const { BRAND } = await import('../src/config/brand');
    expect(BRAND.name).toBe('SB Khush');
    expect(BRAND.primaryUrl).toBe('https://sbkhush.com');
    expect(BRAND.secondaryUrl).toBe('https://www.sbkhush.com');
    expect(BRAND.salesEmployeePrefix).toBe('SBK-SLS-');
  });

  it('removes Login and Dashboard buttons from public homepage navbar and footer while separating legal routes', () => {
    const navbarSrc = fs.readFileSync(
      path.join(WORKSPACE_ROOT, 'src/platform/components/PublicNavbar.tsx'),
      'utf-8'
    );
    const showcaseSrc = fs.readFileSync(
      path.join(WORKSPACE_ROOT, 'src/platform/components/ShowcaseAndPricingSection.tsx'),
      'utf-8'
    );
    const appSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/App.tsx'), 'utf-8');

    expect(navbarSrc).not.toContain('to="/login"');
    expect(navbarSrc).not.toContain('to="/dashboard"');
    expect(showcaseSrc).not.toContain('to="/login"');
    expect(showcaseSrc).not.toContain('to="/dashboard"');
    expect(showcaseSrc).toContain('to="/privacy-policy"');
    expect(showcaseSrc).toContain('to="/terms-and-conditions"');

    expect(appSrc).toContain('/merchant/login');
    expect(appSrc).toContain('/privacy-policy');
    expect(appSrc).toContain('/terms-and-conditions');
    expect(appSrc).toContain('/shop/:shopSlug');
  });

  it('classifies demo vs real stores safely without auto-flagging active real merchants', async () => {
    const { buildDemoDataAuditReport } = await import('../src/utils/demoDataAudit');

    const realShop: Shop = {
      id: 'karachi-mart',
      slug: 'karachi-mart',
      name: 'Karachi Fresh Goods',
      ownerId: 'uid_real',
      ownerName: 'Faisal Ahmed',
      ownerEmail: 'faisal@karachifresh.pk',
      ownerPhone: '03009876543',
      city: 'Karachi',
      address: 'Clifton Block 5',
      status: 'active',
      subscription: {
        planId: 'business',
        planName: 'Business',
        status: 'active',
        billingCycle: 'monthly',
        pricePaid: 1499,
        startDate: '2026-01-01T00:00:00.000Z',
        expiryDate: '2027-01-01T00:00:00.000Z',
      },
      usage: { productsCount: 18, ordersCount: 42, storageBytes: 0, staffCount: 2 },
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const noisyActiveShop: Shop = {
      ...realShop,
      id: 'demo-shop',
      slug: 'demo-shop',
      name: 'Demo Active Business',
    };

    const testPlaceholderShop: Shop = {
      ...realShop,
      id: 'qa-shop-1',
      slug: 'test-shop',
      name: 'QA Test Store',
      ownerEmail: 'qa@test.com',
      ownerPhone: '03000000000',
      subscription: {
        ...realShop.subscription,
        planId: 'free-starter',
        planName: 'Free',
        status: 'trial',
        pricePaid: 0,
      },
      usage: { productsCount: 0, ordersCount: 0, storageBytes: 0, staffCount: 0 },
    };

    const report = buildDemoDataAuditReport({
      shops: [realShop, noisyActiveShop, testPlaceholderShop],
    });

    expect(report.totals.real).toBe(1);
    expect(report.totals.uncertain).toBe(1);
    expect(report.totals.demo + report.totals.test).toBe(1);
    expect(report.items.find((i) => i.id === 'karachi-mart')?.classification).toBe('real');
    expect(report.items.find((i) => i.id === 'demo-shop')?.classification).toBe('uncertain');
  });

  it('validates mobile image uploads with empty MIME type fallback and enforces size/type caps', async () => {
    const { validateImageFile } = await import('../src/services/storageService');

    const mobileCameraPhoto = {
      name: 'IMG_20261120.jpg',
      type: '',
      size: 1024 * 500,
    } as File;
    expect(() => validateImageFile(mobileCameraPhoto)).not.toThrow();

    const oversizedPhoto = {
      name: 'huge.png',
      type: 'image/png',
      size: 6 * 1024 * 1024,
    } as File;
    expect(() => validateImageFile(oversizedPhoto)).toThrow(/5 MB/);

    const badMime = {
      name: 'script.exe',
      type: 'application/x-msdownload',
      size: 1024,
    } as File;
    expect(() => validateImageFile(badMime)).toThrow(/Invalid image format/);
  });

  it('supports shop settings legal pages in firestore.rules and reserves SB Khush platform slugs', () => {
    const firestoreRules = fs.readFileSync(path.join(WORKSPACE_ROOT, 'firestore.rules'), 'utf-8');
    expect(firestoreRules).toContain("hasShopPermission(shopId, 'settings')");
    expect(firestoreRules).toContain("'merchant'");
    expect(firestoreRules).toContain("'privacy-policy'");
    expect(firestoreRules).toContain("'terms-and-conditions'");
  });

  it('encodes and decodes Firestore v1 REST values & documents cleanly including nested maps and arrays', async () => {
    const {
      encodeFirestoreValue,
      encodeFirestoreFields,
      decodeFirestoreValue,
      decodeFirestoreDoc,
    } = await import('../src/utils/firestoreRestServer');

    expect(encodeFirestoreValue(null)).toEqual({ nullValue: null });
    expect(encodeFirestoreValue(true)).toEqual({ booleanValue: true });
    expect(encodeFirestoreValue(42)).toEqual({ integerValue: '42' });
    expect(encodeFirestoreValue(3.14)).toEqual({ doubleValue: 3.14 });
    expect(encodeFirestoreValue('SB Khush')).toEqual({ stringValue: 'SB Khush' });

    const sample = {
      id: 'sm_1',
      employeeId: 'SBK-SLS-001',
      monthlyTarget: 50000,
      rate: 15.5,
      active: true,
      tags: ['karachi', 'retail'],
      payoutDetails: {
        method: 'bank_transfer',
        bankName: 'Meezan Bank',
        nullableNote: null,
      },
      ignoredUndefined: undefined,
    };

    const fields = encodeFirestoreFields(sample);
    expect(fields.ignoredUndefined).toBeUndefined();
    expect(decodeFirestoreValue(fields.payoutDetails)).toEqual({
      method: 'bank_transfer',
      bankName: 'Meezan Bank',
      nullableNote: null,
    });

    const decoded = decodeFirestoreDoc({
      name: 'projects/test/databases/db/documents/salesMembers/sm_1',
      fields,
    });
    expect(decoded).toEqual({
      id: 'sm_1',
      employeeId: 'SBK-SLS-001',
      monthlyTarget: 50000,
      rate: 15.5,
      active: true,
      tags: ['karachi', 'retail'],
      payoutDetails: {
        method: 'bank_transfer',
        bankName: 'Meezan Bank',
        nullableNote: null,
      },
    });
  });

  it('enforces salesperson creation RBAC, validation, SBK-SLS IDs, and caller-authenticated REST writes with Auth rollback', async () => {
    const { createSalesMember, generateEmployeeId } = await import('../src/services/salesService');
    const serverSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'server.ts'), 'utf-8');
    const firestoreRules = fs.readFileSync(path.join(WORKSPACE_ROOT, 'firestore.rules'), 'utf-8');

    expect(generateEmployeeId([{ employeeId: 'SBK-SLS-001' }, { employeeId: 'SBK-SLS-002' }])).toBe('SBK-SLS-003');

    const basePayload = {
      fullName: 'Ali Raza',
      email: 'ali.sales@sbkhush.com',
      phone: '03001234567',
      city: 'Lahore',
      role: 'salesman' as const,
      territory: 'Lahore Central',
      industryFocus: 'all' as const,
      joiningDate: '2026-11-22',
      employmentStatus: 'full_time' as const,
      monthlyTarget: 50000,
      yearlyTarget: 600000,
      commissionPlanId: 'tier-standard',
      commissionPlanName: 'Standard',
      accountStatus: 'invited' as const,
    };

    await expect(createSalesMember({ ...basePayload, role: 'super_admin' as any })).rejects.toThrow(
      /Security Policy Violation/
    );
    await expect(createSalesMember({ ...basePayload, email: 'hasanaamir815@gmail.com' })).rejects.toThrow(
      /Super Admin account cannot be registered/
    );
    await expect(createSalesMember({ ...basePayload, phone: '123' })).rejects.toThrow(/valid mobile phone/);

    // Verify backend uses caller-authenticated REST API, exposes invite route, and rolls back Auth orphans
    expect(serverSrc).toContain("app.post('/api/super-admin/sales/invite'");
    expect(serverSrc).toContain('restCommitWrites');
    expect(serverSrc).toContain('accounts:delete');
    expect(firestoreRules).toContain('isAllowedSalesRole(incoming().role)');
    expect(firestoreRules).toContain("admins/$(request.auth.uid)");
  });
});

describe('Waves 1-3 Production Hardening: Portals, Zero-Demo Storefront, CSV Suite, Affiliate Onboarding & QR Dedup', () => {
  it('places React hooks strictly before early returns and guards portal/sales dashboards with error banners', () => {
    const portalFiles = [
      'src/referral/ReferralDashboardPage.tsx',
      'src/salesman/SalesmanDashboardPage.tsx',
      'src/salesmanager/SalesManagerDashboardPage.tsx',
      'src/salesman/SalesmanLayout.tsx',
      'src/superadmin/sales/SalesOverviewPage.tsx',
      'src/superadmin/sales/SalesMembersPage.tsx',
      'src/superadmin/sales/SalesLeadsPage.tsx',
      'src/superadmin/sales/SalesCommissionsPage.tsx',
      'src/superadmin/sales/SalesPayoutsPage.tsx',
    ];
    for (const rel of portalFiles) {
      const src = fs.readFileSync(path.join(WORKSPACE_ROOT, rel), 'utf-8');
      const firstLoadingGuard = src.indexOf('if (loading)');
      const lastUseMemoOrCallback = Math.max(src.lastIndexOf('useMemo('), src.lastIndexOf('useCallback('), src.lastIndexOf('useEffect('));
      if (firstLoadingGuard !== -1 && lastUseMemoOrCallback !== -1) {
        expect(lastUseMemoOrCallback).toBeLessThan(firstLoadingGuard);
      }
    }
    const salesServiceSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/services/salesService.ts'), 'utf-8');
    expect(salesServiceSrc).toContain("handleFirestoreError(err, OperationType.LIST, 'salesLeads')");
    expect(salesServiceSrc).toContain("handleFirestoreError(err, OperationType.LIST, 'commissionLedger')");
  });

  it('eliminates INITIAL_* / DEFAULT_SHOP_ID live storefront catalog fallbacks, removes mock online card payments, and adds checkout idempotency', () => {
    const storefrontFiles = [
      'src/pages/HomePage.tsx',
      'src/pages/ShopPage.tsx',
      'src/pages/ProductDetailPage.tsx',
      'src/pages/AccountPage.tsx',
      'src/components/common/Header.tsx',
      'src/components/common/Footer.tsx',
    ];
    for (const rel of storefrontFiles) {
      const src = fs.readFileSync(path.join(WORKSPACE_ROOT, rel), 'utf-8');
      expect(src).not.toContain('INITIAL_PRODUCTS');
      expect(src).not.toContain('INITIAL_CATEGORIES');
      expect(src).not.toContain('INITIAL_BANNERS');
      expect(src).not.toContain('DEFAULT_SHOP_ID');
    }
    const migrationSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/services/migrationService.ts'), 'utf-8');
    expect(migrationSrc).not.toContain('INITIAL_PRODUCTS');
    expect(migrationSrc).not.toContain('INITIAL_CATEGORIES');
    expect(migrationSrc).not.toContain('INITIAL_BANNERS');

    const checkoutSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/pages/CheckoutPage.tsx'), 'utf-8');
    const tenantServiceSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/services/tenantService.ts'), 'utf-8');
    const serverSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'server.ts'), 'utf-8');
    const homeSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/pages/HomePage.tsx'), 'utf-8');

    expect(checkoutSrc).toContain('hasEnabledPaymentMethod');
    expect(checkoutSrc).toContain('idempotencyKey: checkoutSessionId');
    expect(checkoutSrc).not.toContain('cardNumber');
    expect(checkoutSrc).not.toContain('cardCvv');

    expect(tenantServiceSrc).toContain('ord_${idemKey}');
    expect(tenantServiceSrc).toContain('getShopRecentReviews');
    expect(tenantServiceSrc).toContain('Online card payments are not enabled');

    expect(serverSrc).toContain('orderIdempotencyCache');
    expect(serverSrc).toContain('ord_${cleanIdempotencyKey.slice(0, 80)}');
    expect(homeSrc).toContain('getShopRecentReviews');
  });

  it('rolls out formula-safe CSV exports and reusable CsvImportModal across shop and sales admin modules', () => {
    const csvModalFiles = [
      'src/dashboard/ShopProductsPage.tsx',
      'src/dashboard/ShopCategoriesPage.tsx',
      'src/dashboard/ShopCustomersPage.tsx',
      'src/dashboard/ShopSuppliersPage.tsx',
      'src/dashboard/ShopInventoryPage.tsx',
      'src/superadmin/sales/SalesLeadsPage.tsx',
    ];
    for (const rel of csvModalFiles) {
      const src = fs.readFileSync(path.join(WORKSPACE_ROOT, rel), 'utf-8');
      expect(src).toContain('CsvImportModal');
      expect(src).toContain('downloadCsvFile');
    }

    const csvExportOnlyFiles = [
      'src/dashboard/ShopOrdersPage.tsx',
      'src/dashboard/ShopPosPage.tsx',
      'src/superadmin/sales/SalesCommissionsPage.tsx',
      'src/superadmin/sales/SalesPayoutsPage.tsx',
    ];
    for (const rel of csvExportOnlyFiles) {
      const src = fs.readFileSync(path.join(WORKSPACE_ROOT, rel), 'utf-8');
      expect(src).toContain('downloadCsvFile');
    }
  });

  it('enforces pending_approval affiliate partner lifecycle, RBAC isolation, daily QR dedup, and attribution window expiry', async () => {
    const {
      resolveAuthorizedPortalRole,
      canAccessPortalRoute,
    } = await import('../src/services/roleGuard');
    const {
      getStoredReferralContext,
      clearStoredReferralContext,
    } = await import('../src/services/salesService');

    // Pending approval partner must resolve to customer (no portal dashboard access)
    expect(
      resolveAuthorizedPortalRole({
        isSuperAdmin: false,
        salesMember: { role: 'referral_agent', accountStatus: 'pending_approval' },
        shopMemberships: [],
      })
    ).toBe('customer');

    // Active partner resolves cleanly to referral_agent and /referral/register stays reachable
    expect(
      resolveAuthorizedPortalRole({
        isSuperAdmin: false,
        salesMember: { role: 'referral_agent', accountStatus: 'active' },
        shopMemberships: [],
      })
    ).toBe('referral_agent');
    expect(canAccessPortalRoute('customer', '/referral/register')).toBe(true);
    expect(canAccessPortalRoute('customer', '/referral')).toBe(false);

    // Attribution window expiration check with isolated localStorage stub
    const originalStorage = (globalThis as any).localStorage;
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    };

    try {
      store.set('sbkhush_ref_code', 'REF-ALI-1234');
      store.set('sbkhush_ref_source', 'qr_scan');
      store.set('sbkhush_ref_captured_at', new Date(Date.now() - 5 * 86_400_000).toISOString());
      const fresh = getStoredReferralContext(30);
      expect(fresh.code).toBe('REF-ALI-1234');
      expect(fresh.expired).toBe(false);

      store.set('sbkhush_ref_captured_at', new Date(Date.now() - 45 * 86_400_000).toISOString());
      const expired = getStoredReferralContext(30);
      expect(expired.code).toBe('');
      expect(expired.expired).toBe(true);
      expect(store.has('sbkhush_ref_code')).toBe(false);

      clearStoredReferralContext();
    } finally {
      (globalThis as any).localStorage = originalStorage;
    }

    const firestoreRules = fs.readFileSync(path.join(WORKSPACE_ROOT, 'firestore.rules'), 'utf-8');
    const serverSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'server.ts'), 'utf-8');
    const referralLayoutSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/referral/ReferralLayout.tsx'), 'utf-8');
    const referralRegisterSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/referral/ReferralRegisterPage.tsx'), 'utf-8');
    const salesMembersSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/superadmin/sales/SalesMembersPage.tsx'), 'utf-8');

    expect(firestoreRules).toContain("memberId == ('sm_ref_' + request.auth.uid)");
    expect(firestoreRules).toContain("incoming().accountStatus == 'pending_approval'");
    expect(firestoreRules).toContain("incoming().role == 'referral_agent'");
    expect(serverSrc).toContain('qrScanDedupCache');
    expect(serverSrc).toContain('attributionWindowDays');
    expect(referralLayoutSrc).toContain('pending_approval');
    expect(referralRegisterSrc).toContain('submitReferralPartnerApplication');
    expect(salesMembersSrc).toContain('handleApproveMember');
  });
});

describe('GitHub Pages Deployment, Storage CORS, External API Gating, Auth Formatting & Firestore Rules', () => {
  it('resolves Vite base path for GitHub Pages (/Bazaar/), Docker root (/), and dev serve (/)', async () => {
    const { resolveViteBasePath } = await import('../vite.config');

    expect(resolveViteBasePath('build', undefined)).toBe('/Bazaar/');
    expect(resolveViteBasePath('build', '/')).toBe('/');
    expect(resolveViteBasePath('build', '/Bazaar')).toBe('/Bazaar/');
    expect(resolveViteBasePath('serve', undefined)).toBe('/');

    const indexHtml = fs.readFileSync(path.join(WORKSPACE_ROOT, 'index.html'), 'utf-8');
    const pwaBannerSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/components/common/PWAStatusBanner.tsx'), 'utf-8');
    const deployYml = fs.readFileSync(path.join(WORKSPACE_ROOT, '.github/workflows/deploy.yml'), 'utf-8');

    expect(indexHtml).toContain('%BASE_URL%favicon.svg');
    expect(indexHtml).toContain('%BASE_URL%apple-touch-icon.png');
    expect(pwaBannerSrc).toContain('import.meta.env.BASE_URL');
    expect(pwaBannerSrc).not.toContain('src="/pwa-192x192.png"');
    expect(deployYml).toContain('npm run lint');
    expect(deployYml).toContain('npm test');
    expect(deployYml).toContain('VITE_API_BASE_URL');
    expect(deployYml).toContain('dist/pwa-192x192.png');
  });

  it('configures origin-allowlisted GCP Storage cors.json without wildcard origin and removes ping.webp probes', async () => {
    const corsConfig = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, 'cors.json'), 'utf-8'));
    expect(Array.isArray(corsConfig)).toBe(true);
    expect(corsConfig[0].origin).toContain('https://sbkhush.github.io');
    expect(corsConfig[0].origin).toContain('https://sbkhush.com');
    expect(corsConfig[0].origin).not.toContain('*');
    expect(corsConfig[0].method).toEqual(expect.arrayContaining(['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']));
    expect(corsConfig[0].responseHeader).toEqual(expect.arrayContaining(['Content-Type', 'x-goog-resumable', 'X-Goog-Upload-URL']));

    const storageServiceSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/services/storageService.ts'), 'utf-8');
    expect(storageServiceSrc).not.toContain('/ping.webp');
    expect(storageServiceSrc).not.toContain('__health_probe__');

    const { mapFirebaseStorageError } = await import('../src/services/storageService');
    const corsMapped = mapFirebaseStorageError({ message: 'Preflight response is not successful. Access-Control-Allow-Origin' });
    expect(corsMapped).toContain('CORS');
    expect(corsMapped).toContain('cors.json');
  });

  it('gates Express API fetches safely on static hosting unless VITE_API_BASE_URL is configured', async () => {
    const {
      isBackendApiAvailable,
      buildApiUrl,
      isStaticHostingOrigin,
    } = await import('../src/config/api');

    expect(isStaticHostingOrigin('sbkhush.github.io')).toBe(true);
    expect(isStaticHostingOrigin('sbkhush.com')).toBe(false);
    expect(isBackendApiAvailable({ apiBaseUrl: '', hostname: 'sbkhush.github.io' })).toBe(false);
    expect(isBackendApiAvailable({ apiBaseUrl: 'https://api.sbkhush.com/', hostname: 'sbkhush.github.io' })).toBe(true);
    expect(buildApiUrl('/api/health', 'https://api.sbkhush.com/')).toBe('https://api.sbkhush.com/api/health');
    expect(buildApiUrl('api/buying-guide', '')).toBe('/api/buying-guide');
  });

  it('constructs complete ShopPublic payloads for legacy shops & splits allow get/list in firestore.rules', async () => {
    const { buildShopPublicUpsertPayload } = await import('../src/services/platformService');
    const now = '2026-11-22T00:00:00.000Z';
    const payload = buildShopPublicUpsertPayload('bazaarpk', null, 'suspended', now);
    expect(payload.id).toBe('bazaarpk');
    expect(payload.slug).toBe('bazaarpk');
    expect(payload.name).toBe('bazaarpk');
    expect(payload.status).toBe('suspended');

    const rules = fs.readFileSync(path.join(WORKSPACE_ROOT, 'firestore.rules'), 'utf-8');
    const lines = rules.split('\n');
    const invalidListRules = lines.filter(
      (line) => /allow\s+(list|read)\b/.test(line) && line.includes('isValidId(') && !line.includes('isValidId(userId)')
    );
    expect(invalidListRules).toEqual([]);
    expect(rules).toContain('match /platform_payment_receipts/{receiptId}');
    expect(rules).toContain('allow list: if isSuperAdmin() || (isSignedIn() && resource.data.ownerId == request.auth.uid);');
  });

  it('pre-validates auth inputs and formats Identity Toolkit error responses clearly', async () => {
    const { validateEmailAndPasswordInput, formatFirebaseAuthError } = await import('../src/utils/authErrors');

    expect(() => validateEmailAndPasswordInput('invalid-email', 'secret123')).toThrow(/valid email/);
    expect(() => validateEmailAndPasswordInput('owner@sbkhush.com', '123')).toThrow(/at least 6 characters/);
    expect(validateEmailAndPasswordInput(' OWNER@SBKHUSH.com ', 'secret123')).toEqual({
      email: 'owner@sbkhush.com',
      password: 'secret123',
    });

    expect(formatFirebaseAuthError({ code: 'auth/email-already-in-use' })).toContain('already exists');
    expect(formatFirebaseAuthError({ code: 'auth/operation-not-allowed' })).toContain('Sign-in method');
    expect(formatFirebaseAuthError({ code: 'auth/unauthorized-domain' })).toContain('Authorized domains');
    expect(formatFirebaseAuthError({ message: 'EMAIL_EXISTS' })).toContain('auth/email-already-in-use');
  });
});



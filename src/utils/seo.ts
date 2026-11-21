import { Product, ShopPublic, StoreSettings } from '../types';

export interface GeneratedSeoTags {
  title: string;
  description: string;
  canonicalUrl: string;
  siteName: string;
  ogType: 'website' | 'product';
  imageUrl?: string;
  priceAmount?: number;
  priceCurrency?: string;
  availability?: 'in stock' | 'out of stock';
  jsonLd: Record<string, any>;
}

function clampText(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trim()}…`;
}

export function resolveCanonicalUrl(explicitPath?: string): string {
  if (typeof window === 'undefined') {
    return explicitPath ? `https://sbkhush.com${explicitPath}` : 'https://sbkhush.com';
  }
  const base = window.location.origin;
  const path = explicitPath || window.location.pathname;
  return `${base}${path}`;
}

/**
 * Generates SEO metadata, OpenGraph, Twitter tags & Schema.org JSON-LD
 * directly from Firestore shop, settings, and optional product data.
 */
export function buildShopSeoTags(params: {
  shop?: ShopPublic | null;
  settings?: Partial<StoreSettings> | null;
  product?: Product | null;
  pageTitle?: string;
  pageDescription?: string;
  categoryName?: string;
  searchQuery?: string;
  canonicalUrl?: string;
}): GeneratedSeoTags {
  const {
    shop,
    settings,
    product,
    pageTitle,
    pageDescription,
    categoryName,
    searchQuery,
    canonicalUrl = resolveCanonicalUrl(),
  } = params;

  const storeName = (shop?.name || settings?.siteName || 'SB Khush Store').trim();
  const city = (shop?.city || settings?.city || 'Pakistan').trim();
  const storeLogo = shop?.logoUrl || settings?.logoUrl || '';
  const storeOgImage = settings?.ogImageUrl || shop?.ogImageUrl || storeLogo || '';
  const currency = settings?.currency || 'PKR';

  // 1. Product Detail SEO (Schema.org Product + Offer)
  if (product) {
    const activePrice = product.salePrice ?? product.regularPrice ?? 0;
    const productImage = product.images?.[0] || storeOgImage || undefined;
    const rawTitle = `${product.title} – Rs. ${Math.round(activePrice).toLocaleString('en-PK')} | ${storeName}`;
    const rawDesc =
      product.description?.trim() ||
      `Buy ${product.title} from ${storeName} (${city}) at Rs. ${Math.round(activePrice).toLocaleString('en-PK')}. Fast Cash on Delivery & Self-Pickup across Pakistan.`;

    return {
      title: clampText(rawTitle, 68),
      description: clampText(rawDesc, 160),
      canonicalUrl,
      siteName: storeName,
      ogType: 'product',
      imageUrl: productImage,
      priceAmount: activePrice,
      priceCurrency: currency,
      availability: product.stock > 0 ? 'in stock' : 'out of stock',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description: clampText(rawDesc, 200),
        sku: product.sku,
        image: productImage ? [productImage] : undefined,
        brand: {
          '@type': 'Brand',
          name: product.brand || storeName,
        },
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: currency,
          price: String(activePrice),
          availability:
            product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Store',
            name: storeName,
          },
        },
      },
    };
  }

  // 2. Storefront / Category / Search / Policy SEO (Schema.org Store)
  let rawTitle =
    pageTitle ||
    shop?.seoTitle ||
    settings?.seoTitle ||
    `${storeName} – Online Store in ${city}`;

  if (categoryName) {
    rawTitle = `${categoryName} | ${storeName} (${city})`;
  } else if (searchQuery) {
    rawTitle = `"${searchQuery}" Search Results | ${storeName}`;
  }

  const rawDesc =
    pageDescription ||
    shop?.seoDescription ||
    settings?.seoDescription ||
    shop?.theme?.heroSubtitle ||
    settings?.aboutUs ||
    `Shop authentic products online from ${storeName} in ${city}. Nationwide Cash on Delivery, EasyPaisa, JazzCash & convenient store pickup across Pakistan.`;

  return {
    title: clampText(rawTitle, 68),
    description: clampText(rawDesc, 160),
    canonicalUrl,
    siteName: storeName,
    ogType: 'website',
    imageUrl: storeOgImage || undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: storeName,
      url: canonicalUrl,
      image: storeOgImage || undefined,
      description: clampText(rawDesc, 200),
      telephone: shop?.publicContactPhone || settings?.contactPhone || undefined,
      email: shop?.publicSupportEmail || settings?.contactEmail || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: shop?.storefrontAddress || settings?.address || undefined,
        addressLocality: city,
        addressCountry: 'PK',
      },
    },
  };
}

export function buildPlatformSeoTags(
  canonicalUrl = resolveCanonicalUrl('/'),
  platformSettings?: {
    platformName?: string;
    seoTitle?: string;
    seoDescription?: string;
    ogImageUrl?: string;
    logoUrl?: string;
    currency?: string;
    canonicalDomain?: string;
  } | null
): GeneratedSeoTags {
  const siteName = (platformSettings?.platformName || 'SB Khush').trim();
  const title =
    (platformSettings?.seoTitle || '').trim() ||
    `${siteName} — Smart Business Management & Online Store SaaS`;
  const description =
    (platformSettings?.seoDescription || '').trim() ||
    'Manage products, stock inventory, POS billing, Khata credit ledger, and your own online storefront across Pakistan with COD, EasyPaisa, JazzCash & Self-Pickup.';
  const resolvedCanonical = platformSettings?.canonicalDomain
    ? platformSettings.canonicalDomain
    : canonicalUrl;
  const imageUrl = platformSettings?.ogImageUrl || platformSettings?.logoUrl || undefined;

  return {
    title: clampText(title, 70),
    description: clampText(description, 165),
    canonicalUrl: resolvedCanonical,
    siteName,
    ogType: 'website',
    imageUrl,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: siteName,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'All',
      description,
      image: imageUrl,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: platformSettings?.currency || 'PKR',
      },
    },
  };
}

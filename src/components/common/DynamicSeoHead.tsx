import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PlatformSettings, Product, ShopPublic, StoreSettings } from '../../types';
import { buildPlatformSeoTags, buildShopSeoTags, GeneratedSeoTags } from '../../utils/seo';

interface DynamicSeoHeadProps {
  shop?: ShopPublic | null;
  settings?: Partial<StoreSettings> | null;
  platformSettings?: PlatformSettings | null;
  product?: Product | null;
  pageTitle?: string;
  pageDescription?: string;
  categoryName?: string;
  searchQuery?: string;
  mode?: 'shop' | 'platform';
}

function upsertMeta(selectorAttr: 'name' | 'property', key: string, content?: string) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${selectorAttr}="${key}"]`) as HTMLMetaElement | null;
  if (!content) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(selectorAttr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertJsonLd(data: Record<string, any>) {
  if (typeof document === 'undefined') return;
  let script = document.head.querySelector('script#dynamic-seo-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'dynamic-seo-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export function applySeoTagsToDocument(tags: GeneratedSeoTags): void {
  if (typeof document === 'undefined') return;
  document.title = tags.title;

  upsertMeta('name', 'description', tags.description);
  upsertCanonical(tags.canonicalUrl);

  // OpenGraph Tags
  upsertMeta('property', 'og:type', tags.ogType);
  upsertMeta('property', 'og:title', tags.title);
  upsertMeta('property', 'og:description', tags.description);
  upsertMeta('property', 'og:site_name', tags.siteName);
  upsertMeta('property', 'og:url', tags.canonicalUrl);
  upsertMeta('property', 'og:image', tags.imageUrl);

  // Product OpenGraph Meta
  if (tags.ogType === 'product' && tags.priceAmount !== undefined) {
    upsertMeta('property', 'product:price:amount', String(tags.priceAmount));
    upsertMeta('property', 'product:price:currency', tags.priceCurrency || 'PKR');
    upsertMeta('property', 'product:availability', tags.availability);
  } else {
    upsertMeta('property', 'product:price:amount', undefined);
    upsertMeta('property', 'product:price:currency', undefined);
    upsertMeta('property', 'product:availability', undefined);
  }

  // Twitter / X Cards
  upsertMeta('name', 'twitter:card', tags.imageUrl ? 'summary_large_image' : 'summary');
  upsertMeta('name', 'twitter:title', tags.title);
  upsertMeta('name', 'twitter:description', tags.description);
  upsertMeta('name', 'twitter:image', tags.imageUrl);

  // Schema.org Structured Data
  upsertJsonLd(tags.jsonLd);
}

export const DynamicSeoHead: React.FC<DynamicSeoHeadProps> = ({
  shop,
  settings,
  platformSettings,
  product,
  pageTitle,
  pageDescription,
  categoryName,
  searchQuery,
  mode = 'shop',
}) => {
  const location = useLocation();

  useEffect(() => {
    const canonicalUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : `https://sbkhush.com${location.pathname}`;

    const tags =
      mode === 'platform'
        ? buildPlatformSeoTags(canonicalUrl, platformSettings)
        : buildShopSeoTags({
            shop,
            settings,
            product,
            pageTitle,
            pageDescription,
            categoryName,
            searchQuery,
            canonicalUrl,
          });

    applySeoTagsToDocument(tags);
  }, [
    mode,
    shop?.id,
    shop?.name,
    shop?.city,
    shop?.logoUrl,
    shop?.ogImageUrl,
    shop?.seoTitle,
    shop?.seoDescription,
    shop?.theme?.heroSubtitle,
    settings?.siteName,
    settings?.seoTitle,
    settings?.seoDescription,
    settings?.logoUrl,
    settings?.ogImageUrl,
    settings?.aboutUs,
    platformSettings?.platformName,
    platformSettings?.seoTitle,
    platformSettings?.seoDescription,
    platformSettings?.ogImageUrl,
    platformSettings?.logoUrl,
    platformSettings?.canonicalDomain,
    product?.id,
    product?.title,
    product?.regularPrice,
    product?.salePrice,
    product?.stock,
    pageTitle,
    pageDescription,
    categoryName,
    searchQuery,
    location.pathname,
  ]);

  return null;
};

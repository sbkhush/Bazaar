import { getRouterBasename } from './tenantDomain';

const DEFAULT_HERO_BG = '#065f46';

export function normalizeHexColor(hex?: string, fallback = DEFAULT_HERO_BG): string {
  const raw = String(hex || '').trim();
  if (/^#([0-9a-fA-F]{6})$/.test(raw)) {
    return raw.toLowerCase();
  }
  if (/^#([0-9a-fA-F]{3})$/.test(raw)) {
    const [, r, g, b] = raw.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/) || [];
    if (r && g && b) {
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
  }
  return fallback;
}

/**
 * Computes WCAG 2.1 relative luminance for a hex color and returns
 * a high-contrast foreground text color (`#ffffff` or `#0f172a`).
 */
export function getAccessibleContrastText(bgHex?: string): '#ffffff' | '#0f172a' {
  const hex = normalizeHexColor(bgHex);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // Threshold ~0.36 favors crisp white on emerald/deep brand hues and dark slate on amber/yellow/light hues
  return luminance > 0.36 ? '#0f172a' : '#ffffff';
}

export function resolveHeroButtonLabel(buttonText?: string): string {
  const trimmed = String(buttonText || '').trim();
  return trimmed || 'Shop Now';
}

export function resolveHeroStoreLink(
  link: string | undefined,
  storeBasePath: string,
  routerBasename?: string
): { href: string; isExternal: boolean } {
  const cleanBase = storeBasePath.replace(/\/+$/, '') || '/s/bazaarpk';
  const trimmed = String(link || '').trim();

  if (!trimmed) {
    return { href: `${cleanBase}/shop`, isExternal: false };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { href: trimmed, isExternal: true };
  }

  const activeBasename = (routerBasename ?? getRouterBasename()).replace(/\/+$/, '');
  let normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // Strip duplicate GitHub Pages basename prefix (e.g. /Bazaar/s/slug -> /s/slug) inside BrowserRouter
  if (activeBasename && normalizedPath.startsWith(`${activeBasename}/`)) {
    normalizedPath = normalizedPath.slice(activeBasename.length);
  }

  if (normalizedPath.startsWith('/s/') || normalizedPath.startsWith('/shop/')) {
    return { href: normalizedPath, isExternal: false };
  }

  return {
    href: `${cleanBase}${normalizedPath}`,
    isExternal: false,
  };
}

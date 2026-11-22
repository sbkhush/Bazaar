/**
 * Central API base URL resolver supporting:
 * 1) Same-origin Express backend (local dev / Cloud Run fullstack)
 * 2) External Express backend configured via VITE_API_BASE_URL (for static GitHub Pages)
 * 3) Explicit detection of static hosting when no external backend URL is configured,
 *    preventing spurious 404/405 console errors against github.io.
 */

export function normalizeApiBaseUrl(raw?: string): string {
  return String(raw || '').trim().replace(/\/+$/, '');
}

export function getApiBaseUrl(envUrl: string | undefined = import.meta.env.VITE_API_BASE_URL): string {
  return normalizeApiBaseUrl(envUrl);
}

export function isExternalApiConfigured(envUrl?: string): boolean {
  return Boolean(getApiBaseUrl(envUrl));
}

export function isStaticHostingOrigin(hostname?: string): boolean {
  const host = (hostname || (typeof window !== 'undefined' ? window.location.hostname : ''))
    .toLowerCase()
    .trim();
  if (!host) return false;
  return (
    host.endsWith('.github.io') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com') ||
    host.endsWith('.pages.dev')
  );
}

export function isBackendApiAvailable(options?: { apiBaseUrl?: string; hostname?: string }): boolean {
  const base = options?.apiBaseUrl !== undefined ? normalizeApiBaseUrl(options.apiBaseUrl) : getApiBaseUrl();
  if (base) return true;
  return !isStaticHostingOrigin(options?.hostname);
}

export function buildApiUrl(path: string, apiBaseUrl?: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = apiBaseUrl !== undefined ? normalizeApiBaseUrl(apiBaseUrl) : getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

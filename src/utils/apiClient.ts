const rawBase =
  typeof import.meta !== 'undefined' && import.meta.env
    ? String(import.meta.env.VITE_API_BASE_URL || '').trim()
    : '';

const normalizedApiBaseUrl = rawBase ? rawBase.replace(/\/+$/, '') : '';

export function getApiBaseUrl(): string {
  return normalizedApiBaseUrl;
}

export function isExternalApiConfigured(): boolean {
  return Boolean(normalizedApiBaseUrl);
}

export function isStaticPagesHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('.github.io');
}

export function buildApiUrl(path: string): string {
  const cleanPath = String(path || '').trim();
  if (!cleanPath) return normalizedApiBaseUrl || '';
  if (/^https?:\/\//i.test(cleanPath)) return cleanPath;
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  if (!normalizedApiBaseUrl) return normalizedPath;
  return `${normalizedApiBaseUrl}${normalizedPath}`;
}

export class ApiClientError extends Error {
  status: number;
  isUnconfiguredBackend: boolean;

  constructor(message: string, status = 0, isUnconfiguredBackend = false) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.isUnconfiguredBackend = isUnconfiguredBackend;
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const targetUrl = buildApiUrl(path);
  const response = await fetch(targetUrl, init);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();

  // Static SPA hosts (GitHub Pages, Cloud Run static previews, custom domains) return index.html / 404.html for unmatched /api/* paths
  if (contentType.includes('text/html') && !normalizedApiBaseUrl) {
    throw new ApiClientError(
      'Dedicated Express API server is not configured for this static host (VITE_API_BASE_URL is empty).',
      response.status || 404,
      true
    );
  }

  return response;
}

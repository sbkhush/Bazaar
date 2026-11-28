import QRCode from 'qrcode';
import { sanitizeShopSlug } from '../data/seedData';
import { Shop, ShopMembership } from '../types';
import { getRouterBasename } from './tenantDomain';

export interface ShopPublicUrlOptions {
  origin?: string;
  basePath?: string;
  pathname?: string;
  hostname?: string;
}

export interface ShopPosterOptions {
  shopName: string;
  shopSlug: string;
  shopUrl: string;
  qrDataUrl: string;
  logoUrl?: string;
  city?: string;
  tagline?: string;
  subline?: string;
  primaryColor?: string;
  accentColor?: string;
}

/**
 * Resolves the exact canonical public storefront URL for a specific tenant slug.
 * Never returns the platform root `/`, and always preserves repository subpath `/Bazaar/`
 * when deployed under GitHub Pages or built with VITE_BASE_PATH=/Bazaar/.
 */
export function buildShopPublicUrl(
  shopSlug: string,
  options: ShopPublicUrlOptions = {}
): string {
  const cleanSlug = sanitizeShopSlug(shopSlug);
  if (!cleanSlug || cleanSlug.length < 2) {
    throw new Error('A valid shop slug is required to generate a unique storefront QR URL.');
  }

  const origin = (
    options.origin ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://sbkhush.github.io')
  ).replace(/\/+$/, '');

  let baseSegment = '';
  if (options.basePath !== undefined) {
    const cleanBase = options.basePath.trim();
    if (cleanBase && cleanBase !== '/' && cleanBase !== './') {
      baseSegment = cleanBase.startsWith('/') ? cleanBase.replace(/\/+$/, '') : `/${cleanBase.replace(/\/+$/, '')}`;
    }
  } else {
    const host =
      options.hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
    const path =
      options.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
    baseSegment = getRouterBasename(undefined, path, host);
  }

  return `${origin}${baseSegment}/s/${cleanSlug}`;
}

/**
 * Enforces strict tenant isolation for dashboard QR & Marketing downloads.
 * Merchant A can only generate/download Merchant A's QR and poster.
 */
export function assertMerchantMarketingAccess(params: {
  targetShop: Shop | null;
  currentUserUid?: string;
  shopMemberships: ShopMembership[];
  isSuperAdmin: boolean;
}): { allowed: boolean; reason?: string } {
  const { targetShop, currentUserUid, shopMemberships, isSuperAdmin } = params;
  if (!targetShop) {
    return { allowed: false, reason: 'No active store selected.' };
  }
  if (!currentUserUid) {
    return { allowed: false, reason: 'Authentication required.' };
  }
  if (isSuperAdmin) {
    return { allowed: true };
  }
  const ownsShop = targetShop.ownerId === currentUserUid;
  const isMember = shopMemberships.some((m) => m.shopId === targetShop.id);
  if (!ownsShop && !isMember) {
    return {
      allowed: false,
      reason: 'Access denied: you can only generate QR codes and posters for your own store.',
    };
  }
  return { allowed: true };
}

export async function generateShopQrDataUrl(shopUrl: string, width = 512): Promise<string> {
  if (!shopUrl || !/^https?:\/\//i.test(shopUrl) || !shopUrl.includes('/s/')) {
    throw new Error('Valid store storefront URL is required for QR generation.');
  }
  return QRCode.toDataURL(shopUrl, {
    width,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

export async function generateShopQrSvg(shopUrl: string): Promise<string> {
  if (!shopUrl || !/^https?:\/\//i.test(shopUrl) || !shopUrl.includes('/s/')) {
    throw new Error('Valid store storefront URL is required for QR generation.');
  }
  return QRCode.toString(shopUrl, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

function loadImageWithTimeout(src: string, useAnonymousCors: boolean, timeoutMs = 3500): Promise<HTMLImageElement | null> {
  if (!src || typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    if (useAnonymousCors) {
      img.crossOrigin = 'anonymous';
    }
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(img);
      }
    };
    img.onerror = () => {
      if (!settled) {
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(null);
      }
    };
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        const remaining = [current, ...words.slice(i + 1)].join(' ');
        let clipped = remaining;
        while (clipped.length > 3 && ctx.measureText(`${clipped}...`).width > maxWidth) {
          clipped = clipped.slice(0, -1);
        }
        lines.push(clipped === remaining ? remaining : `${clipped}...`);
        return lines;
      }
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Renders a high-resolution (1080x1350) printable/shareable PNG marketing poster
 * onto HTML5 Canvas with the shop's name, optional logo (clean layout even without logo),
 * "Shop Online" call-to-action, unique store QR code, storefront URL, and subtle SB Khush footer.
 */
export async function generateShopMarketingPosterPng(
  options: ShopPosterOptions
): Promise<{ dataUrl: string; usedLogoImage: boolean }> {
  if (typeof document === 'undefined') {
    throw new Error('Canvas poster generation requires a browser environment.');
  }

  const canvas = document.createElement('canvas');
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for marketing poster.');
  }

  const brandPrimary = /^#[0-9a-fA-F]{6}$/.test(options.primaryColor || '')
    ? options.primaryColor!
    : '#065f46';
  const brandAccent = /^#[0-9a-fA-F]{6}$/.test(options.accentColor || '')
    ? options.accentColor!
    : '#d97706';

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // Top hero band
  const headerGrad = ctx.createLinearGradient(0, 0, W, 520);
  headerGrad.addColorStop(0, '#022c22');
  headerGrad.addColorStop(0.55, brandPrimary);
  headerGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, W, 500);

  // Subtle decorative accent ring
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(W - 80, 90, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(90, 440, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Optional Shop Logo (with CORS safety so canvas never taints on toDataURL)
  let logoImg: HTMLImageElement | null = null;
  if (options.logoUrl && options.logoUrl.trim()) {
    logoImg = await loadImageWithTimeout(options.logoUrl.trim(), true);
  }

  let usedLogoImage = false;
  let titleStartY = 128;

  if (logoImg) {
    usedLogoImage = true;
    const boxSize = 128;
    const boxX = (W - boxSize) / 2;
    const boxY = 64;
    ctx.save();
    drawRoundedRect(ctx, boxX, boxY, boxSize, boxSize, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();
    const scale = Math.min(boxSize / logoImg.naturalWidth, boxSize / logoImg.naturalHeight);
    const drawW = logoImg.naturalWidth * scale;
    const drawH = logoImg.naturalHeight * scale;
    ctx.drawImage(logoImg, boxX + (boxSize - drawW) / 2, boxY + (boxSize - drawH) / 2, drawW, drawH);
    ctx.restore();
    titleStartY = 250;
  } else {
    // Clean monogram badge when logo is omitted or unavailable
    const badgeSize = 96;
    const badgeX = (W - badgeSize) / 2;
    const badgeY = 72;
    ctx.save();
    drawRoundedRect(ctx, badgeX, badgeY, badgeSize, badgeSize, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 46px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((options.shopName || 'S').trim().charAt(0).toUpperCase(), W / 2, badgeY + badgeSize / 2 + 2);
    ctx.restore();
    titleStartY = 228;
  }

  // Shop Name
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 56px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  const nameLines = wrapCanvasText(ctx, options.shopName || 'Our Online Store', W - 140, 2);
  let cursorY = titleStartY;
  nameLines.forEach((line) => {
    ctx.fillText(line, W / 2, cursorY);
    cursorY += 66;
  });

  // City subtitle if provided
  if (options.city && options.city.trim()) {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.font = '600 26px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.fillText(options.city.trim(), W / 2, cursorY - 12);
    cursorY += 28;
  }

  // Main Center White Poster Card
  const cardX = 88;
  const cardY = Math.max(372, cursorY + 24);
  const cardW = W - 176;
  const cardH = H - cardY - 118;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // Accent pill inside card: "Shop Online"
  const headline = (options.tagline || 'Shop Online').trim() || 'Shop Online';
  ctx.font = '800 44px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(headline, W / 2, cardY + 78);

  const subline =
    (options.subline || 'Scan QR code with your camera to browse products & order').trim();
  ctx.font = '500 24px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(subline.slice(0, 62), W / 2, cardY + 122);

  // QR Container with strict crisp white quiet zone
  const qrImg = await loadImageWithTimeout(options.qrDataUrl, false, 4000);
  const qrFrameSize = Math.min(440, cardH - 295);
  const qrFrameX = (W - qrFrameSize) / 2;
  const qrFrameY = cardY + 154;

  drawRoundedRect(ctx, qrFrameX - 20, qrFrameY - 14, qrFrameSize + 40, qrFrameSize + 28, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  if (qrImg) {
    ctx.drawImage(qrImg, qrFrameX, qrFrameY, qrFrameSize, qrFrameSize);
  }

  // Accent CTA strip below QR
  const urlBoxY = qrFrameY + qrFrameSize + 36;
  const urlBoxW = cardW - 96;
  const urlBoxX = (W - urlBoxW) / 2;
  drawRoundedRect(ctx, urlBoxX, urlBoxY, urlBoxW, 74, 18);
  ctx.fillStyle = '#f1f5f9';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#cbd5e1';
  ctx.stroke();

  // Small accent indicator bar
  drawRoundedRect(ctx, urlBoxX + 16, urlBoxY + 17, 8, 40, 4);
  ctx.fillStyle = brandAccent;
  ctx.fill();

  const displayUrl = options.shopUrl.replace(/^https?:\/\//i, '');
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 23px "JetBrains Mono", ui-monospace, monospace';
  const truncatedUrl =
    displayUrl.length > 52 ? `${displayUrl.slice(0, 49)}...` : displayUrl;
  ctx.fillText(truncatedUrl, W / 2, urlBoxY + 45);

  // Subtle platform footer
  ctx.fillStyle = '#64748b';
  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('Powered by SB Khush  •  COD, EasyPaisa, JazzCash & Pickup', W / 2, H - 52);

  try {
    return { dataUrl: canvas.toDataURL('image/png'), usedLogoImage };
  } catch {
    // Fallback if an untrusted remote logo somehow tainted canvas despite crossOrigin='anonymous'
    if (usedLogoImage) {
      return generateShopMarketingPosterPng({ ...options, logoUrl: undefined });
    }
    throw new Error('Could not export PNG poster.');
  }
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadSvgString(svgContent: string, filename: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

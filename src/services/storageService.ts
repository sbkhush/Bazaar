import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  getMetadata,
} from 'firebase/storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { storage, db, auth } from '../firebase/config';
import { apiFetch } from '../utils/apiClient';

export type StorageFolder =
  | 'logo'
  | 'products'
  | 'banners'
  | 'categories'
  | 'pages'
  | 'payments'
  | 'subscription';

export interface UploadProgressOptions {
  shopId: string;
  folder: StorageFolder;
  subPath?: string; // e.g., productId or orderSessionId
  onProgress?: (percent: number) => void;
  maxDimension?: number;
}

export interface UploadedImageResult {
  url: string;
  storagePath: string;
  bytes: number;
  originalBytes?: number;
  savedPercent?: number;
  isPrivateReceipt?: boolean;
}

export interface StorageQuotaCheck {
  allowed: boolean;
  usedBytes: number;
  maxBytes: number;
  reason?: string;
}

export interface StorageHealthReport {
  configured: boolean;
  bucketName: string;
  status: 'healthy' | 'bucket_missing' | 'permission_denied' | 'network_error';
  message: string;
  checkedAt: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export type VerifiedImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export function normalizeImageMime(mime?: string | null): VerifiedImageMime | '' {
  const clean = String(mime || '').toLowerCase().trim();
  if (clean === 'image/jpg' || clean === 'image/jpeg') return 'image/jpeg';
  if (clean === 'image/png') return 'image/png';
  if (clean === 'image/webp') return 'image/webp';
  if (clean === 'image/gif') return 'image/gif';
  return '';
}

export async function detectImageMimeFromMagicBytes(file: Blob): Promise<VerifiedImageMime | null> {
  try {
    const headerBlob = typeof file.slice === 'function' ? file.slice(0, 12) : file;
    const buffer =
      typeof headerBlob.arrayBuffer === 'function'
        ? await headerBlob.arrayBuffer()
        : null;
    if (!buffer || buffer.byteLength < 4) return null;

    const bytes = new Uint8Array(buffer);
    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return 'image/png';
    }
    // GIF: 47 49 46 38 (GIF8)
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'image/gif';
    }
    // WebP: RIFF....WEBP
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'image/webp';
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveUploadContentType(
  processedBlob: Blob,
  sourceFile: File,
  detectedMime?: VerifiedImageMime | null
): VerifiedImageMime {
  return (
    normalizeImageMime(processedBlob.type) ||
    detectedMime ||
    normalizeImageMime(sourceFile.type) ||
    'image/jpeg'
  );
}

export function validateImageFile(file: File): void {
  const mime = String(file.type || '').toLowerCase().trim();
  const ext = String(file.name || '').toLowerCase().split('.').pop() || '';
  const hasValidMime = ALLOWED_IMAGE_TYPES.includes(mime);
  const hasValidExt = ALLOWED_IMAGE_EXTS.includes(ext);

  // Mobile gallery/camera pickers sometimes return empty file.type on valid image filenames
  if (!hasValidMime && !(mime === '' && hasValidExt)) {
    throw new Error('Invalid image format. Please upload JPG, PNG, WebP, or GIF.');
  }
  if (file.size <= 0) {
    throw new Error('Selected image file is empty.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Image size exceeds 5 MB limit. Please pick a smaller image.');
  }
}

export async function validateImageFileWithMagicBytes(file: File): Promise<VerifiedImageMime> {
  validateImageFile(file);
  const magicMime = await detectImageMimeFromMagicBytes(file);
  if (!magicMime) {
    throw new Error(
      'File contents do not match a valid JPG, PNG, WebP, or GIF image signature.'
    );
  }
  return magicMime;
}

export function calculateNextStorageBytes(currentBytes: number, deltaBytes: number): number {
  return Math.max(0, Math.round(Number(currentBytes || 0) + Number(deltaBytes || 0)));
}

export function evaluateStorageQuota(
  usedBytes: number,
  maxStorageMB: number,
  incomingBytes: number
): StorageQuotaCheck {
  const safeUsed = Math.max(0, Number(usedBytes || 0));
  const safeMaxBytes = Math.max(1, Number(maxStorageMB || 50)) * 1024 * 1024;
  if (safeUsed + incomingBytes > safeMaxBytes) {
    const usedMb = (safeUsed / (1024 * 1024)).toFixed(1);
    return {
      allowed: false,
      usedBytes: safeUsed,
      maxBytes: safeMaxBytes,
      reason: `Storage quota reached (${usedMb} MB / ${maxStorageMB} MB). Delete unused assets or upgrade your plan.`,
    };
  }
  return {
    allowed: true,
    usedBytes: safeUsed,
    maxBytes: safeMaxBytes,
  };
}

export function mapFirebaseStorageError(err: any): string {
  const code = String(err?.code || '');
  switch (code) {
    case 'storage/bucket-not-found':
      return 'Firebase Storage bucket is not provisioned or configured. Check Firebase Console -> Storage.';
    case 'storage/unauthorized':
      return 'Upload denied by Firebase Storage rules. Sign out/in to refresh your tenant permissions or verify storage.rules and Cloud Functions claims.';
    case 'storage/unauthenticated':
      return 'Please sign in again before uploading images.';
    case 'storage/quota-exceeded':
      return 'Firebase Storage bucket quota exceeded. Contact platform administrator.';
    case 'storage/retry-limit-exceeded':
      return 'Upload timed out due to unstable network connection. Please click Retry.';
    case 'storage/canceled':
      return 'Upload was canceled.';
    case 'storage/invalid-format':
      return 'Unsupported image file format.';
    default:
      return err?.message || 'Failed to upload image to Firebase Storage.';
  }
}

/**
 * Compresses an image client-side into a Blob (WebP with automatic JPEG fallback for iOS/older WebViews)
 * before uploading so mobile shoppers and store admins enjoy fast uploads and conserve storage quota.
 */
async function compressImageToBlob(
  file: File,
  maxDimension = 1400,
  quality = 0.84
): Promise<{ blob: Blob; originalBytes: number; compressedBytes: number; savedPercent: number }> {
  const originalBytes = file.size;
  if (file.type === 'image/gif') {
    return { blob: file, originalBytes, compressedBytes: file.size, savedPercent: 0 };
  }

  const objectUrl = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '';
  let img: HTMLImageElement | null = null;
  try {
    const srcUrl =
      objectUrl ||
      (await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      }));

    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode selected image.'));
      image.src = srcUrl;
    });
  } finally {
    if (objectUrl && URL.revokeObjectURL) {
      URL.revokeObjectURL(objectUrl);
    }
  }

  let width = img.naturalWidth || img.width || 1200;
  let height = img.naturalHeight || img.height || 1200;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxDimension) / width));
      width = maxDimension;
    } else {
      width = Math.max(1, Math.round((width * maxDimension) / height));
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { blob: file, originalBytes, compressedBytes: file.size, savedPercent: 0 };
  }

  ctx.drawImage(img, 0, 0, width, height);

  const webpBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', quality);
  });

  // Fallback to JPEG when WebP encoder returns null or non-webp (older iOS Safari / WebViews)
  const blob =
    webpBlob && webpBlob.type === 'image/webp'
      ? webpBlob
      : (await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        })) || file;

  const compressedBytes = blob.size;
  const savedPercent =
    originalBytes > 0 ? Math.max(0, Math.round(((originalBytes - compressedBytes) / originalBytes) * 100)) : 0;

  return { blob, originalBytes, compressedBytes, savedPercent };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to encode image stream.'));
    reader.readAsDataURL(blob);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to encode image stream.'));
    reader.readAsDataURL(blob);
  });
}

function sanitizeFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image'
  );
}

let storageBucketReachable: boolean | null = null;

export function isStorageFallbackTrigger(err: any): boolean {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'storage/bucket-not-found' ||
    code === 'storage/unauthorized' ||
    code === 'storage/unauthenticated' ||
    code === 'storage/unknown' ||
    code === 'storage/retry-limit-exceeded' ||
    code === 'storage/canceled' ||
    /network|cors|fetch|timeout|unknown|preflight|failed|bucket|appcheck/i.test(msg)
  );
}

async function isStorageLikelyReachable(): Promise<boolean> {
  if (storageBucketReachable !== null) return storageBucketReachable;
  const report = await checkStorageHealth();
  return report.status === 'healthy' || report.status === 'permission_denied';
}

async function compressFileToFallbackDataUrl(
  file: File,
  detectedMime: VerifiedImageMime,
  initialMaxDimension = 960,
  maxBytes = 210 * 1024
): Promise<{ dataUrl: string; compressedBytes: number; originalBytes: number; savedPercent: number }> {
  const attempts: Array<{ dim: number; quality: number }> = [
    { dim: initialMaxDimension, quality: 0.78 },
    { dim: Math.min(initialMaxDimension, 800), quality: 0.68 },
    { dim: Math.min(initialMaxDimension, 640), quality: 0.56 },
    { dim: 480, quality: 0.45 },
  ];

  let lastResult = await compressImageToBlob(file, initialMaxDimension, 0.78);
  for (const attempt of attempts) {
    const res = await compressImageToBlob(file, attempt.dim, attempt.quality);
    lastResult = res;
    if (res.blob.size <= maxBytes) {
      break;
    }
  }

  if (lastResult.blob.size > maxBytes * 1.45) {
    throw new Error(
      'Image is too large for inline fallback storage. Please upload a smaller image or enable Firebase Storage CORS.'
    );
  }

  const contentType = resolveUploadContentType(lastResult.blob, file, detectedMime);
  const typedBlob =
    lastResult.blob.type === contentType ? lastResult.blob : new Blob([lastResult.blob], { type: contentType });
  const dataUrl = await blobToDataUrl(typedBlob);
  return {
    dataUrl,
    compressedBytes: lastResult.compressedBytes,
    originalBytes: lastResult.originalBytes,
    savedPercent: lastResult.savedPercent,
  };
}

async function runResumableStorageUpload(
  storagePath: string,
  blob: Blob,
  contentType: string,
  customMetadata: Record<string, string>,
  onProgress?: (percent: number) => void
): Promise<string> {
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, blob, {
    contentType,
    customMetadata,
  });

  return new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(pct);
        }
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export async function uploadShopImage(
  file: File,
  options: UploadProgressOptions
): Promise<UploadedImageResult> {
  const detectedMime = await validateImageFileWithMagicBytes(file);

  const { shopId, folder, subPath, onProgress, maxDimension = 1400 } = options;

  const { blob: processedBlob, originalBytes, compressedBytes, savedPercent } =
    await compressImageToBlob(file, maxDimension);
  const uploadContentType = resolveUploadContentType(processedBlob, file, detectedMime);

  if (processedBlob.size > MAX_UPLOAD_BYTES) {
    throw new Error('Processed image still exceeds 5 MB limit.');
  }

  // Enforce per-shop storage quota using accurate post-compression byte size
  if (folder !== 'payments' && shopId) {
    const shopSnap = await getDoc(doc(db, 'shops', shopId)).catch(() => null);
    if (shopSnap && shopSnap.exists()) {
      const shopData = shopSnap.data();
      const usedBytes = Number(shopData?.usage?.storageBytes || 0);
      const planId = shopData?.subscription?.planId;
      if (planId) {
        const planSnap = await getDoc(doc(db, 'platform_plans', planId)).catch(() => null);
        if (planSnap && planSnap.exists()) {
          const quota = evaluateStorageQuota(
            usedBytes,
            Number(planSnap.data().maxStorageMB || 50),
            processedBlob.size
          );
          if (!quota.allowed) {
            throw new Error(quota.reason || 'Storage quota reached.');
          }
        }
      }
    }
  }

  const ext = processedBlob.type === 'image/webp' ? 'webp' : file.name.split('.').pop() || 'jpg';
  const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, ''));
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${baseName}.${ext}`;

  let rawStoragePath: string;
  if (folder === 'payments') {
    const sessionSegment = subPath || `sess_${Date.now()}`;
    rawStoragePath = `shops/${shopId}/payments/${sessionSegment}/${fileName}`;
  } else {
    const pathSegments = ['shops', shopId, folder];
    if (subPath) pathSegments.push(subPath);
    pathSegments.push(fileName);
    rawStoragePath = pathSegments.join('/');
  }
  const storagePath = rawStoragePath;

  const customMetadata: Record<string, string> = {
    shopId,
    folder,
    uploaderUid: auth.currentUser?.uid || 'guest',
  };
  if (folder === 'payments') {
    customMetadata.purpose = 'checkout_payment_proof';
  }

  try {
    let downloadUrl = '';
    let finalBytes = compressedBytes;
    let finalOriginalBytes = originalBytes;
    let finalSavedPercent = savedPercent;
    let finalStoragePath = storagePath;

    const storageReady = await isStorageLikelyReachable();
    if (storageReady) {
      try {
        try {
          downloadUrl = await runResumableStorageUpload(
            storagePath,
            processedBlob,
            uploadContentType,
            customMetadata,
            onProgress
          );
        } catch (firstErr: any) {
          if (firstErr?.code === 'storage/unauthorized' && auth.currentUser) {
            await auth.currentUser.getIdToken(true).catch(() => {});
            downloadUrl = await runResumableStorageUpload(
              storagePath,
              processedBlob,
              uploadContentType,
              customMetadata,
              onProgress
            );
          } else {
            throw firstErr;
          }
        }
      } catch (storageErr: any) {
        if (!isStorageFallbackTrigger(storageErr)) {
          throw storageErr;
        }
        storageBucketReachable = false;
      }
    }

    if (!downloadUrl) {
      onProgress?.(60);
      const inlineFallback = await compressFileToFallbackDataUrl(file, detectedMime, 960, 210 * 1024);
      downloadUrl = inlineFallback.dataUrl;
      finalBytes = inlineFallback.compressedBytes;
      finalOriginalBytes = inlineFallback.originalBytes;
      finalSavedPercent = inlineFallback.savedPercent;
      finalStoragePath = `inline_compressed/${storagePath}`;
    }

    // Record exact storage usage bytes safely using nested object merge (never dot-notation)
    if (folder !== 'payments' && shopId) {
      const latestSnap = await getDoc(doc(db, 'shops', shopId)).catch(() => null);
      if (latestSnap && latestSnap.exists()) {
        const currentUsage = latestSnap.data()?.usage || {};
        const nextBytes = calculateNextStorageBytes(Number(currentUsage.storageBytes || 0), finalBytes);
        await setDoc(
          doc(db, 'shops', shopId),
          {
            usage: { ...currentUsage, storageBytes: nextBytes },
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        ).catch((e) => console.warn('Could not update shop storageBytes:', e));
      }
    }

    onProgress?.(100);
    return {
      url: downloadUrl,
      storagePath: finalStoragePath,
      bytes: finalBytes,
      originalBytes: finalOriginalBytes,
      savedPercent: finalSavedPercent,
    };
  } catch (storageErr: any) {
    console.warn('Image upload error:', storageErr);
    throw new Error(mapFirebaseStorageError(storageErr));
  }
}

/**
 * Uploads platform-level branding (logo / OG image) by Super Admin to /platform/brand/...
 * Falls back cleanly to compressed WebP Data URL if Firebase Storage bucket or CORS isn't active yet.
 */
export async function uploadPlatformLogo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedImageResult> {
  const detectedMime = await validateImageFileWithMagicBytes(file);
  onProgress?.(15);
  const { blob: processedBlob, originalBytes, compressedBytes, savedPercent } =
    await compressImageToBlob(file, 1000);
  const uploadContentType = resolveUploadContentType(processedBlob, file, detectedMime);
  const ext = uploadContentType === 'image/webp' ? 'webp' : uploadContentType === 'image/png' ? 'png' : 'jpg';
  const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, ''));
  const storagePath = `platform/brand/${Date.now()}_${baseName}.${ext}`;

  try {
    let downloadUrl = '';
    const storageReady = await isStorageLikelyReachable();
    if (storageReady) {
      try {
        try {
          downloadUrl = await runResumableStorageUpload(
            storagePath,
            processedBlob,
            uploadContentType,
            {
              purpose: 'platform_branding',
              uploaderUid: auth.currentUser?.uid || 'super_admin',
            },
            onProgress
          );
        } catch (firstErr: any) {
          if (firstErr?.code === 'storage/unauthorized' && auth.currentUser) {
            await auth.currentUser.getIdToken(true).catch(() => {});
            downloadUrl = await runResumableStorageUpload(
              storagePath,
              processedBlob,
              uploadContentType,
              {
                purpose: 'platform_branding',
                uploaderUid: auth.currentUser?.uid || 'super_admin',
              },
              onProgress
            );
          } else {
            throw firstErr;
          }
        }
      } catch (storageErr: any) {
        if (!isStorageFallbackTrigger(storageErr)) {
          throw storageErr;
        }
        storageBucketReachable = false;
      }
    }

    if (!downloadUrl) {
      onProgress?.(65);
      const inlineFallback = await compressFileToFallbackDataUrl(file, detectedMime, 800, 210 * 1024);
      onProgress?.(100);
      return {
        url: inlineFallback.dataUrl,
        storagePath: `inline_compressed/${storagePath}`,
        bytes: inlineFallback.compressedBytes,
        originalBytes: inlineFallback.originalBytes,
        savedPercent: inlineFallback.savedPercent,
      };
    }

    onProgress?.(100);
    return {
      url: downloadUrl,
      storagePath,
      bytes: compressedBytes,
      originalBytes,
      savedPercent,
    };
  } catch (err: any) {
    throw new Error(mapFirebaseStorageError(err));
  }
}

/**
 * Private checkout payment proof upload:
 * Never exposes public unauthenticated Firebase download URLs.
 * Stores compressed receipt under a private backend-verified endpoint or restricted subcollection.
 */
export async function uploadCheckoutPaymentProof(
  shopId: string,
  orderSessionId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedImageResult> {
  const detectedMime = await validateImageFileWithMagicBytes(file);
  onProgress?.(15);

  const { blob: processedBlob, originalBytes, compressedBytes, savedPercent } =
    await compressImageToBlob(file, 960, 0.72);

  if (processedBlob.size > 320 * 1024) {
    throw new Error('Compressed payment slip is too large. Please crop screenshot to under 320 KB.');
  }

  onProgress?.(45);
  const base64Data = await blobToBase64(processedBlob);
  const contentType = resolveUploadContentType(processedBlob, file, detectedMime);
  const fileName = sanitizeFileName(file.name);

  // 1. Prefer server-side private upload endpoint when Express API is available
  try {
    const response = await apiFetch('/api/uploads/payment-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId,
        orderSessionId,
        contentType,
        fileName,
        base64Data,
      }),
    });
    const ct = response.headers.get('content-type') || '';
    if (response.ok && ct.includes('application/json')) {
      const payload = await response.json();
      onProgress?.(100);
      return {
        url: payload.receiptUrl,
        storagePath: payload.receiptId,
        bytes: compressedBytes,
        originalBytes,
        savedPercent,
        isPrivateReceipt: true,
      };
    }
    if (response.status >= 400 && response.status < 500 && ct.includes('application/json')) {
      const errJson = await response.json();
      throw new Error(errJson.error || 'Payment proof validation rejected.');
    }
  } catch (apiErr: any) {
    if (apiErr?.message && apiErr.message.includes('validation')) {
      throw apiErr;
    }
    // Static SPA host fallback: write directly to Firestore private subcollection readable ONLY by Shop Members/Super Admin
  }

  const receiptId = `rcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = new Date().toISOString();
  await setDoc(doc(db, 'shops', shopId, 'payment_receipts', receiptId), {
    id: receiptId,
    shopId,
    orderSessionId,
    uploaderUid: auth.currentUser?.uid || 'guest',
    contentType,
    fileName,
    base64Data,
    bytes: compressedBytes,
    createdAt: nowIso,
  });

  onProgress?.(100);
  return {
    url: `/api/payments/proof?shopId=${encodeURIComponent(shopId)}&receiptId=${encodeURIComponent(receiptId)}`,
    storagePath: `shops/${shopId}/payment_receipts/${receiptId}`,
    bytes: compressedBytes,
    originalBytes,
    savedPercent,
    isPrivateReceipt: true,
  };
}

/**
 * Private SaaS subscription payment proof upload:
 * Attempts Storage first, and safely stores privately in platform_payment_receipts if claims are unprovisioned.
 */
export async function uploadPlatformSubscriptionProof(
  shopId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedImageResult> {
  const detectedMime = await validateImageFileWithMagicBytes(file);
  onProgress?.(15);

  const { blob: processedBlob, originalBytes, compressedBytes, savedPercent } =
    await compressImageToBlob(file, 960, 0.75);
  const uploadContentType = resolveUploadContentType(processedBlob, file, detectedMime);

  const ext = uploadContentType === 'image/webp' ? 'webp' : uploadContentType === 'image/png' ? 'png' : 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_receipt.${ext}`;
  const storagePath = `platform/payments/${shopId}/${fileName}`;

  try {
    let downloadUrl = '';
    const storageReady = await isStorageLikelyReachable();
    if (storageReady) {
      try {
        downloadUrl = await runResumableStorageUpload(
          storagePath,
          processedBlob,
          uploadContentType,
          {
            shopId,
            purpose: 'subscription_payment_receipt',
            uploaderUid: auth.currentUser?.uid || 'unknown',
          },
          onProgress
        );
      } catch (storageErr: any) {
        if (!isStorageFallbackTrigger(storageErr)) {
          throw storageErr;
        }
        storageBucketReachable = false;
      }
    }

    if (downloadUrl) {
      onProgress?.(100);
      return {
        url: downloadUrl,
        storagePath,
        bytes: compressedBytes,
        originalBytes,
        savedPercent,
      };
    }

    // Store privately in Firestore (only owner & Super Admin can read via PrivateReceiptImage) if Storage is unavailable
    let fallbackBlob = processedBlob;
    let fallbackBytes = compressedBytes;
    if (fallbackBlob.size > 340 * 1024) {
      const tightened = await compressImageToBlob(file, 760, 0.58);
      fallbackBlob = tightened.blob;
      fallbackBytes = tightened.compressedBytes;
    }
    if (fallbackBlob.size > 360 * 1024) {
      throw new Error('Compressed payment slip is too large. Please crop screenshot to under 350 KB.');
    }
    const receiptId = `subrcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const base64Data = await blobToBase64(fallbackBlob);
    await setDoc(doc(db, 'platform_payment_receipts', receiptId), {
      id: receiptId,
      shopId,
      ownerId: auth.currentUser?.uid || 'unknown',
      contentType: resolveUploadContentType(fallbackBlob, file, detectedMime),
      fileName: sanitizeFileName(file.name),
      base64Data,
      bytes: fallbackBytes,
      createdAt: new Date().toISOString(),
    });
    onProgress?.(100);
    return {
      url: `/api/payments/proof?scope=platform&receiptId=${encodeURIComponent(receiptId)}`,
      storagePath: `platform_payment_receipts/${receiptId}`,
      bytes: fallbackBytes,
      originalBytes,
      savedPercent,
      isPrivateReceipt: true,
    };
  } catch (err: any) {
    throw new Error(mapFirebaseStorageError(err));
  }
}

export async function uploadUserProfileAvatar(
  userId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedImageResult> {
  const detectedMime = await validateImageFileWithMagicBytes(file);
  const { blob: processedBlob, originalBytes, compressedBytes, savedPercent } =
    await compressImageToBlob(file, 600);
  const uploadContentType = resolveUploadContentType(processedBlob, file, detectedMime);
  const ext = uploadContentType === 'image/webp' ? 'webp' : uploadContentType === 'image/png' ? 'png' : 'jpg';
  const storagePath = `users/${userId}/profile/${Date.now()}_avatar.${ext}`;

  try {
    let downloadUrl = '';
    const storageReady = await isStorageLikelyReachable();
    if (storageReady) {
      try {
        try {
          downloadUrl = await runResumableStorageUpload(
            storagePath,
            processedBlob,
            uploadContentType,
            { userId, purpose: 'profile_avatar', uploaderUid: auth.currentUser?.uid || userId },
            onProgress
          );
        } catch (firstErr: any) {
          if (firstErr?.code === 'storage/unauthorized' && auth.currentUser) {
            await auth.currentUser.getIdToken(true).catch(() => {});
            downloadUrl = await runResumableStorageUpload(
              storagePath,
              processedBlob,
              uploadContentType,
              { userId, purpose: 'profile_avatar', uploaderUid: auth.currentUser?.uid || userId },
              onProgress
            );
          } else {
            throw firstErr;
          }
        }
      } catch (storageErr: any) {
        if (!isStorageFallbackTrigger(storageErr)) {
          throw storageErr;
        }
        storageBucketReachable = false;
      }
    }

    if (!downloadUrl) {
      const inlineFallback = await compressFileToFallbackDataUrl(file, detectedMime, 480, 140 * 1024);
      onProgress?.(100);
      return {
        url: inlineFallback.dataUrl,
        storagePath: `inline_compressed/${storagePath}`,
        bytes: inlineFallback.compressedBytes,
        originalBytes: inlineFallback.originalBytes,
        savedPercent: inlineFallback.savedPercent,
      };
    }

    onProgress?.(100);
    return {
      url: downloadUrl,
      storagePath,
      bytes: compressedBytes,
      originalBytes,
      savedPercent,
    };
  } catch (err: any) {
    throw new Error(mapFirebaseStorageError(err));
  }
}

export async function uploadSalesExpenseReceipt(
  userId: string,
  expenseId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedImageResult> {
  const detectedMime = await validateImageFileWithMagicBytes(file);
  const { blob: processedBlob, originalBytes, compressedBytes, savedPercent } =
    await compressImageToBlob(file, 1000, 0.78);
  const uploadContentType = resolveUploadContentType(processedBlob, file, detectedMime);
  const ext = uploadContentType === 'image/webp' ? 'webp' : uploadContentType === 'image/png' ? 'png' : 'jpg';
  const safeExpenseId = sanitizeFileName(expenseId || `exp_${Date.now()}`);
  const storagePath = `sales/expenses/${userId}/${safeExpenseId}/${Date.now()}_receipt.${ext}`;

  try {
    let downloadUrl = '';
    const storageReady = await isStorageLikelyReachable();
    if (storageReady) {
      try {
        downloadUrl = await runResumableStorageUpload(
          storagePath,
          processedBlob,
          uploadContentType,
          {
            purpose: 'sales_expense_receipt',
            uploaderUid: auth.currentUser?.uid || userId,
          },
          onProgress
        );
      } catch (storageErr: any) {
        if (!isStorageFallbackTrigger(storageErr)) {
          throw storageErr;
        }
        storageBucketReachable = false;
      }
    }

    if (!downloadUrl) {
      const inlineFallback = await compressFileToFallbackDataUrl(file, detectedMime, 800, 210 * 1024);
      onProgress?.(100);
      return {
        url: inlineFallback.dataUrl,
        storagePath: `inline_compressed/${storagePath}`,
        bytes: inlineFallback.compressedBytes,
        originalBytes: inlineFallback.originalBytes,
        savedPercent: inlineFallback.savedPercent,
      };
    }

    onProgress?.(100);
    return {
      url: downloadUrl,
      storagePath,
      bytes: compressedBytes,
      originalBytes,
      savedPercent,
    };
  } catch (err: any) {
    throw new Error(mapFirebaseStorageError(err));
  }
}

export async function deleteStorageImageByUrl(url?: string, shopId?: string): Promise<boolean> {
  if (!url || url.startsWith('data:') || url.startsWith('/api/payments/proof')) return true;
  if (!url.includes('firebasestorage.googleapis.com')) return false;
  try {
    const imageRef = ref(storage, url);
    let exactBytes = 0;
    try {
      const meta = await getMetadata(imageRef);
      exactBytes = Number(meta.size || 0);
    } catch {
      exactBytes = 0;
    }

    await deleteObject(imageRef);

    if (shopId && exactBytes > 0) {
      const shopSnap = await getDoc(doc(db, 'shops', shopId)).catch(() => null);
      if (shopSnap && shopSnap.exists()) {
        const currentUsage = shopSnap.data()?.usage || {};
        const current = Number(currentUsage.storageBytes || 0);
        const next = calculateNextStorageBytes(current, -exactBytes);
        await setDoc(
          doc(db, 'shops', shopId),
          { usage: { ...currentUsage, storageBytes: next }, updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch(() => {});
      }
    }
    return true;
  } catch (err: any) {
    console.warn('Storage image delete note:', err?.code || err?.message || err);
    return false;
  }
}

export async function checkStorageHealth(): Promise<StorageHealthReport> {
  const bucketName = String(storage?.app?.options?.storageBucket || '');
  const checkedAt = new Date().toISOString();
  if (!bucketName) {
    storageBucketReachable = false;
    return {
      configured: false,
      bucketName: 'unconfigured',
      status: 'bucket_missing',
      message: 'storageBucket missing in Firebase config.',
      checkedAt,
    };
  }

  try {
    const res = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o?maxResults=1`,
      {
        method: 'GET',
        signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(3500) : undefined,
      }
    );

    if (res.ok) {
      storageBucketReachable = true;
      return {
        configured: true,
        bucketName,
        status: 'healthy',
        message: `Connected cleanly to ${bucketName}`,
        checkedAt,
      };
    }

    if (res.status === 401 || res.status === 403) {
      storageBucketReachable = true;
      return {
        configured: true,
        bucketName,
        status: 'permission_denied',
        message: `Bucket ${bucketName} reachable (rules require tenant claims for write).`,
        checkedAt,
      };
    }

    if (res.status === 404) {
      storageBucketReachable = false;
      return {
        configured: false,
        bucketName,
        status: 'bucket_missing',
        message: `Bucket ${bucketName} is not initialized in Firebase Console yet; automatic compressed image fallback is active.`,
        checkedAt,
      };
    }

    storageBucketReachable = false;
    return {
      configured: true,
      bucketName,
      status: 'network_error',
      message: `Storage returned HTTP ${res.status}; automatic compressed image fallback is active.`,
      checkedAt,
    };
  } catch (err: any) {
    storageBucketReachable = false;
    return {
      configured: true,
      bucketName,
      status: 'network_error',
      message: 'Storage CORS or bucket provisioning pending; automatic compressed image fallback is active.',
      checkedAt,
    };
  }
}

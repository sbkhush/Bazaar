import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const WORKSPACE_ROOT = path.resolve(__dirname, '..');

function readWorkspaceFile(relPath: string): string {
  return fs.readFileSync(path.join(WORKSPACE_ROOT, relPath), 'utf-8');
}

describe('Firebase End-to-End Audit & Security Hardening', () => {
  it('fixes list rules by separating get (isValidId) from list without invalid docId binding', () => {
    const rules = readWorkspaceFile('firestore.rules');

    // Previously broken list rules containing isValidId(docId)
    expect(rules).not.toMatch(/match \/platform_payment_receipts\/\{receiptId\}[\s\S]{0,120}allow get, list: if isValidId/);
    expect(rules).not.toMatch(/match \/cnic_registry\/\{hmacKey\}[\s\S]{0,120}allow get, list: if isValidId/);
    expect(rules).not.toMatch(/match \/orders\/\{orderId\}[\s\S]{0,120}allow get, list: if isValidId/);
    expect(rules).not.toMatch(/match \/payment_receipts\/\{receiptId\}[\s\S]{0,120}allow get, list: if isValidId/);
    expect(rules).not.toMatch(/match \/salesExpenses\/\{expenseId\}[\s\S]{0,120}allow get, list: if isValidId/);
    expect(rules).not.toMatch(/match \/salesBonusRecommendations\/\{recId\}[\s\S]{0,120}allow get, list: if isValidId/);

    // Verify clean list rules exist for all customer & admin collections
    expect(rules).toContain('allow list: if isSuperAdmin();');
    expect(rules).toContain('allow list: if isShopMember(shopId);');
    expect(rules).toContain('allow list: if hasShopPermission(shopId, \'inventory\');');
  });

  it('enforces atomic cross-document existsAfter/getAfter across shops, cnic_registry, and shop_slugs', () => {
    const rules = readWorkspaceFile('firestore.rules');

    expect(rules).toContain('existsAfter(/databases/$(database)/documents/cnic_registry/$(incoming().cnicHash))');
    expect(rules).toContain('getAfter(/databases/$(database)/documents/cnic_registry/$(incoming().cnicHash)).data.shopId == shopId');
    expect(rules).toContain('existsAfter(/databases/$(database)/documents/shops/$(incoming().shopId))');
    expect(rules).toContain('existsAfter(/databases/$(database)/documents/shop_slugs/$(shopId))');
    expect(rules).toContain("hmacKey.matches('^[a-f0-9]{64}$')");
    expect(rules).toContain("resource.data.email.lower() == request.auth.token.email.lower()");
    expect(rules).toContain("incoming().source in ['qr_scan', 'referral_link']");
  });

  it('configures Storage CORS, composite support_tickets indexes, and metadata-bound Storage rules', () => {
    const corsRaw = readWorkspaceFile('cors.json');
    const cors = JSON.parse(corsRaw) as Array<{ origin: string[]; method: string[] }>;
    expect(cors.length).toBeGreaterThan(0);
    expect(cors[0].origin).toContain('https://sbkhush.github.io');
    expect(cors[0].origin).toContain('https://sbkhush.com');
    expect(cors[0].origin).toContain('http://localhost:3000');
    expect(cors[0].method).toContain('PUT');

    const indexesRaw = readWorkspaceFile('firestore.indexes.json');
    const indexes = JSON.parse(indexesRaw) as {
      indexes: Array<{ collectionGroup: string; fields: Array<{ fieldPath: string }> }>;
    };
    const ticketIndexes = indexes.indexes.filter((idx) => idx.collectionGroup === 'support_tickets');
    expect(ticketIndexes.length).toBeGreaterThanOrEqual(2);
    expect(
      ticketIndexes.some(
        (idx) => idx.fields[0]?.fieldPath === 'shopId' && idx.fields[1]?.fieldPath === 'userId'
      )
    ).toBe(true);

    const storageRules = readWorkspaceFile('storage.rules');
    expect(storageRules).toContain('request.resource.metadata.shopId == shopId');
    expect(storageRules).toContain('request.resource.metadata.uploaderUid == request.auth.uid');
    expect(storageRules).toContain('allow read: if isShopAdmin(shopId);');
  });

  it('hardens Cloud Functions region, secret parameter, claim size ceiling, and triggers', () => {
    const fnSrc = readWorkspaceFile('functions/src/index.ts');
    expect(fnSrc).toContain("setGlobalOptions({ region: 'us-central1' })");
    expect(fnSrc).toContain("defineSecret('CNIC_HMAC_SECRET')");
    expect(fnSrc).toContain('{ secrets: [cnicHmacSecret] }');
    expect(fnSrc).toContain('export const onPlatformAdminWritten = onDocumentWritten');
    expect(fnSrc).toContain('Buffer.byteLength(JSON.stringify(candidatePayload), \'utf8\') <= 900');
    expect(fnSrc).toContain('platform/payments/${shopId}/');
    expect(fnSrc).toContain('const CHUNK_SIZE = 400');
  });

  it('validates image magic bytes strictly and never passes empty contentType on upload', async () => {
    const {
      detectImageMimeFromMagicBytes,
      resolveUploadContentType,
      validateImageFileWithMagicBytes,
    } = await import('../src/services/storageService');

    // Valid JPEG magic header (FF D8 FF E0) with empty mobile MIME type
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const validJpegFile = new File([jpegHeader], 'camera_123.jpg', { type: '' });
    expect(await detectImageMimeFromMagicBytes(validJpegFile)).toBe('image/jpeg');
    expect(await validateImageFileWithMagicBytes(validJpegFile)).toBe('image/jpeg');

    // Valid PNG magic header (89 50 4E 47 0D 0A 1A 0A)
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validPngFile = new File([pngHeader], 'logo.png', { type: 'image/png' });
    expect(await detectImageMimeFromMagicBytes(validPngFile)).toBe('image/png');

    // Valid WebP magic header (RIFF....WEBP)
    const webpHeader = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const validWebpFile = new File([webpHeader], 'banner.webp', { type: '' });
    expect(await detectImageMimeFromMagicBytes(validWebpFile)).toBe('image/webp');

    // Spoofed SVG/HTML disguised as .jpg must be rejected cleanly
    const spoofedPayload = new File(['<svg onload=alert(1)>'], 'evil.jpg', { type: 'image/jpeg' });
    await expect(validateImageFileWithMagicBytes(spoofedPayload)).rejects.toThrow(/signature/i);

    // ContentType resolution never resolves to empty string or non-canonical image/jpg
    const emptyBlob = new Blob([jpegHeader], { type: '' });
    expect(resolveUploadContentType(emptyBlob, validJpegFile, 'image/jpeg')).toBe('image/jpeg');
  });

  it('redacts CNIC numbers & JWT Bearer tokens in error logs and maps Firebase error codes', async () => {
    const { sanitizeSensitiveErrorText, mapFirebaseErrorMessage } = await import(
      '../src/firebase/errorHandler'
    );

    const leaked = sanitizeSensitiveErrorText(
      'Failed for CNIC 35202-1234567-1 (3520212345671) Bearer eyJhbGciOiJIUzI1NiJ9.payload123.sig456'
    );
    expect(leaked).not.toContain('35202-1234567-1');
    expect(leaked).not.toContain('3520212345671');
    expect(leaked).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(leaked).toContain('XXXXX-XXXXXXX-X');
    expect(leaked).toContain('Bearer [REDACTED]');

    expect(mapFirebaseErrorMessage({ code: 'auth/invalid-credential' })).toContain('Invalid email or password');
    expect(mapFirebaseErrorMessage({ code: 'auth/popup-blocked' })).toContain('blocked the Google sign-in popup');
    expect(mapFirebaseErrorMessage({ code: 'permission-denied' })).toContain('Permission denied');
    expect(mapFirebaseErrorMessage({ code: 'storage/unauthorized' })).toContain('storage.rules');
  });

  it('guards regional functions instance, blocked accounts, transaction order_tracking reads, and post-tx audits', () => {
    const configSrc = readWorkspaceFile('src/firebase/config.ts');
    const authCtxSrc = readWorkspaceFile('src/context/AuthContext.tsx');
    const platformSvcSrc = readWorkspaceFile('src/services/platformService.ts');
    const tenantSvcSrc = readWorkspaceFile('src/services/tenantService.ts');
    const salesSvcSrc = readWorkspaceFile('src/services/salesService.ts');

    expect(configSrc).toContain("export const FIREBASE_FUNCTIONS_REGION = 'us-central1'");
    expect(configSrc).toContain('getApps().length ? getApp() : initializeApp(firebaseConfig)');
    expect(configSrc).toContain('export function isValidRecaptchaSiteKey');
    expect(platformSvcSrc).toContain("from '../firebase/config'");
    expect(platformSvcSrc).not.toContain('getFunctions(auth.app)');
    expect(authCtxSrc).not.toContain('getFunctions(auth.app)');
    expect(authCtxSrc).toContain('if (profile?.isBlocked)');
    expect(authCtxSrc).toContain('user.email === SUPER_ADMIN_EMAIL && user.emailVerified ? \'super_admin\' : \'customer\'');
    expect(tenantSvcSrc).toContain('if (trackRef && trackSnap?.exists())');
    expect(salesSvcSrc).toContain('if (!auth.currentUser) return null;');
    expect(salesSvcSrc).toContain('const updatedCur = await runTransaction');
  });

  it('rejects malformed App Check site keys (such as CLI commands) and supports Storage fallback cleanup', async () => {
    const { isValidRecaptchaSiteKey } = await import('../src/firebase/config');
    const { isStorageFallbackTrigger, deleteStorageImageByUrl } = await import(
      '../src/services/storageService'
    );

    expect(isValidRecaptchaSiteKey('gsutil cors set cors.json gs://primeval-objective-t8chg.firebasestorage.app')).toBe(false);
    expect(isValidRecaptchaSiteKey('')).toBe(false);
    expect(isValidRecaptchaSiteKey('6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI')).toBe(true);

    expect(isStorageFallbackTrigger({ code: 'storage/bucket-not-found' })).toBe(true);
    expect(isStorageFallbackTrigger({ code: 'storage/unknown', message: 'CORS preflight blocked' })).toBe(true);
    expect(await deleteStorageImageByUrl('data:image/webp;base64,UklGRh4AAABXRUJQVlA4')).toBe(true);

    const corsRaw = readWorkspaceFile('cors.json');
    const cors = JSON.parse(corsRaw) as Array<{ origin: string[] }>;
    expect(cors[0].origin).toContain('https://*.ai.studio');
  });
});

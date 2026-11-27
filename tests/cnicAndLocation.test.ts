import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PAKISTAN_LOCATIONS,
  PAKISTAN_CITY_NAMES,
  getPakistanLocation,
  isKnownPakistanCity,
  searchPakistanLocations,
} from '../src/data/locations';
import { PAKISTAN_CITIES } from '../src/data/seedData';
import {
  DUPLICATE_CNIC_ERROR_MESSAGE,
  CNIC_AUDIT_BLOCK_MESSAGE,
  normalizeCnic,
  formatCnicInput,
  isValidCnic,
  maskCnic,
} from '../src/utils/cnic';
import {
  buildValidShopPublicProjection,
  auditShopCnicStatus,
} from '../src/services/platformService';
import type { Shop } from '../src/types';

const WORKSPACE_ROOT = process.cwd();

describe('Pakistan Cities Registry & Chichawatni Support', () => {
  it('includes Chichawatni with District Sahiwal, Punjab, Pakistan in PAKISTAN_LOCATIONS and PAKISTAN_CITIES', () => {
    const chichawatni = getPakistanLocation('Chichawatni');
    expect(chichawatni).toEqual({
      city: 'Chichawatni',
      district: 'Sahiwal',
      province: 'Punjab',
      country: 'Pakistan',
    });
    expect(PAKISTAN_CITY_NAMES).toContain('Chichawatni');
    expect(PAKISTAN_CITIES).toContain('Chichawatni');
    expect(isKnownPakistanCity('chichawatni')).toBe(true);
    expect(PAKISTAN_LOCATIONS.length).toBeGreaterThanOrEqual(40);
  });

  it('supports searching locations by city, district, and province', () => {
    const byCity = searchPakistanLocations('chich');
    expect(byCity.some((loc) => loc.city === 'Chichawatni')).toBe(true);

    const byDistrict = searchPakistanLocations('sahiwal');
    expect(byDistrict.some((loc) => loc.city === 'Sahiwal')).toBe(true);
    expect(byDistrict.some((loc) => loc.city === 'Chichawatni')).toBe(true);

    const byProvince = searchPakistanLocations('punjab');
    expect(byProvince.some((loc) => loc.city === 'Chichawatni')).toBe(true);
  });
});

describe('CNIC Normalization, Formatting, Validation & Privacy Masking', () => {
  it('normalizes dashed or messy input into exact 13 digits', () => {
    expect(normalizeCnic('35202-1234567-1')).toBe('3520212345671');
    expect(normalizeCnic(' 35202 1234567 1 extra ')).toBe('3520212345671');
    expect(formatCnicInput('3520212345671')).toBe('35202-1234567-1');
  });

  it('validates legitimate 13-digit CNICs and rejects invalid or repeated digits', () => {
    const valid = isValidCnic('35202-1234567-1');
    expect(valid.valid).toBe(true);
    expect(valid.normalized).toBe('3520212345671');
    expect(valid.formatted).toBe('35202-1234567-1');

    expect(isValidCnic('').valid).toBe(false);
    expect(isValidCnic('35202-12345').valid).toBe(false);
    expect(isValidCnic('0000000000000').valid).toBe(false);
    expect(isValidCnic('1111111111111').valid).toBe(false);
    expect(isValidCnic('99999-9999999-9').valid).toBe(false);
  });

  it('masks CNIC preserving only trailing digits and never exposing full number', () => {
    const masked = maskCnic('35202-1234567-1');
    expect(masked).toBe('XXXXX-XXXX567-1');
    expect(masked).not.toContain('35202');
    expect(maskCnic('invalid')).toBe('');
  });

  it('never leaks any CNIC field onto ShopPublic projection', () => {
    const shopDoc: Partial<Shop> = {
      id: 'shop-chichawatni',
      slug: 'chichawatni-mart',
      name: 'Chichawatni Super Mart',
      city: 'Chichawatni',
      status: 'active',
      cnicHash: 'hmac_secret_digest_value',
      cnicLast4: '5671',
      cnicMasked: 'XXXXX-XXXX567-1',
      cnicVerified: true,
      cnicStatus: 'verified',
      cnicUpdatedAt: '2026-11-24T00:00:00.000Z',
    };
    const publicProj = buildValidShopPublicProjection('shop-chichawatni', shopDoc);
    expect(publicProj.city).toBe('Chichawatni');
    expect(Object.keys(publicProj).some((k) => k.toLowerCase().includes('cnic'))).toBe(false);
  });

  it('computes accurate CNIC audit status for legacy, verified, and released shops', () => {
    expect(
      auditShopCnicStatus({
        cnicVerified: true,
        cnicHash: 'abc123',
        cnicStatus: 'verified',
      } as Shop)
    ).toBe('verified');

    expect(
      auditShopCnicStatus({
        cnicStatus: 'released',
      } as Shop)
    ).toBe('released');

    expect(auditShopCnicStatus({} as Shop)).toBe('pending_audit');
    expect(DUPLICATE_CNIC_ERROR_MESSAGE).toContain('already associated');
    expect(CNIC_AUDIT_BLOCK_MESSAGE).toContain('pending CNIC verification audit');
  });
});

describe('Security, API Client, Shop Deletion & Reliability Invariants', () => {
  const platformServiceSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/services/platformService.ts'), 'utf-8');
  const apiClientSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/utils/apiClient.ts'), 'utf-8');
  const reportsPageSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/dashboard/ShopReportsPage.tsx'), 'utf-8');
  const orderSuccessSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/pages/OrderSuccessPage.tsx'), 'utf-8');
  const checkoutPageSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'src/pages/CheckoutPage.tsx'), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'server.ts'), 'utf-8');
  const firestoreRestServerSrc = fs.readFileSync(
    path.join(WORKSPACE_ROOT, 'src/utils/firestoreRestServer.ts'),
    'utf-8'
  );
  const functionsSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'functions/src/index.ts'), 'utf-8');
  const firestoreRulesSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'firestore.rules'), 'utf-8');

  it('routes frontend API calls via VITE_API_BASE_URL helper instead of hardcoded relative paths', () => {
    expect(apiClientSrc).toContain('VITE_API_BASE_URL');
    expect(apiClientSrc).toContain('export function buildApiUrl');
    expect(apiClientSrc).toContain('export async function apiFetch');
  });

  it('routes deleteShopComplete through server-side Cloud Function deleteShopCompleteAdmin', () => {
    expect(platformServiceSrc).toContain("'deleteShopCompleteAdmin'");
    expect(functionsSrc).toContain('export const deleteShopCompleteAdmin');
    expect(functionsSrc).toContain("collection('archived_shops')");
  });

  it('enforces global atomic CNIC registration and strict CORS in server.ts, Cloud Functions, and Firestore rules', () => {
    expect(platformServiceSrc).toContain("'registerShopWithCnic'");
    expect(platformServiceSrc).toContain("'/api/shops/register'");
    expect(platformServiceSrc).toContain('SBKHUSH-CNIC-LOCK:');
    expect(serverSrc).toContain("app.post('/api/shops/register'");
    expect(serverSrc).toContain('cnic_registry');
    expect(serverSrc).toContain("type: 'create'");
    expect(serverSrc).toContain('restCommitWrites');
    expect(firestoreRestServerSrc).toContain('currentDocument = { exists: false }');
    expect(serverSrc).toContain('https://sbkhush.github.io');
    expect(serverSrc).not.toContain('allowedOrigins.length === 0 ||');
    expect(functionsSrc).toContain('export const registerShopWithCnic');
    expect(functionsSrc).toContain('export const manageShopCnicAdmin');
    expect(firestoreRulesSrc).toContain('match /cnic_registry/{hmacKey}');
    expect(firestoreRulesSrc).toContain('!exists(/databases/$(database)/documents/cnic_registry/$(hmacKey))');
    expect(firestoreRulesSrc).toContain('allow update, delete: if isValidId(hmacKey) && isSuperAdmin();');
    expect(firestoreRulesSrc).toContain('match /archived_shops/{shopId}');
  });

  it('treats HTML responses without VITE_API_BASE_URL as unconfigured backend and splits registration commits for Firestore rules', () => {
    const registerShopPageSrc = fs.readFileSync(
      path.join(WORKSPACE_ROOT, 'src/platform/RegisterShopPage.tsx'),
      'utf-8'
    );
    expect(apiClientSrc).toContain("if (contentType.includes('text/html') && !normalizedApiBaseUrl)");
    expect(registerShopPageSrc).toContain('const cnicValidation = isValidCnic(cnic)');
    expect(registerShopPageSrc).toContain('if (!cnicValidation.valid)');
    expect(serverSrc).toContain('// Step 1: Atomic Firestore REST commit with exists=false preconditions');
    expect(serverSrc).toContain('// Step 2: Provision public mirror, owner RBAC staff');
  });

  it('uses formula-safe CSV export in ShopReportsPage, PrivateReceiptImage in OrderSuccessPage, and non-Karachi pickup fallback in CheckoutPage', () => {
    expect(reportsPageSrc).toContain('downloadCsvFile');
    expect(orderSuccessSrc).toContain('PrivateReceiptImage');
    expect(checkoutPageSrc).not.toContain("city: pickup.city || 'Karachi'");
  });
});

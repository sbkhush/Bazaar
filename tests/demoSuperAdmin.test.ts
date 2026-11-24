import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEMO_ACCOUNT_TYPE,
  DEMO_ADMIN_DISPLAY_NAME,
  DEMO_ADMIN_EMAIL,
  DEMO_DATA_TAG,
  DEMO_ENV_ID,
  DEMO_ENV_ROOT,
  DEMO_SCOPE_PATH,
  isDemoAccountEmail,
  isDemoClaimSet,
} from '../src/demo/demoConfig';
import { buildDemoSeedDataset } from '../src/demo/demoSeedGenerator';
import {
  getFirestoreNamespaceMode,
  getNamespacePrefix,
  isDemoNamespace,
  setFirestoreNamespaceMode,
} from '../src/utils/demoCollection';
import { canAccessPortalRoute, isAllowedSalesRole } from '../src/services/roleGuard';

const WORKSPACE_ROOT = process.cwd();

function readWorkspaceFile(relPath: string): string {
  return fs.readFileSync(path.join(WORKSPACE_ROOT, relPath), 'utf-8');
}

function collectFilesRecursively(dirRel: string, exts = ['.ts', '.tsx', '.js', '.json']): string[] {
  const absDir = path.join(WORKSPACE_ROOT, dirRel);
  if (!fs.existsSync(absDir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'lib') continue;
    const childRel = path.join(dirRel, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursively(childRel, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(childRel);
    }
  }
  return results;
}

describe('SB Khush Super Admin Demo Login & Air-Gap Isolation Suite', () => {
  afterEach(() => {
    setFirestoreNamespaceMode('prod');
  });

  it('1. Non-secret demo identity constants & helpers match specification', () => {
    expect(DEMO_ADMIN_EMAIL).toBe('demo-admin@sbkhush.com');
    expect(DEMO_ADMIN_DISPLAY_NAME).toBe('SB Khush Demo Admin');
    expect(DEMO_ACCOUNT_TYPE).toBe('DEMO');
    expect(DEMO_SCOPE_PATH).toBe(`${DEMO_ENV_ROOT}/${DEMO_ENV_ID}`);
    expect(DEMO_SCOPE_PATH).toBe('demo_env/default');

    expect(isDemoAccountEmail('DEMO-ADMIN@SBKHUSH.COM ')).toBe(true);
    expect(isDemoAccountEmail('hasanaamir815@gmail.com')).toBe(false);

    expect(isDemoClaimSet({ demo_super_admin: true, super_admin: false })).toBe(true);
    expect(isDemoClaimSet({ account_type: 'DEMO' })).toBe(true);
    expect(isDemoClaimSet({ super_admin: true })).toBe(false);
  });

  it('2. Zero hardcoded demo passwords exist anywhere in source code, scripts, config, or tests', () => {
    // Construct secret check pattern dynamically so the literal secret never appears in source
    const forbiddenNeedle = ['SBKhush', '@', 'Demo', '2026', '!'].join('');
    const candidateFiles = [
      ...collectFilesRecursively('src'),
      ...collectFilesRecursively('functions/src'),
      ...collectFilesRecursively('scripts'),
      ...collectFilesRecursively('tests'),
      'server.ts',
      '.env.example',
      'firestore.rules',
      'storage.rules',
    ];

    for (const relPath of candidateFiles) {
      const content = readWorkspaceFile(relPath);
      expect(content, `Hardcoded demo password leaked in ${relPath}`).not.toContain(forbiddenNeedle);
    }

    const envExample = readWorkspaceFile('.env.example');
    expect(envExample).toContain('DEMO_ADMIN_EMAIL="demo-admin@sbkhush.com"');
    expect(envExample).toContain('DEMO_ADMIN_PASSWORD=""');
  });

  it('3. Seed dataset generator produces exact non-PII counts strictly tagged as DEMO DATA', () => {
    const dataset = buildDemoSeedDataset();

    expect(dataset.tag).toBe(DEMO_DATA_TAG);
    expect(dataset.shopBundles).toHaveLength(20);

    const totalProducts = dataset.shopBundles.reduce((sum, b) => sum + b.products.length, 0);
    const totalCustomers = dataset.shopBundles.reduce((sum, b) => sum + b.customers.length, 0);
    const totalOrders = dataset.shopBundles.reduce((sum, b) => sum + b.orders.length, 0);

    expect(totalProducts).toBe(100);
    expect(totalCustomers).toBe(50);
    expect(totalOrders).toBe(30);

    expect(dataset.salesMembers).toHaveLength(10);
    expect(dataset.salesMembers.filter((m) => m.role === 'sales_manager')).toHaveLength(2);
    expect(
      dataset.salesMembers.filter((m) => m.role === 'salesman' || m.role === 'senior_salesman')
    ).toHaveLength(8);
    expect(dataset.referralAgents).toHaveLength(5);
    expect(dataset.referralAgents.every((a) => a.role === 'referral_agent')).toBe(true);

    // Ensure mix of home delivery and self_pickup orders
    const allOrders = dataset.shopBundles.flatMap((b) => b.orders);
    expect(allOrders.some((o) => o.fulfillmentMethod === 'delivery')).toBe(true);
    expect(allOrders.some((o) => o.fulfillmentMethod === 'self_pickup')).toBe(true);

    // Ensure zero real PII emails leak into demo dataset
    const allEmails = [
      ...dataset.shopBundles.map((b) => b.shop.ownerEmail),
      ...dataset.shopBundles.flatMap((b) => b.customers.map((c) => c.email || '')),
      ...dataset.salesMembers.map((m) => m.email),
      ...dataset.referralAgents.map((a) => a.email),
    ];
    expect(allEmails.every((e) => e.endsWith('@demo-sandbox.invalid'))).toBe(true);
    expect(allEmails.some((e) => e.includes('hasanaamir815'))).toBe(false);

    // Ensure plans, payments, commissions, payouts, tickets, and logs are populated
    expect(dataset.plans.length).toBeGreaterThanOrEqual(4);
    expect(dataset.payments.length).toBeGreaterThan(0);
    expect(dataset.commissionLedger.length).toBeGreaterThan(0);
    expect(dataset.commissionPayouts.length).toBeGreaterThan(0);
    expect(dataset.supportTickets.length).toBeGreaterThan(0);
    expect(dataset.activityLogs.length).toBeGreaterThan(0);
  });

  it('4. Demo namespace switcher toggles cleanly between prod and demo_env/default', () => {
    expect(getFirestoreNamespaceMode()).toBe('prod');
    expect(isDemoNamespace()).toBe(false);
    expect(getNamespacePrefix()).toBe('');

    setFirestoreNamespaceMode('demo');
    expect(getFirestoreNamespaceMode()).toBe('demo');
    expect(isDemoNamespace()).toBe(true);
    expect(getNamespacePrefix()).toBe('demo_env/default');

    setFirestoreNamespaceMode('prod');
    expect(isDemoNamespace()).toBe(false);
    expect(getNamespacePrefix()).toBe('');
  });

  it('5. Demo Admin route guard permits /super-admin & /admin while blocking production portals', () => {
    expect(canAccessPortalRoute('customer', '/super-admin', true)).toBe(true);
    expect(canAccessPortalRoute('customer', '/super-admin/shops', true)).toBe(true);
    expect(canAccessPortalRoute('customer', '/admin/sales', true)).toBe(true);

    // Demo account MUST remain blocked from merchant, sales manager, salesman, and referral portals
    expect(canAccessPortalRoute('customer', '/dashboard', true)).toBe(false);
    expect(canAccessPortalRoute('customer', '/salesman', true)).toBe(false);
    expect(canAccessPortalRoute('customer', '/sales-manager', true)).toBe(false);
    expect(canAccessPortalRoute('customer', '/referral', true)).toBe(false);

    // Non-demo non-admin cannot access /super-admin
    expect(canAccessPortalRoute('salesman', '/super-admin', false)).toBe(false);
    expect(canAccessPortalRoute('shop_owner', '/super-admin', false)).toBe(false);
    expect(isAllowedSalesRole('super_admin')).toBe(false);
  });

  it('6. Firestore & Storage rules enforce strict air-gap isolation between demo and production', () => {
    const firestoreRules = readWorkspaceFile('firestore.rules');
    const storageRules = readWorkspaceFile('storage.rules');

    expect(firestoreRules).toContain('function isNotDemoAccount()');
    expect(firestoreRules).toContain('function isDemoSuperAdmin()');
    expect(firestoreRules).toContain('isNotDemoAccount() &&');
    expect(firestoreRules).toContain('match /demo_admins/{adminId}');
    expect(firestoreRules).toContain('match /demo_env/{envId}');
    expect(firestoreRules).toContain("envId == 'default'");
    expect(firestoreRules).toContain('allow list, create, update, delete: if envId == \'default\' && isSuperAdmin();');
    expect(firestoreRules).toContain('allow read, write: if envId == \'default\' && isValidId(shopId) && (isSuperAdmin() || isDemoSuperAdmin());');
    expect(firestoreRules).toContain("!(demoCollection in ['platform_admins', 'admins'])");

    expect(storageRules).toContain('function isNotDemoAccount()');
    expect(storageRules).toContain('function isDemoSuperAdmin()');
    expect(storageRules).toContain('match /demo_env/default/{allPaths=**}');
    expect(storageRules).toContain('match /shops/{shopId}/logo/{allPaths=**}');
  });

  it('7. Backend server.ts & Cloud Functions reject Demo identities from all production admin endpoints', () => {
    const serverSrc = readWorkspaceFile('server.ts');
    const functionsSrc = readWorkspaceFile('functions/src/index.ts');

    // Cloud Functions
    expect(functionsSrc).toContain('function isDemoIdentity(');
    expect(functionsSrc).toContain('if (isDemoIdentity(email, tokenClaims))');
    expect(functionsSrc).toContain("super_admin: false");
    expect(functionsSrc).toContain("demo_super_admin: true");
    expect(functionsSrc).toContain("account_type: DEMO_ACCOUNT_TYPE");
    expect(functionsSrc).toContain('export const provisionDemoSuperAdmin');
    expect(functionsSrc).toContain('export const issueDemoAdminToken');
    expect(functionsSrc).toContain('export const resetDemoEnvironmentAdmin');

    // Express API server
    expect(serverSrc).toContain('if (user.isDemoAccount) return false;');
    expect(serverSrc).toContain("app.get('/api/demo/status'");
    expect(serverSrc).toContain("app.post('/api/demo/reset'");
    expect(serverSrc).toContain('Only authorized production Super Admins can reset the demo environment');
  });

  it('8. Frontend AuthContext, UI & Services enforce DEMO MODE UI and isolated service routing', () => {
    const authCtx = readWorkspaceFile('src/context/AuthContext.tsx');
    const loginPage = readWorkspaceFile('src/platform/LoginPage.tsx');
    const layout = readWorkspaceFile('src/superadmin/SuperAdminLayout.tsx');
    const dashboard = readWorkspaceFile('src/superadmin/SuperAdminDashboardPage.tsx');
    const shopsPage = readWorkspaceFile('src/superadmin/SuperAdminShopsPage.tsx');
    const settingsPage = readWorkspaceFile('src/superadmin/SuperAdminSettingsPage.tsx');
    const platformSvc = readWorkspaceFile('src/services/platformService.ts');
    const salesSvc = readWorkspaceFile('src/services/salesService.ts');
    const tenantSvc = readWorkspaceFile('src/services/tenantService.ts');
    const retailSvc = readWorkspaceFile('src/services/retailService.ts');
    const storageSvc = readWorkspaceFile('src/services/storageService.ts');

    // AuthContext keeps isSuperAdmin strictly false in Demo Mode
    expect(authCtx).toContain('const isSuperAdmin = !isBlocked && !isDemoAdminVerified && isSuperAdminVerified;');
    expect(authCtx).toContain("setFirestoreNamespaceMode('demo')");
    expect(authCtx).toContain('issueDemoAdminToken');

    // UI launchers & DEMO MODE banner
    expect(loginPage).toContain('Explore Demo Admin');
    expect(loginPage).toContain('loginAsDemoAdmin');
    expect(layout).toContain('data-testid="demo-mode-banner"');
    expect(layout).toContain('DEMO MODE');
    expect(layout).toContain('!isDemoAdmin');

    // Legacy migration guarded out in Demo Mode
    expect(dashboard).toContain('!isDemoAdmin');
    expect(shopsPage).toContain('!isDemoAdmin');

    // Settings has Demo Sandbox controls
    expect(settingsPage).toContain('triggerDemoEnvironmentReset');
    expect(settingsPage).toContain('triggerProvisionDemoAdmin');

    // Services route through scopedCollection / scopedDoc & disable prod side-effects
    expect(platformSvc).toContain('scopedCollection');
    expect(platformSvc).toContain('if (isDemoNamespace())');
    expect(salesSvc).toContain('if (isDemoNamespace()) return null;');
    expect(tenantSvc).toContain('scopedCollection');
    expect(retailSvc).toContain('scopedCollection');
    expect(storageSvc).toContain('isDemoNamespace()');
  });
});

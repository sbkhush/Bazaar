import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { canAccessPortalRoute, isAllowedSalesRole } from '../src/services/roleGuard';

const WORKSPACE_ROOT = process.cwd();

function readWorkspaceFile(relPath: string): string {
  return fs.readFileSync(path.join(WORKSPACE_ROOT, relPath), 'utf-8');
}

describe('SB Khush Clean Production Enforcement & Full Data Purge Suite', () => {
  it('1. Removes all demo admin, demo sandbox, and sample seed files from workspace', () => {
    const removedPaths = [
      'src/demo/demoConfig.ts',
      'src/demo/demoSeedGenerator.ts',
      'src/utils/demoCollection.ts',
      'src/utils/demoDataAudit.ts',
      'src/services/storeService.ts',
      'src/utils/imageUpload.ts',
      'src/utils/i18n.ts',
      'functions/src/demoSeed.ts',
      'scripts/demoAdminHelper.ts',
      'scripts/provision-demo-admin.ts',
      'scripts/reset-demo-data.ts',
      'docs/DEMO_SUPER_ADMIN_GUIDE.md',
      'security_spec.md',
      'public/assets',
    ];

    for (const relPath of removedPaths) {
      expect(fs.existsSync(path.join(WORKSPACE_ROOT, relPath)), `Expected ${relPath} to be deleted`).toBe(false);
    }

    if (fs.existsSync(path.join(WORKSPACE_ROOT, 'walkthrough.md'))) {
      const walkthrough = readWorkspaceFile('walkthrough.md');
      expect(walkthrough).not.toContain('demo-admin@sbkhush.com');
      expect(walkthrough).not.toContain('DEMO_ADMIN_PASSWORD');
    }

    const envExample = readWorkspaceFile('.env.example');
    expect(envExample).not.toContain('DEMO_ADMIN_EMAIL');
    expect(envExample).not.toContain('DEMO_ADMIN_PASSWORD');
  });

  it('2. Removes hardcoded sample catalogs, banners, coupons, and sample storefront items', () => {
    const seedSrc = readWorkspaceFile('src/data/seedData.ts');
    expect(seedSrc).not.toContain('INITIAL_CATEGORIES');
    expect(seedSrc).not.toContain('INITIAL_PRODUCTS');
    expect(seedSrc).not.toContain('INITIAL_BANNERS');
    expect(seedSrc).not.toContain('INITIAL_COUPONS');

    const showcaseSrc = readWorkspaceFile('src/platform/components/ShowcaseAndPricingSection.tsx');
    expect(showcaseSrc).not.toContain('SAMPLE_STORE_ITEMS');
    expect(showcaseSrc).not.toContain('Sample General Store');

    const heroSrc = readWorkspaceFile('src/platform/components/Hero3DShowcase.tsx');
    expect(heroSrc).not.toContain('Super Basmati');
    expect(heroSrc).not.toContain('Rs. 1,950');
  });

  it('3. Removes Demo Super Admin launcher, banner, and RBAC bypass across frontend portals', () => {
    const loginPage = readWorkspaceFile('src/platform/LoginPage.tsx');
    const layout = readWorkspaceFile('src/superadmin/SuperAdminLayout.tsx');
    const authCtx = readWorkspaceFile('src/context/AuthContext.tsx');
    const shopsPage = readWorkspaceFile('src/superadmin/SuperAdminShopsPage.tsx');

    expect(loginPage).not.toContain('Explore Demo Admin');
    expect(loginPage).not.toContain('loginAsDemoAdmin');
    expect(layout).not.toContain('data-testid="demo-mode-banner"');
    expect(layout).not.toContain('isDemoAdmin');
    expect(authCtx).not.toContain('loginAsDemoAdmin');
    expect(shopsPage).not.toContain('buildDemoDataAuditReport');

    expect(canAccessPortalRoute('super_admin', '/super-admin')).toBe(true);
    expect(canAccessPortalRoute('customer', '/super-admin')).toBe(false);
    expect(canAccessPortalRoute('salesman', '/super-admin')).toBe(false);
    expect(canAccessPortalRoute('shop_owner', '/super-admin')).toBe(false);
    expect(isAllowedSalesRole('super_admin')).toBe(false);
  });

  it('4. Removes demo rules and namespaces from firestore.rules and storage.rules', () => {
    const firestoreRules = readWorkspaceFile('firestore.rules');
    const storageRules = readWorkspaceFile('storage.rules');

    expect(firestoreRules).not.toContain('isNotDemoAccount');
    expect(firestoreRules).not.toContain('isDemoSuperAdmin');
    expect(firestoreRules).not.toContain('demo_admins');
    expect(firestoreRules).not.toContain('demo_env');

    expect(storageRules).not.toContain('isNotDemoAccount');
    expect(storageRules).not.toContain('isDemoSuperAdmin');
    expect(storageRules).not.toContain('demo_env');
  });

  it('5. Exposes Super-Admin-only purgeAllPlatformDataAdmin, /api/admin/purge-all, and Danger Zone UI', () => {
    const functionsSrc = readWorkspaceFile('functions/src/index.ts');
    const serverSrc = readWorkspaceFile('server.ts');
    const platformSvc = readWorkspaceFile('src/services/platformService.ts');
    const settingsPage = readWorkspaceFile('src/superadmin/SuperAdminSettingsPage.tsx');

    expect(functionsSrc).not.toContain('issueDemoAdminToken');
    expect(functionsSrc).not.toContain('provisionDemoSuperAdmin');
    expect(functionsSrc).not.toContain('resetDemoEnvironmentAdmin');
    expect(functionsSrc).toContain('export const purgeAllPlatformDataAdmin');
    expect(functionsSrc).toContain("request.data?.confirm !== 'PURGE ALL DATA'");

    expect(serverSrc).not.toContain('/api/demo/status');
    expect(serverSrc).not.toContain('/api/demo/reset');
    expect(serverSrc).toContain("app.post('/api/admin/purge-all'");
    expect(serverSrc).toContain("req.body?.confirm !== 'PURGE ALL DATA'");

    expect(platformSvc).toContain('export async function triggerPurgeAllPlatformData');
    expect(platformSvc).toContain("'purgeAllPlatformDataAdmin'");
    expect(platformSvc).toContain("'/api/admin/purge-all'");
    expect(settingsPage).toContain('PURGE ALL DATA');
    expect(settingsPage).toContain('triggerPurgeAllPlatformData');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const WORKSPACE_ROOT = path.resolve(__dirname, '..');

function readWorkspaceFile(relPath: string): string {
  return fs.readFileSync(path.join(WORKSPACE_ROOT, relPath), 'utf-8');
}

describe('Regression Fixes: Permissions, Khata Reversal, Platform Purge & CORS', () => {
  it('guards optional request.auth.token custom claims in firestore.rules and storage.rules to prevent CEL undefined-property crashes', () => {
    const fsRules = readWorkspaceFile('firestore.rules');
    expect(fsRules).not.toContain('demo_super_admin');
    expect(fsRules).toContain("'super_admin' in request.auth.token");
    expect(fsRules).toContain("'email' in request.auth.token");
    expect(fsRules).toContain("'sales_role' in request.auth.token");

    const stRules = readWorkspaceFile('storage.rules');
    expect(stRules).not.toContain('demo_super_admin');
    expect(stRules).toContain("'super_admin' in request.auth.token");
    expect(stRules).toContain("'shops' in request.auth.token");
  });

  it('routes updateShopStatus and assignShopSubscription through Admin Cloud Functions in live mode with writeBatch fallback', () => {
    const platformSvc = readWorkspaceFile('src/services/platformService.ts');
    expect(platformSvc).toContain("'updateShopStatusAdmin'");
    expect(platformSvc).toContain("'assignShopSubscriptionAdmin'");
    expect(platformSvc).toContain('if (!handledByAdminFn)');
  });

  it('reads all transaction docs before writes in returnPosSale and reverses customer Khata credit balance', () => {
    const retailSvc = readWorkspaceFile('src/services/retailService.ts');
    expect(retailSvc).toContain('creditToReverse > 0 && sale.customerId');
    expect(retailSvc).toContain('POS Return Credit Reversal');
    expect(retailSvc).toContain("type: 'adjustment'");
    expect(retailSvc).toContain('Math.max(0, prevBal - creditToReverse)');
  });

  it('chunks Firestore REST commits into batches of 400 and cleans all operational subcollections on full platform purge', () => {
    const restServer = readWorkspaceFile('src/utils/firestoreRestServer.ts');
    expect(restServer).toContain('const CHUNK_SIZE = 400');

    const serverTs = readWorkspaceFile('server.ts');
    expect(serverTs).toContain("model: 'gemini-4-hydrogen'");
    expect(serverTs).not.toContain('gemini-3.8-flash');
    expect(serverTs).toContain('/api/admin/purge-all');
    expect(serverTs).toContain("'users'");
    expect(serverTs).toContain("'shop_invites'");
    expect(serverTs).toContain("'pickup_slots'");
    expect(serverTs).toContain("'khata_ledger'");
    expect(serverTs).toContain("'pos_sales'");
  });

  it('includes Cloud Run preview origin in cors.json and confirmation-gated platform purge in SuperAdminSettingsPage', () => {
    const cors = JSON.parse(readWorkspaceFile('cors.json')) as Array<{ origin: string[] }>;
    expect(cors[0].origin).toContain('https://*.run.app');

    const settingsPage = readWorkspaceFile('src/superadmin/SuperAdminSettingsPage.tsx');
    expect(settingsPage).toContain("purgeConfirmText !== 'PURGE ALL DATA'");
    expect(settingsPage).toContain('triggerPurgeAllPlatformData');
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALLOWED_SALES_TEAM_ROLES,
  isAllowedSalesRole,
  resolveAuthorizedPortalRole,
  getAuthorizedHomePath,
  canAccessPortalRoute,
  canAccessSalesmanRecord,
  canAccessManagerTeamRecord,
  canAssignTeamLead,
  canRecommendBonusForRep,
  canSubmitSalesExpense,
  canModifyCommissionOrApprovePayout,
  canCreateOrPromotePrivilegedRole,
} from '../src/services/roleGuard';

const WORKSPACE_ROOT = process.cwd();

function readWorkspaceFile(relPath: string): string {
  return fs.readFileSync(path.join(WORKSPACE_ROOT, relPath), 'utf-8');
}

describe('BazaarPK Sales Management Strict RBAC Security Suite (12 Mandatory Tests)', () => {
  const firestoreRules = readWorkspaceFile('firestore.rules');
  const storageRules = readWorkspaceFile('storage.rules');
  const serverSrc = readWorkspaceFile('server.ts');
  const functionsSrc = readWorkspaceFile('functions/src/index.ts');
  const appSrc = readWorkspaceFile('src/App.tsx');
  const superAdminLayoutSrc = readWorkspaceFile('src/superadmin/SuperAdminLayout.tsx');
  const salesManagerLayoutSrc = readWorkspaceFile('src/salesmanager/SalesManagerLayout.tsx');
  const salesmanLayoutSrc = readWorkspaceFile('src/salesman/SalesmanLayout.tsx');
  const referralLayoutSrc = readWorkspaceFile('src/referral/ReferralLayout.tsx');
  const shopDashboardLayoutSrc = readWorkspaceFile('src/dashboard/ShopDashboardLayout.tsx');
  const salesServiceSrc = readWorkspaceFile('src/services/salesService.ts');

  it('1. Salesman cannot open /admin or /super-admin', () => {
    expect(canAccessPortalRoute('salesman', '/admin')).toBe(false);
    expect(canAccessPortalRoute('salesman', '/admin/sales')).toBe(false);
    expect(canAccessPortalRoute('salesman', '/super-admin')).toBe(false);
    expect(canAccessPortalRoute('salesman', '/super-admin/payments')).toBe(false);
    expect(canAccessPortalRoute('salesman', '/sales-manager')).toBe(false);
    expect(canAccessPortalRoute('salesman', '/salesman')).toBe(true);

    // App.tsx mounts both /admin and /super-admin inside SuperAdminLayout guard
    expect(appSrc).toContain("['/super-admin', '/admin'].map");
    expect(superAdminLayoutSrc).toContain('if (!isSuperAdmin)');
    expect(superAdminLayoutSrc).toContain('<Navigate to={authorizedHomePath} replace />');
  });

  it('2. Sales Manager cannot open /admin or /super-admin', () => {
    expect(canAccessPortalRoute('sales_manager', '/admin')).toBe(false);
    expect(canAccessPortalRoute('sales_manager', '/admin/sales/settings')).toBe(false);
    expect(canAccessPortalRoute('sales_manager', '/super-admin')).toBe(false);
    expect(canAccessPortalRoute('sales_manager', '/super-admin/plans')).toBe(false);
    expect(canAccessPortalRoute('sales_manager', '/salesman')).toBe(false);
    expect(canAccessPortalRoute('sales_manager', '/sales-manager')).toBe(true);
    expect(getAuthorizedHomePath('sales_manager')).toBe('/sales-manager');
  });

  it('3. Referral Agent cannot open /admin or /super-admin', () => {
    expect(canAccessPortalRoute('referral_agent', '/admin')).toBe(false);
    expect(canAccessPortalRoute('referral_agent', '/super-admin')).toBe(false);
    expect(canAccessPortalRoute('referral_agent', '/sales-manager')).toBe(false);
    expect(canAccessPortalRoute('referral_agent', '/salesman')).toBe(false);
    expect(canAccessPortalRoute('referral_agent', '/referral')).toBe(true);
    expect(getAuthorizedHomePath('referral_agent')).toBe('/referral');
    expect(referralLayoutSrc).toContain('if (!isReferralAgent || !salesMember)');
    expect(referralLayoutSrc).toContain('<Navigate to={authorizedHomePath} replace />');
  });

  it('4. Salesman cannot access another salesman records', () => {
    expect(
      canAccessSalesmanRecord({
        actorRole: 'salesman',
        actorUid: 'uid_rep_a',
        targetSalesmanUid: 'uid_rep_a',
      })
    ).toBe(true);

    expect(
      canAccessSalesmanRecord({
        actorRole: 'salesman',
        actorUid: 'uid_rep_a',
        targetSalesmanUid: 'uid_rep_b',
      })
    ).toBe(false);

    expect(salesmanLayoutSrc).toContain('if (!isSalesman || !salesMember)');
    expect(salesmanLayoutSrc).toContain('<Navigate to={authorizedHomePath} replace />');
    expect(firestoreRules).toContain('resource.data.assignedSalesmanUid == request.auth.uid');
    expect(firestoreRules).toContain('resource.data.salesmanUid == request.auth.uid');
  });

  it('5. Sales Manager cannot access or assign leads to another manager team', () => {
    expect(
      canAccessManagerTeamRecord({
        actorRole: 'sales_manager',
        actorUid: 'uid_mgr_1',
        recordManagerUid: 'uid_mgr_1',
      })
    ).toBe(true);

    expect(
      canAccessManagerTeamRecord({
        actorRole: 'sales_manager',
        actorUid: 'uid_mgr_1',
        recordManagerUid: 'uid_mgr_2',
      })
    ).toBe(false);

    const crossTeamLeadAssign = canAssignTeamLead({
      actorRole: 'sales_manager',
      actorUid: 'uid_mgr_1',
      lead: { assignedManagerUid: 'uid_mgr_1', assignedSalesmanUid: 'uid_rep_1' },
      targetMember: { uid: 'uid_rep_other', assignedManagerUid: 'uid_mgr_2', accountStatus: 'active', role: 'salesman' },
    });
    expect(crossTeamLeadAssign.allowed).toBe(false);

    const crossTeamBonus = canRecommendBonusForRep({
      actorRole: 'sales_manager',
      actorUid: 'uid_mgr_1',
      targetMember: { uid: 'uid_rep_other', assignedManagerUid: 'uid_mgr_2' },
    });
    expect(crossTeamBonus.allowed).toBe(false);

    expect(salesManagerLayoutSrc).toContain('if (!isSalesManager || !salesMember)');
    expect(salesManagerLayoutSrc).toContain('<Navigate to={authorizedHomePath} replace />');
    expect(firestoreRules).toContain('isManagerOfSalesMember(incoming().assignedSalesmanId)');
    expect(serverSrc).toContain("app.post('/api/sales-manager/leads/assign'");
    expect(serverSrc).toContain("app.post('/api/sales-manager/bonus-recommendations'");
  });

  it('6. Salesman cannot modify commission amounts', () => {
    expect(canModifyCommissionOrApprovePayout('salesman')).toBe(false);
    expect(canModifyCommissionOrApprovePayout('sales_manager')).toBe(false);
    expect(canModifyCommissionOrApprovePayout('referral_agent')).toBe(false);
    expect(canModifyCommissionOrApprovePayout('super_admin')).toBe(true);

    expect(firestoreRules).toContain('match /commissionLedger/{commissionId}');
    expect(firestoreRules).toContain('allow create, update, delete: if isValidId(commissionId) && isSuperAdmin();');
    expect(serverSrc).toContain("app.post('/api/sales/commissions/decision'");
    expect(serverSrc).toContain("app.post('/api/sales/commissions/sync'");
  });

  it('7. Salesman cannot approve payouts or self-approve expenses', () => {
    expect(canModifyCommissionOrApprovePayout('salesman')).toBe(false);
    expect(
      canSubmitSalesExpense({
        actorRole: 'salesman',
        actorUid: 'uid_rep_1',
        expenseSalesmanUid: 'uid_rep_1',
        requestedStatus: 'approved',
        amount: 2500,
      }).allowed
    ).toBe(false);

    expect(
      canSubmitSalesExpense({
        actorRole: 'salesman',
        actorUid: 'uid_rep_1',
        expenseSalesmanUid: 'uid_rep_1',
        requestedStatus: 'pending',
        amount: 2500,
      }).allowed
    ).toBe(true);

    expect(firestoreRules).toContain('match /commissionPayouts/{payoutId}');
    expect(firestoreRules).toContain('allow create, update, delete: if isValidId(payoutId) && isSuperAdmin();');
    expect(firestoreRules).toContain('match /salesExpenses/{expenseId}');
    expect(firestoreRules).toContain("incoming().status == 'pending'");
    expect(firestoreRules).toContain('allow update, delete: if isValidId(expenseId) && isSuperAdmin();');
    expect(serverSrc).toContain("app.post('/api/super-admin/sales/expenses/decision'");
  });

  it('8. Salesman cannot change their role or promote anyone to super_admin', () => {
    expect(isAllowedSalesRole('super_admin')).toBe(false);
    expect(ALLOWED_SALES_TEAM_ROLES).not.toContain('super_admin');

    const resolvedRole = resolveAuthorizedPortalRole({
      isSuperAdmin: false,
      salesMember: { role: 'salesman', accountStatus: 'active' },
      shopMemberships: [],
    });
    expect(resolvedRole).toBe('salesman');

    expect(firestoreRules).toContain('incoming().role == existing().role');
    expect(firestoreRules).toContain('isAllowedSalesRole(incoming().role)');
    expect(firestoreRules).toContain("!incoming().diff(existing()).affectedKeys().hasAny(['role', 'isBlocked'])");
    expect(salesServiceSrc).toContain("sales team accounts can never be assigned super_admin role");
    expect(functionsSrc).toContain("['salesman', 'senior_salesman', 'sales_manager', 'referral_agent']");
  });

  it('9. Frontend API calls cannot bypass backend authorization', () => {
    expect(serverSrc).toContain('resolveTrustedServerRole');
    expect(serverSrc).toContain("app.get('/api/sales/me/role'");
    expect(serverSrc).toContain("app.get('/api/sales/portal/summary'");
    expect(serverSrc).toContain("app.post('/api/super-admin/sales/members'");
    expect(serverSrc).toContain("app.post('/api/super-admin/sales/bonus-recommendations/decision'");
    expect(serverSrc).toContain("app.post('/api/super-admin/sales/expenses/decision'");
    expect(serverSrc).toContain("app.post('/api/salesman/expenses'");
    expect(serverSrc).toContain('res.status(401)');
    expect(serverSrc).toContain('res.status(403)');
    // Verify backend resolves authorization from trusted database records rather than client-supplied role fields
    expect(serverSrc).not.toContain('req.body.actorRole');
  });

  it('10. Unauthorized Firestore and Storage operations are denied by rules', () => {
    expect(firestoreRules).toContain('match /{document=**}');
    expect(firestoreRules).toContain('allow read, write: if false;');
    expect(firestoreRules).toContain('match /salesSettings/{docId}');
    expect(firestoreRules).toContain("hasSalesClaimRole(['sales_manager', 'salesman', 'senior_salesman'])");
    expect(firestoreRules).toContain('match /salesMaterials/{materialId}');
    expect(firestoreRules).toContain('match /salesBonusRecommendations/{recId}');

    expect(storageRules).toContain('match /{allPaths=**}');
    expect(storageRules).toContain('allow read, write: if false;');
    expect(storageRules).toContain('match /sales/materials/{allPaths=**}');
    expect(storageRules).toContain('match /sales/expenses/{userId}/{expenseId}/{fileName}');
  });

  it('11. Shop owners and customers cannot access sales team administration or portals', () => {
    expect(canAccessPortalRoute('shop_owner', '/admin')).toBe(false);
    expect(canAccessPortalRoute('shop_owner', '/super-admin')).toBe(false);
    expect(canAccessPortalRoute('shop_owner', '/sales-manager')).toBe(false);
    expect(canAccessPortalRoute('shop_owner', '/salesman')).toBe(false);
    expect(canAccessPortalRoute('shop_owner', '/referral')).toBe(false);
    expect(canAccessPortalRoute('shop_owner', '/dashboard')).toBe(true);

    expect(canAccessPortalRoute('customer', '/admin')).toBe(false);
    expect(canAccessPortalRoute('customer', '/sales-manager')).toBe(false);
    expect(canAccessPortalRoute('customer', '/salesman')).toBe(false);
    expect(canAccessPortalRoute('customer', '/referral')).toBe(false);

    // Sales-only user without shop membership is redirected out of merchant dashboard
    expect(shopDashboardLayoutSrc).toContain('if (!shop && shopMemberships.length === 0 && !isSuperAdmin)');
    expect(shopDashboardLayoutSrc).toContain("if (['sales_manager', 'salesman', 'referral_agent'].includes(authorizedRole))");
  });

  it('12. Only authorized Super Admin can create or promote privileged accounts', () => {
    expect(
      canCreateOrPromotePrivilegedRole({
        actorRole: 'sales_manager',
        targetRole: 'salesman',
        isSalesTeamContext: true,
      }).allowed
    ).toBe(false);

    expect(
      canCreateOrPromotePrivilegedRole({
        actorRole: 'salesman',
        targetRole: 'super_admin',
        isSalesTeamContext: false,
      }).allowed
    ).toBe(false);

    expect(
      canCreateOrPromotePrivilegedRole({
        actorRole: 'super_admin',
        targetRole: 'super_admin',
        isSalesTeamContext: true,
      }).allowed
    ).toBe(false);

    expect(
      canCreateOrPromotePrivilegedRole({
        actorRole: 'super_admin',
        targetRole: 'sales_manager',
        isSalesTeamContext: true,
      }).allowed
    ).toBe(true);

    expect(firestoreRules).toContain('match /platform_admins/{adminId}');
    expect(firestoreRules).toContain('allow create: if isValidId(memberId) && isSuperAdmin() && isAllowedSalesRole(incoming().role);');
  });
});

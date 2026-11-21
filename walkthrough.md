# Security Summary

BazaarPK Cloud's Sales Management System enforces strict Role-Based Access Control (RBAC) and least-privilege isolation across all six platform roles (`super_admin`, `sales_manager`, `salesman` / `senior_salesman`, `referral_agent`, `shop_owner`, and `shop_staff`) across the frontend router, Express backend APIs, Cloud Functions custom claims, Firestore security rules, and Firebase Storage security rules.

## Strict Role Separation & Anti-Escalation
- **Zero Privilege Escalation**: The allowed sales role policy strictly permits `salesman`, `senior_salesman`, `sales_manager`, and `referral_agent`. Sales team members are never assigned `super_admin` and cannot promote themselves or others.
- **Super Admin Exclusive Control (`/admin/*` and `/super-admin/*`)**: Both `/super-admin/*` and `/admin/*` mount behind `SuperAdminLayout` with instant `<Navigate>` enforcement. Unauthenticated visitors redirect to `/login`; authenticated non-Super Admin users redirect to their own authorized portal home path.
- **Role-Isolated Dedicated Portals**:
  - **Sales Manager (`/sales-manager/*`, login `/sales-manager/login`)**: Restricted strictly to assigned team members (`assignedManagerUid == uid`), lead assignment within the manager's own team, team activity/target monitoring, and team bonus recommendations awaiting Super Admin approval. Managers cannot view or manage other managers' teams, modify commission rules, approve payouts, or open `/admin/*` or `/super-admin/*`.
  - **Salesman (`/salesman/*`, login `/salesman/login`)**: Restricted strictly to the rep's own leads, referrals, targets, read-only commission ledger, read-only payout history, approved sales materials (`/salesman/materials`), and authorized business expenses (`/salesman/expenses`, always created as `pending` with zero self-approval capability).
  - **Referral Agent (`/referral/*`, login `/referral/login`)**: Restricted strictly to referral overview, personal referral code & QR code card, eligible referred shop registrations, and approved referral rewards. Zero CRM leads, team tools, or commission rule visibility.
  - **Shop Owners & Staff (`/dashboard/*`)**: Isolated inside their authorized tenant shops (`shops/{shopId}`) and blocked from all Super Admin and sales administration endpoints and portals.

## Backend, Cloud Functions, Firestore & Storage Enforcement
- **Express Backend (`server.ts`)**: Resolves caller authorization directly from trusted Firestore records (`platform_admins`, `salesMembers`, `shops`, `shopMemberships`), returning HTTP `401` for missing/invalid tokens and HTTP `403` for unauthorized role, cross-team lead assignment, cross-team bonus recommendation, commission/payout modification, or expense self-approval attempts.
- **Firebase Cloud Functions (`functions/src/index.ts`)**: Syncs custom `sales_role` claim strictly for allowed sales roles (`salesman`, `senior_salesman`, `sales_manager`, `referral_agent`) and never grants `super_admin` from sales member records.
- **Firestore & Storage Rules (`firestore.rules`, `storage.rules`)**:
  - `salesMembers` restricts creation/deletion to `isSuperAdmin()`, blocks `super_admin` assignment, and locks role, `assignedManagerUid`, `commissionPlanId`, targets, and `referralCode` against self-modification.
  - `salesLeads`, `salesActivities`, and `salesTargets` scope rep reads/updates to `uid` and manager reads/reassignments strictly to members whose `assignedManagerUid` matches the manager's `uid`.
  - `commissionLedger`, `commissionPayouts`, `salesSettings`, and `salesTeams` restrict all writes to `isSuperAdmin()`.
  - `salesExpenses` allows rep creation strictly with `status == 'pending'` and `salesmanUid == request.auth.uid`; only `isSuperAdmin()` may approve or reject.
  - `salesBonusRecommendations` allows manager creation strictly for reps belonging to their own team with `status == 'pending'`; only `isSuperAdmin()` may approve or reject.
  - `storage.rules` restricts `/sales/materials/**` writes to `isSuperAdmin()` and `/sales/expenses/{userId}/{expenseId}/{fileName}` to the uploading owner (`request.auth.uid == userId`) and `isSuperAdmin()`.

---

## PoC Verification

Verified using Vitest (`npx vitest run`):
- **`tests/securityRbac.test.ts` (12/12 passed)**:
  1. Verified `salesman` cannot open `/admin` or `/super-admin`.
  2. Verified `sales_manager` cannot open `/admin` or `/super-admin`.
  3. Verified `referral_agent` cannot open `/admin` or `/super-admin`.
  4. Verified `salesman` cannot access another salesman's records.
  5. Verified `sales_manager` cannot access or assign leads/bonuses for another manager's team.
  6. Verified `salesman`, `sales_manager`, and `referral_agent` cannot modify commission amounts.
  7. Verified `salesman` cannot approve payouts or self-approve expenses.
  8. Verified `salesman` cannot change their role or assign `super_admin`.
  9. Verified backend Express API routes resolve roles server-side and reject unauthorized callers with HTTP `401`/`403`.
  10. Verified Firestore and Storage rules deny unauthorized access across sales collections and buckets.
  11. Verified shop owners and customers cannot access sales team administration or Super Admin portals.
  12. Verified only `super_admin` can create or promote privileged accounts while sales accounts can never receive `super_admin`.
- **`tests/saasPlatform.test.ts` (36/36 passed)**:
  - Confirmed all existing multi-tenant shop, storefront tracking, transactional billing, storage quota, SEO, and retail accounting checks remain intact.

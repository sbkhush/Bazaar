# Security & Production Readiness Summary

SB Khush Cloud's multi-tenant eCommerce and Sales Management System enforces strict Role-Based Access Control (RBAC) and least-privilege isolation across all platform roles (`super_admin`, `sales_manager`, `salesman` / `senior_salesman`, `referral_agent`, `shop_owner`, and `shop_staff`) across the frontend router, Express backend APIs, Cloud Functions custom claims, Firestore security rules, and Firebase Storage security rules.

## Strict Role Separation & Anti-Escalation
- **Zero Privilege Escalation**: The allowed sales role policy strictly permits `salesman`, `senior_salesman`, `sales_manager`, and `referral_agent`. Sales team members are never assigned `super_admin` and cannot promote themselves or others.
- **Super Admin Exclusive Control (`/admin/*` and `/super-admin/*`)**: Both `/super-admin/*` and `/admin/*` mount behind `SuperAdminLayout` with instant `<Navigate>` enforcement. Unauthenticated visitors redirect to `/login`; authenticated non-Super Admin users redirect to their own authorized portal home path.
- **Role-Isolated Dedicated Portals**:
  - **Sales Manager (`/sales-manager/*`, login `/sales-manager/login`)**: Restricted strictly to assigned team members (`assignedManagerUid == uid`), lead assignment within the manager's own team, team activity/target monitoring, and team bonus recommendations awaiting Super Admin approval. Managers cannot view or manage other managers' teams, modify commission rules, approve payouts, or open `/admin/*` or `/super-admin/*`.
  - **Salesman (`/salesman/*`, login `/salesman/login`)**: Restricted strictly to the rep's own leads, referrals, targets, read-only commission ledger, read-only payout history, approved sales materials (`/salesman/materials`), and authorized business expenses (`/salesman/expenses`, always created as `pending` with zero self-approval capability).
  - **Referral / Affiliate Partner (`/referral/*`, login `/referral/login`, self-registration `/referral/register`)**: Restricted strictly to referral overview, personal referral code & QR code card, eligible referred shop registrations, and approved referral rewards. Self-registered partners start in `pending_approval`, remain blocked from `/referral/*` dashboard access until approved by a Super Admin, and can never self-approve or alter their role.
  - **Shop Owners & Staff (`/dashboard/*`)**: Isolated inside their authorized tenant shops (`shops/{shopId}`) and blocked from all Super Admin and sales administration endpoints and portals.

## Backend, Cloud Functions, Firestore & Storage Enforcement
- **Express Backend (`server.ts`)**: Resolves caller authorization directly from trusted Firestore records (`platform_admins`, `admins`, `salesMembers`, `shops`, `shopMemberships`), returning HTTP `401` for missing/invalid tokens and HTTP `403` for unauthorized callers. Enforces idempotent order creation (`ord_${idempotencyKey}` + `orderIdempotencyCache`), rejects unsupported `online` card checkouts, deduplicates QR scans (`qrScanDedupCache`), and enforces `attributionWindowDays` expiry on referral attributions.
- **Firebase Cloud Functions (`functions/src/index.ts`)**: Syncs custom `sales_role` claim strictly for allowed sales roles (`salesman`, `senior_salesman`, `sales_manager`, `referral_agent`), recognizes legacy `admins/{uid}` Super Admin records, and never grants `super_admin` from sales member records.
- **Firestore & Storage Rules (`firestore.rules`, `storage.rules`)**:
  - `salesMembers` restricts deletion and general creation to `isSuperAdmin()`, blocks `super_admin` assignment, allows self-service affiliate partner creation strictly under `sm_ref_{uid}` with `role == 'referral_agent'` and `accountStatus == 'pending_approval'`, and locks role, `assignedManagerUid`, `commissionPlanId`, targets, and `referralCode` against self-modification.
  - `salesLeads`, `salesActivities`, and `salesTargets` scope rep reads/updates to `uid` and manager reads/reassignments strictly to members whose `assignedManagerUid` matches the manager's `uid`.
  - `commissionLedger`, `commissionPayouts`, `salesSettings`, and `salesTeams` restrict all writes to `isSuperAdmin()`.
  - `salesExpenses` allows rep creation strictly with `status == 'pending'` and `salesmanUid == request.auth.uid`; only `isSuperAdmin()` may approve or reject.
  - `salesBonusRecommendations` allows manager creation strictly for reps belonging to their own team with `status == 'pending'`; only `isSuperAdmin()` may approve or reject.
  - `storage.rules` restricts `/sales/materials/**` writes to `isSuperAdmin()` and `/sales/expenses/{userId}/{expenseId}/{fileName}` to the uploading owner (`request.auth.uid == userId`) and `isSuperAdmin()`.

## Storefront Zero-Demo & Operational Hardening
- Removed all `INITIAL_*` / `DEFAULT_SHOP_ID` live catalog fallbacks from public storefront pages/components and legacy migration routines; storefront customer reviews on the home page render exclusively from real Firestore `reviews` documents.
- Removed unbacked mock card fields (`online` checkout) and added guardrails when no store payment method is enabled.
- Standardized formula-safe CSV exports (`downloadCsvFile`) and RFC-4180 CSV imports (`CsvImportModal`) across shop management and Super Admin sales tables.

---

## Verification Summary

- **`npx vitest run` (59/59 passed across 2 test files)**:
  - `tests/securityRbac.test.ts` (12/12 passed): Verified portal route isolation, cross-rep/cross-team restrictions, commission/payout/expense protections, backend authorization, rules catchall denies, and Super Admin creation rules.
  - `tests/saasPlatform.test.ts` (47/47 passed): Verified multi-tenant isolation, custom claims, storage quotas, tokenized tracking, dynamic SEO, retail COGS/profit calculations, SB Khush branding & demo audit, React hooks-before-early-returns ordering across portals, zero live `INITIAL_*` fallbacks, checkout idempotency, formula-safe CSV suite, `pending_approval` affiliate onboarding RBAC, daily QR scan dedup, and referral attribution window expiry.
- **TypeScript & Production Build**:
  - `npm run lint` (`tsc --noEmit`): Passed with zero errors.
  - `npm run build` (`vite build` / `compile_applet`): Succeeded cleanly.
- **Firestore Rules Deployment (`fax.DeployRules`)**:
  - Deployed updated `firestore.rules` cleanly to project `primeval-objective-t8chg`.

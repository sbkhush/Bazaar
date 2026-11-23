# Security Summary

SB Khush Cloud's multi-tenant eCommerce, Self-Pickup, and Sales Management platform enforces strict Role-Based Access Control (RBAC), tenant isolation, and fail-closed validation across the React Router frontend, Express backend (`/api/*`), Cloud Functions (`functions/src/index.ts`), Firestore Security Rules (`firestore.rules`), and Firebase Storage Rules (`storage.rules`).

## Strict Role Separation & Tenant Isolation
- **Zero Privilege Escalation**: Allowed sales roles remain strictly scoped to `salesman`, `senior_salesman`, `sales_manager`, and `referral_agent`. Sales team accounts cannot receive or self-promote to `super_admin`.
- **Super Admin Exclusive Control (`/super-admin/*` and `/admin/*`)**: Strictly protected by `SuperAdminLayout` route guards, `isSuperAdmin()` rules, custom claims, `platform_admins` records, and backend Firebase ID token verification.
- **Merchant Tenant Isolation (`shops/{shopId}`)**: Public storefronts read only the strict 19-key whitelisted non-PII `shops_public/{shopId}` projection and `shops/{shopId}/settings/public`. Admin mutations (`updateShopStatus`, `assignShopSubscription`, `approvePlatformPayment`, merchant appearance updates) reconstruct the exact sanitized `shops_public` document without `merge: true`, preserving `isValidShopPublicDoc()` compliance and eliminating `Missing or insufficient permissions` failures on documents like `shops/hasan-aamir`.
- **Self-Pickup Security & Counter OTP Flow**:
  - Slot capacity (`shops/{shopId}/pickup_slots/{date}__{slotId}`) is enforced transactionally in both Express (`POST /api/orders/create`) and `createShopOrder`.
  - Pickup verification codes are 6-digit random OTPs paired with deterministic SHA-256 `pickupOtpHash` (`hashPickupOtp`) stored securely on private order records and never exposed in the public 17-key `order_tracking` schema (`isValidOrderTracking`).
  - Only authenticated shop admins/orders staff (`verifyAndCollectSelfPickupOrder`) can validate a customer's 6-digit OTP to transition an order to `Collected` / `Completed`.
  - Customer-initiated cancellations remain restricted by `firestore.rules` to `Pending` orders.

---

## PoC Verification

| Verification Check | Scope Covered | Result & Measured Output |
| :--- | :--- | :--- |
| **`npx vitest run`** | `tests/securityRbac.test.ts` + `tests/saasPlatform.test.ts` (RBAC, `shops_public` 19-key projection, `resolveValidPublicSlug`, Self-Pickup OTP/slots/zero shipping, Vite subpath PWA, CSV injection protection) | **PASS** — 2 test files, **62/62 tests passed** (`1.11s`) |
| **`npm run build` (`vite build`)** | Full production Vite 8 + Rolldown code-split build & VitePWA service worker generation | **PASS** — Entry chunk reduced from **3,297.09 kB (`805.24 kB` gzip)** to **274.96 kB (`52.06 kB` gzip)** (**-91.7% raw / -93.5% gzip**); CSS `110.64 kB`; 4 optimized WebP assets (`32K–194K`, 0 remaining `.jpg` imports); PWA `110 entries (3800.90 KiB)` |
| **`npm run lint` (`tsc --noEmit`) & `compile_applet`** | TypeScript strict type-checking + production bundle verification | **PASS** — `tsc --noEmit` completed with 0 errors and `compile_applet` succeeded |
| **Firestore Rules Deployment (`fax.DeployRules`)** | Deployed updated `firestore.rules` (including `shops_public` rules and `pickup_slots/{slotKey}` rules) | **PASS** — `DeployRules` RPC returned `{}` cleanly |
| **`npm --prefix functions run build`** | Cloud Functions TypeScript compilation (`functions/tsconfig.json` `rootDir: "src"` updated) | **BLOCKED / NOT TESTED** — `functions/node_modules` (`firebase-admin`, `firebase-functions`) is not installed in the sandbox environment (`tsc` failed with `TS2307: Cannot find module 'firebase-admin/app'`) |
| **Live Browser / Mobile Lighthouse E2E** | Interactive runtime click-through of Self-Pickup checkout, OTP counter handoff, Super Admin shop pause on `shops/hasan-aamir`, and mobile LCP/CLS audit | **NOT TESTED** — No headless browser / Firebase auth emulator session executed in this environment |

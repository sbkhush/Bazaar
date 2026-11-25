# Security Summary

SB Khush Cloud's multi-tenant eCommerce, Self-Pickup, and Sales Management platform enforces strict Role-Based Access Control (RBAC), tenant isolation, and fail-closed validation across the React Router frontend, Express backend (`/api/*`), Cloud Functions (`functions/src/index.ts`), Firestore Security Rules (`firestore.rules`), and Firebase Storage Rules (`storage.rules`).

## Strict Role Separation & Tenant Isolation
- **Zero Privilege Escalation**: Allowed sales roles remain strictly scoped to `salesman`, `senior_salesman`, `sales_manager`, and `referral_agent`. Sales team accounts cannot receive or self-promote to `super_admin`.
- **Super Admin Exclusive Control (`/super-admin/*` and `/admin/*`)**: Strictly protected by `SuperAdminLayout` route guards, `isSuperAdmin()` rules, custom claims, `platform_admins` records, and backend Firebase ID token verification.
- **Merchant Tenant Isolation (`shops/{shopId}`)**: Public storefronts read only the strict 19-key whitelisted non-PII `shops_public/{shopId}` projection and `shops/{shopId}/settings/public`. Admin and permitted staff (`settings` / `appearance`) mutations reconstruct the exact sanitized `shops_public` document without `merge: true`, preserving `isValidShopPublicDoc()` compliance while zero CNIC fields ever project onto `shops_public`.
- **Global Atomic One-CNIC-One-Shop Registry (`cnic_registry/{hmacKey}`)**: Store registration requires a valid 13-digit Pakistani CNIC (`RegisterShopPage` -> `registerShopWithCnic` Cloud Function or `POST /api/shops/register`). Raw CNIC digits are normalized server-side and keyed via HMAC-SHA256 (`CNIC_HMAC_SECRET`) inside `cnic_registry/{hmacKey}` using atomic preconditions (`exists: false`) alongside `shop_slugs/{slug}`. Only masked CNIC (`XXXXX-XXXX567-1`) and verification metadata live on private `shops/{shopId}`; `cnic_registry` reads/mutations remain Super Admin or server-enforced only. Legacy owners without verified CNICs are blocked from creating new stores (`ownerHasPendingCnicAudit`), while Super Admin can assign, correct, or release CNIC locks via `manageShopCnicAdmin` / `POST /api/super-admin/cnic/manage`.
- **Server-Side Shop Deletion & Archival (`deleteShopCompleteAdmin`)**: Deleting a shop invokes `deleteShopCompleteAdmin` to purge subcollections, `shops_public`, `shop_slugs`, all staff `shopMemberships` (with custom claims rebuild), Storage folders, CNIC registry locks, and writes an immutable audit archive to `archived_shops/{shopId}` plus `platform_activity_logs`.
- **Firebase Storage & Cross-Origin API Hardening**: Product images match `/shops/{shopId}/products/{allPaths=**}` in `storage.rules` with token-refresh retry and 5 MB image MIME constraints; Express (`server.ts`) enforces an explicit origin allowlist (supporting `https://sbkhush.com`, `https://www.sbkhush.com`, `https://sbkhush.github.io`, and localhost dev origins) while client calls route cleanly through `VITE_API_BASE_URL` (`apiClient.ts`) and receipts render via `<PrivateReceiptImage />`.
- **Self-Pickup Security & Counter OTP Flow**:
  - Slot capacity (`shops/{shopId}/pickup_slots/{date}__{slotId}`) is enforced transactionally in both Express (`POST /api/orders/create`) and `createShopOrder`.
  - Pickup verification codes are 6-digit random OTPs paired with deterministic SHA-256 `pickupOtpHash` (`hashPickupOtp`) stored securely on private order records and never exposed in the public 17-key `order_tracking` schema (`isValidOrderTracking`).
  - Only authenticated shop admins/orders staff (`verifyAndCollectSelfPickupOrder`) can validate a customer's 6-digit OTP to transition an order to `Collected` / `Completed`.
  - Customer-initiated cancellations remain restricted by `firestore.rules` to `Pending` orders.

---

## PoC Verification

| Verification Check | Scope Covered | Result & Measured Output |
| :--- | :--- | :--- |
| **`npx vitest run`** | 4 suites (`securityRbac.test.ts`, `saasPlatform.test.ts`, `selfPickup.test.ts`, `cnicAndLocation.test.ts`) covering RBAC, `shops_public` 19-key & non-CNIC projection, CNIC normalization/masking & atomic server registration, `Chichawatni` location registry, `apiClient`, Self-Pickup OTP/slots, CSV injection safety, and non-Karachi pickup fallback | **PASS** — 4 test files, **80/80 tests passed** (`1.67s`) |
| **`npm run lint` (`tsc --noEmit`)** | Full strict TypeScript check across `src/`, `server.ts`, and tests | **PASS** — 0 TypeScript errors |
| **`npm run build` (`vite build`)** | Full production Vite 8 + Rolldown code-split build & VitePWA service worker generation | **PASS** — built in `2.24s`; entry chunk `275.07 kB` (`52.13 kB` gzip); CSS `111K`; PWA `112 entries (3839.96 KiB)` |
| **Firestore Rules Deployment (`fax.DeployRules`)** | Deployed updated `firestore.rules` (`cnic_registry`, `archived_shops`, `shops_public` permitted staff updates, protected `cnic*` keys on `shops/{shopId}`, `pickup_slots`) | **PASS** — `DeployRules` RPC returned `{}` cleanly |
| **`functions/` TypeScript Build** | Cloud Functions (`functions/src/index.ts` including `registerShopWithCnic`, `manageShopCnicAdmin`, `deleteShopCompleteAdmin`) | **BLOCKED / NOT TESTED** — `functions/node_modules` is not installed in the sandbox environment (`ls functions` shows `src`, `lib`, `package.json`, `tsconfig.json` without `node_modules`) |
| **Live Browser / Mobile Lighthouse E2E** | Interactive runtime click-through of CNIC registration, Super Admin shop deletion & CNIC management, Storage upload/CORS, and Self-Pickup checkout | **NOT TESTED** — No headless browser / Firebase emulator session executed in this environment |

# Security Specification — Multi-Tenant SaaS eCommerce Platform (Production Hardened)

## Architecture & Tenant Isolation Invariants
1. **Default Deny**: Root `match /{document=**} { allow read, write: if false; }` blocks all unspecified Firestore paths, and Storage denies all paths by default.
2. **Backend-Verified Super Admin Gate**:
   - Never trust client-editable `users/{uid}.role` for authorization.
   - `isSuperAdmin()` requires Custom Claim `request.auth.token.super_admin == true`, verified bootstrap identity (`hasanaamir815@gmail.com` with `email_verified == true`), OR presence of `/platform_admins/{request.auth.uid}`.
   - Only `isSuperAdmin()` may create/modify/delete `/platform_admins`, `/platform_plans`, `/platform_settings`, `/platform_payments` approvals, or suspend/delete tenants.
3. **Public vs Private Tenant Split (`shops_public` & `settings/public` vs `settings/private`)**:
   - `shops_public/{shopId}` is the public storefront directory mirror exposing ONLY the 19 safe storefront keys (`id`, `slug`, `name`, `businessType`, `logoUrl`, `city`, `publicContactPhone`, `publicSupportEmail`, `storefrontAddress`, `businessHours`, `seoTitle`, `seoDescription`, `ogImageUrl`, `websiteUrl`, `socialLinks`, `status`, `theme`, `createdAt`, `updatedAt`). CNIC fields are NEVER permitted on `shops_public`.
   - Storefront staff with `settings` or `appearance` module permission, shop owners/admins, and Super Admin may update allowed `shops_public/{shopId}` storefront keys; private fields remain isolated on `shops/{shopId}`.
   - `shops/{shopId}` (containing `ownerEmail`, `ownerPhone`, `cnicHash`, `cnicMasked`, `subscription` financials, `usage` telemetry) is **completely unreadable by the public** (`allow get: if isSuperAdmin() || isShopMember(shopId)`).
   - `shops/{shopId}/settings/public` holds storefront branding, shipping rates, and public pickup/checkout labels; `shops/{shopId}/settings/private` (and legacy `settings/general`) holds merchant private bank/wallet settlement accounts & owner contacts and is readable ONLY by `isShopMember(shopId) || isSuperAdmin()`.
4. **Strict Subcollection Isolation & Module RBAC (`/shops/{shopId}/...`)**:
   - Every operational subcollection checks `isShopMember(shopId)` and module-level `hasShopPermission(shopId, perm)` (`products`, `categories`, `banners`, `orders`, `customers`, `inventory`, `coupons`, `appearance`, `settings`, `staff`).
   - Non-owner staff cannot promote themselves to `shop_admin` or `shop_owner`, cannot modify/delete an existing `shop_owner` record, and invite acceptance requires exact `role` + `permissions` matching the `shop_invites/{inviteId}` doc.
5. **Anti-Tampering on Subscriptions, Slugs, Payments & Global CNIC Uniqueness**:
   - Shop Owners cannot self-upgrade `shops/{shopId}.subscription`, lift a `'suspended'` status, or tamper with `cnicHash`/`cnicLast4`/`cnicMasked`/`cnicVerified`/`cnicStatus`/`cnicUpdatedAt` once set.
   - **Global Atomic One-CNIC-One-Shop Rule**: Store registration routes exclusively through server-verified endpoints (`registerShopWithCnic` Cloud Function using `defineSecret('CNIC_HMAC_SECRET')` or `POST /api/shops/register`) which normalize the 13-digit CNIC, derive an HMAC-SHA256 key (`cnic_registry/{hmacKey}`), and execute atomic Firestore precondition writes (`exists: false`) for `cnic_registry/{hmacKey}`, `shop_slugs/{slug}`, and `shops/{shopId}`. Firestore Rules enforce cross-document atomicity via `existsAfter` and `getAfter` so standalone direct-client writes to any single collection are rejected. Only `isSuperAdmin()` may assign, correct, or release CNIC locks via `manageShopCnicAdmin` / `/api/super-admin/cnic/manage`.
   - Slug reservation requires `!exists(/databases/$(database)/documents/shops/$(incoming().shopId))`, `existsAfter` atomicity, regex validation, and blocks reserved platform keywords.
   - Platform payment approval runs inside a Firestore Transaction verifying `status === 'pending'` to prevent duplicate approval & expiry inflation.
6. **Zero-Leak Guest Order Tracking**:
   - `shops/{shopId}/orders/{orderId}` explicitly denies anonymous/guest `get` and `list`, with cleanly separated `list` rules free of invalid docId path assertions.
   - Each order generates a 256-bit `trackingToken`; only its SHA-256 `trackingTokenHash` is persisted on the order and `shops/{shopId}/order_tracking/trk_<hash32>` (which omits `email`, `phone`, `street address`, and `paymentProofImage`).
7. **Firebase Storage Tenant Isolation (`storage.rules`)**:
   - Public read applies strictly to `logo/`, `products/`, `banners/`, `categories/`, and `pages/`.
   - `shops/{shopId}/payments/`, `shops/{shopId}/subscription/`, `sales/expenses/`, and `platform/payments/{shopId}/` are **strictly private** (no public read) and enforce custom metadata ownership (`shopId` & `uploaderUid`).
   - Tenant authorization relies on Firebase Custom Claims (`token.shops[shopId]`), `sales_role`, and `super_admin` claims (bounded within Firebase Auth's 1000-byte ceiling)—never a bare `isSignedIn()` check. Uploads inspect real JPEG/PNG/WebP/GIF binary magic bytes client-side and enforce `<= 5 MB` in rules.
8. **Complete Shop Deletion & Archival Tombstone (`deleteShopCompleteAdmin`)**:
   - Super Admin shop deletion invokes the server-side `deleteShopCompleteAdmin` Cloud Function (`us-central1`), recursively purging all subcollections, `shops_public/{shopId}`, `shop_slugs/{slug}`, all staff `shopMemberships` + Firebase Auth `shops` custom claims, Firebase Storage `shops/{shopId}/` & `platform/payments/{shopId}/` folders, retaining CNIC lock archival state, and writing an audit record to `archived_shops/{shopId}` and `platform_activity_logs`.
9. **API Origin Hardening (`server.ts`)**:
   - `/api/*` enforces strict CORS origin validation (GitHub Pages host `https://sbkhush.github.io`, `https://sbkhush.com`, `https://www.sbkhush.com`, `APP_URL`, `ALLOWED_INSPECT_ORIGINS` / `ALLOWED_ORIGINS`, local dev) alongside `cors.json` for Firebase Storage, rejecting disallowed cross-site API origins with HTTP 403.

## Dirty Dozen Verification Cases
1. Unauthenticated read of `shops/shopA` or `shops/shopA/orders` -> DENIED
2. Shop A owner reading/modifying `shops/shopB/orders`, `products`, `customers`, or Storage assets -> DENIED
3. Shop Owner writing to `platform_plans`, `platform_admins`, `cnic_registry`, or `archived_shops` -> DENIED
4. Shop Owner modifying `users/{uid}.role = 'super_admin'` or modifying `shops/{shopId}.cnicVerified` -> DENIED
5. Shop Owner self-activating `'enterprise-pro'` subscription directly on `shops/{shopId}` -> DENIED
6. Suspended Shop Owner trying to flip `shops/{shopId}.status = 'active'` -> DENIED
7. Guest creating order with `paymentStatus: 'paid'` -> DENIED
8. Staff with `shop_staff` role trying to delete/override `shop_owner` or escalate role in `shops/{shopId}/staff` -> DENIED
9. Customer updating order status to `'Delivered'` -> DENIED
10. Public unauthenticated query on `shops/{shopId}/inventory_logs`, `contact_messages`, or `settings/private` -> DENIED
11. Slug hijacking existing `shop_slugs/{slug}` or registering duplicate CNIC on `cnic_registry/{hmacKey}` -> DENIED / ATOMIC REJECT
12. Uploading non-image, >5MB payload, or reading private `payments/` / `subscription/` receipts publicly -> DENIED

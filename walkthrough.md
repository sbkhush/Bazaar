# Security Summary

**Reviewed Files**: 22 (frontend routes/services, `server.ts`, `functions/src/index.ts`, `firestore.rules`, `storage.rules`, `cors.json`, deployment workflows)
**Issues Resolved**: 4

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Client-Side CNIC Hash Fallback | `src/services/platformService.ts` | 716 | If Cloud Functions and Express API were unreachable, `registerNewShop` fell back to computing a predictable client-side SHA-256 hash (`SBKHUSH-CNIC-LOCK:...`) and issuing two client-side Firestore batches. | High | Fixed | Removed the client-side `sha256Hex` and `writeBatch` fallback completely. Registration now strictly requires server-side HMAC verification (`registerShopWithCnic` or `/api/shops/register`) and fails closed safely when verification services are unreachable. |
| Incomplete Atomic Store Provisioning in Cloud Function | `functions/src/index.ts` | 680 | `registerShopWithCnic` wrote `settings/public` without `aboutUs` and did not seed initial business-type categories inside the atomic transaction. | Low | Fixed | Added `getDefaultCategoriesForBusinessTypeServer` and populated `aboutUs` plus default categories atomically inside `db.runTransaction()`. |
| Storefront Hero Banner CTA Clipping & Contrast | `src/pages/HomePage.tsx` | 104 | Hero slides used `absolute inset-0` inside a fixed-height container and hardcoded white button text regardless of merchant `primaryColor`, risking clipped or low-contrast CTA buttons on small viewports. | Medium | Fixed | Switched the hero carousel to CSS Grid `[grid-area:1/1]` stacking with accessible luminance-based foreground contrast, whitespace-trimmed `"Shop Now"` fallback, and GitHub Pages subpath link normalization. |
| Tenant Marketing QR & Poster Boundary | `src/dashboard/ShopMarketingPage.tsx` | 50 | Added merchant QR code and downloadable PNG marketing poster generation. | Medium | Fixed | Added `assertMerchantMarketingAccess` and `buildShopPublicUrl` guards so merchants can only generate/download QR codes and posters for their own active store slug (preserving `/Bazaar/` on GitHub Pages) and never cross tenants. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Production Express CNIC Secret Guard | `server.ts` | Rejects `/api/shops/register` with HTTP 500 when `NODE_ENV === 'production'` and `CNIC_HMAC_SECRET` is unset, preventing static fallback hashing in production. |
| Firestore Rules & Role Isolation | `firestore.rules` | Default-deny catch-all, strict ownership/staff permission predicates, Super-Admin-only writes on `platform_admins`, `commissionLedger`, `commissionPayouts`, and `cnic_registry`, and validated public mirrors (`shops_public`). Live REST probe confirmed `403 PERMISSION_DENIED` on unauthenticated `cnic_registry` and `shops` reads. |
| Storage Upload & CORS Rules | `storage.rules` | Restricts uploads to authenticated store admins/staff/sales users, enforces `image/*` content types and 5 MB size ceilings, and keeps payment proofs private. |
| Route-Level Portal Isolation | `src/superadmin/SuperAdminLayout.tsx`, `src/dashboard/DashboardContext.tsx` | Non-Super Admin roles are immediately redirected from `/super-admin` and `/admin`, and `inspectShopId` is ignored unless `isSuperAdmin === true`. |

## PoC Verification

### Bypass Attempt: Unreachable Verification Fallback During CNIC Shop Registration

#### Summary
| Field | Value |
|---|---|
| Issue Type | Client-Side Security Control Fallback |
| Impact | High |
| Affected File | `src/services/platformService.ts:713` |
| Test Scenario | Sign in as a user on a static origin where `registerShopWithCnic` Cloud Function returns 404 (not deployed) and Express `/api/shops/register` is unconfigured (`isUnconfiguredBackend`). Submit `registerNewShop()` with valid shop & CNIC details. |

#### How It Was Fixed
Removed the `sha256Hex('SBKHUSH-CNIC-LOCK:...')` computation and the client-side `batch1`/`batch2` writes from `registerNewShop` in `src/services/platformService.ts`. If neither Cloud Functions nor the Express backend returns a verified shop record, registration aborts before any Firestore document write.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `registerNewShop` validates input CNIC format, slug availability, and legacy audit status (`src/services/platformService.ts:613-626`). | Input validated |
| 2 | Invokes `httpsCallable(functions, 'registerShopWithCnic')` (`src/services/platformService.ts:656`). On 404/network failure, attempts `apiFetch('/api/shops/register')` (`src/services/platformService.ts:686`). | Verification endpoints attempted |
| 3 | When `registeredShop` remains `null`, execution hits `if (!registeredShop)` (`src/services/platformService.ts:714-718`) and throws `"Shop registration verification service is temporarily unreachable. Please try again or contact SB Khush Support."`. | **Blocked / Fails Closed** |

#### Conclusion
**Fix Verified** - No unkeyed client-side CNIC hash or partial Firestore writes can occur when server-side HMAC verification services are unreachable.

---

### Cross-Tenant Access Attempt: Generating Another Merchant's Store QR / Poster

#### Summary
| Field | Value |
|---|---|
| Issue Type | Cross-Tenant Authorization Check |
| Impact | Medium |
| Affected File | `src/utils/shopMarketing.ts:56` & `src/dashboard/DashboardContext.tsx:49` |
| Test Scenario | Authenticated Merchant A (`uid_merchant_a`, owner of `shop-a`) attempts to target `shop-b` (`ownerId: uid_merchant_b`) via `?inspectShopId=shop-b` or via `assertMerchantMarketingAccess`. |

#### How It Was Fixed
`DashboardContext` sets `isInspecting = Boolean(inspectShopId && isSuperAdmin)`, ignoring `inspectShopId` for non-Super Admin merchants, and `ShopMarketingPage` gates QR/poster generation through `assertMerchantMarketingAccess`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Merchant A opens `/dashboard/marketing?inspectShopId=shop-b`. | Request reaches `DashboardProvider` |
| 2 | `DashboardContext.tsx:49-52` evaluates `isSuperAdmin === false`, ignores `inspectShopId`, and binds `resolvedShopId` strictly to Merchant A's `shopMemberships`. | Tenant ID locked to Merchant A |
| 3 | Directly passing `shop-b` to `assertMerchantMarketingAccess` (`src/utils/shopMarketing.ts:56-79`) evaluates `ownsShop === false && isMember === false` and returns `{ allowed: false }`. | **Access Denied Safely** |

#### Conclusion
**Fix Verified** - Merchants can only generate and download QR codes, store links, and marketing posters for stores they own or manage.

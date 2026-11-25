# SB Khush Demo Super Admin Guide

This guide documents the architecture, provisioning, authentication flow, security boundaries, and reset operations for the **SB Khush Demo Super Admin** system.

---

## 1. Account Specification & Security Principles

- **Email**: `demo-admin@sbkhush.com`
- **Display Name**: `SB Khush Demo Admin`
- **Account Type**: `DEMO`
- **Status**: `Active` (stored in `/demo_admins/{uid}`)
- **Custom Claims**:
  ```json
  {
    "super_admin": false,
    "demo_super_admin": true,
    "account_type": "DEMO",
    "demo_scope": "demo_env/default",
    "shops": {},
    "sales_role": null
  }
  ```

### Zero Hardcoded Passwords
Passwords are **never** stored in frontend JavaScript, backend source code, CLI scripts, or automated tests. Set `DEMO_ADMIN_PASSWORD` at runtime via environment configuration (Cloud Functions secrets/env or CLI shell environment) during provisioning.

---

## 2. Provisioning & Seeding

### Option A — Firebase Admin CLI
Ensure Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`) and `functions/node_modules` (for `firebase-admin`) are available, then run:

```bash
DEMO_ADMIN_PASSWORD="<your-strong-demo-password>" npx tsx scripts/provision-demo-admin.ts
```

To reset and re-seed only `/demo_env/default` later:

```bash
npx tsx scripts/reset-demo-data.ts
```

### Option B — Production Super Admin Settings UI / Cloud Functions
1. Deploy Cloud Functions (`functions/src/index.ts`):
   - `provisionDemoSuperAdmin`
   - `issueDemoAdminToken`
   - `resetDemoEnvironmentAdmin`
2. Configure runtime env / secret `DEMO_ADMIN_PASSWORD` in Cloud Functions or provide a temporary runtime password from **Super Admin → Platform Settings → Demo Super Admin Sandbox Control** while signed in as an authorized **Production Super Admin**.
3. Click **Verify / Provision Demo Account** or **Reset & Re-Seed Demo Sandbox**.

---

## 3. Demo Login User Experience

1. Navigate to `/login` (`#/login`).
2. Click **Explore Demo Admin** to open the interactive Demo Super Admin preview modal (displays non-secret account metadata and sandbox rules).
3. Click **Launch Demo Super Admin** — calls `issueDemoAdminToken` and completes real Firebase Authentication via `signInWithCustomToken` (or sign in manually with Firebase Email/Password).
4. `AuthContext` verifies `account_type === 'DEMO'` / `demo_super_admin === true`, sets `isDemoAdmin = true`, keeps `isSuperAdmin = false`, switches Firestore & Storage services to the `demo` namespace (`demo_env/default/...`), and routes to `/super-admin`.
5. `SuperAdminLayout` displays a persistent **DEMO MODE** banner and hides production-only links (`Shop Workspace`, legacy flagship migration controls).

---

## 4. Air-Gap Isolation Guarantees

| Layer | Enforcement Mechanism |
| --- | --- |
| **Firestore Rules** (`firestore.rules`) | `isNotDemoAccount()` blocks Demo Admin from all production collections (`platform_admins`, `admins`, `users`, `shops`, `salesMembers`, etc.). Access is strictly scoped to `/demo_env/default/**` when `isDemoSuperAdmin()` is true. |
| **Storage Rules** (`storage.rules`) | `isNotDemoAccount()` prevents Demo Admin access to `/shops/...`, `/platform/...`, and `/sales/...`. Uploads and reads are allowed strictly under `/demo_env/default/**`. |
| **Cloud Functions** (`functions/src/index.ts`) | `assertSuperAdmin()`, `registerShopWithCnic()`, and `rebuildCustomClaimsForUser()` explicitly reject any demo identity (`isDemoIdentity()`). |
| **Express Server** (`server.ts`) | `isAuthorizedSuperAdmin()`, `/api/shops/register`, `/api/sales*`, `/api/super-admin/*`, and `/api/demo/reset` reject `verifiedUser.isDemoAccount === true` with HTTP `403`. |
| **Frontend Routing & Services** | `canAccessPortalRoute()` restricts Demo Admin to `/super-admin*` and `/admin*` (blocks `/dashboard`, `/salesman`, `/sales-manager`, `/referral`). All platform, sales, tenant, retail, and storage services prefix paths with `demo_env/default` when demo namespace is active. |

---

## 5. Seeded Dataset Summary (`/demo_env/default`)

Every record carries `DEMO DATA` markers and strictly synthetic `.invalid` placeholder contacts (zero real PII):
- **20** demo shops across Lahore, Karachi, Islamabad, Chichawatni, and 16 additional cities
- **100** products (5 per shop)
- **50** synthetic store customers
- **30** simulated orders covering both `delivery` and `self_pickup` fulfillment
- **10** sales team members (**2** `sales_manager` + **8** `salesman` / `senior_salesman`)
- **5** `referral_agent` partners
- Subscription plans, simulated `platform_payments`, `commissionLedger`, `commissionPayouts`, `salesTeams`, `salesLeads`, `salesTargets`, `salesActivities`, `salesQrEvents`, `referralAttributions`, `support_tickets`, `platform_activity_logs`, `platform_settings/general`, and `salesSettings/general`.

---

## 6. Verification

Run the automated test suite, type check, and production build:

```bash
npx vitest run
npm run lint
npm run build
```

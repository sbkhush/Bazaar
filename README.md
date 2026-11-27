# SB Khush — Multi-Tenant eCommerce, POS & Store Management SaaS

A full-stack Pakistani multi-tenant eCommerce, Counter POS, Customer Khata, Self-Pickup, and Sales Management SaaS platform built with React 19, TypeScript, Tailwind CSS, Express, and Firebase Firestore, Storage & Authentication (`https://sbkhush.com`).

## Key Capabilities

### 1. Multi-Tenant Customer Storefront (`/s/:shopSlug`)
- **Brandable Storefront**: Custom shop logos, promotional banners, categories, trending products, variant selectors, predictive search, and live stock tracking.
- **Cart & Voucher Engine**: Slide-over cart drawer, free-shipping progress tracker, coupon validation, and saved carts/wishlists per tenant.
- **Pakistani Checkout & Self-Pickup**:
  - Pakistani mobile phone validation (`03XXXXXXXXX` / `+923XXXXXXXXX`) and nationwide city picker
  - **Home Delivery** via courier partners (TCS, Leopards, Trax, Call Courier, PostEx, M&P)
  - **Self-Pickup / Store Pickup** with store hours, pickup date/time slots, capacity enforcement, and QR + 6-digit OTP verification pass
  - **Payment Options**: Cash on Delivery / Pay at Counter, EasyPaisa, JazzCash, and Bank Transfer (IBFT) with private receipt upload
- **Tokenized Order Tracking**: Privacy-preserving guest order tracking via 256-bit tracking tokens.

### 2. Merchant Dashboard (`/dashboard`)
- **Counter POS & Billing**: Fast retail POS with barcode/SKU support, split payments, printable receipts, and stock + Khata synchronization.
- **Inventory, Purchases & Suppliers**: Wholesale supplier payables, purchase invoices, and real-time stock movement ledgers.
- **Customer Khata & Credit Ledger**: Track customer udhaar balances, payments, and return adjustments.
- **Staff RBAC**: Invite team members (`shop_admin`, `shop_staff`) with granular module permissions.

### 3. Platform Super Admin & Sales Portals (`/super-admin`, `/sales-manager`, `/salesman`, `/referral`)
- **Super Admin Control**: Tenant store approvals, subscription plans & manual TID verification, global CNIC uniqueness registry, support tickets, audit logs, and full platform data purge controls.
- **Field Sales & Referral Portals**: Strict role-isolated portals for Sales Managers, Field Salesmen, and Referral Partners with QR attribution and commission ledgers.

## Tech Stack
- **Frontend**: React 19, TypeScript, React Router 7, Tailwind CSS v4, Lucide Icons, jsPDF, QRCode.
- **Backend & Database**: Cloud Firestore, Firebase Authentication, Firebase Storage, Firebase Cloud Functions v2, Express.
- **Tooling**: Vite 8, Vite PWA, Vitest, Strict TypeScript.

## Development & Deployment
1. Install dependencies: `npm install` (and `npm --prefix functions install` for Cloud Functions).
2. Typecheck, test, and build: `npm run lint && npm test && npm run build`.
3. Deploy Firestore rules, Storage rules, indexes, and Cloud Functions to Firebase project `primeval-objective-t8chg`:
   `firebase deploy --only firestore,storage,functions --project primeval-objective-t8chg`

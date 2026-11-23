# SB Khush — Multi-Tenant eCommerce SaaS & Store Management Platform

A full-stack, production-ready Pakistani multi-tenant eCommerce SaaS web application and administrative system built with React, TypeScript, Tailwind CSS, Express, and Firebase Firestore, Storage & Authentication (`https://sbkhush.com`).

## Key Features

### 1. Customer Storefront
- **Modern Homepage**: Dynamic promotional banner slider, curated categories, trending products, best sellers, limited-time deals with coupon discounts, verified Pakistani customer reviews, and newsletter subscription.
- **Shop Catalog**: Full faceted filters (by Category, Price Range Slider, Pakistani Brands, In-Stock Only), multiple sort orders (Popularity, Price Low to High, Price High to Low, Newest Arrivals), and instant predictive search dropdown.
- **Product Details**: Multi-angle image gallery with thumbnail switcher, variants selector (sizes, colors), live stock indicator, verified price comparison, customer reviews with submission form, and courier delivery estimation.
- **Cart & Slide-Over Drawer**: Real-time subtotal, free shipping progress tracker (e.g. "Add Rs. 650 more for FREE nationwide delivery"), voucher coupon code validator (e.g., `AZADI10`, `WELCOME500`), and session persistence in Firestore.
- **Pakistani Optimized Checkout**:
  - Full Pakistani mobile phone number validation (`03XXXXXXXXX` / `+923XXXXXXXXX`)
  - 40+ Pakistani cities dropdown (Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Sialkot, etc.)
  - Complete delivery address with courier notes
  - Payment methods:
    1. **Cash on Delivery (COD)**: Doorstep cash collection via TCS, Leopards, and Trax.
    2. **Direct Bank Transfer (IBFT)**: Shows official Meezan Bank account details (Account Title, Account Number, IBAN) and captures the customer's transfer transaction ID.
    3. **Online Payment Gateway**: Integration-ready modular architecture for Visa/Mastercard/PayPak.
- **Celebratory Order Confirmation**: Instant order reference (`PK-XXXXXX`), downloadable/printable receipt, and celebratory confetti.
- **Customer Account**: Order history with status tags, live courier shipment tracking visualizer, saved addresses book, and wishlist synchronization.
- **Support & Policies**: Floating WhatsApp support button with pre-filled inquiries, FAQ page, 7-Day Return & Exchange Policy, Terms of Service, and Privacy Policy.

### 2. Admin Management Dashboard (`/admin`)
- **Role-Based Access Control**: Protected admin routes strictly verifying administrative roles in Firestore `/admins/{uid}` and bootstrapped super admin (`hasanaamir815@gmail.com`). Includes a demo switch in the announcement bar for quick evaluation.
- **Dashboard Overview**: Key metrics (Total Sales in PKR, Total Orders, Active Catalog Items, Low-Stock Alerts), recent orders table with status badges, and best-performing products.
- **Product Management**: Complete CRUD operations, multi-image support, SKU generation, regular & sale pricing, stock counts, variant attributes, and published/featured toggles.
- **Category Management**: Create, edit, and delete store categories with custom slugs, banners, and display ordering.
- **Order Fulfillment & Logistics**: Filter orders by status (`Pending`, `Confirmed`, `Processing`, `Shipped`, `Delivered`, `Cancelled`), view complete shipping details, assign courier partners (TCS, Leopards, Trax, PostEx, M&P), record consignment tracking numbers, update payment status, and export orders to CSV.
- **Inventory & Warehouse Logs**: Live stock monitoring, low-stock filter (< 5 units), manual stock adjustments with reason logging (`inventory_logs`).
- **Coupon Management**: Create percentage or fixed discount vouchers with minimum order criteria, expiry dates, usage caps, and active/disabled switches.
- **Website Settings**: Customize store name, announcement bar text, delivery charges, free shipping threshold, and official bank transfer details.
- **One-Click Database Seeder**: Seed the initial Pakistani product catalog, categories, banners, and coupons directly into Firestore with one click.

## Tech Stack
- **Frontend**: React 19, TypeScript, React Router 7, Tailwind CSS v4, Lucide Icons, Canvas Confetti.
- **Backend & Database**: Cloud Firestore, Firebase Authentication.
- **Tooling**: Vite 8, ES2022, Strict TypeScript.

## Deployment Instructions
1. Run `npm run build` to create the production build in `/dist`.
2. Deploy to Firebase Hosting or Cloud Run using the provisioned Firebase project (`primeval-objective-t8chg`).
3. Firestore security rules are deployed at `firestore.rules`.

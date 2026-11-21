export const BRAND = {
  name: 'SB Khush',
  legalName: 'SB Khush Commerce Technologies',
  shortMark: 'SBK',
  tagline: 'Complete Business & Online Storefront Cloud',
  domain: 'sbkhush.com',
  primaryUrl: 'https://sbkhush.com',
  secondaryUrl: 'https://www.sbkhush.com',
  supportEmail: 'support@sbkhush.com',
  salesEmployeePrefix: 'SBK-SLS-',
  defaultThemePrimary: '#065F46',
  defaultThemeAccent: '#D97706',
  seoTitle: 'SB Khush — Smart Business & Online Store SaaS Platform',
  seoDescription:
    'Launch an independent online storefront, manage inventory, POS counter billing, customer Khata ledger, orders, and manual or COD payments with SB Khush.',
} as const;

export const DEFAULT_PLATFORM_PRIVACY_POLICY = `SB Khush ("we", "our", or "the Platform") operates the multi-tenant software-as-a-service commerce platform accessible at https://sbkhush.com and https://www.sbkhush.com.

1. Scope of This Policy
This Privacy Policy applies exclusively to the SB Khush SaaS platform, merchant workspace administration, sales & referral portals, and platform-level billing records. Individual online stores hosted on SB Khush publish and manage their own shop-specific Privacy Policy governing customer orders placed with those merchants.

2. Information Collected on the Platform
- Merchant Account Information: business name, owner full name, verified email address, contact phone number, city, and business category submitted during onboarding.
- Subscription & Billing Verification: selected subscription tier, manual payment transaction references (TID), and uploaded verification receipts stored securely in private storage.
- Security & Operational Audit Logs: authentication timestamps, role permissions, and administrative actions necessary to safeguard tenant isolation.

3. Data Isolation & Tenant Security
Each merchant store operates within isolated tenant collections. Store owners and authorized staff can only access records belonging to their own store. Platform administrators access operational metadata strictly for verification, technical support, and abuse prevention.

4. Cookies, Offline Storage & Authentication
SB Khush uses Firebase Authentication tokens and browser storage solely to preserve active user sessions, cart state, and security preferences. We do not sell merchant or buyer data to third-party advertising networks.

5. Contact SB Khush
For platform privacy inquiries, account data export requests, or security disclosures, contact ${BRAND.supportEmail}.`;

export const DEFAULT_PLATFORM_TERMS = `Welcome to SB Khush (https://sbkhush.com). By registering a merchant workspace or accessing platform services, you agree to these Terms and Conditions.

1. Platform Role & Merchant Independence
SB Khush provides software infrastructure enabling independent businesses to operate online storefronts, inventory systems, POS billing, and order tracking. Each registered merchant is solely responsible for the legality, pricing, authenticity, fulfillment, taxes, and warranties of products sold in their storefront.

2. Account Eligibility & Security
Merchants and authorized team members must provide accurate registration details and safeguard login credentials. Sales team accounts and referral agents operate under strict role-based permissions and may never impersonate platform administrators.

3. Subscriptions & Verification
Free Trial workspaces are activated for trial evaluation without payment. Paid plan renewals verified via bank transfer, EasyPaisa, or JazzCash are activated after administrative verification of valid transaction receipts.

4. Acceptable Use
You may not upload malicious payloads, spoof payment proofs, scrape other tenants' data, or sell prohibited goods on SB Khush. Violations may result in immediate workspace suspension.

5. Platform Support
Technical support and billing queries can be directed to ${BRAND.supportEmail}.`;

export interface ShopLegalTemplateParams {
  shopName: string;
  city?: string;
  contactEmail?: string;
  contactPhone?: string;
  storeUrl?: string;
}

export function buildShopLegalStarterTemplates(params: ShopLegalTemplateParams): {
  privacyTitle: string;
  privacyContent: string;
  termsTitle: string;
  termsContent: string;
} {
  const cleanName = params.shopName.trim() || 'Our Store';
  const cleanCity = params.city?.trim() || 'Pakistan';
  const contactLine =
    params.contactEmail || params.contactPhone
      ? [params.contactEmail, params.contactPhone].filter(Boolean).join(' / ')
      : 'our store contact page';

  return {
    privacyTitle: `Privacy Policy — ${cleanName}`,
    privacyContent: `${cleanName} respects your privacy and handles your order details responsibly.

1. Information We Collect
When you browse ${cleanName} or place an order${params.storeUrl ? ` (${params.storeUrl})` : ''}, we collect your name, mobile number, delivery address, city, and order summary solely to fulfill and deliver your purchase.

2. Payment Verification Records
If you choose Bank Transfer, EasyPaisa, or JazzCash, any uploaded payment screenshot or transaction reference is reviewed exclusively by authorized ${cleanName} staff to verify order payment.

3. Third-Party Sharing
Your shipping details are shared only with our courier or delivery team as needed to deliver your order in ${cleanCity} and across Pakistan. We never sell customer phone numbers or personal data.

4. Store Contact
For questions regarding your personal data or order records, reach ${cleanName} at ${contactLine}.`,
    termsTitle: `Terms & Conditions — ${cleanName}`,
    termsContent: `By placing an order with ${cleanName}, you agree to the following store policies:

1. Orders & Confirmation
All orders are subject to product availability and stock confirmation by ${cleanName}. For Cash on Delivery (COD) and manual transfer orders, our team may confirm your delivery address via phone or WhatsApp before dispatch.

2. Pricing & Payments
Prices are listed in Pakistani Rupees (PKR) unless otherwise stated. Delivery fees are calculated transparently at checkout before confirmation.

3. Delivery & Returns
Estimated delivery timelines depend on courier service availability in your city. Customers may inspect eligibility and conditions for exchanges or returns on our Return Policy page or by contacting ${cleanName}.

4. Store Support
For order modifications, cancellations prior to dispatch, or support, contact ${cleanName} via ${contactLine}.`,
  };
}

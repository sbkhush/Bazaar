import {
  Category,
  StoreSettings,
  PaymentMethod,
  FulfillmentMethod,
  OrderStatus,
  PickupStatus,
  SubscriptionPlan,
  PlatformSettings,
  StaffPermission,
  BusinessType,
  ProductUnit,
  PickupSlotConfig,
} from '../types';

export const DEFAULT_SHOP_ID = 'bazaarpk';
export const SUPER_ADMIN_EMAIL = 'hasanaamir815@gmail.com';

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string; description: string }[] = [
  {
    value: 'general_store',
    label: 'General Store / Kiryana Store',
    description: 'Groceries, staples, beverages, household items with Piece/KG/Gram/Litre/Carton units',
  },
  {
    value: 'cosmetics',
    label: 'Cosmetics & Beauty Shop',
    description: 'Skincare, makeup shades, fragrances, hair care & beauty essentials',
  },
  {
    value: 'clothing',
    label: 'Clothing & Garments Store',
    description: 'Eastern wear, stitched/unstitched suits, footwear, sizes, colors & style variants',
  },
  {
    value: 'other_retail',
    label: 'Other Retail Store',
    description: 'Flexible multi-category Pakistani retail storefront & POS billing',
  },
];

export const PRODUCT_UNITS: ProductUnit[] = [
  'Piece',
  'KG',
  'Gram',
  'Litre',
  'Millilitre',
  'Packet',
  'Carton',
  'Box',
  'Dozen',
  'Set',
];

export function getDefaultCategoriesForBusinessType(
  businessType: BusinessType = 'general_store'
): Omit<Category, 'id' | 'shopId'>[] {
  switch (businessType) {
    case 'cosmetics':
      return [
        { name: 'Skincare & Serums', slug: 'skincare', description: 'Cleansers, moisturizers, serums & sunscreens', order: 1 },
        { name: 'Makeup & Lipsticks', slug: 'makeup', description: 'Foundations, lip shades, palettes & brushes', order: 2 },
        { name: 'Hair & Body Care', slug: 'hair-care', description: 'Shampoos, oils, masks & body lotions', order: 3 },
        { name: 'Fragrances & Perfumes', slug: 'fragrances', description: 'Attar, body mists & designer perfumes', order: 4 },
      ];
    case 'clothing':
      return [
        { name: 'Men & Boys Wear', slug: 'menswear', description: 'Shalwar kameez, kurtas, shirts & trousers', order: 1 },
        { name: 'Women & Lawn Suits', slug: 'womenswear', description: 'Stitched & unstitched 3-piece suites and pret', order: 2 },
        { name: 'Footwear & Chappals', slug: 'footwear', description: 'Casual shoes, sandals, Peshawari & khussa', order: 3 },
        { name: 'Accessories & Bags', slug: 'accessories', description: 'Shawls, dupattas, handbags & belts', order: 4 },
      ];
    case 'other_retail':
      return [
        { name: 'Featured Essentials', slug: 'featured-essentials', description: 'Popular everyday store products', order: 1 },
        { name: 'New Arrivals', slug: 'new-arrivals', description: 'Latest stock added to the store', order: 2 },
        { name: 'Value Bundles', slug: 'value-bundles', description: 'Saver packs and combo deals', order: 3 },
      ];
    case 'general_store':
    default:
      return [
        { name: 'Atta, Rice & Pulses', slug: 'staples-grains', description: 'Everyday kitchen staples, flour, rice & daal', order: 1 },
        { name: 'Cooking Oil & Beverages', slug: 'oils-beverages', description: 'Cooking oils, ghee, tea, milk & cold drinks', order: 2 },
        { name: 'Personal & Home Care', slug: 'home-personal-care', description: 'Soaps, detergents, cleaners & hygiene essentials', order: 3 },
        { name: 'Snacks & Bakery', slug: 'snacks-bakery', description: 'Biscuits, spices, sauces & breakfast items', order: 4 },
      ];
  }
}

export const ALL_STAFF_PERMISSIONS: { key: StaffPermission; label: string }[] = [
  { key: 'overview', label: 'Dashboard Overview' },
  { key: 'pos', label: 'POS & Counter Billing' },
  { key: 'products', label: 'Products Management' },
  { key: 'categories', label: 'Categories' },
  { key: 'orders', label: 'Orders & Invoices' },
  { key: 'customers', label: 'Customers' },
  { key: 'khata', label: 'Customer Khata / Credit Ledger' },
  { key: 'inventory', label: 'Inventory & Stock Movements' },
  { key: 'purchases', label: 'Purchase Invoices' },
  { key: 'suppliers', label: 'Suppliers & Payables' },
  { key: 'coupons', label: 'Coupons & Discounts' },
  { key: 'banners', label: 'Promotional Banners' },
  { key: 'appearance', label: 'Storefront Appearance & SEO' },
  { key: 'settings', label: 'Payment, Delivery & Self-Pickup' },
  { key: 'staff', label: 'Staff Management' },
  { key: 'reports', label: 'Reports, Expenses & Profit' },
  { key: 'subscription', label: 'Subscription & Billing' },
];

export const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80';

import { PAKISTAN_CITY_NAMES } from './locations';

export const PAKISTAN_CITIES = PAKISTAN_CITY_NAMES;

export const COURIERS = [
  { id: 'tcs', name: 'TCS Express', trackingUrl: 'https://www.tcsexpress.com/tracking' },
  { id: 'leopards', name: 'Leopards Courier', trackingUrl: 'https://leopardscourier.com/leopards-tracking' },
  { id: 'trax', name: 'Trax Logistics', trackingUrl: 'https://trax.pk/tracking' },
  { id: 'callcourier', name: 'Call Courier', trackingUrl: 'https://callcourier.com.pk/tracking' },
  { id: 'postex', name: 'PostEx', trackingUrl: 'https://postex.pk/tracking' },
  { id: 'mnp', name: 'M&P Courier', trackingUrl: 'https://www.mulphilog.com/tracking' },
];

export function formatPKR(amount: number): string {
  return `Rs. ${Math.round(amount || 0).toLocaleString('en-PK')}`;
}

export function sanitizeShopSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function isValidShopSlug(slug: string): boolean {
  return (
    /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug) &&
    ![
      'admin',
      'super-admin',
      'dashboard',
      'login',
      'merchant',
      'register',
      'api',
      's',
      'shop',
      'privacy-policy',
      'terms-and-conditions',
      'salesman',
      'sales-manager',
      'referral',
      'r',
    ].includes(slug)
  );
}

export function isValidPakistaniPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^((\+92)|(92)|(0))?3[0-9]{9}$/.test(cleaned);
}

export function getPaymentMethodLabel(
  method?: PaymentMethod | string,
  fulfillmentMethod?: FulfillmentMethod | string
): string {
  switch (method) {
    case 'cod':
      return fulfillmentMethod === 'self_pickup' ? 'Pay at Pickup Counter (Cash)' : 'Cash on Delivery (COD)';
    case 'easypaisa':
      return 'EasyPaisa Mobile Wallet';
    case 'jazzcash':
      return 'JazzCash Mobile Wallet';
    case 'bank_transfer':
      return 'Bank Transfer / IBFT';
    case 'online':
      return 'Online Card Gateway';
    default:
      return String(method || 'COD').toUpperCase();
  }
}

export function getFulfillmentLabel(method?: FulfillmentMethod | string): string {
  return method === 'self_pickup' ? 'Self-Pickup / Store Pickup' : 'Home Delivery (Courier)';
}

export function isSelfPickupEnabled(settings?: Partial<StoreSettings> | null): boolean {
  return Boolean(settings?.selfPickupDetails?.enabled === true);
}

export function isCashOnPickupAllowed(settings?: Partial<StoreSettings> | null): boolean {
  const pickup = settings?.selfPickupDetails;
  if (pickup?.requireAdvancePayment === true) return false;
  if (typeof pickup?.cashOnPickupEnabled === 'boolean') {
    return pickup.cashOnPickupEnabled;
  }
  return settings?.codEnabled !== false;
}

export function derivePickupStatusFromOrderStatus(orderStatus?: OrderStatus | string): PickupStatus {
  switch (orderStatus) {
    case 'Cancelled':
    case 'Returned':
    case 'Refunded':
      return 'Cancelled';
    case 'Collected':
    case 'Completed':
    case 'Delivered':
      return 'Picked Up';
    case 'Ready for Pickup':
      return 'Ready for Pickup';
    case 'Preparing':
    case 'Processing':
      return 'Preparing';
    case 'Pending':
    case 'Confirmed':
    case 'Accepted':
    default:
      return 'New Pickup Order';
  }
}

export function buildPickupQrPayload(orderNumber: string, pickupOtp: string): string {
  const cleanOrd = String(orderNumber || '').trim().toUpperCase();
  const cleanOtp = String(pickupOtp || '').replace(/\D/g, '').slice(0, 6);
  return `SBKHUSH-PICKUP|${cleanOrd}|${cleanOtp}`;
}

export function parsePickupVerificationInput(
  rawInput: string,
  expectedOrderNumber?: string
): { otp: string; orderNumber?: string } {
  const trimmed = String(rawInput || '').trim();
  if (trimmed.startsWith('SBKHUSH-PICKUP|')) {
    const parts = trimmed.split('|');
    const scannedOrder = String(parts[1] || '').trim().toUpperCase();
    const scannedOtp = String(parts[2] || '').replace(/\D/g, '');
    if (
      expectedOrderNumber &&
      scannedOrder &&
      scannedOrder !== expectedOrderNumber.trim().toUpperCase()
    ) {
      throw new Error(
        `Scanned QR belongs to order ${scannedOrder}, not ${expectedOrderNumber}.`
      );
    }
    return { otp: scannedOtp, orderNumber: scannedOrder || undefined };
  }
  return { otp: trimmed.replace(/\D/g, '') };
}

export function validatePickupDateInWindow(
  pickupDate: string,
  advanceDays = 5,
  referenceDate: Date = new Date()
): boolean {
  const clean = String(pickupDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return false;
  const options = buildPickupDateOptions(advanceDays, referenceDate);
  return options.some((opt) => opt.date === clean);
}

export function getDefaultPickupSlots(): PickupSlotConfig[] {
  return [
    {
      id: 'slot_morning',
      label: 'Morning (10:00 AM – 1:00 PM)',
      startTime: '10:00',
      endTime: '13:00',
      maxOrdersPerSlot: 10,
      isActive: true,
    },
    {
      id: 'slot_afternoon',
      label: 'Afternoon (2:00 PM – 5:00 PM)',
      startTime: '14:00',
      endTime: '17:00',
      maxOrdersPerSlot: 12,
      isActive: true,
    },
    {
      id: 'slot_evening',
      label: 'Evening (6:00 PM – 9:30 PM)',
      startTime: '18:00',
      endTime: '21:30',
      maxOrdersPerSlot: 12,
      isActive: true,
    },
  ];
}

export function buildPickupSlotKey(date: string, slotId: string): string {
  const safeDate = String(date || '').replace(/[^0-9-]/g, '').slice(0, 10);
  const safeSlot = String(slotId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  return `${safeDate}__${safeSlot}`;
}

export function buildPickupDateOptions(advanceDays = 5, referenceDate: Date = new Date()): { date: string; label: string }[] {
  const daysCount = Math.max(1, Math.min(14, Math.floor(advanceDays) || 5));
  const list: { date: string; label: string }[] = [];
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(referenceDate.getTime() + i * 86400000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    const dayLabel =
      i === 0
        ? 'Today'
        : i === 1
        ? 'Tomorrow'
        : d.toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' });
    list.push({ date: iso, label: `${dayLabel} (${dd}/${mm})` });
  }
  return list;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: 'SB Khush',
  tagline: 'Multi-Tenant Retail & Online Storefront Cloud',
  logoUrl: '',
  websiteUrl: 'https://sbkhush.com',
  announcement: '',
  supportEmail: 'support@sbkhush.com',
  supportPhone: '+92 300 0000000',
  whatsappNumber: '+923000000000',
  seoTitle: 'SB Khush — Smart Business Management & Online Store SaaS',
  seoDescription:
    'Manage products, stock inventory, POS billing, Khata credit ledger, and your own online storefront across Pakistan with COD, EasyPaisa, JazzCash & Self-Pickup.',
  ogImageUrl: '',
  canonicalDomain: 'https://sbkhush.com',
  currency: 'PKR',
  currencySymbol: 'Rs.',
  socialLinks: {},
  easypaisaDetails: {
    enabled: true,
    accountTitle: 'SB Khush',
    accountNumber: '',
    instructions: 'Send subscription fee to the configured EasyPaisa wallet and enter your 11-digit TID + receipt screenshot.',
  },
  jazzcashDetails: {
    enabled: true,
    accountTitle: 'SB Khush',
    accountNumber: '',
    instructions: 'Transfer via JazzCash App or *786# and upload your payment receipt screenshot.',
  },
  bankDetails: {
    enabled: true,
    bankName: 'Meezan Bank Limited',
    accountTitle: 'SB Khush Commerce Technologies',
    accountNumber: '',
    iban: '',
  },
  gracePeriodDays: 5,
};

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free-starter',
    name: 'Free Plan',
    slug: 'free-starter',
    description: 'Launch a live online storefront with 1 active product, order receiving, and SB Khush store URL — free permanently.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    durationDays: 36500,
    maxProducts: 1,
    maxStorageMB: 25,
    maxStaff: 1,
    features: {
      customBranding: false,
      coupons: false,
      banners: true,
      analytics: false,
      selfPickup: true,
      buyingGuide: false,
      staffAccounts: false,
      customPages: true,
      pos: false,
      barcode: false,
      suppliersPurchases: false,
      khata: false,
      advancedInventory: false,
      advancedReports: false,
      prioritySupport: false,
    },
    isActive: true,
    isPopular: false,
    order: 1,
  },
  {
    id: 'starter',
    name: 'Starter Plan',
    slug: 'starter',
    description: 'Built for neighborhood kiryana, cosmetics & clothing shops with up to 50 active products and basic inventory.',
    monthlyPrice: 799,
    yearlyPrice: 7990,
    durationDays: 30,
    maxProducts: 50,
    maxStorageMB: 150,
    maxStaff: 2,
    features: {
      customBranding: true,
      coupons: true,
      banners: true,
      analytics: true,
      selfPickup: true,
      buyingGuide: false,
      staffAccounts: true,
      customPages: true,
      pos: false,
      barcode: false,
      suppliersPurchases: false,
      khata: false,
      advancedInventory: false,
      advancedReports: false,
      prioritySupport: false,
    },
    isActive: true,
    isPopular: false,
    order: 2,
  },
  {
    id: 'business',
    name: 'Business Plan',
    slug: 'business',
    description: 'Complete counter POS billing, barcode scanning, suppliers, purchase invoices, customer Khata & 500 active products.',
    monthlyPrice: 1499,
    yearlyPrice: 14990,
    durationDays: 30,
    maxProducts: 500,
    maxStorageMB: 750,
    maxStaff: 4,
    features: {
      customBranding: true,
      coupons: true,
      banners: true,
      analytics: true,
      selfPickup: true,
      buyingGuide: true,
      staffAccounts: true,
      customPages: true,
      pos: true,
      barcode: true,
      suppliersPurchases: true,
      khata: true,
      advancedInventory: true,
      advancedReports: true,
      prioritySupport: false,
    },
    isActive: true,
    isPopular: true,
    order: 3,
  },
  {
    id: 'professional',
    name: 'Professional Plan',
    slug: 'professional',
    description: 'Unlimited active products (fair-use storage), COGS & net profit analytics, multi-staff RBAC & priority support.',
    monthlyPrice: 2499,
    yearlyPrice: 24990,
    durationDays: 30,
    maxProducts: -1,
    maxStorageMB: 3072,
    maxStaff: 15,
    features: {
      customBranding: true,
      coupons: true,
      banners: true,
      analytics: true,
      selfPickup: true,
      buyingGuide: true,
      staffAccounts: true,
      customPages: true,
      pos: true,
      barcode: true,
      suppliersPurchases: true,
      khata: true,
      advancedInventory: true,
      advancedReports: true,
      prioritySupport: true,
    },
    isActive: true,
    isPopular: false,
    order: 4,
  },
];

export const INITIAL_SETTINGS: StoreSettings = {
  siteName: 'SB Khush Store',
  logoUrl: '',
  websiteUrl: '',
  primaryColor: '#065f46',
  accentColor: '#d97706',
  announcement: 'Welcome to our online store — Cash on Delivery, EasyPaisa, JazzCash & Store Pickup available.',
  contactPhone: '',
  whatsappNumber: '',
  contactEmail: 'support@sbkhush.com',
  address: 'Karachi, Pakistan',
  city: 'Karachi',
  businessHours: 'Mon – Sat: 10:00 AM – 10:00 PM',
  seoTitle: '',
  seoDescription: '',
  ogImageUrl: '',
  codEnabled: true,
  shippingFee: 200,
  freeShippingThreshold: 3500,
  currency: 'PKR',
  currencySymbol: 'Rs.',
  aboutUs:
    'Welcome to our store! Browse authentic everyday products with transparent pricing, nationwide delivery across Pakistan, and convenient payment options.',
  bankDetails: {
    enabled: false,
    bankName: '',
    accountTitle: '',
    accountNumber: '',
    iban: '',
  },
  easypaisaDetails: {
    enabled: false,
    accountTitle: '',
    accountNumber: '',
    instructions: 'Open EasyPaisa App -> Send Money -> EasyPaisa Transfer, enter the account number above and paste your 11-digit TID below.',
  },
  jazzcashDetails: {
    enabled: false,
    accountTitle: '',
    accountNumber: '',
    instructions: 'Open JazzCash App or dial *786# -> Send Money -> JazzCash Account, send total amount and enter your TID below.',
  },
  selfPickupDetails: {
    enabled: false,
    title: 'Main Store Pickup Counter',
    address: '',
    city: 'Karachi',
    timings: 'Mon – Sat: 11:00 AM – 9:00 PM',
    contactPhone: '',
    mapUrl: '',
    preparationTime: '30–45 mins',
    requireAdvancePayment: false,
    cashOnPickupEnabled: true,
    advanceDays: 5,
    pickupSlots: getDefaultPickupSlots(),
    instructions: 'Bring your Order Number, registered mobile number, and 6-digit Pickup Verification Code / QR Pass when collecting your parcel.',
  },
  socialLinks: {},
};


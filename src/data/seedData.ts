import {
  Product,
  Category,
  Banner,
  StoreSettings,
  Coupon,
  PaymentMethod,
  FulfillmentMethod,
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

export const PAKISTAN_CITIES = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
  'Hyderabad',
  'Abbottabad',
  'Bahawalpur',
  'Sargodha',
  'Sukkur',
  'Larkana',
  'Sheikhupura',
  'Rahim Yar Khan',
  'Jhang',
  'Dera Ghazi Khan',
  'Gujrat',
  'Sahiwal',
  'Wah Cantt',
  'Mardan',
  'Kasur',
  'Okara',
  'Mingora',
  'Nawabshah',
  'Chiniot',
  'Kotri',
  'Mirpur Khas',
  'Kohat',
  'Dera Ismail Khan',
  'Muzaffargarh',
  'Mandi Bahauddin',
  'Jhelum',
  'Attock',
  'Vehari',
  'Chakwal',
  'Mirpur (AJK)',
  'Muzaffarabad (AJK)',
  'Gilgit',
  'Skardu',
];

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
  return method === 'self_pickup' ? 'Self-Pickup (Store Outlet)' : 'Home Delivery (Courier)';
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
    advanceDays: 5,
    pickupSlots: getDefaultPickupSlots(),
    instructions: 'Bring your Order Number, registered mobile number, and 6-digit Pickup OTP when collecting your parcel.',
  },
  socialLinks: {},
};

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'eastern-wear',
    name: 'Eastern Wear & Lawn',
    slug: 'eastern-wear',
    description: 'Designer lawn suits, embroidered kurtas, and traditional wear',
    imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80',
    order: 1,
  },
  {
    id: 'footwear',
    name: 'Handcrafted Footwear',
    slug: 'footwear',
    description: 'Authentic Charsadda and Kaptaan Peshawari chappals & Khussa',
    imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80',
    order: 2,
  },
  {
    id: 'leather-goods',
    name: 'Pure Leather Goods',
    slug: 'leather-goods',
    description: 'Export quality Sialkot genuine leather jackets, wallets, and belts',
    imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80',
    order: 3,
  },
  {
    id: 'electronics',
    name: 'Tech & Audio',
    slug: 'electronics',
    description: 'Smart watches, wireless ANC earbuds, power banks & mobile accessories',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    order: 4,
  },
  {
    id: 'fragrances',
    name: 'Royal Fragrances & Oud',
    slug: 'fragrances',
    description: 'Long-lasting oriental attars, Arabian Oud, and French EDP sprays',
    imageUrl: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80',
    order: 5,
  },
  {
    id: 'home-organic',
    name: 'Organic & Dry Fruits',
    slug: 'home-organic',
    description: 'Premium Gilgit Hunza walnuts, pine nuts (chilgoza), and pure honey',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop&q=80',
    order: 6,
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-lawn-01',
    title: 'Emerald Luxury Embroidered 3-Piece Lawn Suit',
    slug: 'emerald-luxury-embroidered-3-piece-lawn-suit',
    description: 'Exquisite summer digital printed lawn shirt with delicate organza neckline embroidery, paired with a dyed cambric trouser and digital printed pure chiffon dupatta. Breathable, colorfast premium cotton lawn suited for festive Pakistani weather.',
    regularPrice: 6499,
    salePrice: 4899,
    stock: 24,
    category: 'eastern-wear',
    brand: 'Khaadi Inspired',
    images: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
    ],
    sku: 'LAWN-EMR-001',
    variants: [
      { name: 'Size', options: ['Unstitched', 'Small', 'Medium', 'Large'] },
      { name: 'Color', options: ['Emerald Green', 'Royal Navy', 'Ruby Maroon'] },
    ],
    isFeatured: true,
    isPublished: true,
    rating: 4.8,
    reviewCount: 38,
    specifications: {
      Fabric: '100% Premium Combed Cotton Lawn',
      Dupatta: 'Pure Printed Bemberg Chiffon (2.5m)',
      Trouser: 'Dyed Cambric Cotton (2.5m)',
      Origin: 'Faisalabad, Pakistan',
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-peshawari-01',
    title: 'Handmade Charsadda Double Sole Peshawari Chappal',
    slug: 'handmade-charsadda-double-sole-peshawari-chappal',
    description: 'Original artisan-crafted pure cowhide leather Peshawari chappal featuring genuine tyre rubber double sole for maximum durability and traditional comfort. Crafted by master craftsmen in Charsadda, Khyber Pakhtunkhwa.',
    regularPrice: 4200,
    salePrice: 3450,
    stock: 18,
    category: 'footwear',
    brand: 'Charsadda Crafts',
    images: [
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800&auto=format&fit=crop&q=80',
    ],
    sku: 'CHAP-CHR-002',
    variants: [
      { name: 'Size', options: ['7 (40)', '8 (41)', '9 (42)', '10 (43)', '11 (44)'] },
      { name: 'Color', options: ['Mustard Brown', 'Jet Black', 'Burgundy Wine'] },
    ],
    isFeatured: true,
    isPublished: true,
    rating: 4.9,
    reviewCount: 64,
    specifications: {
      Material: '100% Top-Grain Cowhide Leather',
      Sole: 'Recycled Aircraft Tyre Rubber with Steel Arch support',
      Stitching: 'Heavy Duty Waxed Nylon Thread',
      Warranty: '1 Year Sole Guarantee',
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-leather-01',
    title: 'Sialkot Master Artisan Biker Leather Jacket',
    slug: 'sialkot-master-artisan-biker-leather-jacket',
    description: 'Export-grade vintage finished sheepskin leather biker jacket made in Sialkot, the world capital of sports and leather craft. Features heavy duty YKK brass zippers, quilted thermal polyester lining, and 4 functional zipper pockets.',
    regularPrice: 16500,
    salePrice: 12999,
    stock: 9,
    category: 'leather-goods',
    brand: 'Sialkot Tannery Co',
    images: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?w=800&auto=format&fit=crop&q=80',
    ],
    sku: 'LTH-JKT-003',
    variants: [
      { name: 'Size', options: ['M (Chest 40")', 'L (Chest 42")', 'XL (Chest 44")', 'XXL (Chest 46")'] },
      { name: 'Color', options: ['Vintage Distressed Brown', 'Carbon Black'] },
    ],
    isFeatured: true,
    isPublished: true,
    rating: 4.9,
    reviewCount: 22,
    specifications: {
      Leather: 'Full Grain Drum-Dyed Sheepskin (0.9mm)',
      Zippers: 'Genuine YKK Antique Brass',
      Lining: 'Quilted Diamond Satin Thermal Lining',
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-watch-01',
    title: 'AeroPro AMOLED Bluetooth Calling Smartwatch with Urdu Support',
    slug: 'aeropro-amoled-bluetooth-calling-smartwatch',
    description: '1.43-inch HD Ultra AMOLED screen with Always-On display, crisp speakerphone Bluetooth calling, heart rate & SpO2 biometric sensors, IP68 water resistance, and 7-day battery life. Full notification support for WhatsApp, SMS, and Calls in Urdu & English.',
    regularPrice: 6999,
    salePrice: 4799,
    stock: 35,
    category: 'electronics',
    brand: 'TechPak',
    images: [
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
    ],
    sku: 'ELEC-WTC-004',
    variants: [
      { name: 'Color', options: ['Midnight Black', 'Metallic Silver', 'Rose Gold'] },
      { name: 'Strap', options: ['Silicone Sports', 'Magnetic Milanese Loop'] },
    ],
    isFeatured: true,
    isPublished: true,
    rating: 4.7,
    reviewCount: 89,
    specifications: {
      Display: '1.43" HD AMOLED (466x466 px, 600 nits)',
      Battery: '380mAh (7 Days standby, 3 days calling)',
      Compatibility: 'Android 6.0+ / iOS 10.0+',
      Warranty: '1 Year Local Pakistan Brand Warranty',
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-frag-01',
    title: 'Royal Dehn Al Oud & Taif Rose Concentrated Perfume (100ml)',
    slug: 'royal-dehn-al-oud-taif-rose-concentrated-perfume',
    description: 'A regal blend of aged Cambodian Oud, rare Taif mountain roses, warm Kashmiri saffron, and creamy Mysore sandalwood. Ultra-potent Extrait de Parfum projection engineered to stay noticeable for 18+ hours in hot and humid Pakistani conditions.',
    regularPrice: 7500,
    salePrice: 5499,
    stock: 15,
    category: 'fragrances',
    brand: 'Al-Haramain Scents',
    images: [
      'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=800&auto=format&fit=crop&q=80',
    ],
    sku: 'PERF-OUD-005',
    variants: [
      { name: 'Size', options: ['50ml Spray', '100ml Luxury Flacon', '12ml Attar Oil'] },
    ],
    isFeatured: true,
    isPublished: true,
    rating: 5.0,
    reviewCount: 47,
    specifications: {
      Concentration: 'Extrait de Parfum (35% Oil Concentration)',
      Sillage: 'Enormous 6-8 feet projection',
      Longevity: '18+ Hours guaranteed',
      Alcohol: '100% Halal Certified Organic Grain Alcohol',
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-hunza-01',
    title: 'Hunza Valley Organic Roasted Chilgoza & Roasted Walnuts (500g)',
    slug: 'hunza-valley-organic-roasted-chilgoza-roasted-walnuts',
    description: 'Hand-picked from the pristine high-altitude mountains of Hunza and Skardu, Gilgit-Baltistan. Lightly salted in natural Himalayan rock salt. Rich in Omega-3 fatty acids, healthy fats, and crisp buttery freshness guaranteed in airtight nitrogen packaging.',
    regularPrice: 4800,
    salePrice: 3850,
    stock: 40,
    category: 'home-organic',
    brand: 'Northern Dry Fruits',
    images: [
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=800&auto=format&fit=crop&q=80',
    ],
    sku: 'DRY-HNZ-006',
    variants: [
      { name: 'Weight', options: ['250 Grams', '500 Grams Pack', '1 KG Gift Box'] },
    ],
    isFeatured: false,
    isPublished: true,
    rating: 4.9,
    reviewCount: 31,
    specifications: {
      Origin: 'Hunza & Skardu, Gilgit-Baltistan',
      Packaging: 'Food-Grade Zip-lock Nitrogen Pouch',
      ShelfLife: '12 Months',
      Preservatives: 'Zero Chemical Additives',
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-kurta-02',
    title: 'Men Festive Raw Silk Embroidered Kurta Pajama Set',
    slug: 'men-festive-raw-silk-embroidered-kurta-pajama-set',
    description: 'Premium textured raw silk blend kurta adorned with intricate tonal zari thread handwork on ban collar and placket. Includes matching white cotton silk pajama. Ideal for Eid, weddings, and Friday prayers.',
    regularPrice: 5500,
    salePrice: 4200,
    stock: 14,
    category: 'eastern-wear',
    brand: 'Junaid & Co',
    images: [
      'https://images.unsplash.com/photo-1621786030484-4c8f0700d2eb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
    ],
    sku: 'KURT-MSL-007',
    variants: [
      { name: 'Size', options: ['Small (38)', 'Medium (40)', 'Large (42)', 'XL (44)'] },
      { name: 'Color', options: ['Oatmeal Cream', 'Steel Slate Grey', 'Navy Blue', 'Forest Olive'] },
    ],
    isFeatured: true,
    isPublished: true,
    rating: 4.8,
    reviewCount: 19,
    specifications: {
      Fabric: 'Blended Raw Silk with Luster Finish',
      Collar: 'Structured Mandarin Ban with Concealed Buttons',
      Pockets: 'Two Deep Side Pockets',
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-audio-02',
    title: 'BassX Wireless ANC Earbuds with 40H Playtime & Low Latency',
    slug: 'bassx-wireless-anc-earbuds-40h-playtime',
    description: 'Active Noise Cancellation (-35dB), Quad-Mic ENC for crystal clear phone calls even on busy Pakistani streets and motorbikes, deep 12mm titanium drivers, fast Type-C charging, and touch controls.',
    regularPrice: 4999,
    salePrice: 3299,
    stock: 28,
    category: 'electronics',
    brand: 'TechPak',
    images: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    ],
    sku: 'ELEC-EAR-008',
    variants: [
      { name: 'Color', options: ['Matte Black', 'Glacier White', 'Cobalt Blue'] },
    ],
    isFeatured: false,
    isPublished: true,
    rating: 4.6,
    reviewCount: 52,
    specifications: {
      Bluetooth: 'Version 5.3 (15m range)',
      ANC: 'Up to -35dB hybrid cancellation',
      Battery: '8h buds + 32h case (Total 40 Hours)',
      Charging: 'Type-C Fast Charge (10m charge = 2h playback)',
    },
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_BANNERS: Banner[] = [
  {
    id: 'banner-1',
    title: 'Grand Festive Lawn & Heritage Collection',
    subtitle: 'Flat 25% Off on All New Season Arrivals. Authentic Pakistani Craftsmanship delivered to your doorstep.',
    link: '/shop?category=eastern-wear',
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1600&auto=format&fit=crop&q=80',
    buttonText: 'Shop Lawn Collection',
    isActive: true,
    order: 1,
  },
  {
    id: 'banner-2',
    title: 'Authentic Charsadda & Kaptaan Chappals',
    subtitle: 'Pure Top-Grain Leather with Double Tyre Soles. Experience centuries of Peshawar shoemaking mastery.',
    link: '/shop?category=footwear',
    imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=1600&auto=format&fit=crop&q=80',
    buttonText: 'Explore Footwear',
    isActive: true,
    order: 2,
  },
  {
    id: 'banner-3',
    title: 'Export Quality Sialkot Leather Goods',
    subtitle: 'Rugged biker jackets, handcrafted wallets, and executive accessories at direct workshop prices.',
    link: '/shop?category=leather-goods',
    imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=1600&auto=format&fit=crop&q=80',
    buttonText: 'Discover Leather',
    isActive: true,
    order: 3,
  },
];

export const INITIAL_COUPONS: Coupon[] = [
  {
    id: 'coupon-pakistan',
    code: 'AZADI10',
    discountType: 'percentage',
    discountValue: 10,
    minOrderValue: 2500,
    expiryDate: '2027-12-31',
    usageLimit: 1000,
    usageCount: 42,
    isActive: true,
  },
  {
    id: 'coupon-first',
    code: 'WELCOME500',
    discountType: 'fixed',
    discountValue: 500,
    minOrderValue: 4000,
    expiryDate: '2027-12-31',
    usageLimit: 500,
    usageCount: 18,
    isActive: true,
  },
];

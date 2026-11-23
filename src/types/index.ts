export type UserRole =
  | 'customer'
  | 'shop_owner'
  | 'shop_admin'
  | 'shop_staff'
  | 'admin'
  | 'super_admin'
  | 'salesman'
  | 'sales_manager'
  | 'referral_agent';

export * from './sales';

export type StaffRole = 'shop_owner' | 'shop_admin' | 'shop_staff';

export type BusinessType = 'general_store' | 'cosmetics' | 'clothing' | 'other_retail';

export type StaffPermission =
  | 'overview'
  | 'pos'
  | 'products'
  | 'categories'
  | 'orders'
  | 'customers'
  | 'khata'
  | 'inventory'
  | 'purchases'
  | 'suppliers'
  | 'coupons'
  | 'banners'
  | 'appearance'
  | 'settings'
  | 'staff'
  | 'reports'
  | 'subscription';

export interface UserAddress {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  postalCode?: string;
  isDefault?: boolean;
}

export interface ShopMembership {
  shopId: string;
  shopName: string;
  shopSlug: string;
  role: StaffRole;
  permissions?: StaffPermission[];
  joinedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  photoURL?: string;
  role: UserRole;
  isBlocked?: boolean;
  addresses: UserAddress[];
  createdAt: string;
  updatedAt?: string;
}

export type ShopStatus = 'active' | 'inactive' | 'suspended';
export type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'cancelled';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanFeatures {
  customBranding: boolean;
  coupons: boolean;
  banners: boolean;
  analytics: boolean;
  selfPickup: boolean;
  buyingGuide: boolean;
  staffAccounts: boolean;
  customPages: boolean;
  pos: boolean;
  barcode: boolean;
  suppliersPurchases: boolean;
  khata: boolean;
  advancedInventory: boolean;
  advancedReports: boolean;
  prioritySupport?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  durationDays: number;
  maxProducts: number; // -1 means unlimited active products
  maxStorageMB: number;
  maxStaff: number;
  features: PlanFeatures;
  isActive: boolean;
  isPopular?: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShopSubscription {
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  pricePaid: number;
  startDate: string;
  expiryDate: string;
  autoRenew?: boolean;
  isFreeOverride?: boolean;
}

export interface ShopUsage {
  productsCount: number;
  ordersCount: number;
  storageBytes: number;
  staffCount: number;
}

export interface ShopTheme {
  primaryColor: string;
  accentColor: string;
  heroTitle?: string;
  heroSubtitle?: string;
  showTestimonials?: boolean;
  showBuyingGuide?: boolean;
}

export interface Shop {
  id: string;
  slug: string;
  name: string;
  businessType?: BusinessType;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  city: string;
  address: string;
  logoUrl?: string;
  status: ShopStatus;
  subscription: ShopSubscription;
  usage: ShopUsage;
  theme?: ShopTheme;
  adminNotes?: string;
  onboardingChecklist?: Record<string, boolean>;
  defaultBranchId?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ShopPublic {
  id: string;
  slug: string;
  name: string;
  businessType?: BusinessType;
  logoUrl?: string;
  city?: string;
  publicContactPhone?: string;
  publicSupportEmail?: string;
  storefrontAddress?: string;
  businessHours?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImageUrl?: string;
  websiteUrl?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    whatsapp?: string;
    tiktok?: string;
    youtube?: string;
    linkedin?: string;
  };
  status: ShopStatus;
  theme?: ShopTheme;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShopSlugRecord {
  slug: string;
  shopId: string;
  ownerId: string;
  name: string;
  createdAt: string;
}

export interface StaffMember {
  uid: string;
  email: string;
  name: string;
  role: StaffRole;
  permissions: StaffPermission[];
  status: 'active' | 'invited' | 'inactive';
  inviteId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ShopInvite {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  email: string;
  name: string;
  role: 'shop_admin' | 'shop_staff';
  permissions: StaffPermission[];
  invitedBy: string;
  status: 'pending' | 'accepted';
  createdAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
}

export interface PlatformPayment {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  ownerId: string;
  ownerEmail: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  amount: number;
  method: 'easypaisa' | 'jazzcash' | 'bank_transfer';
  transactionId: string;
  senderNumber: string;
  proofUrl: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface PlatformSettings {
  platformName: string;
  tagline: string;
  logoUrl?: string;
  websiteUrl?: string;
  announcement?: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImageUrl?: string;
  canonicalDomain?: string;
  currency?: string;
  currencySymbol?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    linkedin?: string;
    whatsapp?: string;
  };
  easypaisaDetails: MobileWalletDetails;
  jazzcashDetails: MobileWalletDetails;
  bankDetails: {
    enabled?: boolean;
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban: string;
  };
  gracePeriodDays?: number;
  privacyPolicyContent?: string;
  termsContent?: string;
  legalUpdatedAt?: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType:
    | 'shop'
    | 'plan'
    | 'payment'
    | 'product'
    | 'order'
    | 'pos'
    | 'purchase'
    | 'supplier'
    | 'khata'
    | 'expense'
    | 'staff'
    | 'settings'
    | 'ticket'
    | 'migration';
  targetId: string;
  details: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'subscription' | 'system';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface ShopPageContent {
  key: 'about' | 'faq' | 'return-policy' | 'terms' | 'privacy';
  title: string;
  content: string;
  imageUrl?: string;
  updatedAt: string;
}

export interface ShopCustomerSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  city: string;
  ordersCount: number;
  totalSpent: number;
  outstandingBalance?: number;
  notes?: string;
  lastOrderAt: string;
  createdAt: string;
}

export interface ProductVariant {
  name: string;
  options: string[];
  sku?: string;
  stock?: number;
}

export type ProductUnit =
  | 'Piece'
  | 'KG'
  | 'Gram'
  | 'Litre'
  | 'Millilitre'
  | 'Packet'
  | 'Carton'
  | 'Box'
  | 'Dozen'
  | 'Set';

export interface Product {
  id: string;
  shopId?: string;
  branchId?: string;
  title: string;
  slug: string;
  description: string;
  purchasePrice?: number;
  regularPrice: number;
  salePrice?: number;
  stock: number;
  minStockAlert?: number;
  unit?: ProductUnit | string;
  category: string;
  brand: string;
  images: string[];
  sku: string;
  barcode?: string;
  variants?: ProductVariant[];
  // Business-type-specific optional attributes
  shade?: string;
  variantSize?: string;
  skinHairCategory?: string;
  color?: string;
  designRef?: string;
  status?: 'active' | 'archived';
  isFeatured: boolean;
  isPublished: boolean;
  rating: number;
  reviewCount: number;
  specifications?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  shopId?: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  order: number;
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  selectedVariants?: Record<string, string>;
  itemKey: string;
}

export type PaymentMethod = 'cod' | 'bank_transfer' | 'easypaisa' | 'jazzcash' | 'online';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type FulfillmentMethod = 'delivery' | 'self_pickup';
export type PickupStatus =
  | 'New Pickup Order'
  | 'Preparing'
  | 'Ready for Pickup'
  | 'Picked Up'
  | 'Cancelled';
export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Accepted'
  | 'Preparing'
  | 'Ready for Pickup'
  | 'Collected'
  | 'Completed'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Returned'
  | 'Refunded';

export interface PickupSlotConfig {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  maxOrdersPerSlot: number;
  isActive: boolean;
}

export interface PickupSlotAvailability extends PickupSlotConfig {
  date: string;
  slotKey: string;
  bookedCount: number;
  remaining: number;
  isFull: boolean;
}

export interface PickupHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
  actor?: string;
}

export interface OrderCustomerNotification {
  id: string;
  title: string;
  message: string;
  status: OrderStatus;
  createdAt: string;
  channel?: 'in_app' | 'system';
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  selectedVariants?: Record<string, string>;
}

export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
}

export interface OrderPickupDetails {
  locationName: string;
  address: string;
  city: string;
  timings: string;
  contactPhone: string;
  mapUrl?: string;
  preparationTime?: string;
  pickupDate?: string;
  pickupSlotId?: string;
  pickupSlotLabel?: string;
  preferredTime?: string;
  instructions?: string;
}

export interface Order {
  id: string;
  shopId?: string;
  orderNumber: string;
  trackingToken?: string;
  trackingTokenHash?: string;
  userId: string;
  customer: CustomerDetails;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  couponCode?: string;
  fulfillmentMethod?: FulfillmentMethod;
  pickupStatus?: PickupStatus;
  pickupShopId?: string;
  pickupAddress?: string;
  pickupDate?: string;
  pickupTimeSlot?: string;
  pickupInstructions?: string;
  pickupDetails?: OrderPickupDetails;
  pickupOtp?: string;
  pickupOtpHash?: string;
  pickupVerifiedAt?: string;
  pickupVerifiedBy?: string;
  pickupSlotKey?: string;
  stockDeducted?: boolean;
  pickupHistory?: PickupHistoryEntry[];
  customerNotifications?: OrderCustomerNotification[];
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  trackingNumber?: string;
  courierName?: string;
  notes?: string;
  bankSlipReference?: string;
  paymentReference?: string;
  senderAccountNumber?: string;
  paymentProofImage?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderTrackingPublic {
  orderNumber: string;
  orderId: string;
  shopId?: string;
  trackingTokenHash?: string;
  orderStatus: OrderStatus;
  fulfillmentMethod?: FulfillmentMethod;
  pickupDetails?: OrderPickupDetails;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  courierName?: string;
  trackingNumber?: string;
  customerName: string;
  city: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Coupon {
  id: string;
  shopId?: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue: number;
  expiryDate?: string;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
}

export interface Review {
  id: string;
  shopId?: string;
  productId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface MobileWalletDetails {
  enabled: boolean;
  accountTitle: string;
  accountNumber: string;
  instructions?: string;
}

export interface SelfPickupSettings {
  enabled: boolean;
  title: string;
  address: string;
  city: string;
  timings: string;
  contactPhone: string;
  mapUrl?: string;
  preparationTime?: string;
  requireAdvancePayment?: boolean;
  cashOnPickupEnabled?: boolean;
  latitude?: number;
  longitude?: number;
  advanceDays?: number;
  pickupSlots?: PickupSlotConfig[];
  instructions?: string;
}

export interface StoreSettings {
  siteName: string;
  logoUrl?: string;
  websiteUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  announcement: string;
  contactPhone: string;
  whatsappNumber: string;
  contactEmail: string;
  address: string;
  city?: string;
  shippingFee: number;
  freeShippingThreshold: number;
  currency: string;
  currencySymbol: string;
  aboutUs?: string;
  businessHours?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImageUrl?: string;
  codEnabled?: boolean;
  bankDetails: {
    enabled?: boolean;
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban: string;
  };
  easypaisaDetails: MobileWalletDetails;
  jazzcashDetails: MobileWalletDetails;
  selfPickupDetails: SelfPickupSettings;
  socialLinks: {
    facebook?: string;
    instagram?: string;
    whatsapp?: string;
    tiktok?: string;
    youtube?: string;
    linkedin?: string;
  };
}

export interface NewsletterSubscriber {
  id: string;
  shopId: string;
  email: string;
  source?: string;
  createdAt: string;
}

export interface Banner {
  id: string;
  shopId?: string;
  title: string;
  subtitle: string;
  link: string;
  imageUrl: string;
  buttonText?: string;
  isActive: boolean;
  order: number;
}

export interface InventoryLog {
  id: string;
  shopId?: string;
  productId: string;
  productTitle: string;
  changeQuantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  updatedBy: string;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  shopId?: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status: 'new' | 'resolved';
  createdAt: string;
}

export interface MigrationResult {
  success: boolean;
  shopId: string;
  shopSlug: string;
  migratedCounts: {
    products: number;
    categories: number;
    banners: number;
    coupons: number;
    orders: number;
    orderTracking: number;
    reviews: number;
    inventoryLogs: number;
    contactMessages: number;
    settings: number;
  };
  skippedRecords: Record<string, number>;
  failedRecords: { collection: string; id: string; error: string }[];
  verifiedCounts: Record<string, { expectedMin: number; actual: number; matched: boolean }>;
  skippedCollections: string[];
  errors: string[];
  backupJson: string;
  timestamp: string;
}

// ====================================================
// STAGE 1 RETAIL SaaS MODULES: POS, SUPPLIERS, PURCHASES, KHATA, EXPENSES & SUPPORT
// ====================================================

export type StockMovementType =
  | 'stock_in'
  | 'stock_out'
  | 'opening'
  | 'damaged'
  | 'wastage'
  | 'adjustment'
  | 'pos_sale'
  | 'purchase'
  | 'online_order'
  | 'return';

export interface StockMovement {
  id: string;
  shopId: string;
  branchId?: string;
  productId: string;
  productTitle: string;
  type: StockMovementType;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  userId: string;
  userEmail?: string;
  referenceTransaction?: string;
  timestamp: string;
}

export interface Supplier {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  openingBalance: number;
  currentPayableBalance: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PurchaseItemLine {
  productId: string;
  productTitle: string;
  sku?: string;
  quantity: number;
  purchasePrice: number;
  lineTotal: number;
}

export interface PurchaseInvoice {
  id: string;
  shopId: string;
  branchId?: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  purchaseDate: string;
  items: PurchaseItemLine[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  remainingPayable: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export type PosPaymentMethod = 'cash' | 'bank_transfer' | 'qr_payment' | 'khata_credit' | 'split';

export interface PosSaleItem {
  productId: string;
  title: string;
  sku?: string;
  barcode?: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface PosSale {
  id: string;
  shopId: string;
  branchId?: string;
  invoiceNumber: string;
  idempotencyKey: string;
  items: PosSaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PosPaymentMethod;
  cashPaid?: number;
  digitalPaid?: number;
  creditAmount?: number;
  paymentReference?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  cashierId: string;
  cashierName: string;
  status: 'completed' | 'returned' | 'exchanged';
  receiptFormat?: '58mm' | '80mm';
  createdAt: string;
  updatedAt?: string;
}

export interface KhataEntry {
  id: string;
  shopId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  type: 'credit_sale' | 'payment' | 'adjustment';
  amount: number;
  previousBalance: number;
  newBalance: number;
  reference?: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface ShopExpense {
  id: string;
  shopId: string;
  branchId?: string;
  title: string;
  category: 'rent' | 'utilities' | 'salaries' | 'packaging' | 'transport' | 'marketing' | 'other';
  amount: number;
  date: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  shopId?: string;
  shopName?: string;
  userId: string;
  userEmail: string;
  subject: string;
  category: 'billing' | 'technical' | 'onboarding' | 'feature' | 'other';
  priority: 'low' | 'medium' | 'high';
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  adminReply?: string;
  createdAt: string;
  updatedAt?: string;
}

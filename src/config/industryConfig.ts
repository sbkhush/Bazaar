import {
  BusinessType,
  IndustryGroup,
  PlanFeatures,
  StaffPermission,
  StaffRole,
} from '../types';

export interface IndustryMetadata {
  id: BusinessType;
  label: string;
  shortLabel: string;
  group: IndustryGroup;
  publicPrefix: '/s' | '/gym' | '/clinic' | '/carwash' | '/dealer';
  description: string;
  recordNoun: string;
  recordPluralNoun: string;
  isServiceIndustry: boolean;
}

export const ALL_INDUSTRY_META: IndustryMetadata[] = [
  {
    id: 'general_store',
    label: 'General Store / Kiryana',
    shortLabel: 'Kiryana & Grocery',
    group: 'retail',
    publicPrefix: '/s',
    description: 'Groceries, staples, beverages, household items with Piece/KG/Litre units, POS & Khata.',
    recordNoun: 'Product',
    recordPluralNoun: 'Products',
    isServiceIndustry: false,
  },
  {
    id: 'clothing',
    label: 'Clothing & Fashion',
    shortLabel: 'Clothing & Fashion',
    group: 'retail',
    publicPrefix: '/s',
    description: 'Eastern wear, stitched & unstitched suits, footwear, sizes, colors & style variants.',
    recordNoun: 'Product',
    recordPluralNoun: 'Products',
    isServiceIndustry: false,
  },
  {
    id: 'cosmetics',
    label: 'Cosmetics & Beauty Products',
    shortLabel: 'Cosmetics & Beauty',
    group: 'retail',
    publicPrefix: '/s',
    description: 'Skincare, makeup shades, fragrances, hair care & beauty essentials.',
    recordNoun: 'Product',
    recordPluralNoun: 'Products',
    isServiceIndustry: false,
  },
  {
    id: 'electronics',
    label: 'Electronics & Accessories',
    shortLabel: 'Electronics',
    group: 'retail',
    publicPrefix: '/s',
    description: 'Mobiles, laptops, chargers, gadgets, warranty tracking & retail billing.',
    recordNoun: 'Product',
    recordPluralNoun: 'Products',
    isServiceIndustry: false,
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    shortLabel: 'Pharmacy',
    group: 'retail',
    publicPrefix: '/s',
    description: 'Medicines, wellness items, health supplies, batch/expiry stock & counter POS.',
    recordNoun: 'Product',
    recordPluralNoun: 'Products',
    isServiceIndustry: false,
  },
  {
    id: 'gym',
    label: 'Gym & Fitness Center',
    shortLabel: 'Gym & Fitness',
    group: 'gym',
    publicPrefix: '/gym',
    description: 'Member profiles, membership plans, renewals/freeze, QR check-in, trainers & fee collection.',
    recordNoun: 'Member',
    recordPluralNoun: 'Members',
    isServiceIndustry: true,
  },
  {
    id: 'clinic',
    label: 'Clinic & Medical Center',
    shortLabel: 'Clinic & Medical',
    group: 'clinic',
    publicPrefix: '/clinic',
    description: 'Privacy-first patient profiles, doctor schedules, appointments, administrative visit notes & fee billing.',
    recordNoun: 'Patient / Appointment',
    recordPluralNoun: 'Records',
    isServiceIndustry: true,
  },
  {
    id: 'carwash',
    label: 'Car Wash & Detailing',
    shortLabel: 'Car Wash & Detailing',
    group: 'carwash',
    publicPrefix: '/carwash',
    description: 'Vehicle registration, wash packages, live service queue & job cards, staff assignment & billing.',
    recordNoun: 'Job / Vehicle',
    recordPluralNoun: 'Jobs & Vehicles',
    isServiceIndustry: true,
  },
  {
    id: 'car_dealer',
    label: 'Car Dealer / Used Cars',
    shortLabel: 'Car Showroom',
    group: 'car_dealer',
    publicPrefix: '/dealer',
    description: 'Showroom inventory, private purchase cost & profit tracking, test drives, leads & commission deals.',
    recordNoun: 'Vehicle',
    recordPluralNoun: 'Vehicles',
    isServiceIndustry: true,
  },
  {
    id: 'other_retail',
    label: 'Other Business',
    shortLabel: 'General Retail',
    group: 'retail',
    publicPrefix: '/s',
    description: 'Flexible multi-category Pakistani retail storefront, online orders & POS billing.',
    recordNoun: 'Product',
    recordPluralNoun: 'Products',
    isServiceIndustry: false,
  },
];

const INDUSTRY_MAP: Record<BusinessType, IndustryMetadata> = ALL_INDUSTRY_META.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<BusinessType, IndustryMetadata>
);

export function isKnownBusinessType(val?: string | null): val is BusinessType {
  return Boolean(val && val in INDUSTRY_MAP);
}

export function getIndustryMeta(businessType?: BusinessType | string | null): IndustryMetadata {
  if (businessType && businessType in INDUSTRY_MAP) {
    return INDUSTRY_MAP[businessType as BusinessType];
  }
  return INDUSTRY_MAP.general_store;
}

export function getIndustryGroup(businessType?: BusinessType | string | null): IndustryGroup {
  return getIndustryMeta(businessType).group;
}

export function getIndustryPublicPrefix(
  businessType?: BusinessType | string | null
): '/s' | '/gym' | '/clinic' | '/carwash' | '/dealer' {
  return getIndustryMeta(businessType).publicPrefix;
}

export function buildIndustryPublicPath(
  shopSlug: string,
  businessType?: BusinessType | string | null,
  subpath = ''
): string {
  const cleanSlug = (shopSlug || '').trim().toLowerCase() || 'store';
  const prefix = getIndustryPublicPrefix(businessType);
  const cleanSub = subpath ? (subpath.startsWith('/') ? subpath : `/${subpath}`) : '';
  return `${prefix}/${cleanSlug}${cleanSub}`;
}

export function getRequiredPlanFeatureForIndustry(
  businessType?: BusinessType | string | null
): keyof PlanFeatures | null {
  switch (getIndustryGroup(businessType)) {
    case 'gym':
      return 'gymModule';
    case 'clinic':
      return 'clinicModule';
    case 'carwash':
      return 'carwashModule';
    case 'car_dealer':
      return 'dealerModule';
    default:
      return null;
  }
}

export function getRoleOptionsForIndustry(
  businessType?: BusinessType | string | null
): { value: Exclude<StaffRole, 'shop_owner'>; label: string; description: string }[] {
  const group = getIndustryGroup(businessType);
  const base: { value: Exclude<StaffRole, 'shop_owner'>; label: string; description: string }[] = [
    { value: 'shop_admin', label: 'Admin', description: 'Full management access across modules & staff' },
    { value: 'manager', label: 'Manager', description: 'Operational supervisor for daily records & payments' },
    { value: 'shop_staff', label: 'Front Desk / Staff', description: 'Assigned day-to-day module permissions' },
  ];
  if (group === 'gym') {
    base.splice(2, 0, {
      value: 'trainer',
      label: 'Trainer / Coach',
      description: 'Manages members, attendance & workout plans',
    });
  } else if (group === 'clinic') {
    base.splice(2, 0, {
      value: 'doctor',
      label: 'Doctor / Practitioner',
      description: 'Appointments, patient profiles & audit-logged visit notes',
    });
  } else if (group === 'car_dealer') {
    base.splice(2, 0, {
      value: 'salesperson',
      label: 'Showroom Salesperson',
      description: 'Handles inquiries, test drives, leads & vehicle deals',
    });
  }
  return base;
}

export function getPermissionsForIndustry(
  businessType?: BusinessType | string | null
): { key: StaffPermission; label: string }[] {
  const group = getIndustryGroup(businessType);

  const sharedTail: { key: StaffPermission; label: string }[] = [
    { key: 'marketing_qr', label: 'QR Marketing & Posters' },
    { key: 'appearance', label: 'Public Page Appearance' },
    { key: 'settings', label: 'Payments, Hours & Settings' },
    { key: 'staff', label: 'Staff & Roles' },
    { key: 'reports', label: 'Reports & Revenue' },
    { key: 'subscription', label: 'Subscription & Billing' },
  ];

  if (group === 'gym') {
    return [
      { key: 'overview', label: 'Gym Overview' },
      { key: 'gym_members', label: 'Members & Membership Plans' },
      { key: 'gym_attendance', label: 'Daily Attendance & QR Check-in' },
      { key: 'gym_trainers', label: 'Trainers & Workout Plans' },
      { key: 'payments_record', label: 'Fee Collection & Pending Payments' },
      ...sharedTail,
    ];
  }

  if (group === 'clinic') {
    return [
      { key: 'overview', label: 'Clinic Overview' },
      { key: 'clinic_appointments', label: 'Appointments & Waiting List' },
      { key: 'clinic_patients', label: 'Patients & Visit History (Audit-Logged)' },
      { key: 'clinic_notes', label: 'Medical Notes & Prescriptions (Restricted)' },
      { key: 'clinic_doctors', label: 'Doctors & Schedules' },
      { key: 'payments_record', label: 'Consultation Fees & Pending Dues' },
      ...sharedTail,
    ];
  }

  if (group === 'carwash') {
    return [
      { key: 'overview', label: 'Car Wash Overview' },
      { key: 'carwash_queue', label: 'Service Queue & Job Cards' },
      { key: 'carwash_vehicles', label: 'Customers & Vehicles' },
      { key: 'carwash_packages', label: 'Wash & Detailing Packages' },
      { key: 'payments_record', label: 'Payments & Pending Bills' },
      ...sharedTail,
    ];
  }

  if (group === 'car_dealer') {
    return [
      { key: 'overview', label: 'Showroom Overview' },
      { key: 'dealer_vehicles', label: 'Vehicle Inventory & Catalog' },
      { key: 'dealer_private_pricing', label: 'Private Purchase Cost & Profit Margin' },
      { key: 'dealer_leads', label: 'Inquiries, Test Drives & Leads' },
      { key: 'dealer_deals', label: 'Deals, Commissions & Sales Record' },
      { key: 'payments_record', label: 'Booking & Delivery Payments' },
      ...sharedTail,
    ];
  }

  return [
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
    { key: 'marketing_qr', label: 'Shop QR & Marketing' },
    { key: 'appearance', label: 'Storefront Appearance & SEO' },
    { key: 'settings', label: 'Payment, Delivery & Self-Pickup' },
    { key: 'staff', label: 'Staff Management' },
    { key: 'reports', label: 'Reports, Expenses & Profit' },
    { key: 'subscription', label: 'Subscription & Billing' },
  ];
}

export type NavIconKey =
  | 'overview'
  | 'pos'
  | 'products'
  | 'categories'
  | 'orders'
  | 'purchases'
  | 'suppliers'
  | 'customers'
  | 'khata'
  | 'inventory'
  | 'coupons'
  | 'banners'
  | 'marketing'
  | 'appearance'
  | 'settings'
  | 'staff'
  | 'reports'
  | 'subscription'
  | 'profile'
  | 'members'
  | 'attendance'
  | 'trainers'
  | 'appointments'
  | 'patients'
  | 'doctors'
  | 'queue'
  | 'vehicles'
  | 'packages'
  | 'deals'
  | 'payments';

export interface IndustryNavItem {
  to: string;
  label: string;
  iconKey: NavIconKey;
  perm: StaffPermission;
  feature?: keyof PlanFeatures;
  end?: boolean;
}

export function getSidebarNavForIndustry(
  businessType?: BusinessType | string | null
): IndustryNavItem[] {
  const group = getIndustryGroup(businessType);

  if (group === 'gym') {
    return [
      { to: '/dashboard', label: 'Gym Overview', iconKey: 'overview', perm: 'overview', end: true },
      { to: '/dashboard/gym/members', label: 'Members & Plans', iconKey: 'members', perm: 'gym_members' },
      { to: '/dashboard/gym/attendance', label: 'Attendance & QR', iconKey: 'attendance', perm: 'gym_attendance' },
      { to: '/dashboard/gym/trainers', label: 'Trainers & Workouts', iconKey: 'trainers', perm: 'gym_trainers' },
      { to: '/dashboard/payments', label: 'Fee Collection', iconKey: 'payments', perm: 'payments_record' },
      { to: '/dashboard/marketing', label: 'Gym QR & Marketing', iconKey: 'marketing', perm: 'overview' },
      { to: '/dashboard/appearance', label: 'Public Page Setup', iconKey: 'appearance', perm: 'appearance' },
      { to: '/dashboard/settings', label: 'Payments & Hours', iconKey: 'settings', perm: 'settings' },
      { to: '/dashboard/staff', label: 'Staff & Trainers', iconKey: 'staff', perm: 'staff' },
      { to: '/dashboard/industry-reports', label: 'Gym Reports', iconKey: 'reports', perm: 'reports' },
      { to: '/dashboard/subscription', label: 'Subscription Plan', iconKey: 'subscription', perm: 'subscription' },
      { to: '/dashboard/profile', label: 'Support, Logs & Profile', iconKey: 'profile', perm: 'overview' },
    ];
  }

  if (group === 'clinic') {
    return [
      { to: '/dashboard', label: 'Clinic Overview', iconKey: 'overview', perm: 'overview', end: true },
      { to: '/dashboard/clinic/appointments', label: 'Appointments & Queue', iconKey: 'appointments', perm: 'clinic_appointments' },
      { to: '/dashboard/clinic/patients', label: 'Patients & Visit Notes', iconKey: 'patients', perm: 'clinic_patients' },
      { to: '/dashboard/clinic/doctors', label: 'Doctors & Schedules', iconKey: 'doctors', perm: 'clinic_doctors' },
      { to: '/dashboard/payments', label: 'Consultation Fees', iconKey: 'payments', perm: 'payments_record' },
      { to: '/dashboard/marketing', label: 'Clinic Booking QR', iconKey: 'marketing', perm: 'overview' },
      { to: '/dashboard/appearance', label: 'Public Page Setup', iconKey: 'appearance', perm: 'appearance' },
      { to: '/dashboard/settings', label: 'Payments & Hours', iconKey: 'settings', perm: 'settings' },
      { to: '/dashboard/staff', label: 'Doctors & Staff Roles', iconKey: 'staff', perm: 'staff' },
      { to: '/dashboard/industry-reports', label: 'Clinic Reports', iconKey: 'reports', perm: 'reports' },
      { to: '/dashboard/subscription', label: 'Subscription Plan', iconKey: 'subscription', perm: 'subscription' },
      { to: '/dashboard/profile', label: 'Support, Audit & Profile', iconKey: 'profile', perm: 'overview' },
    ];
  }

  if (group === 'carwash') {
    return [
      { to: '/dashboard', label: 'Car Wash Overview', iconKey: 'overview', perm: 'overview', end: true },
      { to: '/dashboard/carwash/queue', label: 'Queue & Job Cards', iconKey: 'queue', perm: 'carwash_queue' },
      { to: '/dashboard/carwash/vehicles', label: 'Customers & Vehicles', iconKey: 'vehicles', perm: 'carwash_vehicles' },
      { to: '/dashboard/carwash/packages', label: 'Service Packages', iconKey: 'packages', perm: 'carwash_packages' },
      { to: '/dashboard/payments', label: 'Payments & Pending', iconKey: 'payments', perm: 'payments_record' },
      { to: '/dashboard/marketing', label: 'Station QR & Marketing', iconKey: 'marketing', perm: 'overview' },
      { to: '/dashboard/appearance', label: 'Public Page Setup', iconKey: 'appearance', perm: 'appearance' },
      { to: '/dashboard/settings', label: 'Payments & Hours', iconKey: 'settings', perm: 'settings' },
      { to: '/dashboard/staff', label: 'Staff & Wash Crew', iconKey: 'staff', perm: 'staff' },
      { to: '/dashboard/industry-reports', label: 'Car Wash Reports', iconKey: 'reports', perm: 'reports' },
      { to: '/dashboard/subscription', label: 'Subscription Plan', iconKey: 'subscription', perm: 'subscription' },
      { to: '/dashboard/profile', label: 'Support, Logs & Profile', iconKey: 'profile', perm: 'overview' },
    ];
  }

  if (group === 'car_dealer') {
    return [
      { to: '/dashboard', label: 'Showroom Overview', iconKey: 'overview', perm: 'overview', end: true },
      { to: '/dashboard/dealer/inventory', label: 'Vehicle Inventory', iconKey: 'vehicles', perm: 'dealer_vehicles' },
      { to: '/dashboard/dealer/leads-deals', label: 'Inquiries, Leads & Deals', iconKey: 'deals', perm: 'dealer_leads' },
      { to: '/dashboard/payments', label: 'Payments & Bookings', iconKey: 'payments', perm: 'payments_record' },
      { to: '/dashboard/marketing', label: 'Showroom QR & Posters', iconKey: 'marketing', perm: 'overview' },
      { to: '/dashboard/appearance', label: 'Showroom Appearance', iconKey: 'appearance', perm: 'appearance' },
      { to: '/dashboard/settings', label: 'Payments & Hours', iconKey: 'settings', perm: 'settings' },
      { to: '/dashboard/staff', label: 'Salespersons & Staff', iconKey: 'staff', perm: 'staff' },
      { to: '/dashboard/industry-reports', label: 'Inventory & P&L Reports', iconKey: 'reports', perm: 'reports' },
      { to: '/dashboard/subscription', label: 'Subscription Plan', iconKey: 'subscription', perm: 'subscription' },
      { to: '/dashboard/profile', label: 'Support, Logs & Profile', iconKey: 'profile', perm: 'overview' },
    ];
  }

  return [
    { to: '/dashboard', label: 'Overview', iconKey: 'overview', perm: 'overview', end: true },
    { to: '/dashboard/pos', label: 'POS & Billing', iconKey: 'pos', perm: 'pos', feature: 'pos' },
    { to: '/dashboard/products', label: 'Products', iconKey: 'products', perm: 'products' },
    { to: '/dashboard/categories', label: 'Categories', iconKey: 'categories', perm: 'categories' },
    { to: '/dashboard/orders', label: 'Orders & Invoices', iconKey: 'orders', perm: 'orders' },
    { to: '/dashboard/purchases', label: 'Purchases', iconKey: 'purchases', perm: 'purchases', feature: 'suppliersPurchases' },
    { to: '/dashboard/suppliers', label: 'Suppliers', iconKey: 'suppliers', perm: 'suppliers', feature: 'suppliersPurchases' },
    { to: '/dashboard/customers', label: 'Customers', iconKey: 'customers', perm: 'customers' },
    { to: '/dashboard/khata', label: 'Customer Khata', iconKey: 'khata', perm: 'khata', feature: 'khata' },
    { to: '/dashboard/inventory', label: 'Inventory', iconKey: 'inventory', perm: 'inventory' },
    { to: '/dashboard/coupons', label: 'Coupons', iconKey: 'coupons', perm: 'coupons' },
    { to: '/dashboard/banners', label: 'Banners', iconKey: 'banners', perm: 'banners' },
    { to: '/dashboard/marketing', label: 'Shop QR & Marketing', iconKey: 'marketing', perm: 'overview' },
    { to: '/dashboard/appearance', label: 'Appearance & Pages', iconKey: 'appearance', perm: 'appearance' },
    { to: '/dashboard/settings', label: 'Payments & Self-Pickup', iconKey: 'settings', perm: 'settings' },
    { to: '/dashboard/staff', label: 'Staff & Roles', iconKey: 'staff', perm: 'staff' },
    { to: '/dashboard/reports', label: 'Reports & Profit', iconKey: 'reports', perm: 'reports' },
    { to: '/dashboard/subscription', label: 'Subscription Plan', iconKey: 'subscription', perm: 'subscription' },
    { to: '/dashboard/profile', label: 'Support, Logs & Profile', iconKey: 'profile', perm: 'overview' },
  ];
}

export function getDefaultPermissionsForRole(
  role: StaffRole,
  businessType?: BusinessType | string | null
): StaffPermission[] {
  const available = getPermissionsForIndustry(businessType).map((p) => p.key);
  if (role === 'shop_owner' || role === 'shop_admin') {
    return available;
  }
  if (role === 'manager') {
    return available.filter((k) => k !== 'subscription');
  }
  if (role === 'doctor') {
    return ['overview', 'clinic_appointments', 'clinic_patients', 'clinic_notes', 'clinic_doctors', 'payments_record'];
  }
  if (role === 'trainer') {
    return ['overview', 'gym_members', 'gym_attendance', 'gym_trainers', 'payments_record'];
  }
  if (role === 'salesperson') {
    return ['overview', 'dealer_vehicles', 'dealer_leads', 'dealer_deals', 'payments_record'];
  }

  const group = getIndustryGroup(businessType);
  if (group === 'gym') return ['overview', 'gym_members', 'gym_attendance', 'payments_record'];
  if (group === 'clinic') return ['overview', 'clinic_appointments', 'clinic_patients', 'payments_record'];
  if (group === 'carwash') return ['overview', 'carwash_queue', 'carwash_vehicles', 'payments_record'];
  if (group === 'car_dealer') return ['overview', 'dealer_vehicles', 'dealer_leads', 'payments_record'];
  return ['overview', 'orders', 'products'];
}

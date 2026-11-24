import {
  ActivityLog,
  BusinessType,
  Category,
  CommissionLedgerEntry,
  CommissionPayout,
  Order,
  PlatformPayment,
  PlatformSettings,
  Product,
  ReferralAttribution,
  SalesActivity,
  SalesAuditLog,
  SalesLead,
  SalesMember,
  SalesQrEvent,
  SalesSettings,
  SalesTarget,
  SalesTeam,
  Shop,
  ShopCustomerSummary,
  ShopPublic,
  StoreSettings,
  SubscriptionPlan,
  SupportTicket,
} from '../types';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../data/seedData';
import { DEFAULT_SALES_SETTINGS } from '../services/salesService';
import { DEMO_DATA_TAG } from './demoConfig';

export interface DemoShopBundle {
  shop: Shop;
  shopPublic: ShopPublic;
  publicSettings: StoreSettings;
  categories: Category[];
  products: Product[];
  customers: ShopCustomerSummary[];
  orders: Order[];
}

export interface DemoSeedDataset {
  generatedAt: string;
  tag: string;
  plans: SubscriptionPlan[];
  platformSettings: PlatformSettings;
  salesSettings: SalesSettings;
  salesMembers: SalesMember[];
  referralAgents: SalesMember[];
  salesTeams: SalesTeam[];
  salesLeads: SalesLead[];
  salesTargets: SalesTarget[];
  salesActivities: SalesActivity[];
  salesQrEvents: SalesQrEvent[];
  salesAuditLogs: SalesAuditLog[];
  salesReferralIndex: Array<{
    referralCode: string;
    salesmanId: string;
    salesmanUid: string;
    salesmanName: string;
    role: SalesMember['role'];
    accountStatus: SalesMember['accountStatus'];
    qrScanCount: number;
    isDemoData: true;
    demoTag: string;
    updatedAt: string;
  }>;
  shopBundles: DemoShopBundle[];
  referralAttributions: ReferralAttribution[];
  payments: PlatformPayment[];
  commissionLedger: CommissionLedgerEntry[];
  commissionPayouts: CommissionPayout[];
  supportTickets: SupportTicket[];
  activityLogs: ActivityLog[];
}

const DEMO_CITIES = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Chichawatni',
  'Sahiwal',
  'Gujranwala',
  'Sialkot',
  'Peshawar',
  'Quetta',
  'Bahawalpur',
  'Hyderabad',
  'Abbottabad',
  'Sargodha',
  'Jhelum',
  'Gujrat',
  'Okara',
  'Vehari',
];

const DEMO_SHOP_TEMPLATES: Array<{ name: string; slug: string; type: BusinessType; status: Shop['status'] }> = [
  { name: 'Khush Mart Lahore', slug: 'demo-khush-mart-lahore', type: 'general_store', status: 'active' },
  { name: 'Noor Cosmetics Studio', slug: 'demo-noor-cosmetics', type: 'cosmetics', status: 'active' },
  { name: 'Zayb Couture House', slug: 'demo-zayb-couture', type: 'clothing', status: 'active' },
  { name: 'Chichawatni Super Bazaar', slug: 'demo-chichawatni-bazaar', type: 'general_store', status: 'active' },
  { name: 'Clifton Glow Beauty', slug: 'demo-clifton-glow', type: 'cosmetics', status: 'active' },
  { name: 'Margalla Looms & Apparel', slug: 'demo-margalla-looms', type: 'clothing', status: 'active' },
  { name: 'Ravi Everyday Mart', slug: 'demo-ravi-everyday', type: 'general_store', status: 'active' },
  { name: 'Chenab Silk & Lawn', slug: 'demo-chenab-silk', type: 'clothing', status: 'active' },
  { name: 'Multan Velvet Beauty', slug: 'demo-multan-velvet', type: 'cosmetics', status: 'active' },
  { name: 'Lyallpur Pantry Plus', slug: 'demo-lyallpur-pantry', type: 'general_store', status: 'active' },
  { name: 'Sahiwal Heritage Boutique', slug: 'demo-sahiwal-heritage', type: 'clothing', status: 'active' },
  { name: 'Potohar Care & Pharmacy', slug: 'demo-potohar-care', type: 'other_retail', status: 'active' },
  { name: 'Indus Glow Hub', slug: 'demo-indus-glow', type: 'cosmetics', status: 'active' },
  { name: 'Khyber Craft Textiles', slug: 'demo-khyber-textiles', type: 'clothing', status: 'active' },
  { name: 'Bolan Fresh Grocers', slug: 'demo-bolan-grocers', type: 'general_store', status: 'active' },
  { name: 'Bahawalpur Royal Attire', slug: 'demo-bahawalpur-royal', type: 'clothing', status: 'active' },
  { name: 'Sindh Organic Naturals', slug: 'demo-sindh-naturals', type: 'cosmetics', status: 'inactive' },
  { name: 'Hazara Pine Goods', slug: 'demo-hazara-pine', type: 'other_retail', status: 'active' },
  { name: 'Sargodha Daily Value', slug: 'demo-sargodha-daily', type: 'general_store', status: 'suspended' },
  { name: 'Gujrat Signature Store', slug: 'demo-gujrat-signature', type: 'other_retail', status: 'active' },
];

const PRODUCT_CATALOG_BY_TYPE: Record<BusinessType, Array<{ title: string; cat: string; price: number; sale?: number }>> = {
  general_store: [
    { title: 'Basmati Super Kernel Rice 5KG', cat: 'Groceries', price: 2450, sale: 2290 },
    { title: 'Cold Pressed Mustard Oil 2L', cat: 'Pantry', price: 1650 },
    { title: 'Mountain Wildflower Honey 500g', cat: 'Organic', price: 1850, sale: 1690 },
    { title: 'Kashmiri Pink Chai Blend', cat: 'Beverages', price: 780 },
    { title: 'Premium Medjool Dates Box', cat: 'Dry Fruits', price: 2100, sale: 1950 },
  ],
  cosmetics: [
    { title: 'Saffron Brightening Serum 30ml', cat: 'Skincare', price: 2800, sale: 2490 },
    { title: 'Matte Velvet Lip Trio', cat: 'Makeup', price: 2150 },
    { title: 'Rosewater Hydrating Mist', cat: 'Skincare', price: 950, sale: 850 },
    { title: 'Argan Keratin Hair Elixir', cat: 'Haircare', price: 1950 },
    { title: 'Mineral Silk Compact Powder', cat: 'Makeup', price: 1450 },
  ],
  clothing: [
    { title: '3-Piece Embroidered Lawn Suit', cat: 'Summer Lawn', price: 5400, sale: 4850 },
    { title: 'Handloom Cotton Kurta', cat: 'Menswear', price: 3200 },
    { title: 'Chiffon Festive Dupatta', cat: 'Accessories', price: 1850, sale: 1590 },
    { title: 'Stitched Cambric Co-Ord Set', cat: 'Pret', price: 4600 },
    { title: 'Khaddar Winter Shawl', cat: 'Winter Wear', price: 3900 },
  ],
  other_retail: [
    { title: 'Copper Thermal Flask 1L', cat: 'Home Living', price: 2600, sale: 2350 },
    { title: 'Smart Digital Kitchen Scale', cat: 'Appliances', price: 1950 },
    { title: 'Handcrafted Ceramic Tea Set', cat: 'Dining', price: 4800, sale: 4290 },
    { title: 'Fast-Charge GaN Wall Adapter', cat: 'Electronics', price: 2950 },
    { title: 'Cotton Travel Organizer Pouch', cat: 'Lifestyle', price: 1350 },
  ],
};

function daysAgoIso(days: number, offsetHours = 0): string {
  const ms = Date.now() - days * 86400000 - offsetHours * 3600000;
  return new Date(ms).toISOString();
}

function daysAheadIso(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export function buildDemoSeedDataset(): DemoSeedDataset {
  const nowIso = new Date().toISOString();
  const plans = DEFAULT_SUBSCRIPTION_PLANS.map((p) => ({ ...p }));

  const platformSettings: PlatformSettings = {
    platformName: 'SB Khush (DEMO)',
    tagline: 'Pakistan Multi-Tenant Retail & POS Cloud — Isolated Demo Sandbox',
    websiteUrl: 'https://sbkhush.com',
    announcement: `${DEMO_DATA_TAG}: Demo Super Admin environment active — production records are strictly locked.`,
    supportEmail: 'demo-support@demo-sandbox.invalid',
    supportPhone: '0300-0000000',
    whatsappNumber: '923000000000',
    seoTitle: 'SB Khush Demo Platform',
    seoDescription: 'Demo environment for SB Khush multi-tenant commerce and sales management.',
    canonicalDomain: 'https://sbkhush.com',
    currency: 'PKR',
    currencySymbol: 'Rs.',
    easypaisaDetails: {
      enabled: true,
      accountTitle: 'SB Khush Demo Wallet',
      accountNumber: '0300-0000001',
      instructions: `${DEMO_DATA_TAG} — Simulated EasyPaisa demo instructions`,
    },
    jazzcashDetails: {
      enabled: true,
      accountTitle: 'SB Khush Demo Wallet',
      accountNumber: '0300-0000002',
      instructions: `${DEMO_DATA_TAG} — Simulated JazzCash demo instructions`,
    },
    bankDetails: {
      enabled: true,
      bankName: 'Demo Sandbox Bank Pakistan',
      accountTitle: 'SB KHUSH DEMO SANDBOX',
      accountNumber: '0000-1111-2222-3333',
      iban: 'PK00DEMO0000000011112222',
    },
    gracePeriodDays: 7,
    updatedAt: nowIso,
  };

  const salesSettings: SalesSettings = {
    ...DEFAULT_SALES_SETTINGS,
    portalBaseUrl: 'https://sbkhush.com',
    updatedAt: nowIso,
  };

  // 10 Demo Sales Team Members: 2 Sales Managers + 8 Salesmen/Senior Salesmen
  const managerNames = [
    { id: 'demo_sm_mgr_1', name: 'Bilal Tariq (Demo Manager)', city: 'Lahore', territory: 'Central Punjab' },
    { id: 'demo_sm_mgr_2', name: 'Sanaullah Khan (Demo Manager)', city: 'Karachi', territory: 'Sindh & South' },
  ];

  const salesmanSpecs: Array<{
    id: string;
    name: string;
    role: 'salesman' | 'senior_salesman';
    managerIdx: number;
    city: string;
    territory: string;
    focus: BusinessType | 'all';
    target: number;
  }> = [
    { id: 'demo_sm_rep_1', name: 'Hamza Raza (Demo)', role: 'senior_salesman', managerIdx: 0, city: 'Lahore', territory: 'Lahore East', focus: 'general_store', target: 150000 },
    { id: 'demo_sm_rep_2', name: 'Zainab Fatima (Demo)', role: 'salesman', managerIdx: 0, city: 'Faisalabad', territory: 'Faisalabad Hub', focus: 'clothing', target: 110000 },
    { id: 'demo_sm_rep_3', name: 'Usman Akram (Demo)', role: 'salesman', managerIdx: 0, city: 'Chichawatni', territory: 'Sahiwal & Chichawatni', focus: 'all', target: 95000 },
    { id: 'demo_sm_rep_4', name: 'Ayesha Siddiqui (Demo)', role: 'senior_salesman', managerIdx: 0, city: 'Islamabad', territory: 'Twin Cities', focus: 'cosmetics', target: 140000 },
    { id: 'demo_sm_rep_5', name: 'Kamran Qureshi (Demo)', role: 'salesman', managerIdx: 1, city: 'Karachi', territory: 'Karachi South', focus: 'cosmetics', target: 120000 },
    { id: 'demo_sm_rep_6', name: 'Mariam Javed (Demo)', role: 'salesman', managerIdx: 1, city: 'Hyderabad', territory: 'Interior Sindh', focus: 'general_store', target: 90000 },
    { id: 'demo_sm_rep_7', name: 'Fawad Mehmood (Demo)', role: 'salesman', managerIdx: 1, city: 'Multan', territory: 'South Punjab', focus: 'clothing', target: 105000 },
    { id: 'demo_sm_rep_8', name: 'Hira Nawaz (Demo)', role: 'senior_salesman', managerIdx: 1, city: 'Quetta', territory: 'West Zone', focus: 'other_retail', target: 115000 },
  ];

  const salesMembers: SalesMember[] = [
    ...managerNames.map((m, idx): SalesMember => ({
      id: m.id,
      uid: `demo_uid_${m.id}`,
      employeeId: `SBK-DM-M0${idx + 1}`,
      fullName: m.name,
      email: `demo.manager${idx + 1}@demo-sandbox.invalid`,
      phone: `0300-100000${idx + 1}`,
      city: m.city,
      role: 'sales_manager',
      teamId: `demo_team_${idx + 1}`,
      teamName: idx === 0 ? 'Punjab Growth Demo Team' : 'Karachi & South Demo Team',
      territory: m.territory,
      industryFocus: 'all',
      joiningDate: daysAgoIso(180).slice(0, 10),
      employmentStatus: 'full_time',
      monthlyTarget: 450000,
      yearlyTarget: 5400000,
      commissionPlanId: 'growth',
      commissionPlanName: 'Growth Tier (20%)',
      accountStatus: 'active',
      referralCode: `DMGR0${idx + 1}`,
      referralLink: `https://sbkhush.com/#/register?ref=DMGR0${idx + 1}`,
      qrScanCount: 18 + idx * 7,
      payoutDetails: {
        preferredMethod: 'bank_transfer',
        accountTitle: m.name,
        accountNumber: `00001111220${idx + 1}`,
        bankName: 'Demo Sandbox Bank',
      },
      inviteStatus: 'accepted',
      createdBy: 'demo-admin@sbkhush.com',
      createdAt: daysAgoIso(180),
      updatedAt: nowIso,
    })),
    ...salesmanSpecs.map((s, idx): SalesMember => {
      const mgr = managerNames[s.managerIdx];
      return {
        id: s.id,
        uid: `demo_uid_${s.id}`,
        employeeId: `SBK-DM-S0${idx + 1}`,
        fullName: s.name,
        email: `demo.rep${idx + 1}@demo-sandbox.invalid`,
        phone: `0301-200000${idx + 1}`,
        city: s.city,
        role: s.role,
        assignedManagerId: mgr.id,
        assignedManagerUid: `demo_uid_${mgr.id}`,
        assignedManagerName: mgr.name,
        teamId: `demo_team_${s.managerIdx + 1}`,
        teamName: s.managerIdx === 0 ? 'Punjab Growth Demo Team' : 'Karachi & South Demo Team',
        territory: s.territory,
        industryFocus: s.focus,
        joiningDate: daysAgoIso(120 - idx * 7).slice(0, 10),
        employmentStatus: 'full_time',
        monthlyTarget: s.target,
        yearlyTarget: s.target * 12,
        commissionPlanId: s.role === 'senior_salesman' ? 'enterprise' : 'standard',
        commissionPlanName: s.role === 'senior_salesman' ? 'Enterprise Partner (25%)' : 'Standard Partner (15%)',
        accountStatus: idx === 7 ? 'inactive' : 'active',
        referralCode: `DREP0${idx + 1}`,
        referralLink: `https://sbkhush.com/#/register?ref=DREP0${idx + 1}`,
        qrScanCount: 24 + idx * 9,
        payoutDetails: {
          preferredMethod: idx % 2 === 0 ? 'easypaisa' : 'jazzcash',
          accountTitle: s.name,
          accountNumber: `0301-200000${idx + 1}`,
        },
        inviteStatus: 'accepted',
        createdBy: 'demo-admin@sbkhush.com',
        createdAt: daysAgoIso(120 - idx * 7),
        updatedAt: nowIso,
      };
    }),
  ];

  // 5 Demo Referral Agents
  const referralAgentSpecs = [
    { name: 'Arslan Digital Hub (Demo Agent)', city: 'Lahore', code: 'DAGENT01' },
    { name: 'Karachi Merchants Network (Demo Agent)', city: 'Karachi', code: 'DAGENT02' },
    { name: 'Chichawatni Chamber Partner (Demo Agent)', city: 'Chichawatni', code: 'DAGENT03' },
    { name: 'Islamabad Retail Guild (Demo Agent)', city: 'Islamabad', code: 'DAGENT04' },
    { name: 'Multan Commerce Circle (Demo Agent)', city: 'Multan', code: 'DAGENT05' },
  ];

  const referralAgents: SalesMember[] = referralAgentSpecs.map((a, idx) => ({
    id: `demo_ref_agent_${idx + 1}`,
    uid: `demo_uid_ref_${idx + 1}`,
    employeeId: `SBK-DA-0${idx + 1}`,
    fullName: a.name,
    email: `demo.agent${idx + 1}@demo-sandbox.invalid`,
    phone: `0302-300000${idx + 1}`,
    city: a.city,
    role: 'referral_agent',
    territory: `${a.city} Affiliate Circle`,
    industryFocus: 'all',
    joiningDate: daysAgoIso(90 - idx * 5).slice(0, 10),
    employmentStatus: 'contract',
    monthlyTarget: 60000,
    yearlyTarget: 720000,
    commissionPlanId: 'standard',
    commissionPlanName: 'Standard Partner (15%)',
    accountStatus: idx === 4 ? 'pending_approval' : 'active',
    referralCode: a.code,
    referralLink: `https://sbkhush.com/#/register?ref=${a.code}`,
    qrScanCount: 14 + idx * 6,
    payoutDetails: {
      preferredMethod: 'easypaisa',
      accountTitle: a.name,
      accountNumber: `0302-300000${idx + 1}`,
    },
    inviteStatus: idx === 4 ? 'pending' : 'accepted',
    createdBy: 'demo-admin@sbkhush.com',
    createdAt: daysAgoIso(90 - idx * 5),
    updatedAt: nowIso,
  }));

  const allSalesTeamMembers = [...salesMembers, ...referralAgents];
  const salesReferralIndex = allSalesTeamMembers.map((m) => ({
    referralCode: m.referralCode,
    salesmanId: m.id,
    salesmanUid: m.uid || m.id,
    salesmanName: m.fullName,
    role: m.role,
    accountStatus: m.accountStatus,
    qrScanCount: m.qrScanCount,
    isDemoData: true as const,
    demoTag: DEMO_DATA_TAG,
    updatedAt: nowIso,
  }));

  const salesTeams: SalesTeam[] = [
    {
      id: 'demo_team_1',
      name: 'Punjab Growth Demo Team',
      managerMemberId: managerNames[0].id,
      managerUid: `demo_uid_${managerNames[0].id}`,
      managerName: managerNames[0].name,
      territory: 'Central & North Punjab',
      cities: ['Lahore', 'Faisalabad', 'Chichawatni', 'Islamabad'],
      memberIds: salesmanSpecs.filter((s) => s.managerIdx === 0).map((s) => s.id),
      monthlyTeamTarget: 495000,
      description: `${DEMO_DATA_TAG}: Demo regional team covering Central Punjab`,
      isActive: true,
      createdAt: daysAgoIso(150),
      updatedAt: nowIso,
    },
    {
      id: 'demo_team_2',
      name: 'Karachi & South Demo Team',
      managerMemberId: managerNames[1].id,
      managerUid: `demo_uid_${managerNames[1].id}`,
      managerName: managerNames[1].name,
      territory: 'Sindh, Multan & West',
      cities: ['Karachi', 'Hyderabad', 'Multan', 'Quetta'],
      memberIds: salesmanSpecs.filter((s) => s.managerIdx === 1).map((s) => s.id),
      monthlyTeamTarget: 430000,
      description: `${DEMO_DATA_TAG}: Demo regional team covering Sindh & South Punjab`,
      isActive: true,
      createdAt: daysAgoIso(150),
      updatedAt: nowIso,
    },
  ];

  // Build 20 Demo Shops, 100 Products (5 per shop), 50 Customers, 30 Orders
  const shopBundles: DemoShopBundle[] = [];
  const referralAttributions: ReferralAttribution[] = [];
  const payments: PlatformPayment[] = [];
  const commissionLedger: CommissionLedgerEntry[] = [];

  // Distribute 50 customers across 20 shops: first 10 shops get 3 customers (30), next 10 get 2 (20) => 50
  // Distribute 30 orders across 20 shops: first 10 shops get 2 orders (20), next 10 get 1 order (10) => 30
  let globalCustomerIdx = 0;
  let globalOrderIdx = 0;

  for (let i = 0; i < 20; i++) {
    const tpl = DEMO_SHOP_TEMPLATES[i];
    const city = DEMO_CITIES[i];
    const shopId = tpl.slug;
    const plan = plans[i % plans.length];
    const isPaidPlan = plan.monthlyPrice > 0;
    const cycle = i % 3 === 0 ? 'yearly' : 'monthly';
    const pricePaid = isPaidPlan ? (cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice) : 0;
    const createdAt = daysAgoIso(60 - i * 2);

    const shop: Shop = {
      id: shopId,
      slug: tpl.slug,
      name: tpl.name,
      businessType: tpl.type,
      ownerId: `demo_owner_${i + 1}`,
      ownerName: `Merchant Owner ${i + 1} (Demo)`,
      ownerEmail: `demo.merchant${i + 1}@demo-sandbox.invalid`,
      ownerPhone: `0305-40000${String(i + 1).padStart(2, '0')}`,
      city,
      address: `Plot ${10 + i}, Main Commercial Block, ${city}`,
      cnicMasked: `XXXXX-XXXX10${String(i).padStart(2, '0')}-${(i % 9) + 1}`,
      cnicLast4: `10${String(i).padStart(2, '0')}`.slice(-4),
      cnicHash: `demo_cnic_hmac_${String(i + 1).padStart(3, '0')}`,
      cnicVerified: true,
      cnicStatus: 'verified',
      cnicUpdatedAt: createdAt,
      logoUrl: '',
      status: tpl.status,
      subscription: {
        planId: plan.id,
        planName: plan.name,
        status: tpl.status === 'suspended' ? 'expired' : 'active',
        billingCycle: cycle,
        pricePaid,
        startDate: createdAt,
        expiryDate: daysAheadIso(cycle === 'yearly' ? 320 : 25),
        autoRenew: false,
      },
      usage: {
        productsCount: 5,
        ordersCount: i < 10 ? 2 : 1,
        storageBytes: 256000,
        staffCount: 2,
      },
      theme: {
        primaryColor: '#065f46',
        accentColor: '#d97706',
        heroTitle: `${tpl.name}`,
        heroSubtitle: `${DEMO_DATA_TAG} — Curated ${tpl.type.replace('_', ' ')} catalog in ${city}`,
        showTestimonials: true,
        showBuyingGuide: true,
      },
      adminNotes: `${DEMO_DATA_TAG}: Synthetic multi-tenant demo shop #${i + 1}`,
      onboardingChecklist: {
        accountCreated: true,
        logoUploaded: true,
        paymentConfigured: true,
        firstProductAdded: true,
      },
      lastActivityAt: daysAgoIso(i % 5),
      createdAt,
      updatedAt: nowIso,
    };

    const shopPublic: ShopPublic = {
      id: shopId,
      slug: tpl.slug,
      name: tpl.name,
      businessType: tpl.type,
      city,
      storefrontAddress: shop.address,
      publicContactPhone: shop.ownerPhone,
      publicSupportEmail: shop.ownerEmail,
      businessHours: 'Mon – Sat: 10:00 AM – 9:00 PM',
      status: tpl.status,
      theme: shop.theme,
      createdAt,
      updatedAt: nowIso,
    };

    const publicSettings: StoreSettings = {
      siteName: tpl.name,
      primaryColor: '#065f46',
      accentColor: '#d97706',
      announcement: `${DEMO_DATA_TAG}: Nationwide COD & Self-Pickup enabled for ${tpl.name}`,
      contactPhone: shop.ownerPhone,
      whatsappNumber: shop.ownerPhone,
      contactEmail: shop.ownerEmail,
      address: shop.address,
      city,
      shippingFee: 200,
      freeShippingThreshold: 3500,
      currency: 'PKR',
      currencySymbol: 'Rs.',
      codEnabled: true,
      bankDetails: { enabled: true, bankName: 'Demo Bank', accountTitle: tpl.name, accountNumber: '0000123456', iban: 'PK00DEMO000123' },
      easypaisaDetails: { enabled: true, accountTitle: tpl.name, accountNumber: shop.ownerPhone },
      jazzcashDetails: { enabled: true, accountTitle: tpl.name, accountNumber: shop.ownerPhone },
      selfPickupDetails: {
        enabled: i % 2 === 0,
        title: `${tpl.name} Pickup Counter`,
        address: shop.address,
        city,
        timings: 'Mon – Sat: 11:00 AM – 8:00 PM',
        contactPhone: shop.ownerPhone,
        preparationTime: '30–45 mins',
        requireAdvancePayment: false,
        cashOnPickupEnabled: true,
        advanceDays: 5,
      },
      socialLinks: {},
    };

    const catalog = PRODUCT_CATALOG_BY_TYPE[tpl.type];
    const catNames = Array.from(new Set(catalog.map((c) => c.cat)));
    const categories: Category[] = catNames.map((name, cIdx) => ({
      id: `demo_cat_${i + 1}_${cIdx + 1}`,
      shopId,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: `${DEMO_DATA_TAG}: ${name} collection`,
      order: cIdx + 1,
    }));

    // Exactly 5 products per shop => 20 * 5 = 100 demo products
    const products: Product[] = catalog.map((item, pIdx) => ({
      id: `demo_prod_${i + 1}_${pIdx + 1}`,
      shopId,
      title: `${item.title} (${city})`,
      slug: `${tpl.slug}-item-${pIdx + 1}`,
      description: `${DEMO_DATA_TAG}: Synthetic product item #${pIdx + 1} for ${tpl.name}.`,
      purchasePrice: Math.round(item.price * 0.65),
      regularPrice: item.price + i * 25,
      salePrice: item.sale ? item.sale + i * 25 : undefined,
      stock: 18 + ((i + pIdx) % 35),
      minStockAlert: 5,
      unit: 'Piece',
      category: item.cat,
      brand: tpl.name.split(' ')[0],
      images: [],
      sku: `DM-${String(i + 1).padStart(2, '0')}-${String(pIdx + 1).padStart(2, '0')}`,
      isFeatured: pIdx < 2,
      isPublished: true,
      rating: 4.4 + ((pIdx % 5) * 0.1),
      reviewCount: 4 + pIdx * 2,
      createdAt,
      updatedAt: nowIso,
    }));

    const customersCountForShop = i < 10 ? 3 : 2;
    const customers: ShopCustomerSummary[] = [];
    for (let c = 0; c < customersCountForShop; c++) {
      globalCustomerIdx++;
      const custId = `demo_cust_${String(globalCustomerIdx).padStart(3, '0')}`;
      customers.push({
        id: custId,
        name: `Demo Customer ${globalCustomerIdx}`,
        email: `demo.customer${globalCustomerIdx}@demo-sandbox.invalid`,
        phone: `0310-5000${String(globalCustomerIdx).padStart(3, '0')}`,
        address: `Street ${globalCustomerIdx}, Sector ${c + 1}, ${city}`,
        city,
        ordersCount: 1 + (c % 2),
        totalSpent: 2800 + globalCustomerIdx * 190,
        outstandingBalance: c === 0 ? 0 : 450,
        notes: DEMO_DATA_TAG,
        lastOrderAt: daysAgoIso(c + 1),
        createdAt: daysAgoIso(25 - c),
      });
    }

    const ordersCountForShop = i < 10 ? 2 : 1;
    const orders: Order[] = [];
    const orderStatuses: Order['orderStatus'][] = ['Pending', 'Confirmed', 'Preparing', 'Delivered', 'Collected', 'Shipped'];
    for (let o = 0; o < ordersCountForShop; o++) {
      globalOrderIdx++;
      const cust = customers[o % customers.length];
      const prod = products[o % products.length];
      const qty = 1 + (globalOrderIdx % 2);
      const unitPrice = prod.salePrice || prod.regularPrice;
      const subtotal = unitPrice * qty;
      const isPickup = globalOrderIdx % 3 === 0;
      const shippingFee = isPickup ? 0 : 200;
      const ordId = `demo_ord_${String(globalOrderIdx).padStart(3, '0')}`;
      const orderNum = `DM-${100000 + globalOrderIdx}`;
      const orderStatus = isPickup ? (o === 0 ? 'Ready for Pickup' : 'Collected') : orderStatuses[globalOrderIdx % orderStatuses.length];

      orders.push({
        id: ordId,
        shopId,
        orderNumber: orderNum,
        userId: cust.id,
        customer: {
          name: cust.name,
          email: cust.email,
          phone: cust.phone,
          address: cust.address || `${city} Market`,
          city: cust.city,
          postalCode: '54000',
        },
        items: [
          {
            productId: prod.id,
            title: prod.title,
            price: unitPrice,
            quantity: qty,
            image: '',
          },
        ],
        subtotal,
        shippingFee,
        discount: 0,
        total: subtotal + shippingFee,
        fulfillmentMethod: isPickup ? 'self_pickup' : 'delivery',
        pickupStatus: isPickup ? (orderStatus === 'Collected' ? 'Picked Up' : 'Ready for Pickup') : undefined,
        pickupDetails: isPickup
          ? {
              locationName: `${tpl.name} Pickup Counter`,
              address: shop.address,
              city,
              timings: 'Mon – Sat: 11:00 AM – 8:00 PM',
              contactPhone: shop.ownerPhone,
              pickupDate: nowIso.slice(0, 10),
              pickupSlotLabel: '12:00 PM – 2:00 PM',
            }
          : undefined,
        paymentMethod: globalOrderIdx % 4 === 0 ? 'easypaisa' : 'cod',
        paymentStatus: orderStatus === 'Delivered' || orderStatus === 'Collected' ? 'paid' : 'pending',
        orderStatus,
        notes: DEMO_DATA_TAG,
        createdAt: daysAgoIso(globalOrderIdx % 14),
        updatedAt: nowIso,
      });
    }

    shopBundles.push({
      shop,
      shopPublic,
      publicSettings,
      categories,
      products,
      customers,
      orders,
    });

    // Attribution for first 15 demo shops (mix of salesman & referral_agent)
    if (i < 15) {
      const sourceMember = i < 11 ? salesMembers[2 + (i % 8)] : referralAgents[i % 4];
      const payId = `demo_pay_${String(i + 1).padStart(3, '0')}`;
      const payAmount = pricePaid > 0 ? pricePaid : 1990;
      const isPending = i >= 12;

      referralAttributions.push({
        id: shopId,
        referralCode: sourceMember.referralCode,
        salesmanId: sourceMember.id,
        salesmanUid: sourceMember.uid,
        salesmanName: sourceMember.fullName,
        shopId,
        shopSlug: shop.slug,
        shopName: shop.name,
        ownerId: shop.ownerId,
        ownerEmail: shop.ownerEmail,
        ownerPhone: shop.ownerPhone,
        city,
        industry: tpl.type,
        source: i % 2 === 0 ? 'referral_link' : 'qr_scan',
        attributionStatus: isPending ? 'registered' : 'subscribed',
        firstPaymentId: payId,
        totalRevenueGenerated: isPending ? 0 : payAmount,
        createdAt,
        updatedAt: nowIso,
      });

      payments.push({
        id: payId,
        shopId,
        shopName: shop.name,
        shopSlug: shop.slug,
        ownerId: shop.ownerId,
        ownerEmail: shop.ownerEmail,
        planId: plan.id,
        planName: plan.name,
        billingCycle: cycle,
        amount: payAmount,
        method: i % 3 === 0 ? 'bank_transfer' : i % 2 === 0 ? 'easypaisa' : 'jazzcash',
        transactionId: `DEMO-TID-${10000 + i}`,
        senderNumber: shop.ownerPhone,
        proofUrl: '',
        notes: DEMO_DATA_TAG,
        status: isPending ? 'pending' : i === 11 ? 'rejected' : 'approved',
        rejectionReason: i === 11 ? 'DEMO DATA: Simulated mismatch receipt' : undefined,
        reviewedBy: isPending ? undefined : 'demo-admin@sbkhush.com',
        reviewedAt: isPending ? undefined : daysAgoIso(10 - (i % 8)),
        createdAt: daysAgoIso(12 - (i % 10)),
      });

      if (!isPending && i < 12) {
        const ratePct = sourceMember.role === 'senior_salesman' ? 25 : 15;
        const commAmt = Math.round((payAmount * ratePct) / 100) + 250;
        const isPaid = i < 4;
        const isApproved = i >= 4 && i < 9;
        commissionLedger.push({
          id: `demo_comm_${String(i + 1).padStart(3, '0')}`,
          salesmanId: sourceMember.id,
          salesmanUid: sourceMember.uid,
          salesmanName: sourceMember.fullName,
          shopId,
          shopName: shop.name,
          paymentId: payId,
          attributionId: shopId,
          planId: plan.id,
          planName: plan.name,
          billingCycle: cycle,
          paymentAmount: payAmount,
          commissionRatePct: ratePct,
          flatBonusAmount: 250,
          commissionAmount: commAmt,
          commissionType: 'subscription_first',
          status: isPaid ? 'paid' : isApproved ? 'approved' : 'pending',
          payoutId: isPaid ? `demo_payout_${(i % 4) + 1}` : undefined,
          approvedBy: isPaid || isApproved ? 'demo-admin@sbkhush.com' : undefined,
          approvedAt: isPaid || isApproved ? daysAgoIso(6) : undefined,
          paidAt: isPaid ? daysAgoIso(2) : undefined,
          createdAt: daysAgoIso(9),
          updatedAt: nowIso,
        });
      }
    }
  }

  // 4 Demo Commission Payouts linked to the first 4 paid ledger entries
  const commissionPayouts: CommissionPayout[] = [0, 1, 2, 3].map((idx) => {
    const ledger = commissionLedger[idx];
    return {
      id: `demo_payout_${idx + 1}`,
      payoutNumber: `DM-PAY-2026-0${idx + 1}`,
      salesmanId: ledger.salesmanId,
      salesmanUid: ledger.salesmanUid,
      salesmanName: ledger.salesmanName,
      salesmanEmail: `demo.payout${idx + 1}@demo-sandbox.invalid`,
      ledgerEntryIds: [ledger.id],
      totalAmount: ledger.commissionAmount,
      method: idx % 2 === 0 ? 'easypaisa' : 'bank_transfer',
      accountTitle: ledger.salesmanName,
      accountNumber: `0301-200000${idx + 1}`,
      transactionReference: `DEMO-POUT-${9001 + idx}`,
      notes: DEMO_DATA_TAG,
      status: 'processed',
      processedBy: 'demo-admin@sbkhush.com',
      processedAt: daysAgoIso(2 + idx),
      createdAt: daysAgoIso(2 + idx),
    };
  });

  // 12 Demo Sales Leads
  const leadStatuses: SalesLead['status'][] = [
    'New',
    'Assigned',
    'Contacted',
    'Interested',
    'Follow-up Required',
    'Demo Scheduled',
    'Negotiation',
    'Converted',
    'Contacted',
    'Follow-up Required',
    'Interested',
    'Converted',
  ];
  const salesLeads: SalesLead[] = leadStatuses.map((status, idx) => {
    const rep = salesMembers[2 + (idx % 8)];
    return {
      id: `demo_lead_${String(idx + 1).padStart(3, '0')}`,
      businessName: `Demo Prospect Store ${idx + 1}`,
      ownerName: `Prospect Merchant ${idx + 1}`,
      phone: `0321-7000${String(idx + 1).padStart(3, '0')}`,
      normalizedPhone: `03217000${String(idx + 1).padStart(3, '0')}`,
      email: `demo.prospect${idx + 1}@demo-sandbox.invalid`,
      normalizedEmail: `demo.prospect${idx + 1}@demo-sandbox.invalid`,
      city: DEMO_CITIES[idx % DEMO_CITIES.length],
      industry: (['general_store', 'cosmetics', 'clothing', 'other_retail'] as BusinessType[])[idx % 4],
      assignedSalesmanId: rep.id,
      assignedSalesmanUid: rep.uid,
      assignedSalesmanName: rep.fullName,
      assignedManagerId: rep.assignedManagerId,
      assignedManagerUid: rep.assignedManagerUid,
      leadSource: idx % 2 === 0 ? 'field_visit' : 'whatsapp',
      expectedPlanId: plans[(idx % 3) + 1].id,
      expectedPlanName: plans[(idx % 3) + 1].name,
      nextFollowUpDate: daysAheadIso(1 + (idx % 4)).slice(0, 10),
      notes: `${DEMO_DATA_TAG}: Synthetic pipeline prospect #${idx + 1}`,
      status,
      convertedShopId: status === 'Converted' ? shopBundles[idx % 5].shop.id : undefined,
      convertedShopSlug: status === 'Converted' ? shopBundles[idx % 5].shop.slug : undefined,
      createdBy: 'demo-admin@sbkhush.com',
      createdAt: daysAgoIso(15 - idx),
      updatedAt: nowIso,
    };
  });

  const periodKey = nowIso.slice(0, 7);
  const salesTargets: SalesTarget[] = salesMembers.map((m, idx) => ({
    id: `demo_target_${m.id}_${periodKey}`,
    salesmanId: m.id,
    salesmanUid: m.uid,
    salesmanName: m.fullName,
    periodType: 'monthly',
    periodKey,
    dailyActivityTarget: m.role === 'sales_manager' ? 5 : 8,
    weeklyLeadTarget: m.role === 'sales_manager' ? 12 : 10,
    monthlyRegistrationTarget: m.role === 'sales_manager' ? 20 : 8,
    monthlyPaidSubscriptionTarget: m.role === 'sales_manager' ? 12 : 5,
    revenueTarget: m.monthlyTarget,
    conversionTarget: 35,
    bonusAmount: 10000 + idx * 1000,
    bonusThresholdPct: 100,
    notes: DEMO_DATA_TAG,
    updatedBy: 'demo-admin@sbkhush.com',
    createdAt: daysAgoIso(20),
    updatedAt: nowIso,
  }));

  const salesActivities: SalesActivity[] = Array.from({ length: 16 }, (_, idx) => {
    const rep = salesMembers[2 + (idx % 8)];
    const lead = salesLeads[idx % salesLeads.length];
    return {
      id: `demo_act_${String(idx + 1).padStart(3, '0')}`,
      salesmanId: rep.id,
      salesmanUid: rep.uid,
      salesmanName: rep.fullName,
      leadId: lead.id,
      leadName: lead.businessName,
      activityType: idx % 3 === 0 ? 'Business visit' : idx % 3 === 1 ? 'Product demo' : 'WhatsApp follow-up',
      activityDateTime: daysAgoIso(idx % 10, idx % 5),
      notes: `${DEMO_DATA_TAG}: Demo field check-in with ${lead.businessName}`,
      nextFollowUpDate: daysAheadIso(2).slice(0, 10),
      resultStatus: idx % 4 === 0 ? 'converted' : 'positive',
      createdAt: daysAgoIso(idx % 10),
    };
  });

  const salesQrEvents: SalesQrEvent[] = Array.from({ length: 10 }, (_, idx) => {
    const m = allSalesTeamMembers[2 + (idx % 10)];
    return {
      id: `demo_qr_${String(idx + 1).padStart(3, '0')}`,
      salesmanId: m.id,
      referralCode: m.referralCode,
      source: idx % 2 === 0 ? 'qr_scan' : 'referral_link',
      userAgent: 'DemoSandboxBrowser/1.0',
      convertedShopId: idx < 5 ? shopBundles[idx].shop.id : undefined,
      createdAt: daysAgoIso(idx + 1),
    };
  });

  const salesAuditLogs: SalesAuditLog[] = [
    {
      id: 'demo_slog_1',
      actorUid: 'demo_admin',
      actorEmail: 'demo-admin@sbkhush.com',
      actorRole: 'super_admin',
      action: 'Seeded Demo Sales Team',
      entityType: 'sales_member',
      entityId: 'demo_team_1',
      details: `${DEMO_DATA_TAG}: Provisioned 2 managers, 8 salesmen & 5 referral agents in isolated demo workspace`,
      createdAt: daysAgoIso(3),
    },
    {
      id: 'demo_slog_2',
      actorUid: 'demo_admin',
      actorEmail: 'demo-admin@sbkhush.com',
      actorRole: 'super_admin',
      action: 'Approved Demo Commission Batch',
      entityType: 'commission',
      entityId: 'demo_comm_001',
      details: `${DEMO_DATA_TAG}: Approved initial simulated partner commissions`,
      createdAt: daysAgoIso(2),
    },
  ];

  const supportTickets: SupportTicket[] = [
    {
      id: 'demo_tkt_1',
      shopId: shopBundles[0].shop.id,
      shopName: shopBundles[0].shop.name,
      userId: shopBundles[0].shop.ownerId,
      userEmail: shopBundles[0].shop.ownerEmail,
      subject: '[DEMO] Self-Pickup time slot capacity query',
      category: 'onboarding',
      priority: 'medium',
      message: `${DEMO_DATA_TAG}: How do we raise pickup slot limits for weekend rush hours?`,
      status: 'open',
      createdAt: daysAgoIso(2),
    },
    {
      id: 'demo_tkt_2',
      shopId: shopBundles[1].shop.id,
      shopName: shopBundles[1].shop.name,
      userId: shopBundles[1].shop.ownerId,
      userEmail: shopBundles[1].shop.ownerEmail,
      subject: '[DEMO] Thermal POS 80mm receipt logo alignment',
      category: 'technical',
      priority: 'low',
      message: `${DEMO_DATA_TAG}: Sample support ticket demonstrating Super Admin ticket triage.`,
      status: 'in_progress',
      adminReply: 'Demo support note: verified 80mm thermal header CSS.',
      createdAt: daysAgoIso(4),
      updatedAt: daysAgoIso(1),
    },
    {
      id: 'demo_tkt_3',
      shopId: shopBundles[2].shop.id,
      shopName: shopBundles[2].shop.name,
      userId: shopBundles[2].shop.ownerId,
      userEmail: shopBundles[2].shop.ownerEmail,
      subject: '[DEMO] Plan upgrade billing cycle preview',
      category: 'billing',
      priority: 'high',
      message: `${DEMO_DATA_TAG}: Requesting annual billing preview for Zayb Couture House.`,
      status: 'open',
      createdAt: daysAgoIso(1),
    },
    {
      id: 'demo_tkt_4',
      shopId: shopBundles[3].shop.id,
      shopName: shopBundles[3].shop.name,
      userId: shopBundles[3].shop.ownerId,
      userEmail: shopBundles[3].shop.ownerEmail,
      subject: '[DEMO] Bulk barcode label export',
      category: 'feature',
      priority: 'low',
      message: `${DEMO_DATA_TAG}: Store team asked about A4 barcode sheet export.`,
      status: 'resolved',
      adminReply: 'Resolved in Inventory -> Barcode Printing module.',
      createdAt: daysAgoIso(7),
      updatedAt: daysAgoIso(3),
    },
    {
      id: 'demo_tkt_5',
      shopId: shopBundles[4].shop.id,
      shopName: shopBundles[4].shop.name,
      userId: shopBundles[4].shop.ownerId,
      userEmail: shopBundles[4].shop.ownerEmail,
      subject: '[DEMO] JazzCash account update confirmation',
      category: 'billing',
      priority: 'medium',
      message: `${DEMO_DATA_TAG}: Sample billing verification inquiry.`,
      status: 'open',
      createdAt: daysAgoIso(0, 4),
    },
  ];

  const activityLogs: ActivityLog[] = Array.from({ length: 10 }, (_, idx) => ({
    id: `demo_plog_${idx + 1}`,
    actorId: 'demo_admin',
    actorEmail: 'demo-admin@sbkhush.com',
    action: idx % 2 === 0 ? 'Demo Shop Audited' : 'Demo Payment Reviewed',
    targetType: idx % 2 === 0 ? 'shop' : 'payment',
    targetId: shopBundles[idx].shop.id,
    details: `${DEMO_DATA_TAG}: Synthetic audit trail record #${idx + 1} for ${shopBundles[idx].shop.name}`,
    createdAt: daysAgoIso(idx),
  }));

  return {
    generatedAt: nowIso,
    tag: DEMO_DATA_TAG,
    plans,
    platformSettings,
    salesSettings,
    salesMembers,
    referralAgents,
    salesTeams,
    salesLeads,
    salesTargets,
    salesActivities,
    salesQrEvents,
    salesAuditLogs,
    salesReferralIndex,
    shopBundles,
    referralAttributions,
    payments,
    commissionLedger,
    commissionPayouts,
    supportTickets,
    activityLogs,
  };
}

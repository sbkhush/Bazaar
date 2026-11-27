"use strict";
// Self-contained deterministic Demo Super Admin dataset generator for Cloud Functions.
// Contains strictly synthetic non-PII records clearly tagged as DEMO DATA.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEMO_DATA_TAG = exports.DEMO_ENV_ID = exports.DEMO_ENV_ROOT = exports.DEMO_ACCOUNT_TYPE = exports.DEMO_ADMIN_DISPLAY_NAME = exports.DEMO_ADMIN_EMAIL = void 0;
exports.buildDemoAdminWriteOperations = buildDemoAdminWriteOperations;
exports.DEMO_ADMIN_EMAIL = 'demo-admin@sbkhush.com';
exports.DEMO_ADMIN_DISPLAY_NAME = 'SB Khush Demo Admin';
exports.DEMO_ACCOUNT_TYPE = 'DEMO';
exports.DEMO_ENV_ROOT = 'demo_env';
exports.DEMO_ENV_ID = 'default';
exports.DEMO_DATA_TAG = 'DEMO DATA';
const DEMO_CITIES = [
    'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad',
    'Multan', 'Chichawatni', 'Sahiwal', 'Gujranwala', 'Sialkot',
    'Peshawar', 'Quetta', 'Bahawalpur', 'Hyderabad', 'Abbottabad',
    'Sargodha', 'Jhelum', 'Gujrat', 'Okara', 'Vehari',
];
const DEMO_SHOP_TEMPLATES = [
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
const PRODUCT_CATALOG_BY_TYPE = {
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
function daysAgoIso(days, offsetHours = 0) {
    return new Date(Date.now() - days * 86400000 - offsetHours * 3600000).toISOString();
}
function daysAheadIso(days) {
    return new Date(Date.now() + days * 86400000).toISOString();
}
function buildDemoAdminWriteOperations() {
    const ops = [];
    const nowIso = new Date().toISOString();
    const pushOp = (pathSegments, data) => {
        const cleaned = {};
        for (const [k, v] of Object.entries(data)) {
            if (v !== undefined)
                cleaned[k] = v;
        }
        ops.push({ pathSegments: [exports.DEMO_ENV_ROOT, exports.DEMO_ENV_ID, ...pathSegments], data: cleaned });
    };
    ops.push({
        pathSegments: [exports.DEMO_ENV_ROOT, exports.DEMO_ENV_ID],
        data: {
            id: exports.DEMO_ENV_ID,
            accountType: exports.DEMO_ACCOUNT_TYPE,
            demoTag: exports.DEMO_DATA_TAG,
            seededAt: nowIso,
            shopCount: 20,
            productCount: 100,
            customerCount: 50,
            orderCount: 30,
            salesMemberCount: 10,
            referralAgentCount: 5,
        },
    });
    const plans = [
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
                customBranding: false, coupons: false, banners: true, analytics: false, selfPickup: true,
                buyingGuide: false, staffAccounts: false, customPages: true, pos: false, barcode: false,
                suppliersPurchases: false, khata: false, advancedInventory: false, advancedReports: false,
                prioritySupport: false,
            },
            isActive: true,
            isPopular: false,
            order: 1,
            createdAt: nowIso,
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
                customBranding: true, coupons: true, banners: true, analytics: true, selfPickup: true,
                buyingGuide: false, staffAccounts: true, customPages: true, pos: false, barcode: false,
                suppliersPurchases: false, khata: false, advancedInventory: false, advancedReports: false,
                prioritySupport: false,
            },
            isActive: true,
            isPopular: false,
            order: 2,
            createdAt: nowIso,
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
                customBranding: true, coupons: true, banners: true, analytics: true, selfPickup: true,
                buyingGuide: true, staffAccounts: true, customPages: true, pos: true, barcode: true,
                suppliersPurchases: true, khata: true, advancedInventory: true, advancedReports: true,
                prioritySupport: false,
            },
            isActive: true,
            isPopular: true,
            order: 3,
            createdAt: nowIso,
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
                customBranding: true, coupons: true, banners: true, analytics: true, selfPickup: true,
                buyingGuide: true, staffAccounts: true, customPages: true, pos: true, barcode: true,
                suppliersPurchases: true, khata: true, advancedInventory: true, advancedReports: true,
                prioritySupport: true,
            },
            isActive: true,
            isPopular: false,
            order: 4,
            createdAt: nowIso,
        },
    ];
    plans.forEach((p) => pushOp(['platform_plans', p.id], p));
    pushOp(['platform_settings', 'general'], {
        platformName: 'SB Khush (DEMO)',
        tagline: 'Pakistan Multi-Tenant Retail & POS Cloud — Isolated Demo Sandbox',
        websiteUrl: 'https://sbkhush.com',
        announcement: `${exports.DEMO_DATA_TAG}: Demo Super Admin environment active — production records are strictly locked.`,
        supportEmail: 'demo-support@demo-sandbox.invalid',
        supportPhone: '0300-0000000',
        whatsappNumber: '923000000000',
        seoTitle: 'SB Khush Demo Platform',
        seoDescription: 'Demo environment for SB Khush multi-tenant commerce and sales management.',
        canonicalDomain: 'https://sbkhush.com',
        currency: 'PKR',
        currencySymbol: 'Rs.',
        easypaisaDetails: { enabled: true, accountTitle: 'SB Khush Demo Wallet', accountNumber: '0300-0000001' },
        jazzcashDetails: { enabled: true, accountTitle: 'SB Khush Demo Wallet', accountNumber: '0300-0000002' },
        bankDetails: {
            enabled: true,
            bankName: 'Demo Sandbox Bank Pakistan',
            accountTitle: 'SB KHUSH DEMO SANDBOX',
            accountNumber: '0000-1111-2222-3333',
            iban: 'PK00DEMO0000000011112222',
        },
        gracePeriodDays: 7,
        updatedAt: nowIso,
    });
    pushOp(['salesSettings', 'general'], {
        id: 'general',
        portalBaseUrl: 'https://sbkhush.com',
        defaultFirstSubRatePct: 20,
        defaultRenewalRatePct: 10,
        verifiedShopFlatBonus: 300,
        yearlyBonusExtraPct: 5,
        minPayoutThreshold: 2000,
        attributionWindowDays: 45,
        allowManualReferralEntry: true,
        preventSelfReferral: true,
        autoSyncCommissionOnPaymentApproval: true,
        commissionPlans: [
            { id: 'standard', name: 'Standard Partner (15%)', firstSubRatePct: 15, renewalRatePct: 8, verifiedShopBonus: 250, yearlyPlanBonusPct: 3, minRevenueForBonus: 50000, targetBonusAmount: 5000 },
            { id: 'growth', name: 'Growth Tier (20%)', firstSubRatePct: 20, renewalRatePct: 10, verifiedShopBonus: 400, yearlyPlanBonusPct: 5, minRevenueForBonus: 100000, targetBonusAmount: 10000 },
            { id: 'enterprise', name: 'Enterprise Partner (25%)', firstSubRatePct: 25, renewalRatePct: 12, verifiedShopBonus: 600, yearlyPlanBonusPct: 7, minRevenueForBonus: 200000, targetBonusAmount: 20000 },
        ],
        updatedAt: nowIso,
    });
    const managerSpecs = [
        { id: 'demo_sm_mgr_1', name: 'Bilal Tariq (Demo Manager)', city: 'Lahore', territory: 'Central Punjab' },
        { id: 'demo_sm_mgr_2', name: 'Sanaullah Khan (Demo Manager)', city: 'Karachi', territory: 'Sindh & South' },
    ];
    const repSpecs = [
        { id: 'demo_sm_rep_1', name: 'Hamza Raza (Demo)', role: 'senior_salesman', mIdx: 0, city: 'Lahore', territory: 'Lahore East', focus: 'general_store', target: 150000 },
        { id: 'demo_sm_rep_2', name: 'Zainab Fatima (Demo)', role: 'salesman', mIdx: 0, city: 'Faisalabad', territory: 'Faisalabad Hub', focus: 'clothing', target: 110000 },
        { id: 'demo_sm_rep_3', name: 'Usman Akram (Demo)', role: 'salesman', mIdx: 0, city: 'Chichawatni', territory: 'Sahiwal & Chichawatni', focus: 'all', target: 95000 },
        { id: 'demo_sm_rep_4', name: 'Ayesha Siddiqui (Demo)', role: 'senior_salesman', mIdx: 0, city: 'Islamabad', territory: 'Twin Cities', focus: 'cosmetics', target: 140000 },
        { id: 'demo_sm_rep_5', name: 'Kamran Qureshi (Demo)', role: 'salesman', mIdx: 1, city: 'Karachi', territory: 'Karachi South', focus: 'cosmetics', target: 120000 },
        { id: 'demo_sm_rep_6', name: 'Mariam Javed (Demo)', role: 'salesman', mIdx: 1, city: 'Hyderabad', territory: 'Interior Sindh', focus: 'general_store', target: 90000 },
        { id: 'demo_sm_rep_7', name: 'Fawad Mehmood (Demo)', role: 'salesman', mIdx: 1, city: 'Multan', territory: 'South Punjab', focus: 'clothing', target: 105000 },
        { id: 'demo_sm_rep_8', name: 'Hira Nawaz (Demo)', role: 'senior_salesman', mIdx: 1, city: 'Quetta', territory: 'West Zone', focus: 'other_retail', target: 115000 },
    ];
    const allSalesMembers = [
        ...managerSpecs.map((m, idx) => ({
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
            referralLink: `https://sbkhush.com/r/DMGR0${idx + 1}`,
            qrScanCount: 18 + idx * 7,
            inviteStatus: 'accepted',
            createdBy: exports.DEMO_ADMIN_EMAIL,
            createdAt: daysAgoIso(180),
            updatedAt: nowIso,
        })),
        ...repSpecs.map((s, idx) => {
            const mgr = managerSpecs[s.mIdx];
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
                teamId: `demo_team_${s.mIdx + 1}`,
                teamName: s.mIdx === 0 ? 'Punjab Growth Demo Team' : 'Karachi & South Demo Team',
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
                referralLink: `https://sbkhush.com/r/DREP0${idx + 1}`,
                qrScanCount: 24 + idx * 9,
                inviteStatus: 'accepted',
                createdBy: exports.DEMO_ADMIN_EMAIL,
                createdAt: daysAgoIso(120 - idx * 7),
                updatedAt: nowIso,
            };
        }),
    ];
    const referralAgents = [
        { name: 'Arslan Digital Hub (Demo Agent)', city: 'Lahore', code: 'DAGENT01' },
        { name: 'Karachi Merchants Network (Demo Agent)', city: 'Karachi', code: 'DAGENT02' },
        { name: 'Chichawatni Chamber Partner (Demo Agent)', city: 'Chichawatni', code: 'DAGENT03' },
        { name: 'Islamabad Retail Guild (Demo Agent)', city: 'Islamabad', code: 'DAGENT04' },
        { name: 'Multan Commerce Circle (Demo Agent)', city: 'Multan', code: 'DAGENT05' },
    ].map((a, idx) => ({
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
        referralLink: `https://sbkhush.com/r/${a.code}`,
        qrScanCount: 14 + idx * 6,
        inviteStatus: idx === 4 ? 'pending' : 'accepted',
        createdBy: exports.DEMO_ADMIN_EMAIL,
        createdAt: daysAgoIso(90 - idx * 5),
        updatedAt: nowIso,
    }));
    [...allSalesMembers, ...referralAgents].forEach((m) => {
        pushOp(['salesMembers', m.id], m);
        pushOp(['salesReferralIndex', m.referralCode], {
            referralCode: m.referralCode,
            salesmanId: m.id,
            salesmanUid: m.uid,
            salesmanName: m.fullName,
            role: m.role,
            accountStatus: m.accountStatus,
            qrScanCount: m.qrScanCount,
            isDemoData: true,
            demoTag: exports.DEMO_DATA_TAG,
            updatedAt: nowIso,
        });
    });
    [0, 1].forEach((mIdx) => {
        const mgr = managerSpecs[mIdx];
        pushOp(['salesTeams', `demo_team_${mIdx + 1}`], {
            id: `demo_team_${mIdx + 1}`,
            name: mIdx === 0 ? 'Punjab Growth Demo Team' : 'Karachi & South Demo Team',
            managerMemberId: mgr.id,
            managerUid: `demo_uid_${mgr.id}`,
            managerName: mgr.name,
            territory: mgr.territory,
            cities: mIdx === 0 ? ['Lahore', 'Faisalabad', 'Chichawatni', 'Islamabad'] : ['Karachi', 'Hyderabad', 'Multan', 'Quetta'],
            memberIds: repSpecs.filter((r) => r.mIdx === mIdx).map((r) => r.id),
            monthlyTeamTarget: 450000,
            description: `${exports.DEMO_DATA_TAG}: Demo regional team`,
            isActive: true,
            createdAt: daysAgoIso(150),
            updatedAt: nowIso,
        });
    });
    let globalCustIdx = 0;
    let globalOrdIdx = 0;
    const paidLedgersForPayout = [];
    for (let i = 0; i < 20; i++) {
        const tpl = DEMO_SHOP_TEMPLATES[i];
        const city = DEMO_CITIES[i];
        const shopId = tpl.slug;
        const plan = plans[i % plans.length];
        const cycle = i % 3 === 0 ? 'yearly' : 'monthly';
        const pricePaid = plan.monthlyPrice > 0 ? (cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice) : 0;
        const createdAt = daysAgoIso(60 - i * 2);
        const shopDoc = {
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
                heroTitle: tpl.name,
                heroSubtitle: `${exports.DEMO_DATA_TAG} — Curated ${tpl.type.replace('_', ' ')} catalog in ${city}`,
                showTestimonials: true,
                showBuyingGuide: true,
            },
            adminNotes: `${exports.DEMO_DATA_TAG}: Synthetic multi-tenant demo shop #${i + 1}`,
            lastActivityAt: daysAgoIso(i % 5),
            createdAt,
            updatedAt: nowIso,
        };
        pushOp(['shops', shopId], shopDoc);
        pushOp(['shops_public', shopId], {
            id: shopId,
            slug: tpl.slug,
            name: tpl.name,
            businessType: tpl.type,
            city,
            storefrontAddress: shopDoc.address,
            publicContactPhone: shopDoc.ownerPhone,
            publicSupportEmail: shopDoc.ownerEmail,
            status: tpl.status,
            theme: shopDoc.theme,
            createdAt,
            updatedAt: nowIso,
        });
        pushOp(['shop_slugs', tpl.slug], {
            slug: tpl.slug,
            shopId,
            ownerId: shopDoc.ownerId,
            name: tpl.name,
            createdAt,
        });
        pushOp(['shops', shopId, 'settings', 'public'], {
            siteName: tpl.name,
            primaryColor: '#065f46',
            accentColor: '#d97706',
            announcement: `${exports.DEMO_DATA_TAG}: Nationwide COD & Self-Pickup enabled for ${tpl.name}`,
            contactPhone: shopDoc.ownerPhone,
            whatsappNumber: shopDoc.ownerPhone,
            contactEmail: shopDoc.ownerEmail,
            address: shopDoc.address,
            city,
            shippingFee: 200,
            freeShippingThreshold: 3500,
            currency: 'PKR',
            currencySymbol: 'Rs.',
            codEnabled: true,
            selfPickupDetails: {
                enabled: i % 2 === 0,
                title: `${tpl.name} Pickup Counter`,
                address: shopDoc.address,
                city,
                timings: 'Mon – Sat: 11:00 AM – 8:00 PM',
                contactPhone: shopDoc.ownerPhone,
            },
            socialLinks: {},
        });
        const catalog = PRODUCT_CATALOG_BY_TYPE[tpl.type];
        const shopProducts = catalog.map((item, pIdx) => {
            const prod = {
                id: `demo_prod_${i + 1}_${pIdx + 1}`,
                shopId,
                title: `${item.title} (${city})`,
                slug: `${tpl.slug}-item-${pIdx + 1}`,
                description: `${exports.DEMO_DATA_TAG}: Synthetic product item #${pIdx + 1} for ${tpl.name}.`,
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
                rating: 4.5,
                reviewCount: 4 + pIdx * 2,
                createdAt,
                updatedAt: nowIso,
            };
            pushOp(['shops', shopId, 'products', prod.id], prod);
            return prod;
        });
        const custCount = i < 10 ? 3 : 2;
        const shopCustomers = [];
        for (let c = 0; c < custCount; c++) {
            globalCustIdx++;
            const custId = `demo_cust_${String(globalCustIdx).padStart(3, '0')}`;
            const cust = {
                id: custId,
                name: `Demo Customer ${globalCustIdx}`,
                email: `demo.customer${globalCustIdx}@demo-sandbox.invalid`,
                phone: `0310-5000${String(globalCustIdx).padStart(3, '0')}`,
                address: `Street ${globalCustIdx}, Sector ${c + 1}, ${city}`,
                city,
                ordersCount: 1 + (c % 2),
                totalSpent: 2800 + globalCustIdx * 190,
                outstandingBalance: c === 0 ? 0 : 450,
                notes: exports.DEMO_DATA_TAG,
                lastOrderAt: daysAgoIso(c + 1),
                createdAt: daysAgoIso(25 - c),
            };
            shopCustomers.push(cust);
            pushOp(['shops', shopId, 'customers', custId], cust);
        }
        const ordCount = i < 10 ? 2 : 1;
        const statuses = ['Pending', 'Confirmed', 'Preparing', 'Delivered', 'Collected', 'Shipped'];
        for (let o = 0; o < ordCount; o++) {
            globalOrdIdx++;
            const cust = shopCustomers[o % shopCustomers.length];
            const prod = shopProducts[o % shopProducts.length];
            const unitPrice = prod.salePrice || prod.regularPrice;
            const qty = 1 + (globalOrdIdx % 2);
            const isPickup = globalOrdIdx % 3 === 0;
            const shippingFee = isPickup ? 0 : 200;
            const ordId = `demo_ord_${String(globalOrdIdx).padStart(3, '0')}`;
            const orderStatus = isPickup ? (o === 0 ? 'Ready for Pickup' : 'Collected') : statuses[globalOrdIdx % statuses.length];
            pushOp(['shops', shopId, 'orders', ordId], {
                id: ordId,
                shopId,
                orderNumber: `DM-${100000 + globalOrdIdx}`,
                userId: cust.id,
                customer: {
                    name: cust.name,
                    email: cust.email,
                    phone: cust.phone,
                    address: cust.address,
                    city: cust.city,
                    postalCode: '54000',
                },
                items: [{ productId: prod.id, title: prod.title, price: unitPrice, quantity: qty, image: '' }],
                subtotal: unitPrice * qty,
                shippingFee,
                discount: 0,
                total: unitPrice * qty + shippingFee,
                fulfillmentMethod: isPickup ? 'self_pickup' : 'delivery',
                pickupStatus: isPickup ? (orderStatus === 'Collected' ? 'Picked Up' : 'Ready for Pickup') : undefined,
                paymentMethod: globalOrdIdx % 4 === 0 ? 'easypaisa' : 'cod',
                paymentStatus: orderStatus === 'Delivered' || orderStatus === 'Collected' ? 'paid' : 'pending',
                orderStatus,
                notes: exports.DEMO_DATA_TAG,
                createdAt: daysAgoIso(globalOrdIdx % 14),
                updatedAt: nowIso,
            });
        }
        if (i < 15) {
            const sourceMember = i < 11 ? allSalesMembers[2 + (i % 8)] : referralAgents[i % 4];
            const payId = `demo_pay_${String(i + 1).padStart(3, '0')}`;
            const payAmount = pricePaid > 0 ? pricePaid : 1990;
            const isPending = i >= 12;
            pushOp(['referralAttributions', shopId], {
                id: shopId,
                referralCode: sourceMember.referralCode,
                salesmanId: sourceMember.id,
                salesmanUid: sourceMember.uid,
                salesmanName: sourceMember.fullName,
                shopId,
                shopSlug: shopDoc.slug,
                shopName: shopDoc.name,
                ownerId: shopDoc.ownerId,
                ownerEmail: shopDoc.ownerEmail,
                city,
                industry: tpl.type,
                source: i % 2 === 0 ? 'referral_link' : 'qr_scan',
                attributionStatus: isPending ? 'registered' : 'subscribed',
                firstPaymentId: payId,
                totalRevenueGenerated: isPending ? 0 : payAmount,
                createdAt,
                updatedAt: nowIso,
            });
            pushOp(['platform_payments', payId], {
                id: payId,
                shopId,
                shopName: shopDoc.name,
                shopSlug: shopDoc.slug,
                ownerId: shopDoc.ownerId,
                ownerEmail: shopDoc.ownerEmail,
                planId: plan.id,
                planName: plan.name,
                billingCycle: cycle,
                amount: payAmount,
                method: i % 3 === 0 ? 'bank_transfer' : i % 2 === 0 ? 'easypaisa' : 'jazzcash',
                transactionId: `DEMO-TID-${10000 + i}`,
                senderNumber: shopDoc.ownerPhone,
                proofUrl: '',
                notes: exports.DEMO_DATA_TAG,
                status: isPending ? 'pending' : i === 11 ? 'rejected' : 'approved',
                reviewedBy: isPending ? undefined : exports.DEMO_ADMIN_EMAIL,
                reviewedAt: isPending ? undefined : daysAgoIso(10 - (i % 8)),
                createdAt: daysAgoIso(12 - (i % 10)),
            });
            if (!isPending && i < 12) {
                const ratePct = sourceMember.role === 'senior_salesman' ? 25 : 15;
                const commAmt = Math.round((payAmount * ratePct) / 100) + 250;
                const isPaid = i < 4;
                const isApproved = i >= 4 && i < 9;
                const ledger = {
                    id: `demo_comm_${String(i + 1).padStart(3, '0')}`,
                    salesmanId: sourceMember.id,
                    salesmanUid: sourceMember.uid,
                    salesmanName: sourceMember.fullName,
                    shopId,
                    shopName: shopDoc.name,
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
                    approvedBy: isPaid || isApproved ? exports.DEMO_ADMIN_EMAIL : undefined,
                    approvedAt: isPaid || isApproved ? daysAgoIso(6) : undefined,
                    paidAt: isPaid ? daysAgoIso(2) : undefined,
                    createdAt: daysAgoIso(9),
                    updatedAt: nowIso,
                };
                if (isPaid)
                    paidLedgersForPayout.push(ledger);
                pushOp(['commissionLedger', ledger.id], ledger);
            }
        }
    }
    paidLedgersForPayout.forEach((ledger, idx) => {
        pushOp(['commissionPayouts', `demo_payout_${idx + 1}`], {
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
            notes: exports.DEMO_DATA_TAG,
            status: 'processed',
            processedBy: exports.DEMO_ADMIN_EMAIL,
            processedAt: daysAgoIso(2 + idx),
            createdAt: daysAgoIso(2 + idx),
        });
    });
    const leadStatuses = ['New', 'Assigned', 'Contacted', 'Interested', 'Follow-up Required', 'Demo Scheduled', 'Negotiation', 'Converted', 'Contacted', 'Follow-up Required', 'Interested', 'Converted'];
    leadStatuses.forEach((status, idx) => {
        const rep = allSalesMembers[2 + (idx % 8)];
        const leadId = `demo_lead_${String(idx + 1).padStart(3, '0')}`;
        pushOp(['salesLeads', leadId], {
            id: leadId,
            businessName: `Demo Prospect Store ${idx + 1}`,
            ownerName: `Prospect Merchant ${idx + 1}`,
            phone: `0321-7000${String(idx + 1).padStart(3, '0')}`,
            normalizedPhone: `03217000${String(idx + 1).padStart(3, '0')}`,
            email: `demo.prospect${idx + 1}@demo-sandbox.invalid`,
            normalizedEmail: `demo.prospect${idx + 1}@demo-sandbox.invalid`,
            city: DEMO_CITIES[idx % DEMO_CITIES.length],
            industry: ['general_store', 'cosmetics', 'clothing', 'other_retail'][idx % 4],
            assignedSalesmanId: rep.id,
            assignedSalesmanUid: rep.uid,
            assignedSalesmanName: rep.fullName,
            assignedManagerId: rep.assignedManagerId,
            assignedManagerUid: rep.assignedManagerUid,
            leadSource: idx % 2 === 0 ? 'field_visit' : 'whatsapp',
            nextFollowUpDate: daysAheadIso(1 + (idx % 4)).slice(0, 10),
            notes: `${exports.DEMO_DATA_TAG}: Synthetic pipeline prospect #${idx + 1}`,
            status,
            createdBy: exports.DEMO_ADMIN_EMAIL,
            createdAt: daysAgoIso(15 - idx),
            updatedAt: nowIso,
        });
    });
    const periodKey = nowIso.slice(0, 7);
    allSalesMembers.forEach((m, idx) => {
        pushOp(['salesTargets', `demo_target_${m.id}_${periodKey}`], {
            id: `demo_target_${m.id}_${periodKey}`,
            salesmanId: m.id,
            salesmanUid: m.uid,
            salesmanName: m.fullName,
            periodType: 'monthly',
            periodKey,
            dailyActivityTarget: 8,
            weeklyLeadTarget: 10,
            monthlyRegistrationTarget: 8,
            monthlyPaidSubscriptionTarget: 5,
            revenueTarget: m.monthlyTarget,
            conversionTarget: 35,
            bonusAmount: 10000 + idx * 1000,
            bonusThresholdPct: 100,
            notes: exports.DEMO_DATA_TAG,
            updatedBy: exports.DEMO_ADMIN_EMAIL,
            createdAt: daysAgoIso(20),
            updatedAt: nowIso,
        });
    });
    for (let idx = 0; idx < 16; idx++) {
        const rep = allSalesMembers[2 + (idx % 8)];
        pushOp(['salesActivities', `demo_act_${String(idx + 1).padStart(3, '0')}`], {
            id: `demo_act_${String(idx + 1).padStart(3, '0')}`,
            salesmanId: rep.id,
            salesmanUid: rep.uid,
            salesmanName: rep.fullName,
            leadId: `demo_lead_${String((idx % 12) + 1).padStart(3, '0')}`,
            leadName: `Demo Prospect Store ${(idx % 12) + 1}`,
            activityType: idx % 3 === 0 ? 'Business visit' : idx % 3 === 1 ? 'Product demo' : 'WhatsApp follow-up',
            activityDateTime: daysAgoIso(idx % 10, idx % 5),
            notes: `${exports.DEMO_DATA_TAG}: Demo check-in`,
            resultStatus: idx % 4 === 0 ? 'converted' : 'positive',
            createdAt: daysAgoIso(idx % 10),
        });
    }
    for (let idx = 0; idx < 10; idx++) {
        const m = allSalesMembers[idx];
        pushOp(['salesQrEvents', `demo_qr_${String(idx + 1).padStart(3, '0')}`], {
            id: `demo_qr_${String(idx + 1).padStart(3, '0')}`,
            salesmanId: m.id,
            referralCode: m.referralCode,
            source: idx % 2 === 0 ? 'qr_scan' : 'referral_link',
            createdAt: daysAgoIso(idx + 1),
        });
    }
    for (let idx = 0; idx < 5; idx++) {
        pushOp(['support_tickets', `demo_tkt_${idx + 1}`], {
            id: `demo_tkt_${idx + 1}`,
            shopId: DEMO_SHOP_TEMPLATES[idx].slug,
            shopName: DEMO_SHOP_TEMPLATES[idx].name,
            userId: `demo_owner_${idx + 1}`,
            userEmail: `demo.merchant${idx + 1}@demo-sandbox.invalid`,
            subject: `[DEMO] Sample merchant inquiry #${idx + 1}`,
            category: idx % 2 === 0 ? 'billing' : 'onboarding',
            priority: idx % 3 === 0 ? 'high' : 'medium',
            message: `${exports.DEMO_DATA_TAG}: Synthetic support ticket for ${DEMO_SHOP_TEMPLATES[idx].name}.`,
            status: idx === 3 ? 'resolved' : 'open',
            createdAt: daysAgoIso(idx),
        });
    }
    for (let idx = 0; idx < 10; idx++) {
        pushOp(['platform_activity_logs', `demo_plog_${idx + 1}`], {
            id: `demo_plog_${idx + 1}`,
            actorId: 'demo_admin',
            actorEmail: exports.DEMO_ADMIN_EMAIL,
            action: idx % 2 === 0 ? 'Demo Shop Audited' : 'Demo Payment Reviewed',
            targetType: idx % 2 === 0 ? 'shop' : 'payment',
            targetId: DEMO_SHOP_TEMPLATES[idx].slug,
            details: `${exports.DEMO_DATA_TAG}: Synthetic audit trail record #${idx + 1}`,
            createdAt: daysAgoIso(idx),
        });
    }
    pushOp(['salesAuditLogs', 'demo_slog_1'], {
        id: 'demo_slog_1',
        actorUid: 'demo_admin',
        actorEmail: exports.DEMO_ADMIN_EMAIL,
        actorRole: 'super_admin',
        action: 'Seeded Demo Sales Team',
        entityType: 'sales_member',
        entityId: 'demo_team_1',
        details: `${exports.DEMO_DATA_TAG}: Initialized isolated sales & referral demo dataset`,
        createdAt: daysAgoIso(1),
    });
    return ops;
}
//# sourceMappingURL=demoSeed.js.map
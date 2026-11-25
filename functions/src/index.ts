import * as crypto from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_DISPLAY_NAME,
  DEMO_ACCOUNT_TYPE,
  DEMO_ENV_ROOT,
  DEMO_ENV_ID,
  DEMO_DATA_TAG,
  buildDemoAdminWriteOperations,
} from './demoSeed';

setGlobalOptions({ region: 'us-central1' });

const cnicHmacSecret = defineSecret('CNIC_HMAC_SECRET');

const app = initializeApp();
const FIRESTORE_DB_ID =
  process.env.FIRESTORE_DATABASE_ID ||
  'ai-studio-bazaarpkecommerc-94c8ec32-7dba-4ff3-a6e4-6aa9072c863c';
const db = getFirestore(app, FIRESTORE_DB_ID);
const auth = getAuth(app);
const storage = getStorage(app);

const SUPER_ADMIN_EMAIL = 'hasanaamir815@gmail.com';
const DUPLICATE_CNIC_ERROR_MESSAGE =
  'This CNIC is already associated with a registered SB Khush shop. Only one shop can be registered against one CNIC. Please contact SB Khush Support if you believe this is an error.';
const CNIC_AUDIT_BLOCK_MESSAGE =
  'Your existing SB Khush shop account has a pending CNIC verification audit. Please contact SB Khush Support or complete CNIC verification before registering another store.';

function normalizeCnicServer(input: unknown): string {
  return String(input || '').replace(/\D/g, '').slice(0, 13);
}

function isValidCnicServer(normalized: string): boolean {
  return /^\d{13}$/.test(normalized) && !/^(\d)\1{12}$/.test(normalized);
}

function maskCnicServer(normalized: string): string {
  if (normalized.length !== 13) return '';
  return `XXXXX-XXXX${normalized.slice(9, 12)}-${normalized.slice(12, 13)}`;
}

function getFunctionsCnicHmacSecret(): string {
  const configured = String(cnicHmacSecret.value() || process.env.CNIC_HMAC_SECRET || '').trim();
  if (configured) return configured;
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return 'dev-local-cnic-hmac-fallback';
  }
  throw new HttpsError('failed-precondition', 'Server CNIC verification secret (CNIC_HMAC_SECRET) is not configured.');
}

function computeCnicHmacServer(normalizedCnic: string): string {
  const secret = getFunctionsCnicHmacSecret();
  return crypto.createHmac('sha256', secret).update(normalizedCnic).digest('hex');
}

const RESERVED_SLUGS = new Set([
  'admin', 'super-admin', 'dashboard', 'login', 'merchant', 'register', 'api',
  's', 'shop', 'cart', 'checkout', 'account', 'tracking',
  'platform', 'pricing', 'about', 'faq', 'terms', 'privacy',
  'privacy-policy', 'terms-and-conditions', 'contact',
  'salesman', 'sales-manager', 'referral', 'r',
]);

function resolveCleanSlug(shopId: string, candidate?: unknown): string {
  for (const raw of [candidate, shopId]) {
    const clean = String(raw || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
    if (clean.length >= 2 && clean.length <= 60 && !RESERVED_SLUGS.has(clean)) {
      return clean;
    }
  }
  return `store-${shopId.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`.slice(0, 50);
}

function stripUndefinedFields(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function toCleanShopPublic(
  shopId: string,
  shopData: Record<string, any>,
  existingPublic: Record<string, any> | undefined,
  status: 'active' | 'inactive' | 'suspended',
  nowIso: string
): Record<string, any> {
  return stripUndefinedFields({
    id: shopId,
    slug: resolveCleanSlug(shopId, shopData.slug || existingPublic?.slug),
    name: String(shopData.name || existingPublic?.name || shopId).trim() || shopId,
    businessType: shopData.businessType ?? existingPublic?.businessType,
    logoUrl: shopData.logoUrl ?? existingPublic?.logoUrl ?? '',
    city: shopData.city ?? existingPublic?.city ?? '',
    publicContactPhone: shopData.publicContactPhone ?? existingPublic?.publicContactPhone,
    publicSupportEmail: shopData.publicSupportEmail ?? existingPublic?.publicSupportEmail,
    storefrontAddress: shopData.storefrontAddress ?? existingPublic?.storefrontAddress ?? shopData.address,
    businessHours: shopData.businessHours ?? existingPublic?.businessHours,
    seoTitle: shopData.seoTitle ?? existingPublic?.seoTitle,
    seoDescription: shopData.seoDescription ?? existingPublic?.seoDescription,
    ogImageUrl: shopData.ogImageUrl ?? existingPublic?.ogImageUrl,
    websiteUrl: shopData.websiteUrl ?? existingPublic?.websiteUrl,
    socialLinks: shopData.socialLinks ?? existingPublic?.socialLinks,
    theme: shopData.theme ?? existingPublic?.theme,
    status,
    createdAt: shopData.createdAt ?? existingPublic?.createdAt,
    updatedAt: nowIso,
  });
}

function isDemoIdentity(email?: string | null, tokenClaims?: Record<string, any> | null): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  return (
    normalized === DEMO_ADMIN_EMAIL ||
    tokenClaims?.demo_super_admin === true ||
    tokenClaims?.account_type === DEMO_ACCOUNT_TYPE
  );
}

async function assertSuperAdmin(uid?: string, email?: string, emailVerified?: boolean, tokenClaims?: Record<string, any>) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (isDemoIdentity(email, tokenClaims)) {
    throw new HttpsError(
      'permission-denied',
      'Demo Super Admin accounts are strictly isolated and cannot access production Super Admin endpoints.'
    );
  }
  if (tokenClaims?.super_admin === true) return;
  if (email === SUPER_ADMIN_EMAIL && emailVerified) return;

  const adminSnap = await db.collection('platform_admins').doc(uid).get();
  if (adminSnap.exists) return;

  const legacyAdminSnap = await db.collection('admins').doc(uid).get();
  if (legacyAdminSnap.exists && legacyAdminSnap.data()?.role === 'super_admin') return;

  throw new HttpsError('permission-denied', 'Super Admin privileges required.');
}

async function rebuildCustomClaimsForUser(
  uid: string
): Promise<{ super_admin: boolean; shops: Record<string, string>; sales_role: string | null }> {
  const userRecord = await auth.getUser(uid);
  if (isDemoIdentity(userRecord.email, userRecord.customClaims)) {
    const demoClaims = {
      super_admin: false,
      demo_super_admin: true,
      account_type: DEMO_ACCOUNT_TYPE,
      demo_scope: `${DEMO_ENV_ROOT}/${DEMO_ENV_ID}`,
      shops: {},
      sales_role: null,
    };
    await auth.setCustomUserClaims(uid, demoClaims);
    return { super_admin: false, shops: {}, sales_role: null };
  }

  const [adminSnap, legacyAdminSnap] = await Promise.all([
    db.collection('platform_admins').doc(uid).get(),
    db.collection('admins').doc(uid).get(),
  ]);
  const isSuper =
    adminSnap.exists ||
    (legacyAdminSnap.exists && legacyAdminSnap.data()?.role === 'super_admin') ||
    (userRecord.email === SUPER_ADMIN_EMAIL && Boolean(userRecord.emailVerified));

  const membershipsSnap = await db.collection('users').doc(uid).collection('shopMemberships').get();
  const shops: Record<string, string> = {};
  membershipsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data?.role && ['shop_owner', 'shop_admin', 'shop_staff'].includes(data.role)) {
      shops[docSnap.id] = data.role;
    }
  });

  // Never allow super_admin role to originate from salesMembers
  let salesRole: string | null = null;
  const salesSnap = await db.collection('salesMembers').where('uid', '==', uid).limit(1).get();
  if (!salesSnap.empty) {
    const sData = salesSnap.docs[0].data();
    if (
      sData &&
      ['active', 'invited'].includes(sData.accountStatus) &&
      ['salesman', 'senior_salesman', 'sales_manager', 'referral_agent'].includes(sData.role)
    ) {
      salesRole = sData.role;
    }
  }

  const existingClaims = userRecord.customClaims || {};
  const preservedClaims: Record<string, any> = {};
  for (const [k, v] of Object.entries(existingClaims)) {
    if (!['super_admin', 'shops', 'sales_role', 'shopsTruncated'].includes(k)) {
      preservedClaims[k] = v;
    }
  }

  // Enforce Firebase Auth custom claims 1000-byte ceiling safely
  const boundedShops: Record<string, string> = {};
  let shopsTruncated = false;
  for (const [sId, role] of Object.entries(shops)) {
    const candidatePayload = {
      ...preservedClaims,
      super_admin: isSuper,
      sales_role: salesRole,
      shops: { ...boundedShops, [sId]: role },
      shopsTruncated: false,
    };
    if (Buffer.byteLength(JSON.stringify(candidatePayload), 'utf8') <= 900) {
      boundedShops[sId] = role;
    } else {
      shopsTruncated = true;
    }
  }

  const nextClaims = {
    ...preservedClaims,
    super_admin: isSuper,
    shops: boundedShops,
    sales_role: salesRole,
    ...(shopsTruncated ? { shopsTruncated: true } : {}),
  };

  await auth.setCustomUserClaims(uid, nextClaims);

  return { super_admin: isSuper, shops: boundedShops, sales_role: salesRole };
}

/**
 * Automatically keep Firebase Auth Custom Claims (`super_admin`, `shops`, `sales_role`) synchronized
 * whenever platform_admins, shop staff, or salesMembers change so storage.rules & firestore.rules
 * verify tenant & platform authorization without stale tokens.
 */
export const onPlatformAdminWritten = onDocumentWritten(
  {
    document: 'platform_admins/{adminId}',
    database: FIRESTORE_DB_ID,
  },
  async (event) => {
    const adminId = event.params.adminId;
    try {
      await rebuildCustomClaimsForUser(adminId);
    } catch (err) {
      console.error('Failed syncing super_admin claim:', adminId, err);
    }
  }
);

export const onShopStaffWritten = onDocumentWritten(
  {
    document: 'shops/{shopId}/staff/{staffUid}',
    database: FIRESTORE_DB_ID,
  },
  async (event) => {
    const staffUid = event.params.staffUid;
    try {
      await rebuildCustomClaimsForUser(staffUid);
    } catch (err) {
      console.error('Failed syncing custom claims for staff:', staffUid, err);
    }
  }
);

export const onSalesMemberWritten = onDocumentWritten(
  {
    document: 'salesMembers/{memberId}',
    database: FIRESTORE_DB_ID,
  },
  async (event) => {
    const afterUid = event.data?.after.data()?.uid as string | undefined;
    const beforeUid = event.data?.before.data()?.uid as string | undefined;
    const targetUid = afterUid || beforeUid;
    if (!targetUid) return;
    try {
      await rebuildCustomClaimsForUser(targetUid);
    } catch (err) {
      console.error('Failed syncing sales_role custom claims for member:', targetUid, err);
    }
  }
);

export const syncMyCustomClaims = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
  return rebuildCustomClaimsForUser(request.auth.uid);
});

/**
 * Idempotent Transactional Payment Approval:
 * Prevents duplicate concurrent approvals from double-extending expiry dates.
 */
export const approvePlatformPayment = onCall(async (request) => {
  await assertSuperAdmin(
    request.auth?.uid,
    request.auth?.token?.email,
    request.auth?.token?.email_verified,
    request.auth?.token
  );

  const paymentId = String(request.data?.paymentId || '').trim();
  if (!paymentId) throw new HttpsError('invalid-argument', 'paymentId is required.');

  const paymentRef = db.collection('platform_payments').doc(paymentId);
  const now = new Date();
  const nowIso = now.toISOString();

  const result = await db.runTransaction(async (tx) => {
    const paySnap = await tx.get(paymentRef);
    if (!paySnap.exists) {
      throw new HttpsError('not-found', 'Payment record not found.');
    }
    const payment = paySnap.data()!;
    if (payment.status !== 'pending') {
      throw new HttpsError(
        'failed-precondition',
        `Payment ${paymentId} has already been processed (${payment.status}).`
      );
    }

    const shopRef = db.collection('shops').doc(payment.shopId);
    const shopPublicRef = db.collection('shops_public').doc(payment.shopId);
    const [shopSnap, shopPublicSnap, planSnap] = await Promise.all([
      tx.get(shopRef),
      tx.get(shopPublicRef),
      tx.get(db.collection('platform_plans').doc(payment.planId)),
    ]);
    if (!shopSnap.exists) {
      throw new HttpsError('not-found', `Shop ${payment.shopId} not found.`);
    }

    const planData = planSnap.exists ? planSnap.data() : null;
    const cycleDays =
      payment.billingCycle === 'yearly' ? 365 : Number(planData?.durationDays || 30);

    const shopData = shopSnap.data()!;
    const existingPublic = shopPublicSnap.exists ? shopPublicSnap.data() : undefined;
    const currentSub = shopData.subscription || {};
    const currentExpiry = currentSub.expiryDate ? new Date(currentSub.expiryDate) : now;
    // Renewal on same plan extends from existing unexpired date; upgrade starts fresh or extends cleanly
    const isSamePlanActive =
      currentSub.planId === payment.planId &&
      currentSub.status === 'active' &&
      currentExpiry > now;
    const baseTime = isSamePlanActive ? currentExpiry.getTime() : now.getTime();
    const nextExpiryIso = new Date(baseTime + cycleDays * 86400000).toISOString();

    tx.update(paymentRef, {
      status: 'approved',
      reviewedBy: request.auth?.token?.email || 'Super Admin',
      reviewedAt: nowIso,
    });

    tx.update(shopRef, {
      status: 'active',
      subscription: {
        planId: payment.planId,
        planName: payment.planName,
        status: 'active',
        billingCycle: payment.billingCycle,
        pricePaid: Number(payment.amount || 0),
        startDate: isSamePlanActive && currentSub.startDate ? currentSub.startDate : nowIso,
        expiryDate: nextExpiryIso,
        isFreeOverride: false,
      },
      updatedAt: nowIso,
    });

    tx.set(
      shopPublicRef,
      toCleanShopPublic(payment.shopId, shopData, existingPublic, 'active', nowIso)
    );

    const logId = `plog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    tx.set(db.collection('platform_activity_logs').doc(logId), {
      id: logId,
      actorId: request.auth?.uid,
      actorEmail: request.auth?.token?.email || 'Super Admin',
      action: 'Approved Payment',
      targetType: 'payment',
      targetId: paymentId,
      details: `Atomically approved Rs. ${payment.amount} for ${payment.shopName} (${payment.planName})`,
      createdAt: nowIso,
    });

    return { ok: true, shopId: payment.shopId, expiryDate: nextExpiryIso };
  });

  return result;
});

export const rejectPlatformPayment = onCall(async (request) => {
  await assertSuperAdmin(
    request.auth?.uid,
    request.auth?.token?.email,
    request.auth?.token?.email_verified,
    request.auth?.token
  );
  const paymentId = String(request.data?.paymentId || '').trim();
  const reason = String(request.data?.reason || 'Payment verification failed or TID invalid.').trim();
  if (!paymentId) throw new HttpsError('invalid-argument', 'paymentId is required.');

  const paymentRef = db.collection('platform_payments').doc(paymentId);
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(paymentRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Payment not found.');
    const paymentData = snap.data()!;
    if (paymentData.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Payment was already processed.');
    }
    tx.update(paymentRef, {
      status: 'rejected',
      rejectionReason: reason,
      reviewedBy: request.auth?.token?.email || 'Super Admin',
      reviewedAt: nowIso,
    });
    const logId = `plog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    tx.set(db.collection('platform_activity_logs').doc(logId), {
      id: logId,
      actorId: request.auth?.uid || 'super_admin',
      actorEmail: request.auth?.token?.email || 'Super Admin',
      action: 'Rejected Payment',
      targetType: 'payment',
      targetId: paymentId,
      details: `Rejected Rs. ${paymentData.amount || 0} for ${paymentData.shopName || paymentData.shopId}: ${reason}`,
      createdAt: nowIso,
    });
  });

  return { ok: true };
});

export const updateShopStatusAdmin = onCall(async (request) => {
  await assertSuperAdmin(
    request.auth?.uid,
    request.auth?.token?.email,
    request.auth?.token?.email_verified,
    request.auth?.token
  );
  const shopId = String(request.data?.shopId || '').trim();
  const status = String(request.data?.status || '').trim() as 'active' | 'inactive' | 'suspended';
  if (!shopId || !['active', 'inactive', 'suspended'].includes(status)) {
    throw new HttpsError('invalid-argument', 'Valid shopId and status required.');
  }

  const [shopSnap, pubSnap] = await Promise.all([
    db.collection('shops').doc(shopId).get(),
    db.collection('shops_public').doc(shopId).get(),
  ]);
  if (!shopSnap.exists) {
    throw new HttpsError('not-found', `Shop ${shopId} not found.`);
  }

  const nowIso = new Date().toISOString();
  const batch = db.batch();
  batch.update(db.collection('shops').doc(shopId), { status, updatedAt: nowIso });
  batch.set(
    db.collection('shops_public').doc(shopId),
    toCleanShopPublic(shopId, shopSnap.data()!, pubSnap.exists ? pubSnap.data() : undefined, status, nowIso)
  );
  await batch.commit();
  return { ok: true, status };
});

export const assignShopSubscriptionAdmin = onCall(async (request) => {
  await assertSuperAdmin(
    request.auth?.uid,
    request.auth?.token?.email,
    request.auth?.token?.email_verified,
    request.auth?.token
  );
  const { shopId, planId, billingCycle, durationDays, isFreeOverride, status, pricePaid } = request.data || {};
  if (!shopId || !planId) {
    throw new HttpsError('invalid-argument', 'shopId and planId are required.');
  }

  const cleanShopId = String(shopId).trim();
  const [planSnap, shopSnap, pubSnap] = await Promise.all([
    db.collection('platform_plans').doc(String(planId)).get(),
    db.collection('shops').doc(cleanShopId).get(),
    db.collection('shops_public').doc(cleanShopId).get(),
  ]);
  if (!planSnap.exists) throw new HttpsError('not-found', 'Plan not found.');
  if (!shopSnap.exists) throw new HttpsError('not-found', `Shop ${cleanShopId} not found.`);
  const plan = planSnap.data()!;

  const days = Number(durationDays) || (billingCycle === 'yearly' ? 365 : Number(plan.durationDays || 30));
  const now = new Date();
  const nowIso = now.toISOString();
  const expiryIso = new Date(now.getTime() + days * 86400000).toISOString();

  const batch = db.batch();
  batch.update(db.collection('shops').doc(cleanShopId), {
    status: 'active',
    subscription: {
      planId: plan.id,
      planName: plan.name,
      status: status || 'active',
      billingCycle: billingCycle || 'monthly',
      pricePaid: isFreeOverride ? 0 : Number(pricePaid ?? (billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice)),
      startDate: nowIso,
      expiryDate: expiryIso,
      isFreeOverride: Boolean(isFreeOverride),
    },
    updatedAt: nowIso,
  });

  batch.set(
    db.collection('shops_public').doc(cleanShopId),
    toCleanShopPublic(cleanShopId, shopSnap.data()!, pubSnap.exists ? pubSnap.data() : undefined, 'active', nowIso)
  );
  await batch.commit();
  return { ok: true, expiryDate: expiryIso };
});

export const registerShopWithCnic = onCall({ secrets: [cnicHmacSecret] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Please sign in before registering a shop.');
  }
  if (isDemoIdentity(request.auth?.token?.email, request.auth?.token)) {
    throw new HttpsError('permission-denied', 'Demo accounts cannot register production stores.');
  }

  const data = (request.data || {}) as Record<string, any>;
  const shopName = String(data.shopName || '').trim();
  const rawSlug = String(data.shopSlug || '').trim();
  const ownerName = String(data.ownerName || '').trim();
  const ownerEmail = String(data.ownerEmail || request.auth?.token?.email || '').trim().toLowerCase();
  const ownerPhone = String(data.ownerPhone || '').trim();
  const city = String(data.city || '').trim();
  const address = String(data.address || '').trim();
  const businessType = ['general_store', 'cosmetics', 'clothing', 'other_retail'].includes(data.businessType)
    ? data.businessType
    : 'general_store';

  const normalizedCnic = normalizeCnicServer(data.cnic);
  if (!isValidCnicServer(normalizedCnic)) {
    throw new HttpsError('invalid-argument', 'Please enter a valid 13-digit Pakistani CNIC (XXXXX-XXXXXXX-X).');
  }
  if (!shopName || !ownerName || !ownerEmail || !ownerPhone || !city || !address) {
    throw new HttpsError('invalid-argument', 'Shop name, owner details, city, address, and CNIC are all required.');
  }

  const cleanSlug = rawSlug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  if (cleanSlug.length < 3 || !/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(cleanSlug) || RESERVED_SLUGS.has(cleanSlug)) {
    throw new HttpsError('invalid-argument', 'Invalid or reserved shop URL slug.');
  }

  const hmacKey = computeCnicHmacServer(normalizedCnic);
  const cnicMasked = maskCnicServer(normalizedCnic);
  const cnicLast4 = normalizedCnic.slice(-4);
  const shopId = cleanSlug;

  // Enforce CNIC audit rule on legacy owners who have an existing shop missing CNIC
  const ownedSnap = await db.collection('shops').where('ownerId', '==', uid).get();
  const hasPendingAuditShop = ownedSnap.docs.some((docSnap) => {
    const s = docSnap.data() || {};
    return !s.cnicHash && s.cnicStatus !== 'released';
  });
  if (hasPendingAuditShop) {
    throw new HttpsError('failed-precondition', CNIC_AUDIT_BLOCK_MESSAGE);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const cnicRef = db.collection('cnic_registry').doc(hmacKey);
  const slugRef = db.collection('shop_slugs').doc(cleanSlug);
  const shopRef = db.collection('shops').doc(shopId);
  const shopPubRef = db.collection('shops_public').doc(shopId);
  const planRef = db.collection('platform_plans').doc('free-starter');

  const newShop = await db.runTransaction(async (tx) => {
    const [cnicSnap, slugSnap, existingShopSnap, planSnap] = await Promise.all([
      tx.get(cnicRef),
      tx.get(slugRef),
      tx.get(shopRef),
      tx.get(planRef),
    ]);

    if (cnicSnap.exists && cnicSnap.data()?.status !== 'released') {
      throw new HttpsError('already-exists', DUPLICATE_CNIC_ERROR_MESSAGE);
    }
    if (slugSnap.exists || existingShopSnap.exists) {
      throw new HttpsError('already-exists', 'This shop URL slug is already taken.');
    }

    const planData = planSnap.exists ? planSnap.data() : null;
    const expiryIso = new Date(
      now.getTime() + (Number(planData?.durationDays) || 36500) * 86400000
    ).toISOString();

    const shopDoc = {
      id: shopId,
      slug: cleanSlug,
      name: shopName,
      businessType,
      ownerId: uid,
      ownerName,
      ownerEmail,
      ownerPhone,
      city,
      address,
      logoUrl: '',
      status: 'active' as const,
      cnicMasked,
      cnicLast4,
      cnicHash: hmacKey,
      cnicVerified: true,
      cnicStatus: 'verified' as const,
      cnicUpdatedAt: nowIso,
      subscription: {
        planId: planData?.id || 'free-starter',
        planName: planData?.name || 'Free Plan',
        status: 'active',
        billingCycle: 'monthly',
        pricePaid: 0,
        startDate: nowIso,
        expiryDate: expiryIso,
        autoRenew: false,
      },
      usage: {
        productsCount: 0,
        ordersCount: 0,
        storageBytes: 0,
        staffCount: 1,
      },
      theme: {
        primaryColor: '#065f46',
        accentColor: '#d97706',
        heroTitle: `Welcome to ${shopName}`,
        heroSubtitle: 'Authentic curated essentials delivered across Pakistan with Cash on Delivery & Self-Pickup.',
        showTestimonials: true,
        showBuyingGuide: Boolean(planData?.features?.buyingGuide),
      },
      onboardingChecklist: {
        accountCreated: true,
        logoUploaded: false,
        paymentConfigured: false,
        firstProductAdded: false,
      },
      lastActivityAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    tx.set(cnicRef, {
      hmacKey,
      ownerId: uid,
      shopId,
      shopName,
      cnicMasked,
      cnicLast4,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    tx.set(slugRef, {
      slug: cleanSlug,
      shopId,
      ownerId: uid,
      name: shopName,
      createdAt: nowIso,
    });

    tx.set(shopRef, shopDoc);
    tx.set(shopPubRef, toCleanShopPublic(shopId, shopDoc, undefined, 'active', nowIso));

    tx.set(shopRef.collection('staff').doc(uid), {
      uid,
      email: ownerEmail,
      name: ownerName,
      role: 'shop_owner',
      permissions: [
        'overview', 'products', 'categories', 'orders', 'customers',
        'inventory', 'coupons', 'banners', 'appearance', 'settings',
        'staff', 'reports', 'subscription', 'pos', 'suppliers', 'purchases', 'khata',
      ],
      status: 'active',
      createdAt: nowIso,
    });

    tx.set(db.collection('users').doc(uid).collection('shopMemberships').doc(shopId), {
      shopId,
      shopName,
      shopSlug: cleanSlug,
      role: 'shop_owner',
      joinedAt: nowIso,
    });

    tx.set(shopRef.collection('settings').doc('public'), {
      siteName: shopName,
      logoUrl: '',
      primaryColor: '#065f46',
      accentColor: '#d97706',
      announcement: 'Welcome to our online store — Cash on Delivery, EasyPaisa, JazzCash & Store Pickup available.',
      contactPhone: ownerPhone,
      whatsappNumber: ownerPhone,
      contactEmail: ownerEmail,
      address: `${address}, ${city}`,
      city,
      shippingFee: 200,
      freeShippingThreshold: 3500,
      currency: 'PKR',
      currencySymbol: 'Rs.',
      codEnabled: true,
      easypaisaDetails: { enabled: false, accountTitle: '', accountNumber: '' },
      jazzcashDetails: { enabled: false, accountTitle: '', accountNumber: '' },
      bankDetails: { enabled: false, bankName: '', accountTitle: shopName, accountNumber: '', iban: '' },
      selfPickupDetails: {
        enabled: false,
        title: `${shopName} Outlet (${city})`,
        address,
        city,
        timings: 'Mon – Sat: 11:00 AM – 9:00 PM',
        contactPhone: ownerPhone,
        preparationTime: '30–45 mins',
        requireAdvancePayment: false,
        cashOnPickupEnabled: true,
        advanceDays: 5,
      },
      socialLinks: {},
      updatedAt: nowIso,
    });

    tx.set(shopRef.collection('settings').doc('private'), {
      bankDetails: { enabled: false, bankName: '', accountTitle: shopName, accountNumber: '', iban: '' },
      easypaisaDetails: { enabled: false, accountTitle: shopName, accountNumber: ownerPhone },
      jazzcashDetails: { enabled: false, accountTitle: shopName, accountNumber: ownerPhone },
      ownerBillingEmail: ownerEmail,
      ownerPrivatePhone: ownerPhone,
      updatedAt: nowIso,
    });

    const logId = `plog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    tx.set(db.collection('platform_activity_logs').doc(logId), {
      id: logId,
      actorId: uid,
      actorEmail: ownerEmail,
      action: 'Registered Shop (CNIC Verified)',
      targetType: 'shop',
      targetId: shopId,
      details: `Registered ${shopName} in ${city} with CNIC ${cnicMasked}`,
      createdAt: nowIso,
    });

    return shopDoc;
  });

  await rebuildCustomClaimsForUser(uid).catch((e) => console.warn('Claim rebuild after register note:', e));
  return { shop: newShop };
});

export const manageShopCnicAdmin = onCall({ secrets: [cnicHmacSecret] }, async (request) => {
  await assertSuperAdmin(
    request.auth?.uid,
    request.auth?.token?.email,
    request.auth?.token?.email_verified,
    request.auth?.token
  );

  const shopId = String(request.data?.shopId || '').trim();
  const action = String(request.data?.action || 'assign').trim();
  const reason = String(request.data?.reason || '').trim();
  if (!shopId || !['assign', 'release'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Valid shopId and action (assign | release) are required.');
  }

  const nowIso = new Date().toISOString();
  const shopRef = db.collection('shops').doc(shopId);

  if (action === 'release') {
    await db.runTransaction(async (tx) => {
      const shopSnap = await tx.get(shopRef);
      if (!shopSnap.exists) throw new HttpsError('not-found', `Shop ${shopId} not found.`);
      const existingHash = String(shopSnap.data()?.cnicHash || '').trim();
      if (existingHash) {
        tx.set(
          db.collection('cnic_registry').doc(existingHash),
          {
            status: 'released',
            releasedAt: nowIso,
            releasedBy: request.auth?.token?.email || 'Super Admin',
            releaseReason: reason || 'Audited CNIC release by Super Admin',
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }
      tx.update(shopRef, {
        cnicMasked: FieldValue.delete(),
        cnicLast4: FieldValue.delete(),
        cnicHash: FieldValue.delete(),
        cnicVerified: false,
        cnicStatus: 'released',
        cnicUpdatedAt: nowIso,
        updatedAt: nowIso,
      });
      const logId = `plog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      tx.set(db.collection('platform_activity_logs').doc(logId), {
        id: logId,
        actorId: request.auth?.uid || 'super_admin',
        actorEmail: request.auth?.token?.email || 'Super Admin',
        action: 'Released Shop CNIC',
        targetType: 'shop',
        targetId: shopId,
        details: reason || `Super Admin released CNIC binding on shop ${shopId}`,
        createdAt: nowIso,
      });
    });
    return { ok: true, cnicStatus: 'released' };
  }

  const normalizedCnic = normalizeCnicServer(request.data?.cnic);
  if (!isValidCnicServer(normalizedCnic)) {
    throw new HttpsError('invalid-argument', 'Valid 13-digit Pakistani CNIC is required.');
  }
  const nextHmacKey = computeCnicHmacServer(normalizedCnic);
  const cnicMasked = maskCnicServer(normalizedCnic);
  const cnicLast4 = normalizedCnic.slice(-4);

  await db.runTransaction(async (tx) => {
    const [shopSnap, nextCnicSnap] = await Promise.all([
      tx.get(shopRef),
      tx.get(db.collection('cnic_registry').doc(nextHmacKey)),
    ]);
    if (!shopSnap.exists) throw new HttpsError('not-found', `Shop ${shopId} not found.`);
    const shopData = shopSnap.data()!;
    const existingHash = String(shopData.cnicHash || '').trim();

    if (
      nextCnicSnap.exists &&
      nextCnicSnap.data()?.status !== 'released' &&
      nextCnicSnap.data()?.shopId !== shopId
    ) {
      throw new HttpsError('already-exists', DUPLICATE_CNIC_ERROR_MESSAGE);
    }

    if (existingHash && existingHash !== nextHmacKey) {
      tx.set(
        db.collection('cnic_registry').doc(existingHash),
        {
          status: 'released',
          releasedAt: nowIso,
          releasedBy: request.auth?.token?.email || 'Super Admin',
          releaseReason: reason || `Reassigned CNIC on shop ${shopId}`,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }

    tx.set(db.collection('cnic_registry').doc(nextHmacKey), {
      hmacKey: nextHmacKey,
      ownerId: shopData.ownerId || '',
      shopId,
      shopName: shopData.name || shopId,
      cnicMasked,
      cnicLast4,
      status: 'active',
      updatedBy: request.auth?.token?.email || 'Super Admin',
      createdAt: nextCnicSnap.exists ? nextCnicSnap.data()?.createdAt || nowIso : nowIso,
      updatedAt: nowIso,
    });

    tx.update(shopRef, {
      cnicMasked,
      cnicLast4,
      cnicHash: nextHmacKey,
      cnicVerified: true,
      cnicStatus: 'verified',
      cnicUpdatedAt: nowIso,
      updatedAt: nowIso,
    });

    const logId = `plog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    tx.set(db.collection('platform_activity_logs').doc(logId), {
      id: logId,
      actorId: request.auth?.uid || 'super_admin',
      actorEmail: request.auth?.token?.email || 'Super Admin',
      action: 'Updated Shop CNIC Verification',
      targetType: 'shop',
      targetId: shopId,
      details: `${reason || 'Super Admin verified/corrected CNIC'} -> ${cnicMasked}`,
      createdAt: nowIso,
    });
  });

  return { ok: true, cnicMasked, cnicStatus: 'verified' };
});

export const deleteShopCompleteAdmin = onCall(async (request) => {
  await assertSuperAdmin(
    request.auth?.uid,
    request.auth?.token?.email,
    request.auth?.token?.email_verified,
    request.auth?.token
  );
  const shopId = String(request.data?.shopId || '').trim();
  if (!shopId) throw new HttpsError('invalid-argument', 'shopId is required.');

  const nowIso = new Date().toISOString();
  const shopRef = db.collection('shops').doc(shopId);
  const [shopSnap, staffSnap] = await Promise.all([
    shopRef.get(),
    shopRef.collection('staff').get(),
  ]);
  if (!shopSnap.exists) {
    throw new HttpsError('not-found', `Shop ${shopId} not found.`);
  }
  const shopData = shopSnap.data()!;
  const warnings: string[] = [];

  const affectedUids = new Set<string>();
  if (shopData.ownerId) affectedUids.add(String(shopData.ownerId));
  staffSnap.forEach((docSnap) => {
    if (docSnap.id) affectedUids.add(docSnap.id);
    const staffUid = docSnap.data()?.uid;
    if (staffUid) affectedUids.add(String(staffUid));
  });

  // Archive minimal non-PII retention metadata and preserve CNIC lock by default
  await db.collection('archived_shops').doc(shopId).set({
    shopId,
    slug: shopData.slug || shopId,
    name: shopData.name || shopId,
    city: shopData.city || '',
    cnicHash: shopData.cnicHash || null,
    cnicMasked: shopData.cnicMasked || null,
    deletedBy: request.auth?.token?.email || 'Super Admin',
    deletedAt: nowIso,
  });

  if (shopData.cnicHash) {
    await db
      .collection('cnic_registry')
      .doc(String(shopData.cnicHash))
      .set(
        {
          status: 'retained_after_shop_delete',
          shopDeletedAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      );
  }

  await db.recursiveDelete(shopRef);
  await db.collection('shops_public').doc(shopId).delete().catch((err) => {
    if (err?.code !== 5) warnings.push(`shops_public delete: ${err?.message || err}`);
  });
  if (shopData.slug) {
    await db.collection('shop_slugs').doc(shopData.slug).delete().catch((err) => {
      if (err?.code !== 5) warnings.push(`shop_slugs delete: ${err?.message || err}`);
    });
  }

  // Delete shop memberships & rebuild custom claims for owner + all staff
  await Promise.all(
    Array.from(affectedUids).map(async (uid) => {
      await db
        .collection('users')
        .doc(uid)
        .collection('shopMemberships')
        .doc(shopId)
        .delete()
        .catch((err) => warnings.push(`membership delete (${uid}): ${err?.message || err}`));
      await rebuildCustomClaimsForUser(uid).catch((err) =>
        warnings.push(`claim rebuild (${uid}): ${err?.message || err}`)
      );
    })
  );

  // Delete tenant & platform payment storage folder assets cleanly
  for (const prefix of [`shops/${shopId}/`, `platform/payments/${shopId}/`]) {
    try {
      await storage.bucket().deleteFiles({ prefix });
    } catch (err: any) {
      if (err?.code !== 404) {
        console.warn(`Storage cleanup warning (${prefix}):`, err);
        warnings.push(`storage cleanup (${prefix}): ${err?.message || err}`);
      }
    }
  }

  const logId = `plog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
  await db.collection('platform_activity_logs').doc(logId).set({
    id: logId,
    actorId: request.auth?.uid || 'super_admin',
    actorEmail: request.auth?.token?.email || 'Super Admin',
    action: 'Deleted Shop Permanently',
    targetType: 'shop',
    targetId: shopId,
    details: `Deleted shop "${shopData.name || shopId}", cleared ${affectedUids.size} staff membership(s), retained CNIC registry lock`,
    createdAt: nowIso,
  });

  return { ok: true, clearedStaffCount: affectedUids.size, warnings };
});

export const incrementProductUsage = onDocumentWritten(
  {
    document: 'shops/{shopId}/products/{productId}',
    database: FIRESTORE_DB_ID,
  },
  async (event) => {
    const shopId = event.params.shopId;
    const before = event.data?.before.exists;
    const after = event.data?.after.exists;
    if (!before && after) {
      await db.collection('shops').doc(shopId).update({ 'usage.productsCount': FieldValue.increment(1) }).catch(() => {});
    } else if (before && !after) {
      await db.collection('shops').doc(shopId).update({ 'usage.productsCount': FieldValue.increment(-1) }).catch(() => {});
    }
  }
);

/**
 * Daily scheduled expiry checker: marks past-due active/trial subscriptions as 'expired'
 * in chunked batches (<= 400 writes/batch) without modifying merchant products/orders/settings.
 */
export const enforceExpiredSubscriptions = onSchedule('every 24 hours', async () => {
  const nowIso = new Date().toISOString();
  const activeSnap = await db
    .collection('shops')
    .where('subscription.status', 'in', ['active', 'trial'])
    .get();

  const expiredDocs = activeSnap.docs.filter((docSnap) => {
    const data = docSnap.data();
    const expiry = data.subscription?.expiryDate;
    return Boolean(expiry && expiry < nowIso && data.subscription?.planId !== 'free-starter');
  });

  const CHUNK_SIZE = 400;
  for (let i = 0; i < expiredDocs.length; i += CHUNK_SIZE) {
    const chunk = expiredDocs.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();
    chunk.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        'subscription.status': 'expired',
        updatedAt: nowIso,
      });
    });
    await batch.commit();
  }
});

// ====================================================
// ISOLATED DEMO SUPER ADMIN SANDBOX FUNCTIONS
// ====================================================

async function ensureDemoAdminUser(passwordOverride?: string): Promise<{
  uid: string;
  email: string;
  claims: Record<string, any>;
}> {
  const demoClaims = {
    super_admin: false,
    demo_super_admin: true,
    account_type: DEMO_ACCOUNT_TYPE,
    demo_scope: `${DEMO_ENV_ROOT}/${DEMO_ENV_ID}`,
    shops: {},
    sales_role: null,
  };

  let userRecord: Awaited<ReturnType<typeof auth.getUserByEmail>> | null = null;
  try {
    userRecord = await auth.getUserByEmail(DEMO_ADMIN_EMAIL);
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') {
      throw err;
    }
  }

  const effectivePassword = String(
    passwordOverride || process.env.DEMO_ADMIN_PASSWORD || crypto.randomBytes(24).toString('hex')
  );

  if (!userRecord) {
    userRecord = await auth.createUser({
      email: DEMO_ADMIN_EMAIL,
      emailVerified: true,
      password: effectivePassword,
      displayName: DEMO_ADMIN_DISPLAY_NAME,
    });
  } else {
    const updatePayload: Record<string, any> = {
      emailVerified: true,
      displayName: DEMO_ADMIN_DISPLAY_NAME,
      disabled: false,
    };
    if (passwordOverride || process.env.DEMO_ADMIN_PASSWORD) {
      updatePayload.password = effectivePassword;
    }
    userRecord = await auth.updateUser(userRecord.uid, updatePayload);
  }

  await auth.setCustomUserClaims(userRecord.uid, demoClaims);
  await db.collection('demo_admins').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: DEMO_ADMIN_EMAIL,
      displayName: DEMO_ADMIN_DISPLAY_NAME,
      accountType: DEMO_ACCOUNT_TYPE,
      demoScope: `${DEMO_ENV_ROOT}/${DEMO_ENV_ID}`,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    uid: userRecord.uid,
    email: DEMO_ADMIN_EMAIL,
    claims: demoClaims,
  };
}

async function seedDemoEnvironmentInternal(): Promise<{
  writtenDocs: number;
  seededCounts: Record<string, number>;
}> {
  const demoRootRef = db.collection(DEMO_ENV_ROOT).doc(DEMO_ENV_ID);
  await db.recursiveDelete(demoRootRef);

  try {
    await storage.bucket().deleteFiles({ prefix: `${DEMO_ENV_ROOT}/${DEMO_ENV_ID}/` });
  } catch (err: any) {
    if (err?.code !== 404) {
      console.warn('Demo storage reset note:', err?.message || err);
    }
  }

  const ops = buildDemoAdminWriteOperations();
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const slice = ops.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();
    for (const op of slice) {
      batch.set(db.doc(op.pathSegments.join('/')), op.data);
    }
    await batch.commit();
  }

  const countCollection = (col: string) =>
    ops.filter((op) => op.pathSegments.length === 4 && op.pathSegments[2] === col).length;
  const countSubcollection = (sub: string) =>
    ops.filter((op) => op.pathSegments.length === 6 && op.pathSegments[2] === 'shops' && op.pathSegments[4] === sub).length;
  const salesOps = ops.filter((op) => op.pathSegments.length === 4 && op.pathSegments[2] === 'salesMembers');
  const referralAgentsCount = salesOps.filter((op) => op.data?.role === 'referral_agent').length;

  return {
    writtenDocs: ops.length,
    seededCounts: {
      shops: countCollection('shops'),
      products: countSubcollection('products'),
      customers: countSubcollection('customers'),
      orders: countSubcollection('orders'),
      salesMembers: salesOps.length - referralAgentsCount,
      referralAgents: referralAgentsCount,
    },
  };
}

export const provisionDemoSuperAdmin = onCall(async (request) => {
  await assertSuperAdmin(
    request.auth?.uid,
    request.auth?.token?.email,
    request.auth?.token?.email_verified,
    request.auth?.token
  );

  const requestedPassword = typeof request.data?.password === 'string' ? request.data.password.trim() : '';
  if (requestedPassword && requestedPassword.length < 8) {
    throw new HttpsError('invalid-argument', 'Demo admin password override must be at least 8 characters.');
  }

  const ensured = await ensureDemoAdminUser(requestedPassword || undefined);
  const demoRootSnap = await db.collection(DEMO_ENV_ROOT).doc(DEMO_ENV_ID).get();
  if (!demoRootSnap.exists) {
    await seedDemoEnvironmentInternal();
  }

  return {
    ok: true,
    uid: ensured.uid,
    email: ensured.email,
    accountType: DEMO_ACCOUNT_TYPE,
    demoScope: `${DEMO_ENV_ROOT}/${DEMO_ENV_ID}`,
  };
});

export const issueDemoAdminToken = onCall(async () => {
  const ensured = await ensureDemoAdminUser();
  const demoRootSnap = await db.collection(DEMO_ENV_ROOT).doc(DEMO_ENV_ID).get();
  if (!demoRootSnap.exists) {
    await seedDemoEnvironmentInternal();
  }

  const customToken = await auth.createCustomToken(ensured.uid, {
    super_admin: false,
    demo_super_admin: true,
    account_type: DEMO_ACCOUNT_TYPE,
    demo_scope: `${DEMO_ENV_ROOT}/${DEMO_ENV_ID}`,
  });

  return {
    ok: true,
    customToken,
    uid: ensured.uid,
    email: ensured.email,
    accountType: DEMO_ACCOUNT_TYPE,
    demoScope: `${DEMO_ENV_ROOT}/${DEMO_ENV_ID}`,
    demoTag: DEMO_DATA_TAG,
  };
});

export const resetDemoEnvironmentAdmin = onCall(async (request) => {
  await assertSuperAdmin(
    request.auth?.uid,
    request.auth?.token?.email,
    request.auth?.token?.email_verified,
    request.auth?.token
  );

  const result = await seedDemoEnvironmentInternal();
  const nowIso = new Date().toISOString();
  const logId = `plog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
  await db.collection('platform_activity_logs').doc(logId).set({
    id: logId,
    actorId: request.auth?.uid || 'super_admin',
    actorEmail: request.auth?.token?.email || 'Super Admin',
    action: 'Reset Demo Environment',
    targetType: 'settings',
    targetId: `${DEMO_ENV_ROOT}/${DEMO_ENV_ID}`,
    details: `Reset and re-seeded isolated demo sandbox (${result.writtenDocs} documents)`,
    createdAt: nowIso,
  });

  return {
    ok: true,
    ...result,
    resetAt: nowIso,
  };
});


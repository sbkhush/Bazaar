import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const app = initializeApp();
const FIRESTORE_DB_ID =
  process.env.FIRESTORE_DATABASE_ID ||
  'ai-studio-bazaarpkecommerc-94c8ec32-7dba-4ff3-a6e4-6aa9072c863c';
const db = getFirestore(app, FIRESTORE_DB_ID);
const auth = getAuth(app);
const storage = getStorage(app);

const SUPER_ADMIN_EMAIL = 'hasanaamir815@gmail.com';

async function assertSuperAdmin(uid?: string, email?: string, emailVerified?: boolean, tokenClaims?: Record<string, any>) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (tokenClaims?.super_admin === true) return;
  if (email === SUPER_ADMIN_EMAIL && emailVerified) return;

  const adminSnap = await db.collection('platform_admins').doc(uid).get();
  if (adminSnap.exists) return;

  throw new HttpsError('permission-denied', 'Super Admin privileges required.');
}

async function rebuildCustomClaimsForUser(
  uid: string
): Promise<{ super_admin: boolean; shops: Record<string, string>; sales_role: string | null }> {
  const userRecord = await auth.getUser(uid);
  const adminSnap = await db.collection('platform_admins').doc(uid).get();
  const isSuper =
    adminSnap.exists ||
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

  await auth.setCustomUserClaims(uid, {
    ...(userRecord.customClaims || {}),
    super_admin: isSuper,
    shops,
    sales_role: salesRole,
  });

  return { super_admin: isSuper, shops, sales_role: salesRole };
}

/**
 * Automatically keep Firebase Auth Custom Claims (`super_admin`, `shops`) synchronized
 * whenever shop staff records or platform_admins change so storage.rules & firestore.rules
 * verify tenant authorization without bare request.auth != null checks.
 */
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
    const shopSnap = await tx.get(shopRef);
    if (!shopSnap.exists) {
      throw new HttpsError('not-found', `Shop ${payment.shopId} not found.`);
    }

    const planSnap = await tx.get(db.collection('platform_plans').doc(payment.planId));
    const planData = planSnap.exists ? planSnap.data() : null;
    const cycleDays =
      payment.billingCycle === 'yearly' ? 365 : Number(planData?.durationDays || 30);

    const shopData = shopSnap.data()!;
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
      {
        status: 'active',
        updatedAt: nowIso,
      },
      { merge: true }
    );

    const logId = `plog_${Date.now()}`;
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
    if (snap.data()?.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Payment was already processed.');
    }
    tx.update(paymentRef, {
      status: 'rejected',
      rejectionReason: reason,
      reviewedBy: request.auth?.token?.email || 'Super Admin',
      reviewedAt: nowIso,
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
  const status = String(request.data?.status || '').trim();
  if (!shopId || !['active', 'inactive', 'suspended'].includes(status)) {
    throw new HttpsError('invalid-argument', 'Valid shopId and status required.');
  }

  const nowIso = new Date().toISOString();
  const batch = db.batch();
  batch.update(db.collection('shops').doc(shopId), { status, updatedAt: nowIso });
  batch.set(db.collection('shops_public').doc(shopId), { status, updatedAt: nowIso }, { merge: true });
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

  const planSnap = await db.collection('platform_plans').doc(String(planId)).get();
  if (!planSnap.exists) throw new HttpsError('not-found', 'Plan not found.');
  const plan = planSnap.data()!;

  const days = Number(durationDays) || (billingCycle === 'yearly' ? 365 : Number(plan.durationDays || 30));
  const now = new Date();
  const nowIso = now.toISOString();
  const expiryIso = new Date(now.getTime() + days * 86400000).toISOString();

  await db.collection('shops').doc(String(shopId)).update({
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

  await db.collection('shops_public').doc(String(shopId)).set({ status: 'active', updatedAt: nowIso }, { merge: true });
  return { ok: true, expiryDate: expiryIso };
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

  const shopRef = db.collection('shops').doc(shopId);
  const shopSnap = await shopRef.get();
  const shopData = shopSnap.data();

  await db.recursiveDelete(shopRef);
  await db.collection('shops_public').doc(shopId).delete().catch(() => {});
  if (shopData?.slug) {
    await db.collection('shop_slugs').doc(shopData.slug).delete().catch(() => {});
  }
  if (shopData?.ownerId) {
    await db.collection('users').doc(shopData.ownerId).collection('shopMemberships').doc(shopId).delete().catch(() => {});
    await rebuildCustomClaimsForUser(shopData.ownerId).catch(() => {});
  }

  // Delete tenant storage folder assets
  try {
    await storage.bucket().deleteFiles({ prefix: `shops/${shopId}/` });
  } catch (err) {
    console.warn('Storage cleanup note during shop delete:', err);
  }

  return { ok: true };
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
 * without modifying or deleting merchant products/orders/settings.
 */
export const enforceExpiredSubscriptions = onSchedule('every 24 hours', async () => {
  const nowIso = new Date().toISOString();
  const activeSnap = await db
    .collection('shops')
    .where('subscription.status', 'in', ['active', 'trial'])
    .get();

  const batch = db.batch();
  let count = 0;

  activeSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const expiry = data.subscription?.expiryDate;
    if (expiry && expiry < nowIso && data.subscription?.planId !== 'free-starter') {
      batch.update(docSnap.ref, {
        'subscription.status': 'expired',
        updatedAt: nowIso,
      });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
  }
});

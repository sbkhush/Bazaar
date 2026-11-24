import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  orderBy,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from '../firebase/config';
import { apiFetch } from '../utils/apiClient';
import { isDemoNamespace, scopedCollection, scopedDoc } from '../utils/demoCollection';
import {
  DUPLICATE_CNIC_ERROR_MESSAGE,
  CNIC_AUDIT_BLOCK_MESSAGE,
  isValidCnic,
  normalizeCnic,
} from '../utils/cnic';
import {
  Shop,
  ShopPublic,
  ShopStatus,
  SubscriptionPlan,
  PlatformSettings,
  PlatformPayment,
  ActivityLog,
  BillingCycle,
  StoreSettings,
  ShopMembership,
  StaffMember,
} from '../types';
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  DEFAULT_PLATFORM_SETTINGS,
  INITIAL_SETTINGS,
  getDefaultCategoriesForBusinessType,
  sanitizeShopSlug,
  isValidShopSlug,
} from '../data/seedData';
import {
  BusinessType,
  SupportTicket,
} from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { normalizeAndValidateSocialLinks, normalizeOptionalHttpUrl } from '../utils/socialLinks';
import {
  recordReferralAttribution,
  verifyReferralAttributionOnShopActivation,
  syncCommissionForApprovedPayment,
  reverseCommissionForPayment,
} from './salesService';

export function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export function resolveValidPublicSlug(shopId: string, candidateSlug?: string): string {
  const candidates = [candidateSlug, shopId].filter(Boolean) as string[];
  for (const raw of candidates) {
    const clean = sanitizeShopSlug(raw);
    if (clean.length >= 2 && clean.length <= 60 && isValidShopSlug(clean)) {
      return clean;
    }
  }
  const fallback = `store-${sanitizeShopSlug(shopId) || 'tenant'}`.slice(0, 60);
  return fallback;
}

export function buildValidShopPublicProjection(
  shopId: string,
  shopData?: Partial<Shop & ShopPublic> | null,
  existingPublic?: Partial<ShopPublic> | null,
  publicSettings?: Partial<StoreSettings> | null,
  overrides?: Partial<ShopPublic>
): ShopPublic {
  const slug = resolveValidPublicSlug(
    shopId,
    overrides?.slug || shopData?.slug || existingPublic?.slug
  );
  const rawStatus = overrides?.status || shopData?.status || existingPublic?.status || 'active';
  const status: ShopStatus =
    rawStatus === 'inactive' || rawStatus === 'suspended' ? rawStatus : 'active';
  const name = (
    overrides?.name ||
    shopData?.name ||
    existingPublic?.name ||
    publicSettings?.siteName ||
    shopId
  ).trim() || shopId;

  const baseTheme = overrides?.theme || shopData?.theme || existingPublic?.theme;
  const theme = baseTheme
    ? stripUndefined({
        primaryColor: baseTheme.primaryColor || publicSettings?.primaryColor || '#065f46',
        accentColor: baseTheme.accentColor || publicSettings?.accentColor || '#d97706',
        heroTitle: baseTheme.heroTitle,
        heroSubtitle: baseTheme.heroSubtitle,
        showTestimonials: baseTheme.showTestimonials,
        showBuyingGuide: baseTheme.showBuyingGuide,
      })
    : undefined;

  return stripUndefined<ShopPublic>({
    id: shopId,
    slug,
    name,
    businessType: overrides?.businessType ?? shopData?.businessType ?? existingPublic?.businessType,
    logoUrl:
      overrides?.logoUrl ??
      publicSettings?.logoUrl ??
      shopData?.logoUrl ??
      existingPublic?.logoUrl ??
      '',
    city:
      overrides?.city ??
      publicSettings?.city ??
      shopData?.city ??
      existingPublic?.city ??
      '',
    publicContactPhone:
      overrides?.publicContactPhone ??
      publicSettings?.contactPhone ??
      shopData?.publicContactPhone ??
      existingPublic?.publicContactPhone,
    publicSupportEmail:
      overrides?.publicSupportEmail ??
      publicSettings?.contactEmail ??
      shopData?.publicSupportEmail ??
      existingPublic?.publicSupportEmail,
    storefrontAddress:
      overrides?.storefrontAddress ??
      publicSettings?.address ??
      shopData?.storefrontAddress ??
      existingPublic?.storefrontAddress ??
      shopData?.address,
    businessHours:
      overrides?.businessHours ??
      publicSettings?.businessHours ??
      shopData?.businessHours ??
      existingPublic?.businessHours,
    seoTitle:
      overrides?.seoTitle ??
      publicSettings?.seoTitle ??
      shopData?.seoTitle ??
      existingPublic?.seoTitle,
    seoDescription:
      overrides?.seoDescription ??
      publicSettings?.seoDescription ??
      shopData?.seoDescription ??
      existingPublic?.seoDescription,
    ogImageUrl:
      overrides?.ogImageUrl ??
      publicSettings?.ogImageUrl ??
      shopData?.ogImageUrl ??
      existingPublic?.ogImageUrl,
    websiteUrl:
      overrides?.websiteUrl ??
      publicSettings?.websiteUrl ??
      shopData?.websiteUrl ??
      existingPublic?.websiteUrl,
    socialLinks:
      overrides?.socialLinks ??
      publicSettings?.socialLinks ??
      shopData?.socialLinks ??
      existingPublic?.socialLinks,
    theme,
    status,
    createdAt: overrides?.createdAt ?? shopData?.createdAt ?? existingPublic?.createdAt,
    updatedAt: overrides?.updatedAt || new Date().toISOString(),
  });
}

/**
 * Maps a master private Shop document into the strict non-PII ShopPublic projection
 * permitted for public storefront reading under firestore.rules.
 */
export function toShopPublic(shop: Shop | ShopPublic, publicSettings?: Partial<StoreSettings>): ShopPublic {
  return buildValidShopPublicProjection(shop.id, shop as Partial<Shop>, shop as Partial<ShopPublic>, publicSettings);
}

export function getShopSubscriptionStatus(shop?: Shop | null, gracePeriodDays = 0) {
  if (!shop) {
    return {
      isSuspended: false,
      isExpired: false,
      inGracePeriod: false,
      daysRemaining: 0,
      effectiveStatus: 'unknown' as const,
    };
  }
  const now = new Date();
  const isSuspended = shop.status === 'suspended' || shop.status === 'inactive';
  const expiryTime = shop.subscription?.expiryDate ? new Date(shop.subscription.expiryDate).getTime() : 0;
  const isFreeStarter = shop.subscription?.planId === 'free-starter' && shop.subscription?.status === 'active';
  const graceMs = Math.max(0, gracePeriodDays) * 86400000;

  const pastExpiry = !isFreeStarter && expiryTime > 0 && expiryTime < now.getTime();
  const inGracePeriod = Boolean(pastExpiry && graceMs > 0 && now.getTime() <= expiryTime + graceMs && shop.subscription?.status !== 'expired' && shop.subscription?.status !== 'cancelled');
  const isExpired =
    !isFreeStarter &&
    (shop.subscription?.status === 'expired' ||
      shop.subscription?.status === 'cancelled' ||
      (expiryTime > 0 && now.getTime() > expiryTime + graceMs));

  const daysRemaining = expiryTime > now.getTime() ? Math.ceil((expiryTime - now.getTime()) / 86400000) : 0;

  return {
    isSuspended,
    isExpired,
    inGracePeriod,
    daysRemaining,
    effectiveStatus: isSuspended ? shop.status : isExpired ? 'expired' : shop.subscription?.status || 'active',
  };
}

// ====================================================
// SUBSCRIPTION PLANS & PLATFORM SETTINGS
// ====================================================

export async function getSubscriptionPlans(activeOnly = false): Promise<SubscriptionPlan[]> {
  try {
    const snap = await getDocs(scopedCollection(db, 'platform_plans'));
    if (snap.empty) {
      return activeOnly
        ? DEFAULT_SUBSCRIPTION_PLANS.filter((p) => p.isActive)
        : DEFAULT_SUBSCRIPTION_PLANS;
    }
    const list: SubscriptionPlan[] = [];
    snap.forEach((d) => {
      list.push({ ...(d.data() as SubscriptionPlan), id: d.id });
    });
    const sorted = list.sort((a, b) => (a.order || 0) - (b.order || 0));
    return activeOnly ? sorted.filter((p) => p.isActive) : sorted;
  } catch (err) {
    console.warn('Could not load subscription plans from Firestore, using defaults:', err);
    return activeOnly
      ? DEFAULT_SUBSCRIPTION_PLANS.filter((p) => p.isActive)
      : DEFAULT_SUBSCRIPTION_PLANS;
  }
}

export async function seedDefaultPlansIfEmpty(): Promise<void> {
  try {
    const snap = await getDocs(scopedCollection(db, 'platform_plans'));
    if (snap.empty) {
      const batch = writeBatch(db);
      for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
        batch.set(scopedDoc(db, 'platform_plans', plan.id), stripUndefined({
          ...plan,
          createdAt: new Date().toISOString(),
        }));
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn('Seed default plans note:', err);
  }
}

export async function saveSubscriptionPlan(plan: Partial<SubscriptionPlan>): Promise<string> {
  const id = plan.id || sanitizeShopSlug(plan.name || `plan-${Date.now()}`);
  const now = new Date().toISOString();
  const payload = stripUndefined<SubscriptionPlan>({
    id,
    name: plan.name || 'Custom Plan',
    slug: plan.slug || id,
    description: plan.description || '',
    monthlyPrice: Number(plan.monthlyPrice) || 0,
    yearlyPrice: Number(plan.yearlyPrice) || 0,
    durationDays: Number(plan.durationDays) || 30,
    maxProducts: plan.maxProducts !== undefined ? Number(plan.maxProducts) : 50,
    maxStorageMB: Number(plan.maxStorageMB) || 100,
    maxStaff: Number(plan.maxStaff) || 1,
    features: plan.features || DEFAULT_SUBSCRIPTION_PLANS[1].features,
    isActive: plan.isActive !== false,
    isPopular: Boolean(plan.isPopular),
    order: Number(plan.order) || 1,
    createdAt: plan.createdAt || now,
    updatedAt: now,
  });

  try {
    await setDoc(scopedDoc(db, 'platform_plans', id), payload, { merge: true });
    await logPlatformActivity('Updated Plan', 'plan', id, `Saved plan ${payload.name} (Rs. ${payload.monthlyPrice}/mo)`);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `platform_plans/${id}`);
  }
}

export async function deleteSubscriptionPlan(planId: string): Promise<void> {
  const shops = await getAllShopsAdmin();
  const inUse = shops.some((s) => s.subscription?.planId === planId);
  if (inUse) {
    throw new Error('Cannot delete a subscription plan currently assigned to active shops. Disable it instead.');
  }
  try {
    await deleteDoc(scopedDoc(db, 'platform_plans', planId));
    await logPlatformActivity('Deleted Plan', 'plan', planId, `Deleted plan ${planId}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `platform_plans/${planId}`);
  }
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const snap = await getDoc(scopedDoc(db, 'platform_settings', 'general'));
    if (snap.exists()) {
      const data = snap.data() as Partial<PlatformSettings>;
      return {
        ...DEFAULT_PLATFORM_SETTINGS,
        ...data,
        socialLinks: {
          ...(DEFAULT_PLATFORM_SETTINGS.socialLinks || {}),
          ...(data.socialLinks || {}),
        },
        easypaisaDetails: {
          ...DEFAULT_PLATFORM_SETTINGS.easypaisaDetails,
          ...(data.easypaisaDetails || {}),
        },
        jazzcashDetails: {
          ...DEFAULT_PLATFORM_SETTINGS.jazzcashDetails,
          ...(data.jazzcashDetails || {}),
        },
        bankDetails: {
          ...DEFAULT_PLATFORM_SETTINGS.bankDetails,
          ...(data.bankDetails || {}),
        },
      };
    }
    return DEFAULT_PLATFORM_SETTINGS;
  } catch (err) {
    console.warn('Could not load platform settings from Firestore, falling back to defaults:', err);
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

export async function getPlatformSettingsStrict(): Promise<{ settings: PlatformSettings; fromFirestore: boolean; error?: string }> {
  try {
    const snap = await getDoc(scopedDoc(db, 'platform_settings', 'general'));
    if (snap.exists()) {
      const data = snap.data() as Partial<PlatformSettings>;
      return {
        fromFirestore: true,
        settings: {
          ...DEFAULT_PLATFORM_SETTINGS,
          ...data,
          socialLinks: {
            ...(DEFAULT_PLATFORM_SETTINGS.socialLinks || {}),
            ...(data.socialLinks || {}),
          },
          easypaisaDetails: {
            ...DEFAULT_PLATFORM_SETTINGS.easypaisaDetails,
            ...(data.easypaisaDetails || {}),
          },
          jazzcashDetails: {
            ...DEFAULT_PLATFORM_SETTINGS.jazzcashDetails,
            ...(data.jazzcashDetails || {}),
          },
          bankDetails: {
            ...DEFAULT_PLATFORM_SETTINGS.bankDetails,
            ...(data.bankDetails || {}),
          },
        },
      };
    }
    return { fromFirestore: false, settings: DEFAULT_PLATFORM_SETTINGS };
  } catch (err: any) {
    return {
      fromFirestore: false,
      settings: DEFAULT_PLATFORM_SETTINGS,
      error: err?.message || 'Failed to read platform settings from Firestore.',
    };
  }
}

export async function updatePlatformSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const normalizedPayload: Partial<PlatformSettings> = { ...settings };
  if (settings.socialLinks !== undefined) {
    normalizedPayload.socialLinks = normalizeAndValidateSocialLinks(settings.socialLinks);
  }
  if (settings.websiteUrl !== undefined) {
    normalizedPayload.websiteUrl = normalizeOptionalHttpUrl(settings.websiteUrl, 'Platform Website URL');
  }

  try {
    const existing = await getPlatformSettings();
    const updatedAt = new Date().toISOString();
    await setDoc(
      scopedDoc(db, 'platform_settings', 'general'),
      stripUndefined({ ...normalizedPayload, updatedAt }),
      { merge: true }
    );
    await logPlatformActivity('Updated Platform Settings', 'settings', 'general', 'Updated Super Admin billing & platform info');
    return {
      ...existing,
      ...normalizedPayload,
      socialLinks: normalizedPayload.socialLinks ?? existing.socialLinks,
      easypaisaDetails: {
        ...existing.easypaisaDetails,
        ...(normalizedPayload.easypaisaDetails || {}),
      },
      jazzcashDetails: {
        ...existing.jazzcashDetails,
        ...(normalizedPayload.jazzcashDetails || {}),
      },
      bankDetails: {
        ...existing.bankDetails,
        ...(normalizedPayload.bankDetails || {}),
      },
      updatedAt,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'platform_settings/general');
  }
}

// ====================================================
// SHOP RESOLUTION, REGISTRATION & MANAGEMENT
// ====================================================

export async function checkSlugAvailability(rawSlug: string): Promise<{ available: boolean; cleanSlug: string; reason?: string }> {
  const cleanSlug = sanitizeShopSlug(rawSlug);
  if (!isValidShopSlug(cleanSlug)) {
    return {
      available: false,
      cleanSlug,
      reason: 'Slug must be 3–50 lowercase letters, numbers, or hyphens (cannot be a reserved route).',
    };
  }
  try {
    const [slugSnap, publicSnap] = await Promise.all([
      getDoc(scopedDoc(db, 'shop_slugs', cleanSlug)),
      getDoc(scopedDoc(db, 'shops_public', cleanSlug)),
    ]);
    if (slugSnap.exists() || publicSnap.exists()) {
      return { available: false, cleanSlug, reason: 'This shop URL slug is already taken.' };
    }
    return { available: true, cleanSlug };
  } catch (err) {
    console.warn('Slug check warning:', err);
    return { available: true, cleanSlug };
  }
}

/**
 * Public-safe storefront lookup: reads ONLY /shop_slugs/{slug} + /shops_public/{shopId}.
 * Never touches private /shops/{shopId} documents containing owner PII or billing data.
 */
export async function getShopPublicBySlug(slug: string): Promise<ShopPublic | null> {
  const cleanSlug = sanitizeShopSlug(slug);
  if (!cleanSlug) return null;
  try {
    const slugSnap = await getDoc(scopedDoc(db, 'shop_slugs', cleanSlug));
    if (slugSnap.exists()) {
      const shopId = slugSnap.data().shopId;
      const pubSnap = await getDoc(scopedDoc(db, 'shops_public', shopId));
      if (pubSnap.exists()) {
        return { ...(pubSnap.data() as ShopPublic), id: pubSnap.id };
      }
    }
    const directPubSnap = await getDoc(scopedDoc(db, 'shops_public', cleanSlug));
    if (directPubSnap.exists()) {
      return { ...(directPubSnap.data() as ShopPublic), id: directPubSnap.id };
    }
    return null;
  } catch (err) {
    console.warn('getShopPublicBySlug error:', err);
    return null;
  }
}

export async function getShopPublicById(shopId: string): Promise<ShopPublic | null> {
  try {
    const pubSnap = await getDoc(scopedDoc(db, 'shops_public', shopId));
    return pubSnap.exists() ? { ...(pubSnap.data() as ShopPublic), id: pubSnap.id } : null;
  } catch {
    return null;
  }
}

export async function getActiveDirectoryShopsPublic(): Promise<ShopPublic[]> {
  try {
    const q = query(scopedCollection(db, 'shops_public'), where('status', '==', 'active'));
    const snap = await getDocs(q);
    const list: ShopPublic[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as ShopPublic), id: d.id }));
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch {
    return [];
  }
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const cleanSlug = sanitizeShopSlug(slug);
  if (!cleanSlug) return null;
  try {
    const slugSnap = await getDoc(scopedDoc(db, 'shop_slugs', cleanSlug));
    if (slugSnap.exists()) {
      const shopId = slugSnap.data().shopId;
      const shopSnap = await getDoc(scopedDoc(db, 'shops', shopId));
      if (shopSnap.exists()) {
        return { ...(shopSnap.data() as Shop), id: shopSnap.id };
      }
    }
    const directSnap = await getDoc(scopedDoc(db, 'shops', cleanSlug));
    if (directSnap.exists()) {
      return { ...(directSnap.data() as Shop), id: directSnap.id };
    }
    return null;
  } catch (err) {
    console.warn('getShopBySlug note:', err);
    return null;
  }
}

export async function getShopById(shopId: string): Promise<Shop | null> {
  try {
    const snap = await getDoc(scopedDoc(db, 'shops', shopId));
    return snap.exists() ? { ...(snap.data() as Shop), id: snap.id } : null;
  } catch {
    return null;
  }
}

export async function getActiveDirectoryShops(): Promise<ShopPublic[]> {
  return getActiveDirectoryShopsPublic();
}

export async function getAllShopsAdmin(): Promise<Shop[]> {
  try {
    const snap = await getDocs(scopedCollection(db, 'shops'));
    const list: Shop[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as Shop), id: d.id }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'shops');
  }
}

export async function getShopsByOwner(ownerUid: string): Promise<Shop[]> {
  if (!ownerUid) return [];
  const q = query(scopedCollection(db, 'shops'), where('ownerId', '==', ownerUid));
  const snap = await getDocs(q);
  const shops: Shop[] = [];
  snap.forEach((d) => shops.push({ ...(d.data() as Shop), id: d.id }));
  return shops;
}

export function auditShopCnicStatus(shop?: Partial<Shop> | null): 'verified' | 'pending_audit' | 'released' {
  if (!shop) return 'pending_audit';
  if (shop.cnicStatus === 'released') return 'released';
  if (shop.cnicHash && shop.cnicVerified !== false) return 'verified';
  return 'pending_audit';
}

export async function ownerHasPendingCnicAudit(ownerUid: string): Promise<boolean> {
  if (!ownerUid) return false;
  try {
    const owned = await getShopsByOwner(ownerUid);
    return owned.some(
      (s: Shop) => String(s.status) !== 'deleted' && auditShopCnicStatus(s) === 'pending_audit'
    );
  } catch {
    return false;
  }
}

export async function registerNewShop(input: {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  cnic: string;
  shopName: string;
  shopSlug: string;
  businessType?: BusinessType;
  city: string;
  address: string;
  planId: string;
  billingCycle: BillingCycle;
  referralCode?: string;
  referralSource?: 'referral_link' | 'qr_scan' | 'manual_assisted' | 'code_entry';
  referralCapturedAt?: string;
  leadId?: string;
  paymentProof?: {
    method: 'easypaisa' | 'jazzcash' | 'bank_transfer';
    transactionId: string;
    senderNumber: string;
    proofUrl: string;
  };
}): Promise<Shop> {
  const cnicCheck = isValidCnic(input.cnic);
  if (!cnicCheck.valid) {
    throw new Error(cnicCheck.error || 'Please enter a valid 13-digit Pakistani CNIC.');
  }

  const slugCheck = await checkSlugAvailability(input.shopSlug);
  if (!slugCheck.available) {
    throw new Error(slugCheck.reason || 'Shop URL slug is unavailable.');
  }

  const hasPendingAudit = await ownerHasPendingCnicAudit(input.ownerId);
  if (hasPendingAudit) {
    throw new Error(CNIC_AUDIT_BLOCK_MESSAGE);
  }

  const plans = await getSubscriptionPlans();
  const freePlan = plans.find((p) => p.id === 'free-starter') || DEFAULT_SUBSCRIPTION_PLANS[0];
  const requestedPlan = plans.find((p) => p.id === input.planId) || freePlan;
  const businessType: BusinessType = input.businessType || 'general_store';

  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== input.ownerId) {
    throw new Error('Please sign in with the shop owner account before registering.');
  }

  let registeredShop: Shop | null = null;

  const payload = {
    ownerName: input.ownerName.trim(),
    ownerEmail: input.ownerEmail.trim(),
    ownerPhone: input.ownerPhone.trim(),
    cnic: cnicCheck.normalized,
    shopName: input.shopName.trim(),
    shopSlug: slugCheck.cleanSlug,
    businessType,
    city: input.city.trim(),
    address: input.address.trim(),
    planId: input.planId,
    billingCycle: input.billingCycle,
  };

  // Primary atomic path: Firebase Cloud Function registerShopWithCnic (server-side HMAC + transaction)
  try {
    const functions = getFunctions(auth.app);
    const registerFn = httpsCallable<typeof payload, { shop: Shop }>(functions, 'registerShopWithCnic');
    const result = await registerFn(payload);
    if (result?.data?.shop) {
      registeredShop = result.data.shop;
    }
  } catch (cfErr: any) {
    const code = String(cfErr?.code || '');
    const msg = String(cfErr?.message || '');
    // Reject duplicates, slug conflicts, or audit blocks immediately — NEVER bypass!
    if (
      code.includes('already-exists') ||
      msg.includes('Only one shop can be registered against one CNIC')
    ) {
      throw new Error(
        msg.toLowerCase().includes('slug') ? msg : DUPLICATE_CNIC_ERROR_MESSAGE
      );
    }
    if (
      code.includes('invalid-argument') ||
      code.includes('permission-denied') ||
      code.includes('failed-precondition') ||
      code.includes('unauthenticated')
    ) {
      throw new Error(msg || 'CNIC shop registration rejected.');
    }

    // Reachability fallback ONLY to trusted Express backend /api/shops/register (never unverified direct client DB)
    const idToken = await currentUser.getIdToken();
    try {
      const apiRes = await apiFetch('/api/shops/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });
      const contentType = apiRes.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          'Shop registration verification service is temporarily unreachable. Please try again or contact SB Khush Support.'
        );
      }
      const json = await apiRes.json();
      if (!apiRes.ok) {
        if (apiRes.status === 409 && json?.code === 'DUPLICATE_CNIC') {
          throw new Error(DUPLICATE_CNIC_ERROR_MESSAGE);
        }
        throw new Error(json?.error || 'Failed to verify CNIC and register shop.');
      }
      registeredShop = json.shop as Shop;
    } catch (apiErr: any) {
      if (apiErr?.isUnconfiguredBackend) {
        throw new Error(
          'CNIC verification backend (Cloud Functions or VITE_API_BASE_URL) is unreachable. Registration halted to enforce One-CNIC-One-Shop.'
        );
      }
      throw apiErr;
    }
  }

  if (!registeredShop) {
    throw new Error('Could not complete atomic CNIC shop registration.');
  }

  // Refresh Firebase Auth custom claims so the new owner immediately receives shopRoles claims
  await currentUser.getIdToken(true).catch(() => {});

  if (requestedPlan.monthlyPrice > 0 && input.paymentProof) {
    const amount = input.billingCycle === 'yearly' ? requestedPlan.yearlyPrice : requestedPlan.monthlyPrice;
    await submitSubscriptionPayment({
      shopId: registeredShop.id,
      shopName: registeredShop.name,
      shopSlug: registeredShop.slug,
      ownerId: input.ownerId,
      ownerEmail: input.ownerEmail,
      planId: requestedPlan.id,
      planName: requestedPlan.name,
      billingCycle: input.billingCycle,
      amount,
      method: input.paymentProof.method,
      transactionId: input.paymentProof.transactionId,
      senderNumber: input.paymentProof.senderNumber,
      proofUrl: input.paymentProof.proofUrl,
    });
  }

  if (input.referralCode?.trim()) {
    await recordReferralAttribution({
      referralCode: input.referralCode.trim(),
      shopId: registeredShop.id,
      shopSlug: registeredShop.slug,
      shopName: registeredShop.name,
      ownerId: input.ownerId,
      ownerEmail: input.ownerEmail,
      ownerPhone: input.ownerPhone,
      city: registeredShop.city,
      industry: businessType,
      leadId: input.leadId,
      source: input.referralSource || 'code_entry',
      capturedAt: input.referralCapturedAt,
    }).catch((e) => console.warn('Referral attribution note:', e));
  }

  return registeredShop;
}

export async function updateShopStatus(shopId: string, status: ShopStatus): Promise<void> {
  const now = new Date().toISOString();
  try {
    const [shopSnap, pubSnap, settingsPubSnap] = await Promise.all([
      getDoc(scopedDoc(db, 'shops', shopId)),
      getDoc(scopedDoc(db, 'shops_public', shopId)).catch(() => null),
      getDoc(scopedDoc(db, 'shops', shopId, 'settings', 'public')).catch(() => null),
    ]);
    if (!shopSnap.exists()) {
      throw new Error(`Shop "${shopId}" was not found.`);
    }
    const shopData = { ...(shopSnap.data() as Shop), id: shopId };
    const existingPublic = pubSnap?.exists() ? (pubSnap.data() as ShopPublic) : null;
    const publicSettings = settingsPubSnap?.exists() ? (settingsPubSnap.data() as Partial<StoreSettings>) : null;
    const cleanPublicDoc = buildValidShopPublicProjection(
      shopId,
      shopData,
      existingPublic,
      publicSettings,
      { status, updatedAt: now }
    );

    const batch = writeBatch(db);
    batch.update(scopedDoc(db, 'shops', shopId), { status, updatedAt: now });
    batch.set(scopedDoc(db, 'shops_public', shopId), cleanPublicDoc);
    await batch.commit();
    if (status === 'active') {
      await verifyReferralAttributionOnShopActivation(shopId).catch(() => {});
    }
    await logPlatformActivity(`Shop ${status}`, 'shop', shopId, `Changed shop ${shopId} status to ${status}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}`);
  }
}

export async function assignShopSubscription(
  shopId: string,
  params: {
    planId: string;
    billingCycle: BillingCycle;
    durationDays?: number;
    isFreeOverride?: boolean;
    status?: 'active' | 'trial' | 'expired' | 'cancelled';
    pricePaid?: number;
  }
): Promise<void> {
  const plans = await getSubscriptionPlans();
  const plan = plans.find((p) => p.id === params.planId) || DEFAULT_SUBSCRIPTION_PLANS[0];
  const days = params.durationDays || (params.billingCycle === 'yearly' ? 365 : plan.durationDays || 30);
  const now = new Date();
  const startDate = now.toISOString();
  const expiryDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const subscription = {
    planId: plan.id,
    planName: plan.name,
    status: params.status || 'active',
    billingCycle: params.billingCycle,
    pricePaid: params.isFreeOverride ? 0 : (params.pricePaid ?? (params.billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice)),
    startDate,
    expiryDate,
    isFreeOverride: Boolean(params.isFreeOverride),
  };

  try {
    const [shopSnap, pubSnap, settingsPubSnap] = await Promise.all([
      getDoc(scopedDoc(db, 'shops', shopId)),
      getDoc(scopedDoc(db, 'shops_public', shopId)).catch(() => null),
      getDoc(scopedDoc(db, 'shops', shopId, 'settings', 'public')).catch(() => null),
    ]);
    if (!shopSnap.exists()) {
      throw new Error(`Shop "${shopId}" was not found.`);
    }
    const shopData = { ...(shopSnap.data() as Shop), id: shopId };
    const existingPublic = pubSnap?.exists() ? (pubSnap.data() as ShopPublic) : null;
    const publicSettings = settingsPubSnap?.exists() ? (settingsPubSnap.data() as Partial<StoreSettings>) : null;
    const cleanPublicDoc = buildValidShopPublicProjection(
      shopId,
      shopData,
      existingPublic,
      publicSettings,
      { status: 'active', updatedAt: startDate }
    );

    const batch = writeBatch(db);
    batch.update(scopedDoc(db, 'shops', shopId), {
      subscription: stripUndefined(subscription),
      status: 'active',
      updatedAt: startDate,
    });
    batch.set(scopedDoc(db, 'shops_public', shopId), cleanPublicDoc);
    await batch.commit();
    await logPlatformActivity(
      'Updated Shop Plan',
      'shop',
      shopId,
      `Assigned ${plan.name} (${params.billingCycle}, ${days}d${params.isFreeOverride ? ' FREE OVERRIDE' : ''})`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}`);
  }
}

export async function extendShopSubscription(shopId: string, extraDays: number): Promise<void> {
  try {
    await runTransaction(db, async (tx) => {
      const shopRef = scopedDoc(db, 'shops', shopId);
      const snap = await tx.get(shopRef);
      if (!snap.exists()) throw new Error('Shop not found');
      const shop = snap.data() as Shop;
      const now = new Date();
      const currentExpiry = shop.subscription?.expiryDate ? new Date(shop.subscription.expiryDate) : now;
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const nextExpiry = new Date(baseDate.getTime() + extraDays * 24 * 60 * 60 * 1000).toISOString();
      const nowIso = now.toISOString();

      tx.update(shopRef, {
        'subscription.expiryDate': nextExpiry,
        'subscription.status': 'active',
        updatedAt: nowIso,
      });
    });
    await logPlatformActivity('Extended Subscription', 'shop', shopId, `Extended shop ${shopId} by ${extraDays} days`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}`);
  }
}

export async function manageShopCnic(params: {
  shopId: string;
  action: 'assign' | 'release';
  cnic?: string;
  reason?: string;
}): Promise<{ ok: boolean; cnicStatus: string; cnicMasked: string }> {
  const cleanPayload = {
    shopId: params.shopId,
    action: params.action,
    cnic: params.cnic ? normalizeCnic(params.cnic) : undefined,
    reason: params.reason?.trim() || 'Super Admin CNIC audit action',
  };

  if (params.action === 'assign') {
    const check = isValidCnic(cleanPayload.cnic || '');
    if (!check.valid) {
      throw new Error(check.error || 'Valid 13-digit CNIC is required.');
    }
  }

  // In Demo Mode, only mutate inside the isolated /demo_env/default namespace (never production CF/API)
  if (isDemoNamespace()) {
    const now = new Date().toISOString();
    const isRelease = params.action === 'release';
    const rawCnic = cleanPayload.cnic || '';
    const masked = isRelease
      ? 'RELEASED'
      : `${rawCnic.slice(0, 5)}-XXXXXXX-${rawCnic.slice(-1)}`;
    const cnicStatus = isRelease ? 'released' : 'verified';
    await updateDoc(scopedDoc(db, 'shops', params.shopId), {
      cnicStatus,
      cnicVerified: !isRelease,
      cnicMasked: masked,
      cnicHash: isRelease ? '' : `demo_hash_${rawCnic.slice(-4)}`,
      updatedAt: now,
    });
    await logPlatformActivity(
      isRelease ? 'Demo CNIC Released' : 'Demo CNIC Assigned',
      'shop',
      params.shopId,
      `${cleanPayload.reason} (${masked})`
    );
    return { ok: true, cnicStatus, cnicMasked: masked };
  }

  try {
    const functions = getFunctions(auth.app);
    const manageFn = httpsCallable<typeof cleanPayload, { ok: boolean; cnicStatus: string; cnicMasked: string }>(
      functions,
      'manageShopCnicAdmin'
    );
    const res = await manageFn(cleanPayload);
    return res.data;
  } catch (cfErr: any) {
    const code = String(cfErr?.code || '');
    const msg = String(cfErr?.message || '');
    if (code.includes('already-exists') || msg.includes('Only one shop can be registered against one CNIC')) {
      throw new Error(DUPLICATE_CNIC_ERROR_MESSAGE);
    }
    if (code.includes('permission-denied') || code.includes('invalid-argument') || code.includes('not-found')) {
      throw new Error(msg || 'CNIC audit update failed.');
    }

    const token = await auth.currentUser?.getIdToken().catch(() => '');
    const res = await apiFetch('/api/super-admin/cnic/manage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(cleanPayload),
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      throw new Error('Could not reach CNIC management backend.');
    }
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error || 'CNIC management failed.');
    }
    return json;
  }
}

export async function deleteShopComplete(shopId: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Super Admin authentication required to delete a shop.');
  }

  if (isDemoNamespace()) {
    const shopSnap = await getDoc(scopedDoc(db, 'shops', shopId)).catch(() => null);
    const slug = shopSnap?.exists() ? String((shopSnap.data() as Shop).slug || '') : '';
    const subcollections = [
      'products',
      'orders',
      'customers',
      'categories',
      'banners',
      'settings',
      'pages',
      'coupons',
      'reviews',
      'inventory_logs',
      'stock_movements',
      'activity_logs',
      'notifications',
      'staff',
      'pickup_slots',
      'order_tracking',
      'contact_messages',
      'newsletter_subscribers',
      'pos_sales',
      'suppliers',
      'purchases',
      'khata_ledger',
      'expenses',
    ];
    for (const sub of subcollections) {
      const snap = await getDocs(scopedCollection(db, 'shops', shopId, sub)).catch(() => null);
      if (snap && !snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    const rootBatch = writeBatch(db);
    rootBatch.delete(scopedDoc(db, 'shops', shopId));
    rootBatch.delete(scopedDoc(db, 'shops_public', shopId));
    if (slug) {
      rootBatch.delete(scopedDoc(db, 'shop_slugs', slug));
    }
    await rootBatch.commit();
    await logPlatformActivity('Deleted Demo Shop', 'shop', shopId, `Removed demo tenant ${shopId} from demo_env/default`);
    return;
  }

  try {
    const functions = getFunctions(auth.app);
    const deleteFn = httpsCallable<{ shopId: string }, { ok: boolean }>(
      functions,
      'deleteShopCompleteAdmin'
    );
    await deleteFn({ shopId });
  } catch (err: any) {
    const msg = String(err?.message || '');
    throw new Error(
      msg ||
        'Complete shop deletion requires the deployed Super Admin Cloud Function (deleteShopCompleteAdmin).'
    );
  }
}

// ====================================================
// SUBSCRIPTION PAYMENT PROOFS & TRANSACTIONAL APPROVALS
// ====================================================

export async function submitSubscriptionPayment(
  data: Omit<PlatformPayment, 'id' | 'status' | 'createdAt'>
): Promise<string> {
  const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<PlatformPayment>({
    ...data,
    id,
    status: 'pending',
    createdAt: now,
  });
  try {
    await setDoc(scopedDoc(db, 'platform_payments', id), payload);
    await logPlatformActivity(
      'Submitted Subscription Payment',
      'payment',
      id,
      `${data.shopName} submitted Rs. ${data.amount} via ${data.method.toUpperCase()} (TID: ${data.transactionId})`
    );
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `platform_payments/${id}`);
  }
}

export async function getAllPlatformPayments(): Promise<PlatformPayment[]> {
  try {
    const snap = await getDocs(scopedCollection(db, 'platform_payments'));
    const list: PlatformPayment[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as PlatformPayment), id: d.id }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'platform_payments');
  }
}

export async function getPaymentsByShop(shopId: string): Promise<PlatformPayment[]> {
  try {
    const q = query(scopedCollection(db, 'platform_payments'), where('shopId', '==', shopId));
    const snap = await getDocs(q);
    const list: PlatformPayment[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as PlatformPayment), id: d.id }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

/**
 * Atomic transactional payment approval: guards against concurrent double approvals,
 * preserves/extends remaining days when renewing an active plan, and updates shops_public.
 */
export async function approvePlatformPayment(paymentId: string): Promise<void> {
  const reviewer = auth.currentUser?.email || 'Super Admin';
  const plans = await getSubscriptionPlans();

  try {
    let logMsg = '';
    await runTransaction(db, async (tx) => {
      const paymentRef = scopedDoc(db, 'platform_payments', paymentId);
      const paySnap = await tx.get(paymentRef);
      if (!paySnap.exists()) {
        throw new Error('Payment request not found');
      }
      const payment = paySnap.data() as PlatformPayment;
      if (payment.status !== 'pending') {
        throw new Error(`Payment ${paymentId} has already been processed (${payment.status}).`);
      }

      const shopRef = scopedDoc(db, 'shops', payment.shopId);
      const shopPubRef = scopedDoc(db, 'shops_public', payment.shopId);
      const [shopSnap, pubSnap] = await Promise.all([tx.get(shopRef), tx.get(shopPubRef)]);
      if (!shopSnap.exists()) {
        throw new Error(`Target shop "${payment.shopId}" no longer exists.`);
      }

      const shopData = shopSnap.data() as Shop;
      const existingPublic = pubSnap.exists() ? (pubSnap.data() as ShopPublic) : null;
      const plan = plans.find((p) => p.id === payment.planId) || DEFAULT_SUBSCRIPTION_PLANS[1];
      const cycleDays = payment.billingCycle === 'yearly' ? 365 : plan.durationDays || 30;
      const now = new Date();
      const nowIso = now.toISOString();

      const currentSub = shopData.subscription;
      const currentExpiry = currentSub?.expiryDate ? new Date(currentSub.expiryDate) : now;
      const isRenewSamePlan =
        currentSub?.planId === payment.planId &&
        currentSub?.status === 'active' &&
        currentExpiry > now;
      const baseTime = isRenewSamePlan ? currentExpiry.getTime() : now.getTime();
      const nextExpiryIso = new Date(baseTime + cycleDays * 86400000).toISOString();

      const cleanPublicDoc = buildValidShopPublicProjection(
        payment.shopId,
        { ...shopData, id: payment.shopId },
        existingPublic,
        undefined,
        { status: 'active', updatedAt: nowIso }
      );

      tx.update(paymentRef, {
        status: 'approved',
        reviewedBy: reviewer,
        reviewedAt: nowIso,
      });

      tx.update(shopRef, {
        status: 'active',
        subscription: stripUndefined({
          planId: payment.planId,
          planName: payment.planName,
          status: 'active',
          billingCycle: payment.billingCycle,
          pricePaid: Number(payment.amount || 0),
          startDate: isRenewSamePlan && currentSub?.startDate ? currentSub.startDate : nowIso,
          expiryDate: nextExpiryIso,
          isFreeOverride: false,
        }),
        updatedAt: nowIso,
      });

      tx.set(shopPubRef, cleanPublicDoc);
      logMsg = `Approved Rs. ${payment.amount} for ${payment.shopName} (${payment.planName})`;
    });

    await syncCommissionForApprovedPayment(paymentId).catch((e) => console.warn('Commission sync note:', e));

    await logPlatformActivity('Approved Payment', 'payment', paymentId, logMsg);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `platform_payments/${paymentId}`);
  }
}

export async function rejectPlatformPayment(paymentId: string, reason: string): Promise<void> {
  const reviewer = auth.currentUser?.email || 'Super Admin';
  try {
    await runTransaction(db, async (tx) => {
      const paymentRef = scopedDoc(db, 'platform_payments', paymentId);
      const paySnap = await tx.get(paymentRef);
      if (!paySnap.exists()) throw new Error('Payment request not found');
      if (paySnap.data()?.status !== 'pending') {
        throw new Error(`Payment ${paymentId} has already been processed (${paySnap.data()?.status}).`);
      }
      tx.update(paymentRef, {
        status: 'rejected',
        rejectionReason: reason || 'Payment verification failed or TID invalid.',
        reviewedBy: reviewer,
        reviewedAt: new Date().toISOString(),
      });
    });
    await reverseCommissionForPayment(paymentId, reason).catch(() => {});
    await logPlatformActivity('Rejected Payment', 'payment', paymentId, `Rejected payment ${paymentId}: ${reason}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `platform_payments/${paymentId}`);
  }
}

// ====================================================
// PLATFORM ANALYTICS & ACTIVITY LOGS
// ====================================================

export async function logPlatformActivity(
  action: string,
  targetType: ActivityLog['targetType'],
  targetId: string,
  details: string
): Promise<void> {
  try {
    const id = `plog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const payload: ActivityLog = {
      id,
      actorId: auth.currentUser?.uid || 'system',
      actorEmail: auth.currentUser?.email || 'system',
      action,
      targetType,
      targetId,
      details,
      createdAt: new Date().toISOString(),
    };
    await setDoc(scopedDoc(db, 'platform_activity_logs', id), payload);
  } catch (err) {
    console.warn('Could not log platform activity:', err);
  }
}

export async function getPlatformActivityLogs(maxItems = 50): Promise<ActivityLog[]> {
  try {
    const q = query(scopedCollection(db, 'platform_activity_logs'), orderBy('createdAt', 'desc'), limit(maxItems));
    const snap = await getDocs(q);
    const list: ActivityLog[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as ActivityLog), id: d.id }));
    return list;
  } catch {
    return [];
  }
}

export interface PlatformAnalyticsSummary {
  totalShops: number;
  activeShops: number;
  inactiveShops: number;
  suspendedShops: number;
  freeShops: number;
  paidShops: number;
  trialShops: number;
  expiredSubscriptions: number;
  pendingPaymentsCount: number;
  totalSubscriptionRevenue: number;
  monthlyRecurringRevenue: number;
  shopsRegisteredThisMonth: number;
  totalProductsAcrossShops: number;
  totalOrdersAcrossShops: number;
  totalRegisteredOwners: number;
  monthlyRegistrationsChart: { label: string; count: number }[];
  planBreakdown: { planName: string; count: number }[];
}

export async function getPlatformAnalytics(): Promise<PlatformAnalyticsSummary> {
  const [shops, payments, plans] = await Promise.all([
    getAllShopsAdmin(),
    getAllPlatformPayments(),
    getSubscriptionPlans(),
  ]);

  const now = new Date();
  const thisMonthPrefix = now.toISOString().slice(0, 7);
  const planMap = new Map(plans.map((p) => [p.id, p]));

  let activeShops = 0;
  let inactiveShops = 0;
  let suspendedShops = 0;
  let freeShops = 0;
  let paidShops = 0;
  let trialShops = 0;
  let expiredSubscriptions = 0;
  let monthlyRecurringRevenue = 0;
  let shopsRegisteredThisMonth = 0;
  let totalProductsAcrossShops = 0;
  let totalOrdersAcrossShops = 0;
  const uniqueOwners = new Set<string>();
  const planCounts = new Map<string, number>();

  for (const s of shops) {
    if (s.ownerId) uniqueOwners.add(s.ownerId);
    if (s.status === 'active') activeShops++;
    else if (s.status === 'suspended') suspendedShops++;
    else inactiveShops++;

    const sub = s.subscription;
    const plan = planMap.get(sub?.planId || '');
    const { isExpired } = getShopSubscriptionStatus(s);

    if (isExpired) expiredSubscriptions++;
    if (sub?.status === 'trial') trialShops++;

    if (!plan || plan.monthlyPrice === 0 || sub?.isFreeOverride) {
      freeShops++;
    } else {
      paidShops++;
      if (!isExpired && s.status === 'active') {
        monthlyRecurringRevenue += sub.billingCycle === 'yearly' ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
      }
    }

    const pName = sub?.planName || 'Starter Free';
    planCounts.set(pName, (planCounts.get(pName) || 0) + 1);

    if (s.createdAt?.startsWith(thisMonthPrefix)) {
      shopsRegisteredThisMonth++;
    }

    totalProductsAcrossShops += Number(s.usage?.productsCount || 0);
    totalOrdersAcrossShops += Number(s.usage?.ordersCount || 0);
  }

  const approvedPayments = payments.filter((p) => p.status === 'approved');
  const pendingPaymentsCount = payments.filter((p) => p.status === 'pending').length;
  const totalSubscriptionRevenue = approvedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const monthlyRegistrationsChart: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short' });
    const count = shops.filter((s) => s.createdAt?.startsWith(key)).length;
    monthlyRegistrationsChart.push({ label, count });
  }

  const planBreakdown = Array.from(planCounts.entries()).map(([planName, count]) => ({
    planName,
    count,
  }));

  return {
    totalShops: shops.length,
    activeShops,
    inactiveShops,
    suspendedShops,
    freeShops,
    paidShops,
    trialShops,
    expiredSubscriptions,
    pendingPaymentsCount,
    totalSubscriptionRevenue,
    monthlyRecurringRevenue,
    shopsRegisteredThisMonth,
    totalProductsAcrossShops,
    totalOrdersAcrossShops,
    totalRegisteredOwners: uniqueOwners.size,
    monthlyRegistrationsChart,
    planBreakdown,
  };
}

export async function updateShopAdminNotes(shopId: string, adminNotes: string): Promise<void> {
  try {
    await setDoc(
      scopedDoc(db, 'shops', shopId),
      {
        adminNotes,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    await logPlatformActivity('Updated Admin Notes', 'shop', shopId, `Updated internal Super Admin notes for ${shopId}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}`);
  }
}

// ====================================================
// PLATFORM SUPPORT TICKETS
// ====================================================

export async function createSupportTicket(
  input: Omit<SupportTicket, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<SupportTicket>({
    ...input,
    id,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  });
  try {
    await setDoc(scopedDoc(db, 'support_tickets', id), payload);
    await logPlatformActivity('Created Support Ticket', 'ticket', id, `${input.userEmail}: ${input.subject}`);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `support_tickets/${id}`);
  }
}

export async function getAllSupportTickets(): Promise<SupportTicket[]> {
  try {
    const snap = await getDocs(scopedCollection(db, 'support_tickets'));
    const list: SupportTicket[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as SupportTicket), id: d.id }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'support_tickets');
  }
}

export async function getShopSupportTickets(shopId: string): Promise<SupportTicket[]> {
  try {
    const uid = auth.currentUser?.uid;
    const colRef = scopedCollection(db, 'support_tickets');
    const q = uid
      ? query(colRef, where('shopId', '==', shopId), where('userId', '==', uid))
      : query(colRef, where('shopId', '==', shopId));
    const snap = await getDocs(q);
    const list: SupportTicket[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as SupportTicket), id: d.id }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function updateSupportTicket(
  ticketId: string,
  updates: { status: SupportTicket['status']; adminReply?: string }
): Promise<void> {
  try {
    await updateDoc(scopedDoc(db, 'support_tickets', ticketId), {
      ...stripUndefined(updates),
      updatedAt: new Date().toISOString(),
    });
    await logPlatformActivity('Updated Support Ticket', 'ticket', ticketId, `Set status to ${updates.status}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `support_tickets/${ticketId}`);
  }
}

// ====================================================
// DEMO ENVIRONMENT ADMIN-ONLY PROVISION & RESET
// ====================================================

export async function triggerDemoEnvironmentReset(): Promise<{
  ok: boolean;
  seededCounts?: Record<string, number>;
}> {
  if (isDemoNamespace()) {
    throw new Error('Forbidden: Demo accounts cannot reset the demo environment. Sign in as Production Super Admin.');
  }
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Production Super Admin authentication required.');
  }

  try {
    const fn = httpsCallable<undefined, { ok: boolean; seededCounts?: Record<string, number> }>(
      getFunctions(auth.app),
      'resetDemoEnvironmentAdmin'
    );
    const res = await fn();
    if (res.data?.ok) return res.data;
  } catch (cfErr: any) {
    const code = String(cfErr?.code || '');
    if (code.includes('permission-denied') || code.includes('unauthenticated')) {
      throw new Error(cfErr?.message || 'Only authorized Production Super Admins can reset demo data.');
    }
  }

  const token = await currentUser.getIdToken();
  const res = await apiFetch('/api/demo/reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error('Demo reset endpoint unavailable. Deploy Cloud Functions or configure VITE_API_BASE_URL.');
  }
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || 'Failed to reset demo environment.');
  }
  return json as { ok: boolean; seededCounts?: Record<string, number> };
}

export async function triggerProvisionDemoAdmin(password?: string): Promise<{
  ok: boolean;
  uid?: string;
  email?: string;
  seededCounts?: Record<string, number>;
}> {
  if (isDemoNamespace()) {
    throw new Error('Forbidden: Demo accounts cannot provision accounts.');
  }
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Production Super Admin authentication required.');
  }

  const fn = httpsCallable<{ password?: string }, { ok: boolean; uid?: string; email?: string; seededCounts?: Record<string, number> }>(
    getFunctions(auth.app),
    'provisionDemoSuperAdmin'
  );
  const res = await fn(password ? { password } : {});
  return res.data;
}

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { MigrationResult, Shop, StaffMember, ShopMembership } from '../types';
import {
  DEFAULT_SHOP_ID,
  INITIAL_SETTINGS,
  DEFAULT_SUBSCRIPTION_PLANS,
  DEFAULT_PLATFORM_SETTINGS,
  SUPER_ADMIN_EMAIL,
} from '../data/seedData';
import {
  stripUndefined,
  seedDefaultPlansIfEmpty,
  logPlatformActivity,
  toShopPublic,
} from './platformService';

async function verifySuperAdminCaller(uid?: string, email?: string | null): Promise<void> {
  if (!uid) {
    throw new Error('Unauthorized: You must be signed in as Super Admin to run legacy migration.');
  }
  if (email === SUPER_ADMIN_EMAIL && auth.currentUser?.emailVerified) {
    return;
  }
  const [adminSnap, legacyAdminSnap] = await Promise.all([
    getDoc(doc(db, 'platform_admins', uid)).catch(() => null),
    getDoc(doc(db, 'admins', uid)).catch(() => null),
  ]);
  if (adminSnap?.exists() || (legacyAdminSnap?.exists() && legacyAdminSnap.data()?.role === 'super_admin')) return;
  throw new Error('Forbidden: Super Admin privileges required to execute legacy migration.');
}

async function readCollectionDocs(
  colName: string,
  errors: string[]
): Promise<{ id: string; data: any }[]> {
  try {
    const snap = await getDocs(collection(db, colName));
    return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  } catch (err: any) {
    const msg = `Failed reading legacy collection "${colName}": ${err?.message || 'Permission or network error'}`;
    errors.push(msg);
    throw new Error(msg);
  }
}

export async function migrateLegacyBazaarPKToTenant(options?: {
  ownerUid?: string;
  ownerEmail?: string;
  ownerName?: string;
}): Promise<MigrationResult> {
  const shopId = DEFAULT_SHOP_ID;
  const shopSlug = DEFAULT_SHOP_ID;
  const now = new Date().toISOString();
  const currentUid = options?.ownerUid || auth.currentUser?.uid || '';
  const currentEmail = options?.ownerEmail || auth.currentUser?.email || SUPER_ADMIN_EMAIL;
  const currentName = options?.ownerName || auth.currentUser?.displayName || 'SB Khush Store Owner';

  const result: MigrationResult = {
    success: false,
    shopId,
    shopSlug,
    migratedCounts: {
      products: 0,
      categories: 0,
      banners: 0,
      coupons: 0,
      orders: 0,
      orderTracking: 0,
      reviews: 0,
      inventoryLogs: 0,
      contactMessages: 0,
      settings: 0,
    },
    skippedRecords: {},
    failedRecords: [],
    verifiedCounts: {},
    skippedCollections: [],
    errors: [],
    backupJson: '{}',
    timestamp: now,
  };

  try {
    // 0. Explicitly verify Super Admin authorization before touching data
    await verifySuperAdminCaller(currentUid, auth.currentUser?.email);

    // 1. Ensure platform plans & settings exist
    await seedDefaultPlansIfEmpty();
    const platSettingsSnap = await getDoc(doc(db, 'platform_settings', 'general'));
    if (!platSettingsSnap.exists()) {
      await setDoc(
        doc(db, 'platform_settings', 'general'),
        stripUndefined({ ...DEFAULT_PLATFORM_SETTINGS, updatedAt: now })
      );
    }

    // 2. Read all legacy collections cleanly (fails fast on read error instead of silent [])
    const [
      legacyProducts,
      legacyCategories,
      legacyBanners,
      legacyCoupons,
      legacyOrders,
      legacyTracking,
      legacyReviews,
      legacyInvLogs,
      legacyMessages,
      legacySettings,
    ] = await Promise.all([
      readCollectionDocs('products', result.errors),
      readCollectionDocs('categories', result.errors),
      readCollectionDocs('banners', result.errors),
      readCollectionDocs('coupons', result.errors),
      readCollectionDocs('orders', result.errors),
      readCollectionDocs('order_tracking', result.errors),
      readCollectionDocs('reviews', result.errors),
      readCollectionDocs('inventory_logs', result.errors),
      readCollectionDocs('contact_messages', result.errors),
      readCollectionDocs('settings', result.errors),
    ]);

    const backupPayload = {
      exportedAt: now,
      source: 'legacy_root_collections',
      counts: {
        products: legacyProducts.length,
        categories: legacyCategories.length,
        banners: legacyBanners.length,
        coupons: legacyCoupons.length,
        orders: legacyOrders.length,
        orderTracking: legacyTracking.length,
        reviews: legacyReviews.length,
        inventoryLogs: legacyInvLogs.length,
        contactMessages: legacyMessages.length,
        settings: legacySettings.length,
      },
      data: {
        products: legacyProducts,
        categories: legacyCategories,
        banners: legacyBanners,
        coupons: legacyCoupons,
        orders: legacyOrders,
        order_tracking: legacyTracking,
        reviews: legacyReviews,
        inventory_logs: legacyInvLogs,
        contact_messages: legacyMessages,
        settings: legacySettings,
      },
    };
    result.backupJson = JSON.stringify(backupPayload, null, 2);

    // 3. Prepare datasets directly from existing Firestore legacy collections (no synthetic demo fallback seeding)
    const productsToWrite = legacyProducts;
    const categoriesToWrite = legacyCategories;
    const bannersToWrite = legacyBanners;
    const couponsToWrite = legacyCoupons;
    const settingsDoc =
      legacySettings.find((s) => s.id === 'general')?.data || INITIAL_SETTINGS;

    // 4. Create or preserve master shops/bazaarpk, shops_public/bazaarpk & shop_slugs/bazaarpk
    await setDoc(
      doc(db, 'shop_slugs', shopSlug),
      {
        slug: shopSlug,
        shopId,
        ownerId: currentUid,
        name: settingsDoc.siteName || 'SB Khush Flagship',
        createdAt: now,
      },
      { merge: true }
    );

    const existingShopSnap = await getDoc(doc(db, 'shops', shopId));
    const enterprisePlan = DEFAULT_SUBSCRIPTION_PLANS[2];
    const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    let flagshipShop: Shop;
    if (!existingShopSnap.exists()) {
      flagshipShop = {
        id: shopId,
        slug: shopSlug,
        name: settingsDoc.siteName || 'SB Khush Flagship',
        ownerId: currentUid,
        ownerName: currentName,
        ownerEmail: currentEmail,
        ownerPhone: settingsDoc.contactPhone || '+92 300 1234567',
        city: settingsDoc.city || 'Karachi',
        address: settingsDoc.address || INITIAL_SETTINGS.address,
        logoUrl: settingsDoc.logoUrl || '',
        status: 'active',
        subscription: {
          planId: enterprisePlan.id,
          planName: enterprisePlan.name,
          status: 'active',
          billingCycle: 'yearly',
          pricePaid: 0,
          startDate: now,
          expiryDate: oneYearLater,
          isFreeOverride: true,
        },
        usage: {
          productsCount: productsToWrite.length,
          ordersCount: legacyOrders.length,
          storageBytes: 0,
          staffCount: 1,
        },
        theme: {
          primaryColor: '#065f46',
          accentColor: '#d97706',
          heroTitle: 'Authentic Pakistani Craftsmanship & Modern Essentials',
          heroSubtitle: 'Flagship multi-category store with nationwide COD, EasyPaisa, JazzCash, and Self-Pickup.',
          showTestimonials: true,
          showBuyingGuide: true,
        },
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'shops', shopId), stripUndefined(flagshipShop));
    } else {
      flagshipShop = { ...(existingShopSnap.data() as Shop), id: shopId };
    }

    // Always ensure shops_public/bazaarpk exists and stays synced
    await setDoc(
      doc(db, 'shops_public', shopId),
      stripUndefined(toShopPublic(flagshipShop, settingsDoc)),
      { merge: true }
    );

    // 5. Ensure owner staff + membership exist
    const staffDoc: StaffMember = {
      uid: currentUid,
      email: currentEmail,
      name: currentName,
      role: 'shop_owner',
      permissions: [
        'overview',
        'products',
        'categories',
        'orders',
        'customers',
        'inventory',
        'coupons',
        'banners',
        'appearance',
        'settings',
        'staff',
        'reports',
        'subscription',
      ],
      status: 'active',
      createdAt: now,
    };
    await setDoc(doc(db, 'shops', shopId, 'staff', currentUid), stripUndefined(staffDoc), { merge: true });

    const memDoc: ShopMembership = {
      shopId,
      shopName: settingsDoc.siteName || 'SB Khush Flagship',
      shopSlug,
      role: 'shop_owner',
      joinedAt: now,
    };
    await setDoc(doc(db, 'users', currentUid, 'shopMemberships', shopId), stripUndefined(memDoc), { merge: true });

    // 6. Idempotent subcollection migrator preserving existing target docs & verifying counts
    const migrateSubcollection = async (
      subName: string,
      items: { id: string; data: any }[],
      countKey: keyof MigrationResult['migratedCounts']
    ) => {
      if (items.length === 0) {
        result.skippedCollections.push(subName);
        result.skippedRecords[subName] = 0;
        result.verifiedCounts[subName] = { expectedMin: 0, actual: 0, matched: true };
        return;
      }

      const existingTargetSnap = await getDocs(collection(db, 'shops', shopId, subName));
      const existingIds = new Set(existingTargetSnap.docs.map((d) => d.id));
      const pending = items.filter((it) => !existingIds.has(it.id));
      const alreadyCount = items.length - pending.length;
      result.skippedRecords[subName] = alreadyCount;

      if (pending.length === 0) {
        result.skippedCollections.push(`${subName} (${alreadyCount} already synced)`);
      } else {
        for (let i = 0; i < pending.length; i += 400) {
          const chunk = pending.slice(i, i + 400);
          try {
            const batch = writeBatch(db);
            for (const item of chunk) {
              batch.set(
                doc(db, 'shops', shopId, subName, item.id),
                stripUndefined({ ...item.data, id: item.id, shopId })
              );
            }
            await batch.commit();
            result.migratedCounts[countKey] += chunk.length;
          } catch (batchErr: any) {
            for (const item of chunk) {
              result.failedRecords.push({
                collection: subName,
                id: item.id,
                error: batchErr?.message || 'Batch commit error',
              });
            }
          }
        }
      }

      const postSnap = await getDocs(collection(db, 'shops', shopId, subName));
      const expectedMin = items.length;
      result.verifiedCounts[subName] = {
        expectedMin,
        actual: postSnap.size,
        matched: postSnap.size >= expectedMin,
      };
    };

    // Migrate split settings (public + private) idempotently without overwriting existing docs
    const mergedSettings = { ...INITIAL_SETTINGS, ...settingsDoc };
    const [pubSettingsSnap, privSettingsSnap] = await Promise.all([
      getDoc(doc(db, 'shops', shopId, 'settings', 'public')),
      getDoc(doc(db, 'shops', shopId, 'settings', 'private')),
    ]);

    if (!pubSettingsSnap.exists()) {
      await setDoc(
        doc(db, 'shops', shopId, 'settings', 'public'),
        stripUndefined({
          siteName: mergedSettings.siteName,
          logoUrl: mergedSettings.logoUrl || '',
          primaryColor: mergedSettings.primaryColor || '#065f46',
          accentColor: mergedSettings.accentColor || '#d97706',
          announcement: mergedSettings.announcement,
          contactPhone: mergedSettings.contactPhone,
          whatsappNumber: mergedSettings.whatsappNumber,
          contactEmail: mergedSettings.contactEmail,
          address: mergedSettings.address,
          city: mergedSettings.city,
          shippingFee: mergedSettings.shippingFee,
          freeShippingThreshold: mergedSettings.freeShippingThreshold,
          currency: mergedSettings.currency,
          currencySymbol: mergedSettings.currencySymbol,
          aboutUs: mergedSettings.aboutUs,
          selfPickupDetails: mergedSettings.selfPickupDetails,
          socialLinks: mergedSettings.socialLinks,
          easypaisaDetails: mergedSettings.easypaisaDetails,
          jazzcashDetails: mergedSettings.jazzcashDetails,
          bankDetails: mergedSettings.bankDetails,
          updatedAt: now,
        })
      );
      result.migratedCounts.settings += 1;
    }

    if (!privSettingsSnap.exists()) {
      await setDoc(
        doc(db, 'shops', shopId, 'settings', 'private'),
        stripUndefined({
          bankDetails: mergedSettings.bankDetails,
          easypaisaDetails: mergedSettings.easypaisaDetails,
          jazzcashDetails: mergedSettings.jazzcashDetails,
          updatedAt: now,
        })
      );
    }

    await migrateSubcollection('categories', categoriesToWrite, 'categories');
    await migrateSubcollection('products', productsToWrite, 'products');
    await migrateSubcollection('banners', bannersToWrite, 'banners');
    await migrateSubcollection('coupons', couponsToWrite, 'coupons');
    await migrateSubcollection('orders', legacyOrders, 'orders');
    await migrateSubcollection('order_tracking', legacyTracking, 'orderTracking');
    await migrateSubcollection('reviews', legacyReviews, 'reviews');
    await migrateSubcollection('inventory_logs', legacyInvLogs, 'inventoryLogs');
    await migrateSubcollection('contact_messages', legacyMessages, 'contactMessages');

    // Update exact counts
    const [finalProds, finalOrders] = await Promise.all([
      getDocs(collection(db, 'shops', shopId, 'products')),
      getDocs(collection(db, 'shops', shopId, 'orders')),
    ]);
    await setDoc(
      doc(db, 'shops', shopId),
      {
        usage: {
          productsCount: finalProds.size,
          ordersCount: finalOrders.size,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    await logPlatformActivity(
      'Migrated Legacy Storefront',
      'migration',
      shopId,
      `Migrated legacy store data into tenant shop "${shopId}" (${result.migratedCounts.products} products, ${result.migratedCounts.orders} orders)`
    );

    result.success = result.failedRecords.length === 0 && result.errors.length === 0;
    return result;
  } catch (err: any) {
    if (!result.errors.includes(err?.message || 'Migration failed')) {
      result.errors.push(err?.message || 'Migration failed');
    }
    return result;
  }
}

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  increment,
  runTransaction,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import {
  Product,
  Category,
  Order,
  Coupon,
  Review,
  StoreSettings,
  Banner,
  InventoryLog,
  StockMovement,
  StockMovementType,
  CartItem,
  ContactMessage,
  StaffMember,
  ShopInvite,
  StaffPermission,
  NotificationItem,
  ActivityLog,
  ShopPageContent,
  Shop,
  ShopCustomerSummary,
  NewsletterSubscriber,
} from '../types';
import {
  INITIAL_SETTINGS,
  FALLBACK_PRODUCT_IMAGE,
  DEFAULT_SHOP_ID,
  DEFAULT_SUBSCRIPTION_PLANS,
} from '../data/seedData';
import { stripUndefined, getShopSubscriptionStatus } from './platformService';
import {
  generateTrackingToken,
  deriveTrackingTokenHash,
  deriveTrackingDocId,
} from '../utils/trackingCrypto';
import { buildApiUrl, isBackendApiAvailable } from '../config/api';
import {
  normalizeAndValidateSocialLinks,
  normalizeOptionalHttpUrl,
} from '../utils/socialLinks';

// ====================================================
// PLAN LIMIT & SUBSCRIPTION ENFORCEMENT HELPERS
// ====================================================

export function countActiveProducts(products: Pick<Product, 'status' | 'isPublished'>[]): number {
  return products.filter((p) => p.status !== 'archived' && p.isPublished !== false).length;
}

export function getProductLimitErrorMessage(planId: string | undefined, planName: string | undefined, activeCount: number, maxProducts: number): string {
  if (planId === 'free-starter' || maxProducts === 1) {
    return 'Your Free Plan allows only 1 active product. Upgrade to Starter to add up to 50 products.';
  }
  return `Active product limit reached (${activeCount}/${maxProducts} on ${planName || 'current plan'}). Archive unused items or upgrade your plan to add more active products.`;
}

export async function getShopAndPlanLimits(shopId: string) {
  const shopSnap = await getDoc(doc(db, 'shops', shopId));
  if (!shopSnap.exists()) {
    return {
      shop: null as Shop | null,
      plan: DEFAULT_SUBSCRIPTION_PLANS[0],
      isSuspended: false,
      isExpired: false,
    };
  }
  const shop = { ...(shopSnap.data() as Shop), id: shopSnap.id };
  const plansSnap = await getDoc(doc(db, 'platform_plans', shop.subscription?.planId || 'free-starter'));
  const defaultFallback =
    DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === shop.subscription?.planId) ||
    (shop.subscription?.planId === 'growth-plus' ? DEFAULT_SUBSCRIPTION_PLANS[2] : undefined) ||
    (shop.subscription?.planId === 'enterprise-pro' ? DEFAULT_SUBSCRIPTION_PLANS[3] : undefined) ||
    DEFAULT_SUBSCRIPTION_PLANS[0];
  const plan = plansSnap.exists() ? (plansSnap.data() as any) : defaultFallback;

  const { isSuspended, isExpired } = getShopSubscriptionStatus(shop);

  return { shop, plan, isSuspended, isExpired };
}

export async function logShopActivity(
  shopId: string,
  action: string,
  targetType: ActivityLog['targetType'],
  targetId: string,
  details: string
): Promise<void> {
  try {
    const id = `slog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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
    await setDoc(doc(db, 'shops', shopId, 'activity_logs', id), payload);
    await updateDoc(doc(db, 'shops', shopId), { lastActivityAt: payload.createdAt }).catch(() => {});
  } catch (err) {
    console.warn('Shop activity log warning:', err);
  }
}

export async function getShopActivityLogs(shopId: string): Promise<ActivityLog[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'activity_logs'));
    const list: ActivityLog[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as ActivityLog), id: d.id }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 60);
  } catch {
    return [];
  }
}

export async function getShopNotifications(shopId: string): Promise<NotificationItem[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'notifications'));
    const list: NotificationItem[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as NotificationItem), id: d.id }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 40);
  } catch {
    return [];
  }
}

export async function markNotificationRead(shopId: string, notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'notifications', notifId), { isRead: true });
  } catch {}
}

// ====================================================
// PRODUCTS (TENANT SCOPED + ACTIVE PRODUCT LIMIT GUARDED)
// ====================================================

export async function getShopProducts(
  shopId: string = DEFAULT_SHOP_ID,
  options?: { category?: string; featuredOnly?: boolean }
): Promise<Product[]> {
  const colPath = `shops/${shopId}/products`;
  try {
    const q = query(collection(db, 'shops', shopId, 'products'), where('isPublished', '==', true));
    const snap = await getDocs(q);
    const list: Product[] = [];
    snap.forEach((d) => {
      const data = d.data() as Product;
      if (data.status !== 'archived') {
        list.push({ ...data, id: d.id, shopId });
      }
    });
    let filtered = list;
    if (options?.category) filtered = filtered.filter((p) => p.category === options.category);
    if (options?.featuredOnly) filtered = filtered.filter((p) => p.isFeatured);
    return filtered;
  } catch (err) {
    console.warn(`Error fetching products for ${colPath}:`, err);
    return [];
  }
}

export async function getShopProductsAdmin(shopId: string = DEFAULT_SHOP_ID): Promise<Product[]> {
  const colPath = `shops/${shopId}/products`;
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'products'));
    const list: Product[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as Product), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, colPath);
  }
}

export async function getShopProductById(shopId: string, id: string): Promise<Product | null> {
  try {
    const snap = await getDoc(doc(db, 'shops', shopId, 'products', id));
    return snap.exists() ? { ...(snap.data() as Product), id: snap.id, shopId } : null;
  } catch {
    return null;
  }
}

export async function saveShopProduct(shopId: string, product: Partial<Product>): Promise<string> {
  const isNew = !product.id;
  const willBeActive = product.status !== 'archived' && product.isPublished !== false;

  if (willBeActive) {
    const { shop, plan, isSuspended, isExpired } = await getShopAndPlanLimits(shopId);
    if (isSuspended || isExpired) {
      throw new Error('Your store subscription is inactive or expired. Renew your plan to publish products.');
    }
    const maxProducts = Number(plan?.maxProducts ?? 1);
    if (maxProducts !== -1) {
      const existingSnap = await getDocs(collection(db, 'shops', shopId, 'products'));
      const otherActive = existingSnap.docs
        .filter((d) => d.id !== product.id)
        .map((d) => d.data() as Product)
        .filter((p) => p.status !== 'archived' && p.isPublished !== false);
      if (otherActive.length >= maxProducts) {
        throw new Error(
          getProductLimitErrorMessage(plan?.id, shop?.subscription?.planName, otherActive.length, maxProducts)
        );
      }
    }
  }

  const id = product.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const docData = stripUndefined<Product>({
    id,
    shopId,
    branchId: product.branchId,
    title: product.title || 'Untitled Product',
    slug: (product.title || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: product.description || '',
    purchasePrice: product.purchasePrice !== undefined ? Number(product.purchasePrice) : undefined,
    regularPrice: Number(product.regularPrice) || 0,
    salePrice: product.salePrice && Number(product.salePrice) > 0 ? Number(product.salePrice) : undefined,
    stock: Number(product.stock) || 0,
    minStockAlert: product.minStockAlert !== undefined ? Number(product.minStockAlert) : 5,
    unit: product.unit || 'Piece',
    category: product.category || 'general',
    brand: product.brand || 'Store Brand',
    images: product.images && product.images.length > 0 ? product.images : [FALLBACK_PRODUCT_IMAGE],
    sku: product.sku || `SKU-${Date.now().toString().slice(-6)}`,
    barcode: product.barcode?.trim() || undefined,
    variants: product.variants || [],
    shade: product.shade?.trim() || undefined,
    variantSize: product.variantSize?.trim() || undefined,
    skinHairCategory: product.skinHairCategory?.trim() || undefined,
    color: product.color?.trim() || undefined,
    designRef: product.designRef?.trim() || undefined,
    status: product.status || 'active',
    isFeatured: Boolean(product.isFeatured),
    isPublished: product.status === 'archived' ? false : product.isPublished !== false,
    rating: product.rating || 4.8,
    reviewCount: product.reviewCount || 0,
    specifications: product.specifications || {},
    createdAt: product.createdAt || now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'products', id), docData);
    if (isNew) {
      await updateDoc(doc(db, 'shops', shopId), {
        'usage.productsCount': increment(1),
        'onboardingChecklist.firstProductAdded': true,
        lastActivityAt: now,
      }).catch(() => {});
    }
    await logShopActivity(shopId, isNew ? 'Created Product' : 'Updated Product', 'product', id, docData.title);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/products/${id}`);
  }
}

export async function archiveShopProduct(shopId: string, id: string, archive = true): Promise<void> {
  if (!archive) {
    // Re-activating must pass active-product plan quota check
    const existing = await getShopProductById(shopId, id);
    if (existing) {
      await saveShopProduct(shopId, { ...existing, status: 'active', isPublished: true });
      return;
    }
  }
  try {
    await updateDoc(doc(db, 'shops', shopId, 'products', id), {
      status: archive ? 'archived' : 'active',
      isPublished: !archive,
      updatedAt: new Date().toISOString(),
    });
    await logShopActivity(
      shopId,
      archive ? 'Archived Product' : 'Restored Product',
      'product',
      id,
      `${archive ? 'Archived' : 'Restored'} product ${id}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}/products/${id}`);
  }
}

export async function deleteShopProduct(shopId: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'products', id));
    const snap = await getDoc(doc(db, 'shops', shopId));
    if (snap.exists()) {
      const currentCount = Number(snap.data()?.usage?.productsCount || 0);
      await updateDoc(doc(db, 'shops', shopId), {
        'usage.productsCount': Math.max(0, currentCount - 1),
      }).catch(() => {});
    }
    await logShopActivity(shopId, 'Deleted Product', 'product', id, `Removed product ${id}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/products/${id}`);
  }
}

// ====================================================
// CATEGORIES
// ====================================================

export async function getShopCategories(shopId: string = DEFAULT_SHOP_ID): Promise<Category[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'categories'));
    const list: Category[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as Category), id: d.id, shopId }));
    return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch {
    return [];
  }
}

export async function saveShopCategory(shopId: string, category: Partial<Category>): Promise<string> {
  const id = category.id || `cat_${Date.now()}`;
  const docData = stripUndefined<Category>({
    id,
    shopId,
    name: category.name || 'New Category',
    slug: category.slug || (category.name || 'cat').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: category.description || '',
    imageUrl: category.imageUrl || FALLBACK_PRODUCT_IMAGE,
    order: category.order || 1,
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'categories', id), docData);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/categories/${id}`);
  }
}

export async function deleteShopCategory(shopId: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'categories', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/categories/${id}`);
  }
}

// ====================================================
// BANNERS
// ====================================================

export async function getShopBanners(shopId: string = DEFAULT_SHOP_ID, includeInactive = false): Promise<Banner[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'banners'));
    const list: Banner[] = [];
    snap.forEach((d) => {
      const b = d.data() as Banner;
      if (includeInactive || b.isActive !== false) {
        list.push({ ...b, id: d.id, shopId });
      }
    });
    return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch {
    return [];
  }
}

export async function saveShopBanner(shopId: string, banner: Partial<Banner>): Promise<string> {
  const { plan, isExpired, isSuspended } = await getShopAndPlanLimits(shopId);
  if (isSuspended || isExpired) {
    throw new Error('Subscription expired or store suspended. Renew your plan to update banners.');
  }
  if (plan && plan.features && plan.features.banners === false) {
    throw new Error('Promotional banners are not enabled on your current plan.');
  }
  const id = banner.id || `ban_${Date.now()}`;
  const payload = stripUndefined<Banner>({
    id,
    shopId,
    title: banner.title || 'Featured Collection',
    subtitle: banner.subtitle || '',
    link: banner.link || '/shop',
    imageUrl: banner.imageUrl || FALLBACK_PRODUCT_IMAGE,
    buttonText: banner.buttonText || 'Shop Now',
    isActive: banner.isActive !== false,
    order: Number(banner.order) || 1,
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'banners', id), payload);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/banners/${id}`);
  }
}

export async function deleteShopBanner(shopId: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'banners', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/banners/${id}`);
  }
}

// ====================================================
// ORDERS & TOKENIZED NON-PII TRACKING
// ====================================================

const clientOrderIdempotencyCache = new Map<string, Order>();

export async function createShopOrder(
  shopId: string,
  orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>
): Promise<Order> {
  if (orderData.paymentMethod === 'online') {
    throw new Error('Online card payments are not enabled. Please choose COD, EasyPaisa, JazzCash, or Bank Transfer.');
  }

  const idemKey = (orderData.idempotencyKey || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const cacheKey = idemKey ? `${shopId}:${idemKey}` : '';
  if (cacheKey && clientOrderIdempotencyCache.has(cacheKey)) {
    return clientOrderIdempotencyCache.get(cacheKey)!;
  }

  const signedInUid = auth.currentUser?.uid;
  const effectiveUserId = signedInUid || 'guest';

  if (effectiveUserId === 'guest' && isBackendApiAvailable()) {
    try {
      const response = await fetch(buildApiUrl('/api/orders/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderData, shopId, userId: 'guest', idempotencyKey: idemKey || undefined }),
      });
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const serverOrder = await response.json();
        if (!serverOrder.requiresClientAuthWrite) {
          if (cacheKey) clientOrderIdempotencyCache.set(cacheKey, serverOrder as Order);
          return serverOrder as Order;
        }
      } else if (!response.ok && contentType.includes('application/json')) {
        const errBody = await response.json().catch(() => null);
        if (response.status === 400 && errBody?.error) {
          throw new Error(errBody.error);
        }
      }
    } catch (apiErr: any) {
      if (apiErr?.message && /stock|unavailable|disabled|invalid|payment/i.test(apiErr.message)) {
        throw apiErr;
      }
      console.warn('Guest API order fallback to client Firestore:', apiErr);
    }
  }

  const id = idemKey
    ? `ord_${idemKey}`
    : `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Pre-check existing order for signed-in idempotent retries
  if (idemKey && effectiveUserId !== 'guest') {
    const existingOrderSnap = await getDoc(doc(db, 'shops', shopId, 'orders', id)).catch(() => null);
    if (existingOrderSnap?.exists()) {
      const existingOrder = { ...(existingOrderSnap.data() as Order), id: existingOrderSnap.id, shopId };
      if (cacheKey) clientOrderIdempotencyCache.set(cacheKey, existingOrder);
      return existingOrder;
    }
  }

  // Validate product availability & stock before writing order
  for (const item of orderData.items || []) {
    if (!item.productId) continue;
    const prodSnap = await getDoc(doc(db, 'shops', shopId, 'products', item.productId)).catch(() => null);
    if (prodSnap && prodSnap.exists()) {
      const prod = prodSnap.data() as Product;
      if (prod.isPublished === false || prod.status === 'archived') {
        throw new Error(`Product "${prod.title || item.title}" is no longer available.`);
      }
      if (typeof prod.stock === 'number' && prod.stock < item.quantity) {
        throw new Error(`Insufficient stock for "${prod.title || item.title}". Available: ${prod.stock}`);
      }
    }
  }

  const orderNumber = `PK-${Math.floor(100000 + Math.random() * 900000)}`;
  const now = new Date().toISOString();
  const trackingToken = generateTrackingToken();
  const trackingTokenHash = await deriveTrackingTokenHash(orderNumber, trackingToken);
  const trackDocId = `trk_${trackingTokenHash.slice(0, 32)}`;

  const fullOrder = stripUndefined<Order>({
    ...orderData,
    id,
    shopId,
    orderNumber,
    trackingTokenHash,
    userId: effectiveUserId,
    idempotencyKey: idemKey || undefined,
    paymentStatus: 'pending',
    orderStatus: 'Pending',
    createdAt: now,
    updatedAt: now,
  });

  // Strict non-PII tracking projection matching isValidOrderTracking() in firestore.rules
  const safeFirstName = (fullOrder.customer.name || 'Customer').trim().split(/\s+/)[0] || 'Customer';
  const trackingDoc = stripUndefined({
    orderNumber,
    orderId: id,
    shopId,
    trackingTokenHash,
    orderStatus: 'Pending',
    fulfillmentMethod: fullOrder.fulfillmentMethod || 'delivery',
    pickupDetails: fullOrder.pickupDetails,
    paymentMethod: fullOrder.paymentMethod,
    paymentStatus: 'pending',
    customerName: safeFirstName,
    city: fullOrder.customer.city,
    items: fullOrder.items.map((it) => ({
      productId: it.productId,
      title: it.title,
      price: it.price,
      quantity: it.quantity,
      image: it.image,
    })),
    total: fullOrder.total,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'shops', shopId, 'orders', id), fullOrder);
    batch.set(doc(db, 'shops', shopId, 'order_tracking', trackDocId), trackingDoc);

    const notifId = `ntf_${Date.now()}`;
    batch.set(doc(db, 'shops', shopId, 'notifications', notifId), {
      id: notifId,
      title: `New Order ${orderNumber}`,
      message: `${safeFirstName} placed a Rs. ${fullOrder.total.toLocaleString()} order via ${fullOrder.paymentMethod.toUpperCase()}`,
      type: 'order',
      isRead: false,
      link: '/dashboard/orders',
      createdAt: now,
    });
    await batch.commit();
    const created = { ...fullOrder, trackingToken };
    if (cacheKey) clientOrderIdempotencyCache.set(cacheKey, created);
    return created;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}/orders/${id}`);
  }
}

export async function getShopOrdersByUser(shopId: string, userId: string): Promise<Order[]> {
  try {
    const q = query(collection(db, 'shops', shopId, 'orders'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const list: Order[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as Order), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/orders`);
  }
}

export async function getAllShopOrdersAdmin(shopId: string): Promise<Order[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'orders'));
    const list: Order[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as Order), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/orders`);
  }
}

export async function updateShopOrderStatus(
  shopId: string,
  orderId: string,
  updates: Partial<Order>,
  orderNumber?: string
): Promise<void> {
  const now = new Date().toISOString();
  const cleanUpdates = stripUndefined({ ...updates, updatedAt: now });

  try {
    const orderRef = doc(db, 'shops', shopId, 'orders', orderId);
    await updateDoc(orderRef, cleanUpdates);

    const ordSnap = await getDoc(orderRef).catch(() => null);
    const ordData = ordSnap?.exists() ? (ordSnap.data() as Order) : null;
    const resolvedOrderNumber = orderNumber || ordData?.orderNumber;
    const trackingHash = ordData?.trackingTokenHash;

    const trackUpdates = stripUndefined({
      orderStatus: updates.orderStatus,
      paymentStatus: updates.paymentStatus,
      courierName: updates.courierName,
      trackingNumber: updates.trackingNumber,
      updatedAt: now,
    });

    if (Object.keys(trackUpdates).length > 1) {
      if (trackingHash) {
        const trackDocId = `trk_${trackingHash.slice(0, 32)}`;
        await updateDoc(doc(db, 'shops', shopId, 'order_tracking', trackDocId), trackUpdates).catch(() => {});
      }
      if (resolvedOrderNumber) {
        await updateDoc(doc(db, 'shops', shopId, 'order_tracking', resolvedOrderNumber), trackUpdates).catch(() => {});
      }
    }

    await logShopActivity(
      shopId,
      'Updated Order',
      'order',
      orderId,
      `Order ${resolvedOrderNumber || orderId} -> ${updates.orderStatus || updates.paymentStatus}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}/orders/${orderId}`);
  }
}

/**
 * Verifies tokenized non-PII parcel tracking for guests or authenticated user own orders.
 * Never exposes customer email, phone, street address, or payment proof via tracking documents.
 */
export async function trackShopOrder(shopId: string, ref: string, token?: string): Promise<Order | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  const upperRef = trimmed.toUpperCase();
  const cleanToken = (token || '').trim();

  // 1. Authenticated user lookup within their own orders
  if (auth.currentUser?.uid) {
    try {
      const userOrders = await getShopOrdersByUser(shopId, auth.currentUser.uid);
      const cleanedInput = trimmed.replace(/[\s-]/g, '');
      const match = userOrders.find(
        (o) =>
          o.orderNumber.toUpperCase() === upperRef ||
          o.customer?.phone?.replace(/[\s-]/g, '') === cleanedInput
      );
      if (match) return match;
    } catch {}
  }

  // 2. Tokenized guest lookup requires BOTH orderNumber AND secret trackingToken
  if (/^PK-[A-Z0-9]+$/.test(upperRef) && cleanToken) {
    try {
      const expectedHash = await deriveTrackingTokenHash(upperRef, cleanToken);
      const trackDocId = await deriveTrackingDocId(upperRef, cleanToken);
      const trackSnap = await getDoc(doc(db, 'shops', shopId, 'order_tracking', trackDocId));
      if (trackSnap.exists()) {
        const td = trackSnap.data();
        if (td.orderNumber === upperRef && td.trackingTokenHash === expectedHash) {
          return {
            id: td.orderId || upperRef,
            shopId,
            orderNumber: td.orderNumber,
            userId: 'tracking',
            customer: {
              name: td.customerName || 'Customer',
              email: '',
              phone: '',
              address: '',
              city: td.city || 'Pakistan',
              postalCode: '',
            },
            items: td.items || [],
            subtotal: td.total || 0,
            shippingFee: 0,
            discount: 0,
            total: td.total || 0,
            fulfillmentMethod: td.fulfillmentMethod || 'delivery',
            pickupDetails: td.pickupDetails,
            paymentMethod: td.paymentMethod || 'cod',
            paymentStatus: td.paymentStatus || 'pending',
            orderStatus: td.orderStatus || 'Pending',
            courierName: td.courierName,
            trackingNumber: td.trackingNumber,
            createdAt: td.createdAt,
            updatedAt: td.updatedAt,
          };
        }
      }
    } catch {}

    // Server backend fallback if running Node API
    if (isBackendApiAvailable()) {
      try {
        const res = await fetch(
          buildApiUrl(`/api/orders/track?shopId=${encodeURIComponent(shopId)}&ref=${encodeURIComponent(upperRef)}&token=${encodeURIComponent(cleanToken)}`)
        );
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return (await res.json()) as Order;
        }
      } catch {}
    }
  }

  return null;
}

// ====================================================
// SETTINGS (PUBLIC vs PRIVATE SPLIT) & CMS PAGES
// ====================================================

export function mergeStoreSettingsPatch(
  existing: StoreSettings,
  patch: Partial<StoreSettings>
): StoreSettings {
  const merged: StoreSettings = {
    ...existing,
    ...patch,
    bankDetails: patch.bankDetails
      ? { ...existing.bankDetails, ...patch.bankDetails }
      : existing.bankDetails,
    easypaisaDetails: patch.easypaisaDetails
      ? { ...existing.easypaisaDetails, ...patch.easypaisaDetails }
      : existing.easypaisaDetails,
    jazzcashDetails: patch.jazzcashDetails
      ? { ...existing.jazzcashDetails, ...patch.jazzcashDetails }
      : existing.jazzcashDetails,
    selfPickupDetails: patch.selfPickupDetails
      ? { ...existing.selfPickupDetails, ...patch.selfPickupDetails }
      : existing.selfPickupDetails,
    socialLinks:
      patch.socialLinks !== undefined
        ? normalizeAndValidateSocialLinks(patch.socialLinks)
        : existing.socialLinks,
  };
  if (patch.websiteUrl !== undefined) {
    merged.websiteUrl = normalizeOptionalHttpUrl(patch.websiteUrl, 'Store Website URL');
  }
  return merged;
}

function normalizeStoreSettings(data: Partial<StoreSettings>): StoreSettings {
  return {
    ...INITIAL_SETTINGS,
    ...data,
    codEnabled: data.codEnabled !== false,
    bankDetails: {
      ...INITIAL_SETTINGS.bankDetails,
      ...(data.bankDetails || {}),
      enabled: data.bankDetails?.enabled !== false,
    },
    easypaisaDetails: { ...INITIAL_SETTINGS.easypaisaDetails, ...(data.easypaisaDetails || {}) },
    jazzcashDetails: { ...INITIAL_SETTINGS.jazzcashDetails, ...(data.jazzcashDetails || {}) },
    selfPickupDetails: { ...INITIAL_SETTINGS.selfPickupDetails, ...(data.selfPickupDetails || {}) },
    socialLinks: { ...(data.socialLinks || {}) },
  };
}

/**
 * Public-safe storefront settings getter: reads ONLY shops/{shopId}/settings/public.
 */
export async function getShopPublicSettings(shopId: string = DEFAULT_SHOP_ID): Promise<StoreSettings> {
  try {
    const pubSnap = await getDoc(doc(db, 'shops', shopId, 'settings', 'public'));
    if (pubSnap.exists()) {
      return normalizeStoreSettings(pubSnap.data() as Partial<StoreSettings>);
    }
    return INITIAL_SETTINGS;
  } catch (err) {
    console.warn(`Could not read public settings for shop ${shopId}:`, err);
    return INITIAL_SETTINGS;
  }
}

/**
 * Authenticated Shop Admin settings getter: merges settings/public + settings/private
 * (with fallback to legacy settings/general for older docs).
 */
export async function getShopSettings(shopId: string = DEFAULT_SHOP_ID): Promise<StoreSettings> {
  try {
    const [pubSnap, privSnap] = await Promise.all([
      getDoc(doc(db, 'shops', shopId, 'settings', 'public')).catch(() => null),
      getDoc(doc(db, 'shops', shopId, 'settings', 'private')).catch(() => null),
    ]);

    if (pubSnap?.exists() || privSnap?.exists()) {
      const merged: Partial<StoreSettings> = {
        ...(pubSnap?.exists() ? pubSnap.data() : {}),
        ...(privSnap?.exists() ? privSnap.data() : {}),
      };
      return normalizeStoreSettings(merged);
    }

    const genSnap = await getDoc(doc(db, 'shops', shopId, 'settings', 'general')).catch(() => null);
    if (genSnap && genSnap.exists()) {
      return normalizeStoreSettings(genSnap.data() as Partial<StoreSettings>);
    }
    return INITIAL_SETTINGS;
  } catch (err) {
    console.warn(`Could not load shop settings for ${shopId}:`, err);
    return INITIAL_SETTINGS;
  }
}

export async function updateShopSettings(shopId: string, settingsPatch: Partial<StoreSettings>): Promise<StoreSettings> {
  const nowIso = new Date().toISOString();
  const current = await getShopSettings(shopId);
  const settings = mergeStoreSettingsPatch(current, settingsPatch);

  const publicSettingsPayload = stripUndefined({
    siteName: settings.siteName,
    logoUrl: settings.logoUrl || '',
    websiteUrl: settings.websiteUrl || '',
    primaryColor: settings.primaryColor || '#065f46',
    accentColor: settings.accentColor || '#d97706',
    announcement: settings.announcement,
    contactPhone: settings.contactPhone,
    whatsappNumber: settings.whatsappNumber,
    contactEmail: settings.contactEmail,
    address: settings.address,
    city: settings.city,
    shippingFee: Number(settings.shippingFee) || 0,
    freeShippingThreshold: Number(settings.freeShippingThreshold) || 0,
    currency: settings.currency || 'PKR',
    currencySymbol: settings.currencySymbol || 'Rs.',
    aboutUs: settings.aboutUs,
    businessHours: settings.businessHours,
    seoTitle: settings.seoTitle,
    seoDescription: settings.seoDescription,
    ogImageUrl: settings.ogImageUrl || '',
    codEnabled: settings.codEnabled !== false,
    selfPickupDetails: settings.selfPickupDetails,
    socialLinks: settings.socialLinks,
    // Buyer checkout transfer details ONLY exposed on public doc when enabled by merchant
    easypaisaDetails: settings.easypaisaDetails?.enabled
      ? settings.easypaisaDetails
      : { enabled: false, accountTitle: '', accountNumber: '' },
    jazzcashDetails: settings.jazzcashDetails?.enabled
      ? settings.jazzcashDetails
      : { enabled: false, accountTitle: '', accountNumber: '' },
    bankDetails:
      settings.bankDetails?.enabled !== false
        ? { ...settings.bankDetails, enabled: true }
        : { enabled: false, bankName: '', accountTitle: '', accountNumber: '', iban: '' },
    updatedAt: nowIso,
  });

  const privateSettingsPayload = stripUndefined({
    bankDetails: settings.bankDetails,
    easypaisaDetails: settings.easypaisaDetails,
    jazzcashDetails: settings.jazzcashDetails,
    updatedAt: nowIso,
  });

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'shops', shopId, 'settings', 'public'), publicSettingsPayload, { merge: true });
    batch.set(doc(db, 'shops', shopId, 'settings', 'private'), privateSettingsPayload, { merge: true });
    batch.update(
      doc(db, 'shops', shopId),
      stripUndefined({
        name: settings.siteName,
        logoUrl: settings.logoUrl || '',
        city: settings.city,
        address: settings.address,
        'theme.primaryColor': settings.primaryColor || '#065f46',
        'theme.accentColor': settings.accentColor || '#d97706',
        'onboardingChecklist.logoUploaded': Boolean(settings.logoUrl),
        'onboardingChecklist.paymentConfigured': Boolean(
          settings.codEnabled !== false ||
            settings.easypaisaDetails?.enabled ||
            settings.jazzcashDetails?.enabled ||
            (settings.bankDetails?.enabled !== false && settings.bankDetails?.accountNumber)
        ),
        updatedAt: nowIso,
      })
    );
    batch.set(
      doc(db, 'shops_public', shopId),
      stripUndefined({
        id: shopId,
        slug: shopId,
        name: settings.siteName,
        logoUrl: settings.logoUrl || '',
        websiteUrl: settings.websiteUrl || '',
        ogImageUrl: settings.ogImageUrl || '',
        city: settings.city || '',
        publicContactPhone: settings.contactPhone || '',
        publicSupportEmail: settings.contactEmail || '',
        storefrontAddress: settings.address || '',
        businessHours: settings.businessHours || '',
        seoTitle: settings.seoTitle || '',
        seoDescription: settings.seoDescription || '',
        socialLinks: settings.socialLinks || {},
        theme: {
          primaryColor: settings.primaryColor || '#065f46',
          accentColor: settings.accentColor || '#d97706',
        },
        updatedAt: nowIso,
      }),
      { merge: true }
    );
    await batch.commit();
    await logShopActivity(shopId, 'Updated Settings', 'settings', 'public', `Updated settings for ${settings.siteName}`);
    return settings;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/settings/public`);
  }
}

export async function getShopPageContent(shopId: string, key: ShopPageContent['key']): Promise<ShopPageContent | null> {
  try {
    const snap = await getDoc(doc(db, 'shops', shopId, 'pages', key));
    return snap.exists() ? (snap.data() as ShopPageContent) : null;
  } catch {
    return null;
  }
}

export async function saveShopPageContent(shopId: string, page: ShopPageContent): Promise<void> {
  const { plan, isExpired, isSuspended } = await getShopAndPlanLimits(shopId);
  if (isSuspended || isExpired) {
    throw new Error('Subscription expired or suspended. Renew your plan to edit storefront CMS pages.');
  }
  if (plan && plan.features && plan.features.customPages === false) {
    throw new Error('Custom CMS pages are not enabled on your current plan.');
  }
  try {
    await setDoc(doc(db, 'shops', shopId, 'pages', page.key), stripUndefined(page));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/pages/${page.key}`);
  }
}

// ====================================================
// COUPONS
// ====================================================

export async function getShopCoupons(shopId: string = DEFAULT_SHOP_ID): Promise<Coupon[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'coupons'));
    const list: Coupon[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as Coupon), id: d.id, shopId }));
    return list;
  } catch {
    return [];
  }
}

export async function saveShopCoupon(shopId: string, coupon: Partial<Coupon>): Promise<string> {
  const { plan, isExpired, isSuspended } = await getShopAndPlanLimits(shopId);
  if (isSuspended || isExpired) {
    throw new Error('Subscription expired or store suspended. Renew your plan to manage coupons.');
  }
  if (!plan?.features?.coupons) {
    throw new Error('Discount coupons are available on Growth & Enterprise plans. Upgrade your subscription to unlock coupons.');
  }
  const id = coupon.id || `cpn_${Date.now()}`;
  const docData = stripUndefined<Coupon>({
    id,
    shopId,
    code: (coupon.code || 'SALE').toUpperCase().trim(),
    discountType: coupon.discountType || 'percentage',
    discountValue: Number(coupon.discountValue) || 10,
    minOrderValue: Number(coupon.minOrderValue) || 0,
    expiryDate: coupon.expiryDate || '2028-12-31',
    usageLimit: coupon.usageLimit || 500,
    usageCount: coupon.usageCount || 0,
    isActive: coupon.isActive !== false,
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'coupons', id), docData);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/coupons/${id}`);
  }
}

export async function deleteShopCoupon(shopId: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'coupons', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/coupons/${id}`);
  }
}

// ====================================================
// CART & WISHLIST (TENANT ISOLATED)
// ====================================================

export async function saveShopUserCart(shopId: string, userId: string, items: CartItem[]): Promise<void> {
  if (!userId || userId === 'guest') return;
  try {
    const cleanItems = items.map((item) =>
      stripUndefined({
        productId: item.productId,
        quantity: item.quantity,
        selectedVariants: item.selectedVariants || {},
        itemKey: item.itemKey,
        title: item.product.title,
        price: item.product.salePrice ?? item.product.regularPrice,
        regularPrice: item.product.regularPrice,
        salePrice: item.product.salePrice,
        image: item.product.images[0] || FALLBACK_PRODUCT_IMAGE,
        brand: item.product.brand,
        category: item.product.category,
        stock: item.product.stock,
      })
    );
    await setDoc(doc(db, 'shops', shopId, 'carts', userId), {
      userId,
      shopId,
      items: cleanItems,
      updatedAt: new Date().toISOString(),
    });
  } catch {}
}

export async function loadShopUserCart(shopId: string, userId: string): Promise<any[] | null> {
  if (!userId || userId === 'guest') return null;
  try {
    const snap = await getDoc(doc(db, 'shops', shopId, 'carts', userId));
    return snap.exists() ? snap.data().items || [] : null;
  } catch {
    return null;
  }
}

export async function saveShopUserWishlist(shopId: string, userId: string, productIds: string[]): Promise<void> {
  if (!userId || userId === 'guest') return;
  try {
    await setDoc(doc(db, 'shops', shopId, 'wishlists', userId), {
      userId,
      shopId,
      productIds,
      updatedAt: new Date().toISOString(),
    });
  } catch {}
}

export async function loadShopUserWishlist(shopId: string, userId: string): Promise<string[]> {
  if (!userId || userId === 'guest') return [];
  try {
    const snap = await getDoc(doc(db, 'shops', shopId, 'wishlists', userId));
    return snap.exists() ? snap.data().productIds || [] : [];
  } catch {
    return [];
  }
}

// ====================================================
// REVIEWS, INVENTORY, CUSTOMERS, CONTACT MESSAGES
// ====================================================

export async function getShopRecentReviews(shopId: string, limitCount = 6): Promise<Review[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'reviews'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const list: Review[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as Review), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function getShopProductReviews(shopId: string, productId: string): Promise<Review[]> {
  try {
    const q = query(collection(db, 'shops', shopId, 'reviews'), where('productId', '==', productId));
    const snap = await getDocs(q);
    const list: Review[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as Review), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function addShopProductReview(shopId: string, review: Omit<Review, 'id' | 'createdAt'>): Promise<string> {
  const id = `rev_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const payload = stripUndefined({
    ...review,
    id,
    shopId,
    createdAt: new Date().toISOString(),
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'reviews', id), payload);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}/reviews/${id}`);
  }
}

export async function getShopInventoryLogs(shopId: string): Promise<InventoryLog[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'inventory_logs'));
    const list: InventoryLog[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as InventoryLog), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function getShopStockMovements(shopId: string): Promise<StockMovement[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'stock_movements'));
    const list: StockMovement[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as StockMovement), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch {
    return [];
  }
}

export async function adjustShopStock(
  shopId: string,
  productId: string,
  delta: number,
  reason: string,
  updatedBy: string,
  movementType: StockMovementType = delta >= 0 ? 'stock_in' : 'stock_out',
  referenceTransaction?: string
): Promise<void> {
  const prodRef = doc(db, 'shops', shopId, 'products', productId);
  const nowIso = new Date().toISOString();
  const uid = auth.currentUser?.uid || updatedBy;

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(prodRef);
      if (!snap.exists()) throw new Error('Product not found in this shop');
      const prod = snap.data() as Product;
      const previousStock = Number(prod.stock || 0);
      const newStock = Math.max(0, previousStock + delta);

      tx.update(prodRef, { stock: newStock, updatedAt: nowIso });

      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      tx.set(doc(db, 'shops', shopId, 'inventory_logs', logId), {
        id: logId,
        shopId,
        productId,
        productTitle: prod.title,
        changeQuantity: delta,
        previousStock,
        newStock,
        reason,
        updatedBy,
        createdAt: nowIso,
      });

      const movId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      tx.set(
        doc(db, 'shops', shopId, 'stock_movements', movId),
        stripUndefined<StockMovement>({
          id: movId,
          shopId,
          productId,
          productTitle: prod.title,
          type: movementType,
          quantityChange: delta,
          previousQuantity: previousStock,
          newQuantity: newStock,
          reason,
          userId: uid,
          userEmail: updatedBy,
          referenceTransaction,
          timestamp: nowIso,
        })
      );
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/products/${productId}`);
  }
}

export async function getShopCustomers(shopId: string): Promise<ShopCustomerSummary[]> {
  const orders = await getAllShopOrdersAdmin(shopId);
  const map = new Map<string, ShopCustomerSummary>();

  for (const ord of orders) {
    const phoneKey = (ord.customer?.phone || ord.customer?.email || ord.id).replace(/[\s-]/g, '');
    const existing = map.get(phoneKey);
    if (!existing) {
      map.set(phoneKey, {
        id: phoneKey,
        name: ord.customer?.name || 'Guest',
        email: ord.customer?.email || '',
        phone: ord.customer?.phone || '',
        city: ord.customer?.city || '',
        ordersCount: 1,
        totalSpent: ord.orderStatus !== 'Cancelled' ? Number(ord.total || 0) : 0,
        lastOrderAt: ord.createdAt,
        createdAt: ord.createdAt,
      });
    } else {
      existing.ordersCount += 1;
      if (ord.orderStatus !== 'Cancelled') {
        existing.totalSpent += Number(ord.total || 0);
      }
      if (new Date(ord.createdAt) > new Date(existing.lastOrderAt)) {
        existing.lastOrderAt = ord.createdAt;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
}

export async function saveShopContactMessage(
  shopId: string,
  msg: Omit<ContactMessage, 'id' | 'status' | 'createdAt'>
): Promise<string> {
  const id = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const docData = stripUndefined<ContactMessage>({
    id,
    shopId,
    name: msg.name.trim(),
    email: msg.email.trim(),
    phone: msg.phone?.trim() || undefined,
    subject: msg.subject?.trim() || undefined,
    message: msg.message.trim(),
    status: 'new',
    createdAt: new Date().toISOString(),
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'contact_messages', id), docData);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}/contact_messages/${id}`);
  }
}

export async function getShopContactMessages(shopId: string): Promise<ContactMessage[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'contact_messages'));
    const list: ContactMessage[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as ContactMessage), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function updateShopContactMessageStatus(shopId: string, msgId: string, status: 'new' | 'resolved'): Promise<void> {
  await updateDoc(doc(db, 'shops', shopId, 'contact_messages', msgId), { status });
}

export async function subscribeToShopNewsletter(
  shopId: string,
  rawEmail: string,
  source = 'footer'
): Promise<string> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }

  const safeId = `sub_${email.replace(/[^a-z0-9]/g, '_').slice(0, 80)}_${Date.now()}`;
  const payload: NewsletterSubscriber = {
    id: safeId,
    shopId,
    email,
    source,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'shops', shopId, 'newsletter_subscribers', safeId), payload);
    return safeId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}/newsletter_subscribers/${safeId}`);
  }
}

export async function getShopNewsletterSubscribers(shopId: string): Promise<NewsletterSubscriber[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'newsletter_subscribers'));
    const list: NewsletterSubscriber[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as NewsletterSubscriber), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/newsletter_subscribers`);
  }
}

// ====================================================
// STAFF MANAGEMENT & INVITES
// ====================================================

export async function getShopStaff(shopId: string): Promise<{ staff: StaffMember[]; invites: ShopInvite[] }> {
  try {
    const [staffSnap, invitesSnap] = await Promise.all([
      getDocs(collection(db, 'shops', shopId, 'staff')),
      getDocs(query(collection(db, 'shop_invites'), where('shopId', '==', shopId))),
    ]);
    const staff: StaffMember[] = [];
    staffSnap.forEach((d) => staff.push({ ...(d.data() as StaffMember), uid: d.id }));
    const invites: ShopInvite[] = [];
    invitesSnap.forEach((d) => invites.push({ ...(d.data() as ShopInvite), id: d.id }));
    return { staff, invites: invites.filter((i) => i.status === 'pending') };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/staff`);
  }
}

export async function inviteShopStaff(
  shopId: string,
  shopName: string,
  shopSlug: string,
  input: {
    email: string;
    name: string;
    role: 'shop_admin' | 'shop_staff';
    permissions: StaffPermission[];
  }
): Promise<string> {
  const { plan, isExpired, isSuspended } = await getShopAndPlanLimits(shopId);
  if (isSuspended || isExpired) {
    throw new Error('Subscription expired or store suspended. Renew your plan to invite staff.');
  }
  if (plan && plan.features && plan.features.staffAccounts === false) {
    throw new Error('Team staff accounts require Growth or Enterprise plan.');
  }
  const current = await getShopStaff(shopId);
  const totalHeadcount = current.staff.length + current.invites.length;
  if (totalHeadcount >= (plan?.maxStaff || 1)) {
    throw new Error(`Staff seat limit reached (${totalHeadcount}/${plan.maxStaff}). Upgrade your plan to add more team members.`);
  }

  const inviteId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const payload: ShopInvite = {
    id: inviteId,
    shopId,
    shopName,
    shopSlug,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: input.role,
    permissions: input.permissions,
    invitedBy: auth.currentUser?.email || 'owner',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'shop_invites', inviteId), payload);
    await logShopActivity(shopId, 'Invited Staff', 'staff', inviteId, `Invited ${payload.email} as ${payload.role}`);
    return inviteId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shop_invites/${inviteId}`);
  }
}

export async function updateShopStaffRole(
  shopId: string,
  staffUid: string,
  role: 'shop_admin' | 'shop_staff',
  permissions: StaffPermission[],
  status: 'active' | 'inactive'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'staff', staffUid), {
      role,
      permissions,
      status,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'users', staffUid, 'shopMemberships', shopId), {
      role,
      permissions,
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}/staff/${staffUid}`);
  }
}

export async function removeShopStaff(shopId: string, staffUid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'staff', staffUid));
    await deleteDoc(doc(db, 'users', staffUid, 'shopMemberships', shopId)).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/staff/${staffUid}`);
  }
}

export async function cancelShopInvite(shopId: string, inviteId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shop_invites', inviteId));
    await logShopActivity(shopId, 'Cancelled Invite', 'staff', inviteId, `Revoked pending invite ${inviteId}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shop_invites/${inviteId}`);
  }
}

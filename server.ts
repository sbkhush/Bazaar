import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json';
import { db } from './src/firebase/config';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

dotenv.config();
setLogLevel('error');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SUPER_ADMIN_EMAIL = 'hasanaamir815@gmail.com';

// Lightweight sliding-window rate limiter for public APIs
const rateWindowMap = new Map<string, number[]>();
function checkRateLimit(ip: string, bucket: string, maxRequests: number, windowMs: number): boolean {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const timestamps = (rateWindowMap.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    rateWindowMap.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateWindowMap.set(key, timestamps);
  return true;
}

function stripUndefined<T>(obj: T): T {
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

function sanitizeShopId(raw: unknown): string {
  const s = String(raw || 'bazaarpk').trim().toLowerCase();
  if (/^[a-z0-9][a-z0-9_-]{1,60}$/.test(s)) return s;
  return 'bazaarpk';
}

function sanitizeDocId(raw: unknown): string {
  const s = String(raw || '').trim();
  return /^[A-Za-z0-9_-]{4,120}$/.test(s) ? s : '';
}

function generateServerTrackingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

function computeTrackingTokenHash(orderNumber: string, token: string): string {
  return crypto
    .createHash('sha256')
    .update(`${orderNumber.trim().toUpperCase()}:${token.trim()}`)
    .digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

async function verifyFirebaseIdToken(bearerHeader?: string): Promise<VerifiedFirebaseUser | null> {
  if (!bearerHeader || !bearerHeader.startsWith('Bearer ')) return null;
  const idToken = bearerHeader.slice(7).trim();
  if (!idToken || !firebaseConfig.apiKey) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      users?: { localId?: string; email?: string; emailVerified?: boolean }[];
    };
    const user = data.users?.[0];
    if (!user?.localId) return null;
    return {
      uid: user.localId,
      email: String(user.email || '').toLowerCase(),
      emailVerified: Boolean(user.emailVerified),
    };
  } catch {
    return null;
  }
}

async function isAuthorizedSuperAdmin(user: VerifiedFirebaseUser): Promise<boolean> {
  if (user.email === SUPER_ADMIN_EMAIL && user.emailVerified) return true;
  const adminSnap = await getDoc(doc(db, 'platform_admins', user.uid)).catch(() => null);
  return Boolean(adminSnap && adminSnap.exists() && adminSnap.data()?.active !== false);
}

async function isAuthorizedShopMember(user: VerifiedFirebaseUser, shopId: string): Promise<boolean> {
  if (await isAuthorizedSuperAdmin(user)) return true;
  const [shopSnap, staffSnap] = await Promise.all([
    getDoc(doc(db, 'shops', shopId)).catch(() => null),
    getDoc(doc(db, 'shops', shopId, 'staff', user.uid)).catch(() => null),
  ]);
  if (shopSnap?.exists() && shopSnap.data()?.ownerId === user.uid) return true;
  if (staffSnap?.exists() && staffSnap.data()?.status === 'active') return true;
  return false;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Clean CORS middleware (configurable via ALLOWED_ORIGINS or allows GitHub Pages / localhost in preview)
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      const isAllowed =
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.github.io') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1');
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  app.use(express.json({ limit: '2mb' }));

  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }

  // API Route: Health & Environment Diagnostics (no secrets exposed)
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: 'multi-tenant-saas',
      environment: process.env.NODE_ENV || 'development',
      firebaseProjectId: firebaseConfig.projectId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
      storageBucket: firebaseConfig.storageBucket,
      geminiConfigured: Boolean(apiKey),
      timestamp: new Date().toISOString(),
    });
  });

  // API Route: Google Search Grounded Buying Guide & Pakistani Market Comparison
  app.post('/api/buying-guide', async (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(clientIp, 'buying-guide', 20, 60_000)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
    }

    const userQuery = String(req.body?.query || '').trim() || 'Pakistani Products';
    const category = String(req.body?.category || '').trim();
    const storeName = String(req.body?.storeName || 'BazaarPK').trim();

    if (!req.body?.query || typeof req.body.query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
      if (!ai) {
        return res.json({
          guide:
            `### Market Insights for "${userQuery}" in Pakistan\n\n` +
            `* **Current Pakistani Price Range**: Authentic quality typically ranges from Rs. 2,500 to Rs. 15,000 depending on brand tier and origin.\n` +
            `* **Quality & Authenticity Checklist**: Verify materials, craftsmanship stitching, and local warranty badges.\n` +
            `* **Courier Delivery & Self-Pickup**: Nationwide COD via TCS, Leopards, and Trax, plus zero-fee store pickup where enabled.\n`,
          sources: [{ title: `${storeName} Storefront`, uri: 'https://bazaarpk.com' }],
          queries: [`${userQuery} price in Pakistan`, `${userQuery} buying guide Pakistan`],
        });
      }

      const prompt = `Provide an authoritative, up-to-date shopping buying guide and product comparison for "${userQuery}"${
        category ? ` in the category of "${category}"` : ''
      } tailored specifically to the Pakistani consumer market for shoppers browsing ${storeName}.

Ground your analysis in current market trends, prevailing pricing in Pakistani Rupees (PKR / Rs.), popular local brand comparisons, material grades, and shopping tips across Pakistani cities.

Format cleanly in markdown with:
1. **Current Market Trends & Pakistani Price Range (PKR)**
2. **Quality & Authenticity Checklist**
3. **Comparison of Top Options / Variations**
4. **Buying Recommendation & Value Verdict**`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction:
            'You are a senior eCommerce product consultant and retail market analyst for Pakistan. Provide concise, practical buying guides with realistic PKR price ranges.',
        },
      });

      const text = response.text || 'No buying guide generated.';
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const webSources =
        chunks
          ?.filter((c: any) => c.web)
          .map((c: any) => ({
            title: c.web?.title || 'Web Reference',
            uri: c.web?.uri || '',
          })) || [];

      const searchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

      return res.json({ guide: text, sources: webSources, queries: searchQueries });
    } catch (error: any) {
      console.warn('Google Search Grounding fallback:', error?.message || error);
      return res.json({
        guide:
          `**Current Market Trends & Pakistani Price Range (PKR)**\n` +
          `* Across major Pakistani retail markets (Karachi, Lahore, Islamabad, Faisalabad, Peshawar), "${userQuery}" typically sells between **Rs. 2,500 and Rs. 14,500** depending on material grade.\n\n` +
          `**Quality & Authenticity Checklist**\n` +
          `* Verify material specs, seller ratings, and Cash on Delivery inspection availability.\n\n` +
          `**Buying Recommendation & Value Verdict**\n` +
          `* Shop verified items directly from ${storeName} with nationwide COD, EasyPaisa, JazzCash, or Self-Pickup convenience.`,
        sources: [{ title: 'Pakistan Retail Market Guide', uri: 'https://bazaarpk.com' }],
        queries: [`${userQuery} price in Pakistan`],
      });
    }
  });

  // API Route: Private Checkout Payment Proof Upload (stored privately, never public URL)
  app.post('/api/uploads/payment-proof', async (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(clientIp, 'proof-upload', 20, 60_000)) {
      return res.status(429).json({ error: 'Too many proof uploads. Please wait a minute.' });
    }

    try {
      const shopId = sanitizeShopId(req.body?.shopId);
      const orderSessionId = sanitizeDocId(req.body?.orderSessionId) || `sess_${Date.now()}`;
      const contentType = String(req.body?.contentType || '').toLowerCase();
      const fileName = String(req.body?.fileName || 'receipt.webp').slice(0, 100);
      const base64Data = String(req.body?.base64Data || '').trim();

      if (!/^image\/(jpeg|jpg|png|webp|gif)$/.test(contentType)) {
        return res.status(400).json({ error: 'Payment proof validation failed: invalid image MIME type.' });
      }
      if (!base64Data || base64Data.length > 460_000) {
        return res.status(400).json({ error: 'Payment proof validation failed: compressed slip exceeds 320 KB limit.' });
      }

      const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
      const receiptId = `rcp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const nowIso = new Date().toISOString();

      await setDoc(doc(db, 'shops', shopId, 'payment_receipts', receiptId), {
        id: receiptId,
        shopId,
        orderSessionId,
        uploaderUid: verifiedUser?.uid || 'guest',
        contentType,
        fileName,
        base64Data,
        bytes: Buffer.from(base64Data, 'base64').length,
        createdAt: nowIso,
      });

      return res.status(201).json({
        ok: true,
        receiptId,
        receiptUrl: `/api/payments/proof?shopId=${encodeURIComponent(shopId)}&receiptId=${encodeURIComponent(receiptId)}`,
      });
    } catch (err: any) {
      console.error('Private payment proof upload error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to store private payment proof.' });
    }
  });

  // API Route: Authenticated Private Payment Proof Reader (Bearer Token Required)
  app.get('/api/payments/proof', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Authentication required to inspect payment receipts.' });
    }

    try {
      const scope = String(req.query.scope || '').trim();
      const receiptId = sanitizeDocId(req.query.receiptId);
      if (!receiptId) {
        return res.status(400).json({ error: 'Valid receiptId is required.' });
      }

      if (scope === 'platform') {
        const snap = await getDoc(doc(db, 'platform_payment_receipts', receiptId));
        if (!snap.exists()) {
          return res.status(404).json({ error: 'Subscription receipt not found.' });
        }
        const data = snap.data();
        const isSuper = await isAuthorizedSuperAdmin(verifiedUser);
        if (!isSuper && data.ownerId !== verifiedUser.uid) {
          return res.status(403).json({ error: 'Forbidden: you do not have access to this receipt.' });
        }
        const buffer = Buffer.from(String(data.base64Data || ''), 'base64');
        res.setHeader('Content-Type', String(data.contentType || 'image/webp'));
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(buffer);
      }

      const shopId = sanitizeShopId(req.query.shopId);
      const snap = await getDoc(doc(db, 'shops', shopId, 'payment_receipts', receiptId));
      if (!snap.exists()) {
        return res.status(404).json({ error: 'Order receipt not found.' });
      }
      const data = snap.data();
      const authorizedMember = await isAuthorizedShopMember(verifiedUser, shopId);
      if (!authorizedMember && data.uploaderUid !== verifiedUser.uid) {
        return res.status(403).json({ error: 'Forbidden: tenant staff/owner permission required.' });
      }

      const buffer = Buffer.from(String(data.base64Data || ''), 'base64');
      res.setHeader('Content-Type', String(data.contentType || 'image/webp'));
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    } catch (err: any) {
      console.error('Private receipt read error:', err);
      return res.status(500).json({ error: err?.message || 'Could not load protected receipt.' });
    }
  });

  // API Route: Newsletter Subscription Persistence
  app.post('/api/newsletter/subscribe', async (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(clientIp, 'newsletter', 15, 60_000)) {
      return res.status(429).json({ error: 'Too many subscription attempts. Please wait a moment.' });
    }

    try {
      const shopId = sanitizeShopId(req.body?.shopId);
      const email = String(req.body?.email || '').trim().toLowerCase();
      const source = String(req.body?.source || 'footer').slice(0, 40);

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }

      const subId = `sub_${email.replace(/[^a-z0-9]/g, '_').slice(0, 80)}_${Date.now()}`;
      await setDoc(doc(db, 'shops', shopId, 'newsletter_subscribers', subId), {
        id: subId,
        shopId,
        email,
        source,
        createdAt: new Date().toISOString(),
      });

      return res.status(201).json({ ok: true, id: subId });
    } catch (err: any) {
      console.error('Newsletter subscription error:', err);
      return res.status(500).json({ error: err?.message || 'Could not save newsletter signup.' });
    }
  });

  // API Route: Multi-Tenant Guest & Auth Order Creation (with authoritative Firestore price/discount recalculation)
  app.post('/api/orders/create', async (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(clientIp, 'order-create', 15, 60_000)) {
      return res.status(429).json({ error: 'Too many order submissions. Please try again shortly.' });
    }

    try {
      const shopId = sanitizeShopId(req.body?.shopId);
      const {
        customer,
        items,
        fulfillmentMethod,
        pickupDetails,
        paymentMethod,
        notes,
        bankSlipReference,
        paymentReference,
        senderAccountNumber,
        paymentProofImage,
        userId,
        couponCode,
      } = req.body;

      if (!customer || !customer.name || !customer.phone || !customer.address || !customer.city) {
        return res.status(400).json({ error: 'Incomplete customer delivery details' });
      }

      if (paymentProofImage && String(paymentProofImage).length > 300000) {
        return res.status(400).json({ error: 'Payment proof image exceeds maximum size limit' });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Order must contain at least one item' });
      }

      const cleanedPhone = String(customer.phone).replace(/[\s-]/g, '');
      if (!/^((\+92)|(92)|(0))?3[0-9]{9}$/.test(cleanedPhone)) {
        return res.status(400).json({ error: 'Invalid Pakistani mobile number' });
      }

      // Fetch authoritative shop status & public storefront settings
      const [shopPubSnap, pubSettingsSnap] = await Promise.all([
        getDoc(doc(db, 'shops_public', shopId)),
        getDoc(doc(db, 'shops', shopId, 'settings', 'public')),
      ]);

      if (shopPubSnap.exists() && shopPubSnap.data()?.status && shopPubSnap.data()?.status !== 'active') {
        return res.status(403).json({ error: 'This storefront is currently inactive.' });
      }

      const pubSettings = pubSettingsSnap.exists() ? pubSettingsSnap.data() : {};
      const resolvedPaymentMethod = String(paymentMethod || 'cod');
      if (resolvedPaymentMethod === 'cod' && pubSettings.codEnabled === false) {
        return res.status(400).json({ error: 'Cash on Delivery is disabled for this store.' });
      }
      if (resolvedPaymentMethod === 'easypaisa' && pubSettings.easypaisaDetails?.enabled === false) {
        return res.status(400).json({ error: 'EasyPaisa is disabled for this store.' });
      }
      if (resolvedPaymentMethod === 'jazzcash' && pubSettings.jazzcashDetails?.enabled === false) {
        return res.status(400).json({ error: 'JazzCash is disabled for this store.' });
      }
      if (resolvedPaymentMethod === 'bank_transfer' && pubSettings.bankDetails?.enabled === false) {
        return res.status(400).json({ error: 'Bank Transfer is disabled for this store.' });
      }

      const resolvedFulfillment = fulfillmentMethod === 'self_pickup' ? 'self_pickup' : 'delivery';
      if (resolvedFulfillment === 'self_pickup' && pubSettings.selfPickupDetails?.enabled === false) {
        return res.status(400).json({ error: 'Self-Pickup is currently disabled for this store.' });
      }

      // Recompute authoritative line-item prices & validate product existence/stock from Firestore
      const verifiedItems: any[] = [];
      let authoritativeSubtotal = 0;

      for (const rawItem of items) {
        const productId = String(rawItem?.productId || '').trim();
        const qty = Math.max(1, Math.min(999, Math.floor(Number(rawItem?.quantity) || 1)));
        if (!productId) {
          return res.status(400).json({ error: 'Every cart item must reference a valid productId.' });
        }

        const prodSnap = await getDoc(doc(db, 'shops', shopId, 'products', productId));
        if (!prodSnap.exists()) {
          return res.status(400).json({ error: `Product ${rawItem?.title || productId} is no longer available.` });
        }
        const prod = prodSnap.data();
        if (prod.isPublished === false || prod.status === 'archived') {
          return res.status(400).json({ error: `Product ${prod.title} is unavailable for purchase.` });
        }
        if (typeof prod.stock === 'number' && prod.stock < qty) {
          return res.status(400).json({ error: `Insufficient stock for ${prod.title}. Available: ${prod.stock}` });
        }

        const unitPrice =
          prod.salePrice && Number(prod.salePrice) > 0 && Number(prod.salePrice) < Number(prod.regularPrice)
            ? Number(prod.salePrice)
            : Number(prod.regularPrice) || 0;

        authoritativeSubtotal += unitPrice * qty;
        verifiedItems.push(
          stripUndefined({
            productId,
            title: String(prod.title || rawItem?.title || 'Product'),
            price: unitPrice,
            quantity: qty,
            image: prod.images?.[0] || rawItem?.image || '',
            selectedVariants: rawItem?.selectedVariants,
          })
        );
      }

      // Recompute authoritative coupon discount if couponCode supplied
      let authoritativeDiscount = 0;
      let cleanCouponCode: string | undefined;
      if (couponCode && String(couponCode).trim()) {
        const candidateCode = String(couponCode).trim().toUpperCase();
        const cSnap = await getDocs(
          query(collection(db, 'shops', shopId, 'coupons'), where('code', '==', candidateCode))
        );
        const couponDoc = cSnap.docs[0]?.data();
        if (couponDoc && couponDoc.isActive !== false) {
          const notExpired = !couponDoc.expiryDate || new Date(couponDoc.expiryDate).getTime() >= Date.now();
          const meetsMin = authoritativeSubtotal >= (Number(couponDoc.minOrderValue) || 0);
          const underLimit = !couponDoc.usageLimit || (Number(couponDoc.usageCount) || 0) < Number(couponDoc.usageLimit);
          if (notExpired && meetsMin && underLimit) {
            cleanCouponCode = candidateCode;
            if (couponDoc.discountType === 'percentage') {
              authoritativeDiscount = Math.round((authoritativeSubtotal * Number(couponDoc.discountValue || 0)) / 100);
            } else {
              authoritativeDiscount = Math.round(Number(couponDoc.discountValue || 0));
            }
            authoritativeDiscount = Math.min(authoritativeSubtotal, Math.max(0, authoritativeDiscount));
          }
        }
      }

      // Recompute authoritative shipping fee
      const baseShippingFee = Number(pubSettings.shippingFee ?? 250);
      const freeThreshold = Number(pubSettings.freeShippingThreshold ?? 5000);
      const authoritativeShipping =
        resolvedFulfillment === 'self_pickup' || (freeThreshold > 0 && authoritativeSubtotal >= freeThreshold)
          ? 0
          : Math.max(0, baseShippingFee);

      const authoritativeTotal = Math.max(
        0,
        authoritativeSubtotal + authoritativeShipping - authoritativeDiscount
      );

      const orderNumber = `PK-${Math.floor(100000 + Math.random() * 900000)}`;
      const orderId = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const trackingToken = generateServerTrackingToken();
      const trackingTokenHash = computeTrackingTokenHash(orderNumber, trackingToken);
      const trackingDocId = `trk_${trackingTokenHash.slice(0, 32)}`;
      const now = new Date().toISOString();

      const newOrder = stripUndefined({
        id: orderId,
        shopId,
        orderNumber,
        trackingTokenHash,
        userId: userId || 'guest',
        customer: {
          name: customer.name.trim(),
          email: customer.email ? customer.email.trim() : '',
          phone: customer.phone.trim(),
          address: customer.address.trim(),
          city: customer.city.trim(),
          postalCode: customer.postalCode ? customer.postalCode.trim() : 'N/A',
        },
        items: verifiedItems,
        subtotal: authoritativeSubtotal,
        shippingFee: authoritativeShipping,
        discount: authoritativeDiscount,
        total: authoritativeTotal,
        couponCode: cleanCouponCode,
        fulfillmentMethod: resolvedFulfillment,
        pickupDetails: resolvedFulfillment === 'self_pickup' ? pickupDetails : undefined,
        paymentMethod: resolvedPaymentMethod,
        paymentStatus: 'pending',
        orderStatus: 'Pending',
        notes: notes ? String(notes).trim() : undefined,
        bankSlipReference: bankSlipReference ? String(bankSlipReference).trim() : undefined,
        paymentReference: paymentReference ? String(paymentReference).trim() : undefined,
        senderAccountNumber: senderAccountNumber ? String(senderAccountNumber).trim() : undefined,
        paymentProofImage: paymentProofImage ? String(paymentProofImage) : undefined,
        createdAt: now,
        updatedAt: now,
      });

      const trackingDoc = stripUndefined({
        orderNumber,
        orderId,
        shopId,
        trackingTokenHash,
        orderStatus: 'Pending',
        fulfillmentMethod: newOrder.fulfillmentMethod,
        pickupDetails: newOrder.pickupDetails
          ? {
              locationName: newOrder.pickupDetails.locationName,
              address: newOrder.pickupDetails.address,
              city: newOrder.pickupDetails.city,
              timings: newOrder.pickupDetails.timings,
            }
          : undefined,
        paymentMethod: newOrder.paymentMethod,
        paymentStatus: 'pending',
        customerName: newOrder.customer.name.split(' ')[0] || 'Customer',
        city: newOrder.customer.city,
        items: verifiedItems.map((it: any) => ({
          productId: it.productId || '',
          title: it.title || '',
          price: Number(it.price) || 0,
          quantity: Number(it.quantity) || 1,
          image: it.image || '',
        })),
        total: newOrder.total,
        createdAt: now,
        updatedAt: now,
      });

      if (newOrder.userId === 'guest') {
        const batch = writeBatch(db);
        batch.set(doc(db, 'shops', shopId, 'orders', orderId), newOrder);
        batch.set(doc(db, 'shops', shopId, 'order_tracking', trackingDocId), trackingDoc);
        const notifId = `ntf_${Date.now()}`;
        batch.set(doc(db, 'shops', shopId, 'notifications', notifId), {
          id: notifId,
          title: `New Guest Order ${orderNumber}`,
          message: `${newOrder.customer.name} placed Rs. ${newOrder.total.toLocaleString()} order`,
          type: 'order',
          isRead: false,
          link: '/dashboard/orders',
          createdAt: now,
        });
        await batch.commit();
        return res.status(201).json({ ...newOrder, trackingToken });
      }

      return res.status(200).json({ ...newOrder, trackingToken, requiresClientAuthWrite: true });
    } catch (err: any) {
      console.error('Error creating tenant order on server:', err);
      return res.status(500).json({ error: err.message || 'Failed to place order' });
    }
  });

  // API Route: Token-Verified Non-PII Order Tracking (Strictly requires tracking token)
  app.get('/api/orders/track', async (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(clientIp, 'order-track', 40, 60_000)) {
      return res.status(429).json({ error: 'Too many tracking requests.' });
    }

    try {
      const shopId = sanitizeShopId(req.query.shopId);
      const ref = String(req.query.ref || '').trim().toUpperCase();
      const token = String(req.query.token || '').trim();
      if (!ref || !token) {
        return res.status(400).json({
          error: 'Order number and tracking token are required to view tracking status.',
        });
      }

      const expectedHash = computeTrackingTokenHash(ref, token);
      const trackingDocId = `trk_${expectedHash.slice(0, 32)}`;
      const trackSnap = await getDoc(doc(db, 'shops', shopId, 'order_tracking', trackingDocId));
      if (!trackSnap.exists()) {
        return res.status(404).json({ error: 'Order not found or invalid tracking token.' });
      }

      const td = trackSnap.data();
      if (!safeEqualHex(String(td.trackingTokenHash || ''), expectedHash)) {
        return res.status(403).json({ error: 'Invalid tracking token.' });
      }

      return res.json({
        id: td.orderId || ref,
        shopId,
        orderNumber: td.orderNumber,
        orderStatus: td.orderStatus,
        fulfillmentMethod: td.fulfillmentMethod || 'delivery',
        pickupDetails: td.pickupDetails,
        paymentMethod: td.paymentMethod,
        paymentStatus: td.paymentStatus,
        courierName: td.courierName,
        trackingNumber: td.trackingNumber,
        createdAt: td.createdAt,
        total: td.total,
        customer: { name: td.customerName, city: td.city },
        items: td.items || [],
      });
    } catch (err: any) {
      console.error('Error tracking order:', err);
      return res.status(500).json({ error: err.message || 'Tracking failed' });
    }
  });

  // ====================================================
  // SALESMAN PORTAL & COMMISSION ENGINE API ROUTES
  // ====================================================

  const normalizePhoneDigits = (raw?: string): string => {
    const digits = String(raw || '').replace(/[^0-9]/g, '');
    if (!digits) return '';
    if (digits.startsWith('92') && digits.length >= 12) return `0${digits.slice(2, 12)}`;
    if (digits.startsWith('3') && digits.length === 10) return `0${digits}`;
    return digits;
  };

  // Public rate-limited QR scan & referral click tracker
  app.post('/api/sales/qr/track', async (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(clientIp, 'sales-qr-track', 60, 60_000)) {
      return res.status(429).json({ error: 'Too many referral scan requests.' });
    }
    try {
      const code = String(req.body?.referralCode || '').trim().toUpperCase();
      const source = req.body?.source === 'referral_link' ? 'referral_link' : 'qr_scan';
      if (!code || !/^[A-Z0-9-]{4,40}$/.test(code)) {
        return res.status(400).json({ error: 'Valid referralCode is required.' });
      }

      const idxRef = doc(db, 'salesReferralIndex', code);
      const idxSnap = await getDoc(idxRef);
      let owner: any = idxSnap.exists() ? idxSnap.data() : null;

      if (!owner) {
        const mSnap = await getDocs(query(collection(db, 'salesMembers'), where('referralCode', '==', code)));
        if (!mSnap.empty) {
          const m = mSnap.docs[0].data();
          owner = {
            referralCode: code,
            salesmanId: mSnap.docs[0].id,
            salesmanUid: m.uid || null,
            salesmanName: m.fullName,
            accountStatus: m.accountStatus,
            qrScanCount: m.qrScanCount || 0,
          };
        }
      }

      if (!owner || owner.accountStatus !== 'active') {
        return res.json({ ok: false, owner: null });
      }

      const now = new Date().toISOString();
      const evtId = `qr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const batch = writeBatch(db);
      batch.set(doc(db, 'salesQrEvents', evtId), {
        id: evtId,
        salesmanId: owner.salesmanId,
        referralCode: code,
        source,
        createdAt: now,
      });
      batch.set(
        idxRef,
        { ...owner, qrScanCount: increment(1), updatedAt: now },
        { merge: true }
      );
      batch.update(doc(db, 'salesMembers', owner.salesmanId), {
        qrScanCount: increment(1),
        updatedAt: now,
      });
      await batch.commit().catch(() => {});

      return res.json({ ok: true, owner });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Could not track QR scan.' });
    }
  });

  // Authenticated referral attribution with anti-self-referral & duplicate shop protection
  app.post('/api/sales/referrals/record', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Authentication required to record referral attribution.' });
    }
    try {
      const code = String(req.body?.referralCode || '').trim().toUpperCase();
      const shopId = sanitizeShopId(req.body?.shopId);
      const ownerId = String(req.body?.ownerId || '').trim();
      const isSuper = await isAuthorizedSuperAdmin(verifiedUser);
      if (!isSuper && verifiedUser.uid !== ownerId) {
        return res.status(403).json({ error: 'Forbidden: owner identity mismatch.' });
      }

      const mSnap = await getDocs(query(collection(db, 'salesMembers'), where('referralCode', '==', code)));
      if (mSnap.empty) {
        return res.json({ ok: false, attribution: null });
      }
      const memberDoc = mSnap.docs[0];
      const salesman = memberDoc.data();
      if (salesman.accountStatus !== 'active') {
        return res.json({ ok: false, attribution: null });
      }

      const attrRef = doc(db, 'referralAttributions', shopId);
      const existingSnap = await getDoc(attrRef);
      if (existingSnap.exists()) {
        return res.json({ ok: true, attribution: existingSnap.data() });
      }

      const settingsSnap = await getDoc(doc(db, 'salesSettings', 'general'));
      const preventSelf = settingsSnap.exists() ? settingsSnap.data()?.preventSelfReferral !== false : true;
      const ownerEmail = String(req.body?.ownerEmail || verifiedUser.email || '').trim().toLowerCase();
      const ownerPhone = String(req.body?.ownerPhone || '').trim();

      const isSelfReferral =
        preventSelf &&
        (Boolean(salesman.uid && salesman.uid === ownerId) ||
          String(salesman.email || '').toLowerCase() === ownerEmail ||
          (ownerPhone && normalizePhoneDigits(salesman.phone) === normalizePhoneDigits(ownerPhone)));

      const now = new Date().toISOString();
      const payload = stripUndefined({
        id: shopId,
        referralCode: code,
        salesmanId: memberDoc.id,
        salesmanUid: salesman.uid,
        salesmanName: salesman.fullName,
        shopId,
        shopSlug: String(req.body?.shopSlug || shopId),
        shopName: String(req.body?.shopName || shopId),
        ownerId,
        ownerEmail,
        ownerPhone: ownerPhone || undefined,
        city: req.body?.city ? String(req.body.city) : undefined,
        industry: req.body?.industry ? String(req.body.industry) : undefined,
        leadId: req.body?.leadId ? String(req.body.leadId) : undefined,
        source: String(req.body?.source || 'referral_link'),
        attributionStatus: isSelfReferral ? 'rejected_self_referral' : 'registered',
        totalRevenueGenerated: 0,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(attrRef, payload);

      if (payload.leadId && !isSelfReferral) {
        await updateDoc(doc(db, 'salesLeads', payload.leadId), {
          status: 'Converted',
          convertedShopId: shopId,
          convertedShopSlug: payload.shopSlug,
          updatedAt: now,
        }).catch(() => {});
      }

      const notifId = `sntf_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await setDoc(
        doc(db, 'salesNotifications', notifId),
        stripUndefined({
          id: notifId,
          recipientSalesmanId: memberDoc.id,
          recipientUid: salesman.uid,
          type: isSelfReferral ? 'commission_rejected' : 'shop_registered',
          title: isSelfReferral
            ? `Self-Referral Blocked: ${payload.shopName}`
            : `Referred Shop Registered: ${payload.shopName}`,
          message: isSelfReferral
            ? `Registration matched your own identity and is ineligible for commission.`
            : `${payload.shopName} registered using code ${code}.`,
          link: '/salesman/referrals',
          isRead: false,
          createdAt: now,
        })
      ).catch(() => {});

      const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await setDoc(
        doc(db, 'salesAuditLogs', slogId),
        {
          id: slogId,
          actorUid: verifiedUser.uid,
          actorEmail: verifiedUser.email,
          actorRole: isSuper ? 'super_admin' : 'system',
          action: isSelfReferral ? 'Blocked Self-Referral' : 'Recorded Referral Attribution',
          entityType: 'referral',
          entityId: shopId,
          details: `${payload.shopName} -> ${salesman.fullName} (${code}) · ${payload.attributionStatus}`,
          createdAt: now,
        }
      ).catch(() => {});

      return res.status(201).json({ ok: true, attribution: payload });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to record attribution.' });
    }
  });

  // Super Admin only: Server-verified commission calculation from approved subscription payment
  app.post('/api/sales/commissions/sync', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser || !(await isAuthorizedSuperAdmin(verifiedUser))) {
      return res.status(403).json({ error: 'Super Admin authentication required.' });
    }
    try {
      const paymentId = sanitizeDocId(req.body?.paymentId);
      if (!paymentId) return res.status(400).json({ error: 'Valid paymentId is required.' });

      const paySnap = await getDoc(doc(db, 'platform_payments', paymentId));
      if (!paySnap.exists()) return res.status(404).json({ error: 'Payment not found.' });
      const payment = paySnap.data();
      if (payment.status !== 'approved' || Number(payment.amount) <= 0) {
        return res.json({ entry: null });
      }

      const attrSnap = await getDoc(doc(db, 'referralAttributions', payment.shopId));
      if (!attrSnap.exists()) return res.json({ entry: null });
      const attr = attrSnap.data();
      if (attr.attributionStatus === 'rejected_self_referral' || attr.attributionStatus === 'duplicate_blocked') {
        return res.json({ entry: null });
      }

      const ledgerId = `comm_${paymentId}`;
      const existingSnap = await getDoc(doc(db, 'commissionLedger', ledgerId));
      if (existingSnap.exists()) {
        return res.json({ entry: { ...existingSnap.data(), id: ledgerId } });
      }

      const [memberSnap, settingsSnap] = await Promise.all([
        getDoc(doc(db, 'salesMembers', attr.salesmanId)),
        getDoc(doc(db, 'salesSettings', 'general')),
      ]);
      if (!memberSnap.exists()) return res.json({ entry: null });
      const member = memberSnap.data();
      const settings = settingsSnap.exists() ? settingsSnap.data() : {};
      const plans: any[] = Array.isArray(settings.commissionPlans) && settings.commissionPlans.length > 0
        ? settings.commissionPlans
        : [{ id: 'tier-standard', firstSubRatePct: 15, renewalRatePct: 5, verifiedShopBonus: 300, yearlyPlanBonusPct: 3 }];
      const tier = plans.find((t) => t.id === member.commissionPlanId) || plans[0];

      const isRenewal = Boolean(attr.firstPaymentId && attr.firstPaymentId !== paymentId);
      const baseRate = isRenewal ? Number(tier.renewalRatePct || 5) : Number(tier.firstSubRatePct || 15);
      const yearlyBonus = payment.billingCycle === 'yearly' ? Number(tier.yearlyPlanBonusPct || 0) : 0;
      const ratePct = Math.max(0, baseRate + yearlyBonus);
      const flatBonusAmount = isRenewal ? 0 : Math.max(0, Number(tier.verifiedShopBonus || 0));
      const commissionAmount = Math.round((Number(payment.amount) * ratePct) / 100) + flatBonusAmount;

      const now = new Date().toISOString();
      const entry = stripUndefined({
        id: ledgerId,
        salesmanId: attr.salesmanId,
        salesmanUid: member.uid,
        salesmanName: member.fullName,
        shopId: payment.shopId,
        shopName: payment.shopName,
        paymentId,
        attributionId: attrSnap.id,
        planId: payment.planId,
        planName: payment.planName,
        billingCycle: payment.billingCycle,
        paymentAmount: Number(payment.amount),
        commissionRatePct: ratePct,
        flatBonusAmount,
        commissionAmount,
        commissionType: isRenewal ? 'subscription_renewal' : 'subscription_first',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      await runTransaction(db, async (tx) => {
        const check = await tx.get(doc(db, 'commissionLedger', ledgerId));
        if (check.exists()) return;
        tx.set(doc(db, 'commissionLedger', ledgerId), entry);
        tx.update(doc(db, 'referralAttributions', attrSnap.id), {
          attributionStatus: 'subscribed',
          firstPaymentId: attr.firstPaymentId || paymentId,
          totalRevenueGenerated: Number(attr.totalRevenueGenerated || 0) + Number(payment.amount),
          updatedAt: now,
        });
      });

      return res.status(201).json({ entry });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Commission sync failed.' });
    }
  });

  // Super Admin only: Approve, reject, or reverse commission ledger entry
  app.post('/api/sales/commissions/decision', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser || !(await isAuthorizedSuperAdmin(verifiedUser))) {
      return res.status(403).json({ error: 'Super Admin authentication required.' });
    }
    try {
      const commissionId = sanitizeDocId(req.body?.commissionId);
      const decision = String(req.body?.decision || '');
      const reason = String(req.body?.reason || '').trim();
      if (!commissionId || !['approved', 'rejected', 'reversed'].includes(decision)) {
        return res.status(400).json({ error: 'Valid commissionId and decision required.' });
      }

      const now = new Date().toISOString();
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'commissionLedger', commissionId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Commission entry not found.');
        const cur = snap.data();

        if (decision === 'approved' && cur.status !== 'pending') {
          throw new Error(`Only pending commissions can be approved (current: ${cur.status}).`);
        }
        if (decision === 'rejected' && cur.status !== 'pending') {
          throw new Error(`Only pending commissions can be rejected (current: ${cur.status}).`);
        }
        if (decision === 'reversed' && !['pending', 'approved', 'paid'].includes(cur.status)) {
          throw new Error(`Commission already ${cur.status}.`);
        }

        const patch: Record<string, any> = { status: decision, updatedAt: now };
        if (decision === 'approved') {
          patch.approvedBy = verifiedUser.email;
          patch.approvedAt = now;
        } else if (decision === 'rejected') {
          patch.rejectionReason = reason || 'Rejected by Super Admin.';
          patch.approvedBy = verifiedUser.email;
          patch.approvedAt = now;
        } else if (decision === 'reversed') {
          patch.reversalReason = reason || 'Reversed due to refund/chargeback.';
          patch.reversedBy = verifiedUser.email;
          patch.reversedAt = now;
        }
        tx.update(ref, patch);
      });

      const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await setDoc(doc(db, 'salesAuditLogs', slogId), {
        id: slogId,
        actorUid: verifiedUser.uid,
        actorEmail: verifiedUser.email,
        actorRole: 'super_admin',
        action: `Commission ${decision}`,
        entityType: 'commission',
        entityId: commissionId,
        details: `${decision.toUpperCase()} commission ${commissionId}${reason ? ` · ${reason}` : ''}`,
        createdAt: now,
      }).catch(() => {});

      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Could not update commission.' });
    }
  });

  // Super Admin only: Process verified manual payout & mark ledger entries paid atomically
  app.post('/api/sales/payouts', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser || !(await isAuthorizedSuperAdmin(verifiedUser))) {
      return res.status(403).json({ error: 'Super Admin authentication required.' });
    }
    try {
      const salesmanId = sanitizeDocId(req.body?.salesmanId);
      const ledgerEntryIds: string[] = Array.isArray(req.body?.ledgerEntryIds)
        ? req.body.ledgerEntryIds.map((id: unknown) => sanitizeDocId(id)).filter(Boolean)
        : [];
      const method = String(req.body?.method || 'bank_transfer');
      const accountTitle = String(req.body?.accountTitle || '').trim();
      const accountNumber = String(req.body?.accountNumber || '').trim();
      const bankName = String(req.body?.bankName || '').trim();
      const transactionReference = String(req.body?.transactionReference || '').trim();
      const notes = String(req.body?.notes || '').trim();

      if (!salesmanId || ledgerEntryIds.length === 0 || !transactionReference || !accountTitle || !accountNumber) {
        return res.status(400).json({ error: 'Incomplete payout settlement details.' });
      }

      const memberSnap = await getDoc(doc(db, 'salesMembers', salesmanId));
      if (!memberSnap.exists()) return res.status(404).json({ error: 'Salesman not found.' });
      const member = memberSnap.data();

      const now = new Date().toISOString();
      const payoutId = `pay_sls_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const payoutNumber = `PAY-SLS-${Math.floor(100000 + Math.random() * 900000)}`;
      let computedTotal = 0;

      const payoutPayload = await runTransaction(db, async (tx) => {
        for (const cid of ledgerEntryIds) {
          const snap = await tx.get(doc(db, 'commissionLedger', cid));
          if (!snap.exists()) throw new Error(`Commission ${cid} does not exist.`);
          const cData = snap.data();
          if (cData.salesmanId !== salesmanId) {
            throw new Error('Commission entries must belong to the selected salesman.');
          }
          if (cData.status !== 'approved') {
            throw new Error(`Commission ${cid} is ${cData.status}; only approved commissions can be paid.`);
          }
          computedTotal += Number(cData.commissionAmount || 0);
        }

        const payload = stripUndefined({
          id: payoutId,
          payoutNumber,
          salesmanId,
          salesmanUid: member.uid,
          salesmanName: member.fullName,
          salesmanEmail: member.email,
          ledgerEntryIds,
          totalAmount: computedTotal,
          method,
          accountTitle,
          accountNumber,
          bankName: bankName || undefined,
          transactionReference,
          notes: notes || undefined,
          status: 'processed',
          processedBy: verifiedUser.email,
          processedAt: now,
          createdAt: now,
        });

        tx.set(doc(db, 'commissionPayouts', payoutId), payload);
        for (const cid of ledgerEntryIds) {
          tx.update(doc(db, 'commissionLedger', cid), {
            status: 'paid',
            payoutId,
            paidAt: now,
            updatedAt: now,
          });
        }
        return payload;
      });

      const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await setDoc(doc(db, 'salesAuditLogs', slogId), {
        id: slogId,
        actorUid: verifiedUser.uid,
        actorEmail: verifiedUser.email,
        actorRole: 'super_admin',
        action: 'Recorded Commission Payout',
        entityType: 'payout',
        entityId: payoutId,
        details: `Paid Rs. ${computedTotal} to ${member.fullName} (${payoutNumber}, TID: ${transactionReference})`,
        createdAt: now,
      }).catch(() => {});

      return res.status(201).json({ payout: payoutPayload });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Payout failed.' });
    }
  });

  // Super Admin only: Regenerate unique referral code & sync public index
  app.post('/api/sales/referrals/regenerate', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser || !(await isAuthorizedSuperAdmin(verifiedUser))) {
      return res.status(403).json({ error: 'Super Admin authentication required.' });
    }
    try {
      const memberId = sanitizeDocId(req.body?.memberId);
      if (!memberId) return res.status(400).json({ error: 'Valid memberId required.' });

      const [memberSnap, allSnap, settingsSnap] = await Promise.all([
        getDoc(doc(db, 'salesMembers', memberId)),
        getDocs(collection(db, 'salesMembers')),
        getDoc(doc(db, 'salesSettings', 'general')),
      ]);
      if (!memberSnap.exists()) return res.status(404).json({ error: 'Salesman not found.' });

      const member = memberSnap.data();
      const existingCodes = new Set(allSnap.docs.map((d) => String(d.data()?.referralCode || '').toUpperCase()));
      const cleanName = String(member.fullName || 'REP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'REP';
      let newCode = `SAL-${cleanName}-${Math.floor(1000 + Math.random() * 9000)}`;
      while (existingCodes.has(newCode)) {
        newCode = `SAL-${cleanName}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      const portalBase = settingsSnap.exists() ? String(settingsSnap.data()?.portalBaseUrl || 'https://sbkhush.com') : 'https://sbkhush.com';
      const newLink = `${portalBase.replace(/\/+$/, '')}/r/${encodeURIComponent(newCode)}`;
      const now = new Date().toISOString();

      const batch = writeBatch(db);
      batch.update(doc(db, 'salesMembers', memberId), {
        referralCode: newCode,
        referralLink: newLink,
        updatedAt: now,
      });
      if (member.referralCode) {
        batch.delete(doc(db, 'salesReferralIndex', member.referralCode));
      }
      batch.set(doc(db, 'salesReferralIndex', newCode), {
        referralCode: newCode,
        salesmanId: memberId,
        salesmanUid: member.uid || null,
        salesmanName: member.fullName,
        accountStatus: member.accountStatus,
        qrScanCount: member.qrScanCount || 0,
        updatedAt: now,
      });
      await batch.commit();

      return res.json({ referralCode: newCode, referralLink: newLink });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to regenerate referral code.' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      return res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Global Express Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled Express API error:', err);
    if (res.headersSent) return;
    res.status(err?.status || 500).json({
      error: err?.message || 'Internal server error',
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

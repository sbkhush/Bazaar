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
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  setLogLevel,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  restCommitWrites,
  restGetDoc,
  restGetDocWithMeta,
  restListCollection,
  restQueryWhereEqual,
  restSetDoc,
} from './src/utils/firestoreRestServer';
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  INITIAL_SETTINGS,
  getDefaultCategoriesForBusinessType,
  sanitizeShopSlug,
  isValidShopSlug,
  isSelfPickupEnabled,
  isCashOnPickupAllowed,
  derivePickupStatusFromOrderStatus,
  validatePickupDateInWindow,
  getDefaultPickupSlots,
} from './src/data/seedData';

dotenv.config();
setLogLevel('error');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SUPER_ADMIN_EMAIL = 'hasanaamir815@gmail.com';

// Lightweight sliding-window rate limiter & daily QR scan deduplication cache
const rateWindowMap = new Map<string, number[]>();
const qrScanDedupCache = new Map<string, string>();
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
  idToken: string;
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
      idToken,
    };
  } catch {
    return null;
  }
}

async function isAuthorizedSuperAdmin(user: VerifiedFirebaseUser): Promise<boolean> {
  if (user.email === SUPER_ADMIN_EMAIL && user.emailVerified) return true;
  const adminDoc = await restGetDoc(['platform_admins', user.uid], user.idToken).catch(() => null);
  if (adminDoc && adminDoc.active !== false) return true;
  const legacyDoc = await restGetDoc(['admins', user.uid], user.idToken).catch(() => null);
  return Boolean(legacyDoc && legacyDoc.role === 'super_admin');
}

interface TrustedSalesMemberDoc {
  id: string;
  uid?: string;
  email: string;
  fullName: string;
  role: 'salesman' | 'senior_salesman' | 'sales_manager' | 'referral_agent';
  accountStatus: string;
  assignedManagerId?: string;
  assignedManagerUid?: string;
  referralCode?: string;
  referralLink?: string;
  [key: string]: any;
}

const ALLOWED_SERVER_SALES_ROLES = ['salesman', 'senior_salesman', 'sales_manager', 'referral_agent'];

async function resolveTrustedSalesMember(user: VerifiedFirebaseUser): Promise<TrustedSalesMemberDoc | null> {
  const byUid = await restQueryWhereEqual<TrustedSalesMemberDoc>('salesMembers', 'uid', user.uid, user.idToken, {
    limitCount: 1,
  }).catch(() => []);
  if (byUid.length > 0 && ALLOWED_SERVER_SALES_ROLES.includes(byUid[0].role)) {
    return byUid[0];
  }
  if (user.email && user.emailVerified) {
    const byEmail = await restQueryWhereEqual<TrustedSalesMemberDoc>('salesMembers', 'email', user.email, user.idToken, {
      limitCount: 1,
    }).catch(() => []);
    if (byEmail.length > 0 && ALLOWED_SERVER_SALES_ROLES.includes(byEmail[0].role)) {
      return byEmail[0];
    }
  }
  return null;
}

type TrustedServerRole = 'super_admin' | 'sales_manager' | 'salesman' | 'referral_agent' | 'merchant' | 'customer';

async function resolveTrustedServerRole(user: VerifiedFirebaseUser): Promise<{
  role: TrustedServerRole;
  salesMember: TrustedSalesMemberDoc | null;
}> {
  if (await isAuthorizedSuperAdmin(user)) {
    return { role: 'super_admin', salesMember: null };
  }
  const member = await resolveTrustedSalesMember(user);
  if (member && (member.accountStatus === 'active' || member.accountStatus === 'invited')) {
    if (member.role === 'sales_manager') return { role: 'sales_manager', salesMember: member };
    if (member.role === 'referral_agent') return { role: 'referral_agent', salesMember: member };
    if (member.role === 'salesman' || member.role === 'senior_salesman') {
      return { role: 'salesman', salesMember: member };
    }
  }
  const ownedShops = await restQueryWhereEqual('shops', 'ownerId', user.uid, user.idToken, {
    limitCount: 1,
  }).catch(() => []);
  if (ownedShops.length > 0) {
    return { role: 'merchant', salesMember: null };
  }
  const memberships = await restListCollection(['users', user.uid, 'shopMemberships'], user.idToken).catch(() => []);
  if (memberships.length > 0) {
    return { role: 'merchant', salesMember: null };
  }
  return { role: 'customer', salesMember: null };
}

async function isAuthorizedShopMember(user: VerifiedFirebaseUser, shopId: string): Promise<boolean> {
  if (await isAuthorizedSuperAdmin(user)) return true;
  const [shopDoc, staffDoc] = await Promise.all([
    restGetDoc(['shops', shopId], user.idToken).catch(() => null),
    restGetDoc(['shops', shopId, 'staff', user.uid], user.idToken).catch(() => null),
  ]);
  if (shopDoc?.ownerId === user.uid) return true;
  if (staffDoc?.status === 'active') return true;
  return false;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Strict CORS allowlist for GitHub Pages frontend, sbkhush.com domains, and localhost dev
  const staticTrustedOrigins = new Set<string>([
    'https://sbkhush.github.io',
    'https://sbkhush.com',
    'https://www.sbkhush.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
  const appUrlRaw = String(process.env.APP_URL || '').trim();
  if (appUrlRaw) {
    try {
      staticTrustedOrigins.add(new URL(appUrlRaw).origin);
    } catch {}
  }
  const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  extraOrigins.forEach((o) => staticTrustedOrigins.add(o));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      const requestHost = req.headers.host || '';
      const sameOrigin =
        origin === `https://${requestHost}` || origin === `http://${requestHost}`;
      const isLocalDevOrigin =
        process.env.NODE_ENV !== 'production' &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
      const isAllowed =
        sameOrigin || staticTrustedOrigins.has(origin) || isLocalDevOrigin;

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      } else if (req.path.startsWith('/api')) {
        return res.status(403).json({ error: 'Origin not permitted by CORS policy.' });
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
    const storeName = String(req.body?.storeName || 'SB Khush').trim();

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
          sources: [{ title: `${storeName} Storefront`, uri: 'https://sbkhush.com' }],
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
        sources: [{ title: 'Pakistan Retail Market Guide', uri: 'https://sbkhush.com' }],
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
        const data = await restGetDoc(['platform_payment_receipts', receiptId], verifiedUser.idToken);
        if (!data) {
          return res.status(404).json({ error: 'Subscription receipt not found.' });
        }
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
      const data = await restGetDoc(['shops', shopId, 'payment_receipts', receiptId], verifiedUser.idToken);
      if (!data) {
        return res.status(404).json({ error: 'Order receipt not found.' });
      }
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

  const orderIdempotencyCache = new Map<string, { expiresAt: number; payload: any }>();

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
        idempotencyKey,
      } = req.body;

      const cleanIdempotencyKey = sanitizeDocId(idempotencyKey);
      const idemCacheKey = cleanIdempotencyKey ? `${shopId}:${cleanIdempotencyKey}` : '';
      if (idemCacheKey) {
        const cached = orderIdempotencyCache.get(idemCacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          return res.status(200).json({ ...cached.payload, deduplicated: true });
        }
      }

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
      if (resolvedPaymentMethod === 'online') {
        return res.status(400).json({ error: 'Online card gateway is not enabled. Please select COD, EasyPaisa, JazzCash, or Bank Transfer.' });
      }
      if (!['cod', 'easypaisa', 'jazzcash', 'bank_transfer'].includes(resolvedPaymentMethod)) {
        return res.status(400).json({ error: 'Unsupported payment method selected.' });
      }

      const resolvedFulfillment = fulfillmentMethod === 'self_pickup' ? 'self_pickup' : 'delivery';
      if (resolvedFulfillment === 'self_pickup' && !isSelfPickupEnabled(pubSettings)) {
        return res.status(400).json({ error: 'Self-Pickup is currently disabled for this store.' });
      }

      if (resolvedPaymentMethod === 'cod') {
        if (resolvedFulfillment === 'self_pickup') {
          if (!isCashOnPickupAllowed(pubSettings)) {
            return res.status(400).json({
              error: 'Advance payment (EasyPaisa, JazzCash, or Bank Transfer) is required for Self-Pickup orders at this store.',
            });
          }
        } else if (pubSettings.codEnabled === false) {
          return res.status(400).json({ error: 'Cash on Delivery is disabled for this store.' });
        }
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
      const orderId = cleanIdempotencyKey
        ? `ord_${cleanIdempotencyKey.slice(0, 80)}`
        : `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const trackingToken = generateServerTrackingToken();
      const trackingTokenHash = computeTrackingTokenHash(orderNumber, trackingToken);
      const trackingDocId = `trk_${trackingTokenHash.slice(0, 32)}`;
      const now = new Date().toISOString();

      let pickupOtp: string | undefined;
      let pickupOtpHash: string | undefined;
      let pickupSlotKey: string | undefined;
      let slotDate: string | undefined;
      let slotId: string | undefined;
      let slotMaxOrders = 10;
      let authoritativePickupDetails: any = undefined;

      if (resolvedFulfillment === 'self_pickup') {
        pickupOtp = String(100000 + crypto.randomInt(0, 900000));
        pickupOtpHash = crypto.createHash('sha256').update(`OTP:${orderNumber}:${pickupOtp}`).digest('hex');

        slotDate = String(pickupDetails?.pickupDate || '').replace(/[^0-9-]/g, '').slice(0, 10);
        slotId = String(pickupDetails?.pickupSlotId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
        const advanceDays = Number(pubSettings.selfPickupDetails?.advanceDays ?? 5) || 5;
        if (!validatePickupDateInWindow(slotDate, advanceDays)) {
          return res.status(400).json({ error: 'Invalid pickup date or date outside store booking window.' });
        }
        if (!slotId) {
          return res.status(400).json({ error: 'A valid pickup time slot selection is required.' });
        }

        pickupSlotKey = `${slotDate}__${slotId}`;
        const rawSlots =
          Array.isArray(pubSettings.selfPickupDetails?.pickupSlots) && pubSettings.selfPickupDetails.pickupSlots.length > 0
            ? pubSettings.selfPickupDetails.pickupSlots
            : getDefaultPickupSlots();
        const matchSlot = rawSlots.find((s: any) => String(s?.id) === slotId);
        if (!matchSlot || matchSlot.isActive === false) {
          return res.status(400).json({ error: 'Selected pickup slot is not active or does not exist.' });
        }
        slotMaxOrders = Math.max(1, Math.min(500, Math.floor(Number(matchSlot.maxOrdersPerSlot) || 10)));

        const sp = pubSettings.selfPickupDetails || {};
        authoritativePickupDetails = stripUndefined({
          locationName: sp.title || pickupDetails?.locationName || 'Store Counter',
          address: sp.address || pickupDetails?.address || '',
          city: sp.city || pickupDetails?.city || pubSettings.city || '',
          timings: sp.timings || pickupDetails?.timings || '',
          contactPhone: sp.contactPhone || pickupDetails?.contactPhone || pubSettings.contactPhone || '',
          mapUrl: sp.mapUrl || pickupDetails?.mapUrl,
          preparationTime: sp.preparationTime || pickupDetails?.preparationTime || '30–45 mins',
          pickupDate: slotDate,
          pickupSlotId: String(matchSlot.id),
          pickupSlotLabel: String(matchSlot.label),
          preferredTime: `${slotDate} · ${String(matchSlot.label)}`,
          instructions: sp.instructions || pickupDetails?.instructions,
        });
      }

      const initialPickupHistory = resolvedFulfillment === 'self_pickup'
        ? [
            {
              status: 'Pending',
              timestamp: now,
              note: authoritativePickupDetails?.pickupSlotLabel
                ? `Self-Pickup scheduled for ${authoritativePickupDetails.pickupDate} (${authoritativePickupDetails.pickupSlotLabel})`
                : 'Self-Pickup order placed',
              actor: customer.name.trim(),
            },
          ]
        : undefined;

      const initialCustomerNotifications = resolvedFulfillment === 'self_pickup'
        ? [
            {
              id: `cnot_${Date.now()}`,
              title: `Pickup Order ${orderNumber} Received`,
              message: `Present your 6-digit Pickup Code & QR Pass at ${authoritativePickupDetails?.locationName || 'the store counter'} when collecting your order.`,
              status: 'Pending',
              createdAt: now,
              channel: 'in_app',
            },
          ]
        : undefined;

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
        pickupDetails: resolvedFulfillment === 'self_pickup' ? authoritativePickupDetails : undefined,
        pickupStatus: resolvedFulfillment === 'self_pickup' ? 'New Pickup Order' : undefined,
        pickupShopId: resolvedFulfillment === 'self_pickup' ? shopId : undefined,
        pickupAddress: resolvedFulfillment === 'self_pickup' ? authoritativePickupDetails?.address : undefined,
        pickupDate: resolvedFulfillment === 'self_pickup' ? slotDate : undefined,
        pickupTimeSlot: resolvedFulfillment === 'self_pickup' ? authoritativePickupDetails?.pickupSlotLabel : undefined,
        pickupInstructions: resolvedFulfillment === 'self_pickup' ? authoritativePickupDetails?.instructions : undefined,
        pickupOtp,
        pickupOtpHash,
        pickupSlotKey,
        stockDeducted: false,
        pickupHistory: initialPickupHistory,
        customerNotifications: initialCustomerNotifications,
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
          ? stripUndefined({
              locationName: newOrder.pickupDetails.locationName,
              address: newOrder.pickupDetails.address,
              city: newOrder.pickupDetails.city,
              timings: newOrder.pickupDetails.timings,
              contactPhone: newOrder.pickupDetails.contactPhone,
              mapUrl: newOrder.pickupDetails.mapUrl,
              preparationTime: newOrder.pickupDetails.preparationTime,
              pickupDate: newOrder.pickupDetails.pickupDate,
              pickupSlotId: newOrder.pickupDetails.pickupSlotId,
              pickupSlotLabel: newOrder.pickupDetails.pickupSlotLabel,
              instructions: newOrder.pickupDetails.instructions,
            })
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
        const notifId = `ntf_${Date.now()}`;
        const notifDoc = {
          id: notifId,
          title: resolvedFulfillment === 'self_pickup' ? `New Self-Pickup Order ${orderNumber}` : `New Guest Order ${orderNumber}`,
          message: resolvedFulfillment === 'self_pickup'
            ? `${newOrder.customer.name} booked Self-Pickup (${newOrder.pickupDetails?.pickupDate || 'Flex'}) · Rs. ${newOrder.total.toLocaleString()}`
            : `${newOrder.customer.name} placed Rs. ${newOrder.total.toLocaleString()} order`,
          type: 'order',
          isRead: false,
          link: '/dashboard/orders',
          createdAt: now,
        };

        if (pickupSlotKey && slotDate && slotId) {
          try {
            await runTransaction(db, async (tx) => {
              const slotRef = doc(db, 'shops', shopId, 'pickup_slots', pickupSlotKey!);
              const slotSnap = await tx.get(slotRef);
              const existingBooked = slotSnap.exists() ? Number(slotSnap.data()?.bookedCount || 0) : 0;
              const maxOrders = slotSnap.exists() ? Number(slotSnap.data()?.maxOrders || slotMaxOrders) : slotMaxOrders;
              if (existingBooked >= maxOrders) {
                throw new Error('SLOT_FULL');
              }
              if (slotSnap.exists()) {
                tx.update(slotRef, {
                  id: pickupSlotKey,
                  shopId,
                  date: slotDate,
                  slotId,
                  bookedCount: existingBooked + 1,
                  maxOrders,
                  updatedAt: now,
                });
              } else {
                tx.set(slotRef, {
                  id: pickupSlotKey,
                  shopId,
                  date: slotDate,
                  slotId,
                  bookedCount: 1,
                  maxOrders,
                  updatedAt: now,
                });
              }
              tx.set(doc(db, 'shops', shopId, 'orders', orderId), newOrder);
              tx.set(doc(db, 'shops', shopId, 'order_tracking', trackingDocId), trackingDoc);
              tx.set(doc(db, 'shops', shopId, 'notifications', notifId), notifDoc);
            });
          } catch (txErr: any) {
            if (txErr?.message === 'SLOT_FULL') {
              return res.status(400).json({ error: 'Selected pickup time slot is now full. Please select another slot.' });
            }
            throw txErr;
          }
        } else {
          const batch = writeBatch(db);
          batch.set(doc(db, 'shops', shopId, 'orders', orderId), newOrder);
          batch.set(doc(db, 'shops', shopId, 'order_tracking', trackingDocId), trackingDoc);
          batch.set(doc(db, 'shops', shopId, 'notifications', notifId), notifDoc);
          await batch.commit();
        }

        const responsePayload = { ...newOrder, trackingToken };
        if (idemCacheKey) {
          orderIdempotencyCache.set(idemCacheKey, {
            expiresAt: Date.now() + 15 * 60 * 1000,
            payload: responsePayload,
          });
        }
        return res.status(201).json(responsePayload);
      }

      return res.status(200).json({ ...newOrder, trackingToken, requiresClientAuthWrite: true });
    } catch (err: any) {
      console.error('Error creating tenant order on server:', err);
      return res.status(500).json({ error: err.message || 'Failed to place order' });
    }
  });

  // API Route: Live Self-Pickup Time Slot Availability
  app.get('/api/orders/pickup-slots', async (req, res) => {
    try {
      const shopId = sanitizeShopId(req.query.shopId);
      const date = String(req.query.date || '').replace(/[^0-9-]/g, '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Valid YYYY-MM-DD pickup date is required.' });
      }
      const pubSnap = await getDoc(doc(db, 'shops', shopId, 'settings', 'public'));
      const pubSettings = pubSnap.exists() ? pubSnap.data() : {};
      const rawSlots =
        Array.isArray(pubSettings.selfPickupDetails?.pickupSlots) && pubSettings.selfPickupDetails.pickupSlots.length > 0
          ? pubSettings.selfPickupDetails.pickupSlots
          : getDefaultPickupSlots();
      const activeSlots = rawSlots.filter((s: any) => s && s.isActive !== false);
      const slotSnaps = await Promise.all(
        activeSlots.map((slot: any) =>
          getDoc(doc(db, 'shops', shopId, 'pickup_slots', `${date}__${String(slot.id)}`)).catch(() => null)
        )
      );
      const slots = activeSlots.map((slot: any, idx: number) => {
        const snap = slotSnaps[idx];
        const bookedCount = snap?.exists() ? Math.max(0, Number(snap.data()?.bookedCount || 0)) : 0;
        const maxOrdersPerSlot = snap?.exists()
          ? Math.max(1, Number(snap.data()?.maxOrders || slot.maxOrdersPerSlot || 10))
          : Math.max(1, Number(slot.maxOrdersPerSlot || 10));
        const remaining = Math.max(0, maxOrdersPerSlot - bookedCount);
        return {
          ...slot,
          date,
          slotKey: `${date}__${String(slot.id)}`,
          bookedCount,
          maxOrdersPerSlot,
          remaining,
          isFull: remaining <= 0,
        };
      });
      return res.json({ shopId, date, enabled: isSelfPickupEnabled(pubSettings), slots });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to load pickup slots.' });
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
        pickupStatus: td.fulfillmentMethod === 'self_pickup' ? derivePickupStatusFromOrderStatus(td.orderStatus) : undefined,
        pickupShopId: td.fulfillmentMethod === 'self_pickup' ? shopId : undefined,
        pickupAddress: td.pickupDetails?.address,
        pickupDate: td.pickupDetails?.pickupDate,
        pickupTimeSlot: td.pickupDetails?.pickupSlotLabel || td.pickupDetails?.preferredTime,
        pickupInstructions: td.pickupDetails?.instructions,
        paymentMethod: td.paymentMethod,
        paymentStatus: td.paymentStatus,
        courierName: td.courierName,
        trackingNumber: td.trackingNumber,
        createdAt: td.createdAt,
        updatedAt: td.updatedAt,
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

      const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
      let owner: Record<string, any> | null = await restGetDoc<Record<string, any>>(
        ['salesReferralIndex', code],
        verifiedUser?.idToken
      ).catch(() => null);

      if (!owner && verifiedUser && (await isAuthorizedSuperAdmin(verifiedUser))) {
        const matches = await restQueryWhereEqual<Record<string, any>>(
          'salesMembers',
          'referralCode',
          code,
          verifiedUser.idToken,
          { limitCount: 1 }
        ).catch(() => []);
        if (matches.length > 0) {
          const m = matches[0];
          owner = {
            id: code,
            referralCode: code,
            salesmanId: m.id,
            salesmanUid: m.uid || null,
            salesmanName: m.fullName,
            accountStatus: m.accountStatus,
            qrScanCount: Number(m.qrScanCount || 0),
          };
        }
      }

      if (!owner || owner.accountStatus !== 'active') {
        return res.json({ ok: false, owner: null });
      }

      const now = new Date().toISOString();
      const todayYmd = now.slice(0, 10);
      const dedupKey = `${clientIp}:${code}`;
      if (qrScanDedupCache.get(dedupKey) === todayYmd) {
        return res.json({ ok: true, owner, deduplicated: true });
      }
      if (qrScanDedupCache.size > 5000) {
        qrScanDedupCache.clear();
      }
      qrScanDedupCache.set(dedupKey, todayYmd);

      const evtId = `qr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      // Public salesQrEvents create rule permits unauthenticated scan logging on its own
      await restSetDoc(
        ['salesQrEvents', evtId],
        {
          id: evtId,
          salesmanId: owner.salesmanId,
          referralCode: code,
          source,
          createdAt: now,
        },
        verifiedUser?.idToken
      ).catch(() => {});

      // Best-effort counter update only when caller is Super Admin or owns the referral code
      if (verifiedUser && owner.salesmanId) {
        const canUpdateCounter =
          owner.salesmanUid === verifiedUser.uid || (await isAuthorizedSuperAdmin(verifiedUser));
        if (canUpdateCounter) {
          const nextCount = (Number(owner.qrScanCount) || 0) + 1;
          await restSetDoc(
            ['salesReferralIndex', code],
            {
              referralCode: code,
              salesmanId: owner.salesmanId,
              salesmanUid: owner.salesmanUid || null,
              salesmanName: owner.salesmanName,
              accountStatus: owner.accountStatus,
              qrScanCount: nextCount,
              updatedAt: now,
            },
            verifiedUser.idToken,
            true
          ).catch(() => {});
        }
      }

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
      if (!code || !/^[A-Z0-9-]{4,40}$/.test(code)) {
        return res.json({ ok: false, attribution: null });
      }
      const isSuper = await isAuthorizedSuperAdmin(verifiedUser);
      if (!isSuper && verifiedUser.uid !== ownerId) {
        return res.status(403).json({ error: 'Forbidden: owner identity mismatch.' });
      }

      const idxOwner = await restGetDoc<Record<string, any>>(['salesReferralIndex', code], verifiedUser.idToken).catch(
        () => null
      );
      let salesmanInfo: Record<string, any> | null = idxOwner
        ? {
            id: idxOwner.salesmanId,
            uid: idxOwner.salesmanUid || undefined,
            fullName: idxOwner.salesmanName,
            accountStatus: idxOwner.accountStatus,
          }
        : null;

      if (isSuper) {
        const directMembers = await restQueryWhereEqual<Record<string, any>>(
          'salesMembers',
          'referralCode',
          code,
          verifiedUser.idToken,
          { limitCount: 1 }
        ).catch(() => []);
        if (directMembers.length > 0) {
          salesmanInfo = directMembers[0];
        }
      }

      if (!salesmanInfo || salesmanInfo.accountStatus !== 'active') {
        return res.json({ ok: false, attribution: null });
      }

      let preventSelf = true;
      let attributionWindowDays = 30;
      if (isSuper) {
        const settings = await restGetDoc<Record<string, any>>(['salesSettings', 'general'], verifiedUser.idToken).catch(
          () => null
        );
        preventSelf = settings ? settings.preventSelfReferral !== false : true;
        if (settings && Number(settings.attributionWindowDays) > 0) {
          attributionWindowDays = Number(settings.attributionWindowDays);
        }
      }

      const rawCapturedAt = req.body?.capturedAt ? String(req.body.capturedAt) : '';
      if (rawCapturedAt) {
        const capturedMs = Date.parse(rawCapturedAt);
        if (Number.isFinite(capturedMs) && Date.now() - capturedMs > attributionWindowDays * 86_400_000) {
          return res.json({ ok: false, attribution: null, reason: 'Referral attribution window expired' });
        }
      }

      const ownerEmail = String(req.body?.ownerEmail || verifiedUser.email || '').trim().toLowerCase();
      const ownerPhone = String(req.body?.ownerPhone || '').trim();

      const isSelfReferral =
        preventSelf &&
        (Boolean(salesmanInfo.uid && salesmanInfo.uid === ownerId) ||
          Boolean(salesmanInfo.email && String(salesmanInfo.email).toLowerCase() === ownerEmail) ||
          Boolean(
            ownerPhone &&
              salesmanInfo.phone &&
              normalizePhoneDigits(salesmanInfo.phone) === normalizePhoneDigits(ownerPhone)
          ));

      const now = new Date().toISOString();
      const payload = stripUndefined({
        id: shopId,
        referralCode: code,
        salesmanId: salesmanInfo.id,
        salesmanUid: salesmanInfo.uid,
        salesmanName: salesmanInfo.fullName,
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

      try {
        await restCommitWrites(
          [{ type: 'create', pathSegments: ['referralAttributions', shopId], data: payload }],
          verifiedUser.idToken
        );
      } catch (createErr: any) {
        if (createErr?.status === 409) {
          const existing = await restGetDoc(['referralAttributions', shopId], verifiedUser.idToken).catch(() => null);
          return res.json({ ok: true, attribution: existing });
        }
        throw createErr;
      }

      if (payload.leadId && !isSelfReferral && isSuper) {
        await restCommitWrites(
          [
            {
              type: 'update',
              pathSegments: ['salesLeads', payload.leadId],
              data: {
                status: 'Converted',
                convertedShopId: shopId,
                convertedShopSlug: payload.shopSlug,
                updatedAt: now,
              },
            },
          ],
          verifiedUser.idToken
        ).catch(() => {});
      }

      if (isSuper) {
        const notifId = `sntf_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
        await restSetDoc(
          ['salesNotifications', notifId],
          stripUndefined({
            id: notifId,
            recipientSalesmanId: salesmanInfo.id,
            recipientUid: salesmanInfo.uid,
            type: isSelfReferral ? 'commission_rejected' : 'shop_registered',
            title: isSelfReferral
              ? `Self-Referral Blocked: ${payload.shopName}`
              : `Referred Shop Registered: ${payload.shopName}`,
            message: isSelfReferral
              ? 'Registration matched your own identity and is ineligible for commission.'
              : `${payload.shopName} registered using code ${code}.`,
            link: salesmanInfo.role === 'referral_agent' ? '/referral/referrals' : '/salesman/referrals',
            isRead: false,
            createdAt: now,
          }),
          verifiedUser.idToken
        ).catch(() => {});
      }

      const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await restSetDoc(
        ['salesAuditLogs', slogId],
        {
          id: slogId,
          actorUid: verifiedUser.uid,
          actorEmail: verifiedUser.email,
          actorRole: isSuper ? 'super_admin' : 'system',
          action: isSelfReferral ? 'Blocked Self-Referral' : 'Recorded Referral Attribution',
          entityType: 'referral',
          entityId: shopId,
          details: `${payload.shopName} -> ${salesmanInfo.fullName} (${code}) · ${payload.attributionStatus}`,
          createdAt: now,
        },
        verifiedUser.idToken
      ).catch(() => {});

      return res.status(201).json({ ok: true, attribution: payload });
    } catch (err: any) {
      return res.status(err?.status || 500).json({ error: err?.message || 'Failed to record attribution.' });
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

      const payment = await restGetDoc<Record<string, any>>(['platform_payments', paymentId], verifiedUser.idToken);
      if (!payment) return res.status(404).json({ error: 'Payment not found.' });
      if (payment.status !== 'approved' || Number(payment.amount) <= 0) {
        return res.json({ entry: null });
      }

      const attrMeta = await restGetDocWithMeta<Record<string, any>>(
        ['referralAttributions', String(payment.shopId)],
        verifiedUser.idToken
      );
      if (!attrMeta) return res.json({ entry: null });
      const attr = attrMeta.data;
      if (attr.attributionStatus === 'rejected_self_referral' || attr.attributionStatus === 'duplicate_blocked') {
        return res.json({ entry: null });
      }

      const ledgerId = `comm_${paymentId}`;
      const existing = await restGetDoc(['commissionLedger', ledgerId], verifiedUser.idToken);
      if (existing) {
        return res.json({ entry: { ...existing, id: ledgerId } });
      }

      const [member, settings] = await Promise.all([
        restGetDoc<Record<string, any>>(['salesMembers', String(attr.salesmanId)], verifiedUser.idToken),
        restGetDoc<Record<string, any>>(['salesSettings', 'general'], verifiedUser.idToken).catch(() => null),
      ]);
      if (!member) return res.json({ entry: null });

      const plans: any[] =
        Array.isArray(settings?.commissionPlans) && settings.commissionPlans.length > 0
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
        attributionId: attr.id,
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

      await restCommitWrites(
        [
          { type: 'create', pathSegments: ['commissionLedger', ledgerId], data: entry },
          {
            type: 'update',
            pathSegments: ['referralAttributions', attr.id],
            data: {
              attributionStatus: 'subscribed',
              firstPaymentId: attr.firstPaymentId || paymentId,
              totalRevenueGenerated: Number(attr.totalRevenueGenerated || 0) + Number(payment.amount),
              updatedAt: now,
            },
            expectedUpdateTime: attrMeta.updateTime,
          },
        ],
        verifiedUser.idToken
      );

      return res.status(201).json({ entry });
    } catch (err: any) {
      return res.status(err?.status || 500).json({ error: err?.message || 'Commission sync failed.' });
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

      const commMeta = await restGetDocWithMeta<Record<string, any>>(
        ['commissionLedger', commissionId],
        verifiedUser.idToken
      );
      if (!commMeta) return res.status(404).json({ error: 'Commission entry not found.' });
      const cur = commMeta.data;

      if (decision === 'approved' && cur.status !== 'pending') {
        return res.status(400).json({ error: `Only pending commissions can be approved (current: ${cur.status}).` });
      }
      if (decision === 'rejected' && cur.status !== 'pending') {
        return res.status(400).json({ error: `Only pending commissions can be rejected (current: ${cur.status}).` });
      }
      if (decision === 'reversed' && !['pending', 'approved', 'paid'].includes(cur.status)) {
        return res.status(400).json({ error: `Commission already ${cur.status}.` });
      }

      const now = new Date().toISOString();
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

      await restCommitWrites(
        [
          {
            type: 'update',
            pathSegments: ['commissionLedger', commissionId],
            data: patch,
            expectedUpdateTime: commMeta.updateTime,
          },
        ],
        verifiedUser.idToken
      );

      const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await restSetDoc(
        ['salesAuditLogs', slogId],
        {
          id: slogId,
          actorUid: verifiedUser.uid,
          actorEmail: verifiedUser.email,
          actorRole: 'super_admin',
          action: `Commission ${decision}`,
          entityType: 'commission',
          entityId: commissionId,
          details: `${decision.toUpperCase()} commission ${commissionId}${reason ? ` · ${reason}` : ''}`,
          createdAt: now,
        },
        verifiedUser.idToken
      ).catch(() => {});

      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(err?.status || 400).json({ error: err?.message || 'Could not update commission.' });
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

      const member = await restGetDoc<Record<string, any>>(['salesMembers', salesmanId], verifiedUser.idToken);
      if (!member) return res.status(404).json({ error: 'Salesman not found.' });

      const entryMetas = await Promise.all(
        ledgerEntryIds.map((cid) => restGetDocWithMeta<Record<string, any>>(['commissionLedger', cid], verifiedUser.idToken))
      );

      let computedTotal = 0;
      for (let i = 0; i < ledgerEntryIds.length; i++) {
        const cid = ledgerEntryIds[i];
        const meta = entryMetas[i];
        if (!meta) return res.status(404).json({ error: `Commission ${cid} does not exist.` });
        if (meta.data.salesmanId !== salesmanId) {
          return res.status(400).json({ error: 'Commission entries must belong to the selected salesman.' });
        }
        if (meta.data.status !== 'approved') {
          return res.status(400).json({
            error: `Commission ${cid} is ${meta.data.status}; only approved commissions can be paid.`,
          });
        }
        computedTotal += Number(meta.data.commissionAmount || 0);
      }

      const now = new Date().toISOString();
      const payoutId = `pay_sls_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const payoutNumber = `PAY-SLS-${Math.floor(100000 + Math.random() * 900000)}`;

      const payoutPayload = stripUndefined({
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

      await restCommitWrites(
        [
          { type: 'create', pathSegments: ['commissionPayouts', payoutId], data: payoutPayload },
          ...entryMetas.map((meta, idx) => ({
            type: 'update' as const,
            pathSegments: ['commissionLedger', ledgerEntryIds[idx]],
            data: {
              status: 'paid',
              payoutId,
              paidAt: now,
              updatedAt: now,
            },
            expectedUpdateTime: meta!.updateTime,
          })),
        ],
        verifiedUser.idToken
      );

      const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await restSetDoc(
        ['salesAuditLogs', slogId],
        {
          id: slogId,
          actorUid: verifiedUser.uid,
          actorEmail: verifiedUser.email,
          actorRole: 'super_admin',
          action: 'Recorded Commission Payout',
          entityType: 'payout',
          entityId: payoutId,
          details: `Paid Rs. ${computedTotal} to ${member.fullName} (${payoutNumber}, TID: ${transactionReference})`,
          createdAt: now,
        },
        verifiedUser.idToken
      ).catch(() => {});

      return res.status(201).json({ payout: payoutPayload });
    } catch (err: any) {
      return res.status(err?.status || 400).json({ error: err?.message || 'Payout failed.' });
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

      const [member, allMembers, settings] = await Promise.all([
        restGetDoc<Record<string, any>>(['salesMembers', memberId], verifiedUser.idToken),
        restListCollection<Record<string, any>>(['salesMembers'], verifiedUser.idToken),
        restGetDoc<Record<string, any>>(['salesSettings', 'general'], verifiedUser.idToken).catch(() => null),
      ]);
      if (!member) return res.status(404).json({ error: 'Salesman not found.' });

      const existingCodes = new Set(allMembers.map((m) => String(m.referralCode || '').toUpperCase()));
      const cleanName = String(member.fullName || 'REP').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'REP';
      let newCode = `SAL-${cleanName}-${Math.floor(1000 + Math.random() * 9000)}`;
      for (let i = 0; i < 20 && existingCodes.has(newCode); i++) {
        newCode = `SAL-${cleanName}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      const portalBase = String(settings?.portalBaseUrl || 'https://sbkhush.com').replace(/\/+$/, '');
      const newLink = `${portalBase}/r/${encodeURIComponent(newCode)}`;
      const now = new Date().toISOString();

      const ops: Parameters<typeof restCommitWrites>[0] = [
        {
          type: 'update',
          pathSegments: ['salesMembers', memberId],
          data: {
            referralCode: newCode,
            referralLink: newLink,
            updatedAt: now,
          },
        },
        {
          type: 'set',
          pathSegments: ['salesReferralIndex', newCode],
          data: {
            referralCode: newCode,
            salesmanId: memberId,
            salesmanUid: member.uid || null,
            salesmanName: member.fullName,
            accountStatus: member.accountStatus,
            qrScanCount: member.qrScanCount || 0,
            updatedAt: now,
          },
        },
      ];
      if (member.referralCode && member.referralCode !== newCode) {
        ops.push({ type: 'delete', pathSegments: ['salesReferralIndex', String(member.referralCode)] });
      }
      await restCommitWrites(ops, verifiedUser.idToken);

      return res.json({ referralCode: newCode, referralLink: newLink });
    } catch (err: any) {
      return res.status(err?.status || 500).json({ error: err?.message || 'Failed to regenerate referral code.' });
    }
  });

  // Server-verified role identity lookup (ignores any client-submitted role headers or body fields)
  app.get('/api/sales/me/role', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    try {
      const resolved = await resolveTrustedServerRole(verifiedUser);
      const portalHome =
        resolved.role === 'super_admin'
          ? '/super-admin'
          : resolved.role === 'sales_manager'
          ? '/sales-manager'
          : resolved.role === 'salesman'
          ? '/salesman'
          : resolved.role === 'referral_agent'
          ? '/referral'
          : resolved.role === 'merchant'
          ? '/dashboard'
          : '/';
      return res.json({
        uid: verifiedUser.uid,
        email: verifiedUser.email,
        role: resolved.role,
        portalHome,
        salesMember: resolved.salesMember,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to verify role.' });
    }
  });

  // Super Admin ONLY: Send or resend Firebase Auth invite/password-setup email (guarantees Auth user exists)
  app.post('/api/super-admin/sales/invite', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!(await isAuthorizedSuperAdmin(verifiedUser))) {
      return res.status(403).json({ error: 'Forbidden: Super Admin access required.' });
    }
    try {
      const memberId = req.body?.memberId ? sanitizeDocId(req.body.memberId) : '';
      let targetEmail = String(req.body?.email || '').trim().toLowerCase();
      let displayName = 'SB Khush Sales Representative';

      if (memberId) {
        const member = await restGetDoc<Record<string, any>>(['salesMembers', memberId], verifiedUser.idToken);
        if (!member) {
          return res.status(404).json({ error: 'Sales member not found.' });
        }
        targetEmail = String(member.email || targetEmail).trim().toLowerCase();
        displayName = String(member.fullName || displayName);
      }

      if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        return res.status(400).json({ error: 'A valid email address is required.' });
      }
      if (targetEmail === SUPER_ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Cannot trigger sales portal invites for the Super Admin account.' });
      }
      if (!firebaseConfig.apiKey) {
        return res.status(500).json({ error: 'Firebase Auth API key is not configured.' });
      }

      let authAccountReady = false;
      const signUpRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: targetEmail,
            password: crypto.randomBytes(20).toString('hex'),
            displayName,
            returnSecureToken: false,
          }),
        }
      );
      const signUpData = (await signUpRes.json().catch(() => ({}))) as any;
      if (signUpRes.ok || signUpData?.error?.message === 'EMAIL_EXISTS') {
        authAccountReady = true;
      } else {
        return res.status(400).json({
          error: `Firebase Auth account setup failed: ${signUpData?.error?.message || 'Unknown error'}`,
        });
      }

      const resetRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType: 'PASSWORD_RESET',
            email: targetEmail,
          }),
        }
      );
      if (!resetRes.ok) {
        const resetErr = (await resetRes.json().catch(() => ({}))) as any;
        return res.status(400).json({
          error: `Invite email dispatch failed: ${resetErr?.error?.message || 'Unable to send reset email.'}`,
        });
      }

      if (memberId) {
        const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
        await restSetDoc(
          ['salesAuditLogs', slogId],
          {
            id: slogId,
            actorUid: verifiedUser.uid,
            actorEmail: verifiedUser.email,
            actorRole: 'super_admin',
            action: 'Sent Portal Access Reset',
            entityType: 'sales_member',
            entityId: memberId,
            details: `Triggered Firebase Authentication invite/reset email to ${targetEmail}`,
            createdAt: new Date().toISOString(),
          },
          verifiedUser.idToken
        ).catch(() => {});
      }

      return res.json({ ok: true, authAccountReady, email: targetEmail });
    } catch (err: any) {
      return res.status(err?.status || 500).json({ error: err?.message || 'Could not dispatch reset email.' });
    }
  });

  // Super Admin ONLY: Create or update sales member cleanly (never permits super_admin assignment)
  app.post('/api/super-admin/sales/members', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!(await isAuthorizedSuperAdmin(verifiedUser))) {
      return res.status(403).json({ error: 'Forbidden: Super Admin access required to manage sales accounts or roles.' });
    }

    const normalizePhoneServer = (raw?: unknown): string => {
      const digits = String(raw || '').replace(/\D/g, '');
      if (digits.startsWith('92') && digits.length >= 12) return `0${digits.slice(2, 12)}`;
      if (digits.startsWith('3') && digits.length === 10) return `0${digits}`;
      return digits;
    };

    let createdAuthIdToken: string | null = null;

    try {
      const rawMemberId = req.body?.memberId ? sanitizeDocId(req.body.memberId) : '';
      const requestedRole = String(req.body?.role || 'salesman').trim();
      if (requestedRole === 'super_admin' || !ALLOWED_SERVER_SALES_ROLES.includes(requestedRole)) {
        return res.status(403).json({
          error:
            'Forbidden: sales team accounts cannot hold super_admin role. Allowed: salesman, senior_salesman, sales_manager, referral_agent.',
        });
      }

      const now = new Date().toISOString();

      // UPDATE EXISTING SALES MEMBER
      if (rawMemberId) {
        const existingData = await restGetDoc<Record<string, any>>(['salesMembers', rawMemberId], verifiedUser.idToken);
        if (!existingData) {
          return res.status(404).json({ error: 'Sales member not found.' });
        }
        const prevRole = existingData?.role;

        if (req.body?.phone) {
          const nextNormPhone = normalizePhoneServer(req.body.phone);
          if (nextNormPhone) {
            const allMembers = await restListCollection<Record<string, any>>(['salesMembers'], verifiedUser.idToken);
            const phoneClash = allMembers.find(
              (m) => m.id !== rawMemberId && normalizePhoneServer(m.phone) === nextNormPhone
            );
            if (phoneClash) {
              return res.status(409).json({ error: 'Another sales member already uses this phone number.' });
            }
          }
        }

        const patch = stripUndefined({
          fullName: req.body?.fullName !== undefined ? String(req.body.fullName).trim() : undefined,
          phone: req.body?.phone !== undefined ? String(req.body.phone).trim() : undefined,
          city: req.body?.city !== undefined ? String(req.body.city).trim() : undefined,
          address: req.body?.address !== undefined ? (String(req.body.address).trim() || null) : undefined,
          role: requestedRole,
          assignedManagerId: req.body?.assignedManagerId !== undefined ? req.body.assignedManagerId || null : undefined,
          assignedManagerUid: req.body?.assignedManagerUid !== undefined ? req.body.assignedManagerUid || null : undefined,
          assignedManagerName: req.body?.assignedManagerName !== undefined ? req.body.assignedManagerName || null : undefined,
          teamId: req.body?.teamId !== undefined ? req.body.teamId || null : undefined,
          teamName: req.body?.teamName !== undefined ? req.body.teamName || null : undefined,
          territory: req.body?.territory !== undefined ? String(req.body.territory).trim() : undefined,
          industryFocus: req.body?.industryFocus !== undefined ? String(req.body.industryFocus) : undefined,
          joiningDate: req.body?.joiningDate !== undefined ? String(req.body.joiningDate) : undefined,
          employmentStatus: req.body?.employmentStatus !== undefined ? String(req.body.employmentStatus) : undefined,
          monthlyTarget: req.body?.monthlyTarget !== undefined ? Math.max(0, Number(req.body.monthlyTarget) || 0) : undefined,
          yearlyTarget: req.body?.yearlyTarget !== undefined ? Math.max(0, Number(req.body.yearlyTarget) || 0) : undefined,
          commissionPlanId: req.body?.commissionPlanId !== undefined ? String(req.body.commissionPlanId) : undefined,
          commissionPlanName: req.body?.commissionPlanName !== undefined ? String(req.body.commissionPlanName) : undefined,
          accountStatus: req.body?.accountStatus ? String(req.body.accountStatus) : undefined,
          payoutDetails: req.body?.payoutDetails !== undefined ? req.body.payoutDetails : undefined,
          updatedAt: now,
        });

        await restCommitWrites(
          [{ type: 'update', pathSegments: ['salesMembers', rawMemberId], data: patch }],
          verifiedUser.idToken
        );

        if (existingData?.referralCode && (patch.accountStatus !== undefined || patch.fullName !== undefined)) {
          await restSetDoc(
            ['salesReferralIndex', String(existingData.referralCode)],
            {
              referralCode: existingData.referralCode,
              salesmanId: rawMemberId,
              salesmanUid: existingData.uid || null,
              salesmanName: patch.fullName || existingData.fullName,
              accountStatus: patch.accountStatus || existingData.accountStatus,
              qrScanCount: existingData.qrScanCount || 0,
              updatedAt: now,
            },
            verifiedUser.idToken,
            true
          ).catch(() => {});
        }

        const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
        await restSetDoc(
          ['salesAuditLogs', slogId],
          {
            id: slogId,
            actorUid: verifiedUser.uid,
            actorEmail: verifiedUser.email,
            actorRole: 'super_admin',
            action: 'Updated Sales Member Profile/Role',
            entityType: 'sales_member',
            entityId: rawMemberId,
            previousValue: String(prevRole || ''),
            newValue: requestedRole,
            details: `Super Admin updated ${rawMemberId} (${requestedRole})`,
            createdAt: now,
          },
          verifiedUser.idToken
        ).catch(() => {});

        return res.json({ ok: true, mode: 'updated', memberId: rawMemberId, role: requestedRole });
      }

      // CREATE NEW SALES MEMBER
      const cleanFullName = String(req.body?.fullName || '').trim();
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      const cleanPhone = String(req.body?.phone || '').trim();
      const cleanCity = String(req.body?.city || 'Karachi').trim() || 'Karachi';

      if (!cleanFullName || cleanFullName.length < 2) {
        return res.status(400).json({ error: 'Full name is required (at least 2 characters).' });
      }
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'A valid email address is required.' });
      }
      if (cleanEmail === SUPER_ADMIN_EMAIL) {
        return res.status(403).json({
          error: 'Security Policy Violation: the Super Admin account cannot be registered as a sales member.',
        });
      }
      if (!cleanPhone || normalizePhoneServer(cleanPhone).length < 10) {
        return res.status(400).json({ error: 'A valid mobile phone number is required.' });
      }

      const existingMembers = await restListCollection<Record<string, any>>(['salesMembers'], verifiedUser.idToken);
      if (existingMembers.some((m) => String(m.email || '').trim().toLowerCase() === cleanEmail)) {
        return res.status(409).json({ error: `A sales account with email ${cleanEmail} already exists.` });
      }
      const normalizedIncomingPhone = normalizePhoneServer(cleanPhone);
      if (existingMembers.some((m) => normalizePhoneServer(m.phone) === normalizedIncomingPhone)) {
        return res.status(409).json({ error: `A sales account with phone number ${cleanPhone} already exists.` });
      }

      // Resolve authoritative manager metadata if assignedManagerId provided
      const assignedManagerId = req.body?.assignedManagerId ? sanitizeDocId(req.body.assignedManagerId) : undefined;
      const managerRecord = assignedManagerId ? existingMembers.find((m) => m.id === assignedManagerId) : undefined;
      const resolvedManagerUid = managerRecord?.uid || req.body?.assignedManagerUid || undefined;
      const resolvedManagerName = managerRecord?.fullName || req.body?.assignedManagerName || undefined;

      const settings = await restGetDoc<Record<string, any>>(['salesSettings', 'general'], verifiedUser.idToken).catch(
        () => null
      );
      const portalBaseUrl = String(settings?.portalBaseUrl || 'https://sbkhush.com').replace(/\/+$/, '');

      const existingIds = new Set(existingMembers.map((m) => String(m.employeeId || '').toUpperCase()));
      let seq = existingMembers.length + 1;
      let employeeId = `SBK-SLS-${String(seq).padStart(3, '0')}`;
      while (existingIds.has(employeeId) && seq < 99999) {
        seq++;
        employeeId = `SBK-SLS-${String(seq).padStart(3, '0')}`;
      }

      const existingCodes = new Set(existingMembers.map((m) => String(m.referralCode || '').toUpperCase()));
      const prefixName = cleanFullName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'REP';
      let referralCode = `SAL-${prefixName}-${Math.floor(1000 + Math.random() * 9000)}`;
      for (let i = 0; i < 20; i++) {
        if (!existingCodes.has(referralCode)) {
          const indexClash = await restGetDoc(['salesReferralIndex', referralCode], verifiedUser.idToken).catch(
            () => null
          );
          if (!indexClash) break;
        }
        referralCode = `SAL-${prefixName}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      const referralLink = `${portalBaseUrl}/r/${encodeURIComponent(referralCode)}`;

      let provisionedUid: string | undefined;
      let authProvisioned = false;
      let resetEmailSent = false;
      let resetEmailWarning: string | undefined;

      if (req.body?.sendPasswordResetInvite && firebaseConfig.apiKey) {
        try {
          const signUpRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: cleanEmail,
                password: crypto.randomBytes(20).toString('hex'),
                displayName: cleanFullName,
                returnSecureToken: true,
              }),
            }
          );
          const signUpData = (await signUpRes.json().catch(() => ({}))) as any;
          if (signUpRes.ok && signUpData?.localId) {
            provisionedUid = String(signUpData.localId);
            createdAuthIdToken = signUpData?.idToken ? String(signUpData.idToken) : null;
            authProvisioned = true;
          } else if (signUpData?.error?.message === 'EMAIL_EXISTS') {
            authProvisioned = true;
          } else {
            resetEmailWarning = `Auth provisioning note (${signUpData?.error?.message || signUpRes.status}).`;
          }

          if (authProvisioned) {
            const resetRes = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  requestType: 'PASSWORD_RESET',
                  email: cleanEmail,
                }),
              }
            );
            if (resetRes.ok) {
              resetEmailSent = true;
            } else {
              const resetErr = (await resetRes.json().catch(() => ({}))) as any;
              resetEmailWarning = resetErr?.error?.message || 'Invite email dispatch returned an error.';
            }
          }
        } catch (authErr: any) {
          resetEmailWarning = authErr?.message || 'Could not reach Firebase Auth invite service.';
        }
      }

      const id = `sm_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const memberPayload = stripUndefined({
        id,
        uid: provisionedUid,
        employeeId,
        fullName: cleanFullName,
        email: cleanEmail,
        phone: cleanPhone,
        city: cleanCity,
        address: req.body?.address ? String(req.body.address).trim() : undefined,
        profilePicture: req.body?.profilePicture ? String(req.body.profilePicture).trim() : undefined,
        role: requestedRole,
        assignedManagerId,
        assignedManagerUid: resolvedManagerUid,
        assignedManagerName: resolvedManagerName,
        teamId: req.body?.teamId || undefined,
        teamName: req.body?.teamName || undefined,
        territory: String(req.body?.territory || cleanCity).trim(),
        industryFocus: req.body?.industryFocus || 'all',
        joiningDate: req.body?.joiningDate || now.slice(0, 10),
        employmentStatus: req.body?.employmentStatus || 'full_time',
        monthlyTarget: Math.max(0, Number(req.body?.monthlyTarget) || 0),
        yearlyTarget: Math.max(0, Number(req.body?.yearlyTarget) || 0),
        commissionPlanId: String(req.body?.commissionPlanId || 'tier-standard'),
        commissionPlanName: String(req.body?.commissionPlanName || 'Standard Commission'),
        accountStatus: String(req.body?.accountStatus || 'invited'),
        referralCode,
        referralLink,
        qrScanCount: 0,
        payoutDetails: req.body?.payoutDetails,
        inviteStatus: 'pending',
        invitedAt: now,
        createdBy: verifiedUser.email || 'Super Admin',
        createdAt: now,
        updatedAt: now,
      });

      try {
        await restCommitWrites(
          [
            { type: 'create', pathSegments: ['salesMembers', id], data: memberPayload },
            {
              type: 'set',
              pathSegments: ['salesReferralIndex', referralCode],
              data: {
                referralCode,
                salesmanId: id,
                salesmanUid: provisionedUid || null,
                salesmanName: cleanFullName,
                accountStatus: memberPayload.accountStatus,
                qrScanCount: 0,
                updatedAt: now,
              },
            },
          ],
          verifiedUser.idToken
        );
      } catch (commitErr) {
        // Roll back newly provisioned Auth account if Firestore write fails so retry doesn't leave an orphan
        if (createdAuthIdToken && firebaseConfig.apiKey) {
          await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: createdAuthIdToken }),
            }
          ).catch(() => {});
        }
        throw commitErr;
      }

      const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await restSetDoc(
        ['salesAuditLogs', slogId],
        {
          id: slogId,
          actorUid: verifiedUser.uid,
          actorEmail: verifiedUser.email,
          actorRole: 'super_admin',
          action: 'Created Salesman Account',
          entityType: 'sales_member',
          entityId: id,
          newValue: requestedRole,
          details: `Created ${cleanFullName} (${employeeId}, ${requestedRole}) · Referral Code: ${referralCode}`,
          createdAt: now,
        },
        verifiedUser.idToken
      ).catch(() => {});

      return res.json({
        ok: true,
        mode: 'created',
        member: memberPayload,
        authProvisioned,
        resetEmailSent,
        resetEmailWarning,
      });
    } catch (err: any) {
      return res.status(err?.status || 500).json({ error: err?.message || 'Failed to save sales member.' });
    }
  });

  // Sales Manager ONLY (or Super Admin): Assign leads strictly within own assigned team
  app.post('/api/sales-manager/leads/assign', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const { role } = await resolveTrustedServerRole(verifiedUser);
    if (role !== 'sales_manager' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden: Sales Manager or Super Admin privileges required.' });
    }
    try {
      const leadIds: string[] = Array.isArray(req.body?.leadIds)
        ? req.body.leadIds.map((id: unknown) => sanitizeDocId(id)).filter(Boolean)
        : [];
      const targetSalesmanId = sanitizeDocId(req.body?.targetSalesmanId);
      if (leadIds.length === 0 || !targetSalesmanId) {
        return res.status(400).json({ error: 'Valid leadIds and targetSalesmanId are required.' });
      }

      const targetRep = await restGetDoc<Record<string, any>>(['salesMembers', targetSalesmanId], verifiedUser.idToken);
      if (!targetRep) {
        return res.status(404).json({ error: 'Target representative not found.' });
      }
      if (role !== 'super_admin' && targetRep.assignedManagerUid !== verifiedUser.uid) {
        return res.status(403).json({
          error: 'Forbidden: Sales Managers can only assign leads to representatives in their own authorized team.',
        });
      }

      const leadMetas = await Promise.all(
        leadIds.map((lid) => restGetDocWithMeta<Record<string, any>>(['salesLeads', lid], verifiedUser.idToken))
      );

      for (let i = 0; i < leadIds.length; i++) {
        const lid = leadIds[i];
        const meta = leadMetas[i];
        if (!meta) {
          return res.status(404).json({ error: `Lead ${lid} not found.` });
        }
        if (role !== 'super_admin' && meta.data.assignedManagerUid && meta.data.assignedManagerUid !== verifiedUser.uid) {
          return res.status(403).json({
            error: `Forbidden: Lead ${lid} belongs to another manager team and cannot be accessed or reassigned.`,
          });
        }
      }

      const now = new Date().toISOString();
      await restCommitWrites(
        leadIds.map((lid, idx) => ({
          type: 'update' as const,
          pathSegments: ['salesLeads', lid],
          data: {
            assignedSalesmanId: targetRep.id,
            assignedSalesmanUid: targetRep.uid || null,
            assignedSalesmanName: targetRep.fullName,
            assignedManagerId: targetRep.assignedManagerId || null,
            assignedManagerUid: targetRep.assignedManagerUid || verifiedUser.uid,
            status: 'Assigned',
            updatedAt: now,
          },
          expectedUpdateTime: leadMetas[idx]!.updateTime,
        })),
        verifiedUser.idToken
      );

      const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await restSetDoc(
        ['salesAuditLogs', slogId],
        {
          id: slogId,
          actorUid: verifiedUser.uid,
          actorEmail: verifiedUser.email,
          actorRole: role === 'super_admin' ? 'super_admin' : 'sales_manager',
          action: 'Manager Assigned Team Leads',
          entityType: 'sales_lead',
          entityId: targetRep.id,
          details: `Assigned ${leadIds.length} lead(s) within authorized team to ${targetRep.fullName}`,
          createdAt: now,
        },
        verifiedUser.idToken
      ).catch(() => {});

      return res.json({ ok: true, assignedCount: leadIds.length });
    } catch (err: any) {
      return res.status(err?.status || 500).json({ error: err?.message || 'Team lead assignment failed.' });
    }
  });

  // Sales Manager ONLY: Recommend performance bonus for team member (pending Super Admin approval)
  app.post('/api/sales-manager/bonus-recommendations', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const { role, salesMember: managerMember } = await resolveTrustedServerRole(verifiedUser);
    if (role !== 'sales_manager' || !managerMember) {
      return res.status(403).json({ error: 'Forbidden: active Sales Manager role required.' });
    }
    try {
      const salesmanId = sanitizeDocId(req.body?.salesmanId);
      const amount = Number(req.body?.recommendedAmount || 0);
      const periodKey = String(req.body?.periodKey || new Date().toISOString().slice(0, 7)).trim();
      const reason = String(req.body?.reason || '').trim();
      if (!salesmanId || !Number.isFinite(amount) || amount <= 0 || reason.length < 5) {
        return res.status(400).json({ error: 'Valid team rep, positive bonus amount, and justification are required.' });
      }
      if (req.body?.status && req.body.status !== 'pending') {
        return res.status(403).json({
          error: 'Forbidden: managers cannot self-approve bonuses; Super Admin approval is required.',
        });
      }

      const targetRep = await restGetDoc<Record<string, any>>(['salesMembers', salesmanId], verifiedUser.idToken);
      if (!targetRep) return res.status(404).json({ error: 'Representative not found.' });
      if (targetRep.assignedManagerUid !== verifiedUser.uid || targetRep.uid === verifiedUser.uid) {
        return res.status(403).json({
          error: 'Forbidden: can only recommend bonuses for reps assigned to your own team.',
        });
      }

      const now = new Date().toISOString();
      const recId = `bon_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const payload = stripUndefined({
        id: recId,
        managerId: managerMember.id,
        managerUid: verifiedUser.uid,
        managerName: managerMember.fullName,
        salesmanId: targetRep.id,
        salesmanUid: targetRep.uid || undefined,
        salesmanName: targetRep.fullName,
        recommendedAmount: Math.round(amount),
        periodKey,
        reason,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
      await restSetDoc(['salesBonusRecommendations', recId], payload, verifiedUser.idToken);

      const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await restSetDoc(
        ['salesAuditLogs', slogId],
        {
          id: slogId,
          actorUid: verifiedUser.uid,
          actorEmail: verifiedUser.email,
          actorRole: 'sales_manager',
          action: 'Recommended Team Bonus',
          entityType: 'bonus_recommendation',
          entityId: recId,
          details: `Recommended Rs. ${Math.round(amount)} bonus for ${targetRep.fullName} (${periodKey}) — pending Super Admin approval`,
          createdAt: now,
        },
        verifiedUser.idToken
      ).catch(() => {});

      return res.status(201).json({ recommendation: payload });
    } catch (err: any) {
      return res.status(err?.status || 500).json({ error: err?.message || 'Failed to submit bonus recommendation.' });
    }
  });

  // Super Admin ONLY: Approve or reject manager bonus recommendation
  app.post('/api/super-admin/sales/bonus-recommendations/decision', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser || !(await isAuthorizedSuperAdmin(verifiedUser))) {
      return res.status(403).json({ error: 'Forbidden: Super Admin authentication required.' });
    }
    try {
      const recId = sanitizeDocId(req.body?.recId);
      const decision = String(req.body?.decision || '');
      const reason = String(req.body?.reason || '').trim();
      if (!recId || !['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'Valid recId and decision (approved/rejected) required.' });
      }

      const recMeta = await restGetDocWithMeta<Record<string, any>>(
        ['salesBonusRecommendations', recId],
        verifiedUser.idToken
      );
      if (!recMeta) return res.status(404).json({ error: 'Recommendation not found.' });
      const cur = recMeta.data;
      if (cur.status !== 'pending') {
        return res.status(400).json({ error: `Recommendation already ${cur.status}.` });
      }

      const now = new Date().toISOString();
      const patch: Record<string, any> = {
        status: decision,
        reviewedBy: verifiedUser.email,
        reviewedAt: now,
        updatedAt: now,
      };
      const ops: Parameters<typeof restCommitWrites>[0] = [];

      if (decision === 'rejected') {
        patch.rejectionReason = reason || 'Declined by Super Admin.';
      } else {
        const ledgerId = `comm_bon_${recId}`;
        patch.commissionLedgerId = ledgerId;
        ops.push({
          type: 'create',
          pathSegments: ['commissionLedger', ledgerId],
          data: stripUndefined({
            id: ledgerId,
            salesmanId: cur.salesmanId,
            salesmanUid: cur.salesmanUid,
            salesmanName: cur.salesmanName,
            shopId: `bonus_${cur.periodKey}`,
            shopName: `Performance Bonus (${cur.periodKey})`,
            paymentId: recId,
            planId: 'performance_bonus',
            planName: `Bonus (${cur.managerName})`,
            billingCycle: 'monthly',
            paymentAmount: 0,
            commissionRatePct: 0,
            flatBonusAmount: cur.recommendedAmount,
            commissionAmount: cur.recommendedAmount,
            commissionType: 'target_bonus',
            status: 'approved',
            approvedBy: verifiedUser.email,
            approvedAt: now,
            createdAt: now,
            updatedAt: now,
          }),
        });
      }

      ops.push({
        type: 'update',
        pathSegments: ['salesBonusRecommendations', recId],
        data: patch,
        expectedUpdateTime: recMeta.updateTime,
      });

      await restCommitWrites(ops, verifiedUser.idToken);

      const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await restSetDoc(
        ['salesAuditLogs', slogId],
        {
          id: slogId,
          actorUid: verifiedUser.uid,
          actorEmail: verifiedUser.email,
          actorRole: 'super_admin',
          action: `Bonus Recommendation ${decision}`,
          entityType: 'bonus_recommendation',
          entityId: recId,
          details: `${decision.toUpperCase()} bonus recommendation ${recId}`,
          createdAt: now,
        },
        verifiedUser.idToken
      ).catch(() => {});

      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(err?.status || 400).json({ error: err?.message || 'Bonus decision failed.' });
    }
  });

  // Salesman / Manager ONLY: Submit own authorized business expense (always forced pending; zero self-approval)
  app.post('/api/salesman/expenses', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const { role, salesMember } = await resolveTrustedServerRole(verifiedUser);
    if ((role !== 'salesman' && role !== 'sales_manager') || !salesMember) {
      return res.status(403).json({ error: 'Forbidden: active sales representative account required.' });
    }
    try {
      if (req.body?.status && req.body.status !== 'pending') {
        return res.status(403).json({ error: 'Forbidden: salesmen cannot self-approve business expenses.' });
      }
      if (req.body?.salesmanUid && req.body.salesmanUid !== verifiedUser.uid) {
        return res.status(403).json({ error: 'Forbidden: cannot submit expense under another representative UID.' });
      }
      const amount = Number(req.body?.amount || 0);
      const description = String(req.body?.description || '').trim();
      const category = String(req.body?.category || 'travel');
      if (!Number.isFinite(amount) || amount <= 0 || !description) {
        return res.status(400).json({ error: 'Positive amount and description are required.' });
      }

      const now = new Date().toISOString();
      const expId = `exp_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const payload = stripUndefined({
        id: expId,
        salesmanId: salesMember.id,
        salesmanUid: verifiedUser.uid,
        salesmanName: salesMember.fullName,
        managerUid: salesMember.assignedManagerUid || undefined,
        category,
        amount: Math.round(amount),
        expenseDate: String(req.body?.expenseDate || now.slice(0, 10)),
        description,
        receiptUrl: req.body?.receiptUrl ? String(req.body.receiptUrl) : undefined,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      await restSetDoc(['salesExpenses', expId], payload, verifiedUser.idToken);
      return res.status(201).json({ expense: payload });
    } catch (err: any) {
      return res.status(err?.status || 500).json({ error: err?.message || 'Failed to submit expense.' });
    }
  });

  // Super Admin ONLY: Approve or reject submitted business expenses
  app.post('/api/super-admin/sales/expenses/decision', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser || !(await isAuthorizedSuperAdmin(verifiedUser))) {
      return res.status(403).json({ error: 'Forbidden: Super Admin authentication required.' });
    }
    try {
      const expenseId = sanitizeDocId(req.body?.expenseId);
      const decision = String(req.body?.decision || '');
      const reason = String(req.body?.reason || '').trim();
      if (!expenseId || !['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'Valid expenseId and decision required.' });
      }

      const expMeta = await restGetDocWithMeta<Record<string, any>>(['salesExpenses', expenseId], verifiedUser.idToken);
      if (!expMeta) return res.status(404).json({ error: 'Expense not found.' });
      if (expMeta.data.status !== 'pending') {
        return res.status(400).json({ error: `Expense already ${expMeta.data.status}.` });
      }

      const now = new Date().toISOString();
      await restCommitWrites(
        [
          {
            type: 'update',
            pathSegments: ['salesExpenses', expenseId],
            data: stripUndefined({
              status: decision,
              rejectionReason: decision === 'rejected' ? reason || 'Rejected by Super Admin.' : undefined,
              reviewedBy: verifiedUser.email,
              reviewedAt: now,
              updatedAt: now,
            }),
            expectedUpdateTime: expMeta.updateTime,
          },
        ],
        verifiedUser.idToken
      );

      const slogId = `slog_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      await restSetDoc(
        ['salesAuditLogs', slogId],
        {
          id: slogId,
          actorUid: verifiedUser.uid,
          actorEmail: verifiedUser.email,
          actorRole: 'super_admin',
          action: `Expense ${decision}`,
          entityType: 'sales_expense',
          entityId: expenseId,
          details: `${decision.toUpperCase()} expense ${expenseId}`,
          createdAt: now,
        },
        verifiedUser.idToken
      ).catch(() => {});
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(err?.status || 400).json({ error: err?.message || 'Expense decision failed.' });
    }
  });

  // Role-scoped portal summary API (zero cross-role or cross-user data leakage)
  app.get('/api/sales/portal/summary', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const { role, salesMember } = await resolveTrustedServerRole(verifiedUser);
    if (!['super_admin', 'sales_manager', 'salesman', 'referral_agent'].includes(role)) {
      return res.status(403).json({ error: 'Forbidden: Shop owners and customers cannot access sales portal APIs.' });
    }
    try {
      if (role === 'referral_agent' && salesMember) {
        const [referrals, comms] = await Promise.all([
          restQueryWhereEqual('referralAttributions', 'salesmanUid', verifiedUser.uid, verifiedUser.idToken),
          restQueryWhereEqual('commissionLedger', 'salesmanUid', verifiedUser.uid, verifiedUser.idToken),
        ]);
        return res.json({
          role: 'referral_agent',
          referrals,
          rewards: comms.filter((c: any) => c.status === 'approved' || c.status === 'paid'),
        });
      }
      if (role === 'salesman' && salesMember) {
        const [leads, referrals, commissions, expenses] = await Promise.all([
          restQueryWhereEqual('salesLeads', 'assignedSalesmanUid', verifiedUser.uid, verifiedUser.idToken),
          restQueryWhereEqual('referralAttributions', 'salesmanUid', verifiedUser.uid, verifiedUser.idToken),
          restQueryWhereEqual('commissionLedger', 'salesmanUid', verifiedUser.uid, verifiedUser.idToken),
          restQueryWhereEqual('salesExpenses', 'salesmanUid', verifiedUser.uid, verifiedUser.idToken),
        ]);
        return res.json({
          role: 'salesman',
          leads,
          referrals,
          commissions,
          expenses,
        });
      }
      if (role === 'sales_manager' && salesMember) {
        const [teamMembers, teamLeads] = await Promise.all([
          restQueryWhereEqual('salesMembers', 'assignedManagerUid', verifiedUser.uid, verifiedUser.idToken),
          restQueryWhereEqual('salesLeads', 'assignedManagerUid', verifiedUser.uid, verifiedUser.idToken),
        ]);
        return res.json({
          role: 'sales_manager',
          teamMembers,
          teamLeads,
        });
      }
      return res.json({ role: 'super_admin' });
    } catch (err: any) {
      return res.status(err?.status || 500).json({ error: err?.message || 'Failed to load scoped summary.' });
    }
  });

  const DUPLICATE_CNIC_MSG =
    'This CNIC is already associated with a registered SB Khush shop. Only one shop can be registered against one CNIC. Please contact SB Khush Support if you believe this is an error.';
  const CNIC_AUDIT_BLOCK_MSG =
    'Your existing SB Khush shop account has a pending CNIC verification audit. Please contact SB Khush Support or complete CNIC verification before registering another store.';

  const normalizeCnicServer = (raw: unknown): string =>
    String(raw || '')
      .replace(/\D/g, '')
      .slice(0, 13);

  const isValidCnicServer = (digits: string): boolean =>
    /^\d{13}$/.test(digits) && !/^(\d)\1{12}$/.test(digits);

  const maskCnicServer = (digits: string): string =>
    digits.length === 13 ? `XXXXX-XXXX${digits.slice(9, 12)}-${digits.slice(12, 13)}` : '';

  const computeServerCnicHmac = (normalizedCnic: string): string => {
    const configuredSecret = String(process.env.CNIC_HMAC_SECRET || '').trim();
    if (!configuredSecret && process.env.NODE_ENV === 'production') {
      const err = new Error('Server CNIC verification secret (CNIC_HMAC_SECRET) is not configured.') as Error & {
        status?: number;
      };
      err.status = 500;
      throw err;
    }
    const secret = configuredSecret || 'dev-local-cnic-hmac-fallback';
    return crypto.createHmac('sha256', secret).update(normalizedCnic).digest('hex');
  };

  // Global One-CNIC-One-Shop Atomic Registration Endpoint
  app.post('/api/shops/register', async (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(clientIp, 'shop-register', 15, 60_000)) {
      return res.status(429).json({ error: 'Too many registration requests. Please wait a minute and try again.' });
    }

    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Authentication required to register a shop.' });
    }

    try {
      const body = req.body || {};
      const shopName = String(body.shopName || '').trim();
      const rawSlug = String(body.shopSlug || '').trim();
      const ownerName = String(body.ownerName || '').trim();
      const ownerEmail = String(body.ownerEmail || verifiedUser.email || '').trim();
      const ownerPhone = String(body.ownerPhone || '').trim();
      const city = String(body.city || '').trim();
      const address = String(body.address || '').trim();
      const normalizedCnic = normalizeCnicServer(body.cnic);

      if (!shopName || !rawSlug || !ownerName || !ownerEmail || !ownerPhone || !city || !address) {
        return res.status(400).json({ error: 'All required shop, owner, and location fields must be provided.' });
      }
      if (!isValidCnicServer(normalizedCnic)) {
        return res.status(400).json({ error: 'Please enter a valid 13-digit Pakistani CNIC (XXXXX-XXXXXXX-X).' });
      }

      const cleanSlug = sanitizeShopSlug(rawSlug);
      if (!isValidShopSlug(cleanSlug)) {
        return res.status(400).json({ error: 'Invalid or reserved shop URL slug.' });
      }

      // Legacy owner safeguard: block accounts owning an existing shop without verified CNIC
      const existingOwnedShops = await restQueryWhereEqual<Record<string, any>>(
        'shops',
        'ownerId',
        verifiedUser.uid,
        verifiedUser.idToken
      ).catch(() => []);
      const legacyPending = existingOwnedShops.find(
        (s) => s.status !== 'deleted' && !s.cnicHash && s.cnicVerified !== true
      );
      if (legacyPending) {
        return res.status(403).json({ error: CNIC_AUDIT_BLOCK_MSG });
      }

      const cnicHash = computeServerCnicHmac(normalizedCnic);
      const cnicMasked = maskCnicServer(normalizedCnic);
      const cnicLast4 = normalizedCnic.slice(-4);
      const shopId = cleanSlug;
      const now = new Date();
      const nowIso = now.toISOString();
      const freePlan = DEFAULT_SUBSCRIPTION_PLANS[0];
      const expiryDate = new Date(
        now.getTime() + (freePlan.durationDays || 36500) * 24 * 60 * 60 * 1000
      ).toISOString();
      const businessType =
        body.businessType === 'cosmetics' ||
        body.businessType === 'clothing' ||
        body.businessType === 'other_retail'
          ? body.businessType
          : 'general_store';

      const newShop = stripUndefined({
        id: shopId,
        slug: cleanSlug,
        name: shopName,
        businessType,
        ownerId: verifiedUser.uid,
        ownerName,
        ownerEmail,
        ownerPhone,
        city,
        address,
        cnicHash,
        cnicMasked,
        cnicLast4,
        cnicVerified: true,
        cnicStatus: 'verified',
        cnicUpdatedAt: nowIso,
        logoUrl: '',
        status: 'active',
        subscription: {
          planId: freePlan.id,
          planName: freePlan.name,
          status: 'active',
          billingCycle: 'monthly',
          pricePaid: 0,
          startDate: nowIso,
          expiryDate,
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
          heroSubtitle:
            'Authentic curated essentials delivered across Pakistan with Cash on Delivery & Self-Pickup.',
          showTestimonials: true,
          showBuyingGuide: freePlan.features.buyingGuide,
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
      });

      const newPublicShop = stripUndefined({
        id: shopId,
        slug: cleanSlug,
        name: shopName,
        businessType,
        logoUrl: '',
        city,
        publicContactPhone: ownerPhone,
        publicSupportEmail: ownerEmail,
        storefrontAddress: `${address}, ${city}`,
        status: 'active',
        theme: newShop.theme,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const cnicRegistryPayload = {
        hmacKey: cnicHash,
        cnicLast4,
        cnicMasked,
        shopId,
        shopSlug: cleanSlug,
        shopName,
        ownerId: verifiedUser.uid,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const ownerStaffPayload = {
        uid: verifiedUser.uid,
        email: ownerEmail,
        name: ownerName,
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
          'pos',
          'suppliers',
          'purchases',
          'khata',
        ],
        status: 'active',
        createdAt: nowIso,
      };

      const membershipPayload = {
        shopId,
        shopName,
        shopSlug: cleanSlug,
        role: 'shop_owner',
        joinedAt: nowIso,
      };

      const fullSettings = {
        ...INITIAL_SETTINGS,
        siteName: shopName,
        contactPhone: ownerPhone,
        whatsappNumber: ownerPhone,
        contactEmail: ownerEmail,
        address: `${address}, ${city}`,
        city,
        bankDetails: { ...INITIAL_SETTINGS.bankDetails, accountTitle: shopName },
        easypaisaDetails: {
          ...INITIAL_SETTINGS.easypaisaDetails,
          accountTitle: shopName,
          accountNumber: ownerPhone,
        },
        jazzcashDetails: {
          ...INITIAL_SETTINGS.jazzcashDetails,
          accountTitle: shopName,
          accountNumber: ownerPhone,
        },
        selfPickupDetails: {
          ...INITIAL_SETTINGS.selfPickupDetails,
          title: `${shopName} Outlet (${city})`,
          address,
          city,
          contactPhone: ownerPhone,
        },
      };

      const publicSettingsPayload = stripUndefined({
        siteName: fullSettings.siteName,
        logoUrl: fullSettings.logoUrl,
        primaryColor: fullSettings.primaryColor,
        accentColor: fullSettings.accentColor,
        announcement: fullSettings.announcement,
        contactPhone: fullSettings.contactPhone,
        whatsappNumber: fullSettings.whatsappNumber,
        contactEmail: fullSettings.contactEmail,
        address: fullSettings.address,
        city: fullSettings.city,
        shippingFee: fullSettings.shippingFee,
        freeShippingThreshold: fullSettings.freeShippingThreshold,
        currency: fullSettings.currency,
        currencySymbol: fullSettings.currencySymbol,
        aboutUs: fullSettings.aboutUs,
        selfPickupDetails: fullSettings.selfPickupDetails,
        socialLinks: fullSettings.socialLinks,
        easypaisaDetails: { enabled: false, accountTitle: '', accountNumber: '' },
        jazzcashDetails: { enabled: false, accountTitle: '', accountNumber: '' },
        bankDetails: fullSettings.bankDetails,
        updatedAt: nowIso,
      });

      const privateSettingsPayload = stripUndefined({
        bankDetails: fullSettings.bankDetails,
        easypaisaDetails: fullSettings.easypaisaDetails,
        jazzcashDetails: fullSettings.jazzcashDetails,
        ownerBillingEmail: ownerEmail,
        ownerPrivatePhone: ownerPhone,
        updatedAt: nowIso,
      });

      const defaultCats = getDefaultCategoriesForBusinessType(businessType);

      // Atomic Firestore REST commit with exists=false preconditions on BOTH cnic_registry and shop_slugs
      try {
        await restCommitWrites(
          [
            {
              type: 'create',
              pathSegments: ['cnic_registry', cnicHash],
              data: cnicRegistryPayload,
            },
            {
              type: 'create',
              pathSegments: ['shop_slugs', cleanSlug],
              data: {
                slug: cleanSlug,
                shopId,
                ownerId: verifiedUser.uid,
                name: shopName,
                createdAt: nowIso,
              },
            },
            {
              type: 'create',
              pathSegments: ['shops', shopId],
              data: newShop,
            },
            {
              type: 'set',
              pathSegments: ['shops_public', shopId],
              data: newPublicShop,
            },
            {
              type: 'set',
              pathSegments: ['shops', shopId, 'staff', verifiedUser.uid],
              data: ownerStaffPayload,
            },
            {
              type: 'set',
              pathSegments: ['users', verifiedUser.uid, 'shopMemberships', shopId],
              data: membershipPayload,
            },
            {
              type: 'set',
              pathSegments: ['shops', shopId, 'settings', 'public'],
              data: publicSettingsPayload,
            },
            {
              type: 'set',
              pathSegments: ['shops', shopId, 'settings', 'private'],
              data: privateSettingsPayload,
            },
            ...defaultCats.map((cat) => {
              const catId = `cat_${cat.slug}`;
              return {
                type: 'set' as const,
                pathSegments: ['shops', shopId, 'categories', catId],
                data: stripUndefined({ ...cat, id: catId, shopId }),
              };
            }),
          ],
          verifiedUser.idToken
        );
      } catch (commitErr: any) {
        const msg = String(commitErr?.message || '');
        if (commitErr?.status === 409 || /already exists|ALREADY_EXISTS|FAILED_PRECONDITION/i.test(msg)) {
          // Disambiguate slug collision vs CNIC collision via slug check (cnic_registry is unreadable by non-SuperAdmin)
          const existingSlug = await restGetDoc(['shop_slugs', cleanSlug], verifiedUser.idToken).catch(() => null);
          if (existingSlug) {
            return res.status(409).json({
              code: 'SLUG_TAKEN',
              error: `Store URL slug "${cleanSlug}" is already taken.`,
            });
          }
          return res.status(409).json({
            code: 'DUPLICATE_CNIC',
            error: DUPLICATE_CNIC_MSG,
          });
        }
        throw commitErr;
      }

      return res.json({ shop: newShop });
    } catch (err: any) {
      return res.status(err?.status || 500).json({
        error: err?.message || 'Failed to register shop with CNIC verification.',
      });
    }
  });

  // Super Admin Audited CNIC Assignment / Correction / Release Endpoint
  app.post('/api/super-admin/cnic/manage', async (req, res) => {
    const verifiedUser = await verifyFirebaseIdToken(req.headers.authorization);
    if (!verifiedUser || !(await isAuthorizedSuperAdmin(verifiedUser))) {
      return res.status(403).json({ error: 'Forbidden: Super Admin authentication required.' });
    }

    try {
      const shopId = sanitizeShopId(req.body?.shopId);
      const action = String(req.body?.action || '').trim();
      const reason = String(req.body?.reason || '').trim() || 'Super Admin CNIC audit action';

      if (!shopId || !['assign', 'release'].includes(action)) {
        return res.status(400).json({ error: 'Valid shopId and action (assign | release) are required.' });
      }

      const shopDoc = await restGetDoc<Record<string, any>>(['shops', shopId], verifiedUser.idToken);
      if (!shopDoc) {
        return res.status(404).json({ error: `Shop "${shopId}" not found.` });
      }

      const nowIso = new Date().toISOString();
      const oldHash = typeof shopDoc.cnicHash === 'string' ? shopDoc.cnicHash : '';
      const logId = `log_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;

      if (action === 'release') {
        if (!oldHash) {
          return res.status(400).json({ error: 'This shop has no bound CNIC to release.' });
        }
        await restCommitWrites(
          [
            { type: 'delete', pathSegments: ['cnic_registry', oldHash] },
            {
              type: 'update',
              pathSegments: ['shops', shopId],
              data: {
                cnicHash: null,
                cnicMasked: '',
                cnicLast4: '',
                cnicVerified: false,
                cnicStatus: 'released',
                cnicUpdatedAt: nowIso,
                updatedAt: nowIso,
              },
            },
            {
              type: 'set',
              pathSegments: ['platform_activity_logs', logId],
              data: {
                id: logId,
                actorId: verifiedUser.uid,
                actorEmail: verifiedUser.email,
                action: 'Released Shop CNIC Binding',
                targetType: 'shop',
                targetId: shopId,
                details: `Released CNIC binding for shop ${shopId}. Reason: ${reason}`,
                createdAt: nowIso,
              },
            },
          ],
          verifiedUser.idToken
        );
        return res.json({ ok: true, cnicStatus: 'released', cnicMasked: '' });
      }

      const normalizedCnic = normalizeCnicServer(req.body?.cnic);
      if (!isValidCnicServer(normalizedCnic)) {
        return res.status(400).json({ error: 'Valid 13-digit Pakistani CNIC is required.' });
      }

      const newHash = computeServerCnicHmac(normalizedCnic);
      const masked = maskCnicServer(normalizedCnic);
      const last4 = normalizedCnic.slice(-4);

      const existingRegistry = await restGetDoc<Record<string, any>>(
        ['cnic_registry', newHash],
        verifiedUser.idToken
      ).catch(() => null);
      if (existingRegistry && existingRegistry.shopId !== shopId) {
        return res.status(409).json({ code: 'DUPLICATE_CNIC', error: DUPLICATE_CNIC_MSG });
      }

      const ops: any[] = [];
      if (oldHash && oldHash !== newHash) {
        ops.push({ type: 'delete', pathSegments: ['cnic_registry', oldHash] });
      }
      ops.push(
        {
          type: 'set',
          pathSegments: ['cnic_registry', newHash],
          data: {
            hmacKey: newHash,
            cnicLast4: last4,
            cnicMasked: masked,
            shopId,
            shopSlug: shopDoc.slug || shopId,
            shopName: shopDoc.name || shopId,
            ownerId: shopDoc.ownerId || '',
            status: 'active',
            createdAt: existingRegistry?.createdAt || nowIso,
            updatedAt: nowIso,
            assignedBySuperAdmin: verifiedUser.email,
            auditReason: reason,
          },
        },
        {
          type: 'update',
          pathSegments: ['shops', shopId],
          data: {
            cnicHash: newHash,
            cnicMasked: masked,
            cnicLast4: last4,
            cnicVerified: true,
            cnicStatus: 'verified',
            cnicUpdatedAt: nowIso,
            updatedAt: nowIso,
          },
        },
        {
          type: 'set',
          pathSegments: ['platform_activity_logs', logId],
          data: {
            id: logId,
            actorId: verifiedUser.uid,
            actorEmail: verifiedUser.email,
            action: 'Assigned Shop CNIC',
            targetType: 'shop',
            targetId: shopId,
            details: `Bound verified CNIC (${masked}) to shop ${shopId}. Reason: ${reason}`,
            createdAt: nowIso,
          },
        }
      );

      await restCommitWrites(ops, verifiedUser.idToken);
      return res.json({ ok: true, cnicStatus: 'verified', cnicMasked: masked });
    } catch (err: any) {
      return res.status(err?.status || 500).json({ error: err?.message || 'CNIC management failed.' });
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

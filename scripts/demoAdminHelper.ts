import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import firebaseConfig from '../firebase-applet-config.json';
import {
  DEMO_ACCOUNT_TYPE,
  DEMO_DATA_TAG,
  DEMO_ENV_ID,
  DEMO_ENV_ROOT,
} from '../src/demo/demoConfig';
import { buildDemoSeedDataset } from '../src/demo/demoSeedGenerator';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

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

export function loadFirebaseAdminModules(): {
  adminApp: any;
  adminAuth: any;
  adminFirestore: any;
  adminStorage: any;
} {
  const candidates = [
    'firebase-admin',
    path.resolve(__dirname, '../functions/node_modules/firebase-admin'),
  ];

  let appMod: any = null;
  let authMod: any = null;
  let firestoreMod: any = null;
  let storageMod: any = null;

  for (const base of candidates) {
    try {
      appMod = require(`${base}/app`);
      authMod = require(`${base}/auth`);
      firestoreMod = require(`${base}/firestore`);
      storageMod = require(`${base}/storage`);
      break;
    } catch {
      // Try next resolution candidate
    }
  }

  if (!appMod || !authMod || !firestoreMod || !storageMod) {
    throw new Error(
      'Unable to locate firebase-admin SDK. Install functions dependencies (`cd functions && npm install`) or install firebase-admin before running Admin CLI scripts.'
    );
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket;
  const databaseId = process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;

  const existingApps = appMod.getApps();
  const app =
    existingApps.length > 0
      ? existingApps[0]
      : appMod.initializeApp({
          credential: appMod.applicationDefault(),
          projectId,
          storageBucket,
        });

  return {
    adminApp: app,
    adminAuth: authMod.getAuth(app),
    adminFirestore: databaseId
      ? firestoreMod.getFirestore(app, databaseId)
      : firestoreMod.getFirestore(app),
    adminStorage: storageMod.getStorage(app),
  };
}

export async function clearAndSeedDemoEnvironmentCli(
  db: any,
  storage: any
): Promise<{
  writtenDocs: number;
  seededCounts: Record<string, number>;
}> {
  const demoRootRef = db.collection(DEMO_ENV_ROOT).doc(DEMO_ENV_ID);
  await db.recursiveDelete(demoRootRef);

  try {
    await storage.bucket().deleteFiles({ prefix: `${DEMO_ENV_ROOT}/${DEMO_ENV_ID}/` });
  } catch (err: any) {
    console.warn('[Demo Storage Cleanup Note]:', err?.message || err);
  }

  const dataset = buildDemoSeedDataset();
  const writeOps: Array<{ pathSegments: string[]; data: Record<string, any> }> = [];

  const pushSet = (segments: string[], data: Record<string, any>) => {
    writeOps.push({
      pathSegments: [DEMO_ENV_ROOT, DEMO_ENV_ID, ...segments],
      data: stripUndefined(data),
    });
  };

  writeOps.push({
    pathSegments: [DEMO_ENV_ROOT, DEMO_ENV_ID],
    data: {
      id: DEMO_ENV_ID,
      accountType: DEMO_ACCOUNT_TYPE,
      demoTag: DEMO_DATA_TAG,
      seededAt: dataset.generatedAt,
      shopCount: dataset.shopBundles.length,
      productCount: dataset.shopBundles.reduce((s, b) => s + b.products.length, 0),
      customerCount: dataset.shopBundles.reduce((s, b) => s + b.customers.length, 0),
      orderCount: dataset.shopBundles.reduce((s, b) => s + b.orders.length, 0),
      salesMemberCount: dataset.salesMembers.length,
      referralAgentCount: dataset.referralAgents.length,
    },
  });

  dataset.plans.forEach((p) => pushSet(['platform_plans', p.id], p));
  pushSet(['platform_settings', 'general'], dataset.platformSettings);
  pushSet(['salesSettings', 'general'], dataset.salesSettings);
  dataset.salesMembers.forEach((m) => pushSet(['salesMembers', m.id], m));
  dataset.referralAgents.forEach((a) => pushSet(['salesMembers', a.id], a));
  dataset.salesReferralIndex.forEach((idx) => pushSet(['salesReferralIndex', idx.referralCode], idx));
  dataset.salesTeams.forEach((t) => pushSet(['salesTeams', t.id], t));
  dataset.salesLeads.forEach((l) => pushSet(['salesLeads', l.id], l));
  dataset.salesTargets.forEach((t) => pushSet(['salesTargets', t.id], t));
  dataset.salesActivities.forEach((a) => pushSet(['salesActivities', a.id], a));
  dataset.salesQrEvents.forEach((q) => pushSet(['salesQrEvents', q.id], q));
  dataset.salesAuditLogs.forEach((l) => pushSet(['salesAuditLogs', l.id], l));
  dataset.referralAttributions.forEach((a) => pushSet(['referralAttributions', a.id], a));
  dataset.payments.forEach((p) => pushSet(['platform_payments', p.id], p));
  dataset.commissionLedger.forEach((c) => pushSet(['commissionLedger', c.id], c));
  dataset.commissionPayouts.forEach((p) => pushSet(['commissionPayouts', p.id], p));
  dataset.supportTickets.forEach((t) => pushSet(['support_tickets', t.id], t));
  dataset.activityLogs.forEach((l) => pushSet(['platform_activity_logs', l.id], l));

  dataset.shopBundles.forEach((bundle) => {
    const sid = bundle.shop.id;
    pushSet(['shops', sid], bundle.shop);
    pushSet(['shops_public', sid], bundle.shopPublic);
    pushSet(['shop_slugs', bundle.shop.slug], {
      slug: bundle.shop.slug,
      shopId: sid,
      ownerId: bundle.shop.ownerId,
      name: bundle.shop.name,
      createdAt: bundle.shop.createdAt,
    });
    pushSet(['shops', sid, 'settings', 'public'], bundle.publicSettings);
    bundle.categories.forEach((c) => pushSet(['shops', sid, 'categories', c.id], c));
    bundle.products.forEach((p) => pushSet(['shops', sid, 'products', p.id], p));
    bundle.customers.forEach((c) => pushSet(['shops', sid, 'customers', c.id], c));
    bundle.orders.forEach((o) => pushSet(['shops', sid, 'orders', o.id], o));
  });

  const CHUNK_SIZE = 400;
  for (let i = 0; i < writeOps.length; i += CHUNK_SIZE) {
    const batch = db.batch();
    const slice = writeOps.slice(i, i + CHUNK_SIZE);
    for (const op of slice) {
      batch.set(db.doc(op.pathSegments.join('/')), op.data);
    }
    await batch.commit();
  }

  return {
    writtenDocs: writeOps.length,
    seededCounts: {
      shops: dataset.shopBundles.length,
      products: dataset.shopBundles.reduce((s, b) => s + b.products.length, 0),
      customers: dataset.shopBundles.reduce((s, b) => s + b.customers.length, 0),
      orders: dataset.shopBundles.reduce((s, b) => s + b.orders.length, 0),
      salesMembers: dataset.salesMembers.length,
      referralAgents: dataset.referralAgents.length,
    },
  };
}

/**
 * Provision SB Khush Demo Super Admin Account & Isolated Demo Dataset
 *
 * Usage:
 *   DEMO_ADMIN_PASSWORD="<strong-secret>" npx tsx scripts/provision-demo-admin.ts
 *
 * Security guarantees:
 * - Reads DEMO_ADMIN_PASSWORD strictly from environment variables (never hardcoded).
 * - Sets Firebase Auth custom claims `{ super_admin: false, demo_super_admin: true, account_type: 'DEMO', demo_scope: 'demo_env/default' }`.
 * - Writes metadata to `/demo_admins/{uid}` (never `platform_admins` or `admins`).
 * - Seeds strictly under `/demo_env/default/...` without touching production data.
 */
import {
  DEMO_ACCOUNT_TYPE,
  DEMO_ADMIN_DISPLAY_NAME,
  DEMO_ADMIN_EMAIL,
  DEMO_SCOPE_PATH,
} from '../src/demo/demoConfig';
import {
  clearAndSeedDemoEnvironmentCli,
  loadFirebaseAdminModules,
} from './demoAdminHelper';

async function main() {
  const email = (process.env.DEMO_ADMIN_EMAIL || DEMO_ADMIN_EMAIL).trim().toLowerCase();
  const password = String(process.env.DEMO_ADMIN_PASSWORD || '').trim();

  if (email !== DEMO_ADMIN_EMAIL) {
    throw new Error(`Refusing to provision unexpected demo email "${email}". Expected ${DEMO_ADMIN_EMAIL}.`);
  }

  const { adminAuth, adminFirestore, adminStorage } = loadFirebaseAdminModules();

  let userRecord: any;
  try {
    userRecord = await adminAuth.getUserByEmail(email);
    const updatePayload: Record<string, any> = {
      displayName: DEMO_ADMIN_DISPLAY_NAME,
      emailVerified: true,
      disabled: false,
    };
    if (password.length >= 12) {
      updatePayload.password = password;
    }
    userRecord = await adminAuth.updateUser(userRecord.uid, updatePayload);
    console.log(`[Demo Provision] Updated existing Firebase Auth user ${email} (${userRecord.uid})`);
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') {
      if (password.length < 12) {
        throw new Error(
          'Missing or weak DEMO_ADMIN_PASSWORD environment variable (min 12 characters required for creating the Demo Super Admin account).'
        );
      }
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: DEMO_ADMIN_DISPLAY_NAME,
        emailVerified: true,
        disabled: false,
      });
      console.log(`[Demo Provision] Created Firebase Auth user ${email} (${userRecord.uid})`);
    } else {
      throw err;
    }
  }

  const demoClaims = {
    super_admin: false,
    demo_super_admin: true,
    account_type: DEMO_ACCOUNT_TYPE,
    demo_scope: DEMO_SCOPE_PATH,
    shops: {},
    sales_role: null,
  };

  await adminAuth.setCustomUserClaims(userRecord.uid, demoClaims);
  console.log('[Demo Provision] Applied strict air-gapped custom claims:', JSON.stringify(demoClaims));

  const nowIso = new Date().toISOString();
  await adminFirestore.collection('demo_admins').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email,
    displayName: DEMO_ADMIN_DISPLAY_NAME,
    role: 'super_admin',
    accountType: DEMO_ACCOUNT_TYPE,
    status: 'active',
    demoScope: DEMO_SCOPE_PATH,
    updatedBy: 'cli:provision-demo-admin',
    updatedAt: nowIso,
  });
  console.log(`[Demo Provision] Wrote /demo_admins/${userRecord.uid}`);

  const seeded = await clearAndSeedDemoEnvironmentCli(adminFirestore, adminStorage);
  console.log(
    `[Demo Provision] Seeded ${seeded.writtenDocs} documents under /${DEMO_SCOPE_PATH}:`,
    JSON.stringify(seeded.seededCounts)
  );
}

main().catch((err) => {
  console.error('[Demo Provision Failed]', err?.message || err);
  process.exit(1);
});

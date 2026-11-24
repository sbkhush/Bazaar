/**
 * Reset SB Khush Isolated Demo Environment (`/demo_env/default`)
 *
 * Usage:
 *   npx tsx scripts/reset-demo-data.ts
 *
 * Safety guarantees:
 * - Recursively deletes ONLY `/demo_env/default` in Firestore and `demo_env/default/` in Storage.
 * - Never reads, modifies, or deletes production root collections (`shops`, `users`, `platform_admins`, etc.).
 */
import { DEMO_SCOPE_PATH } from '../src/demo/demoConfig';
import {
  clearAndSeedDemoEnvironmentCli,
  loadFirebaseAdminModules,
} from './demoAdminHelper';

async function main() {
  const { adminFirestore, adminStorage } = loadFirebaseAdminModules();
  console.log(`[Demo Reset] Resetting isolated demo environment at /${DEMO_SCOPE_PATH}...`);
  const result = await clearAndSeedDemoEnvironmentCli(adminFirestore, adminStorage);
  console.log(
    `[Demo Reset] Complete. Seeded ${result.writtenDocs} documents:`,
    JSON.stringify(result.seededCounts)
  );
}

main().catch((err) => {
  console.error('[Demo Reset Failed]', err?.message || err);
  process.exit(1);
});

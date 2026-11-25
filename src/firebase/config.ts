import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const FIREBASE_FUNCTIONS_REGION = 'us-central1';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: Must pass firebaseConfig.firestoreDatabaseId to getFirestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, FIREBASE_FUNCTIONS_REGION);

export interface FirebaseConnectionDiagnostics {
  online: boolean;
  firestoreReachable: boolean;
  projectId: string;
  databaseId: string;
  storageBucket: string;
  functionsRegion: string;
  appCheckEnabled: boolean;
  checkedAt: string;
  error?: string;
}

let appCheckInitialized = false;
let connectionPromise: Promise<void> | null = null;
let lastConnectionError: string | undefined;
let lastFirestoreReachable = true;

function initOptionalAppCheck() {
  if (appCheckInitialized || typeof window === 'undefined') return;
  const siteKey = String(import.meta.env?.VITE_FIREBASE_APP_CHECK_SITE_KEY || '').trim();
  if (!siteKey) return;

  appCheckInitialized = true;
  void import('firebase/app-check')
    .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    })
    .catch((err) => {
      console.warn('Firebase App Check setup note:', err);
    });
}

export async function testConnection(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        // Probe publicly readable settings doc so default-deny rules never emit false permission warnings
        await getDocFromServer(doc(db, 'platform_settings', 'global'));
        lastFirestoreReachable = true;
        lastConnectionError = undefined;
      } catch (error) {
        lastFirestoreReachable = false;
        const msg = error instanceof Error ? error.message : String(error);
        lastConnectionError = msg;
        if (msg.includes('the client is offline')) {
          console.warn('Firestore notice: client is offline or initializing.');
        }
      }
    })();
  }
  await connectionPromise;
  return lastFirestoreReachable;
}

export async function getFirebaseConnectionDiagnostics(): Promise<FirebaseConnectionDiagnostics> {
  connectionPromise = null;
  const reachable = await testConnection();
  return {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    firestoreReachable: reachable,
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    storageBucket: firebaseConfig.storageBucket,
    functionsRegion: FIREBASE_FUNCTIONS_REGION,
    appCheckEnabled: appCheckInitialized,
    checkedAt: new Date().toISOString(),
    error: lastConnectionError,
  };
}

if (typeof window !== 'undefined') {
  initOptionalAppCheck();
  void testConnection();
  window.addEventListener('online', () => {
    connectionPromise = null;
    void testConnection();
  });
}

export default app;

import {
  collection,
  doc,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore';
import { DEMO_ENV_ID, DEMO_ENV_ROOT } from '../demo/demoConfig';

export type FirestoreNamespaceMode = 'prod' | 'demo';

let activeNamespaceMode: FirestoreNamespaceMode = 'prod';

export function setFirestoreNamespaceMode(mode: FirestoreNamespaceMode): void {
  activeNamespaceMode = mode === 'demo' ? 'demo' : 'prod';
}

export function getFirestoreNamespaceMode(): FirestoreNamespaceMode {
  return activeNamespaceMode;
}

export function isDemoNamespace(): boolean {
  return activeNamespaceMode === 'demo';
}

export function getNamespacePrefix(): string {
  return isDemoNamespace() ? `${DEMO_ENV_ROOT}/${DEMO_ENV_ID}` : '';
}

/**
 * Resolves a top-level collection path (and optional nested subcollections/docs)
 * inside either production root or `/demo_env/default/...` when activeNamespaceMode === 'demo'.
 * Requires an odd number of path segments relative to the namespace root.
 */
export function scopedCollection(
  db: Firestore,
  collectionName: string,
  ...pathSegments: string[]
): CollectionReference<DocumentData> {
  if (isDemoNamespace()) {
    return collection(db, DEMO_ENV_ROOT, DEMO_ENV_ID, collectionName, ...pathSegments);
  }
  return collection(db, collectionName, ...pathSegments);
}

/**
 * Resolves a top-level document path (and optional nested subcollections/docs)
 * inside either production root or `/demo_env/default/...` when activeNamespaceMode === 'demo'.
 */
export function scopedDoc(
  db: Firestore,
  collectionName: string,
  docId: string,
  ...pathSegments: string[]
): DocumentReference<DocumentData> {
  if (isDemoNamespace()) {
    return doc(db, DEMO_ENV_ROOT, DEMO_ENV_ID, collectionName, docId, ...pathSegments);
  }
  return doc(db, collectionName, docId, ...pathSegments);
}

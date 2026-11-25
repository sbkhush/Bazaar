import { auth } from './config';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function sanitizeSensitiveErrorText(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : String(raw || 'Unknown error');
  return message
    .replace(/\b\d{5}-\d{7}-\d\b/g, 'XXXXX-XXXXXXX-X')
    .replace(/\b\d{13}\b/g, 'XXXXXXXXXXXXX')
    .replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, 'Bearer [REDACTED]');
}

export function mapFirebaseErrorMessage(error: unknown, fallback?: string): string {
  const errObj = error as { code?: string; message?: string } | null | undefined;
  const code = String(errObj?.code || '').toLowerCase();
  const rawMessage = sanitizeSensitiveErrorText(errObj?.message || error || '');

  switch (code) {
    // Firebase Auth error codes
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please double-check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please choose at least 6 strong characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes or reset your password.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing authentication.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Please allow popups for this site and retry.';
    case 'auth/network-request-failed':
      return 'Network connection error while contacting authentication servers. Please check your internet and retry.';
    case 'auth/requires-recent-login':
      return 'For your security, please sign out and sign back in before performing this sensitive action.';
    case 'auth/user-disabled':
      return 'This user account has been disabled by platform administration.';

    // Firestore & Cloud Functions error codes
    case 'permission-denied':
    case 'functions/permission-denied':
      return 'Permission denied. Your account lacks authorization for this action, or your session claims need a refresh.';
    case 'unauthenticated':
    case 'functions/unauthenticated':
      return 'Authentication required. Please sign in and retry.';
    case 'failed-precondition':
    case 'functions/failed-precondition':
      return rawMessage || 'This operation cannot be completed in the current state (missing configuration or index).';
    case 'already-exists':
    case 'functions/already-exists':
      return rawMessage || 'This record already exists.';
    case 'not-found':
    case 'functions/not-found':
      return rawMessage || 'Requested record was not found.';
    case 'resource-exhausted':
    case 'functions/resource-exhausted':
      return 'Service quota or rate limit reached temporarily. Please wait a moment and try again.';
    case 'unavailable':
    case 'functions/unavailable':
    case 'deadline-exceeded':
    case 'functions/deadline-exceeded':
      return 'Cloud service is temporarily unavailable or timed out. Please check your connection and retry.';

    // Firebase Storage error codes
    case 'storage/unauthorized':
      return 'Upload denied by Firebase Storage rules. Sign out/in to refresh tenant permissions or verify storage.rules and Cloud Functions claims.';
    case 'storage/bucket-not-found':
      return 'Firebase Storage bucket is not provisioned or configured. Check Firebase Console -> Storage.';
    case 'storage/unauthenticated':
      return 'Please sign in again before uploading images.';
    case 'storage/quota-exceeded':
      return 'Firebase Storage bucket quota exceeded. Contact platform administrator.';
    case 'storage/retry-limit-exceeded':
      return 'Upload timed out due to unstable network connection. Please click Retry.';
    case 'storage/canceled':
      return 'Upload was canceled.';

    default:
      if (rawMessage && rawMessage !== 'Unknown error') {
        return rawMessage;
      }
      return fallback || 'Operation failed. Please try again.';
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: sanitizeSensitiveErrorText(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

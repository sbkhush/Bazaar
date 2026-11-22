const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailAndPasswordInput(email: string, password: string): { email: string; password: string } {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !SIMPLE_EMAIL_REGEX.test(cleanEmail)) {
    throw new Error('Please enter a valid email address (e.g. name@domain.com).');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  return { email: cleanEmail, password };
}

export function formatFirebaseAuthError(err: any, fallback = 'Authentication request failed.'): string {
  const code = String(err?.code || '').trim();
  const rawMessage = String(err?.message || '');

  // Handle REST Identity Toolkit error strings when no FirebaseError code is attached
  const detectedCode =
    code ||
    (rawMessage.includes('EMAIL_EXISTS') ? 'auth/email-already-in-use' : '') ||
    (rawMessage.includes('INVALID_EMAIL') ? 'auth/invalid-email' : '') ||
    (rawMessage.includes('WEAK_PASSWORD') ? 'auth/weak-password' : '') ||
    (rawMessage.includes('OPERATION_NOT_ALLOWED') ? 'auth/operation-not-allowed' : '') ||
    (rawMessage.includes('ADMIN_ONLY_OPERATION') ? 'auth/admin-restricted-operation' : '') ||
    (rawMessage.includes('TOO_MANY_ATTEMPTS') ? 'auth/too-many-requests' : '');

  switch (detectedCode) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in or use Forgot Password. (auth/email-already-in-use)';
    case 'auth/invalid-email':
      return 'Please enter a valid email address. (auth/invalid-email)';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters with a mix of letters and numbers. (auth/weak-password)';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-up is currently disabled in Firebase Authentication for this project. Enable it in Firebase Console -> Authentication -> Sign-in method. (auth/operation-not-allowed)';
    case 'auth/admin-restricted-operation':
      return 'Account registration is restricted by Firebase Auth policy or project configuration. (auth/admin-restricted-operation)';
    case 'auth/unauthorized-domain': {
      const origin = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      return `Domain "${origin}" is not authorized in Firebase Authentication. Add it under Firebase Console -> Authentication -> Settings -> Authorized domains. (auth/unauthorized-domain)`;
    }
    case 'auth/too-many-requests':
      return 'Too many sign-in or sign-up attempts. Please wait a few minutes and try again. (auth/too-many-requests)';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return `Invalid email or password. (${detectedCode})`;
    case 'auth/invalid-api-key':
      return 'Firebase API key is invalid or blocked for this website referrer. (auth/invalid-api-key)';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing authentication. (auth/popup-closed-by-user)';
    case 'auth/network-request-failed':
      return 'Network connection error while contacting Firebase Authentication. Check your internet and try again. (auth/network-request-failed)';
    default:
      if (detectedCode && rawMessage) {
        return `${rawMessage} (${detectedCode})`;
      }
      return rawMessage || fallback;
  }
}

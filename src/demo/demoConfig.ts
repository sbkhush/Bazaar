// Non-secret configuration constants for SB Khush Demo Super Admin environment.
// Passwords MUST NEVER be stored in frontend source code — only server/Admin CLI env vars.

export const DEMO_ADMIN_EMAIL = 'demo-admin@sbkhush.com';
export const DEMO_ADMIN_DISPLAY_NAME = 'SB Khush Demo Admin';
export const DEMO_ACCOUNT_TYPE = 'DEMO' as const;
export const DEMO_ENV_ROOT = 'demo_env';
export const DEMO_ENV_ID = 'default';
export const DEMO_SCOPE_PATH = `${DEMO_ENV_ROOT}/${DEMO_ENV_ID}`;
export const DEMO_DATA_TAG = 'DEMO DATA';

export function isDemoAccountEmail(email?: string | null): boolean {
  return String(email || '').trim().toLowerCase() === DEMO_ADMIN_EMAIL;
}

export function isDemoClaimSet(claims?: Record<string, any> | null): boolean {
  if (!claims) return false;
  return claims.demo_super_admin === true || claims.account_type === DEMO_ACCOUNT_TYPE;
}

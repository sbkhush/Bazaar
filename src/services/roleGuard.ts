import type { SalesLead, SalesMember, SalesMemberRole, ShopMembership } from '../types';

export type AuthorizedPortalRole =
  | 'super_admin'
  | 'sales_manager'
  | 'salesman'
  | 'referral_agent'
  | 'shop_owner'
  | 'shop_staff'
  | 'customer';

export const ALLOWED_SALES_TEAM_ROLES: readonly SalesMemberRole[] = [
  'salesman',
  'senior_salesman',
  'sales_manager',
  'referral_agent',
];

export function isAllowedSalesRole(role: unknown): role is SalesMemberRole {
  return typeof role === 'string' && (ALLOWED_SALES_TEAM_ROLES as readonly string[]).includes(role);
}

export function resolveAuthorizedPortalRole(params: {
  isSuperAdmin: boolean;
  isBlocked?: boolean;
  salesMember: Pick<SalesMember, 'role' | 'accountStatus'> | null;
  shopMemberships: Pick<ShopMembership, 'role'>[];
}): AuthorizedPortalRole {
  if (params.isBlocked) return 'customer';
  if (params.isSuperAdmin) return 'super_admin';

  if (
    params.salesMember &&
    (params.salesMember.accountStatus === 'active' || params.salesMember.accountStatus === 'invited')
  ) {
    if (params.salesMember.role === 'sales_manager') return 'sales_manager';
    if (params.salesMember.role === 'referral_agent') return 'referral_agent';
    if (params.salesMember.role === 'salesman' || params.salesMember.role === 'senior_salesman') {
      return 'salesman';
    }
  }

  if (params.shopMemberships.length > 0) {
    const hasOwnerOrAdmin = params.shopMemberships.some(
      (m) => m.role === 'shop_owner' || m.role === 'shop_admin'
    );
    return hasOwnerOrAdmin ? 'shop_owner' : 'shop_staff';
  }

  return 'customer';
}

export function getAuthorizedHomePath(role: AuthorizedPortalRole): string {
  switch (role) {
    case 'super_admin':
      return '/super-admin';
    case 'sales_manager':
      return '/sales-manager';
    case 'salesman':
      return '/salesman';
    case 'referral_agent':
      return '/referral';
    case 'shop_owner':
    case 'shop_staff':
      return '/dashboard';
    case 'customer':
    default:
      return '/';
  }
}

export function getPortalLoginPathForRoute(pathname: string): string {
  if (pathname.startsWith('/sales-manager')) return '/sales-manager/login';
  if (pathname.startsWith('/salesman')) return '/salesman/login';
  if (pathname.startsWith('/referral')) return '/referral/login';
  return '/login';
}

export function canAccessPortalRoute(role: AuthorizedPortalRole | null, pathname: string): boolean {
  const normalized = pathname.trim().toLowerCase();

  // Public auth entry routes are always reachable
  if (
    normalized === '/sales-manager/login' ||
    normalized === '/salesman/login' ||
    normalized === '/referral/login' ||
    normalized === '/referral/register' ||
    normalized === '/login' ||
    normalized === '/register'
  ) {
    return true;
  }

  // Protected Super Admin portal routes (/admin/* and /super-admin/*)
  if (normalized === '/admin' || normalized.startsWith('/admin/') || normalized === '/super-admin' || normalized.startsWith('/super-admin/')) {
    return role === 'super_admin';
  }

  // Protected Sales Manager portal (/sales-manager/*)
  if (normalized === '/sales-manager' || normalized.startsWith('/sales-manager/')) {
    return role === 'sales_manager';
  }

  // Protected Salesman portal (/salesman/*)
  if (normalized === '/salesman' || normalized.startsWith('/salesman/')) {
    return role === 'salesman';
  }

  // Protected Referral Agent portal (/referral/*)
  if (normalized === '/referral' || normalized.startsWith('/referral/')) {
    return role === 'referral_agent';
  }

  // Protected Merchant Shop Dashboard (/dashboard/*)
  if (normalized === '/dashboard' || normalized.startsWith('/dashboard/')) {
    return role === 'shop_owner' || role === 'shop_staff' || role === 'super_admin';
  }

  return true;
}

export function canAccessSalesmanRecord(params: {
  actorRole: AuthorizedPortalRole;
  actorUid: string;
  targetSalesmanUid?: string;
  targetSalesmanManagerUid?: string;
}): boolean {
  if (params.actorRole === 'super_admin') return true;
  if (!params.actorUid || !params.targetSalesmanUid) return false;
  if (params.actorRole === 'salesman' || params.actorRole === 'referral_agent') {
    return params.actorUid === params.targetSalesmanUid;
  }
  if (params.actorRole === 'sales_manager') {
    return (
      params.actorUid === params.targetSalesmanUid ||
      Boolean(params.targetSalesmanManagerUid && params.targetSalesmanManagerUid === params.actorUid)
    );
  }
  return false;
}

export function canAccessManagerTeamRecord(params: {
  actorRole: AuthorizedPortalRole;
  actorUid: string;
  recordManagerUid?: string;
}): boolean {
  if (params.actorRole === 'super_admin') return true;
  if (params.actorRole !== 'sales_manager') return false;
  return Boolean(params.actorUid && params.recordManagerUid && params.actorUid === params.recordManagerUid);
}

export function canAssignTeamLead(params: {
  actorRole: AuthorizedPortalRole;
  actorUid: string;
  lead: Pick<SalesLead, 'assignedManagerUid' | 'assignedSalesmanUid'>;
  targetMember: Pick<SalesMember, 'uid' | 'assignedManagerUid' | 'accountStatus' | 'role'>;
}): { allowed: boolean; reason?: string } {
  if (params.actorRole === 'super_admin') {
    return { allowed: true };
  }
  if (params.actorRole !== 'sales_manager') {
    return { allowed: false, reason: 'Only a Sales Manager or Super Admin can assign team leads.' };
  }
  if (params.targetMember.accountStatus !== 'active' && params.targetMember.accountStatus !== 'invited') {
    return { allowed: false, reason: 'Target representative account is not active.' };
  }
  if (params.targetMember.assignedManagerUid !== params.actorUid) {
    return { allowed: false, reason: 'Forbidden: target representative does not belong to your assigned team.' };
  }
  if (params.lead.assignedManagerUid && params.lead.assignedManagerUid !== params.actorUid) {
    return { allowed: false, reason: 'Forbidden: lead belongs to another sales manager team.' };
  }
  return { allowed: true };
}

export function canRecommendBonusForRep(params: {
  actorRole: AuthorizedPortalRole;
  actorUid: string;
  targetMember: Pick<SalesMember, 'assignedManagerUid' | 'uid'>;
}): { allowed: boolean; reason?: string } {
  if (params.actorRole !== 'sales_manager') {
    return { allowed: false, reason: 'Only Sales Managers can submit bonus recommendations.' };
  }
  if (params.targetMember.assignedManagerUid !== params.actorUid) {
    return { allowed: false, reason: 'Forbidden: you can only recommend bonuses for reps in your own team.' };
  }
  if (params.targetMember.uid === params.actorUid) {
    return { allowed: false, reason: 'Forbidden: managers cannot recommend bonuses for themselves.' };
  }
  return { allowed: true };
}

export function canSubmitSalesExpense(params: {
  actorRole: AuthorizedPortalRole;
  actorUid: string;
  expenseSalesmanUid: string;
  requestedStatus: string;
  amount: number;
}): { allowed: boolean; reason?: string } {
  if (!['salesman', 'sales_manager'].includes(params.actorRole)) {
    return { allowed: false, reason: 'Only authorized sales representatives can submit expenses.' };
  }
  if (!params.actorUid || params.expenseSalesmanUid !== params.actorUid) {
    return { allowed: false, reason: 'Forbidden: cannot submit expenses on behalf of another user.' };
  }
  if (params.requestedStatus !== 'pending') {
    return { allowed: false, reason: 'Forbidden: submitted expenses must start in pending status and cannot be self-approved.' };
  }
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return { allowed: false, reason: 'Expense amount must be greater than zero.' };
  }
  return { allowed: true };
}

export function canModifyCommissionOrApprovePayout(actorRole: AuthorizedPortalRole): boolean {
  return actorRole === 'super_admin';
}

export function canCreateOrPromotePrivilegedRole(params: {
  actorRole: AuthorizedPortalRole;
  targetRole: string;
  isSalesTeamContext?: boolean;
}): { allowed: boolean; reason?: string } {
  if (params.actorRole !== 'super_admin') {
    return { allowed: false, reason: 'Forbidden: only Super Admin can create or promote privileged accounts.' };
  }
  if (params.isSalesTeamContext && params.targetRole === 'super_admin') {
    return { allowed: false, reason: 'Non-negotiable security policy: sales team accounts can never hold super_admin role.' };
  }
  return { allowed: true };
}

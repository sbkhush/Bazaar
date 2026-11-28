import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteApp, getApp, getApps, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail } from 'firebase/auth';
import app, { auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { getIndustryMeta, isKnownBusinessType } from '../config/industryConfig';
import {
  BillingCycle,
  BusinessType,
  CommissionLedgerEntry,
  CommissionPayout,
  CommissionRuleTier,
  PlatformPayment,
  PayoutMethod,
  ReferralAttribution,
  SalesAccountStatus,
  SalesActivity,
  SalesAnalyticsFilter,
  SalesAnalyticsSummary,
  SalesAuditLog,
  SalesBonusRecommendation,
  SalesExpense,
  SalesLead,
  SalesLeadSource,
  SalesLeadStatus,
  SalesMaterial,
  SalesMember,
  SalesMemberRole,
  SalesNotification,
  SalesNotificationType,
  SalesQrEvent,
  SalesSettings,
  SalesTarget,
  SalesTeam,
  Shop,
} from '../types';
import { parseCsvRows } from '../utils/csvUtils';
import { isAllowedSalesRole } from './roleGuard';

export const DEFAULT_COMMISSION_PLANS: CommissionRuleTier[] = [
  {
    id: 'tier-standard',
    name: 'Standard Field Executive',
    firstSubRatePct: 15,
    renewalRatePct: 5,
    verifiedShopBonus: 300,
    yearlyPlanBonusPct: 3,
    minRevenueForBonus: 50000,
    targetBonusAmount: 5000,
  },
  {
    id: 'tier-senior',
    name: 'Senior Growth Partner',
    firstSubRatePct: 20,
    renewalRatePct: 7,
    verifiedShopBonus: 500,
    yearlyPlanBonusPct: 5,
    minRevenueForBonus: 100000,
    targetBonusAmount: 10000,
  },
  {
    id: 'tier-manager',
    name: 'Sales Manager Override',
    firstSubRatePct: 18,
    renewalRatePct: 6,
    verifiedShopBonus: 500,
    yearlyPlanBonusPct: 4,
    minRevenueForBonus: 150000,
    targetBonusAmount: 15000,
  },
];

export const DEFAULT_SALES_SETTINGS: SalesSettings = {
  id: 'general',
  portalBaseUrl: 'https://sbkhush.com',
  defaultFirstSubRatePct: 15,
  defaultRenewalRatePct: 5,
  verifiedShopFlatBonus: 300,
  yearlyBonusExtraPct: 3,
  minPayoutThreshold: 1000,
  attributionWindowDays: 30,
  allowManualReferralEntry: true,
  preventSelfReferral: true,
  autoSyncCommissionOnPaymentApproval: true,
  commissionPlans: DEFAULT_COMMISSION_PLANS,
};

export const ALL_LEAD_STATUSES: SalesLeadStatus[] = [
  'New',
  'Assigned',
  'Contacted',
  'Interested',
  'Follow-up Required',
  'Demo Scheduled',
  'Negotiation',
  'Converted',
  'Not Interested',
  'Lost',
];

export const ALL_ACTIVITY_TYPES: SalesActivity['activityType'][] = [
  'Business visit',
  'Phone call',
  'WhatsApp follow-up',
  'Product demo',
  'Online meeting',
  'Shop registration assistance',
  'Subscription follow-up',
];

function stripUndef<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndef(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj as Record<string, any>)) {
      if (v !== undefined) out[k] = stripUndef(v);
    }
    return out as T;
  }
  return obj;
}

export function normalizePhoneForMatch(raw?: string): string {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('92') && digits.length >= 12) return `0${digits.slice(2, 12)}`;
  if (digits.startsWith('3') && digits.length === 10) return `0${digits}`;
  return digits;
}

export function generateEmployeeId(existingMembers: Pick<SalesMember, 'employeeId'>[]): string {
  const existingSet = new Set(existingMembers.map((m) => String(m.employeeId || '').toUpperCase()));
  let seq = existingMembers.length + 1;
  while (seq < 99999) {
    const candidate = `SBK-SLS-${String(seq).padStart(3, '0')}`;
    if (!existingSet.has(candidate)) return candidate;
    seq++;
  }
  return `SBK-SLS-${Date.now().toString().slice(-5)}`;
}

export function generateUniqueReferralCode(fullName: string, existingCodes: string[] = []): string {
  const cleanName = fullName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4) || 'REP';
  const codeSet = new Set(existingCodes.map((c) => c.toUpperCase()));
  for (let i = 0; i < 25; i++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const code = `SAL-${cleanName}-${suffix}`;
    if (!codeSet.has(code)) return code;
  }
  return `SAL-${cleanName}-${Date.now().toString().slice(-5)}`;
}

export function buildReferralLink(code: string, baseUrl = 'https://sbkhush.com'): string {
  const cleanBase = baseUrl.replace(/\/+$/, '') || 'https://sbkhush.com';
  return `${cleanBase}/r/${encodeURIComponent(code.trim().toUpperCase())}`;
}

export function buildSalesmanPortalLoginUrl(baseUrl = 'https://sbkhush.com'): string {
  const cleanBase = baseUrl.replace(/\/+$/, '') || 'https://sbkhush.com';
  return `${cleanBase}/salesman/login`;
}

export function buildSalesManagerPortalLoginUrl(baseUrl = 'https://sbkhush.com'): string {
  const cleanBase = baseUrl.replace(/\/+$/, '') || 'https://sbkhush.com';
  return `${cleanBase}/sales-manager/login`;
}

export function buildReferralPortalLoginUrl(baseUrl = 'https://sbkhush.com'): string {
  const cleanBase = baseUrl.replace(/\/+$/, '') || 'https://sbkhush.com';
  return `${cleanBase}/referral/login`;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

import { buildApiUrl } from '../utils/apiClient';

async function trySalesApi<T>(path: string, method: 'GET' | 'POST' = 'POST', body?: unknown): Promise<T | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(buildApiUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error || `Request failed (${res.status})`);
    }
    return json as T;
  } catch (err: any) {
    const errMsg = String(err?.message || '');
    if (
      errMsg.includes('Failed to fetch') ||
      errMsg.includes('Load failed') ||
      errMsg.includes('NetworkError') ||
      errMsg.includes('Unexpected token') ||
      err?.name === 'TypeError'
    ) {
      return null;
    }
    throw err;
  }
}

// ====================================================
// AUDIT LOGS & NOTIFICATIONS
// ====================================================

export async function logSalesAudit(params: {
  action: string;
  entityType: SalesAuditLog['entityType'];
  entityId: string;
  details: string;
  actorRole?: SalesAuditLog['actorRole'];
  previousValue?: string;
  newValue?: string;
}): Promise<void> {
  try {
    const id = `slog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const payload = stripUndef<SalesAuditLog>({
      id,
      actorUid: auth.currentUser?.uid || 'system',
      actorEmail: auth.currentUser?.email || 'system',
      actorRole: params.actorRole || 'super_admin',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details,
      previousValue: params.previousValue,
      newValue: params.newValue,
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'salesAuditLogs', id), payload);
  } catch (err) {
    console.warn('Sales audit log note:', err);
  }
}

export async function getSalesAuditLogs(maxItems = 150): Promise<SalesAuditLog[]> {
  try {
    const q = query(collection(db, 'salesAuditLogs'), orderBy('createdAt', 'desc'), limit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as SalesAuditLog), id: d.id }));
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesAuditLogs');
  }
}

export async function createSalesNotification(params: {
  recipientSalesmanId: string;
  recipientUid?: string;
  type: SalesNotificationType;
  title: string;
  message: string;
  link?: string;
}): Promise<void> {
  try {
    const id = `sntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const payload = stripUndef<SalesNotification>({
      id,
      recipientSalesmanId: params.recipientSalesmanId,
      recipientUid: params.recipientUid,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'salesNotifications', id), payload);
  } catch (err) {
    console.warn('Sales notification create note:', err);
  }
}

export async function getSalesNotifications(recipientSalesmanId: string, recipientUid?: string): Promise<SalesNotification[]> {
  try {
    const q = recipientUid
      ? query(collection(db, 'salesNotifications'), where('recipientUid', '==', recipientUid), limit(60))
      : query(collection(db, 'salesNotifications'), where('recipientSalesmanId', '==', recipientSalesmanId), limit(60));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesNotification), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesNotifications');
  }
}

export async function markSalesNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, 'salesNotifications', notifId), { isRead: true }).catch(() => {});
}

export async function markAllSalesNotificationsRead(notifs: SalesNotification[]): Promise<void> {
  const unread = notifs.filter((n) => !n.isRead);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, 'salesNotifications', n.id), { isRead: true }));
  await batch.commit().catch(() => {});
}

// ====================================================
// SALES SETTINGS & COMMISSION PLANS
// ====================================================

export async function getSalesSettings(): Promise<SalesSettings> {
  try {
    const snap = await getDoc(doc(db, 'salesSettings', 'general'));
    if (snap.exists()) {
      const data = snap.data() as Partial<SalesSettings>;
      return {
        ...DEFAULT_SALES_SETTINGS,
        ...data,
        commissionPlans:
          Array.isArray(data.commissionPlans) && data.commissionPlans.length > 0
            ? data.commissionPlans
            : DEFAULT_COMMISSION_PLANS,
      };
    }
    return DEFAULT_SALES_SETTINGS;
  } catch {
    return DEFAULT_SALES_SETTINGS;
  }
}

export async function updateSalesSettings(patch: Partial<SalesSettings>): Promise<SalesSettings> {
  try {
    const current = await getSalesSettings();
    const updated = stripUndef<SalesSettings>({
      ...current,
      ...patch,
      id: 'general',
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'salesSettings', 'general'), updated, { merge: true });
    await logSalesAudit({
      action: 'Updated Sales Settings',
      entityType: 'sales_settings',
      entityId: 'general',
      details: `Updated commission rates (First: ${updated.defaultFirstSubRatePct}%, Renewal: ${updated.defaultRenewalRatePct}%) and portal URL (${updated.portalBaseUrl})`,
    });
    return updated;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'salesSettings/general');
  }
}

// ====================================================
// SALES MEMBERS & AUTH LINKING
// ====================================================

export async function getAllSalesMembers(): Promise<SalesMember[]> {
  try {
    const snap = await getDocs(collection(db, 'salesMembers'));
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesMember), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'salesMembers');
  }
}

export async function getSalesMemberById(memberId: string): Promise<SalesMember | null> {
  try {
    const snap = await getDoc(doc(db, 'salesMembers', memberId));
    return snap.exists() ? ({ ...(snap.data() as SalesMember), id: snap.id }) : null;
  } catch {
    return null;
  }
}

export async function getSalesMemberByUidOrEmail(uid: string, email?: string | null): Promise<SalesMember | null> {
  try {
    const byUidQ = query(collection(db, 'salesMembers'), where('uid', '==', uid), limit(1));
    const uidSnap = await getDocs(byUidQ);
    if (!uidSnap.empty) {
      const d = uidSnap.docs[0];
      return { ...(d.data() as SalesMember), id: d.id };
    }
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (cleanEmail) {
      const byEmailQ = query(collection(db, 'salesMembers'), where('email', '==', cleanEmail), limit(1));
      const emailSnap = await getDocs(byEmailQ);
      if (!emailSnap.empty) {
        const d = emailSnap.docs[0];
        return { ...(d.data() as SalesMember), id: d.id };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function linkSalesMemberOnLogin(uid: string, email?: string | null): Promise<SalesMember | null> {
  const member = await getSalesMemberByUidOrEmail(uid, email);
  if (!member) return null;

  const now = new Date().toISOString();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const canLink =
    !member.uid ||
    member.uid === uid ||
    (cleanEmail && member.email.toLowerCase() === cleanEmail);

  if (!canLink) return null;

  try {
    const updates: Partial<SalesMember> = {
      uid,
      lastLoginAt: now,
      updatedAt: now,
    };
    if (member.inviteStatus !== 'accepted') {
      updates.inviteStatus = 'accepted';
      updates.acceptedAt = now;
      if (member.accountStatus === 'invited') {
        updates.accountStatus = 'active';
      }
    }
    await updateDoc(doc(db, 'salesMembers', member.id), stripUndef(updates));
    if (member.referralCode) {
      await setDoc(
        doc(db, 'salesReferralIndex', member.referralCode),
        {
          referralCode: member.referralCode,
          salesmanId: member.id,
          salesmanUid: uid,
          salesmanName: member.fullName,
          accountStatus: updates.accountStatus || member.accountStatus,
          updatedAt: now,
        },
        { merge: true }
      ).catch(() => {});
    }
    return { ...member, ...updates };
  } catch {
    return member;
  }
}

export async function createSalesMember(input: {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address?: string;
  profilePicture?: string;
  role: SalesMemberRole;
  assignedManagerId?: string;
  assignedManagerUid?: string;
  assignedManagerName?: string;
  teamId?: string;
  teamName?: string;
  territory: string;
  industryFocus: BusinessType | 'all';
  joiningDate: string;
  employmentStatus: SalesMember['employmentStatus'];
  monthlyTarget: number;
  yearlyTarget: number;
  commissionPlanId: string;
  commissionPlanName: string;
  accountStatus: SalesAccountStatus;
  payoutDetails?: SalesMember['payoutDetails'];
  sendPasswordResetInvite?: boolean;
}): Promise<SalesMember & { _resetEmailSent?: boolean; _resetEmailWarning?: string }> {
  if (!isAllowedSalesRole(input.role)) {
    throw new Error('Security Policy Violation: sales team accounts cannot hold super_admin or invalid roles.');
  }
  const cleanFullName = input.fullName.trim();
  if (cleanFullName.length < 2) {
    throw new Error('Full name is required (at least 2 characters).');
  }
  const cleanEmail = input.email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('A valid corporate or personal email address is required.');
  }
  if (cleanEmail === 'hasanaamir815@gmail.com') {
    throw new Error('Security Policy Violation: the Super Admin account cannot be registered as a sales member.');
  }
  const cleanPhone = input.phone.trim();
  const normalizedPhone = normalizePhoneForMatch(cleanPhone);
  if (!cleanPhone || normalizedPhone.length < 10) {
    throw new Error('A valid mobile phone number is required.');
  }

  // Prefer server-side provisioning API (handles Auth invite + duplicate guards + audit log without disturbing current session)
  const apiRes = await trySalesApi<{
    ok: boolean;
    member?: SalesMember;
    resetEmailSent?: boolean;
    resetEmailWarning?: string;
  }>('/api/super-admin/sales/members', 'POST', input);
  if (apiRes?.member) {
    return {
      ...apiRes.member,
      _resetEmailSent: apiRes.resetEmailSent,
      _resetEmailWarning: apiRes.resetEmailWarning,
    };
  }

  const existing = await getAllSalesMembers();
  if (existing.some((m) => m.email.toLowerCase() === cleanEmail)) {
    throw new Error(`A salesman account with email ${cleanEmail} already exists.`);
  }
  if (existing.some((m) => normalizePhoneForMatch(m.phone) === normalizedPhone)) {
    throw new Error(`A salesman account with phone number ${cleanPhone} already exists.`);
  }

  const settings = await getSalesSettings();
  const id = `sm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const employeeId = generateEmployeeId(existing);
  const referralCode = generateUniqueReferralCode(
    cleanFullName,
    existing.map((m) => m.referralCode)
  );
  const referralLink = buildReferralLink(referralCode, settings.portalBaseUrl);
  const now = new Date().toISOString();

  let provisionedUid: string | undefined;
  let secondaryUser: import('firebase/auth').User | null = null;
  let secondaryAppRef: import('firebase/app').FirebaseApp | null = null;
  let resetEmailSent = false;
  let resetEmailWarning: string | undefined;

  if (input.sendPasswordResetInvite) {
    try {
      const secondaryName = 'sbk-sales-provision';
      secondaryAppRef = getApps().some((a) => a.name === secondaryName)
        ? getApp(secondaryName)
        : initializeApp(app.options, secondaryName);
      const secondaryAuth = getAuth(secondaryAppRef);
      const rnd = new Uint8Array(24);
      crypto.getRandomValues(rnd);
      const ephemeralSecret = Array.from(rnd, (b) => b.toString(16).padStart(2, '0')).join('');
      const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, ephemeralSecret);
      secondaryUser = cred.user;
      provisionedUid = cred.user.uid;
    } catch (authErr: any) {
      if (authErr?.code !== 'auth/email-already-in-use') {
        resetEmailWarning = authErr?.message || 'Could not pre-create Auth user; use Mail icon later.';
      }
    }
  }

  const member = stripUndef<SalesMember>({
    id,
    uid: provisionedUid,
    employeeId,
    fullName: cleanFullName,
    email: cleanEmail,
    phone: cleanPhone,
    city: input.city.trim(),
    address: input.address?.trim() || undefined,
    profilePicture: input.profilePicture?.trim() || undefined,
    role: input.role,
    assignedManagerId: input.assignedManagerId || undefined,
    assignedManagerUid: input.assignedManagerUid || undefined,
    assignedManagerName: input.assignedManagerName || undefined,
    teamId: input.teamId || undefined,
    teamName: input.teamName || undefined,
    territory: input.territory.trim() || input.city.trim(),
    industryFocus: input.industryFocus || 'all',
    joiningDate: input.joiningDate || now.slice(0, 10),
    employmentStatus: input.employmentStatus || 'full_time',
    monthlyTarget: Math.max(0, Number(input.monthlyTarget) || 0),
    yearlyTarget: Math.max(0, Number(input.yearlyTarget) || 0),
    commissionPlanId: input.commissionPlanId,
    commissionPlanName: input.commissionPlanName,
    accountStatus: input.accountStatus || 'invited',
    referralCode,
    referralLink,
    qrScanCount: 0,
    payoutDetails: input.payoutDetails,
    inviteStatus: 'pending',
    invitedAt: now,
    createdBy: auth.currentUser?.email || 'Super Admin',
    createdAt: now,
    updatedAt: now,
  });

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'salesMembers', id), member);
    batch.set(doc(db, 'salesReferralIndex', member.referralCode), {
      referralCode: member.referralCode,
      salesmanId: member.id,
      salesmanUid: member.uid || null,
      salesmanName: member.fullName,
      accountStatus: member.accountStatus,
      qrScanCount: 0,
      updatedAt: now,
    });
    await batch.commit();

    await logSalesAudit({
      action: 'Created Salesman Account',
      entityType: 'sales_member',
      entityId: id,
      details: `Created ${member.fullName} (${member.employeeId}, ${member.role}) · Referral Code: ${member.referralCode}`,
    });

    if (input.sendPasswordResetInvite) {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        resetEmailSent = true;
      } catch (resetErr: any) {
        resetEmailWarning = resetErr?.message || 'Use the mail icon later or Google Sign-In after user setup.';
      }
    }

    return {
      ...member,
      _resetEmailSent: resetEmailSent,
      _resetEmailWarning: resetEmailWarning,
    };
  } catch (err) {
    if (secondaryUser) {
      await secondaryUser.delete().catch(() => {});
    }
    return handleFirestoreError(err, OperationType.CREATE, `salesMembers/${id}`);
  } finally {
    if (secondaryAppRef) {
      await deleteApp(secondaryAppRef).catch(() => {});
    }
  }
}

export async function submitReferralPartnerApplication(input: {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  territory?: string;
}): Promise<SalesMember> {
  const cleanUid = input.uid.trim();
  const cleanName = input.fullName.trim();
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanPhone = input.phone.trim();
  if (!cleanUid) throw new Error('Authentication session required to submit application.');
  if (cleanEmail === 'hasanaamir815@gmail.com') {
    throw new Error('Super Admin email cannot register as an affiliate partner.');
  }

  const memberId = `sm_ref_${cleanUid}`;
  const existingSnap = await getDoc(doc(db, 'salesMembers', memberId)).catch(() => null);
  if (existingSnap?.exists()) {
    return { ...(existingSnap.data() as SalesMember), id: existingSnap.id };
  }

  const settings = await getSalesSettings();
  const defaultPlan = settings.commissionPlans[0] || DEFAULT_COMMISSION_PLANS[0];
  const uidTag = cleanUid.slice(0, 6).toUpperCase();
  const employeeId = `SBK-REF-${uidTag}`;

  const cleanPrefix = cleanName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'PART';
  let referralCode = `REF-${cleanPrefix}-${cleanUid.slice(-4).toUpperCase()}`;
  const collisionSnap = await getDoc(doc(db, 'salesReferralIndex', referralCode)).catch(() => null);
  if (collisionSnap?.exists()) {
    referralCode = `REF-${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const now = new Date().toISOString();
  const member = stripUndef<SalesMember>({
    id: memberId,
    uid: cleanUid,
    employeeId,
    fullName: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    city: input.city.trim() || 'Karachi',
    role: 'referral_agent',
    territory: input.territory?.trim() || input.city.trim() || 'Digital',
    industryFocus: 'all',
    joiningDate: now.slice(0, 10),
    employmentStatus: 'contract',
    monthlyTarget: 0,
    yearlyTarget: 0,
    commissionPlanId: defaultPlan.id,
    commissionPlanName: defaultPlan.name,
    accountStatus: 'pending_approval',
    referralCode,
    referralLink: buildReferralLink(referralCode, settings.portalBaseUrl),
    qrScanCount: 0,
    inviteStatus: 'pending',
    invitedAt: now,
    createdBy: cleanUid,
    createdAt: now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'salesMembers', memberId), member);
    return member;
  } catch (err) {
    return handleFirestoreError(err, OperationType.CREATE, `salesMembers/${memberId}`);
  }
}

export async function updateSalesMember(memberId: string, patch: Partial<SalesMember>): Promise<void> {
  if (patch.role !== undefined && !isAllowedSalesRole(patch.role)) {
    throw new Error('Security Policy Violation: sales team accounts can never be assigned super_admin role.');
  }

  const apiRes = await trySalesApi<{ ok: boolean }>('/api/super-admin/sales/members', 'POST', {
    memberId,
    ...patch,
  });
  if (apiRes?.ok) return;

  try {
    if (patch.phone) {
      const normalized = normalizePhoneForMatch(patch.phone);
      const existing = await getAllSalesMembers();
      if (existing.some((m) => m.id !== memberId && normalizePhoneForMatch(m.phone) === normalized)) {
        throw new Error(`Another sales member already uses phone number ${patch.phone}.`);
      }
    }

    const now = new Date().toISOString();
    const cleanPatch = stripUndef({
      ...patch,
      updatedAt: now,
    });
    delete (cleanPatch as any).id;
    await updateDoc(doc(db, 'salesMembers', memberId), cleanPatch);

    // Keep public referral index synchronized when status/name/uid changes
    if (patch.accountStatus !== undefined || patch.fullName !== undefined || patch.uid !== undefined || patch.referralCode !== undefined) {
      const latest = await getSalesMemberById(memberId);
      if (latest?.referralCode) {
        await setDoc(
          doc(db, 'salesReferralIndex', latest.referralCode),
          {
            referralCode: latest.referralCode,
            salesmanId: latest.id,
            salesmanUid: latest.uid || null,
            salesmanName: latest.fullName,
            accountStatus: latest.accountStatus,
            qrScanCount: latest.qrScanCount || 0,
            updatedAt: now,
          },
          { merge: true }
        ).catch(() => {});
      }
    }

    await logSalesAudit({
      action: 'Updated Salesman Profile',
      entityType: 'sales_member',
      entityId: memberId,
      details: `Updated salesman ${memberId} fields: ${Object.keys(patch).join(', ')}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `salesMembers/${memberId}`);
  }
}

export async function sendSalesmanPortalReset(email: string, memberId: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const apiRes = await trySalesApi<{ ok: boolean }>('/api/super-admin/sales/invite', 'POST', {
    memberId,
    email: cleanEmail,
  });
  if (apiRes?.ok) return;

  await sendPasswordResetEmail(auth, cleanEmail);
  await logSalesAudit({
    action: 'Sent Portal Access Reset',
    entityType: 'sales_member',
    entityId: memberId,
    details: `Triggered Firebase Authentication password reset/invite email to ${cleanEmail}`,
  });
}

export async function regenerateSalesmanReferralCode(memberId: string): Promise<{ referralCode: string; referralLink: string }> {
  const apiRes = await trySalesApi<{ referralCode: string; referralLink: string }>(
    '/api/sales/referrals/regenerate',
    'POST',
    { memberId }
  );
  if (apiRes) return apiRes;

  const [member, allMembers, settings] = await Promise.all([
    getSalesMemberById(memberId),
    getAllSalesMembers(),
    getSalesSettings(),
  ]);
  if (!member) throw new Error('Salesman not found');

  const newCode = generateUniqueReferralCode(
    member.fullName,
    allMembers.map((m) => m.referralCode)
  );
  const newLink = buildReferralLink(newCode, settings.portalBaseUrl);
  const now = new Date().toISOString();

  const batch = writeBatch(db);
  batch.update(doc(db, 'salesMembers', memberId), {
    referralCode: newCode,
    referralLink: newLink,
    updatedAt: now,
  });
  if (member.referralCode) {
    batch.delete(doc(db, 'salesReferralIndex', member.referralCode));
  }
  batch.set(doc(db, 'salesReferralIndex', newCode), {
    referralCode: newCode,
    salesmanId: member.id,
    salesmanUid: member.uid || null,
    salesmanName: member.fullName,
    accountStatus: member.accountStatus,
    qrScanCount: member.qrScanCount || 0,
    updatedAt: now,
  });
  await batch.commit();

  await logSalesAudit({
    action: 'Regenerated Referral Code',
    entityType: 'qr_code',
    entityId: memberId,
    previousValue: member.referralCode,
    newValue: newCode,
    details: `Changed referral code for ${member.fullName} from ${member.referralCode} to ${newCode}`,
  });

  return { referralCode: newCode, referralLink: newLink };
}

// ====================================================
// SALES TEAMS
// ====================================================

export async function getAllSalesTeams(): Promise<SalesTeam[]> {
  try {
    const snap = await getDocs(collection(db, 'salesTeams'));
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesTeam), id: d.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'salesTeams');
  }
}

export async function saveSalesTeam(team: Partial<SalesTeam>): Promise<string> {
  const id = team.id || `team_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const payload = stripUndef<SalesTeam>({
    id,
    name: String(team.name || 'Regional Sales Team').trim(),
    managerMemberId: String(team.managerMemberId || ''),
    managerUid: team.managerUid,
    managerName: String(team.managerName || 'Unassigned'),
    territory: String(team.territory || 'Pakistan'),
    cities: Array.isArray(team.cities) ? team.cities.slice(0, 30) : [],
    memberIds: Array.isArray(team.memberIds) ? team.memberIds.slice(0, 50) : [],
    monthlyTeamTarget: Math.max(0, Number(team.monthlyTeamTarget) || 0),
    description: team.description,
    isActive: team.isActive !== false,
    createdAt: team.createdAt || now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'salesTeams', id), payload, { merge: true });
    await logSalesAudit({
      action: team.id ? 'Updated Sales Team' : 'Created Sales Team',
      entityType: 'sales_team',
      entityId: id,
      details: `${payload.name} (Manager: ${payload.managerName}, Territory: ${payload.territory})`,
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `salesTeams/${id}`);
  }
}

export async function deleteSalesTeam(teamId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'salesTeams', teamId));
    await logSalesAudit({
      action: 'Deleted Sales Team',
      entityType: 'sales_team',
      entityId: teamId,
      details: `Removed sales team ${teamId}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `salesTeams/${teamId}`);
  }
}

// ====================================================
// SALES LEADS & DUPLICATE GUARD
// ====================================================

export async function getAllSalesLeads(): Promise<SalesLead[]> {
  try {
    const snap = await getDocs(collection(db, 'salesLeads'));
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesLead), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'salesLeads');
  }
}

export async function getSalesMembersForManager(managerUid: string): Promise<SalesMember[]> {
  try {
    const q = query(collection(db, 'salesMembers'), where('assignedManagerUid', '==', managerUid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as SalesMember), id: d.id }));
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesMembers');
  }
}

export async function getSalesLeadsForSalesman(salesmanId: string, uid?: string): Promise<SalesLead[]> {
  try {
    const q = uid
      ? query(collection(db, 'salesLeads'), where('assignedSalesmanUid', '==', uid))
      : query(collection(db, 'salesLeads'), where('assignedSalesmanId', '==', salesmanId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesLead), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesLeads');
  }
}

export async function getSalesLeadsForManager(managerMemberIdOrUid: string, isUid = false): Promise<SalesLead[]> {
  try {
    const field = isUid ? 'assignedManagerUid' : 'assignedManagerId';
    const q = query(collection(db, 'salesLeads'), where(field, '==', managerMemberIdOrUid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesLead), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesLeads');
  }
}

export function detectDuplicateLead(
  candidate: { businessName: string; phone: string; email?: string; city: string },
  existingLeads: SalesLead[]
): { match: SalesLead; reason: string } | null {
  const normPhone = normalizePhoneForMatch(candidate.phone);
  const normEmail = String(candidate.email || '').trim().toLowerCase();
  const normBiz = candidate.businessName.trim().toLowerCase();
  const normCity = candidate.city.trim().toLowerCase();

  for (const lead of existingLeads) {
    if (normPhone && lead.normalizedPhone === normPhone) {
      return { match: lead, reason: `Matching phone number (${lead.phone})` };
    }
    if (normEmail && lead.normalizedEmail && lead.normalizedEmail === normEmail) {
      return { match: lead, reason: `Matching email (${lead.email})` };
    }
    if (normBiz && lead.businessName.trim().toLowerCase() === normBiz && lead.city.trim().toLowerCase() === normCity) {
      return { match: lead, reason: `Matching business "${lead.businessName}" in ${lead.city}` };
    }
  }
  return null;
}

export async function createSalesLead(
  input: {
    businessName: string;
    ownerName: string;
    phone: string;
    email?: string;
    city: string;
    industry: BusinessType;
    businessAddress?: string;
    assignedSalesmanId?: string;
    assignedSalesmanUid?: string;
    assignedSalesmanName?: string;
    assignedManagerId?: string;
    assignedManagerUid?: string;
    leadSource: SalesLeadSource;
    expectedPlanId?: string;
    expectedPlanName?: string;
    nextFollowUpDate?: string;
    notes?: string;
    status?: SalesLeadStatus;
    duplicateResolutionNote?: string;
    allowDuplicateOverride?: boolean;
  },
  existingLeadsCache?: SalesLead[]
): Promise<SalesLead> {
  const normalizedPhone = normalizePhoneForMatch(input.phone);
  const normalizedEmail = String(input.email || '').trim().toLowerCase() || undefined;

  if (!input.allowDuplicateOverride) {
    const existing = existingLeadsCache || (await getAllSalesLeads());
    const dup = detectDuplicateLead(
      {
        businessName: input.businessName,
        phone: input.phone,
        email: input.email,
        city: input.city,
      },
      existing
    );
    if (dup) {
      const err: any = new Error(`Duplicate lead detected: ${dup.reason} (Lead ID: ${dup.match.id}). Use Duplicate Resolution to merge or override.`);
      err.duplicateMatch = dup.match;
      err.duplicateReason = dup.reason;
      throw err;
    }
  }

  const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const status: SalesLeadStatus =
    input.status || (input.assignedSalesmanId ? 'Assigned' : 'New');

  const lead = stripUndef<SalesLead>({
    id,
    businessName: input.businessName.trim(),
    ownerName: input.ownerName.trim(),
    phone: input.phone.trim(),
    normalizedPhone,
    email: normalizedEmail,
    normalizedEmail,
    city: input.city.trim(),
    industry: input.industry || 'general_store',
    businessAddress: input.businessAddress?.trim() || undefined,
    assignedSalesmanId: input.assignedSalesmanId || undefined,
    assignedSalesmanUid: input.assignedSalesmanUid || undefined,
    assignedSalesmanName: input.assignedSalesmanName || undefined,
    assignedManagerId: input.assignedManagerId || undefined,
    assignedManagerUid: input.assignedManagerUid || undefined,
    leadSource: input.leadSource || 'field_visit',
    expectedPlanId: input.expectedPlanId || undefined,
    expectedPlanName: input.expectedPlanName || undefined,
    nextFollowUpDate: input.nextFollowUpDate || undefined,
    notes: input.notes?.trim() || undefined,
    status,
    duplicateResolutionNote: input.duplicateResolutionNote,
    createdBy: auth.currentUser?.email || 'Super Admin',
    createdAt: now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'salesLeads', id), lead);
    if (lead.assignedSalesmanId) {
      await createSalesNotification({
        recipientSalesmanId: lead.assignedSalesmanId,
        recipientUid: lead.assignedSalesmanUid,
        type: 'lead_assigned',
        title: `New Lead Assigned: ${lead.businessName}`,
        message: `${lead.ownerName} (${lead.city}) assigned for follow-up.`,
        link: '/salesman/leads',
      });
    }
    await logSalesAudit({
      action: 'Created Sales Lead',
      entityType: 'sales_lead',
      entityId: id,
      details: `${lead.businessName} (${lead.city}) · Assigned to: ${lead.assignedSalesmanName || 'Unassigned'}`,
    });
    return lead;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `salesLeads/${id}`);
  }
}

export async function updateSalesLead(leadId: string, patch: Partial<SalesLead>): Promise<void> {
  try {
    const cleanPatch = stripUndef<Partial<SalesLead>>({
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    if (patch.phone !== undefined) {
      cleanPatch.normalizedPhone = normalizePhoneForMatch(patch.phone);
    }
    if (patch.email !== undefined) {
      cleanPatch.normalizedEmail = patch.email.trim().toLowerCase() || undefined;
    }
    delete (cleanPatch as any).id;

    await updateDoc(doc(db, 'salesLeads', leadId), cleanPatch);

    if (patch.assignedSalesmanId) {
      await createSalesNotification({
        recipientSalesmanId: patch.assignedSalesmanId,
        recipientUid: patch.assignedSalesmanUid,
        type: 'lead_assigned',
        title: `Lead Assigned: ${patch.businessName || leadId}`,
        message: `You have been assigned a lead${patch.nextFollowUpDate ? ` · Follow-up: ${patch.nextFollowUpDate}` : ''}.`,
        link: '/salesman/leads',
      });
    }
    await logSalesAudit({
      action: 'Updated Sales Lead',
      entityType: 'sales_lead',
      entityId: leadId,
      details: `Updated lead ${leadId}: ${Object.keys(patch).join(', ')}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `salesLeads/${leadId}`);
  }
}

export async function bulkAssignLeads(
  leadIds: string[],
  salesman: Pick<SalesMember, 'id' | 'uid' | 'fullName' | 'assignedManagerId' | 'assignedManagerUid'>
): Promise<void> {
  if (leadIds.length === 0) return;
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    for (const lid of leadIds) {
      batch.update(doc(db, 'salesLeads', lid), {
        assignedSalesmanId: salesman.id,
        assignedSalesmanUid: salesman.uid || null,
        assignedSalesmanName: salesman.fullName,
        assignedManagerId: salesman.assignedManagerId || null,
        assignedManagerUid: salesman.assignedManagerUid || null,
        status: 'Assigned',
        updatedAt: now,
      });
    }
    await batch.commit();
    await createSalesNotification({
      recipientSalesmanId: salesman.id,
      recipientUid: salesman.uid,
      type: 'lead_assigned',
      title: `${leadIds.length} Lead(s) Assigned`,
      message: `${leadIds.length} business lead(s) were assigned to you.`,
      link: '/salesman/leads',
    });
    await logSalesAudit({
      action: 'Assigned Leads',
      entityType: 'sales_lead',
      entityId: salesman.id,
      details: `Assigned ${leadIds.length} lead(s) to ${salesman.fullName}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'salesLeads');
  }
}

export async function importLeadsFromCsvText(
  csvText: string,
  options: { assignTo?: SalesMember; skipDuplicates?: boolean } = {}
): Promise<{ imported: number; skippedDuplicates: { row: number; businessName: string; reason: string }[] }> {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least 1 data row.');
  }

  const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const col = (r: string[], ...names: string[]) => {
    for (const n of names) {
      const idx = headers.indexOf(n);
      if (idx >= 0 && r[idx]) return r[idx].trim();
    }
    return '';
  };

  const existing = await getAllSalesLeads();
  let imported = 0;
  const skippedDuplicates: { row: number; businessName: string; reason: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const businessName = col(r, 'businessname', 'business', 'shopname', 'name');
    const ownerName = col(r, 'ownername', 'owner', 'contactname') || businessName;
    const phone = col(r, 'phone', 'mobile', 'whatsapp', 'contact');
    const email = col(r, 'email');
    const city = col(r, 'city') || 'Karachi';
    const rawIndustry = col(r, 'industry', 'businesstype', 'category').toLowerCase();
    const industry: BusinessType = isKnownBusinessType(rawIndustry)
      ? rawIndustry
      : 'general_store';

    if (!businessName || !phone) continue;

    const dup = detectDuplicateLead({ businessName, phone, email, city }, existing);
    if (dup) {
      skippedDuplicates.push({ row: i + 1, businessName, reason: dup.reason });
      if (options.skipDuplicates !== false) continue;
    }

    const created = await createSalesLead(
      {
        businessName,
        ownerName,
        phone,
        email,
        city,
        industry,
        businessAddress: col(r, 'businessaddress', 'address'),
        assignedSalesmanId: options.assignTo?.id,
        assignedSalesmanUid: options.assignTo?.uid,
        assignedSalesmanName: options.assignTo?.fullName,
        assignedManagerId: options.assignTo?.assignedManagerId,
        assignedManagerUid: options.assignTo?.assignedManagerUid,
        leadSource: 'csv_import',
        nextFollowUpDate: col(r, 'nextfollowupdate', 'followupdate') || undefined,
        notes: col(r, 'notes'),
        allowDuplicateOverride: true,
      },
      existing
    );
    existing.push(created);
    imported++;
  }

  return { imported, skippedDuplicates };
}

// ====================================================
// SALES ACTIVITIES
// ====================================================

export async function getAllSalesActivities(): Promise<SalesActivity[]> {
  try {
    const q = query(collection(db, 'salesActivities'), orderBy('activityDateTime', 'desc'), limit(250));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as SalesActivity), id: d.id }));
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesActivities');
  }
}

export async function getSalesActivitiesBySalesman(salesmanId: string, uid?: string): Promise<SalesActivity[]> {
  try {
    const q = uid
      ? query(collection(db, 'salesActivities'), where('salesmanUid', '==', uid))
      : query(collection(db, 'salesActivities'), where('salesmanId', '==', salesmanId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesActivity), id: d.id }))
      .sort((a, b) => new Date(b.activityDateTime).getTime() - new Date(a.activityDateTime).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesActivities');
  }
}

export async function recordSalesActivity(input: Omit<SalesActivity, 'id' | 'createdAt'>): Promise<SalesActivity> {
  const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const payload = stripUndef<SalesActivity>({
    ...input,
    id,
    createdAt: now,
  });

  try {
    await setDoc(doc(db, 'salesActivities', id), payload);
    await updateDoc(doc(db, 'salesMembers', input.salesmanId), {
      lastActivityAt: now,
      updatedAt: now,
    }).catch(() => {});

    if (input.leadId) {
      const leadPatch: Partial<SalesLead> = {
        lastContactAt: input.activityDateTime,
        updatedAt: now,
      };
      if (input.nextFollowUpDate) leadPatch.nextFollowUpDate = input.nextFollowUpDate;
      if (input.resultStatus === 'converted') leadPatch.status = 'Converted';
      else if (input.resultStatus === 'follow_up_needed') leadPatch.status = 'Follow-up Required';
      await updateDoc(doc(db, 'salesLeads', input.leadId), stripUndef(leadPatch)).catch(() => {});
    }

    await logSalesAudit({
      action: 'Logged Sales Activity',
      entityType: 'sales_activity',
      entityId: id,
      actorRole: 'salesman',
      details: `${input.salesmanName}: ${input.activityType}${input.leadName ? ` for ${input.leadName}` : ''} (${input.resultStatus})`,
    });

    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `salesActivities/${id}`);
  }
}

// ====================================================
// SALES TARGETS
// ====================================================

export async function getAllSalesTargets(): Promise<SalesTarget[]> {
  try {
    const snap = await getDocs(collection(db, 'salesTargets'));
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesTarget), id: d.id }))
      .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesTargets');
  }
}

export async function getSalesTargetsForMember(salesmanId: string, uid?: string): Promise<SalesTarget[]> {
  try {
    const q = uid
      ? query(collection(db, 'salesTargets'), where('salesmanUid', '==', uid))
      : query(collection(db, 'salesTargets'), where('salesmanId', '==', salesmanId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as SalesTarget), id: d.id }));
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesTargets');
  }
}

export async function saveSalesTarget(input: Omit<SalesTarget, 'id' | 'createdAt' | 'updatedBy'> & { id?: string }): Promise<SalesTarget> {
  const id = input.id || `tgt_${input.salesmanId}_${input.periodKey}`;
  const now = new Date().toISOString();
  const payload = stripUndef<SalesTarget>({
    ...input,
    id,
    dailyActivityTarget: Math.max(0, Number(input.dailyActivityTarget) || 0),
    weeklyLeadTarget: Math.max(0, Number(input.weeklyLeadTarget) || 0),
    monthlyRegistrationTarget: Math.max(0, Number(input.monthlyRegistrationTarget) || 0),
    monthlyPaidSubscriptionTarget: Math.max(0, Number(input.monthlyPaidSubscriptionTarget) || 0),
    revenueTarget: Math.max(0, Number(input.revenueTarget) || 0),
    conversionTarget: Math.max(0, Number(input.conversionTarget) || 0),
    bonusAmount: Math.max(0, Number(input.bonusAmount) || 0),
    bonusThresholdPct: Math.max(1, Number(input.bonusThresholdPct) || 100),
    updatedBy: auth.currentUser?.email || 'Super Admin',
    createdAt: now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'salesTargets', id), payload, { merge: true });
    await logSalesAudit({
      action: 'Updated Sales Targets',
      entityType: 'sales_target',
      entityId: id,
      details: `Targets for ${payload.salesmanName} (${payload.periodKey}): Reg=${payload.monthlyRegistrationTarget}, Paid=${payload.monthlyPaidSubscriptionTarget}, Rev=${payload.revenueTarget}`,
    });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `salesTargets/${id}`);
  }
}

// ====================================================
// REFERRALS, QR TRACKING & SELF-REFERRAL GUARD
// ====================================================

export async function getAllReferralAttributions(): Promise<ReferralAttribution[]> {
  try {
    const snap = await getDocs(collection(db, 'referralAttributions'));
    return snap.docs
      .map((d) => ({ ...(d.data() as ReferralAttribution), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'referralAttributions');
  }
}

export async function getReferralsForSalesman(salesmanId: string, uid?: string): Promise<ReferralAttribution[]> {
  try {
    const q = uid
      ? query(collection(db, 'referralAttributions'), where('salesmanUid', '==', uid))
      : query(collection(db, 'referralAttributions'), where('salesmanId', '==', salesmanId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as ReferralAttribution), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'referralAttributions');
  }
}

export interface PublicReferralOwner {
  referralCode: string;
  salesmanId: string;
  salesmanUid?: string | null;
  salesmanName: string;
  accountStatus: SalesAccountStatus;
  qrScanCount: number;
  email?: string;
  phone?: string;
}

export async function getReferralCodeOwner(referralCode: string): Promise<PublicReferralOwner | null> {
  const cleanCode = referralCode.trim().toUpperCase();
  if (!cleanCode) return null;
  try {
    const idxSnap = await getDoc(doc(db, 'salesReferralIndex', cleanCode));
    if (idxSnap.exists()) {
      const d = idxSnap.data() as PublicReferralOwner;
      return { ...d, referralCode: cleanCode };
    }
    if (!auth.currentUser) return null;
    // Authorized fallback for authenticated users referencing legacy members not yet mirrored
    const q = query(collection(db, 'salesMembers'), where('referralCode', '==', cleanCode), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const m = { ...(snap.docs[0].data() as SalesMember), id: snap.docs[0].id };
    return {
      referralCode: m.referralCode,
      salesmanId: m.id,
      salesmanUid: m.uid || null,
      salesmanName: m.fullName,
      accountStatus: m.accountStatus,
      qrScanCount: m.qrScanCount || 0,
      email: m.email,
      phone: m.phone,
    };
  } catch {
    return null;
  }
}

export function clearStoredReferralContext(): void {
  try {
    localStorage.removeItem('sbkhush_ref_code');
    localStorage.removeItem('sbkhush_ref_source');
    localStorage.removeItem('sbkhush_ref_captured_at');
    localStorage.removeItem('bazaarpk_ref_code');
    localStorage.removeItem('bazaarpk_ref_source');
  } catch {}
}

export function getStoredReferralContext(
  windowDays: number = DEFAULT_SALES_SETTINGS.attributionWindowDays
): {
  code: string;
  source: 'qr_scan' | 'referral_link' | 'code_entry';
  capturedAt?: string;
  expired: boolean;
} {
  try {
    const code = (
      localStorage.getItem('sbkhush_ref_code') ||
      localStorage.getItem('bazaarpk_ref_code') ||
      ''
    )
      .trim()
      .toUpperCase();
    if (!code) {
      return { code: '', source: 'code_entry', expired: false };
    }
    const rawSource =
      localStorage.getItem('sbkhush_ref_source') || localStorage.getItem('bazaarpk_ref_source');
    const source: 'qr_scan' | 'referral_link' | 'code_entry' =
      rawSource === 'qr_scan' || rawSource === 'referral_link' ? rawSource : 'code_entry';
    const capturedAt = localStorage.getItem('sbkhush_ref_captured_at') || undefined;
    if (capturedAt) {
      const capturedMs = Date.parse(capturedAt);
      const maxAgeMs = Math.max(1, windowDays) * 24 * 60 * 60 * 1000;
      if (Number.isFinite(capturedMs) && Date.now() - capturedMs > maxAgeMs) {
        clearStoredReferralContext();
        return { code: '', source: 'code_entry', expired: true };
      }
    }
    return { code, source, capturedAt, expired: false };
  } catch {
    return { code: '', source: 'code_entry', expired: false };
  }
}

export async function trackQrScan(referralCode: string, source: 'qr_scan' | 'referral_link' = 'qr_scan'): Promise<PublicReferralOwner | null> {
  const cleanCode = referralCode.trim().toUpperCase();
  if (!cleanCode) return null;
  try {
    const nowIso = new Date().toISOString();
    const todayYmd = nowIso.slice(0, 10);
    const dedupKey = `sbkhush_qr_scanned_${cleanCode}_${todayYmd}`;
    let alreadyScannedToday = false;

    try {
      localStorage.setItem('sbkhush_ref_code', cleanCode);
      localStorage.setItem('sbkhush_ref_source', source);
      localStorage.setItem('sbkhush_ref_captured_at', nowIso);
      localStorage.setItem('bazaarpk_ref_code', cleanCode);
      localStorage.setItem('bazaarpk_ref_source', source);
      alreadyScannedToday = localStorage.getItem(dedupKey) === '1';
    } catch {}

    if (alreadyScannedToday) {
      return await getReferralCodeOwner(cleanCode);
    }

    const apiRes = await trySalesApi<{ owner: PublicReferralOwner | null; deduplicated?: boolean }>(
      '/api/sales/qr/track',
      'POST',
      { referralCode: cleanCode, source }
    ).catch(() => null);
    if (apiRes?.owner) {
      try {
        localStorage.setItem(dedupKey, '1');
      } catch {}
      return apiRes.owner;
    }

    const owner = await getReferralCodeOwner(cleanCode);
    if (owner && owner.accountStatus === 'active') {
      const evtId = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await setDoc(doc(db, 'salesQrEvents', evtId), {
        id: evtId,
        salesmanId: owner.salesmanId,
        referralCode: cleanCode,
        source,
        createdAt: nowIso,
      }).catch(() => {});
      try {
        localStorage.setItem(dedupKey, '1');
      } catch {}
    }
    return owner;
  } catch {
    return null;
  }
}

export async function getAllSalesQrEvents(): Promise<SalesQrEvent[]> {
  try {
    const q = query(collection(db, 'salesQrEvents'), orderBy('createdAt', 'desc'), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as SalesQrEvent), id: d.id }));
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesQrEvents');
  }
}

export async function recordReferralAttribution(input: {
  referralCode: string;
  shopId: string;
  shopSlug: string;
  shopName: string;
  ownerId: string;
  ownerEmail: string;
  ownerPhone?: string;
  city?: string;
  industry?: BusinessType;
  leadId?: string;
  source?: ReferralAttribution['source'];
  capturedAt?: string;
}): Promise<ReferralAttribution | null> {
  const cleanCode = input.referralCode.trim().toUpperCase();
  if (!cleanCode) return null;

  const settings = await getSalesSettings();
  const windowDays = Math.max(1, Number(settings.attributionWindowDays) || 30);
  if (input.capturedAt) {
    const capturedMs = Date.parse(input.capturedAt);
    if (Number.isFinite(capturedMs) && Date.now() - capturedMs > windowDays * 24 * 60 * 60 * 1000) {
      clearStoredReferralContext();
      return null;
    }
  }

  const apiRes = await trySalesApi<{ attribution: ReferralAttribution | null }>(
    '/api/sales/referrals/record',
    'POST',
    { ...input, referralCode: cleanCode }
  ).catch(() => null);
  if (apiRes?.attribution) return apiRes.attribution;

  const salesman = await getReferralCodeOwner(cleanCode);
  if (!salesman || salesman.accountStatus !== 'active') {
    return null;
  }

  // Duplicate attribution guard (1 shop = max 1 attribution doc keyed by shopId)
  const attrRef = doc(db, 'referralAttributions', input.shopId);
  const existingAttr = await getDoc(attrRef).catch(() => null);
  if (existingAttr?.exists()) {
    return null;
  }

  // Self-referral protection
  const isSelfReferral =
    settings.preventSelfReferral &&
    (Boolean(salesman.salesmanUid && salesman.salesmanUid === input.ownerId) ||
      Boolean(salesman.email && salesman.email.toLowerCase() === input.ownerEmail.trim().toLowerCase()) ||
      Boolean(
        salesman.phone &&
          input.ownerPhone &&
          normalizePhoneForMatch(salesman.phone) === normalizePhoneForMatch(input.ownerPhone)
      ));

  const now = new Date().toISOString();
  const payload = stripUndef<ReferralAttribution>({
    id: input.shopId,
    referralCode: cleanCode,
    salesmanId: salesman.salesmanId,
    salesmanUid: salesman.salesmanUid || undefined,
    salesmanName: salesman.salesmanName,
    shopId: input.shopId,
    shopSlug: input.shopSlug,
    shopName: input.shopName,
    ownerId: input.ownerId,
    ownerEmail: input.ownerEmail.trim().toLowerCase(),
    ownerPhone: input.ownerPhone,
    city: input.city,
    industry: input.industry,
    leadId: input.leadId,
    source: input.source || 'referral_link',
    attributionStatus: isSelfReferral ? 'rejected_self_referral' : 'registered',
    totalRevenueGenerated: 0,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(attrRef, payload);

  if (input.leadId && !isSelfReferral) {
    await updateDoc(doc(db, 'salesLeads', input.leadId), {
      status: 'Converted',
      convertedShopId: input.shopId,
      convertedShopSlug: input.shopSlug,
      updatedAt: now,
    }).catch(() => {});
  }

  await createSalesNotification({
    recipientSalesmanId: salesman.salesmanId,
    recipientUid: salesman.salesmanUid || undefined,
    type: isSelfReferral ? 'commission_rejected' : 'shop_registered',
    title: isSelfReferral
      ? `Self-Referral Blocked: ${input.shopName}`
      : `Referred Shop Registered: ${input.shopName}`,
    message: isSelfReferral
      ? `Registration of ${input.shopName} matched your own identity and is ineligible for commission.`
      : `${input.shopName} (${input.city || ''}) signed up using code ${cleanCode}.`,
    link: '/salesman/referrals',
  });

  await logSalesAudit({
    action: isSelfReferral ? 'Blocked Self-Referral' : 'Recorded Referral Attribution',
    entityType: 'referral',
    entityId: input.shopId,
    details: `${input.shopName} -> ${salesman.salesmanName} (${cleanCode}) · Status: ${payload.attributionStatus}`,
  });

  return payload;
}

// ====================================================
// CENTRALIZED SERVER-VERIFIED COMMISSION & PAYOUT ENGINE
// ====================================================

export function calculateCommissionForPayment(params: {
  paymentAmount: number;
  billingCycle: BillingCycle;
  member: Pick<SalesMember, 'commissionPlanId'>;
  settings: SalesSettings;
  isRenewal?: boolean;
}): { ratePct: number; flatBonusAmount: number; commissionAmount: number; commissionType: CommissionLedgerEntry['commissionType'] } {
  const tier =
    params.settings.commissionPlans.find((t) => t.id === params.member.commissionPlanId) ||
    params.settings.commissionPlans[0] ||
    DEFAULT_COMMISSION_PLANS[0];

  const baseRate = params.isRenewal ? tier.renewalRatePct : tier.firstSubRatePct;
  const yearlyBonus = params.billingCycle === 'yearly' ? tier.yearlyPlanBonusPct : 0;
  const ratePct = Math.max(0, baseRate + yearlyBonus);
  const flatBonusAmount = params.isRenewal ? 0 : Math.max(0, Number(tier.verifiedShopBonus) || 0);
  const percentagePart = Math.round((Math.max(0, params.paymentAmount) * ratePct) / 100);

  return {
    ratePct,
    flatBonusAmount,
    commissionAmount: percentagePart + flatBonusAmount,
    commissionType: params.isRenewal ? 'subscription_renewal' : 'subscription_first',
  };
}

export async function syncCommissionForApprovedPayment(paymentId: string): Promise<CommissionLedgerEntry | null> {
  // Prefer authoritative Express server endpoint when available
  const apiRes = await trySalesApi<{ entry: CommissionLedgerEntry | null }>(
    '/api/sales/commissions/sync',
    'POST',
    { paymentId }
  ).catch(() => null);
  if (apiRes) return apiRes.entry;

  const paySnap = await getDoc(doc(db, 'platform_payments', paymentId));
  if (!paySnap.exists()) return null;
  const payment = { ...(paySnap.data() as PlatformPayment), id: paySnap.id };
  if (payment.status !== 'approved' || Number(payment.amount) <= 0) return null;

  const attrSnap = await getDoc(doc(db, 'referralAttributions', payment.shopId));
  if (!attrSnap.exists()) return null;
  const attr = attrSnap.data() as ReferralAttribution;
  if (attr.attributionStatus === 'rejected_self_referral' || attr.attributionStatus === 'duplicate_blocked') {
    return null;
  }

  const ledgerId = `comm_${paymentId}`;
  const existingLedgerSnap = await getDoc(doc(db, 'commissionLedger', ledgerId));
  if (existingLedgerSnap.exists()) {
    return { ...(existingLedgerSnap.data() as CommissionLedgerEntry), id: ledgerId };
  }

  const [member, settings] = await Promise.all([
    getSalesMemberById(attr.salesmanId),
    getSalesSettings(),
  ]);
  if (!member) return null;

  const isRenewal = Boolean(attr.firstPaymentId && attr.firstPaymentId !== paymentId);
  const calc = calculateCommissionForPayment({
    paymentAmount: Number(payment.amount),
    billingCycle: payment.billingCycle,
    member,
    settings,
    isRenewal,
  });

  const now = new Date().toISOString();
  const entry = stripUndef<CommissionLedgerEntry>({
    id: ledgerId,
    salesmanId: member.id,
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
    commissionRatePct: calc.ratePct,
    flatBonusAmount: calc.flatBonusAmount,
    commissionAmount: calc.commissionAmount,
    commissionType: calc.commissionType,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  await runTransaction(db, async (tx) => {
    const checkSnap = await tx.get(doc(db, 'commissionLedger', ledgerId));
    if (checkSnap.exists()) return;
    tx.set(doc(db, 'commissionLedger', ledgerId), entry);
    tx.update(doc(db, 'referralAttributions', attr.id), {
      attributionStatus: 'subscribed',
      firstPaymentId: attr.firstPaymentId || paymentId,
      totalRevenueGenerated: Number(attr.totalRevenueGenerated || 0) + Number(payment.amount),
      updatedAt: now,
    });
  });

  await createSalesNotification({
    recipientSalesmanId: member.id,
    recipientUid: member.uid,
    type: 'subscription_paid',
    title: `Subscription Commission Generated: ${formatPKRStr(entry.commissionAmount)}`,
    message: `${payment.shopName} paid ${formatPKRStr(payment.amount)} (${payment.planName}). Pending Super Admin verification.`,
    link: '/salesman/commissions',
  });

  await logSalesAudit({
    action: 'Generated Commission Entry',
    entityType: 'commission',
    entityId: ledgerId,
    details: `${member.fullName}: Rs. ${entry.commissionAmount} (${entry.commissionRatePct}% + Rs. ${entry.flatBonusAmount}) on ${payment.shopName} [${paymentId}]`,
  });

  return entry;
}

export async function verifyReferralAttributionOnShopActivation(shopId: string): Promise<void> {
  try {
    const attrRef = doc(db, 'referralAttributions', shopId);
    const snap = await getDoc(attrRef);
    if (!snap.exists()) return;
    const attr = snap.data() as ReferralAttribution;
    if (attr.attributionStatus === 'registered') {
      await updateDoc(attrRef, {
        attributionStatus: 'verified',
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {}
}

export async function reverseCommissionForPayment(paymentId: string, reason: string): Promise<void> {
  try {
    const ledgerId = `comm_${paymentId}`;
    const snap = await getDoc(doc(db, 'commissionLedger', ledgerId));
    if (!snap.exists()) return;
    const entry = snap.data() as CommissionLedgerEntry;
    if (entry.status === 'pending' || entry.status === 'approved' || entry.status === 'paid') {
      await updateCommissionDecision({
        commissionId: ledgerId,
        decision: 'reversed',
        reason: reason || 'Subscription payment rejected/refunded.',
      });
    }
  } catch {}
}

function formatPKRStr(val: number): string {
  return `Rs. ${Math.round(Number(val) || 0).toLocaleString('en-PK')}`;
}

export async function getAllCommissionLedger(): Promise<CommissionLedgerEntry[]> {
  try {
    const snap = await getDocs(collection(db, 'commissionLedger'));
    return snap.docs
      .map((d) => ({ ...(d.data() as CommissionLedgerEntry), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'commissionLedger');
  }
}

export async function getCommissionsForSalesman(salesmanId: string, uid?: string): Promise<CommissionLedgerEntry[]> {
  try {
    const q = uid
      ? query(collection(db, 'commissionLedger'), where('salesmanUid', '==', uid))
      : query(collection(db, 'commissionLedger'), where('salesmanId', '==', salesmanId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as CommissionLedgerEntry), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'commissionLedger');
  }
}

export async function updateCommissionDecision(params: {
  commissionId: string;
  decision: 'approved' | 'rejected' | 'reversed';
  reason?: string;
}): Promise<void> {
  const apiRes = await trySalesApi<{ ok: boolean }>('/api/sales/commissions/decision', 'POST', params).catch((e) => {
    throw e;
  });
  if (apiRes) return;

  const reviewer = auth.currentUser?.email || 'Super Admin';
  const now = new Date().toISOString();

  const updatedCur = await runTransaction(db, async (tx) => {
    const ref = doc(db, 'commissionLedger', params.commissionId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Commission ledger entry not found.');
    const cur = snap.data() as CommissionLedgerEntry;

    if (params.decision === 'approved' && cur.status !== 'pending') {
      throw new Error(`Only pending commissions can be approved (current: ${cur.status}).`);
    }
    if (params.decision === 'rejected' && cur.status !== 'pending') {
      throw new Error(`Only pending commissions can be rejected (current: ${cur.status}).`);
    }
    if (params.decision === 'reversed' && !['pending', 'approved', 'paid'].includes(cur.status)) {
      throw new Error(`Commission is already ${cur.status}.`);
    }

    const patch: Record<string, any> = {
      status: params.decision,
      updatedAt: now,
    };
    if (params.decision === 'approved') {
      patch.approvedBy = reviewer;
      patch.approvedAt = now;
    } else if (params.decision === 'rejected') {
      patch.rejectionReason = params.reason || 'Rejected by Super Admin review.';
      patch.approvedBy = reviewer;
      patch.approvedAt = now;
    } else if (params.decision === 'reversed') {
      patch.reversalReason = params.reason || 'Reversed due to subscription refund/chargeback.';
      patch.reversedBy = reviewer;
      patch.reversedAt = now;
    }

    tx.update(ref, patch);
    return cur;
  });

  await createSalesNotification({
    recipientSalesmanId: updatedCur.salesmanId,
    recipientUid: updatedCur.salesmanUid,
    type: params.decision === 'approved' ? 'commission_approved' : 'commission_rejected',
    title: `Commission ${params.decision.toUpperCase()}: ${formatPKRStr(updatedCur.commissionAmount)}`,
    message:
      params.decision === 'approved'
        ? `Commission for ${updatedCur.shopName} approved and queued for payout.`
        : `Commission for ${updatedCur.shopName} ${params.decision}: ${params.reason || ''}`,
    link: '/salesman/commissions',
  });

  await logSalesAudit({
    action: `Commission ${params.decision}`,
    entityType: 'commission',
    entityId: params.commissionId,
    previousValue: updatedCur.status,
    newValue: params.decision,
    details: `${updatedCur.salesmanName} · ${updatedCur.shopName} (${formatPKRStr(updatedCur.commissionAmount)}) · ${params.reason || 'Verified'}`,
  });
}

export async function recordManualPayout(input: {
  salesman: SalesMember;
  ledgerEntryIds: string[];
  method: PayoutMethod;
  accountTitle: string;
  accountNumber: string;
  bankName?: string;
  transactionReference: string;
  notes?: string;
}): Promise<CommissionPayout> {
  if (input.ledgerEntryIds.length === 0) {
    throw new Error('Select at least one approved commission entry to settle.');
  }
  if (!input.transactionReference.trim()) {
    throw new Error('Transaction reference (TID / Reference ID) is required.');
  }

  const apiRes = await trySalesApi<{ payout: CommissionPayout }>('/api/sales/payouts', 'POST', {
    salesmanId: input.salesman.id,
    ledgerEntryIds: input.ledgerEntryIds,
    method: input.method,
    accountTitle: input.accountTitle,
    accountNumber: input.accountNumber,
    bankName: input.bankName,
    transactionReference: input.transactionReference,
    notes: input.notes,
  }).catch((e) => {
    throw e;
  });
  if (apiRes) return apiRes.payout;

  const now = new Date().toISOString();
  const payoutId = `pay_sls_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const payoutNumber = `PAY-SLS-${Math.floor(100000 + Math.random() * 900000)}`;
  const processor = auth.currentUser?.email || 'Super Admin';

  let computedTotal = 0;
  await runTransaction(db, async (tx) => {
    const ledgerSnaps = [];
    for (const cid of input.ledgerEntryIds) {
      const snap = await tx.get(doc(db, 'commissionLedger', cid));
      if (!snap.exists()) throw new Error(`Commission entry ${cid} does not exist.`);
      const data = snap.data() as CommissionLedgerEntry;
      if (data.salesmanId !== input.salesman.id) {
        throw new Error('Selected commission entries do not belong to the target salesman.');
      }
      if (data.status !== 'approved') {
        throw new Error(`Commission ${cid} must be approved before payout (status: ${data.status}).`);
      }
      computedTotal += Number(data.commissionAmount) || 0;
      ledgerSnaps.push(cid);
    }

    const payoutPayload = stripUndef<CommissionPayout>({
      id: payoutId,
      payoutNumber,
      salesmanId: input.salesman.id,
      salesmanUid: input.salesman.uid,
      salesmanName: input.salesman.fullName,
      salesmanEmail: input.salesman.email,
      ledgerEntryIds: ledgerSnaps,
      totalAmount: computedTotal,
      method: input.method,
      accountTitle: input.accountTitle.trim(),
      accountNumber: input.accountNumber.trim(),
      bankName: input.bankName?.trim() || undefined,
      transactionReference: input.transactionReference.trim(),
      notes: input.notes?.trim() || undefined,
      status: 'processed',
      processedBy: processor,
      processedAt: now,
      createdAt: now,
    });

    tx.set(doc(db, 'commissionPayouts', payoutId), payoutPayload);
    for (const cid of ledgerSnaps) {
      tx.update(doc(db, 'commissionLedger', cid), {
        status: 'paid',
        payoutId,
        paidAt: now,
        updatedAt: now,
      });
    }
  });

  const savedPayout: CommissionPayout = {
    id: payoutId,
    payoutNumber,
    salesmanId: input.salesman.id,
    salesmanUid: input.salesman.uid,
    salesmanName: input.salesman.fullName,
    salesmanEmail: input.salesman.email,
    ledgerEntryIds: input.ledgerEntryIds,
    totalAmount: computedTotal,
    method: input.method,
    accountTitle: input.accountTitle.trim(),
    accountNumber: input.accountNumber.trim(),
    bankName: input.bankName?.trim() || undefined,
    transactionReference: input.transactionReference.trim(),
    notes: input.notes?.trim() || undefined,
    status: 'processed',
    processedBy: processor,
    processedAt: now,
    createdAt: now,
  };

  await createSalesNotification({
    recipientSalesmanId: input.salesman.id,
    recipientUid: input.salesman.uid,
    type: 'payout_processed',
    title: `Payout Processed: ${formatPKRStr(computedTotal)}`,
    message: `Sent via ${input.method.toUpperCase()} (TID: ${input.transactionReference}). Statement #${payoutNumber} ready.`,
    link: '/salesman/payouts',
  });

  await logSalesAudit({
    action: 'Recorded Commission Payout',
    entityType: 'payout',
    entityId: payoutId,
    details: `Paid ${formatPKRStr(computedTotal)} to ${input.salesman.fullName} via ${input.method.toUpperCase()} (TID: ${input.transactionReference})`,
  });

  return savedPayout;
}

export async function getAllCommissionPayouts(): Promise<CommissionPayout[]> {
  try {
    const snap = await getDocs(collection(db, 'commissionPayouts'));
    return snap.docs
      .map((d) => ({ ...(d.data() as CommissionPayout), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'commissionPayouts');
  }
}

export async function getPayoutsForSalesman(salesmanId: string, uid?: string): Promise<CommissionPayout[]> {
  try {
    const q = uid
      ? query(collection(db, 'commissionPayouts'), where('salesmanUid', '==', uid))
      : query(collection(db, 'commissionPayouts'), where('salesmanId', '==', salesmanId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as CommissionPayout), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'commissionPayouts');
  }
}

// ====================================================
// LIVE SALES ANALYTICS ENGINE (100% REAL RECORDS)
// ====================================================

export function resolveDateRange(filter: SalesAnalyticsFilter): { startMs: number; endMs: number } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400000 - 1;

  switch (filter.preset) {
    case 'today':
      return { startMs: startOfToday, endMs: endOfToday };
    case 'yesterday':
      return { startMs: startOfToday - 86400000, endMs: startOfToday - 1 };
    case 'last_7_days':
      return { startMs: startOfToday - 6 * 86400000, endMs: endOfToday };
    case 'last_30_days':
      return { startMs: startOfToday - 29 * 86400000, endMs: endOfToday };
    case 'this_month':
      return { startMs: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), endMs: endOfToday };
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const e = new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1;
      return { startMs: s, endMs: e };
    }
    case 'custom': {
      const s = filter.customStart ? new Date(filter.customStart).getTime() : 0;
      const e = filter.customEnd ? new Date(filter.customEnd).getTime() + 86399999 : endOfToday;
      return { startMs: Number.isNaN(s) ? 0 : s, endMs: Number.isNaN(e) ? endOfToday : e };
    }
    case 'all_time':
    default:
      return { startMs: 0, endMs: endOfToday };
  }
}

export function computeSalesDashboardAnalytics(
  params: {
    members: SalesMember[];
    leads: SalesLead[];
    referrals: ReferralAttribution[];
    shops: Shop[];
    payments: PlatformPayment[];
    commissions: CommissionLedgerEntry[];
    targets: SalesTarget[];
  },
  filter: SalesAnalyticsFilter
): SalesAnalyticsSummary {
  const { startMs, endMs } = resolveDateRange(filter);
  const inDateRange = (iso?: string) => {
    if (!iso) return false;
    const ms = new Date(iso).getTime();
    return !Number.isNaN(ms) && ms >= startMs && ms <= endMs;
  };

  // Filter members by salesman / manager / city / industry
  const filteredMembers = params.members.filter((m) => {
    if (filter.salesmanId && m.id !== filter.salesmanId) return false;
    if (filter.managerId && m.assignedManagerId !== filter.managerId && m.id !== filter.managerId) return false;
    if (filter.city && filter.city !== 'all' && m.city.toLowerCase() !== filter.city.toLowerCase()) return false;
    if (filter.industry && filter.industry !== 'all' && m.industryFocus !== 'all' && m.industryFocus !== filter.industry) return false;
    return true;
  });
  const memberIdSet = new Set(filteredMembers.map((m) => m.id));
  const restrictByMember =
    Boolean(filter.salesmanId || filter.managerId) ||
    (Boolean(filter.city) && filter.city !== 'all') ||
    (Boolean(filter.industry) && filter.industry !== 'all');

  const filteredLeads = params.leads.filter((l) => {
    if (!inDateRange(l.createdAt)) return false;
    if (filter.salesmanId && l.assignedSalesmanId !== filter.salesmanId) return false;
    if (filter.managerId && l.assignedManagerId !== filter.managerId) return false;
    if (filter.city && filter.city !== 'all' && l.city.toLowerCase() !== filter.city.toLowerCase()) return false;
    if (filter.industry && filter.industry !== 'all' && l.industry !== filter.industry) return false;
    return true;
  });

  const filteredReferrals = params.referrals.filter((r) => {
    if (!inDateRange(r.createdAt)) return false;
    if (filter.salesmanId && r.salesmanId !== filter.salesmanId) return false;
    if (restrictByMember && !memberIdSet.has(r.salesmanId) && filter.managerId) return false;
    if (filter.city && filter.city !== 'all' && (r.city || '').toLowerCase() !== filter.city.toLowerCase()) return false;
    if (filter.industry && filter.industry !== 'all' && r.industry !== filter.industry) return false;
    return true;
  });

  const shopMap = new Map(params.shops.map((s) => [s.id, s]));
  const referralShopIdSet = new Set(filteredReferrals.map((r) => r.shopId));

  const verifiedShops = filteredReferrals.filter((r) => {
    const s = shopMap.get(r.shopId);
    return s && s.status === 'active' && r.attributionStatus !== 'rejected_self_referral';
  }).length;

  const approvedPayments = params.payments.filter((p) => {
    if (p.status !== 'approved' || !inDateRange(p.createdAt)) return false;
    if (filter.salesmanId || filter.managerId) {
      return referralShopIdSet.has(p.shopId);
    }
    const shop = shopMap.get(p.shopId);
    if (filter.city && filter.city !== 'all' && shop?.city?.toLowerCase() !== filter.city.toLowerCase()) return false;
    if (filter.industry && filter.industry !== 'all' && shop?.businessType !== filter.industry) return false;
    return true;
  });

  const filteredCommissions = params.commissions.filter((c) => {
    if (!inDateRange(c.createdAt)) return false;
    if (filter.salesmanId && c.salesmanId !== filter.salesmanId) return false;
    if (filter.managerId && !memberIdSet.has(c.salesmanId)) return false;
    const shop = shopMap.get(c.shopId);
    if (filter.city && filter.city !== 'all' && shop?.city?.toLowerCase() !== filter.city.toLowerCase()) return false;
    if (filter.industry && filter.industry !== 'all' && shop?.businessType !== filter.industry) return false;
    return true;
  });

  const validCommissions = filteredCommissions.filter((c) => c.status !== 'rejected' && c.status !== 'reversed');
  const totalCommissionGenerated = validCommissions.reduce((s, c) => s + Number(c.commissionAmount || 0), 0);
  const pendingCommission = filteredCommissions
    .filter((c) => c.status === 'pending' || c.status === 'approved')
    .reduce((s, c) => s + Number(c.commissionAmount || 0), 0);
  const commissionPaid = filteredCommissions
    .filter((c) => c.status === 'paid')
    .reduce((s, c) => s + Number(c.commissionAmount || 0), 0);

  const totalSalesRevenue = approvedPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

  // Daily performance chart (last 7 days in range or recent 7 days)
  const dailyPerformanceChart: { label: string; value: number }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayRev = approvedPayments
      .filter((p) => p.createdAt.startsWith(key))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    dailyPerformanceChart.push({ label, value: dayRev });
  }

  // Monthly performance chart (last 6 months)
  const monthlyPerformanceChart: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short' });
    const mRev = params.payments
      .filter((p) => p.status === 'approved' && p.createdAt.startsWith(key))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    monthlyPerformanceChart.push({ label, value: mRev });
  }

  // Per-salesman conversions, leads vs registrations, revenue, and target vs achievement
  const salesmanConversionsChart: { label: string; value: number }[] = [];
  const leadsVsRegistrations: { label: string; leads: number; registrations: number }[] = [];
  const revenueBySalesmanChart: { label: string; value: number }[] = [];
  const targetVsAchievement: SalesAnalyticsSummary['targetVsAchievement'] = [];

  for (const m of filteredMembers.slice(0, 10)) {
    const mLeads = filteredLeads.filter((l) => l.assignedSalesmanId === m.id);
    const mRegs = filteredReferrals.filter(
      (r) => r.salesmanId === m.id && r.attributionStatus !== 'rejected_self_referral'
    );
    const mPaidShopIds = new Set(mRegs.map((r) => r.shopId));
    const mRev = approvedPayments
      .filter((p) => mPaidShopIds.has(p.shopId))
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    const shortName = m.fullName.split(' ')[0] || m.employeeId;
    salesmanConversionsChart.push({ label: shortName, value: mRegs.length });
    leadsVsRegistrations.push({
      label: shortName,
      leads: mLeads.length,
      registrations: mRegs.length,
    });
    revenueBySalesmanChart.push({ label: shortName, value: mRev });

    const tgt = m.monthlyTarget > 0 ? m.monthlyTarget : 10000;
    targetVsAchievement.push({
      salesmanId: m.id,
      salesmanName: m.fullName,
      target: tgt,
      achieved: mRev,
      pct: Math.min(200, Math.round((mRev / tgt) * 100)),
      conversionRate: mLeads.length > 0 ? Math.round((mRegs.length / mLeads.length) * 100) : 0,
    });
  }

  const commissionDistribution = [
    {
      label: 'Paid Out',
      count: commissionPaid,
      color: '#065F46',
    },
    {
      label: 'Approved (Awaiting Payout)',
      count: filteredCommissions.filter((c) => c.status === 'approved').reduce((s, c) => s + Number(c.commissionAmount || 0), 0),
      color: '#0284c7',
    },
    {
      label: 'Pending Verification',
      count: filteredCommissions.filter((c) => c.status === 'pending').reduce((s, c) => s + Number(c.commissionAmount || 0), 0),
      color: '#d97706',
    },
    {
      label: 'Rejected / Reversed',
      count: filteredCommissions
        .filter((c) => c.status === 'rejected' || c.status === 'reversed')
        .reduce((s, c) => s + Number(c.commissionAmount || 0), 0),
      color: '#dc2626',
    },
  ];

  // Industry breakdown across referral-registered shops (or all filtered shops if no referrals filtered)
  const industryCounts = new Map<string, number>();
  for (const r of filteredReferrals) {
    const ind = r.industry || shopMap.get(r.shopId)?.businessType || 'general_store';
    industryCounts.set(ind, (industryCounts.get(ind) || 0) + 1);
  }
  const industryBreakdown = Array.from(industryCounts.entries()).map(([k, count], idx) => ({
    label: getIndustryMeta(k).label,
    count,
    color: ['#065F46', '#0284c7', '#7c3aed', '#d97706', '#0f766e'][idx % 5],
  }));

  return {
    totalSalesmen: filteredMembers.length,
    activeSalesmen: filteredMembers.filter((m) => m.accountStatus === 'active').length,
    inactiveSalesmen: filteredMembers.filter((m) => m.accountStatus !== 'active').length,
    totalAssignedLeads: filteredLeads.filter((l) => Boolean(l.assignedSalesmanId)).length,
    newLeads: filteredLeads.filter((l) => l.status === 'New').length,
    followUpRequiredLeads: filteredLeads.filter((l) => l.status === 'Follow-up Required').length,
    convertedLeads: filteredLeads.filter((l) => l.status === 'Converted').length,
    totalRegisteredShops: filteredReferrals.filter((r) => r.attributionStatus !== 'rejected_self_referral').length,
    verifiedShops,
    paidSubscriptions: approvedPayments.length,
    totalSalesRevenue,
    totalCommissionGenerated,
    pendingCommission,
    commissionPaid,
    dailyPerformanceChart,
    monthlyPerformanceChart,
    salesmanConversionsChart,
    leadsVsRegistrations,
    revenueBySalesmanChart,
    commissionDistribution,
    targetVsAchievement,
    industryBreakdown,
  };
}

// ====================================================
// SALES MANAGER SCOPED TEAM OPERATIONS & BONUS RECOMMENDATIONS
// ====================================================

export async function assignLeadWithinManagerTeam(params: {
  leadIds: string[];
  targetSalesman: SalesMember;
  managerUid: string;
}): Promise<void> {
  if (!params.targetSalesman.assignedManagerUid || params.targetSalesman.assignedManagerUid !== params.managerUid) {
    throw new Error('Forbidden: target representative does not belong to your authorized sales team.');
  }

  const apiRes = await trySalesApi<{ ok: boolean }>('/api/sales-manager/leads/assign', 'POST', {
    leadIds: params.leadIds,
    targetSalesmanId: params.targetSalesman.id,
  }).catch((e) => {
    throw e;
  });
  if (apiRes) return;

  const now = new Date().toISOString();
  const batch = writeBatch(db);
  for (const lid of params.leadIds) {
    batch.update(doc(db, 'salesLeads', lid), {
      assignedSalesmanId: params.targetSalesman.id,
      assignedSalesmanUid: params.targetSalesman.uid || null,
      assignedSalesmanName: params.targetSalesman.fullName,
      assignedManagerId: params.targetSalesman.assignedManagerId || null,
      assignedManagerUid: params.managerUid,
      status: 'Assigned',
      updatedAt: now,
    });
  }
  await batch.commit();
}

export async function getSalesActivitiesForTeam(teamMemberUids: string[]): Promise<SalesActivity[]> {
  if (teamMemberUids.length === 0) return [];
  const list: SalesActivity[] = [];
  for (const uid of teamMemberUids) {
    const acts = await getSalesActivitiesBySalesman(uid, uid).catch(() => []);
    list.push(...acts);
  }
  return list.sort((a, b) => new Date(b.activityDateTime).getTime() - new Date(a.activityDateTime).getTime());
}

export async function getSalesTargetsForTeam(teamMembers: SalesMember[]): Promise<SalesTarget[]> {
  const list: SalesTarget[] = [];
  for (const m of teamMembers) {
    const targets = await getSalesTargetsForMember(m.id, m.uid).catch(() => []);
    list.push(...targets);
  }
  return list.sort((a, b) => b.periodKey.localeCompare(a.periodKey));
}

export async function submitBonusRecommendation(input: {
  managerId: string;
  managerUid: string;
  managerName: string;
  targetRep: SalesMember;
  recommendedAmount: number;
  periodKey: string;
  reason: string;
}): Promise<SalesBonusRecommendation> {
  if (input.targetRep.assignedManagerUid !== input.managerUid || input.targetRep.uid === input.managerUid) {
    throw new Error('Forbidden: bonus recommendations are strictly restricted to your assigned team members.');
  }

  const apiRes = await trySalesApi<{ recommendation: SalesBonusRecommendation }>(
    '/api/sales-manager/bonus-recommendations',
    'POST',
    {
      salesmanId: input.targetRep.id,
      recommendedAmount: input.recommendedAmount,
      periodKey: input.periodKey,
      reason: input.reason,
      status: 'pending',
    }
  ).catch((e) => {
    throw e;
  });
  if (apiRes?.recommendation) return apiRes.recommendation;

  const id = `bon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const payload = stripUndef<SalesBonusRecommendation>({
    id,
    managerId: input.managerId,
    managerUid: input.managerUid,
    managerName: input.managerName,
    salesmanId: input.targetRep.id,
    salesmanUid: input.targetRep.uid,
    salesmanName: input.targetRep.fullName,
    recommendedAmount: Math.round(Number(input.recommendedAmount) || 0),
    periodKey: input.periodKey,
    reason: input.reason.trim(),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
  await setDoc(doc(db, 'salesBonusRecommendations', id), payload);
  await logSalesAudit({
    action: 'Recommended Team Bonus',
    entityType: 'bonus_recommendation',
    entityId: id,
    actorRole: 'sales_manager',
    details: `Recommended Rs. ${payload.recommendedAmount} bonus for ${payload.salesmanName} (${payload.periodKey})`,
  });
  return payload;
}

export async function getBonusRecommendationsForManager(managerUid: string): Promise<SalesBonusRecommendation[]> {
  try {
    const q = query(collection(db, 'salesBonusRecommendations'), where('managerUid', '==', managerUid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesBonusRecommendation), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesBonusRecommendations');
  }
}

export async function getAllBonusRecommendations(): Promise<SalesBonusRecommendation[]> {
  try {
    const snap = await getDocs(collection(db, 'salesBonusRecommendations'));
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesBonusRecommendation), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesBonusRecommendations');
  }
}

export async function decideBonusRecommendation(params: {
  recId: string;
  decision: 'approved' | 'rejected';
  reason?: string;
}): Promise<void> {
  const apiRes = await trySalesApi<{ ok: boolean }>(
    '/api/super-admin/sales/bonus-recommendations/decision',
    'POST',
    params
  ).catch((e) => {
    throw e;
  });
  if (apiRes) return;

  const reviewer = auth.currentUser?.email || 'Super Admin';
  const now = new Date().toISOString();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'salesBonusRecommendations', params.recId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Recommendation not found.');
    const cur = snap.data() as SalesBonusRecommendation;
    if (cur.status !== 'pending') throw new Error(`Already ${cur.status}.`);
    const patch: Record<string, any> = {
      status: params.decision,
      reviewedBy: reviewer,
      reviewedAt: now,
      updatedAt: now,
    };
    if (params.decision === 'rejected') {
      patch.rejectionReason = params.reason || 'Declined by Super Admin.';
    } else {
      const ledgerId = `comm_bon_${params.recId}`;
      patch.commissionLedgerId = ledgerId;
      tx.set(doc(db, 'commissionLedger', ledgerId), stripUndef({
        id: ledgerId,
        salesmanId: cur.salesmanId,
        salesmanUid: cur.salesmanUid,
        salesmanName: cur.salesmanName,
        shopId: `bonus_${cur.periodKey}`,
        shopName: `Performance Bonus (${cur.periodKey})`,
        paymentId: params.recId,
        planId: 'performance_bonus',
        planName: `Bonus (${cur.managerName})`,
        billingCycle: 'monthly',
        paymentAmount: 0,
        commissionRatePct: 0,
        flatBonusAmount: cur.recommendedAmount,
        commissionAmount: cur.recommendedAmount,
        commissionType: 'target_bonus',
        status: 'approved',
        approvedBy: reviewer,
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      }));
    }
    tx.update(ref, patch);
  });
}

// ====================================================
// SALESMAN BUSINESS EXPENSES (STRICTLY PENDING ON SUBMIT)
// ====================================================

export async function submitSalesExpense(input: {
  salesmanId: string;
  salesmanUid: string;
  salesmanName: string;
  managerUid?: string;
  category: SalesExpense['category'];
  amount: number;
  expenseDate: string;
  description: string;
  receiptUrl?: string;
}): Promise<SalesExpense> {
  const apiRes = await trySalesApi<{ expense: SalesExpense }>('/api/salesman/expenses', 'POST', {
    ...input,
    status: 'pending',
  }).catch((e) => {
    throw e;
  });
  if (apiRes?.expense) return apiRes.expense;

  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const payload = stripUndef<SalesExpense>({
    id,
    salesmanId: input.salesmanId,
    salesmanUid: input.salesmanUid,
    salesmanName: input.salesmanName,
    managerUid: input.managerUid,
    category: input.category,
    amount: Math.round(Number(input.amount) || 0),
    expenseDate: input.expenseDate || now.slice(0, 10),
    description: input.description.trim(),
    receiptUrl: input.receiptUrl,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
  await setDoc(doc(db, 'salesExpenses', id), payload);
  return payload;
}

export async function getSalesExpensesForMember(salesmanUid: string): Promise<SalesExpense[]> {
  try {
    const q = query(collection(db, 'salesExpenses'), where('salesmanUid', '==', salesmanUid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesExpense), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesExpenses');
  }
}

export async function getAllSalesExpenses(): Promise<SalesExpense[]> {
  try {
    const snap = await getDocs(collection(db, 'salesExpenses'));
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesExpense), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesExpenses');
  }
}

export async function decideSalesExpense(params: {
  expenseId: string;
  decision: 'approved' | 'rejected';
  reason?: string;
}): Promise<void> {
  const apiRes = await trySalesApi<{ ok: boolean }>('/api/super-admin/sales/expenses/decision', 'POST', params).catch(
    (e) => {
      throw e;
    }
  );
  if (apiRes) return;

  const reviewer = auth.currentUser?.email || 'Super Admin';
  const now = new Date().toISOString();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'salesExpenses', params.expenseId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Expense not found.');
    if (snap.data()?.status !== 'pending') throw new Error(`Expense already ${snap.data()?.status}.`);
    tx.update(
      ref,
      stripUndef({
        status: params.decision,
        rejectionReason: params.decision === 'rejected' ? params.reason || 'Declined by Super Admin.' : undefined,
        reviewedBy: reviewer,
        reviewedAt: now,
        updatedAt: now,
      })
    );
  });
}

// ====================================================
// APPROVED SALES MATERIALS & REFERRAL AGENT REWARDS
// ====================================================

export async function getApprovedSalesMaterials(): Promise<SalesMaterial[]> {
  try {
    const snap = await getDocs(collection(db, 'salesMaterials'));
    return snap.docs
      .map((d) => ({ ...(d.data() as SalesMaterial), id: d.id }))
      .filter((m) => m.isActive !== false)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, 'salesMaterials');
  }
}

export async function saveSalesMaterial(
  input: Omit<SalesMaterial, 'id' | 'createdAt' | 'createdBy'> & { id?: string }
): Promise<SalesMaterial> {
  const id = input.id || `mat_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const payload = stripUndef<SalesMaterial>({
    ...input,
    id,
    createdBy: auth.currentUser?.email || 'Super Admin',
    createdAt: now,
    updatedAt: now,
  });
  await setDoc(doc(db, 'salesMaterials', id), payload, { merge: true });
  await logSalesAudit({
    action: input.id ? 'Updated Sales Material' : 'Published Sales Material',
    entityType: 'sales_material',
    entityId: id,
    details: `${payload.title} (${payload.category})`,
  });
  return payload;
}

export async function deleteSalesMaterial(materialId: string): Promise<void> {
  await deleteDoc(doc(db, 'salesMaterials', materialId));
  await logSalesAudit({
    action: 'Deleted Sales Material',
    entityType: 'sales_material',
    entityId: materialId,
    details: `Removed sales material ${materialId}`,
  });
}

export async function getReferralRewardsForAgent(salesmanId: string, uid?: string): Promise<CommissionLedgerEntry[]> {
  const all = await getCommissionsForSalesman(salesmanId, uid);
  return all.filter((c) => c.status === 'approved' || c.status === 'paid');
}

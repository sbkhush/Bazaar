import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import {
  BusinessType,
  IndustryPaymentRecord,
  ManualPaymentMethod,
  PublicOfferingItem,
  ShopAuditLog,
} from '../types';
import { stripUndefined } from './platformService';

export const PAKISTAN_PAYMENT_METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  easypaisa: 'EasyPaisa',
  jazzcash: 'JazzCash',
  ibft: 'IBFT',
};

export function getPaymentMethodDisplay(method: ManualPaymentMethod | string): string {
  return (
    PAKISTAN_PAYMENT_METHOD_LABELS[method as ManualPaymentMethod] ||
    String(method || 'cash').toUpperCase()
  );
}

export function formatWhatsAppReminderUrl(phone: string, message: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  let normalized = digits;
  if (normalized.startsWith('03') && normalized.length === 11) {
    normalized = `92${normalized.slice(1)}`;
  } else if (normalized.startsWith('3') && normalized.length === 10) {
    normalized = `92${normalized}`;
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function calculatePaymentTotals(payments: IndustryPaymentRecord[]) {
  const paidTotal = payments
    .filter((p) => p.status === 'paid' || p.status === 'verified')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingTotal = payments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const thisMonthPrefix = new Date().toISOString().slice(0, 7);
  const monthlyPaid = payments
    .filter(
      (p) =>
        (p.status === 'paid' || p.status === 'verified') &&
        String(p.createdAt || '').startsWith(thisMonthPrefix)
    )
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return { paidTotal, pendingTotal, monthlyPaid };
}

export async function recordIndustryPayment(
  shopId: string,
  input: Omit<IndustryPaymentRecord, 'id' | 'shopId' | 'createdAt' | 'updatedAt'>
): Promise<IndustryPaymentRecord> {
  const id = `ipay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<IndustryPaymentRecord>({
    ...input,
    id,
    shopId,
    amount: Math.max(0, Number(input.amount || 0)),
    recordedBy: input.recordedBy || auth.currentUser?.uid || 'staff',
    recordedByEmail: input.recordedByEmail || auth.currentUser?.email || undefined,
    createdAt: now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'industry_payments', id), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}/industry_payments/${id}`);
  }
}

export async function getIndustryPayments(shopId: string): Promise<IndustryPaymentRecord[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'industry_payments'),
      orderBy('createdAt', 'desc'),
      limit(250)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as IndustryPaymentRecord), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/industry_payments`);
  }
}

export async function updateIndustryPaymentStatus(
  shopId: string,
  paymentId: string,
  status: IndustryPaymentRecord['status'],
  notes?: string
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await updateDoc(
      doc(db, 'shops', shopId, 'industry_payments', paymentId),
      stripUndefined({
        status,
        verifiedBy: status === 'verified' ? auth.currentUser?.email || auth.currentUser?.uid : undefined,
        verifiedAt: status === 'verified' ? now : undefined,
        notes,
        updatedAt: now,
      })
    );
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `shops/${shopId}/industry_payments/${paymentId}`
    );
  }
}

export async function logShopAudit(
  shopId: string,
  input: {
    action: string;
    entityType: ShopAuditLog['entityType'];
    entityId: string;
    details: string;
  }
): Promise<void> {
  try {
    const id = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const payload = stripUndefined<ShopAuditLog>({
      id,
      shopId,
      actorId: auth.currentUser?.uid || 'system',
      actorEmail: auth.currentUser?.email || undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details,
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'shops', shopId, 'auditLogs', id), payload);
  } catch (err) {
    console.warn('Audit log write note:', err);
  }
}

export async function getShopAuditLogs(
  shopId: string,
  maxItems = 80
): Promise<ShopAuditLog[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'auditLogs'),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as ShopAuditLog), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/auditLogs`);
  }
}

export async function getPublicOfferings(shopId: string): Promise<PublicOfferingItem[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'public_offerings'));
    const list = snap.docs.map((d) => ({ ...(d.data() as PublicOfferingItem), id: d.id }));
    return list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } catch {
    return [];
  }
}

export async function savePublicOffering(
  shopId: string,
  offering: Omit<PublicOfferingItem, 'shopId' | 'updatedAt'> & {
    businessType: BusinessType;
  }
): Promise<void> {
  const payload = stripUndefined<PublicOfferingItem>({
    ...offering,
    shopId,
    updatedAt: new Date().toISOString(),
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'public_offerings', offering.id), payload);
  } catch (err) {
    console.warn('Public offering projection sync note:', err);
  }
}

export async function deletePublicOffering(shopId: string, offeringId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'public_offerings', offeringId));
  } catch {
    // Non-fatal if projection doc was already absent
  }
}

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
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import {
  GymAttendanceRecord,
  GymMember,
  GymPlan,
  GymTrainer,
  GymWorkoutPlan,
  IndustryPaymentRecord,
} from '../types';
import { deletePublicOffering, savePublicOffering } from './industryCommonService';
import { stripUndefined } from './platformService';

export function computeGymExpiryDate(startDateIso: string, durationDays: number): string {
  const base = new Date(startDateIso);
  const startMs = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
  const safeDays = Math.max(1, Math.round(Number(durationDays || 30)));
  return new Date(startMs + safeDays * 86400000).toISOString().slice(0, 10);
}

export function computeGymMemberStatus(
  member: Pick<GymMember, 'status' | 'expiryDate'>,
  nowIso: string = new Date().toISOString().slice(0, 10)
): GymMember['status'] {
  if (member.status === 'frozen' || member.status === 'cancelled') {
    return member.status;
  }
  if (member.expiryDate && member.expiryDate < nowIso) {
    return 'expired';
  }
  return 'active';
}

export function buildGymQrPayload(shopId: string, memberId: string, qrToken: string): string {
  return `SBKHUSH-GYM|${shopId}|${memberId}|${qrToken}`;
}

export function parseGymQrPayload(raw: string): {
  shopId?: string;
  memberId?: string;
  qrToken: string;
} {
  const clean = String(raw || '').trim();
  if (clean.startsWith('SBKHUSH-GYM|')) {
    const parts = clean.split('|');
    return {
      shopId: parts[1] || undefined,
      memberId: parts[2] || undefined,
      qrToken: parts[3] || clean,
    };
  }
  return { qrToken: clean };
}

export function computeGymDashboardMetrics(
  members: GymMember[],
  attendance: GymAttendanceRecord[],
  payments: IndustryPaymentRecord[],
  todayIso: string = new Date().toISOString().slice(0, 10)
) {
  let activeMembers = 0;
  let expiredMembers = 0;
  let frozenMembers = 0;
  const upcomingRenewals: GymMember[] = [];
  const sevenDaysLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  for (const m of members) {
    const effective = computeGymMemberStatus(m, todayIso);
    if (effective === 'active') {
      activeMembers++;
      if (m.expiryDate && m.expiryDate >= todayIso && m.expiryDate <= sevenDaysLater) {
        upcomingRenewals.push(m);
      }
    } else if (effective === 'expired') {
      expiredMembers++;
    } else if (effective === 'frozen') {
      frozenMembers++;
    }
  }

  const todayAttendance = attendance.filter((a) => a.date === todayIso).length;
  const monthPrefix = todayIso.slice(0, 7);
  const monthlyRevenue = payments
    .filter(
      (p) =>
        (p.status === 'paid' || p.status === 'verified') &&
        String(p.createdAt || '').startsWith(monthPrefix)
    )
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const pendingMemberFees = members.reduce(
    (sum, m) => sum + Math.max(0, Number(m.pendingAmount || 0)),
    0
  );
  const pendingLedger = payments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return {
    totalMembers: members.length,
    activeMembers,
    expiredMembers,
    frozenMembers,
    todayAttendance,
    monthlyRevenue,
    pendingPayments: Math.max(pendingMemberFees, pendingLedger),
    upcomingRenewalsCount: upcomingRenewals.length,
    upcomingRenewals,
  };
}

// Plans
export async function getGymPlans(shopId: string): Promise<GymPlan[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'gym_plans'));
    return snap.docs
      .map((d) => ({ ...(d.data() as GymPlan), id: d.id }))
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/gym_plans`);
  }
}

export async function saveGymPlan(
  shopId: string,
  plan: Partial<GymPlan> & { name: string; durationDays: number; price: number }
): Promise<GymPlan> {
  const id = plan.id || `gplan_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<GymPlan>({
    id,
    shopId,
    name: plan.name.trim(),
    durationType: plan.durationType || 'monthly',
    durationDays: Math.max(1, Number(plan.durationDays || 30)),
    price: Math.max(0, Number(plan.price || 0)),
    registrationFee: Math.max(0, Number(plan.registrationFee || 0)),
    description: plan.description?.trim() || '',
    isActive: plan.isActive !== false,
    createdAt: plan.createdAt || now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'gym_plans', id), payload, { merge: true });
    if (payload.isActive) {
      await savePublicOffering(shopId, {
        id,
        businessType: 'gym',
        title: payload.name,
        subtitle: `${payload.durationDays} days membership`,
        price: payload.price,
        durationLabel: `${payload.durationDays} days`,
        description: payload.description,
        isActive: true,
      });
    } else {
      await deletePublicOffering(shopId, id);
    }
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/gym_plans/${id}`);
  }
}

export async function deleteGymPlan(shopId: string, planId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'gym_plans', planId));
    await deletePublicOffering(shopId, planId);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/gym_plans/${planId}`);
  }
}

// Trainers & Workout Plans
export async function getGymTrainers(shopId: string): Promise<GymTrainer[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'gym_trainers'));
    return snap.docs.map((d) => ({ ...(d.data() as GymTrainer), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/gym_trainers`);
  }
}

export async function saveGymTrainer(
  shopId: string,
  trainer: Partial<GymTrainer> & { name: string; phone: string }
): Promise<GymTrainer> {
  const id = trainer.id || `gtrn_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<GymTrainer>({
    id,
    shopId,
    name: trainer.name.trim(),
    phone: trainer.phone.trim(),
    specialty: trainer.specialty?.trim() || 'Strength & Conditioning',
    shiftTiming: trainer.shiftTiming?.trim() || 'Morning & Evening',
    isActive: trainer.isActive !== false,
    createdAt: trainer.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'gym_trainers', id), payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/gym_trainers/${id}`);
  }
}

export async function deleteGymTrainer(shopId: string, trainerId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'gym_trainers', trainerId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/gym_trainers/${trainerId}`);
  }
}

export async function getGymWorkoutPlans(shopId: string): Promise<GymWorkoutPlan[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'gym_workout_plans'));
    return snap.docs.map((d) => ({ ...(d.data() as GymWorkoutPlan), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/gym_workout_plans`);
  }
}

export async function saveGymWorkoutPlan(
  shopId: string,
  plan: Partial<GymWorkoutPlan> & { title: string; goal: string }
): Promise<GymWorkoutPlan> {
  const id = plan.id || `gwk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<GymWorkoutPlan>({
    id,
    shopId,
    title: plan.title.trim(),
    trainerId: plan.trainerId,
    trainerName: plan.trainerName,
    goal: plan.goal.trim(),
    scheduleSummary: plan.scheduleSummary?.trim() || '',
    notes: plan.notes?.trim() || '',
    createdAt: plan.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'gym_workout_plans', id), payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/gym_workout_plans/${id}`);
  }
}

export async function deleteGymWorkoutPlan(shopId: string, planId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'gym_workout_plans', planId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/gym_workout_plans/${planId}`);
  }
}

// Members
export async function getGymMembers(shopId: string): Promise<GymMember[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'gym_members'),
      orderBy('createdAt', 'desc'),
      limit(400)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as GymMember), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/gym_members`);
  }
}

export async function saveGymMember(
  shopId: string,
  member: Partial<GymMember> & { name: string; phone: string; startDate: string }
): Promise<GymMember> {
  const id = member.id || `gmem_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const qrToken = member.qrToken || `GYM${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const expiryDate =
    member.expiryDate || computeGymExpiryDate(member.startDate, 30);

  const payload = stripUndefined<GymMember>({
    id,
    shopId,
    memberCode: member.memberCode || `M-${id.slice(-5).toUpperCase()}`,
    name: member.name.trim(),
    phone: member.phone.trim(),
    email: member.email?.trim(),
    cnicLast4: member.cnicLast4?.replace(/\D/g, '').slice(-4),
    emergencyContact: member.emergencyContact?.trim(),
    planId: member.planId,
    planName: member.planName,
    trainerId: member.trainerId,
    trainerName: member.trainerName,
    workoutPlanId: member.workoutPlanId,
    startDate: member.startDate,
    expiryDate,
    status: member.status || 'active',
    feeAmount: Math.max(0, Number(member.feeAmount || 0)),
    paidAmount: Math.max(0, Number(member.paidAmount || 0)),
    pendingAmount: Math.max(
      0,
      Number(member.pendingAmount ?? Math.max(0, Number(member.feeAmount || 0) - Number(member.paidAmount || 0)))
    ),
    qrToken,
    notes: member.notes?.trim(),
    createdAt: member.createdAt || now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'gym_members', id), payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/gym_members/${id}`);
  }
}

export async function renewGymMembership(
  shopId: string,
  member: GymMember,
  plan: GymPlan,
  paidNow: number
): Promise<GymMember> {
  const today = new Date().toISOString().slice(0, 10);
  const startBase = member.expiryDate && member.expiryDate > today ? member.expiryDate : today;
  const nextExpiry = computeGymExpiryDate(startBase, plan.durationDays);
  const totalDue = Number(member.pendingAmount || 0) + Number(plan.price || 0);
  const nextPending = Math.max(0, totalDue - Math.max(0, paidNow));

  return saveGymMember(shopId, {
    ...member,
    planId: plan.id,
    planName: plan.name,
    startDate: startBase,
    expiryDate: nextExpiry,
    status: 'active',
    feeAmount: plan.price,
    paidAmount: Number(member.paidAmount || 0) + Math.max(0, paidNow),
    pendingAmount: nextPending,
  });
}

export async function freezeGymMembership(
  shopId: string,
  memberId: string,
  freeze: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'gym_members', memberId), {
      status: freeze ? 'frozen' : 'active',
      frozenAt: freeze ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}/gym_members/${memberId}`);
  }
}

export async function cancelGymMembership(shopId: string, memberId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'gym_members', memberId), {
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}/gym_members/${memberId}`);
  }
}

// Attendance
export async function getGymAttendance(shopId: string): Promise<GymAttendanceRecord[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'gym_attendance'),
      orderBy('checkInAt', 'desc'),
      limit(300)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as GymAttendanceRecord), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/gym_attendance`);
  }
}

export async function recordGymCheckIn(
  shopId: string,
  member: GymMember,
  method: 'manual' | 'qr' = 'manual'
): Promise<GymAttendanceRecord> {
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const id = `gatt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const payload = stripUndefined<GymAttendanceRecord>({
    id,
    shopId,
    memberId: member.id,
    memberName: member.name,
    memberPhone: member.phone,
    date,
    checkInAt: now,
    method,
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'gym_attendance', id), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}/gym_attendance/${id}`);
  }
}

export async function recordGymCheckOut(shopId: string, attendanceId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'gym_attendance', attendanceId), {
      checkOutAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `shops/${shopId}/gym_attendance/${attendanceId}`
    );
  }
}

export async function submitPublicGymInquiry(
  shopId: string,
  input: { customerName: string; customerPhone: string; planName?: string; message?: string }
): Promise<void> {
  const id = `ginq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  try {
    await setDoc(
      doc(db, 'shops', shopId, 'dealer_inquiries', id),
      stripUndefined({
        id,
        shopId,
        vehicleId: 'gym_membership',
        vehicleTitle: input.planName || 'Gym Membership Inquiry',
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        inquiryType: 'general_inquiry',
        message: input.message?.trim() || 'Interested in joining this gym.',
        status: 'new',
        source: 'public_storefront',
        createdAt: now,
        updatedAt: now,
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}/dealer_inquiries/${id}`);
  }
}

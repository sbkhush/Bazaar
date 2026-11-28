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
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import {
  ClinicAppointment,
  ClinicAppointmentStatus,
  ClinicDoctor,
  ClinicMedicalNote,
  ClinicPatient,
  IndustryPaymentRecord,
} from '../types';
import {
  deletePublicOffering,
  logShopAudit,
  savePublicOffering,
} from './industryCommonService';
import { stripUndefined } from './platformService';

export const CLINIC_ADMIN_DISCLAIMER =
  'Administrative clinic recordkeeping only — this software does not provide automated medical diagnosis, triage, or clinical decision support.';

export const CLINIC_APPOINTMENT_STATUSES: ClinicAppointmentStatus[] = [
  'Pending',
  'Confirmed',
  'Checked In',
  'Completed',
  'Cancelled',
  'No Show',
];

export function computeClinicMetrics(
  patients: ClinicPatient[],
  doctors: ClinicDoctor[],
  appointments: ClinicAppointment[],
  payments: IndustryPaymentRecord[],
  todayIso: string = new Date().toISOString().slice(0, 10)
) {
  const todayAppointments = appointments.filter((a) => a.appointmentDate === todayIso);
  const waitingCount = todayAppointments.filter(
    (a) => a.status === 'Pending' || a.status === 'Confirmed' || a.status === 'Checked In'
  ).length;
  const completedToday = todayAppointments.filter((a) => a.status === 'Completed').length;
  const followUpsDue = appointments.filter(
    (a) => a.isFollowUp && a.status !== 'Completed' && a.status !== 'Cancelled'
  ).length;

  const monthPrefix = todayIso.slice(0, 7);
  const monthlyRevenue = payments
    .filter(
      (p) =>
        (p.status === 'paid' || p.status === 'verified') &&
        String(p.createdAt || '').startsWith(monthPrefix)
    )
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const pendingFees = appointments
    .filter((a) => a.status !== 'Cancelled' && a.feeStatus !== 'paid')
    .reduce(
      (sum, a) => sum + Math.max(0, Number(a.consultationFee || 0) - Number(a.paidAmount || 0)),
      0
    );

  return {
    totalPatients: patients.length,
    activeDoctors: doctors.filter((d) => d.isActive).length,
    todayAppointments: todayAppointments.length,
    waitingCount,
    completedToday,
    followUpsDue,
    monthlyRevenue,
    pendingFees,
  };
}

// Doctors
export async function getClinicDoctors(shopId: string): Promise<ClinicDoctor[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'clinic_doctors'));
    return snap.docs.map((d) => ({ ...(d.data() as ClinicDoctor), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/clinic_doctors`);
  }
}

export async function saveClinicDoctor(
  shopId: string,
  doctor: Partial<ClinicDoctor> & { name: string; specialty: string; consultationFee: number }
): Promise<ClinicDoctor> {
  const id = doctor.id || `cdoc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<ClinicDoctor>({
    id,
    shopId,
    name: doctor.name.trim(),
    specialty: doctor.specialty.trim(),
    qualification: doctor.qualification?.trim(),
    phone: doctor.phone?.trim(),
    consultationFee: Math.max(0, Number(doctor.consultationFee || 0)),
    availableDays:
      doctor.availableDays && doctor.availableDays.length > 0
        ? doctor.availableDays
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    timings: doctor.timings?.trim() || '5:00 PM – 9:00 PM',
    isActive: doctor.isActive !== false,
    createdAt: doctor.createdAt || now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'clinic_doctors', id), payload, { merge: true });
    if (payload.isActive) {
      await savePublicOffering(shopId, {
        id,
        businessType: 'clinic',
        title: payload.name,
        subtitle: `${payload.specialty} · ${payload.timings}`,
        price: payload.consultationFee,
        durationLabel: payload.availableDays.join(', '),
        description: payload.qualification || payload.specialty,
        isActive: true,
      });
    } else {
      await deletePublicOffering(shopId, id);
    }
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/clinic_doctors/${id}`);
  }
}

export async function deleteClinicDoctor(shopId: string, doctorId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'clinic_doctors', doctorId));
    await deletePublicOffering(shopId, doctorId);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/clinic_doctors/${doctorId}`);
  }
}

// Patients (strictly tenant + role isolated & audit-logged)
export async function getClinicPatients(shopId: string): Promise<ClinicPatient[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'clinic_patients'),
      orderBy('createdAt', 'desc'),
      limit(400)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as ClinicPatient), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/clinic_patients`);
  }
}

export async function saveClinicPatient(
  shopId: string,
  patient: Partial<ClinicPatient> & { name: string; phone: string }
): Promise<ClinicPatient> {
  const isUpdate = Boolean(patient.id);
  const id = patient.id || `cpat_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<ClinicPatient>({
    id,
    shopId,
    patientCode: patient.patientCode || `PT-${id.slice(-5).toUpperCase()}`,
    name: patient.name.trim(),
    phone: patient.phone.trim(),
    age: patient.age !== undefined ? Number(patient.age) : undefined,
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    address: patient.address?.trim(),
    allergiesNote: patient.allergiesNote?.trim(),
    createdAt: patient.createdAt || now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'clinic_patients', id), payload, { merge: true });
    await logShopAudit(shopId, {
      action: isUpdate ? 'Updated Patient Profile' : 'Registered Patient Profile',
      entityType: 'clinic_patient',
      entityId: id,
      details: `${isUpdate ? 'Updated' : 'Created'} administrative patient record ${payload.patientCode}`,
    });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/clinic_patients/${id}`);
  }
}

// Medical Notes & Prescriptions (administrative only, strictly private & audit-logged)
export async function getPatientMedicalNotes(
  shopId: string,
  patientId: string
): Promise<ClinicMedicalNote[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'clinic_medical_notes'),
      where('patientId', '==', patientId),
      limit(100)
    );
    const snap = await getDocs(q);
    const list = snap.docs
      .map((d) => ({ ...(d.data() as ClinicMedicalNote), id: d.id }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    await logShopAudit(shopId, {
      action: 'Viewed Patient Visit Notes',
      entityType: 'clinic_medical_note',
      entityId: patientId,
      details: `Accessed ${list.length} visit note(s) for patient ${patientId}`,
    });
    return list;
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.LIST,
      `shops/${shopId}/clinic_medical_notes`
    );
  }
}

export async function addClinicMedicalNote(
  shopId: string,
  note: Omit<ClinicMedicalNote, 'id' | 'shopId' | 'createdByUid' | 'createdAt' | 'updatedAt'>
): Promise<ClinicMedicalNote> {
  const id = `cnote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<ClinicMedicalNote>({
    ...note,
    id,
    shopId,
    createdByUid: auth.currentUser?.uid || 'staff',
    createdByEmail: auth.currentUser?.email || undefined,
    createdAt: now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'clinic_medical_notes', id), payload);
    await logShopAudit(shopId, {
      action: 'Added Administrative Visit Note',
      entityType: 'clinic_medical_note',
      entityId: id,
      details: `Recorded visit note / prescription for patient ${note.patientId}`,
    });
    return payload;
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.CREATE,
      `shops/${shopId}/clinic_medical_notes/${id}`
    );
  }
}

// Appointments
export async function getClinicAppointments(shopId: string): Promise<ClinicAppointment[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'clinic_appointments'),
      orderBy('appointmentDate', 'desc'),
      limit(350)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as ClinicAppointment), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/clinic_appointments`);
  }
}

export async function saveClinicAppointment(
  shopId: string,
  appt: Partial<ClinicAppointment> & {
    patientName: string;
    patientPhone: string;
    doctorName: string;
    appointmentDate: string;
    timeSlot: string;
  }
): Promise<ClinicAppointment> {
  const id = appt.id || `cappt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const fee = Math.max(0, Number(appt.consultationFee || 0));
  const paid = Math.max(0, Number(appt.paidAmount || 0));
  const feeStatus: ClinicAppointment['feeStatus'] =
    paid >= fee && fee > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

  const payload = stripUndefined<ClinicAppointment>({
    id,
    shopId,
    patientId: appt.patientId,
    patientName: appt.patientName.trim(),
    patientPhone: appt.patientPhone.trim(),
    doctorId: appt.doctorId,
    doctorName: appt.doctorName.trim(),
    appointmentDate: appt.appointmentDate,
    timeSlot: appt.timeSlot,
    status: appt.status || 'Confirmed',
    visitReason: appt.visitReason?.trim(),
    isFollowUp: Boolean(appt.isFollowUp),
    consultationFee: fee,
    paidAmount: paid,
    feeStatus,
    source: appt.source || 'staff_desk',
    createdAt: appt.createdAt || now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'clinic_appointments', id), payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/clinic_appointments/${id}`);
  }
}

export async function updateClinicAppointmentStatus(
  shopId: string,
  appointmentId: string,
  status: ClinicAppointmentStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'clinic_appointments', appointmentId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `shops/${shopId}/clinic_appointments/${appointmentId}`
    );
  }
}

export async function submitPublicClinicAppointment(
  shopId: string,
  input: {
    patientName: string;
    patientPhone: string;
    doctorId?: string;
    doctorName: string;
    appointmentDate: string;
    timeSlot: string;
    consultationFee: number;
    visitReason?: string;
  }
): Promise<string> {
  const id = `cappt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<ClinicAppointment>({
    id,
    shopId,
    patientName: input.patientName.trim(),
    patientPhone: input.patientPhone.trim(),
    doctorId: input.doctorId,
    doctorName: input.doctorName.trim(),
    appointmentDate: input.appointmentDate,
    timeSlot: input.timeSlot,
    status: 'Pending',
    visitReason: input.visitReason?.trim(),
    isFollowUp: false,
    consultationFee: Math.max(0, Number(input.consultationFee || 0)),
    paidAmount: 0,
    feeStatus: 'unpaid',
    source: 'public_booking',
    createdAt: now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'clinic_appointments', id), payload);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}/clinic_appointments/${id}`);
  }
}

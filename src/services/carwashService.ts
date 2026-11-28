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
  CarWashCustomer,
  CarWashJobCard,
  CarWashJobStatus,
  CarWashServicePackage,
  CarWashVehicle,
  IndustryPaymentRecord,
} from '../types';
import { deletePublicOffering, savePublicOffering } from './industryCommonService';
import { stripUndefined } from './platformService';

export const CARWASH_PRESET_PACKAGES: Array<{
  name: string;
  category: CarWashServicePackage['category'];
  vehicleType: CarWashServicePackage['vehicleType'];
  price: number;
  estimatedMinutes: number;
  description: string;
}> = [
  {
    name: 'Basic Wash',
    category: 'Basic Wash',
    vehicleType: 'Sedan',
    price: 700,
    estimatedMinutes: 25,
    description: 'Exterior foam wash, tyre dressing & towel dry.',
  },
  {
    name: 'Premium Wash',
    category: 'Premium Wash',
    vehicleType: 'Sedan',
    price: 1200,
    estimatedMinutes: 40,
    description: 'Foam wash, interior vacuum, dashboard polish & mat cleaning.',
  },
  {
    name: 'Interior Cleaning',
    category: 'Interior Cleaning',
    vehicleType: 'SUV',
    price: 2500,
    estimatedMinutes: 90,
    description: 'Deep seats, carpet, roof liner & AC vents sanitization.',
  },
  {
    name: 'Exterior Detailing',
    category: 'Exterior Detailing',
    vehicleType: 'Sedan',
    price: 4500,
    estimatedMinutes: 120,
    description: 'Clay bar decontamination, gloss compounding & paint protection.',
  },
  {
    name: 'Full Detailing',
    category: 'Full Detailing',
    vehicleType: 'SUV',
    price: 7500,
    estimatedMinutes: 240,
    description: 'Complete interior + exterior detailing, engine bay & wax coat.',
  },
  {
    name: 'Polish & Wax',
    category: 'Polish & Wax',
    vehicleType: 'Sedan',
    price: 2200,
    estimatedMinutes: 60,
    description: 'Machine buffing & hydrophobic carnauba wax coat.',
  },
  {
    name: 'Engine Cleaning',
    category: 'Engine Cleaning',
    vehicleType: 'All',
    price: 1000,
    estimatedMinutes: 35,
    description: 'Safe degreaser steam wash & dressing.',
  },
  {
    name: 'Bike Wash',
    category: 'Bike Wash',
    vehicleType: 'Bike',
    price: 300,
    estimatedMinutes: 15,
    description: 'Pressure wash, chain rinse & body shine.',
  },
];

export const CARWASH_JOB_STATUSES: CarWashJobStatus[] = [
  'Booked',
  'Waiting',
  'In Progress',
  'Completed',
  'Delivered',
  'Cancelled',
];

export function computeCarWashJobTotal(price: number, discount = 0): number {
  return Math.max(0, Math.round(Number(price || 0) - Math.max(0, Number(discount || 0))));
}

export function computeCarWashMetrics(
  jobs: CarWashJobCard[],
  payments: IndustryPaymentRecord[],
  todayIso: string = new Date().toISOString().slice(0, 10)
) {
  const todayJobs = jobs.filter(
    (j) => j.scheduledDate === todayIso || String(j.createdAt || '').startsWith(todayIso)
  );
  const queueCount = jobs.filter((j) => j.status === 'Booked' || j.status === 'Waiting').length;
  const inProgressCount = jobs.filter((j) => j.status === 'In Progress').length;
  const completedCount = jobs.filter(
    (j) => j.status === 'Completed' || j.status === 'Delivered'
  ).length;

  const paidTodayFromJobs = todayJobs
    .filter((j) => j.status !== 'Cancelled')
    .reduce((sum, j) => sum + Number(j.paidAmount || 0), 0);

  const paidTodayFromLedger = payments
    .filter(
      (p) =>
        (p.status === 'paid' || p.status === 'verified') &&
        String(p.createdAt || '').startsWith(todayIso)
    )
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const pendingPayments = jobs
    .filter((j) => j.status !== 'Cancelled' && j.paymentStatus !== 'paid')
    .reduce(
      (sum, j) => sum + Math.max(0, Number(j.totalAmount || 0) - Number(j.paidAmount || 0)),
      0
    );

  return {
    todayBookings: todayJobs.length,
    vehiclesInQueue: queueCount,
    jobsInProgress: inProgressCount,
    completedServices: completedCount,
    todayRevenue: Math.max(paidTodayFromJobs, paidTodayFromLedger),
    pendingPayments,
  };
}

export async function getCarWashPackages(shopId: string): Promise<CarWashServicePackage[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'carwash_packages'));
    return snap.docs
      .map((d) => ({ ...(d.data() as CarWashServicePackage), id: d.id }))
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/carwash_packages`);
  }
}

export async function saveCarWashPackage(
  shopId: string,
  pkg: Partial<CarWashServicePackage> & { name: string; price: number }
): Promise<CarWashServicePackage> {
  const id = pkg.id || `cwpkg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<CarWashServicePackage>({
    id,
    shopId,
    name: pkg.name.trim(),
    category: pkg.category || 'Custom',
    vehicleType: pkg.vehicleType || 'All',
    price: Math.max(0, Number(pkg.price || 0)),
    estimatedMinutes: Math.max(10, Number(pkg.estimatedMinutes || 30)),
    description: pkg.description?.trim() || '',
    isActive: pkg.isActive !== false,
    createdAt: pkg.createdAt || now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'carwash_packages', id), payload, { merge: true });
    if (payload.isActive) {
      await savePublicOffering(shopId, {
        id,
        businessType: 'carwash',
        title: payload.name,
        subtitle: `${payload.vehicleType} · ~${payload.estimatedMinutes} mins`,
        price: payload.price,
        durationLabel: `${payload.estimatedMinutes} mins`,
        description: payload.description,
        isActive: true,
      });
    } else {
      await deletePublicOffering(shopId, id);
    }
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/carwash_packages/${id}`);
  }
}

export async function deleteCarWashPackage(shopId: string, packageId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'carwash_packages', packageId));
    await deletePublicOffering(shopId, packageId);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/carwash_packages/${packageId}`);
  }
}

export async function getCarWashCustomers(shopId: string): Promise<CarWashCustomer[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'carwash_customers'));
    return snap.docs.map((d) => ({ ...(d.data() as CarWashCustomer), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/carwash_customers`);
  }
}

export async function saveCarWashCustomer(
  shopId: string,
  customer: Partial<CarWashCustomer> & { name: string; phone: string }
): Promise<CarWashCustomer> {
  const id = customer.id || `cwcust_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<CarWashCustomer>({
    id,
    shopId,
    name: customer.name.trim(),
    phone: customer.phone.trim(),
    totalVisits: Number(customer.totalVisits || 0),
    totalSpent: Number(customer.totalSpent || 0),
    lastVisitAt: customer.lastVisitAt || now,
    createdAt: customer.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'carwash_customers', id), payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/carwash_customers/${id}`);
  }
}

export async function getCarWashVehicles(shopId: string): Promise<CarWashVehicle[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'carwash_vehicles'));
    return snap.docs.map((d) => ({ ...(d.data() as CarWashVehicle), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/carwash_vehicles`);
  }
}

export async function saveCarWashVehicle(
  shopId: string,
  vehicle: Partial<CarWashVehicle> & {
    customerId: string;
    customerName: string;
    customerPhone: string;
    plateNumber: string;
    makeModel: string;
  }
): Promise<CarWashVehicle> {
  const id = vehicle.id || `cwveh_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<CarWashVehicle>({
    id,
    shopId,
    customerId: vehicle.customerId,
    customerName: vehicle.customerName.trim(),
    customerPhone: vehicle.customerPhone.trim(),
    plateNumber: vehicle.plateNumber.trim().toUpperCase(),
    makeModel: vehicle.makeModel.trim(),
    vehicleType: vehicle.vehicleType || 'Sedan',
    color: vehicle.color?.trim(),
    createdAt: vehicle.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'carwash_vehicles', id), payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/carwash_vehicles/${id}`);
  }
}

export async function getCarWashJobs(shopId: string): Promise<CarWashJobCard[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'carwash_jobs'),
      orderBy('createdAt', 'desc'),
      limit(300)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as CarWashJobCard), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/carwash_jobs`);
  }
}

export async function saveCarWashJobCard(
  shopId: string,
  job: Partial<CarWashJobCard> & {
    customerName: string;
    customerPhone: string;
    plateNumber: string;
    packageName: string;
    price: number;
  }
): Promise<CarWashJobCard> {
  const id = job.id || `cwjob_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const discount = Math.max(0, Number(job.discount || 0));
  const totalAmount = computeCarWashJobTotal(job.price, discount);
  const paidAmount = Math.max(0, Number(job.paidAmount || 0));
  const paymentStatus: CarWashJobCard['paymentStatus'] =
    paidAmount >= totalAmount && totalAmount > 0
      ? 'paid'
      : paidAmount > 0
      ? 'partial'
      : 'unpaid';

  const payload = stripUndefined<CarWashJobCard>({
    id,
    shopId,
    jobNumber: job.jobNumber || `CW-${Date.now().toString().slice(-5)}`,
    customerId: job.customerId || '',
    customerName: job.customerName.trim(),
    customerPhone: job.customerPhone.trim(),
    vehicleId: job.vehicleId || '',
    plateNumber: job.plateNumber.trim().toUpperCase(),
    vehicleModel: job.vehicleModel?.trim() || 'Vehicle',
    vehicleType: job.vehicleType || 'Sedan',
    packageId: job.packageId || '',
    packageName: job.packageName.trim(),
    assignedStaffId: job.assignedStaffId,
    assignedStaffName: job.assignedStaffName,
    bookingType: job.bookingType || 'walk_in',
    scheduledDate: job.scheduledDate || now.slice(0, 10),
    scheduledTime: job.scheduledTime,
    status: job.status || 'Waiting',
    price: Math.max(0, Number(job.price || 0)),
    discount,
    totalAmount,
    paidAmount,
    paymentStatus,
    paymentMethod: job.paymentMethod,
    notes: job.notes?.trim(),
    createdAt: job.createdAt || now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'carwash_jobs', id), payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/carwash_jobs/${id}`);
  }
}

export async function updateCarWashJobStatus(
  shopId: string,
  jobId: string,
  status: CarWashJobStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'carwash_jobs', jobId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}/carwash_jobs/${jobId}`);
  }
}

export async function submitPublicCarWashBooking(
  shopId: string,
  input: {
    customerName: string;
    customerPhone: string;
    plateNumber: string;
    vehicleModel: string;
    vehicleType: CarWashJobCard['vehicleType'];
    packageId: string;
    packageName: string;
    price: number;
    scheduledDate: string;
    scheduledTime?: string;
    notes?: string;
  }
): Promise<string> {
  const id = `cwjob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const payload: CarWashJobCard = stripUndefined({
    id,
    shopId,
    jobNumber: `CW-${Date.now().toString().slice(-5)}`,
    customerId: 'public_booking',
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    vehicleId: 'public_booking',
    plateNumber: input.plateNumber.trim().toUpperCase(),
    vehicleModel: input.vehicleModel.trim(),
    vehicleType: input.vehicleType || 'Sedan',
    packageId: input.packageId,
    packageName: input.packageName,
    bookingType: 'booking',
    scheduledDate: input.scheduledDate || now.slice(0, 10),
    scheduledTime: input.scheduledTime,
    status: 'Booked',
    price: Math.max(0, Number(input.price || 0)),
    discount: 0,
    totalAmount: Math.max(0, Number(input.price || 0)),
    paidAmount: 0,
    paymentStatus: 'unpaid',
    source: 'public_booking',
    notes: input.notes?.trim(),
    createdAt: now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'carwash_jobs', id), payload);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}/carwash_jobs/${id}`);
  }
}

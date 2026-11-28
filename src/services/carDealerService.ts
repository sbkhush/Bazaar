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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import {
  DealerDeal,
  DealerInquiry,
  DealerLead,
  DealerPublicVehicle,
  DealerVehicle,
} from '../types';
import { stripUndefined } from './platformService';

/**
 * Strips ALL confidential dealer financial/private fields (`purchasePrice`,
 * `expectedProfit`, `commissionAmount`, `internalNotes`, `registrationNumber`)
 * before creating or updating the public showroom projection.
 */
export function toDealerPublicVehicle(v: DealerVehicle): DealerPublicVehicle {
  return stripUndefined<DealerPublicVehicle>({
    id: v.id,
    shopId: v.shopId,
    title: v.title,
    make: v.make,
    model: v.model,
    variant: v.variant,
    year: v.year,
    registrationCity: v.registrationCity,
    mileageKm: v.mileageKm,
    transmission: v.transmission,
    fuelType: v.fuelType,
    engineCapacity: v.engineCapacity,
    color: v.color,
    condition: v.condition,
    exteriorDetails: v.exteriorDetails,
    interiorDetails: v.interiorDetails,
    images: Array.isArray(v.images) ? v.images : [],
    askingPrice: v.askingPrice,
    status: v.status === 'Reserved' ? 'Reserved' : 'Available',
    featured: Boolean(v.featured),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  });
}

export function filterPublicVehicles(
  vehicles: DealerPublicVehicle[],
  filters: {
    search?: string;
    make?: string;
    minYear?: number;
    maxPrice?: number;
    maxMileage?: number;
  }
): DealerPublicVehicle[] {
  const q = (filters.search || '').trim().toLowerCase();
  const makeFilter = (filters.make || '').trim().toLowerCase();

  return vehicles.filter((v) => {
    if (q) {
      const hay = `${v.title} ${v.make} ${v.model} ${v.variant || ''} ${v.registrationCity || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (makeFilter && makeFilter !== 'all' && v.make.toLowerCase() !== makeFilter) {
      return false;
    }
    if (filters.minYear && Number(v.year) < filters.minYear) {
      return false;
    }
    if (filters.maxPrice && Number(v.askingPrice) > filters.maxPrice) {
      return false;
    }
    if (filters.maxMileage && Number(v.mileageKm) > filters.maxMileage) {
      return false;
    }
    return true;
  });
}

export function computeDealerMetrics(
  vehicles: DealerVehicle[],
  inquiries: DealerInquiry[],
  leads: DealerLead[],
  deals: DealerDeal[]
) {
  const available = vehicles.filter((v) => v.status === 'Available').length;
  const reserved = vehicles.filter((v) => v.status === 'Reserved').length;
  const sold = vehicles.filter((v) => v.status === 'Sold').length;
  const stockAskingValue = vehicles
    .filter((v) => v.status === 'Available' || v.status === 'Reserved')
    .reduce((sum, v) => sum + Number(v.askingPrice || 0), 0);
  const openInquiries = inquiries.filter((i) => i.status === 'new' || i.status === 'contacted').length;
  const realizedProfit = deals.reduce((sum, d) => sum + Number(d.netProfit || 0), 0);
  const totalSalesVolume = deals.reduce((sum, d) => sum + Number(d.agreedPrice || 0), 0);

  return {
    totalVehicles: vehicles.length,
    available,
    reserved,
    sold,
    stockAskingValue,
    openInquiries,
    activeLeads: leads.filter((l) => l.stage !== 'closed_lost' && l.stage !== 'closed_won').length,
    dealsCount: deals.length,
    realizedProfit,
    totalSalesVolume,
  };
}

export async function getDealerVehicles(shopId: string): Promise<DealerVehicle[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'vehicles'),
      orderBy('createdAt', 'desc'),
      limit(300)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as DealerVehicle), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/vehicles`);
  }
}

export async function saveDealerVehicle(
  shopId: string,
  vehicle: Partial<DealerVehicle> & {
    make: string;
    model: string;
    year: number;
    askingPrice: number;
  }
): Promise<DealerVehicle> {
  const id = vehicle.id || `veh_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const title =
    vehicle.title?.trim() ||
    `${vehicle.make.trim()} ${vehicle.model.trim()} ${vehicle.variant ? `${vehicle.variant.trim()} ` : ''}${vehicle.year}`;

  const purchasePrice = vehicle.purchasePrice !== undefined ? Math.max(0, Number(vehicle.purchasePrice)) : undefined;
  const askingPrice = Math.max(0, Number(vehicle.askingPrice || 0));
  const expectedProfit =
    purchasePrice !== undefined ? askingPrice - purchasePrice : vehicle.expectedProfit;

  const payload = stripUndefined<DealerVehicle>({
    id,
    shopId,
    title,
    make: vehicle.make.trim(),
    model: vehicle.model.trim(),
    variant: vehicle.variant?.trim(),
    year: Number(vehicle.year),
    registrationCity: vehicle.registrationCity?.trim() || 'Lahore',
    registrationNumber: vehicle.registrationNumber?.trim().toUpperCase(),
    mileageKm: Math.max(0, Number(vehicle.mileageKm || 0)),
    transmission: vehicle.transmission || 'Automatic',
    fuelType: vehicle.fuelType || 'Petrol',
    engineCapacity: vehicle.engineCapacity?.trim() || '1300cc',
    color: vehicle.color?.trim() || 'White',
    condition: vehicle.condition || 'Used',
    exteriorDetails: vehicle.exteriorDetails?.trim(),
    interiorDetails: vehicle.interiorDetails?.trim(),
    images: Array.isArray(vehicle.images) ? vehicle.images : [],
    askingPrice,
    purchasePrice,
    expectedProfit,
    commissionAmount:
      vehicle.commissionAmount !== undefined ? Math.max(0, Number(vehicle.commissionAmount)) : undefined,
    internalNotes: vehicle.internalNotes?.trim(),
    status: vehicle.status || 'Available',
    featured: Boolean(vehicle.featured),
    createdAt: vehicle.createdAt || now,
    updatedAt: now,
  });

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'shops', shopId, 'vehicles', id), payload, { merge: true });
    const pubRef = doc(db, 'shops', shopId, 'publicVehicles', id);
    if (payload.status === 'Available' || payload.status === 'Reserved') {
      batch.set(pubRef, toDealerPublicVehicle(payload));
    } else {
      batch.delete(pubRef);
    }
    await batch.commit();
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/vehicles/${id}`);
  }
}

export async function deleteDealerVehicle(shopId: string, vehicleId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'shops', shopId, 'vehicles', vehicleId));
    batch.delete(doc(db, 'shops', shopId, 'publicVehicles', vehicleId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/vehicles/${vehicleId}`);
  }
}

export async function getPublicDealerVehicles(shopId: string): Promise<DealerPublicVehicle[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'publicVehicles'));
    return snap.docs
      .map((d) => ({ ...(d.data() as DealerPublicVehicle), id: d.id }))
      .filter((v) => v.status === 'Available' || v.status === 'Reserved')
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  } catch {
    return [];
  }
}

export async function getDealerInquiries(shopId: string): Promise<DealerInquiry[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'dealer_inquiries'),
      orderBy('createdAt', 'desc'),
      limit(250)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as DealerInquiry), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/dealer_inquiries`);
  }
}

export async function submitPublicDealerInquiry(
  shopId: string,
  input: {
    vehicleId: string;
    vehicleTitle: string;
    customerName: string;
    customerPhone: string;
    inquiryType: DealerInquiry['inquiryType'];
    preferredDate?: string;
    message?: string;
  }
): Promise<string> {
  const id = `dinq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<DealerInquiry>({
    id,
    shopId,
    vehicleId: input.vehicleId,
    vehicleTitle: input.vehicleTitle,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    inquiryType: input.inquiryType,
    preferredDate: input.preferredDate,
    message: input.message?.trim(),
    status: 'new',
    source: 'public_storefront',
    createdAt: now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'dealer_inquiries', id), payload);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}/dealer_inquiries/${id}`);
  }
}

export async function updateDealerInquiryStatus(
  shopId: string,
  inquiryId: string,
  status: DealerInquiry['status']
): Promise<void> {
  try {
    await updateDoc(doc(db, 'shops', shopId, 'dealer_inquiries', inquiryId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `shops/${shopId}/dealer_inquiries/${inquiryId}`
    );
  }
}

export async function getDealerLeads(shopId: string): Promise<DealerLead[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'dealer_leads'));
    return snap.docs.map((d) => ({ ...(d.data() as DealerLead), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/dealer_leads`);
  }
}

export async function saveDealerLead(
  shopId: string,
  lead: Partial<DealerLead> & { customerName: string; customerPhone: string }
): Promise<DealerLead> {
  const id = lead.id || `dlead_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const payload = stripUndefined<DealerLead>({
    id,
    shopId,
    customerName: lead.customerName.trim(),
    customerPhone: lead.customerPhone.trim(),
    interestedVehicleId: lead.interestedVehicleId,
    interestedVehicleTitle: lead.interestedVehicleTitle,
    assignedSalespersonId: lead.assignedSalespersonId,
    assignedSalespersonName: lead.assignedSalespersonName,
    stage: lead.stage || 'new',
    followUpDate: lead.followUpDate,
    notes: lead.notes?.trim(),
    createdAt: lead.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'dealer_leads', id), payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/dealer_leads/${id}`);
  }
}

export async function getDealerDeals(shopId: string): Promise<DealerDeal[]> {
  try {
    const q = query(
      collection(db, 'shops', shopId, 'dealer_deals'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as DealerDeal), id: d.id }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/dealer_deals`);
  }
}

export async function recordDealerDeal(
  shopId: string,
  deal: Partial<DealerDeal> & {
    vehicleId: string;
    vehicleTitle: string;
    buyerName: string;
    buyerPhone: string;
    agreedPrice: number;
    bookingAmount: number;
  },
  vehicleCostBasis = 0
): Promise<DealerDeal> {
  const id = deal.id || `ddeal_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const now = new Date().toISOString();
  const agreedPrice = Math.max(0, Number(deal.agreedPrice || 0));
  const bookingAmount = Math.max(0, Number(deal.bookingAmount || 0));
  const remainingPayment = Math.max(0, agreedPrice - bookingAmount);
  const commissionAmount = Math.max(0, Number(deal.commissionAmount || 0));
  const netProfit =
    deal.netProfit !== undefined
      ? Number(deal.netProfit)
      : vehicleCostBasis > 0
      ? agreedPrice - vehicleCostBasis - commissionAmount
      : undefined;

  const payload = stripUndefined<DealerDeal>({
    id,
    shopId,
    vehicleId: deal.vehicleId,
    vehicleTitle: deal.vehicleTitle,
    buyerName: deal.buyerName.trim(),
    buyerPhone: deal.buyerPhone.trim(),
    salespersonId: deal.salespersonId,
    salespersonName: deal.salespersonName,
    agreedPrice,
    bookingAmount,
    remainingPayment,
    commissionAmount,
    netProfit,
    deliveryStatus: deal.deliveryStatus || 'booked',
    paymentMethod: deal.paymentMethod || 'bank_transfer',
    notes: deal.notes?.trim(),
    closedAt: deal.deliveryStatus === 'delivered' ? now : deal.closedAt,
    createdAt: deal.createdAt || now,
    updatedAt: now,
  });

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'shops', shopId, 'dealer_deals', id), payload, { merge: true });
    if (deal.vehicleId) {
      const nextStatus = deal.deliveryStatus === 'delivered' ? 'Sold' : 'Reserved';
      batch.update(doc(db, 'shops', shopId, 'vehicles', deal.vehicleId), {
        status: nextStatus,
        updatedAt: now,
      });
      if (nextStatus === 'Sold') {
        batch.delete(doc(db, 'shops', shopId, 'publicVehicles', deal.vehicleId));
      } else {
        batch.set(
          doc(db, 'shops', shopId, 'publicVehicles', deal.vehicleId),
          { status: 'Reserved', updatedAt: now },
          { merge: true }
        );
      }
    }
    await batch.commit();
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/dealer_deals/${id}`);
  }
}

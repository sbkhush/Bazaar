export type IndustryGroup = 'retail' | 'gym' | 'clinic' | 'carwash' | 'car_dealer';

export type ManualPaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'easypaisa'
  | 'jazzcash'
  | 'ibft';

export type IndustryPaymentRecordStatus = 'paid' | 'verified' | 'pending' | 'partial' | 'refunded';

export interface IndustryPaymentRecord {
  id: string;
  shopId: string;
  module?: 'gym' | 'clinic' | 'carwash' | 'car_dealer';
  businessType?: string;
  industry?: IndustryGroup;
  referenceType:
    | 'membership'
    | 'gym_membership'
    | 'consultation'
    | 'clinic_appointment'
    | 'carwash_job'
    | 'dealer_deal'
    | 'other';
  referenceId: string;
  customerName: string;
  customerOrPatientName?: string;
  customerPhone?: string;
  description?: string;
  amount: number;
  paidAmount?: number;
  remainingAmount?: number;
  method: ManualPaymentMethod;
  status: IndustryPaymentRecordStatus;
  transactionRef?: string;
  transactionReference?: string;
  proofUrl?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  recordedBy?: string;
  recordedByEmail?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ShopAuditLog {
  id: string;
  shopId: string;
  actorId: string;
  actorUid?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  entityType:
    | 'clinic_patient'
    | 'clinic_medical_note'
    | 'clinic_appointment'
    | 'gym_member'
    | 'dealer_vehicle'
    | 'dealer_deal'
    | 'carwash_job'
    | 'payment'
    | 'staff';
  entityId: string;
  resourceType?: string;
  resourceId?: string;
  details: string;
  createdAt: string;
}

export interface PublicOfferingItem {
  id: string;
  shopId: string;
  businessType?: string;
  category?: 'gym_plan' | 'clinic_doctor' | 'carwash_package' | 'service';
  title: string;
  subtitle?: string;
  description?: string;
  price: number;
  durationLabel?: string;
  scheduleLabel?: string;
  isActive: boolean;
  order?: number;
  updatedAt?: string;
}

export interface IndustryCategoryConfig {
  id: string;
  label: string;
  name?: string;
  group: IndustryGroup;
  enabled: boolean;
  publicPrefix: '/s' | '/gym' | '/clinic' | '/carwash' | '/dealer';
  description?: string;
  defaultMaxRecords: number;
  maxFreeRecords?: number;
  notes?: string;
  updatedAt?: string;
}

// ====================================================
// 1. GYM & FITNESS CENTER MODULE
// ====================================================

export type GymPlanDuration = 'monthly' | 'quarterly' | 'half_yearly' | 'annual' | 'custom';
export type GymMemberStatus = 'active' | 'expired' | 'frozen' | 'cancelled';

export interface GymPlan {
  id: string;
  shopId: string;
  name: string;
  durationType: GymPlanDuration;
  durationDays: number;
  price: number;
  registrationFee?: number;
  description?: string;
  includesTrainer?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface GymTrainer {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  specialty: string;
  shiftTiming?: string;
  schedule?: string;
  monthlyFee?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface GymWorkoutPlan {
  id: string;
  shopId: string;
  title: string;
  goal: string;
  trainerId?: string;
  trainerName?: string;
  memberId?: string;
  memberName?: string;
  scheduleSummary?: string;
  scheduleNotes?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GymMember {
  id: string;
  shopId: string;
  memberCode: string;
  name: string;
  fullName?: string;
  phone: string;
  email?: string;
  cnicLast4?: string;
  gender?: 'male' | 'female' | 'other';
  emergencyContact?: string;
  planId?: string;
  planName?: string;
  planPrice?: number;
  trainerId?: string;
  trainerName?: string;
  workoutPlanId?: string;
  startDate: string;
  expiryDate: string;
  status: GymMemberStatus;
  frozenAt?: string;
  feeAmount: number;
  paidAmount: number;
  feePaid?: number;
  pendingAmount: number;
  qrToken: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GymAttendanceRecord {
  id: string;
  shopId: string;
  memberId: string;
  memberCode?: string;
  memberName: string;
  memberPhone?: string;
  date: string; // YYYY-MM-DD
  dateKey?: string;
  checkInAt: string;
  checkOutAt?: string;
  method: 'qr' | 'manual';
  recordedBy?: string;
}

// ====================================================
// 2. CLINIC & MEDICAL CENTER (ADMINISTRATIVE & PRIVACY-FIRST)
// ====================================================

export type ClinicAppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Checked In'
  | 'Completed'
  | 'Cancelled'
  | 'No Show';

export interface ClinicDoctor {
  id: string;
  shopId: string;
  name: string;
  specialty: string;
  specialization?: string;
  qualification?: string;
  phone?: string;
  consultationFee: number;
  availableDays: string[];
  timings: string;
  staffUid?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ClinicPatient {
  id: string;
  shopId: string;
  patientCode: string;
  name: string;
  fullName?: string;
  phone: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other' | 'male' | 'female' | 'other';
  bloodGroup?: string;
  address?: string;
  city?: string;
  guardianName?: string;
  allergiesNote?: string;
  totalVisits?: number;
  outstandingFee?: number;
  lastVisitAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClinicAppointment {
  id: string;
  shopId: string;
  appointmentNumber?: string;
  patientId?: string;
  patientName: string;
  patientPhone: string;
  doctorId?: string;
  doctorName: string;
  appointmentDate: string; // YYYY-MM-DD
  timeSlot: string;
  visitType?: 'new' | 'follow_up' | 'walk_in';
  isFollowUp?: boolean;
  status: ClinicAppointmentStatus;
  consultationFee: number;
  feeStatus: 'unpaid' | 'paid' | 'partial';
  paidAmount: number;
  paymentMethod?: ManualPaymentMethod;
  visitReason?: string;
  reasonForVisit?: string;
  reminderSentAt?: string;
  source: 'dashboard' | 'staff_desk' | 'public_booking';
  createdAt: string;
  updatedAt?: string;
}

export interface ClinicPrescriptionItem {
  medicine: string;
  medicineName?: string;
  dosage: string;
  duration: string;
  instructions?: string;
}

export interface ClinicMedicalNote {
  id: string;
  shopId: string;
  patientId: string;
  patientName: string;
  appointmentId?: string;
  doctorId?: string;
  doctorName: string;
  doctorUid?: string;
  visitDate: string;
  chiefComplaint: string;
  vitalSignsNote?: string;
  clinicalObservations?: string;
  clinicalNotes?: string;
  prescriptions: ClinicPrescriptionItem[];
  advice?: string;
  followUpDate?: string;
  createdByUid: string;
  createdByEmail?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

// ====================================================
// 3. CAR WASH & AUTO DETAILING
// ====================================================

export type CarWashJobStatus =
  | 'Booked'
  | 'Waiting'
  | 'In Progress'
  | 'Completed'
  | 'Delivered'
  | 'Cancelled';

export type CarWashVehicleType =
  | 'Sedan'
  | 'Hatchback'
  | 'SUV'
  | '4x4'
  | 'Van'
  | 'Bike'
  | 'All'
  | 'sedan'
  | 'hatchback'
  | 'suv'
  | 'pickup'
  | 'bike'
  | 'van'
  | 'other';

export interface CarWashServicePackage {
  id: string;
  shopId: string;
  name: string;
  category:
    | 'Basic Wash'
    | 'Premium Wash'
    | 'Interior Cleaning'
    | 'Exterior Detailing'
    | 'Full Detailing'
    | 'Polish & Wax'
    | 'Engine Cleaning'
    | 'Bike Wash'
    | 'Custom';
  vehicleType: CarWashVehicleType;
  price: number;
  estimatedMinutes: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CarWashCustomer {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  totalVisits: number;
  visitsCount?: number;
  totalSpent: number;
  lastVisitAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CarWashVehicle {
  id: string;
  shopId: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  plateNumber: string;
  makeModel: string;
  vehicleType: CarWashVehicleType;
  color?: string;
  visitsCount?: number;
  lastServiceAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CarWashJobCard {
  id: string;
  shopId: string;
  jobNumber: string;
  source?: 'walk_in' | 'booking' | 'public_booking';
  bookingType?: 'walk_in' | 'booking';
  customerId?: string;
  customerName: string;
  customerPhone: string;
  vehicleId?: string;
  plateNumber: string;
  vehicleModel: string;
  makeModel?: string;
  vehicleType: CarWashVehicleType;
  packageId?: string;
  packageName: string;
  serviceId?: string;
  serviceName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime?: string;
  status: CarWashJobStatus;
  price: number;
  packagePrice?: number;
  discount: number;
  totalAmount: number;
  finalAmount?: number;
  paidAmount: number;
  paymentStatus: 'unpaid' | 'paid' | 'partial';
  paymentMethod?: ManualPaymentMethod;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ====================================================
// 4. CAR DEALER & USED CAR SHOWROOM
// ====================================================

export type DealerVehicleStatus =
  | 'Available'
  | 'Reserved'
  | 'Sold'
  | 'Under Inspection'
  | 'Inactive';

export type DealerTransmission = 'Automatic' | 'Manual' | 'CVT' | 'Hybrid';
export type DealerFuelType = 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric' | 'CNG';

/**
 * Private showroom inventory record (includes purchase cost, expected profit, internal notes, commissions).
 * NEVER exposed on public routes or publicVehicles collection.
 */
export interface DealerVehicle {
  id: string;
  shopId: string;
  title: string;
  stockCode?: string;
  make: string;
  model: string;
  variant?: string;
  year: number;
  registrationCity: string;
  registrationNumber?: string;
  mileageKm: number;
  transmission: DealerTransmission;
  fuelType: DealerFuelType;
  engineCapacity: string;
  engineCapacityCc?: string;
  color?: string;
  condition: string;
  conditionGrade?: string;
  exteriorDetails?: string;
  interiorDetails?: string;
  images: string[];
  askingPrice: number;
  purchasePrice?: number; // PRIVATE
  expectedProfit?: number; // PRIVATE
  commissionAmount?: number; // PRIVATE
  internalNotes?: string; // PRIVATE
  status: DealerVehicleStatus;
  featured: boolean;
  isFeatured?: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Public-safe vehicle projection stored in shops/{shopId}/publicVehicles/{vehicleId}.
 * Strips purchasePrice, expectedProfit, commissionAmount, internalNotes, registrationNumber.
 */
export interface DealerPublicVehicle {
  id: string;
  shopId: string;
  title: string;
  stockCode?: string;
  make: string;
  model: string;
  variant?: string;
  year: number;
  registrationCity: string;
  mileageKm: number;
  transmission: DealerTransmission;
  fuelType: DealerFuelType;
  engineCapacity: string;
  engineCapacityCc?: string;
  color?: string;
  condition: string;
  conditionGrade?: string;
  exteriorDetails?: string;
  interiorDetails?: string;
  images: string[];
  askingPrice: number;
  status: 'Available' | 'Reserved';
  featured: boolean;
  isFeatured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DealerInquiry {
  id: string;
  shopId: string;
  vehicleId?: string;
  vehicleTitle?: string;
  customerName: string;
  customerPhone: string;
  inquiryType: 'test_drive' | 'price_offer' | 'general_inquiry' | 'inquiry';
  preferredDate?: string;
  message?: string;
  status: 'new' | 'contacted' | 'scheduled' | 'closed';
  source: 'public_storefront' | 'dashboard';
  createdAt: string;
  updatedAt?: string;
}

export interface DealerLead {
  id: string;
  shopId: string;
  customerName: string;
  customerPhone: string;
  interestedVehicleId?: string;
  interestedVehicleTitle?: string;
  budgetMax?: number;
  stage: 'new' | 'contacted' | 'follow_up' | 'test_drive' | 'negotiation' | 'won' | 'closed_won' | 'lost' | 'closed_lost';
  followUpDate?: string;
  assignedSalespersonId?: string;
  assignedSalespersonName?: string;
  assignedSalesperson?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DealerDeal {
  id: string;
  shopId: string;
  dealNumber?: string;
  vehicleId: string;
  vehicleTitle: string;
  buyerName: string;
  buyerPhone: string;
  buyerCnicLast4?: string;
  salespersonId?: string;
  salespersonName?: string;
  agreedPrice: number;
  salePrice?: number;
  purchaseCost?: number;
  netProfit?: number;
  bookingAmount: number;
  remainingPayment: number;
  remainingAmount?: number;
  paidTotal?: number;
  commissionAmount?: number;
  salespersonCommission?: number;
  paymentMethod: ManualPaymentMethod;
  deliveryStatus: 'booked' | 'pending_payment' | 'documents_ready' | 'delivered' | 'cancelled';
  closedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

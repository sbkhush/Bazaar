import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUSINESS_TYPE_OPTIONS } from '../src/data/seedData';
import {
  ALL_INDUSTRY_META,
  buildIndustryPublicPath,
  getDefaultPermissionsForRole,
  getIndustryGroup,
  getIndustryPublicPrefix,
  getPermissionsForIndustry,
  getRequiredPlanFeatureForIndustry,
  getRoleOptionsForIndustry,
  getSidebarNavForIndustry,
} from '../src/config/industryConfig';
import { buildStorefrontPath, KNOWN_APP_ROOTS } from '../src/utils/tenantDomain';
import {
  buildGymQrPayload,
  computeGymDashboardMetrics,
  computeGymExpiryDate,
  computeGymMemberStatus,
  parseGymQrPayload,
} from '../src/services/gymService';
import {
  computeCarWashJobTotal,
  computeCarWashMetrics,
} from '../src/services/carwashService';
import {
  filterPublicVehicles,
  toDealerPublicVehicle,
} from '../src/services/carDealerService';
import { CLINIC_ADMIN_DISCLAIMER } from '../src/services/clinicService';
import {
  calculatePaymentTotals,
  formatWhatsAppReminderUrl,
} from '../src/services/industryCommonService';
import type {
  BusinessType,
  CarWashJobCard,
  DealerVehicle,
  GymAttendanceRecord,
  GymMember,
  IndustryPaymentRecord,
} from '../src/types';

const WORKSPACE_ROOT = path.resolve(__dirname, '..');

function readWorkspaceFile(relPath: string): string {
  return fs.readFileSync(path.join(WORKSPACE_ROOT, relPath), 'utf-8');
}

describe('SB Khush Multi-Industry SaaS Expansion', () => {
  it('supports all 10 required business categories consistently across seed options, industry config, and blueprint', () => {
    const expectedIds: BusinessType[] = [
      'general_store',
      'clothing',
      'cosmetics',
      'electronics',
      'pharmacy',
      'gym',
      'clinic',
      'carwash',
      'car_dealer',
      'other_retail',
    ];

    expect(BUSINESS_TYPE_OPTIONS.map((o) => o.value)).toEqual(expectedIds);
    expect(ALL_INDUSTRY_META.map((m) => m.id)).toEqual(expectedIds);

    const blueprint = JSON.parse(readWorkspaceFile('firebase-blueprint.json')) as {
      entities: {
        Shop: { properties: { businessType: { enum: string[] } } };
        ShopPublic: { properties: { businessType: { enum: string[] } } };
      };
    };
    expect(blueprint.entities.Shop.properties.businessType.enum).toEqual(expectedIds);
    expect(blueprint.entities.ShopPublic.properties.businessType.enum).toEqual(expectedIds);
  });

  it('resolves industry-specific public prefixes, routing roots, and 404 SPA parity cleanly', () => {
    expect(getIndustryPublicPrefix('general_store')).toBe('/s');
    expect(getIndustryPublicPrefix('electronics')).toBe('/s');
    expect(getIndustryPublicPrefix('pharmacy')).toBe('/s');
    expect(getIndustryPublicPrefix('gym')).toBe('/gym');
    expect(getIndustryPublicPrefix('clinic')).toBe('/clinic');
    expect(getIndustryPublicPrefix('carwash')).toBe('/carwash');
    expect(getIndustryPublicPrefix('car_dealer')).toBe('/dealer');

    expect(buildIndustryPublicPath('iron-pulse', 'gym')).toBe('/gym/iron-pulse');
    expect(buildIndustryPublicPath('al-shifa', 'clinic')).toBe('/clinic/al-shifa');
    expect(buildIndustryPublicPath('spark-wash', 'carwash')).toBe('/carwash/spark-wash');
    expect(buildIndustryPublicPath('lahore-motors', 'car_dealer')).toBe('/dealer/lahore-motors');
    expect(buildStorefrontPath('karachi-mart', '/shop', 'general_store')).toBe('/s/karachi-mart/shop');

    expect(getRequiredPlanFeatureForIndustry('gym')).toBe('gymModule');
    expect(getRequiredPlanFeatureForIndustry('clinic')).toBe('clinicModule');
    expect(getRequiredPlanFeatureForIndustry('carwash')).toBe('carwashModule');
    expect(getRequiredPlanFeatureForIndustry('car_dealer')).toBe('dealerModule');
    expect(getRequiredPlanFeatureForIndustry('general_store')).toBeNull();

    const html404 = readWorkspaceFile('public/404.html');
    const firestoreRules = readWorkspaceFile('firestore.rules');
    const functionsSrc = readWorkspaceFile('functions/src/index.ts');

    for (const root of ['gym', 'clinic', 'carwash', 'dealer']) {
      expect(KNOWN_APP_ROOTS).toContain(root);
      expect(html404).toContain(`'${root}'`);
      expect(firestoreRules).toContain(`'${root}'`);
      expect(functionsSrc).toContain(`'${root}'`);
    }
  });

  it('strictly isolates dashboard sidebar navigation, roles, and permissions per industry', () => {
    const retailNav = getSidebarNavForIndustry('general_store').map((n) => n.to);
    const gymNav = getSidebarNavForIndustry('gym').map((n) => n.to);
    const clinicNav = getSidebarNavForIndustry('clinic').map((n) => n.to);
    const carwashNav = getSidebarNavForIndustry('carwash').map((n) => n.to);
    const dealerNav = getSidebarNavForIndustry('car_dealer').map((n) => n.to);

    expect(retailNav).toContain('/dashboard/pos');
    expect(retailNav).toContain('/dashboard/khata');
    expect(retailNav).not.toContain('/dashboard/gym/members');

    expect(gymNav).toContain('/dashboard/gym/members');
    expect(gymNav).toContain('/dashboard/gym/attendance');
    expect(gymNav).not.toContain('/dashboard/pos');
    expect(gymNav).not.toContain('/dashboard/clinic/patients');

    expect(clinicNav).toContain('/dashboard/clinic/appointments');
    expect(clinicNav).toContain('/dashboard/clinic/patients');
    expect(clinicNav).not.toContain('/dashboard/pos');
    expect(clinicNav).not.toContain('/dashboard/dealer/inventory');

    expect(carwashNav).toContain('/dashboard/carwash/queue');
    expect(carwashNav).toContain('/dashboard/carwash/packages');
    expect(carwashNav).not.toContain('/dashboard/khata');

    expect(dealerNav).toContain('/dashboard/dealer/inventory');
    expect(dealerNav).toContain('/dashboard/dealer/leads-deals');
    expect(dealerNav).not.toContain('/dashboard/products');

    expect(getRoleOptionsForIndustry('clinic').map((r) => r.value)).toContain('doctor');
    expect(getRoleOptionsForIndustry('gym').map((r) => r.value)).toContain('trainer');
    expect(getRoleOptionsForIndustry('car_dealer').map((r) => r.value)).toContain('salesperson');
    expect(getRoleOptionsForIndustry('general_store').map((r) => r.value)).not.toContain('doctor');

    expect(getDefaultPermissionsForRole('doctor', 'clinic')).toContain('clinic_notes');
    expect(getDefaultPermissionsForRole('shop_staff', 'clinic')).not.toContain('clinic_notes');
    expect(getPermissionsForIndustry('car_dealer').map((p) => p.key)).toContain('dealer_private_pricing');
    expect(getIndustryGroup('pharmacy')).toBe('retail');
  });

  it('computes Gym expiry dates, statuses, QR check-in tokens, and dashboard KPIs accurately', () => {
    expect(computeGymExpiryDate('2026-03-01', 30)).toBe('2026-03-31');

    expect(computeGymMemberStatus({ status: 'active', expiryDate: '2026-02-01' }, '2026-03-10')).toBe('expired');
    expect(computeGymMemberStatus({ status: 'frozen', expiryDate: '2026-02-01' }, '2026-03-10')).toBe('frozen');
    expect(computeGymMemberStatus({ status: 'active', expiryDate: '2026-04-01' }, '2026-03-10')).toBe('active');

    const qrRaw = buildGymQrPayload('iron-gym', 'gmem_123', 'GYM999');
    expect(parseGymQrPayload(qrRaw)).toEqual({
      shopId: 'iron-gym',
      memberId: 'gmem_123',
      qrToken: 'GYM999',
    });

    const members: GymMember[] = [
      {
        id: 'm1',
        shopId: 'iron-gym',
        memberCode: 'M-1',
        name: 'Bilal',
        phone: '03001112233',
        startDate: '2026-03-01',
        expiryDate: '2026-04-01',
        status: 'active',
        feeAmount: 3000,
        paidAmount: 3000,
        pendingAmount: 0,
        qrToken: 'QR1',
        createdAt: '2026-03-01T10:00:00.000Z',
      },
      {
        id: 'm2',
        shopId: 'iron-gym',
        memberCode: 'M-2',
        name: 'Hamza',
        phone: '03211112233',
        startDate: '2026-01-01',
        expiryDate: '2026-02-01',
        status: 'active',
        feeAmount: 3000,
        paidAmount: 2000,
        pendingAmount: 1000,
        qrToken: 'QR2',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ];
    const attendance: GymAttendanceRecord[] = [
      {
        id: 'att1',
        shopId: 'iron-gym',
        memberId: 'm1',
        memberName: 'Bilal',
        date: '2026-03-10',
        checkInAt: '2026-03-10T08:00:00.000Z',
        method: 'qr',
      },
    ];
    const payments: IndustryPaymentRecord[] = [
      {
        id: 'p1',
        shopId: 'iron-gym',
        referenceType: 'membership',
        referenceId: 'm1',
        customerName: 'Bilal',
        amount: 3000,
        method: 'easypaisa',
        status: 'paid',
        createdAt: '2026-03-01T10:00:00.000Z',
      },
    ];

    const stats = computeGymDashboardMetrics(members, attendance, payments, '2026-03-10');
    expect(stats.totalMembers).toBe(2);
    expect(stats.activeMembers).toBe(1);
    expect(stats.expiredMembers).toBe(1);
    expect(stats.todayAttendance).toBe(1);
    expect(stats.monthlyRevenue).toBe(3000);
    expect(stats.pendingPayments).toBe(1000);
  });

  it('computes Car Wash job totals, metrics, and Pakistani WhatsApp reminder links', () => {
    expect(computeCarWashJobTotal(1200, 200)).toBe(1000);
    expect(computeCarWashJobTotal(700, 1500)).toBe(0);

    const jobs: CarWashJobCard[] = [
      {
        id: 'j1',
        shopId: 'cw1',
        jobNumber: 'CW-1',
        customerName: 'Usman',
        customerPhone: '03005551234',
        plateNumber: 'LEA-1234',
        vehicleModel: 'Civic',
        vehicleType: 'Sedan',
        packageName: 'Premium Wash',
        scheduledDate: '2026-03-10',
        status: 'In Progress',
        price: 1200,
        discount: 200,
        totalAmount: 1000,
        paidAmount: 400,
        paymentStatus: 'partial',
        createdAt: '2026-03-10T09:00:00.000Z',
      },
    ];
    const stats = computeCarWashMetrics(jobs, [], '2026-03-10');
    expect(stats.todayBookings).toBe(1);
    expect(stats.jobsInProgress).toBe(1);
    expect(stats.todayRevenue).toBe(400);
    expect(stats.pendingPayments).toBe(600);

    expect(formatWhatsAppReminderUrl('0300-1234567', 'Hello')).toBe('https://wa.me/923001234567?text=Hello');
    expect(
      calculatePaymentTotals([
        {
          id: '1',
          shopId: 's',
          referenceType: 'carwash_job',
          referenceId: 'j1',
          customerName: 'Usman',
          amount: 1000,
          method: 'cash',
          status: 'verified',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          shopId: 's',
          referenceType: 'carwash_job',
          referenceId: 'j2',
          customerName: 'Ali',
          amount: 500,
          method: 'jazzcash',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ])
    ).toMatchObject({ paidTotal: 1000, pendingTotal: 500, monthlyPaid: 1000 });
  });

  it('strips confidential pricing/profit/commission fields in toDealerPublicVehicle and filters public showroom inventory', () => {
    const privateVehicle: DealerVehicle = {
      id: 'veh_1',
      shopId: 'lahore-motors',
      title: 'Toyota Corolla Altis Grande 2022',
      make: 'Toyota',
      model: 'Corolla',
      variant: 'Altis Grande',
      year: 2022,
      registrationCity: 'Lahore',
      registrationNumber: 'LEC-22-9090',
      mileageKm: 28000,
      transmission: 'Automatic',
      fuelType: 'Petrol',
      engineCapacity: '1800cc',
      color: 'White',
      condition: 'Used',
      images: ['https://cdn.example.com/corolla.webp'],
      askingPrice: 6850000,
      purchasePrice: 6300000,
      expectedProfit: 550000,
      commissionAmount: 50000,
      internalNotes: 'Owner urgent sale — settled at 6.3M',
      status: 'Available',
      featured: true,
      createdAt: '2026-03-01T10:00:00.000Z',
    };

    const publicDoc = toDealerPublicVehicle(privateVehicle) as unknown as Record<string, unknown>;
    expect(publicDoc.title).toBe('Toyota Corolla Altis Grande 2022');
    expect(publicDoc.askingPrice).toBe(6850000);
    expect('purchasePrice' in publicDoc).toBe(false);
    expect('expectedProfit' in publicDoc).toBe(false);
    expect('commissionAmount' in publicDoc).toBe(false);
    expect('internalNotes' in publicDoc).toBe(false);
    expect('registrationNumber' in publicDoc).toBe(false);

    const list = [
      toDealerPublicVehicle(privateVehicle),
      toDealerPublicVehicle({
        ...privateVehicle,
        id: 'veh_2',
        title: 'Suzuki Alto VXR 2021',
        make: 'Suzuki',
        model: 'Alto',
        variant: 'VXR',
        condition: 'Used',
        color: 'Silver',
        year: 2021,
        askingPrice: 2450000,
        mileageKm: 42000,
      }),
    ];

    expect(filterPublicVehicles(list, { make: 'Suzuki' })).toHaveLength(1);
    expect(filterPublicVehicles(list, { maxPrice: 3000000 })).toHaveLength(1);
    expect(filterPublicVehicles(list, { search: 'grande' })).toHaveLength(1);
    expect(filterPublicVehicles(list, { maxMileage: 30000 })).toHaveLength(1);
  });

  it('enforces Clinic privacy, immutable audit logs, Car Dealer cost isolation, and industry Storage rules', () => {
    expect(CLINIC_ADMIN_DISCLAIMER.toLowerCase()).toContain('administrative');
    expect(CLINIC_ADMIN_DISCLAIMER.toLowerCase()).toContain('does not provide automated medical diagnosis');

    const clinicSrc = readWorkspaceFile('src/services/clinicService.ts');
    expect(clinicSrc).toContain("action: 'Viewed Patient Visit Notes'");
    expect(clinicSrc).toContain("action: 'Added Administrative Visit Note'");

    const firestoreRules = readWorkspaceFile('firestore.rules');
    const storageRules = readWorkspaceFile('storage.rules');

    // Clinic strict isolation & immutable medical notes deletion block
    expect(firestoreRules).toContain('match /clinic_patients/{patientId}');
    expect(firestoreRules).toContain("hasShopPermission(shopId, 'clinic_patients')");
    expect(firestoreRules).toContain('match /clinic_medical_notes/{noteId}');
    expect(firestoreRules).toContain("hasShopPermission(shopId, 'clinic_notes')");
    expect(firestoreRules).toContain('allow delete: if false;');

    // Car Dealer private inventory vs sanitized public catalog
    expect(firestoreRules).toContain('match /vehicles/{vehicleId}');
    expect(firestoreRules).toContain('match /publicVehicles/{vehicleId}');
    expect(firestoreRules).toContain('match /dealer_inquiries/{inquiryId}');

    // Public booking status locks
    expect(firestoreRules).toContain("incoming().source == 'public_booking'");
    expect(firestoreRules).toContain("incoming().status == 'Pending'");
    expect(firestoreRules).toContain("incoming().status == 'Booked'");
    expect(firestoreRules).toContain("incoming().source == 'public_storefront'");

    // Immutable auditLogs & industry roles
    expect(firestoreRules).toContain('match /auditLogs/{logId}');
    expect(firestoreRules).toContain("'manager', 'doctor', 'trainer', 'salesperson', 'shop_staff'");
    expect(storageRules).toContain("'manager', 'doctor', 'trainer', 'salesperson', 'shop_staff'");
    expect(storageRules).toContain('match /shops/{shopId}/vehicles/{allPaths=**}');
    expect(storageRules).toContain('match /shops/{shopId}/receipts/{allPaths=**}');
    expect(storageRules).toContain('allow read: if isShopMember(shopId);');
  });
});

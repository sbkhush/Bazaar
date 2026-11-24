import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import {
  INITIAL_SETTINGS,
  isSelfPickupEnabled,
  isCashOnPickupAllowed,
  derivePickupStatusFromOrderStatus,
  buildPickupQrPayload,
  parsePickupVerificationInput,
  validatePickupDateInWindow,
  buildPickupSlotKey,
  getFulfillmentLabel,
  getPaymentMethodLabel,
} from '../src/data/seedData';
import { hashPickupOtp, generatePickupOtp } from '../src/services/tenantService';

const WORKSPACE_ROOT = path.resolve(__dirname, '..');

function readWorkspaceFile(relPath: string): string {
  return fs.readFileSync(path.join(WORKSPACE_ROOT, relPath), 'utf-8');
}

describe('SB Khush Self Pickup / Store Pickup Comprehensive Suite', () => {
  it('Edge Case 1: keeps Self Pickup disabled by default across settings, CartContext, CheckoutPage, tenantService, and server.ts', () => {
    expect(INITIAL_SETTINGS.selfPickupDetails?.enabled).toBe(false);
    expect(INITIAL_SETTINGS.selfPickupDetails?.preparationTime).toBeTruthy();
    expect(INITIAL_SETTINGS.selfPickupDetails?.requireAdvancePayment).toBe(false);
    expect(INITIAL_SETTINGS.selfPickupDetails?.cashOnPickupEnabled).toBe(true);

    expect(isSelfPickupEnabled(undefined)).toBe(false);
    expect(isSelfPickupEnabled(null)).toBe(false);
    expect(isSelfPickupEnabled({})).toBe(false);
    expect(isSelfPickupEnabled({ ...INITIAL_SETTINGS, selfPickupDetails: undefined })).toBe(false);
    expect(
      isSelfPickupEnabled({
        ...INITIAL_SETTINGS,
        selfPickupDetails: { ...INITIAL_SETTINGS.selfPickupDetails!, enabled: false },
      })
    ).toBe(false);
    expect(
      isSelfPickupEnabled({
        ...INITIAL_SETTINGS,
        selfPickupDetails: { ...INITIAL_SETTINGS.selfPickupDetails!, enabled: true },
      })
    ).toBe(true);

    const cartContextSrc = readWorkspaceFile('src/context/CartContext.tsx');
    const cartPageSrc = readWorkspaceFile('src/pages/CartPage.tsx');
    const checkoutSrc = readWorkspaceFile('src/pages/CheckoutPage.tsx');
    const tenantServiceSrc = readWorkspaceFile('src/services/tenantService.ts');
    const serverSrc = readWorkspaceFile('server.ts');

    expect(cartContextSrc).toContain('isSelfPickupEnabled');
    expect(cartPageSrc).toContain('isSelfPickupEnabled');
    expect(checkoutSrc).toContain('isSelfPickupEnabled');
    expect(tenantServiceSrc).toContain('if (!isSelfPickupEnabled(pubSettings))');
    expect(serverSrc).toContain("if (resolvedFulfillment === 'self_pickup' && !isSelfPickupEnabled(pubSettings))");
    expect(serverSrc).not.toContain('selfPickupDetails?.enabled === false');
  });

  it('Edge Case 2: rejects invalid pickup dates, outside-window dates, and enforces active slot validation', () => {
    const today = new Date();
    const yyyyMmDd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const todayStr = yyyyMmDd(today);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const farFuture = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    expect(validatePickupDateInWindow(todayStr, 5)).toBe(true);
    expect(validatePickupDateInWindow(yyyyMmDd(yesterday), 5)).toBe(false);
    expect(validatePickupDateInWindow(yyyyMmDd(farFuture), 5)).toBe(false);
    expect(validatePickupDateInWindow('invalid-date', 5)).toBe(false);
    expect(validatePickupDateInWindow('', 5)).toBe(false);

    const tenantServiceSrc = readWorkspaceFile('src/services/tenantService.ts');
    const serverSrc = readWorkspaceFile('server.ts');
    const checkoutSrc = readWorkspaceFile('src/pages/CheckoutPage.tsx');

    expect(tenantServiceSrc).toContain('Please select a valid pickup date within the store booking window.');
    expect(tenantServiceSrc).toContain('Please select an active pickup time slot.');
    expect(tenantServiceSrc).toContain('Selected pickup time slot is no longer active');
    expect(serverSrc).toContain('Invalid pickup date or date outside store booking window.');
    expect(serverSrc).toContain('A valid pickup time slot selection is required.');
    expect(checkoutSrc).toContain('Please choose an available pickup time slot before placing your order.');
  });

  it('Edge Case 3: tracks pickup slot capacity atomically and releases slot capacity upon cancellation', () => {
    const tenantServiceSrc = readWorkspaceFile('src/services/tenantService.ts');
    const serverSrc = readWorkspaceFile('server.ts');
    const firestoreRules = readWorkspaceFile('firestore.rules');

    expect(buildPickupSlotKey('2026-11-24', 'slot_evening')).toBe('2026-11-24__slot_evening');
    expect(tenantServiceSrc).toContain('existingBooked >= maxOrders');
    expect(tenantServiceSrc).toContain('bookedCount: Math.max(0, currentBooked - 1)');
    expect(serverSrc).toContain('existingBooked >= maxOrders');
    expect(serverSrc).toContain('bookedCount: existingBooked + 1');
    expect(firestoreRules).toContain('match /pickup_slots/{slotKey}');
  });

  it('Edge Case 4: maps cancelled pickup orders cleanly and allows customer & merchant cancellation with pickupStatus sync', () => {
    expect(derivePickupStatusFromOrderStatus('Pending')).toBe('New Pickup Order');
    expect(derivePickupStatusFromOrderStatus('Confirmed')).toBe('New Pickup Order');
    expect(derivePickupStatusFromOrderStatus('Accepted')).toBe('New Pickup Order');
    expect(derivePickupStatusFromOrderStatus('Preparing')).toBe('Preparing');
    expect(derivePickupStatusFromOrderStatus('Processing')).toBe('Preparing');
    expect(derivePickupStatusFromOrderStatus('Ready for Pickup')).toBe('Ready for Pickup');
    expect(derivePickupStatusFromOrderStatus('Collected')).toBe('Picked Up');
    expect(derivePickupStatusFromOrderStatus('Completed')).toBe('Picked Up');
    expect(derivePickupStatusFromOrderStatus('Delivered')).toBe('Picked Up');
    expect(derivePickupStatusFromOrderStatus('Cancelled')).toBe('Cancelled');

    const accountSrc = readWorkspaceFile('src/pages/AccountPage.tsx');
    const firestoreRules = readWorkspaceFile('firestore.rules');
    const tenantServiceSrc = readWorkspaceFile('src/services/tenantService.ts');

    expect(accountSrc).toContain("cancelTarget.fulfillmentMethod === 'self_pickup' ? ('Cancelled' as const)");
    expect(firestoreRules).toContain("incoming().pickupStatus == 'Cancelled'");
    expect(firestoreRules).toContain("affectedKeys().hasOnly(['orderStatus', 'pickupStatus', 'updatedAt'])");
    expect(tenantServiceSrc).toContain("nextStatus === 'Cancelled'");
  });

  it('Edge Case 5: enforces advance payment vs Cash on Pickup rules and avoids marking unpaid digital orders as paid on counter verification', () => {
    expect(
      isCashOnPickupAllowed({
        ...INITIAL_SETTINGS,
        codEnabled: true,
        selfPickupDetails: {
          ...INITIAL_SETTINGS.selfPickupDetails!,
          requireAdvancePayment: true,
          cashOnPickupEnabled: true,
        },
      })
    ).toBe(false);

    expect(
      isCashOnPickupAllowed({
        ...INITIAL_SETTINGS,
        codEnabled: true,
        selfPickupDetails: {
          ...INITIAL_SETTINGS.selfPickupDetails!,
          requireAdvancePayment: false,
          cashOnPickupEnabled: false,
        },
      })
    ).toBe(false);

    expect(
      isCashOnPickupAllowed({
        ...INITIAL_SETTINGS,
        codEnabled: true,
        selfPickupDetails: {
          ...INITIAL_SETTINGS.selfPickupDetails!,
          requireAdvancePayment: false,
          cashOnPickupEnabled: true,
        },
      })
    ).toBe(true);

    expect(getPaymentMethodLabel('cod', 'self_pickup')).toContain('Pickup');
    expect(getPaymentMethodLabel('cod', 'delivery')).toContain('Cash on Delivery');

    const checkoutSrc = readWorkspaceFile('src/pages/CheckoutPage.tsx');
    const tenantServiceSrc = readWorkspaceFile('src/services/tenantService.ts');
    const serverSrc = readWorkspaceFile('server.ts');
    const shopSettingsSrc = readWorkspaceFile('src/dashboard/ShopSettingsPage.tsx');

    expect(checkoutSrc).toContain('isCashOnPickupAllowed');
    expect(checkoutSrc).toContain('Cash on Pickup (Pay at Counter)');
    expect(tenantServiceSrc).toContain('!isCashOnPickupAllowed(pubSettings)');
    expect(serverSrc).toContain('!isCashOnPickupAllowed(pubSettings)');
    expect(shopSettingsSrc).toContain('requireAdvancePayment');
    expect(shopSettingsSrc).toContain('cashOnPickupEnabled');
    // Counter verification only marks cash paid when params.markCashPaid && paymentMethod === 'cod'
    expect(tenantServiceSrc).toContain("params.markCashPaid && order.paymentMethod === 'cod'");
  });

  it('Edge Case 6: maintains strict multi-tenant shop isolation across rules, backend routes, and client services', () => {
    const firestoreRules = readWorkspaceFile('firestore.rules');
    const tenantServiceSrc = readWorkspaceFile('src/services/tenantService.ts');
    const serverSrc = readWorkspaceFile('server.ts');
    const blueprint = JSON.parse(readWorkspaceFile('firebase-blueprint.json'));

    expect(firestoreRules).toContain('match /shops/{shopId}');
    expect(firestoreRules).toContain('isShopMember(shopId)');
    expect(firestoreRules).toContain('isShopAdmin(shopId)');
    expect(tenantServiceSrc).toContain("scopedDoc(db, 'shops', shopId, 'orders'");
    expect(tenantServiceSrc).toContain("scopedDoc(db, 'shops', shopId, 'pickup_slots'");
    expect(serverSrc).toContain("doc(db, 'shops', shopId, 'orders'");
    expect(serverSrc).toContain("doc(db, 'shops', shopId, 'pickup_slots'");
    expect(blueprint.entities.Order).toBeDefined();
    expect(blueprint.entities.Order.properties.pickupStatus).toBeDefined();
    expect(blueprint.entities.Order.properties.pickupShopId).toBeDefined();
  });

  it('Edge Case 7 & Happy Path: generates scannable QR data URIs, validates QR & 6-digit OTP payloads, and verifies 5-step customer & admin pickup UI', async () => {
    const otp = generatePickupOtp();
    expect(otp).toMatch(/^\d{6}$/);

    const payload = buildPickupQrPayload('PK-908172', otp);
    expect(payload).toBe(`SBKHUSH-PICKUP|PK-908172|${otp}`);

    const qrUri = await QRCode.toDataURL(payload, { width: 168, margin: 1 });
    expect(qrUri.startsWith('data:image/png;base64,')).toBe(true);

    expect(parsePickupVerificationInput(payload, 'PK-908172')).toEqual({
      otp,
      orderNumber: 'PK-908172',
    });
    expect(parsePickupVerificationInput(otp, 'PK-908172')).toEqual({ otp });
    expect(() => parsePickupVerificationInput(payload, 'PK-111111')).toThrow(
      /Scanned QR belongs to order PK-908172/
    );

    const hashA = await hashPickupOtp('PK-908172', otp);
    const hashB = await hashPickupOtp('pk-908172', otp);
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);

    expect(getFulfillmentLabel('self_pickup')).toContain('Self-Pickup');
    expect(getFulfillmentLabel('self_pickup')).toContain('Store Pickup');

    const checkoutSrc = readWorkspaceFile('src/pages/CheckoutPage.tsx');
    const ordersDashSrc = readWorkspaceFile('src/dashboard/ShopOrdersPage.tsx');
    const orderSuccessSrc = readWorkspaceFile('src/pages/OrderSuccessPage.tsx');
    const trackingSrc = readWorkspaceFile('src/pages/OrderTrackingPage.tsx');
    const accountSrc = readWorkspaceFile('src/pages/AccountPage.tsx');
    const qrPassSrc = readWorkspaceFile('src/components/common/PickupQrPass.tsx');

    // Customer checkout elements
    expect(checkoutSrc).toContain('Choose Your Order Fulfillment Method');
    expect(checkoutSrc).toContain('Home Delivery');
    expect(checkoutSrc).toContain('Self Pickup / Store Pickup');
    expect(checkoutSrc).toContain('Free (Pickup)');

    // Admin dashboard elements
    expect(ordersDashSrc).toContain('Self-Pickup');
    expect(ordersDashSrc).toContain('Notify Customer');
    expect(ordersDashSrc).toContain('Verify &amp; Confirm Picked Up');
    expect(ordersDashSrc).toContain('derivePickupStatusFromOrderStatus');

    // Customer receipt, tracking (exact 5 steps), account & QR pass
    expect(qrPassSrc).toContain('QRCode.toDataURL');
    expect(qrPassSrc).toContain('Present Code or QR at Store Counter');
    expect(orderSuccessSrc).toContain('PickupQrPass');
    expect(accountSrc).toContain('PickupQrPass');
    expect(trackingSrc).toContain('Order Placed');
    expect(trackingSrc).toContain('Confirmed');
    expect(trackingSrc).toContain('Preparing');
    expect(trackingSrc).toContain('Ready for Pickup');
    expect(trackingSrc).toContain('Picked Up');
    expect(trackingSrc).toContain('PickupQrPass');
  });
});

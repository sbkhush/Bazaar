import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import {
  Supplier,
  PurchaseInvoice,
  PurchaseItemLine,
  PosSale,
  PosSaleItem,
  PosPaymentMethod,
  KhataEntry,
  ShopExpense,
  ShopCustomerSummary,
  Product,
  Order,
  StockMovement,
} from '../types';
import { stripUndefined } from './platformService';
import { logShopActivity, getShopAndPlanLimits, getAllShopOrdersAdmin } from './tenantService';

// ====================================================
// PURE FINANCIAL & INVENTORY VALUATION HELPERS
// ====================================================

export interface RetailProfitSummary {
  totalRevenue: number;
  onlineRevenue: number;
  posRevenue: number;
  cogs: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  hasEstimatedCogs: boolean;
  missingCostItemsCount: number;
}

export function calculateRetailProfitSummary(params: {
  orders: Order[];
  posSales: PosSale[];
  products: Product[];
  expenses: ShopExpense[];
}): RetailProfitSummary {
  const { orders, posSales, products, expenses } = params;
  const prodCostMap = new Map<string, number>();
  products.forEach((p) => {
    if (typeof p.purchasePrice === 'number' && p.purchasePrice >= 0) {
      prodCostMap.set(p.id, p.purchasePrice);
    }
  });

  const validOnline = orders.filter((o) => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Returned' && o.orderStatus !== 'Refunded');
  const validPos = posSales.filter((s) => s.status === 'completed');

  const onlineRevenue = validOnline.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const posRevenue = validPos.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const totalRevenue = onlineRevenue + posRevenue;

  let cogs = 0;
  let missingCostItemsCount = 0;

  for (const ord of validOnline) {
    for (const item of ord.items || []) {
      const cost = prodCostMap.get(item.productId);
      if (cost !== undefined) {
        cogs += cost * Number(item.quantity || 1);
      } else {
        missingCostItemsCount += 1;
      }
    }
  }

  for (const sale of validPos) {
    for (const item of sale.items || []) {
      const cost = item.costPrice > 0 ? item.costPrice : prodCostMap.get(item.productId);
      if (cost !== undefined && cost >= 0) {
        cogs += cost * Number(item.quantity || 1);
      } else {
        missingCostItemsCount += 1;
      }
    }
  }

  const totalExpenses = expenses.reduce((sum, ex) => sum + Number(ex.amount || 0), 0);
  const grossProfit = totalRevenue - cogs;
  const netProfit = grossProfit - totalExpenses;

  return {
    totalRevenue,
    onlineRevenue,
    posRevenue,
    cogs,
    grossProfit,
    totalExpenses,
    netProfit,
    hasEstimatedCogs: missingCostItemsCount > 0,
    missingCostItemsCount,
  };
}

export function calculateInventoryValuation(products: Product[]) {
  const active = products.filter((p) => p.status !== 'archived');
  let totalUnits = 0;
  let costValuation = 0;
  let retailValuation = 0;
  let missingCostCount = 0;

  for (const p of active) {
    const qty = Math.max(0, Number(p.stock || 0));
    totalUnits += qty;
    const sellPrice = Number(p.salePrice ?? p.regularPrice ?? 0);
    retailValuation += qty * sellPrice;
    if (typeof p.purchasePrice === 'number' && p.purchasePrice >= 0) {
      costValuation += qty * p.purchasePrice;
    } else if (qty > 0) {
      missingCostCount += 1;
    }
  }

  return {
    totalUnits,
    costValuation,
    retailValuation,
    potentialMargin: retailValuation - costValuation,
    missingCostCount,
  };
}

// ====================================================
// POS & COUNTER BILLING (BUSINESS / PROFESSIONAL PLANS)
// ====================================================

export async function getShopPosSales(shopId: string): Promise<PosSale[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'pos_sales'));
    const list: PosSale[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as PosSale), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/pos_sales`);
  }
}

export async function createPosSale(
  shopId: string,
  input: {
    idempotencyKey: string;
    items: PosSaleItem[];
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: PosPaymentMethod;
    cashPaid?: number;
    digitalPaid?: number;
    creditAmount?: number;
    paymentReference?: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    receiptFormat?: '58mm' | '80mm';
  }
): Promise<PosSale> {
  const { plan, isExpired, isSuspended } = await getShopAndPlanLimits(shopId);
  if (isSuspended || isExpired) {
    throw new Error('Subscription inactive or expired. Renew your plan to record POS sales.');
  }
  if (!plan?.features?.pos) {
    throw new Error('POS & Counter Billing requires the Business or Professional plan.');
  }
  if (!input.items.length) {
    throw new Error('Add at least one item to complete a POS sale.');
  }

  const saleId = `pos_${input.idempotencyKey}`;
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const nowIso = new Date().toISOString();
  const cashierId = auth.currentUser?.uid || 'staff';
  const cashierName = auth.currentUser?.displayName || auth.currentUser?.email || 'Cashier';

  try {
    const savedSale = await runTransaction(db, async (tx) => {
      const saleRef = doc(db, 'shops', shopId, 'pos_sales', saleId);
      const existingSale = await tx.get(saleRef);
      if (existingSale.exists()) {
        // Idempotent retry return existing invoice
        return { ...(existingSale.data() as PosSale), id: existingSale.id };
      }

      // Read all product snapshots before any writes
      const productDocs = new Map<string, Product>();
      for (const line of input.items) {
        const pRef = doc(db, 'shops', shopId, 'products', line.productId);
        const pSnap = await tx.get(pRef);
        if (!pSnap.exists()) {
          throw new Error(`Product "${line.title}" no longer exists in catalog.`);
        }
        const prod = { ...(pSnap.data() as Product), id: pSnap.id };
        if (prod.stock < line.quantity) {
          throw new Error(`Insufficient stock for "${prod.title}" (Available: ${prod.stock}, Requested: ${line.quantity}).`);
        }
        productDocs.set(line.productId, prod);
      }

      let customerSnapData: ShopCustomerSummary | null = null;
      const creditToAdd = Number(input.creditAmount || (input.paymentMethod === 'khata_credit' ? input.total : 0));
      if (input.customerId && creditToAdd > 0) {
        const custSnap = await tx.get(doc(db, 'shops', shopId, 'customers', input.customerId));
        if (custSnap.exists()) {
          customerSnapData = custSnap.data() as ShopCustomerSummary;
        }
      }

      // Apply atomic stock deductions & movements
      for (const line of input.items) {
        const prod = productDocs.get(line.productId)!;
        const prevStock = Number(prod.stock || 0);
        const nextStock = Math.max(0, prevStock - line.quantity);
        tx.update(doc(db, 'shops', shopId, 'products', line.productId), {
          stock: nextStock,
          updatedAt: nowIso,
        });

        const movId = `mov_${Date.now()}_${line.productId.slice(-4)}_${Math.random().toString(36).slice(2, 5)}`;
        tx.set(
          doc(db, 'shops', shopId, 'stock_movements', movId),
          stripUndefined<StockMovement>({
            id: movId,
            shopId,
            productId: line.productId,
            productTitle: prod.title,
            type: 'pos_sale',
            quantityChange: -line.quantity,
            previousQuantity: prevStock,
            newQuantity: nextStock,
            reason: `POS Sale ${invoiceNumber}`,
            userId: cashierId,
            userEmail: cashierName,
            referenceTransaction: invoiceNumber,
            timestamp: nowIso,
          })
        );
      }

      // Khata credit ledger update if paid on credit
      if (creditToAdd > 0 && input.customerId) {
        const custRef = doc(db, 'shops', shopId, 'customers', input.customerId);
        const prevBal = Number(customerSnapData?.outstandingBalance || 0);
        const newBal = prevBal + creditToAdd;
        tx.set(
          custRef,
          stripUndefined({
            id: input.customerId,
            name: input.customerName || customerSnapData?.name || 'Walk-in Customer',
            phone: input.customerPhone || customerSnapData?.phone || '',
            email: customerSnapData?.email || '',
            city: customerSnapData?.city || 'Local',
            ordersCount: Number(customerSnapData?.ordersCount || 0) + 1,
            totalSpent: Number(customerSnapData?.totalSpent || 0) + input.total,
            outstandingBalance: newBal,
            lastOrderAt: nowIso,
            createdAt: customerSnapData?.createdAt || nowIso,
          }),
          { merge: true }
        );

        const kId = `kht_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        tx.set(
          doc(db, 'shops', shopId, 'khata_ledger', kId),
          stripUndefined<KhataEntry>({
            id: kId,
            shopId,
            customerId: input.customerId,
            customerName: input.customerName || customerSnapData?.name || 'Customer',
            customerPhone: input.customerPhone || customerSnapData?.phone || '',
            type: 'credit_sale',
            amount: creditToAdd,
            previousBalance: prevBal,
            newBalance: newBal,
            reference: invoiceNumber,
            notes: `POS Credit Sale (${invoiceNumber})`,
            recordedBy: cashierName,
            createdAt: nowIso,
          })
        );
      }

      const saleDoc = stripUndefined<PosSale>({
        id: saleId,
        shopId,
        invoiceNumber,
        idempotencyKey: input.idempotencyKey,
        items: input.items,
        subtotal: Number(input.subtotal),
        discount: Number(input.discount),
        total: Number(input.total),
        paymentMethod: input.paymentMethod,
        cashPaid: input.cashPaid,
        digitalPaid: input.digitalPaid,
        creditAmount: creditToAdd > 0 ? creditToAdd : undefined,
        paymentReference: input.paymentReference?.trim() || undefined,
        customerId: input.customerId,
        customerName: input.customerName?.trim() || 'Walk-in Customer',
        customerPhone: input.customerPhone?.trim() || undefined,
        cashierId,
        cashierName,
        status: 'completed',
        receiptFormat: input.receiptFormat || '80mm',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      tx.set(saleRef, saleDoc);
      return saleDoc;
    });

    await logShopActivity(
      shopId,
      'Completed POS Sale',
      'pos',
      savedSale.id,
      `${savedSale.invoiceNumber} — Rs. ${savedSale.total.toLocaleString()} (${savedSale.paymentMethod})`
    );
    return savedSale;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/pos_sales/${saleId}`);
  }
}

export async function returnPosSale(shopId: string, saleId: string, reason = 'Customer Return / Exchange'): Promise<void> {
  const nowIso = new Date().toISOString();
  const actorId = auth.currentUser?.uid || 'staff';
  const actorName = auth.currentUser?.displayName || auth.currentUser?.email || 'Cashier';

  try {
    await runTransaction(db, async (tx) => {
      const saleRef = doc(db, 'shops', shopId, 'pos_sales', saleId);
      const saleSnap = await tx.get(saleRef);
      if (!saleSnap.exists()) throw new Error('POS invoice not found.');
      const sale = saleSnap.data() as PosSale;
      if (sale.status === 'returned') {
        throw new Error('This POS invoice has already been returned.');
      }

      for (const item of sale.items) {
        const pRef = doc(db, 'shops', shopId, 'products', item.productId);
        const pSnap = await tx.get(pRef);
        if (pSnap.exists()) {
          const prev = Number(pSnap.data().stock || 0);
          const next = prev + Number(item.quantity || 0);
          tx.update(pRef, { stock: next, updatedAt: nowIso });

          const movId = `mov_${Date.now()}_${item.productId.slice(-4)}_${Math.random().toString(36).slice(2, 5)}`;
          tx.set(
            doc(db, 'shops', shopId, 'stock_movements', movId),
            stripUndefined<StockMovement>({
              id: movId,
              shopId,
              productId: item.productId,
              productTitle: item.title,
              type: 'return',
              quantityChange: item.quantity,
              previousQuantity: prev,
              newQuantity: next,
              reason: `${reason} (${sale.invoiceNumber})`,
              userId: actorId,
              userEmail: actorName,
              referenceTransaction: sale.invoiceNumber,
              timestamp: nowIso,
            })
          );
        }
      }

      tx.update(saleRef, { status: 'returned', updatedAt: nowIso });
    });
    await logShopActivity(shopId, 'Returned POS Sale', 'pos', saleId, `${reason} (${saleId})`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}/pos_sales/${saleId}`);
  }
}

// ====================================================
// SUPPLIERS & PURCHASE INVOICES
// ====================================================

export async function getShopSuppliers(shopId: string): Promise<Supplier[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'suppliers'));
    const list: Supplier[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as Supplier), id: d.id, shopId }));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/suppliers`);
  }
}

export async function saveShopSupplier(shopId: string, supplier: Partial<Supplier>): Promise<string> {
  const { plan, isSuspended, isExpired } = await getShopAndPlanLimits(shopId);
  if (isSuspended || isExpired) throw new Error('Subscription inactive or expired.');
  if (!plan?.features?.suppliersPurchases) {
    throw new Error('Suppliers management requires the Business or Professional plan.');
  }
  const isNew = !supplier.id;
  const id = supplier.id || `sup_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const nowIso = new Date().toISOString();
  const payload = stripUndefined<Supplier>({
    id,
    shopId,
    name: supplier.name?.trim() || 'Supplier',
    phone: supplier.phone?.trim() || '',
    email: supplier.email?.trim() || undefined,
    address: supplier.address?.trim() || undefined,
    openingBalance: Number(supplier.openingBalance || 0),
    currentPayableBalance:
      isNew ? Number(supplier.openingBalance || 0) : Number(supplier.currentPayableBalance ?? 0),
    notes: supplier.notes?.trim() || undefined,
    createdAt: supplier.createdAt || nowIso,
    updatedAt: nowIso,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'suppliers', id), payload, { merge: true });
    await logShopActivity(shopId, isNew ? 'Added Supplier' : 'Updated Supplier', 'supplier', id, payload.name);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/suppliers/${id}`);
  }
}

export async function recordSupplierPayment(
  shopId: string,
  supplierId: string,
  amount: number,
  notes?: string
): Promise<void> {
  if (amount <= 0) throw new Error('Payment amount must be greater than zero.');
  const nowIso = new Date().toISOString();
  try {
    await runTransaction(db, async (tx) => {
      const supRef = doc(db, 'shops', shopId, 'suppliers', supplierId);
      const snap = await tx.get(supRef);
      if (!snap.exists()) throw new Error('Supplier not found.');
      const cur = Number(snap.data().currentPayableBalance || 0);
      const next = Math.max(0, cur - amount);
      tx.update(supRef, { currentPayableBalance: next, updatedAt: nowIso });
    });
    await logShopActivity(
      shopId,
      'Supplier Payment',
      'supplier',
      supplierId,
      `Paid Rs. ${amount.toLocaleString()} ${notes ? `(${notes})` : ''}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}/suppliers/${supplierId}`);
  }
}

export async function getShopPurchases(shopId: string): Promise<PurchaseInvoice[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'purchases'));
    const list: PurchaseInvoice[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as PurchaseInvoice), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/purchases`);
  }
}

export async function createPurchaseInvoice(
  shopId: string,
  input: {
    supplierId: string;
    supplierName: string;
    invoiceNumber: string;
    purchaseDate: string;
    items: PurchaseItemLine[];
    discount: number;
    paidAmount: number;
    notes?: string;
  }
): Promise<PurchaseInvoice> {
  const { plan, isSuspended, isExpired } = await getShopAndPlanLimits(shopId);
  if (isSuspended || isExpired) throw new Error('Subscription inactive or expired.');
  if (!plan?.features?.suppliersPurchases) {
    throw new Error('Purchase invoices require the Business or Professional plan.');
  }
  if (!input.items.length) throw new Error('Add at least one product line.');

  // Guard duplicate invoice number
  const existingInvSnap = await getDocs(
    query(collection(db, 'shops', shopId, 'purchases'), where('invoiceNumber', '==', input.invoiceNumber.trim()))
  );
  if (!existingInvSnap.empty) {
    throw new Error(`Purchase invoice "${input.invoiceNumber}" already exists.`);
  }

  const subtotal = input.items.reduce((s, l) => s + Number(l.lineTotal || l.quantity * l.purchasePrice), 0);
  const discount = Math.max(0, Number(input.discount || 0));
  const total = Math.max(0, subtotal - discount);
  const paidAmount = Math.min(total, Math.max(0, Number(input.paidAmount || 0)));
  const remainingPayable = Math.max(0, total - paidAmount);
  const paymentStatus: PurchaseInvoice['paymentStatus'] =
    remainingPayable === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const nowIso = new Date().toISOString();
  const actorId = auth.currentUser?.uid || 'owner';
  const actorEmail = auth.currentUser?.email || 'owner';

  try {
    const invoice = await runTransaction(db, async (tx) => {
      const supRef = doc(db, 'shops', shopId, 'suppliers', input.supplierId);
      const supSnap = await tx.get(supRef);
      if (!supSnap.exists()) throw new Error('Selected supplier not found.');

      const prodSnapshots = new Map<string, Product>();
      for (const line of input.items) {
        const pSnap = await tx.get(doc(db, 'shops', shopId, 'products', line.productId));
        if (!pSnap.exists()) throw new Error(`Product "${line.productTitle}" not found.`);
        prodSnapshots.set(line.productId, { ...(pSnap.data() as Product), id: pSnap.id });
      }

      // Increase stock & update purchasePrice & write stock movements
      for (const line of input.items) {
        const prod = prodSnapshots.get(line.productId)!;
        const prev = Number(prod.stock || 0);
        const next = prev + Number(line.quantity || 0);
        tx.update(doc(db, 'shops', shopId, 'products', line.productId), {
          stock: next,
          purchasePrice: Number(line.purchasePrice),
          updatedAt: nowIso,
        });

        const movId = `mov_${Date.now()}_${line.productId.slice(-4)}_${Math.random().toString(36).slice(2, 5)}`;
        tx.set(
          doc(db, 'shops', shopId, 'stock_movements', movId),
          stripUndefined<StockMovement>({
            id: movId,
            shopId,
            productId: line.productId,
            productTitle: prod.title,
            type: 'purchase',
            quantityChange: line.quantity,
            previousQuantity: prev,
            newQuantity: next,
            reason: `Purchase Invoice ${input.invoiceNumber} from ${input.supplierName}`,
            userId: actorId,
            userEmail: actorEmail,
            referenceTransaction: input.invoiceNumber,
            timestamp: nowIso,
          })
        );
      }

      // Update supplier payable balance
      const curPayable = Number(supSnap.data().currentPayableBalance || 0);
      tx.update(supRef, {
        currentPayableBalance: curPayable + remainingPayable,
        updatedAt: nowIso,
      });

      const docData = stripUndefined<PurchaseInvoice>({
        id: purchaseId,
        shopId,
        supplierId: input.supplierId,
        supplierName: input.supplierName,
        invoiceNumber: input.invoiceNumber.trim(),
        purchaseDate: input.purchaseDate || nowIso.slice(0, 10),
        items: input.items,
        subtotal,
        discount,
        total,
        paidAmount,
        remainingPayable,
        paymentStatus,
        notes: input.notes?.trim() || undefined,
        createdBy: actorEmail,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      tx.set(doc(db, 'shops', shopId, 'purchases', purchaseId), docData);
      return docData;
    });

    await logShopActivity(
      shopId,
      'Recorded Purchase Invoice',
      'purchase',
      purchaseId,
      `${invoice.invoiceNumber} from ${invoice.supplierName} — Rs. ${invoice.total.toLocaleString()}`
    );
    return invoice;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/purchases/${purchaseId}`);
  }
}

// ====================================================
// CUSTOMERS DIRECTORY & KHATA / CREDIT LEDGER
// ====================================================

export async function getShopCustomersWithKhata(shopId: string): Promise<ShopCustomerSummary[]> {
  const [explicitSnap, orders] = await Promise.all([
    getDocs(collection(db, 'shops', shopId, 'customers')).catch(() => null),
    getAllShopOrdersAdmin(shopId).catch(() => [] as Order[]),
  ]);

  const map = new Map<string, ShopCustomerSummary>();

  explicitSnap?.forEach((d) => {
    const data = d.data() as ShopCustomerSummary;
    map.set(d.id, { ...data, id: d.id, outstandingBalance: Number(data.outstandingBalance || 0) });
  });

  for (const ord of orders) {
    const phoneKey = (ord.customer?.phone || ord.customer?.email || ord.id).replace(/[\s-]/g, '');
    const existing = map.get(phoneKey);
    if (!existing) {
      map.set(phoneKey, {
        id: phoneKey,
        name: ord.customer?.name || 'Guest',
        email: ord.customer?.email || '',
        phone: ord.customer?.phone || '',
        address: ord.customer?.address || '',
        city: ord.customer?.city || '',
        ordersCount: 1,
        totalSpent: ord.orderStatus !== 'Cancelled' ? Number(ord.total || 0) : 0,
        outstandingBalance: 0,
        lastOrderAt: ord.createdAt,
        createdAt: ord.createdAt,
      });
    } else {
      existing.ordersCount = Math.max(existing.ordersCount || 0, 0) + 1;
      if (ord.orderStatus !== 'Cancelled') {
        existing.totalSpent = Number(existing.totalSpent || 0) + Number(ord.total || 0);
      }
      if (new Date(ord.createdAt) > new Date(existing.lastOrderAt || 0)) {
        existing.lastOrderAt = ord.createdAt;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => (b.outstandingBalance || 0) - (a.outstandingBalance || 0) || b.totalSpent - a.totalSpent);
}

export async function saveShopCustomerProfile(
  shopId: string,
  customer: Partial<ShopCustomerSummary>
): Promise<string> {
  const cleanPhone = (customer.phone || '').replace(/[\s-]/g, '');
  const id = customer.id || cleanPhone || `cust_${Date.now()}`;
  const nowIso = new Date().toISOString();

  const existing = await getDoc(doc(db, 'shops', shopId, 'customers', id)).catch(() => null);
  const prevData = existing?.exists() ? (existing.data() as ShopCustomerSummary) : null;

  const payload = stripUndefined<ShopCustomerSummary>({
    id,
    name: customer.name?.trim() || prevData?.name || 'Customer',
    email: customer.email?.trim() || prevData?.email || '',
    phone: customer.phone?.trim() || prevData?.phone || '',
    address: customer.address?.trim() || prevData?.address || '',
    city: customer.city?.trim() || prevData?.city || 'Karachi',
    ordersCount: prevData?.ordersCount || 0,
    totalSpent: prevData?.totalSpent || 0,
    outstandingBalance:
      customer.outstandingBalance !== undefined
        ? Number(customer.outstandingBalance)
        : prevData?.outstandingBalance || 0,
    notes: customer.notes?.trim() || prevData?.notes || undefined,
    lastOrderAt: prevData?.lastOrderAt || nowIso,
    createdAt: prevData?.createdAt || nowIso,
  });

  try {
    await setDoc(doc(db, 'shops', shopId, 'customers', id), payload, { merge: true });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/customers/${id}`);
  }
}

export async function getShopKhataEntries(shopId: string, customerId?: string): Promise<KhataEntry[]> {
  try {
    const colRef = collection(db, 'shops', shopId, 'khata_ledger');
    const q = customerId ? query(colRef, where('customerId', '==', customerId)) : colRef;
    const snap = await getDocs(q);
    const list: KhataEntry[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as KhataEntry), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `shops/${shopId}/khata_ledger`);
  }
}

export async function recordKhataTransaction(
  shopId: string,
  input: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    type: KhataEntry['type'];
    amount: number;
    reference?: string;
    notes?: string;
  }
): Promise<KhataEntry> {
  const { plan, isSuspended, isExpired } = await getShopAndPlanLimits(shopId);
  if (isSuspended || isExpired) throw new Error('Subscription inactive or expired.');
  if (!plan?.features?.khata) {
    throw new Error('Customer Khata / Credit Ledger requires the Business or Professional plan.');
  }
  if (input.amount <= 0) throw new Error('Amount must be greater than zero.');

  const nowIso = new Date().toISOString();
  const recordedBy = auth.currentUser?.email || 'Owner';
  const entryId = `kht_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

  try {
    const entry = await runTransaction(db, async (tx) => {
      const custRef = doc(db, 'shops', shopId, 'customers', input.customerId);
      const custSnap = await tx.get(custRef);
      const prevData = custSnap.exists() ? (custSnap.data() as ShopCustomerSummary) : null;
      const prevBal = Number(prevData?.outstandingBalance || 0);

      const delta = input.type === 'payment' ? -Math.abs(input.amount) : Math.abs(input.amount);
      const newBal = Math.max(0, prevBal + delta);

      tx.set(
        custRef,
        stripUndefined({
          id: input.customerId,
          name: input.customerName || prevData?.name || 'Customer',
          phone: input.customerPhone || prevData?.phone || '',
          email: prevData?.email || '',
          city: prevData?.city || 'Pakistan',
          ordersCount: prevData?.ordersCount || 0,
          totalSpent: prevData?.totalSpent || 0,
          outstandingBalance: newBal,
          lastOrderAt: nowIso,
          createdAt: prevData?.createdAt || nowIso,
        }),
        { merge: true }
      );

      const entryDoc = stripUndefined<KhataEntry>({
        id: entryId,
        shopId,
        customerId: input.customerId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        type: input.type,
        amount: Math.abs(input.amount),
        previousBalance: prevBal,
        newBalance: newBal,
        reference: input.reference?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        recordedBy,
        createdAt: nowIso,
      });

      tx.set(doc(db, 'shops', shopId, 'khata_ledger', entryId), entryDoc);
      return entryDoc;
    });

    await logShopActivity(
      shopId,
      input.type === 'payment' ? 'Khata Payment Received' : 'Khata Credit Recorded',
      'khata',
      entryId,
      `${input.customerName}: Rs. ${input.amount.toLocaleString()} (New Balance: Rs. ${entry.newBalance.toLocaleString()})`
    );
    return entry;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/khata_ledger/${entryId}`);
  }
}

// ====================================================
// EXPENSES (FOR REAL NET PROFIT CALCULATION)
// ====================================================

export async function getShopExpenses(shopId: string): Promise<ShopExpense[]> {
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'expenses'));
    const list: ShopExpense[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as ShopExpense), id: d.id, shopId }));
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export async function saveShopExpense(
  shopId: string,
  expense: Omit<ShopExpense, 'id' | 'shopId' | 'createdBy' | 'createdAt'>
): Promise<string> {
  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const nowIso = new Date().toISOString();
  const payload = stripUndefined<ShopExpense>({
    ...expense,
    id,
    shopId,
    amount: Math.max(0, Number(expense.amount || 0)),
    createdBy: auth.currentUser?.email || 'owner',
    createdAt: nowIso,
  });
  try {
    await setDoc(doc(db, 'shops', shopId, 'expenses', id), payload);
    await logShopActivity(shopId, 'Recorded Expense', 'expense', id, `${payload.title} — Rs. ${payload.amount}`);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}/expenses/${id}`);
  }
}

export async function deleteShopExpense(shopId: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'expenses', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shops/${shopId}/expenses/${id}`);
  }
}

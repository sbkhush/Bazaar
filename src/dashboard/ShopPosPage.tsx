import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  RotateCcw,
  Calculator,
  CheckCircle2,
  Loader2,
  X,
  Barcode,
  Download,
} from 'lucide-react';
import { useDashboard } from './DashboardContext';
import { getShopProductsAdmin } from '../services/tenantService';
import {
  getShopPosSales,
  createPosSale,
  returnPosSale,
  getShopCustomersWithKhata,
  saveShopCustomerProfile,
} from '../services/retailService';
import {
  Product,
  PosSale,
  PosSaleItem,
  PosPaymentMethod,
  ShopCustomerSummary,
} from '../types';
import { formatPKR, FALLBACK_PRODUCT_IMAGE } from '../data/seedData';
import { PlanFeatureGate } from '../components/common/PlanFeatureGate';
import { downloadCsvFile } from '../utils/csvUtils';

export const ShopPosPage: React.FC = () => {
  const { shopId, shop, settings, isReadOnly } = useDashboard();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [customers, setCustomers] = useState<ShopCustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<PosSaleItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [cashPaid, setCashPaid] = useState<number>(0);
  const [digitalPaid, setDigitalPaid] = useState<number>(0);
  const [receiptFormat, setReceiptFormat] = useState<'58mm' | '80mm'>('80mm');
  const [idempotencyKey, setIdempotencyKey] = useState(() => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<PosSale | null>(null);

  const loadPosData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [prods, sls, custs] = await Promise.all([
        getShopProductsAdmin(shopId),
        getShopPosSales(shopId),
        getShopCustomersWithKhata(shopId),
      ]);
      setProducts(prods.filter((p) => p.status !== 'archived'));
      setSales(sls);
      setCustomers(custs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosData();
  }, [shopId]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.lineTotal, 0),
    [cart]
  );
  const total = Math.max(0, subtotal - Math.max(0, discount));

  useEffect(() => {
    if (paymentMethod === 'split') {
      setCashPaid(total);
      setDigitalPaid(0);
    }
  }, [total, paymentMethod]);

  const addProductToCart = (p: Product) => {
    setError(null);
    if (p.stock <= 0) {
      setError(`"${p.title}" is out of stock.`);
      return;
    }
    const unitPrice = Number(p.salePrice ?? p.regularPrice ?? 0);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) {
        if (existing.quantity + 1 > p.stock) {
          setError(`Only ${p.stock} units of "${p.title}" available in stock.`);
          return prev;
        }
        return prev.map((i) =>
          i.productId === p.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                lineTotal: (i.quantity + 1) * i.unitPrice,
              }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          title: p.title,
          sku: p.sku,
          barcode: p.barcode,
          unitPrice,
          costPrice: Number(p.purchasePrice || 0),
          quantity: 1,
          lineTotal: unitPrice,
        },
      ];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    const prod = products.find((p) => p.id === productId);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (prod && nextQty > prod.stock) {
            setError(`Only ${prod.stock} units in stock.`);
            return item;
          }
          return { ...item, quantity: nextQty, lineTotal: nextQty * item.unitPrice };
        })
        .filter(Boolean) as PosSaleItem[]
    );
  };

  const handleBarcodeSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) return;
    const exact = products.find(
      (p) => (p.barcode || '').toLowerCase() === q || p.sku.toLowerCase() === q
    );
    if (exact) {
      addProductToCart(exact);
      setSearch('');
      return;
    }
    if (filteredProducts.length === 1) {
      addProductToCart(filteredProducts[0]);
      setSearch('');
    }
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const handleCompleteSale = async () => {
    if (isReadOnly || !cart.length) return;
    setError(null);

    let resolvedCustomerId = selectedCustomerId;
    let resolvedCustomerName = 'Walk-in Customer';
    let resolvedCustomerPhone = '';

    const matchedCust = customers.find((c) => c.id === selectedCustomerId);
    if (matchedCust) {
      resolvedCustomerName = matchedCust.name;
      resolvedCustomerPhone = matchedCust.phone;
    }

    const creditAmount =
      paymentMethod === 'khata_credit'
        ? total
        : paymentMethod === 'split'
        ? Math.max(0, total - Number(cashPaid || 0) - Number(digitalPaid || 0))
        : 0;

    if (creditAmount > 0 && !resolvedCustomerId) {
      if (!quickCustName.trim() || !quickCustPhone.trim()) {
        setError('Select an existing customer or enter Name & Phone for Khata credit tracking.');
        return;
      }
      resolvedCustomerId = await saveShopCustomerProfile(shopId, {
        name: quickCustName.trim(),
        phone: quickCustPhone.trim(),
        city: settings.city || 'Pakistan',
      });
      resolvedCustomerName = quickCustName.trim();
      resolvedCustomerPhone = quickCustPhone.trim();
    }

    setSubmitting(true);
    try {
      const savedSale = await createPosSale(shopId, {
        idempotencyKey,
        items: cart,
        subtotal,
        discount: Math.max(0, discount),
        total,
        paymentMethod,
        cashPaid: paymentMethod === 'cash' ? total : paymentMethod === 'split' ? Number(cashPaid || 0) : undefined,
        digitalPaid:
          paymentMethod === 'bank_transfer' || paymentMethod === 'qr_payment'
            ? total
            : paymentMethod === 'split'
            ? Number(digitalPaid || 0)
            : undefined,
        creditAmount: creditAmount > 0 ? creditAmount : undefined,
        paymentReference: paymentReference.trim() || undefined,
        customerId: resolvedCustomerId || undefined,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone || undefined,
        receiptFormat,
      });

      setCart([]);
      setDiscount(0);
      setPaymentReference('');
      setQuickCustName('');
      setQuickCustPhone('');
      setIdempotencyKey(`${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      setActiveReceipt(savedSale);
      await loadPosData();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete POS checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnSale = async (sale: PosSale) => {
    if (isReadOnly || sale.status === 'returned') return;
    await returnPosSale(shopId, sale.id);
    await loadPosData();
  };

  const exportPosSalesCsv = () => {
    downloadCsvFile(
      `${shop?.slug || shopId}-pos-sales-${new Date().toISOString().slice(0, 10)}.csv`,
      ['InvoiceNumber', 'Date', 'Customer', 'Phone', 'PaymentMethod', 'SubtotalPKR', 'DiscountPKR', 'TotalPKR', 'Status', 'Reference'],
      sales.map((s) => [
        s.invoiceNumber,
        s.createdAt,
        s.customerName || 'Walk-in',
        s.customerPhone || '',
        s.paymentMethod,
        s.subtotal,
        s.discount,
        s.total,
        s.status,
        s.paymentReference || '',
      ])
    );
  };

  return (
    <PlanFeatureGate feature="pos">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#065F46]" /> POS &amp; Counter Billing
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fast barcode search, cash/digital/split/Khata credit checkout, and 58mm/80mm thermal receipts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportPosSalesCsv}
              className="px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export Sales CSV
            </button>
            <div className="inline-flex border border-slate-200 rounded-xl bg-white p-1 text-xs font-semibold">
              {(['58mm', '80mm'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setReceiptFormat(fmt)}
                  className={`px-3 py-1 rounded-lg ${
                    receiptFormat === fmt ? 'bg-[#065F46] text-white' : 'text-slate-600'
                  }`}
                >
                  {fmt} Receipt
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium no-print">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading POS catalog...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
            {/* Product Grid + Barcode Scanner */}
            <div className="lg:col-span-7 space-y-4">
              <form onSubmit={handleBarcodeSearchSubmit} className="bg-white border border-slate-200 rounded-xl p-3 flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Scan barcode or search product name / SKU (Press Enter to quick-add)..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#065F46] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" /> Match
                </button>
              </form>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[540px] overflow-y-auto pr-1">
                {filteredProducts.map((p) => {
                  const unitPrice = p.salePrice ?? p.regularPrice;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      disabled={p.stock <= 0 || isReadOnly}
                      onClick={() => addProductToCart(p)}
                      className="text-left bg-white border border-slate-200 hover:border-[#065F46] disabled:opacity-50 rounded-xl p-3 space-y-2 transition"
                    >
                      <img
                        src={p.images?.[0] || FALLBACK_PRODUCT_IMAGE}
                        alt={p.title}
                        className="w-full h-24 object-cover rounded-lg border border-slate-100"
                      />
                      <div>
                        <p className="font-bold text-xs text-slate-900 line-clamp-2">{p.title}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate">
                          {p.barcode || p.sku}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="font-extrabold text-[#065F46] tabular-nums">
                          {formatPKR(unitPrice)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            p.stock <= (p.minStockAlert ?? 5)
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.stock} {p.unit || 'pcs'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* POS Bill Cart & Payment */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Current Counter Bill ({cart.length} items)
                  </h3>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-[11px] font-semibold text-rose-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center">
                    Click products or scan a barcode to build the customer bill.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto text-xs">
                    {cart.map((item) => (
                      <div key={item.productId} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 truncate">{item.title}</p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {formatPKR(item.unitPrice)} &times; {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.productId, -1)}
                            className="p-1 border border-slate-200 rounded"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-bold tabular-nums">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.productId, 1)}
                            className="p-1 border border-slate-200 rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.productId, -item.quantity)}
                            className="p-1 text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-slate-200 pt-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Customer</label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">Walk-in Customer</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Discount (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      max={subtotal}
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                {!selectedCustomerId && (paymentMethod === 'khata_credit' || paymentMethod === 'split') && (
                  <div className="grid grid-cols-2 gap-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <input
                      type="text"
                      placeholder="Khata Customer Name *"
                      value={quickCustName}
                      onChange={(e) => setQuickCustName(e.target.value)}
                      className="px-2.5 py-1.5 border border-amber-300 rounded-lg bg-white"
                    />
                    <input
                      type="tel"
                      placeholder="Mobile (0300...) *"
                      value={quickCustPhone}
                      onChange={(e) => setQuickCustPhone(e.target.value)}
                      className="px-2.5 py-1.5 border border-amber-300 rounded-lg bg-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'cash', label: 'Cash' },
                        { id: 'bank_transfer', label: 'Bank / IBFT' },
                        { id: 'qr_payment', label: 'EasyPaisa / QR' },
                        { id: 'khata_credit', label: 'Khata Credit' },
                        { id: 'split', label: 'Split Pay' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`py-2 px-2 rounded-lg border font-bold text-[11px] ${
                          paymentMethod === m.id
                            ? 'bg-[#065F46] text-white border-[#065F46]'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'split' && (
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Cash PKR</label>
                      <input
                        type="number"
                        min={0}
                        value={cashPaid}
                        onChange={(e) => setCashPaid(Number(e.target.value))}
                        className="w-full px-2 py-1 border border-slate-200 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Digital PKR</label>
                      <input
                        type="number"
                        min={0}
                        value={digitalPaid}
                        onChange={(e) => setDigitalPaid(Number(e.target.value))}
                        className="w-full px-2 py-1 border border-slate-200 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-rose-600">Khata Credit</label>
                      <p className="font-extrabold text-rose-700 py-1 tabular-nums">
                        {formatPKR(Math.max(0, total - cashPaid - digitalPaid))}
                      </p>
                    </div>
                  </div>
                )}

                {(paymentMethod === 'bank_transfer' || paymentMethod === 'qr_payment') && (
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Optional TID / Reference #"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                )}

                <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-slate-300">Net Payable Total</p>
                    <p className="text-2xl font-black tabular-nums">{formatPKR(total)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={submitting || cart.length === 0 || isReadOnly}
                    onClick={handleCompleteSale}
                    className="px-5 py-3 bg-[#065F46] hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting ? 'Processing...' : 'Complete & Receipt'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent POS Invoices */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 no-print">
          <h3 className="text-sm font-extrabold text-slate-900">Recent Counter Invoices ({sales.length})</h3>
          {sales.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No POS sales recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-2 px-3">Invoice</th>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.slice(0, 15).map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {s.invoiceNumber}
                        <span className="block text-[10px] font-sans font-normal text-slate-400">
                          {new Date(s.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{s.customerName || 'Walk-in'}</td>
                      <td className="py-2.5 px-3 uppercase font-semibold">{s.paymentMethod.replace('_', ' ')}</td>
                      <td className="py-2.5 px-3 text-right font-extrabold tabular-nums">{formatPKR(s.total)}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`uppercase font-bold text-[10px] ${
                            s.status === 'returned' ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveReceipt(s)}
                            className="px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 font-semibold flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" /> Receipt
                          </button>
                          {!isReadOnly && s.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => handleReturnSale(s)}
                              className="px-2.5 py-1 border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 font-semibold flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" /> Return
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Thermal Receipt Print Modal (58mm or 80mm) */}
        {activeReceipt && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between no-print border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Thermal Receipt ({receiptFormat})
                </h3>
                <button type="button" onClick={() => setActiveReceipt(null)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div
                className={`mx-auto bg-white border border-dashed border-slate-300 p-4 font-mono text-[11px] text-slate-900 space-y-2 ${
                  receiptFormat === '58mm' ? 'w-[220px]' : 'w-[300px]'
                }`}
              >
                <div className="text-center border-b border-dashed border-slate-300 pb-2">
                  <p className="font-bold text-sm">{shop?.name || settings.siteName}</p>
                  <p>{settings.address}</p>
                  <p>Tel: {settings.contactPhone}</p>
                </div>

                <div className="text-[10px] space-y-0.5">
                  <p>INV: {activeReceipt.invoiceNumber}</p>
                  <p>DATE: {new Date(activeReceipt.createdAt).toLocaleString()}</p>
                  <p>CUST: {activeReceipt.customerName || 'Walk-in'}</p>
                  <p>PAY: {activeReceipt.paymentMethod.toUpperCase()}</p>
                </div>

                <div className="border-y border-dashed border-slate-300 py-2 space-y-1">
                  {activeReceipt.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between gap-2">
                      <span className="truncate">
                        {it.quantity}x {it.title}
                      </span>
                      <span className="tabular-nums shrink-0">{it.lineTotal}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>Rs. {activeReceipt.subtotal}</span>
                  </div>
                  {activeReceipt.discount > 0 && (
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <span>-Rs. {activeReceipt.discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed border-slate-300">
                    <span>NET TOTAL</span>
                    <span>Rs. {activeReceipt.total}</span>
                  </div>
                </div>

                <p className="text-center text-[10px] pt-2">Thank you for shopping with us!</p>
              </div>

              <div className="flex justify-end gap-2 no-print">
                <button
                  type="button"
                  onClick={() => setActiveReceipt(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 bg-[#065F46] text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print {receiptFormat} Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PlanFeatureGate>
  );
};

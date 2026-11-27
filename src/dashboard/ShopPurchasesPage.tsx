import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Receipt, Loader2, Trash2, X } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import { getShopProductsAdmin } from '../services/tenantService';
import {
  getShopSuppliers,
  getShopPurchases,
  createPurchaseInvoice,
} from '../services/retailService';
import { Product, Supplier, PurchaseInvoice, PurchaseItemLine } from '../types';
import { formatPKR } from '../data/seedData';
import { PlanFeatureGate } from '../components/common/PlanFeatureGate';

export const ShopPurchasesPage: React.FC = () => {
  const { shopId, isReadOnly } = useDashboard();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`PUR-${Date.now().toString().slice(-5)}`);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<PurchaseItemLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const loadAll = async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const [sups, prods, purs] = await Promise.all([
        getShopSuppliers(shopId),
        getShopProductsAdmin(shopId),
        getShopPurchases(shopId),
      ]);
      setSuppliers(sups);
      setProducts(prods.filter((p) => p.status !== 'archived'));
      setPurchases(purs);
      if (sups.length && !supplierId) setSupplierId(sups[0].id);
    } catch (err: any) {
      setError(err?.message || 'Could not load purchases and suppliers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [shopId]);

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const netTotal = Math.max(0, subtotal - Math.max(0, discount));
  const remaining = Math.max(0, netTotal - Math.min(netTotal, Math.max(0, paidAmount)));

  const handleAddLine = () => {
    if (!products.length) return;
    const first = products[0];
    const cost = Number(first.purchasePrice || Math.round((first.regularPrice || 0) * 0.7));
    setLines((prev) => [
      ...prev,
      {
        productId: first.id,
        productTitle: first.title,
        sku: first.sku,
        quantity: 10,
        purchasePrice: cost,
        lineTotal: 10 * cost,
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setError(null);
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!sup) {
      setError('Select a supplier first.');
      return;
    }
    if (!lines.length) {
      setError('Add at least one product line.');
      return;
    }

    setSaving(true);
    try {
      await createPurchaseInvoice(shopId, {
        supplierId: sup.id,
        supplierName: sup.name,
        invoiceNumber,
        purchaseDate,
        items: lines,
        discount,
        paidAmount,
        notes,
      });
      setModalOpen(false);
      setLines([]);
      setDiscount(0);
      setPaidAmount(0);
      setNotes('');
      setInvoiceNumber(`PUR-${Date.now().toString().slice(-5)}`);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to record purchase invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlanFeatureGate feature="suppliersPurchases">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#065F46]" /> Stock Purchases &amp; Bills
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Recording a purchase invoice automatically increases stock, updates cost price, and adds payable balances.
            </p>
          </div>
          {!isReadOnly && (
            <div className="flex gap-2 self-start">
              <Link
                to="/dashboard/suppliers"
                className="px-3.5 py-2.5 border border-slate-300 bg-white rounded-xl text-xs font-bold"
              >
                Manage Suppliers
              </Link>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  if (!lines.length && products.length) handleAddLine();
                  setModalOpen(true);
                }}
                className="px-4 py-2.5 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> New Purchase Bill
              </button>
            </div>
          )}
        </div>

        {error && !modalOpen && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading purchases...
            </div>
          ) : purchases.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">
              No purchase bills recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Payable Due</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchases.map((pr) => (
                    <tr key={pr.id}>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{pr.invoiceNumber}</td>
                      <td className="py-3 px-4 font-semibold">{pr.supplierName}</td>
                      <td className="py-3 px-4 text-slate-500">{pr.purchaseDate}</td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">{formatPKR(pr.total)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-emerald-700">{formatPKR(pr.paidAmount)}</td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums text-rose-700">
                        {formatPKR(pr.remainingPayable)}
                      </td>
                      <td className="py-3 px-4 uppercase font-bold text-[10px]">{pr.paymentStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full p-6 space-y-4 my-8 text-xs max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900">Record Supplier Purchase Bill</h3>
                <button type="button" onClick={() => setModalOpen(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">{error}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier *</label>
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bill / Invoice # *</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Purchased Products</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg font-semibold hover:bg-slate-50 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item Row
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <select
                      value={line.productId}
                      onChange={(e) => {
                        const prod = products.find((p) => p.id === e.target.value);
                        if (!prod) return;
                        const cost = Number(prod.purchasePrice || 0);
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx
                              ? {
                                  ...l,
                                  productId: prod.id,
                                  productTitle: prod.title,
                                  sku: prod.sku,
                                  purchasePrice: cost,
                                  lineTotal: l.quantity * cost,
                                }
                              : l
                          )
                        );
                      }}
                      className="sm:col-span-5 px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => {
                        const qty = Math.max(1, Number(e.target.value));
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx ? { ...l, quantity: qty, lineTotal: qty * l.purchasePrice } : l
                          )
                        );
                      }}
                      placeholder="Qty"
                      className="sm:col-span-2 px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                    />
                    <input
                      type="number"
                      min={0}
                      value={line.purchasePrice}
                      onChange={(e) => {
                        const cost = Math.max(0, Number(e.target.value));
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx ? { ...l, purchasePrice: cost, lineTotal: l.quantity * cost } : l
                          )
                        );
                      }}
                      placeholder="Unit Cost"
                      className="sm:col-span-2 px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                    />
                    <span className="sm:col-span-2 text-right font-bold tabular-nums">
                      {formatPKR(line.lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      className="sm:col-span-1 text-rose-600 flex justify-end"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bill Discount (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount Paid Now (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    max={netTotal}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-center">
                  <span className="text-[11px] text-slate-500">Total Bill / Payable Due</span>
                  <span className="font-extrabold text-slate-900 tabular-nums">
                    {formatPKR(netTotal)} / <span className="text-rose-700">{formatPKR(remaining)}</span>
                  </span>
                </div>
              </div>

              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional supplier bill notes"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#065F46] text-white rounded-lg font-bold"
                >
                  {saving ? 'Recording Stock & Bill...' : 'Save Purchase Invoice'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PlanFeatureGate>
  );
};

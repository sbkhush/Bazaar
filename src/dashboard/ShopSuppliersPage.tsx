import React, { useEffect, useState } from 'react';
import { Plus, Truck, Loader2, X, Banknote, Download, Upload } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  getShopSuppliers,
  saveShopSupplier,
  recordSupplierPayment,
} from '../services/retailService';
import { Supplier } from '../types';
import { formatPKR } from '../data/seedData';
import { PlanFeatureGate } from '../components/common/PlanFeatureGate';
import { CsvImportModal } from '../components/common/CsvImportModal';
import { downloadCsvFile } from '../utils/csvUtils';

export const ShopSuppliersPage: React.FC = () => {
  const { shopId, shop, isReadOnly } = useDashboard();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSuppliers = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setSuppliers(await getShopSuppliers(shopId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [shopId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || isReadOnly) return;
    setSaving(true);
    setActionError(null);
    try {
      await saveShopSupplier(shopId, editing);
      setEditing(null);
      await loadSuppliers();
    } catch (err: any) {
      setActionError(err?.message || 'Could not save supplier.');
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplier || isReadOnly) return;
    setSaving(true);
    setActionError(null);
    try {
      await recordSupplierPayment(shopId, paySupplier.id, Number(payAmount), payNotes.trim());
      setPaySupplier(null);
      setPayAmount('');
      setPayNotes('');
      await loadSuppliers();
    } catch (err: any) {
      setActionError(err?.message || 'Could not record supplier payment.');
    } finally {
      setSaving(false);
    }
  };

  const totalPayables = suppliers.reduce(
    (s, sup) => s + Math.max(0, Number(sup.currentPayableBalance || 0)),
    0
  );

  const exportCsv = () => {
    downloadCsvFile(
      `${shop?.slug || shopId}-suppliers-${new Date().toISOString().slice(0, 10)}.csv`,
      ['name', 'phone', 'email', 'address', 'openingBalancePKR', 'currentPayableBalancePKR'],
      suppliers.map((s) => [
        s.name,
        s.phone,
        s.email || '',
        s.address || '',
        s.openingBalance || 0,
        s.currentPayableBalance || 0,
      ])
    );
  };

  const handleImportCsv = async (rows: Record<string, string>[]) => {
    if (isReadOnly) throw new Error('Read-only mode.');
    const existingPhones = new Set(
      suppliers.map((s) => (s.phone || '').replace(/[\s-]/g, '')).filter(Boolean)
    );
    const existingNames = new Set(suppliers.map((s) => s.name.trim().toLowerCase()));
    let imported = 0;
    let skipped = 0;
    for (const r of rows) {
      const name = (r.name || r.suppliername || r.company || '').trim();
      const phone = (r.phone || r.mobile || '').trim();
      const cleanPhone = phone.replace(/[\s-]/g, '');
      if (!name || cleanPhone.length < 7) {
        skipped++;
        continue;
      }
      if (existingNames.has(name.toLowerCase()) || existingPhones.has(cleanPhone)) {
        skipped++;
        continue;
      }
      try {
        await saveShopSupplier(shopId, {
          name,
          phone,
          email: r.email || '',
          address: r.address || '',
          openingBalance: Math.max(0, Number(r.openingbalance || r.openingbalancepkr) || 0),
        });
        existingNames.add(name.toLowerCase());
        existingPhones.add(cleanPhone);
        imported++;
      } catch {
        skipped++;
      }
    }
    await loadSuppliers();
    return { imported, skipped };
  };

  return (
    <PlanFeatureGate feature="suppliersPurchases">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#065F46]" /> Suppliers &amp; Wholesalers
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Total Supplier Payables Due: <strong className="text-rose-700">{formatPKR(totalPayables)}</strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            <button
              type="button"
              onClick={exportCsv}
              className="px-3.5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            {!isReadOnly && (
              <>
                <button
                  type="button"
                  onClick={() => setCsvModalOpen(true)}
                  className="px-3.5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" /> Import CSV
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({ name: '', phone: '', email: '', address: '', openingBalance: 0 })
                  }
                  className="px-4 py-2.5 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Supplier
                </button>
              </>
            )}
          </div>
        </div>

        {actionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between gap-2">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss error">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading suppliers...
            </div>
          ) : suppliers.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">
              No wholesalers added yet. Add a supplier before recording purchase bills.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-right">Payable Balance</th>
                    {!isReadOnly && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{s.name}</p>
                        {s.address && <p className="text-[11px] text-slate-500">{s.address}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono text-slate-700">{s.phone}</p>
                        {s.email && <p className="text-[11px] text-slate-500">{s.email}</p>}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold tabular-nums">
                        <span className={s.currentPayableBalance > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                          {formatPKR(s.currentPayableBalance)}
                        </span>
                      </td>
                      {!isReadOnly && (
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditing(s)}
                              className="px-2.5 py-1 border border-slate-200 rounded-lg font-semibold hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            {s.currentPayableBalance > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPaySupplier(s);
                                  setPayAmount(String(s.currentPayableBalance));
                                }}
                                className="px-2.5 py-1 bg-[#065F46] text-white rounded-lg font-bold flex items-center gap-1"
                              >
                                <Banknote className="w-3 h-3" /> Pay
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {editing && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
            <form
              onSubmit={handleSave}
              className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900">
                  {editing.id ? 'Edit Supplier' : 'Add Supplier'}
                </h3>
                <button type="button" onClick={() => setEditing(null)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier / Company Name *</label>
                <input
                  type="text"
                  required
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  required
                  value={editing.phone || ''}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address / Market</label>
                <input
                  type="text"
                  value={editing.address || ''}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              {!editing.id && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opening Payable Balance (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    value={editing.openingBalance ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, openingBalance: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#065F46] text-white rounded-lg font-bold"
                >
                  {saving ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        )}

        {paySupplier && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
            <form
              onSubmit={handlePayment}
              className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900">
                  Pay {paySupplier.name}
                </h3>
                <button type="button" onClick={() => setPaySupplier(null)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <p className="text-slate-600">
                Current Payable Balance: <strong className="text-rose-700">{formatPKR(paySupplier.currentPayableBalance)}</strong>
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount Paid (PKR) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={paySupplier.currentPayableBalance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Reference / Method</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Cash / Meezan IBFT"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaySupplier(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#065F46] text-white rounded-lg font-bold"
                >
                  {saving ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        )}
        <CsvImportModal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          title="Import Suppliers CSV"
          subtitle="Duplicate supplier names or mobile numbers are skipped."
          expectedHeaders={['name', 'phone', 'email', 'address', 'openingBalance']}
          requiredHeaders={['name', 'phone']}
          sampleFilename={`${shop?.slug || shopId}-suppliers-sample.csv`}
          sampleRows={[['Al-Madina Wholesale Traders', '03211234567', 'sales@almadina.pk', 'Akbari Mandi, Lahore', 0]]}
          onImport={handleImportCsv}
        />
      </div>
    </PlanFeatureGate>
  );
};

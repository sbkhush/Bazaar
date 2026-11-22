import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, Plus, BookOpen, X, Download, Upload } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  getShopCustomersWithKhata,
  saveShopCustomerProfile,
} from '../services/retailService';
import { ShopCustomerSummary } from '../types';
import { formatPKR, PAKISTAN_CITIES } from '../data/seedData';
import { CsvImportModal } from '../components/common/CsvImportModal';
import { downloadCsvFile } from '../utils/csvUtils';

export const ShopCustomersPage: React.FC = () => {
  const { shopId, shop, isReadOnly, canUseFeature } = useDashboard();
  const [customers, setCustomers] = useState<ShopCustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', city: 'Karachi', email: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const loadCustomers = () => {
    if (!shopId) return;
    setLoading(true);
    getShopCustomersWithKhata(shopId)
      .then(setCustomers)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, [shopId]);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setSaving(true);
    try {
      await saveShopCustomerProfile(shopId, form);
      setModalOpen(false);
      setForm({ name: '', phone: '', city: 'Karachi', email: '', address: '', notes: '' });
      loadCustomers();
    } finally {
      setSaving(false);
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase())
  );

  const totalKhataReceivable = customers.reduce(
    (s, c) => s + Math.max(0, Number(c.outstandingBalance || 0)),
    0
  );

  const exportCsv = () => {
    downloadCsvFile(
      `${shop?.slug || shopId}-customers-${new Date().toISOString().slice(0, 10)}.csv`,
      ['name', 'phone', 'city', 'email', 'address', 'ordersCount', 'totalSpentPKR', 'khataDuePKR'],
      filtered.map((c) => [
        c.name,
        c.phone,
        c.city,
        c.email || '',
        c.address || '',
        c.ordersCount,
        c.totalSpent,
        c.outstandingBalance || 0,
      ])
    );
  };

  const handleImportCsv = async (rows: Record<string, string>[]) => {
    if (isReadOnly) throw new Error('Read-only mode.');
    const existingPhones = new Set(
      customers.map((c) => (c.phone || '').replace(/[\s-]/g, '')).filter(Boolean)
    );
    let imported = 0;
    let skipped = 0;
    for (const r of rows) {
      const name = (r.name || r.fullname || r.customername || '').trim();
      const phone = (r.phone || r.mobile || r.whatsapp || '').trim();
      const cleanPhone = phone.replace(/[\s-]/g, '');
      if (!name || cleanPhone.length < 7) {
        skipped++;
        continue;
      }
      if (existingPhones.has(cleanPhone)) {
        skipped++;
        continue;
      }
      await saveShopCustomerProfile(shopId, {
        name,
        phone,
        city: r.city || 'Karachi',
        email: r.email || '',
        address: r.address || '',
        notes: r.notes || '',
      });
      existingPhones.add(cleanPhone);
      imported++;
    }
    loadCustomers();
    return {
      imported,
      skipped,
      notes: skipped > 0 ? 'Duplicate phone numbers or incomplete rows were skipped.' : undefined,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Store Customers</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tenant-isolated customer directory with online orders, POS visits, and Khata receivable balances.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={exportCsv}
            className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          {canUseFeature('khata') && (
            <Link
              to="/dashboard/khata"
              className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#065F46]" />
              Khata Due: {formatPKR(totalKhataReceivable)}
            </Link>
          )}
          {!isReadOnly && (
            <>
              <button
                type="button"
                onClick={() => setCsvModalOpen(true)}
                className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> Import CSV
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Customer
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer name, phone, city..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading customers...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">No customers recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Phone &amp; City</th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Lifetime Value</th>
                  <th className="py-3 px-4 text-right">Khata Balance</th>
                  <th className="py-3 px-4 text-right">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-500">{c.email || 'Walk-in / Guest'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono text-slate-700">{c.phone}</p>
                      <p className="text-[11px] text-slate-500">{c.city}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums">{c.ordersCount}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-[#065F46] tabular-nums">
                      {formatPKR(c.totalSpent)}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold tabular-nums">
                      <span className={(c.outstandingBalance || 0) > 0 ? 'text-rose-700' : 'text-slate-400'}>
                        {formatPKR(c.outstandingBalance || 0)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {new Date(c.lastOrderAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCustomer}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Add Customer Profile</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="03001234567"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">City</label>
                <select
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {PAKISTAN_CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Address / Notes</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
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
                {saving ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </form>
        </div>
      )}
      <CsvImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="Import Customers CSV"
        subtitle="Existing mobile numbers are automatically skipped to preserve Khata balances."
        expectedHeaders={['name', 'phone', 'city', 'email', 'address', 'notes']}
        requiredHeaders={['name', 'phone']}
        sampleFilename={`${shop?.slug || shopId}-customers-sample.csv`}
        sampleRows={[['Bilal Ahmed', '03001234567', 'Lahore', 'bilal@example.com', 'Model Town Block B', 'VIP customer']]}
        onImport={handleImportCsv}
      />
    </div>
  );
};

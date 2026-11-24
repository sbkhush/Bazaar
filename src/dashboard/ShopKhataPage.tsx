import React, { useEffect, useState } from 'react';
import { BookOpen, Loader2, Plus, Printer, X } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  getShopCustomersWithKhata,
  getShopKhataEntries,
  recordKhataTransaction,
} from '../services/retailService';
import { ShopCustomerSummary, KhataEntry } from '../types';
import { formatPKR } from '../data/seedData';
import { PlanFeatureGate } from '../components/common/PlanFeatureGate';

export const ShopKhataPage: React.FC = () => {
  const { shopId, shop, isReadOnly } = useDashboard();
  const [customers, setCustomers] = useState<ShopCustomerSummary[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [entries, setEntries] = useState<KhataEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [txType, setTxType] = useState<KhataEntry['type']>('payment');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async (custId?: string) => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [custs, kht] = await Promise.all([
        getShopCustomersWithKhata(shopId),
        getShopKhataEntries(shopId, custId || selectedCustomerId || undefined),
      ]);
      setCustomers(custs);
      setEntries(kht);
      if (!selectedCustomerId && custs.length > 0 && !custId) {
        const withBal = custs.find((c) => (c.outstandingBalance || 0) > 0) || custs[0];
        setSelectedCustomerId(withBal.id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shopId]);

  useEffect(() => {
    if (shopId && selectedCustomerId) {
      getShopKhataEntries(shopId, selectedCustomerId).then(setEntries);
    }
  }, [shopId, selectedCustomerId]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
  const totalOutstanding = customers.reduce(
    (s, c) => s + Math.max(0, Number(c.outstandingBalance || 0)),
    0
  );

  const handleRecordTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || isReadOnly || !amount) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await recordKhataTransaction(shopId, {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        type: txType,
        amount: Number(amount),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setAmount('');
      setReference('');
      setNotes('');
      await loadData(selectedCustomer.id);
    } catch (err: any) {
      setActionError(err?.message || 'Could not record Khata transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PlanFeatureGate feature="khata">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#065F46]" /> Customer Khata / Credit Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Total Outstanding Receivables:{' '}
              <strong className="text-rose-700">{formatPKR(totalOutstanding)}</strong>
            </p>
          </div>
          {selectedCustomer && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start"
            >
              <Printer className="w-3.5 h-3.5" /> Print Khata Statement
            </button>
          )}
        </div>

        {actionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between gap-2 no-print">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss error">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading Khata ledger...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Customer List */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
              <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900">
                Customer Accounts ({customers.length})
              </div>
              <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto text-xs">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`w-full text-left p-3.5 flex items-center justify-between gap-2 transition ${
                      selectedCustomerId === c.id ? 'bg-emerald-50 border-l-4 border-[#065F46]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{c.name}</p>
                      <p className="text-[11px] font-mono text-slate-500">{c.phone}</p>
                    </div>
                    <span
                      className={`font-extrabold tabular-nums shrink-0 ${
                        (c.outstandingBalance || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatPKR(c.outstandingBalance || 0)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Customer Statement & Payment Recovery */}
            <div className="lg:col-span-8 space-y-5">
              {selectedCustomer ? (
                <>
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase font-bold text-slate-400">
                        {shop?.name} — Khata Statement
                      </p>
                      <h3 className="text-lg font-extrabold text-slate-900">{selectedCustomer.name}</h3>
                      <p className="text-xs text-slate-500">
                        {selectedCustomer.phone} · {selectedCustomer.city}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500">Outstanding Credit Due</p>
                      <p className="text-2xl font-black text-rose-700 tabular-nums">
                        {formatPKR(selectedCustomer.outstandingBalance || 0)}
                      </p>
                    </div>
                  </div>

                  {!isReadOnly && (
                    <form
                      onSubmit={handleRecordTx}
                      className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs no-print"
                    >
                      <select
                        value={txType}
                        onChange={(e) => setTxType(e.target.value as KhataEntry['type'])}
                        className="px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
                      >
                        <option value="payment">Payment Received (-)</option>
                        <option value="credit_sale">Add Khata Credit (+)</option>
                        <option value="adjustment">Balance Adjustment (+)</option>
                      </select>
                      <input
                        type="number"
                        required
                        min={1}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Amount PKR *"
                        className="px-3 py-2 border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes / Reference"
                        className="px-3 py-2 border border-slate-200 rounded-lg"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2 bg-[#065F46] text-white rounded-lg font-bold flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> {submitting ? 'Saving...' : 'Record'}
                      </button>
                    </form>
                  )}

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900">
                      Ledger Transactions ({entries.length})
                    </div>
                    {entries.length === 0 ? (
                      <p className="text-xs text-slate-500 p-8 text-center">
                        No Khata credit or recovery transactions recorded for this customer.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                              <th className="py-2.5 px-4">Date</th>
                              <th className="py-2.5 px-4">Type &amp; Details</th>
                              <th className="py-2.5 px-4 text-right">Amount</th>
                              <th className="py-2.5 px-4 text-right">New Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {entries.map((en) => (
                              <tr key={en.id}>
                                <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                                  {new Date(en.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-2.5 px-4">
                                  <p className="font-bold uppercase text-[11px] text-slate-800">
                                    {en.type.replace('_', ' ')}
                                  </p>
                                  {(en.notes || en.reference) && (
                                    <p className="text-[11px] text-slate-500">
                                      {en.notes || en.reference}
                                    </p>
                                  )}
                                </td>
                                <td
                                  className={`py-2.5 px-4 text-right font-bold tabular-nums ${
                                    en.type === 'payment' ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  {en.type === 'payment' ? '-' : '+'}
                                  {formatPKR(en.amount)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-extrabold tabular-nums">
                                  {formatPKR(en.newBalance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
                  Add a customer or complete a Khata credit sale at POS to manage customer credit balances.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PlanFeatureGate>
  );
};

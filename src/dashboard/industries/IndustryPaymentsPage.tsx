import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Receipt, Search, Wallet } from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  calculatePaymentTotals,
  getIndustryPayments,
  getPaymentMethodDisplay,
  recordIndustryPayment,
  updateIndustryPaymentStatus,
} from '../../services/industryCommonService';
import { IndustryPaymentRecord, ManualPaymentMethod } from '../../types';
import { formatPKR } from '../../data/seedData';
import { ImageUploader } from '../../components/common/ImageUploader';

const PAYMENT_METHODS: ManualPaymentMethod[] = [
  'cash',
  'easypaisa',
  'jazzcash',
  'bank_transfer',
  'ibft',
];

export const IndustryPaymentsPage: React.FC = () => {
  const { shopId, industryGroup, isReadOnly } = useDashboard();
  const [payments, setPayments] = useState<IndustryPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'verified'>('all');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<ManualPaymentMethod>('cash');
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');
  const [transactionRef, setTransactionRef] = useState('');
  const [proofUrlList, setProofUrlList] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getIndustryPayments(shopId);
      setPayments(list);
    } catch (err: any) {
      setError(err?.message || 'Could not load payment ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const totals = calculatePaymentTotals(payments);

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly) return;
    const numericAmount = Number(amount);
    if (!customerName.trim() || !numericAmount || numericAmount <= 0) {
      setError('Customer name and valid PKR amount are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordIndustryPayment(shopId, {
        module:
          industryGroup === 'gym' ||
          industryGroup === 'clinic' ||
          industryGroup === 'carwash' ||
          industryGroup === 'car_dealer'
            ? industryGroup
            : 'gym',
        referenceType:
          industryGroup === 'gym'
            ? 'membership'
            : industryGroup === 'clinic'
            ? 'consultation'
            : industryGroup === 'carwash'
            ? 'carwash_job'
            : 'dealer_deal',
        referenceId: `manual_${Date.now()}`,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        amount: numericAmount,
        method,
        status,
        transactionRef: transactionRef.trim() || undefined,
        proofUrl: proofUrlList[0] || undefined,
        notes: description.trim() || undefined,
      });
      setCustomerName('');
      setCustomerPhone('');
      setDescription('');
      setAmount('');
      setTransactionRef('');
      setProofUrlList([]);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (paymentId: string, nextStatus: IndustryPaymentRecord['status']) => {
    if (!shopId || isReadOnly) return;
    try {
      await updateIndustryPaymentStatus(shopId, paymentId, nextStatus);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not update payment status.');
    }
  };

  const filtered = payments.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${p.customerName} ${p.customerPhone || ''} ${p.transactionRef || ''} ${p.notes || ''}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Payments &amp; Fee Collection</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Track Cash, EasyPaisa, JazzCash, Bank Transfer, and IBFT receipts alongside pending dues.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Collected</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {formatPKR(totals.paidTotal)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">This Month Collected</p>
          <p className="text-2xl font-extrabold text-[#065F46] mt-1 tabular-nums">
            {formatPKR(totals.monthlyPaid)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Pending Verification / Dues</p>
          <p className="text-2xl font-extrabold text-amber-700 mt-1 tabular-nums">
            {formatPKR(totals.pendingTotal)}
          </p>
        </div>
      </div>

      {!isReadOnly && (
        <form onSubmit={handleRecord} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#065F46]" /> Record Payment Entry
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer / Member / Patient Name *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Mobile Number (03xx...)"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="number"
              min="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount in PKR *"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as ManualPaymentMethod)}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {getPaymentMethodDisplay(m)}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'paid' | 'pending')}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="paid">Paid / Received</option>
              <option value="pending">Pending / Due</option>
            </select>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="TID / IBFT / Receipt Reference"
              className="px-3 py-2 border border-slate-200 rounded-lg font-mono"
            />
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes (e.g. Monthly fee, Consultation balance, Booking deposit)"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
          {method !== 'cash' && (
            <ImageUploader
              shopId={shopId}
              folder="receipts"
              images={proofUrlList}
              onChange={setProofUrlList}
              label="Optional Payment Proof / Slip"
            />
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-[#065F46] text-white rounded-xl font-bold inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {saving ? 'Recording...' : 'Save Payment Entry'}
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden text-xs">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, TID, or note..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'paid', 'verified', 'pending'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold capitalize ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading payment history...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <Receipt className="w-6 h-6 mx-auto text-slate-300" />
            <p>No payment records match the current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Method &amp; Ref</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-500 tabular-nums">
                      {p.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{p.customerName}</p>
                      <p className="text-[11px] text-slate-500">
                        {[p.customerPhone, p.notes].filter(Boolean).join(' · ') || p.referenceType}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{getPaymentMethodDisplay(p.method)}</p>
                      {p.transactionRef && (
                        <p className="text-[11px] font-mono text-slate-500">{p.transactionRef}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-900 tabular-nums">
                      {formatPKR(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold capitalize ${
                          p.status === 'verified' || p.status === 'paid'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : p.status === 'pending'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isReadOnly && p.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleVerify(p.id, 'verified')}
                          className="px-2.5 py-1 bg-[#065F46] text-white rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Mark Verified
                        </button>
                      )}
                      {!isReadOnly && p.status === 'paid' && (
                        <button
                          type="button"
                          onClick={() => handleVerify(p.id, 'verified')}
                          className="px-2.5 py-1 border border-slate-200 text-slate-700 rounded-md text-[11px] font-semibold"
                        >
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

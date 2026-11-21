import React, { useEffect, useMemo, useState } from 'react';
import { Coins, Check, XCircle, RotateCcw, RefreshCw, Loader2 } from 'lucide-react';
import {
  decideBonusRecommendation,
  decideSalesExpense,
  getAllBonusRecommendations,
  getAllCommissionLedger,
  getAllSalesExpenses,
  syncCommissionForApprovedPayment,
  updateCommissionDecision,
} from '../../services/salesService';
import { getAllPlatformPayments } from '../../services/platformService';
import { formatPKR } from '../../data/seedData';
import { useToast } from '../../components/common/Toast';
import { CommissionLedgerEntry, SalesBonusRecommendation, SalesExpense } from '../../types';

export const SalesCommissionsPage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [entries, setEntries] = useState<CommissionLedgerEntry[]>([]);
  const [bonusRecs, setBonusRecs] = useState<SalesBonusRecommendation[]>([]);
  const [expenses, setExpenses] = useState<SalesExpense[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const [reasonModal, setReasonModal] = useState<{
    entry: CommissionLedgerEntry;
    decision: 'rejected' | 'reversed';
  } | null>(null);
  const [reasonText, setReasonText] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, recs, exps] = await Promise.all([
        getAllCommissionLedger().catch(() => []),
        getAllBonusRecommendations().catch(() => []),
        getAllSalesExpenses().catch(() => []),
      ]);
      setEntries(list);
      setBonusRecs(recs);
      setExpenses(exps);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncFromPayments = async () => {
    setSyncing(true);
    try {
      const payments = await getAllPlatformPayments();
      const approved = payments.filter((p) => p.status === 'approved' && Number(p.amount) > 0);
      let createdCount = 0;
      const existingPaymentIds = new Set(entries.map((e) => e.paymentId));
      for (const pay of approved) {
        if (existingPaymentIds.has(pay.id)) continue;
        const entry = await syncCommissionForApprovedPayment(pay.id);
        if (entry) createdCount++;
      }
      showToast(
        createdCount > 0
          ? `Synced ${createdCount} new commission ledger entry(s) from verified payments.`
          : 'All eligible approved subscription payments are already synced.',
        'success'
      );
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Commission sync failed.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleApprove = async (entry: CommissionLedgerEntry) => {
    try {
      await updateCommissionDecision({ commissionId: entry.id, decision: 'approved' });
      showToast(`Approved Rs. ${entry.commissionAmount} for ${entry.salesmanName}.`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Approval failed.', 'error');
    }
  };

  const handleReasonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonModal) return;
    try {
      await updateCommissionDecision({
        commissionId: reasonModal.entry.id,
        decision: reasonModal.decision,
        reason: reasonText.trim(),
      });
      showToast(`Commission marked as ${reasonModal.decision}.`, 'success');
      setReasonModal(null);
      setReasonText('');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Action failed.', 'error');
    }
  };

  const filtered = useMemo(
    () => entries.filter((e) => statusFilter === 'all' || e.status === statusFilter),
    [entries, statusFilter]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Commission Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Server-verified commission ledger calculated strictly from approved subscription payments. Approve, reject, or reverse on refund.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved (Ready for Payout)</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
            <option value="reversed">Reversed</option>
          </select>
          <button
            type="button"
            onClick={handleSyncFromPayments}
            disabled={syncing}
            className="px-4 py-2 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync Approved Payments
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Coins className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No commission ledger entries found</p>
            <p className="text-xs text-slate-500">Commissions appear automatically when Super Admin approves a referred shop&apos;s subscription payment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Salesman & Shop</th>
                  <th className="px-4 py-3">Plan & Payment</th>
                  <th className="px-4 py-3">Rate + Bonus</th>
                  <th className="px-4 py-3">Commission</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{c.salesmanName}</p>
                      <p className="text-[11px] text-slate-500">{c.shopName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{c.planName} ({c.billingCycle})</p>
                      <p className="text-[11px] text-slate-500 tabular-nums">Paid: {formatPKR(c.paymentAmount)}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {c.commissionRatePct}% {c.flatBonusAmount > 0 ? `+ ${formatPKR(c.flatBonusAmount)}` : ''}
                    </td>
                    <td className="px-4 py-3 font-extrabold text-[#065F46] tabular-nums">
                      {formatPKR(c.commissionAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                          c.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-900'
                            : c.status === 'approved'
                            ? 'bg-blue-50 text-blue-700'
                            : c.status === 'pending'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {c.status}
                      </span>
                      {(c.rejectionReason || c.reversalReason) && (
                        <p className="text-[10px] text-rose-600 mt-1">{c.rejectionReason || c.reversalReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        {c.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(c)}
                              className="px-2.5 py-1 rounded-lg bg-[#065F46] text-white font-bold inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setReasonModal({ entry: c, decision: 'rejected' })}
                              className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold inline-flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </>
                        )}
                        {(c.status === 'approved' || c.status === 'paid') && (
                          <button
                            type="button"
                            onClick={() => setReasonModal({ entry: c, decision: 'reversed' })}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Reverse
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

      {/* MANAGER BONUS RECOMMENDATIONS & SALES EXPENSE CLAIMS (SUPER ADMIN ONLY APPROVALS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-extrabold text-slate-900">
              Manager Bonus Recommendations ({bonusRecs.length})
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Approving adds a target bonus entry into the commission ledger.
            </p>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {bonusRecs.length === 0 ? (
              <p className="p-6 text-center text-slate-500">No bonus recommendations submitted.</p>
            ) : (
              bonusRecs.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      {r.salesmanName} · {formatPKR(r.recommendedAmount)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      By {r.managerName} ({r.periodKey}) · {r.reason}
                    </p>
                  </div>
                  {r.status === 'pending' ? (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          decideBonusRecommendation({ recId: r.id, decision: 'approved' })
                            .then(() => {
                              showToast('Bonus recommendation approved.', 'success');
                              loadData();
                            })
                            .catch((e) => showToast(e.message, 'error'))
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#065F46] text-white font-bold"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          decideBonusRecommendation({ recId: r.id, decision: 'rejected' })
                            .then(() => {
                              showToast('Bonus recommendation rejected.', 'success');
                              loadData();
                            })
                            .catch((e) => showToast(e.message, 'error'))
                        }
                        className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 font-semibold"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="capitalize font-bold text-slate-600">{r.status}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-extrabold text-slate-900">
              Sales Expense Claims ({expenses.length})
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Reps cannot self-approve expenses; Super Admin verification required.
            </p>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {expenses.length === 0 ? (
              <p className="p-6 text-center text-slate-500">No expense claims submitted.</p>
            ) : (
              expenses.map((ex) => (
                <div key={ex.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      {ex.salesmanName} · {formatPKR(ex.amount)} ({ex.category.replace('_', ' ')})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {ex.expenseDate} · {ex.description}
                    </p>
                  </div>
                  {ex.status === 'pending' ? (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          decideSalesExpense({ expenseId: ex.id, decision: 'approved' })
                            .then(() => {
                              showToast('Expense approved.', 'success');
                              loadData();
                            })
                            .catch((e) => showToast(e.message, 'error'))
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#065F46] text-white font-bold"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          decideSalesExpense({ expenseId: ex.id, decision: 'rejected' })
                            .then(() => {
                              showToast('Expense rejected.', 'success');
                              loadData();
                            })
                            .catch((e) => showToast(e.message, 'error'))
                        }
                        className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 font-semibold"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="capitalize font-bold text-slate-600">{ex.status}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {reasonModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleReasonSubmit} className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-base font-extrabold text-slate-900 capitalize">
              {reasonModal.decision} Commission ({formatPKR(reasonModal.entry.commissionAmount)})
            </h3>
            <p className="text-slate-600">
              Provide an audit reason for {reasonModal.decision === 'rejected' ? 'rejecting' : 'reversing'} this commission for {reasonModal.entry.salesmanName}:
            </p>
            <textarea
              required
              rows={3}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="e.g. Subscription refunded / chargeback issued"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReasonModal(null)} className="px-4 py-2 rounded-xl border border-slate-200 font-semibold">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-rose-700 text-white font-bold">
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, FileDown, CheckCircle2, Loader2, Banknote } from 'lucide-react';
import {
  getAllCommissionLedger,
  getAllCommissionPayouts,
  getAllSalesMembers,
  getSalesSettings,
  recordManualPayout,
} from '../../services/salesService';
import { formatPKR } from '../../data/seedData';
import { downloadPayoutStatementPdf } from '../../utils/qrPdfUtils';
import { useToast } from '../../components/common/Toast';
import {
  CommissionLedgerEntry,
  CommissionPayout,
  PayoutMethod,
  SalesMember,
  SalesSettings,
} from '../../types';

export const SalesPayoutsPage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [members, setMembers] = useState<SalesMember[]>([]);
  const [ledger, setLedger] = useState<CommissionLedgerEntry[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [settings, setSettings] = useState<SalesSettings | null>(null);

  const [selectedSalesmanId, setSelectedSalesmanId] = useState('');
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [method, setMethod] = useState<PayoutMethod>('bank_transfer');
  const [accountTitle, setAccountTitle] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, l, p, s] = await Promise.all([
        getAllSalesMembers().catch(() => []),
        getAllCommissionLedger().catch(() => []),
        getAllCommissionPayouts().catch(() => []),
        getSalesSettings(),
      ]);
      setMembers(m);
      setLedger(l);
      setPayouts(p);
      setSettings(s);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const payableGroups = useMemo(() => {
    const approved = ledger.filter((c) => c.status === 'approved');
    const bySalesman = new Map<
      string,
      { salesman: SalesMember | undefined; entries: CommissionLedgerEntry[]; total: number }
    >();
    const memberMap = new Map(members.map((m) => [m.id, m]));

    for (const c of approved) {
      const cur = bySalesman.get(c.salesmanId) || {
        salesman: memberMap.get(c.salesmanId),
        entries: [],
        total: 0,
      };
      cur.entries.push(c);
      cur.total += Number(c.commissionAmount) || 0;
      bySalesman.set(c.salesmanId, cur);
    }
    return Array.from(bySalesman.entries()).map(([salesmanId, val]) => ({
      salesmanId,
      salesmanName: val.salesman?.fullName || val.entries[0]?.salesmanName || salesmanId,
      ...val,
    }));
  }, [ledger, members]);

  const activeGroup = useMemo(
    () => payableGroups.find((g) => g.salesmanId === selectedSalesmanId) || null,
    [payableGroups, selectedSalesmanId]
  );

  const selectedAmount = useMemo(() => {
    if (!activeGroup) return 0;
    const idSet = new Set(selectedEntryIds);
    return activeGroup.entries
      .filter((e) => idSet.has(e.id))
      .reduce((sum, e) => sum + Number(e.commissionAmount || 0), 0);
  }, [activeGroup, selectedEntryIds]);

  const selectSalesmanForPayout = (salesmanId: string) => {
    const grp = payableGroups.find((g) => g.salesmanId === salesmanId);
    setSelectedSalesmanId(salesmanId);
    if (!grp) {
      setSelectedEntryIds([]);
      return;
    }
    setSelectedEntryIds(grp.entries.map((e) => e.id));
    if (grp.salesman?.payoutDetails) {
      setMethod(grp.salesman.payoutDetails.preferredMethod || 'bank_transfer');
      setAccountTitle(grp.salesman.payoutDetails.accountTitle || grp.salesman.fullName);
      setAccountNumber(grp.salesman.payoutDetails.accountNumber || '');
      setBankName(grp.salesman.payoutDetails.bankName || '');
    } else {
      setMethod('bank_transfer');
      setAccountTitle(grp.salesman?.fullName || grp.salesmanName);
      setAccountNumber('');
      setBankName('');
    }
  };

  const toggleEntry = (id: string) => {
    setSelectedEntryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleProcessPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !activeGroup.salesman) {
      showToast('Select a valid salesman with approved commissions.', 'error');
      return;
    }
    if (selectedEntryIds.length === 0) {
      showToast('Select at least one approved commission entry.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const saved = await recordManualPayout({
        salesman: activeGroup.salesman,
        ledgerEntryIds: selectedEntryIds,
        method,
        accountTitle,
        accountNumber,
        bankName,
        transactionReference,
        notes,
      });
      showToast(`Payout ${saved.payoutNumber} (${formatPKR(saved.totalAmount)}) recorded.`, 'success');
      setSelectedSalesmanId('');
      setSelectedEntryIds([]);
      setTransactionReference('');
      setNotes('');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to record payout.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalApprovedQueue = payableGroups.reduce((s, g) => s + g.total, 0);
  const totalSettled = payouts.reduce((s, p) => s + Number(p.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Payout Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Settle approved commissions via Bank Transfer, EasyPaisa, or JazzCash and issue downloadable PDF payout statements.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2">
            <span className="text-blue-700 font-semibold">Approved Queue: </span>
            <span className="font-extrabold text-blue-950 tabular-nums">{formatPKR(totalApprovedQueue)}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2">
            <span className="text-emerald-700 font-semibold">Total Disbursed: </span>
            <span className="font-extrabold text-[#065F46] tabular-nums">{formatPKR(totalSettled)}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Approved Salesmen Queue */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900">Ready for Payout</h2>
              {settings && (
                <span className="text-[11px] text-slate-500">
                  Min threshold: {formatPKR(settings.minPayoutThreshold)}
                </span>
              )}
            </div>

            {payableGroups.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 space-y-2">
                <CheckCircle2 className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">No approved unpaid commissions waiting</p>
                <p>Approve pending entries in Commission Management first.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {payableGroups.map((g) => {
                  const isSelected = selectedSalesmanId === g.salesmanId;
                  const belowThreshold =
                    settings && g.total < settings.minPayoutThreshold;
                  return (
                    <button
                      key={g.salesmanId}
                      type="button"
                      onClick={() => selectSalesmanForPayout(g.salesmanId)}
                      className={`w-full text-left p-3.5 rounded-xl border transition ${
                        isSelected
                          ? 'border-[#065F46] bg-emerald-50/70'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-slate-900">{g.salesmanName}</p>
                          <p className="text-[11px] text-slate-500">
                            {g.salesman?.employeeId || g.salesmanId} · {g.entries.length} approved entry(s)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-extrabold text-[#065F46] tabular-nums">
                            {formatPKR(g.total)}
                          </p>
                          {belowThreshold && (
                            <span className="text-[10px] font-semibold text-amber-700">
                              Below min threshold
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Payout Execution Form */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5">
            {!activeGroup ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center text-xs text-slate-500 space-y-2">
                <Wallet className="w-8 h-8 text-slate-300" />
                <p className="font-bold text-slate-700">Select a salesman from the left queue</p>
                <p className="max-w-sm">
                  Review eligible approved commissions, enter bank/wallet TID, and generate an official payout statement PDF.
                </p>
              </div>
            ) : (
              <form onSubmit={handleProcessPayout} className="space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Settle Commission — {activeGroup.salesmanName}
                    </h2>
                    <p className="text-[11px] text-slate-500">{activeGroup.salesman?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Selected Total</p>
                    <p className="text-lg font-extrabold text-[#065F46] tabular-nums">
                      {formatPKR(selectedAmount)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="font-bold text-slate-700 mb-2">Included Approved Ledger Entries</p>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {activeGroup.entries.map((entry) => (
                      <label
                        key={entry.id}
                        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedEntryIds.includes(entry.id)}
                            onChange={() => toggleEntry(entry.id)}
                            className="accent-[#065F46]"
                          />
                          <div>
                            <p className="font-semibold text-slate-800">{entry.shopName}</p>
                            <p className="text-[10px] text-slate-500">
                              {entry.planName} ({entry.billingCycle})
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {formatPKR(entry.commissionAmount)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Payout Method</label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value as PayoutMethod)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="bank_transfer">Bank Transfer (IBFT / Raast)</option>
                      <option value="easypaisa">EasyPaisa</option>
                      <option value="jazzcash">JazzCash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Transaction Reference / TID *</label>
                    <input
                      required
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      placeholder="e.g. TID-98451234"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Account Title *</label>
                    <input
                      required
                      value={accountTitle}
                      onChange={(e) => setAccountTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Account / Wallet Number *</label>
                    <input
                      required
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="0300... or IBAN"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  {method === 'bank_transfer' && (
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                      <input
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. Meezan Bank / HBL / Alfalah"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Internal Payout Notes</label>
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional settlement remarks"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submitting || selectedEntryIds.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    <Banknote className="w-4 h-4" />
                    {submitting ? 'Processing Payout...' : `Record Payout (${formatPKR(selectedAmount)})`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Historical Payouts Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900">Payout History & Statements</h2>
          <span className="text-[11px] text-slate-500">{payouts.length} payout(s)</span>
        </div>

        {payouts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No payouts have been recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Statement #</th>
                  <th className="px-4 py-3">Salesman</th>
                  <th className="px-4 py-3">Method & Account</th>
                  <th className="px-4 py-3">TID / Reference</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Processed</th>
                  <th className="px-4 py-3 text-right">PDF Statement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{p.payoutNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{p.salesmanName}</p>
                      <p className="text-[11px] text-slate-500">{p.ledgerEntryIds.length} entry(s)</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold uppercase text-slate-800">{p.method.replace('_', ' ')}</p>
                      <p className="text-[11px] text-slate-500">
                        {p.accountTitle} · {p.accountNumber}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{p.transactionReference}</td>
                    <td className="px-4 py-3 font-extrabold text-[#065F46] tabular-nums">
                      {formatPKR(p.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(p.processedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => downloadPayoutStatementPdf(p)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold inline-flex items-center gap-1.5 text-slate-700"
                      >
                        <FileDown className="w-3.5 h-3.5" /> Statement PDF
                      </button>
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

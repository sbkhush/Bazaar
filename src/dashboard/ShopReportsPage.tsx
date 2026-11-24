import React, { useEffect, useState, useMemo } from 'react';
import {
  Download,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  X,
} from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  getAllShopOrdersAdmin,
  getShopProductsAdmin,
} from '../services/tenantService';
import {
  getShopPosSales,
  getShopExpenses,
  saveShopExpense,
  deleteShopExpense,
  getShopSuppliers,
  calculateRetailProfitSummary,
} from '../services/retailService';
import { Order, Product, PosSale, ShopExpense, Supplier } from '../types';
import { formatPKR } from '../data/seedData';
import { DistributionMeters, SimpleBarChart } from '../components/common/SimpleCharts';
import { downloadCsvFile } from '../utils/csvUtils';

export const ShopReportsPage: React.FC = () => {
  const { shopId, shop, canUseFeature, isReadOnly } = useDashboard();
  const [orders, setOrders] = useState<Order[]>([]);
  const [posSales, setPosSales] = useState<PosSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<ShopExpense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const [rangePreset, setRangePreset] = useState<'7d' | '30d' | '90d' | 'all' | 'custom'>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Quick expense form
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ShopExpense['category']>('rent');
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');
  const [savingExp, setSavingExp] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadAll = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [ords, prods, sales, exps, sups] = await Promise.all([
        getAllShopOrdersAdmin(shopId).catch(() => []),
        getShopProductsAdmin(shopId).catch(() => []),
        getShopPosSales(shopId).catch(() => []),
        getShopExpenses(shopId).catch(() => []),
        getShopSuppliers(shopId).catch(() => []),
      ]);
      setOrders(ords);
      setProducts(prods);
      setPosSales(sales);
      setExpenses(exps);
      setSuppliers(sups);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [shopId]);

  const dateBounds = useMemo(() => {
    const now = new Date();
    if (rangePreset === 'all') return { from: '', to: '' };
    if (rangePreset === 'custom') return { from: startDate, to: endDate };
    const days = rangePreset === '7d' ? 7 : rangePreset === '30d' ? 30 : 90;
    const fromDate = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
    return { from: fromDate, to: now.toISOString().slice(0, 10) };
  }, [rangePreset, startDate, endDate]);

  const inRange = (iso?: string) => {
    if (!iso) return true;
    const day = iso.slice(0, 10);
    if (dateBounds.from && day < dateBounds.from) return false;
    if (dateBounds.to && day > dateBounds.to) return false;
    return true;
  };

  const filteredOrders = orders.filter((o) => inRange(o.createdAt));
  const filteredPos = posSales.filter((s) => inRange(s.createdAt));
  const filteredExpenses = expenses.filter((e) => inRange(e.date));

  const profit = useMemo(
    () =>
      calculateRetailProfitSummary({
        orders: filteredOrders,
        posSales: filteredPos,
        expenses: filteredExpenses,
        products,
      }),
    [filteredOrders, filteredPos, filteredExpenses, products]
  );

  const validOrders = filteredOrders.filter((o) => o.orderStatus !== 'Cancelled');
  const validPos = filteredPos.filter((s) => s.status !== 'returned');

  // Cashier / Staff report
  const cashierStats = useMemo(() => {
    const map = new Map<string, { email: string; count: number; total: number }>();
    validPos.forEach((s) => {
      const key = s.cashierName || s.cashierId || 'Cashier';
      const prev = map.get(key) || { email: key, count: 0, total: 0 };
      prev.count += 1;
      prev.total += Number(s.total || 0);
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [validPos]);

  // Payment method distribution across online + POS
  const payCounts = new Map<string, number>();
  validOrders.forEach((o) =>
    payCounts.set(o.paymentMethod.toUpperCase(), (payCounts.get(o.paymentMethod.toUpperCase()) || 0) + 1)
  );
  validPos.forEach((s) =>
    payCounts.set(`POS_${s.paymentMethod.toUpperCase()}`, (payCounts.get(`POS_${s.paymentMethod.toUpperCase()}`) || 0) + 1)
  );

  // City breakdown
  const cityRevenue = new Map<string, number>();
  validOrders.forEach((o) => {
    const city = o.customer.city || 'Other';
    cityRevenue.set(city, (cityRevenue.get(city) || 0) + Number(o.total || 0));
  });
  const topCities = Array.from(cityRevenue.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !expAmount) return;
    setSavingExp(true);
    setActionError(null);
    try {
      await saveShopExpense(shopId, {
        title: expTitle.trim() || `${expCategory.toUpperCase()} Expense`,
        category: expCategory,
        amount: Number(expAmount),
        date: new Date().toISOString().slice(0, 10),
        notes: expNote.trim() || undefined,
      });
      setExpTitle('');
      setExpAmount('');
      setExpNote('');
      await loadAll();
    } catch (err: any) {
      setActionError(err?.message || 'Could not save expense entry.');
    } finally {
      setSavingExp(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (isReadOnly) return;
    setActionError(null);
    try {
      await deleteShopExpense(shopId, expenseId);
      await loadAll();
    } catch (err: any) {
      setActionError(err?.message || 'Could not delete expense entry.');
    }
  };

  const exportReport = () => {
    downloadCsvFile(
      `${shop?.slug || shopId}-retail-profit-report.csv`,
      ['Metric', 'Value'],
      [
        ['Store', shop?.name || shopId],
        ['Online Revenue PKR', String(profit.onlineRevenue)],
        ['POS Revenue PKR', String(profit.posRevenue)],
        ['Total Revenue PKR', String(profit.totalRevenue)],
        ['COGS PKR' + (profit.hasEstimatedCogs ? ' (Estimated)' : ''), String(profit.cogs)],
        ['Gross Profit PKR', String(profit.grossProfit)],
        ['Operating Expenses PKR', String(profit.totalExpenses)],
        ['Net Profit PKR', String(profit.netProfit)],
      ]
    );
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Generating retail &amp; profit reports...
      </div>
    );
  }

  const totalPayables = suppliers.reduce(
    (s, sup) => s + Math.max(0, Number(sup.currentPayableBalance || 0)),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Reports, Expenses &amp; Net Profit</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Online + POS sales split, Cost of Goods Sold (COGS), store expenses, and profit margin analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={rangePreset}
            onChange={(e) => setRangePreset(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-semibold"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
          <button
            type="button"
            onClick={exportReport}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {rangePreset === 'custom' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 text-xs items-center">
          <label className="font-semibold text-slate-700">
            From:{' '}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="ml-1 px-2.5 py-1.5 border border-slate-200 rounded-lg"
            />
          </label>
          <label className="font-semibold text-slate-700">
            To:{' '}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="ml-1 px-2.5 py-1.5 border border-slate-200 rounded-lg"
            />
          </label>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {profit.hasEstimatedCogs && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Estimated COGS:</strong> Some older items sold in this period lack a recorded purchase cost price. Add cost prices on Products or Purchases for exact margin precision.
          </span>
        </div>
      )}

      {/* Profit & Sales KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Revenue</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {formatPKR(profit.totalRevenue)}
          </p>
          <p className="text-[11px] text-slate-400">
            Online {formatPKR(profit.onlineRevenue)} · POS {formatPKR(profit.posRevenue)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">
            COGS {profit.hasEstimatedCogs ? '(Estimated)' : ''}
          </p>
          <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {formatPKR(profit.cogs)}
          </p>
          <p className="text-[11px] text-slate-400">Cost of sold goods</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Gross Profit</p>
          <p className="text-xl font-extrabold text-emerald-700 mt-1 tabular-nums">
            {formatPKR(profit.grossProfit)}
          </p>
          <p className="text-[11px] text-slate-400">Revenue minus COGS</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Store Expenses</p>
          <p className="text-xl font-extrabold text-rose-700 mt-1 tabular-nums">
            {formatPKR(profit.totalExpenses)}
          </p>
          <p className="text-[11px] text-slate-400">{filteredExpenses.length} expense entries</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Net Profit</p>
          <p
            className={`text-xl font-extrabold mt-1 tabular-nums ${
              profit.netProfit >= 0 ? 'text-[#065F46]' : 'text-rose-700'
            }`}
          >
            {formatPKR(profit.netProfit)}
          </p>
          <p className="text-[11px] text-slate-400">Supplier payables: {formatPKR(totalPayables)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Top Cities by Online Revenue</h3>
          {topCities.length > 0 ? (
            <SimpleBarChart data={topCities} valuePrefix="Rs. " />
          ) : (
            <p className="text-xs text-slate-500 py-8 text-center">No online order data in selected range.</p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Channel &amp; Payment Split</h3>
          {payCounts.size > 0 ? (
            <DistributionMeters
              items={Array.from(payCounts.entries()).map(([label, count], idx) => ({
                label,
                count,
                color: ['#065F46', '#0f172a', '#d97706', '#0284c7'][idx % 4],
              }))}
            />
          ) : (
            <p className="text-xs text-slate-500 py-8 text-center">No sales recorded in selected range.</p>
          )}
        </div>
      </div>

      {/* Store Operating Expenses & Staff/Cashier Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Operating Expenses Ledger</h3>
            {!canUseFeature('advancedReports') && (
              <span className="text-[11px] font-semibold text-amber-700">
                Full COGS &amp; Profit export unlocks in Business/Pro
              </span>
            )}
          </div>

          {!isReadOnly && (
            <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <input
                type="text"
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                placeholder="Title (e.g. Monthly Rent)"
                className="px-3 py-2 border border-slate-200 rounded-lg"
              />
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as ShopExpense['category'])}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="rent">Shop Rent</option>
                <option value="utilities">Electricity &amp; Bills</option>
                <option value="salaries">Staff Salaries</option>
                <option value="packaging">Packaging</option>
                <option value="transport">Transport / Rider</option>
                <option value="marketing">Marketing</option>
                <option value="other">Misc Expense</option>
              </select>
              <input
                type="number"
                required
                min={1}
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="Amount PKR"
                className="px-3 py-2 border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                value={expNote}
                onChange={(e) => setExpNote(e.target.value)}
                placeholder="Note (optional)"
                className="px-3 py-2 border border-slate-200 rounded-lg"
              />
              <button
                type="submit"
                disabled={savingExp}
                className="px-3 py-2 bg-[#065F46] text-white rounded-lg font-bold flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>
          )}

          {filteredExpenses.length === 0 ? (
            <p className="text-slate-500 py-4 text-center">No expenses logged in this date range.</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {filteredExpenses.map((ex) => (
                <div key={ex.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{ex.title || ex.category}</p>
                    <p className="text-[11px] text-slate-500">
                      {ex.category} · {ex.date} {ex.notes ? `· ${ex.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-rose-700 tabular-nums">{formatPKR(ex.amount)}</span>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(ex.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold text-slate-900">Cashier / POS Staff Sales</h3>
          {cashierStats.length === 0 ? (
            <p className="text-slate-500 py-6 text-center">No POS counter sales in selected period.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {cashierStats.map((c, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{c.email}</p>
                    <p className="text-[11px] text-slate-500">{c.count} invoices</p>
                  </div>
                  <span className="font-extrabold text-[#065F46] tabular-nums">{formatPKR(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

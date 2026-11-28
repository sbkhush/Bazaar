import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Package,
  DollarSign,
  Plus,
  Settings,
  CreditCard,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Calculator,
  TrendingUp,
  QrCode,
} from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  getAllShopOrdersAdmin,
  getShopProductsAdmin,
  countActiveProducts,
} from '../services/tenantService';
import {
  getShopPosSales,
  getShopSuppliers,
  getShopPurchases,
} from '../services/retailService';
import { Order, Product, PosSale, Supplier, PurchaseInvoice } from '../types';
import { formatPKR } from '../data/seedData';
import { SimpleBarChart } from '../components/common/SimpleCharts';

export const ShopOverviewPage: React.FC = () => {
  const { shopId, shop, settings, plan, isReadOnly, canUseFeature } = useDashboard();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [posSales, setPosSales] = useState<PosSale[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    Promise.all([
      getAllShopOrdersAdmin(shopId).catch(() => []),
      getShopProductsAdmin(shopId).catch(() => []),
      getShopPosSales(shopId).catch(() => []),
      getShopSuppliers(shopId).catch(() => []),
      getShopPurchases(shopId).catch(() => []),
    ])
      .then(([ords, prods, sales, sups, purch]) => {
        setOrders(ords);
        setProducts(prods);
        setPosSales(sales);
        setSuppliers(sups);
        setPurchases(purch);
      })
      .finally(() => setLoading(false));
  }, [shopId]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center text-xs text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading shop metrics...
      </div>
    );
  }

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const validOrders = orders.filter((o) => o.orderStatus !== 'Cancelled');
  const validPos = posSales.filter((s) => s.status !== 'returned');

  const todayOnlineSales = validOrders
    .filter((o) => o.createdAt?.startsWith(todayPrefix))
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const todayPosRevenue = validPos
    .filter((s) => s.createdAt?.startsWith(todayPrefix))
    .reduce((sum, s) => sum + Number(s.total || 0), 0);
  const todayTotalSales = todayOnlineSales + todayPosRevenue;

  const totalRevenue =
    validOrders.reduce((s, o) => s + Number(o.total || 0), 0) +
    validPos.reduce((s, p) => s + Number(p.total || 0), 0);
  const pendingOrders = orders.filter((o) => o.orderStatus === 'Pending').length;

  const activeProducts = products.filter(
    (p) => p.status !== 'archived' && p.isPublished !== false
  );
  const activeCount = countActiveProducts(products);
  const lowStockProducts = activeProducts.filter(
    (p) => p.stock <= (p.minStockAlert ?? 5)
  );
  const totalPayables = suppliers.reduce(
    (sum, s) => sum + Math.max(0, Number(s.currentPayableBalance || 0)),
    0
  );

  // Top-selling products across online + POS
  const salesMap = new Map<string, { title: string; qty: number; revenue: number }>();
  validOrders.forEach((o) => {
    o.items.forEach((item) => {
      const prev = salesMap.get(item.productId) || {
        title: item.title,
        qty: 0,
        revenue: 0,
      };
      prev.qty += Number(item.quantity || 0);
      prev.revenue += Number(item.price || 0) * Number(item.quantity || 0);
      salesMap.set(item.productId, prev);
    });
  });
  validPos.forEach((s) => {
    s.items.forEach((item) => {
      const prev = salesMap.get(item.productId) || {
        title: item.title,
        qty: 0,
        revenue: 0,
      };
      prev.qty += Number(item.quantity || 0);
      prev.revenue += Number(item.lineTotal || 0);
      salesMap.set(item.productId, prev);
    });
  });
  const topSelling = Array.from(salesMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // 7-day combined sales revenue bar chart
  const salesChart = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayKey = d.toISOString().slice(0, 10);
    const onlineRev = validOrders
      .filter((o) => o.createdAt?.startsWith(dayKey))
      .reduce((s, o) => s + Number(o.total || 0), 0);
    const posRev = validPos
      .filter((s) => s.createdAt?.startsWith(dayKey))
      .reduce((s, p) => s + Number(p.total || 0), 0);
    return {
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      value: onlineRev + posRev,
    };
  });

  const usedStorageMB = Number(((shop?.usage?.storageBytes || 0) / (1024 * 1024)).toFixed(1));
  const isUnlimitedProducts = plan.maxProducts === -1;
  const prodPct = isUnlimitedProducts
    ? 12
    : Math.min(100, Math.round((activeCount / Math.max(1, plan.maxProducts)) * 100));
  const storPct = Math.min(100, Math.round((usedStorageMB / Math.max(1, plan.maxStorageMB)) * 100));

  const checklistSteps = [
    {
      label: 'Merchant store account created',
      done: true,
      to: '/dashboard/profile',
    },
    {
      label: 'Store logo & branding uploaded',
      done: Boolean(shop?.logoUrl || settings.logoUrl || shop?.onboardingChecklist?.logoUploaded),
      to: '/dashboard/appearance',
    },
    {
      label: 'Payment / Self-Pickup details configured',
      done: Boolean(
        settings.bankDetails?.iban ||
          settings.easypaisaDetails?.accountNumber ||
          settings.jazzcashDetails?.accountNumber ||
          settings.selfPickupDetails?.enabled
      ),
      to: '/dashboard/settings',
    },
    {
      label: 'First active product published',
      done: activeCount > 0,
      to: '/dashboard/products',
    },
  ];
  const completedSteps = checklistSteps.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Store Overview</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time storefront &amp; POS sales, low-stock alerts, quota usage, and setup progress.
          </p>
        </div>

        {!isReadOnly && (
          <div className="flex flex-wrap gap-2">
            {canUseFeature('pos') && (
              <Link
                to="/dashboard/pos"
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Calculator className="w-3.5 h-3.5" /> Open POS
              </Link>
            )}
            <Link
              to="/dashboard/products"
              className="px-4 py-2 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product
            </Link>
            <Link
              to="/dashboard/marketing"
              className="px-4 py-2 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-[#065F46] rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" /> Shop QR &amp; Poster
            </Link>
            <Link
              to="/dashboard/settings"
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" /> Payment &amp; Pickup
            </Link>
          </div>
        )}
      </div>

      {/* Interactive Onboarding Checklist */}
      {completedSteps < checklistSteps.length && (
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-emerald-950">
                Store Launch Checklist ({completedSteps}/{checklistSteps.length} Complete)
              </h3>
              <p className="text-[11px] text-emerald-800">
                Finish setting up your storefront so Pakistani shoppers can browse and place orders smoothly.
              </p>
            </div>
            {shop && (
              <Link
                to={`/s/${shop.slug}`}
                target="_blank"
                className="px-3.5 py-2 bg-white border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100/50"
              >
                Open Public Storefront <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            {checklistSteps.map((step, idx) => (
              <Link
                key={idx}
                to={step.to}
                className={`p-3 rounded-xl border flex items-center gap-2 transition ${
                  step.done
                    ? 'bg-white border-emerald-200 text-emerald-900'
                    : 'bg-white border-amber-200 hover:border-[#065F46] text-slate-800 font-semibold'
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-[#065F46] shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span className={step.done ? 'line-through opacity-75' : ''}>{step.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Today's Sales",
            value: formatPKR(todayTotalSales),
            sub: `Online ${formatPKR(todayOnlineSales)} · POS ${formatPKR(todayPosRevenue)}`,
            icon: TrendingUp,
          },
          {
            label: 'Total Revenue',
            value: formatPKR(totalRevenue),
            sub: `${validOrders.length} online · ${validPos.length} POS`,
            icon: DollarSign,
          },
          {
            label: 'Total Orders',
            value: orders.length,
            sub: `${pendingOrders} pending confirmation`,
            icon: ShoppingBag,
          },
          {
            label: 'Active Products',
            value: activeCount,
            sub: `${lowStockProducts.length} low stock alerts`,
            icon: Package,
          },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className="w-4 h-4 text-[#065F46]" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">{kpi.value}</p>
            <p className="text-[11px] text-slate-500">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Sales Chart & Plan Quotas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-1">7-Day Combined Revenue (PKR)</h3>
          <p className="text-[11px] text-slate-500 mb-4">Online storefront orders + POS counter billing</p>
          <SimpleBarChart data={salesChart} barColor="#065F46" valuePrefix="Rs. " />
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Plan Limits &amp; Usage</h3>
              <span className="text-xs font-bold text-[#065F46]">{plan.name}</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Active Products Used</span>
                <span className="font-bold tabular-nums">
                  {activeCount} / {isUnlimitedProducts ? 'Unlimited' : plan.maxProducts}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#065F46]" style={{ width: `${prodPct}%` }} />
              </div>
              {!isUnlimitedProducts && activeCount >= plan.maxProducts && (
                <p className="text-[11px] text-amber-700 font-semibold">
                  Limit reached — upgrade to publish more products.
                </p>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Cloud Storage Used</span>
                <span className="font-bold tabular-nums">{usedStorageMB} MB / {plan.maxStorageMB} MB</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-900" style={{ width: `${storPct}%` }} />
              </div>
            </div>

            {suppliers.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600">Supplier Payables Due</span>
                <span className="font-extrabold text-rose-700 tabular-nums">{formatPKR(totalPayables)}</span>
              </div>
            )}
          </div>

          <Link
            to="/dashboard/subscription"
            className="w-full py-2.5 border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" /> Upgrade or Renew Plan
          </Link>
        </div>
      </div>

      {/* Low Stock & Top Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Low-Stock Alerts
            </h3>
            <Link to="/dashboard/inventory" className="text-xs font-bold text-[#065F46] hover:underline">
              Adjust Stock
            </Link>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">All active products are healthy in stock.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {lowStockProducts.slice(0, 5).map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{p.title}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      SKU: {p.sku} · Alert threshold: {p.minStockAlert ?? 5}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold tabular-nums shrink-0 ${
                      p.stock <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {p.stock} {p.unit || 'pcs'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Top-Selling Products</h3>
            <Link to="/dashboard/reports" className="text-xs font-bold text-[#065F46] hover:underline">
              View Reports
            </Link>
          </div>
          {topSelling.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">Sales rankings appear after your first order or POS sale.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {topSelling.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{item.title}</p>
                    <p className="text-[11px] text-slate-500 tabular-nums">{item.qty} units sold</p>
                  </div>
                  <span className="font-extrabold text-[#065F46] tabular-nums shrink-0">
                    {formatPKR(item.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders & Recent Purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Recent Store Orders</h3>
            <Link to="/dashboard/orders" className="text-xs font-bold text-[#065F46] hover:underline">
              Manage All
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No orders placed in this shop yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {orders.slice(0, 5).map((o) => (
                <div key={o.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-900">
                      {o.orderNumber} — {o.customer.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {o.customer.city} · {o.paymentMethod.toUpperCase()} ({o.paymentStatus}) · {o.fulfillmentMethod === 'self_pickup' ? 'Self-Pickup' : 'Delivery'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-slate-900 tabular-nums">{formatPKR(o.total)}</p>
                    <span className="text-[11px] font-semibold text-[#065F46]">{o.orderStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Recent Supplier Purchases</h3>
            <Link to="/dashboard/purchases" className="text-xs font-bold text-[#065F46] hover:underline">
              Purchase Desk
            </Link>
          </div>
          {purchases.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No wholesaler purchase bills recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {purchases.slice(0, 5).map((pr) => (
                <div key={pr.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-900">
                      {pr.invoiceNumber} — {pr.supplierName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {pr.purchaseDate?.slice(0, 10)} · {pr.items.length} items
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-slate-900 tabular-nums">{formatPKR(pr.total)}</p>
                    <span className={`text-[11px] font-semibold ${pr.remainingPayable > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {pr.remainingPayable > 0 ? `Due ${formatPKR(pr.remainingPayable)}` : 'Paid'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

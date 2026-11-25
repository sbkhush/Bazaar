import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Loader2,
  CheckCircle2,
  PauseCircle,
  Trash2,
} from 'lucide-react';
import {
  getShopById,
  getSubscriptionPlans,
  getPaymentsByShop,
  updateShopStatus,
  assignShopSubscription,
  extendShopSubscription,
  deleteShopComplete,
  updateShopAdminNotes,
  auditShopCnicStatus,
  manageShopCnic,
} from '../services/platformService';
import {
  getShopProductsAdmin,
  getAllShopOrdersAdmin,
  getShopCustomers,
  getShopSettings,
  getShopStaff,
  getShopActivityLogs,
} from '../services/tenantService';
import {
  Shop,
  Product,
  Order,
  ShopCustomerSummary,
  StoreSettings,
  StaffMember,
  ShopInvite,
  ActivityLog,
  SubscriptionPlan,
  PlatformPayment,
} from '../types';
import { formatPKR, BUSINESS_TYPE_OPTIONS } from '../data/seedData';
import { formatCnicInput, isValidCnic } from '../utils/cnic';

const TABS = [
  'Overview',
  'Subscription',
  'Products',
  'Orders',
  'Customers',
  'Payment Settings',
  'Staff / Members',
  'Storage Usage',
  'Activity Logs',
  'Actions',
] as const;

export const SuperAdminShopDetailPage: React.FC = () => {
  const { shopId = '' } = useParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<Shop | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<ShopCustomerSummary[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [staffData, setStaffData] = useState<{ staff: StaffMember[]; invites: ShopInvite[] }>({
    staff: [],
    invites: [],
  });
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [payments, setPayments] = useState<PlatformPayment[]>([]);

  const [selectedPlanId, setSelectedPlanId] = useState('starter');
  const [freeComp, setFreeComp] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmDeleteSlug, setConfirmDeleteSlug] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [cnicInput, setCnicInput] = useState('');
  const [cnicReason, setCnicReason] = useState('');
  const [cnicBusy, setCnicBusy] = useState(false);
  const [cnicMsg, setCnicMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, pList, prods, ords, custs, stgs, stf, lg, pays] = await Promise.all([
        getShopById(shopId),
        getSubscriptionPlans(),
        getShopProductsAdmin(shopId).catch(() => []),
        getAllShopOrdersAdmin(shopId).catch(() => []),
        getShopCustomers(shopId).catch(() => []),
        getShopSettings(shopId),
        getShopStaff(shopId).catch(() => ({ staff: [], invites: [] })),
        getShopActivityLogs(shopId),
        getPaymentsByShop(shopId),
      ]);
      setShop(s);
      setPlans(pList);
      setProducts(prods);
      setOrders(ords);
      setCustomers(custs);
      setSettings(stgs);
      setStaffData(stf);
      setLogs(lg);
      setPayments(pays);
      if (s?.subscription?.planId) setSelectedPlanId(s.subscription.planId);
      setAdminNotes(s?.adminNotes || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shopId) loadAll();
  }, [shopId]);

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center text-xs text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading shop dossier...
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
        <p className="text-sm font-bold text-slate-900">Shop not found ({shopId})</p>
        <Link to="/super-admin/shops" className="text-xs font-bold text-[#065F46] hover:underline">
          Back to Shops Directory
        </Link>
      </div>
    );
  }

  const currentPlan = plans.find((p) => p.id === shop.subscription?.planId);
  const maxMB = currentPlan?.maxStorageMB || 50;
  const usedMB = Number(((shop.usage?.storageBytes || 0) / (1024 * 1024)).toFixed(2));
  const storagePct = Math.min(100, Math.round((usedMB / maxMB) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/super-admin/shops" className="p-2 border border-slate-200 bg-white rounded-xl hover:bg-slate-50">
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </Link>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{shop.name}</h2>
            <p className="text-xs text-slate-500 font-mono">
              /s/{shop.slug} · Owner: {shop.ownerEmail} · Status: {shop.status.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/dashboard?inspectShopId=${shop.id}`}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" /> Inspect Shop Dashboard (Read-Only)
          </Link>
          <Link
            to={`/s/${shop.slug}`}
            target="_blank"
            className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open Storefront
          </Link>
        </div>
      </div>

      {/* 10-Tab Bar */}
      <div className="flex overflow-x-auto gap-1.5 pb-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap transition ${
              tab === t
                ? 'bg-white border border-b-0 border-slate-200 text-[#065F46]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-xs">
        {tab === 'Overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Store Profile</h3>
                <div className="space-y-2 text-slate-700">
                  <p><strong>Shop ID:</strong> <span className="font-mono">{shop.id}</span></p>
                  <p><strong>Store Type:</strong> {BUSINESS_TYPE_OPTIONS.find((b) => b.value === (shop.businessType || 'general_store'))?.label || 'General Store'}</p>
                  <p><strong>Storefront URL:</strong> <span className="font-mono">/s/{shop.slug}</span></p>
                  <p><strong>Owner Name:</strong> {shop.ownerName}</p>
                  <p><strong>Owner Email:</strong> {shop.ownerEmail}</p>
                  <p><strong>Phone:</strong> {shop.ownerPhone}</p>
                  <p><strong>City / Address:</strong> {shop.city} — {shop.address}</p>
                  <p>
                    <strong>CNIC Verification:</strong>{' '}
                    <span className="font-mono">{shop.cnicMasked || 'Not Assigned'}</span>{' '}
                    <span
                      className={`ml-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        auditShopCnicStatus(shop) === 'verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : auditShopCnicStatus(shop) === 'released'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {auditShopCnicStatus(shop).replace('_', ' ')}
                    </span>
                  </p>
                  <p><strong>Registered:</strong> {new Date(shop.createdAt).toLocaleString()}</p>
                  <p><strong>Last Activity:</strong> {shop.lastActivityAt ? new Date(shop.lastActivityAt).toLocaleString() : 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 self-start">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500">Live Products</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{products.length}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500">Total Orders</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{orders.length}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500">Unique Customers</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{customers.length}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500">Gross Revenue</p>
                  <p className="text-lg font-extrabold text-[#065F46] mt-1 tabular-nums">
                    {formatPKR(orders.filter((o) => o.orderStatus !== 'Cancelled').reduce((s, o) => s + Number(o.total || 0), 0))}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">Internal Super Admin Notes</h4>
                {notesSaved && <span className="text-emerald-700 font-semibold">Saved</span>}
              </div>
              <textarea
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Private platform verification notes, manual payment remarks, or compliance history..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
              />
              <button
                type="button"
                disabled={savingNotes}
                onClick={async () => {
                  setSavingNotes(true);
                  setNotesSaved(false);
                  setActionError(null);
                  try {
                    await updateShopAdminNotes(shop.id, adminNotes);
                    setNotesSaved(true);
                  } catch (err: any) {
                    setActionError(err?.message || 'Failed to save internal notes.');
                  } finally {
                    setSavingNotes(false);
                  }
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold"
              >
                {savingNotes ? 'Saving Notes...' : 'Save Internal Notes'}
              </button>
              {actionError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {actionError}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'Subscription' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-slate-500">Current Plan</p>
                <p className="text-base font-extrabold text-slate-900 mt-1">{shop.subscription?.planName}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-slate-500">Subscription Status</p>
                <p className="text-base font-extrabold uppercase text-[#065F46] mt-1">{shop.subscription?.status}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-slate-500">Billing Cycle</p>
                <p className="text-base font-extrabold uppercase text-slate-900 mt-1">{shop.subscription?.billingCycle}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-slate-500">Expiry Date</p>
                <p className="text-base font-extrabold text-slate-900 mt-1">
                  {shop.subscription?.expiryDate ? new Date(shop.subscription.expiryDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl space-y-3">
              <h4 className="font-bold text-slate-900">Change / Assign Subscription Plan</h4>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (Rs. {p.monthlyPrice}/mo)</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 font-semibold">
                  <input type="checkbox" checked={freeComp} onChange={(e) => setFreeComp(e.target.checked)} />
                  Free Comp Override
                </label>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={async () => {
                    setActionBusy(true);
                    setActionError(null);
                    try {
                      await assignShopSubscription(shop.id, { planId: selectedPlanId, billingCycle: 'monthly', isFreeOverride: freeComp });
                      await loadAll();
                    } catch (err: any) {
                      setActionError(err?.message || 'Failed to assign subscription plan.');
                    } finally {
                      setActionBusy(false);
                    }
                  }}
                  className="px-4 py-2 bg-[#065F46] text-white rounded-lg font-bold disabled:opacity-50"
                >
                  Apply Plan (30d)
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={async () => {
                    setActionBusy(true);
                    setActionError(null);
                    try {
                      await extendShopSubscription(shop.id, 30);
                      await loadAll();
                    } catch (err: any) {
                      setActionError(err?.message || 'Failed to extend subscription.');
                    } finally {
                      setActionBusy(false);
                    }
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  Extend +30 Days
                </button>
              </div>
              {actionError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {actionError}
                </div>
              )}
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-2">Subscription Payment History ({payments.length})</h4>
              {payments.length === 0 ? (
                <p className="text-slate-500">No subscription payment proofs submitted by this store.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {payments.map((p) => (
                    <div key={p.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold">{p.planName} ({p.billingCycle}) — {formatPKR(p.amount)}</p>
                        <p className="text-[11px] text-slate-500">TID: {p.transactionId} · {p.method.toUpperCase()}</p>
                      </div>
                      <span className="font-bold uppercase">{p.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'Products' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Catalog Products ({products.length})</h3>
            {products.length === 0 ? (
              <p className="text-slate-500">No products created yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {products.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{p.title}</p>
                      <p className="text-[11px] text-slate-500">{p.category} · SKU: {p.sku} · Stock: {p.stock}</p>
                    </div>
                    <p className="font-bold tabular-nums">{formatPKR(p.salePrice ?? p.regularPrice)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Orders' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Recent Orders ({orders.length})</h3>
            {orders.length === 0 ? (
              <p className="text-slate-500">No orders placed yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <div key={o.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{o.orderNumber} — {o.customer.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {o.customer.city} · {o.paymentMethod.toUpperCase()} ({o.paymentStatus}) · {o.orderStatus}
                      </p>
                    </div>
                    <p className="font-bold tabular-nums">{formatPKR(o.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Customers' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Store Customers ({customers.length})</h3>
            {customers.length === 0 ? (
              <p className="text-slate-500">No customer records yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-500">{c.phone} · {c.city}</p>
                    </div>
                    <p className="font-bold tabular-nums">{c.ordersCount} orders · {formatPKR(c.totalSpent)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Payment Settings' && settings && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 border border-slate-200 rounded-xl space-y-1">
              <h4 className="font-bold text-slate-900">EasyPaisa &amp; JazzCash</h4>
              <p>EasyPaisa ({settings.easypaisaDetails.enabled ? 'Enabled' : 'Disabled'}): {settings.easypaisaDetails.accountNumber} ({settings.easypaisaDetails.accountTitle})</p>
              <p>JazzCash ({settings.jazzcashDetails.enabled ? 'Enabled' : 'Disabled'}): {settings.jazzcashDetails.accountNumber} ({settings.jazzcashDetails.accountTitle})</p>
            </div>
            <div className="p-4 border border-slate-200 rounded-xl space-y-1">
              <h4 className="font-bold text-slate-900">Bank Transfer &amp; Self-Pickup</h4>
              <p>Bank: {settings.bankDetails.bankName} — {settings.bankDetails.accountNumber}</p>
              <p>IBAN: {settings.bankDetails.iban}</p>
              <p>Self-Pickup ({settings.selfPickupDetails.enabled ? 'Enabled' : 'Disabled'}): {settings.selfPickupDetails.address}</p>
            </div>
          </div>
        )}

        {tab === 'Staff / Members' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Active Team Members ({staffData.staff.length})</h3>
            <div className="divide-y divide-slate-100">
              {staffData.staff.map((st) => (
                <div key={st.uid} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{st.name}</p>
                    <p className="text-[11px] text-slate-500">{st.email}</p>
                  </div>
                  <span className="font-bold uppercase text-[#065F46]">{st.role}</span>
                </div>
              ))}
            </div>
            {staffData.invites.length > 0 && (
              <div className="pt-2">
                <h4 className="font-bold text-slate-700 mb-1">Pending Invites ({staffData.invites.length})</h4>
                {staffData.invites.map((inv) => (
                  <p key={inv.id} className="text-slate-600">{inv.email} — {inv.role}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Storage Usage' && (
          <div className="space-y-3 max-w-md">
            <h3 className="text-sm font-bold text-slate-900">Cloud Storage Quota</h3>
            <p className="text-slate-600 tabular-nums">
              Used <strong>{usedMB} MB</strong> of <strong>{maxMB} MB</strong> ({storagePct}%)
            </p>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#065F46]" style={{ width: `${storagePct}%` }} />
            </div>
          </div>
        )}

        {tab === 'Activity Logs' && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900">Recent Shop Audit Logs ({logs.length})</h3>
            {logs.length === 0 ? (
              <p className="text-slate-500">No logged admin actions yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <div key={l.id} className="py-2 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-bold text-slate-900">{l.action}</span> —{' '}
                      <span className="text-slate-600">{l.details}</span>
                      <p className="text-[11px] text-slate-400">{l.actorEmail}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Actions' && (
          <div className="space-y-6">
            {actionError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {actionError}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={actionBusy}
                onClick={async () => {
                  setActionBusy(true);
                  setActionError(null);
                  try {
                    await updateShopStatus(shop.id, 'active');
                    await loadAll();
                  } catch (err: any) {
                    setActionError(err?.message || 'Failed to activate shop.');
                  } finally {
                    setActionBusy(false);
                  }
                }}
                className="px-4 py-2.5 bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Activate / Reactivate Shop
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={async () => {
                  setActionBusy(true);
                  setActionError(null);
                  try {
                    await updateShopStatus(shop.id, 'suspended');
                    await loadAll();
                  } catch (err: any) {
                    setActionError(err?.message || 'Failed to suspend shop.');
                  } finally {
                    setActionBusy(false);
                  }
                }}
                className="px-4 py-2.5 bg-amber-600 text-white rounded-xl font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <PauseCircle className="w-4 h-4" /> Suspend Shop
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={async () => {
                  setActionBusy(true);
                  setActionError(null);
                  try {
                    await updateShopStatus(shop.id, 'inactive');
                    await loadAll();
                  } catch (err: any) {
                    setActionError(err?.message || 'Failed to update shop status.');
                  } finally {
                    setActionBusy(false);
                  }
                }}
                className="px-4 py-2.5 border border-slate-300 text-slate-800 rounded-xl font-bold disabled:opacity-50"
              >
                Set Inactive
              </button>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold flex items-center gap-1.5 ml-auto"
              >
                <Trash2 className="w-4 h-4" /> Delete Shop
              </button>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    CNIC Verification &amp; Global Ownership Lock (Super Admin Only)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Assign or correct a merchant CNIC using server-side HMAC hashing, or release the CNIC binding when closing/re-auditing a store.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-mono text-[11px] font-semibold text-slate-800">
                  Current: {shop.cnicMasked || 'Unverified'} ({auditShopCnicStatus(shop).replace('_', ' ')})
                </span>
              </div>

              {cnicMsg && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium ${
                    cnicMsg.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-700'
                  }`}
                >
                  {cnicMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assign / Correct CNIC (13 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    inputMode="numeric"
                    value={cnicInput}
                    onChange={(e) => setCnicInput(formatCnicInput(e.target.value))}
                    placeholder="35202-1234567-1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Audit Reason / Remarks
                  </label>
                  <input
                    type="text"
                    value={cnicReason}
                    onChange={(e) => setCnicReason(e.target.value)}
                    placeholder="e.g. Verified original CNIC via compliance check"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={cnicBusy}
                  onClick={async () => {
                    setCnicMsg(null);
                    if (!isValidCnic(cnicInput)) {
                      setCnicMsg({ type: 'error', text: 'Please enter a valid 13-digit CNIC before assigning.' });
                      return;
                    }
                    setCnicBusy(true);
                    try {
                      await manageShopCnic({
                        shopId: shop.id,
                        action: 'assign',
                        cnic: cnicInput,
                        reason: cnicReason.trim() || undefined,
                      });
                      setCnicInput('');
                      setCnicReason('');
                      setCnicMsg({ type: 'success', text: 'CNIC verified and bound to this shop securely.' });
                      await loadAll();
                    } catch (err: any) {
                      setCnicMsg({ type: 'error', text: err?.message || 'Could not assign CNIC.' });
                    } finally {
                      setCnicBusy(false);
                    }
                  }}
                  className="px-4 py-2 bg-[#065F46] hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg font-bold"
                >
                  {cnicBusy ? 'Processing...' : 'Assign & Verify CNIC'}
                </button>

                {shop.cnicHash && (
                  <button
                    type="button"
                    disabled={cnicBusy}
                    onClick={async () => {
                      setCnicMsg(null);
                      setCnicBusy(true);
                      try {
                        await manageShopCnic({
                          shopId: shop.id,
                          action: 'release',
                          reason: cnicReason.trim() || 'Super Admin released CNIC binding',
                        });
                        setCnicReason('');
                        setCnicMsg({ type: 'success', text: 'CNIC binding released from global registry.' });
                        await loadAll();
                      } catch (err: any) {
                        setCnicMsg({ type: 'error', text: err?.message || 'Could not release CNIC binding.' });
                      } finally {
                        setCnicBusy(false);
                      }
                    }}
                    className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50 rounded-lg font-bold"
                  >
                    Release CNIC Binding
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-red-700">Delete Shop Permanently</h3>
            <p className="text-xs text-slate-600">
              Permanently remove <strong>{shop.name}</strong> and all products, orders, settings, and slug reservation. Type{' '}
              <code className="font-mono font-bold text-slate-900">{shop.slug}</code> to confirm.
            </p>
            <input
              type="text"
              value={confirmDeleteSlug}
              onChange={(e) => setConfirmDeleteSlug(e.target.value)}
              placeholder={shop.slug}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setConfirmDeleteSlug('');
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting || confirmDeleteSlug !== shop.slug}
                onClick={async () => {
                  setDeleting(true);
                  setActionError(null);
                  try {
                    await deleteShopComplete(shop.id);
                    navigate('/super-admin/shops');
                  } catch (err: any) {
                    setActionError(err?.message || 'Failed to delete shop completely.');
                    setDeleteModalOpen(false);
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

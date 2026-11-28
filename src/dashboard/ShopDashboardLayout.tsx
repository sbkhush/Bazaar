import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, Link, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Grid,
  ShoppingCart,
  Users,
  Boxes,
  Ticket,
  Image as ImageIcon,
  Palette,
  Settings,
  UserCog,
  BarChart3,
  CreditCard,
  UserCircle,
  ExternalLink,
  LogOut,
  Menu,
  X,
  Eye,
  AlertTriangle,
  Store,
  Loader2,
  Bell,
  Calculator,
  Truck,
  BookOpen,
  Receipt,
  Lock,
  QrCode,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardProvider, useDashboard } from './DashboardContext';
import { StaffPermission, NotificationItem, PlanFeatures } from '../types';
import { getShopNotifications, markNotificationRead } from '../services/tenantService';

const DashboardShell: React.FC = () => {
  const {
    currentUser,
    loading: authLoading,
    shopMemberships,
    setActiveShopId,
    isSuperAdmin,
    authorizedRole,
    authorizedHomePath,
    logout,
  } = useAuth();
  const {
    shopId,
    shop,
    loading: dashLoading,
    isReadOnly,
    isSuspended,
    isExpired,
    hasPermission,
    canUseFeature,
  } = useDashboard();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (shopId) {
      getShopNotifications(shopId).then(setNotifications).catch(() => {});
    }
  }, [shopId]);

  if (authLoading || dashLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 gap-2 text-xs text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
        Loading Shop Workspace...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <Store className="w-10 h-10 text-[#065F46] mx-auto" />
          <h1 className="text-xl font-extrabold text-slate-900">Sign In to Manage Your Store</h1>
          <p className="text-xs text-slate-600">
            Log in with your merchant owner or staff account to access your store dashboard.
          </p>
          <div className="flex gap-2.5 pt-2">
            <Link to="/login" className="flex-1 py-2.5 bg-[#065F46] text-white rounded-xl text-xs font-bold">
              Merchant Login
            </Link>
            <Link to="/register" className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold">
              Open New Store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!shop && shopMemberships.length === 0 && !isSuperAdmin) {
    if (['sales_manager', 'salesman', 'referral_agent'].includes(authorizedRole)) {
      return <Navigate to={authorizedHomePath} replace />;
    }
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <Store className="w-10 h-10 text-[#065F46] mx-auto" />
          <h1 className="text-xl font-extrabold text-slate-900">No Store Associated Yet</h1>
          <p className="text-xs text-slate-600">
            Signed in as <strong>{currentUser.email}</strong>. Launch your own online general store in 60 seconds.
          </p>
          <div className="flex gap-2.5 pt-2">
            <Link to="/register" className="flex-1 py-2.5 bg-[#065F46] text-white rounded-xl text-xs font-bold">
              Create Your Store
            </Link>
            <Link to="/" className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold">
              Platform Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navItems: {
    to: string;
    label: string;
    icon: any;
    perm: StaffPermission;
    feature?: keyof PlanFeatures;
    end?: boolean;
  }[] = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, perm: 'overview', end: true },
    { to: '/dashboard/pos', label: 'POS & Billing', icon: Calculator, perm: 'pos', feature: 'pos' },
    { to: '/dashboard/products', label: 'Products', icon: Package, perm: 'products' },
    { to: '/dashboard/categories', label: 'Categories', icon: Grid, perm: 'categories' },
    { to: '/dashboard/orders', label: 'Orders & Invoices', icon: ShoppingCart, perm: 'orders' },
    { to: '/dashboard/purchases', label: 'Purchases', icon: Receipt, perm: 'purchases', feature: 'suppliersPurchases' },
    { to: '/dashboard/suppliers', label: 'Suppliers', icon: Truck, perm: 'suppliers', feature: 'suppliersPurchases' },
    { to: '/dashboard/customers', label: 'Customers', icon: Users, perm: 'customers' },
    { to: '/dashboard/khata', label: 'Customer Khata', icon: BookOpen, perm: 'khata', feature: 'khata' },
    { to: '/dashboard/inventory', label: 'Inventory', icon: Boxes, perm: 'inventory' },
    { to: '/dashboard/coupons', label: 'Coupons', icon: Ticket, perm: 'coupons' },
    { to: '/dashboard/banners', label: 'Banners', icon: ImageIcon, perm: 'banners' },
    { to: '/dashboard/marketing', label: 'Shop QR & Marketing', icon: QrCode, perm: 'overview' },
    { to: '/dashboard/appearance', label: 'Appearance & Pages', icon: Palette, perm: 'appearance' },
    { to: '/dashboard/settings', label: 'Payments & Self-Pickup', icon: Settings, perm: 'settings' },
    { to: '/dashboard/staff', label: 'Staff & Roles', icon: UserCog, perm: 'staff' },
    { to: '/dashboard/reports', label: 'Reports & Profit', icon: BarChart3, perm: 'reports' },
    { to: '/dashboard/subscription', label: 'Subscription Plan', icon: CreditCard, perm: 'subscription' },
    { to: '/dashboard/profile', label: 'Support, Logs & Profile', icon: UserCircle, perm: 'overview' },
  ];

  const visibleNav = navItems.filter((item) => hasPermission(item.perm));
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const querySuffix = isReadOnly && shopId ? `?inspectShopId=${encodeURIComponent(shopId)}` : '';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {shop?.logoUrl ? (
              <img src={shop.logoUrl} alt={shop.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#065F46] text-white flex items-center justify-center font-extrabold text-sm shrink-0">
                {(shop?.name || 'S').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900 truncate">{shop?.name || 'Shop Admin'}</p>
              <p className="text-[10px] font-mono text-slate-500 truncate">/s/{shop?.slug || shopId}</p>
            </div>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Multi-shop Switcher */}
        {shopMemberships.length > 1 && !isReadOnly && (
          <div className="px-3 pt-3">
            <select
              value={shopId}
              onChange={(e) => {
                setActiveShopId(e.target.value);
                navigate('/dashboard');
              }}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50"
            >
              {shopMemberships.map((m) => (
                <option key={m.shopId} value={m.shopId}>
                  {m.shopName} ({m.role})
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map((item) => {
            const locked = item.feature ? !canUseFeature(item.feature) : false;
            return (
              <NavLink
                key={item.to}
                to={`${item.to}${querySuffix}`}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-[#065F46] text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {locked && <Lock className="w-3 h-3 shrink-0 opacity-60" />}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 space-y-1.5 text-xs">
          {shop && (
            <Link
              to={`/s/${shop.slug}`}
              target="_blank"
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800"
            >
              <span>View Public Storefront</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
          {isSuperAdmin && (
            <Link
              to="/super-admin"
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
            >
              <span>Super Admin Portal</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => logout().then(() => navigate('/login'))}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {isReadOnly && (
          <div className="bg-slate-900 text-white px-4 py-2 text-xs flex items-center justify-between gap-2 no-print">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <span>
                <strong>Super Admin Inspection Mode (Read-Only)</strong> — Inspecting{' '}
                <code className="font-mono">{shop?.name}</code>
              </span>
            </div>
            <Link to={`/super-admin/shops/${shopId}`} className="underline font-bold">
              Return to Shop Dossier
            </Link>
          </div>
        )}

        {(isSuspended || isExpired) && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2 no-print">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                {isSuspended
                  ? 'Your storefront is currently suspended or inactive. Public shoppers see a maintenance notice.'
                  : 'Your subscription has expired. Renew your plan to keep publishing products seamlessly.'}
              </span>
            </div>
            <Link to="/dashboard/subscription" className="px-3 py-1 bg-amber-900 text-white rounded-lg font-bold">
              Manage Subscription
            </Link>
          </div>
        )}

        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900">
                {shop?.name || 'Merchant Dashboard'}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Plan: <strong>{shop?.subscription?.planName || 'Starter'}</strong> · Status:{' '}
                <span className="uppercase font-semibold">{shop?.subscription?.status || 'active'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
              title="Store Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-2xl shadow-lg p-3 z-50 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-900">Store Notifications</span>
                  <button type="button" onClick={() => setNotifOpen(false)} className="text-[11px] text-slate-500">
                    Close
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No notifications yet.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {notifications.slice(0, 8).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markNotificationRead(shopId, n.id);
                          setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
                          if (n.link) navigate(n.link);
                          setNotifOpen(false);
                        }}
                        className={`p-2 cursor-pointer rounded-lg text-xs hover:bg-slate-50 ${
                          n.isRead ? 'opacity-65' : 'bg-emerald-50/40'
                        }`}
                      >
                        <p className="font-bold text-slate-900">{n.title}</p>
                        <p className="text-[11px] text-slate-600">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const ShopDashboardLayout: React.FC = () => (
  <DashboardProvider>
    <DashboardShell />
  </DashboardProvider>
);

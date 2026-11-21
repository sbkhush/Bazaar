import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  Link,
  Navigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import { getRouterBasename } from './utils/tenantDomain';
import { Store, ShieldAlert, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ToastProvider } from './components/common/Toast';

// Layer 1: SaaS Platform Marketing & Auth
import { PlatformLandingPage } from './platform/PlatformLandingPage';
import { RegisterShopPage } from './platform/RegisterShopPage';
import { LoginPage } from './platform/LoginPage';
import { ReferralRedirectPage } from './platform/ReferralRedirectPage';

// Layer 2: Super Admin Portal
import { SuperAdminLayout } from './superadmin/SuperAdminLayout';
import { SuperAdminDashboardPage } from './superadmin/SuperAdminDashboardPage';
import { SuperAdminShopsPage } from './superadmin/SuperAdminShopsPage';
import { SuperAdminShopDetailPage } from './superadmin/SuperAdminShopDetailPage';
import { SuperAdminPlansPage } from './superadmin/SuperAdminPlansPage';
import { SuperAdminPaymentsPage } from './superadmin/SuperAdminPaymentsPage';
import { SuperAdminAnalyticsPage } from './superadmin/SuperAdminAnalyticsPage';
import { SuperAdminSupportPage } from './superadmin/SuperAdminSupportPage';
import { SuperAdminAuditLogsPage } from './superadmin/SuperAdminAuditLogsPage';
import { SuperAdminSettingsPage } from './superadmin/SuperAdminSettingsPage';
import { SalesOverviewPage } from './superadmin/sales/SalesOverviewPage';
import { SalesPortalAccessPage } from './superadmin/sales/SalesPortalAccessPage';
import { SalesMembersPage } from './superadmin/sales/SalesMembersPage';
import { SalesMemberDetailPage } from './superadmin/sales/SalesMemberDetailPage';
import { SalesTeamsPage } from './superadmin/sales/SalesTeamsPage';
import { SalesLeadsPage } from './superadmin/sales/SalesLeadsPage';
import { SalesRegistrationsPage } from './superadmin/sales/SalesRegistrationsPage';
import { SalesReferralsPage } from './superadmin/sales/SalesReferralsPage';
import { SalesTargetsPage } from './superadmin/sales/SalesTargetsPage';
import { SalesCommissionsPage } from './superadmin/sales/SalesCommissionsPage';
import { SalesPayoutsPage } from './superadmin/sales/SalesPayoutsPage';
import { SalesQrCodesPage } from './superadmin/sales/SalesQrCodesPage';
import { SalesReportsPage } from './superadmin/sales/SalesReportsPage';
import { SalesActivityLogsPage } from './superadmin/sales/SalesActivityLogsPage';
import { SalesSettingsPage } from './superadmin/sales/SalesSettingsPage';

// Layer 2B: Individual Salesman Portal
import { SalesmanLoginPage } from './salesman/SalesmanLoginPage';
import { SalesmanLayout } from './salesman/SalesmanLayout';
import { SalesmanDashboardPage } from './salesman/SalesmanDashboardPage';

// Layer 3: Merchant Shop Dashboard
import { ShopDashboardLayout } from './dashboard/ShopDashboardLayout';
import { ShopOverviewPage } from './dashboard/ShopOverviewPage';
import { ShopProductsPage } from './dashboard/ShopProductsPage';
import { ShopCategoriesPage } from './dashboard/ShopCategoriesPage';
import { ShopOrdersPage } from './dashboard/ShopOrdersPage';
import { ShopCustomersPage } from './dashboard/ShopCustomersPage';
import { ShopInventoryPage } from './dashboard/ShopInventoryPage';
import { ShopPosPage } from './dashboard/ShopPosPage';
import { ShopPurchasesPage } from './dashboard/ShopPurchasesPage';
import { ShopSuppliersPage } from './dashboard/ShopSuppliersPage';
import { ShopKhataPage } from './dashboard/ShopKhataPage';
import { ShopCouponsPage } from './dashboard/ShopCouponsPage';
import { ShopBannersPage } from './dashboard/ShopBannersPage';
import { ShopAppearancePage } from './dashboard/ShopAppearancePage';
import { ShopSettingsPage } from './dashboard/ShopSettingsPage';
import { ShopStaffPage } from './dashboard/ShopStaffPage';
import { ShopReportsPage } from './dashboard/ShopReportsPage';
import { ShopSubscriptionPage } from './dashboard/ShopSubscriptionPage';
import { ShopProfilePage } from './dashboard/ShopProfilePage';

// Layer 4: Multi-Tenant Storefront Components & Pages
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { CartDrawer } from './components/common/CartDrawer';
import { WhatsAppButton } from './components/common/WhatsAppButton';
import { DynamicSeoHead } from './components/common/DynamicSeoHead';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { AccountPage } from './pages/AccountPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { ContactPage } from './pages/ContactPage';
import {
  AboutPage,
  FAQPage,
  ReturnPolicyPage,
  TermsPage,
  PrivacyPage,
} from './pages/PolicyPages';
import { DEFAULT_SHOP_ID } from './data/seedData';

const StorefrontLayout: React.FC = () => {
  const { loading, notFound, isSuspended, shopSlug, shop, settings, storeBasePath } = useTenant();
  const { pathname } = useLocation();
  const hasChildSeo =
    pathname.includes('/product/') ||
    pathname.endsWith('/shop') ||
    /\/(about|faq|return-policy|terms|privacy)$/.test(pathname);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3 p-6">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
        <p className="text-xs font-medium text-slate-500">Loading storefront...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-200/70 text-slate-600 flex items-center justify-center">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Storefront Not Found</h1>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
          No active store was found at <span className="font-mono text-slate-700">/s/{shopSlug}</span>. Verify the store URL or launch your own store on BazaarPK Cloud.
        </p>
        <div className="flex flex-wrap gap-3 pt-2 justify-center">
          <Link
            to={`/s/${DEFAULT_SHOP_ID}`}
            className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            Visit Flagship Store <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Back to Platform Home
          </Link>
        </div>
      </div>
    );
  }

  if (isSuspended) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Store Temporarily Unavailable</h1>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
          <strong>{settings.siteName}</strong> is currently paused by the store owner or platform administration. If you own this store, sign in to your workspace to review status or billing.
        </p>
        <div className="flex flex-wrap gap-3 pt-2 justify-center">
          <Link
            to="/login"
            className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition"
          >
            Merchant Sign In
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Platform Home
          </Link>
        </div>
      </div>
    );
  }

  // Fallback check if storeBasePath has unknown child route rendered via Outlet
  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-emerald-600 selection:text-white"
      data-store-path={storeBasePath}
    >
      {!hasChildSeo && <DynamicSeoHead shop={shop} settings={settings} />}
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <CartDrawer />
      <WhatsAppButton />
      <Footer />
    </div>
  );
};

const TenantRouteWrapper: React.FC = () => {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  return (
    <TenantProvider slug={shopSlug || DEFAULT_SHOP_ID}>
      <CartProvider>
        <WishlistProvider>
          <StorefrontLayout />
        </WishlistProvider>
      </CartProvider>
    </TenantProvider>
  );
};

const StoreNotFoundPage: React.FC = () => {
  const { storeBasePath, settings } = useTenant();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-20 h-20 bg-emerald-50 text-emerald-800 rounded-3xl flex items-center justify-center font-black text-3xl">
        404
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Page Not Found</h1>
      <p className="text-xs text-slate-500 max-w-sm">
        The link you followed inside {settings.siteName} may be broken or moved.
      </p>
      <Link
        to={storeBasePath}
        className="px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition shadow-sm"
      >
        Return to {settings.siteName} Home
      </Link>
    </div>
  );
};

const LegacyProductRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/s/${DEFAULT_SHOP_ID}/product/${id || ''}`} replace />;
};

const LegacyOrderSuccessRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/s/${DEFAULT_SHOP_ID}/order-success/${id || ''}`} replace />;
};

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unexpected rendering error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-slate-900">Something went wrong</h1>
          <p className="text-xs text-slate-500 max-w-md">{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const basename = getRouterBasename();

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter basename={basename}>
            <Routes>
              {/* Layer 1: SaaS Platform Marketing & Auth */}
              <Route path="/" element={<PlatformLandingPage />} />
              <Route path="/register" element={<RegisterShopPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/r/:refCode" element={<ReferralRedirectPage />} />

              {/* Layer 2B: Individual Salesman Portal */}
              <Route path="/salesman/login" element={<SalesmanLoginPage />} />
              <Route path="/salesman" element={<SalesmanLayout />}>
                <Route index element={<SalesmanDashboardPage />} />
                <Route path="leads" element={<SalesmanDashboardPage />} />
                <Route path="referrals" element={<SalesmanDashboardPage />} />
                <Route path="targets" element={<SalesmanDashboardPage />} />
                <Route path="commissions" element={<SalesmanDashboardPage />} />
                <Route path="payouts" element={<SalesmanDashboardPage />} />
                <Route path="activities" element={<SalesmanDashboardPage />} />
                <Route path="qr" element={<SalesmanDashboardPage />} />
                <Route path="notifications" element={<SalesmanDashboardPage />} />
                <Route path="team" element={<SalesmanDashboardPage />} />
              </Route>

              {/* Layer 2: Super Admin Portal */}
              <Route path="/super-admin" element={<SuperAdminLayout />}>
                <Route index element={<SuperAdminDashboardPage />} />
                <Route path="shops" element={<SuperAdminShopsPage />} />
                <Route path="shops/:shopId" element={<SuperAdminShopDetailPage />} />
                <Route path="plans" element={<SuperAdminPlansPage />} />
                <Route path="payments" element={<SuperAdminPaymentsPage />} />
                <Route path="analytics" element={<SuperAdminAnalyticsPage />} />
                <Route path="support" element={<SuperAdminSupportPage />} />
                <Route path="audit-logs" element={<SuperAdminAuditLogsPage />} />
                <Route path="settings" element={<SuperAdminSettingsPage />} />
                <Route path="sales" element={<SalesOverviewPage />} />
                <Route path="sales/portal" element={<SalesPortalAccessPage />} />
                <Route path="sales/members" element={<SalesMembersPage />} />
                <Route path="sales/members/new" element={<SalesMembersPage defaultCreateOpen />} />
                <Route path="sales/members/:memberId" element={<SalesMemberDetailPage />} />
                <Route path="sales/teams" element={<SalesTeamsPage />} />
                <Route path="sales/leads" element={<SalesLeadsPage />} />
                <Route path="sales/registrations" element={<SalesRegistrationsPage />} />
                <Route path="sales/referrals" element={<SalesReferralsPage />} />
                <Route path="sales/targets" element={<SalesTargetsPage />} />
                <Route path="sales/commissions" element={<SalesCommissionsPage />} />
                <Route path="sales/payouts" element={<SalesPayoutsPage />} />
                <Route path="sales/qr-codes" element={<SalesQrCodesPage />} />
                <Route path="sales/reports" element={<SalesReportsPage />} />
                <Route path="sales/activity-logs" element={<SalesActivityLogsPage />} />
                <Route path="sales/settings" element={<SalesSettingsPage />} />
              </Route>

              {/* Layer 3: Shop Admin Management Portal */}
              <Route path="/dashboard" element={<ShopDashboardLayout />}>
                <Route index element={<ShopOverviewPage />} />
                <Route path="pos" element={<ShopPosPage />} />
                <Route path="products" element={<ShopProductsPage />} />
                <Route path="categories" element={<ShopCategoriesPage />} />
                <Route path="orders" element={<ShopOrdersPage />} />
                <Route path="customers" element={<ShopCustomersPage />} />
                <Route path="khata" element={<ShopKhataPage />} />
                <Route path="inventory" element={<ShopInventoryPage />} />
                <Route path="purchases" element={<ShopPurchasesPage />} />
                <Route path="suppliers" element={<ShopSuppliersPage />} />
                <Route path="coupons" element={<ShopCouponsPage />} />
                <Route path="banners" element={<ShopBannersPage />} />
                <Route path="appearance" element={<ShopAppearancePage />} />
                <Route path="settings" element={<ShopSettingsPage />} />
                <Route path="staff" element={<ShopStaffPage />} />
                <Route path="reports" element={<ShopReportsPage />} />
                <Route path="subscription" element={<ShopSubscriptionPage />} />
                <Route path="profile" element={<ShopProfilePage />} />
              </Route>

              {/* Layer 4: Multi-Tenant Public Storefronts */}
              <Route path="/s/:shopSlug" element={<TenantRouteWrapper />}>
                <Route index element={<HomePage />} />
                <Route path="shop" element={<ShopPage />} />
                <Route path="product/:id" element={<ProductDetailPage />} />
                <Route path="cart" element={<CartPage />} />
                <Route path="checkout" element={<CheckoutPage />} />
                <Route path="order-success/:id" element={<OrderSuccessPage />} />
                <Route path="account" element={<AccountPage />} />
                <Route path="tracking" element={<OrderTrackingPage />} />
                <Route path="contact" element={<ContactPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="faq" element={<FAQPage />} />
                <Route path="return-policy" element={<ReturnPolicyPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="*" element={<StoreNotFoundPage />} />
              </Route>

              {/* Legacy Flagship BazaarPK Route Redirects */}
              <Route path="/shop" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/shop`} replace />} />
              <Route path="/product/:id" element={<LegacyProductRedirect />} />
              <Route path="/cart" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/cart`} replace />} />
              <Route path="/checkout" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/checkout`} replace />} />
              <Route path="/order-success/:id" element={<LegacyOrderSuccessRedirect />} />
              <Route path="/account" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/account`} replace />} />
              <Route path="/tracking" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/tracking`} replace />} />
              <Route path="/contact" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/contact`} replace />} />
              <Route path="/about" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/about`} replace />} />
              <Route path="/faq" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/faq`} replace />} />
              <Route path="/return-policy" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/return-policy`} replace />} />
              <Route path="/terms" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/terms`} replace />} />
              <Route path="/privacy" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/privacy`} replace />} />
              <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
              <Route path="/admin" element={<Navigate to="/dashboard" replace />} />

              {/* Platform-wide Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

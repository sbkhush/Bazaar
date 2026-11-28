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

// Layer 1: Critical Public Shell & Primary Landing/Storefront Home
import { PlatformLandingPage } from './platform/PlatformLandingPage';
import { HomePage } from './pages/HomePage';
import { PWAStatusBanner } from './components/common/PWAStatusBanner';
import { BRAND } from './config/brand';

// Layer 4: Critical Storefront Chrome
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { CartDrawer } from './components/common/CartDrawer';
import { WhatsAppButton } from './components/common/WhatsAppButton';
import { DynamicSeoHead } from './components/common/DynamicSeoHead';
import { DEFAULT_SHOP_ID } from './data/seedData';
import { getIndustryGroup, getIndustryMeta } from './config/industryConfig';

function lazyNamed<T extends React.ComponentType<any>>(
  loader: () => Promise<Record<string, unknown>>,
  exportName: string
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    loader().then((mod) => ({ default: mod[exportName] as T }))
  );
}

const RouteLoader: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div
    className={`${
      compact ? 'min-h-[55vh]' : 'min-h-screen'
    } flex flex-col items-center justify-center bg-slate-50 gap-3 p-6`}
  >
    <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
    <p className="text-xs font-semibold text-slate-600 tracking-wide">
      Loading {BRAND.name}...
    </p>
  </div>
);

// Layer 1 (Secondary): SaaS Platform Auth, Legal & Referral
const RegisterShopPage = lazyNamed(() => import('./platform/RegisterShopPage'), 'RegisterShopPage');
const LoginPage = lazyNamed(() => import('./platform/LoginPage'), 'LoginPage');
const ReferralRedirectPage = lazyNamed(() => import('./platform/ReferralRedirectPage'), 'ReferralRedirectPage');
const PlatformLegalPage = lazyNamed<React.ComponentType<{ type: 'privacy' | 'terms' }>>(
  () => import('./pages/PlatformLegalPage'),
  'PlatformLegalPage'
);

// Layer 2: Super Admin Portal (Lazy Chunked)
const SuperAdminLayout = lazyNamed(() => import('./superadmin/SuperAdminLayout'), 'SuperAdminLayout');
const SuperAdminDashboardPage = lazyNamed(() => import('./superadmin/SuperAdminDashboardPage'), 'SuperAdminDashboardPage');
const SuperAdminShopsPage = lazyNamed(() => import('./superadmin/SuperAdminShopsPage'), 'SuperAdminShopsPage');
const SuperAdminShopDetailPage = lazyNamed(() => import('./superadmin/SuperAdminShopDetailPage'), 'SuperAdminShopDetailPage');
const SuperAdminPlansPage = lazyNamed(() => import('./superadmin/SuperAdminPlansPage'), 'SuperAdminPlansPage');
const SuperAdminPaymentsPage = lazyNamed(() => import('./superadmin/SuperAdminPaymentsPage'), 'SuperAdminPaymentsPage');
const SuperAdminAnalyticsPage = lazyNamed(() => import('./superadmin/SuperAdminAnalyticsPage'), 'SuperAdminAnalyticsPage');
const SuperAdminSupportPage = lazyNamed(() => import('./superadmin/SuperAdminSupportPage'), 'SuperAdminSupportPage');
const SuperAdminAuditLogsPage = lazyNamed(() => import('./superadmin/SuperAdminAuditLogsPage'), 'SuperAdminAuditLogsPage');
const SuperAdminSettingsPage = lazyNamed(() => import('./superadmin/SuperAdminSettingsPage'), 'SuperAdminSettingsPage');
const SalesOverviewPage = lazyNamed(() => import('./superadmin/sales/SalesOverviewPage'), 'SalesOverviewPage');
const SalesPortalAccessPage = lazyNamed(() => import('./superadmin/sales/SalesPortalAccessPage'), 'SalesPortalAccessPage');
const SalesMembersPage = lazyNamed<React.ComponentType<{ defaultCreateOpen?: boolean }>>(
  () => import('./superadmin/sales/SalesMembersPage'),
  'SalesMembersPage'
);
const SalesMemberDetailPage = lazyNamed(() => import('./superadmin/sales/SalesMemberDetailPage'), 'SalesMemberDetailPage');
const SalesTeamsPage = lazyNamed(() => import('./superadmin/sales/SalesTeamsPage'), 'SalesTeamsPage');
const SalesLeadsPage = lazyNamed(() => import('./superadmin/sales/SalesLeadsPage'), 'SalesLeadsPage');
const SalesRegistrationsPage = lazyNamed(() => import('./superadmin/sales/SalesRegistrationsPage'), 'SalesRegistrationsPage');
const SalesReferralsPage = lazyNamed(() => import('./superadmin/sales/SalesReferralsPage'), 'SalesReferralsPage');
const SalesTargetsPage = lazyNamed(() => import('./superadmin/sales/SalesTargetsPage'), 'SalesTargetsPage');
const SalesCommissionsPage = lazyNamed(() => import('./superadmin/sales/SalesCommissionsPage'), 'SalesCommissionsPage');
const SalesPayoutsPage = lazyNamed(() => import('./superadmin/sales/SalesPayoutsPage'), 'SalesPayoutsPage');
const SalesQrCodesPage = lazyNamed(() => import('./superadmin/sales/SalesQrCodesPage'), 'SalesQrCodesPage');
const SalesReportsPage = lazyNamed(() => import('./superadmin/sales/SalesReportsPage'), 'SalesReportsPage');
const SalesActivityLogsPage = lazyNamed(() => import('./superadmin/sales/SalesActivityLogsPage'), 'SalesActivityLogsPage');
const SalesSettingsPage = lazyNamed(() => import('./superadmin/sales/SalesSettingsPage'), 'SalesSettingsPage');

// Layer 2B: Individual Salesman, Sales Manager & Referral Agent Portals
const SalesmanLoginPage = lazyNamed(() => import('./salesman/SalesmanLoginPage'), 'SalesmanLoginPage');
const SalesmanLayout = lazyNamed(() => import('./salesman/SalesmanLayout'), 'SalesmanLayout');
const SalesmanDashboardPage = lazyNamed(() => import('./salesman/SalesmanDashboardPage'), 'SalesmanDashboardPage');
const SalesManagerLoginPage = lazyNamed(() => import('./salesmanager/SalesManagerLoginPage'), 'SalesManagerLoginPage');
const SalesManagerLayout = lazyNamed(() => import('./salesmanager/SalesManagerLayout'), 'SalesManagerLayout');
const SalesManagerDashboardPage = lazyNamed(() => import('./salesmanager/SalesManagerDashboardPage'), 'SalesManagerDashboardPage');
const ReferralLoginPage = lazyNamed(() => import('./referral/ReferralLoginPage'), 'ReferralLoginPage');
const ReferralRegisterPage = lazyNamed(() => import('./referral/ReferralRegisterPage'), 'ReferralRegisterPage');
const ReferralLayout = lazyNamed(() => import('./referral/ReferralLayout'), 'ReferralLayout');
const ReferralDashboardPage = lazyNamed(() => import('./referral/ReferralDashboardPage'), 'ReferralDashboardPage');

// Layer 3: Merchant Shop Dashboard (Lazy Chunked)
const ShopDashboardLayout = lazyNamed(() => import('./dashboard/ShopDashboardLayout'), 'ShopDashboardLayout');
const ShopOverviewPage = lazyNamed(() => import('./dashboard/ShopOverviewPage'), 'ShopOverviewPage');
const ShopProductsPage = lazyNamed(() => import('./dashboard/ShopProductsPage'), 'ShopProductsPage');
const ShopCategoriesPage = lazyNamed(() => import('./dashboard/ShopCategoriesPage'), 'ShopCategoriesPage');
const ShopOrdersPage = lazyNamed(() => import('./dashboard/ShopOrdersPage'), 'ShopOrdersPage');
const ShopCustomersPage = lazyNamed(() => import('./dashboard/ShopCustomersPage'), 'ShopCustomersPage');
const ShopInventoryPage = lazyNamed(() => import('./dashboard/ShopInventoryPage'), 'ShopInventoryPage');
const ShopPosPage = lazyNamed(() => import('./dashboard/ShopPosPage'), 'ShopPosPage');
const ShopPurchasesPage = lazyNamed(() => import('./dashboard/ShopPurchasesPage'), 'ShopPurchasesPage');
const ShopSuppliersPage = lazyNamed(() => import('./dashboard/ShopSuppliersPage'), 'ShopSuppliersPage');
const ShopKhataPage = lazyNamed(() => import('./dashboard/ShopKhataPage'), 'ShopKhataPage');
const ShopCouponsPage = lazyNamed(() => import('./dashboard/ShopCouponsPage'), 'ShopCouponsPage');
const ShopBannersPage = lazyNamed(() => import('./dashboard/ShopBannersPage'), 'ShopBannersPage');
const ShopAppearancePage = lazyNamed(() => import('./dashboard/ShopAppearancePage'), 'ShopAppearancePage');
const ShopSettingsPage = lazyNamed(() => import('./dashboard/ShopSettingsPage'), 'ShopSettingsPage');
const ShopStaffPage = lazyNamed(() => import('./dashboard/ShopStaffPage'), 'ShopStaffPage');
const ShopReportsPage = lazyNamed(() => import('./dashboard/ShopReportsPage'), 'ShopReportsPage');
const ShopSubscriptionPage = lazyNamed(() => import('./dashboard/ShopSubscriptionPage'), 'ShopSubscriptionPage');
const ShopProfilePage = lazyNamed(() => import('./dashboard/ShopProfilePage'), 'ShopProfilePage');
const ShopMarketingPage = lazyNamed(() => import('./dashboard/ShopMarketingPage'), 'ShopMarketingPage');

// Layer 3B: Multi-Industry Vertical Dashboard Pages
const GymMembersPage = lazyNamed(() => import('./dashboard/industries/GymMembersPage'), 'GymMembersPage');
const GymAttendancePage = lazyNamed(() => import('./dashboard/industries/GymAttendancePage'), 'GymAttendancePage');
const GymTrainersPage = lazyNamed(() => import('./dashboard/industries/GymTrainersPage'), 'GymTrainersPage');
const ClinicAppointmentsPage = lazyNamed(() => import('./dashboard/industries/ClinicAppointmentsPage'), 'ClinicAppointmentsPage');
const ClinicPatientsPage = lazyNamed(() => import('./dashboard/industries/ClinicPatientsPage'), 'ClinicPatientsPage');
const ClinicDoctorsPage = lazyNamed(() => import('./dashboard/industries/ClinicDoctorsPage'), 'ClinicDoctorsPage');
const CarWashQueuePage = lazyNamed(() => import('./dashboard/industries/CarWashQueuePage'), 'CarWashQueuePage');
const CarWashVehiclesPage = lazyNamed(() => import('./dashboard/industries/CarWashVehiclesPage'), 'CarWashVehiclesPage');
const CarWashPackagesPage = lazyNamed(() => import('./dashboard/industries/CarWashPackagesPage'), 'CarWashPackagesPage');
const DealerInventoryPage = lazyNamed(() => import('./dashboard/industries/DealerInventoryPage'), 'DealerInventoryPage');
const DealerLeadsDealsPage = lazyNamed(() => import('./dashboard/industries/DealerLeadsDealsPage'), 'DealerLeadsDealsPage');
const IndustryPaymentsPage = lazyNamed(() => import('./dashboard/industries/IndustryPaymentsPage'), 'IndustryPaymentsPage');
const IndustryReportsPage = lazyNamed(() => import('./dashboard/industries/IndustryReportsPage'), 'IndustryReportsPage');

// Layer 4 (Secondary): Storefront Interior Pages & Service Industry Public Page
const IndustryPublicPage = lazyNamed(() => import('./pages/IndustryPublicPage'), 'IndustryPublicPage');
const ShopPage = lazyNamed(() => import('./pages/ShopPage'), 'ShopPage');
const ProductDetailPage = lazyNamed(() => import('./pages/ProductDetailPage'), 'ProductDetailPage');
const CartPage = lazyNamed(() => import('./pages/CartPage'), 'CartPage');
const CheckoutPage = lazyNamed(() => import('./pages/CheckoutPage'), 'CheckoutPage');
const OrderSuccessPage = lazyNamed(() => import('./pages/OrderSuccessPage'), 'OrderSuccessPage');
const AccountPage = lazyNamed(() => import('./pages/AccountPage'), 'AccountPage');
const OrderTrackingPage = lazyNamed(() => import('./pages/OrderTrackingPage'), 'OrderTrackingPage');
const ContactPage = lazyNamed(() => import('./pages/ContactPage'), 'ContactPage');
const AboutPage = lazyNamed(() => import('./pages/PolicyPages'), 'AboutPage');
const FAQPage = lazyNamed(() => import('./pages/PolicyPages'), 'FAQPage');
const ReturnPolicyPage = lazyNamed(() => import('./pages/PolicyPages'), 'ReturnPolicyPage');
const TermsPage = lazyNamed(() => import('./pages/PolicyPages'), 'TermsPage');
const PrivacyPage = lazyNamed(() => import('./pages/PolicyPages'), 'PrivacyPage');

const StorefrontLayout: React.FC = () => {
  const { loading, notFound, isSuspended, shopSlug, shop, settings, storeBasePath } = useTenant();
  const { pathname } = useLocation();
  const hasChildSeo =
    pathname.includes('/product/') ||
    pathname.endsWith('/shop') ||
    /\/(about|faq|return-policy|terms|privacy|privacy-policy|terms-and-conditions)$/.test(pathname);

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
          No active store was found at <span className="font-mono text-slate-700">{storeBasePath}</span>. Verify the store URL or launch your own store on {BRAND.name}.
        </p>
        <div className="flex flex-wrap gap-3 pt-2 justify-center">
          <Link
            to="/register"
            className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            Launch Your Store <ArrowRight className="w-3.5 h-3.5" />
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

  const isServiceTenant = getIndustryGroup(shop?.businessType) !== 'retail';
  const industryMeta = getIndustryMeta(shop?.businessType);

  // Fallback check if storeBasePath has unknown child route rendered via Outlet
  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-emerald-600 selection:text-white"
      data-store-path={storeBasePath}
    >
      {!hasChildSeo && <DynamicSeoHead shop={shop} settings={settings} />}
      {isServiceTenant ? (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <Link to={storeBasePath} className="flex items-center gap-2.5 min-w-0">
              {settings.logoUrl || shop?.logoUrl ? (
                <img
                  src={settings.logoUrl || shop?.logoUrl}
                  alt={shop?.name || settings.siteName}
                  className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#065F46] text-white flex items-center justify-center text-xs font-extrabold">
                  {(shop?.name || settings.siteName || 'SB').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900 truncate">
                  {shop?.name || settings.siteName}
                </p>
                <p className="text-[10px] font-semibold text-[#065F46] uppercase tracking-wider">
                  {industryMeta.shortLabel}
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-3 text-xs">
              <Link to={`${storeBasePath}/contact`} className="font-semibold text-slate-600 hover:text-slate-900 hidden sm:inline">
                Contact
              </Link>
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800"
              >
                Staff Login
              </Link>
            </div>
          </div>
        </header>
      ) : (
        <Header />
      )}
      <main className="flex-1">
        <React.Suspense fallback={<RouteLoader compact />}>
          <Outlet />
        </React.Suspense>
      </main>
      {!isServiceTenant && <CartDrawer />}
      <WhatsAppButton />
      <Footer />
    </div>
  );
};

const StorefrontIndexPage: React.FC = () => {
  const { shop } = useTenant();
  if (getIndustryGroup(shop?.businessType) !== 'retail') {
    return <IndustryPublicPage />;
  }
  return <HomePage />;
};

const TenantRouteWrapper: React.FC<{
  basePrefix?: '/s' | '/shop' | '/gym' | '/clinic' | '/carwash' | '/dealer';
}> = ({ basePrefix = '/s' }) => {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  return (
    <TenantProvider slug={shopSlug || DEFAULT_SHOP_ID} basePrefix={basePrefix}>
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
            <PWAStatusBanner />
            <React.Suspense fallback={<RouteLoader />}>
            <Routes>
              {/* Layer 1: SaaS Platform Marketing, Legal & Auth */}
              <Route path="/" element={<PlatformLandingPage />} />
              <Route path="/register" element={<RegisterShopPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/merchant/login" element={<LoginPage />} />
              <Route path="/privacy-policy" element={<PlatformLegalPage type="privacy" />} />
              <Route path="/terms-and-conditions" element={<PlatformLegalPage type="terms" />} />
              <Route path="/r/:refCode" element={<ReferralRedirectPage />} />

              {/* Layer 2B: Individual Salesman Portal (Strict Role Guard) */}
              <Route path="/salesman/login" element={<SalesmanLoginPage />} />
              <Route path="/salesman" element={<SalesmanLayout />}>
                <Route index element={<SalesmanDashboardPage />} />
                <Route path="leads" element={<SalesmanDashboardPage />} />
                <Route path="referrals" element={<SalesmanDashboardPage />} />
                <Route path="targets" element={<SalesmanDashboardPage />} />
                <Route path="commissions" element={<SalesmanDashboardPage />} />
                <Route path="payouts" element={<SalesmanDashboardPage />} />
                <Route path="expenses" element={<SalesmanDashboardPage />} />
                <Route path="materials" element={<SalesmanDashboardPage />} />
                <Route path="activities" element={<SalesmanDashboardPage />} />
                <Route path="qr" element={<SalesmanDashboardPage />} />
                <Route path="notifications" element={<SalesmanDashboardPage />} />
              </Route>

              {/* Layer 2C: Sales Manager Portal (Strict Team-Scoped Role Guard) */}
              <Route path="/sales-manager/login" element={<SalesManagerLoginPage />} />
              <Route path="/sales-manager" element={<SalesManagerLayout />}>
                <Route index element={<SalesManagerDashboardPage />} />
                <Route path="team" element={<SalesManagerDashboardPage />} />
                <Route path="leads" element={<SalesManagerDashboardPage />} />
                <Route path="activities" element={<SalesManagerDashboardPage />} />
                <Route path="targets" element={<SalesManagerDashboardPage />} />
                <Route path="reports" element={<SalesManagerDashboardPage />} />
                <Route path="bonuses" element={<SalesManagerDashboardPage />} />
              </Route>

              {/* Layer 2D: Referral Agent Portal (Referral & Approved Rewards Only) */}
              <Route path="/referral/login" element={<ReferralLoginPage />} />
              <Route path="/referral/register" element={<ReferralRegisterPage />} />
              <Route path="/referral" element={<ReferralLayout />}>
                <Route index element={<ReferralDashboardPage />} />
                <Route path="qr" element={<ReferralDashboardPage />} />
                <Route path="referrals" element={<ReferralDashboardPage />} />
                <Route path="rewards" element={<ReferralDashboardPage />} />
              </Route>

              {/* Layer 2: Super Admin Portal (/super-admin/* and /admin/* strictly Super Admin only) */}
              {['/super-admin', '/admin'].map((adminPrefix) => (
                <Route key={adminPrefix} path={adminPrefix} element={<SuperAdminLayout />}>
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
              ))}

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
                <Route path="marketing" element={<ShopMarketingPage />} />
                <Route path="gym/members" element={<GymMembersPage />} />
                <Route path="gym/attendance" element={<GymAttendancePage />} />
                <Route path="gym/trainers" element={<GymTrainersPage />} />
                <Route path="clinic/appointments" element={<ClinicAppointmentsPage />} />
                <Route path="clinic/patients" element={<ClinicPatientsPage />} />
                <Route path="clinic/doctors" element={<ClinicDoctorsPage />} />
                <Route path="carwash/queue" element={<CarWashQueuePage />} />
                <Route path="carwash/vehicles" element={<CarWashVehiclesPage />} />
                <Route path="carwash/packages" element={<CarWashPackagesPage />} />
                <Route path="dealer/inventory" element={<DealerInventoryPage />} />
                <Route path="dealer/leads-deals" element={<DealerLeadsDealsPage />} />
                <Route path="payments" element={<IndustryPaymentsPage />} />
                <Route path="industry-reports" element={<IndustryReportsPage />} />
              </Route>

              {/* Layer 4: Multi-Tenant Public Storefronts (/s/:shopSlug & /shop/:shopSlug) */}
              {[
                { path: '/s/:shopSlug', prefix: '/s' as const },
                { path: '/shop/:shopSlug', prefix: '/shop' as const },
              ].map((mount) => (
                <Route
                  key={mount.path}
                  path={mount.path}
                  element={<TenantRouteWrapper basePrefix={mount.prefix} />}
                >
                  <Route index element={<StorefrontIndexPage />} />
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
                  <Route path="terms-and-conditions" element={<TermsPage />} />
                  <Route path="privacy" element={<PrivacyPage />} />
                  <Route path="privacy-policy" element={<PrivacyPage />} />
                  <Route path="*" element={<StoreNotFoundPage />} />
                </Route>
              ))}

              {/* Layer 4B: Industry Vertical Public Portals (/gym, /clinic, /carwash, /dealer) */}
              {[
                { path: '/gym/:shopSlug', prefix: '/gym' as const },
                { path: '/clinic/:shopSlug', prefix: '/clinic' as const },
                { path: '/carwash/:shopSlug', prefix: '/carwash' as const },
                { path: '/dealer/:shopSlug', prefix: '/dealer' as const },
              ].map((mount) => (
                <Route
                  key={mount.path}
                  path={mount.path}
                  element={<TenantRouteWrapper basePrefix={mount.prefix} />}
                >
                  <Route index element={<IndustryPublicPage />} />
                  <Route path="contact" element={<ContactPage />} />
                  <Route path="about" element={<AboutPage />} />
                  <Route path="terms" element={<TermsPage />} />
                  <Route path="terms-and-conditions" element={<TermsPage />} />
                  <Route path="privacy" element={<PrivacyPage />} />
                  <Route path="privacy-policy" element={<PrivacyPage />} />
                  <Route path="*" element={<StoreNotFoundPage />} />
                </Route>
              ))}

              {/* Legacy Flagship Store Route Redirects */}
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
              <Route path="/terms" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/terms-and-conditions`} replace />} />
              <Route path="/privacy" element={<Navigate to={`/s/${DEFAULT_SHOP_ID}/privacy-policy`} replace />} />

              {/* Platform-wide Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </React.Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

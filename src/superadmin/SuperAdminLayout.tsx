import React, { useState } from 'react';
import { NavLink, Outlet, Link, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  CreditCard,
  Receipt,
  BarChart3,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Loader2,
  LifeBuoy,
  History,
  Settings,
  TrendingUp,
  UserCheck,
  Users,
  UserPlus,
  UsersRound,
  Target,
  Building2,
  Share2,
  Award,
  Coins,
  Wallet,
  QrCode,
  FileBarChart2,
  ClipboardList,
  Sliders,
  ChevronDown,
  ChevronRight,
  FlaskConical,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/common/BrandLogo';
import { BRAND } from '../config/brand';
import { DEMO_SCOPE_PATH } from '../demo/demoConfig';

export const SuperAdminLayout: React.FC = () => {
  const { currentUser, isSuperAdmin, isDemoAdmin, authorizedHomePath, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(true);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-7 h-7 animate-spin text-[#065F46]" />
      </div>
    );
  }

  // Strict route guard: unauthenticated -> /login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Strict route guard: any non-Super Admin (salesman, sales_manager, referral_agent, shop_owner, customer) -> redirect away immediately
  if (!isSuperAdmin) {
    if (!isDemoAdmin) {
      return <Navigate to={authorizedHomePath} replace />;
    }
  }

  const navItems = [
    { to: '/super-admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/super-admin/shops', label: 'Shops & Migration', icon: Store },
    { to: '/super-admin/plans', label: 'Subscription Plans', icon: CreditCard },
    { to: '/super-admin/payments', label: 'Payment Approvals', icon: Receipt },
    { to: '/super-admin/analytics', label: 'Platform Analytics', icon: BarChart3 },
    { to: '/super-admin/support', label: 'Support Tickets', icon: LifeBuoy },
    { to: '/super-admin/audit-logs', label: 'Audit Logs', icon: History },
    { to: '/super-admin/settings', label: 'Platform Settings', icon: Settings },
  ];

  const salesNavItems = [
    { to: '/super-admin/sales', label: 'Sales Overview', icon: TrendingUp, end: true },
    { to: '/super-admin/sales/portal', label: 'Salesman Portal', icon: UserCheck },
    { to: '/super-admin/sales/members', label: 'All Salesmen', icon: Users, end: true },
    { to: '/super-admin/sales/members/new', label: 'Add New Salesman', icon: UserPlus },
    { to: '/super-admin/sales/teams', label: 'Sales Teams', icon: UsersRound },
    { to: '/super-admin/sales/leads', label: 'Sales Leads', icon: Target },
    { to: '/super-admin/sales/registrations', label: 'Shop Registrations', icon: Building2 },
    { to: '/super-admin/sales/referrals', label: 'Referrals', icon: Share2 },
    { to: '/super-admin/sales/targets', label: 'Sales Targets', icon: Award },
    { to: '/super-admin/sales/commissions', label: 'Commission Management', icon: Coins },
    { to: '/super-admin/sales/payouts', label: 'Payout Management', icon: Wallet },
    { to: '/super-admin/sales/qr-codes', label: 'QR Code Management', icon: QrCode },
    { to: '/super-admin/sales/reports', label: 'Sales Reports', icon: FileBarChart2 },
    { to: '/super-admin/sales/activity-logs', label: 'Activity Logs', icon: ClipboardList },
    { to: '/super-admin/sales/settings', label: 'Sales Settings', icon: Sliders },
  ];

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-950 text-slate-200 flex flex-col transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <Link to="/super-admin" className="flex items-center gap-2.5">
            <BrandLogo variant="icon" tone="light" size="sm" />
            <div>
              <p className="text-sm font-extrabold text-white leading-none">{BRAND.name}</p>
              <p
                className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${
                  isDemoAdmin ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {isDemoAdmin ? 'Demo Super Admin' : 'Super Admin'}
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-[#065F46] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Sales Management Group */}
          <div className="pt-4 mt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setSalesOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 hover:text-emerald-300"
            >
              <span>Sales Management</span>
              {salesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {salesOpen && (
              <div className="mt-1 space-y-0.5">
                {salesNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-[#065F46] text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="px-2 py-1">
            <p className="text-[11px] font-semibold text-white truncate">{currentUser.email}</p>
            <p className="text-[10px] text-slate-400">
              {isDemoAdmin ? 'DEMO ACCOUNT · Isolated' : 'Platform Owner'}
            </p>
          </div>
          <Link
            to="/"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-900 transition"
          >
            <span>SaaS Homepage</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-950/50 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-sm sm:text-base font-bold text-slate-900">
              Platform Control Tower
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isDemoAdmin ? (
              <span className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
                DEMO MODE
              </span>
            ) : (
              <Link
                to="/dashboard"
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Shop Workspace
              </Link>
            )}
          </div>
        </header>

        {isDemoAdmin && (
          <div
            data-testid="demo-mode-banner"
            className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-200/80 text-amber-950 text-[10px] font-extrabold uppercase tracking-wider">
                DEMO MODE
              </span>
              <span className="font-semibold">{currentUser.email}</span>
              <span className="text-amber-800">·</span>
              <span className="text-amber-900">
                Isolated Sandbox (<code className="font-mono">/{DEMO_SCOPE_PATH}</code>) — Production Data Locked (Resets managed by Production Super Admin)
              </span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-[11px] font-bold text-amber-950 transition"
            >
              Exit Demo
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

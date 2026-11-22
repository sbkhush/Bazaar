import React, { useState } from 'react';
import { NavLink, Outlet, Link, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  QrCode,
  Store,
  Award,
  LogOut,
  Menu,
  X,
  Loader2,
  Share2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ReferralLayout: React.FC = () => {
  const { currentUser, salesMember, isReferralAgent, authorizedHomePath, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-7 h-7 animate-spin text-[#065F46]" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/referral/login" replace />;
  }

  if (!isReferralAgent || !salesMember) {
    if (salesMember?.role === 'referral_agent' && salesMember.accountStatus === 'pending_approval') {
      return <Navigate to="/referral/login" replace />;
    }
    return <Navigate to={authorizedHomePath} replace />;
  }

  const navItems = [
    { to: '/referral', label: 'Referral Overview', icon: LayoutDashboard, end: true },
    { to: '/referral/qr', label: 'Referral Code & QR', icon: QrCode },
    { to: '/referral/referrals', label: 'Referred Shops', icon: Store },
    { to: '/referral/rewards', label: 'Approved Rewards', icon: Award },
  ];

  const handleSignOut = async () => {
    await logout();
    navigate('/referral/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-950 text-slate-200 flex flex-col transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <Link to="/referral" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#065F46] text-white flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white leading-none">SB Khush Referral</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mt-0.5">
                {salesMember.employeeId}
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
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="px-2 py-1">
            <p className="text-xs font-bold text-white truncate">{salesMember.fullName}</p>
            <p className="text-[10px] text-emerald-400 uppercase font-semibold">Referral Agent</p>
          </div>
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
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900">
                Referral Partner Workspace
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Code: <span className="font-mono font-bold text-[#065F46]">{salesMember.referralCode}</span>
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { NavLink, Outlet, Link, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UsersRound,
  Target,
  ClipboardList,
  Award,
  FileBarChart2,
  Gift,
  LogOut,
  Menu,
  X,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SalesManagerLayout: React.FC = () => {
  const { currentUser, salesMember, isSalesManager, authorizedHomePath, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-7 h-7 animate-spin text-[#065F46]" />
      </div>
    );
  }

  // Strict route guard: unauthenticated -> /sales-manager/login
  if (!currentUser) {
    return <Navigate to="/sales-manager/login" replace />;
  }

  // Strict route guard: any non-sales_manager role -> redirect immediately to own authorized portal
  if (!isSalesManager || !salesMember) {
    return <Navigate to={authorizedHomePath} replace />;
  }

  const navItems = [
    { to: '/sales-manager', label: 'Team Overview', icon: LayoutDashboard, end: true },
    { to: '/sales-manager/team', label: 'Assigned Team', icon: UsersRound },
    { to: '/sales-manager/leads', label: 'Team Leads & Assign', icon: Target },
    { to: '/sales-manager/activities', label: 'Team Activities', icon: ClipboardList },
    { to: '/sales-manager/targets', label: 'Team Targets', icon: Award },
    { to: '/sales-manager/reports', label: 'Team Reports', icon: FileBarChart2 },
    { to: '/sales-manager/bonuses', label: 'Bonus Recommendations', icon: Gift },
  ];

  const handleSignOut = async () => {
    await logout();
    navigate('/sales-manager/login');
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
          <Link to="/sales-manager" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#065F46] text-white flex items-center justify-center">
              <UsersRound className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white leading-none">Sales Manager</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mt-0.5">
                {salesMember.territory || salesMember.city}
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
            <p className="text-[10px] text-emerald-400 uppercase font-semibold">
              Sales Manager · {salesMember.employeeId}
            </p>
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
                Sales Manager Team Portal
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Strictly scoped to your assigned regional team
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-[#065F46]">
            <ShieldCheck className="w-3.5 h-3.5" />
            Team Scoped Access
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  Share2,
  Award,
  Coins,
  Wallet,
  ClipboardList,
  QrCode,
  Bell,
  UsersRound,
  LogOut,
  Menu,
  X,
  Briefcase,
  Loader2,
  ShieldAlert,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getSalesNotifications,
  markAllSalesNotificationsRead,
  markSalesNotificationRead,
} from '../services/salesService';
import { SalesNotification } from '../types';

export const SalesmanLayout: React.FC = () => {
  const { currentUser, salesMember, isSalesman, isSalesManager, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<SalesNotification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser?.uid || !salesMember?.id) return;
    getSalesNotifications(salesMember.id, currentUser.uid)
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, [currentUser?.uid, salesMember?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-7 h-7 animate-spin text-[#065F46]" />
      </div>
    );
  }

  if (!currentUser || !isSalesman || !salesMember) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Salesman Portal Access Required</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {currentUser && salesMember
              ? `Your salesman profile (${salesMember.employeeId}) is currently ${salesMember.accountStatus}.`
              : 'Sign in with an active salesman account provisioned by BazaarPK Super Admin.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Link
              to="/salesman/login"
              className="flex-1 py-2.5 bg-[#065F46] text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition"
            >
              Salesman Sign In
            </Link>
            <Link
              to="/"
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
            >
              Platform Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navItems = [
    { to: '/salesman', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/salesman/leads', label: 'My Leads', icon: Target },
    { to: '/salesman/referrals', label: 'My Referrals', icon: Share2 },
    { to: '/salesman/targets', label: 'Targets', icon: Award },
    { to: '/salesman/commissions', label: 'Commissions', icon: Coins },
    { to: '/salesman/payouts', label: 'Payouts', icon: Wallet },
    { to: '/salesman/activities', label: 'Activity Logs', icon: ClipboardList },
    { to: '/salesman/qr', label: 'QR & Referral Link', icon: QrCode },
    { to: '/salesman/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    ...(isSalesManager ? [{ to: '/salesman/team', label: 'My Sales Team', icon: UsersRound }] : []),
  ];

  const handleSignOut = async () => {
    await logout();
    navigate('/salesman/login');
  };

  const handleMarkRead = async (n: SalesNotification) => {
    await markSalesNotificationRead(n.id);
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
  };

  const handleMarkAllRead = async () => {
    await markAllSalesNotificationsRead(notifications);
    setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
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
          <Link to="/salesman" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#065F46] text-white flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white leading-none">BazaarPK Sales</p>
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
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-[#065F46] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`
              }
            >
              <span className="flex items-center gap-3">
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="px-2 py-1">
            <p className="text-xs font-bold text-white truncate">{salesMember.fullName}</p>
            <p className="text-[10px] text-emerald-400 uppercase font-semibold">
              {salesMember.role.replace('_', ' ')} · {salesMember.city}
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
                Sales Representative Workspace
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Referral Code:{' '}
                <span className="font-mono font-bold text-[#065F46]">{salesMember.referralCode}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 relative">
            <button
              type="button"
              onClick={() => setNotifOpen((p) => !p)}
              className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <Link
              to={`/register?ref=${encodeURIComponent(salesMember.referralCode)}`}
              className="px-3 py-1.5 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white text-xs font-bold"
            >
              + Assist Shop Signup
            </Link>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden text-xs">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">Notifications</span>
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-[#065F46] font-bold inline-flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-center text-slate-500">No notifications yet.</p>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleMarkRead(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${
                          n.isRead ? 'opacity-70' : 'bg-emerald-50/40'
                        }`}
                      >
                        <p className="font-bold text-slate-900">{n.title}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{n.message}</p>
                      </button>
                    ))
                  )}
                </div>
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

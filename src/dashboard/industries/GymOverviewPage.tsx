import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CheckSquare,
  Dumbbell,
  ExternalLink,
  Loader2,
  MessageCircle,
  QrCode,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  computeGymDashboardMetrics,
  getGymAttendance,
  getGymMembers,
  recordGymCheckIn,
} from '../../services/gymService';
import {
  formatWhatsAppReminderUrl,
  getIndustryPayments,
} from '../../services/industryCommonService';
import { GymAttendanceRecord, GymMember, IndustryPaymentRecord } from '../../types';
import { formatPKR } from '../../data/seedData';

export const GymOverviewPage: React.FC = () => {
  const { shopId, shop, publicStorePath, isReadOnly } = useDashboard();
  const [members, setMembers] = useState<GymMember[]>([]);
  const [attendance, setAttendance] = useState<GymAttendanceRecord[]>([]);
  const [payments, setPayments] = useState<IndustryPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [m, a, p] = await Promise.all([
        getGymMembers(shopId).catch(() => []),
        getGymAttendance(shopId).catch(() => []),
        getIndustryPayments(shopId).catch(() => []),
      ]);
      setMembers(m);
      setAttendance(a);
      setPayments(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading Gym Dashboard...
      </div>
    );
  }

  const metrics = computeGymDashboardMetrics(members, attendance, payments);

  const handleQuickCheckIn = async (member: GymMember) => {
    if (isReadOnly) return;
    setBusyId(member.id);
    try {
      await recordGymCheckIn(shopId, member, 'manual');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {shop?.name || 'Gym & Fitness'} — Operations Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Member roster, expiry pipeline, QR attendance &amp; fee collection.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/gym/members"
            className="px-3.5 py-2 bg-[#065F46] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Member / Plan
          </Link>
          <Link
            to="/dashboard/gym/attendance"
            className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5 text-[#065F46]" /> QR Check-In Desk
          </Link>
          <Link
            to={publicStorePath}
            target="_blank"
            className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5"
          >
            Public Gym Page <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Required 7 Gym Dashboard Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Members</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {metrics.totalMembers}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Active Members</p>
          <p className="text-2xl font-extrabold text-[#065F46] mt-1 tabular-nums">
            {metrics.activeMembers}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Expired Members</p>
          <p className="text-2xl font-extrabold text-red-700 mt-1 tabular-nums">
            {metrics.expiredMembers}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Today&apos;s Attendance</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {metrics.todayAttendance}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Monthly Revenue</p>
          <p className="text-lg font-extrabold text-slate-900 mt-1 tabular-nums">
            {formatPKR(metrics.monthlyRevenue)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Pending Payments</p>
          <p className="text-lg font-extrabold text-amber-700 mt-1 tabular-nums">
            {formatPKR(metrics.pendingPayments)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Upcoming Renewals</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {metrics.upcomingRenewalsCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Renewals + WhatsApp Reminders */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#065F46]" /> Upcoming Renewals (Next 7 Days)
            </h3>
            <Link to="/dashboard/gym/members" className="text-xs font-semibold text-[#065F46]">
              Manage All
            </Link>
          </div>
          {metrics.upcomingRenewals.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No memberships expiring in the next 7 days.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {metrics.upcomingRenewals.slice(0, 6).map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{m.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {m.planName || 'Membership'} · Expires {m.expiryDate}
                    </p>
                  </div>
                  <a
                    href={formatWhatsAppReminderUrl(
                      m.phone,
                      `Assalam-o-Alaikum ${m.name}, your membership at ${shop?.name || 'our gym'} expires on ${m.expiryDate}. Please renew to continue uninterrupted access.`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg font-semibold inline-flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Reminder
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Members Quick Check-In */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#065F46]" /> Recent Members Quick Check-In
            </h3>
            <Link to="/dashboard/gym/attendance" className="text-xs font-semibold text-[#065F46]">
              Full Log
            </Link>
          </div>
          {members.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Register your first gym member to enable check-ins.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {members.slice(0, 6).map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      {m.name} <span className="font-mono text-slate-400">· {m.memberCode}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {m.planName || 'No Plan'} · Valid until {m.expiryDate}
                    </p>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => handleQuickCheckIn(m)}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold inline-flex items-center gap-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      {busyId === m.id ? 'Checking...' : 'Check In'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <Link
          to="/dashboard/gym/trainers"
          className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-[#065F46] transition flex items-center gap-3"
        >
          <Dumbbell className="w-5 h-5 text-[#065F46]" />
          <div>
            <p className="font-bold text-slate-900">Trainers &amp; Workout Plans</p>
            <p className="text-[11px] text-slate-500">Manage coach shifts and workout routines</p>
          </div>
        </Link>
        <Link
          to="/dashboard/payments"
          className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-[#065F46] transition flex items-center gap-3"
        >
          <Wallet className="w-5 h-5 text-[#065F46]" />
          <div>
            <p className="font-bold text-slate-900">Fee Ledger &amp; Pending Dues</p>
            <p className="text-[11px] text-slate-500">Cash, EasyPaisa, JazzCash &amp; IBFT receipts</p>
          </div>
        </Link>
        <Link
          to="/dashboard/marketing"
          className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-[#065F46] transition flex items-center gap-3"
        >
          <QrCode className="w-5 h-5 text-[#065F46]" />
          <div>
            <p className="font-bold text-slate-900">Gym QR Poster</p>
            <p className="text-[11px] text-slate-500">Download reception QR standee for walk-ins</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

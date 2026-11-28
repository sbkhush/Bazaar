import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  ClipboardList,
  ExternalLink,
  Loader2,
  ShieldAlert,
  Stethoscope,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  CLINIC_ADMIN_DISCLAIMER,
  computeClinicMetrics,
  getClinicAppointments,
  getClinicDoctors,
  getClinicPatients,
} from '../../services/clinicService';
import { getIndustryPayments, getShopAuditLogs } from '../../services/industryCommonService';
import {
  ClinicAppointment,
  ClinicDoctor,
  ClinicPatient,
  IndustryPaymentRecord,
  ShopAuditLog,
} from '../../types';
import { formatPKR } from '../../data/seedData';

export const ClinicOverviewPage: React.FC = () => {
  const { shopId, shop, publicStorePath } = useDashboard();
  const [patients, setPatients] = useState<ClinicPatient[]>([]);
  const [doctors, setDoctors] = useState<ClinicDoctor[]>([]);
  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [payments, setPayments] = useState<IndustryPaymentRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<ShopAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    Promise.all([
      getClinicPatients(shopId).catch(() => []),
      getClinicDoctors(shopId).catch(() => []),
      getClinicAppointments(shopId).catch(() => []),
      getIndustryPayments(shopId).catch(() => []),
      getShopAuditLogs(shopId, 8).catch(() => []),
    ])
      .then(([p, d, a, pay, aud]) => {
        setPatients(p);
        setDoctors(d);
        setAppointments(a);
        setPayments(pay);
        setAuditLogs(aud);
      })
      .finally(() => setLoading(false));
  }, [shopId]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading Clinic Workspace...
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const metrics = computeClinicMetrics(patients, doctors, appointments, payments, today);
  const waitingList = appointments.filter(
    (a) =>
      a.appointmentDate === today &&
      (a.status === 'Pending' || a.status === 'Confirmed' || a.status === 'Checked In')
  );

  return (
    <div className="space-y-6">
      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Administrative &amp; Privacy Notice</p>
          <p className="text-[11px] text-amber-900 mt-0.5">{CLINIC_ADMIN_DISCLAIMER}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {shop?.name || 'Clinic & Medical Center'} — Desk Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Privacy-isolated appointments, doctors, administrative visit notes &amp; fee billing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/clinic/appointments"
            className="px-3.5 py-2 bg-[#065F46] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
          >
            <CalendarCheck className="w-3.5 h-3.5" /> Appointments Desk
          </Link>
          <Link
            to="/dashboard/clinic/patients"
            className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#065F46]" /> Patients &amp; Notes
          </Link>
          <Link
            to={publicStorePath}
            target="_blank"
            className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5"
          >
            Public Booking Page <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Patients</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {metrics.totalPatients}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Active Doctors</p>
          <p className="text-2xl font-extrabold text-[#065F46] mt-1 tabular-nums">
            {metrics.activeDoctors}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Today&apos;s Appointments</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {metrics.todayAppointments}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Waiting Queue</p>
          <p className="text-2xl font-extrabold text-amber-700 mt-1 tabular-nums">
            {metrics.waitingCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Monthly Revenue</p>
          <p className="text-lg font-extrabold text-slate-900 mt-1 tabular-nums">
            {formatPKR(metrics.monthlyRevenue)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-500">Pending Fees</p>
          <p className="text-lg font-extrabold text-red-700 mt-1 tabular-nums">
            {formatPKR(metrics.pendingFees)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">Today&apos;s Waiting Queue</h3>
            <Link to="/dashboard/clinic/appointments" className="font-semibold text-[#065F46]">
              Open Queue
            </Link>
          </div>
          {waitingList.length === 0 ? (
            <p className="py-8 text-center text-slate-400">No active appointments waiting today.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {waitingList.slice(0, 6).map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{a.patientName}</p>
                    <p className="text-[11px] text-slate-500">
                      {a.doctorName} · {a.timeSlot}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 font-semibold text-[11px]">
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">Recent Privacy Audit Trail</h3>
            <Link to="/dashboard/clinic/patients" className="font-semibold text-[#065F46]">
              Patients
            </Link>
          </div>
          {auditLogs.length === 0 ? (
            <p className="py-8 text-center text-slate-400">
              Audit events appear automatically when patient profiles or visit notes are viewed or saved.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{log.action}</p>
                    <p className="text-[11px] text-slate-500">{log.details}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    {log.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <Link
          to="/dashboard/clinic/doctors"
          className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-[#065F46] transition flex items-center gap-3"
        >
          <Stethoscope className="w-5 h-5 text-[#065F46]" />
          <div>
            <p className="font-bold text-slate-900">Doctors &amp; Schedules</p>
            <p className="text-[11px] text-slate-500">OPD timings, specialties &amp; consultation fees</p>
          </div>
        </Link>
        <Link
          to="/dashboard/clinic/patients"
          className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-[#065F46] transition flex items-center gap-3"
        >
          <ClipboardList className="w-5 h-5 text-[#065F46]" />
          <div>
            <p className="font-bold text-slate-900">Patient Registry &amp; Notes</p>
            <p className="text-[11px] text-slate-500">Strict private records with visit audit logging</p>
          </div>
        </Link>
        <Link
          to="/dashboard/payments"
          className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-[#065F46] transition flex items-center gap-3"
        >
          <Wallet className="w-5 h-5 text-[#065F46]" />
          <div>
            <p className="font-bold text-slate-900">Consultation Fee Ledger</p>
            <p className="text-[11px] text-slate-500">Record cash, EasyPaisa, JazzCash &amp; IBFT fees</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

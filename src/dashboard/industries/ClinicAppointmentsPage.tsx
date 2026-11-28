import React, { useEffect, useState } from 'react';
import { CalendarCheck, Loader2, MessageCircle, Plus, Search, ShieldAlert } from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  CLINIC_ADMIN_DISCLAIMER,
  CLINIC_APPOINTMENT_STATUSES,
  getClinicAppointments,
  getClinicDoctors,
  getClinicPatients,
  saveClinicAppointment,
  updateClinicAppointmentStatus,
} from '../../services/clinicService';
import {
  formatWhatsAppReminderUrl,
  recordIndustryPayment,
} from '../../services/industryCommonService';
import {
  ClinicAppointment,
  ClinicAppointmentStatus,
  ClinicDoctor,
  ClinicPatient,
  ManualPaymentMethod,
} from '../../types';
import { formatPKR } from '../../data/seedData';

export const ClinicAppointmentsPage: React.FC = () => {
  const { shopId, shop, isReadOnly } = useDashboard();
  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [doctors, setDoctors] = useState<ClinicDoctor[]>([]);
  const [patients, setPatients] = useState<ClinicPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClinicAppointmentStatus>('all');
  const [search, setSearch] = useState('');

  // Form
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState('06:00 PM');
  const [visitReason, setVisitReason] = useState('');
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [consultationFee, setConsultationFee] = useState('1500');
  const [paidAmount, setPaidAmount] = useState('1500');
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>('cash');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [a, d, p] = await Promise.all([
        getClinicAppointments(shopId),
        getClinicDoctors(shopId),
        getClinicPatients(shopId),
      ]);
      setAppointments(a);
      setDoctors(d);
      setPatients(p);
      if (!doctorId && d.length > 0) {
        setDoctorId(d[0].id);
        setConsultationFee(String(d[0].consultationFee));
        setPaidAmount(String(d[0].consultationFee));
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly) return;
    setSaving(true);
    setError(null);
    try {
      const docObj = doctors.find((d) => d.id === doctorId);
      const fee = Number(consultationFee || 0);
      const paid = Number(paidAmount || 0);
      const saved = await saveClinicAppointment(shopId, {
        patientId: patientId || undefined,
        patientName,
        patientPhone,
        doctorId: docObj?.id,
        doctorName: docObj?.name || 'On-Duty Doctor',
        appointmentDate,
        timeSlot,
        visitReason,
        isFollowUp,
        consultationFee: fee,
        paidAmount: paid,
        status: 'Confirmed',
      });

      if (paid > 0) {
        await recordIndustryPayment(shopId, {
          module: 'clinic',
          referenceType: 'consultation',
          referenceId: saved.id,
          customerName: saved.patientName,
          customerPhone: saved.patientPhone,
          amount: paid,
          method: paymentMethod,
          status: 'paid',
          notes: `OPD Consultation — ${saved.doctorName} (${saved.appointmentDate})`,
        });
      }

      setPatientName('');
      setPatientPhone('');
      setVisitReason('');
      setPatientId('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to schedule appointment.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = appointments.filter((a) => {
    if (dateFilter && a.appointmentDate !== dateFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${a.patientName} ${a.patientPhone} ${a.doctorName} ${a.visitReason || ''}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
        <span>{CLINIC_ADMIN_DISCLAIMER}</span>
      </div>

      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Appointments &amp; Waiting List</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage clinic slots, walk-ins, follow-ups, public bookings, and consultation fee payments.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      {!isReadOnly && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#065F46]" /> Book Appointment / Walk-in Visit
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={patientId}
              onChange={(e) => {
                const pid = e.target.value;
                setPatientId(pid);
                const found = patients.find((p) => p.id === pid);
                if (found) {
                  setPatientName(found.name);
                  setPatientPhone(found.phone);
                }
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Existing Patient (Optional)</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.phone}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Patient Name *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="tel"
              required
              value={patientPhone}
              onChange={(e) => setPatientPhone(e.target.value)}
              placeholder="Patient Phone *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <select
              value={doctorId}
              onChange={(e) => {
                const id = e.target.value;
                setDoctorId(id);
                const docObj = doctors.find((d) => d.id === id);
                if (docObj) {
                  setConsultationFee(String(docObj.consultationFee));
                  setPaidAmount(String(docObj.consultationFee));
                }
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Select Doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.specialty} · {formatPKR(d.consultationFee)})
                </option>
              ))}
            </select>
            <input
              type="date"
              required
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              required
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              placeholder="Time Slot (e.g. 06:30 PM)"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="number"
              min="0"
              value={consultationFee}
              onChange={(e) => setConsultationFee(e.target.value)}
              placeholder="Consultation Fee (PKR)"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
            <input
              type="number"
              min="0"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="Paid Now (PKR)"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as ManualPaymentMethod)}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="cash">Cash</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="jazzcash">JazzCash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="ibft">IBFT</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="text"
              value={visitReason}
              onChange={(e) => setVisitReason(e.target.value)}
              placeholder="Administrative visit reason (e.g. Follow-up checkup)"
              className="flex-1 min-w-[220px] px-3 py-2 border border-slate-200 rounded-lg"
            />
            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isFollowUp}
                onChange={(e) => setIsFollowUp(e.target.checked)}
              />
              Follow-up Visit
            </label>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#065F46] text-white rounded-xl font-bold inline-flex items-center gap-1.5"
            >
              <CalendarCheck className="w-4 h-4" />
              {saving ? 'Scheduling...' : 'Save Appointment'}
            </button>
          </div>
        </form>
      )}

      {/* Calendar / Search / Filter Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden text-xs">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient or doctor..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
          >
            <option value="all">All Statuses</option>
            {CLINIC_APPOINTMENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="text-slate-600 underline text-[11px]"
            >
              Clear Date
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading appointments...
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-slate-400">No appointments match your filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Date &amp; Slot</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3 text-right">Fee / Paid</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Remind</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 tabular-nums">
                      <p className="font-bold text-slate-900">{a.appointmentDate}</p>
                      <p className="text-[11px] text-slate-500">{a.timeSlot}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">
                        {a.patientName}{' '}
                        {a.isFollowUp && (
                          <span className="text-[10px] font-semibold text-[#065F46]">· Follow-up</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {a.patientPhone} {a.visitReason ? `· ${a.visitReason}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{a.doctorName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <p className="font-bold text-slate-900">{formatPKR(a.consultationFee)}</p>
                      <p className="text-[11px] text-slate-500">
                        Paid: {formatPKR(a.paidAmount)} ({a.feeStatus})
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {isReadOnly ? (
                        <span className="px-2 py-0.5 rounded border border-slate-200 text-[11px] font-semibold">
                          {a.status}
                        </span>
                      ) : (
                        <select
                          value={a.status}
                          onChange={(e) =>
                            updateClinicAppointmentStatus(
                              shopId,
                              a.id,
                              e.target.value as ClinicAppointmentStatus
                            ).then(load)
                          }
                          className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-[11px] font-semibold"
                        >
                          {CLINIC_APPOINTMENT_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={formatWhatsAppReminderUrl(
                          a.patientPhone,
                          `Assalam-o-Alaikum ${a.patientName}, reminder from ${shop?.name || 'Clinic'}: Your appointment with ${a.doctorName} is scheduled for ${a.appointmentDate} at ${a.timeSlot}.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-md font-semibold text-[11px]"
                      >
                        <MessageCircle className="w-3 h-3" /> WhatsApp
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

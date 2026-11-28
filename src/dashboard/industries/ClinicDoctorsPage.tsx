import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  deleteClinicDoctor,
  getClinicAppointments,
  getClinicDoctors,
  saveClinicDoctor,
} from '../../services/clinicService';
import { ClinicAppointment, ClinicDoctor } from '../../types';
import { formatPKR } from '../../data/seedData';

export const ClinicDoctorsPage: React.FC = () => {
  const { shopId, isReadOnly } = useDashboard();
  const [doctors, setDoctors] = useState<ClinicDoctor[]>([]);
  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [qualification, setQualification] = useState('');
  const [phone, setPhone] = useState('');
  const [fee, setFee] = useState('1500');
  const [timings, setTimings] = useState('Mon – Sat: 5:00 PM – 9:00 PM');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        getClinicDoctors(shopId),
        getClinicAppointments(shopId),
      ]);
      setDoctors(d);
      setAppointments(a);
    } catch (err: any) {
      setError(err?.message || 'Failed to load doctors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly) return;
    setSaving(true);
    setError(null);
    try {
      await saveClinicDoctor(shopId, {
        name,
        specialty,
        qualification,
        phone,
        consultationFee: Number(fee || 0),
        timings,
      });
      setName('');
      setSpecialty('');
      setQualification('');
      setPhone('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save doctor profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Doctors &amp; OPD Schedules</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage clinic practitioners, timings, consultation fees, and doctor-wise consultation counts.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      {!isReadOnly && (
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#065F46]" /> Add Doctor / Practitioner
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Full Name *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              required
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Specialty (e.g. General Physician) *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              placeholder="Qualification (e.g. MBBS, FCPS)"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (Internal Desk)"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="number"
              min="0"
              required
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="Consultation Fee (PKR) *"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
            <input
              type="text"
              value={timings}
              onChange={(e) => setTimings(e.target.value)}
              placeholder="Schedule Timings"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-[#065F46] text-white rounded-xl font-bold inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Publish Doctor Schedule'}
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden text-xs">
        {loading ? (
          <div className="py-12 flex justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading doctors...
          </div>
        ) : doctors.length === 0 ? (
          <p className="py-12 text-center text-slate-400">No doctors added yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {doctors.map((d) => {
              const docAppts = appointments.filter((a) => a.doctorId === d.id || a.doctorName === d.name);
              const collected = docAppts
                .filter((a) => a.status !== 'Cancelled')
                .reduce((s, a) => s + Number(a.paidAmount || 0), 0);
              return (
                <div key={d.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-sm text-slate-900">
                      {d.name}{' '}
                      <span className="text-xs font-normal text-slate-500">· {d.specialty}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {d.qualification ? `${d.qualification} · ` : ''}
                      {d.timings}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right tabular-nums">
                      <p className="font-bold text-slate-900">{formatPKR(d.consultationFee)} / visit</p>
                      <p className="text-[11px] text-slate-500">
                        {docAppts.length} bookings · {formatPKR(collected)} collected
                      </p>
                    </div>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => deleteClinicDoctor(shopId, d.id).then(load)}
                        className="p-1.5 text-red-600 border border-red-200 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

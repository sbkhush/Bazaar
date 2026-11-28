import React, { useEffect, useState } from 'react';
import { ClipboardList, FileText, Loader2, Lock, Plus, Search, ShieldAlert, UserPlus } from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  addClinicMedicalNote,
  CLINIC_ADMIN_DISCLAIMER,
  getClinicAppointments,
  getClinicDoctors,
  getClinicPatients,
  getPatientMedicalNotes,
  saveClinicPatient,
} from '../../services/clinicService';
import { getShopAuditLogs } from '../../services/industryCommonService';
import {
  ClinicAppointment,
  ClinicDoctor,
  ClinicMedicalNote,
  ClinicPatient,
  ClinicPrescriptionItem,
  ShopAuditLog,
} from '../../types';

export const ClinicPatientsPage: React.FC = () => {
  const { shopId, isReadOnly, hasPermission } = useDashboard();
  const canAccessNotes = hasPermission('clinic_notes');

  const [patients, setPatients] = useState<ClinicPatient[]>([]);
  const [doctors, setDoctors] = useState<ClinicDoctor[]>([]);
  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [auditLogs, setAuditLogs] = useState<ShopAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Selected Patient + Private Notes
  const [selectedPatient, setSelectedPatient] = useState<ClinicPatient | null>(null);
  const [notes, setNotes] = useState<ClinicMedicalNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // Patient Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<ClinicPatient['gender']>('Male');
  const [allergiesNote, setAllergiesNote] = useState('');
  const [savingPatient, setSavingPatient] = useState(false);

  // Administrative Note Form
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [doctorName, setDoctorName] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [clinicalObservations, setClinicalObservations] = useState('');
  const [prescText, setPrescText] = useState('');
  const [advice, setAdvice] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [p, d, a, logs] = await Promise.all([
        getClinicPatients(shopId),
        getClinicDoctors(shopId),
        getClinicAppointments(shopId),
        getShopAuditLogs(shopId, 20).catch(() => []),
      ]);
      setPatients(p);
      setDoctors(d);
      setAppointments(a);
      setAuditLogs(logs);
      if (!doctorName && d.length > 0) setDoctorName(d[0].name);
    } catch (err: any) {
      setError(err?.message || 'Could not load patient records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const openPatientNotes = async (patient: ClinicPatient) => {
    setSelectedPatient(patient);
    if (!canAccessNotes) {
      setNotes([]);
      return;
    }
    setNotesLoading(true);
    try {
      const list = await getPatientMedicalNotes(shopId, patient.id);
      setNotes(list);
      getShopAuditLogs(shopId, 20).then(setAuditLogs).catch(() => {});
    } catch (err: any) {
      setError(err?.message || 'Could not load visit notes.');
    } finally {
      setNotesLoading(false);
    }
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly) return;
    setSavingPatient(true);
    setError(null);
    try {
      await saveClinicPatient(shopId, {
        name,
        phone,
        age: age ? Number(age) : undefined,
        gender,
        allergiesNote: allergiesNote || undefined,
      });
      setName('');
      setPhone('');
      setAge('');
      setAllergiesNote('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save patient profile.');
    } finally {
      setSavingPatient(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly || !selectedPatient || !canAccessNotes) return;
    setSavingNote(true);
    setError(null);
    try {
      const prescriptions: ClinicPrescriptionItem[] = prescText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [medicine, dosage = 'As directed', duration = '5 days'] = line
            .split('|')
            .map((s) => s.trim());
          return { medicine, dosage, duration };
        });

      await addClinicMedicalNote(shopId, {
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        doctorName: doctorName || 'Duty Doctor',
        visitDate,
        chiefComplaint,
        clinicalObservations,
        prescriptions,
        advice,
      });

      setChiefComplaint('');
      setClinicalObservations('');
      setPrescText('');
      setAdvice('');
      await openPatientNotes(selectedPatient);
    } catch (err: any) {
      setError(err?.message || 'Could not save administrative visit note.');
    } finally {
      setSavingNote(false);
    }
  };

  const filtered = patients.filter((p) =>
    `${p.name} ${p.phone} ${p.patientCode}`.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPatientVisits = selectedPatient
    ? appointments.filter(
        (a) => a.patientId === selectedPatient.id || a.patientPhone === selectedPatient.phone
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Strict Privacy &amp; Administrative Recordkeeping</p>
          <p className="text-[11px] text-amber-900 mt-0.5">
            {CLINIC_ADMIN_DISCLAIMER} Patient records are never exposed publicly and all profile/note writes and views are audit-logged.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      {!isReadOnly && (
        <form onSubmit={handleSavePatient} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#065F46]" /> Register Patient Profile
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Patient Full Name *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile Number *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="number"
              min="0"
              max="120"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Age (Years)"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as ClinicPatient['gender'])}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <input
              type="text"
              value={allergiesNote}
              onChange={(e) => setAllergiesNote(e.target.value)}
              placeholder="Allergies / Alerts (optional)"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={savingPatient}
            className="px-5 py-2 bg-[#065F46] text-white rounded-xl font-bold"
          >
            {savingPatient ? 'Saving...' : 'Save Patient'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 text-xs">
        {/* Patient List */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-3.5 border-b border-slate-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient name, phone, PT code..."
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
          {loading ? (
            <div className="py-10 flex justify-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading patients...
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-slate-400">No patients registered yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openPatientNotes(p)}
                  className={`w-full text-left p-3.5 hover:bg-slate-50 transition flex items-center justify-between gap-2 ${
                    selectedPatient?.id === p.id ? 'bg-emerald-50/70' : ''
                  }`}
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {p.name} <span className="font-mono text-slate-400">· {p.patientCode}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {p.phone} {p.age ? `· ${p.age}y` : ''} {p.gender ? `· ${p.gender}` : ''}
                    </p>
                  </div>
                  <ClipboardList className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Visit History & Medical Notes */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          {!selectedPatient ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <FileText className="w-7 h-7 mx-auto text-slate-300" />
              <p>Select a patient on the left to inspect visit history and administrative notes.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {selectedPatient.name} ({selectedPatient.patientCode})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedPatient.phone} · Visits: {selectedPatientVisits.length}
                    {selectedPatient.allergiesNote ? ` · Note: ${selectedPatient.allergiesNote}` : ''}
                  </p>
                </div>
              </div>

              {!canAccessNotes ? (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    Your staff role does not hold the restricted <code>clinic_notes</code> permission required to view or enter clinical notes &amp; prescriptions.
                  </span>
                </div>
              ) : (
                <>
                  {!isReadOnly && (
                    <form onSubmit={handleAddNote} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <p className="font-bold text-slate-900">
                        Record Administrative Visit Note &amp; Prescription
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="date"
                          required
                          value={visitDate}
                          onChange={(e) => setVisitDate(e.target.value)}
                          className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                        />
                        <select
                          value={doctorName}
                          onChange={(e) => setDoctorName(e.target.value)}
                          className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                        >
                          {doctors.length === 0 ? (
                            <option value="Duty Doctor">Duty Doctor</option>
                          ) : (
                            doctors.map((d) => (
                              <option key={d.id} value={d.name}>
                                {d.name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      <input
                        type="text"
                        required
                        value={chiefComplaint}
                        onChange={(e) => setChiefComplaint(e.target.value)}
                        placeholder="Chief Complaint / Reason for Visit *"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                      <textarea
                        rows={2}
                        required
                        value={clinicalObservations}
                        onChange={(e) => setClinicalObservations(e.target.value)}
                        placeholder="Doctor / Practitioner Notes (recorded as authored, no automated analysis) *"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                      <textarea
                        rows={2}
                        value={prescText}
                        onChange={(e) => setPrescText(e.target.value)}
                        placeholder="Prescriptions (one per line: Medicine Name | Dosage | Duration)"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono text-[11px]"
                      />
                      <input
                        type="text"
                        value={advice}
                        onChange={(e) => setAdvice(e.target.value)}
                        placeholder="Follow-up instructions / advice (optional)"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      />
                      <button
                        type="submit"
                        disabled={savingNote}
                        className="px-4 py-2 bg-[#065F46] text-white rounded-lg font-bold inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {savingNote ? 'Saving Note...' : 'Save Visit Note (Audit-Logged)'}
                      </button>
                    </form>
                  )}

                  {notesLoading ? (
                    <div className="py-6 flex justify-center gap-2 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading encrypted clinic notes...
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="py-6 text-center text-slate-400">
                      No administrative visit notes recorded for this patient yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((n) => (
                        <div key={n.id} className="p-3.5 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-bold text-slate-900">
                              {n.visitDate} · {n.doctorName}
                            </span>
                            <span className="font-mono">{n.createdByEmail || n.createdByUid}</span>
                          </div>
                          <p className="font-semibold text-slate-800">{n.chiefComplaint}</p>
                          <p className="text-slate-600">{n.clinicalObservations}</p>
                          {n.prescriptions && n.prescriptions.length > 0 && (
                            <div className="pt-1 border-t border-slate-100 text-[11px]">
                              <p className="font-bold text-slate-700">Rx:</p>
                              <ul className="list-disc list-inside text-slate-600">
                                {n.prescriptions.map((rx, i) => (
                                  <li key={i}>
                                    {rx.medicine} — {rx.dosage} ({rx.duration})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {n.advice && <p className="text-[11px] text-[#065F46]">Advice: {n.advice}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Audit Trail */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
        <h3 className="text-sm font-extrabold text-slate-900">Clinic Access &amp; Edit Audit Trail</h3>
        {auditLogs.length === 0 ? (
          <p className="text-slate-400">No audit entries recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">{log.action}</span>{' '}
                  <span className="text-slate-500">· {log.details}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {log.actorEmail || log.actorId} · {log.createdAt.slice(0, 16).replace('T', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

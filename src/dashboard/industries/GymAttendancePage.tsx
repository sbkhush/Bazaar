import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Loader2, LogOut, QrCode, Search } from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  buildGymQrPayload,
  computeGymMemberStatus,
  getGymAttendance,
  getGymMembers,
  parseGymQrPayload,
  recordGymCheckIn,
  recordGymCheckOut,
} from '../../services/gymService';
import { GymAttendanceRecord, GymMember } from '../../types';

export const GymAttendancePage: React.FC = () => {
  const { shopId, isReadOnly } = useDashboard();
  const [members, setMembers] = useState<GymMember[]>([]);
  const [attendance, setAttendance] = useState<GymAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrInput, setQrInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedQrMember, setSelectedQrMember] = useState<GymMember | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [m, a] = await Promise.all([
        getGymMembers(shopId),
        getGymAttendance(shopId),
      ]);
      setMembers(m);
      setAttendance(a);
    } catch (err: any) {
      setError(err?.message || 'Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  useEffect(() => {
    if (!selectedQrMember || !shopId) {
      setQrDataUrl('');
      return;
    }
    const payload = buildGymQrPayload(shopId, selectedQrMember.id, selectedQrMember.qrToken);
    QRCode.toDataURL(payload, { width: 180, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [selectedQrMember, shopId]);

  const handleQrCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly || !qrInput.trim()) return;
    setError(null);
    setFeedback(null);
    const parsed = parseGymQrPayload(qrInput);
    const member = members.find(
      (m) =>
        m.id === parsed.memberId ||
        m.qrToken.toLowerCase() === parsed.qrToken.toLowerCase() ||
        m.memberCode.toLowerCase() === parsed.qrToken.toLowerCase()
    );
    if (!member) {
      setError('No matching gym member found for this QR code or member code.');
      return;
    }
    const eff = computeGymMemberStatus(member);
    if (eff === 'expired' || eff === 'cancelled') {
      setError(`${member.name}'s membership is ${eff} (expired ${member.expiryDate}). Please renew first.`);
      return;
    }
    await recordGymCheckIn(shopId, member, 'qr');
    setFeedback(`Checked in ${member.name} (${member.memberCode}) cleanly.`);
    setQrInput('');
    await load();
  };

  const today = new Date().toISOString().slice(0, 10);
  const filteredMembers = members.filter((m) =>
    `${m.name} ${m.phone} ${m.memberCode}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Daily Attendance &amp; QR Check-In</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Scan member QR pass or log manual check-ins and check-outs.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
          {error}
        </div>
      )}
      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!isReadOnly && (
          <form onSubmit={handleQrCheckIn} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#065F46]" /> Scan Member QR or Enter Member Code
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Paste QR payload (SBKHUSH-GYM|...) or Member Code (M-XXXXX)"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#065F46] text-white rounded-lg font-bold"
              >
                Verify &amp; Check In
              </button>
            </div>
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
          <h3 className="text-sm font-extrabold text-slate-900">Member QR Pass Generator</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <select
              value={selectedQrMember?.id || ''}
              onChange={(e) =>
                setSelectedQrMember(members.find((m) => m.id === e.target.value) || null)
              }
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Select member to preview QR pass...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.memberCode})
                </option>
              ))}
            </select>
            {qrDataUrl && selectedQrMember && (
              <div className="flex items-center gap-3 p-2 border border-slate-200 rounded-xl bg-slate-50">
                <img src={qrDataUrl} alt={selectedQrMember.name} className="w-20 h-20" />
                <div>
                  <p className="font-bold text-slate-900">{selectedQrMember.name}</p>
                  <p className="font-mono text-[11px] text-slate-500">{selectedQrMember.memberCode}</p>
                  <p className="font-mono text-[10px] text-slate-400">{selectedQrMember.qrToken}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-900">Manual Member Check-In</h3>
            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search member..."
                className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-[#065F46]" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {filteredMembers.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{m.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {m.memberCode} · Status: {computeGymMemberStatus(m)}
                    </p>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() =>
                        recordGymCheckIn(shopId, m, 'manual').then(() => {
                          setFeedback(`Checked in ${m.name}.`);
                          load();
                        })
                      }
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold"
                    >
                      Check In
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
          <h3 className="text-sm font-extrabold text-slate-900">
            Attendance Log ({attendance.filter((a) => a.date === today).length} today)
          </h3>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {attendance.length === 0 ? (
              <p className="py-8 text-center text-slate-400">No check-ins recorded yet.</p>
            ) : (
              attendance.slice(0, 40).map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{a.memberName}</p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      In: {new Date(a.checkInAt).toLocaleString()} ({a.method.toUpperCase()})
                      {a.checkOutAt ? ` · Out: ${new Date(a.checkOutAt).toLocaleTimeString()}` : ''}
                    </p>
                  </div>
                  {!isReadOnly && !a.checkOutAt && (
                    <button
                      type="button"
                      onClick={() => recordGymCheckOut(shopId, a.id).then(load)}
                      className="px-2.5 py-1 border border-slate-200 text-slate-700 rounded-lg font-semibold inline-flex items-center gap-1"
                    >
                      <LogOut className="w-3 h-3" /> Check Out
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

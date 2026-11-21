import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Mail, Copy, ShieldCheck, Loader2 } from 'lucide-react';
import {
  getAllSalesMembers,
  getSalesSettings,
  buildSalesmanPortalLoginUrl,
  sendSalesmanPortalReset,
} from '../../services/salesService';
import { useToast } from '../../components/common/Toast';
import { SalesMember, SalesSettings } from '../../types';

export const SalesPortalAccessPage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<SalesMember[]>([]);
  const [settings, setSettings] = useState<SalesSettings | null>(null);

  useEffect(() => {
    Promise.all([getAllSalesMembers().catch(() => []), getSalesSettings()])
      .then(([m, s]) => {
        setMembers(m);
        setSettings(s);
      })
      .finally(() => setLoading(false));
  }, []);

  const portalUrl = buildSalesmanPortalLoginUrl(settings?.portalBaseUrl);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Salesman Portal Access</h1>
          <p className="text-xs text-slate-500 mt-1">
            Dedicated individual login portal for field salesmen and sales managers. Secured via Firebase Authentication.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/salesman/login"
            className="px-4 py-2 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open Salesman Login
          </Link>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#065F46] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1 flex-1">
            <h2 className="text-sm font-bold text-slate-900">Official Salesman Portal URL</h2>
            <p className="text-xs text-slate-500">
              Share this login URL with invited representatives. Representatives claim their accounts using Google Sign-In or Firebase Auth email password reset links. Passwords are never stored or exposed in plaintext.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <code className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900">
                {portalUrl}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(portalUrl).catch(() => {});
                  showToast('Portal URL copied to clipboard.', 'success');
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Copy URL
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Representative Claim & Login Status</h3>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#065F46]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Representative</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Invite Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3 text-right">Auth Invite / Reset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No representatives added yet.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{m.fullName}</p>
                        <p className="text-[11px] text-slate-500">{m.email}</p>
                      </td>
                      <td className="px-4 py-3 capitalize">{m.role.replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                            m.inviteStatus === 'accepted'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {m.inviteStatus || 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString() : 'Never signed in'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            sendSalesmanPortalReset(m.email, m.id)
                              .then(() => showToast(`Auth invite/reset sent to ${m.email}`, 'success'))
                              .catch((e) => showToast(e.message, 'error'))
                          }
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Mail className="w-3.5 h-3.5 text-blue-600" />
                          Send Invite / Reset
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

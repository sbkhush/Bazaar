import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, LifeBuoy, Send, AlertCircle } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import { useAuth } from '../context/AuthContext';
import {
  getShopContactMessages,
  updateShopContactMessageStatus,
  getShopActivityLogs,
} from '../services/tenantService';
import {
  createSupportTicket,
  getShopSupportTickets,
} from '../services/platformService';
import { ContactMessage, ActivityLog, SupportTicket } from '../types';

export const ShopProfilePage: React.FC = () => {
  const { shopId, shop, userRole, isReadOnly } = useDashboard();
  const { currentUser, resetPassword } = useAuth();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetSent, setResetSent] = useState(false);

  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState<SupportTicket['category']>('technical');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketNotice, setTicketNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    if (!shopId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [msgs, lgs, tks] = await Promise.all([
        getShopContactMessages(shopId),
        getShopActivityLogs(shopId),
        getShopSupportTickets(shopId).catch(() => []),
      ]);
      setMessages(msgs);
      setLogs(lgs);
      setTickets(tks);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not load profile data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shopId]);

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;
    setErrorMsg(null);
    try {
      await resetPassword(currentUser.email);
      setResetSent(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not send password reset email.');
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !ticketSubject.trim() || !ticketMessage.trim()) return;
    setSubmittingTicket(true);
    setTicketNotice(null);
    setErrorMsg(null);
    try {
      await createSupportTicket({
        shopId,
        shopName: shop?.name || shopId,
        userId: currentUser?.uid || shop?.ownerId || 'owner',
        userEmail: currentUser?.email || shop?.ownerEmail || '',
        subject: ticketSubject.trim(),
        category: ticketCategory,
        priority: 'medium',
        message: ticketMessage.trim(),
      });
      setTicketSubject('');
      setTicketMessage('');
      setTicketNotice('Support ticket sent to SB Khush Platform Administration.');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit support ticket.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Owner Profile, Support &amp; Activity</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your security credentials, contact platform support, respond to customer inquiries, and audit recent actions.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Account Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <p className="text-sm font-extrabold text-slate-900">{currentUser?.displayName || shop?.ownerName}</p>
          <p className="text-slate-600">{currentUser?.email}</p>
          <p className="text-slate-500 uppercase font-bold text-[11px]">
            Role: {userRole.replace('_', ' ')} · Store: {shop?.name}
          </p>
        </div>
        {!isReadOnly && (
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <button
              type="button"
              onClick={handlePasswordReset}
              className="px-4 py-2 border border-slate-300 rounded-xl font-semibold hover:bg-slate-50"
            >
              Send Password Reset Email
            </button>
            {resetSent && (
              <span className="text-emerald-700 font-semibold">Reset instructions emailed!</span>
            )}
          </div>
        )}
      </div>

      {/* Submit Support Ticket to Platform Owner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-4 h-4 text-[#065F46]" />
          <h3 className="text-sm font-extrabold text-slate-900">
            Platform Support Desk ({tickets.length} tickets)
          </h3>
        </div>

        {ticketNotice && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-semibold">
            {ticketNotice}
          </div>
        )}

        {!isReadOnly && (
          <form onSubmit={handleSubmitTicket} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              placeholder="Ticket subject (e.g. Plan upgrade inquiry)"
              className="sm:col-span-2 px-3 py-2 border border-slate-200 rounded-lg"
            />
            <select
              value={ticketCategory}
              onChange={(e) => setTicketCategory(e.target.value as SupportTicket['category'])}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="billing">Billing / Plan Upgrade</option>
              <option value="technical">Technical Support</option>
              <option value="onboarding">Store Onboarding</option>
              <option value="other">General Question</option>
            </select>
            <textarea
              rows={2}
              required
              value={ticketMessage}
              onChange={(e) => setTicketMessage(e.target.value)}
              placeholder="Describe how our team can help your store..."
              className="sm:col-span-3 px-3 py-2 border border-slate-200 rounded-lg"
            />
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={submittingTicket}
                className="px-4 py-2 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl font-bold flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {submittingTicket ? 'Submitting...' : 'Submit Support Ticket'}
              </button>
            </div>
          </form>
        )}

        {tickets.length > 0 && (
          <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
            {tickets.map((t) => (
              <div key={t.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{t.subject}</span>
                  <span
                    className={`uppercase font-bold text-[10px] ${
                      t.status === 'resolved'
                        ? 'text-emerald-700'
                        : t.status === 'in_progress'
                        ? 'text-blue-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-slate-600">{t.message}</p>
                {t.adminReply && (
                  <div className="mt-1.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                    <strong>Platform Reply:</strong> {t.adminReply}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center text-xs text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading inbox &amp; logs...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Messages */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
            <h3 className="text-sm font-extrabold text-slate-900">
              Customer Inquiries ({messages.length})
            </h3>
            {messages.length === 0 ? (
              <p className="text-slate-500 py-6 text-center">No customer contact inquiries yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {messages.map((m) => (
                  <div key={m.id} className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{m.name} ({m.email})</span>
                      <span className={`font-bold uppercase text-[10px] ${m.status === 'resolved' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {m.status}
                      </span>
                    </div>
                    {m.subject && <p className="font-semibold text-slate-700">{m.subject}</p>}
                    <p className="text-slate-600">{m.message}</p>
                    {!isReadOnly && m.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => updateShopContactMessageStatus(shopId, m.id, 'resolved').then(loadData)}
                        className="text-[11px] font-bold text-[#065F46] hover:underline flex items-center gap-1 pt-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Mark Resolved
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Logs */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
            <h3 className="text-sm font-extrabold text-slate-900">Shop Activity Audit Trail</h3>
            {logs.length === 0 ? (
              <p className="text-slate-500 py-6 text-center">No actions recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {logs.map((l) => (
                  <div key={l.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">{l.action}</p>
                      <p className="text-[11px] text-slate-600">{l.details}</p>
                      <p className="text-[10px] text-slate-400">{l.actorEmail}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

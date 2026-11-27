import React, { useEffect, useState } from 'react';
import { Loader2, MessageSquare, CheckCircle2, Clock, Send } from 'lucide-react';
import { getAllSupportTickets, updateSupportTicket } from '../services/platformService';
import { SupportTicket } from '../types';

export const SuperAdminSupportPage: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('open');
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [statusChoice, setStatusChoice] = useState<SupportTicket['status']>('in_progress');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getAllSupportTickets();
      setTickets(list);
    } catch (err: any) {
      setError(err?.message || 'Could not load support tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const visible = tickets.filter((t) => (filter === 'all' ? true : t.status === filter));

  const openTicketModal = (t: SupportTicket) => {
    setSelected(t);
    setReplyText(t.adminReply || '');
    setStatusChoice(t.status === 'open' ? 'in_progress' : t.status);
  };

  const handleSaveReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await updateSupportTicket(selected.id, {
        status: statusChoice,
        adminReply: replyText.trim(),
      });
      setSelected(null);
      await loadTickets();
    } catch (err: any) {
      setError(err?.message || 'Could not save support response.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Merchant Support Tickets</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Respond to merchant billing, technical, and feature requests submitted from Shop Profile.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['open', 'in_progress', 'resolved', 'all'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilter(st)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize border transition ${
              filter === st
                ? 'bg-[#065F46] text-white border-[#065F46]'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {st.replace('_', ' ')} ({st === 'all' ? tickets.length : tickets.filter((t) => t.status === st).length})
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading support queue...
          </div>
        ) : visible.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-500">
            No {filter.replace('_', ' ')} support tickets found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map((t) => (
              <div key={t.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900">{t.subject}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold uppercase text-[10px]">
                      {t.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        t.priority === 'high'
                          ? 'bg-red-50 text-red-700'
                          : t.priority === 'medium'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-bold uppercase text-[11px] ${
                        t.status === 'resolved'
                          ? 'text-emerald-700'
                          : t.status === 'in_progress'
                          ? 'text-amber-700'
                          : 'text-blue-700'
                      }`}
                    >
                      {t.status === 'resolved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{t.message}</p>
                  <p className="text-[11px] text-slate-400">
                    Shop: <strong className="text-slate-600">{t.shopName || t.shopId || 'Platform'}</strong> · From:{' '}
                    {t.userEmail} · {new Date(t.createdAt).toLocaleString()}
                  </p>
                  {t.adminReply && (
                    <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                      <strong>Admin Reply:</strong> {t.adminReply}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openTicketModal(t)}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold flex items-center gap-1.5 self-start sm:self-center shrink-0"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#065F46]" />
                  {t.adminReply ? 'Update Reply' : 'Respond'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveReply} className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
            <h3 className="text-base font-extrabold text-slate-900">Reply to Ticket: {selected.subject}</h3>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
              {selected.message}
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ticket Status</label>
              <select
                value={statusChoice}
                onChange={(e) => setStatusChoice(e.target.value as SupportTicket['status'])}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Admin Response</label>
              <textarea
                rows={4}
                required
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a clear response for the merchant..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#065F46] hover:bg-emerald-900 text-white rounded-lg font-bold flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> {saving ? 'Sending...' : 'Save Response'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

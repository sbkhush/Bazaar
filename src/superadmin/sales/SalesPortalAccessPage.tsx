import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Mail, Copy, ShieldCheck, Loader2, FileText, Plus, Trash2 } from 'lucide-react';
import {
  getAllSalesMembers,
  getSalesSettings,
  buildSalesmanPortalLoginUrl,
  buildSalesManagerPortalLoginUrl,
  buildReferralPortalLoginUrl,
  sendSalesmanPortalReset,
  getApprovedSalesMaterials,
  saveSalesMaterial,
  deleteSalesMaterial,
} from '../../services/salesService';
import { useToast } from '../../components/common/Toast';
import { SalesMember, SalesSettings, SalesMaterial } from '../../types';

export const SalesPortalAccessPage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [members, setMembers] = useState<SalesMember[]>([]);
  const [settings, setSettings] = useState<SalesSettings | null>(null);
  const [materials, setMaterials] = useState<SalesMaterial[]>([]);
  const [matForm, setMatForm] = useState({
    title: '',
    category: 'brochure' as SalesMaterial['category'],
    audience: 'all_sales' as SalesMaterial['audience'],
    description: '',
    fileUrl: '',
  });
  const [savingMat, setSavingMat] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [m, s, mats] = await Promise.all([
        getAllSalesMembers(),
        getSalesSettings(),
        getApprovedSalesMaterials(),
      ]);
      setMembers(m);
      setSettings(s);
      setMaterials(mats);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load portal access directory from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const portalUrl = buildSalesmanPortalLoginUrl(settings?.portalBaseUrl);
  const managerPortalUrl = buildSalesManagerPortalLoginUrl(settings?.portalBaseUrl);
  const referralPortalUrl = buildReferralPortalLoginUrl(settings?.portalBaseUrl);

  const handlePublishMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matForm.title.trim()) {
      showToast('Material title is required.', 'info');
      return;
    }
    setSavingMat(true);
    try {
      await saveSalesMaterial({
        title: matForm.title.trim(),
        category: matForm.category,
        audience: matForm.audience,
        description: matForm.description.trim(),
        fileUrl: matForm.fileUrl.trim(),
        isActive: true,
      });
      showToast('Approved sales material published.', 'success');
      setMatForm({ title: '', category: 'brochure', audience: 'all_sales', description: '', fileUrl: '' });
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to publish material.', 'error');
    } finally {
      setSavingMat(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Role-Isolated Sales Portals</h1>
          <p className="text-xs text-slate-500 mt-1">
            Dedicated RBAC-enforced portals for Sales Managers, Salesmen, and Referral Agents. Sales roles never receive Super Admin privileges.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/sales-manager/login"
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Manager Portal
          </Link>
          <Link
            to="/salesman/login"
            className="px-3.5 py-2 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Salesman Portal
          </Link>
          <Link
            to="/referral/login"
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Referral Portal
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-rose-800">{loadError}</span>
          <button
            type="button"
            onClick={loadData}
            className="px-3.5 py-1.5 rounded-lg bg-rose-700 text-white font-bold hover:bg-rose-800 self-start sm:self-auto"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#065F46] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2 flex-1">
            <h2 className="text-sm font-bold text-slate-900">Isolated Portal Login URLs</h2>
            <p className="text-xs text-slate-500">
              Each role enters only its dedicated portal. Firebase Authentication verifies identity while RBAC guards enforce least-privilege access.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
              {[
                { label: 'Sales Manager Portal', url: managerPortalUrl },
                { label: 'Salesman Portal', url: portalUrl },
                { label: 'Referral Agent Portal', url: referralPortalUrl },
              ].map((p) => (
                <div key={p.label} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <p className="font-bold text-slate-900">{p.label}</p>
                  <code className="block text-[11px] font-mono text-slate-700 break-all">{p.url}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(p.url).catch(() => {});
                      showToast(`${p.label} URL copied.`, 'success');
                    }}
                    className="text-[11px] font-bold text-[#065F46] inline-flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy Link
                  </button>
                </div>
              ))}
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

      {/* Super Admin Approved Sales Materials Publisher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#065F46]" />
          <h3 className="text-sm font-bold text-slate-900">Approved Sales Materials</h3>
        </div>
        <form onSubmit={handlePublishMaterial} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <input
            value={matForm.title}
            onChange={(e) => setMatForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Title (e.g., Retail POS Pitch Deck)"
            className="px-3 py-2 border border-slate-200 rounded-xl"
            required
          />
          <select
            value={matForm.category}
            onChange={(e) => setMatForm((p) => ({ ...p, category: e.target.value as SalesMaterial['category'] }))}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white"
          >
            <option value="brochure">Brochure</option>
            <option value="pitch_deck">Pitch Deck</option>
            <option value="pricing_sheet">Pricing Sheet</option>
            <option value="whatsapp_script">WhatsApp Script</option>
            <option value="demo_video">Demo Video</option>
          </select>
          <input
            value={matForm.fileUrl}
            onChange={(e) => setMatForm((p) => ({ ...p, fileUrl: e.target.value }))}
            placeholder="Optional HTTPS resource URL"
            className="px-3 py-2 border border-slate-200 rounded-xl"
          />
          <button
            type="submit"
            disabled={savingMat}
            className="px-4 py-2 rounded-xl bg-[#065F46] hover:bg-emerald-900 text-white font-bold inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {savingMat ? 'Publishing...' : 'Publish Material'}
          </button>
          <input
            value={matForm.description}
            onChange={(e) => setMatForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Summary or key talking points for field reps..."
            className="md:col-span-4 px-3 py-2 border border-slate-200 rounded-xl"
          />
        </form>

        <div className="divide-y divide-slate-100 text-xs">
          {materials.length === 0 ? (
            <p className="text-slate-400 py-3 text-center">No approved sales materials published yet.</p>
          ) : (
            materials.map((mat) => (
              <div key={mat.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">
                    {mat.title}{' '}
                    <span className="text-[11px] font-semibold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full ml-1">
                      {mat.category.replace('_', ' ')}
                    </span>
                  </p>
                  {mat.description && <p className="text-[11px] text-slate-500 mt-0.5">{mat.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    deleteSalesMaterial(mat.id)
                      .then(() => {
                        showToast('Material removed.', 'success');
                        return loadData();
                      })
                      .catch((err) => showToast(err.message, 'error'))
                  }
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                  title="Remove material"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

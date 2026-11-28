import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Loader2, AlertCircle } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import {
  getShopBanners,
  saveShopBanner,
  deleteShopBanner,
} from '../services/tenantService';
import { Banner } from '../types';
import { ImageUploader } from '../components/common/ImageUploader';

export const ShopBannersPage: React.FC = () => {
  const { shopId, isReadOnly } = useDashboard();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Banner> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadBanners = async () => {
    if (!shopId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      setBanners(await getShopBanners(shopId, true));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load banners.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
  }, [shopId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || isReadOnly) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const normalizedBanner: Partial<Banner> = {
        ...editing,
        buttonText: String(editing.buttonText || '').trim() || 'Shop Now',
        link: String(editing.link || '').trim() || '/shop',
      };
      await saveShopBanner(shopId, normalizedBanner);
      setEditing(null);
      await loadBanners();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save promotional banner.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bannerId: string) => {
    setErrorMsg(null);
    try {
      await deleteShopBanner(shopId, bannerId);
      await loadBanners();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete banner.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Promotional Banners</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage homepage hero slides and seasonal campaigns.</p>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() =>
              setEditing({
                title: '',
                subtitle: '',
                link: '/shop',
                imageUrl: '',
                buttonText: 'Shop Now',
                isActive: true,
                order: banners.length + 1,
              })
            }
            className="px-4 py-2.5 bg-[#065F46] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 self-start"
          >
            <Plus className="w-4 h-4" /> Add Banner
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center text-xs text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading banners...
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
          No custom banners added yet (your storefront uses the default editorial banner).
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map((b) => (
            <div key={b.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <img src={b.imageUrl} alt={b.title} className="w-full h-40 object-cover bg-slate-100" />
              <div className="p-4 flex-1 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{b.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">{b.subtitle}</p>
                  <p className="text-[10px] font-semibold text-[#065F46] truncate">
                    CTA: {(b.buttonText || '').trim() || 'Shop Now'} → {b.link || '/shop'}
                  </p>
                </div>
                {!isReadOnly && (
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" onClick={() => setEditing(b)} className="p-1.5 border border-slate-200 rounded-lg">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b.id)}
                      className="p-1.5 border border-red-200 text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              {editing.id ? 'Edit Banner' : 'Add Promotional Banner'}
            </h3>
            <div className="space-y-3 text-xs">
              <input
                type="text"
                required
                value={editing.title || ''}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Headline Title"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                value={editing.subtitle || ''}
                onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                placeholder="Subtitle / Offer details"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={editing.buttonText || ''}
                  onChange={(e) => setEditing({ ...editing, buttonText: e.target.value })}
                  placeholder="Button Label"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={editing.link || '/shop'}
                  onChange={(e) => setEditing({ ...editing, link: e.target.value })}
                  placeholder="Target Link (/shop)"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <ImageUploader
                shopId={shopId}
                folder="banners"
                images={editing.imageUrl ? [editing.imageUrl] : []}
                onChange={(imgs) => setEditing({ ...editing, imageUrl: imgs[0] || '' })}
                label="Banner Artwork (16:9 Recommended)"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-[#065F46] text-white rounded-lg text-xs font-bold">
                {saving ? 'Saving...' : 'Save Banner'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

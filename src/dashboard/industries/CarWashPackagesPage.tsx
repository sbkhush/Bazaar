import React, { useEffect, useState } from 'react';
import { Loader2, Package, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  CARWASH_PRESET_PACKAGES,
  deleteCarWashPackage,
  getCarWashPackages,
  saveCarWashPackage,
} from '../../services/carwashService';
import { CarWashServicePackage } from '../../types';
import { formatPKR } from '../../data/seedData';

const PACKAGE_CATEGORIES: CarWashServicePackage['category'][] = [
  'Basic Wash',
  'Premium Wash',
  'Interior Cleaning',
  'Exterior Detailing',
  'Full Detailing',
  'Polish & Wax',
  'Engine Cleaning',
  'Bike Wash',
  'Custom',
];

export const CarWashPackagesPage: React.FC = () => {
  const { shopId, isReadOnly } = useDashboard();
  const [packages, setPackages] = useState<CarWashServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<CarWashServicePackage['category']>('Basic Wash');
  const [vehicleType, setVehicleType] = useState<CarWashServicePackage['vehicleType']>('Sedan');
  const [price, setPrice] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('35');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [seedingPresets, setSeedingPresets] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      setPackages(await getCarWashPackages(shopId));
    } catch (err: any) {
      setError(err?.message || 'Failed to load wash packages.');
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
      await saveCarWashPackage(shopId, {
        name,
        category,
        vehicleType,
        price: Number(price) || 0,
        estimatedMinutes: Number(estimatedMinutes) || 30,
        description,
        isActive: true,
      });
      setName('');
      setPrice('');
      setDescription('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create wash package.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadRecommendedPresets = async () => {
    if (!shopId || isReadOnly) return;
    setSeedingPresets(true);
    setError(null);
    try {
      const existingNames = new Set(packages.map((p) => p.name.toLowerCase()));
      for (const preset of CARWASH_PRESET_PACKAGES) {
        if (!existingNames.has(preset.name.toLowerCase())) {
          await saveCarWashPackage(shopId, { ...preset, isActive: true });
        }
      }
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to add preset packages.');
    } finally {
      setSeedingPresets(false);
    }
  };

  const handleToggleActive = async (pkg: CarWashServicePackage) => {
    if (!shopId || isReadOnly) return;
    await saveCarWashPackage(shopId, { ...pkg, isActive: !pkg.isActive });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!shopId || isReadOnly) return;
    await deleteCarWashPackage(shopId, id);
    await load();
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading Service Packages...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Wash &amp; Detailing Packages</h2>
          <p className="text-slate-500 mt-0.5">
            Active packages appear on your station&apos;s public booking page and job card intake desk.
          </p>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            disabled={seedingPresets}
            onClick={handleLoadRecommendedPresets}
            className="px-3.5 py-2 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-[#065F46] rounded-xl font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {seedingPresets ? 'Adding Presets...' : 'Add Recommended Preset Packages'}
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium">
          {error}
        </div>
      )}

      {!isReadOnly && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
        >
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#065F46]" /> Add Wash / Detailing Package
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Package Title *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CarWashServicePackage['category'])}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              {PACKAGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as CarWashServicePackage['vehicleType'])}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              {(['Sedan', 'Hatchback', 'SUV', '4x4', 'Bike', 'Van', 'All'] as CarWashServicePackage['vehicleType'][]).map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                )
              )}
            </select>
            <input
              required
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price (PKR) *"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
            <input
              type="number"
              min="10"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="Est. Minutes"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's included (e.g. Snow foam, vacuum, tyre shine)"
              className="flex-1 min-w-[240px] px-3 py-2 border border-slate-200 rounded-lg"
            />
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#065F46] text-white rounded-xl font-bold disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Package'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Package className="w-4 h-4 text-[#065F46]" /> Service Menu ({packages.length})
        </h3>
        {packages.length === 0 ? (
          <p className="py-10 text-center text-slate-400">
            No wash packages configured yet. Create your first package above or click &quot;Add Recommended Preset Packages&quot;.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {packages.map((p) => (
              <div
                key={p.id}
                className={`border rounded-xl p-4 space-y-2 ${
                  p.isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{p.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {p.category} · {p.vehicleType} · ~{p.estimatedMinutes} mins
                    </p>
                  </div>
                  <span className="font-extrabold text-[#065F46] tabular-nums">
                    {formatPKR(p.price)}
                  </span>
                </div>
                {p.description && <p className="text-[11px] text-slate-600">{p.description}</p>}
                {!isReadOnly && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(p)}
                      className="text-[11px] font-bold text-slate-700 hover:text-[#065F46]"
                    >
                      {p.isActive ? 'Active (Hide from Public)' : 'Hidden (Activate)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Delete package"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

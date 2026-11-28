import React, { useEffect, useState } from 'react';
import {
  Car,
  Edit3,
  Loader2,
  Lock,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  deleteDealerVehicle,
  getDealerVehicles,
  saveDealerVehicle,
} from '../../services/carDealerService';
import { DealerVehicle, DealerVehicleStatus } from '../../types';
import { formatPKR } from '../../data/seedData';
import { ImageUploader } from '../../components/common/ImageUploader';
import { SafeImage } from '../../components/common/SafeImage';

const VEHICLE_STATUSES: DealerVehicleStatus[] = [
  'Available',
  'Reserved',
  'Sold',
  'Under Inspection',
  'Inactive',
];

export const DealerInventoryPage: React.FC = () => {
  const { shopId, isReadOnly, hasPermission } = useDashboard();
  const canViewPrivatePricing = hasPermission('dealer_private_pricing');

  const [vehicles, setVehicles] = useState<DealerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DealerVehicleStatus>('all');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [variant, setVariant] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [registrationCity, setRegistrationCity] = useState('Lahore');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [mileageKm, setMileageKm] = useState('35000');
  const [transmission, setTransmission] = useState<DealerVehicle['transmission']>('Automatic');
  const [fuelType, setFuelType] = useState<DealerVehicle['fuelType']>('Petrol');
  const [engineCapacity, setEngineCapacity] = useState('1500cc');
  const [color, setColor] = useState('White');
  const [condition, setCondition] = useState<DealerVehicle['condition']>('Used');
  const [exteriorDetails, setExteriorDetails] = useState('');
  const [interiorDetails, setInteriorDetails] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [askingPrice, setAskingPrice] = useState('');
  const [status, setStatus] = useState<DealerVehicleStatus>('Available');
  const [featured, setFeatured] = useState(false);

  // Private fields (strictly excluded from publicVehicles)
  const [purchasePrice, setPurchasePrice] = useState('');
  const [commissionAmount, setCommissionAmount] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      setVehicles(await getDealerVehicles(shopId));
    } catch (err: any) {
      setError(err?.message || 'Could not load showroom inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const resetForm = () => {
    setEditingId(null);
    setMake('');
    setModel('');
    setVariant('');
    setYear(String(new Date().getFullYear()));
    setRegistrationCity('Lahore');
    setRegistrationNumber('');
    setMileageKm('35000');
    setTransmission('Automatic');
    setFuelType('Petrol');
    setEngineCapacity('1500cc');
    setColor('White');
    setCondition('Used');
    setExteriorDetails('');
    setInteriorDetails('');
    setImages([]);
    setAskingPrice('');
    setStatus('Available');
    setFeatured(false);
    setPurchasePrice('');
    setCommissionAmount('');
    setInternalNotes('');
  };

  const handleEdit = (v: DealerVehicle) => {
    setEditingId(v.id);
    setMake(v.make);
    setModel(v.model);
    setVariant(v.variant || '');
    setYear(String(v.year));
    setRegistrationCity(v.registrationCity);
    setRegistrationNumber(v.registrationNumber || '');
    setMileageKm(String(v.mileageKm));
    setTransmission(v.transmission);
    setFuelType(v.fuelType);
    setEngineCapacity(v.engineCapacity);
    setColor(v.color || 'White');
    setCondition(v.condition || 'Used');
    setExteriorDetails(v.exteriorDetails || '');
    setInteriorDetails(v.interiorDetails || '');
    setImages(v.images || []);
    setAskingPrice(String(v.askingPrice));
    setStatus(v.status);
    setFeatured(Boolean(v.featured));
    setPurchasePrice(v.purchasePrice !== undefined ? String(v.purchasePrice) : '');
    setCommissionAmount(v.commissionAmount !== undefined ? String(v.commissionAmount) : '');
    setInternalNotes(v.internalNotes || '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly) return;
    setSaving(true);
    setError(null);
    try {
      const existing = editingId ? vehicles.find((x) => x.id === editingId) : undefined;
      await saveDealerVehicle(shopId, {
        id: editingId || undefined,
        createdAt: existing?.createdAt,
        make,
        model,
        variant,
        year: Number(year) || new Date().getFullYear(),
        registrationCity,
        registrationNumber: canViewPrivatePricing
          ? registrationNumber
          : existing?.registrationNumber,
        mileageKm: Number(mileageKm) || 0,
        transmission,
        fuelType,
        engineCapacity,
        color,
        condition,
        exteriorDetails,
        interiorDetails,
        images,
        askingPrice: Number(askingPrice) || 0,
        purchasePrice: canViewPrivatePricing
          ? purchasePrice !== ''
            ? Number(purchasePrice)
            : undefined
          : existing?.purchasePrice,
        commissionAmount: canViewPrivatePricing
          ? commissionAmount !== ''
            ? Number(commissionAmount)
            : undefined
          : existing?.commissionAmount,
        internalNotes: canViewPrivatePricing ? internalNotes : existing?.internalNotes,
        status,
        featured,
      });
      resetForm();
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save vehicle.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vehicleId: string) => {
    if (!shopId || isReadOnly) return;
    setError(null);
    try {
      await deleteDealerVehicle(shopId, vehicleId);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not remove vehicle.');
    }
  };

  const computedExpectedProfit =
    askingPrice !== '' && purchasePrice !== ''
      ? Number(askingPrice) - Number(purchasePrice) - Number(commissionAmount || 0)
      : null;

  const filtered = vehicles.filter((v) => {
    if (statusFilter !== 'all' && v.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      v.title.toLowerCase().includes(q) ||
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.registrationCity.toLowerCase().includes(q) ||
      (v.registrationNumber || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading Showroom Inventory...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Vehicle Inventory &amp; Showroom Catalog</h2>
          <p className="text-slate-500 mt-0.5">
            Available &amp; Reserved vehicles automatically publish sanitized specs to your public showroom. Purchase cost, profit &amp; plate notes remain strictly private.
          </p>
        </div>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold"
          >
            Cancel Edit
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
          onSubmit={handleSave}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#065F46]" />{' '}
            {editingId ? 'Edit Vehicle Listing' : 'Add Vehicle to Showroom'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              required
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Make (e.g. Toyota, Honda) *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model (e.g. Corolla, Civic) *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              placeholder="Variant (e.g. Altis Grande X)"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              required
              type="number"
              min="1970"
              max="2030"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Model Year *"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              value={registrationCity}
              onChange={(e) => setRegistrationCity(e.target.value)}
              placeholder="Registration City (Lahore, Islamabad...)"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="number"
              min="0"
              value={mileageKm}
              onChange={(e) => setMileageKm(e.target.value)}
              placeholder="Mileage (KM)"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
            <select
              value={transmission}
              onChange={(e) => setTransmission(e.target.value as DealerVehicle['transmission'])}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
              <option value="CVT">CVT</option>
              <option value="Hybrid e-CVT">Hybrid e-CVT</option>
            </select>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as DealerVehicle['fuelType'])}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="Petrol">Petrol</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Diesel">Diesel</option>
              <option value="Electric">Electric</option>
              <option value="CNG">CNG</option>
            </select>
            <input
              value={engineCapacity}
              onChange={(e) => setEngineCapacity(e.target.value)}
              placeholder="Engine (e.g. 1800cc)"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Exterior Color"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as DealerVehicle['condition'])}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="Used">Used</option>
              <option value="New">New</option>
              <option value="Imported">Imported (Japanese / UK)</option>
              <option value="Certified">Showroom Certified</option>
            </select>
            <input
              required
              type="number"
              min="0"
              value={askingPrice}
              onChange={(e) => setAskingPrice(e.target.value)}
              placeholder="Public Asking Price (PKR) *"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums font-bold"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DealerVehicleStatus)}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              {VEHICLE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
              />
              Featured on Showroom
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <textarea
              rows={2}
              value={exteriorDetails}
              onChange={(e) => setExteriorDetails(e.target.value)}
              placeholder="Exterior details (e.g. Bumper to bumper genuine, 1 fender touchup, alloy rims)"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <textarea
              rows={2}
              value={interiorDetails}
              onChange={(e) => setInteriorDetails(e.target.value)}
              placeholder="Interior details (e.g. Leather seats, cruise control, android panel)"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          {shopId && (
            <ImageUploader
              shopId={shopId}
              folder="vehicles"
              images={images}
              onChange={setImages}
              multiple={true}
              maxImages={8}
              label="Vehicle Photos (Public Showroom Gallery)"
            />
          )}

          {canViewPrivatePricing && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-extrabold text-slate-900 inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-600" />
                  Private Showroom Financials &amp; Registration (Never Visible Publicly)
                </span>
                {computedExpectedProfit !== null && (
                  <span
                    className={`font-extrabold tabular-nums ${
                      computedExpectedProfit >= 0 ? 'text-[#065F46]' : 'text-red-700'
                    }`}
                  >
                    Est. Net Margin: {formatPKR(computedExpectedProfit)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                  placeholder="Private Reg # (e.g. LEA-9821)"
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono uppercase"
                />
                <input
                  type="number"
                  min="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="Purchase / Cost Price (PKR)"
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white tabular-nums"
                />
                <input
                  type="number"
                  min="0"
                  value={commissionAmount}
                  onChange={(e) => setCommissionAmount(e.target.value)}
                  placeholder="Broker / Staff Commission (PKR)"
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white tabular-nums"
                />
                <input
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Seller phone / token note / file status"
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl font-bold disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Update Vehicle' : 'Publish Vehicle'}
            </button>
          </div>
        </form>
      )}

      {/* Vehicle List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold border ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              All ({vehicles.length})
            </button>
            {VEHICLE_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-semibold border ${
                  statusFilter === st
                    ? 'bg-[#065F46] text-white border-[#065F46]'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {st} ({vehicles.filter((v) => v.status === st).length})
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search make, model, city..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-slate-400">No vehicles found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((v) => (
              <div
                key={v.id}
                className="border border-slate-200 rounded-xl p-4 flex gap-3.5 bg-white"
              >
                <div className="w-28 h-24 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {v.images && v.images[0] ? (
                    <SafeImage
                      src={v.images[0]}
                      alt={v.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Car className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold text-slate-900 truncate flex items-center gap-1">
                      {v.featured && <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {v.title}
                    </p>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] shrink-0">
                      {v.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {v.registrationCity} · {v.mileageKm.toLocaleString()} km · {v.transmission} ·{' '}
                    {v.fuelType} · {v.engineCapacity}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="font-extrabold text-[#065F46] text-sm tabular-nums">
                      {formatPKR(v.askingPrice)}
                    </span>
                    {canViewPrivatePricing && v.purchasePrice !== undefined && (
                      <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                        Cost: {formatPKR(v.purchasePrice)} · Est. Profit:{' '}
                        {formatPKR(v.expectedProfit || v.askingPrice - v.purchasePrice)}
                      </span>
                    )}
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleEdit(v)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-[#065F46] font-semibold inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(v.id)}
                        className="px-2.5 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

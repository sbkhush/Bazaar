import React, { useEffect, useState } from 'react';
import { Car, Loader2, Plus, Search, Users } from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  getCarWashCustomers,
  getCarWashJobs,
  getCarWashVehicles,
  saveCarWashCustomer,
  saveCarWashVehicle,
} from '../../services/carwashService';
import { CarWashCustomer, CarWashJobCard, CarWashVehicle } from '../../types';
import { formatPKR } from '../../data/seedData';

export const CarWashVehiclesPage: React.FC = () => {
  const { shopId, isReadOnly } = useDashboard();
  const [customers, setCustomers] = useState<CarWashCustomer[]>([]);
  const [vehicles, setVehicles] = useState<CarWashVehicle[]>([]);
  const [jobs, setJobs] = useState<CarWashJobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [makeModel, setMakeModel] = useState('');
  const [vehicleType, setVehicleType] = useState<CarWashVehicle['vehicleType']>('Sedan');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const [c, v, j] = await Promise.all([
        getCarWashCustomers(shopId),
        getCarWashVehicles(shopId),
        getCarWashJobs(shopId),
      ]);
      setCustomers(c);
      setVehicles(v);
      setJobs(j);
    } catch (err: any) {
      setError(err?.message || 'Failed to load car wash vehicles & customers.');
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
      const existingCust = customers.find(
        (c) => c.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')
      );
      const cust =
        existingCust ||
        (await saveCarWashCustomer(shopId, {
          name,
          phone,
          totalVisits: 0,
          totalSpent: 0,
        }));
      await saveCarWashVehicle(shopId, {
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        plateNumber,
        makeModel,
        vehicleType,
        color,
      });
      setName('');
      setPhone('');
      setPlateNumber('');
      setMakeModel('');
      setColor('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not register vehicle.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading Customers &amp; Vehicles...
      </div>
    );
  }

  const filteredVehicles = vehicles.filter((v) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      v.plateNumber.toLowerCase().includes(q) ||
      v.makeModel.toLowerCase().includes(q) ||
      v.customerName.toLowerCase().includes(q) ||
      v.customerPhone.toLowerCase().includes(q)
    );
  });

  const historyJobs = selectedPlate
    ? jobs.filter((j) => j.plateNumber === selectedPlate)
    : [];

  return (
    <div className="space-y-6 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Customers &amp; Vehicle Registry</h2>
          <p className="text-slate-500 mt-0.5">
            Track repeat vehicle owners, license plates &amp; full wash/detailing service history.
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-bold text-slate-700">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Users className="w-3.5 h-3.5 text-[#065F46]" /> {customers.length} Customers
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Car className="w-3.5 h-3.5 text-[#065F46]" /> {vehicles.length} Vehicles
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium">
          {error}
        </div>
      )}

      {!isReadOnly && (
        <form
          onSubmit={handleSave}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
        >
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#065F46]" /> Register Customer &amp; Vehicle
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Owner Name *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              required
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              placeholder="Plate # (LEA-123) *"
              className="px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase"
            />
            <input
              required
              value={makeModel}
              onChange={(e) => setMakeModel(e.target.value)}
              placeholder="Make & Model *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as CarWashVehicle['vehicleType'])}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              {(['Sedan', 'Hatchback', 'SUV', '4x4', 'Bike', 'Van', 'All'] as CarWashVehicle['vehicleType'][]).map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                )
              )}
            </select>
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Color (White, Black...)"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#065F46] text-white rounded-xl font-bold disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Vehicle'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-900">Registered Vehicles</h3>
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plate or owner..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {filteredVehicles.length === 0 ? (
            <p className="py-10 text-center text-slate-400">No vehicles registered yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredVehicles.map((v) => {
                const visits = jobs.filter((j) => j.plateNumber === v.plateNumber).length;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedPlate(v.plateNumber)}
                    className={`w-full text-left py-3 px-2 rounded-lg flex items-center justify-between gap-3 transition ${
                      selectedPlate === v.plateNumber ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        <span className="font-mono">{v.plateNumber}</span> · {v.makeModel} ({v.vehicleType})
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {v.customerName} ({v.customerPhone}){v.color ? ` · ${v.color}` : ''}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold tabular-nums">
                      {visits} visits
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900">
            {selectedPlate ? `Service History — ${selectedPlate}` : 'Select a Vehicle for History'}
          </h3>
          {!selectedPlate ? (
            <p className="py-10 text-center text-slate-400">
              Click any vehicle from the list to inspect past wash &amp; detailing jobs.
            </p>
          ) : historyJobs.length === 0 ? (
            <p className="py-8 text-center text-slate-400">No job cards recorded for {selectedPlate} yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyJobs.map((j) => (
                <div key={j.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{j.packageName}</p>
                    <p className="text-[11px] text-slate-500">
                      {j.scheduledDate} · {j.jobNumber} · {j.status}
                    </p>
                  </div>
                  <span className="font-bold text-[#065F46] tabular-nums">
                    {formatPKR(j.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

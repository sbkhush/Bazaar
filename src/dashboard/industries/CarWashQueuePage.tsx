import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPlus,
  Loader2,
  MessageCircle,
  Search,
  Wallet,
} from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  CARWASH_JOB_STATUSES,
  computeCarWashJobTotal,
  getCarWashJobs,
  getCarWashPackages,
  saveCarWashCustomer,
  saveCarWashJobCard,
  saveCarWashVehicle,
  updateCarWashJobStatus,
} from '../../services/carwashService';
import {
  formatWhatsAppReminderUrl,
  recordIndustryPayment,
} from '../../services/industryCommonService';
import { getShopStaff } from '../../services/tenantService';
import {
  CarWashJobCard,
  CarWashJobStatus,
  CarWashServicePackage,
  ManualPaymentMethod,
  StaffMember,
} from '../../types';
import { formatPKR } from '../../data/seedData';

const STATUS_STYLE: Record<CarWashJobStatus, string> = {
  Booked: 'bg-sky-50 text-sky-800 border-sky-200',
  Waiting: 'bg-amber-50 text-amber-800 border-amber-200',
  'In Progress': 'bg-indigo-50 text-indigo-800 border-indigo-200',
  Completed: 'bg-emerald-50 text-[#065F46] border-emerald-200',
  Delivered: 'bg-slate-100 text-slate-700 border-slate-200',
  Cancelled: 'bg-red-50 text-red-700 border-red-200',
};

export const CarWashQueuePage: React.FC = () => {
  const { shopId, shop, isReadOnly } = useDashboard();
  const [jobs, setJobs] = useState<CarWashJobCard[]>([]);
  const [packages, setPackages] = useState<CarWashServicePackage[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | CarWashJobStatus>('all');
  const [search, setSearch] = useState('');

  // Job card form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleType, setVehicleType] = useState<CarWashJobCard['vehicleType']>('Sedan');
  const [packageId, setPackageId] = useState('');
  const [customPackageName, setCustomPackageName] = useState('Custom Wash');
  const [price, setPrice] = useState('1200');
  const [discount, setDiscount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>('cash');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [bookingType, setBookingType] = useState<'walk_in' | 'booking'>('walk_in');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState('11:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const [j, p, s] = await Promise.all([
        getCarWashJobs(shopId),
        getCarWashPackages(shopId),
        getShopStaff(shopId).catch(() => ({ staff: [] as StaffMember[], invites: [] })),
      ]);
      setJobs(j);
      setPackages(p.filter((pkg) => pkg.isActive));
      setStaffList(s.staff.filter((st) => st.status === 'active'));
      if (!packageId && p.length > 0) {
        const activePkg = p.find((x) => x.isActive) || p[0];
        setPackageId(activePkg.id);
        setPrice(String(activePkg.price));
        setVehicleType(activePkg.vehicleType);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load car wash queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const handleSelectPackage = (id: string) => {
    setPackageId(id);
    const pkg = packages.find((p) => p.id === id);
    if (pkg) {
      setPrice(String(pkg.price));
      setVehicleType(pkg.vehicleType);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly) return;
    setSaving(true);
    setError(null);
    try {
      const pkg = packages.find((p) => p.id === packageId);
      const staff = staffList.find((st) => st.uid === assignedStaffId);
      const numericPrice = Math.max(0, Number(price || 0));
      const numericDiscount = Math.max(0, Number(discount || 0));
      const numericPaid = Math.max(0, Number(paidAmount || 0));
      const finalPkgName = pkg?.name || customPackageName.trim() || 'Car Wash Service';

      const cust = await saveCarWashCustomer(shopId, {
        name: customerName,
        phone: customerPhone,
        totalVisits: 1,
        totalSpent: numericPaid,
      });

      const veh = await saveCarWashVehicle(shopId, {
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        plateNumber,
        makeModel: vehicleModel || 'Vehicle',
        vehicleType,
      });

      const job = await saveCarWashJobCard(shopId, {
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        vehicleId: veh.id,
        plateNumber: veh.plateNumber,
        vehicleModel: veh.makeModel,
        vehicleType,
        packageId: pkg?.id || 'custom',
        packageName: finalPkgName,
        assignedStaffId: staff?.uid,
        assignedStaffName: staff?.name,
        bookingType,
        scheduledDate,
        scheduledTime,
        status: bookingType === 'booking' ? 'Booked' : 'Waiting',
        price: numericPrice,
        discount: numericDiscount,
        paidAmount: numericPaid,
        paymentMethod,
        notes,
      });

      if (numericPaid > 0) {
        await recordIndustryPayment(shopId, {
          businessType: 'carwash',
          customerName: job.customerName,
          customerPhone: job.customerPhone,
          referenceType: 'carwash_job',
          referenceId: job.id,
          description: `${job.jobNumber} · ${job.plateNumber} (${job.packageName})`,
          amount: numericPaid,
          method: paymentMethod,
          status: 'paid',
        });
      }

      setCustomerName('');
      setCustomerPhone('');
      setPlateNumber('');
      setVehicleModel('');
      setDiscount('0');
      setPaidAmount('0');
      setNotes('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save job card.');
    } finally {
      setSaving(false);
    }
  };

  const handleSettleJobPayment = async (job: CarWashJobCard) => {
    if (!shopId || isReadOnly) return;
    const due = Math.max(0, Number(job.totalAmount) - Number(job.paidAmount || 0));
    if (due <= 0) return;
    setError(null);
    try {
      await saveCarWashJobCard(shopId, {
        ...job,
        paidAmount: job.totalAmount,
        paymentMethod: job.paymentMethod || 'cash',
      });
      await recordIndustryPayment(shopId, {
        businessType: 'carwash',
        customerName: job.customerName,
        customerPhone: job.customerPhone,
        referenceType: 'carwash_job',
        referenceId: job.id,
        description: `Balance cleared · ${job.jobNumber} (${job.plateNumber})`,
        amount: due,
        method: job.paymentMethod || 'cash',
        status: 'paid',
      });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to settle job payment.');
    }
  };

  const handleStatusChange = async (jobId: string, status: CarWashJobStatus) => {
    if (!shopId || isReadOnly) return;
    try {
      await updateCarWashJobStatus(shopId, jobId, status);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not update job status.');
    }
  };

  const totalPreview = computeCarWashJobTotal(Number(price || 0), Number(discount || 0));

  const filtered = jobs.filter((j) => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      j.plateNumber.toLowerCase().includes(q) ||
      j.customerName.toLowerCase().includes(q) ||
      j.customerPhone.toLowerCase().includes(q) ||
      j.jobNumber.toLowerCase().includes(q) ||
      j.packageName.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading Service Queue &amp; Job Cards...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Service Queue &amp; Job Cards</h2>
        <p className="text-slate-500 mt-0.5">
          Manage walk-ins, scheduled bay bookings, staff assignments, job billing &amp; WhatsApp pickup alerts.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium">
          {error}
        </div>
      )}

      {!isReadOnly && (
        <form
          onSubmit={handleCreateJob}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ClipboardPlus className="w-4 h-4 text-[#065F46]" /> Create Job Card / Walk-In Intake
            </h3>
            <span className="font-extrabold text-[#065F46] tabular-nums">
              Net Total: {formatPKR(totalPreview)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone (e.g. 0300-1234567) *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              required
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              placeholder="Number Plate (e.g. LEA-4521) *"
              className="px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase"
            />
            <input
              required
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
              placeholder="Make & Model (e.g. Civic 2021) *"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {packages.length > 0 ? (
              <select
                value={packageId}
                onChange={(e) => handleSelectPackage(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatPKR(p.price)}
                  </option>
                ))}
                <option value="custom">Custom Package...</option>
              </select>
            ) : (
              <input
                value={customPackageName}
                onChange={(e) => setCustomPackageName(e.target.value)}
                placeholder="Wash Package Name"
                className="px-3 py-2 border border-slate-200 rounded-lg"
              />
            )}

            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as CarWashJobCard['vehicleType'])}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              {(['Sedan', 'Hatchback', 'SUV', '4x4', 'Bike', 'Van', 'All'] as CarWashJobCard['vehicleType'][]).map(
                (vt) => (
                  <option key={vt} value={vt}>
                    {vt}
                  </option>
                )
              )}
            </select>

            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Package Price (PKR)"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="Discount (PKR)"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
            <select
              value={assignedStaffId}
              onChange={(e) => setAssignedStaffId(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Assign Wash Staff (Optional)</option>
              {staffList.map((st) => (
                <option key={st.uid} value={st.uid}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value as 'walk_in' | 'booking')}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="walk_in">Walk-In (Waiting Queue)</option>
              <option value="booking">Advance Booking</option>
            </select>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              type="number"
              min="0"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="Paid Now (PKR)"
              className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as ManualPaymentMethod)}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="cash">Cash</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="jazzcash">JazzCash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="ibft">IBFT</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-3 items-center justify-between">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bay instructions or interior/exterior notes (optional)"
              className="flex-1 min-w-[220px] px-3 py-2 border border-slate-200 rounded-lg"
            />
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl font-bold disabled:opacity-60"
            >
              {saving ? 'Creating...' : 'Create Job Card'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
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
              All ({jobs.length})
            </button>
            {CARWASH_JOB_STATUSES.map((st) => (
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
                {st} ({jobs.filter((j) => j.status === st).length})
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plate, job #, customer..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-slate-400">No job cards match the selected filter.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((j) => {
              const due = Math.max(0, Number(j.totalAmount) - Number(j.paidAmount || 0));
              const waMessage = `Assalam-o-Alaikum ${j.customerName}, your vehicle ${j.plateNumber} (${j.vehicleModel}) at ${shop?.name || 'our Car Wash'} is currently "${j.status}". Job #${j.jobNumber}, Total: ${formatPKR(j.totalAmount)}.`;
              return (
                <div
                  key={j.id}
                  className="py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{j.plateNumber}</span>
                      <span className="font-bold text-slate-800">{j.vehicleModel}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${
                          STATUS_STYLE[j.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {j.status}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{j.jobNumber}</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {j.packageName} · {j.customerName} ({j.customerPhone}) ·{' '}
                      {j.scheduledDate}
                      {j.scheduledTime ? ` ${j.scheduledTime}` : ''}
                      {j.assignedStaffName ? ` · Staff: ${j.assignedStaffName}` : ''}
                    </p>
                    {j.notes && <p className="text-[11px] text-slate-500">Note: {j.notes}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="text-right mr-1">
                      <p className="font-extrabold text-slate-900 tabular-nums">
                        {formatPKR(j.totalAmount)}
                      </p>
                      <p
                        className={`text-[11px] font-semibold tabular-nums ${
                          due > 0 ? 'text-red-700' : 'text-[#065F46]'
                        }`}
                      >
                        {due > 0 ? `Due ${formatPKR(due)}` : 'Paid'}
                      </p>
                    </div>

                    {!isReadOnly && (
                      <select
                        value={j.status}
                        onChange={(e) =>
                          handleStatusChange(j.id, e.target.value as CarWashJobStatus)
                        }
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold"
                      >
                        {CARWASH_JOB_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    )}

                    {!isReadOnly && due > 0 && j.status !== 'Cancelled' && (
                      <button
                        type="button"
                        onClick={() => handleSettleJobPayment(j)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#065F46] text-white font-bold inline-flex items-center gap-1"
                      >
                        <Wallet className="w-3.5 h-3.5" /> Mark Paid
                      </button>
                    )}

                    {due === 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#065F46]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                      </span>
                    )}

                    <a
                      href={formatWhatsAppReminderUrl(j.customerPhone, waMessage)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-[#065F46] font-semibold inline-flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

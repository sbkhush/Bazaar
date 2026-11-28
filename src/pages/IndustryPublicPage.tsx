import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  Car,
  CheckCircle2,
  Clock,
  Dumbbell,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { getIndustryGroup, getIndustryMeta } from '../config/industryConfig';
import {
  formatWhatsAppReminderUrl,
  getPublicOfferings,
} from '../services/industryCommonService';
import {
  filterPublicVehicles,
  getPublicDealerVehicles,
  submitPublicDealerInquiry,
} from '../services/carDealerService';
import {
  CLINIC_ADMIN_DISCLAIMER,
  submitPublicClinicAppointment,
} from '../services/clinicService';
import { submitPublicCarWashBooking } from '../services/carwashService';
import { submitPublicGymInquiry } from '../services/gymService';
import {
  CarWashJobCard,
  DealerInquiry,
  DealerPublicVehicle,
  PublicOfferingItem,
} from '../types';
import { formatPKR } from '../data/seedData';
import { SafeImage } from '../components/common/SafeImage';

export const IndustryPublicPage: React.FC = () => {
  const { shopId, shop, settings } = useTenant();
  const businessType = shop?.businessType || 'general_store';
  const industryGroup = getIndustryGroup(businessType);
  const meta = getIndustryMeta(businessType);

  const [offerings, setOfferings] = useState<PublicOfferingItem[]>([]);
  const [vehicles, setVehicles] = useState<DealerPublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Car Dealer public catalog filters
  const [search, setSearch] = useState('');
  const [makeFilter, setMakeFilter] = useState('all');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<DealerPublicVehicle | null>(null);

  // Shared public request fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Clinic fields
  const [selectedDoctorOfferingId, setSelectedDoctorOfferingId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [timeSlot, setTimeSlot] = useState('6:00 PM');

  // Car Wash fields
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleType, setVehicleType] = useState<CarWashJobCard['vehicleType']>('Sedan');

  // Gym fields
  const [selectedPlanName, setSelectedPlanName] = useState('');

  // Dealer inquiry type
  const [inquiryType, setInquiryType] =
    useState<DealerInquiry['inquiryType']>('test_drive');
  const [preferredDate, setPreferredDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    const loadPublic = async () => {
      try {
        if (industryGroup === 'car_dealer') {
          const list = await getPublicDealerVehicles(shopId);
          setVehicles(list);
          if (list.length > 0) setSelectedVehicle(list[0]);
        } else {
          const list = await getPublicOfferings(shopId);
          const active = list.filter((o) => o.isActive);
          setOfferings(active);
          if (active.length > 0) {
            setSelectedDoctorOfferingId(active[0].id);
            setSelectedPackageId(active[0].id);
            setSelectedPlanName(active[0].title);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    loadPublic();
  }, [shopId, industryGroup]);

  const makes = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.make).filter(Boolean))).sort(),
    [vehicles]
  );

  const filteredVehicles = useMemo(
    () =>
      filterPublicVehicles(vehicles, {
        search,
        make: makeFilter,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
      }),
    [vehicles, search, makeFilter, maxPrice]
  );

  const handlePublicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    setSubmitting(true);
    setSubmittedNotice(null);
    setSubmitError(null);
    try {
      if (industryGroup === 'clinic') {
        const docItem = offerings.find((o) => o.id === selectedDoctorOfferingId);
        const apptId = await submitPublicClinicAppointment(shopId, {
          patientName: customerName,
          patientPhone: customerPhone,
          doctorId: docItem?.id,
          doctorName: docItem?.title || 'Duty Doctor',
          appointmentDate,
          timeSlot,
          consultationFee: docItem?.price || 0,
          visitReason: notes,
        });
        setSubmittedNotice(
          `Appointment request (${apptId}) submitted. Clinic reception will confirm your slot on ${customerPhone}.`
        );
      } else if (industryGroup === 'carwash') {
        const pkg = offerings.find((o) => o.id === selectedPackageId);
        const jobId = await submitPublicCarWashBooking(shopId, {
          customerName,
          customerPhone,
          plateNumber,
          vehicleModel: vehicleModel || 'Vehicle',
          vehicleType,
          packageId: pkg?.id || 'standard',
          packageName: pkg?.title || 'Car Wash Service',
          price: pkg?.price || 0,
          scheduledDate: preferredDate,
          scheduledTime: timeSlot,
          notes,
        });
        setSubmittedNotice(
          `Car wash slot booked (${jobId}). Bring ${plateNumber.toUpperCase()} at ${timeSlot} on ${preferredDate}.`
        );
      } else if (industryGroup === 'car_dealer') {
        const targetVeh = selectedVehicle || filteredVehicles[0];
        const inqId = await submitPublicDealerInquiry(shopId, {
          vehicleId: targetVeh?.id || 'general',
          vehicleTitle: targetVeh?.title || 'Showroom Vehicle Inquiry',
          customerName,
          customerPhone,
          inquiryType,
          preferredDate,
          message: notes,
        });
        setSubmittedNotice(
          `Showroom inquiry (${inqId}) sent! A representative will call you on ${customerPhone}.`
        );
      } else if (industryGroup === 'gym') {
        await submitPublicGymInquiry(shopId, {
          customerName,
          customerPhone,
          planName: selectedPlanName || 'Membership Trial',
          message: notes,
        });
        setSubmittedNotice(
          `Membership inquiry received! Our gym desk will contact you on ${customerPhone}.`
        );
      }
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setPlateNumber('');
      setVehicleModel('');
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not submit request. Please try WhatsApp instead.');
    } finally {
      setSubmitting(false);
    }
  };

  const contactPhone = shop?.publicContactPhone || settings.contactPhone || '';
  const address = shop?.storefrontAddress || settings.address || '';
  const hours = shop?.businessHours || settings.businessHours || 'Mon–Sat · 9:00 AM – 10:00 PM';
  const waHref = formatWhatsAppReminderUrl(
    settings.whatsappNumber || contactPhone,
    `Assalam-o-Alaikum ${shop?.name || settings.siteName}, I would like more information.`
  );

  const HeroIcon =
    industryGroup === 'gym'
      ? Dumbbell
      : industryGroup === 'clinic'
      ? Stethoscope
      : industryGroup === 'carwash'
      ? Sparkles
      : Car;

  if (loading) {
    return (
      <div className="py-24 flex justify-center items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading {shop?.name || meta.shortLabel}...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-xs">
      {/* Business Header Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[#065F46] font-bold text-[11px]">
            <HeroIcon className="w-3.5 h-3.5" /> {meta.label}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {shop?.name || settings.siteName}
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            {shop?.seoDescription || settings.seoDescription || meta.description}
          </p>
          <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-slate-600 font-medium">
            {address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#065F46]" /> {address}
                {shop?.city ? `, ${shop.city}` : ''}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#065F46]" /> {hours}
            </span>
            {contactPhone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#065F46]" /> {contactPhone}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          {contactPhone && (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl font-bold inline-flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp Desk
            </a>
          )}
        </div>
      </section>

      {industryGroup === 'clinic' && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-[11px] font-medium">
            {CLINIC_ADMIN_DISCLAIMER} Patient profiles and private visit records are never exposed publicly.
          </p>
        </div>
      )}

      {/* Main Two-Column Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Offerings or Dealer Showroom Catalog */}
        <div className="lg:col-span-7 space-y-4">
          {industryGroup === 'car_dealer' ? (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-extrabold text-slate-900">
                    Available Showroom Vehicles ({filteredVehicles.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search make, model, city..."
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <select
                    value={makeFilter}
                    onChange={(e) => setMakeFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="all">All Makes</option>
                    {makes.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Max Price (PKR)"
                    className="px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              {filteredVehicles.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400">
                  No showroom vehicles match your filters right now.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredVehicles.map((v) => (
                    <div
                      key={v.id}
                      className={`bg-white border rounded-2xl overflow-hidden transition ${
                        selectedVehicle?.id === v.id
                          ? 'border-[#065F46] ring-1 ring-[#065F46]'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="h-44 bg-slate-100 border-b border-slate-200 flex items-center justify-center overflow-hidden">
                        {v.images && v.images[0] ? (
                          <SafeImage
                            src={v.images[0]}
                            alt={v.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Car className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-extrabold text-slate-900 text-sm">{v.title}</h3>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-[#065F46] font-bold text-[10px]">
                            {v.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {v.registrationCity} · {v.mileageKm.toLocaleString()} km · {v.transmission} ·{' '}
                          {v.fuelType} · {v.engineCapacity}
                        </p>
                        {v.exteriorDetails && (
                          <p className="text-[11px] text-slate-600 line-clamp-2">
                            {v.exteriorDetails}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="text-sm font-extrabold text-[#065F46] tabular-nums">
                            {formatPKR(v.askingPrice)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedVehicle(v)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-[11px]"
                          >
                            Inquire / Test Drive
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-extrabold text-slate-900">
                {industryGroup === 'gym'
                  ? 'Membership Plans'
                  : industryGroup === 'clinic'
                  ? 'Doctors & Consultation Timings'
                  : 'Wash & Detailing Packages'}
              </h2>
              {offerings.length === 0 ? (
                <p className="py-10 text-center text-slate-400">
                  Service catalog is being updated. Contact us on WhatsApp or use the request form.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {offerings.map((o) => (
                    <div
                      key={o.id}
                      className="border border-slate-200 rounded-xl p-4 space-y-1.5 bg-slate-50/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-extrabold text-slate-900 text-sm">{o.title}</h3>
                        <span className="font-extrabold text-[#065F46] tabular-nums">
                          {formatPKR(o.price)}
                        </span>
                      </div>
                      {o.subtitle && (
                        <p className="text-[11px] font-semibold text-slate-600">{o.subtitle}</p>
                      )}
                      {o.description && (
                        <p className="text-[11px] text-slate-500">{o.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Public Booking / Inquiry Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-[#065F46]" />
            {industryGroup === 'clinic'
              ? 'Book Clinic Appointment'
              : industryGroup === 'carwash'
              ? 'Book Car Wash Slot'
              : industryGroup === 'car_dealer'
              ? 'Vehicle Inquiry & Test Drive'
              : 'Request Gym Trial / Membership'}
          </h2>

          {submittedNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#065F46] font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submittedNotice}</span>
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium">
              {submitError}
            </div>
          )}

          <form onSubmit={handlePublicSubmit} className="space-y-3">
            {industryGroup === 'car_dealer' && selectedVehicle && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] text-slate-500">Selected Vehicle</p>
                <p className="font-extrabold text-slate-900">
                  {selectedVehicle.title} · {formatPKR(selectedVehicle.askingPrice)}
                </p>
              </div>
            )}

            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Your Full Name *"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
            <input
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Mobile / WhatsApp Number (03XX-XXXXXXX) *"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />

            {industryGroup === 'clinic' && (
              <>
                {offerings.length > 0 && (
                  <select
                    value={selectedDoctorOfferingId}
                    onChange={(e) => setSelectedDoctorOfferingId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {offerings.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title} — {formatPKR(o.price)}
                      </option>
                    ))}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    required
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg"
                  />
                  <input
                    required
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    placeholder="Preferred Time"
                    className="px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </>
            )}

            {industryGroup === 'carwash' && (
              <>
                {offerings.length > 0 && (
                  <select
                    value={selectedPackageId}
                    onChange={(e) => setSelectedPackageId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {offerings.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title} — {formatPKR(o.price)}
                      </option>
                    ))}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    required
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                    placeholder="Number Plate *"
                    className="px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase"
                  />
                  <input
                    required
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Car Model (e.g. Alto) *"
                    className="px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={vehicleType}
                    onChange={(e) =>
                      setVehicleType(e.target.value as CarWashJobCard['vehicleType'])
                    }
                    className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Sedan">Sedan</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="SUV">SUV</option>
                    <option value="4x4">4x4</option>
                    <option value="Bike">Bike</option>
                  </select>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="px-2.5 py-2 border border-slate-200 rounded-lg"
                  />
                  <input
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    placeholder="Time"
                    className="px-2.5 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </>
            )}

            {industryGroup === 'car_dealer' && (
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={inquiryType}
                  onChange={(e) =>
                    setInquiryType(e.target.value as DealerInquiry['inquiryType'])
                  }
                  className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="test_drive">Book Test Drive</option>
                  <option value="price_offer">Price / Token Inquiry</option>
                  <option value="general_inquiry">Inspection Request</option>
                </select>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            )}

            {industryGroup === 'gym' && offerings.length > 0 && (
              <select
                value={selectedPlanName}
                onChange={(e) => setSelectedPlanName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                {offerings.map((o) => (
                  <option key={o.id} value={o.title}>
                    {o.title} — {formatPKR(o.price)}
                  </option>
                ))}
              </select>
            )}

            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes or questions..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-[#065F46] hover:bg-emerald-900 text-white rounded-xl font-bold disabled:opacity-60"
            >
              {submitting
                ? 'Submitting...'
                : industryGroup === 'clinic'
                ? 'Request Appointment'
                : industryGroup === 'carwash'
                ? 'Book Car Wash Slot'
                : industryGroup === 'car_dealer'
                ? 'Send Showroom Inquiry'
                : 'Request Membership Callback'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

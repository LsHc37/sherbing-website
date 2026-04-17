'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ThankYouOverlay from '@/app/components/ThankYouOverlay';
import { getServices, validateBookingForm } from '@/lib/services/pricingService';
import { formatTime12 } from '@/lib/dateTime';

type AvailabilitySlot = { time: string; status: 'open' | 'booked' };
type DayOpenSlots = { date: string; openTimes: string[] };

const SPECIAL_BASE_PRICE = 200;
const INCLUDED_SERVICE_IDS = ['dog_waste_removal', 'lawn_mowing', 'hedge_trimming', 'gutter_cleaning'];
const QUARTER_ACRE_SQFT = 10890;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(baseDate: string, daysToAdd: number): string {
  const d = new Date(`${baseDate}T00:00:00`);
  d.setDate(d.getDate() + daysToAdd);
  return toIsoDate(d);
}

function formatQuickDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
}

export default function SpecialBookingContent() {
  const searchParams = useSearchParams();
  const services = useMemo(() => getServices(), []);
  const addOnServices = useMemo(() => services.filter((service) => !INCLUDED_SERVICE_IDS.includes(service.id)), [services]);
  const minimumScheduleDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }, []);

  const [formData, setFormData] = useState({
    service_ids: [...INCLUDED_SERVICE_IDS],
    address: '',
    city: '',
    state: 'ID',
    zip_code: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    scheduled_date: '',
    scheduled_time: '',
    scheduled_duration_minutes: 60,
    notes: '',
    sales_referral_code: '',
  });
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [quickSelectDates, setQuickSelectDates] = useState<string[]>([]);
  const [estimatedLotSqft, setEstimatedLotSqft] = useState<number | null>(null);
  const [eligibilityMessage, setEligibilityMessage] = useState('');
  const [eligibilityStatus, setEligibilityStatus] = useState<'idle' | 'checking' | 'eligible' | 'custom_quote' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const referralCode = searchParams.get('ref') || searchParams.get('referral') || searchParams.get('sales_referral_code');
    if (referralCode) {
      setFormData((prev) => ({ ...prev, sales_referral_code: referralCode.trim() }));
    }
  }, [searchParams]);

  const checkEligibility = async () => {
    if (!formData.address.trim() || !formData.city.trim() || !formData.state.trim() || !formData.zip_code.trim()) {
      setEligibilityStatus('error');
      setEligibilityMessage('Enter the full address first so we can check the property size.');
      return;
    }

    setEligibilityStatus('checking');
    setEligibilityMessage('Checking the address for the summer special...');

    try {
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          service_ids: ['lawn_mowing'],
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setEligibilityStatus('error');
        setEligibilityMessage(data.error || 'Unable to check eligibility right now.');
        return;
      }

      const propertySqft = Number(data.inferred_property_sqft || 0);
      const yardSqft = Number(data.inferred_yard_sqft || 0);
      const lotSqft = Math.max(0, propertySqft) + Math.max(0, yardSqft);
      const eligible = lotSqft > 0 && lotSqft <= QUARTER_ACRE_SQFT;

      setEstimatedLotSqft(lotSqft);
      setEligibilityStatus(eligible ? 'eligible' : 'custom_quote');
      setEligibilityMessage(eligible
        ? `Eligible for the $200 summer special. Estimated lot size is about ${Math.round(lotSqft).toLocaleString()} sqft, which is at or under 1/4 acre.`
        : `This property is estimated at about ${Math.round(lotSqft).toLocaleString()} sqft, so a custom quote will be needed instead of the flat $200 special.`);
    } catch {
      setEligibilityStatus('error');
      setEligibilityMessage('Could not check eligibility right now. Please try again in a moment.');
    }
  };

  const selectedAddOnServices = useMemo(
    () => addOnServices.filter((service) => selectedAddOns.includes(service.id)),
    [addOnServices, selectedAddOns]
  );

  const addOnTotal = useMemo(
    () => selectedAddOnServices.reduce((sum, service) => sum + Number(service.minimum_price || 0), 0),
    [selectedAddOnServices]
  );

  const totalPrice = SPECIAL_BASE_PRICE + addOnTotal;

  const openSlots = useMemo(() => availabilitySlots.filter((slot) => slot.status === 'open'), [availabilitySlots]);

  const fetchAvailabilityForDate = useCallback(async (date: string): Promise<AvailabilitySlot[]> => {
    const response = await fetch(`/api/bookings/availability?date=${encodeURIComponent(date)}&durationMinutes=${encodeURIComponent(String(formData.scheduled_duration_minutes || 60))}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error || 'Failed to load availability');
    }
    if (body?.warning) {
      setAvailabilityError(String(body.warning));
    }
    return Array.isArray(body?.slots) ? (body.slots as AvailabilitySlot[]) : [];
  }, [formData.scheduled_duration_minutes]);

  const loadAvailability = useCallback(async (date: string) => {
    if (!date) {
      setAvailabilitySlots([]);
      setAvailabilityError('');
      return;
    }

    setAvailabilityLoading(true);
    try {
      const slots = await fetchAvailabilityForDate(date);
      setAvailabilitySlots(slots);
      if (formData.scheduled_time) {
        const selected = slots.find((slot) => slot.time === formData.scheduled_time && slot.status === 'open');
        if (!selected) {
          setFormData((prev) => ({ ...prev, scheduled_time: '' }));
        }
      }
    } catch (error) {
      setAvailabilityError(error instanceof Error ? error.message : 'Failed to load availability');
      setAvailabilitySlots([]);
    } finally {
      setAvailabilityLoading(false);
    }
  }, [fetchAvailabilityForDate, formData.scheduled_time]);

  const loadUpcomingOpenDates = useCallback(async (startDate: string) => {
    const results: DayOpenSlots[] = [];
    for (let offset = 0; offset < 45 && results.length < 4; offset += 1) {
      const date = addDays(startDate, offset);
      const slots = await fetchAvailabilityForDate(date);
      const openTimes = slots.filter((slot) => slot.status === 'open').map((slot) => slot.time);
      if (openTimes.length > 0) {
        results.push({ date, openTimes });
      }
    }
    return results;
  }, [fetchAvailabilityForDate]);

  useEffect(() => {
    const bootstrapSoonestOpen = async () => {
      setAvailabilityLoading(true);
      try {
        const openDates = await loadUpcomingOpenDates(minimumScheduleDate);
        setQuickSelectDates(openDates.slice(1, 4).map((entry) => entry.date));
        if (openDates.length === 0) {
          setFormData((prev) => ({ ...prev, scheduled_date: minimumScheduleDate, scheduled_time: '' }));
          setAvailabilitySlots([]);
          return;
        }
        const soonest = openDates[0];
        setFormData((prev) => ({ ...prev, scheduled_date: soonest.date, scheduled_time: soonest.openTimes[0] || '' }));
        setAvailabilitySlots(soonest.openTimes.map((time) => ({ time, status: 'open' as const })));
      } catch {
        setAvailabilityError('Failed to load availability');
      } finally {
        setAvailabilityLoading(false);
      }
    };

    void bootstrapSoonestOpen();
  }, [loadUpcomingOpenDates, minimumScheduleDate]);

  useEffect(() => {
    void loadAvailability(formData.scheduled_date);
  }, [formData.scheduled_date, loadAvailability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const validationResults = validateBookingForm({ ...formData, service_ids: formData.service_ids });
    if (!validationResults.valid) {
      setErrors(validationResults.errors);
      return;
    }

    if (eligibilityStatus !== 'eligible') {
      setErrors(['Check eligibility first and make sure the property qualifies for the special.']);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          service_ids: [...formData.service_ids, ...selectedAddOnServices.map((service) => service.id)],
          package_id: 'premium_summer_cleanup',
          estimated_price: totalPrice,
          referral_code: formData.sales_referral_code,
          notes: `${formData.notes ? `${formData.notes} | ` : ''}Summer special booking with add-ons: ${selectedAddOnServices.map((service) => service.name).join(', ') || 'none'}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrors([errorData.error || 'Booking failed']);
        return;
      }

      setSubmitted(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch {
      setErrors(['Error submitting booking']);
    } finally {
      setLoading(false);
    }
  };

  const toggleAddOn = (serviceId: string) => {
    setSelectedAddOns((prev) => prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]);
  };

  return (
    <main className="page-shell min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />

      <ThankYouOverlay
        open={submitted}
        title="Thank you for booking"
        message="Your summer special request was submitted successfully. We’re sending you back home now."
      />

      <div className="max-w-5xl mx-auto">
        <div className="surface-card p-6 sm:p-8 mb-8 appear-up">
          <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-900">
            Summer Special Booking
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-slate-900">Premium Summer Cleanup</h1>
          <p className="mt-3 text-slate-700 max-w-3xl">
            $200 flat for standard residential lots up to 1/4 acre. Add extra services below at normal prices.
          </p>
        </div>

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8 appear-up">
            <p className="text-red-800 font-semibold mb-2">Please fix these errors:</p>
            <ul className="text-red-700 text-sm space-y-1">
              {errors.map((error, i) => <li key={i}>• {error}</li>)}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="surface-card p-8 appear-up">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Special Package Included</h2>
            <p className="text-slate-700 mb-5">Included in the flat $200 price:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                'Dog poop pickup',
                'Lawn mowing',
                'Weed whacking',
                'Hedge trimming',
                'Gutter cleaning',
              ].map((item) => (
                <div key={item} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-slate-700 leading-6">
              Severely overgrown hedges or larger properties may require a custom quote upon arrival.
            </p>
          </div>

          <div className="surface-card p-8 appear-up stagger-1">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Add-ons at Normal Prices</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {addOnServices.map((service) => {
                const checked = selectedAddOns.includes(service.id);
                return (
                  <label key={service.id} className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-emerald-50 transition">
                    <input type="checkbox" checked={checked} onChange={() => toggleAddOn(service.id)} className="mt-1" />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{service.name}</p>
                      <p className="text-sm text-slate-600">Add-on: ${service.minimum_price}+</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Base special: ${SPECIAL_BASE_PRICE}. Add-ons total: ${addOnTotal.toFixed(2)}. Total: ${totalPrice.toFixed(2)}.
            </div>
          </div>

          <div className="surface-card p-8 appear-up stagger-2">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">3. Property Address</h2>
            <div className="space-y-4">
              <input type="text" name="address" placeholder="Street Address" value={formData.address} onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))} className="w-full px-4 py-3 border border-slate-300 rounded-lg" required />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input type="text" name="city" placeholder="City" value={formData.city} onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))} className="px-4 py-3 border border-slate-300 rounded-lg" required />
                <select name="state" value={formData.state} onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))} className="px-4 py-3 border border-slate-300 rounded-lg">
                  <option value="ID">Idaho</option>
                  <option value="WA">Washington</option>
                  <option value="OR">Oregon</option>
                  <option value="UT">Utah</option>
                </select>
                <input type="text" name="zip_code" placeholder="ZIP Code" value={formData.zip_code} onChange={(e) => setFormData((prev) => ({ ...prev, zip_code: e.target.value }))} className="px-4 py-3 border border-slate-300 rounded-lg" required />
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">See if you&apos;re eligible</p>
                    <p className="text-sm text-amber-900/85">Check whether the property is at or under 1/4 acre.</p>
                  </div>
                  <button type="button" onClick={() => void checkEligibility()} className="btn-secondary whitespace-nowrap px-4 py-2 self-start lg:self-auto" disabled={eligibilityStatus === 'checking'}>
                    {eligibilityStatus === 'checking' ? 'Checking...' : 'Check Eligibility'}
                  </button>
                </div>
                {eligibilityMessage && <p className={`mt-3 text-sm leading-6 ${eligibilityStatus === 'eligible' ? 'text-emerald-800' : eligibilityStatus === 'custom_quote' ? 'text-amber-800' : eligibilityStatus === 'error' ? 'text-red-700' : 'text-slate-700'}`}>{eligibilityMessage}</p>}
                {estimatedLotSqft ? <p className="mt-2 text-xs text-slate-600">Estimated lot size: {Math.round(estimatedLotSqft).toLocaleString()} sqft.</p> : null}
              </div>
            </div>
          </div>

          <div className="surface-card p-8 appear-up stagger-3">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">4. Your Information</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Full Name" value={formData.customer_name} onChange={(e) => setFormData((prev) => ({ ...prev, customer_name: e.target.value }))} className="w-full px-4 py-3 border border-slate-300 rounded-lg" required />
              <input type="email" placeholder="Email Address" value={formData.customer_email} onChange={(e) => setFormData((prev) => ({ ...prev, customer_email: e.target.value }))} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
              <input type="tel" placeholder="Phone Number" value={formData.customer_phone} onChange={(e) => setFormData((prev) => ({ ...prev, customer_phone: e.target.value }))} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
            </div>
          </div>

          <div className="surface-card p-8 appear-up stagger-4">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">5. Schedule Service</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <input type="date" value={formData.scheduled_date} onChange={(e) => setFormData((prev) => ({ ...prev, scheduled_date: e.target.value, scheduled_time: '' }))} min={minimumScheduleDate} className="px-4 py-3 border border-slate-300 rounded-lg" />
              <select value={String(formData.scheduled_duration_minutes || 60)} onChange={(e) => setFormData((prev) => ({ ...prev, scheduled_duration_minutes: Number(e.target.value) || 60, scheduled_time: '' }))} className="px-4 py-3 border border-slate-300 rounded-lg">
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
              </select>
              <div className="px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-600 flex items-center">
                {formData.scheduled_time ? `Selected time: ${formatTime12(formData.scheduled_time)}` : 'Select a date to view open times'}
              </div>
            </div>

            {quickSelectDates.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">Next closest open dates</p>
                <div className="flex flex-wrap gap-2">
                  {quickSelectDates.map((date) => (
                    <button key={date} type="button" onClick={() => setFormData((prev) => ({ ...prev, scheduled_date: date, scheduled_time: '' }))} className="px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-slate-700 text-xs hover:bg-slate-100">
                      {formatQuickDateLabel(date)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formData.scheduled_date && (
              <div className="rounded-lg border border-slate-200 p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-800">Available Times</p>
                  <button type="button" onClick={() => void loadAvailability(formData.scheduled_date)} className="text-xs px-3 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">Refresh</button>
                </div>
                {availabilityLoading && <p className="text-sm text-slate-600">Loading live availability...</p>}
                {availabilityError && <p className="text-sm text-red-600">{availabilityError}</p>}
                {!availabilityLoading && !availabilityError && (
                  <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/40">
                    <p className="text-sm font-semibold text-emerald-800 mb-2">Open Times</p>
                    {openSlots.length === 0 ? (
                      <p className="text-sm text-amber-700">No available times this date.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {openSlots.map((slot) => (
                          <button key={slot.time} type="button" onClick={() => setFormData((prev) => ({ ...prev, scheduled_time: slot.time }))} className={`px-3 py-2 rounded text-sm border bg-white text-slate-800 border-emerald-300 hover:border-emerald-500 ${formData.scheduled_time === slot.time ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-100/70' : ''}`}>
                            {formatTime12(slot.time)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <textarea placeholder="Any special instructions or notes?" value={formData.notes} onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))} className="w-full mt-4 px-4 py-3 border border-slate-300 rounded-lg" rows={4} />
          </div>

          <div className="surface-card p-8 appear-up stagger-5">
            <p className="mb-4 text-sm text-slate-700 leading-6">
              Severely overgrown hedges or larger properties may require a custom quote upon arrival.
            </p>
            <button type="submit" disabled={loading} className="w-full btn-primary py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Submitting...' : `Book Special - $${totalPrice.toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
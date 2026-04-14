'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getServices,
  validateBookingForm,
} from '@/lib/services/pricingService';

type EstimateSource = 'standard' | 'ai';

type AvailabilitySlot = {
  time: string;
  status: 'open' | 'booked';
};

type DayOpenSlots = {
  date: string;
  openTimes: string[];
};

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

export default function BookingContent() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    service_ids: [] as string[],
    package_id: '',
    lawn_mowing_frequency: 'weekly' as 'weekly' | 'bi_weekly',
    lawn_initial_overgrowth: 'no' as 'yes' | 'no',
    lawn_bag_clippings: 'no' as 'yes' | 'no',
    lawn_heavy_pet_waste: 'no' as 'yes' | 'no',
    lawn_access_blocked: 'no' as 'yes' | 'no',
    window_count: '',
    window_scope: 'exterior' as 'exterior' | 'interior_exterior',
    window_screen_track_count: '',
    gutter_story_count: '1' as '1' | '2',
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
  });

  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [estimateSource, setEstimateSource] = useState<EstimateSource>('standard');
  const [inferredPropertySqft, setInferredPropertySqft] = useState<number | null>(null);
  const [inferredYardSqft, setInferredYardSqft] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [quickSelectDates, setQuickSelectDates] = useState<string[]>([]);

  const services = useMemo(() => getServices(), []);
  const minimumScheduleDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    const queryServiceId = searchParams.get('service');

    if (!queryServiceId) {
      return;
    }

    if (!services.some((service) => service.id === queryServiceId)) {
      console.warn(`Service ${queryServiceId} not found`);
      return;
    }

    setFormData((prev) => {
      // Only update if the service isn't already selected
      if (prev.service_ids.includes(queryServiceId)) {
        return prev;
      }

      return {
        ...prev,
        service_ids: [queryServiceId],
      };
    });
  }, [searchParams, services]);

  const canEstimate = useMemo(() => {
    return (
      formData.service_ids.length > 0 &&
      formData.address.trim().length > 0 &&
      formData.city.trim().length > 0 &&
      formData.state.trim().length > 0 &&
      formData.zip_code.trim().length > 0
    );
  }, [formData]);

  const handleServiceToggle = (serviceId: string) => {
    setFormData((prev) => {
      const exists = prev.service_ids.includes(serviceId);
      return {
        ...prev,
        service_ids: exists
          ? prev.service_ids.filter((id) => id !== serviceId)
          : [...prev.service_ids, serviceId],
      };
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'scheduled_date') {
      setFormData((prev) => ({
        ...prev,
        scheduled_date: value,
        scheduled_time: '',
      }));
      return;
    }

    if (name === 'scheduled_duration_minutes') {
      setFormData((prev) => ({
        ...prev,
        scheduled_duration_minutes: Number(value) || 60,
        scheduled_time: '',
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const fetchAvailabilityForDate = useCallback(async (date: string): Promise<AvailabilitySlot[]> => {
    const response = await fetch(
      `/api/bookings/availability?date=${encodeURIComponent(date)}&durationMinutes=${encodeURIComponent(String(formData.scheduled_duration_minutes || 60))}`
    );
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
          setFormData((prev) => ({
            ...prev,
            scheduled_date: minimumScheduleDate,
            scheduled_time: '',
          }));
          setAvailabilitySlots([]);
          return;
        }

        const soonest = openDates[0];
        const soonestSlots = soonest.openTimes.map((time) => ({ time, status: 'open' as const }));
        setFormData((prev) => ({
          ...prev,
          scheduled_date: soonest.date,
          scheduled_time: soonest.openTimes[0] || '',
        }));
        setAvailabilitySlots(soonestSlots);
      } catch (error) {
        setAvailabilityError(error instanceof Error ? error.message : 'Failed to load availability');
      } finally {
        setAvailabilityLoading(false);
      }
    };

    void bootstrapSoonestOpen();
  }, [loadUpcomingOpenDates, minimumScheduleDate]);

  useEffect(() => {
    void loadAvailability(formData.scheduled_date);
  }, [formData.scheduled_date, loadAvailability]);

  const selectTimeSlot = (time: string) => {
    setFormData((prev) => ({
      ...prev,
      scheduled_time: time,
    }));
  };

  const openSlots = useMemo(() => {
    return availabilitySlots.filter((slot) => slot.status === 'open');
  }, [availabilitySlots]);

  const getAiEstimate = async () => {
    if (!canEstimate) {
      setErrors(['Select at least one service and enter full address to get an estimate']);
      return;
    }

    setEstimating(true);
    setErrors([]);

    try {
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          service_ids: formData.service_ids,
          lawn_mowing_frequency: formData.service_ids.includes('lawn_mowing') ? formData.lawn_mowing_frequency : undefined,
          lawn_initial_overgrowth: formData.service_ids.includes('lawn_mowing') ? formData.lawn_initial_overgrowth === 'yes' : undefined,
          lawn_bag_clippings: formData.service_ids.includes('lawn_mowing') ? formData.lawn_bag_clippings === 'yes' : undefined,
          lawn_heavy_pet_waste: formData.service_ids.includes('lawn_mowing') ? formData.lawn_heavy_pet_waste === 'yes' : undefined,
          lawn_access_blocked: formData.service_ids.includes('lawn_mowing') ? formData.lawn_access_blocked === 'yes' : undefined,
          window_count: formData.window_count ? Number(formData.window_count) : undefined,
          window_scope: formData.service_ids.includes('window_cleaning') ? formData.window_scope : undefined,
          window_screen_track_count: formData.window_screen_track_count ? Number(formData.window_screen_track_count) : undefined,
          gutter_story_count: formData.service_ids.includes('gutter_cleaning') ? Number(formData.gutter_story_count) : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrors([errorData.error || 'Failed to get estimate']);
        return;
      }

      const data = await response.json();
      const estimatedPriceValue = Number(data.estimated_price);
      const inferredPropertySqftValue = Number(data.inferred_property_sqft);
      const inferredYardSqftValue = Number(data.inferred_yard_sqft);

      if (Number.isFinite(estimatedPriceValue) && estimatedPriceValue > 0) {
        setEstimatedPrice(estimatedPriceValue);
      } else {
        setErrors(['Unable to calculate estimate right now']);
        return;
      }

      if (Number.isFinite(inferredPropertySqftValue) && inferredPropertySqftValue > 0) {
        setInferredPropertySqft(inferredPropertySqftValue);
      }

      if (Number.isFinite(inferredYardSqftValue) && inferredYardSqftValue > 0) {
        setInferredYardSqft(inferredYardSqftValue);
      }

      setEstimateSource(data.source === 'ai' ? 'ai' : 'standard');
    } catch (error) {
      setErrors(['Error connecting to estimate service']);
      console.error('Estimate error:', error);
    } finally {
      setEstimating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const validationResults = validateBookingForm(formData);
    if (!validationResults.valid) {
      setErrors(validationResults.errors);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          estimated_price: estimatedPrice || 0,
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
    } catch (error) {
      setErrors(['Error submitting booking']);
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedServices = services.filter((s) => formData.service_ids.includes(s.id));
  const includesLawnMowing = selectedServices.some((service) => service.id === 'lawn_mowing');
  const includesWindowCleaning = selectedServices.some((service) => service.id === 'window_cleaning');
  const includesGutterCleaning = selectedServices.some((service) => service.id === 'gutter_cleaning');

  return (
    <main className="page-shell min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />

      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-2 appear-up">Book a Service</h1>
        <p className="text-lg text-slate-700 mb-8 appear-up stagger-1">
          Get a personalized estimate and schedule your service in minutes.
        </p>

        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8 appear-up">
            <p className="text-green-800 font-semibold">✓ Booking submitted successfully!</p>
            <p className="text-green-700 text-sm mt-1">Redirecting to home...</p>
          </div>
        )}

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8 appear-up">
            <p className="text-red-800 font-semibold mb-2">Please fix these errors:</p>
            <ul className="text-red-700 text-sm space-y-1">
              {errors.map((error, i) => <li key={i}>• {error}</li>)}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Service Selection */}
          <div className="surface-card p-8 appear-up">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">1. Select Services</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <label key={service.id} className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-emerald-50 transition">
                  <input
                    type="checkbox"
                    checked={formData.service_ids.includes(service.id)}
                    onChange={() => handleServiceToggle(service.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{service.name}</p>
                    <p className="text-sm text-slate-600">${service.minimum_price}+</p>
                  </div>
                </label>
              ))}
            </div>

            {includesLawnMowing && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Lawn Mowing Details</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Choose the mowing frequency and any add-ons that apply to the visit.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <select
                    name="lawn_mowing_frequency"
                    value={formData.lawn_mowing_frequency}
                    onChange={handleInputChange}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="bi_weekly">Bi-weekly</option>
                  </select>
                  <select
                    name="lawn_initial_overgrowth"
                    value={formData.lawn_initial_overgrowth}
                    onChange={handleInputChange}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="no">No overgrowth cut</option>
                    <option value="yes">Initial overgrowth cut</option>
                  </select>
                  <select
                    name="lawn_bag_clippings"
                    value={formData.lawn_bag_clippings}
                    onChange={handleInputChange}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="no">Mulch clippings</option>
                    <option value="yes">Bag clippings (+$10)</option>
                  </select>
                  <select
                    name="lawn_heavy_pet_waste"
                    value={formData.lawn_heavy_pet_waste}
                    onChange={handleInputChange}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="no">No heavy pet waste</option>
                    <option value="yes">Heavy pet waste (+$15)</option>
                  </select>
                  <select
                    name="lawn_access_blocked"
                    value={formData.lawn_access_blocked}
                    onChange={handleInputChange}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="no">Full access available</option>
                    <option value="yes">Locked gate / blocked yard</option>
                  </select>
                </div>
              </div>
            )}

            {includesWindowCleaning && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Window Cleaning Details</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Add the window count and cleaning scope so the estimate uses the base trip fee plus per-window pricing.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input
                    type="number"
                    min="1"
                    name="window_count"
                    placeholder="Number of windows"
                    value={formData.window_count}
                    onChange={handleInputChange}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <select
                    name="window_scope"
                    value={formData.window_scope}
                    onChange={handleInputChange}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="exterior">Exterior only</option>
                    <option value="interior_exterior">Interior and exterior</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    name="window_screen_track_count"
                    placeholder="Screens/tracks count"
                    value={formData.window_screen_track_count}
                    onChange={handleInputChange}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {includesGutterCleaning && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Gutter Cleaning Details</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Gutter cleaning is priced from home size and story count only.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <select
                    name="gutter_story_count"
                    value={formData.gutter_story_count}
                    onChange={handleInputChange}
                    className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="1">Single-story</option>
                    <option value="2">Two-story</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Address Information */}
          <div className="surface-card p-8 appear-up stagger-1">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">2. Property Address</h2>
            <div className="space-y-4">
              <input
                type="text"
                name="address"
                placeholder="Street Address"
                value={formData.address}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  name="city"
                  placeholder="City"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="ID">Idaho</option>
                  <option value="WA">Washington</option>
                  <option value="OR">Oregon</option>
                  <option value="UT">Utah</option>
                </select>
                <input
                  type="text"
                  name="zip_code"
                  placeholder="ZIP Code"
                  value={formData.zip_code}
                  onChange={handleInputChange}
                  className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Estimate */}
          <div className="surface-card p-8 appear-up stagger-2">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">3. Get Estimate</h2>
            <button
              type="button"
              onClick={getAiEstimate}
              disabled={!canEstimate || estimating}
              className="btn-primary mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {estimating ? 'Getting Estimate...' : 'Get AI Estimate'}
            </button>

            {estimatedPrice !== null && (
              <div className="bg-emerald-50 p-6 rounded-lg border border-emerald-200">
                <p className="text-sm text-slate-600 mb-2">Estimated Price</p>
                <p className="text-4xl font-bold text-emerald-700">${estimatedPrice.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Source: {estimateSource === 'ai' ? 'AI-assisted estimate' : 'Standard pricing estimate'}
                </p>
                {(inferredPropertySqft || inferredYardSqft) && (
                  <p className="text-xs text-slate-500 mt-1">
                    Inferred size: {inferredPropertySqft || 'N/A'} sqft home, {inferredYardSqft || 'N/A'} sqft lot
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="surface-card p-8 appear-up stagger-3">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">4. Your Information</h2>
            <div className="space-y-4">
              <input
                type="text"
                name="customer_name"
                placeholder="Full Name"
                value={formData.customer_name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
              <input
                type="email"
                name="customer_email"
                placeholder="Email Address"
                value={formData.customer_email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <input
                type="tel"
                name="customer_phone"
                placeholder="Phone Number"
                value={formData.customer_phone}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="surface-card p-8 appear-up stagger-4">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">5. Schedule Service</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <input
                type="date"
                name="scheduled_date"
                value={formData.scheduled_date}
                onChange={handleInputChange}
                min={minimumScheduleDate}
                className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <select
                name="scheduled_duration_minutes"
                value={String(formData.scheduled_duration_minutes || 60)}
                onChange={handleInputChange}
                className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
              </select>
              <div className="px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-600 flex items-center">
                {formData.scheduled_time ? `Selected time: ${formData.scheduled_time}` : 'Select a date to view open times'}
              </div>
            </div>

            {quickSelectDates.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">Next closest open dates</p>
                <div className="flex flex-wrap gap-2">
                  {quickSelectDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, scheduled_date: date, scheduled_time: '' }))}
                      className="px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-slate-700 text-xs hover:bg-slate-100"
                    >
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
                  <button
                    type="button"
                    onClick={() => void loadAvailability(formData.scheduled_date)}
                    className="text-xs px-3 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Refresh
                  </button>
                </div>

                {availabilityLoading && <p className="text-sm text-slate-600">Loading live availability...</p>}
                {availabilityError && <p className="text-sm text-red-600">{availabilityError}</p>}

                {!availabilityLoading && !availabilityError && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700">Open slot</span>
                      <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Selected slot</span>
                    </div>

                    <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/40">
                      <p className="text-sm font-semibold text-emerald-800 mb-2">Open Times</p>
                      {openSlots.length === 0 ? (
                        <p className="text-sm text-amber-700">No available times this date.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {openSlots.map((slot) => {
                            const isSelected = formData.scheduled_time === slot.time;
                            return (
                              <button
                                key={slot.time}
                                type="button"
                                onClick={() => selectTimeSlot(slot.time)}
                                className={[
                                  'px-3 py-2 rounded text-sm border bg-white text-slate-800 border-emerald-300 hover:border-emerald-500',
                                  isSelected ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-100/70' : '',
                                ].join(' ')}
                              >
                                {slot.time}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <textarea
              name="notes"
              placeholder="Any special instructions or notes?"
              value={formData.notes}
              onChange={handleInputChange}
              className="w-full mt-4 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              rows={4}
            />
          </div>

          {/* Submit */}
          <div className="surface-card p-8 appear-up stagger-5">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Complete Booking'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  calculateMultiServiceEstimate,
  getServices,
  SERVICE_PACKAGES,
  validateBookingForm,
} from '@/lib/services/pricingService';

type EstimateSource = 'standard' | 'ai';

export default function BookingContent() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    service_ids: [] as string[],
    package_id: '',
    address: '',
    city: '',
    state: 'ID',
    zip_code: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    scheduled_date: '',
    scheduled_time: '',
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

  const services = useMemo(() => getServices(), []);

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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrors([errorData.message || 'Failed to get estimate']);
        return;
      }

      const data = await response.json();
      setInferredPropertySqft(data.property_sqft);
      setInferredYardSqft(data.yard_sqft);
      setEstimatedPrice(data.estimate_price);
      setEstimateSource('ai');
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
        setErrors([errorData.message || 'Booking failed']);
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
                <p className="text-xs text-slate-500 mt-2">Based on property size and services selected</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="date"
                name="scheduled_date"
                value={formData.scheduled_date}
                onChange={handleInputChange}
                className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <input
                type="time"
                name="scheduled_time"
                value={formData.scheduled_time}
                onChange={handleInputChange}
                className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
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

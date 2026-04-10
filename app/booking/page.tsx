import { Suspense } from 'react';
import BookingContent from './booking-content';

function BookingLoading() {
  return (
    <main className="page-shell min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto surface-card p-6 sm:p-8">
        <div className="h-10 bg-slate-200 rounded animate-pulse mb-4"></div>
        <div className="h-6 bg-slate-200 rounded animate-pulse mb-8"></div>
      </div>
    </main>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<BookingLoading />}>
      <BookingContent />
    </Suspense>
  );
}
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
          service_ids: formData.service_ids,
          package_id: formData.package_id || undefined,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          notes: formData.notes,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrors([data.error || 'Unable to estimate pricing right now']);
        return;
      }

      if (typeof data.estimated_price === 'number') {
        setEstimatedPrice(data.estimated_price);
        setEstimateSource(data.source === 'ai' ? 'ai' : 'standard');
      }

      if (typeof data.inferred_property_sqft === 'number') {
        setInferredPropertySqft(data.inferred_property_sqft);
      }
      if (typeof data.inferred_yard_sqft === 'number') {
        setInferredYardSqft(data.inferred_yard_sqft);
      }
    } catch {
      setErrors(['Unable to estimate pricing right now']);
    } finally {
      setEstimating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const validation = validateBookingForm({
      ...formData,
      package_id: formData.package_id || undefined,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    let propertySqft = inferredPropertySqft ?? 1840;
    let yardSqft = inferredYardSqft ?? 5500;
    let finalEstimate =
      estimatedPrice ??
      calculateMultiServiceEstimate(formData.service_ids, propertySqft, yardSqft, formData.package_id || undefined);

    if (estimatedPrice === null) {
      try {
        const response = await fetch('/api/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_ids: formData.service_ids,
            package_id: formData.package_id || undefined,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zip_code: formData.zip_code,
            notes: formData.notes,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          if (typeof data.estimated_price === 'number') {
            finalEstimate = data.estimated_price;
            setEstimatedPrice(finalEstimate);
            setEstimateSource(data.source === 'ai' ? 'ai' : 'standard');
          }
          if (typeof data.inferred_property_sqft === 'number') {
            propertySqft = data.inferred_property_sqft;
            setInferredPropertySqft(propertySqft);
          }
          if (typeof data.inferred_yard_sqft === 'number') {
            yardSqft = data.inferred_yard_sqft;
            setInferredYardSqft(yardSqft);
          }
        }
      } catch {
        // Keep fallback estimate.
      }
    }

    setLoading(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_ids: formData.service_ids,
          package_id: formData.package_id || undefined,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          property_sqft: propertySqft,
          yard_sqft: yardSqft,
          customer_name: formData.customer_name,
          customer_email: formData.customer_email || undefined,
          customer_phone: formData.customer_phone || undefined,
          notes: formData.notes,
          estimated_price: finalEstimate,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrors([data.error || 'Failed to submit booking. Please try again.']);
        return;
      }

      setSubmitted(true);
      setFormData({
        service_ids: [],
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
      setEstimatedPrice(null);
      setInferredPropertySqft(null);
      setInferredYardSqft(null);
      setTimeout(() => setSubmitted(false), 5000);
    } catch {
      setErrors(['An error occurred. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto surface-card p-6 sm:p-8 appear-up">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">Book Services</h1>
        <p className="text-slate-700 mb-8">
          Select services, provide your address, and use AI to generate a more personalized estimate before submitting.
        </p>

        {submitted && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 appear-up">
            ✓ Booking submitted successfully! We&apos;ll contact you soon to confirm.
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg appear-up">
            <p className="text-red-800 font-semibold mb-2">Please fix these errors:</p>
            <ul className="list-disc list-inside text-red-700">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Services <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border border-emerald-200 rounded-xl bg-white/80 max-h-64 overflow-auto">
              {services.map((service) => (
                <label key={service.id} className="flex items-center gap-2 text-sm text-slate-800 rounded-lg px-2 py-1 hover:bg-emerald-50">
                  <input
                    type="checkbox"
                    checked={formData.service_ids.includes(service.id)}
                    onChange={() => handleServiceToggle(service.id)}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  {service.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Package (optional)</label>
            <select
              name="package_id"
              value={formData.package_id}
              onChange={handleInputChange}
              className="field-shell"
            >
              <option value="">No package</option>
              {SERVICE_PACKAGES.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} ({pkg.discountPercent}% off)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="address"
              placeholder="123 Main Street"
              value={formData.address}
              onChange={handleInputChange}
              className="field-shell"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="city"
                placeholder="Boise"
                value={formData.city}
                onChange={handleInputChange}
                className="field-shell"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                className="field-shell"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                ZIP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="zip_code"
                placeholder="83702"
                value={formData.zip_code}
                onChange={handleInputChange}
                className="field-shell"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={getAiEstimate}
              disabled={estimating || !canEstimate}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {estimating ? 'Analyzing...' : 'Get AI Estimate'}
            </button>
            <p className="text-sm text-slate-600">AI uses address and service selections to infer size and pricing.</p>
          </div>

          {estimatedPrice !== null && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl appear-up">
              <p className="text-sm text-slate-600">
                Estimated Price {estimateSource === 'ai' ? '(AI analyzed)' : '(standard)'}
              </p>
              <p className="text-3xl font-bold text-emerald-700">${estimatedPrice.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-2">
                Inferred house size: {inferredPropertySqft ?? 'n/a'} sqft | Inferred yard size: {inferredYardSqft ?? 'n/a'} sqft
              </p>
            </div>
          )}

          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Contact Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="customer_name"
                  placeholder="John Doe"
                  value={formData.customer_name}
                  onChange={handleInputChange}
                  className="field-shell"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">Email</label>
                  <input
                    type="email"
                    name="customer_email"
                    placeholder="john@example.com"
                    value={formData.customer_email}
                    onChange={handleInputChange}
                    className="field-shell"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">Phone</label>
                  <input
                    type="tel"
                    name="customer_phone"
                    placeholder="(208) 555-1234"
                    value={formData.customer_phone}
                    onChange={handleInputChange}
                    className="field-shell"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">Provide at least one: email or phone.</p>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Notes</label>
                <textarea
                  name="notes"
                  placeholder="Any details about timing, gate access, pets, or special requests..."
                  rows={3}
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="field-shell"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit Booking'}
          </button>
        </form>
      </div>
    </main>
  );
}

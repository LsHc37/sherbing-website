import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServices } from '@/lib/services/pricingService';
import { SERVICE_DETAILS } from '@/lib/services/serviceDetails';

const serviceIcons: Record<string, string> = {
  lawn_mowing: '🌿',
  lawn_treatment: '💚',
  landscaping: '🌲',
  snow_removal: '❄️',
  gutter_cleaning: '🧼',
  hedge_trimming: '✂️',
  window_cleaning: '🪟',
  yard_cleanup: '🧱',
  tree_service: '🌲',
  deck_staining: '🪵',
  fence_painting: '🎨',
  fence_staining: '🪵',
  mulch_installation: '🌱',
  rock_installation: '💎',
  dog_waste_removal: '🐕',
  lawn_mow_dog_waste_combo: '🌿',
  pool_cleaning: '💦',
};

export function generateStaticParams() {
  return getServices().map((service) => ({ serviceId: service.id }));
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const service = getServices().find((item) => item.id === serviceId);

  if (!service) {
    notFound();
  }

  const icon = serviceIcons[service.id] || '🏡';
  const details = SERVICE_DETAILS[service.id];

  return (
    <main className="page-shell min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />

      <header className="glass-nav sticky top-0 z-40 mb-8">
        <nav className="section-container py-4">
          <Link href="/" className="text-slate-700 hover:text-slate-900 text-sm">
            ← Back to Home
          </Link>
        </nav>
      </header>

      <div className="max-w-4xl mx-auto">
        <div className="surface-card p-8 sm:p-12 mb-8 appear-up">
          <div className="flex items-start gap-6 mb-8">
            <div className="text-7xl">{icon}</div>
            <div className="flex-1">
              <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-2">{service.name}</h1>
              <p className="text-2xl text-emerald-700 font-semibold">Starting from ${service.minimum_price}</p>
            </div>
          </div>

          <p className="text-lg text-slate-700 leading-relaxed mb-6">
            {details?.fullDescription || service.description}
          </p>

          {service.rating && (
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xl">
                {'★'.repeat(Math.round(service.rating))}
                {'☆'.repeat(5 - Math.round(service.rating))}
              </span>
              <span className="text-slate-600">{service.rating.toFixed(1)}/5 rating</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm text-slate-600 mb-1">Base Price</p>
              <p className="text-2xl font-bold text-emerald-700">${service.minimum_price}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-slate-600 mb-1">Service Type</p>
              <p className="text-xl font-semibold text-slate-900 capitalize">{service.name}</p>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="surface-card p-8 sm:p-12 mb-8 appear-up stagger-1">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Benefits of {service.name}</h2>
          {details && details.benefits.length > 0 ? (
            <ul className="space-y-3">
              {details.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-green-600 text-xl mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-slate-700">{benefit}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-6 space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-green-600 text-xl mt-0.5">✓</span>
                <span className="text-slate-700">Professional and experienced team</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600 text-xl mt-0.5">✓</span>
                <span className="text-slate-700">Fast and reliable service in the Boise area</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600 text-xl mt-0.5">✓</span>
                <span className="text-slate-700">Transparent pricing with no hidden fees</span>
              </li>
            </ul>
          )}
        </div>

        {/* Process Section */}
        <div className="surface-card p-8 sm:p-12 mb-8 appear-up stagger-2">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">How Our Process Works</h2>
          {details && details.process.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {details.process.map((step, index) => (
                <div key={index} className="text-center sm:text-left">
                  <div className="text-4xl font-bold text-emerald-700 mb-3">{index + 1}</div>
                  <p className="text-sm text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-emerald-700 mb-2">1</div>
                <h3 className="font-semibold text-slate-900 mb-2">Review Service</h3>
                <p className="text-sm text-slate-600">Read the service details and pricing.</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-emerald-700 mb-2">2</div>
                <h3 className="font-semibold text-slate-900 mb-2">Book It</h3>
                <p className="text-sm text-slate-600">Jump to booking with this service already selected.</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-emerald-700 mb-2">3</div>
                <h3 className="font-semibold text-slate-900 mb-2">Get It Done</h3>
                <p className="text-sm text-slate-600">We handle the rest after submission.</p>
              </div>
            </div>
          )}
        </div>

        {/* FAQs Section */}
        {details && details.faqs.length > 0 && (
          <div className="surface-card p-8 sm:p-12 mb-8 appear-up stagger-2">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {details.faqs.map((faq, index) => (
                <div key={index} className="border-b border-slate-200 pb-6 last:border-b-0 last:pb-0">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{faq.question}</h3>
                  <p className="text-slate-700 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-emerald-300 bg-gradient-to-r from-emerald-700 via-emerald-800 to-slate-900 text-white px-8 py-12 sm:px-12 sm:py-16 text-center appear-up stagger-3">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to book {service.name.toLowerCase()}?</h2>
          <p className="text-emerald-100 text-lg mb-8 max-w-2xl mx-auto">
            Tap the button below to open the booking page with this service already selected.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/booking?service=${service.id}`}
              className="inline-flex items-center justify-center rounded-xl bg-white text-emerald-800 px-8 py-3 font-semibold hover:bg-emerald-50 transition"
            >
              Book This Service
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/30 px-8 py-3 font-semibold hover:bg-white/20 transition"
            >
              Back Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { getServices } from '@/lib/services/pricingService';

export default function ServiceShowcase() {
  const services = getServices();
  const serviceIcons = ['🌿', '🌲', '🧱', '❄️', '🧼', '🪵', '🌱'];

  return (
    <section className="py-16">
      <div className="section-container">
        <h2 className="text-4xl sm:text-5xl font-bold text-center text-slate-900 mb-4 appear-up">Our Services</h2>
        <p className="text-center text-slate-700 text-lg mb-12 appear-up stagger-1">
          Professional landscaping and home exterior solutions tailored to your property
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={service.id}
              className="surface-card overflow-hidden appear-up"
              style={{ animationDelay: `${80 * (index + 1)}ms` }}
            >
              <div className="w-full h-44 bg-gradient-to-br from-emerald-100 via-lime-100 to-emerald-200 flex items-center justify-center border-b border-emerald-200/70">
                <div className="text-6xl">{serviceIcons[index % serviceIcons.length]}</div>
              </div>

              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{service.name}</h3>
                <p className="text-slate-700 text-sm mb-5 min-h-12">{service.description}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Starting Price:</span>
                    <span className="font-semibold text-emerald-700">${service.minimum_price}</span>
                  </div>
                  {service.rating && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 flex items-center gap-1">
                        Rating: <span className="text-yellow-500">{'★'.repeat(Math.round(service.rating))}</span>
                      </span>
                      <span className="text-slate-700 font-medium">{service.rating.toFixed(1)}/5</span>
                    </div>
                  )}
                </div>

                <Link href={`/services/${service.id}`} className="btn-primary w-full mt-6 text-center block">
                  Learn More
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

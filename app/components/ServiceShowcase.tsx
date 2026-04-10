'use client';

import Link from 'next/link';
import { getServices } from '@/lib/services/pricingService';

const serviceIcons: Record<string, string> = {
  lawn_mowing: '✂️',
  lawn_treatment: '🌱',
  landscaping: '🌳',
  snow_removal: '❄️',
  gutter_cleaning: '🧽',
  hedge_trimming: '🌿',
  window_cleaning: '✨',
  yard_cleanup: '🧹',
  tree_service: '🪚',
  deck_staining: '🎨',
  fence_painting: '🖌️',
  fence_staining: '🏡',
  mulch_installation: '🟤',
  rock_installation: '⛰️',
  dog_waste_removal: '🐕',
  lawn_mow_dog_waste_combo: '⚡',
  pool_cleaning: '💦',
};

export default function ServiceShowcase() {
  const services = getServices();

  return (
    <section className="py-16">
      <div className="section-container">
        <h2 className="text-4xl sm:text-5xl font-bold text-center text-slate-900 mb-4 appear-up">Our Services</h2>
        <p className="text-center text-slate-700 text-lg mb-12 appear-up stagger-1">
          Professional landscaping and home exterior solutions tailored to your property
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => {
            const icon = serviceIcons[service.id] || '⚙️';
            
            return (
              <div
                key={service.id}
                className="surface-card overflow-hidden appear-up hover:shadow-lg transition-shadow"
                style={{ animationDelay: `${80 * (index + 1)}ms` }}
              >
                <div className="w-full h-48 bg-gradient-to-br from-emerald-100 via-lime-100 to-emerald-200 flex items-center justify-center border-b-4 border-emerald-300 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-emerald-400/10 group-hover:bg-emerald-400/20 transition-colors" />
                  <div className="text-7xl group-hover:scale-110 transition-transform duration-300">{icon}</div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{service.name}</h3>
                  <p className="text-slate-700 text-sm mb-4 min-h-10 line-clamp-2">{service.description}</p>

                  <div className="space-y-3 border-t border-slate-200 pt-4">
                    <div className="bg-emerald-50 px-3 py-2 rounded-lg">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Starting From</p>
                      <p className="text-2xl font-bold text-emerald-700">${service.minimum_price}</p>
                    </div>
                    
                    {service.rating && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">Rating:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-500 font-bold text-lg">{service.rating.toFixed(1)}</span>
                          <span className="text-yellow-400">★</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Link href={`/services/${service.id}`} className="btn-primary w-full mt-5 text-center block hover:shadow-md transition">
                    Learn More
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

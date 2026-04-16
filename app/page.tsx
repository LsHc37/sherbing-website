import Link from 'next/link';
import Logo from '@/app/components/Logo';
import ServiceShowcase from '@/app/components/ServiceShowcase';
import AuthNavActions from '@/app/components/AuthNavActions';

export default function Home() {
  return (
    <main className="page-shell min-h-screen pb-20">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />

      <header className="glass-nav sticky top-0 z-40">
        <nav className="section-container py-4 flex justify-between items-center">
          <Logo variant="icon" size="small" />
          <AuthNavActions />
        </nav>
      </header>

      <section className="section-container pt-18 sm:pt-24 pb-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-center">
          <div className="appear-up">
            <p className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold tracking-wide bg-white/80 border border-green-200 text-green-800 mb-5">
              Trusted across Boise neighborhoods
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-slate-900">
              Outdoor spaces that feel better every season.
            </h1>
            <p className="text-lg sm:text-xl text-slate-700 mt-5 max-w-2xl">
              From weekly lawn care to one-time transformations, Sherbing makes it easy to estimate, book, and manage high-quality home services in one flow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/booking" className="btn-primary px-6 py-3">
                Book a Service
              </Link>
              <Link href="/specials" className="btn-secondary px-6 py-3">
                View Specials
              </Link>
              <Link href="/careers" className="btn-secondary px-6 py-3">
                Careers
              </Link>
              <Link href="#services" className="btn-secondary px-6 py-3">
                Explore Services
              </Link>
            </div>
          </div>

          <div className="surface-card p-7 appear-up stagger-2">
            <h2 className="text-2xl font-bold text-slate-900">Why homeowners choose Sherbing</h2>
            <div className="mt-5 space-y-4 text-sm sm:text-base text-slate-700">
              <div className="flex items-start gap-3">
                <span className="mt-1 text-green-700">01</span>
                <p>Fast estimate tools with transparent base pricing before checkout.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-1 text-green-700">02</span>
                <p>Simple online booking, secure account access, and live request tracking.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-1 text-green-700">03</span>
                <p>Local Boise-focused team for seasonal and year-round property care.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-container pb-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { value: '24h', label: 'Typical response window' },
            { value: '6+', label: 'Core service categories' },
            { value: '4.9', label: 'Average customer satisfaction' },
          ].map((item, index) => (
            <div key={item.label} className={`surface-card p-6 text-center appear-up stagger-${index + 1}`}>
              <p className="text-4xl font-bold text-green-800">{item.value}</p>
              <p className="mt-2 text-sm uppercase tracking-wider text-slate-600">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-container pb-14">
        <div className="rounded-3xl border border-amber-300 bg-gradient-to-r from-amber-100 via-lime-50 to-emerald-100 px-6 py-8 sm:px-10 sm:py-10 appear-up stagger-2">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-900">
                Special Offers
              </p>
              <h2 className="mt-4 text-3xl font-bold text-slate-950">See current specials and seasonal deals.</h2>
              <p className="mt-3 max-w-2xl text-slate-700 leading-7">
                Compare our current offers, including the Premium Summer Cleanup special, and jump straight to the booking flow that fits your property.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/specials" className="btn-primary px-6 py-3">
                View All Specials
              </Link>
              <Link href="/special-booking" className="btn-secondary px-6 py-3">
                Book Summer Special
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div id="services" className="appear-up stagger-2">
        <ServiceShowcase />
      </div>

      <section className="section-container mt-14">
        <div className="rounded-3xl border border-emerald-300 bg-gradient-to-r from-emerald-700 via-emerald-800 to-slate-900 text-white px-6 py-10 sm:px-10 sm:py-14 appear-up stagger-3">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to transform your yard?</h2>
          <p className="text-base sm:text-lg mt-4 text-emerald-100 max-w-2xl">
            Get a personalized estimate in minutes and lock in a service date that fits your schedule.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/booking" className="inline-flex items-center rounded-xl bg-white text-emerald-800 px-6 py-3 font-semibold hover:bg-emerald-50">
              Book Now
            </Link>
            <Link href="/signup" className="inline-flex items-center rounded-xl bg-white/10 border border-white/30 px-6 py-3 font-semibold hover:bg-white/20">
              Create Free Account
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border border-white/25 bg-white/10 px-5 py-4 text-sm sm:text-base">
            <p className="font-semibold text-white">Need help before booking?</p>
            <p className="mt-2 text-emerald-100">
              Reach Sherbing at{' '}
              <a href="mailto:contact.sherbing@gmail.com" className="font-semibold text-white underline underline-offset-4 hover:text-emerald-200">
                contact.sherbing@gmail.com
              </a>{' '}
              or{' '}
              <a href="tel:2087618136" className="font-semibold text-white underline underline-offset-4 hover:text-emerald-200">
                (208) 761-8136
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="section-container mt-14">
        <div className="flex flex-col sm:flex-row justify-between gap-4 py-6 border-t border-slate-300 text-sm text-slate-600">
          <p>Sherbing | Serve Boise with reliable outdoor service teams.</p>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-slate-900">About Us</Link>
            <Link href="/careers" className="hover:text-slate-900">Careers</Link>
            <Link href="/login" className="hover:text-slate-900">Sign In</Link>
            <Link href="/employee/login" className="hover:text-slate-900">Employee Login</Link>
            <Link href="/admin/login" className="hover:text-slate-900">Admin Login</Link>
            <Link href="/booking" className="hover:text-slate-900">Book Service</Link>
            <Link href="/signup" className="hover:text-slate-900">Get Started</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

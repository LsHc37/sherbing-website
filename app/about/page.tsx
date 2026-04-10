import Link from 'next/link';
import Logo from '@/app/components/Logo';

export default function AboutPage() {
  return (
    <main className="page-shell min-h-screen pb-20">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />

      <header className="glass-nav sticky top-0 z-40">
        <nav className="section-container py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <Logo variant="icon" size="small" />
            <span className="text-slate-900 font-semibold">Sherbing</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/booking" className="btn-secondary text-sm sm:text-base">
              Book Service
            </Link>
            <Link href="/signup" className="btn-primary text-sm sm:text-base">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <section className="section-container pt-16 sm:pt-20 pb-12">
        <div className="max-w-4xl">
          <p className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold tracking-wide bg-white/80 border border-green-200 text-green-800 mb-5 appear-up">
            About Sherbing
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-slate-900 appear-up stagger-1">
            Built in Boise to make outdoor home services simple.
          </h1>
          <p className="text-lg sm:text-xl text-slate-700 mt-5 max-w-3xl appear-up stagger-2">
            Sherbing helps homeowners book trusted landscaping and exterior services with less hassle,
            clear pricing, and a better customer experience from estimate to completion.
          </p>
        </div>
      </section>

      <section className="section-container pb-12">
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="surface-card p-7 appear-up">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Our Mission</h2>
            <p className="text-slate-700 leading-relaxed">
              We believe homeowners should be able to maintain beautiful outdoor spaces without chasing
              quotes, playing phone tag, or guessing final pricing. Sherbing exists to make the process
              fast, transparent, and reliable.
            </p>
          </article>

          <article className="surface-card p-7 appear-up stagger-1">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">What We Do</h2>
            <p className="text-slate-700 leading-relaxed">
              From lawn mowing and treatments to seasonal cleanup, fence and deck care, and specialty
              services, we connect Boise-area customers with dependable crews and modern booking tools.
            </p>
          </article>

          <article className="surface-card p-7 appear-up stagger-2">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Why Customers Stay</h2>
            <p className="text-slate-700 leading-relaxed">
              Customers choose Sherbing for responsive communication, straightforward estimates, and a
              smooth online flow. We focus on consistency, quality, and making sure the job gets done right.
            </p>
          </article>
        </div>
      </section>

      <section className="section-container pb-12">
        <div className="surface-card p-8 sm:p-10 appear-up stagger-2">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">How Sherbing Works</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-3xl font-bold text-emerald-700">01</p>
              <p className="text-slate-700 mt-2">Choose one or more services that match your property needs.</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-700">02</p>
              <p className="text-slate-700 mt-2">Use your address to get a faster, more informed estimate.</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-700">03</p>
              <p className="text-slate-700 mt-2">Book online and share details like timing, access, and notes.</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-700">04</p>
              <p className="text-slate-700 mt-2">Track your request and get service delivered by trusted teams.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-container pb-14">
        <div className="rounded-3xl border border-emerald-300 bg-gradient-to-r from-emerald-700 via-emerald-800 to-slate-900 text-white px-6 py-10 sm:px-10 sm:py-14 appear-up stagger-3">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to work with Sherbing?</h2>
          <p className="text-base sm:text-lg mt-4 text-emerald-100 max-w-2xl">
            Start with a service that fits your home and schedule. We&apos;ll help you get from quote to completed job quickly.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/booking" className="inline-flex items-center rounded-xl bg-white text-emerald-800 px-6 py-3 font-semibold hover:bg-emerald-50">
              Book Now
            </Link>
            <Link href="/services/lawn_mowing" className="inline-flex items-center rounded-xl bg-white/10 border border-white/30 px-6 py-3 font-semibold hover:bg-white/20">
              Explore Services
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

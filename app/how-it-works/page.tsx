import Link from 'next/link';
import Logo from '@/app/components/Logo';
import AuthNavActions from '@/app/components/AuthNavActions';
import HowItWorksExperience from '@/app/components/HowItWorksExperience';

export default function HowItWorksPage() {
  return (
    <main className="page-shell min-h-screen pb-20">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />

      <header className="glass-nav sticky top-0 z-40">
        <nav className="section-container py-4 flex justify-between items-center">
          <Link href="/">
            <Logo variant="icon" size="small" />
          </Link>
          <AuthNavActions />
        </nav>
      </header>

      <section className="section-container pt-16 sm:pt-20">
        <p className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold tracking-wide bg-white/80 border border-green-200 text-green-800 mb-4">
          Browser game style walkthrough
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 max-w-4xl">
          How it works: choose services and watch your house get cleaned in real time.
        </h1>
        <p className="text-lg text-slate-700 mt-5 max-w-3xl leading-8">
          This interactive preview starts with long grass, dirty gutters, weeds, and buildup on the house. Select the jobs
          your property needs and run the demo to see each service animation complete step by step.
        </p>
      </section>

      <section className="section-container pb-14">
        <HowItWorksExperience />
      </section>

      <section className="section-container mt-12">
        <div className="rounded-3xl border border-emerald-300 bg-gradient-to-r from-emerald-700 via-emerald-800 to-slate-900 text-white px-6 py-9 sm:px-10 sm:py-12">
          <h2 className="text-3xl font-bold">Ready to book the real service?</h2>
          <p className="text-base sm:text-lg mt-3 text-emerald-100 max-w-2xl">
            Use the booking flow to choose your date and lock in the exact services you just previewed.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/booking" className="inline-flex items-center rounded-xl bg-white text-emerald-800 px-6 py-3 font-semibold hover:bg-emerald-50">
              Book Service
            </Link>
            <Link href="/specials" className="inline-flex items-center rounded-xl bg-white/10 border border-white/30 px-6 py-3 font-semibold hover:bg-white/20">
              View Specials
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

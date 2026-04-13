import Link from 'next/link';
import Image from 'next/image';
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
              We focus on lawn mowing, lawn treatment, snow removal, gutter cleaning, dog waste pickup,
              window cleaning, and hedge trimming for Boise-area homeowners.
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

      <section className="section-container pb-12">
        <div className="surface-card p-8 sm:p-10 appear-up stagger-3">
          <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-slate-100 aspect-[4/5]">
              <Image
                src="/photo.jpg"
                alt="Lucas Mellen, Founder and CEO of Sherbing"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 320px"
                className="object-cover"
              />
            </div>

            <div>
              <p className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold tracking-wide bg-emerald-50 border border-emerald-200 text-emerald-800 mb-4">
                Meet the Founder
              </p>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">About Me</h2>
              <p className="text-xl font-semibold text-slate-900">Lucas Mellen</p>
              <p className="text-emerald-700 font-medium mb-5">Founder &amp; CEO, Sherbing</p>
              <p className="text-slate-700 leading-relaxed mb-4">
                I&apos;m Lucas Mellen, Founder &amp; CEO of Sherbing. I&apos;m 17 years old and based in Boise,
                Idaho. I started Sherbing to build something useful for real families and homeowners,
                and to make everyday outdoor services feel easier and less stressful.
              </p>
              <p className="text-slate-700 leading-relaxed mb-4">
                I&apos;m also the founder and CEO of Retrogigz, a tech company that supports the other
                businesses I&apos;m building. A big part of why I do this work is that I love helping
                people, especially kids, and creating opportunities that make life better.
              </p>
              <p className="text-slate-700 leading-relaxed">
                Outside of work, I enjoy working out and spending time with my girlfriend. My biggest
                life goal is simple: build a happy, healthy family while creating companies that do
                meaningful work.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Based In</p>
                  <p className="text-sm font-semibold text-slate-900">Boise, Idaho</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Also Building</p>
                  <p className="text-sm font-semibold text-slate-900">Retrogigz</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Core Focus</p>
                  <p className="text-sm font-semibold text-slate-900">Helping People</p>
                </div>
              </div>

              <blockquote className="mt-6 rounded-2xl border-l-4 border-emerald-500 bg-emerald-50/70 px-5 py-4 text-slate-700 italic">
                &quot;I want to build companies that solve real problems and create a better life for the
                people around me.&quot;
              </blockquote>
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

          <p className="mt-4 text-sm sm:text-base text-emerald-100">
            Questions first? Email{' '}
            <a href="mailto:contact.sherbing@gmail.com" className="font-semibold text-white underline underline-offset-4 hover:text-emerald-200">
              contact.sherbing@gmail.com
            </a>{' '}
            or call/text{' '}
            <a href="tel:2087618136" className="font-semibold text-white underline underline-offset-4 hover:text-emerald-200">
              (208) 761-8136
            </a>
            .
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

import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Specials | Sherbing',
  description: 'View seasonal specials and limited-time offers from Sherbing.',
};

const specials = [
  {
    title: 'Premium Summer Cleanup',
    price: '$200',
    subtitle: 'For standard residential lots up to 1/4 acre',
    details: [
      'Dog poop pickup',
      'Lawn mowing',
      'Weed whacking',
      'Hedge trimming',
      'Gutter cleaning',
    ],
    note: 'Normal cleanup jobs are usually around $350. Larger properties or severely overgrown hedges may require a custom quote upon arrival.',
    cta: '/special-booking',
  },
  {
    title: 'Curb Appeal Bundle',
    price: 'Bundle pricing',
    subtitle: 'Lawn care + windows',
    details: [
      'Lawn mowing',
      'Window cleaning',
      'Priority scheduling',
    ],
    note: 'Perfect for homeowners who want a fast refresh before guests, photos, or real estate showings.',
    cta: '/booking?service=lawn_mowing',
  },
  {
    title: 'Starter Bundle',
    price: 'Bundle pricing',
    subtitle: 'Lawn care + dog waste pickup',
    details: [
      'Lawn mowing',
      'Dog waste pickup',
      'Easy maintenance package',
    ],
    note: 'A simple seasonal option for keeping the yard clean and under control.',
    cta: '/booking?service=lawn_mowing',
  },
];

export default function SpecialsPage() {
  return (
    <main className="page-shell min-h-screen pb-20">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />

      <section className="section-container pt-14 sm:pt-20">
        <div className="surface-card p-8 sm:p-10 appear-up">
          <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-900">
            Specials
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-slate-900">Current offers and seasonal deals</h1>
          <p className="mt-4 max-w-3xl text-slate-700 leading-7">
            Browse the current specials, including our featured summer cleanup package. If your property is bigger than the stated limit, we’ll handle it with a custom quote.
          </p>
        </div>
      </section>

      <section className="section-container mt-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {specials.map((special, index) => (
            <article key={special.title} className={`surface-card p-6 sm:p-7 appear-up stagger-${Math.min(index + 1, 4)}`}>
              <p className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-900">
                Featured Deal
              </p>
              <h2 className="mt-4 text-2xl font-bold text-slate-950">{special.title}</h2>
              <p className="mt-2 text-3xl font-bold text-emerald-700">{special.price}</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">{special.subtitle}</p>

              <div className="mt-5 space-y-2">
                {special.details.map((detail) => (
                  <div key={detail} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {detail}
                  </div>
                ))}
              </div>

              <p className="mt-5 text-sm leading-6 text-slate-700">{special.note}</p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={special.cta} className="btn-primary px-5 py-3">
                  Book This Special
                </Link>
                {index === 0 && (
                  <Link href="/booking" className="btn-secondary px-5 py-3">
                    Regular Booking
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
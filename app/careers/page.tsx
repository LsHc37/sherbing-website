import Link from 'next/link';
import type { Metadata } from 'next';
import CareersApplicationForm from './application-form';

export const metadata: Metadata = {
  title: 'Careers | Sherbing',
  description: 'Apply to join the Sherbing landscaping and lawn care team.',
};

export default function CareersPage() {
  return (
    <main className="page-shell min-h-screen pb-20">
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />

      <header className="glass-nav sticky top-0 z-40">
        <nav className="section-container py-4 flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold text-slate-900 tracking-tight">
            Sherbing
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="btn-secondary px-4 py-2">
              Home
            </Link>
            <Link href="/booking" className="btn-secondary px-4 py-2">
              Book Service
            </Link>
          </div>
        </nav>
      </header>

      <section className="section-container pt-12 sm:pt-16">
        <CareersApplicationForm />
      </section>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type SessionUser = {
  email: string;
  full_name: string;
  role: 'customer' | 'employee' | 'admin';
};

const adminSections = [
  {
    href: '/admin/browser',
    title: 'Unrestricted Browser',
    description: 'Open the Ultraviolet browser dashboard with URL prepending, XOR encoding, and admin-only access.',
    accent: 'from-cyan-500 to-blue-600',
  },
  {
    href: '/admin/users',
    title: 'Users',
    description: 'Manage roles, employment profiles, availability, and referral settings.',
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    href: '/admin/bookings',
    title: 'Bookings',
    description: 'Assign employees, edit schedules, and manage booking status in one place.',
    accent: 'from-violet-500 to-fuchsia-600',
  },
  {
    href: '/admin/routes',
    title: 'Route Planner',
    description: 'Generate optimized dispatch routes and apply them to bookings.',
    accent: 'from-amber-500 to-orange-600',
  },
  {
    href: '/admin/timesheet',
    title: 'Timesheets',
    description: 'Review hours, adjustments, and employee labor tracking data.',
    accent: 'from-slate-500 to-slate-700',
  },
  {
    href: '/admin/job-applications',
    title: 'Job Applications',
    description: 'Review applicants and move candidates through the hiring process.',
    accent: 'from-rose-500 to-red-600',
  },
];

export default function AdminHomePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!response.ok) {
        window.location.href = '/admin/login';
        return;
      }

      const payload = await response.json();
      const sessionUser = payload?.user as SessionUser | undefined;
      if (!sessionUser || sessionUser.role !== 'admin') {
        window.location.href = '/employee/dashboard';
        return;
      }

      setUser(sessionUser);
      setLoading(false);
    };

    void load();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 mx-auto rounded-2xl border border-white/20 border-t-white animate-spin" />
          <p className="text-sm text-slate-300">Loading admin portal...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_42%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] text-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.3fr_0.7fr] lg:p-10">
            <div className="space-y-5">
              <div className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
                Sherbing Admin
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Command center for Sherbing operations</h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  Use this portal to manage customers, bookings, routes, payroll, and the restricted browser environment.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/admin/browser"
                  className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Open Browser
                </Link>
                <Link
                  href="/admin/users"
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Manage Users
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Signed in as</p>
              <div className="mt-3 space-y-1">
                <p className="text-lg font-semibold text-white">{user?.full_name || 'Admin'}</p>
                <p className="text-sm text-slate-300">{user?.email}</p>
              </div>
              <div className="mt-6 grid gap-3 text-sm text-slate-300">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <span className="block text-xs uppercase tracking-[0.2em] text-slate-400">Status</span>
                  <span className="mt-2 block font-medium text-emerald-300">Admin access granted</span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <span className="block text-xs uppercase tracking-[0.2em] text-slate-400">Protected tools</span>
                  <span className="mt-2 block font-medium text-cyan-300">Browser, users, bookings, routes, and more</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Admin Sections</h2>
              <p className="mt-1 text-sm text-slate-300">Choose a tool to continue.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {adminSections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                <div className={`mb-4 h-1.5 w-16 rounded-full bg-gradient-to-r ${section.accent}`} />
                <h3 className="text-lg font-semibold text-white group-hover:text-cyan-200">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{section.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

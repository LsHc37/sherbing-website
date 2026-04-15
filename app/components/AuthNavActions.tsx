'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type SessionUser = {
  email: string;
  full_name: string;
  role: 'customer' | 'employee' | 'admin';
};

export default function AuthNavActions() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          setUser(null);
          return;
        }

        const data = await response.json();
        setUser(data.user || null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/careers" className="btn-secondary text-sm sm:text-base">
          Careers
        </Link>
        <Link href="/about" className="btn-secondary text-sm sm:text-base">
          About Us
        </Link>
        <span className="text-sm text-slate-600">Loading...</span>
      </div>
    );
  }

  if (user) {
    const accountPath = user.role === 'admin' || user.role === 'employee' ? '/employee/dashboard' : '/account';

    return (
      <div className="flex items-center gap-3">
        <Link href="/careers" className="btn-secondary text-sm sm:text-base">
          Careers
        </Link>
        <Link href="/about" className="btn-secondary text-sm sm:text-base">
          About Us
        </Link>
        <Link href={accountPath} className="btn-secondary text-sm sm:text-base">
          My Account
        </Link>
        <button onClick={handleLogout} className="btn-primary text-sm sm:text-base">
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/careers" className="btn-secondary text-sm sm:text-base">
        Careers
      </Link>
      <Link href="/about" className="btn-secondary text-sm sm:text-base">
        About Us
      </Link>
      <Link href="/login" className="btn-secondary text-sm sm:text-base">
        Sign In
      </Link>
      <Link href="/signup" className="btn-primary text-sm sm:text-base">
        Get Started
      </Link>
    </div>
  );
}

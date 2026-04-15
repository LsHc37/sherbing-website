'use client';

import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { useState } from 'react';

type Role = 'customer' | 'employee' | 'admin';

type RoleLoginFormProps = {
  title: string;
  subtitle: string;
  allowedRoles: Role[];
  redirectByRole: Partial<Record<Role, string>>;
  footerLinks?: Array<{ href: string; label: string }>;
  showSignupLink?: boolean;
};

export default function RoleLoginForm({
  title,
  subtitle,
  allowedRoles,
  redirectByRole,
  footerLinks = [],
  showSignupLink = false,
}: RoleLoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setUnverifiedEmail('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.status === 403 && data.requiresVerification) {
        setUnverifiedEmail(email);
        setError('');
        return;
      }

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      const role = data?.user?.role as Role | undefined;
      if (!role || !allowedRoles.includes(role)) {
        setError(`This login is for ${allowedRoles.join(' and ')} accounts.`);
        return;
      }

      window.location.href = redirectByRole[role] || '/';
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!unverifiedEmail) return;
    setResendLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      });

      const data = await response.json();
      if (response.ok) {
        window.location.href = `/verify-email?email=${encodeURIComponent(unverifiedEmail)}`;
      } else {
        setError(data.error || 'Failed to resend code');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <main className="page-shell min-h-screen flex items-center justify-center px-4 py-10">
      <div className="surface-card p-8 sm:p-9 max-w-md w-full appear-up">
        <div className="text-center mb-8 appear-up stagger-1">
          <div className="flex justify-center mb-4">
            <Logo variant="icon" size="medium" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <p className="text-slate-600 text-sm mt-2">{subtitle}</p>
        </div>

        {unverifiedEmail ? (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-900 text-sm">
                <strong>Email not verified:</strong> We sent a verification code to <strong>{unverifiedEmail}</strong>.
                Please check your email and verify your account to continue.
              </p>
            </div>

            <button
              onClick={handleResendCode}
              disabled={resendLoading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {resendLoading ? 'Sending...' : 'Go to Verification'}
            </button>

            <button
              onClick={() => {
                setUnverifiedEmail('');
                setEmail('');
                setPassword('');
              }}
              className="btn-secondary w-full"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm appear-up">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="field-shell"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-900">Password</label>
                <Link href="/forgot-password" className="text-xs text-emerald-700 hover:underline font-medium">
                  Forgot?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="field-shell"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}

        <div className="mt-6 space-y-3 text-center text-sm text-slate-600">
          {showSignupLink && (
            <p>
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-emerald-700 font-semibold hover:underline">
                Sign Up
              </Link>
            </p>
          )}
          {footerLinks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              {footerLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-emerald-700 font-semibold hover:underline">
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

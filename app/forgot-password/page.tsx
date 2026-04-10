'use client';

import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send reset email');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell min-h-screen flex items-center justify-center px-4 py-10">
      <div className="surface-card p-8 sm:p-9 max-w-md w-full appear-up">
        <div className="text-center mb-8 appear-up stagger-1">
          <div className="flex justify-center mb-4">
            <Logo variant="icon" size="medium" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Reset Password</h1>
          <p className="text-slate-600 text-sm mt-2">Enter your email to receive a reset link</p>
        </div>

        {submitted ? (
          // Success Message
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-900 text-sm">
                <strong>Check your email!</strong> We've sent a password reset link to <strong>{email}</strong>. 
                The link will expire in 1 hour.
              </p>
            </div>

            <Link href="/login" className="btn-primary w-full text-center block">
              Back to Sign In
            </Link>
          </div>
        ) : (
          // Reset Form
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="field-shell"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-slate-600 text-sm">
            Remember your password?{' '}
            <Link href="/login" className="text-emerald-700 font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

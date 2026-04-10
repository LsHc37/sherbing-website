'use client';

import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new one.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }

      setSuccess(true);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card p-8 sm:p-9 max-w-md w-full appear-up">
      <div className="text-center mb-8 appear-up stagger-1">
        <div className="flex justify-center mb-4">
          <Logo variant="icon" size="medium" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Create New Password</h1>
        <p className="text-slate-600 text-sm mt-2">Enter your new password below</p>
      </div>

      {success ? (
        // Success Message
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-900 text-sm">
              <strong>Password reset successful!</strong> You can now sign in with your new password.
            </p>
          </div>

          <Link href="/login" className="btn-primary w-full text-center block">
            Sign In
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
            <label className="block text-sm font-medium text-slate-900 mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={!token}
              className="field-shell disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">At least 8 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              disabled={!token}
              className="field-shell disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
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
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="page-shell min-h-screen flex items-center justify-center px-4 py-10">
      <Suspense fallback={<div className="surface-card p-8 max-w-md w-full">Loading...</div>}>
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}

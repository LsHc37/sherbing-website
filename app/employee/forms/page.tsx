'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Logo from '@/app/components/Logo';

type SessionUser = {
  email: string;
  full_name: string;
  role: 'employee' | 'admin' | 'customer';
};

type OnboardingState = {
  forms: {
    terms_of_service: boolean;
    work_contract: boolean;
    job_description: boolean;
    pay_terms: boolean;
  };
  all_forms_signed: boolean;
  forms_terms_signed_at: string;
  forms_work_contract_signed_at: string;
  forms_job_description_signed_at: string;
  forms_pay_terms_signed_at: string;
  training_completed_at: string;
  shadow_required: boolean;
  shadow_completed_at: string;
  shadow_mentor_email: string;
  can_clock_in: boolean;
  onboarding_stage: 'forms' | 'training' | 'shadow' | 'ready_to_work';
  completion_percent: number;
  clock_in_at: string;
  clock_out_at: string;
  tracked_minutes_total: string;
  tracked_hours_total: string;
};

type FormKey = keyof OnboardingState['forms'];

const formConfig: Array<{ key: FormKey; title: string; description: string }> = [
  {
    key: 'terms_of_service',
    title: 'Terms of Service',
    description: 'Acknowledge platform standards, client conduct expectations, and communication requirements.',
  },
  {
    key: 'work_contract',
    title: 'Independent Contractor Agreement',
    description: 'Confirm the private contractor relationship and agreement terms for project work.',
  },
  {
    key: 'job_description',
    title: 'Job Description',
    description: 'Review role expectations, service quality standards, and on-site safety responsibilities.',
  },
  {
    key: 'pay_terms',
    title: 'Pay Terms',
    description: 'Acknowledge payout timing, rate expectations, and billing process details.',
  },
];

function formatDate(value?: string) {
  if (!value) return 'Not signed';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function EmployeeFormsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const meResponse = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!meResponse.ok) {
      window.location.href = '/login';
      return;
    }

    const mePayload = await meResponse.json();
    const me = mePayload?.user as SessionUser;
    if (!me || (me.role !== 'employee' && me.role !== 'admin')) {
      window.location.href = '/account';
      return;
    }
    setUser(me);

    const onboardingResponse = await fetch('/api/employee/onboarding', { cache: 'no-store' });
    const onboardingPayload = await onboardingResponse.json().catch(() => ({}));
    if (!onboardingResponse.ok) {
      setError(onboardingPayload?.error || 'Unable to load forms');
      setLoading(false);
      return;
    }

    setOnboarding(onboardingPayload.onboarding as OnboardingState);
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const signForm = async (form: FormKey) => {
    setSaving(form);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/employee/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign_form', form }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || 'Unable to sign form');
        return;
      }

      setOnboarding(payload.onboarding as OnboardingState);
      setMessage('Form signed successfully.');
    } finally {
      setSaving('');
    }
  };

  const clockIn = async () => {
    setSaving('clock-in');
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/employee/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clock_in' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || 'Unable to clock in');
        return;
      }

      setOnboarding(payload.onboarding as OnboardingState);
      setMessage('Clocked in. Have a great shift.');
    } finally {
      setSaving('');
    }
  };

  const clockOut = async () => {
    setSaving('clock-out');
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/employee/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clock_out' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || 'Unable to clock out');
        return;
      }

      setOnboarding(payload.onboarding as OnboardingState);
      setMessage('Clocked out and time recorded.');
    } finally {
      setSaving('');
    }
  };

  const isClockedIn = useMemo(() => Boolean(onboarding?.clock_in_at), [onboarding?.clock_in_at]);
  const formsSignedCount = useMemo(() => {
    if (!onboarding?.forms) return 0;
    return Object.values(onboarding.forms).filter(Boolean).length;
  }, [onboarding?.forms]);

  if (loading) {
    return <main className="p-8">Loading forms and compliance...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo variant="icon" size="small" />
            <span className="text-sm text-gray-500">Employee Forms</span>
          </div>
          <div className="flex items-center gap-4 text-sm sm:text-base flex-wrap justify-end">
            <Link href="/employee/dashboard" className="text-gray-700 hover:text-gray-900">Bookings</Link>
            <Link href="/employee/calendar" className="text-gray-700 hover:text-gray-900">Calendar</Link>
            <Link href="/employee/forms" className="text-gray-900 font-semibold">Forms</Link>
            <Link href="/employee/training" className="text-gray-700 hover:text-gray-900">Training</Link>
            <Link href="/employee/job-applications" className="text-gray-700 hover:text-gray-900">Job Applications</Link>
          </div>
        </nav>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Signed In As</p>
            <p className="text-lg font-semibold text-gray-900">{user?.full_name || user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">All Required Forms</p>
            <p className={`text-2xl font-bold ${onboarding?.all_forms_signed ? 'text-emerald-700' : 'text-amber-600'}`}>
              {onboarding?.all_forms_signed ? 'Complete' : 'Pending'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Tracked Hours</p>
            <p className="text-2xl font-bold text-gray-900">{onboarding?.tracked_hours_total || '0.00'}h</p>
          </div>
        </div>

        <section className="bg-white rounded-lg shadow p-6 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">Onboarding Progress</h2>
            <span className="text-sm font-semibold text-gray-700">{onboarding?.completion_percent ?? 0}% complete</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, onboarding?.completion_percent ?? 0))}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            Current stage: {String(onboarding?.onboarding_stage || 'forms').replace(/_/g, ' ')}.
            {' '}
            Forms signed: {formsSignedCount}/4.
          </p>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Clock In / Clock Out</h2>
          <p className="text-sm text-gray-600">Track shift duration so admin can review productivity, job duration, and labor planning.</p>

          <div className="flex flex-wrap gap-3 items-center">
            {!isClockedIn ? (
              <button
                type="button"
                disabled={!onboarding?.can_clock_in || saving === 'clock-in'}
                onClick={() => void clockIn()}
                className="px-4 py-2 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving === 'clock-in' ? 'Clocking In...' : 'Clock In'}
              </button>
            ) : (
              <button
                type="button"
                disabled={saving === 'clock-out'}
                onClick={() => void clockOut()}
                className="px-4 py-2 rounded-md bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-60"
              >
                {saving === 'clock-out' ? 'Clocking Out...' : 'Clock Out'}
              </button>
            )}

            {onboarding?.clock_in_at && (
              <span className="text-sm text-gray-600">Current shift started: {formatDate(onboarding.clock_in_at)}</span>
            )}
          </div>

          {onboarding?.shadow_required && !onboarding.shadow_completed_at && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
              Shadow requirement is still pending. Complete training and shadow first to unlock solo clock-in.
            </div>
          )}

          {!onboarding?.can_clock_in && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Clock-in is locked until all required forms are signed, training is complete, and shadow requirements are satisfied.
            </div>
          )}
        </section>

        <section className="space-y-4">
          {formConfig.map((formItem) => {
            const signed = Boolean(onboarding?.forms?.[formItem.key]);
            const signedAtLookup: Record<FormKey, string | undefined> = {
              terms_of_service: onboarding?.forms_terms_signed_at,
              work_contract: onboarding?.forms_work_contract_signed_at,
              job_description: onboarding?.forms_job_description_signed_at,
              pay_terms: onboarding?.forms_pay_terms_signed_at,
            };

            return (
              <article key={formItem.key} className="bg-white rounded-lg shadow p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-gray-900">{formItem.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${signed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {signed ? 'Signed' : 'Pending'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{formItem.description}</p>
                <p className="text-xs text-gray-500">Signed at: {formatDate(signedAtLookup[formItem.key])}</p>
                <button
                  type="button"
                  disabled={signed || saving === formItem.key}
                  onClick={() => void signForm(formItem.key)}
                  className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-60"
                >
                  {signed ? 'Already Signed' : (saving === formItem.key ? 'Signing...' : 'Sign Form')}
                </button>
              </article>
            );
          })}
        </section>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>}
        {message && <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">{message}</div>}
      </div>
    </main>
  );
}

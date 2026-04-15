'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  training_completed_at: string;
  shadow_required: boolean;
  shadow_completed_at: string;
  shadow_mentor_email: string;
  completion_percent: number;
  onboarding_stage: 'forms' | 'training' | 'shadow' | 'ready_to_work';
};

function formatDate(value?: string) {
  if (!value) return 'Not completed';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function EmployeeTrainingPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [mentorEmail, setMentorEmail] = useState('');
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
      setError(onboardingPayload?.error || 'Unable to load training data');
      setLoading(false);
      return;
    }

    const state = onboardingPayload.onboarding as OnboardingState;
    setOnboarding(state);
    setMentorEmail(state.shadow_mentor_email || '');
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const completeTraining = async () => {
    setSaving('training');
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/employee/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_training' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || 'Unable to update training status');
        return;
      }
      setOnboarding(payload.onboarding as OnboardingState);
      setMessage('Training marked as completed.');
    } finally {
      setSaving('');
    }
  };

  const saveShadowMentor = async () => {
    const mentor = mentorEmail.trim().toLowerCase();
    if (!mentor) {
      setError('Enter a mentor email first.');
      return;
    }

    setSaving('mentor');
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/employee/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_shadow_mentor', mentor_email: mentor }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || 'Unable to save mentor');
        return;
      }
      setOnboarding(payload.onboarding as OnboardingState);
      setMessage('Shadow mentor saved.');
    } finally {
      setSaving('');
    }
  };

  const completeShadow = async () => {
    setSaving('shadow');
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/employee/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_shadow' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || 'Unable to complete shadow training');
        return;
      }
      setOnboarding(payload.onboarding as OnboardingState);
      setMessage('Shadow requirement marked as completed.');
    } finally {
      setSaving('');
    }
  };

  if (loading) {
    return <main className="p-8">Loading training tab...</main>;
  }

  const formsSignedCount = onboarding?.forms ? Object.values(onboarding.forms).filter(Boolean).length : 0;
  const canCompleteTraining = Boolean(onboarding?.all_forms_signed) && !Boolean(onboarding?.training_completed_at);
  const canCompleteShadow = Boolean(onboarding?.training_completed_at)
    && Boolean(String(onboarding?.shadow_mentor_email || '').trim())
    && !Boolean(onboarding?.shadow_completed_at);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo variant="icon" size="small" />
            <span className="text-sm text-gray-500">Training</span>
          </div>
          <div className="flex items-center gap-4 text-sm sm:text-base flex-wrap justify-end">
            <Link href="/employee/dashboard" className="text-gray-700 hover:text-gray-900">Bookings</Link>
            <Link href="/employee/calendar" className="text-gray-700 hover:text-gray-900">Calendar</Link>
            <Link href="/employee/forms" className="text-gray-700 hover:text-gray-900">Forms</Link>
            <Link href="/employee/training" className="text-gray-900 font-semibold">Training</Link>
            <Link href="/employee/job-applications" className="text-gray-700 hover:text-gray-900">Job Applications</Link>
          </div>
        </nav>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Signed In As</p>
            <p className="text-lg font-semibold text-gray-900">{user?.full_name || user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Training</p>
            <p className={`text-2xl font-bold ${onboarding?.training_completed_at ? 'text-emerald-700' : 'text-amber-600'}`}>
              {onboarding?.training_completed_at ? 'Completed' : 'Pending'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Shadow Requirement</p>
            <p className={`text-2xl font-bold ${onboarding?.shadow_completed_at ? 'text-emerald-700' : 'text-amber-600'}`}>
              {onboarding?.shadow_completed_at ? 'Completed' : 'Pending'}
            </p>
          </div>
        </div>

        <section className="bg-white rounded-lg shadow p-6 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">Onboarding Sequence</h2>
            <span className="text-sm font-semibold text-gray-700">{onboarding?.completion_percent ?? 0}% complete</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, onboarding?.completion_percent ?? 0))}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            Stage: {String(onboarding?.onboarding_stage || 'forms').replace(/_/g, ' ')} | Forms signed: {formsSignedCount}/4
          </p>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Training Checklist</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
            <li>Safety and job-site procedures reviewed</li>
            <li>Service quality standards reviewed</li>
            <li>Customer communication expectations reviewed</li>
            <li>Equipment handling standards reviewed</li>
          </ul>
          <p className="text-xs text-gray-500">Completed at: {formatDate(onboarding?.training_completed_at)}</p>
          <button
            type="button"
            disabled={!canCompleteTraining || saving === 'training'}
            onClick={() => void completeTraining()}
            className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-60"
          >
            {onboarding?.training_completed_at ? 'Training Completed' : (saving === 'training' ? 'Saving...' : 'Mark Training Complete')}
          </button>
          {!onboarding?.all_forms_signed && (
            <p className="text-xs text-amber-700">All required forms must be signed before training can be completed.</p>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Shadow Requirement</h2>
          <p className="text-sm text-gray-600">
            Employees must shadow at least one experienced team member before working independently.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-sm text-gray-700">
              Shadow mentor email
              <input
                type="email"
                value={mentorEmail}
                onChange={(event) => setMentorEmail(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="mentor@sherbing.com"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveShadowMentor()}
              disabled={saving === 'mentor'}
              className="px-4 py-2 rounded-md bg-indigo-700 text-white text-sm font-semibold hover:bg-indigo-600 disabled:opacity-60"
            >
              {saving === 'mentor' ? 'Saving...' : 'Save Mentor'}
            </button>
          </div>
          <p className="text-xs text-gray-500">Current mentor: {onboarding?.shadow_mentor_email || 'Not set'}</p>
          <p className="text-xs text-gray-500">Shadow completed at: {formatDate(onboarding?.shadow_completed_at)}</p>
          <button
            type="button"
            onClick={() => void completeShadow()}
            disabled={!canCompleteShadow || saving === 'shadow'}
            className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            {onboarding?.shadow_completed_at ? 'Shadow Completed' : (saving === 'shadow' ? 'Saving...' : 'Mark Shadow Complete')}
          </button>
          {!onboarding?.training_completed_at && (
            <p className="text-xs text-amber-700">Training must be completed before shadow can be marked complete.</p>
          )}
          {onboarding?.training_completed_at && !onboarding?.shadow_mentor_email && (
            <p className="text-xs text-amber-700">Set a mentor before completing shadow requirement.</p>
          )}
        </section>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>}
        {message && <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">{message}</div>}
      </div>
    </main>
  );
}

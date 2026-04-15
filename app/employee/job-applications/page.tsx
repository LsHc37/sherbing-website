'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Logo from '@/app/components/Logo';

type User = {
  email: string;
  full_name: string;
  role: 'employee' | 'admin' | 'customer';
};

type JobApplication = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  email: string;
  city_zip: string;
  previous_experience: 'yes' | 'no';
  previous_experience_details: string;
  equipment_known: string[];
  can_lift_50_plus_lbs: 'yes' | 'no';
  has_valid_license_and_transportation: 'yes' | 'no';
  available_start_date: string;
  general_availability: string;
  why_work_for_sherbing: string;
  own_equipment: string;
  resume_file_name: string;
  resume_url: string;
  resume_mime_type: string;
  status: 'new' | 'reviewing' | 'interview' | 'hired' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
};

const statusOptions: JobApplication['status'][] = ['new', 'reviewing', 'interview', 'hired', 'rejected'];

function formatDateTime(value: string) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function statusStyles(status: JobApplication['status']) {
  switch (status) {
    case 'hired':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'interview':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'reviewing':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'rejected':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export default function EmployeeJobApplicationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | JobApplication['status']>('all');
  const [savingId, setSavingId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!meRes.ok) {
      window.location.href = '/login';
      return;
    }

    const meData = await meRes.json();
    const me = meData?.user as User;
    if (!me || (me.role !== 'employee' && me.role !== 'admin')) {
      window.location.href = '/account';
      return;
    }

    setUser(me);

    const response = await fetch('/api/job-applications', { cache: 'no-store' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body?.error || 'Unable to load job applications');
      setLoading(false);
      return;
    }

    const data = await response.json();
    setApplications(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const filteredApplications = useMemo(() => {
    return [...applications]
      .filter((application) => selectedStatus === 'all' || application.status === selectedStatus)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }, [applications, selectedStatus]);

  const statusCounts = useMemo(() => {
    return applications.reduce<Record<JobApplication['status'] | 'all', number>>(
      (counts, application) => {
        counts.all += 1;
        counts[application.status] += 1;
        return counts;
      },
      {
        all: 0,
        new: 0,
        reviewing: 0,
        interview: 0,
        hired: 0,
        rejected: 0,
      }
    );
  }, [applications]);

  const updateStatus = async (applicationId: string, status: JobApplication['status']) => {
    setSavingId(applicationId);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/job-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId, status }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body?.error || 'Unable to update application status');
        return;
      }

      setMessage('Application status updated.');
      await load();
    } finally {
      setSavingId('');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900">Loading job applications...</h1>
            <p className="text-sm text-gray-600 mt-2">Fetching the latest submissions and resume links.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo variant="icon" size="small" />
            <span className="text-sm text-gray-500">Job Applications</span>
          </div>
          <div className="flex items-center gap-4 text-sm sm:text-base flex-wrap justify-end">
            <Link href="/employee/dashboard" className="text-gray-700 hover:text-gray-900">Bookings</Link>
            <Link href="/employee/calendar" className="text-gray-700 hover:text-gray-900">Calendar</Link>
            {user?.role === 'admin' && <Link href="/admin/users" className="text-gray-700 hover:text-gray-900">Manage Users</Link>}
            {user?.role === 'admin' && <Link href="/admin/booking" className="text-gray-700 hover:text-gray-900">Manage Bookings</Link>}
            <button onClick={logout} className="text-gray-700 hover:text-gray-900">Logout</button>
          </div>
        </nav>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Signed In As</p>
            <p className="text-lg font-semibold text-gray-900">{user?.full_name || user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Applications</p>
            <p className="text-2xl font-bold text-gray-900">{statusCounts.all}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">New Applications</p>
            <p className="text-2xl font-bold text-emerald-700">{statusCounts.new}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">In Review</p>
            <p className="text-2xl font-bold text-amber-600">{statusCounts.reviewing + statusCounts.interview}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-2">
          {(['all', ...statusOptions] as const).map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${selectedStatus === status ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              {status === 'all' ? 'All' : status}
              <span className="ml-2 opacity-70">({status === 'all' ? statusCounts.all : statusCounts[status]})</span>
            </button>
          ))}
          <button onClick={() => void load()} className="ml-auto px-4 py-2 bg-gray-900 text-white text-sm rounded-full hover:bg-black">Refresh</button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>}
        {message && <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">{message}</div>}

        <section className="space-y-4">
          {filteredApplications.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-gray-600">No applications found for this filter.</div>
          ) : (
            filteredApplications.map((application) => (
              <article key={application.id} className="bg-white rounded-lg shadow p-6 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold text-gray-900">{application.full_name}</h2>
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles(application.status)}`}>
                        {application.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Submitted {formatDateTime(application.created_at)}</p>
                  </div>
                  <div className="min-w-[220px]">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Update status</label>
                    <select
                      value={application.status}
                      onChange={(event) => void updateStatus(application.id, event.target.value as JobApplication['status'])}
                      disabled={savingId === application.id}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 text-sm text-gray-700">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Contact</p>
                    <p className="mt-2 font-semibold text-gray-900">{application.email}</p>
                    <p>{application.phone}</p>
                    <p>{application.city_zip}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Readiness</p>
                    <p className="mt-2">Previous experience: {application.previous_experience === 'yes' ? 'Yes' : 'No'}</p>
                    <p>Can lift 50+ lbs: {application.can_lift_50_plus_lbs === 'yes' ? 'Yes' : 'No'}</p>
                    <p>License and transport: {application.has_valid_license_and_transportation === 'yes' ? 'Yes' : 'No'}</p>
                    <p>Start date: {application.available_start_date || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Resume</p>
                    <a href={application.resume_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-emerald-700 font-semibold hover:underline">
                      View resume
                    </a>
                    <p className="mt-2 text-gray-500">{application.resume_file_name}</p>
                    {application.reviewed_by && <p className="mt-2 text-gray-500">Updated by {application.reviewed_by}</p>}
                    {application.reviewed_at && <p className="text-gray-500">Updated {formatDateTime(application.reviewed_at)}</p>}
                  </div>
                </div>

                {application.previous_experience_details && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Past experience</p>
                    <p className="mt-2 text-sm text-gray-700 leading-7">{application.previous_experience_details}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Equipment</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {application.equipment_known.length > 0 ? application.equipment_known.map((item) => (
                      <span key={item} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{item}</span>
                    )) : <span className="text-sm text-gray-500">No equipment listed</span>}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Why Sherbing</p>
                    <p className="mt-2 text-sm text-gray-700 leading-7">{application.why_work_for_sherbing || 'No response provided.'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Own equipment</p>
                    <p className="mt-2 text-sm text-gray-700 leading-7">{application.own_equipment || 'No response provided.'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Availability</p>
                  <p className="mt-2 text-sm text-gray-700 leading-7">{application.general_availability || 'No response provided.'}</p>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

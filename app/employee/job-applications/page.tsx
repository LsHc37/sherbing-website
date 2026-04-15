'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Logo from '@/app/components/Logo';

type User = {
  email: string;
  full_name: string;
  role: 'employee' | 'admin' | 'customer';
  managed_groups?: string;
};

type JobApplicationMessage = {
  id: string;
  sender_email: string;
  sender_name: string;
  sender_role: 'employee' | 'admin';
  created_at: string;
  body: string;
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
  status: 'new' | 'reviewing' | 'interview' | 'onboarding' | 'hired' | 'rejected';
  interview_group?: string;
  interview_scheduled_at?: string;
  interview_meeting_url?: string;
  onboarding_notes?: string;
  messages?: JobApplicationMessage[];
  reviewed_by?: string;
  reviewed_at?: string;
};

const statusOptions: JobApplication['status'][] = ['new', 'reviewing', 'interview', 'onboarding', 'hired', 'rejected'];
const MAIN_ADMIN_EMAIL = 'lucas.mellen1@gmail.com';

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
    case 'onboarding':
      return 'bg-violet-100 text-violet-800 border-violet-200';
    case 'reviewing':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'rejected':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function parseManagedGroups(value?: string) {
  return Array.from(new Set(
    String(value || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  ));
}

export default function EmployeeJobApplicationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | JobApplication['status']>('all');
  const [savingId, setSavingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [interviewDateDrafts, setInterviewDateDrafts] = useState<Record<string, string>>({});
  const [meetingUrlDrafts, setMeetingUrlDrafts] = useState<Record<string, string>>({});
  const [onboardingNotesDrafts, setOnboardingNotesDrafts] = useState<Record<string, string>>({});
  const [interviewGroupDrafts, setInterviewGroupDrafts] = useState<Record<string, string>>({});
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});

  const isPrimaryAdmin = user?.role === 'admin' && user.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL;
  const isAdmin = user?.role === 'admin';
  const managedGroups = useMemo(() => parseManagedGroups(user?.managed_groups), [user?.managed_groups]);
  const roleLabel = useMemo(() => {
    if (!user) return 'User';
    if (user.role === 'admin') return 'Admin';
    if (user.role === 'employee' && managedGroups.length > 0) return 'Manager';
    if (user.role === 'employee') return 'Employee';
    return 'Customer';
  }, [managedGroups.length, user]);

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
    const nextApplications = Array.isArray(data) ? data : [];
    setApplications(nextApplications);

    const dateDraftMap: Record<string, string> = {};
    const linkDraftMap: Record<string, string> = {};
    const noteDraftMap: Record<string, string> = {};
    const groupDraftMap: Record<string, string> = {};
    for (const application of nextApplications) {
      dateDraftMap[application.id] = application.interview_scheduled_at || '';
      linkDraftMap[application.id] = application.interview_meeting_url || '';
      noteDraftMap[application.id] = application.onboarding_notes || '';
      groupDraftMap[application.id] = application.interview_group || '';
    }
    setInterviewDateDrafts(dateDraftMap);
    setMeetingUrlDrafts(linkDraftMap);
    setOnboardingNotesDrafts(noteDraftMap);
    setInterviewGroupDrafts(groupDraftMap);
    setLoading(false);
  };

  const canManageInterviewForApplication = (application: JobApplication) => {
    if (isAdmin) return true;
    const group = String(application.interview_group || '').trim().toLowerCase();
    return Boolean(group) && managedGroups.includes(group);
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
        onboarding: 0,
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

  const saveInterviewDetails = async (applicationId: string) => {
    setSavingId(`${applicationId}:interview`);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/job-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          interview_group: interviewGroupDrafts[applicationId] || '',
          interview_scheduled_at: interviewDateDrafts[applicationId] || '',
          interview_meeting_url: meetingUrlDrafts[applicationId] || '',
          onboarding_notes: onboardingNotesDrafts[applicationId] || '',
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body?.error || 'Unable to save interview details');
        return;
      }

      setMessage('Interview details updated.');
      await load();
    } finally {
      setSavingId('');
    }
  };

  const sendMessage = async (applicationId: string) => {
    const text = String(messageDrafts[applicationId] || '').trim();
    if (!text) {
      setError('Type a message before sending.');
      return;
    }

    setSavingId(`${applicationId}:message`);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/job-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          message_text: text,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body?.error || 'Unable to send message');
        return;
      }

      setMessageDrafts((prev) => ({ ...prev, [applicationId]: '' }));
      setMessage('Message sent.');
      await load();
    } finally {
      setSavingId('');
    }
  };

  const deleteApplication = async (applicationId: string) => {
    if (!window.confirm('Delete this application permanently?')) {
      return;
    }

    setDeletingId(applicationId);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/job-applications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body?.error || 'Unable to delete application');
        return;
      }

      setMessage('Application deleted.');
      await load();
    } finally {
      setDeletingId('');
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
            <p className="text-xs text-gray-500 mt-1">
              Access: {roleLabel}{managedGroups.length > 0 ? ` (${managedGroups.join(', ')})` : ''}
            </p>
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
            <p className="text-2xl font-bold text-amber-600">{statusCounts.reviewing + statusCounts.interview + statusCounts.onboarding}</p>
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
                  <div className="min-w-[220px] space-y-3">
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
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => void deleteApplication(application.id)}
                        disabled={deletingId === application.id}
                        className="w-full rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === application.id ? 'Deleting...' : 'Delete Application'}
                      </button>
                    )}
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
                    <a
                      href={`/api/job-applications/${encodeURIComponent(application.id)}/resume`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-emerald-700 font-semibold hover:underline"
                    >
                      View resume
                    </a>
                    <p className="mt-2 text-gray-500">{application.resume_file_name}</p>
                    <p className="text-xs text-gray-500 break-all">{application.resume_url}</p>
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

                <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Interview and onboarding</p>
                  <input
                    type="datetime-local"
                    value={interviewDateDrafts[application.id] || ''}
                    disabled={!canManageInterviewForApplication(application)}
                    onChange={(event) => setInterviewDateDrafts((prev) => ({
                      ...prev,
                      [application.id]: event.target.value,
                    }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <input
                    type="url"
                    placeholder="Video call link (Google Meet, Zoom, Teams...)"
                    value={meetingUrlDrafts[application.id] || ''}
                    disabled={!canManageInterviewForApplication(application)}
                    onChange={(event) => setMeetingUrlDrafts((prev) => ({
                      ...prev,
                      [application.id]: event.target.value,
                    }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <textarea
                    placeholder="Onboarding notes, required docs, next steps..."
                    value={onboardingNotesDrafts[application.id] || ''}
                    disabled={!canManageInterviewForApplication(application)}
                    onChange={(event) => setOnboardingNotesDrafts((prev) => ({
                      ...prev,
                      [application.id]: event.target.value,
                    }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-24 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <input
                    type="text"
                    value={interviewGroupDrafts[application.id] || ''}
                    disabled={!isAdmin}
                    onChange={(event) => setInterviewGroupDrafts((prev) => ({
                      ...prev,
                      [application.id]: event.target.value.toLowerCase(),
                    }))}
                    placeholder="Interview group, ex: north-team"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canManageInterviewForApplication(application) || savingId === `${application.id}:interview`}
                      onClick={() => void saveInterviewDetails(application.id)}
                      className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingId === `${application.id}:interview` ? 'Saving...' : 'Save interview plan'}
                    </button>
                    {application.interview_meeting_url && (
                      <a
                        href={application.interview_meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
                      >
                        Join video call
                      </a>
                    )}
                  </div>
                  {!canManageInterviewForApplication(application) && (
                    <p className="text-xs text-gray-500">
                      Interview controls require admin access or manager assignment to this application group.
                    </p>
                  )}
                  {isPrimaryAdmin && (
                    <p className="text-xs text-gray-500">
                      Primary admin can control all interview groups and manager permissions.
                    </p>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Internal interview messages</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {(application.messages || []).length === 0 ? (
                      <p className="text-sm text-gray-500">No messages yet.</p>
                    ) : (
                      (application.messages || []).map((messageItem) => (
                        <div key={messageItem.id} className="rounded-md border border-gray-200 bg-white p-3">
                          <p className="text-xs font-semibold text-gray-600">
                            {messageItem.sender_name} ({messageItem.sender_role}) at {formatDateTime(messageItem.created_at)}
                          </p>
                          <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{messageItem.body}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <textarea
                    value={messageDrafts[application.id] || ''}
                    onChange={(event) => setMessageDrafts((prev) => ({ ...prev, [application.id]: event.target.value }))}
                    placeholder="Send a message to admins and employees handling this interview"
                    disabled={!canManageInterviewForApplication(application)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-20 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage(application.id)}
                    disabled={!canManageInterviewForApplication(application) || savingId === `${application.id}:message`}
                    className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingId === `${application.id}:message` ? 'Sending...' : 'Send message'}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

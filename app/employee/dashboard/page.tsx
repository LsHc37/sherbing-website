'use client';

import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { useEffect, useMemo, useState } from 'react';

type User = {
  email: string;
  full_name: string;
  role: 'employee' | 'admin' | 'customer';
};

type Booking = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_id: string;
  property_sqft?: string;
  yard_sqft?: string;
  package_id?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  scheduled_date?: string;
  scheduled_time?: string;
  estimated_price: number;
  customer_price: number;
  sherbing_fee: number;
  employee_payout: number;
  status: string;
  assigned_employee: string;
  customer_update_request?: string;
  notes?: string;
  created_at: string;
};

const OPEN_JOB_STATUSES = new Set(['pending', 'confirmed', 'change_requested']);
const FINAL_STATUSES = new Set(['completed', 'cancelled']);

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function prettyStatus(status: string): string {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (s) => s.toUpperCase());
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'confirmed':
      return 'bg-blue-100 text-blue-800';
    case 'change_requested':
      return 'bg-purple-100 text-purple-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function formatAddress(booking: Booking): string {
  const partOne = booking.address?.trim() || '';
  const partTwo = [booking.city, booking.state].map((value) => value?.trim()).filter(Boolean).join(', ');
  const zip = booking.zip_code?.trim() || '';

  return [partOne, [partTwo, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

function parseServices(serviceId: string): string[] {
  return String(serviceId || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => prettyStatus(value));
}

function includesSearchTerm(booking: Booking, term: string): boolean {
  if (!term.trim()) return true;

  const haystack = [
    booking.id,
    booking.customer_name,
    booking.customer_email,
    booking.customer_phone,
    booking.service_id,
    booking.address,
    booking.city,
    booking.state,
    booking.zip_code,
    booking.assigned_employee,
    booking.notes,
    booking.customer_update_request,
    booking.package_id,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(term.toLowerCase().trim());
}

type BookingCardProps = {
  booking: Booking;
  userEmail: string;
  actionLoading: string | null;
  onMarkStatus: (bookingId: string, status: string) => Promise<void>;
};

function BookingCard({ booking, userEmail, actionLoading, onMarkStatus }: BookingCardProps) {
  const normalizedAssignee = String(booking.assigned_employee || '').toLowerCase();
  const claimedByCurrentUser = normalizedAssignee && normalizedAssignee === userEmail;
  const claimedByOther = normalizedAssignee && normalizedAssignee !== userEmail;
  const services = parseServices(booking.service_id);
  const canClaim = !normalizedAssignee && booking.status === 'pending';
  const canComplete = claimedByCurrentUser && !FINAL_STATUSES.has(booking.status);

  return (
    <article className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{services.join(', ') || 'Service'}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(booking.status)}`}>
              {prettyStatus(booking.status)}
            </span>
            {claimedByCurrentUser && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Assigned to you</span>
            )}
            {claimedByOther && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Assigned to {booking.assigned_employee}</span>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Booking ID: {booking.id} | Created: {new Date(booking.created_at).toLocaleString()}
          </p>

          <p className="text-gray-700">{formatAddress(booking) || 'Address unavailable'}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
            <p><span className="font-medium text-gray-800">Customer:</span> {booking.customer_name || 'N/A'}</p>
            <p><span className="font-medium text-gray-800">Assigned:</span> {booking.assigned_employee || 'Unassigned'}</p>
            <p><span className="font-medium text-gray-800">Email:</span> {booking.customer_email || 'N/A'}</p>
            <p><span className="font-medium text-gray-800">Phone:</span> {booking.customer_phone || 'N/A'}</p>
            <p><span className="font-medium text-gray-800">Scheduled Date:</span> {booking.scheduled_date || 'TBD'}</p>
            <p><span className="font-medium text-gray-800">Scheduled Time:</span> {booking.scheduled_time || 'TBD'}</p>
            <p><span className="font-medium text-gray-800">Property Size:</span> {booking.property_sqft || 'N/A'} sqft</p>
            <p><span className="font-medium text-gray-800">Yard Size:</span> {booking.yard_sqft || 'N/A'} sqft</p>
            <p><span className="font-medium text-gray-800">Package:</span> {booking.package_id ? prettyStatus(booking.package_id) : 'N/A'}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(booking) || booking.address || '')}`}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded"
            >
              Open Map
            </a>
            {booking.customer_phone && (
              <a href={`tel:${booking.customer_phone}`} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                Call Customer
              </a>
            )}
            {booking.customer_email && (
              <a href={`mailto:${booking.customer_email}`} className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded">
                Email Customer
              </a>
            )}
          </div>

          {booking.customer_update_request && (
            <p className="text-sm font-medium text-blue-700">
              Customer Request: {prettyStatus(booking.customer_update_request)}
            </p>
          )}
          {booking.notes && <p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Notes:</span> {booking.notes}</p>}
        </div>

        <div className="w-full lg:w-80 border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Customer Pays</span>
            <span className="font-semibold text-gray-900">{formatMoney(Number(booking.customer_price || booking.estimated_price))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Sherbing Fee</span>
            <span className="font-semibold text-gray-900">{formatMoney(Number(booking.sherbing_fee || 0))}</span>
          </div>
          <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between text-sm">
            <span className="text-gray-700 font-medium">Employee Earns</span>
            <span className="font-bold text-green-600">{formatMoney(Number(booking.employee_payout || 0))}</span>
          </div>

          <div className="pt-3 flex flex-wrap gap-2">
            {canClaim && (
              <button
                onClick={() => void onMarkStatus(booking.id, 'confirmed')}
                disabled={actionLoading === booking.id + 'confirmed'}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading === booking.id + 'confirmed' ? 'Claiming...' : 'Claim Job'}
              </button>
            )}

            {canComplete && (
              <button
                onClick={() => void onMarkStatus(booking.id, 'completed')}
                disabled={actionLoading === booking.id + 'completed'}
                className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading === booking.id + 'completed' ? 'Updating...' : 'Mark Completed'}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

type BookingSectionProps = {
  title: string;
  subtitle: string;
  bookings: Booking[];
  emptyMessage: string;
  userEmail: string;
  actionLoading: string | null;
  onMarkStatus: (bookingId: string, status: string) => Promise<void>;
};

function BookingSection({
  title,
  subtitle,
  bookings,
  emptyMessage,
  userEmail,
  actionLoading,
  onMarkStatus,
}: BookingSectionProps) {
  return (
    <section className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
      </div>

      {bookings.length === 0 ? (
        <div className="p-6 text-gray-600">{emptyMessage}</div>
      ) : (
        <div className="divide-y">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              userEmail={userEmail}
              actionLoading={actionLoading}
              onMarkStatus={onMarkStatus}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function EmployeeDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const meRes = await fetch('/api/auth/me');
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

      const bookingsRes = await fetch('/api/bookings/list');
      if (!bookingsRes.ok) {
        const body = await bookingsRes.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to load bookings');
      }

      const data = (await bookingsRes.json()) as Booking[];
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const normalizedUserEmail = String(user?.email || '').toLowerCase();

  const openJobs = useMemo(() => {
    return bookings.filter((booking) => OPEN_JOB_STATUSES.has(booking.status));
  }, [bookings]);

  const historyJobs = useMemo(() => {
    return bookings.filter((booking) => !OPEN_JOB_STATUSES.has(booking.status));
  }, [bookings]);

  const claimedByMe = useMemo(() => {
    if (!user) return [];
    return openJobs.filter((booking) => String(booking.assigned_employee || '').toLowerCase() === normalizedUserEmail);
  }, [normalizedUserEmail, openJobs, user]);

  const unclaimedOpenJobs = useMemo(() => {
    return openJobs.filter((booking) => !booking.assigned_employee);
  }, [openJobs]);

  const assignedToOthers = useMemo(() => {
    if (!user) return [];
    return openJobs.filter((booking) => {
      const assignee = String(booking.assigned_employee || '').toLowerCase();
      return assignee && assignee !== normalizedUserEmail;
    });
  }, [normalizedUserEmail, openJobs, user]);

  const myCompletedJobs = useMemo(() => {
    if (!user) return [];
    return historyJobs.filter((booking) => (
      booking.status === 'completed' && String(booking.assigned_employee || '').toLowerCase() === normalizedUserEmail
    ));
  }, [historyJobs, normalizedUserEmail, user]);

  const otherHistory = useMemo(() => {
    if (!user) return [];
    return historyJobs.filter((booking) => !myCompletedJobs.some((myBooking) => myBooking.id === booking.id));
  }, [historyJobs, myCompletedJobs, user]);

  const openPayoutTotal = useMemo(() => {
    return claimedByMe.reduce((sum, booking) => sum + Number(booking.employee_payout || 0), 0);
  }, [claimedByMe]);

  const completedPayoutTotal = useMemo(() => {
    return myCompletedJobs.reduce((sum, booking) => sum + Number(booking.employee_payout || 0), 0);
  }, [myCompletedJobs]);

  const filteredUnclaimedOpenJobs = useMemo(() => {
    return unclaimedOpenJobs.filter((booking) => includesSearchTerm(booking, searchTerm));
  }, [searchTerm, unclaimedOpenJobs]);

  const filteredClaimedByMe = useMemo(() => {
    return claimedByMe.filter((booking) => includesSearchTerm(booking, searchTerm));
  }, [claimedByMe, searchTerm]);

  const filteredAssignedToOthers = useMemo(() => {
    return assignedToOthers.filter((booking) => includesSearchTerm(booking, searchTerm));
  }, [assignedToOthers, searchTerm]);

  const filteredMyCompletedJobs = useMemo(() => {
    return myCompletedJobs.filter((booking) => includesSearchTerm(booking, searchTerm));
  }, [myCompletedJobs, searchTerm]);

  const filteredOtherHistory = useMemo(() => {
    return otherHistory.filter((booking) => includesSearchTerm(booking, searchTerm));
  }, [otherHistory, searchTerm]);

  const markStatus = async (bookingId: string, status: string): Promise<void> => {
    setActionLoading(bookingId + status);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const raw = await response.text();
      let body: { error?: string } = {};
      if (raw) {
        try {
          body = JSON.parse(raw) as { error?: string };
        } catch {
          body = {};
        }
      }
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to update booking');
      }

      if (status === 'confirmed') {
        setMessage('Job claimed successfully.');
      } else if (status === 'completed') {
        setMessage('Job marked as completed.');
      } else {
        setMessage('Booking updated successfully.');
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  if (loading) {
    return <main className="min-h-screen bg-gray-50 p-8">Loading employee dashboard...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="icon" size="small" />
            <span className="text-sm text-gray-500">Employee Dashboard</span>
          </div>
          <div className="flex items-center gap-4 text-sm sm:text-base">
            {user?.role === 'admin' && <Link href="/admin/users" className="text-gray-700 hover:text-gray-900">Manage Users</Link>}
            {user?.role === 'admin' && <Link href="/admin/booking" className="text-gray-700 hover:text-gray-900">Manage Bookings</Link>}
            <button onClick={logout} className="text-gray-700 hover:text-gray-900">Logout</button>
          </div>
        </nav>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Signed In As</p>
            <p className="text-lg font-semibold text-gray-900">{user?.full_name || user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Open Jobs (Unclaimed)</p>
            <p className="text-2xl font-bold text-gray-900">{unclaimedOpenJobs.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Your Open Earnings</p>
            <p className="text-2xl font-bold text-green-600">{formatMoney(openPayoutTotal)}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Your Active Jobs</p>
            <p className="text-2xl font-bold text-gray-900">{claimedByMe.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Team Assigned Open Jobs</p>
            <p className="text-2xl font-bold text-gray-900">{assignedToOthers.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Your Completed Earnings</p>
            <p className="text-2xl font-bold text-emerald-600">{formatMoney(completedPayoutTotal)}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by customer, booking ID, address, service, notes..."
            className="w-full md:max-w-xl rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => void loadData()}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-black"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
        )}
        {message && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">{message}</div>
        )}

        <BookingSection
          title="My Active Jobs"
          subtitle="These jobs are assigned to you and still in progress."
          bookings={filteredClaimedByMe}
          emptyMessage="No active jobs assigned to you right now."
          userEmail={normalizedUserEmail}
          actionLoading={actionLoading}
          onMarkStatus={markStatus}
        />

        <BookingSection
          title="Available Jobs"
          subtitle="Claim a pending booking when you are ready to take it."
          bookings={filteredUnclaimedOpenJobs}
          emptyMessage="No unclaimed jobs are available right now."
          userEmail={normalizedUserEmail}
          actionLoading={actionLoading}
          onMarkStatus={markStatus}
        />

        <BookingSection
          title="Team Assigned Open Jobs"
          subtitle="Open jobs currently assigned to another team member."
          bookings={filteredAssignedToOthers}
          emptyMessage="No team-assigned open jobs right now."
          userEmail={normalizedUserEmail}
          actionLoading={actionLoading}
          onMarkStatus={markStatus}
        />

        <BookingSection
          title="My Completed Jobs"
          subtitle="Completed work history with full customer and payout details."
          bookings={filteredMyCompletedJobs}
          emptyMessage="No completed jobs recorded for your account yet."
          userEmail={normalizedUserEmail}
          actionLoading={actionLoading}
          onMarkStatus={markStatus}
        />

        <BookingSection
          title="Other History"
          subtitle="Closed jobs from the rest of the team for full visibility."
          bookings={filteredOtherHistory}
          emptyMessage="No additional booking history found."
          userEmail={normalizedUserEmail}
          actionLoading={actionLoading}
          onMarkStatus={markStatus}
        />
      </div>
    </main>
  );
}

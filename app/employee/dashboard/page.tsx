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

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...(init || {}), signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

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
  actionLoading: string | null;
  onUpdateSchedule: (bookingId: string, scheduledDate: string, scheduledTime: string) => Promise<void>;
};

function BookingCard({ booking, actionLoading, onUpdateSchedule }: BookingCardProps) {
  const services = parseServices(booking.service_id);
  const [scheduledDateDraft, setScheduledDateDraft] = useState(booking.scheduled_date || '');
  const [scheduledTimeDraft, setScheduledTimeDraft] = useState(booking.scheduled_time || '');

  return (
    <article className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{services.join(', ') || 'Service'}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(booking.status)}`}>
              {prettyStatus(booking.status)}
            </span>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl">
            <input
              type="date"
              value={scheduledDateDraft}
              onChange={(event) => setScheduledDateDraft(event.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="time"
              value={scheduledTimeDraft}
              onChange={(event) => setScheduledTimeDraft(event.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={() => void onUpdateSchedule(booking.id, scheduledDateDraft, scheduledTimeDraft)}
              disabled={actionLoading === booking.id + 'schedule'}
              className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {actionLoading === booking.id + 'schedule' ? 'Saving...' : 'Save Schedule'}
            </button>
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
        </div>
      </div>
    </article>
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
      const meRes = await fetchWithTimeout('/api/auth/me');
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

      const bookingsRes = await fetchWithTimeout('/api/bookings/list');
      if (!bookingsRes.ok) {
        const body = await bookingsRes.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to load bookings');
      }

      const data = (await bookingsRes.json()) as Booking[];
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Dashboard request timed out. Please refresh and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking) => includesSearchTerm(booking, searchTerm))
      .sort((a, b) => {
        const aDate = `${a.scheduled_date || '9999-12-31'} ${a.scheduled_time || '23:59'}`;
        const bDate = `${b.scheduled_date || '9999-12-31'} ${b.scheduled_time || '23:59'}`;
        return aDate.localeCompare(bDate);
      });
  }, [bookings, searchTerm]);

  const scheduledCount = useMemo(() => {
    return bookings.filter((booking) => Boolean(booking.scheduled_date && booking.scheduled_time)).length;
  }, [bookings]);

  const payoutTotal = useMemo(() => {
    return bookings.reduce((sum, booking) => sum + Number(booking.employee_payout || 0), 0);
  }, [bookings]);

  const updateSchedule = async (bookingId: string, scheduledDate: string, scheduledTime: string): Promise<void> => {
    setActionLoading(bookingId + 'schedule');
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
        }),
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
        throw new Error(body?.error || 'Failed to update schedule');
      }

      setMessage('Schedule updated successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    } finally {
      setActionLoading(null);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900">Loading employee dashboard...</h1>
            <p className="text-sm text-gray-600 mt-2">Fetching your bookings and schedule details.</p>
          </div>
        </div>
      </main>
    );
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
            <p className="text-sm text-gray-500">Total Bookings</p>
            <p className="text-2xl font-bold text-gray-900">{bookings.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Scheduled Bookings</p>
            <p className="text-2xl font-bold text-gray-900">{scheduledCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Potential Earnings</p>
            <p className="text-2xl font-bold text-green-600">{formatMoney(payoutTotal)}</p>
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

        <section className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">All Bookings</h2>
            <p className="text-sm text-gray-600 mt-1">View all job details in one place and update schedule times directly.</p>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="p-6 text-gray-600">No bookings found.</div>
          ) : (
            <div className="divide-y">
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={`${booking.id}-${booking.scheduled_date || ''}-${booking.scheduled_time || ''}`}
                  booking={booking}
                  actionLoading={actionLoading}
                  onUpdateSchedule={updateSchedule}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

'use client';

import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime12, formatTime12 } from '@/lib/dateTime';

type User = {
  email: string;
  full_name: string;
  role: 'employee' | 'admin' | 'customer';
  shadow_required?: string;
  shadow_completed_at?: string;
};

type Booking = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_id: string;
  service_details?: string;
  property_sqft?: string;
  yard_sqft?: string;
  package_id?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  scheduled_date?: string;
  scheduled_time?: string;
  scheduled_duration_minutes?: number;
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
    booking.service_details,
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
  canManageActions: boolean;
  onUpdateSchedule: (bookingId: string, scheduledDate: string, scheduledTime: string, scheduledDurationMinutes: number) => Promise<void>;
  onSaveBookingDetails: (bookingId: string, updates: {
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    service_id: string;
    service_details: string;
    property_sqft: string;
    yard_sqft: string;
    package_id: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
  }) => Promise<void>;
  onDeleteBooking: (bookingId: string) => Promise<void>;
};

function BookingCard({ booking, actionLoading, canManageActions, onUpdateSchedule, onSaveBookingDetails, onDeleteBooking }: BookingCardProps) {
  const services = parseServices(booking.service_id);
  const [scheduledDateDraft, setScheduledDateDraft] = useState(booking.scheduled_date || '');
  const [scheduledTimeDraft, setScheduledTimeDraft] = useState(booking.scheduled_time || '');
  const [scheduledDurationDraft, setScheduledDurationDraft] = useState(Number(booking.scheduled_duration_minutes || 60));
  const [customerNameDraft, setCustomerNameDraft] = useState(booking.customer_name || '');
  const [customerEmailDraft, setCustomerEmailDraft] = useState(booking.customer_email || '');
  const [customerPhoneDraft, setCustomerPhoneDraft] = useState(booking.customer_phone || '');
  const [serviceIdDraft, setServiceIdDraft] = useState(booking.service_id || '');
  const [serviceDetailsDraft, setServiceDetailsDraft] = useState(booking.service_details || '');
  const [propertySqftDraft, setPropertySqftDraft] = useState(booking.property_sqft || '');
  const [yardSqftDraft, setYardSqftDraft] = useState(booking.yard_sqft || '');
  const [packageIdDraft, setPackageIdDraft] = useState(booking.package_id || '');
  const [addressDraft, setAddressDraft] = useState(booking.address || '');
  const [cityDraft, setCityDraft] = useState(booking.city || '');
  const [stateDraft, setStateDraft] = useState(booking.state || '');
  const [zipCodeDraft, setZipCodeDraft] = useState(booking.zip_code || '');

  return (
    <article className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{services.join(', ') || 'Service'}</h3>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              {prettyStatus(booking.status)}
            </span>
          </div>

          <p className="text-xs text-gray-500">
            Booking ID: {booking.id} | Created: {formatDateTime12(booking.created_at)}
          </p>

          <p className="text-gray-700">{formatAddress(booking) || 'Address unavailable'}</p>

          {booking.service_details && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1">Work Details</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                {booking.service_details.split('|').map((item) => item.trim()).filter(Boolean).join('\n')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
            <p><span className="font-medium text-gray-800">Customer:</span> {booking.customer_name || 'N/A'}</p>
            <p><span className="font-medium text-gray-800">Email:</span> {booking.customer_email || 'N/A'}</p>
            <p><span className="font-medium text-gray-800">Phone:</span> {booking.customer_phone || 'N/A'}</p>
            <p><span className="font-medium text-gray-800">Scheduled Date:</span> {booking.scheduled_date || 'TBD'}</p>
            <p><span className="font-medium text-gray-800">Scheduled Time:</span> {formatTime12(booking.scheduled_time)}</p>
            <p><span className="font-medium text-gray-800">Duration:</span> {Number(booking.scheduled_duration_minutes || 60)} minutes</p>
            <p><span className="font-medium text-gray-800">Quoted Price:</span> {formatMoney(Number(booking.customer_price || booking.estimated_price || 0))}</p>
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
            <select
              value={String(scheduledDurationDraft)}
              onChange={(event) => setScheduledDurationDraft(Number(event.target.value) || 60)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="30">30m</option>
              <option value="45">45m</option>
              <option value="60">1h</option>
              <option value="90">1.5h</option>
              <option value="120">2h</option>
              <option value="180">3h</option>
            </select>
            <button
              onClick={() => void onUpdateSchedule(booking.id, scheduledDateDraft, scheduledTimeDraft, scheduledDurationDraft)}
              disabled={!canManageActions || actionLoading === booking.id + 'schedule'}
              className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {actionLoading === booking.id + 'schedule' ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Edit Booking Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="text"
                value={customerNameDraft}
                onChange={(event) => setCustomerNameDraft(event.target.value)}
                placeholder="Customer name"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="email"
                value={customerEmailDraft}
                onChange={(event) => setCustomerEmailDraft(event.target.value)}
                placeholder="Customer email"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                value={customerPhoneDraft}
                onChange={(event) => setCustomerPhoneDraft(event.target.value)}
                placeholder="Customer phone"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                value={serviceIdDraft}
                onChange={(event) => setServiceIdDraft(event.target.value)}
                placeholder="Service(s), comma separated"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                value={propertySqftDraft}
                onChange={(event) => setPropertySqftDraft(event.target.value)}
                placeholder="Property sqft"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                value={yardSqftDraft}
                onChange={(event) => setYardSqftDraft(event.target.value)}
                placeholder="Yard sqft"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                value={packageIdDraft}
                onChange={(event) => setPackageIdDraft(event.target.value)}
                placeholder="Package"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                value={addressDraft}
                onChange={(event) => setAddressDraft(event.target.value)}
                placeholder="Street address"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                value={cityDraft}
                onChange={(event) => setCityDraft(event.target.value)}
                placeholder="City"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                value={stateDraft}
                onChange={(event) => setStateDraft(event.target.value)}
                placeholder="State"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                value={zipCodeDraft}
                onChange={(event) => setZipCodeDraft(event.target.value)}
                placeholder="ZIP code"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <textarea
              value={serviceDetailsDraft}
              onChange={(event) => setServiceDetailsDraft(event.target.value)}
              placeholder="Service details"
              className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={() => void onSaveBookingDetails(booking.id, {
                customer_name: customerNameDraft,
                customer_email: customerEmailDraft,
                customer_phone: customerPhoneDraft,
                service_id: serviceIdDraft,
                service_details: serviceDetailsDraft,
                property_sqft: propertySqftDraft,
                yard_sqft: yardSqftDraft,
                package_id: packageIdDraft,
                address: addressDraft,
                city: cityDraft,
                state: stateDraft,
                zip_code: zipCodeDraft,
              })}
              disabled={!canManageActions || actionLoading === booking.id + 'details'}
              className="px-3 py-2 bg-slate-800 text-white text-sm rounded-md hover:bg-black disabled:opacity-50"
            >
              {actionLoading === booking.id + 'details' ? 'Saving...' : 'Save Booking Details'}
            </button>
          </div>

          <div>
            <button
              onClick={() => void onDeleteBooking(booking.id)}
              disabled={!canManageActions || actionLoading === booking.id + 'delete'}
              className="px-3 py-2 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 disabled:opacity-50"
            >
              {actionLoading === booking.id + 'delete' ? 'Deleting...' : 'Delete Booking'}
            </button>
          </div>

          {!canManageActions && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Action locked until required shadow training is completed. Go to Training tab to complete onboarding.
            </div>
          )}

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

          {booking.notes && <p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Job Notes:</span> {booking.notes}</p>}
        </div>

        <div className="w-full lg:w-80 border border-emerald-200 rounded-lg p-4 bg-emerald-50 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Customer Quote</p>
          <p className="text-3xl font-bold text-emerald-700">
            {formatMoney(Number(booking.customer_price || booking.estimated_price || 0))}
          </p>
          <p className="text-xs text-emerald-800">This is the exact quoted customer price.</p>
        </div>
      </div>
    </article>
  );
}

export default function EmployeeDashboardPage() {
  const router = useRouter();
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

  const quotedTotal = useMemo(() => {
    return bookings.reduce((sum, booking) => sum + Number(booking.customer_price || booking.estimated_price || 0), 0);
  }, [bookings]);

  const canWorkSolo = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const shadowRequired = String(user.shadow_required || 'true').toLowerCase() !== 'false';
    if (!shadowRequired) return true;
    return Boolean(String(user.shadow_completed_at || '').trim());
  }, [user]);

  const updateSchedule = async (bookingId: string, scheduledDate: string, scheduledTime: string, scheduledDurationMinutes: number): Promise<void> => {
    setActionLoading(bookingId + 'schedule');
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          scheduled_duration_minutes: scheduledDurationMinutes,
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

  const deleteBooking = async (bookingId: string): Promise<void> => {
    const confirmed = window.confirm('Delete this booking permanently?');
    if (!confirmed) return;

    setActionLoading(bookingId + 'delete');
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'DELETE',
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
        throw new Error(body?.error || 'Failed to delete booking');
      }

      setMessage('Booking deleted successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete booking');
    } finally {
      setActionLoading(null);
    }
  };

  const saveBookingDetails = async (
    bookingId: string,
    updates: {
      customer_name: string;
      customer_email: string;
      customer_phone: string;
      service_id: string;
      service_details: string;
      property_sqft: string;
      yard_sqft: string;
      package_id: string;
      address: string;
      city: string;
      state: string;
      zip_code: string;
    }
  ): Promise<void> => {
    setActionLoading(bookingId + 'details');
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
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
        throw new Error(body?.error || 'Failed to save booking details');
      }

      setMessage('Booking details saved successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save booking details');
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
            <button
              onClick={() => router.push('/employee/dashboard')}
              className="text-gray-700 hover:text-gray-900"
            >
              Bookings
            </button>
            <button
              onClick={() => router.push('/employee/calendar')}
              className="text-gray-700 hover:text-gray-900"
            >
              Calendar
            </button>
            <button
              onClick={() => router.push('/employee/forms')}
              className="text-gray-700 hover:text-gray-900"
            >
              Forms
            </button>
            <button
              onClick={() => router.push('/employee/timesheet')}
              className="text-gray-700 hover:text-gray-900"
            >
              Timesheet
            </button>
            <button
              onClick={() => router.push('/employee/training')}
              className="text-gray-700 hover:text-gray-900"
            >
              Training
            </button>
            <button
              onClick={() => router.push('/employee/job-applications')}
              className="text-gray-700 hover:text-gray-900"
            >
              Job Applications
            </button>
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
            <p className="text-sm text-gray-500">Total Quoted Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">{formatMoney(quotedTotal)}</p>
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

        {!canWorkSolo && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900 text-sm">
            Solo work actions are locked until shadow training is complete. Finish your training in the
            {' '}
            <Link href="/employee/training" className="font-semibold underline">Training tab</Link>
            .
          </div>
        )}

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
                  canManageActions={canWorkSolo}
                  onUpdateSchedule={updateSchedule}
                  onSaveBookingDetails={saveBookingDetails}
                  onDeleteBooking={deleteBooking}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

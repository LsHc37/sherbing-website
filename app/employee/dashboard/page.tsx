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

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function prettyStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase());
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

export default function EmployeeDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  const openJobs = useMemo(() => {
    return bookings.filter((booking) => OPEN_JOB_STATUSES.has(booking.status));
  }, [bookings]);

  const claimedByMe = useMemo(() => {
    if (!user) return [];
    return openJobs.filter((booking) => booking.assigned_employee === user.email);
  }, [openJobs, user]);

  const unclaimedOpenJobs = useMemo(() => {
    return openJobs.filter((booking) => !booking.assigned_employee);
  }, [openJobs]);

  const openPayoutTotal = useMemo(() => {
    return claimedByMe.reduce((sum, booking) => sum + Number(booking.employee_payout || 0), 0);
  }, [claimedByMe]);

  const markStatus = async (bookingId: string, status: string) => {
    setActionLoading(bookingId + status);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to update booking');
      }

      setMessage(status === 'confirmed' ? 'Job claimed successfully.' : 'Job marked as completed.');
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

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
        )}
        {message && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">{message}</div>
        )}

        <section className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">Open Jobs</h2>
            <p className="text-sm text-gray-600 mt-1">Employees can claim pending jobs and see expected payout before accepting.</p>
          </div>

          {openJobs.length === 0 ? (
            <div className="p-6 text-gray-600">No open jobs right now.</div>
          ) : (
            <div className="divide-y">
              {openJobs.map((booking) => {
                const claimedByCurrentUser = booking.assigned_employee && booking.assigned_employee === user?.email;
                const claimedByOther = booking.assigned_employee && booking.assigned_employee !== user?.email;

                return (
                  <article key={booking.id} className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{booking.service_id.replace(/_/g, ' ').toUpperCase()}</h3>
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

                        <p className="text-gray-700">
                          {booking.address}, {booking.city}, {booking.state} {booking.zip_code}
                        </p>
                        {(booking.scheduled_date || booking.scheduled_time) && (
                          <p className="text-sm text-gray-600">
                            Scheduled: {booking.scheduled_date || 'TBD'} {booking.scheduled_time || ''}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          Customer: {booking.customer_name} {booking.customer_email ? `(${booking.customer_email})` : ''}
                        </p>
                        {booking.customer_phone && <p className="text-sm text-gray-500">Phone: {booking.customer_phone}</p>}
                        {booking.customer_update_request && (
                          <p className="text-sm font-medium text-blue-700">
                            Customer Request: {prettyStatus(booking.customer_update_request)}
                          </p>
                        )}
                        {booking.notes && <p className="text-sm text-gray-600">Notes: {booking.notes}</p>}
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
                          {!booking.assigned_employee && booking.status === 'pending' && (
                            <button
                              onClick={() => markStatus(booking.id, 'confirmed')}
                              disabled={actionLoading === booking.id + 'confirmed'}
                              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              {actionLoading === booking.id + 'confirmed' ? 'Claiming...' : 'Claim Job'}
                            </button>
                          )}

                          {claimedByCurrentUser && booking.status !== 'completed' && (
                            <button
                              onClick={() => markStatus(booking.id, 'completed')}
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
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

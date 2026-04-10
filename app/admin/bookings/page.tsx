'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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
  status: string;
  assigned_employee: string;
  notes?: string;
};

type User = {
  email: string;
  full_name: string;
  role: 'customer' | 'employee' | 'admin';
  active: string;
  available_dates?: string;
};

type BookingEdit = {
  assigned_employee: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  notes: string;
};

const STATUS_OPTIONS = ['pending', 'confirmed', 'change_requested', 'completed', 'cancelled'];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [edits, setEdits] = useState<Record<string, BookingEdit>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');

  const employees = useMemo(() => {
    return users.filter((user) => user.role === 'employee' && String(user.active).toLowerCase() !== 'false');
  }, [users]);

  const load = async () => {
    setLoading(true);
    setMessage('');

    const me = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!me.ok) {
      window.location.href = '/login';
      return;
    }

    const meData = await me.json();
    if (meData?.user?.role !== 'admin') {
      window.location.href = '/employee/dashboard';
      return;
    }

    const [bookingsRes, usersRes] = await Promise.all([
      fetch('/api/bookings/list', { cache: 'no-store' }),
      fetch('/api/users', { cache: 'no-store' }),
    ]);

    if (!bookingsRes.ok || !usersRes.ok) {
      setMessage('Failed to load admin booking data');
      setLoading(false);
      return;
    }

    const bookingData = await bookingsRes.json();
    const userData = await usersRes.json();

    const bookingList = Array.isArray(bookingData) ? bookingData : [];
    const userList = Array.isArray(userData) ? userData : [];

    setBookings(bookingList);
    setUsers(userList);

    const initialEdits: Record<string, BookingEdit> = {};
    for (const booking of bookingList) {
      initialEdits[booking.id] = {
        assigned_employee: booking.assigned_employee || '',
        scheduled_date: booking.scheduled_date || '',
        scheduled_time: booking.scheduled_time || '',
        status: booking.status || 'pending',
        notes: booking.notes || '',
      };
    }
    setEdits(initialEdits);

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const updateEdit = (bookingId: string, key: keyof BookingEdit, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [bookingId]: {
        ...(prev[bookingId] || {
          assigned_employee: '',
          scheduled_date: '',
          scheduled_time: '',
          status: 'pending',
          notes: '',
        }),
        [key]: value,
      },
    }));
  };

  const saveBooking = async (bookingId: string) => {
    const edit = edits[bookingId];
    if (!edit) return;

    setSavingId(bookingId);
    setMessage('');

    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edit),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body?.error || `Failed to update booking ${bookingId}`);
      setSavingId('');
      return;
    }

    setMessage(`Updated booking ${bookingId}`);
    setSavingId('');
    await load();
  };

  if (loading) {
    return <main className="p-8">Loading admin booking tools...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Booking Management</h1>
            <p className="text-sm text-gray-600">Assign employees, schedule work dates, and manage booking statuses.</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin/users" className="text-gray-700 hover:text-gray-900">Manage Users</Link>
            <Link href="/employee/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {message && <div className="p-3 rounded bg-blue-50 border border-blue-200 text-blue-700">{message}</div>}

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-2">Active Employees</h2>
          <p className="text-sm text-gray-600 mb-4">Employees marked active can be assigned to bookings.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map((employee) => (
              <div key={employee.email} className="border rounded-lg p-3 text-sm">
                <p className="font-semibold text-gray-900">{employee.full_name || employee.email}</p>
                <p className="text-gray-600">{employee.email}</p>
                <p className="text-gray-600 mt-1">
                  Available dates: {employee.available_dates ? employee.available_dates.split(',').join(', ') : 'Not set'}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm">Booking</th>
                <th className="px-4 py-3 text-left text-sm">Customer</th>
                <th className="px-4 py-3 text-left text-sm">Assign Employee</th>
                <th className="px-4 py-3 text-left text-sm">Schedule Date</th>
                <th className="px-4 py-3 text-left text-sm">Time</th>
                <th className="px-4 py-3 text-left text-sm">Status</th>
                <th className="px-4 py-3 text-left text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bookings.map((booking) => {
                const edit = edits[booking.id] || {
                  assigned_employee: '',
                  scheduled_date: '',
                  scheduled_time: '',
                  status: booking.status || 'pending',
                  notes: booking.notes || '',
                };

                return (
                  <tr key={booking.id}>
                    <td className="px-4 py-3 text-sm align-top">
                      <p className="font-semibold text-gray-900">{booking.id}</p>
                      <p className="text-gray-700">{booking.service_id}</p>
                      <p className="text-gray-600">{booking.address}, {booking.city}, {booking.state} {booking.zip_code}</p>
                    </td>
                    <td className="px-4 py-3 text-sm align-top">
                      <p className="text-gray-900">{booking.customer_name}</p>
                      <p className="text-gray-600">{booking.customer_email || '-'}</p>
                      <p className="text-gray-600">{booking.customer_phone || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm align-top">
                      <select
                        value={edit.assigned_employee}
                        onChange={(e) => updateEdit(booking.id, 'assigned_employee', e.target.value)}
                        className="px-2 py-1 border rounded w-56"
                      >
                        <option value="">Unassigned</option>
                        {employees.map((employee) => (
                          <option key={employee.email} value={employee.email}>
                            {employee.full_name || employee.email}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm align-top">
                      <input
                        type="date"
                        value={edit.scheduled_date}
                        onChange={(e) => updateEdit(booking.id, 'scheduled_date', e.target.value)}
                        className="px-2 py-1 border rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm align-top">
                      <input
                        type="time"
                        value={edit.scheduled_time}
                        onChange={(e) => updateEdit(booking.id, 'scheduled_time', e.target.value)}
                        className="px-2 py-1 border rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm align-top">
                      <select
                        value={edit.status}
                        onChange={(e) => updateEdit(booking.id, 'status', e.target.value)}
                        className="px-2 py-1 border rounded"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm align-top">
                      <button
                        onClick={() => saveBooking(booking.id)}
                        disabled={savingId === booking.id}
                        className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {savingId === booking.id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

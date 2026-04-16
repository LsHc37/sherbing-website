'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Booking = {
  id: string;
  customer_name: string;
  service_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  scheduled_date?: string;
  scheduled_time?: string;
  scheduled_duration_minutes?: number;
  customer_price?: number;
  estimated_price?: number;
  status: string;
  assigned_employee: string;
};

type User = {
  email: string;
  full_name: string;
  role: 'customer' | 'employee' | 'admin';
  active: string;
};

type RouteStop = {
  booking_id: string;
  order: number;
  estimated_travel_minutes: number;
  estimated_service_minutes: number;
  scheduled_time: string;
  customer_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  estimated_price: number;
};

type PlannedRoute = {
  source: 'ai' | 'standard';
  route_name: string;
  route_group_id: string;
  assigned_employee: string;
  target_date: string;
  summary: string;
  totals: {
    estimated_price: number;
    estimated_service_minutes: number;
    estimated_travel_minutes: number;
    estimated_total_minutes: number;
  };
  stops: RouteStop[];
};

function todayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AdminRoutesPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [targetDate, setTargetDate] = useState(todayIsoDate());
  const [routeName, setRouteName] = useState('');
  const [assignedEmployee, setAssignedEmployee] = useState('');
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking) => String(booking.status || '').toLowerCase() !== 'cancelled')
      .filter((booking) => !targetDate || String(booking.scheduled_date || '').trim() === targetDate || !booking.scheduled_date)
      .sort((a, b) => {
        const aTime = String(a.scheduled_time || '').trim();
        const bTime = String(b.scheduled_time || '').trim();
        if (aTime && bTime && aTime !== bTime) return aTime.localeCompare(bTime);
        return a.address.localeCompare(b.address);
      });
  }, [bookings, targetDate]);

  const selectedBookingIds = useMemo(() => {
    return Object.entries(selectedMap)
      .filter(([, selected]) => selected)
      .map(([bookingId]) => bookingId);
  }, [selectedMap]);

  const load = async () => {
    setLoading(true);
    setMessage('');

    const meResponse = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!meResponse.ok) {
      window.location.href = '/login';
      return;
    }

    const meData = await meResponse.json();
    if (meData?.user?.role !== 'admin') {
      window.location.href = '/employee/dashboard';
      return;
    }

    const [bookingsResponse, usersResponse] = await Promise.all([
      fetch('/api/bookings/list', { cache: 'no-store' }),
      fetch('/api/users', { cache: 'no-store' }),
    ]);

    if (!bookingsResponse.ok || !usersResponse.ok) {
      setMessage('Unable to load route planning data');
      setLoading(false);
      return;
    }

    const bookingData = await bookingsResponse.json();
    const userData = await usersResponse.json();

    const bookingList = Array.isArray(bookingData) ? bookingData : [];
    const userList = Array.isArray(userData) ? userData : [];

    setBookings(bookingList);
    setEmployees(userList.filter((user: User) => user.role === 'employee' && String(user.active || '').toLowerCase() !== 'false'));

    setSelectedMap((prev) => {
      const next: Record<string, boolean> = {};
      for (const booking of bookingList as Booking[]) {
        if (prev[booking.id]) next[booking.id] = true;
      }
      return next;
    });

    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const toggleBooking = (bookingId: string) => {
    setSelectedMap((prev) => ({
      ...prev,
      [bookingId]: !prev[bookingId],
    }));
  };

  const selectAllVisible = () => {
    const next: Record<string, boolean> = {};
    for (const booking of filteredBookings) {
      next[booking.id] = true;
    }
    setSelectedMap(next);
  };

  const clearSelection = () => {
    setSelectedMap({});
    setPlannedRoute(null);
  };

  const generateRoutePlan = async () => {
    if (selectedBookingIds.length === 0) {
      setMessage('Select at least one booking to plan a route.');
      return;
    }

    setPlanning(true);
    setMessage('');

    const response = await fetch('/api/admin/routes/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_ids: selectedBookingIds,
        route_name: routeName,
        assigned_employee: assignedEmployee,
        target_date: targetDate,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body?.error || 'Failed to generate route plan');
      setPlanning(false);
      return;
    }

    setPlannedRoute(body as PlannedRoute);
    setPlanning(false);
    setMessage(`Route plan generated (${body.source === 'ai' ? 'AI' : 'Standard'}).`);
  };

  const applyRoutePlan = async () => {
    if (!plannedRoute || plannedRoute.stops.length === 0) {
      setMessage('Generate a route plan before applying it.');
      return;
    }

    setApplying(true);
    setMessage('');

    for (const stop of plannedRoute.stops) {
      const response = await fetch(`/api/bookings/${encodeURIComponent(stop.booking_id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_employee: plannedRoute.assigned_employee || assignedEmployee,
          scheduled_date: plannedRoute.target_date || targetDate,
          scheduled_time: stop.scheduled_time,
          scheduled_duration_minutes: stop.estimated_service_minutes,
          route_name: plannedRoute.route_name,
          route_group_id: plannedRoute.route_group_id,
          route_stop_order: stop.order,
          route_estimated_travel_minutes: stop.estimated_travel_minutes,
          route_ai_summary: plannedRoute.summary,
          status: 'confirmed',
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setMessage(body?.error || `Failed applying route for ${stop.booking_id}`);
        setApplying(false);
        return;
      }
    }

    setApplying(false);
    setMessage('Route applied to all selected bookings.');
    await load();
  };

  if (loading) {
    return <main className="p-8">Loading route planning tools...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Route Planner</h1>
            <p className="text-sm text-gray-600">Create optimized employee routes with AI and apply dispatch details to bookings.</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin/bookings" className="text-gray-700 hover:text-gray-900">Bookings</Link>
            <Link href="/admin/users" className="text-gray-700 hover:text-gray-900">Users</Link>
            <Link href="/admin/timesheet" className="text-gray-700 hover:text-gray-900">Timesheets</Link>
            <Link href="/employee/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {message && <div className="p-3 rounded bg-blue-50 border border-blue-200 text-blue-700">{message}</div>}

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="px-3 py-2 border rounded"
            />
            <input
              type="text"
              value={routeName}
              onChange={(event) => setRouteName(event.target.value)}
              placeholder="Route name (optional)"
              className="px-3 py-2 border rounded"
            />
            <select
              value={assignedEmployee}
              onChange={(event) => setAssignedEmployee(event.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="">Assign employee later</option>
              {employees.map((employee) => (
                <option key={employee.email} value={employee.email}>{employee.full_name || employee.email}</option>
              ))}
            </select>
            <button
              onClick={() => void generateRoutePlan()}
              disabled={planning || selectedBookingIds.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              {planning ? 'Planning...' : 'Generate Route (AI)'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={selectAllVisible} className="px-3 py-1 bg-slate-100 rounded text-sm">Select Visible</button>
            <button onClick={clearSelection} className="px-3 py-1 bg-slate-100 rounded text-sm">Clear</button>
            <span className="text-sm text-gray-600 self-center">Selected: {selectedBookingIds.length}</span>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm">Select</th>
                <th className="px-4 py-3 text-left text-sm">Booking</th>
                <th className="px-4 py-3 text-left text-sm">Customer</th>
                <th className="px-4 py-3 text-left text-sm">Service / Price</th>
                <th className="px-4 py-3 text-left text-sm">Schedule</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredBookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="px-4 py-3 text-sm align-top">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedMap[booking.id])}
                      onChange={() => toggleBooking(booking.id)}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm align-top">
                    <p className="font-semibold text-gray-900">{booking.id}</p>
                    <p className="text-gray-600">{booking.address}, {booking.city}, {booking.state} {booking.zip_code}</p>
                  </td>
                  <td className="px-4 py-3 text-sm align-top">
                    <p>{booking.customer_name}</p>
                    <p className="text-gray-500">{booking.assigned_employee || 'Unassigned'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm align-top">
                    <p>{booking.service_id}</p>
                    <p className="text-gray-600">${Number(booking.customer_price || booking.estimated_price || 0).toFixed(2)}</p>
                  </td>
                  <td className="px-4 py-3 text-sm align-top">
                    <p>{booking.scheduled_date || 'Unscheduled'}</p>
                    <p className="text-gray-600">{booking.scheduled_time || 'TBD'} ({Number(booking.scheduled_duration_minutes || 60)} min)</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {plannedRoute && (
          <section className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Planned Route: {plannedRoute.route_name}</h2>
                <p className="text-sm text-gray-600">{plannedRoute.summary}</p>
                <p className="text-xs text-gray-500 mt-1">Route ID: {plannedRoute.route_group_id}</p>
              </div>
              <button
                onClick={() => void applyRoutePlan()}
                disabled={applying}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {applying ? 'Applying...' : 'Apply Route to Bookings'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded bg-slate-50 border">Estimated Revenue: ${plannedRoute.totals.estimated_price.toFixed(2)}</div>
              <div className="p-3 rounded bg-slate-50 border">Service Minutes: {plannedRoute.totals.estimated_service_minutes}</div>
              <div className="p-3 rounded bg-slate-50 border">Travel Minutes: {plannedRoute.totals.estimated_travel_minutes}</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs">Stop</th>
                    <th className="px-3 py-2 text-left text-xs">Booking</th>
                    <th className="px-3 py-2 text-left text-xs">Planned Time</th>
                    <th className="px-3 py-2 text-left text-xs">Travel</th>
                    <th className="px-3 py-2 text-left text-xs">Service</th>
                    <th className="px-3 py-2 text-left text-xs">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {plannedRoute.stops.map((stop) => (
                    <tr key={stop.booking_id}>
                      <td className="px-3 py-2 text-sm font-semibold">{stop.order}</td>
                      <td className="px-3 py-2 text-sm">
                        <p className="font-medium">{stop.booking_id}</p>
                        <p className="text-gray-600">{stop.address}, {stop.city}, {stop.state} {stop.zip_code}</p>
                      </td>
                      <td className="px-3 py-2 text-sm">{stop.scheduled_time}</td>
                      <td className="px-3 py-2 text-sm">{stop.estimated_travel_minutes} min</td>
                      <td className="px-3 py-2 text-sm">{stop.estimated_service_minutes} min</td>
                      <td className="px-3 py-2 text-sm">${stop.estimated_price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

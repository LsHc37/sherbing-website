'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type TimesheetEntry = {
  entry_id: string;
  clock_in_at: string;
  clock_out_at: string;
  work_date: string;
  work_date_label: string;
  minutes_worked: number;
  status: string;
  source: string;
};

type AdjustmentRequest = {
  request_id: string;
  target_date: string;
  target_date_label: string;
  minutes_delta: number;
  reason: string;
  status: string;
  created_at: string;
  review_notes: string;
};

type TimesheetPayload = {
  employee: {
    email: string;
    full_name: string;
    pay_type: string;
    pay_rate: number;
    job_description: string;
    route_role: string;
  };
  pay_period: {
    start_date: string;
    end_date: string;
    label: string;
    cadence: string;
  };
  summary: {
    worked_minutes: number;
    approved_adjustment_minutes: number;
    payable_minutes: number;
    payable_hours: number;
    shift_count: number;
    work_day_count: number;
    estimated_gross_pay: number;
    estimate_detail: string;
  };
  current_clock: {
    clock_in_at: string;
    clock_out_at: string;
    clocked_in: boolean;
  };
  entries: TimesheetEntry[];
  adjustment_requests: AdjustmentRequest[];
};

function formatMinutes(minutes: number) {
  const safe = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${hours}h ${remainder}m`;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function EmployeeTimesheetPage() {
  const [data, setData] = useState<TimesheetPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [adjustmentDate, setAdjustmentDate] = useState('');
  const [adjustmentMinutes, setAdjustmentMinutes] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const canClockOut = useMemo(() => Boolean(data?.current_clock.clocked_in), [data?.current_clock.clocked_in]);

  const load = async () => {
    setLoading(true);
    setError('');

    const meResponse = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!meResponse.ok) {
      window.location.href = '/login';
      return;
    }

    const meData = await meResponse.json();
    if (!meData?.user || (meData.user.role !== 'employee' && meData.user.role !== 'admin')) {
      window.location.href = '/account';
      return;
    }

    const response = await fetch('/api/employee/timesheet', { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body?.error || 'Unable to load timesheet');
      setLoading(false);
      return;
    }

    setData(body as TimesheetPayload);
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const runClockAction = async (action: 'clock_in' | 'clock_out') => {
    setWorking(action);
    setError('');
    setMessage('');

    const response = await fetch('/api/employee/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(body?.error || `Unable to ${action.replace('_', ' ')}`);
      setWorking('');
      return;
    }

    setMessage(action === 'clock_in' ? 'Clocked in successfully.' : 'Clocked out and logged to timesheet.');
    setWorking('');
    await load();
  };

  const submitAdjustment = async () => {
    setError('');
    setMessage('');

    const minutesDelta = Number(adjustmentMinutes);
    const response = await fetch('/api/employee/timesheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_date: adjustmentDate,
        minutes_delta: minutesDelta,
        reason: adjustmentReason,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body?.error || 'Unable to submit adjustment request');
      return;
    }

    setData(body as TimesheetPayload);
    setAdjustmentDate('');
    setAdjustmentMinutes('');
    setAdjustmentReason('');
    setMessage('Adjustment request submitted for review.');
  };

  if (loading) {
    return <main className="p-8">Loading timesheet...</main>;
  }

  if (!data) {
    return <main className="p-8">No timesheet data found.</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Timesheet & Pay</h1>
            <p className="text-sm text-gray-600">Bi-weekly timesheet, adjustment requests, and paycheck estimate.</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/employee/dashboard" className="text-gray-700 hover:text-gray-900">Bookings</Link>
            <Link href="/employee/calendar" className="text-gray-700 hover:text-gray-900">Calendar</Link>
            <Link href="/employee/forms" className="text-gray-700 hover:text-gray-900">Forms</Link>
            <Link href="/employee/training" className="text-gray-700 hover:text-gray-900">Training</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700">{error}</div>}
        {message && <div className="bg-green-50 border border-green-200 rounded p-3 text-green-700">{message}</div>}

        <section className="bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Pay Period</p>
            <p className="font-semibold text-gray-900">{data.pay_period.label}</p>
            <p className="text-xs text-gray-500">{data.pay_period.cadence}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Payable Hours</p>
            <p className="text-2xl font-bold text-gray-900">{data.summary.payable_hours.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Estimated Gross Pay</p>
            <p className="text-2xl font-bold text-emerald-700">${data.summary.estimated_gross_pay.toFixed(2)}</p>
            <p className="text-xs text-gray-500">{data.summary.estimate_detail}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Pay Setup</p>
            <p className="font-semibold text-gray-900">{data.employee.pay_type || 'hourly'} @ ${data.employee.pay_rate.toFixed(2)}</p>
            <p className="text-xs text-gray-500">Route role: {data.employee.route_role || 'Not set'}</p>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Clock</h2>
          <p className="text-sm text-gray-600">
            Current status: {data.current_clock.clocked_in ? 'Clocked In' : 'Clocked Out'}
            {data.current_clock.clock_in_at && ` (last clock-in ${formatDateTime(data.current_clock.clock_in_at)})`}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => void runClockAction('clock_in')}
              disabled={working === 'clock_in' || canClockOut}
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              {working === 'clock_in' ? 'Clocking In...' : 'Clock In'}
            </button>
            <button
              onClick={() => void runClockAction('clock_out')}
              disabled={working === 'clock_out' || !canClockOut}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {working === 'clock_out' ? 'Clocking Out...' : 'Clock Out'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Time Adjustment Request</h2>
          <p className="text-sm text-gray-600">Submit corrections (positive or negative minutes). Admin can review and approve.</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="date"
              value={adjustmentDate}
              onChange={(event) => setAdjustmentDate(event.target.value)}
              className="px-3 py-2 border rounded"
            />
            <input
              type="number"
              value={adjustmentMinutes}
              onChange={(event) => setAdjustmentMinutes(event.target.value)}
              placeholder="Minutes delta (+/-)"
              className="px-3 py-2 border rounded"
            />
            <input
              type="text"
              value={adjustmentReason}
              onChange={(event) => setAdjustmentReason(event.target.value)}
              placeholder="Reason"
              className="px-3 py-2 border rounded"
            />
            <button onClick={() => void submitAdjustment()} className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-black">
              Submit Request
            </button>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="p-6 border-b">
            <h2 className="text-lg font-bold text-gray-900">Timesheet Entries</h2>
          </div>
          <table className="min-w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs">Date</th>
                <th className="px-3 py-2 text-left text-xs">Clock In</th>
                <th className="px-3 py-2 text-left text-xs">Clock Out</th>
                <th className="px-3 py-2 text-left text-xs">Worked</th>
                <th className="px-3 py-2 text-left text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.entries.length === 0 ? (
                <tr><td className="px-3 py-3 text-sm text-gray-600" colSpan={5}>No entries in this pay period.</td></tr>
              ) : data.entries.map((entry) => (
                <tr key={entry.entry_id}>
                  <td className="px-3 py-2 text-sm">{entry.work_date_label}</td>
                  <td className="px-3 py-2 text-sm">{formatDateTime(entry.clock_in_at)}</td>
                  <td className="px-3 py-2 text-sm">{formatDateTime(entry.clock_out_at)}</td>
                  <td className="px-3 py-2 text-sm">{formatMinutes(entry.minutes_worked)}</td>
                  <td className="px-3 py-2 text-sm">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="p-6 border-b">
            <h2 className="text-lg font-bold text-gray-900">Adjustment Requests</h2>
          </div>
          <table className="min-w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs">Date</th>
                <th className="px-3 py-2 text-left text-xs">Minutes</th>
                <th className="px-3 py-2 text-left text-xs">Reason</th>
                <th className="px-3 py-2 text-left text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.adjustment_requests.length === 0 ? (
                <tr><td className="px-3 py-3 text-sm text-gray-600" colSpan={4}>No adjustment requests in this pay period.</td></tr>
              ) : data.adjustment_requests.map((request) => (
                <tr key={request.request_id}>
                  <td className="px-3 py-2 text-sm">{request.target_date_label}</td>
                  <td className={`px-3 py-2 text-sm ${request.minutes_delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {request.minutes_delta >= 0 ? '+' : ''}{request.minutes_delta}
                  </td>
                  <td className="px-3 py-2 text-sm">{request.reason}</td>
                  <td className="px-3 py-2 text-sm">{request.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

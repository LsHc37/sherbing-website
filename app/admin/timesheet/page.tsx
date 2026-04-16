'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type AdjustmentRequest = {
  request_id: string;
  employee_email: string;
  employee_name: string;
  target_date: string;
  minutes_delta: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_by: string;
  reviewed_at: string;
  review_notes: string;
};

export default function AdminTimesheetPage() {
  const [requests, setRequests] = useState<AdjustmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRequestId, setSavingRequestId] = useState('');
  const [reviewNotesDrafts, setReviewNotesDrafts] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [message, setMessage] = useState('');

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((requestItem) => requestItem.status === statusFilter);
  }, [requests, statusFilter]);

  const load = useCallback(async () => {
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

    const statusQuery = statusFilter === 'all' ? '' : `?status=${encodeURIComponent(statusFilter)}`;
    const response = await fetch(`/api/admin/timesheet/adjustments${statusQuery}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ([]));
    if (!response.ok) {
      setMessage((body as { error?: string })?.error || 'Unable to load adjustment requests');
      setLoading(false);
      return;
    }

    const loaded = Array.isArray(body) ? body as AdjustmentRequest[] : [];
    setRequests(loaded);
    setReviewNotesDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const requestItem of loaded) {
        next[requestItem.request_id] = prev[requestItem.request_id] ?? requestItem.review_notes ?? '';
      }
      return next;
    });
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const reviewRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    setSavingRequestId(requestId);
    setMessage('');

    const response = await fetch('/api/admin/timesheet/adjustments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: requestId,
        status,
        review_notes: reviewNotesDrafts[requestId] || '',
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body?.error || 'Failed to update adjustment request');
      setSavingRequestId('');
      return;
    }

    setMessage(`Request ${requestId} marked as ${status}.`);
    setSavingRequestId('');
    await load();
  };

  if (loading) {
    return <main className="p-8">Loading admin timesheet reviews...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Timesheet Adjustment Reviews</h1>
            <p className="text-sm text-gray-600">Approve or reject employee time correction requests for bi-weekly payroll.</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin/bookings" className="text-gray-700 hover:text-gray-900">Bookings</Link>
            <Link href="/admin/routes" className="text-gray-700 hover:text-gray-900">Routes</Link>
            <Link href="/admin/users" className="text-gray-700 hover:text-gray-900">Users</Link>
            <Link href="/employee/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {message && <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded">{message}</div>}

        <section className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor="statusFilter" className="text-sm text-gray-600">Status</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="px-3 py-2 border rounded"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>
          <button onClick={() => void load()} className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-black">Refresh</button>
        </section>

        <section className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs">Employee</th>
                <th className="px-3 py-2 text-left text-xs">Date</th>
                <th className="px-3 py-2 text-left text-xs">Minutes</th>
                <th className="px-3 py-2 text-left text-xs">Reason</th>
                <th className="px-3 py-2 text-left text-xs">Status</th>
                <th className="px-3 py-2 text-left text-xs">Review Notes</th>
                <th className="px-3 py-2 text-left text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRequests.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-sm text-gray-600" colSpan={7}>No adjustment requests for this filter.</td>
                </tr>
              )}
              {filteredRequests.map((requestItem) => {
                const isPending = requestItem.status === 'pending';
                return (
                  <tr key={requestItem.request_id}>
                    <td className="px-3 py-2 text-sm">
                      <p className="font-semibold text-gray-900">{requestItem.employee_name}</p>
                      <p className="text-gray-600">{requestItem.employee_email}</p>
                    </td>
                    <td className="px-3 py-2 text-sm">{requestItem.target_date}</td>
                    <td className={`px-3 py-2 text-sm ${requestItem.minutes_delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {requestItem.minutes_delta >= 0 ? '+' : ''}{requestItem.minutes_delta}
                    </td>
                    <td className="px-3 py-2 text-sm max-w-sm whitespace-pre-wrap">{requestItem.reason}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        requestItem.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : requestItem.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}>
                        {requestItem.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <textarea
                        value={reviewNotesDrafts[requestItem.request_id] || ''}
                        onChange={(event) => setReviewNotesDrafts((prev) => ({
                          ...prev,
                          [requestItem.request_id]: event.target.value,
                        }))}
                        rows={2}
                        className="w-72 px-2 py-1 border rounded"
                        placeholder="Optional review note"
                        disabled={!isPending}
                      />
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => void reviewRequest(requestItem.request_id, 'approved')}
                          disabled={!isPending || savingRequestId === requestItem.request_id}
                          className="px-2 py-1 bg-emerald-600 text-white rounded disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => void reviewRequest(requestItem.request_id, 'rejected')}
                          disabled={!isPending || savingRequestId === requestItem.request_id}
                          className="px-2 py-1 bg-red-600 text-white rounded disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
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

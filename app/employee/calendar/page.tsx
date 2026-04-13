'use client';

import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { useEffect, useMemo, useState } from 'react';

type User = {
  email: string;
  full_name: string;
  role: 'employee' | 'admin' | 'customer';
};

type AvailabilityEntry = {
  date: string;
  start: string;
  end: string;
  type: 'open' | 'blocked';
};

export default function EmployeeCalendarPage() {
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [newType, setNewType] = useState<'open' | 'blocked'>('blocked');

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

      const availabilityRes = await fetch('/api/employee/availability');
      const body = await availabilityRes.json().catch(() => ({}));
      if (!availabilityRes.ok) {
        throw new Error(body?.error || 'Failed to load calendar settings');
      }

      const list = Array.isArray(body?.entries) ? (body.entries as AvailabilityEntry[]) : [];
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  }, [entries]);

  const addEntry = () => {
    setError('');
    setMessage('');

    if (!newDate || !newStart || !newEnd) {
      setError('Date, start time, and end time are required.');
      return;
    }

    if (newStart >= newEnd) {
      setError('Start time must be before end time.');
      return;
    }

    const next = [...entries, { date: newDate, start: newStart, end: newEnd, type: newType }];
    setEntries(next);
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const saveEntries = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/employee/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to save calendar settings');
      }

      setMessage('Calendar openings/blockouts saved successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save calendar settings');
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  if (loading) {
    return <main className="min-h-screen bg-gray-50 p-8">Loading employee calendar...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="icon" size="small" />
            <span className="text-sm text-gray-500">Employee Calendar</span>
          </div>
          <div className="flex items-center gap-4 text-sm sm:text-base">
            <Link href="/employee/dashboard" className="text-gray-700 hover:text-gray-900">Bookings</Link>
            <Link href="/employee/calendar" className="text-gray-700 hover:text-gray-900 font-semibold">Calendar</Link>
            <button onClick={logout} className="text-gray-700 hover:text-gray-900">Logout</button>
          </div>
        </nav>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900">Work Calendar Settings</h1>
          <p className="text-sm text-gray-600 mt-2">
            Add openings and blockouts for times you can or cannot work. Customer booking only sees Open/Booked, never personal details.
          </p>
          <p className="text-sm text-gray-500 mt-1">Signed in as {user?.full_name || user?.email}</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>}
        {message && <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">{message}</div>}

        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Add Calendar Entry</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="time"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="time"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value === 'blocked' ? 'blocked' : 'open')}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="blocked">Blocked (cannot work)</option>
              <option value="open">Open (can work)</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={addEntry} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
              Add Entry
            </button>
            <button
              onClick={() => void saveEntries()}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Calendar'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-lg font-bold text-gray-900">Current Entries</h2>
          </div>

          {sortedEntries.length === 0 ? (
            <div className="p-6 text-gray-600">No entries yet. Add your first opening or blockout above.</div>
          ) : (
            <div className="divide-y">
              {sortedEntries.map((entry, index) => (
                <div key={`${entry.date}-${entry.start}-${entry.end}-${entry.type}-${index}`} className="p-4 flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium text-gray-900">{entry.date}</span> {entry.start}-{entry.end} {' '}
                    <span className={entry.type === 'blocked' ? 'text-red-700 font-medium' : 'text-green-700 font-medium'}>
                      {entry.type === 'blocked' ? 'Blocked' : 'Open'}
                    </span>
                  </div>
                  <button
                    onClick={() => removeEntry(index)}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

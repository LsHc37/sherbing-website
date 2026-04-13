'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type User = {
  created_at: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'customer' | 'employee' | 'admin';
  active: string;
  available_dates?: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [availabilityDrafts, setAvailabilityDrafts] = useState<Record<string, string[]>>({});
  const [availabilityInputs, setAvailabilityInputs] = useState<Record<string, string>>({});
  const [inviteData, setInviteData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'employee',
  });

  const parseAvailabilityDates = (value?: string) => {
    if (!value) return [] as string[];
    return Array.from(new Set(value.split(',').map((v) => v.trim()).filter(Boolean))).sort();
  };

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    const me = await fetch('/api/auth/me');
    if (!me.ok) {
      window.location.href = '/login';
      return;
    }

    const meData = await me.json();
    if (meData.user.role !== 'admin') {
      window.location.href = '/employee/dashboard';
      return;
    }

    const response = await fetch('/api/users');
    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error || 'Unable to load users');
      setLoading(false);
      return;
    }

    const loadedUsers = await response.json();
    setUsers(loadedUsers);

    const nextDrafts: Record<string, string[]> = {};
    for (const user of loadedUsers as User[]) {
      nextDrafts[user.email] = parseAvailabilityDates(user.available_dates);
    }
    setAvailabilityDrafts(nextDrafts);

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const updateUser = async (email: string, payload: { role?: User['role']; active?: string; available_dates?: string }) => {
    const response = await fetch(`/api/users/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error || 'User update failed');
      return;
    }

    setMessage(`Updated ${email}`);
    await load();
  };

  const setRole = async (email: string, role: User['role']) => {
    await updateUser(email, { role });
  };

  const setAvailability = async (email: string, available_dates: string) => {
    await updateUser(email, { available_dates });
  };

  const addAvailabilityDate = (email: string) => {
    const dateToAdd = (availabilityInputs[email] || '').trim();
    if (!dateToAdd) return;

    setAvailabilityDrafts((prev) => {
      const existing = prev[email] || [];
      if (existing.includes(dateToAdd)) {
        return prev;
      }

      return {
        ...prev,
        [email]: [...existing, dateToAdd].sort(),
      };
    });

    setAvailabilityInputs((prev) => ({
      ...prev,
      [email]: '',
    }));
  };

  const removeAvailabilityDate = (email: string, dateToRemove: string) => {
    setAvailabilityDrafts((prev) => ({
      ...prev,
      [email]: (prev[email] || []).filter((date) => date !== dateToRemove),
    }));
  };

  const saveAvailabilityDates = async (email: string) => {
    const dates = availabilityDrafts[email] || [];
    await setAvailability(email, dates.join(','));
  };

  const setActive = async (email: string, active: string) => {
    await updateUser(email, { active });
  };

  const inviteEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteData),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Invite failed');
      return;
    }

    setMessage(`Invited ${data.email} (${data.role}). Temporary password: ${data.temp_password}`);
    setInviteData({ full_name: '', email: '', phone: '', role: 'employee' });
    await load();
  };

  if (loading) return <main className="p-8">Loading users...</main>;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-green-600">Admin User Management</h1>
            <p className="text-sm text-gray-500">Invite staff and manage roles</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/booking" className="text-gray-700 hover:text-gray-900">Manage Bookings</Link>
            <Link href="/employee/dashboard" className="text-gray-700 hover:text-gray-900">Back to Dashboard</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {message && <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded">{message}</div>}

        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold mb-4">Invite Employee or Admin</h2>
          <form onSubmit={inviteEmployee} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={inviteData.full_name}
              onChange={(e) => setInviteData((p) => ({ ...p, full_name: e.target.value }))}
              placeholder="Full name"
              className="px-3 py-2 border rounded"
            />
            <input
              value={inviteData.email}
              onChange={(e) => setInviteData((p) => ({ ...p, email: e.target.value }))}
              placeholder="Email"
              className="px-3 py-2 border rounded"
            />
            <input
              value={inviteData.phone}
              onChange={(e) => setInviteData((p) => ({ ...p, phone: e.target.value }))}
              placeholder="Phone"
              className="px-3 py-2 border rounded"
            />
            <div className="flex gap-2">
              <select
                value={inviteData.role}
                onChange={(e) => setInviteData((p) => ({ ...p, role: e.target.value }))}
                className="px-3 py-2 border rounded w-full"
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
              <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Invite</button>
            </div>
          </form>
          <p className="text-xs text-gray-500 mt-2">This creates the account and returns a temporary password in the message above.</p>
        </section>

        <section className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm">Name</th>
                <th className="px-4 py-3 text-left text-sm">Email</th>
                <th className="px-4 py-3 text-left text-sm">Phone</th>
                <th className="px-4 py-3 text-left text-sm">Role</th>
                <th className="px-4 py-3 text-left text-sm">Active</th>
                <th className="px-4 py-3 text-left text-sm">Available Dates</th>
                <th className="px-4 py-3 text-left text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.email}>
                  <td className="px-4 py-3 text-sm">{user.full_name}</td>
                  <td className="px-4 py-3 text-sm">{user.email}</td>
                  <td className="px-4 py-3 text-sm">{user.phone || '-'}</td>
                  <td className="px-4 py-3 text-sm font-semibold">{user.role}</td>
                  <td className="px-4 py-3 text-sm">
                    <select
                      value={String(user.active || 'true')}
                      onChange={(e) => void setActive(user.email, e.target.value)}
                      className="px-2 py-1 border rounded"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="min-w-72 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={availabilityInputs[user.email] || ''}
                          onChange={(e) => setAvailabilityInputs((prev) => ({
                            ...prev,
                            [user.email]: e.target.value,
                          }))}
                          className="px-2 py-1 border rounded"
                        />
                        <button
                          type="button"
                          onClick={() => addAvailabilityDate(user.email)}
                          className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveAvailabilityDates(user.email)}
                          className="px-2 py-1 bg-emerald-600 text-white rounded"
                        >
                          Save
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(availabilityDrafts[user.email] || []).length === 0 && (
                          <span className="text-xs text-gray-500">No dates selected</span>
                        )}
                        {(availabilityDrafts[user.email] || []).map((date) => (
                          <button
                            key={date}
                            type="button"
                            onClick={() => removeAvailabilityDate(user.email, date)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                            title="Remove date"
                          >
                            {date} ×
                          </button>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setRole(user.email, 'customer')} className="px-2 py-1 bg-gray-100 rounded">Customer</button>
                      <button onClick={() => setRole(user.email, 'employee')} className="px-2 py-1 bg-blue-100 rounded">Employee</button>
                      <button onClick={() => setRole(user.email, 'admin')} className="px-2 py-1 bg-amber-100 rounded">Admin</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

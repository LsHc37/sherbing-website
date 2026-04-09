'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '@/app/components/Logo';

type User = {
  email: string;
  full_name: string;
  role: string;
  phone?: string;
};

type Booking = {
  id: string;
  service_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  estimated_price: number;
  status: string;
  customer_update_request?: string;
  created_at: string;
};

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [reviewData, setReviewData] = useState({ title: '', comment: '', rating: 5 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        window.location.href = '/login';
        return;
      }

      const me = await meRes.json();
      setUser(me.user);

      const bookingsRes = await fetch('/api/my-bookings');
      const bookingData = bookingsRes.ok ? await bookingsRes.json() : [];
      setBookings(bookingData);
    } finally {
      setLoading(false);
    }
  }, []);

  const filterBookings = (bookingList: Booking[], search: string, status: string) => {
    let filtered = bookingList;

    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(b =>
        b.address.toLowerCase().includes(lowerSearch) ||
        b.city.toLowerCase().includes(lowerSearch) ||
        b.service_id.toLowerCase().includes(lowerSearch)
      );
    }

    if (status !== 'all') {
      filtered = filtered.filter(b => b.status === status);
    }

    setFilteredBookings(filtered);
  };

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    filterBookings(bookings, searchTerm, statusFilter);
  }, [bookings, searchTerm, statusFilter]);

  const requestChange = async (bookingId: string, requestType: string) => {
    setMessage('');
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_update_request: requestType }),
    });

    if (response.ok) {
      setMessage('Request sent to team.');
      await load();
    } else {
      const data = await response.json();
      setMessage(data.error || 'Could not send request');
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingBooking) return;

    if (!reviewData.title.trim() || !reviewData.comment.trim()) {
      setMessage('Please fill in all review fields');
      return;
    }

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: reviewingBooking.id,
          customer_id: user?.email,
          service_id: reviewingBooking.service_id,
          rating: reviewData.rating,
          title: reviewData.title,
          comment: reviewData.comment,
        }),
      });

      if (response.ok) {
        setMessage('Review submitted successfully!');
        setReviewingBooking(null);
        setReviewData({ title: '', comment: '', rating: 5 });
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to submit review');
      }
    } catch {
      setMessage('Error submitting review');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(passwordData),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Password change failed');
      return;
    }

    setMessage('Password updated successfully.');
    setPasswordData({ current_password: '', new_password: '' });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <main className="p-8">Loading account...</main>;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Logo variant="icon" size="small" />
          <div className="space-x-4 flex text-sm sm:text-base">
            <Link href="/booking" className="text-gray-600 hover:text-gray-900">Book Service</Link>
            <button onClick={logout} className="text-gray-600 hover:text-gray-900">Logout</button>
          </div>
        </nav>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Account Info */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">My Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="text-lg font-semibold text-gray-900">{user?.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-lg font-semibold text-gray-900">{user?.email}</p>
            </div>
          </div>
          {user?.phone && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">Phone</p>
              <p className="text-lg font-semibold text-gray-900">{user.phone}</p>
            </div>
          )}
          {message && <p className="mt-4 text-green-700 font-medium">{message}</p>}
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Security</h3>
          <form onSubmit={changePassword} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="password"
                placeholder="Current password"
                value={passwordData.current_password}
                onChange={(e) => setPasswordData((p) => ({ ...p, current_password: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <input
                type="password"
                placeholder="New password (8+ chars)"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData((p) => ({ ...p, new_password: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium">
                Change Password
              </button>
            </div>
          </form>
        </div>

        {/* Bookings Section */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b">
            <h3 className="text-xl font-bold mb-4">My Bookings</h3>
            
            {/* Search and Filter */}
            <div className="space-y-3 sm:flex sm:gap-3 sm:space-y-0">
              <input
                type="text"
                placeholder="Search by address, city, or service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="p-6 text-center text-gray-600">
              {bookings.length === 0 ? 'No bookings yet.' : 'No bookings match your search.'}
            </div>
          ) : (
            <div className="divide-y">
              {filteredBookings.map((booking) => (
                <div key={booking.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-semibold text-gray-900 text-lg">{booking.service_id.replace(/_/g, ' ').toUpperCase()}</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(booking.status)}`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-gray-600">{booking.address}, {booking.city}, {booking.state} {booking.zip_code}</p>
                      <p className="text-gray-500 text-sm mt-2">Booked: {new Date(booking.created_at).toLocaleDateString()}</p>
                      {booking.customer_update_request && (
                        <p className="text-blue-700 text-sm mt-2 font-medium">Pending Request: {booking.customer_update_request.replace(/_/g, ' ')}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">${booking.estimated_price.toFixed(2)}</p>
                    </div>
                  </div>

                  {booking.status === 'completed' ? (
                    <button
                      onClick={() => setReviewingBooking(booking)}
                      className="mt-4 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-sm font-medium"
                    >
                      Write Review
                    </button>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {booking.status !== 'cancelled' && (
                        <>
                          <button
                            onClick={() => requestChange(booking.id, 'reschedule_request')}
                            className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-sm font-medium"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => requestChange(booking.id, 'cancel_request')}
                            className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => requestChange(booking.id, 'scope_change_request')}
                            className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 text-sm font-medium"
                          >
                            Modify Services
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {reviewingBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h4 className="text-lg font-bold mb-4">Write a Review</h4>
            <p className="text-sm text-gray-600 mb-4">
              Service: <span className="font-medium">{reviewingBooking.service_id.replace(/_/g, ' ').toUpperCase()}</span>
            </p>

            <form onSubmit={submitReview} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Rating (1-5 stars)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewData(prev => ({ ...prev, rating: star }))}
                      className={`text-2xl ${reviewData.rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Review Title</label>
                <input
                  type="text"
                  placeholder="Great service, highly recommend..."
                  value={reviewData.title}
                  onChange={(e) => setReviewData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Your Review</label>
                <textarea
                  placeholder="Share your experience with this service..."
                  rows={4}
                  value={reviewData.comment}
                  onChange={(e) => setReviewData(prev => ({ ...prev, comment: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Submit Review
                </button>
                <button
                  type="button"
                  onClick={() => setReviewingBooking(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

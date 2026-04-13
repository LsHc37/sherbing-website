import { NextRequest, NextResponse } from 'next/server';
import type { Review } from '@/lib/types';
import { getSessionFromRequest } from '@/lib/auth/session';
import { findBookingById } from '@/lib/services/googleSheetsService';
import { checkRateLimit, getRequestIp } from '@/lib/services/rateLimitService';

// In-memory storage for reviews (replace with database in production)
const reviews: Review[] = [];

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = getRequestIp(request);
    const ipLimit = checkRateLimit(`reviews:ip:${ip}`, 20, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many review submissions. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();

    const { booking_id, service_id, rating, title, comment } = body;

    // Validate required fields
    if (!booking_id || !service_id) {
      return NextResponse.json(
        { error: 'booking_id and service_id are required' },
        { status: 400 }
      );
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Review title is required' },
        { status: 400 }
      );
    }

    if (!comment || comment.trim().length === 0) {
      return NextResponse.json(
        { error: 'Review comment is required' },
        { status: 400 }
      );
    }

    const booking = await findBookingById(String(booking_id));
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.customer_email.toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (String(booking.status || '').toLowerCase() !== 'completed') {
      return NextResponse.json({ error: 'Reviews are only allowed for completed bookings' }, { status: 400 });
    }

    const existingReview = reviews.find((review) => review.booking_id === booking_id);
    if (existingReview) {
      return NextResponse.json({ error: 'A review for this booking already exists' }, { status: 409 });
    }

    const review: Review = {
      id: `review-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      booking_id,
      customer_id: session.email,
      service_id,
      rating,
      title,
      comment,
      verified_purchase: true,
      created_at: new Date().toISOString(),
    };

    reviews.push(review);

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Review API error:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service_id');
    const bookingId = searchParams.get('booking_id');

    let filteredReviews = reviews;

    if (serviceId) {
      filteredReviews = filteredReviews.filter(r => r.service_id === serviceId);
    }

    if (bookingId) {
      filteredReviews = filteredReviews.filter(r => r.booking_id === bookingId);
    }

    return NextResponse.json(filteredReviews);
  } catch (error) {
    console.error('Review fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

import { addBookingToSheet } from '@/lib/services/googleSheetsService';
import { clearAllBookingsInSheet } from '@/lib/services/googleSheetsService';
import { sendBookingConfirmation } from '@/lib/services/bookingService';
import type { BookingForm } from '@/lib/types';
import { enforceMinimumCustomerPrice } from '@/lib/services/payoutService';
import { getSessionFromRequest } from '@/lib/auth/session';
import { isBookingSlotAvailable } from '@/lib/services/googleSheetsService';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = getSessionFromRequest(request);
    const customerEmail = body.customer_email || session?.email;

    if (!Array.isArray(body.service_ids) || body.service_ids.length === 0) {
      return NextResponse.json({ error: 'At least one service is required' }, { status: 400 });
    }
    if (!body.customer_name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }
    if (!customerEmail && !body.customer_phone) {
      return NextResponse.json({ error: 'Provide at least one contact method: email or phone' }, { status: 400 });
    }
    if (!body.address || !body.city || !body.state || !body.zip_code) {
      return NextResponse.json({ error: 'Full service address is required' }, { status: 400 });
    }

    const scheduledDate = String(body.scheduled_date || '').trim();
    const scheduledTime = String(body.scheduled_time || '').trim();
    if (scheduledDate && scheduledTime) {
      const isAvailable = await isBookingSlotAvailable(scheduledDate, scheduledTime);
      if (!isAvailable) {
        return NextResponse.json({ error: 'That time slot was just booked. Please choose another time.' }, { status: 409 });
      }
    }

    const bookingData: BookingForm & { booking_id: string; estimated_price: number } = {
      ...body,
      customer_email: customerEmail,
      booking_id: `SHERBING-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      estimated_price: enforceMinimumCustomerPrice(Number(body.estimated_price || 0)),
    };

    // Attempt to add to Google Sheets, but never block booking submission on sheet errors.
    const sheetResult = await addBookingToSheet(bookingData);

    // Send confirmation email if customer provided email
    if (bookingData.customer_email) {
      const serviceNames = body.service_ids?.map((id: string) => id.replace(/_/g, ' ').toUpperCase()).join(', ') || 'Services';
      await sendBookingConfirmation(
        bookingData.customer_email,
        body.customer_name,
        bookingData.booking_id,
        serviceNames,
        `${body.address}, ${body.city}, ${body.state} ${body.zip_code}`,
        bookingData.estimated_price,
        body.scheduled_date,
        body.scheduled_time
      );
    }

    return NextResponse.json(
      {
        success: true,
        booking_id: bookingData.booking_id,
        message: 'Booking submitted successfully',
        sheet_warning: sheetResult.success ? undefined : sheetResult.error,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Booking API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await clearAllBookingsInSheet();
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to clear bookings' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'All bookings cleared' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to clear bookings', details: (error as Error).message },
      { status: 500 }
    );
  }
}

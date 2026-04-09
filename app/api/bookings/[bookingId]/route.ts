import { getSessionFromRequest } from '@/lib/auth/session';
import { findBookingById, updateBookingInSheet } from '@/lib/services/googleSheetsService';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId } = await context.params;
    const body = await request.json();

    if (session.role === 'customer') {
      const booking = await findBookingById(bookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      if (booking.customer_email.toLowerCase() !== session.email.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const updateRequest = String(body.customer_update_request || '').trim();
      const notes = String(body.notes || '').trim();
      if (!updateRequest) {
        return NextResponse.json({ error: 'Update request is required' }, { status: 400 });
      }

      const result = await updateBookingInSheet(bookingId, {
        customer_update_request: updateRequest,
        notes,
        status: 'change_requested',
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Update failed' }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    if (session.role === 'employee' || session.role === 'admin') {
      const status = body.status ? String(body.status) : undefined;
      const notes = body.notes ? String(body.notes) : undefined;

      const result = await updateBookingInSheet(bookingId, {
        status,
        notes,
        assigned_employee: session.email,
        customer_update_request: body.customer_update_request ? String(body.customer_update_request) : undefined,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Update failed' }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update booking', details: (error as Error).message }, { status: 500 });
  }
}

import { getSessionFromRequest } from '@/lib/auth/session';
import { findUserByEmail } from '@/lib/services/googleSheetsService';
import { deleteBookingFromSheet, findBookingById, updateBookingInSheet } from '@/lib/services/googleSheetsService';
import { isBookingSlotAvailable } from '@/lib/services/googleSheetsService';
import { NextRequest, NextResponse } from 'next/server';

function normalizeBookingIdParam(rawBookingId: string) {
  try {
    return decodeURIComponent(String(rawBookingId || '').trim());
  } catch {
    return String(rawBookingId || '').trim();
  }
}

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
    const normalizedBookingId = normalizeBookingIdParam(bookingId);
    const body = await request.json();

    if (session.role === 'customer') {
      const booking = await findBookingById(normalizedBookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found', booking_id: normalizedBookingId }, { status: 404 });
      }
      if (booking.customer_email.toLowerCase() !== session.email.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const updateRequest = String(body.customer_update_request || '').trim();
      const notes = String(body.notes || '').trim();
      if (!updateRequest) {
        return NextResponse.json({ error: 'Update request is required' }, { status: 400 });
      }

      const result = await updateBookingInSheet(normalizedBookingId, {
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
      const booking = await findBookingById(normalizedBookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found', booking_id: normalizedBookingId }, { status: 404 });
      }

      const status = body.status ? String(body.status) : undefined;
      const notes = body.notes ? String(body.notes) : undefined;
      const assignedEmployee = body.assigned_employee ? String(body.assigned_employee).trim().toLowerCase() : undefined;
      const scheduledDate = body.scheduled_date ? String(body.scheduled_date).trim() : undefined;
      const scheduledTime = body.scheduled_time ? String(body.scheduled_time).trim() : undefined;
      const scheduledDurationMinutes = body.scheduled_duration_minutes !== undefined
        ? Number(body.scheduled_duration_minutes)
        : undefined;
      const normalizedScheduledDurationMinutes = Number.isFinite(scheduledDurationMinutes)
        ? Math.max(30, Math.min(480, Math.round(Number(scheduledDurationMinutes) / 15) * 15))
        : undefined;
      const customerName = body.customer_name !== undefined ? String(body.customer_name).trim() : undefined;
      const customerEmail = body.customer_email !== undefined ? String(body.customer_email).trim().toLowerCase() : undefined;
      const customerPhone = body.customer_phone !== undefined ? String(body.customer_phone).trim() : undefined;
      const serviceId = body.service_id !== undefined ? String(body.service_id).trim() : undefined;
      const serviceDetails = body.service_details !== undefined ? String(body.service_details).trim() : undefined;
      const propertySqft = body.property_sqft !== undefined ? String(body.property_sqft).trim() : undefined;
      const yardSqft = body.yard_sqft !== undefined ? String(body.yard_sqft).trim() : undefined;
      const packageId = body.package_id !== undefined ? String(body.package_id).trim() : undefined;
      const address = body.address !== undefined ? String(body.address).trim() : undefined;
      const city = body.city !== undefined ? String(body.city).trim() : undefined;
      const state = body.state !== undefined ? String(body.state).trim() : undefined;
      const zipCode = body.zip_code !== undefined ? String(body.zip_code).trim() : undefined;

      if (customerEmail !== undefined && customerEmail && !/.+@.+\..+/.test(customerEmail)) {
        return NextResponse.json({ error: 'Invalid customer email' }, { status: 400 });
      }

      if (session.role === 'employee') {
        const user = await findUserByEmail(session.email);
        const shadowRequired = String(user?.shadow_required || 'true').toLowerCase() !== 'false';
        const shadowCompleted = Boolean(String(user?.shadow_completed_at || '').trim());
        if (shadowRequired && !shadowCompleted) {
          return NextResponse.json({ error: 'Shadow training must be completed before managing bookings independently.' }, { status: 403 });
        }

        const currentAssignee = String(booking.assigned_employee || '').trim().toLowerCase();
        const isAssignedToEmployee = currentAssignee === session.email.toLowerCase();
        const isUnassigned = !currentAssignee;
        const isClaimAttempt = assignedEmployee === session.email.toLowerCase() || status === 'confirmed';

        if (!isAssignedToEmployee && !(isUnassigned && isClaimAttempt)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      const effectiveScheduledDate = scheduledDate || booking.scheduled_date;
      const effectiveScheduledTime = scheduledTime || booking.scheduled_time;
      const effectiveDurationMinutes = Number.isFinite(scheduledDurationMinutes)
        ? Number(normalizedScheduledDurationMinutes)
        : Number(booking.scheduled_duration_minutes || 60);

      if (effectiveScheduledDate && effectiveScheduledTime) {
        const isAvailable = await isBookingSlotAvailable(
          effectiveScheduledDate,
          effectiveScheduledTime,
          normalizedBookingId,
          effectiveDurationMinutes
        );
        if (!isAvailable) {
          return NextResponse.json({ error: 'Selected date/time is already booked' }, { status: 409 });
        }
      }

      const shouldAutoAssignToEmployee = session.role === 'employee' && status === 'confirmed';
      const resolvedAssignedEmployee = session.role === 'admin'
        ? assignedEmployee
        : shouldAutoAssignToEmployee
          ? session.email
          : booking.assigned_employee || undefined;

      const result = await updateBookingInSheet(normalizedBookingId, {
        status,
        notes,
        assigned_employee: resolvedAssignedEmployee,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        scheduled_duration_minutes: Number.isFinite(normalizedScheduledDurationMinutes) ? String(normalizedScheduledDurationMinutes) : undefined,
        customer_update_request: body.customer_update_request ? String(body.customer_update_request) : undefined,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        service: serviceId,
        service_details: serviceDetails,
        property_sqft: propertySqft,
        yard_sqft: yardSqft,
        package: packageId,
        address,
        city,
        state,
        zip_code: zipCode,
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'employee' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { bookingId } = await context.params;
    const normalizedBookingId = normalizeBookingIdParam(bookingId);
    const booking = await findBookingById(normalizedBookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found', booking_id: normalizedBookingId }, { status: 404 });
    }

    if (session.role === 'employee') {
      const user = await findUserByEmail(session.email);
      const shadowRequired = String(user?.shadow_required || 'true').toLowerCase() !== 'false';
      const shadowCompleted = Boolean(String(user?.shadow_completed_at || '').trim());
      if (shadowRequired && !shadowCompleted) {
        return NextResponse.json({ error: 'Shadow training must be completed before managing bookings independently.' }, { status: 403 });
      }

      const assignedEmployee = String(booking.assigned_employee || '').trim().toLowerCase();
      if (assignedEmployee !== session.email.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const result = await deleteBookingFromSheet(normalizedBookingId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete booking' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete booking', details: (error as Error).message }, { status: 500 });
  }
}

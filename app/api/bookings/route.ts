import { addBookingToSheet } from '@/lib/services/googleSheetsService';
import { clearAllBookingsInSheet } from '@/lib/services/googleSheetsService';
import { findUserByReferralCode } from '@/lib/services/googleSheetsService';
import { sendBookingConfirmation } from '@/lib/services/bookingService';
import type { BookingForm } from '@/lib/types';
import { enforceMinimumCustomerPrice } from '@/lib/services/payoutService';
import { getSessionFromRequest } from '@/lib/auth/session';
import { isBookingSlotAvailable } from '@/lib/services/googleSheetsService';
import { isServiceAreaValid } from '@/lib/services/pricingService';
import { NextRequest, NextResponse } from 'next/server';

function yesNoLabel(value: unknown) {
  return String(value) === 'yes' ? 'Yes' : 'No';
}

function buildServiceDetails(body: Record<string, unknown>) {
  const serviceIds = Array.isArray(body.service_ids) ? body.service_ids.map((v) => String(v)) : [];
  const details: string[] = [];

  if (serviceIds.includes('lawn_mowing')) {
    details.push(`Lawn Frequency: ${String(body.lawn_mowing_frequency || 'weekly')}`);
    details.push(`Initial Overgrowth: ${yesNoLabel(body.lawn_initial_overgrowth)}`);
    details.push(`Bag Clippings: ${yesNoLabel(body.lawn_bag_clippings)}`);
    details.push(`Heavy Pet Waste: ${yesNoLabel(body.lawn_heavy_pet_waste)}`);
    details.push(`Access Blocked: ${yesNoLabel(body.lawn_access_blocked)}`);
  }

  if (serviceIds.includes('window_cleaning')) {
    details.push(`Window Count: ${String(body.window_count || 'N/A')}`);
    details.push(`Window Scope: ${String(body.window_scope || 'exterior')}`);
    details.push(`Screen/Track Count: ${String(body.window_screen_track_count || '0')}`);
  }

  if (serviceIds.includes('pressure_washing')) {
    details.push(`Pressure Washing Scope: ${String(body.pressure_washing_scope || 'both')}`);
  }

  if (serviceIds.includes('gutter_cleaning')) {
    details.push(`Gutter Story Count: ${String(body.gutter_story_count || '1')}`);
  }

  if (body.package_id) {
    details.push(`Package: ${String(body.package_id)}`);
  }

  return details.join(' | ');
}

function parseCommissionRate(rate: unknown) {
  const numericRate = Number(rate);
  if (!Number.isFinite(numericRate) || numericRate <= 0) return 0;
  return numericRate > 1 ? numericRate / 100 : numericRate;
}

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
    if (!isServiceAreaValid(String(body.zip_code || ''))) {
      return NextResponse.json(
        { error: 'We currently only service the Boise area. Please check your ZIP code.' },
        { status: 400 }
      );
    }

    const scheduledDate = String(body.scheduled_date || '').trim();
    const scheduledTime = String(body.scheduled_time || '').trim();
    const scheduledDurationMinutesRaw = Number(body.scheduled_duration_minutes || 60);
    const scheduledDurationMinutes = Number.isFinite(scheduledDurationMinutesRaw)
      ? Math.max(30, Math.min(480, Math.round(scheduledDurationMinutesRaw / 15) * 15))
      : 60;
    if (scheduledDate && scheduledTime) {
      const isAvailable = await isBookingSlotAvailable(scheduledDate, scheduledTime, undefined, scheduledDurationMinutes);
      if (!isAvailable) {
        return NextResponse.json({ error: 'That time slot was just booked. Please choose another time.' }, { status: 409 });
      }
    }

    const referralCode = String(body.sales_referral_code || body.referral_code || '').trim();
    const referredUser = referralCode ? await findUserByReferralCode(referralCode) : undefined;
    const referralCommissionRate = parseCommissionRate(referredUser?.sales_commission_rate || body.sales_commission_rate || 0);
    const referralCommissionAmount = referralCommissionRate > 0
      ? Math.round(enforceMinimumCustomerPrice(Number(body.estimated_price || 0)) * referralCommissionRate * 100) / 100
      : 0;

    const bookingData: BookingForm & { booking_id: string; estimated_price: number } = {
      ...body,
      customer_email: customerEmail,
      booking_id: `SHERBING-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
      estimated_price: enforceMinimumCustomerPrice(Number(body.estimated_price || 0)),
      service_details: buildServiceDetails(body as Record<string, unknown>),
      scheduled_duration_minutes: Number.isFinite(scheduledDurationMinutes) ? scheduledDurationMinutes : 60,
      sales_referral_code: referredUser?.sales_referral_code || referralCode,
      sales_referral_email: referredUser?.email || String(body.sales_referral_email || ''),
      sales_commission_rate: referralCommissionRate ? String(referralCommissionRate) : '',
      sales_commission_amount: referralCommissionAmount ? String(referralCommissionAmount) : '',
    };

    // Booking should only succeed if persistence succeeds.
    const sheetResult = await addBookingToSheet(bookingData);
    if (!sheetResult.success) {
      return NextResponse.json(
        { error: sheetResult.error || 'Unable to save booking right now. Please try again.' },
        { status: 503 }
      );
    }

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

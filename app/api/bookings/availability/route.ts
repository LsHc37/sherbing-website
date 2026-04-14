import { NextRequest, NextResponse } from 'next/server';
import { getBookingAvailabilityForDate } from '@/lib/services/googleSheetsService';

const FALLBACK_SLOT_TIMES = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
];

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date') || '';
    const durationMinutes = Number(request.nextUrl.searchParams.get('durationMinutes') || '60');
    if (!date) {
      return NextResponse.json({ error: 'date query parameter is required' }, { status: 400 });
    }

    const slots = await getBookingAvailabilityForDate(date, durationMinutes);
    const bookedCount = slots.filter((slot) => slot.status === 'booked').length;

    return NextResponse.json({
      date,
      durationMinutes,
      slots,
      openCount: slots.length - bookedCount,
      bookedCount,
    });
  } catch (error) {
    // Fail closed so customers never book a broken slot when availability cannot be computed.
    return NextResponse.json({
      date: request.nextUrl.searchParams.get('date') || '',
      slots: FALLBACK_SLOT_TIMES.map((time) => ({ time, status: 'booked' as const })),
      openCount: 0,
      bookedCount: FALLBACK_SLOT_TIMES.length,
      warning: 'Availability temporarily unavailable',
      details: (error as Error).message,
    });
  }
}

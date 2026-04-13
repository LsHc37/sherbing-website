import { NextRequest, NextResponse } from 'next/server';
import { getBookingAvailabilityForDate } from '@/lib/services/googleSheetsService';

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date') || '';
    if (!date) {
      return NextResponse.json({ error: 'date query parameter is required' }, { status: 400 });
    }

    const slots = await getBookingAvailabilityForDate(date);
    const bookedCount = slots.filter((slot) => slot.status === 'booked').length;

    return NextResponse.json({
      date,
      slots,
      openCount: slots.length - bookedCount,
      bookedCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load availability', details: (error as Error).message },
      { status: 500 }
    );
  }
}

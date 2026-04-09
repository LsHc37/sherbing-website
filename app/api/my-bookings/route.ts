import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { listBookingsByCustomerEmail } from '@/lib/services/googleSheetsService';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookings = await listBookingsByCustomerEmail(session.email);
    const mapped = bookings.map((booking) => {
      const [fallbackCity = '', fallbackStateZip = ''] = booking.city_state_zip.split(',').map((v) => v.trim());
      const [fallbackState = '', fallbackZip = ''] = fallbackStateZip.split(' ');
      const city = booking.city || fallbackCity;
      const state = booking.state || fallbackState;
      const zip = booking.zip_code || fallbackZip;
      return {
        id: booking.booking_id,
        service_id: booking.service,
        address: booking.address,
        city,
        state,
        zip_code: zip,
        scheduled_date: booking.scheduled_date || '',
        scheduled_time: booking.scheduled_time || '',
        estimated_price: Number(booking.estimated_price || 0),
        status: booking.status || 'pending',
        customer_update_request: booking.customer_update_request || '',
        notes: booking.notes || '',
        created_at: booking.timestamp,
      };
    });

    return NextResponse.json(mapped);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch bookings', details: (error as Error).message },
      { status: 500 }
    );
  }
}

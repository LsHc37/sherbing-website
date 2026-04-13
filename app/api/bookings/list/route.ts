import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { listBookingsFromSheet } from '@/lib/services/googleSheetsService';
import { calculatePayoutBreakdown } from '@/lib/services/payoutService';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || (session.role !== 'employee' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookings = await listBookingsFromSheet();
    const mapped = bookings.map((booking) => {
      const [fallbackCity = '', fallbackStateZip = ''] = booking.city_state_zip.split(',').map((v) => v.trim());
      const [fallbackState = '', fallbackZip = ''] = fallbackStateZip.split(' ');
      const city = booking.city || fallbackCity;
      const state = booking.state || fallbackState;
      const zip = booking.zip_code || fallbackZip;
      const estimatedPrice = Number(booking.estimated_price || 0);
      const payout = calculatePayoutBreakdown(estimatedPrice);
      return {
        id: booking.booking_id,
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        customer_phone: booking.customer_phone,
        service_id: booking.service,
        property_sqft: booking.property_sqft || '',
        yard_sqft: booking.yard_sqft || '',
        package_id: booking.package || '',
        address: booking.address,
        city,
        state,
        zip_code: zip,
        scheduled_date: booking.scheduled_date || '',
        scheduled_time: booking.scheduled_time || '',
        estimated_price: payout.customerPrice,
        customer_price: Number(booking.customer_price || payout.customerPrice),
        sherbing_fee: Number(booking.sherbing_fee || payout.sherbingFee),
        employee_payout: Number(booking.employee_payout || payout.employeePayout),
        status: booking.status || 'pending',
        assigned_employee: booking.assigned_employee || '',
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

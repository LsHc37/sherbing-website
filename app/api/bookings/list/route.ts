import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { listBookingsFromSheet } from '@/lib/services/googleSheetsService';
import { calculatePayoutBreakdown } from '@/lib/services/payoutService';

function parseCurrencyValue(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const normalized = raw.replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

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
      const estimatedPrice = parseCurrencyValue(booking.estimated_price);
      const customerPrice = parseCurrencyValue(booking.customer_price);
      const sherbingFee = parseCurrencyValue(booking.sherbing_fee);
      const employeePayout = parseCurrencyValue(booking.employee_payout);
      const payout = calculatePayoutBreakdown(estimatedPrice);
      return {
        id: booking.booking_id,
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        customer_phone: booking.customer_phone,
        service_id: booking.service,
        service_details: booking.service_details || '',
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
        customer_price: customerPrice || payout.customerPrice,
        sherbing_fee: sherbingFee || payout.sherbingFee,
        employee_payout: employeePayout || payout.employeePayout,
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

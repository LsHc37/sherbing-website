import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import {
  addTimesheetAdjustmentRequest,
  findUserByEmail,
  listBookingsFromSheet,
  listTimesheetAdjustmentRequestsByEmployee,
  listTimesheetEntriesByEmployee,
} from '@/lib/services/googleSheetsService';

const DAY_MS = 24 * 60 * 60 * 1000;
const BIWEEKLY_ANCHOR = new Date('2026-01-05T00:00:00');

function toDateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  const next = new Date(value.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBiweeklyPeriod(referenceDate: Date) {
  const anchor = toDateOnly(BIWEEKLY_ANCHOR);
  const target = toDateOnly(referenceDate);
  const diffDays = Math.floor((target.getTime() - anchor.getTime()) / DAY_MS);
  const periodIndex = Math.floor(diffDays / 14);
  const start = addDays(anchor, periodIndex * 14);
  const end = addDays(start, 13);
  return {
    start,
    end,
    startIso: toIsoDate(start),
    endIso: toIsoDate(end),
  };
}

function inPeriod(dateIso: string, periodStart: Date, periodEnd: Date) {
  const parsed = parseIsoDate(dateIso);
  if (!parsed) return false;
  const value = toDateOnly(parsed).getTime();
  return value >= periodStart.getTime() && value <= periodEnd.getTime();
}

function parseMoney(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRate(value: unknown): number {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeReferralRate(value: unknown): number {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed > 1 ? parsed / 100 : parsed;
}

function formatDisplayDate(dateIso: string) {
  const parsed = new Date(dateIso);
  return Number.isNaN(parsed.getTime()) ? dateIso : parsed.toLocaleDateString();
}

async function buildTimesheetPayload(email: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }

  const period = getBiweeklyPeriod(new Date());
  const entries = await listTimesheetEntriesByEmployee(email);
  const requests = await listTimesheetAdjustmentRequestsByEmployee(email);

  const periodEntries = entries
    .filter((entry) => inPeriod(String(entry.clock_out_at || entry.clock_in_at || ''), period.start, period.end))
    .sort((a, b) => String(a.clock_in_at || '').localeCompare(String(b.clock_in_at || '')));

  const periodRequests = requests
    .filter((request) => inPeriod(request.target_date, period.start, period.end))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  const approvedRequestMinutes = periodRequests
    .filter((request) => String(request.status || '').toLowerCase() === 'approved')
    .reduce((sum, request) => sum + Number(request.minutes_delta || 0), 0);

  const periodWorkedMinutes = periodEntries.reduce((sum, entry) => sum + Number(entry.minutes_worked || 0), 0);
  const totalPaidMinutes = Math.max(0, periodWorkedMinutes + approvedRequestMinutes);
  const hoursWorked = totalPaidMinutes / 60;
  const uniqueWorkDays = new Set(
    periodEntries
      .map((entry) => String(entry.clock_out_at || entry.clock_in_at || '').slice(0, 10))
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
  ).size;
  const shiftCount = periodEntries.length;

  const payType = String(user.pay_type || 'hourly').trim().toLowerCase() || 'hourly';
  const payRate = parseRate(user.pay_rate);
  const userReferralCode = String(user.sales_referral_code || '').trim().toLowerCase();
  const userReferralRate = normalizeReferralRate(user.sales_commission_rate);

  const bookings = await listBookingsFromSheet();
  const referralBookings = bookings
    .filter((booking) => {
      const bookingReferralEmail = String(booking.sales_referral_email || '').trim().toLowerCase();
      const bookingReferralCode = String(booking.sales_referral_code || '').trim().toLowerCase();
      return (
        bookingReferralEmail === email.toLowerCase() ||
        (userReferralCode && bookingReferralCode === userReferralCode)
      );
    })
    .filter((booking) => {
      const status = String(booking.status || '').toLowerCase();
      return status === 'completed' || status === 'confirmed';
    })
    .filter((booking) => inPeriod(String(booking.scheduled_date || ''), period.start, period.end));

  const salesCommissionTotal = referralBookings.reduce((sum, booking) => {
    const storedCommission = parseMoney(booking.sales_commission_amount);
    if (storedCommission > 0) {
      return sum + storedCommission;
    }

    const baseAmount = parseMoney(booking.employee_payout || booking.customer_price || booking.estimated_price);
    const fallbackRate = normalizeReferralRate(booking.sales_commission_rate) || userReferralRate;
    return sum + baseAmount * fallbackRate;
  }, 0);

  let estimatedGrossPay = 0;
  let estimateDetail = '';

  if (payType === 'daily') {
    estimatedGrossPay = uniqueWorkDays * payRate;
    estimateDetail = `${uniqueWorkDays} work days x $${payRate.toFixed(2)} per day`;
  } else if (payType === 'per_route') {
    estimatedGrossPay = shiftCount * payRate;
    estimateDetail = `${shiftCount} shifts/routes x $${payRate.toFixed(2)} per route`;
  } else if (payType === 'commission') {
    const commissionRate = payRate > 1 ? payRate / 100 : payRate;
    const bookings = await listBookingsFromSheet();
    const commissionBase = bookings
      .filter((booking) => String(booking.assigned_employee || '').trim().toLowerCase() === email.toLowerCase())
      .filter((booking) => {
        const status = String(booking.status || '').toLowerCase();
        return status === 'completed' || status === 'confirmed';
      })
      .filter((booking) => inPeriod(String(booking.scheduled_date || ''), period.start, period.end))
      .reduce((sum, booking) => sum + parseMoney(booking.employee_payout || booking.customer_price || booking.estimated_price), 0);

    estimatedGrossPay = commissionBase * commissionRate;
    estimateDetail = `${(commissionRate * 100).toFixed(2)}% commission on $${commissionBase.toFixed(2)} base`;
  } else {
    estimatedGrossPay = hoursWorked * payRate;
    estimateDetail = `${hoursWorked.toFixed(2)} hours x $${payRate.toFixed(2)} per hour`;
  }

  estimatedGrossPay += salesCommissionTotal;
  if (salesCommissionTotal > 0) {
    estimateDetail = estimateDetail ? `${estimateDetail} + $${salesCommissionTotal.toFixed(2)} sales commission` : `$${salesCommissionTotal.toFixed(2)} sales commission`;
  }

  const entriesView = periodEntries.map((entry) => ({
    entry_id: entry.entry_id,
    clock_in_at: entry.clock_in_at,
    clock_out_at: entry.clock_out_at,
    work_date: String(entry.clock_out_at || entry.clock_in_at || '').slice(0, 10),
    work_date_label: formatDisplayDate(String(entry.clock_out_at || entry.clock_in_at || '').slice(0, 10)),
    minutes_worked: Number(entry.minutes_worked || 0),
    status: entry.status,
    source: entry.source,
  }));

  const requestView = periodRequests.map((request) => ({
    request_id: request.request_id,
    target_date: request.target_date,
    target_date_label: formatDisplayDate(request.target_date),
    minutes_delta: Number(request.minutes_delta || 0),
    reason: request.reason,
    status: request.status,
    created_at: request.created_at,
    review_notes: request.review_notes || '',
  }));

  return {
    employee: {
      email: user.email,
      full_name: user.full_name,
      pay_type: payType,
      pay_rate: payRate,
      job_description: user.job_description || '',
      route_role: user.route_role || '',
    },
    pay_period: {
      start_date: period.startIso,
      end_date: period.endIso,
      label: `${formatDisplayDate(period.startIso)} - ${formatDisplayDate(period.endIso)}`,
      cadence: 'bi-weekly',
    },
    summary: {
      worked_minutes: periodWorkedMinutes,
      approved_adjustment_minutes: approvedRequestMinutes,
      payable_minutes: totalPaidMinutes,
      payable_hours: Number(hoursWorked.toFixed(2)),
      shift_count: shiftCount,
      work_day_count: uniqueWorkDays,
      sales_commission_total: Number(salesCommissionTotal.toFixed(2)),
      sales_commission_count: referralBookings.length,
      estimated_gross_pay: Number(estimatedGrossPay.toFixed(2)),
      estimate_detail: estimateDetail,
    },
    current_clock: {
      clock_in_at: user.clock_in_at || '',
      clock_out_at: user.clock_out_at || '',
      clocked_in: Boolean(String(user.clock_in_at || '').trim() && !String(user.clock_out_at || '').trim()),
    },
    entries: entriesView,
    adjustment_requests: requestView,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || (session.role !== 'employee' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await buildTimesheetPayload(session.email);
    if (!payload) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load timesheet', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || (session.role !== 'employee' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      target_date?: string;
      minutes_delta?: number;
      reason?: string;
    };

    const targetDate = String(body.target_date || '').trim();
    const minutesDelta = Number(body.minutes_delta);
    const reason = String(body.reason || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json({ error: 'target_date must be YYYY-MM-DD' }, { status: 400 });
    }
    if (!Number.isFinite(minutesDelta) || Math.round(minutesDelta) === 0) {
      return NextResponse.json({ error: 'minutes_delta must be a non-zero number' }, { status: 400 });
    }
    if (Math.abs(minutesDelta) > 720) {
      return NextResponse.json({ error: 'minutes_delta cannot exceed 720 minutes in a single request' }, { status: 400 });
    }
    if (!reason || reason.length < 8) {
      return NextResponse.json({ error: 'reason is required (at least 8 characters)' }, { status: 400 });
    }

    const result = await addTimesheetAdjustmentRequest({
      employee_email: session.email,
      target_date: targetDate,
      minutes_delta: Math.round(minutesDelta),
      reason,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to submit adjustment request' }, { status: 400 });
    }

    const payload = await buildTimesheetPayload(session.email);
    return NextResponse.json({ success: true, request_id: result.request_id, ...payload });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to submit adjustment request', details: (error as Error).message },
      { status: 500 }
    );
  }
}

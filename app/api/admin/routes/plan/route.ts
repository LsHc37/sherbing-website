import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { listBookingsFromSheet } from '@/lib/services/googleSheetsService';

const DEFAULT_ROUTE_START_MINUTES = 8 * 60;

type RoutePlanInput = {
  booking_ids: string[];
  route_name?: string;
  assigned_employee?: string;
  target_date?: string;
};

type RouteStop = {
  booking_id: string;
  order: number;
  estimated_travel_minutes: number;
  estimated_service_minutes: number;
  scheduled_time: string;
  customer_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  estimated_price: number;
};

function parseMoney(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDuration(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 60;
  return Math.max(30, Math.min(480, Math.round(parsed / 15) * 15));
}

function minutesToHHMM(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const hours = Math.floor(safe / 60) % 24;
  const minutes = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function estimateTravelMinutes(fromZip: string, toZip: string): number {
  const a = String(fromZip || '').trim();
  const b = String(toZip || '').trim();
  if (!a || !b) return 15;
  if (a === b) return 10;

  const a3 = Number(a.slice(0, 3));
  const b3 = Number(b.slice(0, 3));
  if (!Number.isFinite(a3) || !Number.isFinite(b3)) return 18;
  const delta = Math.abs(a3 - b3);
  return Math.min(35, 10 + delta * 3);
}

function buildDeterministicPlan(stops: Array<{
  booking_id: string;
  customer_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  estimated_price: number;
  scheduled_time: string;
  scheduled_duration_minutes: number;
}>): RouteStop[] {
  const sorted = [...stops].sort((a, b) => {
    const aTime = String(a.scheduled_time || '').trim();
    const bTime = String(b.scheduled_time || '').trim();
    if (aTime && bTime && aTime !== bTime) return aTime.localeCompare(bTime);
    if (a.zip_code !== b.zip_code) return a.zip_code.localeCompare(b.zip_code);
    return a.address.localeCompare(b.address);
  });

  let rollingMinutes = DEFAULT_ROUTE_START_MINUTES;
  return sorted.map((stop, index) => {
    const previous = sorted[index - 1];
    const travel = index === 0 ? 0 : estimateTravelMinutes(previous?.zip_code || '', stop.zip_code);
    rollingMinutes += travel;

    const planned: RouteStop = {
      booking_id: stop.booking_id,
      order: index + 1,
      estimated_travel_minutes: travel,
      estimated_service_minutes: parseDuration(stop.scheduled_duration_minutes),
      scheduled_time: minutesToHHMM(rollingMinutes),
      customer_name: stop.customer_name,
      address: stop.address,
      city: stop.city,
      state: stop.state,
      zip_code: stop.zip_code,
      estimated_price: stop.estimated_price,
    };

    rollingMinutes += planned.estimated_service_minutes;
    return planned;
  });
}

function coerceAiPlan(raw: unknown, fallback: RouteStop[]): RouteStop[] {
  if (!Array.isArray(raw)) return fallback;

  const byId = new Map(fallback.map((stop) => [stop.booking_id, stop]));
  const used = new Set<string>();
  const planned: RouteStop[] = [];

  for (const item of raw) {
    const bookingId = String((item as { booking_id?: string }).booking_id || '').trim();
    if (!bookingId || used.has(bookingId)) continue;

    const base = byId.get(bookingId);
    if (!base) continue;

    const orderRaw = Number((item as { order?: number }).order);
    const travelRaw = Number((item as { estimated_travel_minutes?: number }).estimated_travel_minutes);

    planned.push({
      ...base,
      order: Number.isFinite(orderRaw) && orderRaw > 0 ? Math.floor(orderRaw) : planned.length + 1,
      estimated_travel_minutes: Number.isFinite(travelRaw) && travelRaw >= 0 ? Math.round(travelRaw) : base.estimated_travel_minutes,
    });
    used.add(bookingId);
  }

  if (planned.length !== fallback.length) return fallback;

  const sorted = [...planned].sort((a, b) => a.order - b.order);
  let rollingMinutes = DEFAULT_ROUTE_START_MINUTES;
  return sorted.map((stop, index) => {
    rollingMinutes += index === 0 ? 0 : stop.estimated_travel_minutes;
    const scheduled_time = minutesToHHMM(rollingMinutes);
    rollingMinutes += stop.estimated_service_minutes;
    return {
      ...stop,
      order: index + 1,
      scheduled_time,
    };
  });
}

async function maybeEnhanceWithAi(stops: RouteStop[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || stops.length < 2) {
    return {
      plannedStops: stops,
      summary: 'Deterministic route order generated from schedule and ZIP proximity.',
      source: 'standard' as const,
    };
  }

  const aiStopsPayload = stops.map((stop) => ({
    booking_id: stop.booking_id,
    address: `${stop.address}, ${stop.city}, ${stop.state} ${stop.zip_code}`,
    estimated_service_minutes: stop.estimated_service_minutes,
    estimated_price: stop.estimated_price,
  }));

  const prompt = [
    'You are a dispatch route optimizer.',
    'Return JSON only in this exact shape: {"stops":[{"booking_id":"string","order":1,"estimated_travel_minutes":12}],"summary":"string"}.',
    'Use every booking_id exactly once. Keep stop order practical for driving efficiency.',
    `Stops: ${JSON.stringify(aiStopsPayload)}`,
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.15,
      messages: [
        { role: 'system', content: 'You return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    return {
      plannedStops: stops,
      summary: 'AI route optimization unavailable, used deterministic ordering.',
      source: 'standard' as const,
    };
  }

  const data = await response.json();
  const content = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!content) {
    return {
      plannedStops: stops,
      summary: 'AI returned an empty response, used deterministic ordering.',
      source: 'standard' as const,
    };
  }

  try {
    const parsed = JSON.parse(content) as { stops?: unknown; summary?: string };
    return {
      plannedStops: coerceAiPlan(parsed.stops, stops),
      summary: String(parsed.summary || '').trim() || 'AI optimized route order and travel timing.',
      source: 'ai' as const,
    };
  } catch {
    return {
      plannedStops: stops,
      summary: 'AI response could not be parsed, used deterministic ordering.',
      source: 'standard' as const,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<RoutePlanInput>;
    const bookingIds = Array.isArray(body.booking_ids)
      ? body.booking_ids.map((value) => String(value || '').trim()).filter(Boolean)
      : [];

    if (bookingIds.length === 0) {
      return NextResponse.json({ error: 'booking_ids is required' }, { status: 400 });
    }

    const routeName = String(body.route_name || '').trim() || `Route ${new Date().toLocaleDateString()}`;
    const assignedEmployee = String(body.assigned_employee || '').trim().toLowerCase();
    const targetDate = String(body.target_date || '').trim();

    const allBookings = await listBookingsFromSheet();
    const bookingSet = new Set(bookingIds.map((value) => value.toLowerCase()));

    const selected = allBookings
      .filter((booking) => bookingSet.has(String(booking.booking_id || '').toLowerCase()))
      .filter((booking) => !targetDate || String(booking.scheduled_date || '').trim() === targetDate)
      .map((booking) => ({
        booking_id: booking.booking_id,
        customer_name: booking.customer_name,
        address: booking.address,
        city: booking.city || booking.city_state_zip.split(',')[0]?.trim() || '',
        state: booking.state || booking.city_state_zip.split(',')[1]?.trim().split(' ')[0] || '',
        zip_code: booking.zip_code || booking.city_state_zip.split(' ').filter(Boolean).pop() || '',
        estimated_price: parseMoney(booking.customer_price || booking.estimated_price),
        scheduled_time: String(booking.scheduled_time || '').trim(),
        scheduled_duration_minutes: parseDuration(booking.scheduled_duration_minutes),
      }));

    if (selected.length === 0) {
      return NextResponse.json({ error: 'No matching bookings found for planning' }, { status: 404 });
    }

    const deterministic = buildDeterministicPlan(selected);
    const aiResult = await maybeEnhanceWithAi(deterministic);
    const routeGroupId = `ROUTE-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const totals = aiResult.plannedStops.reduce(
      (acc, stop) => {
        acc.estimated_price += stop.estimated_price;
        acc.estimated_service_minutes += stop.estimated_service_minutes;
        acc.estimated_travel_minutes += stop.estimated_travel_minutes;
        return acc;
      },
      { estimated_price: 0, estimated_service_minutes: 0, estimated_travel_minutes: 0 }
    );

    return NextResponse.json({
      source: aiResult.source,
      route_name: routeName,
      route_group_id: routeGroupId,
      assigned_employee: assignedEmployee,
      target_date: targetDate,
      summary: aiResult.summary,
      totals: {
        ...totals,
        estimated_total_minutes: totals.estimated_service_minutes + totals.estimated_travel_minutes,
      },
      stops: aiResult.plannedStops,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate route plan', details: (error as Error).message },
      { status: 500 }
    );
  }
}

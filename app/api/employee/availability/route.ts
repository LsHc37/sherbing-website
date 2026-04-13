import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import {
  findUserByEmail,
  parseEmployeeAvailabilityEntries,
  updateUserInSheet,
} from '@/lib/services/googleSheetsService';

type AvailabilityPayloadEntry = {
  date: string;
  start: string;
  end: string;
  type: 'open' | 'blocked';
};

function normalizeDate(value: string) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? raw : '';
}

function normalizeTime(value: string) {
  const raw = String(value || '').trim();
  const match = raw.match(/^([0-1]\d|2[0-3]):([0-5]\d)$/);
  return match ? raw : '';
}

function serializeEntries(entries: AvailabilityPayloadEntry[]) {
  return entries
    .map((entry) => `${entry.date}|${entry.start}|${entry.end}|${entry.type}`)
    .join(',');
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || (session.role !== 'employee' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await findUserByEmail(session.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const entries = parseEmployeeAvailabilityEntries(user.available_dates);
    return NextResponse.json({
      email: user.email,
      entries,
      raw: user.available_dates || '',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load availability', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || (session.role !== 'employee' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const rawEntries = Array.isArray(body?.entries) ? body.entries : [];

    const normalized = rawEntries
      .map((entry: unknown) => {
        const value = entry as Partial<AvailabilityPayloadEntry>;
        const date = normalizeDate(String(value?.date || ''));
        const start = normalizeTime(String(value?.start || ''));
        const end = normalizeTime(String(value?.end || ''));
        const type = value?.type === 'blocked' ? 'blocked' : 'open';

        if (!date || !start || !end || start >= end) {
          return null;
        }

        return { date, start, end, type } as AvailabilityPayloadEntry;
      })
      .filter((entry: AvailabilityPayloadEntry | null): entry is AvailabilityPayloadEntry => Boolean(entry));

    const saveValue = serializeEntries(normalized);
    const result = await updateUserInSheet(session.email, { available_dates: saveValue });
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update availability' }, { status: 400 });
    }

    return NextResponse.json({ success: true, entries: normalized });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update availability', details: (error as Error).message },
      { status: 500 }
    );
  }
}

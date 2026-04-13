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
  repeat?: 'none' | 'daily' | 'weekly' | 'weekdays';
  until?: string;
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
    .map((entry) => `${entry.date}|${entry.start}|${entry.end}|${entry.type}|${entry.repeat || 'none'}|${entry.until || ''}`)
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
    let invalidCount = 0;

    const normalized = rawEntries
      .map((entry: unknown) => {
        const value = entry as Partial<AvailabilityPayloadEntry>;
        const date = normalizeDate(String(value?.date || ''));
        const start = normalizeTime(String(value?.start || ''));
        const end = normalizeTime(String(value?.end || ''));
        const type = value?.type === 'blocked' ? 'blocked' : 'open';
        const repeat = value?.repeat && ['none', 'daily', 'weekly', 'weekdays'].includes(value.repeat)
          ? value.repeat
          : 'none';
        const until = value?.until ? normalizeDate(String(value.until)) : '';

        if (!date || !start || !end || start >= end) {
          invalidCount += 1;
          return null;
        }

        if (until && until < date) {
          invalidCount += 1;
          return null;
        }

        return { date, start, end, type, repeat, until: until || undefined } as AvailabilityPayloadEntry;
      })
      .filter((entry: AvailabilityPayloadEntry | null): entry is AvailabilityPayloadEntry => Boolean(entry));

    if (invalidCount > 0) {
      return NextResponse.json(
        { error: `Could not save calendar: ${invalidCount} invalid entr${invalidCount === 1 ? 'y' : 'ies'} detected.` },
        { status: 400 }
      );
    }

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

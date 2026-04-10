import { getSessionFromRequest } from '@/lib/auth/session';
import { listUsersFromSheet } from '@/lib/services/googleSheetsService';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await listUsersFromSheet();
    const safeUsers = users.map((user) => ({
      created_at: user.created_at,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
      active: user.active,
      available_dates: user.available_dates || '',
    }));

    return NextResponse.json(safeUsers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load users', details: (error as Error).message }, { status: 500 });
  }
}

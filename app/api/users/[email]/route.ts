import { getSessionFromRequest } from '@/lib/auth/session';
import { updateUserInSheet } from '@/lib/services/googleSheetsService';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ email: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await context.params;
    const decodedEmail = decodeURIComponent(email).toLowerCase();
    const body = await request.json();

    const role = body.role ? String(body.role) : undefined;
    const active = body.active === undefined ? undefined : String(body.active);
    const availableDates = Array.isArray(body.available_dates)
      ? body.available_dates.map((value: unknown) => String(value).trim()).filter(Boolean).join(',')
      : body.available_dates === undefined
        ? undefined
        : String(body.available_dates).trim();
    const managedGroups = Array.isArray(body.managed_groups)
      ? body.managed_groups.map((value: unknown) => String(value).trim().toLowerCase()).filter(Boolean).join(',')
      : body.managed_groups === undefined
        ? undefined
        : String(body.managed_groups).trim().toLowerCase();

    if (role && !['customer', 'employee', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const result = await updateUserInSheet(decodedEmail, {
      role: role as 'customer' | 'employee' | 'admin' | undefined,
      active,
      available_dates: availableDates,
      managed_groups: managedGroups,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Update failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user', details: (error as Error).message }, { status: 500 });
  }
}

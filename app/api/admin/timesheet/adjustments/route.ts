import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import {
  listTimesheetAdjustmentRequestsFromSheet,
  listUsersFromSheet,
  updateTimesheetAdjustmentRequestInSheet,
} from '@/lib/services/googleSheetsService';

function normalizeStatus(value: string) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'rejected') return 'rejected';
  return 'pending';
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const statusFilter = String(request.nextUrl.searchParams.get('status') || '').trim().toLowerCase();
    const users = await listUsersFromSheet();
    const byEmail = new Map(users.map((user) => [String(user.email || '').toLowerCase(), user]));

    const requests = await listTimesheetAdjustmentRequestsFromSheet();
    const filtered = requests
      .filter((requestItem) => {
        if (!statusFilter) return true;
        return String(requestItem.status || '').toLowerCase() === statusFilter;
      })
      .map((requestItem) => {
        const user = byEmail.get(String(requestItem.employee_email || '').toLowerCase());
        return {
          request_id: requestItem.request_id,
          employee_email: requestItem.employee_email,
          employee_name: user?.full_name || requestItem.employee_email,
          target_date: requestItem.target_date,
          minutes_delta: Number(requestItem.minutes_delta || 0),
          reason: requestItem.reason,
          status: normalizeStatus(requestItem.status),
          created_at: requestItem.created_at,
          reviewed_by: requestItem.reviewed_by || '',
          reviewed_at: requestItem.reviewed_at || '',
          review_notes: requestItem.review_notes || '',
        };
      })
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    return NextResponse.json(filtered);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load adjustment requests', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      request_id?: string;
      status?: string;
      review_notes?: string;
    };

    const requestId = String(body.request_id || '').trim();
    const status = normalizeStatus(String(body.status || '').trim());
    const reviewNotes = String(body.review_notes || '').trim();

    if (!requestId) {
      return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
    }
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });
    }

    const updateResult = await updateTimesheetAdjustmentRequestInSheet(requestId, {
      status,
      reviewed_by: session.email,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    });

    if (!updateResult.success) {
      return NextResponse.json({ error: updateResult.error || 'Failed to update request' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update adjustment request', details: (error as Error).message },
      { status: 500 }
    );
  }
}

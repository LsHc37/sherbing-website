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
      managed_groups: user.managed_groups || '',
      forms_terms_signed_at: user.forms_terms_signed_at || '',
      forms_work_contract_signed_at: user.forms_work_contract_signed_at || '',
      forms_job_description_signed_at: user.forms_job_description_signed_at || '',
      forms_pay_terms_signed_at: user.forms_pay_terms_signed_at || '',
      training_completed_at: user.training_completed_at || '',
      shadow_required: user.shadow_required || 'true',
      shadow_completed_at: user.shadow_completed_at || '',
      shadow_mentor_email: user.shadow_mentor_email || '',
      clock_in_at: user.clock_in_at || '',
      clock_out_at: user.clock_out_at || '',
      tracked_minutes_total: user.tracked_minutes_total || '0',
      route_role: user.route_role || '',
      pay_type: user.pay_type || '',
      pay_rate: user.pay_rate || '',
      job_description: user.job_description || '',
    }));

    return NextResponse.json(safeUsers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load users', details: (error as Error).message }, { status: 500 });
  }
}

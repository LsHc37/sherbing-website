import {
  createSessionToken,
  getSessionCookieName,
  getSessionCookieSettings,
  getSessionFromRequest,
  getSessionMaxAgeSeconds,
  isAdminEmail,
} from '@/lib/auth/session';
import { findUserByEmail } from '@/lib/services/googleSheetsService';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = await findUserByEmail(session.email);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const resolvedRole = isAdminEmail(user.email) ? 'admin' : user.role;

  const refreshedToken = createSessionToken({
    email: user.email,
    full_name: user.full_name,
    role: resolvedRole,
  });

  const response = NextResponse.json({
    authenticated: true,
    user: {
      email: user.email,
      full_name: user.full_name,
      role: resolvedRole,
      phone: user.phone,
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
    },
  });

  response.cookies.set(getSessionCookieName(), refreshedToken, {
    ...getSessionCookieSettings(),
    maxAge: getSessionMaxAgeSeconds(),
  });

  return response;
}

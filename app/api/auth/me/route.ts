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
    },
  });

  response.cookies.set(getSessionCookieName(), refreshedToken, {
    ...getSessionCookieSettings(),
    maxAge: getSessionMaxAgeSeconds(),
  });

  return response;
}

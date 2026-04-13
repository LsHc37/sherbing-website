import { getSessionCookieName, getSessionCookieSettings, getSessionFromRequest } from '@/lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(getSessionCookieName(), '', {
    ...getSessionCookieSettings(),
    maxAge: 0,
  });

  return response;
}

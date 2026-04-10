import { getSessionCookieName, getSessionCookieSettings } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(getSessionCookieName(), '', {
    ...getSessionCookieSettings(),
    maxAge: 0,
  });

  return response;
}

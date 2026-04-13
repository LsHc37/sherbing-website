import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  getSessionCookieName,
  getSessionCookieSettings,
  getSessionMaxAgeSeconds,
  hashPassword,
  isAdminEmail,
  verifyPassword,
} from '@/lib/auth/session';
import { findUserByEmail, updateUserInSheet } from '@/lib/services/googleSheetsService';
import { checkRateLimit, getRequestIp } from '@/lib/services/rateLimitService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const ip = getRequestIp(request);
    const ipLimit = checkRateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
    const accountLimit = checkRateLimit(`login:account:${normalizedEmail}`, 8, 15 * 60 * 1000);
    if (!ipLimit.allowed || !accountLimit.allowed) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // User rows store email_verified as "true" | "false" strings.
    const isEmailVerified = String(user.email_verified).trim().toLowerCase() === 'true';
    if (!isEmailVerified) {
      return NextResponse.json(
        { error: 'Email not verified', requiresVerification: true, email: normalizedEmail },
        { status: 403 }
      );
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.password_hash.startsWith('$2')) {
      await updateUserInSheet(normalizedEmail, { password_hash: await hashPassword(password) });
    }

    const resolvedRole = isAdminEmail(normalizedEmail) ? 'admin' : user.role;

    if (resolvedRole === 'admin' && user.role !== 'admin') {
      await updateUserInSheet(normalizedEmail, { role: 'admin' });
    }

    const token = createSessionToken({
      email: user.email,
      full_name: user.full_name,
      role: resolvedRole,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: {
          email: user.email,
          full_name: user.full_name,
          role: resolvedRole,
          phone: user.phone,
        },
        message: 'Login successful',
      },
      { status: 200 }
    );

    response.cookies.set(getSessionCookieName(), token, {
      ...getSessionCookieSettings(),
      maxAge: getSessionMaxAgeSeconds(),
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Login failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

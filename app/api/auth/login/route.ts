import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, getSessionCookieName, getSessionCookieSettings, getSessionMaxAgeSeconds, hashPassword } from '@/lib/auth/session';
import { findUserByEmail } from '@/lib/services/googleSheetsService';

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
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // User rows store email_verified as "true" | "false" strings.
    const isEmailVerified = String(user.email_verified).trim().toLowerCase() === 'true';
    if (!isEmailVerified) {
      return NextResponse.json(
        { error: 'Email not verified', requiresVerification: true, email: normalizedEmail },
        { status: 403 }
      );
    }

    const passwordHash = hashPassword(password);
    if (user.password_hash !== passwordHash) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = createSessionToken({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: {
          email: user.email,
          full_name: user.full_name,
          role: user.role,
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

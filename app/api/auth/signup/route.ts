import { NextRequest, NextResponse } from 'next/server';
import {
  createVerificationToken,
  getVerificationCookieName,
  getVerificationMaxAgeSeconds,
  hashPassword,
  isAdminEmail,
  validatePasswordStrength,
} from '@/lib/auth/session';
import { createUserInSheet } from '@/lib/services/googleSheetsService';
import { generateVerificationCode, sendVerificationEmail } from '@/lib/services/bookingService';
import { checkRateLimit, getRequestIp } from '@/lib/services/rateLimitService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name, phone } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const ip = getRequestIp(request);
    const ipLimit = checkRateLimit(`signup:ip:${ip}`, 10, 15 * 60 * 1000);
    const emailLimit = checkRateLimit(`signup:email:${normalizedEmail}`, 3, 60 * 60 * 1000);

    if (!ipLimit.allowed || !emailLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const passwordStrengthError = validatePasswordStrength(password);
    if (passwordStrengthError) {
      return NextResponse.json({ error: passwordStrengthError }, { status: 400 });
    }

    const role = isAdminEmail(normalizedEmail) ? 'admin' : 'customer';

    // Generate verification code for email
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiry

    const created = await createUserInSheet({
      email: normalizedEmail,
      full_name,
      phone,
      password_hash: await hashPassword(password),
      role,
      email_verified: false,
      email_verification_code: verificationCode,
      email_verification_expires: expiresAt.toISOString(),
    });

    if (!created.success) {
      return NextResponse.json({ error: created.error || 'Signup failed' }, { status: 400 });
    }

    // Send verification email
    const emailResult = await sendVerificationEmail(
      normalizedEmail,
      verificationCode,
      full_name
    );

    if (!emailResult.success) {
      console.warn('Failed to send verification email:', emailResult.error);
      // Note: We don't fail signup if email sending fails - user can request resend
    }

    const response = NextResponse.json(
      {
        success: true,
        requiresVerification: true,
        email: normalizedEmail,
        message: 'Account created! Check your email for a verification code.',
      },
      { status: 201 }
    );

    response.cookies.set(getVerificationCookieName(), createVerificationToken({ email: normalizedEmail }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: getVerificationMaxAgeSeconds(),
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Signup failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

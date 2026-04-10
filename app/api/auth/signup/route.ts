import { NextRequest, NextResponse } from 'next/server';
import { createVerificationToken, getVerificationCookieName, getVerificationMaxAgeSeconds, hashPassword } from '@/lib/auth/session';
import { createUserInSheet } from '@/lib/services/googleSheetsService';
import { generateVerificationCode, sendVerificationEmail } from '@/lib/services/bookingService';

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
    const adminEmails = new Set(['lucas.mellen1@gmail.com', 'lucanmellen1@gmail.com']);
    const role = adminEmails.has(normalizedEmail) ? 'admin' : 'customer';

    // Generate verification code for email
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiry

    const created = await createUserInSheet({
      email: normalizedEmail,
      full_name,
      phone,
      password_hash: hashPassword(password),
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

    response.cookies.set(getVerificationCookieName(), createVerificationToken({ email: normalizedEmail, code: verificationCode }), {
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

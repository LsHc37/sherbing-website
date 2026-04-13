import { NextRequest, NextResponse } from 'next/server';
import { generateVerificationCode, sendVerificationEmail } from '@/lib/services/bookingService';
import { createVerificationToken, getVerificationCookieName, getVerificationMaxAgeSeconds } from '@/lib/auth/session';
import { findUserByEmail, updateUserInSheet } from '@/lib/services/googleSheetsService';
import { checkRateLimit, getRequestIp } from '@/lib/services/rateLimitService';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const ip = getRequestIp(request);
    const ipLimit = checkRateLimit(`send-verification:ip:${ip}`, 15, 15 * 60 * 1000);
    const emailLimit = checkRateLimit(`send-verification:email:${normalizedEmail}`, 4, 15 * 60 * 1000);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email required' },
        { status: 400 }
      );
    }

    // Find user in Sheets
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isVerified = String(user.email_verified).trim().toLowerCase() === 'true';
    if (isVerified) {
      return NextResponse.json(
        { error: 'Email is already verified' },
        { status: 400 }
      );
    }

    // Generate verification code (6 digits)
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiry

    // Store code in Sheets (in Users tab)
    const updateResult = await updateUserInSheet(normalizedEmail, {
      email_verification_code: verificationCode,
      email_verification_expires: expiresAt.toISOString(),
    });

    if (!updateResult.success) {
      return NextResponse.json(
        { error: updateResult.error || 'Failed to store verification code' },
        { status: 500 }
      );
    }

    // Send email
    const emailResult = await sendVerificationEmail(
      normalizedEmail,
      verificationCode,
      user.full_name || 'User'
    );

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
    });

    response.cookies.set(getVerificationCookieName(), createVerificationToken({ email: normalizedEmail }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: getVerificationMaxAgeSeconds(),
    });

    return response;
  } catch (error) {
    console.error('Verification email error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    );
  }
}

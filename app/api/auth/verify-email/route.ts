import { NextRequest, NextResponse } from 'next/server';
import { getVerificationCookieName, verifyVerificationToken } from '@/lib/auth/session';
import { findUserByEmail, updateUserInSheet } from '@/lib/services/googleSheetsService';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedCode = String(code || '').trim();
    const verificationCookie = verifyVerificationToken(request.cookies.get(getVerificationCookieName())?.value || null);

    if (!normalizedEmail || !normalizedCode) {
      return NextResponse.json(
        { error: 'Email and verification code required' },
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

    // Check if email already verified
    const isVerified = String(user.email_verified).trim().toLowerCase() === 'true';
    if (isVerified) {
      return NextResponse.json(
        { success: true, message: 'Email already verified' }
      );
    }

    // Check if code matches
    const storedCode = String(user.email_verification_code || '').trim();
    const cookieMatches = Boolean(
      verificationCookie &&
      verificationCookie.email.toLowerCase() === normalizedEmail &&
      verificationCookie.code.trim() === normalizedCode
    );

    if (storedCode !== normalizedCode && !cookieMatches) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Check if code has expired
    if (user.email_verification_expires) {
      const expiresAt = new Date(user.email_verification_expires);
      if (new Date() > expiresAt) {
        return NextResponse.json(
          { error: 'Verification code has expired' },
          { status: 400 }
        );
      }
    }

    // Mark email as verified in Sheets
    const updateResult = await updateUserInSheet(normalizedEmail, {
      email_verified: true,
      email_verification_code: '', // Clear code
      email_verification_expires: '', // Clear expiry
    });

    if (!updateResult.success) {
      return NextResponse.json(
        { error: updateResult.error || 'Failed to update verification status' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });

    response.cookies.set(getVerificationCookieName(), '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    );
  }
}

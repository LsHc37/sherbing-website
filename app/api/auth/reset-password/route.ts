import { NextRequest, NextResponse } from 'next/server';
import { findUserByPasswordResetToken, updateUserInSheet } from '@/lib/services/googleSheetsService';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/session';
import { checkRateLimit, getRequestIp } from '@/lib/services/rateLimitService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    const ip = getRequestIp(request);
    const ipLimit = checkRateLimit(`reset-password:ip:${ip}`, 10, 15 * 60 * 1000);
    const tokenLimit = checkRateLimit(`reset-password:token:${String(token).slice(0, 16)}`, 8, 15 * 60 * 1000);
    if (!ipLimit.allowed || !tokenLimit.allowed) {
      return NextResponse.json({ error: 'Too many password reset attempts. Please try again later.' }, { status: 429 });
    }

    const passwordStrengthError = validatePasswordStrength(password);
    if (passwordStrengthError) {
      return NextResponse.json({ error: passwordStrengthError }, { status: 400 });
    }

    // Find user by reset token
    const user = await findUserByPasswordResetToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 401 }
      );
    }

    // Hash new password and update user
    const passwordHash = await hashPassword(password);
    const updated = await updateUserInSheet(user.email, {
      password_hash: passwordHash,
      password_reset_token: '', // Clear reset token
      password_reset_expires: '', // Clear expiry
    });

    if (!updated.success) {
      console.error('Failed to update password:', updated.error);
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Password reset successful' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in reset-password route:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

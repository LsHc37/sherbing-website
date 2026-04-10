import { NextRequest, NextResponse } from 'next/server';
import { findUserByPasswordResetToken, updateUserInSheet } from '@/lib/services/googleSheetsService';
import { hashPassword } from '@/lib/auth/session';

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

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
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
    const passwordHash = hashPassword(password);
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

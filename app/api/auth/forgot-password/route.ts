import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, updateUserInSheet } from '@/lib/services/googleSheetsService';
import { sendPasswordResetEmail } from '@/lib/services/bookingService';
import crypto from 'crypto';

function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await findUserByEmail(normalizedEmail);

    // Always return success for security (don't reveal if email exists)
    if (!user) {
      return NextResponse.json(
        { success: true, message: 'If an account exists, a reset email will be sent' },
        { status: 200 }
      );
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = generateResetToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Update user with reset token
    const updated = await updateUserInSheet(normalizedEmail, {
      password_reset_token: resetToken,
      password_reset_expires: expiresAt.toISOString(),
    });

    if (!updated.success) {
      console.error('Failed to update user with reset token:', updated.error);
      return NextResponse.json(
        { error: 'Failed to process request' },
        { status: 500 }
      );
    }

    // Send reset email
    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const emailResult = await sendPasswordResetEmail(normalizedEmail, user.full_name, resetLink);

    if (!emailResult.success) {
      console.warn('Failed to send password reset email:', emailResult.error);
      // Note: We don't fail the request if email sending fails
    }

    return NextResponse.json(
      { success: true, message: 'Password reset email sent' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in forgot-password route:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, initializeSheet, updateUserInSheet } from '@/lib/services/googleSheetsService';
import { sendPasswordResetEmail } from '@/lib/services/bookingService';
import { checkRateLimit, getRequestIp } from '@/lib/services/rateLimitService';
import crypto from 'crypto';

function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getBaseUrl(request: NextRequest): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');

  if (forwardedHost) {
    const protocol = forwardedProto || 'https';
    return `${protocol}://${forwardedHost}`.replace(/\/+$/, '');
  }

  if (host) {
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    return `${protocol}://${host}`.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}

export async function POST(request: NextRequest) {
  try {
    const init = await initializeSheet();
    if (!init.success) {
      return NextResponse.json(
        { error: init.error || 'Google Sheets not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const ip = getRequestIp(request);
    const ipLimit = checkRateLimit(`forgot-password:ip:${ip}`, 10, 15 * 60 * 1000);
    const emailLimit = checkRateLimit(`forgot-password:email:${normalizedEmail}`, 3, 15 * 60 * 1000);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many reset attempts. Please try again later.' },
        { status: 429 }
      );
    }

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
    const resetLink = `${getBaseUrl(request)}/reset-password?token=${resetToken}`;
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

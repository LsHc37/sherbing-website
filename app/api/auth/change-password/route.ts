import { getSessionFromRequest, hashPassword } from '@/lib/auth/session';
import { findUserByEmail, updateUserInSheet } from '@/lib/services/googleSheetsService';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const current_password = String(body.current_password || '');
    const new_password = String(body.new_password || '');

    if (!current_password || !new_password) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
    }

    if (new_password.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    const user = await findUserByEmail(session.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.password_hash !== hashPassword(current_password)) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const result = await updateUserInSheet(session.email, {
      password_hash: hashPassword(new_password),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Password update failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to change password', details: (error as Error).message }, { status: 500 });
  }
}

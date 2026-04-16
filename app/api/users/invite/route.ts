import { getSessionFromRequest, hashPassword } from '@/lib/auth/session';
import { createUserInSheet } from '@/lib/services/googleSheetsService';
import { NextRequest, NextResponse } from 'next/server';

function makeTempPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  let output = '';
  for (let i = 0; i < length; i += 1) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }
  return output;
}

function makeReferralCode(fullName: string, email: string) {
  const base = (fullName || email.split('@')[0] || 'employee')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18) || 'employee';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const full_name = String(body.full_name || '').trim();
    const phone = String(body.phone || '').trim();
    const role = body.role === 'admin' ? 'admin' : 'employee';
    const salesReferralCode = String(body.sales_referral_code || '').trim() || makeReferralCode(full_name, email);
    const salesCommissionRate = String(body.sales_commission_rate || '').trim();

    if (!email || !full_name) {
      return NextResponse.json({ error: 'Email and full name are required' }, { status: 400 });
    }

    const tempPassword = makeTempPassword();
    const result = await createUserInSheet({
      email,
      full_name,
      phone,
      password_hash: await hashPassword(tempPassword),
      role,
      sales_referral_code: salesReferralCode,
      sales_commission_rate: salesCommissionRate,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Invite failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true, temp_password: tempPassword, role, email });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to invite user', details: (error as Error).message }, { status: 500 });
  }
}

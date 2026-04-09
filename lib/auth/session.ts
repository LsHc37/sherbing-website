import crypto from 'crypto';
import type { NextRequest } from 'next/server';

export type SessionUser = {
  email: string;
  full_name: string;
  role: 'customer' | 'employee' | 'admin';
};

const COOKIE_NAME = 'sherbing_session';
const VERIFICATION_COOKIE_NAME = 'sherbing_verification';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const VERIFICATION_MAX_AGE_SECONDS = 60 * 10;

function getSecret() {
  return process.env.AUTH_SECRET || 'dev-only-secret-change-me';
}

function base64url(input: string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function sign(data: string) {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

export function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function createSessionToken(user: SessionUser) {
  const payload = {
    ...user,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };

  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token?: string | null): SessionUser | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = sign(encodedPayload);
  if (expectedSignature !== providedSignature) return null;

  try {
    const payload = JSON.parse(fromBase64url(encodedPayload)) as SessionUser & { exp: number };
    if (!payload.exp || Date.now() > payload.exp) return null;

    return {
      email: payload.email,
      full_name: payload.full_name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value || null;
  return verifySessionToken(token);
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export function getSessionMaxAgeSeconds() {
  return SESSION_MAX_AGE_SECONDS;
}

export type VerificationToken = {
  email: string;
  code: string;
};

export function createVerificationToken(payload: VerificationToken) {
  const envelope = {
    ...payload,
    exp: Date.now() + VERIFICATION_MAX_AGE_SECONDS * 1000,
  };

  const encodedPayload = base64url(JSON.stringify(envelope));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyVerificationToken(token?: string | null): VerificationToken | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = sign(encodedPayload);
  if (expectedSignature !== providedSignature) return null;

  try {
    const payload = JSON.parse(fromBase64url(encodedPayload)) as VerificationToken & { exp: number };
    if (!payload.exp || Date.now() > payload.exp) return null;

    return {
      email: payload.email,
      code: payload.code,
    };
  } catch {
    return null;
  }
}

export function getVerificationCookieName() {
  return VERIFICATION_COOKIE_NAME;
}

export function getVerificationMaxAgeSeconds() {
  return VERIFICATION_MAX_AGE_SECONDS;
}

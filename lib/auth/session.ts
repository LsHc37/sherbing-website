import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';

export type SessionUser = {
  email: string;
  full_name: string;
  role: 'customer' | 'employee' | 'admin';
};

const COOKIE_NAME = 'sherbing_session';
const VERIFICATION_COOKIE_NAME = 'sherbing_verification';
const SESSION_MAX_AGE_SECONDS = Number(process.env.SESSION_MAX_AGE_SECONDS || 60 * 60 * 8);
const VERIFICATION_MAX_AGE_SECONDS = 60 * 10;
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

let cachedDevSecret: string | null = null;

function getSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be configured in production');
  }

  if (!cachedDevSecret) {
    cachedDevSecret = crypto.randomBytes(32).toString('hex');
  }

  return cachedDevSecret;
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
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function hashLegacyPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function isBcryptHash(value: string) {
  return value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$');
}

export async function verifyPassword(password: string, storedHash: string) {
  const normalizedHash = String(storedHash || '').trim();
  if (!normalizedHash) return false;

  try {
    if (isBcryptHash(normalizedHash)) {
      return bcrypt.compare(password, normalizedHash);
    }

    return hashLegacyPassword(password) === normalizedHash;
  } catch {
    return false;
  }
}

export function getAdminEmailSet() {
  const configured = String(process.env.ADMIN_EMAILS || '');
  return new Set(
    configured
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string) {
  return getAdminEmailSet().has(String(email || '').trim().toLowerCase());
}

export function validatePasswordStrength(password: string) {
  const value = String(password || '');

  if (value.length < 12) return 'Password must be at least 12 characters';
  if (!/[A-Z]/.test(value)) return 'Password must include at least one uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must include at least one lowercase letter';
  if (!/\d/.test(value)) return 'Password must include at least one number';

  return null;
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

function getAuthCookieDomain() {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return domain || undefined;
}

export function getSessionCookieSettings() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    domain: getAuthCookieDomain(),
  };
}

export type VerificationToken = {
  email: string;
  code?: string;
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

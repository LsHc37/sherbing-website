import type { NextRequest } from 'next/server';

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitRecord>();

function cleanup(now: number) {
  for (const [key, record] of buckets.entries()) {
    if (record.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const firstForwarded = forwardedFor.split(',')[0]?.trim();
  if (firstForwarded) return firstForwarded;

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return 'unknown';
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  cleanup(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(limit - 1, 0), retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(limit - existing.count, 0),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

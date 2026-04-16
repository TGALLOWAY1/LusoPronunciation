import type { NextFunction, Request, Response } from 'express';
import { ERROR_CLASS } from '../../lib/errorTaxonomy';
import { speechLog } from '../utils/speechDebug';
import { createDailyQuota } from './dailyQuota';
import { parsePositiveIntEnv } from './rateLimit';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const DEFAULT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 20;

// Daily quota ceiling — the big one. Caps how much Azure spend a single
// principal (user or IP) can drive per UTC day, regardless of how they pace
// their requests.
const DEFAULT_DAILY_QUOTA = 200;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const pronunciationRateLimitStore = new Map<string, RateLimitEntry>();
let lastRateLimitCleanupAt = 0;

function readConfiguredOrigins(): Set<string> {
  const allowlist = new Set<string>();
  const rawAllowlist =
    process.env.SPEECH_CORS_ALLOWED_ORIGINS ||
    process.env.CORS_ALLOWED_ORIGINS ||
    process.env.APP_ORIGINS ||
    '';

  rawAllowlist
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => allowlist.add(origin));

  // Only add the dev defaults when not in production, so prod can never
  // accidentally accept requests from localhost origins.
  if (process.env.NODE_ENV !== 'production') {
    DEFAULT_ALLOWED_ORIGINS.forEach((o) => allowlist.add(o));
  }

  // APP_ORIGIN (used by OAuth) is implicitly trusted.
  if (process.env.APP_ORIGIN) {
    allowlist.add(process.env.APP_ORIGIN.trim());
  }

  return allowlist;
}

function resolveRateLimitKey(req: Request): string {
  const user = (req as Request & { user?: { id?: string; userId?: string; _id?: string } }).user;
  const userId = user?.id || user?.userId || user?._id;
  if (userId) {
    return `user:${userId}`;
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

function cleanupExpiredRateLimitEntries(now: number): void {
  if (now - lastRateLimitCleanupAt < 60_000) {
    return;
  }

  lastRateLimitCleanupAt = now;
  for (const [key, entry] of pronunciationRateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      pronunciationRateLimitStore.delete(key);
    }
  }
}

export function pronunciationCorsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') || 'unknown';
  const requestOrigin = req.header('origin');
  const allowedOrigins = readConfiguredOrigins();

  // Allow requests with no Origin header (CLI/server-to-server/same-origin requests).
  // Browsers always send Origin for cross-origin; absence typically means
  // same-origin fetch, curl, or the Vite preview. This does not weaken CORS
  // policy — it just skips setting CORS headers.
  if (!requestOrigin) {
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
    return;
  }

  // Same-origin: the browser sends Origin matching Host.
  const host = req.header('host');
  const isSameOrigin =
    host &&
    (requestOrigin === `https://${host}` || requestOrigin === `http://${host}`);

  if (!isSameOrigin && !allowedOrigins.has(requestOrigin)) {
    speechLog('warn', 'Pronunciation request blocked by CORS policy', {
      requestId,
      statusClass: '4xx',
    });
    res.status(403).json({
      error: 'Origin not allowed',
      message: 'This origin is not allowed to access pronunciation endpoints.',
      requestId,
    });
    return;
  }

  // Pin Access-Control-Allow-Headers to a known list — never reflect the
  // browser's Access-Control-Request-Headers unconditionally.
  res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
  res.setHeader('Access-Control-Max-Age', '600');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

export function pronunciationRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') || 'unknown';
  const windowMs = parsePositiveIntEnv(
    process.env.SPEECH_RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS
  );
  const maxRequests = parsePositiveIntEnv(
    process.env.SPEECH_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_RATE_LIMIT_MAX_REQUESTS
  );

  const now = Date.now();
  cleanupExpiredRateLimitEntries(now);

  const key = resolveRateLimitKey(req);
  const current = pronunciationRateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    pronunciationRateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    next();
    return;
  }

  if (current.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    speechLog('warn', 'Pronunciation request blocked by rate limiter', {
      requestId,
      statusClass: '4xx',
    });
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have reached the pronunciation request limit. Please wait and try again.',
      requestId,
      errorClass: ERROR_CLASS.serverRateLimited,
    });
    return;
  }

  pronunciationRateLimitStore.set(key, {
    ...current,
    count: current.count + 1,
  });
  next();
}

/**
 * Daily quota gate. Runs AFTER requireAuth so it keys on user id. This is the
 * cost ceiling that matters most: an attacker with unlimited IPs still can't
 * drive unlimited Azure spend through any one account.
 */
export const pronunciationDailyQuotaMiddleware = createDailyQuota({
  name: 'pronunciation:daily',
  max: parsePositiveIntEnv(process.env.SPEECH_DAILY_QUOTA, DEFAULT_DAILY_QUOTA),
  message:
    'You have reached the daily pronunciation assessment limit. The quota resets at 00:00 UTC.',
});

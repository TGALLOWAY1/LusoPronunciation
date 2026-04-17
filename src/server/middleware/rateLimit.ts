/**
 * Generic in-memory rate limiter for Express routes.
 *
 * Designed for single-instance deployments (Railway). If this app scales to
 * multiple instances, swap the backing store for Redis/Upstash or rely on a
 * platform-layer rate limiter (e.g., Cloudflare, Vercel Firewall).
 *
 * Layers supported:
 *   - Per-IP (default): keys by req.ip
 *   - Per-user: keys by req.user.id when authenticated
 *   - Per-key (arbitrary): keyBy(req) => string
 *
 * Emits structured logs on block events for abuse monitoring.
 */
import type { NextFunction, Request, Response } from 'express';

export interface RateLimitOptions {
  /** Unique identifier used in logs and store namespacing. */
  name: string;
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Maximum requests per window per key. */
  max: number;
  /** Optional custom key function. Defaults to IP. */
  keyBy?: (req: Request) => string;
  /** Optional hook called every time a request is blocked. */
  onBlock?: (req: Request, key: string) => void;
  /** Human-facing message included in the 429 response. */
  message?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores: Map<string, Map<string, RateLimitEntry>> = new Map();
const cleanupWatermark: Map<string, number> = new Map();
const CLEANUP_INTERVAL_MS = 60_000;

function getStore(name: string): Map<string, RateLimitEntry> {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

function maybeCleanup(name: string, store: Map<string, RateLimitEntry>, now: number): void {
  const last = cleanupWatermark.get(name) ?? 0;
  if (now - last < CLEANUP_INTERVAL_MS) return;
  cleanupWatermark.set(name, now);
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

function defaultKeyBy(req: Request): string {
  // Prefer authenticated user id if available
  const user = (req as Request & { user?: { id?: string } }).user;
  if (user?.id) return `u:${user.id}`;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

export function createRateLimit(opts: RateLimitOptions) {
  const { name, windowMs, max, keyBy = defaultKeyBy, onBlock, message } = opts;
  const store = getStore(name);

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    maybeCleanup(name, store, now);

    const key = keyBy(req);
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      next();
      return;
    }

    if (entry.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      onBlock?.(req, key);
      console.warn(
        `[RateLimit] blocked name=${name} key=${key} path=${req.path} method=${req.method} retryAfter=${retryAfter}s`
      );
      res.status(429).json({
        error: 'Too many requests',
        message: message || 'You have reached the request limit. Please wait and try again.',
      });
      return;
    }

    entry.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    next();
  };
}

/**
 * Parse a positive int env var with fallback.
 */
export function parsePositiveIntEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

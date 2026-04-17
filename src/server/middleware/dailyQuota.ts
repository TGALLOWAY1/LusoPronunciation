/**
 * Daily quota middleware — a second layer on top of the sliding-window rate
 * limiter. Where the rate limiter caps burst traffic, the daily quota caps
 * total backend spend per key per UTC day. This is the primary control that
 * keeps the app from being abused as a free gateway to Azure even if an
 * attacker paces their requests slowly.
 *
 * Tracks counts in an in-memory Map keyed by `${key}:${utcDay}`.
 *
 * NOTE: this resets on process restart. For a durable quota in production
 * with multiple replicas, back this by Redis or persist to Mongo with an
 * indexed `(key, day)` collection. For single-instance Railway, memory is
 * acceptable — an attacker who can reliably trigger restarts is a separate
 * problem.
 */
import type { NextFunction, Request, Response } from 'express';

export interface DailyQuotaOptions {
  name: string;
  /** Max requests per key per UTC day. */
  max: number;
  /** Optional key function. Defaults to user id then IP. */
  keyBy?: (req: Request) => string;
  /** Skip unauthenticated requests? Default false. */
  skipIfAnonymous?: boolean;
  /** Human-facing message included in the 429 response. */
  message?: string;
}

interface QuotaEntry {
  count: number;
  day: string;
}

const stores: Map<string, Map<string, QuotaEntry>> = new Map();

function getStore(name: string): Map<string, QuotaEntry> {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

function currentUtcDay(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

function defaultKeyBy(req: Request): string {
  const user = (req as Request & { user?: { id?: string } }).user;
  if (user?.id) return `u:${user.id}`;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

export function createDailyQuota(opts: DailyQuotaOptions) {
  const { name, max, keyBy = defaultKeyBy, skipIfAnonymous = false, message } = opts;
  const store = getStore(name);

  return function dailyQuotaMiddleware(req: Request, res: Response, next: NextFunction): void {
    const user = (req as Request & { user?: unknown }).user;
    if (skipIfAnonymous && !user) {
      next();
      return;
    }

    const key = keyBy(req);
    const day = currentUtcDay();
    const storeKey = `${key}:${day}`;
    const entry = store.get(storeKey);

    // Opportunistic cleanup: when creating a new entry, scrub entries from
    // previous days belonging to the same key. This keeps the store bounded.
    if (!entry) {
      for (const existingKey of store.keys()) {
        if (existingKey.startsWith(`${key}:`) && !existingKey.endsWith(`:${day}`)) {
          store.delete(existingKey);
        }
      }
      store.set(storeKey, { count: 1, day });
      res.setHeader('X-Quota-Limit', String(max));
      res.setHeader('X-Quota-Remaining', String(max - 1));
      next();
      return;
    }

    if (entry.count >= max) {
      console.warn(
        `[DailyQuota] blocked name=${name} key=${key} day=${day} max=${max} path=${req.path}`
      );
      res.setHeader('X-Quota-Limit', String(max));
      res.setHeader('X-Quota-Remaining', '0');
      res.status(429).json({
        error: 'Daily quota exceeded',
        message:
          message ||
          'You have reached the daily request limit. The quota resets at 00:00 UTC.',
      });
      return;
    }

    entry.count += 1;
    res.setHeader('X-Quota-Limit', String(max));
    res.setHeader('X-Quota-Remaining', String(Math.max(0, max - entry.count)));
    next();
  };
}

/**
 * Persistent, server-authoritative assessment quota enforcement.
 *
 * This is the primary control that keeps a personal-project Azure bill bounded
 * once self-serve registration is open. It runs on the pronunciation assessment
 * request path BEFORE audio conversion / the Azure call, and enforces three
 * caps, all backed by the DB (AssessmentUsageModel) so they survive restarts:
 *
 *   1. Per-user DAILY cap    (ASSESSMENT_DAILY_LIMIT,     default 10)  → 429 DAILY_LIMIT
 *   2. Per-user LIFETIME cap  (ASSESSMENT_LIFETIME_LIMIT,  default 40)  → 429 LIFETIME_LIMIT
 *   3. GLOBAL daily breaker   (GLOBAL_DAILY_ASSESSMENT_LIMIT, default 300) → 503 GLOBAL_LIMIT
 *
 * Exempt accounts (User.assessmentExempt — set for invite-code registrations —
 * or an email in EXEMPT_USER_EMAILS) skip the per-user caps (1 & 2). The GLOBAL
 * breaker (3) is a hard Azure-billing backstop and applies to EVERYONE,
 * including exempt users.
 *
 * COUNTING MODEL — "reserve then gate": each request atomically $inc's the
 * relevant counters up front (reserving its slot), then checks whether it
 * exceeded a limit; if so it rolls the counters back and rejects. This is
 * race-free under concurrency (two simultaneous requests get distinct post-inc
 * values), unlike a read-then-write check. A reserved slot is NOT refunded if
 * the subsequent Azure call fails — that is deliberate: a request that reaches
 * Azure has already had the chance to incur cost, so it counts.
 *
 * The in-memory sliding-window rate limiter (pronunciationSecurity) still runs
 * in front of this as burst protection.
 */
import type { NextFunction, Request, Response } from 'express';
import { AssessmentUsageModel } from '../models/AssessmentUsageModel';
import { UserModel } from '../models/UserModel';
import { ERROR_CLASS } from '../../lib/errorTaxonomy';
import { parsePositiveIntEnv } from './rateLimit';

export const DEFAULT_ASSESSMENT_DAILY_LIMIT = 10;
export const DEFAULT_ASSESSMENT_LIFETIME_LIMIT = 40;
export const DEFAULT_GLOBAL_DAILY_ASSESSMENT_LIMIT = 300;

export type AssessmentLimitType = 'DAILY_LIMIT' | 'LIFETIME_LIMIT' | 'GLOBAL_LIMIT';

export interface AssessmentQuotaState {
  dailyUsed: number;
  dailyLimit: number;
  lifetimeUsed: number;
  lifetimeLimit: number;
  exempt: boolean;
}

export interface AssessmentLimits {
  daily: number;
  lifetime: number;
  global: number;
}

export function getAssessmentLimits(): AssessmentLimits {
  return {
    daily: parsePositiveIntEnv(process.env.ASSESSMENT_DAILY_LIMIT, DEFAULT_ASSESSMENT_DAILY_LIMIT),
    lifetime: parsePositiveIntEnv(
      process.env.ASSESSMENT_LIFETIME_LIMIT,
      DEFAULT_ASSESSMENT_LIFETIME_LIMIT
    ),
    global: parsePositiveIntEnv(
      process.env.GLOBAL_DAILY_ASSESSMENT_LIMIT,
      DEFAULT_GLOBAL_DAILY_ASSESSMENT_LIMIT
    ),
  };
}

/** Comma-separated allowlist of always-exempt emails (case-insensitive). */
export function getExemptEmails(): Set<string> {
  return new Set(
    (process.env.EXEMPT_USER_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function currentUtcDay(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(
    now.getUTCDate()
  ).padStart(2, '0')}`;
}

function globalKey(day: string): string {
  return `global:${day}`;
}
function userDayKey(userId: string, day: string): string {
  return `user:${userId}:${day}`;
}
function userLifetimeKey(userId: string): string {
  return `user:${userId}:lifetime`;
}

function extractUser(req: Request): { id?: string; email?: string } {
  const user = (req as Request & { user?: { id?: string; email?: string } }).user;
  return { id: user?.id, email: user?.email };
}

/**
 * Resolve whether the account is exempt from per-user caps. Checks the free
 * email allowlist first (no DB round-trip), then the persisted
 * User.assessmentExempt flag.
 */
export async function resolveExempt(userId: string, email: string | undefined): Promise<boolean> {
  if (email && getExemptEmails().has(email.toLowerCase())) {
    return true;
  }
  try {
    const userDoc = await UserModel.findById(userId).select('assessmentExempt').lean();
    return Boolean((userDoc as { assessmentExempt?: boolean } | null)?.assessmentExempt);
  } catch {
    // On a lookup failure, do NOT grant exemption — fail closed toward the cap.
    return false;
  }
}

async function incrUsage(key: string): Promise<number> {
  const doc = await AssessmentUsageModel.findOneAndUpdate(
    { key },
    { $inc: { count: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return (doc as { count?: number } | null)?.count ?? 0;
}

async function decrUsage(key: string): Promise<void> {
  await AssessmentUsageModel.updateOne({ key }, { $inc: { count: -1 } }).catch(() => {
    /* best-effort rollback */
  });
}

async function readUsage(key: string): Promise<number> {
  const doc = await AssessmentUsageModel.findOne({ key }).select('count').lean();
  return (doc as { count?: number } | null)?.count ?? 0;
}

/**
 * Read-only current quota state (no increment). Used by the quota-display
 * endpoint so the UI can show remaining allowance without spending a slot.
 */
export async function computeQuotaState(
  userId: string,
  email: string | undefined,
  now: Date = new Date()
): Promise<AssessmentQuotaState> {
  const day = currentUtcDay(now);
  const limits = getAssessmentLimits();
  const exempt = await resolveExempt(userId, email);
  const [dailyUsed, lifetimeUsed] = await Promise.all([
    readUsage(userDayKey(userId, day)),
    readUsage(userLifetimeKey(userId)),
  ]);
  return {
    dailyUsed,
    dailyLimit: limits.daily,
    lifetimeUsed,
    lifetimeLimit: limits.lifetime,
    exempt,
  };
}

/** Mirror the daily quota onto the legacy X-Quota-* headers the client hook already reads. */
function setQuotaHeaders(res: Response, state: AssessmentQuotaState): void {
  res.setHeader('X-Quota-Limit', String(state.dailyLimit));
  res.setHeader('X-Quota-Remaining', String(Math.max(0, state.dailyLimit - state.dailyUsed)));
  res.setHeader('X-Assessment-Daily-Used', String(state.dailyUsed));
  res.setHeader('X-Assessment-Daily-Limit', String(state.dailyLimit));
  res.setHeader('X-Assessment-Lifetime-Used', String(state.lifetimeUsed));
  res.setHeader('X-Assessment-Lifetime-Limit', String(state.lifetimeLimit));
  res.setHeader('X-Assessment-Exempt', state.exempt ? '1' : '0');
}

/**
 * Enforcement middleware. Place it BEFORE the upload/handler in the assessment
 * route chain (after requireAuth, which populates req.user).
 */
export async function assessmentQuotaMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { id: userId, email } = extractUser(req);

  // requireAuth runs before this; if somehow unauthenticated, fail closed.
  if (!userId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication is required for pronunciation assessment.',
    });
    return;
  }

  const day = currentUtcDay();
  const limits = getAssessmentLimits();
  const gKey = globalKey(day);
  const dKey = userDayKey(userId, day);
  const lKey = userLifetimeKey(userId);

  try {
    const exempt = await resolveExempt(userId, email);

    // 1. GLOBAL breaker — reserve a global slot first (applies to everyone).
    const newGlobal = await incrUsage(gKey);
    if (newGlobal > limits.global) {
      await decrUsage(gKey);
      res.status(503).json({
        error: 'Daily capacity reached',
        message:
          'This app has reached its daily assessment capacity. This is a personal project ' +
          'with a hard cap on Azure spend — please try again after 00:00 UTC.',
        errorClass: ERROR_CLASS.serverRateLimited,
        limitType: 'GLOBAL_LIMIT' as AssessmentLimitType,
        quota: {
          dailyUsed: await readUsage(dKey),
          dailyLimit: limits.daily,
          lifetimeUsed: await readUsage(lKey),
          lifetimeLimit: limits.lifetime,
          exempt,
        },
      });
      return;
    }

    // 2 & 3. Reserve per-user slots (always, so usage display is honest), then
    // gate only when the account is not exempt.
    const newLifetime = await incrUsage(lKey);
    const newDaily = await incrUsage(dKey);

    if (!exempt && newLifetime > limits.lifetime) {
      await Promise.all([decrUsage(dKey), decrUsage(lKey), decrUsage(gKey)]);
      const state: AssessmentQuotaState = {
        dailyUsed: newDaily - 1,
        dailyLimit: limits.daily,
        lifetimeUsed: newLifetime - 1,
        lifetimeLimit: limits.lifetime,
        exempt,
      };
      setQuotaHeaders(res, state);
      res.status(429).json({
        error: 'Lifetime assessment limit reached',
        message:
          `You have used all ${limits.lifetime} lifetime pronunciation assessments for this ` +
          'free account. Azure charges this personal project for every assessment, so there is ' +
          'a lifetime cap. Have an invite code? Register with one to lift the limit.',
        errorClass: ERROR_CLASS.serverRateLimited,
        limitType: 'LIFETIME_LIMIT' as AssessmentLimitType,
        quota: state,
      });
      return;
    }

    if (!exempt && newDaily > limits.daily) {
      await Promise.all([decrUsage(dKey), decrUsage(lKey), decrUsage(gKey)]);
      const state: AssessmentQuotaState = {
        dailyUsed: newDaily - 1,
        dailyLimit: limits.daily,
        lifetimeUsed: newLifetime - 1,
        lifetimeLimit: limits.lifetime,
        exempt,
      };
      setQuotaHeaders(res, state);
      res.status(429).json({
        error: 'Daily assessment limit reached',
        message:
          `You have used all ${limits.daily} pronunciation assessments for today. The daily ` +
          'allowance resets at 00:00 UTC. Have an invite code? Register with one to lift the limit.',
        errorClass: ERROR_CLASS.serverRateLimited,
        limitType: 'DAILY_LIMIT' as AssessmentLimitType,
        quota: state,
      });
      return;
    }

    // Allowed. Expose the post-increment state to the client via headers and by
    // injecting a `quota` field into the (2xx JSON) assessment response body.
    const state: AssessmentQuotaState = {
      dailyUsed: newDaily,
      dailyLimit: limits.daily,
      lifetimeUsed: newLifetime,
      lifetimeLimit: limits.lifetime,
      exempt,
    };
    setQuotaHeaders(res, state);
    (res as Response & { locals: Record<string, unknown> }).locals.assessmentQuota = state;

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (
        res.statusCode >= 200 &&
        res.statusCode < 300 &&
        body &&
        typeof body === 'object' &&
        !Array.isArray(body)
      ) {
        (body as Record<string, unknown>).quota = state;
      }
      return originalJson(body as never);
    }) as Response['json'];

    next();
  } catch (error) {
    // Never let a quota-accounting error hard-fail the request path. We fail
    // OPEN (proceed) so a transient DB hiccup doesn't block a legitimate user —
    // the in-memory burst limiter still bounds the worst case. We intentionally
    // do NOT roll back here: any counter that was incremented stays incremented
    // (conservative for billing), and blind decrements could corrupt counts
    // that this request never touched.
    console.error(
      '[AssessmentQuota] accounting error, failing open:',
      error instanceof Error ? error.message : error
    );
    next();
  }
}

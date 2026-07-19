import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

// ─────────────────────────────────────────────────────────────────
// In-memory mock of the AssessmentUsageModel counter collection.
// findOneAndUpdate($inc +1) mutates synchronously before resolving, mirroring
// the atomic server-side increment the middleware relies on for race-free
// "reserve then gate" accounting.
// ─────────────────────────────────────────────────────────────────
const counters = vi.hoisted(() => new Map<string, number>());

function chainLean<T>(value: T) {
  return { lean: async () => value };
}
function chainSelectLean<T>(value: T) {
  return { select: () => chainLean(value) };
}

vi.mock('../models/AssessmentUsageModel', () => ({
  AssessmentUsageModel: {
    findOneAndUpdate: (filter: { key: string }) => {
      const next = (counters.get(filter.key) ?? 0) + 1;
      counters.set(filter.key, next);
      return chainLean({ count: next });
    },
    findOne: (filter: { key: string }) => chainSelectLean({ count: counters.get(filter.key) ?? 0 }),
    updateOne: (filter: { key: string }, update: { $inc?: { count?: number } }) => {
      const delta = update?.$inc?.count ?? 0;
      counters.set(filter.key, (counters.get(filter.key) ?? 0) + delta);
      return Promise.resolve({ acknowledged: true });
    },
  },
}));

const userFindByIdMock = vi.hoisted(() => vi.fn());
vi.mock('../models/UserModel', () => ({
  UserModel: {
    findById: (...args: unknown[]) => ({
      select: () => ({ lean: () => userFindByIdMock(...args) }),
    }),
  },
}));

import {
  assessmentQuotaMiddleware,
  computeQuotaState,
  currentUtcDay,
} from './assessmentQuota';

function createReq(user?: { id: string; email: string }): Request {
  return { user, ip: '127.0.0.1' } as unknown as Request;
}

function createRes(): Response & {
  body: any;
  statusCode: number;
  headers: Record<string, string>;
} {
  const res: any = { body: undefined, statusCode: 200, headers: {}, locals: {} };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });
  res.setHeader = vi.fn((k: string, v: string) => {
    res.headers[k] = v;
    return res;
  });
  return res;
}

const day = currentUtcDay();

describe('assessmentQuotaMiddleware', () => {
  beforeEach(() => {
    counters.clear();
    userFindByIdMock.mockReset();
    userFindByIdMock.mockResolvedValue({ assessmentExempt: false });
    delete process.env.ASSESSMENT_DAILY_LIMIT;
    delete process.env.ASSESSMENT_LIFETIME_LIMIT;
    delete process.env.GLOBAL_DAILY_ASSESSMENT_LIMIT;
    delete process.env.EXEMPT_USER_EMAILS;
  });

  afterEach(() => {
    delete process.env.ASSESSMENT_DAILY_LIMIT;
    delete process.env.ASSESSMENT_LIFETIME_LIMIT;
    delete process.env.GLOBAL_DAILY_ASSESSMENT_LIMIT;
    delete process.env.EXEMPT_USER_EMAILS;
  });

  it('allows a request under all caps, calls next, and injects quota into 2xx bodies', async () => {
    const req = createReq({ id: 'user-1', email: 'a@example.com' });
    const res = createRes();
    const next = vi.fn();

    await assessmentQuotaMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    // Daily headers mirror the legacy X-Quota-* contract the client reads.
    expect(res.headers['X-Quota-Limit']).toBe('10');
    expect(res.headers['X-Quota-Remaining']).toBe('9');
    expect(res.headers['X-Assessment-Lifetime-Limit']).toBe('40');

    // The wrapped res.json injects the quota object on success responses.
    res.statusCode = 200;
    res.json({ rawAzure: {}, attemptScore: {} });
    expect(res.body.quota).toEqual({
      dailyUsed: 1,
      dailyLimit: 10,
      lifetimeUsed: 1,
      lifetimeLimit: 40,
      exempt: false,
    });
  });

  it('rejects with 429 DAILY_LIMIT once the daily cap is reached', async () => {
    counters.set(`user:user-1:${day}`, 10); // already used all 10 today
    counters.set(`user:user-1:lifetime`, 10);
    const req = createReq({ id: 'user-1', email: 'a@example.com' });
    const res = createRes();
    const next = vi.fn();

    await assessmentQuotaMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.limitType).toBe('DAILY_LIMIT');
    expect(res.body.quota).toEqual({
      dailyUsed: 10,
      dailyLimit: 10,
      lifetimeUsed: 10,
      lifetimeLimit: 40,
      exempt: false,
    });
    // Reserved slots were rolled back — counters returned to their prior values.
    expect(counters.get(`user:user-1:${day}`)).toBe(10);
    expect(counters.get(`user:user-1:lifetime`)).toBe(10);
    expect(counters.get(`global:${day}`)).toBe(0);
  });

  it('rejects with 429 LIFETIME_LIMIT once the lifetime cap is reached', async () => {
    counters.set(`user:user-1:lifetime`, 40); // lifetime exhausted
    const req = createReq({ id: 'user-1', email: 'a@example.com' });
    const res = createRes();
    const next = vi.fn();

    await assessmentQuotaMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.limitType).toBe('LIFETIME_LIMIT');
    expect(res.body.quota.lifetimeUsed).toBe(40);
    expect(res.body.quota.lifetimeLimit).toBe(40);
    expect(counters.get(`global:${day}`)).toBe(0);
  });

  it('lets exempt users past the per-user caps (via User.assessmentExempt)', async () => {
    userFindByIdMock.mockResolvedValue({ assessmentExempt: true });
    counters.set(`user:user-1:${day}`, 999);
    counters.set(`user:user-1:lifetime`, 999);
    const req = createReq({ id: 'user-1', email: 'a@example.com' });
    const res = createRes();
    const next = vi.fn();

    await assessmentQuotaMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.headers['X-Assessment-Exempt']).toBe('1');
  });

  it('lets exempt users past via the EXEMPT_USER_EMAILS allowlist (no DB lookup)', async () => {
    process.env.EXEMPT_USER_EMAILS = 'owner@example.com, other@example.com';
    counters.set(`user:user-1:${day}`, 999);
    counters.set(`user:user-1:lifetime`, 999);
    const req = createReq({ id: 'user-1', email: 'Owner@Example.com' });
    const res = createRes();
    const next = vi.fn();

    await assessmentQuotaMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(userFindByIdMock).not.toHaveBeenCalled();
  });

  it('trips the GLOBAL circuit breaker with 503 for everyone, including exempt users', async () => {
    process.env.GLOBAL_DAILY_ASSESSMENT_LIMIT = '5';
    userFindByIdMock.mockResolvedValue({ assessmentExempt: true });
    counters.set(`global:${day}`, 5); // global capacity already reached
    const req = createReq({ id: 'user-1', email: 'a@example.com' });
    const res = createRes();
    const next = vi.fn();

    await assessmentQuotaMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body.limitType).toBe('GLOBAL_LIMIT');
    // Reserved global slot rolled back.
    expect(counters.get(`global:${day}`)).toBe(5);
  });

  it('429 body has the documented structured shape', async () => {
    counters.set(`user:user-1:${day}`, 10);
    const req = createReq({ id: 'user-1', email: 'a@example.com' });
    const res = createRes();
    await assessmentQuotaMiddleware(req, res, vi.fn());

    expect(res.body).toMatchObject({
      error: expect.any(String),
      message: expect.any(String),
      errorClass: 'server_rate_limited',
      limitType: 'DAILY_LIMIT',
      quota: {
        dailyUsed: expect.any(Number),
        dailyLimit: expect.any(Number),
        lifetimeUsed: expect.any(Number),
        lifetimeLimit: expect.any(Number),
        exempt: expect.any(Boolean),
      },
    });
  });

  it('honors env-configured limits', async () => {
    process.env.ASSESSMENT_DAILY_LIMIT = '2';
    counters.set(`user:user-1:${day}`, 2);
    const req = createReq({ id: 'user-1', email: 'a@example.com' });
    const res = createRes();
    await assessmentQuotaMiddleware(req, res, vi.fn());
    expect(res.statusCode).toBe(429);
    expect(res.body.quota.dailyLimit).toBe(2);
  });

  it('401s if reached without an authenticated user', async () => {
    const req = createReq(undefined);
    const res = createRes();
    const next = vi.fn();
    await assessmentQuotaMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('computeQuotaState (read-only)', () => {
  beforeEach(() => {
    counters.clear();
    userFindByIdMock.mockReset();
    userFindByIdMock.mockResolvedValue({ assessmentExempt: false });
    delete process.env.EXEMPT_USER_EMAILS;
  });

  it('reports current counts without incrementing', async () => {
    counters.set(`user:user-1:${day}`, 3);
    counters.set(`user:user-1:lifetime`, 7);
    const state = await computeQuotaState('user-1', 'a@example.com');
    expect(state).toEqual({
      dailyUsed: 3,
      dailyLimit: 10,
      lifetimeUsed: 7,
      lifetimeLimit: 40,
      exempt: false,
    });
    // No mutation from a read.
    expect(counters.get(`user:user-1:${day}`)).toBe(3);
    expect(counters.get(`user:user-1:lifetime`)).toBe(7);
  });
});

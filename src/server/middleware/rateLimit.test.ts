import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createRateLimit } from './rateLimit';
import { createDailyQuota } from './dailyQuota';

function mockReq(ip = '1.2.3.4', user?: { id: string }): Request {
  return {
    ip,
    socket: { remoteAddress: ip },
    user,
    path: '/test',
    method: 'POST',
    body: {},
  } as unknown as Request;
}

function mockRes(): Response & { statusCode: number; body?: unknown; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  } as unknown as Response & { statusCode: number; body?: unknown; headers: Record<string, string> };
  return res;
}

describe('createRateLimit', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit and blocks once exceeded', () => {
    const limiter = createRateLimit({ name: 'test:underover', windowMs: 60_000, max: 3 });
    const next = vi.fn() as unknown as NextFunction;

    for (let i = 0; i < 3; i++) {
      const res = mockRes();
      limiter(mockReq('9.9.9.9'), res, next);
    }
    expect((next as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(3);

    const blockedRes = mockRes();
    const blockedNext = vi.fn() as unknown as NextFunction;
    limiter(mockReq('9.9.9.9'), blockedRes, blockedNext);
    expect(blockedRes.statusCode).toBe(429);
    expect(blockedRes.headers['retry-after']).toBeDefined();
    expect(blockedNext).not.toHaveBeenCalled();
  });

  it('separates buckets by IP', () => {
    const limiter = createRateLimit({ name: 'test:perip', windowMs: 60_000, max: 1 });
    const next = vi.fn() as unknown as NextFunction;

    const res1 = mockRes();
    limiter(mockReq('1.1.1.1'), res1, next);
    const res2 = mockRes();
    limiter(mockReq('2.2.2.2'), res2, next);

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect((next as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2);
  });

  it('keys on authenticated user id when available', () => {
    const limiter = createRateLimit({ name: 'test:user', windowMs: 60_000, max: 1 });
    const next = vi.fn() as unknown as NextFunction;

    // Different IPs, same user — should count as one bucket.
    const res1 = mockRes();
    limiter(mockReq('1.1.1.1', { id: 'user-x' }), res1, next);
    const res2 = mockRes();
    limiter(mockReq('2.2.2.2', { id: 'user-x' }), res2, next);

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(429);
  });
});

describe('createDailyQuota', () => {
  it('enforces per-user daily max and exposes quota headers', () => {
    const quota = createDailyQuota({ name: 'test:daily', max: 2 });
    const next = vi.fn() as unknown as NextFunction;

    const r1 = mockRes();
    quota(mockReq('1.1.1.1', { id: 'u1' }), r1, next);
    expect(r1.statusCode).toBe(200);
    expect(r1.headers['x-quota-limit']).toBe('2');
    expect(r1.headers['x-quota-remaining']).toBe('1');

    const r2 = mockRes();
    quota(mockReq('1.1.1.1', { id: 'u1' }), r2, next);
    expect(r2.statusCode).toBe(200);
    expect(r2.headers['x-quota-remaining']).toBe('0');

    const r3 = mockRes();
    const blockedNext = vi.fn() as unknown as NextFunction;
    quota(mockReq('1.1.1.1', { id: 'u1' }), r3, blockedNext);
    expect(r3.statusCode).toBe(429);
    expect(blockedNext).not.toHaveBeenCalled();
  });

  it('keys different users separately', () => {
    const quota = createDailyQuota({ name: 'test:daily-multi', max: 1 });
    const next = vi.fn() as unknown as NextFunction;

    const r1 = mockRes();
    quota(mockReq('1.1.1.1', { id: 'alpha' }), r1, next);
    const r2 = mockRes();
    quota(mockReq('1.1.1.1', { id: 'beta' }), r2, next);

    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
  });

  it('optionally skips anonymous traffic', () => {
    const quota = createDailyQuota({ name: 'test:daily-skip', max: 1, skipIfAnonymous: true });
    const next = vi.fn() as unknown as NextFunction;

    const r1 = mockRes();
    quota(mockReq('1.1.1.1'), r1, next);
    const r2 = mockRes();
    quota(mockReq('1.1.1.1'), r2, next);

    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200); // anonymous passthrough
  });
});

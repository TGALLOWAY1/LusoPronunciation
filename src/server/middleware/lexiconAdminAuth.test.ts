import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import { requireLexiconAdmin } from './lexiconAdminAuth';
import type { AuthenticatedRequest } from './auth';

function makeReq(userId?: string): AuthenticatedRequest {
  return { user: userId ? { id: userId, email: 'a@b' } : undefined } as AuthenticatedRequest;
}

function makeRes(): { res: Response; statusFn: ReturnType<typeof vi.fn>; jsonFn: ReturnType<typeof vi.fn> } {
  const jsonFn = vi.fn();
  const statusFn = vi.fn(() => ({ json: jsonFn })) as any;
  return {
    res: { status: statusFn } as unknown as Response,
    statusFn,
    jsonFn,
  };
}

const originalEnv = { ...process.env };

describe('requireLexiconAdmin', () => {
  beforeEach(() => {
    delete process.env.LEXICON_ADMIN_USER_IDS;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('401s when no user is attached to the request', () => {
    const next = vi.fn();
    const { res, statusFn } = makeRes();
    requireLexiconAdmin(makeReq(undefined), res, next as unknown as NextFunction);
    expect(statusFn).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('in non-production with empty allowlist, lets any signed-in user through', () => {
    process.env.NODE_ENV = 'development';
    const next = vi.fn();
    const { res } = makeRes();
    requireLexiconAdmin(makeReq('user-1'), res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('in production with empty allowlist, denies all access', () => {
    process.env.NODE_ENV = 'production';
    const next = vi.fn();
    const { res, statusFn } = makeRes();
    requireLexiconAdmin(makeReq('user-1'), res, next as unknown as NextFunction);
    expect(statusFn).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('admits users listed in LEXICON_ADMIN_USER_IDS', () => {
    process.env.NODE_ENV = 'production';
    process.env.LEXICON_ADMIN_USER_IDS = 'user-1,user-2';
    const next = vi.fn();
    const { res } = makeRes();
    requireLexiconAdmin(makeReq('user-2'), res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('denies users not in the allowlist', () => {
    process.env.NODE_ENV = 'production';
    process.env.LEXICON_ADMIN_USER_IDS = 'user-1';
    const next = vi.fn();
    const { res, statusFn } = makeRes();
    requireLexiconAdmin(makeReq('user-9'), res, next as unknown as NextFunction);
    expect(statusFn).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

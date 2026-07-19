import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

// ─────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────
//
// InviteCodeModel.findOneAndUpdate is mocked with an in-memory "document"
// whose usedCount/maxUses fields are mutated synchronously inside the mock,
// mirroring how MongoDB evaluates a filter + update atomically server-side.
// Because the mock body itself never awaits before mutating state, two
// "concurrent" calls (via Promise.all) still can't interleave mid-check —
// which is exactly the property the atomic findOneAndUpdate rewrite in
// auth.ts is supposed to provide instead of the old read-then-$inc race.

interface MockInvite {
  _id: { toString: () => string };
  code: string;
  usedCount: number;
  maxUses: number;
  isActive: boolean;
  expiresAt?: Date;
  usedBy: unknown[];
}

let invite: MockInvite;

function resetInvite(overrides: Partial<MockInvite> = {}) {
  invite = {
    _id: { toString: () => 'invite-id' },
    code: 'LAUNCH-ACCESS',
    usedCount: 0,
    maxUses: 1,
    isActive: true,
    expiresAt: undefined,
    usedBy: [],
    ...overrides,
  };
}

const inviteFindOneAndUpdateMock = vi.hoisted(() => vi.fn());
const inviteUpdateOneMock = vi.hoisted(() => vi.fn());

vi.mock('../models/InviteCodeModel', () => ({
  InviteCodeModel: {
    findOneAndUpdate: (...args: unknown[]) => inviteFindOneAndUpdateMock(...args),
    updateOne: (...args: unknown[]) => inviteUpdateOneMock(...args),
  },
}));

const userFindOneMock = vi.hoisted(() => vi.fn());
const userSaveMock = vi.hoisted(() => vi.fn());

vi.mock('../models/UserModel', () => {
  class MockUserModel {
    _id = { toString: () => `user-${Math.random().toString(36).slice(2)}` };
    createdAt = new Date('2026-01-01T00:00:00.000Z');
    email!: string;
    passwordHash?: string;
    displayName?: string;

    constructor(doc: Record<string, unknown>) {
      Object.assign(this, doc);
    }

    save() {
      return userSaveMock(this);
    }

    static findOne(...args: unknown[]) {
      return userFindOneMock(...args);
    }
  }
  return { UserModel: MockUserModel };
});

import authRouter from './auth';

function createReq(body: unknown): Request {
  return { body, ip: '127.0.0.1' } as unknown as Request;
}

function createRes(): Response & { body: unknown; statusCode: number } {
  const res: Partial<Response> & { body: unknown; statusCode: number } = {
    body: undefined,
    statusCode: 200,
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as unknown as Response['status'];
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res as Response;
  }) as unknown as Response['json'];
  return res as Response & { body: unknown; statusCode: number };
}

function getRegisterHandler() {
  const layer = (authRouter as any).stack.find((l: any) => l.route?.path === '/register');
  // stack[0] is the per-IP rate limiter, stack[1] is the actual handler —
  // bypass rate limiting here since we're testing invite-code atomicity.
  return layer.route.stack[1].handle as (req: Request, res: Response) => Promise<void>;
}

function validRegistrationBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    email: `user-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'a-fine-password-1',
    inviteCode: 'launch-access',
    ...overrides,
  };
}

describe('POST /api/auth/register — atomic invite-code consumption', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.REQUIRE_INVITE_CODE = 'true';
    resetInvite();

    inviteFindOneAndUpdateMock.mockReset();
    inviteFindOneAndUpdateMock.mockImplementation(async (filter: any) => {
      const now = new Date();
      const codeMatches = filter.code === invite.code;
      const activeMatches = !filter.isActive || invite.isActive === filter.isActive;
      const notExpired =
        !invite.expiresAt ||
        invite.expiresAt > now;
      const underCap = invite.usedCount < invite.maxUses;

      if (!codeMatches || !activeMatches || !notExpired || !underCap) {
        return null;
      }

      // Atomic increment — this is the whole point under test: the
      // check-and-increment happens in one synchronous step, not across an
      // awaited read followed by a separate $inc.
      invite.usedCount += 1;
      return { ...invite };
    });

    inviteUpdateOneMock.mockReset();
    inviteUpdateOneMock.mockImplementation(async (filter: any, update: any) => {
      if (update?.$inc?.usedCount) {
        invite.usedCount += update.$inc.usedCount;
      }
      if (update?.$push?.usedBy) {
        invite.usedBy.push(update.$push.usedBy);
      }
      return { acknowledged: true };
    });

    userFindOneMock.mockReset();
    userFindOneMock.mockResolvedValue(null);

    userSaveMock.mockReset();
    userSaveMock.mockResolvedValue(undefined);
  });

  it('registers successfully and increments usedCount exactly once', async () => {
    const handler = getRegisterHandler();
    const req = createReq(validRegistrationBody());
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(invite.usedCount).toBe(1);
    expect(invite.usedBy).toHaveLength(1);
  });

  it('rejects registration once the invite code is exhausted', async () => {
    resetInvite({ usedCount: 1, maxUses: 1 });
    const handler = getRegisterHandler();
    const req = createReq(validRegistrationBody());
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'Invalid invite code',
      message: 'This invite code is not valid or has expired.',
    });
    // Rejected attempts must not touch usedCount.
    expect(invite.usedCount).toBe(1);
  });

  it('two concurrent registrations against maxUses=1 — exactly one succeeds', async () => {
    resetInvite({ usedCount: 0, maxUses: 1 });
    const handler = getRegisterHandler();

    const reqA = createReq(validRegistrationBody());
    const resA = createRes();
    const reqB = createReq(validRegistrationBody());
    const resB = createRes();

    await Promise.all([handler(reqA, resA), handler(reqB, resB)]);

    const statuses = [resA.statusCode, resB.statusCode].sort();
    expect(statuses).toEqual([201, 403]);
    // The invite slot was only ever consumed once, regardless of two
    // simultaneous requests racing the check.
    expect(invite.usedCount).toBe(1);
  });

  it('releases the invite slot (compensating decrement) if user creation fails after consumption', async () => {
    userSaveMock.mockRejectedValueOnce(new Error('simulated write failure'));

    const handler = getRegisterHandler();
    const req = createReq(validRegistrationBody());
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    // Consumed then released — net effect is zero, so the slot is still
    // available for a retry.
    expect(invite.usedCount).toBe(0);
  });

  it('releases the invite slot if the email is already registered', async () => {
    userFindOneMock.mockResolvedValueOnce({ _id: { toString: () => 'existing' } });

    const handler = getRegisterHandler();
    const req = createReq(validRegistrationBody());
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(invite.usedCount).toBe(0);
  });

  it('skips invite validation entirely when REQUIRE_INVITE_CODE=false', async () => {
    process.env.REQUIRE_INVITE_CODE = 'false';
    const handler = getRegisterHandler();
    const req = createReq(validRegistrationBody({ inviteCode: undefined }));
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(inviteFindOneAndUpdateMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/register — open signups (default) + anti-bot', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    // Default (unset) means OPEN signups now.
    delete process.env.REQUIRE_INVITE_CODE;
    resetInvite();

    inviteFindOneAndUpdateMock.mockReset();
    inviteFindOneAndUpdateMock.mockImplementation(async (filter: any) => {
      const now = new Date();
      const codeMatches = filter.code === invite.code;
      const activeMatches = !filter.isActive || invite.isActive === filter.isActive;
      const notExpired = !invite.expiresAt || invite.expiresAt > now;
      const underCap = invite.usedCount < invite.maxUses;
      if (!codeMatches || !activeMatches || !notExpired || !underCap) {
        return null;
      }
      invite.usedCount += 1;
      return { ...invite };
    });

    inviteUpdateOneMock.mockReset();
    inviteUpdateOneMock.mockImplementation(async (_filter: any, update: any) => {
      if (update?.$inc?.usedCount) invite.usedCount += update.$inc.usedCount;
      if (update?.$push?.usedBy) invite.usedBy.push(update.$push.usedBy);
      return { acknowledged: true };
    });

    userFindOneMock.mockReset();
    userFindOneMock.mockResolvedValue(null);
    userSaveMock.mockReset();
    userSaveMock.mockResolvedValue(undefined);
  });

  it('registers without any invite code and does NOT consume a code (standard account)', async () => {
    const handler = getRegisterHandler();
    const req = createReq(validRegistrationBody({ inviteCode: undefined }));
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(inviteFindOneAndUpdateMock).not.toHaveBeenCalled();
    // Standard accounts are not marked exempt.
    expect(userSaveMock.mock.calls[0][0].assessmentExempt).toBe(false);
  });

  it('registering with a VALID optional code consumes it and marks the account exempt', async () => {
    const handler = getRegisterHandler();
    const req = createReq(validRegistrationBody({ inviteCode: 'launch-access' }));
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(invite.usedCount).toBe(1);
    expect(userSaveMock.mock.calls[0][0].assessmentExempt).toBe(true);
  });

  it('registering with an INVALID optional code still fails (never silently ignored)', async () => {
    const handler = getRegisterHandler();
    const req = createReq(validRegistrationBody({ inviteCode: 'WRONG-CODE' }));
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'Invalid invite code',
      message: 'This invite code is not valid or has expired.',
    });
    expect(userSaveMock).not.toHaveBeenCalled();
  });

  it('rejects registration when the honeypot field is filled', async () => {
    const handler = getRegisterHandler();
    const req = createReq(validRegistrationBody({ inviteCode: undefined, botField: 'i-am-a-bot' }));
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(userSaveMock).not.toHaveBeenCalled();
    expect(inviteFindOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it('rejects registration from a disposable email domain', async () => {
    const handler = getRegisterHandler();
    const req = createReq(
      validRegistrationBody({ inviteCode: undefined, email: 'throwaway@mailinator.com' })
    );
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Invalid email');
    expect(userSaveMock).not.toHaveBeenCalled();
  });
});

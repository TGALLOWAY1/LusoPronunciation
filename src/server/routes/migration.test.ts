import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';

const practiceSessionFindMock = vi.hoisted(() => vi.fn());
const practiceSessionInsertManyMock = vi.hoisted(() => vi.fn());
const attemptFindMock = vi.hoisted(() => vi.fn());
const attemptInsertManyMock = vi.hoisted(() => vi.fn());

vi.mock('../models/PracticeSessionModel', () => ({
  PracticeSessionModel: {
    find: (...args: unknown[]) => practiceSessionFindMock(...args),
    insertMany: (...args: unknown[]) => practiceSessionInsertManyMock(...args),
  },
}));

vi.mock('../models/PronunciationAttemptModel', () => ({
  PronunciationAttemptModel: {
    find: (...args: unknown[]) => attemptFindMock(...args),
    insertMany: (...args: unknown[]) => attemptInsertManyMock(...args),
  },
}));

import migrationRouter, {
  sessionAlreadyExists,
  attemptAlreadyExists,
} from './migration';

// ─────────────────────────────────────────────────────────────────
// Pure-function unit tests (no DB / mocking needed)
// ─────────────────────────────────────────────────────────────────

describe('sessionAlreadyExists', () => {
  const existing = [
    { mode: 'sentences', startedAt: new Date('2026-01-01T00:00:00.000Z') },
  ];

  it('matches when mode is equal and startedAt is within the 1s window', () => {
    expect(
      sessionAlreadyExists(existing, 'sentences', new Date('2026-01-01T00:00:00.500Z'))
    ).toBe(true);
  });

  it('does not match when mode differs', () => {
    expect(
      sessionAlreadyExists(existing, 'words', new Date('2026-01-01T00:00:00.000Z'))
    ).toBe(false);
  });

  it('does not match when startedAt is outside the window', () => {
    expect(
      sessionAlreadyExists(existing, 'sentences', new Date('2026-01-01T00:00:05.000Z'))
    ).toBe(false);
  });

  it('returns false for an invalid startedAt without throwing', () => {
    expect(sessionAlreadyExists(existing, 'sentences', new Date('not-a-date'))).toBe(false);
  });
});

describe('attemptAlreadyExists', () => {
  const existing = [
    { contentId: 'sent-1', createdAt: new Date('2026-01-01T00:00:00.000Z') },
  ];

  it('matches when contentId is equal and createdAt is within the 5s window', () => {
    expect(
      attemptAlreadyExists(existing, 'sent-1', new Date('2026-01-01T00:00:04.000Z'))
    ).toBe(true);
  });

  it('does not match when contentId differs', () => {
    expect(
      attemptAlreadyExists(existing, 'sent-2', new Date('2026-01-01T00:00:00.000Z'))
    ).toBe(false);
  });

  it('does not match when createdAt is outside the window', () => {
    expect(
      attemptAlreadyExists(existing, 'sent-1', new Date('2026-01-01T00:00:10.000Z'))
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Route-level batching test: mocks Mongoose models so we can assert
// (a) the response shape/counts are preserved and (b) the DB is only hit a
// constant number of times regardless of payload size (one existence-check
// query + one insertMany per collection, instead of one round-trip per
// record).
// ─────────────────────────────────────────────────────────────────

function createReq(userId: string, body: unknown): AuthenticatedRequest {
  return {
    user: { id: userId, email: 'migration-test@example.com' },
    body,
  } as unknown as AuthenticatedRequest;
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

function getLocalStorageHandler() {
  const layer = (migrationRouter as any).stack.find(
    (l: any) => l.route?.path === '/local-storage'
  );
  // stack[0] is requireAuth, stack[1] is the actual async handler — bypass
  // auth here since we're testing migration logic, not JWT verification.
  return layer.route.stack[1].handle as (
    req: AuthenticatedRequest,
    res: Response
  ) => Promise<void>;
}

describe('POST /api/migrate/local-storage batching', () => {
  beforeEach(() => {
    practiceSessionFindMock.mockReset();
    practiceSessionInsertManyMock.mockReset();
    attemptFindMock.mockReset();
    attemptInsertManyMock.mockReset();

    practiceSessionFindMock.mockReturnValue({ lean: () => Promise.resolve([]) });
    attemptFindMock.mockReturnValue({ lean: () => Promise.resolve([]) });
    practiceSessionInsertManyMock.mockImplementation(async (docs: Array<{ _id: mongoose.Types.ObjectId }>) =>
      docs.map((d) => ({ _id: d._id }))
    );
    attemptInsertManyMock.mockImplementation(async (docs: Array<{ _id: mongoose.Types.ObjectId }>) =>
      docs.map((d) => ({ _id: d._id }))
    );
  });

  it('preserves response counts and only issues one query + one insertMany per collection', async () => {
    // One existing session (duplicate) matching the batched query result.
    practiceSessionFindMock.mockReturnValueOnce({
      lean: () =>
        Promise.resolve([{ mode: 'words', startedAt: new Date('2026-01-02T00:00:00.000Z') }]),
    });
    // One existing sentence attempt (duplicate).
    attemptFindMock.mockReturnValueOnce({
      lean: () =>
        Promise.resolve([{ contentId: 'sent-2', createdAt: new Date('2026-01-01T00:02:00.000Z') }]),
    });

    const payload = {
      sessions: [
        {
          sessionId: 's1',
          userId: 'u1',
          startedAt: '2026-01-01T00:00:00.000Z',
          endedAt: '2026-01-01T00:05:00.000Z',
          durationSeconds: 300,
          mode: 'sentences',
          totalAttempts: 2,
          sentenceAttempts: 1,
          wordAttempts: 1,
        },
        {
          // Duplicate — should be skipped and never inserted.
          sessionId: 's2',
          userId: 'u1',
          startedAt: '2026-01-02T00:00:00.000Z',
          endedAt: '2026-01-02T00:05:00.000Z',
          durationSeconds: 300,
          mode: 'words',
          totalAttempts: 1,
          sentenceAttempts: 0,
          wordAttempts: 1,
        },
      ],
      sentenceAttempts: [
        {
          attemptId: 'sa1',
          userId: 'u1',
          sessionId: 's1',
          sentenceId: 'sent-1',
          createdAt: '2026-01-01T00:01:00.000Z',
          overallScore: 80,
          accuracyScore: 80,
          fluencyScore: 80,
          completenessScore: 80,
        },
        {
          // Duplicate — should be skipped.
          attemptId: 'sa2',
          userId: 'u1',
          sessionId: 's1',
          sentenceId: 'sent-2',
          createdAt: '2026-01-01T00:02:00.000Z',
          overallScore: 70,
          accuracyScore: 70,
          fluencyScore: 70,
          completenessScore: 70,
        },
      ],
      wordAttempts: [
        {
          attemptId: 'wa1',
          userId: 'u1',
          sessionId: 's1',
          wordId: 'word-1',
          createdAt: '2026-01-01T00:03:00.000Z',
          overallScore: 90,
          accuracyScore: 90,
        },
      ],
    };

    const req = createReq(new mongoose.Types.ObjectId().toString(), payload);
    const res = createRes();

    const handler = getLocalStorageHandler();
    await handler(req, res);

    expect(res.body).toEqual({
      importedSessions: 1,
      importedAttempts: 2,
      skippedSessions: 1,
      skippedAttempts: 1,
      errors: [],
    });

    // Existence checks: one batched query per collection-step, not one per
    // record (payload has 2 sessions + 2 sentence attempts + 1 word attempt
    // = 5 records, but only 3 find() calls total).
    expect(practiceSessionFindMock).toHaveBeenCalledTimes(1);
    expect(attemptFindMock).toHaveBeenCalledTimes(2); // sentence step + word step

    // Inserts: one insertMany per collection-step covering only the
    // non-duplicate records.
    expect(practiceSessionInsertManyMock).toHaveBeenCalledTimes(1);
    expect(practiceSessionInsertManyMock.mock.calls[0][0]).toHaveLength(1);
    expect(attemptInsertManyMock).toHaveBeenCalledTimes(2);
    expect(attemptInsertManyMock.mock.calls[0][0]).toHaveLength(1); // sentence
    expect(attemptInsertManyMock.mock.calls[1][0]).toHaveLength(1); // word
  });

  it('tolerates a partial insertMany failure without failing the whole batch', async () => {
    const payload = {
      sessions: [
        {
          sessionId: 'ok-session',
          userId: 'u1',
          startedAt: '2026-02-01T00:00:00.000Z',
          endedAt: '2026-02-01T00:05:00.000Z',
          durationSeconds: 300,
          mode: 'sentences',
          totalAttempts: 0,
          sentenceAttempts: 0,
          wordAttempts: 0,
        },
        {
          sessionId: 'bad-session',
          userId: 'u1',
          startedAt: '2026-02-02T00:00:00.000Z',
          endedAt: '2026-02-02T00:05:00.000Z',
          durationSeconds: 300,
          mode: 'sentences',
          totalAttempts: 0,
          sentenceAttempts: 0,
          wordAttempts: 0,
        },
      ],
      sentenceAttempts: [],
      wordAttempts: [],
    };

    // Simulate insertMany partially failing: only the first doc lands, the
    // second raises a per-document error (as `ordered: false` bulk writes
    // do), surfaced via `insertedDocs` on the thrown error.
    practiceSessionInsertManyMock.mockImplementationOnce(
      async (docs: Array<{ _id: mongoose.Types.ObjectId }>) => {
        const error: any = new Error('E11000 duplicate key or validation error');
        error.name = 'MongoBulkWriteError';
        error.insertedDocs = [{ _id: docs[0]._id }];
        throw error;
      }
    );

    const req = createReq(new mongoose.Types.ObjectId().toString(), payload);
    const res = createRes();

    const handler = getLocalStorageHandler();
    await handler(req, res);

    const body = res.body as {
      importedSessions: number;
      skippedSessions: number;
      errors: string[];
    };
    expect(body.importedSessions).toBe(1);
    expect(body.skippedSessions).toBe(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain('bad-session');
  });
});

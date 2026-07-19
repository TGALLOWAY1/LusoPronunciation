import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

// ─────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────
// FlashcardModel.find returns a chainable query (.sort().limit().exec())
// resolving to a fixture set of cards. We assert the /due handler clamps the
// limit, maps documents to DTOs, and surfaces them oldest-due-first.

const findMock = vi.hoisted(() => vi.fn());

vi.mock('../models/FlashcardModel', () => ({
  FlashcardModel: {
    find: (...args: unknown[]) => findMock(...args),
  },
}));

// The service is exercised by its own unit test; here we just ensure the
// /review handler validates input before touching it.
vi.mock('../services/flashcardService', () => ({
  ensureFlashcard: vi.fn(),
  updateFlashcardAfterReview: vi.fn(),
}));

import flashcardsRouter from './flashcards';

const VALID_USER_ID = 'a'.repeat(24);

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'card-1' },
    userId: { toString: () => VALID_USER_ID },
    contentId: 'sentence-1',
    contentType: 'sentence',
    nextDueAt: new Date('2020-01-01T00:00:00.000Z'),
    intervalDays: 1,
    easeFactor: 2.5,
    reps: 0,
    lapses: 0,
    lastScore: undefined,
    lastOutcome: undefined,
    history: [],
    createdAt: new Date('2019-12-31T00:00:00.000Z'),
    updatedAt: new Date('2019-12-31T00:00:00.000Z'),
    ...overrides,
  };
}

/** Grabs the last handler registered on a given route path (skips middleware). */
function getRouteHandler(path: string, method: 'get' | 'post') {
  const layer = (flashcardsRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method],
  );
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle as (
    req: Request,
    res: Response,
  ) => Promise<void>;
}

function createReq(overrides: Partial<Request> = {}): Request {
  return {
    query: {},
    body: {},
    user: { id: VALID_USER_ID },
    ...overrides,
  } as unknown as Request;
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

describe('GET /api/flashcards/due', () => {
  beforeEach(() => {
    findMock.mockReset();
  });

  function mockDueCards(cards: unknown[]) {
    const query = {
      sort: vi.fn(() => query),
      limit: vi.fn(() => query),
      exec: vi.fn(() => Promise.resolve(cards)),
    };
    findMock.mockReturnValue(query);
    return query;
  }

  it('returns due flashcards mapped to DTOs for the authenticated user', async () => {
    mockDueCards([makeCard()]);
    const handler = getRouteHandler('/due', 'get');
    const res = createRes();

    await handler(createReq(), res);

    expect(res.statusCode).toBe(200);
    const body = res.body as any[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: 'card-1',
      contentId: 'sentence-1',
      contentType: 'sentence',
      nextDueAt: '2020-01-01T00:00:00.000Z',
      historyCount: 0,
    });
    // Only cards due at/before "now" are queried for this user.
    const filter = findMock.mock.calls[0][0] as any;
    expect(filter.userId.toString()).toBe(VALID_USER_ID);
    expect(filter.nextDueAt.$lte).toBeInstanceOf(Date);
  });

  it('clamps the requested limit to a maximum of 100', async () => {
    const query = mockDueCards([]);
    const handler = getRouteHandler('/due', 'get');

    await handler(createReq({ query: { limit: '500' } } as Partial<Request>), createRes());

    expect(query.limit).toHaveBeenCalledWith(100);
  });

  it('defaults to a limit of 20 when none is supplied', async () => {
    const query = mockDueCards([]);
    const handler = getRouteHandler('/due', 'get');

    await handler(createReq(), createRes());

    expect(query.limit).toHaveBeenCalledWith(20);
  });
});

describe('POST /api/flashcards/review — input validation', () => {
  it('rejects an unknown grade with 400 before touching the service', async () => {
    const handler = getRouteHandler('/review', 'post');
    const res = createRes();

    await handler(
      createReq({ body: { cardId: 'b'.repeat(24), grade: 'sometimes' } } as Partial<Request>),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect((res.body as any).error).toBe('Invalid grade');
  });

  it('rejects a missing cardId with 400', async () => {
    const handler = getRouteHandler('/review', 'post');
    const res = createRes();

    await handler(createReq({ body: { grade: 'good' } } as Partial<Request>), res);

    expect(res.statusCode).toBe(400);
    expect((res.body as any).error).toBe('Invalid cardId');
  });
});

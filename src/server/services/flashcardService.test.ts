import { describe, expect, it, vi } from 'vitest';
import { updateFlashcardAfterReview, scoreToOutcome } from './flashcardService';
import type { IFlashcardDocument, ReviewOutcome } from '../models/FlashcardModel';

/**
 * Builds a minimal in-memory flashcard "document" whose save() is a no-op spy.
 * updateFlashcardAfterReview only reads/writes scalar SRS fields and calls
 * card.save(), so we don't need a real Mongoose document here.
 */
function makeCard(overrides: Partial<IFlashcardDocument> = {}): IFlashcardDocument {
  const card = {
    intervalDays: 10,
    easeFactor: 2.5,
    reps: 5,
    lapses: 0,
    history: [] as unknown[],
    lastOutcome: undefined,
    lastScore: undefined,
    nextDueAt: new Date('2020-01-01T00:00:00.000Z'),
    save: vi.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve(this);
    }),
    ...overrides,
  };
  return card as unknown as IFlashcardDocument;
}

describe('updateFlashcardAfterReview — lapse (again) handling', () => {
  it('resets reps to 0 on a lapse so the card re-enters the relearning ladder', async () => {
    const card = makeCard({ reps: 5, lapses: 1, intervalDays: 30 });

    await updateFlashcardAfterReview(card, 'again');

    // Canonical SM-2: reps drop to 0, lapse count increments, interval resets to 1 day.
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(2);
    expect(card.intervalDays).toBe(1);
    expect(card.lastOutcome).toBe('again');
    expect(card.save).toHaveBeenCalledTimes(1);
  });

  it('a lapsed card then follows the 1-day / 6-day relearning ladder on subsequent success', async () => {
    const card = makeCard({ reps: 5, lapses: 0, intervalDays: 30 });

    // Lapse → reps 0, interval 1.
    await updateFlashcardAfterReview(card, 'again');
    expect(card.reps).toBe(0);
    expect(card.intervalDays).toBe(1);

    // First success after lapse → reps 1, interval 1 (first review rung).
    await updateFlashcardAfterReview(card, 'good');
    expect(card.reps).toBe(1);
    expect(card.intervalDays).toBe(1);

    // Second success → reps 2, interval 6 (second review rung).
    await updateFlashcardAfterReview(card, 'good');
    expect(card.reps).toBe(2);
    expect(card.intervalDays).toBe(6);
  });

  it('never lets the ease factor fall below the 1.3 floor', async () => {
    const card = makeCard({ easeFactor: 1.35 });

    await updateFlashcardAfterReview(card, 'again'); // easeChange -0.2

    expect(card.easeFactor).toBe(1.3);
  });
});

describe('updateFlashcardAfterReview — successful outcomes grow intervals', () => {
  it('good/easy increment reps and grow the interval past the ladder', async () => {
    const card = makeCard({ reps: 3, intervalDays: 6, easeFactor: 2.5 });

    await updateFlashcardAfterReview(card, 'easy', 95);

    expect(card.reps).toBe(4);
    expect(card.intervalDays).toBeGreaterThan(6);
    expect(card.lastScore).toBe(95);
    expect(card.lastOutcome).toBe('easy');
  });

  it('hard reduces the interval and still counts as a rep (not a lapse)', async () => {
    const card = makeCard({ reps: 4, lapses: 0, intervalDays: 20 });

    await updateFlashcardAfterReview(card, 'hard');

    expect(card.reps).toBe(5);
    expect(card.lapses).toBe(0);
    expect(card.intervalDays).toBeLessThan(20);
  });
});

describe('scoreToOutcome', () => {
  it.each<[number, ReviewOutcome]>([
    [10, 'again'],
    [49, 'again'],
    [50, 'hard'],
    [69, 'hard'],
    [70, 'good'],
    [89, 'good'],
    [90, 'easy'],
    [100, 'easy'],
  ])('maps score %i → %s', (score, expected) => {
    expect(scoreToOutcome(score)).toBe(expected);
  });
});

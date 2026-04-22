import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { groupObservations } from './lexiconAggregator';

function obs(overrides: Partial<Parameters<typeof groupObservations>[0][number]>) {
  return {
    surfaceForm: 'xilogravura',
    rawSurfaceForm: 'xilogravura',
    userId: new mongoose.Types.ObjectId(),
    sentenceId: new mongoose.Types.ObjectId(),
    contextText: 'A xilogravura é bonita.',
    resolutionType: 'generated' as const,
    generatedPronunciationId: undefined,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  };
}

describe('groupObservations', () => {
  it('returns an empty array for no rows', () => {
    expect(groupObservations([])).toEqual([]);
  });

  it('counts occurrences by surfaceForm', () => {
    const result = groupObservations([
      obs({ surfaceForm: 'xilogravura' }),
      obs({ surfaceForm: 'xilogravura' }),
      obs({ surfaceForm: 'gengibre' }),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].surfaceForm).toBe('xilogravura');
    expect(result[0].frequency).toBe(2);
    expect(result[1].surfaceForm).toBe('gengibre');
    expect(result[1].frequency).toBe(1);
  });

  it('counts unique users across duplicate observations', () => {
    const u1 = new mongoose.Types.ObjectId();
    const u2 = new mongoose.Types.ObjectId();
    const result = groupObservations([
      obs({ userId: u1 }),
      obs({ userId: u1 }),
      obs({ userId: u2 }),
    ]);
    expect(result[0].frequency).toBe(3);
    expect(result[0].uniqueUsers).toBe(2);
  });

  it('picks the most frequent raw spelling as displayForm', () => {
    const result = groupObservations([
      obs({ rawSurfaceForm: 'Xilogravura' }),
      obs({ rawSurfaceForm: 'xilogravura' }),
      obs({ rawSurfaceForm: 'xilogravura' }),
    ]);
    expect(result[0].displayForm).toBe('xilogravura');
  });

  it('caps examples at 3 and tracks first/last seen', () => {
    const early = new Date('2026-03-01T00:00:00Z');
    const mid = new Date('2026-03-15T00:00:00Z');
    const late = new Date('2026-04-01T00:00:00Z');
    const result = groupObservations([
      obs({ createdAt: early, contextText: 'ex1' }),
      obs({ createdAt: mid, contextText: 'ex2' }),
      obs({ createdAt: late, contextText: 'ex3' }),
      obs({ createdAt: late, contextText: 'ex4' }),
    ]);
    expect(result[0].examples).toHaveLength(3);
    expect(result[0].firstSeenAt).toEqual(early);
    expect(result[0].lastSeenAt).toEqual(late);
  });

  it('keeps the resolutionType from the most recent observation', () => {
    const early = new Date('2026-03-01T00:00:00Z');
    const late = new Date('2026-04-01T00:00:00Z');
    const result = groupObservations([
      obs({ createdAt: late, resolutionType: 'unresolved' }),
      obs({ createdAt: early, resolutionType: 'generated' }),
    ]);
    expect(result[0].lastResolutionType).toBe('unresolved');
  });

  it('sorts results by frequency desc, then alphabetically', () => {
    const result = groupObservations([
      obs({ surfaceForm: 'banana' }),
      obs({ surfaceForm: 'abacaxi' }),
      obs({ surfaceForm: 'abacaxi' }),
      obs({ surfaceForm: 'cebola' }),
      obs({ surfaceForm: 'cebola' }),
    ]);
    expect(result.map((g) => g.surfaceForm)).toEqual([
      'abacaxi',
      'cebola',
      'banana',
    ]);
  });
});

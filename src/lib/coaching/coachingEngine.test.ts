import { describe, expect, it } from 'vitest';
import type { AttemptScore } from '@/types/pronunciation';
import { buildCoachingSuggestion } from './coachingEngine';

function createAttempt(overrides: Partial<AttemptScore> = {}): AttemptScore {
  return {
    attemptId: 'attempt-1',
    sentenceId: 'sentence-1',
    overallAccuracy: 82,
    fluency: 82,
    completeness: 82,
    prosody: 80,
    wordScores: [],
    createdAt: '2026-03-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildCoachingSuggestion', () => {
  it('returns coverage coaching when completeness is low', () => {
    const suggestion = buildCoachingSuggestion(
      createAttempt({
        completeness: 60,
        fluency: 90,
        overallAccuracy: 88,
      })
    );

    expect(suggestion.kind).toBe('coverage');
    expect(suggestion.ctaLabel).toBe('Retry sentence');
  });

  it('returns rhythm coaching when fluency is low', () => {
    const suggestion = buildCoachingSuggestion(
      createAttempt({
        completeness: 90,
        fluency: 63,
        overallAccuracy: 88,
      })
    );

    expect(suggestion.kind).toBe('rhythm');
    expect(suggestion.message).toContain('steady rhythm');
  });

  it('returns clarity coaching with weak-word targets when pronunciation is low', () => {
    const suggestion = buildCoachingSuggestion(
      createAttempt({
        overallAccuracy: 68,
        fluency: 88,
        completeness: 91,
        wordScores: [
          { word: 'carro', accuracy: 61 },
          { word: 'galho', accuracy: 67 },
          { word: 'rua', accuracy: 89 },
        ],
      })
    );

    expect(suggestion.kind).toBe('clarity');
    expect(suggestion.targets).toBeDefined();
    expect(suggestion.targets?.length).toBeGreaterThan(0);
    expect(suggestion.targets?.[0]?.word).toBe('carro');
  });
});

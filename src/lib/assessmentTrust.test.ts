import { describe, expect, it } from 'vitest';
import { computeTrustLevel, getTrustMessage } from './assessmentTrust';
import type { AttemptScore } from '@/types/pronunciation';

function makeAttempt(overrides: Partial<AttemptScore> = {}): AttemptScore {
  return {
    attemptId: 'a1',
    sentenceId: 's1',
    overallAccuracy: 85,
    completeness: 95,
    recognitionStatus: 'Success',
    wordScores: [
      { word: 'ola', accuracy: 90 },
      { word: 'mundo', accuracy: 88 },
    ],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeTrustLevel', () => {
  it('returns trusted for a clean Azure success', () => {
    expect(computeTrustLevel(makeAttempt())).toBe('trusted');
  });

  it('returns untrusted when recognitionStatus is not Success', () => {
    expect(computeTrustLevel(makeAttempt({ recognitionStatus: 'NoMatch' }))).toBe('untrusted');
    expect(
      computeTrustLevel(makeAttempt({ recognitionStatus: 'InitialSilenceTimeout' }))
    ).toBe('untrusted');
  });

  it('returns untrusted when completeness is very low', () => {
    expect(computeTrustLevel(makeAttempt({ completeness: 20 }))).toBe('untrusted');
  });

  it('returns untrusted when most words are omitted/extra', () => {
    const attempt = makeAttempt({
      completeness: 90,
      wordScores: [
        { word: 'ola', accuracy: 0, errorType: 'omitted' },
        { word: 'mundo', accuracy: 0, errorType: 'omitted' },
        { word: 'agora', accuracy: 82 },
      ],
    });
    expect(computeTrustLevel(attempt)).toBe('untrusted');
  });

  it('returns degraded when completeness is mid-range', () => {
    expect(computeTrustLevel(makeAttempt({ completeness: 55 }))).toBe('degraded');
  });

  it('returns degraded when ~1/3 of words are missing', () => {
    const attempt = makeAttempt({
      completeness: 90,
      wordScores: [
        { word: 'a', accuracy: 0, errorType: 'omitted' },
        { word: 'b', accuracy: 88 },
        { word: 'c', accuracy: 91 },
      ],
    });
    expect(computeTrustLevel(attempt)).toBe('degraded');
  });

  it('treats an empty word list as untrusted', () => {
    const attempt = makeAttempt({ wordScores: [], completeness: 100 });
    expect(computeTrustLevel(attempt)).toBe('untrusted');
  });

  it('ignores missing completeness as long as status is Success and words match', () => {
    const attempt = makeAttempt({ completeness: undefined });
    expect(computeTrustLevel(attempt)).toBe('trusted');
  });
});

describe('getTrustMessage', () => {
  it('returns null for trusted', () => {
    expect(getTrustMessage('trusted')).toBeNull();
  });

  it('returns a user-facing message for untrusted', () => {
    expect(getTrustMessage('untrusted')).toMatch(/quieter room/i);
  });

  it('returns a softer caveat for degraded', () => {
    expect(getTrustMessage('degraded')).toMatch(/less accurate/i);
  });
});

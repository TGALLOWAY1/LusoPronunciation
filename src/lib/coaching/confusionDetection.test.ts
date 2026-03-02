import { describe, expect, it } from 'vitest';
import type { AttemptScore } from '@/types/pronunciation';
import { detectConfusionTags } from './confusionDetection';

function createAttemptWithWords(words: Array<{ word: string; accuracy: number }>): AttemptScore {
  return {
    attemptId: 'attempt-1',
    sentenceId: 'sentence-1',
    overallAccuracy: 70,
    fluency: 76,
    completeness: 82,
    wordScores: words.map((entry) => ({
      word: entry.word,
      accuracy: entry.accuracy,
    })),
    createdAt: '2026-03-02T00:00:00.000Z',
  };
}

describe('detectConfusionTags', () => {
  it('detects lh_nh, r_rr, and nasalization from weak-word spellings', () => {
    const attempt = createAttemptWithWords([
      { word: 'minha', accuracy: 65 },
      { word: 'galho', accuracy: 62 },
      { word: 'carro', accuracy: 60 },
      { word: 'pão', accuracy: 64 },
    ]);

    const tags = detectConfusionTags(attempt, 'Minha galho carro pão');

    expect(tags).toContain('lh_nh');
    expect(tags).toContain('r_rr');
    expect(tags).toContain('nasalization');
  });
});

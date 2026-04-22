import { describe, expect, it } from 'vitest';
import { adaptWordScoresToNormalized } from './adapters';
import type { WordScore } from '@/types/pronunciation';

describe('adaptWordScoresToNormalized', () => {
  it('uses azureWordIndex to extract phonemes when duplicate words exist', () => {
    const wordScores: WordScore[] = [
      { word: 'casa', accuracy: 92, azureWordIndex: 0 },
      { word: 'casa', accuracy: 71, azureWordIndex: 2 },
    ];

    const rawAzure = {
      NBest: [
        {
          Words: [
            {
              Word: 'casa',
              Phonemes: [{ Phoneme: 'k', PronunciationAssessment: { AccuracyScore: 95 } }],
            },
            {
              Word: 'de',
              Phonemes: [{ Phoneme: 'd', PronunciationAssessment: { AccuracyScore: 90 } }],
            },
            {
              Word: 'casa',
              Phonemes: [{ Phoneme: 'z', PronunciationAssessment: { AccuracyScore: 65 } }],
            },
          ],
        },
      ],
    };

    const normalized = adaptWordScoresToNormalized(wordScores, rawAzure);

    expect(normalized[0].phonemes?.[0].symbol).toBe('k');
    expect(normalized[1].phonemes?.[0].symbol).toBe('z');
  });

  it('generates deterministic phoneme tips for low-scoring sounds', () => {
    const wordScores: WordScore[] = [{ word: 'joia', accuracy: 62, azureWordIndex: 0 }];
    const rawAzure = {
      NBest: [
        {
          Words: [
            {
              Word: 'joia',
              Phonemes: [{ Phoneme: 'ʒ', PronunciationAssessment: { AccuracyScore: 52 } }],
            },
          ],
        },
      ],
    };

    const normalized = adaptWordScoresToNormalized(wordScores, rawAzure);

    expect(normalized[0].phonemes?.[0].tip).toBe(
      'Focus on the ʒ sound and slow down slightly for clarity.'
    );
  });
});

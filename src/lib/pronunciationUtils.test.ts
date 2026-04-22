import { describe, expect, it } from 'vitest';
import { mapAzurePronunciationResultToAttemptScore } from './pronunciationUtils';

describe('mapAzurePronunciationResultToAttemptScore', () => {
  it('preserves azureWordIndex and referenceTokenIndex for word mapping lineage', () => {
    const rawAzure = {
      RecognitionStatus: 'Success',
      NBest: [
        {
          PronunciationAssessment: {
            AccuracyScore: 84,
          },
          Words: [
            { Word: 'Olá', PronunciationAssessment: { AccuracyScore: 80 } },
            { Word: 'mundo', PronunciationAssessment: { AccuracyScore: 88 } },
            { Word: 'agora', PronunciationAssessment: { AccuracyScore: 79 } },
          ],
        },
      ],
    };

    const attempt = mapAzurePronunciationResultToAttemptScore(
      rawAzure,
      'sentence-1',
      'attempt-1',
      undefined,
      'Olá, mundo!'
    );

    expect(attempt.wordScores[0]).toMatchObject({
      azureWordIndex: 0,
      referenceTokenIndex: 0,
    });
    expect(attempt.wordScores[1]).toMatchObject({
      azureWordIndex: 1,
      referenceTokenIndex: 1,
    });
    expect(attempt.wordScores[2]).toMatchObject({
      azureWordIndex: 2,
      referenceTokenIndex: undefined,
    });
  });
});

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

  it('preserves Azure recognitionStatus on the AttemptScore', () => {
    const rawAzure = {
      RecognitionStatus: 'NoMatch',
      NBest: [
        {
          PronunciationAssessment: { AccuracyScore: 0, CompletenessScore: 0 },
          Words: [],
        },
      ],
    };

    const attempt = mapAzurePronunciationResultToAttemptScore(
      rawAzure,
      'sentence-noise',
      'attempt-noise',
      undefined,
      'Olá mundo.'
    );

    expect(attempt.recognitionStatus).toBe('NoMatch');
  });

  it('maps both nested and flattened Azure phoneme shapes onto WordScore.phonemeScores', () => {
    const rawAzure = {
      RecognitionStatus: 'Success',
      NBest: [
        {
          PronunciationAssessment: { AccuracyScore: 84 },
          Words: [
            {
              Word: 'ola',
              PronunciationAssessment: { AccuracyScore: 84 },
              Phonemes: [
                // nested shape
                { Phoneme: 'o', PronunciationAssessment: { AccuracyScore: 91 }, Offset: 10, Duration: 5 },
                // flattened shape
                { Phoneme: 'l', AccuracyScore: 55 },
                // unnamed (pt-BR may omit names) — score still kept, label null
                { AccuracyScore: 70 },
              ],
            },
          ],
        },
      ],
    };

    const attempt = mapAzurePronunciationResultToAttemptScore(
      rawAzure,
      'sentence-ph',
      'attempt-ph',
      undefined,
      'ola'
    );

    expect(attempt.wordScores[0].phonemeScores).toEqual([
      { label: 'o', accuracyScore: 91, offset: 10, duration: 5 },
      { label: 'l', accuracyScore: 55 },
      { label: null, accuracyScore: 70 },
    ]);
  });

  it('omits phonemeScores when Azure returned no Phonemes array', () => {
    const rawAzure = {
      RecognitionStatus: 'Success',
      NBest: [
        {
          PronunciationAssessment: { AccuracyScore: 90 },
          Words: [{ Word: 'oi', PronunciationAssessment: { AccuracyScore: 90 } }],
        },
      ],
    };

    const attempt = mapAzurePronunciationResultToAttemptScore(
      rawAzure,
      'sentence-noph',
      'attempt-noph',
      undefined,
      'oi'
    );

    expect(attempt.wordScores[0].phonemeScores).toBeUndefined();
  });
});

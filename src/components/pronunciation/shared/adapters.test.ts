import { describe, expect, it } from 'vitest';
import {
  adaptWordScoresToNormalized,
  enrichWordsWithCanonicalData,
} from './adapters';
import type { WordScore } from '@/types/pronunciation';
import type { Sentence, Word } from '@/lib/types';
import type { NormalizedWordFeedback } from './types';

function makeCanonicalWord(overrides: Partial<Word> & Pick<Word, 'id' | 'textPt'>): Word {
  return {
    translationEn: '',
    partOfSpeech: 'noun',
    difficulty: 2,
    difficultForEnglish: false,
    categoryId: 'c',
    categoryLabelEn: 'C',
    categoryLabelPt: 'C',
    ...overrides,
  } as Word;
}

describe('adaptWordScoresToNormalized', () => {
  it('displays Azure real phoneme scores, mapping labels to internal IDs', () => {
    const wordScores: WordScore[] = [
      {
        word: 'chave',
        accuracy: 82,
        azureWordIndex: 0,
        phonemeScores: [
          { label: 'ʃ', accuracyScore: 90 },
          { label: 'a', accuracyScore: 55 },
        ],
      },
    ];

    const normalized = adaptWordScoresToNormalized(wordScores);

    expect(normalized[0].phonemes).toEqual([
      { symbol: 'SH', score: 90, isProblem: false, azureLabel: 'ʃ' },
      { symbol: 'AA', score: 55, isProblem: true, azureLabel: 'a' },
    ]);
  });

  it('passes through unmapped Azure labels rather than discarding the score', () => {
    const wordScores: WordScore[] = [
      {
        word: 'x',
        accuracy: 70,
        phonemeScores: [{ label: 'ʔ', accuracyScore: 72 }],
      },
    ];

    const normalized = adaptWordScoresToNormalized(wordScores);

    expect(normalized[0].phonemes?.[0]).toEqual({
      symbol: 'ʔ',
      score: 72,
      isProblem: false,
      azureLabel: 'ʔ',
    });
  });

  it('labels unnamed Azure phonemes as "Sound N" while keeping their scores', () => {
    const wordScores: WordScore[] = [
      {
        word: 'casa',
        accuracy: 80,
        phonemeScores: [
          { label: null, accuracyScore: 88 },
          { label: null, accuracyScore: 40 },
        ],
      },
    ];

    const normalized = adaptWordScoresToNormalized(wordScores);

    expect(normalized[0].phonemes).toEqual([
      { symbol: 'Sound 1', score: 88, isProblem: false, azureLabel: null },
      { symbol: 'Sound 2', score: 40, isProblem: true, azureLabel: null },
    ]);
  });

  it('does not fabricate phonemes when Azure returned none', () => {
    const wordScores: WordScore[] = [{ word: 'oi', accuracy: 95, azureWordIndex: 0 }];

    const normalized = adaptWordScoresToNormalized(wordScores);

    expect(normalized[0].phonemes).toBeUndefined();
  });
});

describe('enrichWordsWithCanonicalData', () => {
  const sentence = undefined as unknown as Sentence;

  it('borrows canonical labels for unnamed phonemes only when counts match exactly', () => {
    const words: NormalizedWordFeedback[] = [
      {
        id: 'word_0',
        text: 'chave',
        accuracyScore: 80,
        index: 0,
        phonemes: [
          { symbol: 'Sound 1', score: 90, isProblem: false, azureLabel: null },
          { symbol: 'Sound 2', score: 50, isProblem: true, azureLabel: null },
        ],
      },
    ];
    const canonicalMap = new Map<string, Word>([
      ['w-chave', makeCanonicalWord({ id: 'w-chave', textPt: 'chave', phonemes: ['SH', 'AA'] })],
    ]);

    const enriched = enrichWordsWithCanonicalData(sentence, words, canonicalMap);

    // Counts match (2 === 2): borrow canonical labels, scores preserved.
    expect(enriched[0].phonemes).toEqual([
      { symbol: 'SH', score: 90, isProblem: false, azureLabel: null },
      { symbol: 'AA', score: 50, isProblem: true, azureLabel: null },
    ]);
    expect(enriched[0].wordId).toBe('w-chave');
  });

  it('does not borrow canonical labels when phoneme counts mismatch', () => {
    const words: NormalizedWordFeedback[] = [
      {
        id: 'word_0',
        text: 'chave',
        accuracyScore: 80,
        index: 0,
        phonemes: [
          { symbol: 'Sound 1', score: 90, isProblem: false, azureLabel: null },
          { symbol: 'Sound 2', score: 50, isProblem: true, azureLabel: null },
        ],
      },
    ];
    const canonicalMap = new Map<string, Word>([
      ['w-chave', makeCanonicalWord({ id: 'w-chave', textPt: 'chave', phonemes: ['SH', 'AA', 'V'] })],
    ]);

    const enriched = enrichWordsWithCanonicalData(sentence, words, canonicalMap);

    // Counts mismatch (2 !== 3): keep "Sound N", scores preserved.
    expect(enriched[0].phonemes?.map(p => p.symbol)).toEqual(['Sound 1', 'Sound 2']);
    expect(enriched[0].phonemes?.map(p => p.score)).toEqual([90, 50]);
  });

  it('keeps labeled Azure phonemes untouched (only unnamed entries borrow)', () => {
    const words: NormalizedWordFeedback[] = [
      {
        id: 'word_0',
        text: 'chave',
        accuracyScore: 80,
        index: 0,
        phonemes: [
          { symbol: 'SH', score: 90, isProblem: false, azureLabel: 'ʃ' },
          { symbol: 'Sound 2', score: 50, isProblem: true, azureLabel: null },
        ],
      },
    ];
    const canonicalMap = new Map<string, Word>([
      ['w-chave', makeCanonicalWord({ id: 'w-chave', textPt: 'chave', phonemes: ['ZZ', 'AA'] })],
    ]);

    const enriched = enrichWordsWithCanonicalData(sentence, words, canonicalMap);

    // Labeled entry stays 'SH' (not overwritten by canonical 'ZZ'); only the
    // unnamed second entry borrows the canonical 'AA'.
    expect(enriched[0].phonemes?.map(p => p.symbol)).toEqual(['SH', 'AA']);
  });

  it('reference-only: populates canonical phonemes with NO score when Azure gave none', () => {
    const words: NormalizedWordFeedback[] = [
      {
        id: 'word_0',
        text: 'chave',
        accuracyScore: 80,
        index: 0,
        // No phonemes: Azure returned no per-phoneme scores.
      },
    ];
    const canonicalMap = new Map<string, Word>([
      ['w-chave', makeCanonicalWord({ id: 'w-chave', textPt: 'chave', phonemes: ['SH', 'AA', 'V'] })],
    ]);

    const enriched = enrichWordsWithCanonicalData(sentence, words, canonicalMap);

    expect(enriched[0].phonemes).toEqual([
      { symbol: 'SH' },
      { symbol: 'AA' },
      { symbol: 'V' },
    ]);
    // No scores and no problem flags in reference-only mode.
    expect(enriched[0].phonemes?.every(p => p.score === undefined)).toBe(true);
    expect(enriched[0].phonemes?.every(p => p.isProblem === undefined)).toBe(true);
  });
});

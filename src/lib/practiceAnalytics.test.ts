import { describe, expect, it } from 'vitest';
import type {
  SentencePracticeAttempt,
  WordPracticeAttempt,
  Word,
  Sentence,
} from './types';
import {
  filterByWindow,
  buildMultiMetricTrend,
  computeImprovement,
  generateInsights,
  buildRecommendations,
} from './practiceAnalytics';

const NOW = new Date('2026-06-17T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number, extraMs = 0): string {
  return new Date(NOW.getTime() - days * DAY_MS + extraMs).toISOString();
}

function sentence(overrides: Partial<SentencePracticeAttempt> = {}): SentencePracticeAttempt {
  return {
    attemptId: `s-${Math.random()}`,
    userId: 'u',
    sessionId: 'sess-1',
    sentenceId: 'sent-1',
    difficulty: 3,
    category: 'food',
    createdAt: NOW.toISOString(),
    overallScore: 80,
    accuracyScore: 80,
    fluencyScore: 80,
    completenessScore: 80,
    ...overrides,
  };
}

function word(overrides: Partial<WordPracticeAttempt> = {}): WordPracticeAttempt {
  return {
    attemptId: `w-${Math.random()}`,
    userId: 'u',
    sessionId: 'sess-1',
    wordId: 'word-1',
    difficulty: 3,
    category: 'food',
    createdAt: NOW.toISOString(),
    overallScore: 80,
    accuracyScore: 80,
    ...overrides,
  };
}

function makeWord(id: string, textPt: string, phonemes: string[] = []): Word {
  return {
    id,
    textPt,
    translationEn: 'x',
    partOfSpeech: 'noun',
    difficulty: 3,
    difficultForEnglish: false,
    categoryId: 'food',
    categoryLabelEn: 'Food',
    categoryLabelPt: 'Comida',
    phonemes,
  };
}

function makeSentence(id: string, textPt: string, phonemes: string[] = []): Sentence {
  return {
    id,
    textPt,
    translationEn: 'x',
    difficulty: 3,
    categoryId: 'food',
    categoryLabelEn: 'Food',
    categoryLabelPt: 'Comida',
    phonemes,
  };
}

describe('filterByWindow', () => {
  it('includes items exactly at the cutoff and excludes items just before', () => {
    const items = [
      { createdAt: daysAgo(7) }, // exactly at cutoff (inclusive)
      { createdAt: daysAgo(7, -1) }, // 1ms before cutoff
    ];
    const result = filterByWindow(items, '7d', NOW);
    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toBe(daysAgo(7));
  });

  it('passes everything through for the "all" window', () => {
    const items = [{ createdAt: daysAgo(1000) }, { createdAt: daysAgo(1) }];
    expect(filterByWindow(items, 'all', NOW)).toHaveLength(2);
  });
});

describe('buildMultiMetricTrend', () => {
  it('produces a fixed number of buckets per window', () => {
    expect(buildMultiMetricTrend([], [], '7d', NOW)).toHaveLength(7);
    expect(buildMultiMetricTrend([], [], '30d', NOW)).toHaveLength(30);
    expect(buildMultiMetricTrend([], [], '90d', NOW)).toHaveLength(13);
  });

  it('returns no buckets for "all" when there is no data', () => {
    expect(buildMultiMetricTrend([], [], 'all', NOW)).toEqual([]);
  });

  it('only includes metrics that are actually recorded', () => {
    const s = sentence({ createdAt: NOW.toISOString(), overallScore: 80, fluencyScore: 70 });
    const w = word({ createdAt: NOW.toISOString(), overallScore: 90, accuracyScore: 85 }); // no fluency
    const trend = buildMultiMetricTrend([s], [w], '7d', NOW);

    expect(trend.flatMap((p) => p.values.overall).sort()).toEqual([80, 90]);
    // Only the sentence contributes a fluency score; the word has none.
    expect(trend.flatMap((p) => p.values.fluency)).toEqual([70]);
  });
});

describe('computeImprovement', () => {
  it('excludes items below the minimum attempt threshold', () => {
    const attempts = [
      word({ wordId: 'w-short', overallScore: 50, createdAt: daysAgo(3) }),
      word({ wordId: 'w-short', overallScore: 60, createdAt: daysAgo(2) }),
      word({ wordId: 'w-short', overallScore: 90, createdAt: daysAgo(1) }),
    ];
    const { mostImproved, needsPractice } = computeImprovement([], attempts, 'all', { now: NOW });
    const allIds = [...mostImproved, ...needsPractice].map((i) => i.id);
    expect(allIds).not.toContain('w-short');
  });

  it('surfaces rising items in mostImproved and falling items in needsPractice', () => {
    const improving = [50, 55, 60, 90].map((score, i) =>
      word({ wordId: 'w-improve', overallScore: score, createdAt: daysAgo(4 - i) }),
    );
    const declining = [80, 70, 60, 50].map((score, i) =>
      word({ wordId: 'w-decline', overallScore: score, createdAt: daysAgo(4 - i) }),
    );
    const { mostImproved, needsPractice } = computeImprovement(
      [],
      [...improving, ...declining],
      'all',
      { now: NOW },
    );

    const improved = mostImproved.find((i) => i.id === 'w-improve');
    expect(improved).toBeDefined();
    expect(improved!.delta).toBeCloseTo(22.5);
    expect(mostImproved.map((i) => i.id)).not.toContain('w-decline');

    expect(needsPractice.map((i) => i.id)).toContain('w-decline');
  });

  it('splits odd attempt counts with an overlapping middle element', () => {
    const attempts = [10, 20, 30, 40, 50].map((score, i) =>
      word({ wordId: 'w-odd', overallScore: score, createdAt: daysAgo(5 - i) }),
    );
    const { mostImproved } = computeImprovement([], attempts, 'all', { now: NOW });
    const item = mostImproved.find((i) => i.id === 'w-odd');
    expect(item).toBeDefined();
    expect(item!.earlyAvg).toBeCloseTo(20); // mean(10,20,30)
    expect(item!.recentAvg).toBeCloseTo(40); // mean(30,40,50)
  });

  it('caps each list at topN', () => {
    const attempts: WordPracticeAttempt[] = [];
    for (let n = 0; n < 12; n++) {
      [40, 50, 60, 90].forEach((score, i) => {
        attempts.push(
          word({ wordId: `w-${n}`, overallScore: score, createdAt: daysAgo(4 - i) }),
        );
      });
    }
    const { mostImproved } = computeImprovement([], attempts, 'all', { now: NOW, topN: 6 });
    expect(mostImproved.length).toBeLessThanOrEqual(6);
  });
});

describe('generateInsights', () => {
  it('returns nothing when there is too little data', () => {
    expect(generateInsights([sentence()], [], 'all', NOW)).toEqual([]);
  });

  it('is deterministic for identical input', () => {
    const sentences = ['s1', 's2', 's3'].flatMap((id) => [
      sentence({ sentenceId: id, sessionId: 'sess-1', overallScore: 60, createdAt: daysAgo(2) }),
      sentence({ sentenceId: id, sessionId: 'sess-1', overallScore: 82, createdAt: daysAgo(2, 60_000) }),
    ]);
    const a = generateInsights(sentences, [], 'all', NOW);
    const b = generateInsights(sentences, [], 'all', NOW);
    expect(a).toEqual(b);
    expect(a.some((i) => i.id === 'improves-with-repetition')).toBe(true);
  });
});

describe('buildRecommendations', () => {
  it('only recommends content that exists, grounded in real weaknesses', () => {
    const allWords = [makeWord('w1', 'pão', ['AN_NASAL']), makeWord('w2', 'não', ['AN_NASAL'])];
    const allSentences = [makeSentence('s1', 'Tudo bem', ['AN_NASAL'])];

    const wordAttempts = [0, 1, 2].map((i) =>
      word({
        wordId: 'w1',
        overallScore: 45,
        accuracyScore: 45,
        phonemeScores: [{ phonemeId: 'AN_NASAL', overallScore: 45 }],
        createdAt: daysAgo(3 - i),
      }),
    );

    const recs = buildRecommendations([], wordAttempts, allWords, allSentences);

    for (const rec of recs) {
      if (rec.kind === 'word') {
        expect(allWords.some((w) => w.id === rec.id)).toBe(true);
      }
      if (rec.kind === 'sentence') {
        expect(allSentences.some((s) => s.id === rec.id)).toBe(true);
      }
    }
    expect(recs.some((r) => r.kind === 'phoneme' && r.id === 'AN_NASAL')).toBe(true);
    expect(recs.some((r) => r.kind === 'word' && r.id === 'w1')).toBe(true);
  });
});

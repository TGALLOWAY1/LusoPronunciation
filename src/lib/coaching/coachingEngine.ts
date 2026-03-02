import type { AttemptScore } from '@/types/pronunciation';

export type MinimalPairDrill = {
  tags: string[];
  pairs: Array<{
    a: string;
    b: string;
    note?: string;
  }>;
};

export type CoachingSuggestion = {
  kind: 'retry' | 'minimal_pairs' | 'rhythm' | 'clarity' | 'coverage';
  title: string;
  message: string;
  ctaLabel: string;
  targets?: { word: string; index: number; score?: number }[];
  drill?: MinimalPairDrill;
};

export type CoachingContext = {
  previousAttempt?: AttemptScore | null;
  sentenceText?: string;
  nativeAudioAvailable?: boolean;
};

const LOW_COMPLETENESS_THRESHOLD = 75;
const LOW_FLUENCY_THRESHOLD = 75;
const LOW_PRONUNCIATION_THRESHOLD = 78;
const WEAK_WORD_THRESHOLD = 80;
const TARGET_WORD_LIMIT = 3;
const IMPROVEMENT_DELTA_THRESHOLD = 2;

function getWeakWordTargets(
  attempt: AttemptScore,
  limit: number = TARGET_WORD_LIMIT
): Array<{ word: string; index: number; score?: number }> {
  if (!attempt.wordScores || attempt.wordScores.length === 0) {
    return [];
  }

  return attempt.wordScores
    .map((wordScore, index) => ({
      word: wordScore.word,
      index,
      score: wordScore.accuracy,
    }))
    .filter((target) => typeof target.score === 'number' && target.score < WEAK_WORD_THRESHOLD)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, limit);
}

function countImprovedWords(
  currentAttempt: AttemptScore,
  previousAttempt?: AttemptScore | null
): number {
  if (!previousAttempt?.wordScores?.length || !currentAttempt.wordScores?.length) {
    return 0;
  }

  const total = Math.min(previousAttempt.wordScores.length, currentAttempt.wordScores.length);
  let improvedCount = 0;

  for (let index = 0; index < total; index += 1) {
    const previousScore = previousAttempt.wordScores[index]?.accuracy;
    const currentScore = currentAttempt.wordScores[index]?.accuracy;

    if (
      typeof previousScore === 'number' &&
      typeof currentScore === 'number' &&
      currentScore - previousScore >= IMPROVEMENT_DELTA_THRESHOLD
    ) {
      improvedCount += 1;
    }
  }

  return improvedCount;
}

function withConfidencePrefix(message: string, improvedCount: number): string {
  if (improvedCount <= 0) {
    return message;
  }

  const noun = improvedCount === 1 ? 'word' : 'words';
  return `Nice work: ${improvedCount} ${noun} improved. ${message}`;
}

function formatTargetWords(targets: Array<{ word: string }>): string {
  return targets.map((target) => target.word).join(', ');
}

export function buildCoachingSuggestion(
  attempt: AttemptScore,
  context: CoachingContext = {}
): CoachingSuggestion {
  const improvedCount = countImprovedWords(attempt, context.previousAttempt);
  const weakTargets = getWeakWordTargets(attempt);
  const completeness = attempt.completeness ?? null;
  const fluency = attempt.fluency ?? null;

  if (completeness !== null && completeness < LOW_COMPLETENESS_THRESHOLD) {
    return {
      kind: 'coverage',
      title: 'Next try',
      message: withConfidencePrefix(
        'Try speaking the full sentence without long pauses.',
        improvedCount
      ),
      ctaLabel: 'Retry sentence',
      targets: weakTargets.length > 0 ? weakTargets : undefined,
    };
  }

  if (fluency !== null && fluency < LOW_FLUENCY_THRESHOLD) {
    return {
      kind: 'rhythm',
      title: 'Next try',
      message: withConfidencePrefix(
        "Keep a steady rhythm and don't rush the middle.",
        improvedCount
      ),
      ctaLabel: 'Retry sentence',
      targets: weakTargets.length > 0 ? weakTargets : undefined,
    };
  }

  if (attempt.overallAccuracy < LOW_PRONUNCIATION_THRESHOLD || weakTargets.length > 0) {
    const message =
      weakTargets.length > 0
        ? `Focus on these words: ${formatTargetWords(weakTargets)}.`
        : 'Focus on clear consonants and vowel endings in your next try.';

    return {
      kind: 'clarity',
      title: 'Next try',
      message: withConfidencePrefix(message, improvedCount),
      ctaLabel: 'Retry sentence',
      targets: weakTargets.length > 0 ? weakTargets : undefined,
    };
  }

  return {
    kind: 'retry',
    title: 'Next try',
    message: withConfidencePrefix(
      'Good control. Do one more attempt to lock in consistency.',
      improvedCount
    ),
    ctaLabel: context.nativeAudioAvailable ? 'Replay and retry' : 'Retry sentence',
    targets: weakTargets.length > 0 ? weakTargets : undefined,
  };
}

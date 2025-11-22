/**
 * Shared pronunciation feedback components.
 * 
 * These components are designed to work with normalized types and can be used
 * by both the dev pronunciation fixtures page and the practice sentences page.
 */

export { default as PhraseScoreOverview } from './PhraseScoreOverview';
export { default as PhraseTrendSparkline } from './PhraseTrendSparkline';
export { default as InteractiveWordStrip } from './InteractiveWordStrip';
export { default as PhonemePanel } from './PhonemePanel';
export { default as SentenceAudioControls } from './SentenceAudioControls';

export type {
  NormalizedWordFeedback,
  NormalizedAudioVariant,
  NormalizedWordAudioVariant,
} from './types';

/**
 * Adapter functions to convert between different word feedback formats.
 */

import type { WordFeedback } from '@/types/pronunciationFixtures';
import type { WordScore } from '@/types/pronunciation';
import type { NormalizedWordFeedback } from './types';

/**
 * Converts WordFeedback (from pronunciationFixtures) to NormalizedWordFeedback.
 */
export function adaptWordFeedbackToNormalized(word: WordFeedback): NormalizedWordFeedback {
  return {
    id: word.wordId || `word_${word.index}`,
    text: word.text,
    accuracyScore: word.score,
    errorType: word.errorType || null,
    phonemes: word.phonemes,
    wordId: word.wordId,
    index: word.index,
    level: word.level,
    score: word.score,
  };
}

/**
 * Converts WordScore (from pronunciation.ts) to NormalizedWordFeedback.
 */
export function adaptWordScoreToNormalized(wordScore: WordScore, index: number): NormalizedWordFeedback {
  // Map score to level
  const score = wordScore.accuracy;
  const level: NormalizedWordFeedback['level'] = 
    score >= 90 ? 'excellent' :
    score >= 80 ? 'good' :
    score >= 70 ? 'ok' : 'practice';

  return {
    id: `word_${index}`,
    text: wordScore.word,
    accuracyScore: score,
    errorType: wordScore.errorType || null,
    phonemes: undefined, // WordScore doesn't have phonemes, but can be added later
    index,
    level,
    score,
  };
}


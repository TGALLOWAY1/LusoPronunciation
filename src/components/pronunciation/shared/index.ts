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
 * Re-exported from adapters.ts for convenience.
 */

export {
  adaptFixtureWordsToNormalized,
  adaptWordScoresToNormalized,
  buildWordAudioVariantsForSentence,
} from './adapters';

// Alias for backward compatibility
export { adaptFixtureWordsToNormalized as adaptWordFeedbackToNormalized } from './adapters';


/**
 * Normalized types for shared pronunciation feedback components.
 * 
 * These types provide a common interface that can be used by both:
 * - Dev pronunciation fixtures page (uses WordFeedback from pronunciationFixtures.ts)
 * - Practice Sentences page (uses WordScore from pronunciation.ts)
 */

/**
 * Normalized word feedback interface that can be adapted from either:
 * - WordFeedback (from pronunciationFixtures.ts) - used by dev page
 * - WordScore (from pronunciation.ts) - used by practice page
 */
export interface NormalizedWordFeedback {
  /** Unique identifier for the word (index or wordId) */
  id: string;
  /** The word text */
  text: string;
  /** Accuracy score (0-100) */
  accuracyScore: number;
  /** Error type if applicable */
  errorType?: string | null;
  /** Phoneme-level feedback (preserve current shape, can refine later) */
  phonemes?: Array<{
    symbol: string;
    score: number;
    exampleWord?: string;
    tip?: string;
    isProblem?: boolean;
  }>;
  /** Optional word ID for TTS audio lookup */
  wordId?: string;
  /** Optional index in the sentence */
  index?: number;
  /** Optional level classification */
  level?: 'excellent' | 'good' | 'ok' | 'practice';
  /** Optional overall score (for compatibility) */
  score?: number;
}

/**
 * Normalized audio variant interface for sentence-level audio.
 */
export interface NormalizedAudioVariant {
  type: 'native' | 'user';
  url: string;
}

/**
 * Normalized word audio variant interface for word-level audio.
 */
export interface NormalizedWordAudioVariant extends NormalizedAudioVariant {
  wordIndex: number;
  startTimeMs?: number;
  endTimeMs?: number;
}


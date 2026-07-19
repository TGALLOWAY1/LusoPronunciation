export type ErrorType = 'none' | 'mispronounced' | 'omitted' | 'extra';

/**
 * A single Azure-scored phoneme within a word.
 *
 * This is the RAW Azure shape (label-based), preserved verbatim from the
 * assessment response — Azure is the source of truth for the score. `label` is
 * null when Azure omits the phoneme name (common for pt-BR, where Microsoft does
 * not guarantee phoneme names); the score is kept regardless.
 *
 * Note: this differs intentionally from the persisted analytics shape in
 * `src/shared/types/practice.ts` (`{ phonemeId, overallScore }`). That form is
 * derived from this one by mapping Azure labels → internal phoneme IDs (see
 * `azurePhonemeMap.ts`) at persist time; unmapped/unlabeled phonemes are dropped
 * there because analytics aggregate by phoneme identity.
 */
export type PhonemeScore = {
  /** Azure phoneme name (IPA), or null when Azure omitted it. */
  label: string | null;
  /** Azure accuracy score, 0-100. */
  accuracyScore: number;
  /** Optional audio offset (100-ns ticks) as returned by Azure. */
  offset?: number;
  /** Optional audio duration (100-ns ticks) as returned by Azure. */
  duration?: number;
};

export type WordScore = {
  word: string;
  accuracy: number; // 0-100
  errorType?: ErrorType;
  /**
   * Per-phoneme scores from Azure (Granularity: 'Phoneme'). Present only when
   * Azure returned a Phonemes array for this word; absent for older cached
   * attempts or word-granularity responses. Never fabricated.
   */
  phonemeScores?: PhonemeScore[];
  /**
   * Index of the word in Azure's NBest[0].Words array.
   * Preserved to avoid re-matching by text when extracting phoneme details.
   */
  azureWordIndex?: number;
  /**
   * Index of the word-like token in the reference sentence text.
   * Useful for mapping assessment data back to UI tokens.
   */
  referenceTokenIndex?: number;
  // future: startTimeMs?: number;
  // future: endTimeMs?: number;
};

export type AttemptScore = {
  attemptId: string;
  sentenceId: string;
  overallAccuracy: number;
  fluency?: number;
  completeness?: number;
  prosody?: number;
  wordScores: WordScore[];
  createdAt: string;
  audioUrl?: string; // local blob URL for playback
  latencyMs?: number; // round-trip time for the Azure API call (ms)
  /**
   * Azure root-level recognition status (e.g. 'Success', 'NoMatch',
   * 'InitialSilenceTimeout'). Preserved so the UI can gate on audio quality.
   */
  recognitionStatus?: string;
};

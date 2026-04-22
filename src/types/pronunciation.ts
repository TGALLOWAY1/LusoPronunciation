export type ErrorType = 'none' | 'mispronounced' | 'omitted' | 'extra';

export type WordScore = {
  word: string;
  accuracy: number; // 0-100
  errorType?: ErrorType;
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

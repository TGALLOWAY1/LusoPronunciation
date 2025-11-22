export type ErrorType = 'none' | 'mispronounced' | 'omitted' | 'extra';

export type WordScore = {
  word: string;
  accuracy: number; // 0-100
  errorType?: ErrorType;
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
};


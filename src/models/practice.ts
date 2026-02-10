import type { SentenceId, WordId } from "./content";
import type { AudioId } from "./audio";

export type PronunciationEngine = "mock" | "azure_speech";

export type PronunciationErrorType =
  | "omitted"
  | "substituted"
  | "inserted"
  | "mispronounced"
  | "unexpected_break"
  | "missing_break"
  | "monotone";

/**
 * Per-word scoring details returned by the pronouncer.
 */
export interface WordScore {
  wordId?: WordId;        // Optional link to Word
  expectedText: string;   // From the Sentence
  recognizedText?: string;
  score: number;          // 0–100
  errorType?: PronunciationErrorType;
}

/**
 * One attempt at pronouncing a sentence and getting feedback.
 */
export interface SentenceAttempt {
  id: string;
  sentenceId: SentenceId;
  createdAt: string;      // ISO timestamp
  // Audio the user recorded (optional to persist)
  audioId?: AudioId;
  // Scoring
  engine: PronunciationEngine;
  overallScore: number;   // 0–100
  accuracyScore?: number;
  fluencyScore?: number;
  completenessScore?: number;
  wordScores?: WordScore[];
  feedbackSummary?: string; // Short text displayed in UI
  durationMs?: number;      // Duration of the analysis call
}

/**
 * Aggregate progress per sentence.
 * Used for stats and "best score" displays.
 */
export interface SentenceProgress {
  sentenceId: SentenceId;
  bestScore: number;         // Highest overallScore achieved
  lastScore?: number;
  attemptsCount: number;
  firstAttemptAt?: string;
  lastAttemptAt?: string;
}

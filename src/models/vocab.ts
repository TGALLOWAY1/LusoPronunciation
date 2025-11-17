import type { CategoryId, WordId } from "./content";

export type LearningStage = "new" | "learning" | "review" | "mastered";

/**
 * Per-word learning state for spaced repetition.
 */
export interface WordState {
  wordId: WordId;
  stage: LearningStage;
  easeFactor: number;       // e.g. start around 2.0
  intervalDays: number;     // 0 for new / due now
  dueAt: string;            // ISO timestamp
  correctStreak: number;
  incorrectStreak: number;
  totalReviews: number;
  lastResult?: "correct" | "incorrect";
  lastReviewedAt?: string;
  firstSeenAt?: string;
}

export type QuizPromptType = "pt_to_en" | "en_to_pt";

/**
 * A single vocab review event with all data embedded.
 * This is simpler than storing separate Question/Response records.
 */
export interface QuizReview {
  id: string;
  wordId: WordId;
  categoryId: CategoryId;
  promptType: QuizPromptType;
  promptText: string;      // What was displayed as the question
  choices: string[];       // Multiple-choice options
  correctAnswer: string;
  selectedAnswer: string;
  isCorrect: boolean;
  answeredAt: string;      // ISO timestamp
  responseTimeMs?: number;
}


import type { CategoryId } from "./content";

/**
 * Progress for a single category.
 * Can be computed from WordState + Word, or cached.
 */
export interface CategoryProgress {
  categoryId: CategoryId;
  totalWords: number;
  learnedWords: number;     // stage in ["learning", "review", "mastered"]
  masteredWords: number;    // stage === "mastered"
  lastUpdatedAt: string;
}

/**
 * Simple per-day summary for a "Stats" or "Today" panel.
 * Single-user app, so no userId needed.
 */
export interface DailySummary {
  date: string;             // "YYYY-MM-DD" in my timezone
  sentenceAttempts: number;
  vocabReviews: number;
  minutesPracticed?: number;
}


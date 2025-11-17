import type { Category, Word, Sentence } from "./content";
import type { Audio } from "./audio";
import type { SentenceAttempt, SentenceProgress } from "./practice";
import type { WordState, QuizReview } from "./vocab";
import type { CategoryProgress, DailySummary } from "./progress";

/**
 * Top-level structure for all persisted app data.
 * This could be backed by a JSON file or a DB later.
 */
export interface AppData {
  categories: Category[];
  words: Word[];
  sentences: Sentence[];
  audio: Audio[];
  sentenceAttempts: SentenceAttempt[];
  sentenceProgress: SentenceProgress[];
  wordStates: WordState[];
  quizReviews: QuizReview[];
  categoryProgress?: CategoryProgress[];
  dailySummaries?: DailySummary[];
}


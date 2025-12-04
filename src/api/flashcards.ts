/**
 * Flashcards API client
 * Handles spaced repetition system (SRS) flashcards
 */

import { authenticatedFetch } from './auth';

/**
 * Review outcome type
 */
export type ReviewOutcome = 'again' | 'hard' | 'good' | 'easy';

/**
 * Flashcard DTO
 */
export interface Flashcard {
  id: string;
  userId: string;
  contentId: string;
  contentType: 'sentence' | 'word';
  nextDueAt: string; // ISO timestamp
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  lastScore?: number;
  lastOutcome?: ReviewOutcome;
  historyCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get flashcards that are due for review
 */
export async function getDueFlashcards(limit: number = 20): Promise<Flashcard[]> {
  const response = await authenticatedFetch(`/api/flashcards/due?limit=${limit}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Review a flashcard and update SRS state
 */
export interface ReviewFlashcardParams {
  cardId: string;
  grade: ReviewOutcome;
  attemptId?: string;
  score?: number;
}

export async function reviewFlashcard(params: ReviewFlashcardParams): Promise<Flashcard> {
  const response = await authenticatedFetch('/api/flashcards/review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Ensure a flashcard exists for the given content
 * Creates one if it doesn't exist
 */
export async function ensureFlashcard(
  contentId: string,
  contentType: 'sentence' | 'word'
): Promise<Flashcard> {
  const response = await authenticatedFetch('/api/flashcards/ensure', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contentId, contentType }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Maps a pronunciation score to a review outcome
 * This matches the backend scoreToOutcome function
 */
export function scoreToOutcome(score: number): ReviewOutcome {
  if (score < 50) {
    return 'again'; // Poor - needs immediate review
  } else if (score < 70) {
    return 'hard'; // Below threshold - harder
  } else if (score < 90) {
    return 'good'; // Good performance
  } else {
    return 'easy'; // Excellent - can wait longer
  }
}


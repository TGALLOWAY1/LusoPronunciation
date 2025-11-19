/**
 * Practice Store
 * 
 * Manages pronunciation attempt history for sentences and words.
 * Provides a simple in-memory store that can be extended with persistence later.
 */

import type { AttemptScore } from '@/types/pronunciation';

// In-memory storage for attempts
// Key format: "sentence:{id}" or "word:{id}"
const attemptStore = new Map<string, AttemptScore[]>();

/**
 * Add a pronunciation attempt for a sentence.
 * 
 * @param sentenceId - The sentence ID
 * @param attempt - The attempt score data
 */
export function addSentenceAttempt(sentenceId: string, attempt: AttemptScore): void {
  const key = `sentence:${sentenceId}`;
  const attempts = attemptStore.get(key) || [];
  attempts.unshift(attempt); // Add to beginning (most recent first)
  attemptStore.set(key, attempts);
}

/**
 * Get all attempts for a sentence.
 * 
 * @param sentenceId - The sentence ID
 * @returns Array of attempts, most recent first
 */
export function getSentenceAttempts(sentenceId: string): AttemptScore[] {
  const key = `sentence:${sentenceId}`;
  return attemptStore.get(key) || [];
}

/**
 * Get the latest attempt for a sentence.
 * 
 * @param sentenceId - The sentence ID
 * @returns The most recent attempt, or null if none exist
 */
export function getLatestSentenceAttempt(sentenceId: string): AttemptScore | null {
  const attempts = getSentenceAttempts(sentenceId);
  return attempts.length > 0 ? attempts[0] : null;
}

/**
 * Add a pronunciation attempt for a word.
 * 
 * @param wordId - The word ID
 * @param attempt - The attempt score data
 */
export function addWordAttempt(wordId: string, attempt: AttemptScore): void {
  const key = `word:${wordId}`;
  const attempts = attemptStore.get(key) || [];
  attempts.unshift(attempt); // Add to beginning (most recent first)
  attemptStore.set(key, attempts);
}

/**
 * Get all attempts for a word.
 * 
 * @param wordId - The word ID
 * @returns Array of attempts, most recent first
 */
export function getWordAttempts(wordId: string): AttemptScore[] {
  const key = `word:${wordId}`;
  return attemptStore.get(key) || [];
}

/**
 * Get the latest attempt for a word.
 * 
 * @param wordId - The word ID
 * @returns The most recent attempt, or null if none exist
 */
export function getLatestWordAttempt(wordId: string): AttemptScore | null {
  const attempts = getWordAttempts(wordId);
  return attempts.length > 0 ? attempts[0] : null;
}

/**
 * Clear all attempts (useful for testing).
 */
export function clearAllAttempts(): void {
  attemptStore.clear();
}


/**
 * Drill log utilities for storing word drill attempts in localStorage
 */

import type { WordDrillLogEntry } from '@/types/drill';

export const WORD_DRILL_LOG_STORAGE_KEY = "lusopronounce_word_drill_log";

/**
 * Load all word drill log entries from localStorage
 * @returns Array of log entries, or empty array if none exist or on error
 */
export function loadWordDrillLog(): WordDrillLogEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(WORD_DRILL_LOG_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    
    // Validate that it's an array
    if (!Array.isArray(parsed)) {
      console.warn('Word drill log in localStorage is not an array, resetting');
      return [];
    }

    // Validate entries have required fields
    const validEntries = parsed.filter((entry: any) => {
      return (
        entry &&
        typeof entry.id === 'string' &&
        typeof entry.wordId === 'string' &&
        typeof entry.wordText === 'string' &&
        typeof entry.translation === 'string' &&
        typeof entry.known === 'boolean' &&
        typeof entry.timestamp === 'string' &&
        entry.mode === 'word-drill'
      );
    });

    if (validEntries.length !== parsed.length) {
      console.warn('Some word drill log entries were invalid and filtered out');
    }

    return validEntries;
  } catch (error) {
    console.error('Error loading word drill log from localStorage:', error);
    return [];
  }
}

/**
 * Append a new word drill log entry to localStorage
 * @param entry The log entry to append
 */
export function appendWordDrillLog(entry: WordDrillLogEntry): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const existing = loadWordDrillLog();
    const updated = [...existing, entry];
    window.localStorage.setItem(WORD_DRILL_LOG_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error appending word drill log to localStorage:', error);
    // Try to handle quota exceeded errors gracefully
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, cannot save drill log entry');
    }
  }
}


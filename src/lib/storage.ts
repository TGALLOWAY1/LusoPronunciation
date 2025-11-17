/**
 * LocalStorage utilities for persisting user preferences and state.
 */

const STORAGE_PREFIX = 'lusopronounce_';

export type PracticeMode = 'sentence' | 'word';

/**
 * Get the last practice mode used.
 */
export function getLastPracticeMode(): PracticeMode | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}lastPracticeMode`);
    return stored as PracticeMode | null;
  } catch (error) {
    console.warn('Failed to read last practice mode from localStorage:', error);
    return null;
  }
}

/**
 * Save the last practice mode used.
 */
export function setLastPracticeMode(mode: PracticeMode): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}lastPracticeMode`, mode);
  } catch (error) {
    console.warn('Failed to save last practice mode to localStorage:', error);
  }
}


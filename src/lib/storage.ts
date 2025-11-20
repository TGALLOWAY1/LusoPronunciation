/**
 * LocalStorage utilities for persisting user preferences and state.
 */

const STORAGE_PREFIX = 'lusopronounce_';

export type PracticeMode = 'sentence' | 'word';
export type WordVoice = 'male' | 'female';

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

/**
 * Get the preferred word voice (male or female).
 * Defaults to 'male' if not set.
 */
export function getPreferredWordVoice(): WordVoice {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}preferredWordVoice`);
    if (stored === 'male' || stored === 'female') {
      return stored;
    }
    return 'male'; // Default
  } catch (error) {
    console.warn('Failed to read preferred word voice from localStorage:', error);
    return 'male';
  }
}

/**
 * Save the preferred word voice.
 */
export function setPreferredWordVoice(voice: WordVoice): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}preferredWordVoice`, voice);
  } catch (error) {
    console.warn('Failed to save preferred word voice to localStorage:', error);
  }
}


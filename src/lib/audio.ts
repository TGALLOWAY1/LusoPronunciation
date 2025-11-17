import type { AudioIndex, AudioIndexEntry } from './types';

/**
 * Audio URL inference and resolution utilities.
 * Handles both audio_index.json lookups and fallback path inference.
 */

export type Gender = 'male' | 'female';

/**
 * Get audio URL from audio index if available, otherwise infer from naming convention.
 */
export function getSentenceAudioUrl(
  sentenceId: string,
  gender: Gender,
  audioIndex?: AudioIndex
): string | undefined {
  // First, try to find in audio index
  if (audioIndex && audioIndex[sentenceId]) {
    const entry = audioIndex[sentenceId];
    const url = entry.ptbr[gender];
    if (url) {
      // Ensure URL starts with / for Vite dev server
      return url.startsWith('/') ? url : `/${url}`;
    }
    return undefined;
  }

  // Fallback: infer from naming convention
  // Pattern: {category}_{number} -> /audio/ptbr/{gender}/{category}_{number}.wav
  // e.g., "food_001" -> "/audio/ptbr/male/food_001.wav"
  return `/audio/ptbr/${gender}/${sentenceId}.wav`;
}

/**
 * Get audio URL for a word.
 * Words follow pattern: {category}_word_{number}
 */
export function getWordAudioUrl(
  wordId: string,
  gender: Gender,
  audioIndex?: AudioIndex
): string | undefined {
  // First, try to find in audio index
  if (audioIndex && audioIndex[wordId]) {
    const entry = audioIndex[wordId];
    const url = entry.ptbr[gender];
    if (url) {
      // Ensure URL starts with / for Vite dev server
      return url.startsWith('/') ? url : `/${url}`;
    }
    return undefined;
  }

  // Fallback: infer from naming convention
  // Pattern: {category}_word_{number} -> /audio/ptbr/{gender}/{category}_word_{number}.wav
  // e.g., "food_word_001" -> "/audio/ptbr/male/food_word_001.wav"
  return `/audio/ptbr/${gender}/${wordId}.wav`;
}

/**
 * Load audio index from JSON file.
 */
export async function loadAudioIndex(): Promise<AudioIndex> {
  try {
    const response = await fetch('/data/audio_index.json');
    if (!response.ok) {
      console.warn('Failed to load audio_index.json, will use inferred paths');
      return {};
    }
    return await response.json();
  } catch (error) {
    console.warn('Error loading audio_index.json:', error);
    return {};
  }
}

/**
 * Get audio entry from index by ID.
 */
export function getAudioEntry(
  audioId: string,
  audioIndex: AudioIndex
): AudioIndexEntry | null {
  return audioIndex[audioId] || null;
}


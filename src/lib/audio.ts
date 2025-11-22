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
 * 
 * Word audio naming convention: public/audio/words/<wordId>_<gender>.wav
 * Examples:
 * - adj_001_female.wav
 * - food_word_001_male.wav
 * - basic_001_female.wav
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

  // Fallback: infer from filesystem naming convention
  // Pattern: <wordId>_<gender>.wav -> /audio/words/<wordId>_<gender>.wav
  // e.g., "food_word_001" + "male" -> "/audio/words/food_word_001_male.wav"
  // e.g., "adj_001" + "female" -> "/audio/words/adj_001_female.wav"
  return `/audio/words/${wordId}_${gender}.wav`;
}

/**
 * Load audio index from JSON file.
 * Returns empty object if loading fails (graceful degradation).
 * @throws Error only if there's a critical issue that should be surfaced
 */
export async function loadAudioIndex(): Promise<AudioIndex> {
  try {
    const response = await fetch('/data/audio_index.json');
    if (!response.ok) {
      console.warn(`Failed to load audio_index.json: ${response.status} ${response.statusText}. Will use inferred paths.`);
      return {};
    }
    const data = await response.json();
    if (!data || typeof data !== 'object') {
      console.warn('Invalid audio_index.json format, will use inferred paths');
      return {};
    }
    return data;
  } catch (error) {
    console.warn('Error loading audio_index.json:', error);
    // Return empty object as fallback - audio URLs will be inferred
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


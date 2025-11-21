/**
 * Global Audio Routing Utility
 * 
 * Provides centralized audio URL resolution based on voice selection.
 * This ensures all audio playback across the app uses the globally selected voice.
 * 
 * Audio mapping format:
 * - Sentences: Look up in audio_index.json by sentenceId, then fallback to naming convention
 * - Words: Look up in audio_index.json by wordId, then fallback to TTS-generated paths
 * 
 * Voice IDs:
 * - "male" | "female" - Standard voice variants
 * - Future: May support specific Azure TTS voices like "pt-BR-FranciscaNeural"
 */

import type { AudioIndex } from '@/lib/types';
import { getSentenceAudioUrl, getWordAudioUrl, loadAudioIndex } from '@/lib/audio';
import { getWordAudioPath } from '@/lib/wordAudioPaths';
import type { WordVoice } from '@/lib/storage';

// Cache for audio index
let audioIndexCache: AudioIndex | null = null;
let audioIndexPromise: Promise<AudioIndex> | null = null;

/**
 * Get the cached audio index, loading it if necessary.
 */
async function getAudioIndex(): Promise<AudioIndex> {
  if (audioIndexCache) {
    return audioIndexCache;
  }
  
  if (!audioIndexPromise) {
    audioIndexPromise = loadAudioIndex().then((index: AudioIndex) => {
      audioIndexCache = index;
      return index;
    });
  }
  
  return audioIndexPromise;
}

/**
 * Get audio URL for a sentence based on voice selection.
 * 
 * @param sentenceId - The sentence ID (e.g., "food_001")
 * @param voiceId - The voice ID ("male" | "female")
 * @returns The audio URL, or null if not found
 * 
 * @example
 * const url = await getAudioUrlForSentence("food_001", "male");
 * // Returns: "/audio/ptbr/male/food_001.wav" or from audio_index.json
 */
export async function getAudioUrlForSentence(
  sentenceId: string,
  voiceId: WordVoice
): Promise<string | null> {
  try {
    const audioIndex = await getAudioIndex();
    const url = getSentenceAudioUrl(sentenceId, voiceId, audioIndex);
    return url || null;
  } catch (error) {
    console.error(`Error resolving audio URL for sentence "${sentenceId}" (${voiceId}):`, error);
    return null;
  }
}

/**
 * Synchronous version that uses cached audio index if available.
 * Falls back to naming convention if index not loaded yet.
 * 
 * @param sentenceId - The sentence ID
 * @param voiceId - The voice ID
 * @returns The audio URL, or null if not found
 */
export function getAudioUrlForSentenceSync(
  sentenceId: string,
  voiceId: WordVoice
): string | null {
  try {
    const url = getSentenceAudioUrl(sentenceId, voiceId, audioIndexCache || undefined);
    return url || null;
  } catch (error) {
    console.error(`Error resolving audio URL for sentence "${sentenceId}" (${voiceId}):`, error);
    return null;
  }
}

/**
 * Get audio URL for a word based on voice selection.
 * 
 * Priority:
 * 1. Check audio_index.json for word audio
 * 2. Fallback to TTS-generated word audio path
 * 
 * @param wordId - The word ID (e.g., "food_word_001")
 * @param voiceId - The voice ID ("male" | "female")
 * @returns The audio URL, or null if not found
 * 
 * @example
 * const url = await getAudioUrlForWord("food_word_001", "female");
 * // Returns: "/audio/words/food_word_001_female.wav" or from audio_index.json
 */
export async function getAudioUrlForWord(
  wordId: string,
  voiceId: WordVoice
): Promise<string | null> {
  try {
    const audioIndex = await getAudioIndex();
    
    // First try audio_index.json
    const urlFromIndex = getWordAudioUrl(wordId, voiceId, audioIndex);
    if (urlFromIndex) {
      return urlFromIndex;
    }
    
    // Fallback to TTS-generated path
    return getWordAudioPath(wordId, voiceId);
  } catch (error) {
    console.error(`Error resolving audio URL for word "${wordId}" (${voiceId}):`, error);
    // Fallback to TTS path even on error
    return getWordAudioPath(wordId, voiceId);
  }
}

/**
 * Synchronous version that uses cached audio index if available.
 * Falls back to TTS-generated path if index not loaded yet.
 * 
 * @param wordId - The word ID
 * @param voiceId - The voice ID
 * @returns The audio URL, or null if not found
 */
export function getAudioUrlForWordSync(
  wordId: string,
  voiceId: WordVoice
): string {
  try {
    // First try audio_index.json if cached
    if (audioIndexCache) {
      const urlFromIndex = getWordAudioUrl(wordId, voiceId, audioIndexCache);
      if (urlFromIndex) {
        return urlFromIndex;
      }
    }
    
    // Fallback to TTS-generated path
    return getWordAudioPath(wordId, voiceId);
  } catch (error) {
    console.error(`Error resolving audio URL for word "${wordId}" (${voiceId}):`, error);
    // Fallback to TTS path even on error
    return getWordAudioPath(wordId, voiceId);
  }
}

/**
 * Preload the audio index to improve performance.
 * Call this early in the app lifecycle.
 */
export async function preloadAudioIndex(): Promise<void> {
  await getAudioIndex();
}


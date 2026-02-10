import type { AudioIndex, AudioIndexEntry } from './types';
import { CONTENT_SOURCE, getReleaseDataPath } from '@/config/appConfig';
import { ensureDatasetBootstrap } from '@/pipeline/release/datasetBootstrap';

/**
 * Audio URL inference and resolution utilities.
 * Handles both audio_index.json lookups and fallback path inference.
 */

export type Gender = 'male' | 'female';

/**
 * Maps gender to canonical voiceId.
 * 
 * @param gender - Gender ("male" | "female")
 * @returns Voice ID (e.g., "ptbr_male" | "ptbr_female")
 */
function genderToVoiceId(gender: Gender): string {
  return `ptbr_${gender}`;
}

/**
 * Get audio URL from audio index if available, otherwise infer from naming convention.
 * 
 * Priority:
 * 1. Check canonical `voices` field in audio index (new format)
 * 2. Check legacy `ptbr` field in audio index (backward compatibility)
 * 3. Fall back to inferred canonical path
 * 4. Fall back to legacy inferred path
 */
export function getSentenceAudioUrl(
  sentenceId: string,
  gender: Gender,
  audioIndex?: AudioIndex
): string | undefined {
  // First, try to find in audio index
  if (audioIndex && audioIndex[sentenceId]) {
    const entry = audioIndex[sentenceId];
    const voiceId = genderToVoiceId(gender);
    
    // Priority 1: Check canonical voices field (new format)
    if (entry.voices && entry.voices[voiceId]) {
      const url = entry.voices[voiceId];
      return url.startsWith('/') ? url : `/${url}`;
    }
    
    // Priority 2: Check legacy ptbr field (backward compatibility)
    const legacyUrl = entry.ptbr[gender];
    if (legacyUrl) {
      return legacyUrl.startsWith('/') ? legacyUrl : `/${legacyUrl}`;
    }
  }

  // Priority 3: Fall back to inferred canonical path
  const voiceId = genderToVoiceId(gender);
  return `/audio/sentences/${voiceId}/${sentenceId}.wav`;
}

/**
 * Get audio URL for a word.
 * 
 * Priority:
 * 1. Check canonical `voices` field in audio index (new format)
 * 2. Check legacy `ptbr` field in audio index (backward compatibility)
 * 3. Fall back to inferred canonical path
 * 4. Fall back to legacy inferred path (old naming: <wordId>_<gender>.wav)
 */
export function getWordAudioUrl(
  wordId: string,
  gender: Gender,
  audioIndex?: AudioIndex
): string | undefined {
  // First, try to find in audio index
  if (audioIndex && audioIndex[wordId]) {
    const entry = audioIndex[wordId];
    const voiceId = genderToVoiceId(gender);
    
    // Priority 1: Check canonical voices field (new format)
    if (entry.voices && entry.voices[voiceId]) {
      const url = entry.voices[voiceId];
      return url.startsWith('/') ? url : `/${url}`;
    }
    
    // Priority 2: Check legacy ptbr field (backward compatibility)
    const legacyUrl = entry.ptbr[gender];
    if (legacyUrl) {
      return legacyUrl.startsWith('/') ? legacyUrl : `/${legacyUrl}`;
    }
  }

  // Priority 3: Fall back to inferred canonical path
  const voiceId = genderToVoiceId(gender);
  return `/audio/words/${voiceId}/${wordId}.wav`;
}

/**
 * Load audio index from JSON file.
 * Returns empty object if loading fails (graceful degradation).
 * @throws Error only if there's a critical issue that should be surfaced
 */
export async function loadAudioIndex(): Promise<AudioIndex> {
  try {
    if (CONTENT_SOURCE === 'pipeline') {
      await ensureDatasetBootstrap();
      const releasePath = getReleaseDataPath('audio_index.json');
      const releaseResponse = await fetch(releasePath);
      if (releaseResponse.ok) {
        const releaseData = await releaseResponse.json();
        if (releaseData && typeof releaseData === 'object') {
          return releaseData;
        }
      }
      throw new Error(`Failed to load release audio index from ${releasePath}`);
    }

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

import type { WordVoice } from '@/lib/storage';

/**
 * Voice family parsed from a generated audio path. Matches the conventions
 * used in `data/audio_index.json` and `src/lib/wordAudioPaths.ts`:
 *
 * - `/audio/ptbr/male/*.wav`
 * - `/audio/words/ptbr_female/*.wav`
 * - `/audio/words/<id>_male.wav`
 */
export type VoiceFamily = 'male' | 'female';

export function getVoiceTagFromUrl(url: string | null | undefined): VoiceFamily | null {
  if (!url) return null;
  const lower = url.toLowerCase();

  if (/(^|\/)ptbr_male(\/|$)/.test(lower) || /(^|\/)male(\/|$)/.test(lower) || /_male\.[a-z0-9]+$/.test(lower)) {
    return 'male';
  }
  if (
    /(^|\/)ptbr_female(\/|$)/.test(lower) ||
    /(^|\/)female(\/|$)/.test(lower) ||
    /_female\.[a-z0-9]+$/.test(lower)
  ) {
    return 'female';
  }
  return null;
}

/**
 * True if the sentence audio URL and every word audio URL resolve to the
 * same voice family as `selectedVoice`. URLs whose voice tag cannot be
 * parsed are treated as consistent (we only flag *known* mismatches).
 */
export function isSameVoiceFamily(
  sentenceUrl: string | null | undefined,
  wordUrls: Array<string | null | undefined>,
  selectedVoice: WordVoice
): boolean {
  const sentenceTag = getVoiceTagFromUrl(sentenceUrl);
  if (sentenceTag && sentenceTag !== selectedVoice) return false;

  for (const url of wordUrls) {
    const tag = getVoiceTagFromUrl(url);
    if (tag && tag !== selectedVoice) return false;
  }
  return true;
}

/**
 * Fallback pronunciation generator.
 *
 * When no curated `masterWords.json` entry (exact or lemma) matches a token,
 * we run the existing heuristic grapheme-to-phoneme mapper
 * (`src/pipeline/phonemeMapper.ts`) to produce a best-effort phoneme sequence,
 * a rough syllable split, a generic tip, and a numeric confidence score.
 *
 * Results are cached in MongoDB via `GeneratedPronunciationModel` keyed by
 * the normalized surface form so the same word never gets re-computed.
 *
 * Confidence bands:
 *   phonemes.length > 0 → 0.6 ("generated",  medium bucket)
 *   phonemes.length = 0 → 0.3 ("unresolved", low bucket)
 */

import { mapWordToPhonemes } from '../../pipeline/phonemeMapper';
import { GeneratedPronunciationModel } from '../models/GeneratedPronunciationModel';

const LOG_TAG = '[GeneratedPronunciation]';

export type GeneratedResolutionType = 'generated' | 'unresolved';

export interface GeneratedPronunciationPayload {
  id: string;
  resolutionType: GeneratedResolutionType;
  surfaceForm: string;
  phonemes: string[];
  ipa?: string;
  syllables: string[];
  tipText: string;
  confidence: number;
  needsReview: boolean;
}

/**
 * Generates (or reads from cache) a pronunciation record for a surface form.
 * The input is normalized internally so callers can pass either the raw
 * surface form or a pre-normalized lookup key.
 */
export async function generatePronunciation(
  surfaceForm: string
): Promise<GeneratedPronunciationPayload> {
  const key = normalizeForCacheKey(surfaceForm);
  if (!key) {
    throw new Error('generatePronunciation: empty surfaceForm');
  }

  const cached = await GeneratedPronunciationModel.findOne({ surfaceForm: key });
  if (cached) {
    return toPayload(cached);
  }

  const { phonemes, ipa } = mapWordToPhonemes(key);
  const syllables = estimateSyllables(key);
  const hasPhonemes = phonemes.length > 0;
  const confidence = hasPhonemes ? 0.6 : 0.3;
  const needsReview = !hasPhonemes;
  const tipText = hasPhonemes
    ? 'Auto-generated pronunciation — follow the native TTS audio for the definitive sound.'
    : 'Pronunciation unavailable for this word — listen to the native TTS audio and imitate it.';

  const doc = await GeneratedPronunciationModel.findOneAndUpdate(
    { surfaceForm: key },
    {
      $setOnInsert: {
        surfaceForm: key,
        phonemes,
        ipa,
        syllables,
        tipText,
        confidence,
        needsReview,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(
    `${LOG_TAG} cached ${key} phonemes=${phonemes.length} confidence=${confidence}`
  );

  return toPayload(doc);
}

function toPayload(
  doc: InstanceType<typeof GeneratedPronunciationModel>
): GeneratedPronunciationPayload {
  const hasPhonemes = doc.phonemes.length > 0;
  return {
    id: doc._id.toHexString(),
    resolutionType: hasPhonemes ? 'generated' : 'unresolved',
    surfaceForm: doc.surfaceForm,
    phonemes: doc.phonemes,
    ipa: doc.ipa,
    syllables: doc.syllables,
    tipText: doc.tipText,
    confidence: doc.confidence,
    needsReview: doc.needsReview,
  };
}

function normalizeForCacheKey(input: string): string {
  return (input ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\-']/gu, '');
}

/**
 * Rough syllable split for Portuguese.
 *
 * Heuristic:
 *   - Find vowel positions (a/e/i/o/u, including accented variants, treating
 *     consecutive vowels as one diphthong nucleus).
 *   - Between two nuclei, one consonant goes with the following syllable,
 *     two+ consonants are split down the middle.
 *
 * Good enough for a human-readable hint — not phonologically exact.
 */
export function estimateSyllables(word: string): string[] {
  const lower = (word ?? '').toLowerCase();
  if (!lower) return [];

  const VOWEL = /[aeiouáàâãéêíóôõúüy]/i;
  const nuclei: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < lower.length) {
    if (VOWEL.test(lower[i])) {
      const start = i;
      while (i < lower.length && VOWEL.test(lower[i])) i += 1;
      nuclei.push({ start, end: i - 1 });
    } else {
      i += 1;
    }
  }

  if (nuclei.length <= 1) return [word];

  const ONSET_STOPS = new Set(['p', 'b', 't', 'd', 'c', 'g', 'f', 'v']);
  const isOnsetCluster = (c1: string, c2: string): boolean =>
    ONSET_STOPS.has(c1) && (c2 === 'r' || c2 === 'l');

  const syllables: string[] = [];
  let cut = 0;
  for (let n = 0; n < nuclei.length - 1; n += 1) {
    const here = nuclei[n];
    const next = nuclei[n + 1];
    const consonantsBetween = next.start - here.end - 1;
    let splitAt: number;
    if (consonantsBetween === 0) {
      // Hiatus / diphthong break — split at the vowel boundary.
      splitAt = next.start;
    } else if (consonantsBetween === 1) {
      // Single consonant goes with the following syllable (ca-sa).
      splitAt = here.end + 1;
    } else if (consonantsBetween === 2) {
      const c1 = lower[here.end + 1];
      const c2 = lower[here.end + 2];
      // Onset cluster (tr, pr, bl, …) stays together with the next syllable.
      splitAt = isOnsetCluster(c1, c2) ? here.end + 1 : here.end + 2;
    } else {
      splitAt = here.end + 1 + Math.floor(consonantsBetween / 2);
    }
    syllables.push(word.slice(cut, splitAt));
    cut = splitAt;
  }
  syllables.push(word.slice(cut));
  return syllables;
}

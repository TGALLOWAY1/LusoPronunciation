/**
 * Learning Resources Resolver
 *
 * Maps difficult phonemes and words to pronunciation learning resources.
 *
 * Strategy (see docs/architecture/analytics-pipeline.md):
 *   - Deterministic, zero-maintenance YouTube *search* URLs are always generated, so
 *     every sound/word has a working "learn more" link without any manual curation and
 *     without an API key.
 *   - A small, optional `CURATED_*` override map can pin a few stable, high-authority
 *     reference pages for the hardest sounds. It links to durable reference pages
 *     (not specific videos), so it does not rot. Leave it empty to rely purely on search.
 *
 * All functions are pure and synchronous (no network calls).
 */

import { getPhonemeById } from './phonemeMetadata';
import type { LearningResource } from './types';

const YOUTUBE_SEARCH = 'https://www.youtube.com/results?search_query=';
const FORVO_WORD = 'https://forvo.com/word/';

/**
 * Curated overrides keyed by canonical phoneme id. Intentionally tiny and limited to
 * durable reference pages for the sounds English speakers struggle with most.
 */
const CURATED_PHONEME_RESOURCES: Record<string, LearningResource[]> = {
  AN_NASAL: nasalVowelReference(),
  EN_NASAL: nasalVowelReference(),
  IN_NASAL: nasalVowelReference(),
  ON_NASAL: nasalVowelReference(),
  UN_NASAL: nasalVowelReference(),
  LH: [
    {
      label: 'Portuguese phonology reference (lh / ʎ)',
      url: 'https://en.wikipedia.org/wiki/Portuguese_phonology#Consonants',
      source: 'curated',
    },
  ],
  NH: [
    {
      label: 'Portuguese phonology reference (nh / ɲ)',
      url: 'https://en.wikipedia.org/wiki/Portuguese_phonology#Consonants',
      source: 'curated',
    },
  ],
};

function nasalVowelReference(): LearningResource[] {
  return [
    {
      label: 'Portuguese nasal vowels reference',
      url: 'https://en.wikipedia.org/wiki/Portuguese_phonology#Nasal_vowels',
      source: 'curated',
    },
  ];
}

/**
 * Returns pronunciation learning resources for a phoneme.
 *
 * Curated overrides (if any) come first, followed by an always-present generated
 * YouTube search tuned to the phoneme's IPA symbol.
 */
export function getPhonemeResources(phonemeId: string): LearningResource[] {
  const meta = getPhonemeById(phonemeId);
  const canonical = meta?.id ?? phonemeId.trim().toUpperCase();
  const symbol = meta?.ipa ? `/${meta.ipa}/` : canonical;

  const resources: LearningResource[] = [];
  const curated = CURATED_PHONEME_RESOURCES[canonical];
  if (curated) resources.push(...curated);

  const query = `Brazilian Portuguese ${symbol} sound pronunciation tutorial`;
  resources.push({
    label: `How to pronounce ${symbol} in Brazilian Portuguese`,
    url: YOUTUBE_SEARCH + encodeURIComponent(query),
    source: 'youtube-search',
  });

  return resources;
}

/**
 * Returns pronunciation learning resources for a word: a YouTube search and a
 * direct Forvo native-speaker recording link.
 */
export function getWordResources(word: { textPt: string }): LearningResource[] {
  const text = word.textPt;
  const query = `Brazilian Portuguese pronunciation "${text}"`;
  return [
    {
      label: `How to say “${text}”`,
      url: YOUTUBE_SEARCH + encodeURIComponent(query),
      source: 'youtube-search',
    },
    {
      label: `Hear “${text}” on Forvo`,
      url: `${FORVO_WORD}${encodeURIComponent(text)}/#pt`,
      source: 'forvo',
    },
  ];
}

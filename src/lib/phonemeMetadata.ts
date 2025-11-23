/**
 * Phoneme Metadata Loader
 * 
 * Loads and provides access to phoneme metadata from data/phoneme_metadata.json.
 * This is the canonical source for phoneme metadata in the runtime.
 * 
 * The metadata file contains rich information about each phoneme including:
 * - IPA symbols, type, category, difficulty
 * - Articulation and acoustic descriptions
 * - Common mistakes and teaching tips
 * - Minimal pairs and example words
 */

import rawPhonemeMetadata from '../../data/phoneme_metadata.json';

/**
 * Minimal pair entry showing contrast between phonemes.
 */
export interface MinimalPair {
  pair: [string, string];
  contrast: string;
}

/**
 * Example word entry demonstrating the phoneme in context.
 */
export interface ExampleWord {
  pt: string;
  ipa: string;
  stressPattern: string;
  english: string;
}

/**
 * Complete phoneme metadata entry matching the structure in data/phoneme_metadata.json.
 */
export interface PhonemeMeta {
  id: string;
  ipa: string;
  type: string;
  category: string;
  difficulty: number;
  englishApprox: string;
  articulation: string;
  acousticDescription: string;
  commonMistakes: string[];
  teachingTips: string[];
  minimalPairs: MinimalPair[];
  exampleWords: ExampleWord[];
}

// Type assertion: the JSON is an array of PhonemeMeta objects
const PHONEME_METADATA_ARRAY = rawPhonemeMetadata as PhonemeMeta[];

// Create a lookup map by ID for efficient access
const PHONEME_METADATA_MAP = new Map<string, PhonemeMeta>();
for (const entry of PHONEME_METADATA_ARRAY) {
  // Store by both uppercase and lowercase ID for case-insensitive lookup
  PHONEME_METADATA_MAP.set(entry.id, entry);
  PHONEME_METADATA_MAP.set(entry.id.toLowerCase(), entry);
  PHONEME_METADATA_MAP.set(entry.id.toUpperCase(), entry);
}

// Alias mapping for Azure phonemes that differ from our canonical IDs
const PHONEME_ALIASES: Record<string, string> = {
  'R': 'R_TAP', // Azure uses 'r' for tap/flap, we use 'R_TAP'
  'AX': 'AH',   // Azure uses 'ax' for schwa, we use 'AH' (near-open central)
  'AE': 'EH',   // Azure uses 'ae' (near-open front), we map to 'EH' (open-mid front)
  'NG': 'N',    // Azure uses 'ng' (velar nasal), we map to 'N' (alveolar nasal) as approximation
  'IH': 'IY',   // Azure uses 'ih' (near-close front), we map to 'IY' (close front)
  'UH': 'UW',   // Azure uses 'uh' (near-close back), we map to 'UW' (close back)
  'AY': 'AA',   // Azure uses 'ay' (diphthong), we map to 'AA' (open central)
  'AW': 'AA',   // Azure uses 'aw' (diphthong), we map to 'AA' (open central)
  'OY': 'AO',   // Azure uses 'oy' (diphthong), we map to 'AO' (open-mid back)
};

/**
 * Normalizes a phoneme ID for lookup (case-insensitive).
 * Also applies alias mapping for Azure phoneme symbols.
 * 
 * @param id - The phoneme ID (e.g., "AA", "ah", "aa")
 * @returns Normalized ID in uppercase
 */
function normalizeId(id: string): string {
  const upper = id.trim().toUpperCase();
  return PHONEME_ALIASES[upper] || upper;
}

/**
 * Gets phoneme metadata by ID (case-insensitive).
 * 
 * This is the primary lookup function for phoneme metadata.
 * 
 * @param id - The phoneme ID (e.g., "AA", "ah", "aa")
 * @returns PhonemeMeta if found, undefined otherwise
 * 
 * @example
 * const meta = getPhonemeById("AA");
 * if (meta) {
 *   console.log(meta.ipa); // "a"
 *   console.log(meta.englishApprox); // "Similar to 'f'a'ther'"
 * }
 */
export function getPhonemeById(id: string): PhonemeMeta | undefined {
  if (!id || id.trim().length === 0) {
    return undefined;
  }

  const normalized = normalizeId(id);
  return PHONEME_METADATA_MAP.get(normalized);
}

/**
 * Gets all available phoneme metadata entries.
 * 
 * @returns Array of all phoneme metadata entries, sorted by ID
 */
export function getAllPhonemes(): PhonemeMeta[] {
  return [...PHONEME_METADATA_ARRAY].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Gets phoneme metadata for a given symbol (backward compatibility).
 * 
 * @deprecated Use getPhonemeById() instead. This function is kept for backward compatibility
 * but may be removed in a future version.
 * 
 * @param symbol - The phoneme symbol/ID (e.g., "aa", "AA", "ah")
 * @returns PhonemeMeta if found, undefined otherwise
 */
export function getPhonemeMetadata(symbol: string): PhonemeMeta | undefined {
  return getPhonemeById(symbol);
}

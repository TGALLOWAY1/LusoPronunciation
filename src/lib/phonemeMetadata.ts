/**
 * Phoneme Metadata Loader
 * 
 * Loads and provides access to phoneme metadata from data/phoneme_metadata.json.
 * Maps ARPABET symbols (used by Azure Speech) to IPA symbols and pronunciation guidance.
 */

import rawPhonemeMetadata from '../../data/phoneme_metadata.json';

export interface PhonemeMetadata {
  ipa: string;
  description: string;
  englishExamples: string[];
  portugueseExamples: string[];
  notes?: string;
}

type PhonemeMetadataMap = Record<string, PhonemeMetadata>;

const METADATA: PhonemeMetadataMap = rawPhonemeMetadata as PhonemeMetadataMap;

/**
 * Normalizes a phoneme symbol for lookup.
 * Converts to lowercase to handle case variations in ARPABET symbols.
 * 
 * @param symbol - The phoneme symbol (ARPABET or IPA)
 * @returns Normalized symbol in lowercase
 */
function normalizeSymbol(symbol: string): string {
  return symbol.toLowerCase().trim();
}

/**
 * Gets phoneme metadata for a given ARPABET symbol.
 * 
 * @param symbol - The ARPABET phoneme symbol (e.g., "aa", "b", "ch")
 * @returns PhonemeMetadata if found, undefined otherwise
 */
export function getPhonemeMetadata(symbol: string): PhonemeMetadata | undefined {
  if (!symbol) {
    return undefined;
  }

  const normalized = normalizeSymbol(symbol);
  
  // Try exact match first
  if (METADATA[normalized]) {
    return METADATA[normalized];
  }
  
  // Try with Unicode normalization (NFC)
  const nfcNormalized = normalized.normalize('NFC');
  if (METADATA[nfcNormalized]) {
    return METADATA[nfcNormalized];
  }
  
  // Try with Unicode normalization (NFD - decomposed form)
  const nfdNormalized = normalized.normalize('NFD');
  if (METADATA[nfdNormalized]) {
    return METADATA[nfdNormalized];
  }
  
  return undefined;
}

/**
 * Gets all available phoneme metadata entries.
 * 
 * @returns Array of all phoneme metadata entries, sorted by symbol
 */
export function getAllPhonemes(): Array<{ symbol: string; metadata: PhonemeMetadata }> {
  return Object.entries(METADATA)
    .map(([symbol, metadata]) => ({
      symbol,
      metadata,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

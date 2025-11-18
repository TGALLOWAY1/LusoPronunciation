import rawPhonemeMetadata from '../../data/phoneme_metadata.json';

export interface PhonemeMetadataEntry {
  ipa: string;
  type: 'vowel' | 'consonant' | string;
  description: string;
  examplePt?: string;
  exampleEn?: string;
}

export type PhonemeMetadataMap = Record<string, PhonemeMetadataEntry>;

const METADATA: PhonemeMetadataMap = rawPhonemeMetadata as PhonemeMetadataMap;

/**
 * Gets phoneme metadata for a given IPA symbol.
 * Attempts normalization to handle Unicode variations.
 * 
 * @param symbol - The IPA phoneme symbol
 * @returns PhonemeMetadataEntry if found, undefined otherwise
 */
export function getPhonemeMetadata(symbol: string): PhonemeMetadataEntry | undefined {
  // Try exact match first
  if (METADATA[symbol]) {
    return METADATA[symbol];
  }
  
  // Try normalized form (NFC normalization)
  const normalized = symbol.normalize('NFC');
  if (METADATA[normalized]) {
    return METADATA[normalized];
  }
  
  // Try NFD normalization (decomposed form)
  const decomposed = symbol.normalize('NFD');
  if (METADATA[decomposed]) {
    return METADATA[decomposed];
  }
  
  return undefined;
}


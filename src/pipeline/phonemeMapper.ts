/**
 * Phoneme mapper for words.
 * 
 * Maps Portuguese words to IPA transcriptions and phoneme sequences.
 * Uses heuristic-based rules to identify difficult sounds for English speakers.
 * 
 * This is a rule-based implementation that can be refined later with
 * more sophisticated phoneme analysis or external pronunciation APIs.
 */

// TODO: Import phoneme metadata utilities when implementing full grapheme-to-phoneme mapping
// import { getAllPhonemes, getPhonemeMetadata } from '../lib/phonemeMetadata';

/**
 * Gets phonemes and IPA for a token.
 * 
 * This is a simplified heuristic-based implementation. A full implementation
 * would use grapheme-to-phoneme conversion rules or an external API.
 * 
 * For now, returns empty arrays and undefined IPA, but provides the structure
 * for future enhancement.
 * 
 * @param token - The token (word) to analyze
 * @returns Object with phonemes array and optional IPA string
 */
export function getPhonemesForToken(token: string): { phonemes: string[]; ipa?: string } {
  if (!token || token.trim().length === 0) {
    return { phonemes: [] };
  }

  // TODO: Implement full grapheme-to-phoneme mapping
  // For now, return empty phonemes array
  // Future: Use phonemeMetadata to map Portuguese graphemes to ARPABET/IPA symbols
  
  // Placeholder: could analyze token and return some basic phonemes
  // This is a stub that can be enhanced later
  const phonemes: string[] = [];
  const ipa: string | undefined = undefined;

  return { phonemes, ipa };
}

/**
 * Determines if a word is hard for English speakers based on phoneme analysis.
 * 
 * Simple heuristic-based approach:
 * - Identifies nasal vowels (ã, õ, ão) and difficult digraphs (lh, nh, rr, word-initial r)
 * - Can also analyze phonemes array if provided
 * 
 * @param phonemes - Array of phoneme codes (ARPABET or similar)
 * @returns true if the word is likely difficult for English speakers
 */
export function isHardForEnglish(phonemes: string[]): boolean {
  // If phonemes are provided, analyze them
  // For now, this is a simple stub - could check for specific difficult phonemes
  if (phonemes.length > 0) {
    // TODO: Check for difficult phonemes in the array
    // Could look for nasal vowels, guttural R sounds, etc.
  }

  // For now, return false as a safe default
  // The actual difficulty will be determined by analyzing the word text
  // in the tagging/enrichment stage
  return false;
}

/**
 * Maps a Portuguese word to phonemes and IPA, and determines if it's hard for English speakers.
 * 
 * Heuristic-based approach:
 * - Identifies nasal vowels (ã, õ, ão) and difficult digraphs (lh, nh, rr, word-initial r)
 * - Returns undefined for IPA/phonemes for now (TODO: implement grapheme-to-phoneme mapping)
 * 
 * @param word - The Portuguese word to analyze
 * @returns Object with IPA, phonemes (optional), and difficulty flag
 */
export function mapWordToPhonemes(
  word: string
): {
  ipa?: string;
  phonemes?: string[];
  isHardForEnglishSpeakers: boolean;
} {
  if (!word || word.trim().length === 0) {
    return {
      isHardForEnglishSpeakers: false,
    };
  }

  const normalized = word.toLowerCase().trim();
  let isHard = false;

  // Check for nasal vowels (common difficulty for English speakers)
  if (normalized.includes('ã') || normalized.includes('õ') || normalized.includes('ão')) {
    isHard = true;
  }

  // Check for difficult digraphs
  if (normalized.includes('lh') || normalized.includes('nh')) {
    isHard = true;
  }

  // Check for double 'r' (guttural R sound)
  if (normalized.includes('rr')) {
    isHard = true;
  }

  // Check for word-initial 'r' (also guttural in Portuguese)
  if (normalized.startsWith('r')) {
    isHard = true;
  }

  // Get phonemes using the helper function
  const { phonemes, ipa } = getPhonemesForToken(word);

  return {
    ipa,
    phonemes: phonemes.length > 0 ? phonemes : undefined,
    isHardForEnglishSpeakers: isHard,
  };
}


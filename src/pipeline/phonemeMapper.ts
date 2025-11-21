/**
 * Phoneme mapper for words.
 * 
 * Maps Portuguese words to IPA transcriptions and phoneme sequences.
 * Uses heuristic-based rules to identify difficult sounds for English speakers.
 * 
 * This is a rule-based implementation that can be refined later with
 * more sophisticated phoneme analysis or external pronunciation APIs.
 */

// TODO: Import phoneme metadata utilities when implementing grapheme-to-phoneme mapping
// import { getAllPhonemes } from '../lib/phonemeMetadata';

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

  // TODO: Implement grapheme-to-phoneme mapping using phonemeMetadata
  // For now, return undefined for IPA and phonemes
  // Future: Use phonemeMetadata to map graphemes to ARPABET/IPA symbols

  return {
    ipa: undefined,
    phonemes: undefined,
    isHardForEnglishSpeakers: isHard,
  };
}


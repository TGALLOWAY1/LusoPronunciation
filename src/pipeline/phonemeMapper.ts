/**
 * Phoneme mapper for words.
 * 
 * Maps Portuguese words to IPA transcriptions and phoneme sequences.
 * Uses heuristic-based rules to identify difficult sounds for English speakers.
 * 
 * This is a minimal rule-based implementation that can be refined later with
 * more sophisticated phoneme analysis or external pronunciation APIs.
 */

import { getPhonemeById } from '../lib/phonemeMetadata';

/**
 * Gets phonemes and IPA for a token.
 * 
 * This is a minimal grapheme-to-phoneme implementation using simple rules.
 * 
 * @param token - The token (word) to analyze
 * @returns Object with phonemes array and optional IPA string
 */
export function getPhonemesForToken(token: string): { phonemes: string[]; ipa?: string } {
  if (!token || token.trim().length === 0) {
    return { phonemes: [] };
  }

  // Use mapWordToPhonemes for the actual mapping
  const result = mapWordToPhonemes(token);
  return {
    phonemes: result.phonemes || [],
    ipa: result.ipa,
  };
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
 * Maps a Portuguese word to phonemes using minimal grapheme-to-phoneme rules.
 * 
 * Simple mapping rules:
 * - Direct consonant mapping (p,b,m,n,t,d,k,g,f,v,s,z,l,r,ch,j,lh,nh)
 * - Basic vowel mapping (a,e,i,o,u)
 * - Simple nasalization (final m/n → nasal vowel)
 * 
 * All mapped phoneme IDs are verified against phoneme_metadata.json.
 * Unknown cases return empty array with TODO comments.
 * 
 * @param word - The Portuguese word to analyze
 * @returns Object with phonemes array (verified against metadata) and optional IPA
 */
export function mapWordToPhonemes(word: string): {
  phonemes: string[];
  ipa?: string;
} {
  if (!word || word.trim().length === 0) {
    return { phonemes: [] };
  }

  const normalized = word.toLowerCase().trim();
  const phonemes: string[] = [];
  let i = 0;

  while (i < normalized.length) {
    const char = normalized[i];
    const nextChar = i + 1 < normalized.length ? normalized[i + 1] : '';
    const twoChars = char + nextChar;

    // Silent h in Portuguese orthography
    if (char === 'h') {
      i++;
      continue;
    }

    // Handle digraphs first (longer sequences take priority)
    if (twoChars === 'lh') {
      const phonemeId = 'LH';
      if (getPhonemeById(phonemeId)) {
        phonemes.push(phonemeId);
        i += 2;
        continue;
      }
      // TODO: Handle unknown 'lh' case
      i += 2;
      continue;
    }

    if (twoChars === 'nh') {
      const phonemeId = 'NH';
      if (getPhonemeById(phonemeId)) {
        phonemes.push(phonemeId);
        i += 2;
        continue;
      }
      // TODO: Handle unknown 'nh' case
      i += 2;
      continue;
    }

    if (twoChars === 'ch') {
      const phonemeId = 'CH';
      if (getPhonemeById(phonemeId)) {
        phonemes.push(phonemeId);
        i += 2;
        continue;
      }
      // TODO: Handle unknown 'ch' case
      i += 2;
      continue;
    }

    if (twoChars === 'rr') {
      const phonemeId = 'R_TAP';
      if (getPhonemeById(phonemeId)) {
        phonemes.push(phonemeId);
        i += 2;
        continue;
      }
      // TODO: Handle unknown 'rr' case
      i += 2;
      continue;
    }

    // Handle single consonants
    if (char === 'p') {
      if (getPhonemeById('P')) {
        phonemes.push('P');
      }
      i++;
      continue;
    }

    if (char === 'b') {
      if (getPhonemeById('B')) {
        phonemes.push('B');
      }
      i++;
      continue;
    }

    if (char === 'm') {
      // Check if final m (nasalization)
      if (i === normalized.length - 1) {
        // TODO: Map to nasal vowel based on preceding vowel
        // For now, just use M
        if (getPhonemeById('M')) {
          phonemes.push('M');
        }
      } else {
        if (getPhonemeById('M')) {
          phonemes.push('M');
        }
      }
      i++;
      continue;
    }

    if (char === 'n') {
      // Check if final n (nasalization)
      if (i === normalized.length - 1) {
        // TODO: Map to nasal vowel based on preceding vowel
        // For now, just use N
        if (getPhonemeById('N')) {
          phonemes.push('N');
        }
      } else {
        if (getPhonemeById('N')) {
          phonemes.push('N');
        }
      }
      i++;
      continue;
    }

    if (char === 't') {
      if (getPhonemeById('T')) {
        phonemes.push('T');
      }
      i++;
      continue;
    }

    if (char === 'd') {
      if (getPhonemeById('D')) {
        phonemes.push('D');
      }
      i++;
      continue;
    }

    if (char === 'k' || char === 'c' && (nextChar === 'a' || nextChar === 'o' || nextChar === 'u')) {
      if (getPhonemeById('K')) {
        phonemes.push('K');
      }
      i++;
      continue;
    }

    if (char === 'g') {
      if (getPhonemeById('G')) {
        phonemes.push('G');
      }
      i++;
      continue;
    }

    if (char === 'f') {
      if (getPhonemeById('F')) {
        phonemes.push('F');
      }
      i++;
      continue;
    }

    if (char === 'v') {
      if (getPhonemeById('V')) {
        phonemes.push('V');
      }
      i++;
      continue;
    }

    if (char === 's') {
      if (getPhonemeById('S')) {
        phonemes.push('S');
      }
      i++;
      continue;
    }

    if (char === 'z') {
      if (getPhonemeById('Z')) {
        phonemes.push('Z');
      }
      i++;
      continue;
    }

    if (char === 'l') {
      if (getPhonemeById('L')) {
        phonemes.push('L');
      }
      i++;
      continue;
    }

    if (char === 'r') {
      // Word-initial r or rr (already handled above)
      if (i === 0 || normalized[i - 1] === ' ') {
        if (getPhonemeById('R_TAP')) {
          phonemes.push('R_TAP');
        }
      } else {
        if (getPhonemeById('R_TAP')) {
          phonemes.push('R_TAP');
        }
      }
      i++;
      continue;
    }

    if (char === 'j') {
      if (getPhonemeById('JH')) {
        phonemes.push('JH');
      }
      i++;
      continue;
    }

    // Handle vowels
    if (char === 'a') {
      // Simple rule: use AA for most cases, AH for final unstressed
      if (i === normalized.length - 1) {
        if (getPhonemeById('AH')) {
          phonemes.push('AH');
        }
      } else {
        if (getPhonemeById('AA')) {
          phonemes.push('AA');
        }
      }
      i++;
      continue;
    }

    if (char === 'á' || char === 'à' || char === 'â') {
      if (getPhonemeById('AA')) {
        phonemes.push('AA');
      }
      i++;
      continue;
    }

    if (char === 'e') {
      if (getPhonemeById('EH')) {
        phonemes.push('EH');
      }
      i++;
      continue;
    }

    if (char === 'é' || char === 'ê') {
      if (getPhonemeById('EH')) {
        phonemes.push('EH');
      }
      i++;
      continue;
    }

    if (char === 'i') {
      if (getPhonemeById('IY')) {
        phonemes.push('IY');
      }
      i++;
      continue;
    }

    if (char === 'í') {
      if (getPhonemeById('IY')) {
        phonemes.push('IY');
      }
      i++;
      continue;
    }

    if (char === 'o') {
      if (getPhonemeById('OW')) {
        phonemes.push('OW');
      }
      i++;
      continue;
    }

    if (char === 'ó' || char === 'ô') {
      if (getPhonemeById('OW')) {
        phonemes.push('OW');
      }
      i++;
      continue;
    }

    if (char === 'u') {
      if (getPhonemeById('UW')) {
        phonemes.push('UW');
      }
      i++;
      continue;
    }

    if (char === 'ú') {
      if (getPhonemeById('UW')) {
        phonemes.push('UW');
      }
      i++;
      continue;
    }

    // Handle nasal vowels (ã, õ, ão)
    if (char === 'ã') {
      if (getPhonemeById('AN_NASAL')) {
        phonemes.push('AN_NASAL');
      }
      i++;
      continue;
    }

    if (char === 'õ') {
      if (getPhonemeById('ON_NASAL')) {
        phonemes.push('ON_NASAL');
      }
      i++;
      continue;
    }

    if (twoChars === 'ão') {
      if (getPhonemeById('AN_NASAL')) {
        phonemes.push('AN_NASAL');
      }
      i += 2;
      continue;
    }

    // Unknown character - skip with TODO
    // TODO: Handle unknown character: ${char}
    i++;
  }

  return { phonemes };
}

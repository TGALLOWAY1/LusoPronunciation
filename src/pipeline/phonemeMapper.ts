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
 * Base (oral) vowel graphemes and their nasal-vowel phoneme IDs.
 * Used when a vowel is followed by a nasal coda (m/n) or written with a tilde.
 */
const NASAL_VOWEL_ID: Record<string, string> = {
  a: 'AN_NASAL', á: 'AN_NASAL', à: 'AN_NASAL', â: 'AN_NASAL', ã: 'AN_NASAL',
  e: 'EN_NASAL', é: 'EN_NASAL', ê: 'EN_NASAL',
  i: 'IN_NASAL', í: 'IN_NASAL',
  o: 'ON_NASAL', ó: 'ON_NASAL', ô: 'ON_NASAL', õ: 'ON_NASAL',
  u: 'UN_NASAL', ú: 'UN_NASAL',
};

/** All vowel graphemes (oral + nasal-marked) recognised by the mapper. */
const VOWELS = new Set([
  'a', 'á', 'à', 'â', 'ã',
  'e', 'é', 'ê',
  'i', 'í',
  'o', 'ó', 'ô', 'õ',
  'u', 'ú',
]);

/**
 * Maps a Portuguese word to phonemes using rule-based grapheme-to-phoneme rules
 * tuned for Brazilian Portuguese (pt-BR).
 *
 * Rules of note (all phoneme IDs are verified against phoneme_metadata.json):
 * - Nasal codas: a vowel followed by a coda m/n (word-final or pre-consonant)
 *   becomes the matching nasal vowel (*_NASAL); the m/n is absorbed, not emitted
 *   as a separate consonant. Intervocalic m/n (e.g. "cama", "nome") stays a plain
 *   onset consonant and the preceding vowel stays oral (conservative: only true
 *   syllable codas nasalise).
 * - Nasal diphthongs are approximated within the 36-phoneme inventory:
 *     ão / final -am → AN_NASAL + W   (/ɐ̃w̃/)
 *     ãe            → AN_NASAL + Y   (/ɐ̃j̃/)
 *     õe            → ON_NASAL + Y   (/õj̃/)
 *   Other nasal-coda rimes (-em, -im, -om, -um, -en, ...) are rendered as the bare
 *   nasal vowel without a glide (e.g. "bem" → EN_NASAL) as the closest inventory fit.
 * - "ch" → SH (/ʃ/), "j" → ZH (/ʒ/), "g" before e/i → ZH (/ʒ/).
 * - Soft "c" before e/i → S; "ç" → S in every position.
 * - "qu"/"gu": before e/i the u is silent (→ K / G); before a/o the u is a W glide
 *   (→ K+W / G+W).
 * - Word-final unstressed vowel reduction: final "e" → IY (/i/), final "o" → UW (/u/),
 *   final "a" → AH (/ɐ/). Applied only word-finally; no general stress assignment.
 * - Allophonic t/d affrication before /i/: "ti"/final "te" → CH (/tʃ/), "di"/final
 *   "de" → JH (/dʒ/). CH/JH are repurposed to their correct pt-BR role (ti/di
 *   allophones) now that "ch"/"j" map to SH/ZH.
 * - Rhotics: "rr" and word-initial "r" → HH (strong guttural /h/); intervocalic,
 *   cluster, and coda single "r" → R_TAP (/ɾ/).
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

  const charAt = (idx: number): string => (idx >= 0 && idx < normalized.length ? normalized[idx] : '');
  const isVowel = (c: string): boolean => VOWELS.has(c);
  /** A char that ends the current word (real end of string or a space in a phrase). */
  const isBoundary = (c: string): boolean => c === '' || c === ' ';
  /**
   * True when the grapheme at `idx` (a t or d) is followed by an /i/-quality vowel,
   * triggering pt-BR affrication (t → /tʃ/, d → /dʒ/). This covers orthographic
   * "ti"/"di" (including nasal "tin-"/"din-") and a word-final "e" that reduces to
   * /i/ (e.g. "noite", "cidade", "grande"). A non-final "e" keeps its /e~ɛ/ quality
   * and does NOT palatalise (e.g. "dedo").
   */
  const palatalizesBeforeI = (idx: number): boolean => {
    const n = charAt(idx + 1);
    if (n === 'i' || n === 'í') return true;
    if (n === 'e' && isBoundary(charAt(idx + 2))) return true;
    return false;
  };
  const push = (id: string): void => {
    if (getPhonemeById(id)) {
      phonemes.push(id);
    }
  };

  while (i < normalized.length) {
    const char = normalized[i];
    const nextChar = charAt(i + 1);
    const twoChars = char + nextChar;
    const isWordFinal = isBoundary(nextChar);

    // Silent h in Portuguese orthography (also skips a standalone 'h')
    if (char === 'h') {
      i++;
      continue;
    }

    // --- Digraphs (longer sequences take priority) ---
    if (twoChars === 'lh') {
      push('LH');
      i += 2;
      continue;
    }

    if (twoChars === 'nh') {
      push('NH');
      i += 2;
      continue;
    }

    if (twoChars === 'ch') {
      // pt-BR "ch" is the voiceless post-alveolar fricative /ʃ/, not an affricate.
      push('SH');
      i += 2;
      continue;
    }

    if (twoChars === 'rr') {
      // Digraph "rr" is the strong guttural rhotic /h/ in pt-BR, not a tap.
      push('HH');
      i += 2;
      continue;
    }

    // --- Consonants ---
    if (char === 'p') {
      push('P');
      i++;
      continue;
    }

    if (char === 'b') {
      push('B');
      i++;
      continue;
    }

    if (char === 'm' || char === 'n') {
      // Any m/n reaching this point is a syllable onset (coda m/n is absorbed into
      // the preceding nasal vowel during vowel handling below).
      push(char === 'm' ? 'M' : 'N');
      i++;
      continue;
    }

    if (char === 't') {
      // Allophonic affrication before /i/: "ti"/final "te" → /tʃ/ (CH).
      push(palatalizesBeforeI(i) ? 'CH' : 'T');
      i++;
      continue;
    }

    if (char === 'd') {
      // Allophonic affrication before /i/: "di"/final "de" → /dʒ/ (JH).
      push(palatalizesBeforeI(i) ? 'JH' : 'D');
      i++;
      continue;
    }

    if (char === 'ç') {
      // Cedilla is /s/ in every position.
      push('S');
      i++;
      continue;
    }

    if (char === 'c') {
      // Soft c before e/i is /s/; otherwise (a/o/u/consonant) it is /k/.
      if (nextChar === 'e' || nextChar === 'é' || nextChar === 'ê' || nextChar === 'i' || nextChar === 'í') {
        push('S');
      } else {
        push('K');
      }
      i++;
      continue;
    }

    if (char === 'k') {
      push('K');
      i++;
      continue;
    }

    if (char === 'q') {
      // "qu": u is silent before e/i (→ K); a W glide before a/o (→ K + W).
      if (nextChar === 'u') {
        const after = charAt(i + 2);
        push('K');
        if (after === 'a' || after === 'á' || after === 'â' || after === 'ã' ||
            after === 'o' || after === 'ó' || after === 'ô' || after === 'õ') {
          push('W');
        }
        i += 2;
        continue;
      }
      push('K');
      i++;
      continue;
    }

    if (char === 'g') {
      // "gu": u is silent before e/i (→ G); a W glide before a/o (→ G + W).
      if (nextChar === 'u') {
        const after = charAt(i + 2);
        if (after === 'e' || after === 'é' || after === 'ê' || after === 'i' || after === 'í') {
          push('G');
          i += 2;
          continue;
        }
        if (after === 'a' || after === 'á' || after === 'â' || after === 'ã' ||
            after === 'o' || after === 'ó' || after === 'ô' || after === 'õ') {
          push('G');
          push('W');
          i += 2;
          continue;
        }
      }
      // Soft g before e/i is /ʒ/; otherwise the velar stop /g/.
      if (nextChar === 'e' || nextChar === 'é' || nextChar === 'ê' || nextChar === 'i' || nextChar === 'í') {
        push('ZH');
      } else {
        push('G');
      }
      i++;
      continue;
    }

    if (char === 'f') {
      push('F');
      i++;
      continue;
    }

    if (char === 'v') {
      push('V');
      i++;
      continue;
    }

    if (char === 's') {
      push('S');
      i++;
      continue;
    }

    if (char === 'z') {
      push('Z');
      i++;
      continue;
    }

    if (char === 'l') {
      push('L');
      i++;
      continue;
    }

    if (char === 'r') {
      // Word-initial single R is the strong guttural /h/ (like "rr"). Intervocalic
      // and consonant-cluster R are the tap /ɾ/. Syllable-coda single R (e.g.
      // "porta", final -ar/-er/-ir) is ALSO left as the tap here: BP coda-R
      // realisation varies widely by dialect (tap, guttural, or dropped), and the
      // tap is the conservative, dialect-neutral choice.
      const wordInitial = i === 0 || charAt(i - 1) === ' ';
      push(wordInitial ? 'HH' : 'R_TAP');
      i++;
      continue;
    }

    if (char === 'j') {
      // pt-BR "j" is the voiced post-alveolar fricative /ʒ/, not an affricate.
      push('ZH');
      i++;
      continue;
    }

    // --- Nasal diphthong graphemes (handled before single-vowel rules) ---
    if (twoChars === 'ão') {
      push('AN_NASAL');
      push('W');
      i += 2;
      continue;
    }

    if (twoChars === 'ãe') {
      push('AN_NASAL');
      push('Y');
      i += 2;
      continue;
    }

    if (twoChars === 'õe') {
      push('ON_NASAL');
      push('Y');
      i += 2;
      continue;
    }

    // --- Vowels ---
    if (isVowel(char)) {
      // Tilde-marked nasal vowels are inherently nasal.
      if (char === 'ã') {
        push('AN_NASAL');
        i++;
        continue;
      }
      if (char === 'õ') {
        push('ON_NASAL');
        i++;
        continue;
      }

      // Nasal coda: vowel + m/n where the m/n is a coda (word-final or before a
      // consonant). 'nh' is excluded (there the n is a palatal-nasal onset).
      if (nextChar === 'm' || nextChar === 'n') {
        const after = charAt(i + 2);
        const isNhDigraph = nextChar === 'n' && after === 'h';
        const codaNasal = !isNhDigraph && (isBoundary(after) || !isVowel(after));
        if (codaNasal) {
          // Word-final -am is the /ɐ̃w̃/ diphthong, like "ão".
          if (char === 'a' && nextChar === 'm' && isBoundary(after)) {
            push('AN_NASAL');
            push('W');
          } else {
            push(NASAL_VOWEL_ID[char]);
          }
          i += 2; // consume the vowel AND the absorbed m/n coda
          continue;
        }
      }

      // Oral vowel with word-final reduction (e → i, o → u, a → ɐ).
      if (char === 'a') {
        push(isWordFinal ? 'AH' : 'AA');
      } else if (char === 'á' || char === 'à' || char === 'â') {
        push('AA');
      } else if (char === 'e') {
        push(isWordFinal ? 'IY' : 'EH');
      } else if (char === 'é' || char === 'ê') {
        push('EH');
      } else if (char === 'i' || char === 'í') {
        push('IY');
      } else if (char === 'o') {
        push(isWordFinal ? 'UW' : 'OW');
      } else if (char === 'ó' || char === 'ô') {
        push('OW');
      } else if (char === 'u' || char === 'ú') {
        push('UW');
      }
      i++;
      continue;
    }

    // Unknown character - skip
    i++;
  }

  return { phonemes };
}

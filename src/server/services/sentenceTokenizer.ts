/**
 * Tokenizes a Portuguese sentence into surface-form tokens plus a normalized
 * lookup key used by the pronunciation resolver.
 *
 * The normalization matches the existing pipeline tokenizer in
 * src/pipeline/sentenceWordRefs.ts so curated `masterWords` entries can be
 * found by their existing `normalizedText` values (lowercased, diacritics
 * stripped, punctuation removed).
 */

export interface SentenceToken {
  position: number;
  surfaceForm: string;
  normalizedForm: string;
  startChar: number;
  endChar: number;
}

const WORD_PATTERN = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu;
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Normalizes a single token for curated-word lookup.
 * Lower-cases, decomposes accents, strips diacritics and stray punctuation.
 */
export function normalizeTokenForm(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^\p{L}\p{N}\-']/gu, '')
    .trim();
}

/**
 * Splits a sentence into tokens, preserving hyphen-joined forms like
 * "guarda-chuva" and "falar-me" as a single token.
 */
export function tokenizeSentence(text: string): SentenceToken[] {
  if (!text || !text.trim()) {
    return [];
  }

  const tokens: SentenceToken[] = [];
  let position = 0;

  for (const match of text.matchAll(WORD_PATTERN)) {
    const surfaceForm = match[0];
    const normalizedForm = normalizeTokenForm(surfaceForm);
    if (!normalizedForm) {
      continue;
    }

    const startChar = match.index ?? 0;
    tokens.push({
      position,
      surfaceForm,
      normalizedForm,
      startChar,
      endChar: startChar + surfaceForm.length,
    });
    position += 1;
  }

  return tokens;
}

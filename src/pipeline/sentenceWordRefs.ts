/**
 * Sentence-to-word alignment module.
 * 
 * Builds word references that link sentences to their constituent words
 * by matching tokens in the sentence text to EnrichedWord entries.
 */

import type { EnrichedWord, EnrichedSentence } from '../types/contentGeneration';

/**
 * Normalizes a token for matching by removing accents and converting to lowercase.
 * 
 * @param token - The token to normalize
 * @returns Normalized token
 */
function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes a sentence into words, preserving character positions.
 * 
 * @param text - The sentence text
 * @returns Array of tokens with their positions
 */
function tokenizeSentence(text: string): Array<{
  text: string;
  normalized: string;
  tokenIndex: number;
  startChar: number;
  endChar: number;
}> {
  const tokens: Array<{
    text: string;
    normalized: string;
    tokenIndex: number;
    startChar: number;
    endChar: number;
  }> = [];

  const matches = text.matchAll(/[\p{L}\p{N}]+/gu);
  let tokenIndex = 0;

  for (const match of matches) {
    const textValue = match[0];
    const normalized = normalizeToken(textValue);

    if (!normalized) {
      continue;
    }

    const startChar = match.index ?? 0;
    tokens.push({
      text: textValue,
      normalized,
      tokenIndex,
      startChar,
      endChar: startChar + textValue.length,
    });
    tokenIndex += 1;
  }

  return tokens;
}

function createWordLookup<T extends Pick<EnrichedWord, 'id' | 'text' | 'normalizedText'>>(words: T[]): {
  wordMap: Map<string, T>;
  maxPhraseLength: number;
} {
  const wordMap = new Map<string, T>();
  let maxPhraseLength = 1;

  for (const word of words) {
    const normalized = normalizeToken(word.normalizedText || word.text);
    if (!normalized) {
      continue;
    }

    if (!wordMap.has(normalized)) {
      wordMap.set(normalized, word);
    }

    maxPhraseLength = Math.max(maxPhraseLength, normalized.split(' ').length);
  }

  return { wordMap, maxPhraseLength };
}

/**
 * Computes word references for sentences by matching tokens to EnrichedWord entries.
 * 
 * Algorithm:
 * 1. Tokenize each sentence's normalizedText by whitespace/punctuation
 * 2. For each token, look up a matching EnrichedWord by normalizedText
 * 3. If found, append { wordId, tokenIndex } to sentence.wordRefs
 * 4. Gracefully handle tokens that don't match any word (skip or log warning)
 * 
 * @param sentences - Array of enriched sentences to process
 * @param words - Array of enriched words to match against
 * @returns Array of enriched sentences with wordRefs populated
 */
export function computeSentenceWordRefs(
  sentences: EnrichedSentence[],
  words: EnrichedWord[]
): EnrichedSentence[] {
  const { wordMap, maxPhraseLength } = createWordLookup(words);

  // Process each sentence
  return sentences.map(sentence => {
    const tokens = tokenizeSentence(sentence.text);
    const wordRefs: Array<{ wordId: string; tokenIndex: number }> = [];

    for (let index = 0; index < tokens.length;) {
      let matched = false;
      const maxWindow = Math.min(maxPhraseLength, tokens.length - index);

      for (let phraseLength = maxWindow; phraseLength >= 1; phraseLength--) {
        const candidate = tokens
          .slice(index, index + phraseLength)
          .map(token => token.normalized)
          .join(' ');
        const matchedWord = wordMap.get(candidate);

        if (!matchedWord) {
          continue;
        }

        wordRefs.push({
          wordId: matchedWord.id,
          tokenIndex: tokens[index].tokenIndex,
        });

        index += phraseLength;
        matched = true;
        break;
      }

      if (!matched) {
        index += 1;
      }
    }

    return {
      ...sentence,
      wordRefs,
    };
  });
}

/**
 * Builds word references for a sentence by matching tokens to EnrichedWord entries.
 * (Legacy function, kept for backward compatibility)
 * 
 * @param sentence - The sentence text
 * @param words - Array of EnrichedWord entries to match against
 * @returns Array of word references for matched words
 */
export function buildWordRefs(
  sentence: string,
  words: Array<Pick<EnrichedWord, 'id' | 'text' | 'normalizedText'>>
): Array<{ wordId: string; tokenIndex: number; startChar: number; endChar: number }> {
  const wordRefs: Array<{ wordId: string; tokenIndex: number; startChar: number; endChar: number }> = [];
  const { wordMap, maxPhraseLength } = createWordLookup(words);
  const tokens = tokenizeSentence(sentence);

  for (let index = 0; index < tokens.length;) {
    let matched = false;
    const maxWindow = Math.min(maxPhraseLength, tokens.length - index);

    for (let phraseLength = maxWindow; phraseLength >= 1; phraseLength--) {
      const windowTokens = tokens.slice(index, index + phraseLength);
      const candidate = windowTokens.map(token => token.normalized).join(' ');
      const matchedWord = wordMap.get(candidate);

      if (!matchedWord) {
        continue;
      }

      wordRefs.push({
        wordId: matchedWord.id,
        tokenIndex: windowTokens[0].tokenIndex,
        startChar: windowTokens[0].startChar,
        endChar: windowTokens[windowTokens.length - 1].endChar,
      });

      index += phraseLength;
      matched = true;
      break;
    }

    if (!matched) {
      index += 1;
    }
  }

  return wordRefs;
}

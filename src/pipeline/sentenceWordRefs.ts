/**
 * Sentence-to-word alignment module.
 * 
 * Builds word references (WordRef) that link sentences to their constituent words
 * by matching tokens in the sentence text to MasterWord entries.
 */

import { MasterWord, WordRef } from '../types/contentGeneration';

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
    .replace(/[^\w\s]/g, ''); // Remove punctuation
}

/**
 * Builds word references for a sentence by matching tokens to MasterWord entries.
 * 
 * Tokenizes the sentence on whitespace and punctuation, then attempts to match
 * each token to a MasterWord by normalizing both the token and word text.
 * 
 * @param sentence - The sentence text
 * @param words - Array of MasterWord entries to match against
 * @returns Array of WordRef entries for matched words
 */
export function buildWordRefs(
  sentence: string,
  words: MasterWord[]
): WordRef[] {
  const wordRefs: WordRef[] = [];
  
  // Create a lookup map of normalized word text to MasterWord
  const wordMap = new Map<string, MasterWord>();
  for (const word of words) {
    const normalized = normalizeToken(word.text);
    // If multiple words have the same normalized form, keep the first one
    if (!wordMap.has(normalized)) {
      wordMap.set(normalized, word);
    }
  }

  // Tokenize sentence: split on whitespace and punctuation, but keep track of positions
  const tokens: Array<{ text: string; startChar: number; endChar: number }> = [];
  let currentStart = 0;
  let inWord = false;

  for (let i = 0; i < sentence.length; i++) {
    const char = sentence[i];
    const isWordChar = /[\w\u00C0-\u017F]/.test(char); // Word char including accented letters

    if (isWordChar && !inWord) {
      // Start of a new word
      currentStart = i;
      inWord = true;
    } else if (!isWordChar && inWord) {
      // End of a word
      tokens.push({
        text: sentence.substring(currentStart, i),
        startChar: currentStart,
        endChar: i,
      });
      inWord = false;
    }
  }

  // Handle word at end of sentence
  if (inWord) {
    tokens.push({
      text: sentence.substring(currentStart),
      startChar: currentStart,
      endChar: sentence.length,
    });
  }

  // Match tokens to words
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
    const token = tokens[tokenIndex];
    const normalizedToken = normalizeToken(token.text);
    
    const matchedWord = wordMap.get(normalizedToken);
    
    if (matchedWord) {
      wordRefs.push({
        wordId: matchedWord.id,
        tokenIndex,
        startChar: token.startChar,
        endChar: token.endChar,
      });
    } else {
      // Optional: log debug info for unmatched tokens
      // console.debug(`No match found for token: "${token.text}" in sentence: "${sentence}"`);
    }
  }

  return wordRefs;
}


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
    .replace(/[^\w\s]/g, ''); // Remove punctuation
}

/**
 * Tokenizes a sentence into words, preserving character positions.
 * 
 * @param text - The sentence text
 * @returns Array of tokens with their positions
 */
function tokenizeSentence(text: string): Array<{ text: string; tokenIndex: number }> {
  const tokens: Array<{ text: string; tokenIndex: number }> = [];
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  for (let i = 0; i < words.length; i++) {
    // Remove punctuation from token for matching
    const cleanToken = words[i].replace(/[^\w\u00C0-\u017F]/g, '');
    if (cleanToken.length > 0) {
      tokens.push({
        text: cleanToken,
        tokenIndex: i,
      });
    }
  }
  
  return tokens;
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
  // Create a lookup map of normalized word text to EnrichedWord
  const wordMap = new Map<string, EnrichedWord>();
  for (const word of words) {
    const normalized = word.normalizedText || normalizeToken(word.text);
    // If multiple words have the same normalized form, keep the first one
    if (!wordMap.has(normalized)) {
      wordMap.set(normalized, word);
    }
  }

  // Process each sentence
  return sentences.map(sentence => {
    const normalizedText = sentence.normalizedText || normalizeToken(sentence.text);
    const tokens = tokenizeSentence(normalizedText);
    
    const wordRefs: Array<{ wordId: string; tokenIndex: number }> = [];
    
    // Match tokens to words
    for (const token of tokens) {
      const normalizedToken = normalizeToken(token.text);
      const matchedWord = wordMap.get(normalizedToken);
      
      if (matchedWord) {
        wordRefs.push({
          wordId: matchedWord.id,
          tokenIndex: token.tokenIndex,
        });
      } else {
        // Gracefully handle unmatched tokens - just skip them
        // Could optionally log a warning in development mode
        if (process.env.NODE_ENV === 'development') {
          // Optional: uncomment for debugging
          // console.debug(`No match found for token: "${token.text}" in sentence: "${sentence.text}"`);
        }
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
  words: EnrichedWord[]
): Array<{ wordId: string; tokenIndex: number; startChar: number; endChar: number }> {
  const wordRefs: Array<{ wordId: string; tokenIndex: number; startChar: number; endChar: number }> = [];
  
  // Create a lookup map of normalized word text to EnrichedWord
  const wordMap = new Map<string, EnrichedWord>();
  for (const word of words) {
    const normalized = word.normalizedText || normalizeToken(word.text);
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
    }
  }

  return wordRefs;
}


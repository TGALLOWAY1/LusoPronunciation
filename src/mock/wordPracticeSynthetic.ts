/**
 * Synthetic word-level practice dataset loader.
 * 
 * This module loads the generated word practice dataset that combines:
 * - Sentence text from sentences.json
 * - Word difficulty from words.json
 * - Azure pronunciation assessment data from phrase_*_JSON.json files
 */

import rawData from '../../data/word_practice_synthetic.json';
import type { SyntheticWordPracticeDataset } from '../types/wordPractice';

export const WORD_PRACTICE_SYNTHETIC: SyntheticWordPracticeDataset = rawData as SyntheticWordPracticeDataset;

/**
 * Gets all word entries for a specific phrase.
 * 
 * @param phraseId - The phrase ID (e.g., "phrase_1")
 * @returns Array of word entries for that phrase, sorted by wordIndex
 */
export function getWordsForPhrase(phraseId: string): SyntheticWordPracticeDataset {
  return WORD_PRACTICE_SYNTHETIC
    .filter(w => w.phraseId === phraseId)
    .sort((a, b) => a.wordIndex - b.wordIndex);
}

/**
 * Gets a word entry by its unique ID.
 * 
 * @param id - The word entry ID (e.g., "phrase_1-w0")
 * @returns The word entry if found, undefined otherwise
 */
export function getWordEntryById(id: string) {
  return WORD_PRACTICE_SYNTHETIC.find(w => w.id === id);
}

/**
 * Gets all word entries across all phrases.
 * 
 * @returns The complete dataset
 */
export function getAllWordEntries(): SyntheticWordPracticeDataset {
  return WORD_PRACTICE_SYNTHETIC;
}


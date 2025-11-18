/**
 * Data loading and filtering utilities for sentences and words.
 * 
 * This module provides tree-shakeable functions to:
 * - Load static JSON data files
 * - Transform raw JSON to app-friendly types
 * - Filter by category and difficulty
 * - Resolve audio URLs
 */

import type {
  RawSentence,
  RawWord,
  RawCategory,
  SentencesData,
  WordsData,
  Sentence,
  Word,
  Category,
  Difficulty,
} from './types';
import { getSentenceAudioUrl, getWordAudioUrl, loadAudioIndex } from './audio';
import type { AudioIndex } from './types';

// Cache for loaded data
let cachedSentences: Sentence[] | null = null;
let cachedWords: Word[] | null = null;
let cachedCategories: Category[] | null = null;
let cachedAudioIndex: AudioIndex | null = null;

/**
 * Load and cache audio index.
 * @throws Error if audio index cannot be loaded
 */
export async function ensureAudioIndex(): Promise<AudioIndex> {
  if (!cachedAudioIndex) {
    try {
      cachedAudioIndex = await loadAudioIndex();
    } catch (error) {
      console.error('Error ensuring audio index:', error);
      // Return empty index as fallback rather than throwing
      cachedAudioIndex = {};
    }
  }
  return cachedAudioIndex;
}

/**
 * Transform raw sentence data to app-friendly format.
 */
function transformSentence(
  raw: RawSentence,
  category: RawCategory,
  audioIndex?: AudioIndex
): Sentence {
  const audioId = raw.id; // Sentence IDs match audio IDs in index
  
  return {
    id: raw.id,
    textPt: raw.pt,
    translationEn: raw.en,
    difficulty: raw.difficulty,
    categoryId: category.id,
    categoryLabelEn: category.label_en,
    categoryLabelPt: category.label_pt,
    pronunciationNotes: raw.pronunciation_notes,
    audioId,
    audioMaleUrl: getSentenceAudioUrl(raw.id, 'male', audioIndex),
    audioFemaleUrl: getSentenceAudioUrl(raw.id, 'female', audioIndex),
  };
}

/**
 * Transform raw word data to app-friendly format.
 */
function transformWord(
  raw: RawWord,
  category: RawCategory,
  audioIndex?: AudioIndex
): Word {
  const audioId = raw.id; // Word IDs match audio IDs in index
  
  return {
    id: raw.id,
    textPt: raw.pt,
    translationEn: raw.en,
    partOfSpeech: raw.pos,
    difficulty: raw.difficulty,
    difficultForEnglish: raw.difficult_for_english,
    categoryId: category.id,
    categoryLabelEn: category.label_en,
    categoryLabelPt: category.label_pt,
    pronunciationNotes: raw.pronunciation_notes,
    audioId,
    audioMaleUrl: getWordAudioUrl(raw.id, 'male', audioIndex),
    audioFemaleUrl: getWordAudioUrl(raw.id, 'female', audioIndex),
  };
}

/**
 * Load all sentences from STATIC DATA/sentences.json.
 * Results are cached after first load.
 */
export async function loadAllSentences(): Promise<Sentence[]> {
  if (cachedSentences) {
    return cachedSentences;
  }

  try {
    const response = await fetch('/STATIC DATA/sentences.json');
    if (!response.ok) {
      throw new Error(`Failed to load sentences.json: ${response.statusText}`);
    }
    
    const data: SentencesData = await response.json();
    const audioIndex = await ensureAudioIndex();
    
    const sentences: Sentence[] = [];
    
    for (const category of data.categories) {
      if (category.sentences) {
        for (const rawSentence of category.sentences) {
          sentences.push(transformSentence(rawSentence, category, audioIndex));
        }
      }
    }
    
    cachedSentences = sentences;
    return sentences;
  } catch (error) {
    console.error('Error loading sentences:', error);
    const message = error instanceof Error 
      ? error.message 
      : 'Failed to load sentences data';
    throw new Error(`Unable to load sentences: ${message}`);
  }
}

/**
 * Load all words from STATIC DATA/words.json.
 * Results are cached after first load.
 */
export async function loadAllWords(): Promise<Word[]> {
  if (cachedWords) {
    return cachedWords;
  }

  try {
    const response = await fetch('/STATIC DATA/words.json');
    if (!response.ok) {
      throw new Error(`Failed to load words.json: ${response.statusText}`);
    }
    
    const data: WordsData = await response.json();
    const audioIndex = await ensureAudioIndex();
    
    const words: Word[] = [];
    
    for (const category of data.categories) {
      if (category.words) {
        for (const rawWord of category.words) {
          words.push(transformWord(rawWord, category, audioIndex));
        }
      }
    }
    
    cachedWords = words;
    return words;
  } catch (error) {
    console.error('Error loading words:', error);
    const message = error instanceof Error 
      ? error.message 
      : 'Failed to load words data';
    throw new Error(`Unable to load words: ${message}`);
  }
}

/**
 * Load all categories from sentences.json (categories are the same in both files).
 */
export async function loadAllCategories(): Promise<Category[]> {
  if (cachedCategories) {
    return cachedCategories;
  }

  try {
    const response = await fetch('/STATIC DATA/sentences.json');
    if (!response.ok) {
      throw new Error(`Failed to load categories: ${response.statusText}`);
    }
    
    const data: SentencesData = await response.json();
    
    const categories: Category[] = data.categories.map(cat => ({
      id: cat.id,
      labelEn: cat.label_en,
      labelPt: cat.label_pt,
    }));
    
    cachedCategories = categories;
    return categories;
  } catch (error) {
    console.error('Error loading categories:', error);
    const message = error instanceof Error 
      ? error.message 
      : 'Failed to load categories data';
    throw new Error(`Unable to load categories: ${message}`);
  }
}

/**
 * Filter sentences by category ID(s).
 */
export function filterSentencesByCategory(
  sentences: Sentence[],
  categoryIds: string | string[]
): Sentence[] {
  const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
  return sentences.filter(s => ids.includes(s.categoryId));
}

/**
 * Filter sentences by difficulty.
 */
export function filterSentencesByDifficulty(
  sentences: Sentence[],
  minDifficulty?: Difficulty,
  maxDifficulty?: Difficulty
): Sentence[] {
  return sentences.filter(s => {
    if (minDifficulty !== undefined && s.difficulty < minDifficulty) {
      return false;
    }
    if (maxDifficulty !== undefined && s.difficulty > maxDifficulty) {
      return false;
    }
    return true;
  });
}

/**
 * Filter words by category ID(s).
 */
export function filterWordsByCategory(
  words: Word[],
  categoryIds: string | string[]
): Word[] {
  const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
  return words.filter(w => ids.includes(w.categoryId));
}

/**
 * Filter words by difficulty.
 */
export function filterWordsByDifficulty(
  words: Word[],
  minDifficulty?: Difficulty,
  maxDifficulty?: Difficulty
): Word[] {
  return words.filter(w => {
    if (minDifficulty !== undefined && w.difficulty < minDifficulty) {
      return false;
    }
    if (maxDifficulty !== undefined && w.difficulty > maxDifficulty) {
      return false;
    }
    return true;
  });
}

/**
 * Filter words that are difficult for English speakers.
 */
export function filterWordsDifficultForEnglish(
  words: Word[],
  difficultOnly: boolean = true
): Word[] {
  if (!difficultOnly) {
    return words;
  }
  return words.filter(w => w.difficultForEnglish);
}

/**
 * Get a single sentence by ID.
 */
export async function getSentenceById(id: string): Promise<Sentence | null> {
  const sentences = await loadAllSentences();
  return sentences.find(s => s.id === id) || null;
}

/**
 * Get a single word by ID.
 */
export async function getWordById(id: string): Promise<Word | null> {
  const words = await loadAllWords();
  return words.find(w => w.id === id) || null;
}

/**
 * Clear all caches (useful for testing or reloading data).
 */
export function clearDataCache(): void {
  cachedSentences = null;
  cachedWords = null;
  cachedCategories = null;
  cachedAudioIndex = null;
}


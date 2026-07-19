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
  SentencesData,
  Sentence,
  Word,
  Category,
  Difficulty,
} from './types';
import { getSentenceAudioUrl, getWordAudioUrl, loadAudioIndex } from './audio';
import type { AudioIndex } from './types';
import type { EnrichedWord, EnrichedSentence } from '../types/contentGeneration';

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
 * Transform enriched sentence data to app-friendly format.
 */
function transformEnrichedSentence(
  enriched: EnrichedSentence,
  categoryLabelEn: string,
  categoryLabelPt: string,
  audioIndex?: AudioIndex
): Sentence {
  const audioId = enriched.id; // Sentence IDs match audio IDs in index
  
  // Map difficultyScore to Difficulty (2-4 scale: Easy, Medium, Hard)
  // If difficultyScore is provided, map it to 2-4 range
  // Otherwise default to 3 (Medium)
  let difficulty: Difficulty = 3;
  if (enriched.difficultyScore !== undefined) {
    // Map 0-100 score to 2-4 scale
    difficulty = Math.max(2, Math.min(4, Math.round((enriched.difficultyScore / 100) * 2) + 2)) as Difficulty;
  }
  
  return {
    id: enriched.id,
    textPt: enriched.text,
    translationEn: enriched.en || '', // Use preserved English translation
    difficulty: enriched.difficulty || difficulty, // Use preserved difficulty, fallback to computed
    categoryId: enriched.category,
    categoryLabelEn,
    categoryLabelPt,
    pronunciationNotes: enriched.pronunciationNotes, // Use preserved pronunciation notes
    audioId,
    audioMaleUrl: getSentenceAudioUrl(enriched.id, 'male', audioIndex),
    audioFemaleUrl: getSentenceAudioUrl(enriched.id, 'female', audioIndex),
    // Enriched fields (sentences don't have phonemes/ipa at sentence level)
    tags: enriched.tags,
    difficultyScore: enriched.difficultyScore,
    cefr: enriched.cefr,
    wordRefs: enriched.wordRefs,
    hardForEnglish: enriched.hardForEnglish,
  };
}

/**
 * Transform enriched word data to app-friendly format.
 */
function transformEnrichedWord(
  enriched: EnrichedWord,
  categoryLabelEn: string,
  categoryLabelPt: string,
  audioIndex?: AudioIndex
): Word {
  const audioId = enriched.id; // Word IDs match audio IDs in index
  
  // Map difficultyScore to Difficulty (2-4 scale: Easy, Medium, Hard)
  // If difficultyScore is provided, map it to 2-4 range
  // Otherwise default to 3 (Medium)
  let difficulty: Difficulty = 3;
  if (enriched.difficultyScore !== undefined) {
    // Map 0-100 score to 2-4 scale
    difficulty = Math.max(2, Math.min(4, Math.round((enriched.difficultyScore / 100) * 2) + 2)) as Difficulty;
  }
  
  return {
    id: enriched.id,
    textPt: enriched.text,
    forms: enriched.forms,
    translationEn: enriched.en || '', // Use preserved English translation
    partOfSpeech: enriched.partOfSpeech,
    difficulty: enriched.difficulty || difficulty, // Use preserved difficulty, fallback to computed
    difficultForEnglish: enriched.difficultForEnglish ?? enriched.englishDifficultyFlag ?? false,
    categoryId: enriched.category,
    categoryLabelEn,
    categoryLabelPt,
    pronunciationNotes: enriched.pronunciationNotes, // Use preserved pronunciation notes
    audioId,
    audioMaleUrl: getWordAudioUrl(enriched.id, 'male', audioIndex),
    audioFemaleUrl: getWordAudioUrl(enriched.id, 'female', audioIndex),
    // Enriched fields
    phonemes: enriched.phonemes?.length > 0 ? enriched.phonemes : undefined,
    ipa: enriched.ipa,
    tags: enriched.tags,
    difficultyScore: enriched.difficultyScore,
    cefr: enriched.cefr,
  };
}

/**
 * Load category labels from legacy data files.
 * Used when loading master datasets to get category labels.
 */
async function loadCategoryLabels(): Promise<Map<string, { labelEn: string; labelPt: string }>> {
  const categoryMap = new Map<string, { labelEn: string; labelPt: string }>();
  
  try {
    // Try to load from sentences.json first
    const response = await fetch('/data/sentences.json');
    if (response.ok) {
      const data: SentencesData = await response.json();
      for (const category of data.categories) {
        categoryMap.set(category.id, {
          labelEn: category.label_en,
          labelPt: category.label_pt,
        });
      }
      return categoryMap;
    }
  } catch {
    // Fall through to static data
  }
  
  try {
    // Fallback to static data
    const response = await fetch('/data/static/sentences.json');
    if (response.ok) {
      const data: SentencesData = await response.json();
      for (const category of data.categories) {
        categoryMap.set(category.id, {
          labelEn: category.label_en,
          labelPt: category.label_pt,
        });
      }
    }
  } catch {
    // If both fail, return empty map - category labels will be missing
  }
  
  return categoryMap;
}

/**
 * Load all sentences from the pipeline-generated master dataset.
 *
 * Loads from `masterSentences.json` only. If the dataset is missing or empty the
 * error is thrown so callers can surface a visible error state \u2014 no legacy files
 * and no hardcoded sample data are ever substituted for real content.
 *
 * Results are cached after first load.
 */
export async function loadAllSentences(): Promise<Sentence[]> {
  if (cachedSentences) {
    return cachedSentences;
  }

  const audioIndex = await ensureAudioIndex();

  try {
    const masterResponse = await fetch('/data/masterSentences.json');
    if (!masterResponse.ok) {
      throw new Error(
        `Failed to load masterSentences.json: ${masterResponse.status} ${masterResponse.statusText}.`
      );
    }

    const enrichedSentences: EnrichedSentence[] = await masterResponse.json();

    if (enrichedSentences.length === 0) {
      throw new Error('masterSentences.json is empty. The master dataset must contain data.');
    }

    const categoryLabels = await loadCategoryLabels();

    const sentences: Sentence[] = enrichedSentences.map(enriched => {
      const categoryInfo = categoryLabels.get(enriched.category) || {
        labelEn: enriched.category,
        labelPt: enriched.category,
      };
      return transformEnrichedSentence(enriched, categoryInfo.labelEn, categoryInfo.labelPt, audioIndex);
    });

    cachedSentences = sentences;
    console.log(`Loaded ${sentences.length} sentences from master dataset`);
    return sentences;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error loading master sentences:', errorMsg);
    throw new Error(`Unable to load sentences: ${errorMsg}`);
  }
}

/**
 * Load all words from the pipeline-generated master dataset.
 *
 * Loads from `masterWords.json` only. If the dataset is missing or empty the
 * error is thrown so callers can surface a visible error state — no legacy files
 * and no hardcoded sample data are ever substituted for real content.
 *
 * Results are cached after first load.
 */
export async function loadAllWords(): Promise<Word[]> {
  if (cachedWords) {
    return cachedWords;
  }

  const audioIndex = await ensureAudioIndex();

  try {
    const masterResponse = await fetch('/data/masterWords.json');
    if (!masterResponse.ok) {
      throw new Error(
        `Failed to load masterWords.json: ${masterResponse.status} ${masterResponse.statusText}.`
      );
    }

    const enrichedWords: EnrichedWord[] = await masterResponse.json();

    if (enrichedWords.length === 0) {
      throw new Error('masterWords.json is empty. The master dataset must contain data.');
    }

    const categoryLabels = await loadCategoryLabels();

    const words: Word[] = enrichedWords.map(enriched => {
      const categoryInfo = categoryLabels.get(enriched.category) || {
        labelEn: enriched.category,
        labelPt: enriched.category,
      };
      return transformEnrichedWord(enriched, categoryInfo.labelEn, categoryInfo.labelPt, audioIndex);
    });

    cachedWords = words;
    console.log(`Loaded ${words.length} words from master dataset`);
    return words;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error loading master words:', errorMsg);
    throw new Error(`Unable to load words: ${errorMsg}`);
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
    const categoryLabels = await loadCategoryLabels();

    const masterResponse = await fetch('/data/masterSentences.json');
    if (masterResponse.ok) {
      const enrichedSentences: EnrichedSentence[] = await masterResponse.json();
      if (enrichedSentences.length > 0) {
        const activeCategoryIds = new Set(
          enrichedSentences
            .map(sentence => sentence.category)
            .filter((categoryId): categoryId is string => Boolean(categoryId))
        );

        const categories: Category[] = [];

        for (const [id, labels] of categoryLabels.entries()) {
          if (activeCategoryIds.has(id)) {
            categories.push({
              id,
              labelEn: labels.labelEn,
              labelPt: labels.labelPt,
            });
            activeCategoryIds.delete(id);
          }
        }

        for (const id of activeCategoryIds) {
          categories.push({
            id,
            labelEn: id,
            labelPt: id,
          });
        }

        cachedCategories = categories;
        return categories;
      }
    }

    let response = await fetch('/data/sentences.json');
    if (!response.ok) {
      response = await fetch('/data/static/sentences.json');
      if (!response.ok) {
        throw new Error(`Failed to load categories: ${response.statusText}`);
      }
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

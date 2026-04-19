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
import type { EnrichedWord, EnrichedSentence } from '../types/contentGeneration';
import { sampleData } from './sampleData';
import { buildWordRefs } from '../pipeline/sentenceWordRefs';
import { CONTENT_SOURCE } from '../config/appConfig';

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
    forms: raw.forms,
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
 * Load all sentences based on CONTENT_SOURCE configuration.
 * 
 * - If CONTENT_SOURCE === 'pipeline': Loads from masterSentences.json, throws error if missing
 * - If CONTENT_SOURCE === 'legacy': Loads from legacy files with fallback chain
 * 
 * Results are cached after first load.
 */
export async function loadAllSentences(): Promise<Sentence[]> {
  if (cachedSentences) {
    return cachedSentences;
  }

  const audioIndex = await ensureAudioIndex();
  
  // Pipeline mode: Load from master dataset only, no fallback
  if (CONTENT_SOURCE === 'pipeline') {
    try {
      const masterResponse = await fetch('/data/masterSentences.json');
      if (!masterResponse.ok) {
        const errorMsg = `[CONTENT_SOURCE=pipeline] Failed to load masterSentences.json: ${masterResponse.status} ${masterResponse.statusText}. Master dataset is required when CONTENT_SOURCE=pipeline.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      const enrichedSentences: EnrichedSentence[] = await masterResponse.json();
      
      // Check if we actually got data (not just empty array)
      if (enrichedSentences.length === 0) {
        const errorMsg = `[CONTENT_SOURCE=pipeline] masterSentences.json is empty. Master dataset must contain data when CONTENT_SOURCE=pipeline.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
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
      console.log(`[CONTENT_SOURCE=pipeline] Loaded ${sentences.length} sentences from master dataset`);
      return sentences;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[CONTENT_SOURCE=pipeline] Error loading master sentences:`, errorMsg);
      throw new Error(`Failed to load pipeline data: ${errorMsg}`);
    }
  }
  
  // Legacy mode: Try master dataset first, then fallback to legacy files
  try {
    const masterResponse = await fetch('/data/masterSentences.json');
    if (masterResponse.ok) {
      const enrichedSentences: EnrichedSentence[] = await masterResponse.json();
      // Check if we actually got data (not just empty array)
      if (enrichedSentences.length > 0) {
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
      }
    }
  } catch (error) {
    console.warn('Failed to load master sentences, falling back to legacy files:', error);
  }

  // Fallback to legacy files
  try {
    // Try data/sentences.json first
    let response = await fetch('/data/sentences.json');
    if (!response.ok) {
      // Fallback to static data
      response = await fetch('/data/static/sentences.json');
      if (!response.ok) {
        throw new Error(`Failed to load sentences.json: ${response.statusText}`);
      }
    }
    
    const data: SentencesData = await response.json();
    
    // Feat 15: Load words to compute wordRefs for legacy sentences
    // Use the same normalization function as buildWordRefs
    const normalizeToken = (token: string): string => {
      return token
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^\w\s]/g, ''); // Remove punctuation
    };
    
    let wordsForWordRefs: Array<Pick<EnrichedWord, 'id' | 'text' | 'normalizedText'> & { forms?: string[] }> = [];
    try {
      const wordsData = await loadAllWords();
      // Convert Word[] to EnrichedWord[] format for buildWordRefs
      wordsForWordRefs = wordsData.map(word => ({
        id: word.id,
        text: word.textPt,
        normalizedText: normalizeToken(word.textPt),
        forms: word.forms,
        category: word.categoryId,
      }));
    } catch (wordError) {
      console.warn('Failed to load words for wordRefs computation:', wordError);
    }
    
    const sentences: Sentence[] = [];
    
    for (const category of data.categories) {
      if (category.sentences) {
        for (const rawSentence of category.sentences) {
          const sentence = transformSentence(rawSentence, category, audioIndex);
          
          // Feat 15: Compute wordRefs for legacy sentences if words are available
          if (wordsForWordRefs.length > 0) {
            const wordRefs = buildWordRefs(sentence.textPt, wordsForWordRefs);
            // Convert to the format expected by Sentence interface (without startChar/endChar)
            sentence.wordRefs = wordRefs.map(ref => ({
              wordId: ref.wordId,
              tokenIndex: ref.tokenIndex,
            }));
          }
          
          sentences.push(sentence);
        }
      }
    }
    
    cachedSentences = sentences;
    console.log(`Loaded ${sentences.length} sentences from legacy files`);
    return sentences;
  } catch (error) {
    console.error('Error loading sentences:', error);
    // Temporary fallback to sample data if all else fails
    console.warn('Falling back to sample data for sentences');
    const sampleSentences: Sentence[] = sampleData.sentences.map(sample => {
      // Map sample data format to Sentence format
      const categoryId = sample.categories[0] || 'foods';
      const category = sampleData.categories.find(c => c.id === categoryId) || {
        id: categoryId,
        name: categoryId,
        description: '',
      };
      
      return {
        id: sample.id,
        textPt: sample.textPt,
        translationEn: sample.translationEn || '',
        difficulty: sample.difficulty,
        categoryId: category.id,
        categoryLabelEn: category.name,
        categoryLabelPt: category.name,
        pronunciationNotes: undefined,
        audioId: sample.id,
        audioMaleUrl: getSentenceAudioUrl(sample.id, 'male', audioIndex),
        audioFemaleUrl: getSentenceAudioUrl(sample.id, 'female', audioIndex),
        tags: sample.tags,
      };
    });
    
    cachedSentences = sampleSentences;
    console.log(`Loaded ${sampleSentences.length} sentences from sample data`);
    return sampleSentences;
  }
}

/**
 * Load all words based on CONTENT_SOURCE configuration.
 * 
 * - If CONTENT_SOURCE === 'pipeline': Loads from masterWords.json, throws error if missing
 * - If CONTENT_SOURCE === 'legacy': Loads from legacy files with fallback chain
 * 
 * Results are cached after first load.
 */
export async function loadAllWords(): Promise<Word[]> {
  if (cachedWords) {
    return cachedWords;
  }

  const audioIndex = await ensureAudioIndex();
  
  // Pipeline mode: Load from master dataset only, no fallback
  if (CONTENT_SOURCE === 'pipeline') {
    try {
      const masterResponse = await fetch('/data/masterWords.json');
      if (!masterResponse.ok) {
        const errorMsg = `[CONTENT_SOURCE=pipeline] Failed to load masterWords.json: ${masterResponse.status} ${masterResponse.statusText}. Master dataset is required when CONTENT_SOURCE=pipeline.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      const enrichedWords: EnrichedWord[] = await masterResponse.json();
      
      // Check if we actually got data (not just empty array)
      if (enrichedWords.length === 0) {
        const errorMsg = `[CONTENT_SOURCE=pipeline] masterWords.json is empty. Master dataset must contain data when CONTENT_SOURCE=pipeline.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
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
      console.log(`[CONTENT_SOURCE=pipeline] Loaded ${words.length} words from master dataset`);
      return words;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[CONTENT_SOURCE=pipeline] Error loading master words:`, errorMsg);
      throw new Error(`Failed to load pipeline data: ${errorMsg}`);
    }
  }
  
  // Legacy mode: Try master dataset first, then fallback to legacy files
  try {
    const masterResponse = await fetch('/data/masterWords.json');
    if (masterResponse.ok) {
      const enrichedWords: EnrichedWord[] = await masterResponse.json();
      // Check if we actually got data (not just empty array)
      if (enrichedWords.length > 0) {
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
      } else {
        // Empty array - fall through to legacy files
        console.log('Master words file is empty, falling back to legacy files');
      }
    }
  } catch (error) {
    console.warn('Failed to load master words, falling back to legacy files:', error);
  }

  // Fallback to legacy files
  try {
    const response = await fetch('/data/static/words.json');
    if (!response.ok) {
      throw new Error(`Failed to load words.json: ${response.statusText}`);
    }
    
    const data: WordsData = await response.json();
    
    const words: Word[] = [];
    
    for (const category of data.categories) {
      if (category.words) {
        for (const rawWord of category.words) {
          words.push(transformWord(rawWord, category, audioIndex));
        }
      }
    }
    
    cachedWords = words;
    console.log(`Loaded ${words.length} words from legacy files`);
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

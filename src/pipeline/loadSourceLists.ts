/**
 * Source loader for the content generation pipeline.
 * 
 * This module loads and normalizes raw data from existing JSON files into
 * RawWord and RawSentence arrays for further processing.
 * 
 * Schema Notes:
 * 
 * STATIC DATA/words.json structure:
 *   Root: { language_pair, version, categories: [...] }
 *   Category: { id, label_en, label_pt, words: [...] }
 *   Word: { id, pt, en, pos, difficulty, difficult_for_english, pronunciation_notes? }
 * 
 * data/sentences.json structure:
 *   Root: { language_pair, version, categories: [...] }
 *   Category: { id, label_en, label_pt, sentences: [...] }
 *   Sentence: { id, en, pt, difficulty, pronunciation_notes? }
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { RawWord, RawSentence, WordsData, SentencesData } from '../lib/types';
import type { GenerationPipelineConfig } from '../../config/generationPipeline.config';

/**
 * Normalizes text to lowercase for consistent matching.
 * 
 * @param text - The text to normalize
 * @returns Normalized text in lowercase
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Loads and normalizes words from the configured JSON file into RawWord array.
 * 
 * @param config - Generation pipeline configuration
 * @returns Promise resolving to an array of normalized RawWord entries
 */
export async function loadRawWords(config: GenerationPipelineConfig): Promise<RawWord[]> {
  const wordsPath = path.join(process.cwd(), config.paths.rawWordsJsonPath);
  
  console.log(`Loading words from: ${wordsPath}`);
  const content = await fs.readFile(wordsPath, 'utf-8');
  const data: WordsData = JSON.parse(content);
  
  const rawWords: RawWord[] = [];
  
  // Flatten categories and map words to RawWord
  for (const category of data.categories) {
    for (const word of category.words || []) {
      rawWords.push({
        id: word.id,
        pt: word.pt.trim(),
        forms: Array.isArray(word.forms)
          ? word.forms.map((form: string) => form.trim()).filter(Boolean)
          : undefined,
        en: word.en.trim(),
        pos: word.pos,
        category: category.id,
        difficulty: word.difficulty as 1 | 2 | 3 | 4 | 5,
        difficult_for_english: word.difficult_for_english,
        pronunciation_notes: word.pronunciation_notes,
      });
    }
  }
  
  // Normalize: deduplicate by PT text (case-insensitive comparison)
  // Keep the first occurrence
  const seen = new Map<string, RawWord>();
  const normalized: RawWord[] = [];
  
  for (const word of rawWords) {
    const key = normalizeText(word.pt);
    
    if (!seen.has(key)) {
      seen.set(key, word);
      normalized.push(word);
    } else {
      // Keep first occurrence
      continue;
    }
  }
  
  // Apply limit from config if specified
  const limited = config.limits.maxWords
    ? normalized.slice(0, config.limits.maxWords)
    : normalized;
  
  console.log(`Loaded ${limited.length} raw words (${normalized.length} unique, ${rawWords.length} total before deduplication)`);
  
  return limited;
}

/**
 * Loads and normalizes sentences from the configured JSON file into RawSentence array.
 * 
 * @param config - Generation pipeline configuration
 * @returns Promise resolving to an array of normalized RawSentence entries
 */
export async function loadRawSentences(config: GenerationPipelineConfig): Promise<RawSentence[]> {
  const sentencesPath = path.join(process.cwd(), config.paths.rawSentencesJsonPath);
  
  console.log(`Loading sentences from: ${sentencesPath}`);
  const content = await fs.readFile(sentencesPath, 'utf-8');
  const data: SentencesData = JSON.parse(content);
  
  const rawSentences: RawSentence[] = [];
  
  // Flatten categories and map sentences to RawSentence
  for (const category of data.categories) {
    for (const sentence of category.sentences || []) {
      rawSentences.push({
        id: sentence.id,
        pt: sentence.pt.trim(),
        en: sentence.en.trim(),
        category: category.id,
        difficulty: sentence.difficulty as 1 | 2 | 3 | 4 | 5,
        pronunciation_notes: sentence.pronunciation_notes,
      });
    }
  }
  
  // Normalize: deduplicate by PT text (case-insensitive comparison)
  const seen = new Map<string, RawSentence>();
  const normalized: RawSentence[] = [];
  
  for (const sentence of rawSentences) {
    const key = normalizeText(sentence.pt);
    
    if (!seen.has(key)) {
      seen.set(key, sentence);
      normalized.push(sentence);
    } else {
      // Keep first occurrence
      continue;
    }
  }
  
  // Apply limit from config if specified
  const limited = config.limits.maxSentences
    ? normalized.slice(0, config.limits.maxSentences)
    : normalized;
  
  console.log(`Loaded ${limited.length} raw sentences (${normalized.length} unique, ${rawSentences.length} total before deduplication)`);
  
  return limited;
}

/**
 * Source loader for the content generation pipeline.
 * 
 * This module loads and normalizes raw data from existing JSON files into
 * RawWordInput and RawSentenceInput arrays for further processing.
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
 * 
 * TODO: Future integration - Merge frequency data from CSV sources such as
 * data/source/word_frequency_ptbr.csv to populate frequencyRank fields.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { RawWordInput, RawSentenceInput } from '../types/contentGeneration';
import generationPipelineConfig from '../../config/generationPipeline.config';

// Types matching the JSON structure
interface WordEntry {
  id: string;
  pt: string;
  en: string;
  pos: string;
  difficulty: number;
  difficult_for_english: boolean;
  pronunciation_notes?: string;
}

interface SentenceEntry {
  id: string;
  en: string;
  pt: string;
  difficulty: number;
  pronunciation_notes?: string;
}

interface WordsJson {
  language_pair: string;
  version: string;
  categories: Array<{
    id: string;
    label_en: string;
    label_pt: string;
    words: WordEntry[];
  }>;
}

interface SentencesJson {
  language_pair: string;
  version: string;
  categories: Array<{
    id: string;
    label_en: string;
    label_pt: string;
    sentences: SentenceEntry[];
  }>;
}

/**
 * Loads and normalizes words from STATIC DATA/words.json into RawWordInput array.
 * 
 * @returns Promise resolving to an array of normalized RawWordInput entries
 */
export async function loadRawWords(): Promise<RawWordInput[]> {
  const wordsPath = path.join(process.cwd(), 'STATIC DATA', 'words.json');
  
  console.log(`Loading words from: ${wordsPath}`);
  const content = await fs.readFile(wordsPath, 'utf-8');
  const data: WordsJson = JSON.parse(content);
  
  const rawWords: RawWordInput[] = [];
  
  // Flatten categories and map words to RawWordInput
  for (const category of data.categories) {
    for (const word of category.words) {
      rawWords.push({
        pt: word.pt.trim(),
        english: word.en.trim(),
        // frequencyRank will be populated later from frequency lists
        // TODO: Merge frequency data from data/source/word_frequency_ptbr.csv
        frequencyRank: undefined,
        partOfSpeech: word.pos,
        category: category.id,
      });
    }
  }
  
  // Normalize: deduplicate by PT text (case-insensitive comparison)
  // Keep the first occurrence (or one with lower difficulty if available)
  const seen = new Map<string, RawWordInput>();
  const normalized: RawWordInput[] = [];
  
  for (const word of rawWords) {
    const key = word.pt.toLowerCase().trim();
    
    if (!seen.has(key)) {
      seen.set(key, word);
      normalized.push(word);
    } else {
      // If duplicate found, keep the existing one (first occurrence wins)
      // In future, we could compare difficulty or other fields to keep the "best" one
      continue;
    }
  }
  
  // Apply limit from config if enabled
  // TODO: Consider applying limits in a later enrichment step instead
  const limited = generationPipelineConfig.enableWords
    ? normalized.slice(0, generationPipelineConfig.wordLimit)
    : normalized;
  
  console.log(`Loaded ${limited.length} raw words (${normalized.length} unique, ${rawWords.length} total before deduplication)`);
  
  return limited;
}

/**
 * Loads and normalizes sentences from data/sentences.json into RawSentenceInput array.
 * 
 * @returns Promise resolving to an array of normalized RawSentenceInput entries
 */
export async function loadRawSentences(): Promise<RawSentenceInput[]> {
  const sentencesPath = path.join(process.cwd(), 'data', 'sentences.json');
  
  console.log(`Loading sentences from: ${sentencesPath}`);
  const content = await fs.readFile(sentencesPath, 'utf-8');
  const data: SentencesJson = JSON.parse(content);
  
  const rawSentences: RawSentenceInput[] = [];
  
  // Flatten categories and map sentences to RawSentenceInput
  for (const category of data.categories) {
    for (const sentence of category.sentences) {
      rawSentences.push({
        pt: sentence.pt.trim(),
        english: sentence.en.trim() || '', // Use empty string if translation missing
        // TODO: Handle missing translations - some sentences may not have English translations
        // frequencyRank will be populated later from frequency lists
        frequencyRank: undefined,
        category: category.id,
      });
    }
  }
  
  // Normalize: deduplicate by PT text (case-insensitive comparison)
  const seen = new Map<string, RawSentenceInput>();
  const normalized: RawSentenceInput[] = [];
  
  for (const sentence of rawSentences) {
    const key = sentence.pt.toLowerCase().trim();
    
    if (!seen.has(key)) {
      seen.set(key, sentence);
      normalized.push(sentence);
    } else {
      // Keep first occurrence
      continue;
    }
  }
  
  // Apply limit from config if enabled
  // TODO: Consider applying limits in a later enrichment step instead
  const limited = generationPipelineConfig.enableSentences
    ? normalized.slice(0, generationPipelineConfig.sentenceLimit)
    : normalized;
  
  console.log(`Loaded ${limited.length} raw sentences (${normalized.length} unique, ${rawSentences.length} total before deduplication)`);
  
  return limited;
}


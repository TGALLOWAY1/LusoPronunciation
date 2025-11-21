/**
 * Enrichment orchestrator for the content generation pipeline.
 * 
 * Transforms RawWordInput and RawSentenceInput into enriched MasterWord and
 * MasterSentence arrays by applying phoneme mapping, difficulty inference,
 * category inference, and word reference building.
 */

import {
  RawWordInput,
  RawSentenceInput,
  MasterWord,
  MasterSentence,
} from '../types/contentGeneration';
import { mapWordToPhonemes } from './phonemeMapper';
import * as tagging from './tagging';
import { buildWordRefs } from './sentenceWordRefs';

/**
 * Simple slugify helper to generate stable IDs from text.
 * 
 * @param text - The text to slugify
 * @returns Slugified string suitable for use in IDs
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .trim()
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
}

/**
 * Generates a stable ID for a word.
 * 
 * @param pt - The Portuguese word text
 * @param index - Optional index for uniqueness
 * @returns Word ID
 */
function generateWordId(pt: string, index?: number): string {
  const slug = slugify(pt);
  // If slug is empty or too short, use index-based fallback
  if (slug.length === 0) {
    return `word_${index ?? Date.now()}`;
  }
  // Add index if provided to ensure uniqueness
  return index !== undefined ? `word_${slug}_${index}` : `word_${slug}`;
}

/**
 * Generates a stable ID for a sentence.
 * 
 * @param pt - The Portuguese sentence text
 * @param index - Optional index for uniqueness
 * @returns Sentence ID
 */
function generateSentenceId(pt: string, index?: number): string {
  // TODO: Improve ID generation - could use short hash of sentence text
  // For now, use slugified version with index
  const slug = slugify(pt.substring(0, 50)); // Use first 50 chars for slug
  if (slug.length === 0) {
    return `sentence_${index ?? Date.now()}`;
  }
  return index !== undefined ? `sentence_${slug}_${index}` : `sentence_${slug}`;
}

/**
 * Builds MasterWord array from RawWordInput array.
 * 
 * Applies phoneme mapping, difficulty inference, and category inference.
 * Generates stable IDs and enriches with all required fields.
 * 
 * @param rawWords - Array of raw word inputs
 * @param limit - Maximum number of words to process
 * @returns Array of enriched MasterWord entries
 */
export function buildMasterWords(
  rawWords: RawWordInput[],
  limit: number
): MasterWord[] {
  const truncated = rawWords.slice(0, limit);
  const masterWords: MasterWord[] = [];

  for (let i = 0; i < truncated.length; i++) {
    const raw = truncated[i];
    const phonemeData = mapWordToPhonemes(raw.pt);

    const masterWord: MasterWord = {
      id: generateWordId(raw.pt, i),
      text: raw.pt,
      englishGloss: raw.english,
      partOfSpeech: raw.partOfSpeech || 'unknown',
      frequencyRank: raw.frequencyRank,
      difficulty: tagging.inferWordDifficulty(raw.frequencyRank),
      category: tagging.inferCategory(raw.category, raw.pt),
      isHardForEnglishSpeakers: phonemeData.isHardForEnglishSpeakers,
      ipa: phonemeData.ipa,
      phonemes: phonemeData.phonemes,
    };

    masterWords.push(masterWord);
  }

  return masterWords;
}

/**
 * Builds MasterSentence array from RawSentenceInput array.
 * 
 * Applies difficulty inference, category inference, tag inference, and
 * builds word references by matching sentence tokens to MasterWord entries.
 * 
 * @param rawSentences - Array of raw sentence inputs
 * @param words - Array of MasterWord entries for word reference matching
 * @param limit - Maximum number of sentences to process
 * @returns Array of enriched MasterSentence entries
 */
export function buildMasterSentences(
  rawSentences: RawSentenceInput[],
  words: MasterWord[],
  limit: number
): MasterSentence[] {
  const truncated = rawSentences.slice(0, limit);
  const masterSentences: MasterSentence[] = [];

  for (let i = 0; i < truncated.length; i++) {
    const raw = truncated[i];
    const wordRefs = buildWordRefs(raw.pt, words);

    const masterSentence: MasterSentence = {
      id: generateSentenceId(raw.pt, i),
      text: raw.pt,
      englishTranslation: raw.english,
      frequencyRank: raw.frequencyRank,
      difficulty: tagging.inferSentenceDifficulty(raw.frequencyRank),
      category: tagging.inferCategory(raw.category, raw.pt),
      tags: tagging.inferTagsForSentence(raw.pt),
      wordRefs,
    };

    masterSentences.push(masterSentence);
  }

  return masterSentences;
}


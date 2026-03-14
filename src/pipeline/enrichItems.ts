/**
 * Enrichment orchestrator for the content generation pipeline.
 * 
 * Transforms RawWord and RawSentence into enriched EnrichedWord and
 * EnrichedSentence arrays by applying phoneme mapping, tagging, difficulty inference,
 * and word reference building.
 */

import type { RawWord, RawSentence } from '../lib/types';
import type { EnrichedWord, EnrichedSentence } from '../types/contentGeneration';
import type { GenerationPipelineConfig } from '../../config/generationPipeline.config';
import { mapWordToPhonemes } from './phonemeMapper';
import { applyWordTags, applySentenceTags, inferCategory } from './tagging';
import { computeSentenceWordRefs } from './sentenceWordRefs';

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
 * Enriches raw words into EnrichedWord objects.
 * 
 * Steps:
 * 1. Normalize text
 * 2. Attach phonemes/IPA via phonemeMapper
 * 3. Apply tags and difficulty heuristics via tagging
 * 
 * @param rawWords - Array of raw words from source data
 * @param config - Generation pipeline configuration
 * @returns Array of enriched word entries
 */
export function enrichWords(
  rawWords: RawWord[],
  _config: GenerationPipelineConfig
): EnrichedWord[] {
  const enrichedWords: EnrichedWord[] = [];

  for (const raw of rawWords) {
    const text = raw.pt.trim();
    const normalizedText = normalizeText(text);
    
    // Get phonemes using G2P mapper
    const { phonemes, ipa } = mapWordToPhonemes(text);
    
    // Create base enriched word - preserve all fields from raw data
    const enrichedWord: EnrichedWord = {
      id: raw.id,
      text,
      normalizedText,
      en: raw.en.trim(), // Preserve English translation
      category: inferCategory(raw.category, text),
      partOfSpeech: raw.pos,
      difficulty: raw.difficulty, // Preserve difficulty (1-5 scale)
      difficultForEnglish: raw.difficult_for_english,
      pronunciationNotes: raw.pronunciation_notes, // Preserve pronunciation notes
      englishDifficultyFlag: raw.difficult_for_english, // Alias for backward compatibility
      phonemes: phonemes || [], // Ensure array is never undefined
      ipa,
    };
    
    // Apply tags and difficulty heuristics
    const taggedWord = applyWordTags(enrichedWord);
    
    enrichedWords.push(taggedWord);
  }

  return enrichedWords;
}

/**
 * Enriches raw sentences into EnrichedSentence objects.
 * 
 * Steps:
 * 1. Normalize text
 * 2. Apply sentence-level tags and difficulty
 * 3. Use computeSentenceWordRefs to produce wordRefs
 * 
 * @param rawSentences - Array of raw sentences from source data
 * @param words - Array of enriched words for word reference matching
 * @param config - Generation pipeline configuration
 * @returns Array of enriched sentence entries
 */
export function enrichSentences(
  rawSentences: RawSentence[],
  words: EnrichedWord[],
  _config: GenerationPipelineConfig
): EnrichedSentence[] {
  // First, create base enriched sentences - preserve all fields from raw data
  const baseEnriched: EnrichedSentence[] = rawSentences.map(raw => {
    const text = raw.pt.trim();
    const normalizedText = normalizeText(text);
    
    // Determine if sentence is hard for English speakers
    // Simple heuristic: check if it contains difficult features
    const hasNasal = normalizedText.includes('ã') || normalizedText.includes('õ') || normalizedText.includes('ão');
    const hasLh = normalizedText.includes('lh');
    const hasRr = normalizedText.includes('rr');
    const hardForEnglish = hasNasal || hasLh || hasRr;
    
    return {
      id: raw.id,
      text,
      normalizedText,
      en: raw.en.trim(), // Preserve English translation
      category: inferCategory(raw.category, text),
      difficulty: raw.difficulty, // Preserve difficulty (1-5 scale)
      pronunciationNotes: raw.pronunciation_notes, // Preserve pronunciation notes
      hardForEnglish,
    };
  });
  
  // Apply tags and difficulty heuristics
  const taggedSentences = baseEnriched.map(sentence => applySentenceTags(sentence));
  
  // Compute word references
  const sentencesWithRefs = computeSentenceWordRefs(taggedSentences, words);
  
  return sentencesWithRefs;
}

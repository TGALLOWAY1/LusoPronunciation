/**
 * Tagging and difficulty inference module.
 * 
 * Heuristic-based functions for inferring difficulty levels, categories, and tags
 * from raw input data. These are intentionally simple and can be refined later
 * with more sophisticated NLP or machine learning approaches.
 */

import { MasterWord, MasterSentence } from '../types/contentGeneration';

/**
 * Infers word difficulty level based on frequency rank.
 * 
 * Heuristic bands:
 * - rank <= 500 → "A1" (most common words)
 * - 501-1000 → "A2"
 * - 1001-2000 → "B1"
 * - > 2000 → "B2"
 * - missing rank → "B1" (default)
 * 
 * @param rank - Optional frequency rank
 * @returns Difficulty level
 */
export function inferWordDifficulty(rank?: number): MasterWord['difficulty'] {
  if (rank === undefined || rank === null) {
    // TODO: Improve default difficulty inference when rank is missing
    // Could use word length, part of speech, or other heuristics
    return 'B1';
  }

  if (rank <= 500) {
    return 'A1';
  } else if (rank <= 1000) {
    return 'A2';
  } else if (rank <= 2000) {
    return 'B1';
  } else {
    return 'B2';
  }
}

/**
 * Infers sentence difficulty level based on frequency rank.
 * 
 * Uses the same heuristic bands as inferWordDifficulty.
 * 
 * @param rank - Optional frequency rank
 * @returns Difficulty level
 */
export function inferSentenceDifficulty(rank?: number): MasterSentence['difficulty'] {
  if (rank === undefined || rank === null) {
    // TODO: Improve default difficulty inference when rank is missing
    // Could analyze sentence length, complexity, or vocabulary
    return 'B1';
  }

  if (rank <= 500) {
    return 'A1';
  } else if (rank <= 1000) {
    return 'A2';
  } else if (rank <= 2000) {
    return 'B1';
  } else {
    return 'B2';
  }
}

/**
 * Infers category from raw category string or text content.
 * 
 * If rawCategory exists, uses it directly.
 * Otherwise, performs simple keyword-based inference:
 * - Food-related: "comer", "beber", "comida", "restaurante"
 * - Work-related: "trabalhar", "trabalho", "escritório"
 * - Travel-related: "viajar", "viagem", "hotel", "aeroporto"
 * - Default: "general"
 * 
 * @param rawCategory - Optional category from source data
 * @param text - The text content (word or sentence)
 * @returns Inferred category string
 */
export function inferCategory(
  rawCategory: string | undefined,
  text: string
): string {
  if (rawCategory && rawCategory.trim().length > 0) {
    return rawCategory.trim();
  }

  // Simple keyword-based inference
  const normalized = text.toLowerCase();

  // Food-related keywords
  if (
    normalized.includes('comer') ||
    normalized.includes('beber') ||
    normalized.includes('comida') ||
    normalized.includes('restaurante') ||
    normalized.includes('café') ||
    normalized.includes('água')
  ) {
    return 'food';
  }

  // Work-related keywords
  if (
    normalized.includes('trabalhar') ||
    normalized.includes('trabalho') ||
    normalized.includes('escritório') ||
    normalized.includes('reunião')
  ) {
    return 'work';
  }

  // Travel-related keywords
  if (
    normalized.includes('viajar') ||
    normalized.includes('viagem') ||
    normalized.includes('hotel') ||
    normalized.includes('aeroporto') ||
    normalized.includes('ônibus') ||
    normalized.includes('trem')
  ) {
    return 'travel';
  }

  // Default category
  return 'general';
}

/**
 * Infers tags from sentence content.
 * 
 * Extracts simple linguistic features:
 * - "question" if sentence contains "?"
 * - "first-person" if sentence contains first-person pronouns (eu, meu, minha)
 * - "negation" if sentence contains negation words (não, nunca, nenhum)
 * - "present-tense" if sentence contains present-tense indicators (simple heuristics)
 * 
 * This is intentionally lightweight and easy to extend.
 * 
 * @param sentence - The sentence text
 * @returns Array of tag strings
 */
export function inferTagsForSentence(sentence: string): string[] {
  const tags: string[] = [];
  const normalized = sentence.toLowerCase();

  // Question tag
  if (sentence.includes('?') || sentence.includes('?')) {
    tags.push('question');
  }

  // First-person tag
  if (
    /\beu\b/.test(normalized) ||
    /\bmeu\b/.test(normalized) ||
    /\bminha\b/.test(normalized) ||
    /\bmeus\b/.test(normalized) ||
    /\bminhas\b/.test(normalized)
  ) {
    tags.push('first-person');
  }

  // Negation tag
  if (
    /\bnão\b/.test(normalized) ||
    /\bnunca\b/.test(normalized) ||
    /\bnenhum\b/.test(normalized) ||
    /\bnenhuma\b/.test(normalized)
  ) {
    tags.push('negation');
  }

  // Present-tense indicators (simple heuristic)
  // Common present-tense verb endings: -o, -as, -a, -amos, -am
  // This is a very basic heuristic and could be improved
  if (
    /\b(estou|sou|tenho|faço|vou|posso|quero|preciso)\b/.test(normalized)
  ) {
    tags.push('present-tense');
  }

  return tags;
}


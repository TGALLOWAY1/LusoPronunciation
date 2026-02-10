/**
 * Tagging and difficulty inference module.
 * 
 * Heuristic-based functions for inferring difficulty levels, categories, and tags
 * from raw input data. These are intentionally simple and can be refined later
 * with more sophisticated NLP or machine learning approaches.
 */

import type { EnrichedWord, EnrichedSentence } from '../types/contentGeneration';

/**
 * Infers CEFR level based on word characteristics.
 * 
 * Heuristic-based approach:
 * - Short, common words → A1
 * - Medium length, common words → A2
 * - Longer words or tricky features → B1/B2
 * 
 * @param word - The enriched word
 * @returns CEFR level string
 */
function inferWordCEFR(word: EnrichedWord): string {
  const text = word.normalizedText || word.text.toLowerCase();
  const length = text.length;
  const hasTrickyFeatures = word.tags?.some(tag => 
    tag === 'nasal' || tag === 'contains_lh' || tag === 'contains_rr'
  ) || false;

  // Very short, simple words
  if (length <= 3 && !hasTrickyFeatures) {
    return 'A1';
  }

  // Short to medium words
  if (length <= 5 && !hasTrickyFeatures) {
    return 'A2';
  }

  // Words with tricky features or longer words
  if (hasTrickyFeatures || length > 8) {
    return 'B2';
  }

  // Default to B1
  return 'B1';
}

/**
 * Infers CEFR level based on sentence characteristics.
 * 
 * Heuristic-based approach:
 * - Short sentences → A1/A2
 * - Medium sentences → B1
 * - Long or complex sentences → B2
 * 
 * @param sentence - The enriched sentence
 * @returns CEFR level string
 */
function inferSentenceCEFR(sentence: EnrichedSentence): string {
  const text = sentence.normalizedText || sentence.text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const hasTrickyFeatures = sentence.tags?.some(tag =>
    tag === 'has_nasal' || tag === 'has_lh' || tag === 'has_rr'
  ) || false;

  // Very short sentences
  if (wordCount <= 4 && !hasTrickyFeatures) {
    return 'A1';
  }

  // Short to medium sentences
  if (wordCount <= 8 && !hasTrickyFeatures) {
    return 'A2';
  }

  // Long sentences or tricky features
  if (wordCount > 12 || hasTrickyFeatures) {
    return 'B2';
  }

  // Default to B1
  return 'B1';
}

/**
 * Calculates a numeric difficulty score (0-100, higher = more difficult).
 * 
 * @param word - The enriched word
 * @returns Difficulty score
 */
function calculateWordDifficultyScore(word: EnrichedWord): number {
  const text = word.normalizedText || word.text.toLowerCase();
  let score = 0;

  // Base score from length
  score += Math.min(text.length * 2, 30);

  // Add points for tricky features
  if (word.tags?.includes('nasal')) score += 15;
  if (word.tags?.includes('contains_lh')) score += 10;
  if (word.tags?.includes('contains_rr')) score += 10;
  if (word.englishDifficultyFlag) score += 20;

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Calculates a numeric difficulty score (0-100, higher = more difficult).
 * 
 * @param sentence - The enriched sentence
 * @returns Difficulty score
 */
function calculateSentenceDifficultyScore(sentence: EnrichedSentence): number {
  const text = sentence.normalizedText || sentence.text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  let score = 0;

  // Base score from word count
  score += Math.min(wordCount * 3, 40);

  // Add points for tricky features
  if (sentence.tags?.includes('has_nasal')) score += 10;
  if (sentence.tags?.includes('has_lh')) score += 10;
  if (sentence.tags?.includes('has_rr')) score += 10;
  if (sentence.tags?.includes('high_syllable_count')) score += 15;
  if (sentence.hardForEnglish) score += 20;

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Applies tags to an enriched word based on its characteristics.
 * 
 * Rule-based tagging:
 * - "nasal" if contains nasal vowels (ã, õ, ão)
 * - "contains_lh" if contains 'lh' digraph
 * - "contains_rr" if contains 'rr' digraph
 * - "proper_noun" if starts with capital letter (simple heuristic)
 * 
 * @param word - The enriched word to tag
 * @returns Enriched word with tags applied
 */
export function applyWordTags(word: EnrichedWord): EnrichedWord {
  const text = word.normalizedText || word.text.toLowerCase();
  const tags: string[] = word.tags ? [...word.tags] : [];

  // Check for nasal vowels
  if (text.includes('ã') || text.includes('õ') || text.includes('ão')) {
    if (!tags.includes('nasal')) {
      tags.push('nasal');
    }
  }

  // Check for 'lh' digraph
  if (text.includes('lh')) {
    if (!tags.includes('contains_lh')) {
      tags.push('contains_lh');
    }
  }

  // Check for 'rr' digraph
  if (text.includes('rr')) {
    if (!tags.includes('contains_rr')) {
      tags.push('contains_rr');
    }
  }

  // Check for proper noun (starts with capital in original text)
  if (word.text && word.text[0] === word.text[0].toUpperCase() && word.text.length > 1) {
    if (!tags.includes('proper_noun')) {
      tags.push('proper_noun');
    }
  }

  // Infer CEFR and difficulty score if not already set
  const cefr = word.cefr || inferWordCEFR({ ...word, tags });
  const difficultyScore = word.difficultyScore ?? calculateWordDifficultyScore({ ...word, tags });

  return {
    ...word,
    tags,
    cefr,
    difficultyScore,
  };
}

/**
 * Applies tags to an enriched sentence based on its characteristics.
 * 
 * Rule-based tagging:
 * - "has_nasal" if contains nasal vowels
 * - "has_lh" if contains 'lh' digraph
 * - "has_rr" if contains 'rr' digraph
 * - "high_syllable_count" if sentence is long (simple heuristic)
 * 
 * @param sentence - The enriched sentence to tag
 * @returns Enriched sentence with tags applied
 */
export function applySentenceTags(sentence: EnrichedSentence): EnrichedSentence {
  const text = sentence.normalizedText || sentence.text.toLowerCase();
  const tags: string[] = sentence.tags ? [...sentence.tags] : [];

  // Check for nasal vowels
  if (text.includes('ã') || text.includes('õ') || text.includes('ão')) {
    if (!tags.includes('has_nasal')) {
      tags.push('has_nasal');
    }
  }

  // Check for 'lh' digraph
  if (text.includes('lh')) {
    if (!tags.includes('has_lh')) {
      tags.push('has_lh');
    }
  }

  // Check for 'rr' digraph
  if (text.includes('rr')) {
    if (!tags.includes('has_rr')) {
      tags.push('has_rr');
    }
  }

  // Check for high syllable count (approximate by word count)
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount > 10) {
    if (!tags.includes('high_syllable_count')) {
      tags.push('high_syllable_count');
    }
  }

  // Infer CEFR and difficulty score if not already set
  const cefr = sentence.cefr || inferSentenceCEFR({ ...sentence, tags });
  const difficultyScore = sentence.difficultyScore ?? calculateSentenceDifficultyScore({ ...sentence, tags });

  return {
    ...sentence,
    tags,
    cefr,
    difficultyScore,
  };
}

/**
 * Infers category from raw category string or text content.
 * 
 * If rawCategory exists, uses it directly.
 * Otherwise, performs simple keyword-based inference.
 * 
 * @param rawCategory - Optional category from source data
 * @param text - The text content (word or sentence)
 * @returns Inferred category string
 */
export function inferCategory(
  rawCategory: string | undefined,
  _text: string
): string {
  if (rawCategory && rawCategory.trim().length > 0) {
    return rawCategory.trim();
  }

  throw new Error('inferCategory requires an explicit rawCategory. Keyword-based fallback has been removed.');
}

/**
 * Infers tags from sentence content (legacy function, kept for backward compatibility).
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
  if (sentence.includes('?')) {
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

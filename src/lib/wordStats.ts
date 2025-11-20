/**
 * Word Statistics Helper
 * 
 * Calculates statistics about words including total count and counts by category.
 */

import type { Word } from './types';

/**
 * Statistics about words grouped by category
 */
export type WordCategoryStats = {
  totalWords: number;
  byCategory: Record<string, number>;
};

/**
 * Calculate word statistics from an array of words
 * 
 * @param words - Array of Word objects
 * @returns Statistics including total count and counts per category
 */
export function getWordStats(words: Word[]): WordCategoryStats {
  const totalWords = words.length;
  const byCategory: Record<string, number> = {};

  // Group words by category
  for (const word of words) {
    const categoryId = word.categoryId || 'uncategorized';
    byCategory[categoryId] = (byCategory[categoryId] || 0) + 1;
  }

  return {
    totalWords,
    byCategory,
  };
}


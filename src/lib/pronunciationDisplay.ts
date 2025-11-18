/**
 * Shared utilities for displaying pronunciation feedback
 * 
 * These functions provide consistent styling, colors, and labels
 * for pronunciation scores across the application.
 */

import type { ErrorType } from '@/types/pronunciation';

/**
 * Get color class for a score (0-100)
 * Returns Tailwind classes for background and text color
 */
export function getScoreColor(score: number): string {
  if (score >= 80) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  } else if (score >= 60) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  } else if (score >= 40) {
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  } else {
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  }
}

/**
 * Get border color class for a score (0-100)
 * Used for word chips to indicate accuracy
 */
export function getScoreBorderColor(score: number): string {
  if (score >= 80) {
    return 'border-green-500';
  } else if (score >= 60) {
    return 'border-yellow-500';
  } else if (score >= 40) {
    return 'border-orange-500';
  } else {
    return 'border-red-500';
  }
}

/**
 * Get color class for error type
 * Returns Tailwind classes for error indicators
 */
export function getErrorTypeColor(errorType: ErrorType | string | undefined): string {
  if (!errorType || errorType === 'none') {
    return '';
  }

  switch (errorType) {
    case 'mispronounced':
      return 'bg-red-100 text-red-800 border-red-500 dark:bg-red-900 dark:text-red-200';
    case 'omitted':
      return 'bg-orange-100 text-orange-800 border-orange-500 dark:bg-orange-900 dark:text-orange-200';
    case 'extra':
      return 'bg-purple-100 text-purple-800 border-purple-500 dark:bg-purple-900 dark:text-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-500 dark:bg-gray-700 dark:text-gray-200';
  }
}

/**
 * Get label for error type
 */
export function getErrorTypeLabel(errorType: ErrorType | string | undefined): string {
  if (!errorType || errorType === 'none') {
    return '';
  }

  switch (errorType) {
    case 'mispronounced':
      return 'Mispronounced';
    case 'omitted':
      return 'Omitted';
    case 'extra':
      return 'Extra';
    default:
      return errorType;
  }
}

/**
 * Get icon/emoji for error type
 */
export function getErrorTypeIcon(errorType: ErrorType | string | undefined): string {
  if (!errorType || errorType === 'none') {
    return '';
  }

  switch (errorType) {
    case 'mispronounced':
      return '❌';
    case 'omitted':
      return '⏭️';
    case 'extra':
      return '➕';
    default:
      return '⚠️';
  }
}

/**
 * Get CSS classes for word feedback chip
 * Combines score color and error type styling
 */
export function getWordChipClasses(
  accuracyScore: number,
  errorType: ErrorType | string | undefined
): string {
  const baseClasses = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium border-2 transition-colors';
  
  if (errorType && errorType !== 'none') {
    return `${baseClasses} ${getErrorTypeColor(errorType)}`;
  }
  
  return `${baseClasses} ${getScoreColor(accuracyScore)} ${getScoreBorderColor(accuracyScore)}`;
}

/**
 * Format score as percentage (0-100)
 */
export function formatScore(score: number): string {
  return Math.round(score).toString();
}


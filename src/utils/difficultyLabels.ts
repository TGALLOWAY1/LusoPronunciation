import type { Difficulty } from '@/lib/types';

/**
 * Centralized difficulty label mapping.
 * Used by FilterControls and SentencePractice to ensure consistent labels.
 */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
};

/**
 * Get the display label for a difficulty level.
 * @param difficulty - The difficulty level (2-4) or null
 * @returns The label string, or null if difficulty is null
 */
export function getDifficultyLabel(difficulty: Difficulty | null): string | null {
  if (difficulty === null) {
    return null;
  }
  return DIFFICULTY_LABELS[difficulty];
}

/**
 * Get all difficulty options with labels for use in filter controls.
 * @returns Array of difficulty objects with value and label
 */
export function getDifficultyOptions(): { value: Difficulty; label: string }[] {
  return [
    { value: 2, label: DIFFICULTY_LABELS[2] },
    { value: 3, label: DIFFICULTY_LABELS[3] },
    { value: 4, label: DIFFICULTY_LABELS[4] },
  ];
}


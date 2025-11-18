import { memo } from 'react';
import type { ErrorType } from '@/types/pronunciation';
import { getWordChipClasses, getErrorTypeLabel, getErrorTypeIcon, formatScore } from '@/lib/pronunciationDisplay';

export interface WordFeedbackChipProps {
  word: string;
  accuracyScore: number;
  errorType?: ErrorType | string;
  index?: number;
}

/**
 * WordFeedbackChip displays a single word with its pronunciation feedback
 * Shows accuracy score, error type (if any), and color-coded styling
 */
function WordFeedbackChip({ word, accuracyScore, errorType }: WordFeedbackChipProps) {
  const classes = getWordChipClasses(accuracyScore, errorType);
  const errorLabel = getErrorTypeLabel(errorType);
  const errorIcon = getErrorTypeIcon(errorType);

  return (
    <span className={classes} title={errorLabel || `Accuracy: ${formatScore(accuracyScore)}%`}>
      {errorIcon && <span className="text-xs">{errorIcon}</span>}
      <span>{word}</span>
      <span className="text-xs opacity-75">({formatScore(accuracyScore)})</span>
    </span>
  );
}

export default memo(WordFeedbackChip);


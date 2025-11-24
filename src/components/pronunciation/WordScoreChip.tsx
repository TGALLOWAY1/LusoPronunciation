import type { WordFeedback } from '@/types/pronunciationFixtures';
import { getScoreColor } from '@/components/pronunciation/ScoringPanel';

interface WordScoreChipProps {
  word: WordFeedback & { score?: number };
}

/**
 * A small pill component to render a single word with color-coded feedback.
 */
export default function WordScoreChip({ word }: WordScoreChipProps) {
  const theme = getScoreColor(word.score ?? 0);
  const tooltipText = `${word.text} • ${word.score}/100${word.errorType ? ` • ${word.errorType}` : ''}`;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border transition-transform hover:scale-105 ${theme.bg.replace('bg-', 'bg- opacity-90 ')} ${theme.text} ${theme.border}`}
      title={tooltipText}
    >
      {word.text}
    </span>
  );
}


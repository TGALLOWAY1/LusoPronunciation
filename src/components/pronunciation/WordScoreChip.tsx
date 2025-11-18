import type { WordFeedback } from '@/types/pronunciationFixtures';

interface WordScoreChipProps {
  word: WordFeedback;
}

/**
 * A small pill component to render a single word with color-coded feedback.
 */
export default function WordScoreChip({ word }: WordScoreChipProps) {
  // Determine colors based on level
  const getColors = (level: WordFeedback['level']) => {
    switch (level) {
      case 'excellent':
        return {
          bg: 'bg-emerald-100 dark:bg-emerald-900/30',
          text: 'text-emerald-800 dark:text-emerald-200',
          border: 'border-emerald-300 dark:border-emerald-700',
        };
      case 'good':
        return {
          bg: 'bg-sky-100 dark:bg-sky-900/30',
          text: 'text-sky-800 dark:text-sky-200',
          border: 'border-sky-300 dark:border-sky-700',
        };
      case 'ok':
        return {
          bg: 'bg-amber-100 dark:bg-amber-900/30',
          text: 'text-amber-800 dark:text-amber-200',
          border: 'border-amber-300 dark:border-amber-700',
        };
      case 'practice':
        return {
          bg: 'bg-rose-100 dark:bg-rose-900/30',
          text: 'text-rose-800 dark:text-rose-200',
          border: 'border-rose-300 dark:border-rose-700',
        };
    }
  };

  const colors = getColors(word.level);
  const tooltipText = `${word.text} • ${word.score}/100${word.errorType ? ` • ${word.errorType}` : ''}`;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border transition-transform hover:scale-105 ${colors.bg} ${colors.text} ${colors.border}`}
      title={tooltipText}
    >
      {word.text}
    </span>
  );
}


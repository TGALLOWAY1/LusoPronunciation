import { memo } from 'react';

interface WordStatusBarProps {
  status: 'new' | 'learning' | 'review' | 'known';
  className?: string;
}

/**
 * Micro progress bar/badge showing word practice status.
 * Minimal design to avoid cluttering the card.
 */
function WordStatusBar({ status, className = '' }: WordStatusBarProps) {
  const statusConfig = {
    new: {
      label: 'New',
      colorClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    },
    learning: {
      label: 'Learning',
      colorClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
    review: {
      label: 'Review',
      colorClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    },
    known: {
      label: 'Mastered',
      colorClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
  };

  const config = statusConfig[status];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.colorClass} ${className}`}>
      {config.label}
    </span>
  );
}

export default memo(WordStatusBar);


import type { WordFeedback } from '@/types/pronunciationFixtures';
import WordScoreChip from './WordScoreChip';

interface WordScoreRowProps {
  words?: WordFeedback[];
}

/**
 * Displays a row of word score chips with a legend.
 */
export default function WordScoreRow({ words }: WordScoreRowProps) {
  if (!words || words.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
        No word-level data available yet
      </div>
    );
  }

  const legendItems: Array<{ level: WordFeedback['level']; label: string }> = [
    { level: 'excellent', label: 'Excellent (90+)' },
    { level: 'good', label: 'Good (80-89)' },
    { level: 'ok', label: 'OK (70-79)' },
    { level: 'practice', label: 'Practice (<70)' },
  ];

  const getLegendDotColor = (level: WordFeedback['level']) => {
    switch (level) {
      case 'excellent':
        return 'bg-emerald-500';
      case 'good':
        return 'bg-sky-500';
      case 'ok':
        return 'bg-amber-500';
      case 'practice':
        return 'bg-rose-500';
    }
  };

  return (
    <div className="space-y-3">
      {/* Word chips */}
      <div className="flex flex-wrap gap-2">
        {words.map((word) => (
          <WordScoreChip key={word.index} word={word} />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="font-medium">Legend:</span>
        {legendItems.map((item) => (
          <div key={item.level} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${getLegendDotColor(item.level)}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


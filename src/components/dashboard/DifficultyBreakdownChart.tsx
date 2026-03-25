import type { DifficultyStats } from '@/lib/types';
import { getDifficultyLabel } from '@/utils/difficultyLabels';

interface DifficultyBreakdownChartProps {
  data: DifficultyStats[];
}

/**
 * Large horizontal bar chart showing performance by difficulty level.
 * Desktop-only component.
 */
export default function DifficultyBreakdownChart({ data }: DifficultyBreakdownChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        No difficulty data available
      </p>
    );
  }

  // Get color for difficulty level
  const getDifficultyColor = (difficulty: number): string => {
    switch (difficulty) {
      case 2:
        return 'bg-sky-500 dark:bg-sky-600';
      case 3:
        return 'bg-amber-500 dark:bg-amber-600';
      case 4:
        return 'bg-orange-500 dark:bg-orange-600';
      default:
        return 'bg-gray-500 dark:bg-gray-600';
    }
  };

  // Get text color for difficulty level
  const getDifficultyTextColor = (difficulty: number): string => {
    switch (difficulty) {
      case 2:
        return 'text-sky-700 dark:text-sky-300';
      case 3:
        return 'text-amber-700 dark:text-amber-300';
      case 4:
        return 'text-orange-700 dark:text-orange-300';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  const maxScore = 100;

  return (
    <div className="space-y-4">
      {data
        .sort((a, b) => a.difficulty - b.difficulty)
        .map((stat) => {
          const barWidth = stat.avgOverallScore !== undefined
            ? (stat.avgOverallScore / maxScore) * 100
            : 0;
          const totalAttempts = stat.sentenceAttempts + stat.wordAttempts;

          return (
            <div 
              key={stat.difficulty} 
              className="space-y-2 group"
              title={`Difficulty ${stat.difficulty}: ${stat.avgOverallScore?.toFixed(1) || 'N/A'} avg score from ${totalAttempts} attempts`}
            >
              {/* Label and value */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-semibold ${getDifficultyTextColor(stat.difficulty)} min-w-[100px]`}>
                    {getDifficultyLabel(stat.difficulty) ?? `Difficulty ${stat.difficulty}`}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {totalAttempts} {totalAttempts === 1 ? 'attempt' : 'attempts'}
                  </span>
                  {(stat.sentencesKnownCount > 0 || stat.wordsKnownCount > 0) && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      ({stat.sentencesKnownCount + stat.wordsKnownCount} known)
                    </span>
                  )}
                </div>
                {stat.avgOverallScore !== undefined ? (
                  <span className="text-base font-bold text-gray-900 dark:text-gray-100 min-w-[50px] text-right group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {stat.avgOverallScore.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500">No data</span>
                )}
              </div>

              {/* Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-10 overflow-hidden group-hover:bg-gray-300 dark:group-hover:bg-gray-600 transition-colors">
                {stat.avgOverallScore !== undefined ? (
                  <div
                    className={`h-full transition-all duration-500 ${getDifficultyColor(stat.difficulty)} flex items-center justify-end pr-3`}
                    style={{ width: `${barWidth}%` }}
                  >
                    {barWidth >= 20 && (
                      <span className="text-sm font-semibold text-white">
                        {stat.avgOverallScore.toFixed(1)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-xs text-gray-400 dark:text-gray-500">No data</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}


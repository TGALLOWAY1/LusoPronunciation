import type { DifficultyAverage } from '@/lib/pronunciationAggregationUtils';

interface DifficultyScoreBarChartProps {
  data: DifficultyAverage[];
  maxScore?: number;
}

/**
 * Horizontal bar chart showing average overall pronunciation score by difficulty level.
 * Uses simple div-based bars for a lightweight, dependency-free visualization.
 */
export default function DifficultyScoreBarChart({
  data,
  maxScore = 100,
}: DifficultyScoreBarChartProps) {
  // Always show the chart even if all counts are 0

  // Get color for difficulty level
  const getDifficultyColor = (difficulty: number): string => {
    switch (difficulty) {
      case 1:
        return 'bg-emerald-500 dark:bg-emerald-600';
      case 2:
        return 'bg-sky-500 dark:bg-sky-600';
      case 3:
        return 'bg-amber-500 dark:bg-amber-600';
      case 4:
        return 'bg-orange-500 dark:bg-orange-600';
      case 5:
        return 'bg-rose-500 dark:bg-rose-600';
      default:
        return 'bg-gray-500 dark:bg-gray-600';
    }
  };

  // Get text color for difficulty level
  const getDifficultyTextColor = (difficulty: number): string => {
    switch (difficulty) {
      case 1:
        return 'text-emerald-700 dark:text-emerald-300';
      case 2:
        return 'text-sky-700 dark:text-sky-300';
      case 3:
        return 'text-amber-700 dark:text-amber-300';
      case 4:
        return 'text-orange-700 dark:text-orange-300';
      case 5:
        return 'text-rose-700 dark:text-rose-300';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Average Score by Difficulty Level
      </h3>
      <div className="space-y-3">
        {data.map((item) => {
          const barWidth = (item.averageScore / maxScore) * 100;
          const hasData = item.count > 0 && item.averageScore > 0;
          
          return (
            <div key={item.difficulty} className="space-y-1">
              {/* Label and value */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${getDifficultyTextColor(item.difficulty)}`}>
                    Difficulty {item.difficulty}
                  </span>
                  {hasData ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({item.count} {item.count === 1 ? 'attempt' : 'attempts'})
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      (no attempts)
                    </span>
                  )}
                </div>
                {hasData ? (
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {item.averageScore.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    N/A
                  </span>
                )}
              </div>
              
              {/* Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                {hasData ? (
                  <div
                    className={`h-full transition-all duration-500 ${getDifficultyColor(item.difficulty)} flex items-center justify-end pr-2`}
                    style={{ width: `${barWidth}%` }}
                  >
                    <span className="text-xs font-medium text-white opacity-90">
                      {barWidth >= 15 ? `${item.averageScore.toFixed(1)}` : ''}
                    </span>
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
      
      {/* Optional: Summary note */}
      {data.reduce((sum, item) => sum + item.count, 0) > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Based on {data.reduce((sum, item) => sum + item.count, 0)} total attempts
          </p>
        </div>
      )}
    </div>
  );
}


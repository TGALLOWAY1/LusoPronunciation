import type { SentencePracticeAttempt } from '@/lib/types';
import PhraseTrendSparkline from '@/components/pronunciation/shared/PhraseTrendSparkline';

interface ScoreHistoryProps {
  attempts: SentencePracticeAttempt[];
}

/**
 * ScoreHistory component displays attempt history for a sentence.
 * Shows a trend visualization and attempt count.
 */
export default function ScoreHistory({ attempts }: ScoreHistoryProps) {
  // Extract scores from attempts (most recent first, so reverse for chronological display)
  const scores = [...attempts]
    .reverse()
    .map((attempt) => attempt.overallScore);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Score History
      </h3>

      {attempts.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
            Record this sentence a few times to see your improvement over time.
          </p>
        </div>
      ) : (
        <div className="py-2">
          {/* Trend visualization with axis labels */}
          <div className="w-full">
            <PhraseTrendSparkline scores={scores} height={120} />
          </div>
          
          {/* Attempt count */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
              Attempts: <span className="font-semibold text-gray-900 dark:text-gray-100">{attempts.length}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


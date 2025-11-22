import type { SentencePracticeAttempt } from '@/lib/types';

interface AttemptHistoryProps {
  attempts: SentencePracticeAttempt[];
  selectedAttemptId: string | null;
  onSelectAttempt: (attemptId: string) => void;
}

/**
 * Formats a timestamp to a relative or absolute time string.
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    // Show date for older attempts
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Gets the color class for a score.
 */
function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 80) return 'text-sky-600 dark:text-sky-400';
  if (score >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

/**
 * AttemptHistory component displays a clickable list of previous attempts for a sentence.
 * Each attempt shows timestamp, overall score, and key metrics.
 * Clicking an attempt selects it for viewing its scoring and recording.
 * 
 * Expects attempts to be sorted by timestamp descending (most recent first).
 */
export default function AttemptHistory({
  attempts,
  selectedAttemptId,
  onSelectAttempt,
}: AttemptHistoryProps) {
  if (attempts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Attempt History
        </h3>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
            Record this sentence to see your attempts here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Attempt History
      </h3>
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {attempts.map((attempt) => {
          const isSelected = attempt.attemptId === selectedAttemptId;
          return (
            <button
              key={attempt.attemptId}
              onClick={() => onSelectAttempt(attempt.attemptId)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {formatTimestamp(attempt.createdAt)}
                </span>
                <span
                  className={`text-sm font-semibold ${getScoreColor(attempt.overallScore)}`}
                >
                  {Math.round(attempt.overallScore)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Acc: {Math.round(attempt.accuracyScore)}</span>
                {attempt.fluencyScore !== undefined && (
                  <span>Flu: {Math.round(attempt.fluencyScore)}</span>
                )}
                {attempt.completenessScore !== undefined && (
                  <span>Com: {Math.round(attempt.completenessScore)}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


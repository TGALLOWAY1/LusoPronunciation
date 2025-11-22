import type { AttemptScore } from '@/types/pronunciation';

interface ScoringPanelProps {
  currentAttempt: AttemptScore | null;
}

/**
 * Metric descriptions for tooltips.
 */
const METRIC_DESCRIPTIONS: Record<string, string> = {
  accuracy: 'How closely the pronunciation of individual sounds and words matches the target.',
  fluency: 'Smoothness and rhythm of speech, including pauses and hesitations.',
  completeness: 'How fully the user pronounced all expected words in the sentence.',
  prosody: 'Naturalness of intonation, stress, and overall speech melody.',
};

/**
 * Gets the description for a metric.
 */
function getMetricDescription(metric: string): string {
  return METRIC_DESCRIPTIONS[metric.toLowerCase()] || '';
}

/**
 * Gets the color class for a score.
 */
function getScoreColor(score: number): string {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 80) return 'bg-sky-500';
  if (score >= 70) return 'bg-amber-500';
  return 'bg-rose-500';
}

/**
 * Scoring panel component that displays pronunciation metrics.
 * Shows Overall Pronunciation Score, Accuracy, Fluency, Completeness, and Prosody.
 */
export default function ScoringPanel({ currentAttempt }: ScoringPanelProps) {
  if (!currentAttempt) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No attempt data available</p>
        </div>
      </div>
    );
  }

  const overall = Math.round(currentAttempt.overallAccuracy);
  const accuracy = Math.round(currentAttempt.overallAccuracy);
  const fluency = currentAttempt.fluency ? Math.round(currentAttempt.fluency) : null;
  const completeness = currentAttempt.completeness ? Math.round(currentAttempt.completeness) : null;
  const prosody = currentAttempt.prosody ? Math.round(currentAttempt.prosody) : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Current Score
      </h3>

      {/* Overall Pronunciation Score */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Overall Pronunciation Score
          </span>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {overall} <span className="text-lg text-gray-500 dark:text-gray-400">/ 100</span>
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${getScoreColor(overall)}`}
            style={{ width: `${overall}%` }}
          />
        </div>
      </div>

      {/* Sub-score bars */}
      <div className="space-y-4">
        {/* Accuracy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-sm text-gray-600 dark:text-gray-400 cursor-help"
              title={getMetricDescription('accuracy')}
            >
              Accuracy
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{accuracy}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-full transition-all duration-500 ${getScoreColor(accuracy)}`}
              style={{ width: `${accuracy}%` }}
            />
          </div>
        </div>

        {/* Fluency */}
        {fluency !== null && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-sm text-gray-600 dark:text-gray-400 cursor-help"
                title={getMetricDescription('fluency')}
              >
                Fluency
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{fluency}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-full transition-all duration-500 ${getScoreColor(fluency)}`}
                style={{ width: `${fluency}%` }}
              />
            </div>
          </div>
        )}

        {/* Completeness */}
        {completeness !== null && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-sm text-gray-600 dark:text-gray-400 cursor-help"
                title={getMetricDescription('completeness')}
              >
                Completeness
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{completeness}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-full transition-all duration-500 ${getScoreColor(completeness)}`}
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>
        )}

        {/* Prosody */}
        {prosody !== null && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-sm text-gray-600 dark:text-gray-400 cursor-help"
                title={getMetricDescription('prosody')}
              >
                Prosody
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{prosody}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-full transition-all duration-500 ${getScoreColor(prosody)}`}
                style={{ width: `${prosody}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


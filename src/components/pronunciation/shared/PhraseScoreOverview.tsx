import type { AttemptScore } from '@/types/pronunciation';
import type { NormalizedWordFeedback } from './types';
import PhraseTrendSparkline from './PhraseTrendSparkline';
import { getScoreFeedbackMessage } from '@/lib/scoreFeedback';
import { isSingleTokenReference } from '@/lib/referenceTokens';

interface PhraseScoreOverviewProps {
  attemptScore: AttemptScore;
  words?: NormalizedWordFeedback[];
  onWordSelected?: (word: NormalizedWordFeedback) => void;
  /**
   * Real per-attempt overall scores (oldest → newest) for the trend sparkline.
   * The sparkline is only rendered when at least two real scores are provided;
   * no synthetic history is ever invented.
   */
  trendScores?: number[];
  /**
   * Reference text (word or sentence) being scored. When it is a single token,
   * fluency/completeness/prosody are degenerate and are suppressed.
   */
  referenceText?: string;
  // onPracticeWord removed - practice functionality will be on dedicated Practice Words page
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
 * Graphical score representation with progress bars for pronunciation assessment.
 * Note: Practice-specific features (e.g., "Focus on these words") are handled
 * on a dedicated Practice Words page, not in the assessment view.
 */
export default function PhraseScoreOverview({
  attemptScore,
  words: _words,
  onWordSelected: _onWordSelected,
  trendScores,
  referenceText,
}: PhraseScoreOverviewProps) {
  // "Overall" is Azure's composite pronunciation score (PronScore) when present;
  // older logged attempts fall back to accuracy.
  const overall = Math.round(attemptScore.pronScore ?? attemptScore.overallAccuracy);
  const accuracy = Math.round(attemptScore.overallAccuracy);

  // Single-token references (individual words) make fluency/completeness/prosody
  // degenerate, so suppress them entirely.
  const singleToken = isSingleTokenReference(referenceText);
  const fluency = !singleToken && attemptScore.fluency ? Math.round(attemptScore.fluency) : null;
  const completeness =
    !singleToken && attemptScore.completeness ? Math.round(attemptScore.completeness) : null;
  const prosody = !singleToken && attemptScore.prosody ? Math.round(attemptScore.prosody) : null;

  const feedbackMessage = getScoreFeedbackMessage({
    overall,
    accuracy: attemptScore.overallAccuracy,
    fluency: singleToken ? undefined : attemptScore.fluency,
  });

  // Only render the trend when at least two real attempt scores are available.
  const showTrend = Boolean(trendScores && trendScores.length >= 2);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 80) return 'bg-sky-500';
    if (score >= 70) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
      {/* Overall score bar */}
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

      {/* Pronunciation trend sparkline — only shown with real multi-attempt history */}
      {showTrend && (
        <div className="pt-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Progress over time</span>
          </div>
          <PhraseTrendSparkline scores={trendScores!} />
        </div>
      )}

      {/* Sub-score bars */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
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

        {fluency !== null && (
          <>
            <div className="flex items-center justify-between">
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
          </>
        )}

        {completeness !== null && (
          <>
            <div className="flex items-center justify-between">
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
          </>
        )}

        {prosody !== null && (
          <>
            <div className="flex items-center justify-between">
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
          </>
        )}
      </div>

      {/* Feedback message */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-700 dark:text-gray-300 italic text-center">
          {feedbackMessage}
        </p>
      </div>
    </div>
  );
}

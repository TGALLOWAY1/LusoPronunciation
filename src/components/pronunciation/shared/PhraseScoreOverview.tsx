import type { AttemptScore } from '@/types/pronunciation';
import type { NormalizedWordFeedback } from './types';
import PhraseTrendSparkline from './PhraseTrendSparkline';

interface PhraseScoreOverviewProps {
  attemptScore: AttemptScore;
  words?: NormalizedWordFeedback[];
  onWordSelected?: (word: NormalizedWordFeedback) => void;
  /** Optional trend scores array. If provided and non-empty, uses this for sparkline. Otherwise generates synthetic data. */
  trendScores?: number[];
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
 * Generates a feedback message based on overall score.
 */
function getFeedbackMessage(overall: number): string {
  if (overall >= 90) return "Excellent pronunciation. You're sounding very natural.";
  if (overall >= 80) return "Strong overall. Focus on smoothing out your fluency.";
  if (overall >= 70) return "Good start. A bit more practice will clean up some sounds.";
  return "Keep going! Focus on listening closely to the reference audio and repeating slowly.";
}

/**
 * Generates synthetic trend data for pronunciation attempts.
 * 
 * TODO: Replace with real multi-attempt data when available.
 * This function creates 4-5 simulated attempts showing gradual improvement
 * for UX demonstration purposes only.
 * 
 * @param currentScore - The current attempt's overall score
 * @returns Array of scores representing attempt history
 */
function generateTrendData(currentScore: number): number[] {
  const numAttempts = 5;
  const scores: number[] = [currentScore];
  
  // Generate synthetic future attempts with gradual improvement
  // Each attempt improves by 2-3 points, capped at 100
  for (let i = 1; i < numAttempts; i++) {
    const improvement = 2 + Math.random(); // 2-3 points improvement
    const nextScore = Math.min(100, scores[i - 1] + improvement);
    scores.push(Math.round(nextScore * 10) / 10); // Round to 1 decimal
  }
  
  return scores;
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
}: PhraseScoreOverviewProps) {
  const overall = Math.round(attemptScore.overallAccuracy);
  const accuracy = Math.round(attemptScore.overallAccuracy);
  const fluency = attemptScore.fluency ? Math.round(attemptScore.fluency) : null;
  const completeness = attemptScore.completeness ? Math.round(attemptScore.completeness) : null;
  const prosody = attemptScore.prosody ? Math.round(attemptScore.prosody) : null;

  const feedbackMessage = getFeedbackMessage(attemptScore.overallAccuracy);

  // Use provided trend scores if available, otherwise generate synthetic data
  const displayTrendScores = trendScores && trendScores.length > 0
    ? trendScores
    : generateTrendData(attemptScore.overallAccuracy);

  // Note: Top words calculation logic kept for potential reuse, but not rendered
  // in assessment view. Practice functionality will be on dedicated Practice Words page.
  // const topWordsToPractice = words
  //   ? [...words]
  //       .filter((word) => typeof word.accuracyScore === 'number' && !isNaN(word.accuracyScore))
  //       .sort((a, b) => a.accuracyScore - b.accuracyScore)
  //       .slice(0, 3)
  //   : [];

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

      {/* Pronunciation trend sparkline */}
      <div className="pt-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {trendScores && trendScores.length > 0 ? 'Progress over time' : 'Progress over time (simulated)'}
          </span>
        </div>
        <PhraseTrendSparkline scores={displayTrendScores} />
      </div>

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


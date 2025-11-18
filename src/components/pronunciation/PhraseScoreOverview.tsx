import type { AttemptScore } from '@/types/pronunciation';
import type { WordFeedback } from '@/types/pronunciationFixtures';

interface PhraseScoreOverviewProps {
  attemptScore: AttemptScore;
  words?: WordFeedback[];
  onWordSelected?: (word: WordFeedback) => void;
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
 * Graphical score representation with progress bars and top words to practice.
 */
export default function PhraseScoreOverview({
  attemptScore,
  words,
  onWordSelected,
}: PhraseScoreOverviewProps) {
  const overall = Math.round(attemptScore.overallAccuracy);
  const accuracy = Math.round(attemptScore.overallAccuracy);
  const fluency = attemptScore.fluency ? Math.round(attemptScore.fluency) : null;
  const completeness = attemptScore.completeness ? Math.round(attemptScore.completeness) : null;
  const prosody = attemptScore.prosody ? Math.round(attemptScore.prosody) : null;

  const feedbackMessage = getFeedbackMessage(attemptScore.overallAccuracy);

  // Get top 3 words to practice (lowest scores)
  const topWordsToPractice = words
    ? [...words].sort((a, b) => a.score - b.score).slice(0, 3)
    : [];

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
            Overall Score
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Accuracy</span>
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
              <span className="text-sm text-gray-600 dark:text-gray-400">Fluency</span>
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
              <span className="text-sm text-gray-600 dark:text-gray-400">Completeness</span>
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
              <span className="text-sm text-gray-600 dark:text-gray-400">Prosody</span>
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

      {/* Top 3 words to practice */}
      {topWordsToPractice.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            🎯 Top 3 Words to Practice:
          </h4>
          <div className="flex flex-wrap gap-2">
            {topWordsToPractice.map((word) => (
              <button
                key={word.index}
                onClick={() => onWordSelected?.(word)}
                className="px-3 py-1.5 bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 rounded-full text-sm font-medium border border-rose-300 dark:border-rose-700 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors"
              >
                {word.text} ({word.score}/100)
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


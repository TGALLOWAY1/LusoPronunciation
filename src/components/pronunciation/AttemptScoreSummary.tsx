import type { AttemptScore } from '@/types/pronunciation';
import { getScoreFeedbackMessage } from '@/lib/scoreFeedback';
import { isSingleTokenReference } from '@/lib/referenceTokens';

interface AttemptScoreSummaryProps {
  attemptScore: AttemptScore;
  /**
   * Reference text (word or sentence) being scored. When it is a single token,
   * fluency/completeness/prosody are degenerate and are suppressed.
   */
  referenceText?: string;
}

/**
 * Component that summarizes the phrase-level attempt scores.
 */
export default function AttemptScoreSummary({ attemptScore, referenceText }: AttemptScoreSummaryProps) {
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
      {/* Overall score */}
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Overall Score</p>
        <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">
          {overall} <span className="text-2xl text-gray-500 dark:text-gray-400">/ 100</span>
        </p>
      </div>

      {/* Stat pills */}
      <div className="flex flex-wrap gap-2 justify-center">
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
          <span className="text-gray-600 dark:text-gray-400">Accuracy: </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{accuracy}</span>
        </div>
        {fluency !== null && (
          <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
            <span className="text-gray-600 dark:text-gray-400">Fluency: </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{fluency}</span>
          </div>
        )}
        {completeness !== null && (
          <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
            <span className="text-gray-600 dark:text-gray-400">Completeness: </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{completeness}</span>
          </div>
        )}
        {prosody !== null && (
          <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
            <span className="text-gray-600 dark:text-gray-400">Prosody: </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{prosody}</span>
          </div>
        )}
      </div>

      {/* Feedback message */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-700 dark:text-gray-300 text-center italic">
          {feedbackMessage}
        </p>
      </div>
    </div>
  );
}

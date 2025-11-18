import type { AttemptScore } from '@/types/pronunciation';

interface AttemptScoreSummaryProps {
  attemptScore: AttemptScore;
}

/**
 * Generates a feedback message based on overall score and sub-scores.
 */
function getFeedbackMessage(overall: number): string {
  if (overall >= 90) return "Excellent pronunciation. You're sounding very natural.";
  if (overall >= 80) return "Strong overall. Focus on smoothing out your fluency.";
  if (overall >= 70) return "Good start. A bit more practice will clean up some sounds.";
  return "Keep going! Focus on listening closely to the reference audio and repeating slowly.";
}

/**
 * Component that summarizes the phrase-level attempt scores.
 */
export default function AttemptScoreSummary({ attemptScore }: AttemptScoreSummaryProps) {
  const overall = Math.round(attemptScore.overallAccuracy);
  const accuracy = Math.round(attemptScore.overallAccuracy);
  const fluency = attemptScore.fluency ? Math.round(attemptScore.fluency) : null;
  const completeness = attemptScore.completeness ? Math.round(attemptScore.completeness) : null;
  const prosody = attemptScore.prosody ? Math.round(attemptScore.prosody) : null;

  const feedbackMessage = getFeedbackMessage(attemptScore.overallAccuracy);

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


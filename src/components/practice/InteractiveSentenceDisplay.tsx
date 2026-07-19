import { getScoreColor } from '@/components/pronunciation/ScoringPanel';

interface WordScore {
  word: string;
  /** Score for this word, or null when the sentence hasn't been scored yet. */
  overallScore: number | null;
  [key: string]: any;
}

interface InteractiveSentenceDisplayProps {
  sentenceText: string;
  wordScores: WordScore[];
  onWordClick: (wordData: WordScore, index: number) => void;
}

/**
 * Score badge colors, matching the light "pill" treatment ScoringPanel uses
 * for its overall-score label (color + number, not color alone).
 */
function getScoreBadgeClasses(score: number): string {
  if (score >= 80) {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
  if (score >= 60) {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }
  return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
}

/**
 * The practice sentence, one button per word. Before an attempt every word
 * gets a neutral underline; after scoring the underline takes the score color
 * and a small numeric badge appears below the word (so the score isn't
 * conveyed by color alone), and the word becomes clickable to inspect its
 * sounds.
 */
export default function InteractiveSentenceDisplay({
  sentenceText,
  wordScores,
  onWordClick,
}: InteractiveSentenceDisplayProps) {
  const tokens = sentenceText.trim().split(/\s+/);

  return (
    <div className="flex flex-wrap justify-center items-start gap-x-3 gap-y-2">
      {tokens.map((token, index) => {
        const wordData = wordScores[index];
        const score = wordData?.overallScore ?? null;
        const isScored = score !== null;
        const theme = isScored ? getScoreColor(score) : null;
        const borderClass = theme ? theme.border : 'border-gray-200 dark:border-gray-700';
        const textClass = theme ? theme.text : '';

        return (
          <div key={`${token}-${index}`} className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => isScored && wordData && onWordClick(wordData, index)}
              disabled={!isScored}
              title={isScored ? `Tap to see sound tips for "${token}"` : undefined}
              className={`text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 ${textClass} border-b-4 transition-all pb-1 rounded-sm ${borderClass} ${
                isScored
                  ? 'cursor-pointer hover:opacity-80'
                  : 'cursor-default'
              }`}
            >
              {token}
            </button>
            {isScored && (
              <span
                className={`text-xs font-semibold leading-none px-1.5 py-0.5 rounded-full ${getScoreBadgeClasses(score)}`}
              >
                {Math.round(score)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

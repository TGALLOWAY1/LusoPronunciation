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
 * The practice sentence, one button per word. Before an attempt every word
 * gets a neutral underline; after scoring the underline takes the score color
 * and the word becomes clickable to inspect its sounds.
 */
export default function InteractiveSentenceDisplay({
  sentenceText,
  wordScores,
  onWordClick,
}: InteractiveSentenceDisplayProps) {
  const tokens = sentenceText.trim().split(/\s+/);

  return (
    <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2">
      {tokens.map((token, index) => {
        const wordData = wordScores[index];
        const score = wordData?.overallScore ?? null;
        const isScored = score !== null;
        const theme = isScored ? getScoreColor(score) : null;
        const borderClass = theme ? theme.border : 'border-gray-200 dark:border-gray-700';
        const textClass = theme ? theme.text : '';

        return (
          <button
            type="button"
            key={`${token}-${index}`}
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
        );
      })}
    </div>
  );
}

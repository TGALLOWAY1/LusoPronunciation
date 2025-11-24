import { getScoreColor } from '@/components/pronunciation/ScoringPanel';

interface WordScore {
  word: string;
  overallScore: number;
  [key: string]: any;
}

interface InteractiveSentenceDisplayProps {
  sentenceText: string;
  wordScores: WordScore[];
  onWordClick: (wordData: WordScore, index: number) => void;
}

export default function InteractiveSentenceDisplay({
  sentenceText,
  wordScores,
  onWordClick,
}: InteractiveSentenceDisplayProps) {
  const tokens = sentenceText.trim().split(/\s+/);

  return (
    <div className="flex flex-wrap justify-center items-center gap-3">
      {tokens.map((token, index) => {
        const wordData = wordScores[index];
        const score = wordData?.overallScore ?? null;
        const theme = score !== null ? getScoreColor(score) : null;
        const borderClass = theme ? `${theme.border}` : 'border-gray-300 dark:border-gray-600';
        const textClass = theme ? theme.text : '';

        return (
          <button
            type="button"
            key={`${token}-${index}`}
            onClick={() => wordData && onWordClick(wordData, index)}
            className={`text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 ${textClass} border-b-4 transition-all pb-1 rounded-sm ${borderClass} ${
              wordData ? '' : 'opacity-70'
            }`}
          >
            {token}
          </button>
        );
      })}
    </div>
  );
}


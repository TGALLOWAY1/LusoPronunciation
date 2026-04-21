import { useEffect, useMemo, useState } from 'react';
import type { AttemptScore } from '@/types/pronunciation';
import type { NormalizedWordFeedback } from '@/components/pronunciation/shared/types';
import InteractiveSentenceDisplay from '@/components/practice/InteractiveSentenceDisplay';
import PhonemeDetailList from '@/components/practice/PhonemeDetailList';

interface TokenWordScore {
  word: string;
  overallScore: number;
  normalizedWord?: NormalizedWordFeedback;
}

interface SentenceResultViewProps {
  sentenceText: string;
  tokenWordScores: TokenWordScore[];
  words: NormalizedWordFeedback[];
  attempt: AttemptScore;
  difficulty?: number;
  activeTab: 'practice' | 'history';
  onTabChange: (tab: 'practice' | 'history') => void;
}

function getLevelLabel(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'ok';
  return 'practice';
}

function formatAttemptTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function getWordKey(word: NormalizedWordFeedback): string {
  if (word.index !== undefined) return `idx-${word.index}`;
  return `id-${word.id}`;
}

export default function SentenceResultView({
  sentenceText,
  tokenWordScores,
  words,
  attempt,
  difficulty,
  activeTab,
  onTabChange,
}: SentenceResultViewProps) {
  const [selectedWordKey, setSelectedWordKey] = useState<string | null>(null);

  // Auto-select first word when attempt changes (or on mount).
  useEffect(() => {
    if (words.length > 0) {
      setSelectedWordKey(getWordKey(words[0]));
    } else {
      setSelectedWordKey(null);
    }
  }, [attempt.attemptId, words]);

  const selectedWord = useMemo(() => {
    if (!selectedWordKey) return null;
    return words.find((w) => getWordKey(w) === selectedWordKey) ?? null;
  }, [selectedWordKey, words]);

  const selectedIndex = useMemo(() => {
    if (!selectedWord) return null;
    if (selectedWord.index !== undefined) return selectedWord.index;
    const parsed = Number(selectedWord.id);
    return Number.isFinite(parsed) ? parsed : null;
  }, [selectedWord]);

  const handleWordClick = (_wordData: TokenWordScore, index: number) => {
    const match = words.find((w) => {
      if (w.index !== undefined) return w.index === index;
      const parsed = Number(w.id);
      return parsed === index;
    });
    if (match) {
      setSelectedWordKey(getWordKey(match));
    }
  };

  const overallScore = Math.round(attempt.overallAccuracy);
  const levelLabel = getLevelLabel(overallScore);
  const timestamp = formatAttemptTimestamp(attempt.createdAt);

  return (
    <div className="space-y-6">
      {/* Header row: difficulty pill + timestamp (left), tabs (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          {difficulty !== undefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200">
              Difficulty {difficulty}
            </span>
          )}
          <span className="text-gray-500 dark:text-gray-400">{timestamp}</span>
        </div>
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onTabChange('practice')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'practice'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Practice
          </button>
          <button
            onClick={() => onTabChange('history')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {/* Sentence - dominant, centered */}
      <div className="pt-2">
        <InteractiveSentenceDisplay
          sentenceText={sentenceText}
          wordScores={tokenWordScores}
          onWordClick={handleWordClick}
          selectedIndex={selectedIndex}
        />
      </div>

      {/* Score line */}
      <p className="text-center text-base text-gray-800 dark:text-gray-200">
        Overall score: {overallScore}/100 <span className="text-gray-400 dark:text-gray-500">•</span> Level: {levelLabel}
      </p>

      {/* Selected word block */}
      {selectedWord && (
        <div className="pt-2">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {selectedWord.text}
          </h3>
          <PhonemeDetailList word={selectedWord} />
        </div>
      )}
    </div>
  );
}

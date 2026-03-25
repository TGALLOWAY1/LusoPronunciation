import { memo } from 'react';
import type { Word } from '@/lib/types';
import WordAudioButton from './WordAudioButton';
import WordStatusBar from './WordStatusBar';

interface WordStudyCardProps {
  word: Word;
  status?: 'new' | 'learning' | 'review' | 'known';
}

/**
 * Simplified word card for study/learning mode.
 * Shows word, translation, and a play button using the selected voice from settings.
 * No recording, no assessment, no "Know it" button.
 */
function WordStudyCard({ word, status }: WordStudyCardProps) {
  const difficultyColors = {
    2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    4: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };

  const difficultyLabels = {
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
  };

  return (
    <div className="card card-hover card-compact relative">
      {/* Header with status, category and difficulty */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {status && <WordStatusBar status={status} />}
          <span className="badge badge-secondary">
            {word.categoryLabelEn}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {word.difficultForEnglish && (
            <span className="badge badge-warning">
              ⚠️ Tricky
            </span>
          )}
          <span
            className={`badge ${difficultyColors[word.difficulty]}`}
          >
            {difficultyLabels[word.difficulty]}
          </span>
        </div>
      </div>

      {/* Portuguese word - large and prominent */}
      <div className="mb-3">
        <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {word.textPt}
        </p>
      </div>

      {/* English translation */}
      <div className="mb-4">
        <p className="text-base text-gray-600 dark:text-gray-300 italic">
          {word.translationEn}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {word.partOfSpeech}
        </p>
      </div>

      {/* Pronunciation notes */}
      {word.pronunciationNotes && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 rounded text-sm">
          <p className="text-blue-800 dark:text-blue-300">{word.pronunciationNotes}</p>
        </div>
      )}

      {/* Audio playback control - single button using selected voice from settings */}
      <div className="mb-4 flex gap-2">
        <WordAudioButton wordId={word.id} label="Play" compact={false} />
      </div>
    </div>
  );
}

export default memo(WordStudyCard);


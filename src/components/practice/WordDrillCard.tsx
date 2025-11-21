import { memo } from 'react';
import type { Word } from '@/lib/types';
import WordAudioButton from './WordAudioButton';

interface WordDrillCardProps {
  word: Word;
  showTranslation: boolean;
  onKnowIt: () => void;
  onDontKnowIt: () => void;
}

/**
 * Word card specifically for drill mode.
 * Shows word with optional translation toggle and Know it/Don't know it buttons.
 */
function WordDrillCard({ word, showTranslation, onKnowIt, onDontKnowIt }: WordDrillCardProps) {
  const difficultyColors = {
    1: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    4: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    5: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  const difficultyLabels = {
    1: 'Very Easy',
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
    5: 'Very Hard',
  };

  return (
    <div className="card card-hover">
      {/* Header with category and difficulty */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <span className="badge badge-secondary">
          {word.categoryLabelEn}
        </span>
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
      <div className="mb-4">
        <p className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 text-center">
          {word.textPt}
        </p>
      </div>

      {/* English translation - only shown if toggle is on */}
      {showTranslation && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-lg text-gray-700 dark:text-gray-300 italic text-center">
            {word.translationEn}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
            {word.partOfSpeech}
          </p>
        </div>
      )}

      {/* Pronunciation notes */}
      {word.pronunciationNotes && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 rounded text-sm">
          <p className="text-blue-800 dark:text-blue-300">{word.pronunciationNotes}</p>
        </div>
      )}

      {/* Audio playback control */}
      <div className="mb-6 flex justify-center">
        <WordAudioButton wordId={word.id} label="Play Pronunciation" compact={false} />
      </div>

      {/* Action buttons - Know it / Don't know it */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onKnowIt}
          className="btn btn-success btn-md flex-1"
        >
          ✓ Know it
        </button>
        <button
          onClick={onDontKnowIt}
          className="btn btn-danger btn-md flex-1"
        >
          ✗ Don't know it
        </button>
      </div>
    </div>
  );
}

export default memo(WordDrillCard);


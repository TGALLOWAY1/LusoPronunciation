import { memo, useCallback } from 'react';
import type { Word } from '@/lib/types';
import AudioPlayerButton from './AudioPlayerButton';

interface WordCardProps {
  word: Word;
  onKnowIt: (wordId: string) => void;
  onReviewLater: (wordId: string) => void;
}

function WordCard({ word, onKnowIt, onReviewLater }: WordCardProps) {
  const handleKnowIt = useCallback(() => {
    onKnowIt(word.id);
  }, [word.id, onKnowIt]);

  const handleReviewLater = useCallback(() => {
    onReviewLater(word.id);
  }, [word.id, onReviewLater]);
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
    <div className="card card-hover card-compact">
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

      {/* Audio playback controls */}
      {(word.audioMaleUrl || word.audioFemaleUrl) && (
        <div className="mb-4 flex gap-2">
          {word.audioMaleUrl && (
            <AudioPlayerButton
              audioUrl={word.audioMaleUrl}
              label="Male"
              icon="👨"
              variant="male"
              compact={true}
            />
          )}
          {word.audioFemaleUrl && (
            <AudioPlayerButton
              audioUrl={word.audioFemaleUrl}
              label="Female"
              icon="👩"
              variant="female"
              compact={true}
            />
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleKnowIt}
          className="btn btn-success btn-sm flex-1"
        >
          ✓ Know it
        </button>
        <button
          onClick={handleReviewLater}
          className="btn btn-secondary btn-sm flex-1"
        >
          ⏰ Review later
        </button>
      </div>
    </div>
  );
}

export default memo(WordCard);


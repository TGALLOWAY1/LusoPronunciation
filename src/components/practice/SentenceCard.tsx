import { memo } from 'react';
import type { Sentence } from '@/lib/types';
import AudioPlayerButton from './AudioPlayerButton';

interface SentenceCardProps {
  sentence: Sentence;
  currentIndex: number;
  totalCount: number;
}

function SentenceCard({ sentence, currentIndex, totalCount }: SentenceCardProps) {
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
    <div className="card card-hover p-6 md:p-8">
      {/* Progress indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {currentIndex + 1} of {totalCount}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`badge ${difficultyColors[sentence.difficulty]}`}
          >
            {difficultyLabels[sentence.difficulty]}
          </span>
          <span className="badge badge-secondary">
            {sentence.categoryLabelEn}
          </span>
        </div>
      </div>

      {/* Portuguese sentence - prominent */}
      <div className="mb-6">
        <p className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-relaxed">
          {sentence.textPt}
        </p>
      </div>

      {/* English translation - smaller, lighter */}
      <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
        <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 italic">
          {sentence.translationEn}
        </p>
      </div>

      {/* Audio playback controls */}
      {(sentence.audioMaleUrl || sentence.audioFemaleUrl) && (
        <div className="mb-6 flex gap-3">
          {sentence.audioMaleUrl && (
            <AudioPlayerButton
              audioUrl={sentence.audioMaleUrl}
              label="Male Voice"
              icon="👨"
              variant="male"
            />
          )}
          {sentence.audioFemaleUrl && (
            <AudioPlayerButton
              audioUrl={sentence.audioFemaleUrl}
              label="Female Voice"
              icon="👩"
              variant="female"
            />
          )}
        </div>
      )}

      {/* Pronunciation tips */}
      {sentence.pronunciationNotes && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 rounded">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">💡 Pronunciation Tip</p>
          <p className="text-sm text-blue-800 dark:text-blue-300">{sentence.pronunciationNotes}</p>
        </div>
      )}

      {/* Category info (optional, subtle) */}
      <div className="text-xs text-gray-400 dark:text-gray-500">
        Category: {sentence.categoryLabelPt}
      </div>
    </div>
  );
}

export default memo(SentenceCard);


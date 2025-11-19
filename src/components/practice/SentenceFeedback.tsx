import { memo } from 'react';
import type { ErrorType } from '@/types/pronunciation';
import type { PhonemeFeedback } from '@/types/pronunciationFixtures';
import WordFeedbackChip from './WordFeedbackChip';
import PhonemeChip from '../pronunciation/PhonemeChip';
import { getScoreColor, formatScore } from '@/lib/pronunciationDisplay';

export interface OverallScores {
  accuracy: number;
  fluency?: number;
  completeness?: number;
  prosody?: number;
  pronScore?: number; // Overall pronunciation score (if available)
}

export interface WordFeedback {
  index: number;
  text: string;
  accuracyScore: number;
  errorType?: ErrorType | string;
  phonemes?: PhonemeFeedback[]; // Optional phoneme data
}

export interface SentenceFeedbackProps {
  overall: OverallScores;
  words: WordFeedback[];
}

/**
 * SentenceFeedback displays pronunciation assessment results
 * Shows overall scores (accuracy, fluency, completeness, prosody) and word-level feedback
 */
function SentenceFeedback({ overall, words }: SentenceFeedbackProps) {
  return (
    <div className="mt-6 space-y-4">
      {/* Overall Score Summary */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Pronunciation Feedback
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Accuracy</p>
            <p className={`text-lg font-semibold ${getScoreColor(overall.accuracy)} px-2 py-1 rounded inline-block`}>
              {formatScore(overall.accuracy)} / 100
            </p>
          </div>
          {overall.fluency !== undefined && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fluency</p>
              <p className={`text-lg font-semibold ${getScoreColor(overall.fluency)} px-2 py-1 rounded inline-block`}>
                {formatScore(overall.fluency)} / 100
              </p>
            </div>
          )}
          {overall.completeness !== undefined && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Completeness</p>
              <p className={`text-lg font-semibold ${getScoreColor(overall.completeness)} px-2 py-1 rounded inline-block`}>
                {formatScore(overall.completeness)} / 100
              </p>
            </div>
          )}
          {overall.prosody !== undefined && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Prosody</p>
              <p className={`text-lg font-semibold ${getScoreColor(overall.prosody)} px-2 py-1 rounded inline-block`}>
                {formatScore(overall.prosody)} / 100
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Word-level Feedback */}
      {words.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Word-by-Word Feedback
          </h4>
          <div className="space-y-3">
            {words.map((word, index) => (
              <div key={index} className="space-y-1.5">
                <WordFeedbackChip
                  word={word.text}
                  accuracyScore={word.accuracyScore}
                  errorType={word.errorType}
                  index={word.index}
                />
                {/* Phoneme chips under each word */}
                {word.phonemes && word.phonemes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 ml-1">
                    {word.phonemes.map((phoneme, phonemeIndex) => (
                      <PhonemeChip
                        key={phonemeIndex}
                        symbol={phoneme.symbol}
                        score={phoneme.score}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(SentenceFeedback);


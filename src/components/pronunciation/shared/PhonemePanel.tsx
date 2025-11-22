import type { NormalizedWordFeedback } from './types';
import { getPhonemeMetadata } from '@/lib/phonemeMetadata';

interface PhonemePanelProps {
  word?: NormalizedWordFeedback | null;
  onClose?: () => void;
}

/**
 * Panel displaying phoneme details and tips for a selected word.
 */
export default function PhonemePanel({ word, onClose }: PhonemePanelProps) {
  // Empty state: no word selected
  if (!word) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Sound Details (Phonemes & Tips)
        </h3>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Click a word in the sentence to see tips for its sounds.
          </p>
        </div>
      </div>
    );
  }

  const getPhonemeColors = (score: number) => {
    if (score >= 90) {
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        text: 'text-emerald-800 dark:text-emerald-200',
        border: 'border-emerald-300 dark:border-emerald-700',
      };
    }
    if (score >= 80) {
      return {
        bg: 'bg-sky-100 dark:bg-sky-900/30',
        text: 'text-sky-800 dark:text-sky-200',
        border: 'border-sky-300 dark:border-sky-700',
      };
    }
    if (score >= 70) {
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-800 dark:text-amber-200',
        border: 'border-amber-300 dark:border-amber-700',
      };
    }
    return {
      bg: 'bg-rose-100 dark:bg-rose-900/30',
      text: 'text-rose-800 dark:text-rose-200',
      border: 'border-rose-300 dark:border-rose-700',
    };
  };

  const problemPhonemes = word.phonemes?.filter(p => p.isProblem) || [];
  const wordScore = word.score ?? word.accuracyScore;
  const wordLevel = word.level || (wordScore >= 90 ? 'excellent' : wordScore >= 80 ? 'good' : wordScore >= 70 ? 'ok' : 'practice');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Sound Details (Phonemes & Tips)
          </h3>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            <span className="text-primary-600 dark:text-primary-400">{word.text}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Overall score: {wordScore}/100 • Level: {wordLevel}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Phoneme chips */}
      {word.phonemes && word.phonemes.length > 0 ? (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Phonemes:
          </h4>
          <div className="flex flex-wrap gap-2">
            {word.phonemes.map((phoneme, index) => {
              const colors = getPhonemeColors(phoneme.score);
              const metadata = getPhonemeMetadata(phoneme.symbol);
              
              // Build enriched tooltip
              let tooltipText = `${phoneme.symbol} • ${phoneme.score}/100`;
              if (metadata) {
                tooltipText += ` • ${metadata.description}`;
                if (metadata.portugueseExamples.length > 0) {
                  tooltipText += ` • PT: ${metadata.portugueseExamples[0]}`;
                }
                if (metadata.englishExamples.length > 0) {
                  tooltipText += ` • EN: ${metadata.englishExamples[0]}`;
                }
              } else if (phoneme.tip) {
                tooltipText += ` • ${phoneme.tip}`;
              }
              
              return (
                <span
                  key={index}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border transition-transform hover:scale-105 ${colors.bg} ${colors.text} ${colors.border}`}
                  title={tooltipText}
                >
                  {phoneme.symbol}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            No phoneme data available for this word yet.
          </p>
        </div>
      )}

      {/* How to pronounce these sounds */}
      {word.phonemes && word.phonemes.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            🔊 How to pronounce these sounds:
          </h4>
          <div className="space-y-3">
            {word.phonemes.map((phoneme, index) => {
              const metadata = getPhonemeMetadata(phoneme.symbol);
              
              if (metadata) {
                return (
                  <div
                    key={index}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {phoneme.symbol}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          <strong>How to say it:</strong> {metadata.description}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
                          {metadata.portugueseExamples.length > 0 && (
                            <span>
                              <strong>PT:</strong> <em>{metadata.portugueseExamples.join(', ')}</em>
                            </span>
                          )}
                          {metadata.englishExamples.length > 0 && (
                            <span>
                              <strong>EN:</strong> <em>{metadata.englishExamples.join(', ')}</em>
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {phoneme.score}/100
                      </span>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={index}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {phoneme.symbol}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          No extra info available for this sound yet.
                        </p>
                        {phoneme.tip && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {phoneme.tip}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {phoneme.score}/100
                      </span>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}

      {/* Tips section for problem phonemes */}
      {problemPhonemes.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            💡 Focus Areas:
          </h4>
          <ul className="space-y-2">
            {problemPhonemes.map((phoneme, index) => {
              const metadata = getPhonemeMetadata(phoneme.symbol);
              return (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="text-rose-500 dark:text-rose-400 mt-0.5">•</span>
                  <span>
                    <strong className="font-medium">{phoneme.symbol}:</strong>{' '}
                    {phoneme.tip || metadata?.description || `Score: ${phoneme.score}/100 - needs practice`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {problemPhonemes.length === 0 && word.phonemes && word.phonemes.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            ✅ All phonemes are performing well!
          </p>
        </div>
      )}
    </div>
  );
}

